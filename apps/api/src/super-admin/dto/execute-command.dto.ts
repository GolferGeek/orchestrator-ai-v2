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

  @ApiPropertyOptional({
    description:
      'Session ID to resume a previous conversation. If provided, continues the existing session with full context.',
    example: '7cc98885-14ef-4f81-bc29-95c19a2c82b9',
  })
  @IsString()
  @IsOptional()
  sessionId?: string;
}
