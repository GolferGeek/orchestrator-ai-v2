import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import { ExecutionContext } from "@orchestrator-ai/transport-types";

/**
 * Legal Department input interface
 * Validation is handled by NestJS DTOs at the controller level
 *
 * Context flows through via ExecutionContext parameter.
 * Provider/model come from context.provider and context.model.
 */
export interface LegalDepartmentInput {
  /** Execution context - contains orgSlug, userId, conversationId, taskId, provider, model, etc. */
  context: ExecutionContext;
  userMessage: string;
  /** Optional: Multiple documents for legal review/analysis */
  documents?: Array<{
    name: string;
    content: string;
    type?: string;
  }>;
}

/**
 * Result from Legal Department execution
 */
export interface LegalDepartmentResult {
  taskId: string;
  status: "completed" | "failed";
  userMessage: string;
  response?: string;
  error?: string;
  duration: number;
}

/**
 * Status response for checking thread state
 */
export interface LegalDepartmentStatus {
  taskId: string;
  status: LegalDepartmentState["status"];
  userMessage: string;
  response?: string;
  error?: string;
}

/**
 * Legal Department State Annotation
 *
 * Uses ExecutionContext for all identification and configuration.
 * No individual fields for taskId, userId, etc.
 *
 * Phase 3 (M0): Simple echo workflow to prove LLM integration works
 * Future phases will add:
 * - Document analysis
 * - Legal metadata extraction
 * - Multi-document comparison
 * - Compliance checking
 */
export const LegalDepartmentStateAnnotation = Annotation.Root({
  // Include message history from LangGraph
  ...MessagesAnnotation.spec,

  // ExecutionContext - the core context that flows through the system
  // Note: Default is a placeholder that MUST be overwritten when invoking the graph.
  // Runtime validation happens in graph nodes, not at state initialization.
  executionContext: Annotation<ExecutionContext>({
    reducer: (_, next) => next,
    default: () => ({
      orgSlug: "",
      userId: "",
      conversationId: "",
      taskId: "",
      planId: "",
      deliverableId: "",
      agentSlug: "",
      agentType: "",
      provider: "",
      model: "",
    }),
  }),

  // User's message/prompt
  userMessage: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),

  // Optional: Documents for legal analysis (M0: not processed, placeholder for future)
  documents: Annotation<
    Array<{
      name: string;
      content: string;
      type?: string;
    }>
  >({
    reducer: (_, next) => next,
    default: () => [],
  }),

  // Legal metadata placeholder (M0: not used, for future phases)
  legalMetadata: Annotation<Record<string, unknown> | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  // Final response
  response: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  // Status tracking
  status: Annotation<"started" | "processing" | "completed" | "failed">({
    reducer: (_, next) => next,
    default: () => "started",
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

export type LegalDepartmentState = typeof LegalDepartmentStateAnnotation.State;
