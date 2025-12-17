import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';
import { MarketingDatabaseService } from './marketing-database.service';

/**
 * Marketing Module
 *
 * Provides configuration endpoints for the Marketing Swarm UI:
 * - Content types (blog posts, social media, etc.)
 * - Marketing agents (writers, editors, evaluators)
 * - LLM configurations for each agent
 *
 * Data is stored in the `marketing` schema in PostgreSQL.
 * Uses direct pg connection (like RAG) for schema flexibility.
 * All operations are read-only (configuration management is done via seeds/migrations).
 */
@Module({
  imports: [AuthModule, ConfigModule, SupabaseModule, HttpModule],
  controllers: [MarketingController],
  providers: [MarketingDatabaseService, MarketingService],
  exports: [MarketingService, MarketingDatabaseService],
})
export class MarketingModule {}
