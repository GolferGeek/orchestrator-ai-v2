/**
 * ExecutionContext - The core context that flows through the entire system
 *
 * Created by the frontend with every request, passed through:
 * - API controllers
 * - Mode routers
 * - All runners (api, context, external, orchestrator, rag)
 * - All services (tasks, conversations, deliverables, LLM, observability)
 * - LangGraph workflows
 *
 * Every function that does work should take ExecutionContext as a parameter.
 */

/**
 * Core execution context - always present on every A2A request
 * All fields are required as they are provided with every call through the A2A service
 */
export interface ExecutionContext {
  /** Organization slug */
  orgSlug: string;

  /** User ID (from auth) */
  userId: string;

  /** Conversation ID */
  conversationId: string;

  /** Task ID */
  taskId: string;

  /** Deliverable ID */
  deliverableId: string;

  /** Agent slug */
  agentSlug: string;

  /** Agent type (e.g., 'context', 'api', 'orchestrator', 'rag', 'langgraph') */
  agentType: string;

  /** LLM provider (e.g., 'openai', 'anthropic', 'ollama', 'google') */
  provider: string;

  /** LLM model identifier (e.g., 'gpt-4', 'claude-sonnet-4-20250514') */
  model: string;
}


/**
 * Create a complete execution context with all required fields
 */
export function createExecutionContext(params: {
  orgSlug: string;
  userId: string;
  conversationId: string;
  taskId: string;
  deliverableId: string;
  agentSlug: string;
  agentType: string;
  provider: string;
  model: string;
}): ExecutionContext {
  return { ...params };
}

/**
 * Create a mock execution context for testing
 */
export function createMockExecutionContext(
  overrides?: Partial<ExecutionContext>,
): ExecutionContext {
  return {
    orgSlug: 'test-org',
    userId: 'test-user-id',
    conversationId: 'test-conversation-id',
    taskId: 'test-task-id',
    deliverableId: 'test-deliverable-id',
    agentSlug: 'test-agent',
    agentType: 'context',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    ...overrides,
  };
}

/**
 * Type guard to check if an object is a valid ExecutionContext
 * All fields are required
 */
export function isExecutionContext(obj: unknown): obj is ExecutionContext {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate.orgSlug === 'string' &&
    typeof candidate.userId === 'string' &&
    typeof candidate.conversationId === 'string' &&
    typeof candidate.taskId === 'string' &&
    typeof candidate.deliverableId === 'string' &&
    typeof candidate.agentSlug === 'string' &&
    typeof candidate.agentType === 'string' &&
    typeof candidate.provider === 'string' &&
    typeof candidate.model === 'string'
  );
}
