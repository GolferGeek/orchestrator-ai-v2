import { Injectable, Logger } from '@nestjs/common';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { RiskScope } from '../interfaces/scope.interface';
import { RiskSubject } from '../interfaces/subject.interface';
import { RiskCompositeScore } from '../interfaces/composite-score.interface';
import { ScopeRepository } from '../repositories/scope.repository';
import { SubjectRepository } from '../repositories/subject.repository';
import { DimensionRepository } from '../repositories/dimension.repository';
import { AssessmentRepository } from '../repositories/assessment.repository';
import { CompositeScoreRepository } from '../repositories/composite-score.repository';
import { DimensionAnalyzerService } from './dimension-analyzer.service';
import { ScoreAggregationService } from './score-aggregation.service';

export interface AnalysisResult {
  subject: RiskSubject;
  compositeScore: RiskCompositeScore;
  assessmentCount: number;
}

@Injectable()
export class RiskAnalysisService {
  private readonly logger = new Logger(RiskAnalysisService.name);

  constructor(
    private readonly scopeRepo: ScopeRepository,
    private readonly subjectRepo: SubjectRepository,
    private readonly dimensionRepo: DimensionRepository,
    private readonly assessmentRepo: AssessmentRepository,
    private readonly compositeScoreRepo: CompositeScoreRepository,
    private readonly dimensionAnalyzer: DimensionAnalyzerService,
    private readonly scoreAggregation: ScoreAggregationService,
  ) {}

  /**
   * Run full risk analysis for a single subject
   * This is the main orchestration method
   */
  async analyzeSubject(
    subject: RiskSubject,
    scope: RiskScope,
    context: ExecutionContext,
  ): Promise<AnalysisResult> {
    this.logger.log(
      `Starting risk analysis for ${subject.identifier} in scope ${scope.name}`,
    );

    const analysisConfig = scope.analysis_config ?? {};

    // Check if Risk Radar is enabled
    if (!analysisConfig.riskRadar?.enabled) {
      this.logger.debug(`Risk Radar disabled for scope ${scope.name}`);
      throw new Error('Risk Radar is not enabled for this scope');
    }

    // 1. Get all active dimensions for this scope
    const dimensions = await this.dimensionRepo.findByScope(scope.id);
    if (dimensions.length === 0) {
      throw new Error(`No dimensions configured for scope ${scope.name}`);
    }

    this.logger.debug(
      `Found ${dimensions.length} dimensions to analyze: ${dimensions.map((d) => d.slug).join(', ')}`,
    );

    // 2. Run dimension analysis in parallel (Risk Radar)
    const assessmentPromises = dimensions.map((dimension) =>
      this.dimensionAnalyzer.analyzeDimension({
        subject,
        dimension,
        context,
        // TODO: Add market data fetching service
        marketData: {},
      }),
    );

    const assessmentResults = await Promise.allSettled(assessmentPromises);

    // 3. Filter successful assessments and create in database
    type AssessmentData = Awaited<
      ReturnType<typeof this.dimensionAnalyzer.analyzeDimension>
    >;
    const successfulAssessments = assessmentResults
      .filter(
        (r): r is PromiseFulfilledResult<AssessmentData> =>
          r.status === 'fulfilled',
      )
      .map((r) => r.value);

    if (successfulAssessments.length === 0) {
      throw new Error('All dimension analyses failed');
    }

    // Save assessments to database
    const createdAssessments = await this.assessmentRepo.createBatch(
      successfulAssessments,
    );

    this.logger.debug(
      `Created ${createdAssessments.length} assessments for ${subject.identifier}`,
    );

    // 4. Aggregate into composite score
    const aggregation = this.scoreAggregation.aggregateAssessments(
      createdAssessments,
      dimensions,
    );

    // 5. Mark previous active scores as superseded
    await this.compositeScoreRepo.supersedeForSubject(subject.id);

    // 6. Calculate validity duration
    const staleHours = scope.thresholds?.stale_hours ?? 24;
    const validUntil = this.scoreAggregation.calculateValidUntil(
      new Date(),
      staleHours,
    );

    // 7. Create the composite score
    const compositeScore = await this.compositeScoreRepo.create({
      subject_id: subject.id,
      task_id: context.taskId,
      overall_score: aggregation.overallScore,
      dimension_scores: aggregation.dimensionScores,
      confidence: aggregation.confidence,
      status: 'active',
      valid_until: validUntil.toISOString(),
    });

    this.logger.log(
      `Risk analysis complete for ${subject.identifier}: score=${compositeScore.overall_score}`,
    );

    return {
      subject,
      compositeScore,
      assessmentCount: createdAssessments.length,
    };
  }

  /**
   * Run risk analysis for all active subjects in a scope
   */
  async analyzeScope(
    scope: RiskScope,
    context: ExecutionContext,
  ): Promise<AnalysisResult[]> {
    const subjects = await this.subjectRepo.findByScope(scope.id);

    this.logger.log(
      `Analyzing ${subjects.length} subjects in scope ${scope.name}`,
    );

    const results: AnalysisResult[] = [];

    for (const subject of subjects) {
      try {
        const result = await this.analyzeSubject(subject, scope, context);
        results.push(result);
      } catch (error) {
        this.logger.error(
          `Failed to analyze subject ${subject.identifier}: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Continue with other subjects
      }
    }

    return results;
  }

  /**
   * Get the current risk score for a subject
   */
  async getCurrentScore(subjectId: string): Promise<RiskCompositeScore | null> {
    return this.compositeScoreRepo.findActiveBySubject(subjectId);
  }

  /**
   * Check if a subject's score is stale
   */
  async isScoreStale(subjectId: string): Promise<boolean> {
    const score = await this.getCurrentScore(subjectId);
    if (!score) {
      return true;
    }

    if (!score.valid_until) {
      return false;
    }

    return new Date() > new Date(score.valid_until);
  }

  /**
   * Get all active scopes for an agent
   */
  async getScopesForAgent(
    agentSlug: string,
    organizationSlug: string,
  ): Promise<RiskScope[]> {
    return this.scopeRepo.findByAgentSlug(agentSlug, organizationSlug);
  }
}
