import { Annotation, MessagesAnnotation } from '@langchain/langgraph';
import { z } from 'zod';

/**
 * Zod schema for Data Analyst input validation
 */
export const DataAnalystInputSchema = z.object({
  taskId: z.string().min(1, 'taskId is required'),
  userId: z.string().min(1, 'userId is required'),
  conversationId: z.string().optional(),
  organizationSlug: z.string().optional(),
  question: z.string().min(1, 'question is required'),
  provider: z.string().default('anthropic'),
  model: z.string().default('claude-sonnet-4-20250514'),
});

export type DataAnalystInput = z.infer<typeof DataAnalystInputSchema>;

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

  // User's question
  question: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  // Schema discovery
  availableTables: Annotation<string[]>({
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

/**
 * Validate Data Analyst input
 */
export function validateDataAnalystInput(input: unknown): DataAnalystInput {
  return DataAnalystInputSchema.parse(input);
}

/**
 * Format validation errors
 */
export function formatValidationErrors(error: z.ZodError): string {
  return error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
}
