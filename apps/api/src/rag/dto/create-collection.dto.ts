import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateCollectionDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  embeddingModel?: string = 'nomic-embed-text';

  @IsInt()
  @Min(100)
  @Max(4000)
  @IsOptional()
  chunkSize?: number = 1000;

  @IsInt()
  @Min(0)
  @Max(1000)
  @IsOptional()
  chunkOverlap?: number = 200;
}
