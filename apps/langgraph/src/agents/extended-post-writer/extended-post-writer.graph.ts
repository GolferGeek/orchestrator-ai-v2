import { StateGraph, END, interrupt } from '@langchain/langgraph';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import {
  ExtendedPostWriterStateAnnotation,
  ExtendedPostWriterState,
  GeneratedContent,
} from './extended-post-writer.state';
import { LLMHttpClientService } from '../../services/llm-http-client.service';
import { ObservabilityService } from '../../services/observability.service';
import { PostgresCheckpointerService } from '../../persistence/postgres-checkpointer.service';

const AGENT_SLUG = 'extended-post-writer';

/**
 * Create the Extended Post Writer graph with HITL
 *
 * Flow:
 * 1. Start → Generate blog post
 * 2. Generate blog → Generate SEO → Generate social → HITL interrupt
 * 3. HITL resume → Route based on decision:
 *    - approve/skip → Finalize
 *    - replace → Finalize (content already in state)
 *    - regenerate → Back to generate blog (with feedback)
 *    - reject → Finalize (marked as rejected)
 * 4. Finalize → End
 *
 * KEY DESIGN DECISIONS:
 * - Uses taskId only (no threadId - taskId IS the thread_id in LangGraph config)
 * - hitlDecision and hitlFeedback come from HitlBaseState
 * - API Runner handles deliverable creation and version tracking
 * - interrupt() returns content structure for API Runner to process
 */
