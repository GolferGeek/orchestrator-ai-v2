import {
  IsNotEmpty,
  IsString,
  IsArray,
  IsOptional,
  IsNumber,
  ValidateNested,
  IsObject,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExecutionContext } from '@orchestrator-ai/transport-types';

class AgentConfigDto {
  @IsString()
  @IsNotEmpty()
  agentSlug: string;

  @IsString()
  @IsNotEmpty()
  llmConfigId: string;

  @IsString()
  @IsNotEmpty()
  llmProvider: string;

  @IsString()
  @IsNotEmpty()
  llmModel: string;

  @IsString()
  @IsOptional()
  displayName?: string;
}

class SwarmConfigDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgentConfigDto)
  writers: AgentConfigDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgentConfigDto)
  editors: AgentConfigDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgentConfigDto)
  evaluators: AgentConfigDto[];

  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  maxEditCycles?: number = 3;
}

class PromptDataDto {
  @IsString()
  @IsNotEmpty()
  topic: string;

  @IsString()
  @IsNotEmpty()
  audience: string;

  @IsString()
  @IsNotEmpty()
  goal: string;

  @IsArray()
  @IsString({ each: true })
  keyPoints: string[];

  @IsString()
  @IsNotEmpty()
  tone: string;

  @IsString()
  @IsOptional()
  constraints?: string;

  @IsString()
  @IsOptional()
  examples?: string;

  @IsString()
  @IsOptional()
  additionalContext?: string;
}

export class MarketingSwarmRequestDto {
  @IsObject()
  @IsNotEmpty()
  context: ExecutionContext;

  @IsString()
  @IsNotEmpty()
  contentTypeSlug: string;

  @IsString()
  @IsNotEmpty()
  contentTypeContext: string;

  @ValidateNested()
  @Type(() => PromptDataDto)
  promptData: PromptDataDto;

  @ValidateNested()
  @Type(() => SwarmConfigDto)
  config: SwarmConfigDto;
}
