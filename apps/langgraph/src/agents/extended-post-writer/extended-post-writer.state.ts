import { Annotation } from '@langchain/langgraph';
import { HitlBaseStateAnnotation } from '../../hitl/hitl-base.state';
import type { HitlGeneratedContent } from '@orchestrator-ai/transport-types';

/**
 * Extended Post Writer input interface
 * Validation is handled by NestJS DTOs at the controller level
 *
 * Context flows through via ExecutionContext parameter.
 * Provider/model come from context.provider and context.model.
 */
export interface ExtendedPostWriterInput {
  /** Task ID for tracking */
  taskId: string;
  /** User ID */
  userId: string;
  /** Conversation ID (optional) */
  conversationId?: string;
  /** Organization slug */
  organizationSlug: string;
  /** LLM provider */
  provider: string;
  /** LLM model */
  model: string;
  /** User's message/prompt */
  userMessage: string;
  /** Additional context */
  additionalContext?: string;
  /** Keywords for SEO */
  keywords?: string[];
  /** Writing tone */
  tone?: string;
}

/**
 * Generated content structure
 * Extends HitlGeneratedContent for consistency with transport types
 */
export interface GeneratedContent extends HitlGeneratedContent {
  blogPost: string;
  seoDescription: string;
  socialPosts: string[];
}

/**
 * Extended Post Writer State Annotation
 *
 * Extends HitlBaseStateAnnotation with domain-specific content fields.
 * Uses taskId consistently (no separate threadId - taskId IS the thread_id).
 *
 * KEY DESIGN DECISIONS:
 * 1. Extends HitlBaseStateAnnotation for HITL state management
 * 2. Uses taskId (passed to LangGraph as thread_id config)
 * 3. No version tracking in state - API Runner handles via DeliverablesService
 * 4. Domain-specific: blogPost, seoDescription, socialPosts
 */
export const ExtendedPostWriterStateAnnotation = Annotation.Root({
  // Include all HITL base state (includes taskId, hitlDecision, etc.)
  ...HitlBaseStateAnnotation.spec,

  // === User Input ===
  userMessage: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
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

  // === Generated Content ===
  blogPost: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
  seoDescription: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
  socialPosts: Annotation<string[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),

  // === Final Content (after HITL approval) ===
  finalContent: Annotation<GeneratedContent | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  // === Generation Tracking ===
  generationCount: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
});

export type ExtendedPostWriterState = typeof ExtendedPostWriterStateAnnotation.State;
