import { Annotation, MessagesAnnotation } from '@langchain/langgraph';

/**
 * Data Analyst input interface
 * Validation is handled by NestJS DTOs at the controller level
 */
export interface DataAnalystInput {
  taskId: string;
  userId: string;
  conversationId?: string;
  organizationSlug: string;
  userMessage: string;
  provider?: string;
  model?: string;
}

/**
 * Tool result structure
 */
export interface ToolResult {
  toolName: string;
  result: string;
  success: boolean;
  error?: string;
}

/**
 * Data Analyst State Annotation
 *
 * Extends MessagesAnnotation to track:
 * - Task/user identification
 * - The user's question
 * - Discovered schema information
 * - Generated SQL and results
 * - Final summary
 */
export const DataAnalystStateAnnotation = Annotation.Root({
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

  // Schema discovery
  availableTables: Annotation<string[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),

  selectedTables: Annotation<string[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),

  tableSchemas: Annotation<Record<string, string>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),

  // SQL execution
  generatedSql: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  sqlResults: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  // Tool tracking
  toolResults: Annotation<ToolResult[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Final output
  summary: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  // Status tracking
  status: Annotation<'started' | 'discovering' | 'querying' | 'summarizing' | 'completed' | 'failed'>({
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

export type DataAnalystState = typeof DataAnalystStateAnnotation.State;

