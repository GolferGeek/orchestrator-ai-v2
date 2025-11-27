import { StateGraph, END, interrupt, Command } from '@langchain/langgraph';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import {
  ExtendedPostWriterStateAnnotation,
  ExtendedPostWriterState,
  GeneratedContent,
  HitlResponse,
} from './extended-post-writer.state';
import { LLMHttpClientService } from '../../services/llm-http-client.service';
import { ObservabilityService } from '../../services/observability.service';
import { PostgresCheckpointerService } from '../../persistence/postgres-checkpointer.service';

const AGENT_SLUG = 'extended-post-writer';

/**
 * Create the Extended Post Writer graph with HITL
 *
 * Flow:
 * 1. Start → Generate blog post ONLY
 * 2. Generate blog → HITL interrupt (wait for approval of blog post)
 * 3. HITL resume → Process decision
 *    - approve/edit → Generate supporting content (SEO + social) → Finalize
 *    - reject → End with rejection
 * 4. Finalize → End
 */
export function createExtendedPostWriterGraph(
  llmClient: LLMHttpClientService,
  observability: ObservabilityService,
  checkpointer: PostgresCheckpointerService,
) {
  // Node: Start
  async function startNode(
    state: ExtendedPostWriterState,
  ): Promise<Partial<ExtendedPostWriterState>> {
    await observability.emitStarted({
      taskId: state.taskId,
      threadId: state.threadId,
      agentSlug: AGENT_SLUG,
      userId: state.userId,
      conversationId: state.conversationId,
      organizationSlug: state.organizationSlug,
      message: `Starting content generation for topic: ${state.userMessage}`,
    });

    return {
      status: 'generating',
      startedAt: Date.now(),
      messages: [new HumanMessage(`Create content about: ${state.userMessage}`)],
    };
  }

  // Node: Generate blog post ONLY (before HITL)
  async function generateBlogPostNode(
    state: ExtendedPostWriterState,
  ): Promise<Partial<ExtendedPostWriterState>> {
    await observability.emitProgress({
      taskId: state.taskId,
      threadId: state.threadId,
      agentSlug: AGENT_SLUG,
      userId: state.userId,
      conversationId: state.conversationId,
      message: 'Generating blog post for review',
      step: 'generate_blog_post',
      progress: 30,
    });

    const keywordsStr = state.keywords.length > 0
      ? `Keywords to include: ${state.keywords.join(', ')}`
      : '';

    const contextStr = state.context
      ? `Additional context: ${state.context}`
      : '';

    const prompt = `You are a professional content writer. Create a compelling blog post for the following topic.

Topic: ${state.userMessage}
Tone: ${state.tone}
${keywordsStr}
${contextStr}

Generate a well-structured blog post (800-1200 words) with:
- An engaging introduction that hooks the reader
- Clear body sections with subheadings (use markdown ## for headings)
- A compelling conclusion with a call to action

Return ONLY the blog post content in markdown format, no additional text or JSON wrapping.`;

    try {
      const response = await llmClient.callLLM({
        userMessage: prompt,
        provider: state.provider,
        model: state.model,
        userId: state.userId,
        callerName: AGENT_SLUG,
      });

      const blogPost = response.text.trim();

      return {
        generatedContent: {
          blogPost,
          seoDescription: '', // Will be generated after approval
          socialPosts: [],    // Will be generated after approval
        },
        messages: [
          ...state.messages,
          new AIMessage('Blog post generated. Please review before we generate SEO and social content.'),
        ],
      };
    } catch (error) {
      return {
        error: `Failed to generate blog post: ${error instanceof Error ? error.message : String(error)}`,
        status: 'failed',
      };
    }
  }

  // Node: Generate supporting content (SEO + social) AFTER HITL approval
  async function generateSupportingContentNode(
    state: ExtendedPostWriterState,
  ): Promise<Partial<ExtendedPostWriterState>> {
    await observability.emitProgress({
      taskId: state.taskId,
      threadId: state.threadId,
      agentSlug: AGENT_SLUG,
      userId: state.userId,
      conversationId: state.conversationId,
      message: 'Generating SEO description and social posts based on approved blog',
      step: 'generate_supporting_content',
      progress: 70,
    });

    // Use the approved/edited blog post
    const approvedBlogPost = state.finalContent?.blogPost || state.generatedContent?.blogPost || '';

    const prompt = `Based on the following approved blog post, create supporting marketing content.

APPROVED BLOG POST:
${approvedBlogPost}

Generate the following in JSON format:
{
  "seoDescription": "A compelling SEO meta description (150-160 characters) that captures the main value proposition and includes relevant keywords.",
  "socialPosts": [
    "Twitter/X post (under 280 characters) - engaging hook with key insight",
    "LinkedIn post (2-3 paragraphs, professional tone) - valuable takeaways from the blog",
    "Instagram caption (engaging, conversational, with 3-5 relevant hashtags)"
  ]
}

Return ONLY the JSON object, no additional text.`;

    try {
      const response = await llmClient.callLLM({
        userMessage: prompt,
        provider: state.provider,
        model: state.model,
        userId: state.userId,
        callerName: AGENT_SLUG,
      });

      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse supporting content');
      }

      const supportingContent = JSON.parse(jsonMatch[0]) as {
        seoDescription: string;
        socialPosts: string[];
      };

      return {
        finalContent: {
          blogPost: approvedBlogPost,
          seoDescription: supportingContent.seoDescription,
          socialPosts: supportingContent.socialPosts,
        },
        status: 'finalizing',
        messages: [
          ...state.messages,
          new AIMessage('SEO and social content generated. Finalizing...'),
        ],
      };
    } catch (error) {
      return {
        error: `Failed to generate supporting content: ${error instanceof Error ? error.message : String(error)}`,
        status: 'failed',
      };
    }
  }

  // Node: HITL interrupt - waits for human approval
  async function hitlInterruptNode(
    state: ExtendedPostWriterState,
  ): Promise<Partial<ExtendedPostWriterState>> {
    await observability.emitHitlWaiting({
      taskId: state.taskId,
      threadId: state.threadId,
      agentSlug: AGENT_SLUG,
      userId: state.userId,
      conversationId: state.conversationId,
      message: 'Content ready for review',
      pendingContent: state.generatedContent,
    });

    // This is where interrupt() is called - ONLY in graph nodes
    const response = interrupt({
      reason: 'human_review',
      taskId: state.taskId,
      threadId: state.threadId,
      agentSlug: AGENT_SLUG,
      contentType: 'extended_post',
      pendingContent: state.generatedContent,
      message: 'Please review the generated content and approve, edit, or reject.',
    });

    // When resumed, response will contain the HITL decision
    return {
      hitlPending: false,
      hitlResponse: response as HitlResponse,
      status: 'hitl_resumed',
    };
  }

  // Node: Process HITL decision
  async function processHitlDecisionNode(
    state: ExtendedPostWriterState,
  ): Promise<Partial<ExtendedPostWriterState>> {
    const response = state.hitlResponse;

    if (!response) {
      return {
        error: 'No HITL response received',
        status: 'failed',
      };
    }

    await observability.emitHitlResumed({
      taskId: state.taskId,
      threadId: state.threadId,
      agentSlug: AGENT_SLUG,
      userId: state.userId,
      conversationId: state.conversationId,
      decision: response.decision,
      message: response.feedback || `Decision: ${response.decision}`,
    });

    switch (response.decision) {
      case 'approve':
        // Store approved blog post, will generate SEO + social next
        return {
          finalContent: {
            blogPost: state.generatedContent?.blogPost || '',
            seoDescription: '',
            socialPosts: [],
          },
          status: 'generating_supporting',
          messages: [
            ...state.messages,
            new AIMessage('Blog post approved! Now generating SEO and social content...'),
          ],
        };

      case 'edit':
        // Use edited blog post if provided, otherwise use original
        const editedBlogPost = response.editedContent?.blogPost || state.generatedContent?.blogPost || '';
        return {
          finalContent: {
            blogPost: editedBlogPost,
            seoDescription: '',
            socialPosts: [],
          },
          status: 'generating_supporting',
          messages: [
            ...state.messages,
            new AIMessage('Edited blog post received! Now generating SEO and social content...'),
          ],
        };

      case 'reject':
        return {
          status: 'rejected',
          completedAt: Date.now(),
          messages: [
            ...state.messages,
            new AIMessage(
              `Content rejected. Feedback: ${response.feedback || 'No feedback provided'}`,
            ),
          ],
        };

      default:
        return {
          error: `Unknown HITL decision: ${response.decision}`,
          status: 'failed',
        };
    }
  }

  // Node: Finalize content
  async function finalizeNode(
    state: ExtendedPostWriterState,
  ): Promise<Partial<ExtendedPostWriterState>> {
    await observability.emitProgress({
      taskId: state.taskId,
      threadId: state.threadId,
      agentSlug: AGENT_SLUG,
      userId: state.userId,
      conversationId: state.conversationId,
      message: 'Finalizing approved content',
      step: 'finalize',
      progress: 90,
    });

    await observability.emitCompleted({
      taskId: state.taskId,
      threadId: state.threadId,
      agentSlug: AGENT_SLUG,
      userId: state.userId,
      conversationId: state.conversationId,
      result: { content: state.finalContent },
      duration: Date.now() - state.startedAt,
    });

    return {
      status: 'completed',
      completedAt: Date.now(),
      messages: [
        ...state.messages,
        new AIMessage('Content finalized and ready for publishing.'),
      ],
    };
  }

  // Node: Handle rejection
  async function rejectedNode(
    state: ExtendedPostWriterState,
  ): Promise<Partial<ExtendedPostWriterState>> {
    await observability.emitFailed({
      taskId: state.taskId,
      threadId: state.threadId,
      agentSlug: AGENT_SLUG,
      userId: state.userId,
      conversationId: state.conversationId,
      error: `Content rejected: ${state.hitlResponse?.feedback || 'No reason given'}`,
      duration: Date.now() - state.startedAt,
    });

    return {
      completedAt: Date.now(),
    };
  }

  // Node: Handle errors (named 'handle_error' to avoid conflict with 'error' state channel)
  async function handleErrorNode(
    state: ExtendedPostWriterState,
  ): Promise<Partial<ExtendedPostWriterState>> {
    await observability.emitFailed({
      taskId: state.taskId,
      threadId: state.threadId,
      agentSlug: AGENT_SLUG,
      userId: state.userId,
      conversationId: state.conversationId,
      error: state.error || 'Unknown error',
      duration: Date.now() - state.startedAt,
    });

    return {
      status: 'failed',
      completedAt: Date.now(),
    };
  }

  // Build the graph
  const graph = new StateGraph(ExtendedPostWriterStateAnnotation)
    .addNode('start', startNode)
    .addNode('generate_blog_post', generateBlogPostNode)
    .addNode('hitl_interrupt', hitlInterruptNode)
    .addNode('process_hitl', processHitlDecisionNode)
    .addNode('generate_supporting', generateSupportingContentNode)
    .addNode('finalize', finalizeNode)
    .addNode('rejected', rejectedNode)
    .addNode('handle_error', handleErrorNode)
    // Edges - First invocation: start → generate_blog_post → hitl_interrupt (pauses here)
    .addEdge('__start__', 'start')
    .addEdge('start', 'generate_blog_post')
    .addConditionalEdges('generate_blog_post', (state) => {
      if (state.error) return 'handle_error';
      return 'hitl_interrupt';
    })
    // After HITL resume: process_hitl → generate_supporting → finalize
    .addEdge('hitl_interrupt', 'process_hitl')
    .addConditionalEdges('process_hitl', (state) => {
      if (state.error) return 'handle_error';
      if (state.status === 'rejected') return 'rejected';
      return 'generate_supporting'; // Go generate SEO + social after approval
    })
    .addConditionalEdges('generate_supporting', (state) => {
      if (state.error) return 'handle_error';
      return 'finalize';
    })
    .addEdge('finalize', END)
    .addEdge('rejected', END)
    .addEdge('handle_error', END);

  // Compile with checkpointer
  return graph.compile({
    checkpointer: checkpointer.getSaver(),
  });
}

export type ExtendedPostWriterGraph = ReturnType<typeof createExtendedPostWriterGraph>;
