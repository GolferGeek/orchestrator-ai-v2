import {
  IsString,
  IsOptional,
  IsObject,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUniverseDto {
  @ApiProperty({ description: 'Universe slug', maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  slug!: string;

  @ApiProperty({ description: 'Universe name', maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ description: 'Universe description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'User ID creating the universe' })
  @IsOptional()
  @IsUUID()
  created_by?: string;
}
