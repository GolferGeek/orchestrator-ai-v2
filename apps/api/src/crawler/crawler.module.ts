import { Module } from '@nestjs/common';
import { SupabaseModule } from '@/supabase/supabase.module';

// Repositories
import {
  CrawlerSourceRepository,
  ArticleRepository,
  SourceCrawlRepository,
} from './repositories';

// Services
import { CrawlerService, DeduplicationService } from './services';

// Controllers
import { CrawlerAdminController } from './crawler-admin.controller';

/**
 * CrawlerModule - Central crawling infrastructure
 *
 * Provides shared crawling capabilities for all agents:
 * - Source management (findOrCreate prevents duplicates)
 * - Article storage with 4-layer deduplication
 * - Crawl tracking and metrics
 *
 * Agents use this module to:
 * 1. Register sources via CrawlerService.findOrCreateSource()
 * 2. Pull new articles via CrawlerService.findNewArticlesForSource()
 * 3. Store crawled content via CrawlerService.storeArticle()
 *
 * The actual crawling (Firecrawl, RSS, etc.) is handled by agent-specific
 * services or a central crawler runner.
 */
@Module({
  imports: [SupabaseModule],
  controllers: [CrawlerAdminController],
  providers: [
    // Repositories
    CrawlerSourceRepository,
    ArticleRepository,
    SourceCrawlRepository,
    // Services
    DeduplicationService,
    CrawlerService,
  ],
  exports: [
    // Export repositories for advanced use cases
    CrawlerSourceRepository,
    ArticleRepository,
    SourceCrawlRepository,
    // Export services (primary interface)
    DeduplicationService,
    CrawlerService,
  ],
})
export class CrawlerModule {}
