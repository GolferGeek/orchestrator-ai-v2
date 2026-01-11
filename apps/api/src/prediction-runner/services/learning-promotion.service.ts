import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { LearningRepository } from '../repositories/learning.repository';
import { LearningLineageRepository } from '../repositories/learning-lineage.repository';
import { TestAuditLogRepository } from '../repositories/test-audit-log.repository';
import {
  Learning,
  LearningLineageWithDetails,
  CreateLearningLineageData,
} from '../interfaces/learning.interface';

/**
 * Validation result for learning promotion
 */
export interface PromotionValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  learning?: Learning;
}

/**
 * Backtest result for learning validation
 */
export interface BacktestResult {
  pass: boolean;
  improvement_score: number;
  window_days: number;
  details?: Record<string, unknown>;
}

/**
 * Learning promotion service
 * Handles promoting test learnings to production (INV-07, INV-09)
 *
 * Key invariants:
 * - INV-07: Learning promotion MUST be human-approved, audited action
 * - INV-09: Promoted learning becomes is_test=false; original preserved as is_test=true
 */
@Injectable()
export class LearningPromotionService {
  private readonly logger = new Logger(LearningPromotionService.name);

  constructor(
    private readonly learningRepository: LearningRepository,
    private readonly lineageRepository: LearningLineageRepository,
    private readonly auditRepository: TestAuditLogRepository,
  ) {}

  /**
   * Validate if a learning can be promoted to production
   * Checks:
   * 1. Learning exists and is_test=true
   * 2. Learning has not already been promoted
   * 3. Learning is in active status
   * 4. Learning has validation metrics (times_applied > 0)
   */
  async validateForPromotion(
    learningId: string,
  ): Promise<PromotionValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check learning exists
    const learning = await this.learningRepository.findById(learningId);
    if (!learning) {
      errors.push(`Learning not found: ${learningId}`);
      return { valid: false, errors, warnings };
    }

    // Check is_test=true
    if (!learning.is_test) {
      errors.push('Learning must have is_test=true to be promoted');
    }

    // Check not already promoted
    const alreadyPromoted =
      await this.lineageRepository.isTestLearningPromoted(learningId);
    if (alreadyPromoted) {
      errors.push('Learning has already been promoted to production');
    }

    // Check learning status
    if (learning.status !== 'active') {
      errors.push(
        `Learning must be active to promote (current status: ${learning.status})`,
      );
    }

    // Check has validation metrics
    if (learning.times_applied === 0) {
      warnings.push(
        'Learning has never been applied in test scenarios. Consider validating before promotion.',
      );
    }

