/**
 * Market Predictor Module
 *
 * NestJS module for the Market Predictor runner.
 * Provides the MarketPredictorRunnerService and required dependencies.
 *
 * DEPENDENCIES:
 * - PostgresCheckpointerModule: LangGraph state persistence
 * - SupabaseModule: Database access for PredictionDbService
 * - ObservabilityModule: Observability events
 *
 * @module market-predictor.module
 */

import { Module } from '@nestjs/common';
import { MarketPredictorRunnerService } from './market-predictor-runner.service';
import { PostgresCheckpointerModule } from '../base/postgres-checkpointer.module';
import { PostgresCheckpointerService } from '../base/postgres-checkpointer.service';
import { DefaultClaimProcessor } from '../base/default-claim-processor';
import { SupabaseModule } from '../../../../supabase/supabase.module';
import { ObservabilityEventsService } from '../../../../observability/observability-events.service';
import { ObservabilityModule } from '../../../../observability/observability.module';

@Module({
  imports: [PostgresCheckpointerModule, SupabaseModule, ObservabilityModule],
  providers: [
    {
      provide: 'IClaimProcessor',
      useFactory: (observabilityService: ObservabilityEventsService) => {
        return new DefaultClaimProcessor(observabilityService);
      },
      inject: [ObservabilityEventsService],
    },
    {
      provide: MarketPredictorRunnerService,
      useFactory: (
        checkpointer: PostgresCheckpointerService,
        observabilityService: ObservabilityEventsService,
      ) => {
        return MarketPredictorRunnerService.create(
          checkpointer,
          observabilityService,
        );
      },
      inject: [PostgresCheckpointerService, ObservabilityEventsService],
    },
  ],
  exports: [MarketPredictorRunnerService],
})
export class MarketPredictorModule {}
