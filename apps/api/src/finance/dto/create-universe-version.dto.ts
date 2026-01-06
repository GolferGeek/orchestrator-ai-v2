import {
  IsObject,
  IsOptional,
  IsNumber,
  Min,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUniverseVersionDto {
  @ApiPropertyOptional({ description: 'Version number', minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  version?: number;

  @ApiPropertyOptional({ description: 'Whether this version is active' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiProperty({
    description:
      'Configuration JSON: instruments list, market hours/timezone, allowed timing windows, data-source profile refs',
    example: {
      instruments: ['AAPL', 'GOOGL', 'MSFT'],
      market_hours: {
        open: '09:30',
        close: '16:00',
        timezone: 'America/New_York',
      },
      timing_windows: ['pre_close', 'post_close', 'pre_open', 'intraday_now'],
      data_sources: { market: 'yahoo_finance', news: 'rss' },
    },
  })
  @IsObject()
  config_json!: Record<string, unknown>;
}
