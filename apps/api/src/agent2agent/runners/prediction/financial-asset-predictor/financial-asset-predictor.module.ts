/**
 * Financial Asset Predictor Module
 *
 * NestJS module for the Financial Asset Predictor runner.
 * Provides the FinancialAssetPredictorRunnerService and required dependencies.
 *
 * DEPENDENCIES:
 * - PostgresCheckpointerModule: LangGraph state persistence
 * - SupabaseModule: Database access for PredictionDbService
 * - ObservabilityModule: Observability events
 *
 * @module financial-asset-predictor.module
 */

import { Module } from '@nestjs/common';
import { FinancialAssetPredictorRunnerService } from './financial-asset-predictor-runner.service';
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
      provide: FinancialAssetPredictorRunnerService,
      useFactory: (
        checkpointer: PostgresCheckpointerService,
        observabilityService: ObservabilityEventsService,
      ) => {
        return FinancialAssetPredictorRunnerService.create(
          checkpointer,
          observabilityService,
        );
      },
      inject: [PostgresCheckpointerService, ObservabilityEventsService],
    },
  ],
  exports: [FinancialAssetPredictorRunnerService],
})
export class FinancialAssetPredictorModule {}
