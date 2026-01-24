/**
 * Central Crawler E2E Tests
 *
 * Tests the complete flow of the central crawler system including:
 * - Source management (findOrCreate)
 * - Article storage with 4-layer deduplication
 * - Cross-agent content sharing
 * - Subscription-based article pulling
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { CrawlerModule } from '../crawler.module';
import { CrawlerService } from '../services/crawler.service';
import { DeduplicationService } from '../services/deduplication.service';
import { SupabaseModule } from '@/supabase/supabase.module';
import { SupabaseService } from '@/supabase/supabase.service';

// Skip tests if no database connection
const describeWithDb =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? describe
    : describe.skip;

describeWithDb('CrawlerModule E2E', () => {
  let app: INestApplication;
  let crawlerService: CrawlerService;
  let deduplicationService: DeduplicationService;
  let supabaseService: SupabaseService;

  // Test data IDs for cleanup
  const testSourceIds: string[] = [];
  const testArticleIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CrawlerModule, SupabaseModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    crawlerService = moduleFixture.get<CrawlerService>(CrawlerService);
    deduplicationService = moduleFixture.get<DeduplicationService>(DeduplicationService);
    supabaseService = moduleFixture.get<SupabaseService>(SupabaseService);
  });

  afterAll(async () => {
    // Cleanup test data
    const client = supabaseService.getServiceClient();

    // Delete test articles
    if (testArticleIds.length > 0) {
      await client
        .schema('crawler')
        .from('articles')
        .delete()
        .in('id', testArticleIds);
    }

    // Delete test sources
    if (testSourceIds.length > 0) {
      await client
        .schema('crawler')
        .from('sources')
        .delete()
        .in('id', testSourceIds);
    }

    await app.close();
  });

  // =============================================================================
  // SOURCE MANAGEMENT
  // =============================================================================

  describe('Source Management', () => {
    it('should create a new source', async () => {
      const sourceData = {
        organization_slug: 'e2e-test-org',
        name: 'E2E Test Source',
        source_type: 'rss' as const,
        url: `https://e2e-test-${Date.now()}.example.com/feed`,
      };

      const source = await crawlerService.findOrCreateSource(sourceData);

      expect(source).toBeDefined();
      expect(source.id).toBeDefined();
      expect(source.name).toBe(sourceData.name);
      expect(source.url).toBe(sourceData.url);
      expect(source.is_active).toBe(true);

      testSourceIds.push(source.id);
    });

    it('should return existing source when URL matches', async () => {
      const uniqueUrl = `https://e2e-duplicate-test-${Date.now()}.example.com/feed`;

      // Create first source
      const source1 = await crawlerService.findOrCreateSource({
        organization_slug: 'e2e-test-org',
        name: 'Original Source',
        source_type: 'rss',
        url: uniqueUrl,
      });
      testSourceIds.push(source1.id);

      // Try to create with same URL
      const source2 = await crawlerService.findOrCreateSource({
        organization_slug: 'e2e-test-org',
        name: 'Duplicate Source',
        source_type: 'rss',
        url: uniqueUrl,
      });

      // Should return same source
      expect(source2.id).toBe(source1.id);
    });

    it('should find source by ID', async () => {
      const sourceData = {
        organization_slug: 'e2e-test-org',
        name: 'Find By ID Test',
        source_type: 'api' as const,
        url: `https://e2e-findbyid-${Date.now()}.example.com/api`,
      };

      const created = await crawlerService.findOrCreateSource(sourceData);
      testSourceIds.push(created.id);

      const found = await crawlerService.findSourceById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.name).toBe(sourceData.name);
    });

    it('should return null for non-existent source', async () => {
      const found = await crawlerService.findSourceById('00000000-0000-0000-0000-000000000000');

      expect(found).toBeNull();
    });

    it('should find all sources for organization', async () => {
      const orgSlug = `e2e-org-${Date.now()}`;

      // Create multiple sources for same org
      const source1 = await crawlerService.findOrCreateSource({
        organization_slug: orgSlug,
        name: 'Org Source 1',
        source_type: 'rss',
        url: `https://e2e-org1-${Date.now()}.example.com/feed`,
      });
      testSourceIds.push(source1.id);

      const source2 = await crawlerService.findOrCreateSource({
        organization_slug: orgSlug,
        name: 'Org Source 2',
        source_type: 'api',
        url: `https://e2e-org2-${Date.now()}.example.com/api`,
      });
      testSourceIds.push(source2.id);

      const sources = await crawlerService.findAllSources(orgSlug);

      expect(sources.length).toBeGreaterThanOrEqual(2);
      expect(sources.some((s) => s.id === source1.id)).toBe(true);
      expect(sources.some((s) => s.id === source2.id)).toBe(true);
    });
  });

  // =============================================================================
  // ARTICLE STORAGE & DEDUPLICATION
  // =============================================================================

  describe('Article Storage & Deduplication', () => {
    let testSource: Awaited<ReturnType<typeof crawlerService.findOrCreateSource>>;

    beforeAll(async () => {
      testSource = await crawlerService.findOrCreateSource({
        organization_slug: 'e2e-dedup-org',
        name: 'Dedup Test Source',
        source_type: 'rss',
        url: `https://e2e-dedup-${Date.now()}.example.com/feed`,
      });
      testSourceIds.push(testSource.id);
    });

    it('should store a new article', async () => {
      const contentHash = deduplicationService.generateContentHash(
        `Test article ${Date.now()}`,
      );

      const result = await crawlerService.storeArticle({
        organization_slug: 'e2e-dedup-org',
        source_id: testSource.id,
        url: `https://example.com/article-${Date.now()}`,
        title: 'E2E Test Article',
        content: 'This is test article content for E2E testing.',
        content_hash: contentHash,
      });

      expect(result.isNew).toBe(true);
      expect(result.article.id).toBeDefined();
      expect(result.duplicateType).toBeUndefined();

      testArticleIds.push(result.article.id);
    });

    it('should detect exact duplicate within same source', async () => {
      const content = `Duplicate test content ${Date.now()}`;
      const contentHash = deduplicationService.generateContentHash(content);
      const url = `https://example.com/dup-test-${Date.now()}`;

      // Store first article
      const first = await crawlerService.storeArticle({
        organization_slug: 'e2e-dedup-org',
        source_id: testSource.id,
        url: url,
        title: 'Original Article',
        content: content,
        content_hash: contentHash,
      });
      testArticleIds.push(first.article.id);
      expect(first.isNew).toBe(true);

      // Try to store duplicate
      const second = await crawlerService.storeArticle({
        organization_slug: 'e2e-dedup-org',
        source_id: testSource.id,
        url: `${url}-duplicate`,
        title: 'Duplicate Article',
        content: content,
        content_hash: contentHash,
      });

      expect(second.isNew).toBe(false);
      expect(second.duplicateType).toBe('exact');
    });

    it('should detect cross-source duplicate', async () => {
      // Create a second source
      const secondSource = await crawlerService.findOrCreateSource({
        organization_slug: 'e2e-dedup-org',
        name: 'Second Dedup Source',
        source_type: 'rss',
        url: `https://e2e-dedup2-${Date.now()}.example.com/feed`,
      });
      testSourceIds.push(secondSource.id);

      const content = `Cross-source content ${Date.now()}`;
      const contentHash = deduplicationService.generateContentHash(content);

      // Store in first source
      const first = await crawlerService.storeArticle({
        organization_slug: 'e2e-dedup-org',
        source_id: testSource.id,
        url: `https://source1.com/article-${Date.now()}`,
        title: 'Source 1 Article',
        content: content,
        content_hash: contentHash,
      });
      testArticleIds.push(first.article.id);

      // Try to store same content in second source
      const second = await crawlerService.storeArticle({
        organization_slug: 'e2e-dedup-org',
        source_id: secondSource.id,
        url: `https://source2.com/article-${Date.now()}`,
        title: 'Source 2 Article',
        content: content,
        content_hash: contentHash,
      });

      expect(second.isNew).toBe(false);
      expect(second.duplicateType).toBe('cross_source');
    });
  });

  // =============================================================================
  // CRAWL LIFECYCLE
  // =============================================================================

  describe('Crawl Lifecycle', () => {
    let testSource: Awaited<ReturnType<typeof crawlerService.findOrCreateSource>>;

    beforeAll(async () => {
      testSource = await crawlerService.findOrCreateSource({
        organization_slug: 'e2e-crawl-org',
        name: 'Crawl Lifecycle Test',
        source_type: 'rss',
        url: `https://e2e-crawl-${Date.now()}.example.com/feed`,
      });
      testSourceIds.push(testSource.id);
    });

    it('should track crawl lifecycle from start to success', async () => {
      // Start crawl
      const crawl = await crawlerService.startCrawl(testSource.id);
      expect(crawl.id).toBeDefined();
      expect(crawl.source_id).toBe(testSource.id);
      expect(crawl.status).toBe('running');

      // Complete crawl with success
      const completed = await crawlerService.completeCrawlSuccess(crawl.id, {
        articles_found: 10,
        articles_new: 5,
        duplicates_exact: 2,
        duplicates_cross_source: 1,
        duplicates_fuzzy_title: 1,
        duplicates_phrase_overlap: 1,
        crawl_duration_ms: 5000,
      });

      expect(completed.status).toBe('success');
      expect(completed.articles_found).toBe(10);
      expect(completed.articles_new).toBe(5);
    });

    it('should track crawl lifecycle with error', async () => {
      const crawl = await crawlerService.startCrawl(testSource.id);

      const failed = await crawlerService.completeCrawlError(
        crawl.id,
        'Connection timeout',
        1000,
      );

      expect(failed.status).toBe('error');
      expect(failed.error_message).toBe('Connection timeout');
    });

    it('should mark source crawl success and update timestamp', async () => {
      await crawlerService.markSourceCrawlSuccess(testSource.id);

      const updated = await crawlerService.findSourceById(testSource.id);
      expect(updated?.last_crawl_at).toBeDefined();
      expect(updated?.consecutive_errors).toBe(0);
    });

    it('should mark source crawl error and increment counter', async () => {
      await crawlerService.markSourceCrawlError(testSource.id, 'Test error');

      const updated = await crawlerService.findSourceById(testSource.id);
      expect(updated?.consecutive_errors).toBeGreaterThan(0);
    });
  });

  // =============================================================================
  // BATCH PROCESSING
  // =============================================================================

  describe('Batch Processing', () => {
    let testSource: Awaited<ReturnType<typeof crawlerService.findOrCreateSource>>;

    beforeAll(async () => {
      testSource = await crawlerService.findOrCreateSource({
        organization_slug: 'e2e-batch-org',
        name: 'Batch Processing Test',
        source_type: 'rss',
        url: `https://e2e-batch-${Date.now()}.example.com/feed`,
      });
      testSourceIds.push(testSource.id);
    });

    it('should process multiple items in batch', async () => {
      const items = [
        {
          url: `https://example.com/batch-1-${Date.now()}`,
          title: 'Batch Article 1',
          content: 'Content for batch article 1',
        },
        {
          url: `https://example.com/batch-2-${Date.now()}`,
          title: 'Batch Article 2',
          content: 'Content for batch article 2',
        },
        {
          url: `https://example.com/batch-3-${Date.now()}`,
          title: 'Batch Article 3',
          content: 'Content for batch article 3',
        },
      ];

      const result = await crawlerService.processCrawledItems(
        testSource.id,
        'e2e-batch-org',
        items,
      );

      expect(result.source_id).toBe(testSource.id);
      expect(result.articles_found).toBe(3);
      expect(result.articles_new).toBe(3);
      expect(result.errors).toHaveLength(0);
      expect(result.new_articles).toHaveLength(3);

      // Track for cleanup
      result.new_articles.forEach((a) => testArticleIds.push(a.id));
    });

    it('should handle duplicates in batch processing', async () => {
      const uniqueContent = `Batch duplicate test ${Date.now()}`;
      const items = [
        {
          url: `https://example.com/batch-dup-1-${Date.now()}`,
          title: 'First Unique',
          content: uniqueContent,
        },
        {
          url: `https://example.com/batch-dup-2-${Date.now()}`,
          title: 'Second Same Content',
          content: uniqueContent, // Same content = duplicate
        },
      ];

      const result = await crawlerService.processCrawledItems(
        testSource.id,
        'e2e-batch-org',
        items,
      );

      expect(result.articles_found).toBe(2);
      expect(result.articles_new).toBe(1);
      expect(result.duplicates.exact).toBeGreaterThanOrEqual(1);

      // Track for cleanup
      result.new_articles.forEach((a) => testArticleIds.push(a.id));
    });
  });

  // =============================================================================
  // ARTICLE RETRIEVAL
  // =============================================================================

  describe('Article Retrieval', () => {
    let testSource: Awaited<ReturnType<typeof crawlerService.findOrCreateSource>>;
    let storedArticles: { id: string; first_seen_at: string }[] = [];

    beforeAll(async () => {
      testSource = await crawlerService.findOrCreateSource({
        organization_slug: 'e2e-retrieval-org',
        name: 'Retrieval Test Source',
        source_type: 'rss',
        url: `https://e2e-retrieval-${Date.now()}.example.com/feed`,
      });
      testSourceIds.push(testSource.id);

      // Store some articles
      for (let i = 0; i < 3; i++) {
        const result = await crawlerService.storeArticle({
          organization_slug: 'e2e-retrieval-org',
          source_id: testSource.id,
          url: `https://example.com/retrieval-${Date.now()}-${i}`,
          title: `Retrieval Test Article ${i}`,
          content: `Content for retrieval test ${i}`,
          content_hash: deduplicationService.generateContentHash(`retrieval-${Date.now()}-${i}`),
        });
        if (result.isNew) {
          storedArticles.push({
            id: result.article.id,
            first_seen_at: result.article.first_seen_at,
          });
          testArticleIds.push(result.article.id);
        }
      }
    });

    it('should find new articles for source since timestamp', async () => {
      const pastDate = new Date('2020-01-01');
      const articles = await crawlerService.findNewArticlesForSource(
        testSource.id,
        pastDate,
        100,
      );

      expect(articles.length).toBeGreaterThanOrEqual(storedArticles.length);
    });

    it('should find new articles for multiple sources', async () => {
      const pastDate = new Date('2020-01-01');
      const articles = await crawlerService.findNewArticlesForSources(
        [testSource.id],
        pastDate,
        100,
      );

      expect(articles.length).toBeGreaterThanOrEqual(storedArticles.length);
    });

    it('should respect limit parameter', async () => {
      const pastDate = new Date('2020-01-01');
      const articles = await crawlerService.findNewArticlesForSource(
        testSource.id,
        pastDate,
        1,
      );

      expect(articles.length).toBeLessThanOrEqual(1);
    });
  });
});