    // Calculate success rate if applicable
    if (learning.times_applied > 0 && learning.times_helpful > 0) {
      const successRate = learning.times_helpful / learning.times_applied;
      if (successRate < 0.5) {
        warnings.push(
          `Learning has low success rate: ${(successRate * 100).toFixed(1)}%. Consider reviewing before promotion.`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      learning,
    };
  }

  /**
   * Promote a test learning to production
   * Creates a production copy (is_test=false) and records lineage
   *
   * @param testLearningId - ID of the test learning to promote
   * @param userId - ID of the user performing the promotion (human approval)
   * @param organizationSlug - Organization slug for audit logging
   * @param notes - Optional notes explaining the promotion decision
   * @param backtestResult - Optional backtest validation results
   * @param scenarioRuns - Optional array of scenario run IDs where learning was validated
   * @returns The created learning lineage record
   */
  async promoteLearning(
    testLearningId: string,
    userId: string,
    organizationSlug: string,
    notes?: string,
    backtestResult?: BacktestResult,
    scenarioRuns?: string[],
  ): Promise<LearningLineageWithDetails> {
    this.logger.log(
      `Promoting test learning to production: ${testLearningId} by user ${userId}`,
    );

    // Validate learning can be promoted
    const validation = await this.validateForPromotion(testLearningId);
    if (!validation.valid) {
      throw new BadRequestException(
        `Cannot promote learning: ${validation.errors.join(', ')}`,
      );
    }

    const testLearning = validation.learning!;

    // Create production copy with is_test=false
    const productionLearning = await this.learningRepository.create({
      scope_level: testLearning.scope_level,
      domain: testLearning.domain ?? undefined,
      universe_id: testLearning.universe_id ?? undefined,
      target_id: testLearning.target_id ?? undefined,
      analyst_id: testLearning.analyst_id ?? undefined,
      learning_type: testLearning.learning_type,
      title: testLearning.title,
      description: testLearning.description,
      config: testLearning.config,
      source_type: testLearning.source_type,
      source_evaluation_id: testLearning.source_evaluation_id ?? undefined,
      source_missed_opportunity_id:
        testLearning.source_missed_opportunity_id ?? undefined,
      status: 'active',
      version: testLearning.version,
      // Production learning has is_test=false (set by database default or explicitly)
    });

    // Calculate validation metrics
    const validationMetrics = {
      times_applied: testLearning.times_applied,
      times_helpful: testLearning.times_helpful,
      success_rate:
        testLearning.times_applied > 0
          ? testLearning.times_helpful / testLearning.times_applied
          : 0,
    };

    // Create lineage record
    const lineageData: CreateLearningLineageData = {
      organization_slug: organizationSlug,
      test_learning_id: testLearningId,
      production_learning_id: productionLearning.id,
      scenario_runs: scenarioRuns ?? [],
      validation_metrics: validationMetrics,
      backtest_result: backtestResult
        ? (backtestResult as unknown as Record<string, unknown>)
        : undefined,
      promoted_by: userId,
      notes: notes ?? undefined,
    };

    const lineage = await this.lineageRepository.create(lineageData);

    // Audit the promotion action (INV-07: human-approved, audited action)
    await this.auditRepository.log({
      organization_slug: organizationSlug,
      user_id: userId,
      action: 'learning_promoted',
      resource_type: 'learning',
      resource_id: testLearningId,
      details: {
        test_learning_id: testLearningId,
        production_learning_id: productionLearning.id,
        lineage_id: lineage.id,
        validation_metrics: validationMetrics,
        backtest_result: backtestResult,
        scenario_runs: scenarioRuns ?? [],
        notes: notes,
      },
    });

    this.logger.log(
      `Successfully promoted learning ${testLearningId} -> ${productionLearning.id}`,
    );

    // Return lineage with details
    const lineageWithDetails =
      await this.lineageRepository.getPromotionHistory(organizationSlug);
    const promoted = lineageWithDetails.find((l) => l.id === lineage.id);
    if (!promoted) {
      throw new Error('Failed to retrieve promotion details');
    }

    return promoted;
  }

  /**
   * Get promotion history for an organization
   * Returns all learning promotions with enriched user and learning details
   */
  async getPromotionHistory(
    organizationSlug: string,
  ): Promise<LearningLineageWithDetails[]> {
    return this.lineageRepository.getPromotionHistory(organizationSlug);
  }

  /**
   * Get lineage details for a specific test learning
   * Returns the promotion record if the learning has been promoted
   */
  async getLineage(
    testLearningId: string,
  ): Promise<LearningLineageWithDetails | null> {
    const lineages =
      await this.lineageRepository.findByTestLearning(testLearningId);
    if (lineages.length === 0) {
      return null;
    }

    // Return the most recent promotion
    const lineage = lineages[0];

    if (!lineage) {
      return null;
    }

    // Fetch with details
    const lineageWithDetails = await this.lineageRepository.getPromotionHistory(
      lineage.organization_slug,
    );
    return (
      lineageWithDetails.find((l) => l.test_learning_id === testLearningId) ??
      null
    );
  }

  /**
   * Reject a test learning from promotion
   * Marks the learning as disabled and audits the rejection
   *
   * @param learningId - ID of the learning to reject
   * @param userId - ID of the user rejecting the learning
   * @param organizationSlug - Organization slug for audit logging
   * @param reason - Reason for rejection
   */
  async rejectLearning(
    learningId: string,
    userId: string,
    organizationSlug: string,
    reason: string,
  ): Promise<Learning> {
    this.logger.log(`Rejecting learning: ${learningId} by user ${userId}`);

    // Check learning exists and is a test learning
    const learning = await this.learningRepository.findById(learningId);
    if (!learning) {
      throw new NotFoundException(`Learning not found: ${learningId}`);
    }

    if (!learning.is_test) {
      throw new BadRequestException(
        'Can only reject test learnings (is_test=true)',
      );
    }

    // Check not already promoted
    const alreadyPromoted =
      await this.lineageRepository.isTestLearningPromoted(learningId);
    if (alreadyPromoted) {
      throw new ConflictException(
        'Cannot reject learning that has already been promoted',
      );
    }

    // Update learning status to disabled
    const updatedLearning = await this.learningRepository.update(learningId, {
      status: 'disabled',
    });

    // Audit the rejection action (INV-07: human-approved, audited action)
    await this.auditRepository.log({
      organization_slug: organizationSlug,
      user_id: userId,
      action: 'learning_rejected',
      resource_type: 'learning',
      resource_id: learningId,
      details: {
        learning_id: learningId,
        learning_title: learning.title,
        reason: reason,
        times_applied: learning.times_applied,
        times_helpful: learning.times_helpful,
      },
    });

    this.logger.log(`Successfully rejected learning ${learningId}: ${reason}`);

    return updatedLearning;
  }

  /**
   * Run backtest validation for a test learning
   * Simulates what would happen if the learning had been applied in the past
   *
   * @param learningId - ID of the learning to backtest
   * @param windowDays - Number of days to backtest over
   * @returns Backtest result
   */
  async backtestLearning(
    learningId: string,
    windowDays: number = 30,
  ): Promise<BacktestResult> {
    this.logger.log(
      `Running backtest for learning ${learningId} over ${windowDays} days`,
    );

    // Validate learning exists and is a test learning
    const learning = await this.learningRepository.findByIdOrThrow(learningId);
    if (!learning.is_test) {
      throw new BadRequestException(
        'Can only backtest test learnings (is_test=true)',
      );
    }

    // TODO: Implement backtest logic
    // This would involve:
    // 1. Get historical predictions/evaluations from the past windowDays
    // 2. Simulate applying the learning to those predictions
    // 3. Compare actual outcomes with hypothetical outcomes if learning was applied
    // 4. Calculate improvement score

    // Placeholder implementation
    const result: BacktestResult = {
      pass: true,
      improvement_score: 0.0,
      window_days: windowDays,
      details: {
        message:
          'Backtest validation not yet implemented. This is a placeholder.',
        learning_id: learningId,
        learning_title: learning.title,
      },
    };

    this.logger.warn(
      `Backtest validation not yet implemented for learning ${learningId}`,
    );

    return result;
  }

  /**
   * Get promotion statistics for an organization
   * Returns aggregate metrics about learning promotions
   */
  async getPromotionStats(organizationSlug: string): Promise<{
    total_test_learnings: number;
    total_promoted: number;
    total_rejected: number;
    pending_review: number;
    avg_times_applied: number;
    avg_success_rate: number;
  }> {
    // Get all test learnings
    const allLearnings = await this.learningRepository.findByScope(
      'runner', // Get all scopes
    );
    const testLearnings = allLearnings.filter((l) => l.is_test);

    // Get promoted learnings
    const lineages =
      await this.lineageRepository.findByOrganization(organizationSlug);
    const promotedIds = new Set(lineages.map((l) => l.test_learning_id));

    // Get rejected learnings
    const rejectedLearnings = testLearnings.filter(
      (l) => l.status === 'disabled' && !promotedIds.has(l.id),
    );

    // Get pending learnings (active but not promoted or rejected)
    const pendingLearnings = testLearnings.filter(
      (l) => l.status === 'active' && !promotedIds.has(l.id),
    );

    // Calculate averages
    const promotedLearnings = testLearnings.filter((l) =>
      promotedIds.has(l.id),
    );
    const avgTimesApplied =
      promotedLearnings.length > 0
        ? promotedLearnings.reduce((sum, l) => sum + l.times_applied, 0) /
          promotedLearnings.length
        : 0;

    const successRates = promotedLearnings
      .filter((l) => l.times_applied > 0)
      .map((l) => l.times_helpful / l.times_applied);
    const avgSuccessRate =
      successRates.length > 0
        ? successRates.reduce((sum, r) => sum + r, 0) / successRates.length
        : 0;

    return {
      total_test_learnings: testLearnings.length,
      total_promoted: promotedIds.size,
      total_rejected: rejectedLearnings.length,
      pending_review: pendingLearnings.length,
      avg_times_applied: avgTimesApplied,
      avg_success_rate: avgSuccessRate,
    };
  }
}
