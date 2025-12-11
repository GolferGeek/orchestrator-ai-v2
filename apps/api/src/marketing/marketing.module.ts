import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';

/**
 * Marketing Module
 *
 * Provides configuration endpoints for the Marketing Swarm UI:
 * - Content types (blog posts, social media, etc.)
 * - Marketing agents (writers, editors, evaluators)
 * - LLM configurations for each agent
 *
 * Data is stored in the `marketing` schema in Supabase.
 * All operations are read-only (configuration management is done via seeds/migrations).
 */
@Module({
  imports: [AuthModule, SupabaseModule],
  controllers: [MarketingController],
  providers: [MarketingService],
  exports: [MarketingService],
})
export class MarketingModule {}
