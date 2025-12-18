import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import { z } from "zod";

/**
 * Zod schema for validating workflow input
 */
export const WorkflowInputSchema = z.object({
  taskId: z.string().min(1, "taskId is required"),
  userId: z.string().min(1, "userId is required"),
  conversationId: z.string().optional(),
  organizationSlug: z.string().optional(),
  userMessage: z.string().min(1, "userMessage is required"),
  agentSlug: z.string().min(1, "agentSlug is required"),
  provider: z.string().default("anthropic"),
  model: z.string().default("claude-sonnet-4-20250514"),
  metadata: z.record(z.unknown()).optional(),
});

export type WorkflowInput = z.infer<typeof WorkflowInputSchema>;

/**
 * Zod schema for HITL state
 */
export const HitlStateSchema = z.object({
  hitlRequest: z
    .object({
      taskId: z.string(),
      threadId: z.string(),
      agentSlug: z.string(),
      userId: z.string(),
      conversationId: z.string().optional(),
      organizationSlug: z.string().optional(),
      pendingContent: z.unknown(),
      contentType: z.string(),
      message: z.string().optional(),
    })
    .optional(),
  hitlResponse: z
    .object({
      decision: z.enum(["approve", "edit", "reject"]),
      editedContent: z.unknown().optional(),
      feedback: z.string().optional(),
    })
    .optional(),
  hitlStatus: z.enum(["none", "waiting", "resumed"]).default("none"),
});

export type HitlStateType = z.infer<typeof HitlStateSchema>;

/**
 * Zod schema for workflow execution metadata
 */
export const WorkflowMetadataSchema = z.object({
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
  currentStep: z.string().optional(),
  stepCount: z.number().default(0),
  errors: z.array(z.string()).default([]),
});

export type WorkflowMetadata = z.infer<typeof WorkflowMetadataSchema>;

/**
 * Base state annotation for all LangGraph workflows
 *
 * This provides common fields that all workflows should have:
 * - Task/user identification
 * - Message history (via MessagesAnnotation)
 * - HITL state
 * - Workflow metadata
 *
 * Extend this for agent-specific state fields.
 */
export const BaseStateAnnotation = Annotation.Root({
  // Include message history from LangGraph
  ...MessagesAnnotation.spec,

  // Task identification
  taskId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),

  threadId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),

  // User identification
  userId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),

  conversationId: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  organizationSlug: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  // Agent identification
  agentSlug: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),

  // LLM configuration
  provider: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "anthropic",
  }),

  model: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "claude-sonnet-4-20250514",
  }),

  // User input
  userMessage: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),

  // Workflow result
  result: Annotation<unknown>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  // Error state
  error: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  // HITL state fields
  hitlRequest: Annotation<HitlStateType["hitlRequest"]>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  hitlResponse: Annotation<HitlStateType["hitlResponse"]>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  hitlStatus: Annotation<"none" | "waiting" | "resumed">({
    reducer: (_, next) => next,
    default: () => "none",
  }),

  // Workflow metadata
  metadata: Annotation<WorkflowMetadata>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({
      stepCount: 0,
      errors: [],
    }),
  }),
});

export type BaseState = typeof BaseStateAnnotation.State;

/**
 * Validate workflow input using Zod schema
 * Throws ZodError if validation fails
 */
export function validateWorkflowInput(input: unknown): WorkflowInput {
  return WorkflowInputSchema.parse(input);
}

/**
 * Safe validation that returns a result object instead of throwing
 */
export function safeValidateWorkflowInput(input: unknown): {
  success: boolean;
  data?: WorkflowInput;
  error?: z.ZodError;
} {
  const result = WorkflowInputSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Format Zod validation errors into a human-readable string
 */
export function formatValidationErrors(error: z.ZodError): string {
  return error.errors
    .map((e) => `${e.path.join(".")}: ${e.message}`)
    .join("; ");
}
