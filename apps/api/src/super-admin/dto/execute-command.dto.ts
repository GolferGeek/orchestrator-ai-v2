import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExecuteCommandDto {
  @ApiProperty({
    description: 'The prompt or command to execute',
    example: '/test',
  })
  @IsString()
  @IsNotEmpty()
  prompt!: string;

  @ApiPropertyOptional({
    description: 'Optional skill to target',
    example: 'api-testing-skill',
  })
  @IsString()
  @IsOptional()
  skill?: string;
}
