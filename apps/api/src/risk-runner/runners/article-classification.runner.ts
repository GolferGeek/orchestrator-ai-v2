/**
 * Article Classification Runner
 *
 * Cron-scheduled runner that classifies unprocessed crawler articles
 * by their relevance to risk dimensions. Uses a cheap/fast LLM for
 * efficient triage, enabling targeted dimension analysis.
 *
 * Flow:
 * 1. Get all active scopes with crawler subscriptions
 * 2. For each scope, classify unprocessed articles
 * 3. Store classifications in risk.article_classifications
 * 4. Classifications are then used by dimension analysis
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ArticleClassifierService,
  ClassificationBatchResult,
} from '../services/article-classifier.service';
import { ScopeRepository } from '../repositories/scope.repository';

export interface ClassificationRunnerResult {
  scopesProcessed: number;
  totalArticles: number;
  totalClassified: number;
  totalFailed: number;
  duration: number;
  skipped: boolean;
  scopeResults: Array<{
    scopeId: string;
    scopeName: string;
    articlesProcessed: number;
    classified: number;
    failed: number;
  }>;
  errors: string[];
}

@Injectable()
export class ArticleClassificationRunner {
  private readonly logger = new Logger(ArticleClassificationRunner.name);
  private isRunning = false;

  constructor(
    private readonly classifierService: ArticleClassifierService,
    private readonly scopeRepo: ScopeRepository,
  ) {}

  /**
   * Scheduled runner - runs every 10 minutes
   * Classifies unprocessed articles for all active scopes
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async runScheduledClassification(): Promise<void> {
    this.logger.log('[CRON] Starting scheduled article classification');
    await this.runBatchClassification();
  }

  /**
   * Manual trigger for batch classification
   */
  async runBatchClassification(
    articlesPerScope: number = 50,
  ): Promise<ClassificationRunnerResult> {
    if (this.isRunning) {
      this.logger.warn('Skipping - previous classification run still in progress');
      return {
        scopesProcessed: 0,
        totalArticles: 0,
        totalClassified: 0,
        totalFailed: 0,
        duration: 0,
        skipped: true,
        scopeResults: [],
        errors: [],
      };
    }

    this.isRunning = true;
    const startTime = Date.now();

    const result: ClassificationRunnerResult = {
      scopesProcessed: 0,
      totalArticles: 0,
      totalClassified: 0,
      totalFailed: 0,
      duration: 0,
      skipped: false,
      scopeResults: [],
      errors: [],
    };

    try {
      // Get all active scopes (non-test)
      const scopes = await this.scopeRepo.findAllActive();
      const activeScopes = scopes.filter((s) => !s.is_test);

      this.logger.log(`Processing ${activeScopes.length} active scopes for article classification`);

      for (const scope of activeScopes) {
        try {
          const batchResult = await this.classifierService.classifyArticlesForScope(
            scope.id,
            articlesPerScope,
          );

          result.scopesProcessed++;
          result.totalArticles += batchResult.totalArticles;
          result.totalClassified += batchResult.classified;
          result.totalFailed += batchResult.failed;

          result.scopeResults.push({
            scopeId: scope.id,
            scopeName: scope.name,
            articlesProcessed: batchResult.totalArticles,
            classified: batchResult.classified,
            failed: batchResult.failed,
          });

          if (batchResult.errors.length > 0) {
            result.errors.push(...batchResult.errors.map((e) => `[${scope.name}] ${e}`));
          }

          this.logger.debug(
            `Scope ${scope.name}: ${batchResult.classified}/${batchResult.totalArticles} articles classified`,
          );
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`[${scope.name}] Scope processing failed: ${msg}`);
          this.logger.error(`Failed to process scope ${scope.name}: ${msg}`);
        }
      }

      result.duration = Date.now() - startTime;

      this.logger.log(
        `Article classification complete: ${result.totalClassified}/${result.totalArticles} articles ` +
          `across ${result.scopesProcessed} scopes in ${result.duration}ms`,
      );

      if (result.totalFailed > 0) {
        this.logger.warn(`${result.totalFailed} articles failed classification`);
      }

      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Batch classification failed: ${msg}`);
      this.logger.error(`Batch classification failed: ${msg}`);
      result.duration = Date.now() - startTime;
      return result;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Classify articles for a single scope (for manual triggers)
   */
  async classifyScopeArticles(
    scopeId: string,
    limit: number = 50,
  ): Promise<ClassificationBatchResult> {
    return this.classifierService.classifyArticlesForScope(scopeId, limit);
  }

  /**
   * Get classification statistics for a scope
   */
  async getClassificationStats(scopeId: string) {
    return this.classifierService.getClassificationStats(scopeId);
  }

  /**
   * Check if runner is currently processing
   */
  isProcessing(): boolean {
    return this.isRunning;
  }
}
