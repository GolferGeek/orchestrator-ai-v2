import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

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

  @IsString()
  @IsNotEmpty()
  organizationSlug!: string;

  @IsString()
  userMessage!: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  model?: string;
}
