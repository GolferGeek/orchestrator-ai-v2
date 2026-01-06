import { IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";
import { ExecutionContext } from "@orchestrator-ai/transport-types";

/**
 * FinanceRequestDto
 *
 * Request DTO for finance research workflow execution.
 *
 * Requires:
 * - context: ExecutionContext capsule (with taskId)
 * - universeVersionId: ID of the universe version to analyze
 *
 * Optional:
 * - runTs: Timestamp for the run (defaults to now)
 * - userMessage: Optional user message (ignored, included for A2A compatibility)
 */
export class FinanceRequestDto {
  @IsObject()
  @IsNotEmpty()
  context: ExecutionContext;

  @IsString()
  @IsNotEmpty()
  universeVersionId: string;

  @IsString()
  @IsOptional()
  runTs?: string;

  @IsString()
  @IsOptional()
  userMessage?: string;
}
