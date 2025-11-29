import { IsString, IsOptional, IsArray, IsNotEmpty, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ExecutionContext } from '@orchestrator-ai/transport-types';

/**
 * Execution context DTO - all required fields
 */
class ExecutionContextDto implements ExecutionContext {
  @IsString()
  @IsNotEmpty()
  orgSlug!: string;

  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @IsString()
  @IsNotEmpty()
  taskId!: string;

  @IsString()
  deliverableId!: string;

  @IsString()
  @IsNotEmpty()
  agentSlug!: string;

  @IsString()
  @IsNotEmpty()
  agentType!: string;

  @IsString()
  @IsNotEmpty()
  provider!: string;

  @IsString()
  @IsNotEmpty()
  model!: string;
}

/**
 * Request DTO for Extended Post Writer agent
 *
 * ExecutionContext is required - no individual fields accepted
 */
export class ExtendedPostWriterRequestDto {
  @IsObject()
  @ValidateNested()
  @Type(() => ExecutionContextDto)
  context!: ExecutionContextDto;

  @IsString()
  @IsNotEmpty()
  userMessage!: string;

  @IsOptional()
  @IsString()
  contextInfo?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsString()
  tone?: string;
}
