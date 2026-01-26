import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AgentIdeasController } from './agent-ideas.controller';
import { AgentIdeasService } from './agent-ideas.service';
import { SupabaseModule } from '@/supabase/supabase.module';

/**
 * AgentIdeasModule
 *
 * Provides public endpoints for the "Agent Ideas" landing page feature.
 *
 * This module:
 * - Proxies requests to the LangGraph Business Automation Advisor workflow
 * - Stores lead submissions in the database for follow-up
 *
 * No authentication required - these endpoints are for landing page visitors.
 */
@Module({
  imports: [HttpModule, SupabaseModule],
  controllers: [AgentIdeasController],
  providers: [AgentIdeasService],
  exports: [AgentIdeasService],
})
export class AgentIdeasModule {}
