import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdateCollectionDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsIn(['member', 'director', 'c-level', null])
  @IsOptional()
  requiredRole?: string | null;
}
