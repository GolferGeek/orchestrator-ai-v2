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
 * - ExecutionContext flows through entire workflow - no individual context fields
 * - Uses context.taskId as thread_id in LangGraph config
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
    const ctx = state.executionContext;
    const topic = state.userMessage || state.topic;

    await observability.emitStarted({
      taskId: ctx.taskId,
      threadId: ctx.taskId,
      agentSlug: ctx.agentSlug,
      userId: ctx.userId,
      conversationId: ctx.conversationId,
      organizationSlug: ctx.orgSlug,
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
    const ctx = state.executionContext;
    const { topic, hitlFeedback, generationCount, tone, keywords, context: additionalContext } = state;

    await observability.emitProgress({
      taskId: ctx.taskId,
      threadId: ctx.taskId,
      agentSlug: ctx.agentSlug,
      userId: ctx.userId,
      conversationId: ctx.conversationId,
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

    const feedbackStr = hitlFeedback
      ? `\n\nPrevious feedback to incorporate: ${hitlFeedback}`
      : '';

    const prompt = `You are a professional content writer. Create a compelling blog post for the following topic.

Topic: ${topic}
Tone: ${tone}
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
        context: ctx,
        userMessage: prompt,
        callerName: AGENT_SLUG,
      });

      return {
        blogPost: response.text.trim(),
        generationCount: generationCount + 1,
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
    const ctx = state.executionContext;

    await observability.emitProgress({
      taskId: ctx.taskId,
      threadId: ctx.taskId,
      agentSlug: ctx.agentSlug,
      userId: ctx.userId,
      conversationId: ctx.conversationId,
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
        context: ctx,
        userMessage: prompt,
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
    const ctx = state.executionContext;

    await observability.emitProgress({
      taskId: ctx.taskId,
      threadId: ctx.taskId,
      agentSlug: ctx.agentSlug,
      userId: ctx.userId,
      conversationId: ctx.conversationId,
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
        context: ctx,
        userMessage: prompt,
        callerName: AGENT_SLUG,
      });

      // Try to parse JSON, but don't fail the whole workflow if it doesn't work
      let socialPosts: string[] = [];
      try {
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as { posts: string[] };
          socialPosts = parsed.posts || [];
        }
      } catch (parseError) {
        // If JSON parsing fails, use the raw response as a single social post
        console.warn('Failed to parse social posts JSON, using raw response');
        socialPosts = [response.text.trim()];
      }

      // If we still have no posts, create a placeholder
      if (socialPosts.length === 0) {
        socialPosts = ['Check out our latest blog post!'];
      }

      return {
        socialPosts,
        messages: [
          ...state.messages,
          new AIMessage('Social posts generated.'),
        ],
      };
    } catch (error) {
      // Don't fail the workflow for social posts - use placeholder
      console.error(`Social posts generation error: ${error}`);
      return {
        socialPosts: ['Check out our latest blog post!'],
        messages: [
          ...state.messages,
          new AIMessage('Social posts generated with placeholder.'),
        ],
      };
    }
  }

  // Node: HITL interrupt - waits for human approval of blog post
  // interrupt() pauses the graph and returns the resume value when invoked with Command({ resume: value })
  // On initial call: interrupt() pauses, checkpoints state
  // On resume: interrupt() returns the value passed via Command({ resume: value })
  // NOTE: At this point only blogPost is generated. SEO and social posts come after approval.
  async function hitlInterruptNode(
    state: ExtendedPostWriterState,
  ): Promise<Partial<ExtendedPostWriterState>> {
    const ctx = state.executionContext;

    // Only blog post is available at this point
    const content = {
      blogPost: state.blogPost,
      seoDescription: '', // Not generated yet
      socialPosts: [], // Not generated yet
    };

    // Emit observability event before interrupt
    await observability.emitHitlWaiting({
      taskId: ctx.taskId,
      threadId: ctx.taskId,
      agentSlug: ctx.agentSlug,
      userId: ctx.userId,
      conversationId: ctx.conversationId,
      message: 'Blog post ready for review',
      pendingContent: content,
    });

    // interrupt() pauses the graph here
    // When resumed with Command({ resume: { decision, feedback, editedContent } }),
    // interrupt() returns that value and execution continues
    const hitlResponse = interrupt({
      reason: 'human_review',
      nodeName: 'hitl_interrupt',
      topic: state.topic,
      content,
      message: 'Please review the blog post before generating SEO and social content',
    }) as { decision: string; feedback?: string; editedContent?: GeneratedContent } | undefined;

    // If hitlResponse is undefined, we're still waiting (graph checkpointed)
    // This shouldn't happen as interrupt should throw on initial call
    if (!hitlResponse) {
      return {
        hitlPending: true,
        status: 'hitl_waiting',
      };
    }

    // We have a response - extract the decision
    const { decision, feedback, editedContent } = hitlResponse;

    // If user provided edited content with 'replace' decision, update the blog post
    const updatedBlogPost = editedContent?.blogPost || state.blogPost;

    return {
      hitlPending: false,
      hitlDecision: decision as ExtendedPostWriterState['hitlDecision'],
      hitlFeedback: feedback || null,
      blogPost: updatedBlogPost,
      status: decision === 'reject' ? 'failed' : 'processing', // Will continue to SEO
    };
  }

  // Routing function after HITL
  // After blog post approval, continue to generate SEO and social posts
  function routeAfterHitl(state: ExtendedPostWriterState): string {
    switch (state.hitlDecision) {
      case 'approve':
      case 'skip':
      case 'replace':
        return 'generate_seo'; // Continue to generate SEO and social posts
      case 'reject':
        return 'finalize_rejected';
      case 'regenerate':
        return 'generate_blog_post';
      default:
        throw new Error(`Invalid HITL decision: ${state.hitlDecision}`);
    }
  }

  // Node: Finalize content
  async function finalizeNode(
    state: ExtendedPostWriterState,
  ): Promise<Partial<ExtendedPostWriterState>> {
    const ctx = state.executionContext;

    await observability.emitProgress({
      taskId: ctx.taskId,
      threadId: ctx.taskId,
      agentSlug: ctx.agentSlug,
      userId: ctx.userId,
      conversationId: ctx.conversationId,
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
      taskId: ctx.taskId,
      threadId: ctx.taskId,
      agentSlug: ctx.agentSlug,
      userId: ctx.userId,
      conversationId: ctx.conversationId,
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
    const ctx = state.executionContext;

    await observability.emitFailed({
      taskId: ctx.taskId,
      threadId: ctx.taskId,
      agentSlug: ctx.agentSlug,
      userId: ctx.userId,
      conversationId: ctx.conversationId,
      error: `Content rejected: ${state.hitlFeedback}`,
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
    const ctx = state.executionContext;

    await observability.emitFailed({
      taskId: ctx.taskId,
      threadId: ctx.taskId,
      agentSlug: ctx.agentSlug,
      userId: ctx.userId,
      conversationId: ctx.conversationId,
      error: state.error,
      duration: Date.now() - state.startedAt,
    });

    return {
      status: 'failed',
      completedAt: Date.now(),
    };
  }

  // Build the graph
  // Flow: initialize → generate_blog_post → HITL → (after approval) generate_seo → generate_social → finalize
  const graph = new StateGraph(ExtendedPostWriterStateAnnotation)
    .addNode('initialize', initializeNode)
    .addNode('generate_blog_post', generateBlogPostNode)
    .addNode('hitl_interrupt', hitlInterruptNode)
    .addNode('generate_seo', generateSeoNode)
    .addNode('generate_social', generateSocialNode)
    .addNode('finalize', finalizeNode)
    .addNode('finalize_rejected', finalizeRejectedNode)
    .addNode('handle_error', handleErrorNode)
    // Edges - Generation flow
    .addEdge('__start__', 'initialize')
    .addEdge('initialize', 'generate_blog_post')
    .addConditionalEdges('generate_blog_post', (state) => {
      if (state.error) return 'handle_error';
      return 'hitl_interrupt'; // Go to HITL right after blog post
    })
    // After HITL - route based on decision
    .addConditionalEdges('hitl_interrupt', routeAfterHitl, {
      generate_blog_post: 'generate_blog_post', // Regenerate if requested
      generate_seo: 'generate_seo', // Continue to SEO after approval
      finalize_rejected: 'finalize_rejected',
    })
    .addConditionalEdges('generate_seo', (state) => {
      if (state.error) return 'handle_error';
      return 'generate_social';
    })
    .addConditionalEdges('generate_social', (state) => {
      if (state.error) return 'handle_error';
      return 'finalize';
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
