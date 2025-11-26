import { Annotation, MessagesAnnotation } from '@langchain/langgraph';

/**
 * Extended Post Writer input interface
 * Validation is handled by NestJS DTOs at the controller level
 */
export interface ExtendedPostWriterInput {
  taskId: string;
  userId: string;
  conversationId?: string;
  organizationSlug: string;
  userMessage: string;
  context?: string;
  keywords?: string[];
  tone?: string;
  provider?: string;
  model?: string;
}

/**
 * Generated content structure
 */
export interface GeneratedContent {
  blogPost: string;
  seoDescription: string;
  socialPosts: string[];
}

/**
 * HITL decision type
 */
export type HitlDecision = 'approve' | 'edit' | 'reject';

/**
 * HITL response structure
 */
export interface HitlResponse {
  decision: HitlDecision;
  editedContent?: GeneratedContent;
  feedback?: string;
}

/**
 * Extended Post Writer State Annotation
 *
 * Tracks:
 * - Task/user identification
 * - Content generation parameters
 * - Generated content (blog, SEO, social)
 * - HITL state for approval workflow
 * - Final output
 */
export const ExtendedPostWriterStateAnnotation = Annotation.Root({
  // Include message history from LangGraph
  ...MessagesAnnotation.spec,

  // Task identification
  taskId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  threadId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  // User identification
  userId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  conversationId: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  organizationSlug: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  // LLM configuration
  provider: Annotation<string>({
    reducer: (_, next) => next,
    default: () => 'anthropic',
  }),

  model: Annotation<string>({
    reducer: (_, next) => next,
    default: () => 'claude-sonnet-4-20250514',
  }),

  // User's message/prompt
  userMessage: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  context: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  keywords: Annotation<string[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),

  tone: Annotation<string>({
    reducer: (_, next) => next,
    default: () => 'professional',
  }),

  // Generated content
  generatedContent: Annotation<GeneratedContent | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  // HITL state
  hitlPending: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),

  hitlResponse: Annotation<HitlResponse | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  // Final approved content
  finalContent: Annotation<GeneratedContent | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  // Status tracking
  status: Annotation<
    'started' | 'generating' | 'hitl_waiting' | 'hitl_resumed' | 'finalizing' | 'completed' | 'rejected' | 'failed'
  >({
    reducer: (_, next) => next,
    default: () => 'started',
  }),

  error: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  // Workflow metadata
  startedAt: Annotation<number>({
    reducer: (_, next) => next,
    default: () => Date.now(),
  }),

  completedAt: Annotation<number | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
});

export type ExtendedPostWriterState = typeof ExtendedPostWriterStateAnnotation.State;

