import { Test, TestingModule } from '@nestjs/testing';
import { FirecrawlService } from '../firecrawl.service';
import { Source } from '../../interfaces/source.interface';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('FirecrawlService', () => {
  let service: FirecrawlService;

  const mockSource: Source = {
    id: 'source-123',
    name: 'Test Source',
    description: 'A test source',
    source_type: 'web',
    url: 'https://example.com/news',
    scope_level: 'universe',
    domain: 'stocks',
    universe_id: 'universe-123',
    target_id: null,
    crawl_config: {
      selector: '.article-content',
      timeout_ms: 5000,
    },
    auth_config: { type: 'none' },
    crawl_frequency_minutes: 15,
    is_active: true,
    last_crawl_at: null,
    last_crawl_status: null,
    last_error: null,
    consecutive_errors: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    // Set up environment variable for tests
    process.env.FIRECRAWL_API_KEY = 'test-api-key';

    const module: TestingModule = await Test.createTestingModule({
      providers: [FirecrawlService],
    }).compile();

    service = module.get<FirecrawlService>(FirecrawlService);

    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.FIRECRAWL_API_KEY;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isConfigured', () => {
    it('should return true when API key is set', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when API key is not set', async () => {
      delete process.env.FIRECRAWL_API_KEY;

      const module: TestingModule = await Test.createTestingModule({
        providers: [FirecrawlService],
      }).compile();

      const unconfiguredService =
        module.get<FirecrawlService>(FirecrawlService);
      expect(unconfiguredService.isConfigured()).toBe(false);
    });
  });

  describe('scrape', () => {
    it('should successfully scrape a URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            markdown: '# Test Article\n\nThis is the content.',
            metadata: {
              title: 'Test Article',
              sourceURL: 'https://example.com/news',
            },
          },
        }),
      });

      const result = await service.scrape('https://example.com/news');

      expect(result.success).toBe(true);
      expect(result.data?.markdown).toContain('Test Article');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/scrape'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        }),
      );
    });

    it('should return error when API key is not configured', async () => {
      delete process.env.FIRECRAWL_API_KEY;

      const module: TestingModule = await Test.createTestingModule({
        providers: [FirecrawlService],
      }).compile();

      const unconfiguredService =
        module.get<FirecrawlService>(FirecrawlService);

      const result = await unconfiguredService.scrape('https://example.com');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limited',
      });

      const result = await service.scrape('https://example.com/news');

      expect(result.success).toBe(false);
      expect(result.error).toContain('429');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.scrape('https://example.com/news');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should reject invalid URLs', async () => {
      const result = await service.scrape('not-a-valid-url');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });

    it('should reject non-http protocols', async () => {
      const result = await service.scrape('ftp://example.com/file');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid protocol');
    });
  });

  describe('scrapeSource', () => {
    it('should scrape a source and return crawl result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            markdown: 'Article content here',
            metadata: {
              title: 'Test Article',
              sourceURL: mockSource.url,
            },
          },
        }),
      });

      const result = await service.scrapeSource(mockSource);

      expect(result.success).toBe(true);
      expect(result.source_id).toBe(mockSource.id);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.content).toBe('Article content here');
    });

    it('should reject non-web sources', async () => {
      const rssSource = { ...mockSource, source_type: 'rss' as const };

      const result = await service.scrapeSource(rssSource);

      expect(result.success).toBe(false);
      expect(result.error).toContain("only supports 'web' sources");
    });

    it('should handle empty response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            markdown: '',
            metadata: {},
          },
        }),
      });

      const result = await service.scrapeSource(mockSource);

      expect(result.success).toBe(true);
      expect(result.items).toHaveLength(0);
    });
  });

  describe('testCrawl', () => {
    it('should return preview of crawled content', async () => {
      const longContent = 'x'.repeat(2000);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            markdown: longContent,
            metadata: { title: 'Test' },
          },
        }),
      });

      const result = await service.testCrawl('https://example.com/article');

      expect(result.success).toBe(true);
      expect(result.preview.length).toBeLessThanOrEqual(1000);
      expect(result.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it('should validate URL before crawling', async () => {
      const result = await service.testCrawl('invalid-url');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });
  });
});