export function createExtendedPostWriterGraph(
  llmClient: LLMHttpClientService,
  observability: ObservabilityService,
  checkpointer: PostgresCheckpointerService,
) {
  // Node: Initialize
  async function initializeNode(
    state: ExtendedPostWriterState,
  ): Promise<Partial<ExtendedPostWriterState>> {
    // Extract topic from user message
    const topic = state.userMessage || state.topic;

    await observability.emitStarted({
      taskId: state.taskId,
      threadId: state.taskId, // Use taskId as threadId for backwards compatibility
      agentSlug: AGENT_SLUG,
      userId: state.userId,
      conversationId: state.conversationId,
      organizationSlug: state.organizationSlug,
      message: `Starting content generation for topic: ${topic}`,
    });

    return {
      status: 'generating',
      topic,
      startedAt: Date.now(),
      messages: [new HumanMessage(`Create content about: ${topic}`)],
    };
  }

  // Node: Generate blog post
  async function generateBlogPostNode(
    state: ExtendedPostWriterState,
  ): Promise<Partial<ExtendedPostWriterState>> {
    const { topic, hitlFeedback, generationCount, tone, keywords, context: additionalContext } = state;

    await observability.emitProgress({
      taskId: state.taskId,
      threadId: state.taskId,
      agentSlug: AGENT_SLUG,
      userId: state.userId,
      conversationId: state.conversationId,
      message: hitlFeedback ? 'Regenerating blog post with feedback' : 'Generating blog post',
      step: 'generate_blog_post',
      progress: 20,
    });

    const keywordsStr = keywords && keywords.length > 0
      ? `Keywords to include: ${keywords.join(', ')}`
      : '';

    const contextStr = additionalContext
      ? `Additional context: ${additionalContext}`
      : '';

    // Include feedback if regenerating
    const feedbackStr = hitlFeedback
      ? `\n\nPrevious feedback to incorporate: ${hitlFeedback}`
      : '';

    const prompt = `You are a professional content writer. Create a compelling blog post for the following topic.

Topic: ${topic}
Tone: ${tone || 'professional'}
${keywordsStr}
${contextStr}
${feedbackStr}

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

      return {
        blogPost: response.text.trim(),
        generationCount: generationCount + 1,
        // Clear feedback after using it
        hitlFeedback: null,
        hitlDecision: null,
        messages: [
          ...state.messages,
          new AIMessage('Blog post generated.'),
        ],
      };
    } catch (error) {
      return {
        error: `Failed to generate blog post: ${error instanceof Error ? error.message : String(error)}`,
        status: 'failed',
      };
    }
  }

  // Node: Generate SEO description
  async function generateSeoNode(
    state: ExtendedPostWriterState,
  ): Promise<Partial<ExtendedPostWriterState>> {
    await observability.emitProgress({
      taskId: state.taskId,
      threadId: state.taskId,
      agentSlug: AGENT_SLUG,
      userId: state.userId,
      conversationId: state.conversationId,
      message: 'Generating SEO description',
      step: 'generate_seo',
      progress: 40,
    });

    const prompt = `Based on the following blog post, create a compelling SEO meta description (150-160 characters) that captures the main value proposition.

BLOG POST:
${state.blogPost}

Return ONLY the SEO description, no additional text.`;

    try {
      const response = await llmClient.callLLM({
        userMessage: prompt,
        provider: state.provider,
        model: state.model,
        userId: state.userId,
        callerName: AGENT_SLUG,
      });

      return {
        seoDescription: response.text.trim(),
        messages: [
          ...state.messages,
          new AIMessage('SEO description generated.'),
        ],
      };
    } catch (error) {
      return {
        error: `Failed to generate SEO description: ${error instanceof Error ? error.message : String(error)}`,
        status: 'failed',
      };
    }
  }

  // Node: Generate social posts
  async function generateSocialNode(
    state: ExtendedPostWriterState,
  ): Promise<Partial<ExtendedPostWriterState>> {
    await observability.emitProgress({
      taskId: state.taskId,
      threadId: state.taskId,
      agentSlug: AGENT_SLUG,
      userId: state.userId,
      conversationId: state.conversationId,
      message: 'Generating social media posts',
      step: 'generate_social',
      progress: 60,
    });

    const prompt = `Based on the following blog post, create 3 social media posts:
1. Twitter/X post (under 280 characters) - engaging hook with key insight
2. LinkedIn post (2-3 paragraphs, professional tone) - valuable takeaways
3. Instagram caption (engaging, conversational, with 3-5 relevant hashtags)

BLOG POST:
${state.blogPost}

Return the posts in JSON format:
{
  "posts": [
    "Twitter post here",
    "LinkedIn post here",
    "Instagram post here"
  ]
}`;

    try {
      const response = await llmClient.callLLM({
        userMessage: prompt,
        provider: state.provider,
        model: state.model,
        userId: state.userId,
        callerName: AGENT_SLUG,
      });

      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      let socialPosts: string[] = [];

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { posts: string[] };
        socialPosts = parsed.posts;
      } else {
        // Fallback: split by double newline
        socialPosts = response.text.split('\n\n').filter(p => p.trim());
      }

      return {
        socialPosts,
        messages: [
          ...state.messages,
          new AIMessage('Social posts generated.'),
        ],
      };
    } catch (error) {
      return {
        error: `Failed to generate social posts: ${error instanceof Error ? error.message : String(error)}`,
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
      threadId: state.taskId,
      agentSlug: AGENT_SLUG,
      userId: state.userId,
      conversationId: state.conversationId,
      message: 'Content ready for review',
      pendingContent: {
        blogPost: state.blogPost,
        seoDescription: state.seoDescription,
        socialPosts: state.socialPosts,
      },
    });

    // Build content payload for interrupt
    // This is returned to the API Runner which handles deliverable creation
    const content = {
      blogPost: state.blogPost,
      seoDescription: state.seoDescription,
      socialPosts: state.socialPosts,
    };

    // Mark as pending and call interrupt
    // The interrupt value is returned to the API Runner
    // When resumed, state will have hitlDecision set by API Runner
    interrupt({
      reason: 'human_review',
      nodeName: 'hitl_interrupt',
      topic: state.topic,
      content,
      message: 'Please review the generated content',
    });

    // This return is executed AFTER resume (interrupt pauses execution)
    // hitlDecision will be set by the resume command
    return {
      hitlPending: false,
      status: 'hitl_waiting',
    };
  }

  // Routing function after HITL
  function routeAfterHitl(state: ExtendedPostWriterState): string {
    const decision = state.hitlDecision;

    switch (decision) {
      case 'approve':
      case 'skip':
        // Content accepted, move to finalization
        return 'finalize';

      case 'replace':
        // User provided their own content (already in state via resume)
        return 'finalize';

      case 'reject':
        // Rejected completely - go to finalize with rejection status
        return 'finalize_rejected';

      case 'regenerate':
        // Regenerate with feedback (feedback in state.hitlFeedback)
        return 'generate_blog_post';

      default:
        // Default to finalize
        return 'finalize';
    }
  }

  // Node: Finalize content
  async function finalizeNode(
    state: ExtendedPostWriterState,
  ): Promise<Partial<ExtendedPostWriterState>> {
    await observability.emitProgress({
      taskId: state.taskId,
      threadId: state.taskId,
      agentSlug: AGENT_SLUG,
      userId: state.userId,
      conversationId: state.conversationId,
      message: 'Finalizing approved content',
      step: 'finalize',
      progress: 90,
    });

    const finalContent: GeneratedContent = {
      blogPost: state.blogPost,
      seoDescription: state.seoDescription,
      socialPosts: state.socialPosts,
    };

    await observability.emitCompleted({
      taskId: state.taskId,
      threadId: state.taskId,
      agentSlug: AGENT_SLUG,
      userId: state.userId,
      conversationId: state.conversationId,
      result: { content: finalContent },
      duration: Date.now() - state.startedAt,
    });

    return {
      finalContent,
      status: 'completed',
      completedAt: Date.now(),
      messages: [
        ...state.messages,
        new AIMessage('Content finalized and ready for publishing.'),
      ],
    };
  }

  // Node: Handle rejection
  async function finalizeRejectedNode(
    state: ExtendedPostWriterState,
  ): Promise<Partial<ExtendedPostWriterState>> {
    await observability.emitFailed({
      taskId: state.taskId,
      threadId: state.taskId,
      agentSlug: AGENT_SLUG,
      userId: state.userId,
      conversationId: state.conversationId,
      error: `Content rejected: ${state.hitlFeedback || 'No reason given'}`,
      duration: Date.now() - state.startedAt,
    });

    return {
      status: 'failed',
      error: 'Content rejected by user',
      completedAt: Date.now(),
    };
  }

  // Node: Handle errors
  async function handleErrorNode(
    state: ExtendedPostWriterState,
  ): Promise<Partial<ExtendedPostWriterState>> {
    await observability.emitFailed({
      taskId: state.taskId,
      threadId: state.taskId,
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
    .addNode('initialize', initializeNode)
    .addNode('generate_blog_post', generateBlogPostNode)
    .addNode('generate_seo', generateSeoNode)
    .addNode('generate_social', generateSocialNode)
    .addNode('hitl_interrupt', hitlInterruptNode)
    .addNode('finalize', finalizeNode)
    .addNode('finalize_rejected', finalizeRejectedNode)
    .addNode('handle_error', handleErrorNode)
    // Edges - Generation flow
    .addEdge('__start__', 'initialize')
    .addEdge('initialize', 'generate_blog_post')
    .addConditionalEdges('generate_blog_post', (state) => {
      if (state.error) return 'handle_error';
      return 'generate_seo';
    })
    .addConditionalEdges('generate_seo', (state) => {
      if (state.error) return 'handle_error';
      return 'generate_social';
    })
    .addConditionalEdges('generate_social', (state) => {
      if (state.error) return 'handle_error';
      return 'hitl_interrupt';
    })
    // After HITL - route based on decision
    .addConditionalEdges('hitl_interrupt', routeAfterHitl, {
      generate_blog_post: 'generate_blog_post',
      finalize: 'finalize',
      finalize_rejected: 'finalize_rejected',
    })
    .addEdge('finalize', END)
    .addEdge('finalize_rejected', END)
    .addEdge('handle_error', END);

  // Compile with checkpointer
  return graph.compile({
    checkpointer: checkpointer.getSaver(),
  });
}

export type ExtendedPostWriterGraph = ReturnType<typeof createExtendedPostWriterGraph>;
