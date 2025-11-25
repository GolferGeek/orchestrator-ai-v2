import { IsString, IsOptional } from 'class-validator';

/**
 * Request DTO for Data Analyst agent
 */
export class DataAnalystRequestDto {
  @IsString()
  taskId!: string;

  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  organizationSlug?: string;

  @IsString()
  question!: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  model?: string;
}
