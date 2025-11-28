import { IsString, IsOptional, IsNotEmpty, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ExecutionContext } from '@orchestrator-ai/transport-types';

/**
 * Execution context DTO
 */
class ExecutionContextDto implements Partial<ExecutionContext> {
  @IsString()
  @IsNotEmpty()
  orgSlug!: string;

  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @IsOptional()
  @IsString()
  taskId?: string;

  @IsOptional()
  @IsString()
  deliverableId?: string;

  @IsOptional()
  @IsString()
  agentSlug?: string;

  @IsOptional()
  @IsString()
  agentType?: string;
}

/**
 * Request DTO for Data Analyst agent
 *
 * Supports two ways to provide context:
 * 1. Via context object (preferred): { context: { orgSlug, userId, conversationId, taskId } }
 * 2. Via individual fields (legacy): { orgSlug, userId, conversationId, taskId }
 */
export class DataAnalystRequestDto {
  // Option 1: Context object (preferred)
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ExecutionContextDto)
  context?: ExecutionContextDto;

  // Option 2: Individual fields (legacy support)
  @IsOptional()
  @IsString()
  taskId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  organizationSlug?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  orgSlug?: string;

  // Agent-specific fields
  @IsString()
  userMessage!: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  model?: string;
}
