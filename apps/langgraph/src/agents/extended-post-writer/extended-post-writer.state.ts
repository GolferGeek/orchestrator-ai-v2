import { Annotation, MessagesAnnotation } from '@langchain/langgraph';
import { z } from 'zod';

/**
 * Zod schema for Extended Post Writer input validation
 */
export const ExtendedPostWriterInputSchema = z.object({
  taskId: z.string().min(1, 'taskId is required'),
  userId: z.string().min(1, 'userId is required'),
  conversationId: z.string().optional(),
  organizationSlug: z.string().optional(),
  topic: z.string().min(1, 'topic is required'),
  context: z.string().optional(),
  keywords: z.array(z.string()).optional().default([]),
  tone: z.string().optional().default('professional'),
  provider: z.string().default('anthropic'),
  model: z.string().default('claude-sonnet-4-20250514'),
});

export type ExtendedPostWriterInput = z.infer<typeof ExtendedPostWriterInputSchema>;

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

  organizationSlug: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
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

  // Content generation parameters
  topic: Annotation<string>({
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

/**
 * Validate Extended Post Writer input
 */
export function validateExtendedPostWriterInput(input: unknown): ExtendedPostWriterInput {
  return ExtendedPostWriterInputSchema.parse(input);
}

/**
 * Format validation errors
 */
export function formatValidationErrors(error: z.ZodError): string {
  return error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
}
