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
import { PredictorRepository } from '../../repositories/predictor.repository';
import { SignalRepository } from '../../repositories/signal.repository';
import { SignalFingerprintRepository } from '../../repositories/signal-fingerprint.repository';
import { SourceSeenItemRepository } from '../../repositories/source-seen-item.repository';
import { TargetRepository } from '../../repositories/target.repository';
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
  includeTestData?: boolean;
}

interface PredictionParams {
  id?: string;
  ids?: string[];
  targetId?: string;
  filters?: PredictionFilters;
  page?: number;
  pageSize?: number;
  includeSnapshot?: boolean;
}

@Injectable()
export class PredictionHandler implements IDashboardHandler {
  private readonly logger = new Logger(PredictionHandler.name);
  private readonly supportedActions = [
    'list',
    'get',
    'getSnapshot',
    'getDeepDive',
    'compare',
  ];

  constructor(
    private readonly predictionRepository: PredictionRepository,
    private readonly predictorRepository: PredictorRepository,
    private readonly signalRepository: SignalRepository,
    private readonly signalFingerprintRepository: SignalFingerprintRepository,
    private readonly sourceSeenItemRepository: SourceSeenItemRepository,
    private readonly targetRepository: TargetRepository,
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
    // Merge filters from payload.filters into params.filters for list operations
    const filters = payload.filters as PredictionFilters | undefined;

    switch (action.toLowerCase()) {
      case 'list':
        return this.handleList(params, filters);
      case 'get':
        return this.handleGet(params);
      case 'getsnapshot':
      case 'get-snapshot':
      case 'snapshot':
        return this.handleGetSnapshot(params);
      case 'getdeepdive':
      case 'get-deep-dive':
      case 'deep-dive':
      case 'deepdive':
        return this.handleGetDeepDive(params);
      case 'compare':
        return this.handleCompare(params);
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
    filters?: PredictionFilters,
  ): Promise<DashboardActionResult> {
    // Merge filters from both sources (params.filters and payload.filters)
    const mergedFilters = { ...params?.filters, ...filters };
    const targetId = params?.targetId || mergedFilters?.targetId;
    const universeId = mergedFilters?.universeId;

    this.logger.debug(
      `[PREDICTION-HANDLER] handleList - targetId: ${targetId}, universeId: ${universeId}, filters: ${JSON.stringify(mergedFilters)}`,
    );

    try {
      let predictions;
      // Track universe_id for enrichment
      let knownUniverseId: string | undefined = universeId;
      // Build test data filter from merged filters
      const testDataFilter = {
        includeTestData: mergedFilters?.includeTestData ?? false,
      };

      if (targetId) {
        // Filter by target
        predictions = await this.predictionRepository.findByTarget(
          targetId,
          mergedFilters?.status,
          testDataFilter,
        );
        // Get universe_id from the target
        const target = await this.targetRepository.findById(targetId);
        if (target) {
          knownUniverseId = target.universe_id;
        }
      } else if (universeId) {
        // Filter by universe (portfolio)
        predictions = await this.predictionRepository.findByUniverse(
          universeId,
          mergedFilters?.status,
          testDataFilter,
        );
      } else if (mergedFilters?.status === 'active') {
        // Get all active predictions
        predictions =
          await this.predictionRepository.findActivePredictions(testDataFilter);
      } else {
        // Default: get active predictions
        predictions =
          await this.predictionRepository.findActivePredictions(testDataFilter);
      }

      this.logger.debug(
        `[PREDICTION-HANDLER] Found ${predictions.length} predictions`,
      );

      // Apply additional filters
      let filtered = predictions;

      if (mergedFilters?.direction) {
        filtered = filtered.filter(
          (p) => p.direction === mergedFilters.direction,
        );
      }

      if (mergedFilters?.fromDate) {
        const fromDate = new Date(mergedFilters.fromDate);
        filtered = filtered.filter((p) => new Date(p.predicted_at) >= fromDate);
      }

      if (mergedFilters?.toDate) {
        const toDate = new Date(mergedFilters.toDate);
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

      // Enrich predictions with target details and transform to frontend format
      // Look up target info for all predictions
      const targetIds = [
        ...new Set(paginatedPredictions.map((p) => p.target_id)),
      ];
      const targetMap = new Map<
        string,
        { universe_id: string; symbol: string; name: string }
      >();

      await Promise.all(
        targetIds.map(async (tid) => {
          const target = await this.targetRepository.findById(tid);
          if (target) {
            targetMap.set(tid, {
              universe_id: target.universe_id,
              symbol: target.symbol,
              name: target.name,
            });
          }
        }),
      );

      // Transform predictions to frontend format (camelCase + enriched data)
      const enrichedPredictions = paginatedPredictions.map((p) => {
        const target = targetMap.get(p.target_id);
        return {
          // Core fields
          id: p.id,
          targetId: p.target_id,
          universeId: knownUniverseId || target?.universe_id || null,
          taskId: p.task_id,
          status: p.status,
          direction: p.direction,
          confidence: p.confidence,
          magnitude: p.magnitude,
          timeframe: p.timeframe_hours ? `${p.timeframe_hours}h` : undefined,
          timeframeHours: p.timeframe_hours,
          reasoning: p.reasoning,
          // Dates
          generatedAt: p.predicted_at,
          predictedAt: p.predicted_at,
          expiresAt: p.expires_at,
          resolvedAt: p.outcome_captured_at,
          // Entry/exit values
          entryValue: p.entry_price,
          exitValue: p.target_price,
          stopLoss: p.stop_loss,
          // Outcome
          outcomeValue: p.outcome_value,
          resolutionNotes: p.resolution_notes,
          // Enriched target info
          targetSymbol: target?.symbol || null,
          targetName: target?.name || null,
          // Test data flag
          isTest: p.is_test_data === true,
          // Ensemble data
          llmEnsembleResults: p.llm_ensemble || undefined,
          analystEnsemble: p.analyst_ensemble || undefined,
        };
      });

      // Optionally include snapshots
      let results = enrichedPredictions;
      if (params?.includeSnapshot) {
        results = await Promise.all(
          enrichedPredictions.map(async (prediction) => {
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

      // Return snapshot data directly (frontend expects snapshot object, not wrapped)
      // Field names match frontend PredictionSnapshot interface
      return buildDashboardSuccess({
        id: snapshot.id,
        predictionId: snapshot.prediction_id,
        // All predictors that contributed
        predictors: snapshot.predictors,
        // Signals considered but rejected (and why)
        rejectedSignals: snapshot.rejected_signals,
        // Each analyst's individual assessment
        analystAssessments: snapshot.analyst_assessments,
        // Each LLM tier's assessment (frontend expects 'llmEnsembleResults')
        llmEnsembleResults: snapshot.llm_ensemble,
        // Learnings that were applied
        appliedLearnings: snapshot.learnings_applied,
        // Threshold evaluation details
        thresholdEvaluation: snapshot.threshold_evaluation,
        // Complete timeline
        timeline: snapshot.timeline,
        // Metadata
        createdAt: snapshot.created_at,
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

  /**
   * Get full prediction deep-dive with lineage:
   * - Prediction details
   * - Source article references
   * - Signal fingerprints
   * - Analyst reasoning chain
   * - Contributing predictors with signals
   */
  private async handleGetDeepDive(
    params?: PredictionParams,
  ): Promise<DashboardActionResult> {
    if (!params?.id) {
      return buildDashboardError('MISSING_ID', 'Prediction ID is required');
    }

    try {
      // Get prediction
      const prediction = await this.predictionRepository.findById(params.id);
      if (!prediction) {
        return buildDashboardError(
          'NOT_FOUND',
          `Prediction not found: ${params.id}`,
        );
      }

      // Get snapshot for predictor IDs and analyst assessments
      const snapshot = await this.snapshotService.getSnapshot(params.id);

      // Get predictors that contributed to this prediction
      const predictorIds =
        snapshot?.predictors?.map((p) => p.predictor_id) ?? [];
      const predictors = await Promise.all(
        predictorIds.map((id) => this.predictorRepository.findById(id)),
      );
      const validPredictors = predictors.filter((p) => p !== null);

      // Get signals for each predictor
      const signalIds = validPredictors
        .map((p) => p.signal_id)
        .filter((id): id is string => !!id);
      const signals = await Promise.all(
        signalIds.map((id) => this.signalRepository.findById(id)),
      );
      const validSignals = signals.filter((s) => s !== null);

      // Get fingerprints for signals
      const fingerprints = await Promise.all(
        signalIds.map((id) =>
          this.signalFingerprintRepository.findBySignalId(id),
        ),
      );

      // Get source articles (from seen items) for signals
      const sourceArticles = await Promise.all(
        validSignals.map(async (signal) => {
          const contentHash = signal.metadata?.content_hash as
            | string
            | undefined;
          if (!contentHash) return null;
          return this.sourceSeenItemRepository.findByContentHash(
            signal.source_id,
            contentHash,
          );
        }),
      );

      // Build reasoning chain from analyst assessments
      const reasoningChain =
        snapshot?.analyst_assessments?.map((assessment) => ({
          analystSlug: assessment.analyst.slug,
          tier: assessment.tier,
          direction: assessment.direction,
          confidence: assessment.confidence,
          reasoning: assessment.reasoning,
          keyFactors: assessment.key_factors,
          risks: assessment.risks,
          learningsApplied: assessment.learnings_applied,
        })) ?? [];

      // Build complete lineage response
      return buildDashboardSuccess({
        prediction: {
          id: prediction.id,
          targetId: prediction.target_id,
          direction: prediction.direction,
          magnitude: prediction.magnitude,
          confidence: prediction.confidence,
          timeframeHours: prediction.timeframe_hours,
          status: prediction.status,
          predictedAt: prediction.predicted_at,
          expiresAt: prediction.expires_at,
          outcomeValue: prediction.outcome_value,
          resolutionNotes: prediction.resolution_notes,
          reasoning: prediction.reasoning,
        },
        lineage: {
          // Contributing predictors with their signals
          predictors: validPredictors.map((predictor, idx) => {
            const signal = validSignals.find(
              (s) => s.id === predictor.signal_id,
            );
            const fingerprint = fingerprints[idx];
            const article = sourceArticles[idx];

            return {
              id: predictor.id,
              direction: predictor.direction,
              strength: predictor.strength,
              confidence: predictor.confidence,
              reasoning: predictor.reasoning,
              analystSlug: predictor.analyst_slug,
              createdAt: predictor.created_at,
              signal: signal
                ? {
                    id: signal.id,
                    content: signal.content,
                    direction: signal.direction,
                    urgency: signal.urgency,
                    sourceId: signal.source_id,
                    detectedAt: signal.detected_at,
                    url: signal.url,
                  }
                : null,
              fingerprint: fingerprint
                ? {
                    titleNormalized: fingerprint.title_normalized,
                    keyPhrases: fingerprint.key_phrases,
                    fingerprintHash: fingerprint.fingerprint_hash,
                  }
                : null,
              sourceArticle: article
                ? {
                    url: article.original_url,
                    title:
                      typeof article.metadata?.title === 'string'
                        ? article.metadata.title
                        : undefined,
                    firstSeenAt: article.first_seen_at,
                    contentHash: article.content_hash,
                  }
                : null,
            };
          }),
          // Analyst reasoning chain
          analystAssessments: reasoningChain,
          // LLM ensemble details
          llmEnsemble: snapshot?.llm_ensemble ?? null,
          // Threshold evaluation
          thresholdEvaluation: snapshot?.threshold_evaluation ?? null,
          // Timeline of events
          timeline: snapshot?.timeline ?? [],
        },
        // Summary stats
        stats: {
          predictorCount: validPredictors.length,
          signalCount: validSignals.length,
          analystCount: reasoningChain.length,
          averageConfidence:
            validPredictors.length > 0
              ? validPredictors.reduce((sum, p) => sum + p.confidence, 0) /
                validPredictors.length
              : 0,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to get prediction deep-dive: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'DEEPDIVE_FAILED',
        error instanceof Error
          ? error.message
          : 'Failed to get prediction deep-dive',
      );
    }
  }

  /**
   * Compare multiple predictions side by side
   *
   * Sprint 5: Phase 3.8 - Prediction comparison feature
   *
   * @param params - Must include ids array with 2+ prediction IDs
   * @returns Comparison data including predictions, accuracy stats, analyst assessments
   */
  private async handleCompare(
    params?: PredictionParams,
  ): Promise<DashboardActionResult> {
    const ids = params?.ids ?? [];

    if (ids.length < 2) {
      return buildDashboardError(
        'INVALID_IDS',
        'At least 2 prediction IDs are required for comparison',
        { received: ids.length },
      );
    }

    if (ids.length > 10) {
      return buildDashboardError(
        'TOO_MANY_IDS',
        'Maximum 10 predictions can be compared at once',
        { received: ids.length },
      );
    }

    try {
      // Fetch all predictions
      const predictions = await Promise.all(
        ids.map((id) => this.predictionRepository.findById(id)),
      );

      // Filter out null results
      const validPredictions = predictions.filter((p) => p !== null);

      if (validPredictions.length < 2) {
        return buildDashboardError(
          'INSUFFICIENT_PREDICTIONS',
          'At least 2 valid predictions are required for comparison',
          {
            requested: ids.length,
            found: validPredictions.length,
            missing: ids.filter((id, idx) => predictions[idx] === null),
          },
        );
      }

      // Get snapshots for each prediction
      const snapshots = await Promise.all(
        validPredictions.map((p) => this.snapshotService.getSnapshot(p.id)),
      );

      // Build comparison data for each prediction
      const comparisonItems = await Promise.all(
        validPredictions.map(async (prediction, idx) => {
          const snapshot = snapshots[idx];

          // Get predictors for this prediction
          const predictorIds =
            snapshot?.predictors?.map((p) => p.predictor_id) ?? [];
          const predictors = await Promise.all(
            predictorIds
              .slice(0, 5)
              .map((id) => this.predictorRepository.findById(id)),
          );
          const validPredictors = predictors.filter((p) => p !== null);

          // Build analyst assessment summary
          const analystSummary =
            snapshot?.analyst_assessments?.map((a) => ({
              analystSlug: a.analyst.slug,
              tier: a.tier,
              direction: a.direction,
              confidence: a.confidence,
            })) ?? [];

          return {
            prediction: {
              id: prediction.id,
              targetId: prediction.target_id,
              direction: prediction.direction,
              magnitude: prediction.magnitude,
              confidence: prediction.confidence,
              timeframeHours: prediction.timeframe_hours,
              status: prediction.status,
              predictedAt: prediction.predicted_at,
              expiresAt: prediction.expires_at,
              outcomeValue: prediction.outcome_value,
            },
            stats: {
              predictorCount: predictorIds.length,
              analystCount: analystSummary.length,
              averageStrength:
                validPredictors.length > 0
                  ? validPredictors.reduce((sum, p) => sum + p.strength, 0) /
                    validPredictors.length
                  : 0,
              averageConfidence:
                validPredictors.length > 0
                  ? validPredictors.reduce((sum, p) => sum + p.confidence, 0) /
                    validPredictors.length
                  : 0,
            },
            analystAssessments: analystSummary,
            thresholdsMet: snapshot?.threshold_evaluation ?? null,
          };
        }),
      );

      // Calculate comparison summary
      const directionAgreement =
        this.calculateDirectionAgreement(comparisonItems);
      const confidenceRange = this.calculateConfidenceRange(comparisonItems);
      const outcomeComparison =
        this.calculateOutcomeComparison(comparisonItems);

      return buildDashboardSuccess({
        predictions: comparisonItems,
        comparison: {
          totalCompared: comparisonItems.length,
          directionAgreement,
          confidenceRange,
          outcomeComparison,
          // Group by target to show same-target predictions together
          byTarget: this.groupByTarget(comparisonItems),
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to compare predictions: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'COMPARE_FAILED',
        error instanceof Error
          ? error.message
          : 'Failed to compare predictions',
      );
    }
  }

  /**
   * Calculate direction agreement across predictions
   */
  private calculateDirectionAgreement(
    items: Array<{ prediction: { direction: string } }>,
  ): { unanimous: boolean; directions: Record<string, number> } {
    const directions: Record<string, number> = {};

    for (const item of items) {
      const dir = item.prediction.direction;
      directions[dir] = (directions[dir] || 0) + 1;
    }

    const unanimous = Object.keys(directions).length === 1;

    return { unanimous, directions };
  }

  /**
   * Calculate confidence range across predictions
   */
  private calculateConfidenceRange(
    items: Array<{ prediction: { confidence: number } }>,
  ): { min: number; max: number; average: number; spread: number } {
    const confidences = items.map((i) => i.prediction.confidence);
    const min = Math.min(...confidences);
    const max = Math.max(...confidences);
    const average =
      confidences.reduce((sum, c) => sum + c, 0) / confidences.length;

    return {
      min,
      max,
      average,
      spread: max - min,
    };
  }

  /**
   * Calculate outcome comparison for resolved predictions
   */
  private calculateOutcomeComparison(
    items: Array<{
      prediction: {
        status: string;
        outcomeValue: number | null;
        direction: string;
      };
    }>,
  ): {
    resolvedCount: number;
    correctCount: number;
    accuracyPct: number | null;
  } {
    const resolved = items.filter((i) => i.prediction.status === 'resolved');
    const resolvedCount = resolved.length;

    if (resolvedCount === 0) {
      return { resolvedCount: 0, correctCount: 0, accuracyPct: null };
    }

    const correct = resolved.filter((i) => {
      const outcome = i.prediction.outcomeValue;
      if (outcome === null) return false;
      const actualDirection = outcome > 0 ? 'up' : 'down';
      return i.prediction.direction === actualDirection;
    });

    const correctCount = correct.length;
    const accuracyPct = (correctCount / resolvedCount) * 100;

    return { resolvedCount, correctCount, accuracyPct };
  }

  /**
   * Group comparison items by target ID
   */
  private groupByTarget(
    items: Array<{ prediction: { targetId: string; id: string } }>,
  ): Record<string, string[]> {
    const byTarget: Record<string, string[]> = {};

    for (const item of items) {
      const targetId = item.prediction.targetId;
      if (!byTarget[targetId]) {
        byTarget[targetId] = [];
      }
      byTarget[targetId].push(item.prediction.id);
    }

    return byTarget;
  }
}
