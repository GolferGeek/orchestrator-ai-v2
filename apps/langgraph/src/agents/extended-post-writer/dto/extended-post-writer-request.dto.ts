import { IsString, IsOptional, IsArray } from 'class-validator';

/**
 * Request DTO for Extended Post Writer agent
 */
export class ExtendedPostWriterRequestDto {
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
  topic!: string;

  @IsOptional()
  @IsString()
  context?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsString()
  tone?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  model?: string;
}
