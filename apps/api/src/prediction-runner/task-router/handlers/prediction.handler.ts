/**
 * Prediction Dashboard Handler
 *
 * Handles dashboard mode requests for predictions.
 * Predictions are the final output of the system - forecasts for targets.
 * Includes snapshot access for full explainability.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { ExecutionContext } from '@orchestrator-ai/transport-types';
import type { DashboardRequestPayload } from '@orchestrator-ai/transport-types';
import { PredictionRepository } from '../../repositories/prediction.repository';
import { SnapshotService } from '../../services/snapshot.service';
import {
  IDashboardHandler,
  DashboardActionResult,
  buildDashboardSuccess,
  buildDashboardError,
  buildPaginationMetadata,
} from '../dashboard-handler.interface';
import { PredictionStatus } from '../../interfaces/prediction.interface';

interface PredictionFilters {
  targetId?: string;
  universeId?: string;
  status?: PredictionStatus;
  direction?: string;
  fromDate?: string;
  toDate?: string;
}

interface PredictionParams {
  id?: string;
  targetId?: string;
  filters?: PredictionFilters;
  page?: number;
  pageSize?: number;
  includeSnapshot?: boolean;
}

@Injectable()
export class PredictionHandler implements IDashboardHandler {
  private readonly logger = new Logger(PredictionHandler.name);
  private readonly supportedActions = ['list', 'get', 'getSnapshot'];

  constructor(
    private readonly predictionRepository: PredictionRepository,
    private readonly snapshotService: SnapshotService,
  ) {}

  async execute(
    action: string,
    payload: DashboardRequestPayload,
    context: ExecutionContext,
  ): Promise<DashboardActionResult> {
    this.logger.debug(
      `[PREDICTION-HANDLER] Executing action: ${action} for org: ${context.orgSlug}`,
    );

    const params = payload.params as PredictionParams | undefined;

    switch (action.toLowerCase()) {
      case 'list':
        return this.handleList(params);
      case 'get':
        return this.handleGet(params);
      case 'getsnapshot':
      case 'get-snapshot':
      case 'snapshot':
        return this.handleGetSnapshot(params);
      default:
        return buildDashboardError(
          'UNSUPPORTED_ACTION',
          `Unsupported action: ${action}`,
          { supportedActions: this.supportedActions },
        );
    }
  }

  getSupportedActions(): string[] {
    return this.supportedActions;
  }

  private async handleList(
    params?: PredictionParams,
  ): Promise<DashboardActionResult> {
    const targetId = params?.targetId || params?.filters?.targetId;

    try {
      let predictions;

      if (targetId) {
        // Filter by target
        predictions = await this.predictionRepository.findByTarget(
          targetId,
          params?.filters?.status,
        );
      } else if (params?.filters?.status === 'active') {
        // Get all active predictions
        predictions = await this.predictionRepository.findActivePredictions();
      } else {
        // Default: get active predictions
        predictions = await this.predictionRepository.findActivePredictions();
      }

      // Apply additional filters
      let filtered = predictions;

      if (params?.filters?.direction) {
        filtered = filtered.filter(
          (p) => p.direction === params.filters!.direction,
        );
      }

      if (params?.filters?.fromDate) {
        const fromDate = new Date(params.filters.fromDate);
        filtered = filtered.filter((p) => new Date(p.predicted_at) >= fromDate);
      }

      if (params?.filters?.toDate) {
        const toDate = new Date(params.filters.toDate);
        filtered = filtered.filter((p) => new Date(p.predicted_at) <= toDate);
      }

      // Simple pagination
      const page = params?.page ?? 1;
      const pageSize = params?.pageSize ?? 20;
      const startIndex = (page - 1) * pageSize;
      const paginatedPredictions = filtered.slice(
        startIndex,
        startIndex + pageSize,
      );

      // Optionally include snapshots
      let results = paginatedPredictions;
      if (params?.includeSnapshot) {
        results = await Promise.all(
          paginatedPredictions.map(async (prediction) => {
            const snapshot = await this.snapshotService.getSnapshot(
              prediction.id,
            );
            return {
              ...prediction,
              snapshot: snapshot || null,
            };
          }),
        );
      }

      return buildDashboardSuccess(
        results,
        buildPaginationMetadata(filtered.length, page, pageSize),
      );
    } catch (error) {
      this.logger.error(
        `Failed to list predictions: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'LIST_FAILED',
        error instanceof Error ? error.message : 'Failed to list predictions',
      );
    }
  }

  private async handleGet(
    params?: PredictionParams,
  ): Promise<DashboardActionResult> {
    if (!params?.id) {
      return buildDashboardError('MISSING_ID', 'Prediction ID is required');
    }

    try {
      const prediction = await this.predictionRepository.findById(params.id);
      if (!prediction) {
        return buildDashboardError(
          'NOT_FOUND',
          `Prediction not found: ${params.id}`,
        );
      }

      // Include snapshot if requested
      if (params.includeSnapshot) {
        const snapshot = await this.snapshotService.getSnapshot(params.id);
        return buildDashboardSuccess({
          ...prediction,
          snapshot: snapshot || null,
        });
      }

      return buildDashboardSuccess(prediction);
    } catch (error) {
      this.logger.error(
        `Failed to get prediction: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'GET_FAILED',
        error instanceof Error ? error.message : 'Failed to get prediction',
      );
    }
  }

  private async handleGetSnapshot(
    params?: PredictionParams,
  ): Promise<DashboardActionResult> {
    if (!params?.id) {
      return buildDashboardError('MISSING_ID', 'Prediction ID is required');
    }

    try {
      // First verify prediction exists
      const prediction = await this.predictionRepository.findById(params.id);
      if (!prediction) {
        return buildDashboardError(
          'NOT_FOUND',
          `Prediction not found: ${params.id}`,
        );
      }

      // Get the full snapshot for explainability
      const snapshot = await this.snapshotService.getSnapshot(params.id);
      if (!snapshot) {
        return buildDashboardError(
          'SNAPSHOT_NOT_FOUND',
          `Snapshot not found for prediction: ${params.id}`,
        );
      }

      // Return full explainability data
      return buildDashboardSuccess({
        prediction,
        snapshot: {
          // All predictors that contributed
          predictors: snapshot.predictors,
          // Signals considered but rejected (and why)
          rejectedSignals: snapshot.rejected_signals,
          // Each analyst's individual assessment
          analystAssessments: snapshot.analyst_assessments,
          // Each LLM tier's assessment
          llmEnsemble: snapshot.llm_ensemble,
          // Learnings that were applied
          learningsApplied: snapshot.learnings_applied,
          // Threshold evaluation details
          thresholdEvaluation: snapshot.threshold_evaluation,
          // Complete timeline
          timeline: snapshot.timeline,
          // Metadata
          createdAt: snapshot.created_at,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to get snapshot: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'SNAPSHOT_FAILED',
        error instanceof Error ? error.message : 'Failed to get snapshot',
      );
    }
  }
}
