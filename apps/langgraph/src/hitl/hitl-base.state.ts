import { Annotation, MessagesAnnotation } from '@langchain/langgraph';
import type { HitlDecision, HitlStatus } from '@orchestrator-ai/transport-types';

/**
 * Base state annotation for all HITL-capable workflows.
 * Individual agents extend this with their domain-specific fields.
 *
 * KEY DESIGN DECISIONS:
 * 1. Uses `taskId` consistently (passed to LangGraph as thread_id config)
 * 2. NO version tracking in state - API Runner handles via DeliverablesService
 * 3. NO direct DB access from LangGraph - framework-agnostic
 * 4. HITL state (pending, decision, feedback) stored here for checkpointer
 */
export const HitlBaseStateAnnotation = Annotation.Root({
  // Include message history from LangGraph
  ...MessagesAnnotation.spec,

  // === Task Identification ===
  // taskId is THE identifier - passed to LangGraph as thread_id config
  taskId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
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

  // === LLM Configuration ===
  provider: Annotation<string>({
    reducer: (_, next) => next,
    default: () => 'ollama',
  }),
  model: Annotation<string>({
    reducer: (_, next) => next,
    default: () => 'llama3.2:1b',
  }),

  // === HITL State ===
  // These are stored in LangGraph checkpointer - no separate table needed
  hitlDecision: Annotation<HitlDecision | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  hitlFeedback: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  hitlPending: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),
  // Track which node triggered HITL (for serialized HITL)
  hitlNodeName: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // === Workflow Status ===
  status: Annotation<HitlStatus>({
    reducer: (_, next) => next,
    default: () => 'started',
  }),
  error: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
  startedAt: Annotation<number>({
    reducer: (_, next) => next,
    default: () => Date.now(),
  }),
  completedAt: Annotation<number | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
});

export type HitlBaseState = typeof HitlBaseStateAnnotation.State;

/**
 * Helper to check if state extends HitlBaseState
 */
export function isHitlState(state: unknown): state is HitlBaseState {
  return (
    typeof state === 'object' &&
    state !== null &&
    'taskId' in state &&
    'hitlDecision' in state &&
    'hitlPending' in state
  );
}
