/**
 * Prediction Module
 *
 * NestJS module for the ambient prediction agent system.
 * Provides controllers and services for managing prediction runners.
 *
 * DOMAIN MODULES:
 * - StockPredictorModule: Stock market predictions (AAPL, TSLA, etc.)
 * - CryptoPredictorModule: Cryptocurrency predictions (BTC, ETH, SOL, etc.)
 * - MarketPredictorModule: Prediction market predictions (Polymarket)
 *
 * SHARED SERVICES:
 * - AmbientAgentOrchestratorService: Background polling orchestration
 * - RunnerFactoryService: Runner instance creation
 * - PredictionDbService: Database persistence
 * - Learning services: Outcome evaluation, postmortems, context updates
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

// Domain-specific predictor modules
import { StockPredictorModule } from './stock-predictor/stock-predictor.module';
import { CryptoPredictorModule } from './crypto-predictor/crypto-predictor.module';
import { MarketPredictorModule } from './market-predictor/market-predictor.module';

// Re-export runner services for external access
export { StockPredictorRunnerService } from './stock-predictor/stock-predictor-runner.service';
export { CryptoPredictorRunnerService } from './crypto-predictor/crypto-predictor-runner.service';
export { MarketPredictorRunnerService } from './market-predictor/market-predictor-runner.service';

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
 * - Domain-specific modules for stocks, crypto, and prediction markets
 */
@Module({
  imports: [
    // Core dependencies
    SupabaseModule,
    LLMModule,
    // Domain-specific predictor modules
    StockPredictorModule,
    CryptoPredictorModule,
    MarketPredictorModule,
  ],
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
    // Shared services
    AmbientAgentOrchestratorService,
    RunnerFactoryService,
    PredictionDbService,
    OutcomeEvaluationService,
    PostmortemService,
    MissedOpportunityService,
    LearningContextBuilderService,
    LearningConversationService,
    AgentContextUpdateService,
    // Domain modules (re-export for external access)
    StockPredictorModule,
    CryptoPredictorModule,
    MarketPredictorModule,
  ],
})
export class PredictionModule {}
