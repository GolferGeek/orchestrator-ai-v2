/**
 * TestDbSourceCrawlerService - Crawls test_db sources from prediction.test_articles
 *
 * Phase 2: Test Input Infrastructure
 *
 * This service handles the `test_db` source type, which reads synthetic articles
 * from the `prediction.test_articles` table instead of external URLs.
 *
 * Key features:
 * - Reads from DB instead of network calls
 * - All content is automatically marked as is_test=true
 * - Supports filtering by scenario_id, target_symbols, and processed status
 * - Marks articles as processed after successful ingestion
 *
 * INVARIANTS:
 * - INV-02: All signals from test_db sources MUST have is_test=true
 * - INV-04: Test predictors can ONLY affect T_ prefixed targets
 * - INV-08: Test target symbols MUST have T_ prefix
 *
 * @module test-db-source-crawler
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  TestArticleRepository,
  TestArticle,
} from '../repositories/test-article.repository';
import { Source } from '../interfaces/source.interface';
import { CrawledItem, CrawlResult } from '../interfaces/crawl-config.interface';

/**
 * Configuration for test_db source crawling
 */
export interface TestDbCrawlConfig {
  /** Organization slug to filter articles */
  organization_slug: string;
  /** Optional scenario ID to filter articles */
  scenario_id?: string;
  /** Optional target symbols to filter articles */
  target_symbols?: string[];
  /** Only fetch unprocessed articles (default: true) */
  unprocessed_only?: boolean;
  /** Maximum articles to fetch per crawl (default: 100) */
  max_articles?: number;
}

/**
 * Result from test_db crawl with additional test metadata
 */
export interface TestDbCrawlResult extends CrawlResult {
  /** Article IDs that were crawled */
  article_ids: string[];
  /** Scenario ID if filtering by scenario */
  scenario_id?: string;
  /** Flag indicating all content is test data */
  is_test: true;
}

@Injectable()
export class TestDbSourceCrawlerService {
  private readonly logger = new Logger(TestDbSourceCrawlerService.name);

  constructor(private readonly testArticleRepository: TestArticleRepository) {}

