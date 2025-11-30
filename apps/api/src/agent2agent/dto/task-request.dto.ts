import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AgentTaskMode,
  TaskMessage,
  TaskRequestParams,
  ExecutionContext,
} from '@orchestrator-ai/transport-types';

// Re-export shared types
export { AgentTaskMode, TaskMessage, TaskRequestParams };

/**
 * ExecutionContext DTO for validation
 * Maps to ExecutionContext interface from transport-types
 */
export class ExecutionContextDto implements ExecutionContext {
  @IsString()
  orgSlug!: string;

  @IsString()
  userId!: string;

  @IsString()
  conversationId!: string;

  @IsString()
  taskId!: string;

  @IsString()
  planId!: string;

  @IsString()
  deliverableId!: string;

  @IsString()
  agentSlug!: string;

  @IsString()
  agentType!: string;

  @IsString()
  provider!: string;

  @IsString()
  model!: string;
}

export class TaskMessageDto {
  @IsString()
  role!: string;

  @IsOptional()
  content?: unknown;
}

/**
 * Task Request DTO
 *
 * The ExecutionContext is the core capsule that flows through the system.
 * It's created by the frontend and passed with every request.
 *
 * Note: The server will override context.userId with the authenticated user's ID
 * for security - we don't trust client-provided userId.
 */
export class TaskRequestDto {
  /**
   * ExecutionContext - Required, created by frontend
   * Contains all context needed for task execution
   */
  @IsObject()
  @ValidateNested()
  @Type(() => ExecutionContextDto)
  context!: ExecutionContext;

  /**
   * Agent task mode - Optional, can be derived from JSON-RPC method
   */
  @IsOptional()
  @IsEnum(AgentTaskMode)
  mode?: AgentTaskMode;

  /**
   * User's message/prompt
   */
  @IsOptional()
  @IsString()
  userMessage?: string;

  /**
   * Action-specific payload (action params, config, etc.)
   */
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  /**
   * Prompt template parameters
   */
  @IsOptional()
  @IsObject()
  promptParameters?: Record<string, unknown>;

  /**
   * Conversation history messages
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskMessageDto)
  messages?: TaskMessageDto[];

  /**
   * Additional metadata
   */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * Task request after normalization (mode is guaranteed to be set)
 */
export type NormalizedTaskRequestDto = TaskRequestDto & { mode: AgentTaskMode };
