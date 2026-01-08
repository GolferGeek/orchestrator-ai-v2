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
import { AmbientAgentOrchestratorService } from './ambient-agent-orchestrator.service';
import { RunnerFactoryService } from './runner-factory.service';
import { PredictionDbService } from './base/services/prediction-db.service';
import { SupabaseModule } from '../../../supabase/supabase.module';

/**
 * Prediction Module
 *
 * Encapsulates all prediction runner functionality:
 * - REST API controller for prediction management
 * - Ambient agent orchestrator for background polling
 * - Runner factory for creating prediction runners
 * - Database service for storing predictions
 */
@Module({
  imports: [SupabaseModule],
  controllers: [PredictionController],
  providers: [
    AmbientAgentOrchestratorService,
    RunnerFactoryService,
    PredictionDbService,
  ],
  exports: [
    AmbientAgentOrchestratorService,
    RunnerFactoryService,
    PredictionDbService,
  ],
})
export class PredictionModule {}