  /**
   * Crawl a test_db source by reading from prediction.test_articles
   *
   * @param source - The test_db source configuration
   * @returns CrawlResult with articles from the database
   */
  async crawlTestDbSource(source: Source): Promise<TestDbCrawlResult> {
    const startTime = Date.now();

    // Validate source type
    if (source.source_type !== 'test_db') {
      return {
        success: false,
        source_id: source.id,
        items: [],
        error: `Invalid source type: ${source.source_type}. Expected test_db.`,
        duration_ms: Date.now() - startTime,
        article_ids: [],
        is_test: true,
      };
    }

    // Extract config from crawl_config
    const config = this.extractConfig(source);

    if (!config.organization_slug) {
      return {
        success: false,
        source_id: source.id,
        items: [],
        error:
          'Missing organization_slug in crawl_config for test_db source. Configure via crawl_config.organization_slug.',
        duration_ms: Date.now() - startTime,
        article_ids: [],
        is_test: true,
      };
    }

    try {
      // Fetch articles from the database
      const articles = await this.fetchTestArticles(config);

      this.logger.log(
        `Fetched ${articles.length} test articles for source ${source.id}` +
          (config.scenario_id ? ` (scenario: ${config.scenario_id})` : ''),
      );

      // Convert articles to CrawledItems
      const items: CrawledItem[] = articles.map((article) =>
        this.articleToCrawledItem(article),
      );

      return {
        success: true,
        source_id: source.id,
        items,
        duration_ms: Date.now() - startTime,
        article_ids: articles.map((a) => a.id),
        scenario_id: config.scenario_id,
        is_test: true,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to crawl test_db source: ${errorMessage}`);

      return {
        success: false,
        source_id: source.id,
        items: [],
        error: errorMessage,
        duration_ms: Date.now() - startTime,
        article_ids: [],
        is_test: true,
      };
    }
  }

  /**
   * Mark articles as processed after successful signal creation
   *
   * @param articleIds - IDs of articles to mark as processed
   */
  async markArticlesProcessed(articleIds: string[]): Promise<void> {
    if (articleIds.length === 0) return;

    try {
      await this.testArticleRepository.bulkMarkProcessed(articleIds);
      this.logger.debug(
        `Marked ${articleIds.length} test articles as processed`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to mark articles as processed: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Extract TestDbCrawlConfig from source's crawl_config
   */
  private extractConfig(source: Source): TestDbCrawlConfig {
    const crawlConfig = source.crawl_config ?? {};

    return {
      organization_slug: crawlConfig.organization_slug ?? '',
      scenario_id: crawlConfig.scenario_id,
      target_symbols: crawlConfig.target_symbols,
      unprocessed_only: crawlConfig.unprocessed_only ?? true,
      max_articles: crawlConfig.max_articles ?? 100,
    };
  }

  /**
   * Fetch test articles based on configuration
   */
  private async fetchTestArticles(
    config: TestDbCrawlConfig,
  ): Promise<TestArticle[]> {
    let articles: TestArticle[];

    if (config.scenario_id) {
      // Filter by scenario
      articles = await this.testArticleRepository.findByScenario(
        config.scenario_id,
      );
    } else if (
      config.target_symbols &&
      config.target_symbols.length > 0 &&
      config.target_symbols[0]
    ) {
      // Filter by target symbol (use first symbol, could extend to support multiple)
      articles = await this.testArticleRepository.findByTargetSymbol(
        config.target_symbols[0],
      );
    } else {
      // Get all unprocessed articles for the organization
      articles = await this.testArticleRepository.findUnprocessed(
        config.scenario_id,
      );
    }

    // Apply unprocessed filter if enabled
    if (config.unprocessed_only) {
      articles = articles.filter((a) => !a.processed);
    }

    // Apply max limit
    if (config.max_articles && articles.length > config.max_articles) {
      articles = articles.slice(0, config.max_articles);
    }

    // Validate all target symbols have T_ prefix (INV-08)
    for (const article of articles) {
      const invalidSymbols = article.target_symbols.filter(
        (s) => !s.startsWith('T_'),
      );
      if (invalidSymbols.length > 0) {
        this.logger.warn(
          `Article ${article.id} has invalid target symbols without T_ prefix: ${invalidSymbols.join(', ')}. ` +
            `This violates INV-08.`,
        );
      }
    }

    return articles;
  }

  /**
   * Convert a TestArticle to a CrawledItem
   */
  private articleToCrawledItem(article: TestArticle): CrawledItem {
    return {
      content: article.content,
      title: article.title,
      url: `synthetic://test-article/${article.id}`,
      published_at: article.published_at,
      metadata: {
        // Test data markers
        is_test: true,
        is_synthetic: true,
        synthetic_marker: article.synthetic_marker,

        // Article metadata
        test_article_id: article.id,
        scenario_id: article.scenario_id,
        organization_slug: article.organization_slug,

        // Expected outcomes for validation
        sentiment_expected: article.sentiment_expected,
        strength_expected: article.strength_expected,

        // Target symbols for signal routing
        target_symbols: article.target_symbols,
      },
    };
  }

  /**
   * Create a test_db source configuration
   * Helper method for creating test sources programmatically
   */
  static createTestDbSourceConfig(
    name: string,
    organizationSlug: string,
    options: {
      scenarioId?: string;
      targetSymbols?: string[];
      description?: string;
      domain?: 'stocks' | 'crypto' | 'elections' | 'polymarket';
    } = {},
  ): {
    name: string;
    description: string;
    source_type: 'test_db';
    url: string;
    scope_level: 'domain';
    domain?: 'stocks' | 'crypto' | 'elections' | 'polymarket';
    crawl_config: {
      organization_slug: string;
      scenario_id?: string;
      target_symbols?: string[];
      unprocessed_only: boolean;
      max_articles: number;
    };
    is_test: true;
  } {
    return {
      name,
      description:
        options.description ??
        `Test DB source for ${organizationSlug}${options.scenarioId ? ` (scenario: ${options.scenarioId})` : ''}`,
      source_type: 'test_db',
      url: `db://prediction.test_articles?org=${organizationSlug}${options.scenarioId ? `&scenario=${options.scenarioId}` : ''}`,
      scope_level: 'domain',
      domain: options.domain,
      crawl_config: {
        organization_slug: organizationSlug,
        scenario_id: options.scenarioId,
        target_symbols: options.targetSymbols,
        unprocessed_only: true,
        max_articles: 100,
      },
      is_test: true,
    };
  }
}
