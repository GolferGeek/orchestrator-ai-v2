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
 * 1. Start → Generate content (blog, SEO, social)
 * 2. Generate → HITL interrupt (wait for approval)
 * 3. HITL resume → Process decision
 *    - approve → Finalize with original content
 *    - edit → Finalize with edited content
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
      message: `Starting content generation for topic: ${state.topic}`,
    });

    return {
      status: 'generating',
      startedAt: Date.now(),
      messages: [new HumanMessage(`Create content about: ${state.topic}`)],
    };
  }

  // Node: Generate content
  async function generateContentNode(
    state: ExtendedPostWriterState,
  ): Promise<Partial<ExtendedPostWriterState>> {
    await observability.emitProgress({
      taskId: state.taskId,
      threadId: state.threadId,
      agentSlug: AGENT_SLUG,
      userId: state.userId,
      conversationId: state.conversationId,
      message: 'Generating blog post, SEO description, and social posts',
      step: 'generate_content',
      progress: 30,
    });

    const keywordsStr = state.keywords.length > 0
      ? `Keywords to include: ${state.keywords.join(', ')}`
      : '';

    const contextStr = state.context
      ? `Additional context: ${state.context}`
      : '';

    const prompt = `You are a professional content writer. Create comprehensive marketing content for the following topic.

Topic: ${state.topic}
Tone: ${state.tone}
${keywordsStr}
${contextStr}

Generate the following in JSON format:
{
  "blogPost": "A well-structured blog post (800-1200 words) with introduction, body sections, and conclusion. Use markdown formatting.",
  "seoDescription": "A compelling SEO meta description (150-160 characters) that includes the main keyword.",
  "socialPosts": [
    "Twitter/X post (under 280 characters)",
    "LinkedIn post (2-3 paragraphs, professional tone)",
    "Instagram caption (engaging, with suggested hashtags)"
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

      // Parse the JSON response
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse generated content');
      }

      const content: GeneratedContent = JSON.parse(jsonMatch[0]);

      return {
        generatedContent: content,
        messages: [
          ...state.messages,
          new AIMessage('Content generated successfully. Awaiting review.'),
        ],
      };
    } catch (error) {
      return {
        error: `Failed to generate content: ${error instanceof Error ? error.message : String(error)}`,
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
        return {
          finalContent: state.generatedContent,
          status: 'finalizing',
          messages: [
            ...state.messages,
            new AIMessage('Content approved. Finalizing...'),
          ],
        };

      case 'edit':
        if (!response.editedContent) {
          return {
            error: 'Edit decision requires edited content',
            status: 'failed',
          };
        }
        return {
          finalContent: response.editedContent,
          status: 'finalizing',
          messages: [
            ...state.messages,
            new AIMessage('Edited content received. Finalizing...'),
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
    .addNode('generate_content', generateContentNode)
    .addNode('hitl_interrupt', hitlInterruptNode)
    .addNode('process_hitl', processHitlDecisionNode)
    .addNode('finalize', finalizeNode)
    .addNode('rejected', rejectedNode)
    .addNode('handle_error', handleErrorNode)
    // Edges
    .addEdge('__start__', 'start')
    .addEdge('start', 'generate_content')
    .addConditionalEdges('generate_content', (state) => {
      if (state.error) return 'handle_error';
      return 'hitl_interrupt';
    })
    .addEdge('hitl_interrupt', 'process_hitl')
    .addConditionalEdges('process_hitl', (state) => {
      if (state.error) return 'handle_error';
      if (state.status === 'rejected') return 'rejected';
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
