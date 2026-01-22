import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ExecutionContext, NIL_UUID } from '@orchestrator-ai/transport-types';
import { ScopeRepository } from '../repositories/scope.repository';
import { SubjectRepository } from '../repositories/subject.repository';
import {
  RiskAnalysisService,
  AnalysisResult,
} from '../services/risk-analysis.service';

export interface RunnerResult {
  analyzed: number;
  successful: number;
  failed: number;
  scopesProcessed: number;
  duration: number;
}

@Injectable()
export class RiskAnalysisRunner {
  private readonly logger = new Logger(RiskAnalysisRunner.name);
  private isRunning = false;

  constructor(
    private readonly scopeRepo: ScopeRepository,
    private readonly subjectRepo: SubjectRepository,
    private readonly riskAnalysisService: RiskAnalysisService,
  ) {}

  /**
   * Scheduled runner - runs every 30 minutes
   * Analyzes all active subjects across all active scopes
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async runScheduledAnalysis(): Promise<void> {
    this.logger.log('[CRON] Starting scheduled risk analysis run');
    await this.runBatchAnalysis();
  }

  /**
   * Manual trigger for batch analysis
   */
  async runBatchAnalysis(): Promise<RunnerResult> {
    if (this.isRunning) {
      this.logger.warn(
        'Skipping - previous risk analysis run still in progress',
      );
      return {
        analyzed: 0,
        successful: 0,
        failed: 0,
        scopesProcessed: 0,
        duration: 0,
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    let analyzed = 0;
    let successful = 0;
    let failed = 0;
    let scopesProcessed = 0;

    try {
      // Get all active scopes
      const scopes = await this.scopeRepo.findAllActive();
      this.logger.log(`Found ${scopes.length} active scopes to process`);

      for (const scope of scopes) {
        // Check if Risk Radar is enabled for this scope
        if (!scope.analysis_config?.riskRadar?.enabled) {
          this.logger.debug(
            `Skipping scope ${scope.name} - Risk Radar disabled`,
          );
          continue;
        }

        scopesProcessed++;

        // Get active subjects for this scope
        const subjects = await this.subjectRepo.findByScope(scope.id);
        this.logger.log(
          `Processing ${subjects.length} subjects in scope ${scope.name}`,
        );

        for (const subject of subjects) {
          analyzed++;

          try {
            // Create execution context for this analysis
            const ctx = this.createExecutionContext(
              scope.organization_slug,
              scope.agent_slug,
            );

            await this.riskAnalysisService.analyzeSubject(subject, scope, ctx);
            successful++;
          } catch (error) {
            failed++;
            this.logger.error(
              `Failed to analyze subject ${subject.identifier}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `Risk analysis batch complete: ${successful}/${analyzed} successful ` +
          `across ${scopesProcessed} scopes in ${duration}ms`,
      );

      return {
        analyzed,
        successful,
        failed,
        scopesProcessed,
        duration,
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Analyze a single subject (for manual triggers from UI)
   */
  async analyzeSubject(subjectId: string): Promise<AnalysisResult> {
    const subject = await this.subjectRepo.findByIdOrThrow(subjectId);
    const scope = await this.scopeRepo.findByIdOrThrow(subject.scope_id);

    const context = this.createExecutionContext(
      scope.organization_slug,
      scope.agent_slug,
    );

    return this.riskAnalysisService.analyzeSubject(subject, scope, context);
  }

  /**
   * Create an execution context for background runner operations
   */
  private createExecutionContext(
    orgSlug: string,
    agentSlug: string,
  ): ExecutionContext {
    return {
      orgSlug,
      userId: NIL_UUID, // System user for background operations
      conversationId: NIL_UUID,
      taskId: this.generateTaskId(),
      planId: NIL_UUID,
      deliverableId: NIL_UUID,
      agentSlug,
      agentType: 'api',
      provider: process.env.DEFAULT_LLM_PROVIDER || 'anthropic',
      model: process.env.DEFAULT_LLM_MODEL || 'claude-sonnet-4-20250514',
    };
  }

  /**
   * Generate a unique task ID for this runner execution
   */
  private generateTaskId(): string {
    return `risk-runner-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Check if runner is currently processing
   */
  isProcessing(): boolean {
    return this.isRunning;
  }
}
