import {
  IsString,
  IsOptional,
  IsArray,
  IsUUID,
  IsBoolean,
} from 'class-validator';

export class UpdateCollectionDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  requiredRole?: string | null;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  allowedUsers?: string[] | null;

  @IsBoolean()
  @IsOptional()
  clearAllowedUsers?: boolean;
}
