import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsArray,
  IsBoolean,
  IsNumber,
} from 'class-validator';

/**
 * Agent recommendation structure
 */
export interface AgentRecommendation {
  name: string;
  tagline: string;
  description: string;
  use_case_example: string;
  time_saved: string;
  wow_factor: string;
  category: string;
}

/**
 * Request DTO for submitting interest in agent recommendations
 */
export class SubmitInterestDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsNotEmpty()
  industryInput!: string;

  @IsString()
  @IsOptional()
  normalizedIndustry?: string;

  @IsString()
  @IsOptional()
  industryDescription?: string;

  @IsArray()
  @IsNotEmpty()
  selectedAgents!: AgentRecommendation[];

  @IsArray()
  @IsOptional()
  allRecommendations?: AgentRecommendation[];

  @IsBoolean()
  @IsOptional()
  isFallback?: boolean;

  @IsNumber()
  @IsOptional()
  processingTimeMs?: number;
}
