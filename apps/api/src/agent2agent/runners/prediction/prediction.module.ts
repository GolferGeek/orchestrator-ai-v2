/**
 * Prediction Module
 *
 * NestJS module for the ambient prediction agent system.
 * Provides controllers and services for managing prediction runners.
 *
 * @module prediction.module
 */

import { Module } from '@nestjs/common';
import { PredictionController } from './prediction.controller';
import { LearningController } from './learning.controller';
import { AmbientAgentOrchestratorService } from './ambient-agent-orchestrator.service';
import { RunnerFactoryService } from './runner-factory.service';
import { PredictionDbService } from './base/services/prediction-db.service';
import { OutcomeEvaluationService } from './base/services/outcome-evaluation.service';
import { PostmortemService } from './base/services/postmortem.service';
import { MissedOpportunityService } from './base/services/missed-opportunity.service';
import { LearningContextBuilderService } from './base/services/learning-context.service';
import { LearningConversationService } from './base/services/learning-conversation.service';
import { AgentContextUpdateService } from './base/services/agent-context-update.service';
import { SupabaseModule } from '../../../supabase/supabase.module';
import { LLMModule } from '../../../llms/llm.module';

/**
 * Prediction Module
 *
 * Encapsulates all prediction runner functionality:
 * - REST API controller for prediction management
 * - Learning controller for learning loop functionality
 * - Ambient agent orchestrator for background polling
 * - Runner factory for creating prediction runners
 * - Database service for storing predictions
 * - Learning services for outcome evaluation, postmortems, and context updates
 */
@Module({
  imports: [SupabaseModule, LLMModule],
  controllers: [PredictionController, LearningController],
  providers: [
    AmbientAgentOrchestratorService,
    RunnerFactoryService,
    PredictionDbService,
    OutcomeEvaluationService,
    PostmortemService,
    MissedOpportunityService,
    LearningContextBuilderService,
    LearningConversationService,
    AgentContextUpdateService,
  ],
  exports: [
    AmbientAgentOrchestratorService,
    RunnerFactoryService,
    PredictionDbService,
    OutcomeEvaluationService,
    PostmortemService,
    MissedOpportunityService,
    LearningContextBuilderService,
    LearningConversationService,
    AgentContextUpdateService,
  ],
})
export class PredictionModule {}
