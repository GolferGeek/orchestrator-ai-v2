import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

/**
 * Request DTO for getting agent recommendations
 */
export class GetRecommendationsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  industry!: string;
}
