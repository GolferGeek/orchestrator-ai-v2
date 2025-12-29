import { IsString, IsOptional, IsUrl, IsObject } from "class-validator";
import { ExecutionContext } from "@orchestrator-ai/transport-types";
import { IsValidExecutionContext } from "../validators/execution-context.validator";

/**
 * Request DTO for generic workflow execution
 *
 * Uses ExecutionContext capsule pattern - receives full context as a single object
 * instead of individual fields (taskId, conversationId, userId, provider, model).
 *
 * Validation is done via custom @IsValidExecutionContext decorator
 * which uses the isExecutionContext() type guard from transport-types.
 */
export class WorkflowRequestDto {
  @IsValidExecutionContext()
  context!: ExecutionContext;

  @IsString()
  prompt: string; // Main user prompt/announcement

  @IsUrl({ require_tld: false, require_protocol: true })
  @IsOptional()
  statusWebhook?: string; // Webhook URL for progress updates

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>; // Additional workflow-specific data
}
