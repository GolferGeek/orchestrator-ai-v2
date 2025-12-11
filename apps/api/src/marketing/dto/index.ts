import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsBoolean,
  IsUUID,
} from 'class-validator';

// Content Type DTOs
export class ContentTypeDto {
  @IsUUID()
  id!: string;

  @IsString()
  slug!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  systemPromptTemplate?: string;

  @IsOptional()
  @IsArray()
  requiredFields?: string[];

  @IsBoolean()
  isActive!: boolean;
}

// Marketing Agent DTOs
export class MarketingAgentDto {
  @IsUUID()
  id!: string;

  @IsString()
  slug!: string;

  @IsString()
  name!: string;

  @IsString()
  role!: 'writer' | 'editor' | 'evaluator';

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsBoolean()
  isActive!: boolean;
}

// Agent LLM Config DTOs
export class AgentLLMConfigDto {
  @IsUUID()
  id!: string;

  @IsUUID()
  agentId!: string;

  @IsString()
  llmProvider!: string;

  @IsString()
  llmModel!: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsNumber()
  maxTokens?: number;

  @IsBoolean()
  isDefault!: boolean;

  @IsBoolean()
  isActive!: boolean;
}

// Response DTOs with joined data
export class MarketingAgentWithConfigsDto extends MarketingAgentDto {
  @IsArray()
  llmConfigs!: AgentLLMConfigDto[];
}

// Create/Update DTOs (for future admin endpoints)
export class CreateContentTypeDto {
  @IsString()
  slug!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  systemPromptTemplate?: string;

  @IsOptional()
  @IsArray()
  requiredFields?: string[];
}

export class UpdateContentTypeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  systemPromptTemplate?: string;

  @IsOptional()
  @IsArray()
  requiredFields?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
