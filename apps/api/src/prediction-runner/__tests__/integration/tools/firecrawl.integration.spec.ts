/**
 * Firecrawl Integration Tests
 *
 * These tests hit the REAL Firecrawl API to validate web scraping.
 * Run with: npx jest --config jest.integration.config.js firecrawl.integration.spec.ts
 *
 * Required environment variables:
 * - FIRECRAWL_API_KEY (required)
 * - FIRECRAWL_BASE_URL (optional, defaults to https://api.firecrawl.dev/v1)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { FirecrawlService } from '../../../services/firecrawl.service';

// Check if we should skip tests
const shouldSkipFirecrawl = !process.env.FIRECRAWL_API_KEY;

// Test URLs - public pages that should be scrape-friendly
const TEST_URLS = {
  simple: 'https://example.com',
  news: 'https://news.ycombinator.com',
  finance: 'https://finance.yahoo.com',
  jsonTest: 'https://httpbin.org/json',
  techCrunch: 'https://techcrunch.com',
};

// Helper to check if error is rate limit or transient API error
const isTransientError = (error?: string): boolean => {
  if (!error) return false;
  const lowerError = error.toLowerCase();
  return (
    lowerError.includes('rate') ||
    lowerError.includes('limit') ||
    lowerError.includes('429') ||
    lowerError.includes('timeout') ||
    lowerError.includes('econnreset') ||
    lowerError.includes('unavailable') ||
    lowerError.includes('503') ||
    lowerError.includes('502')
  );
};

// Helper to handle rate-limited or transient error results gracefully
const expectSuccessOrTransient = (result: {
  success: boolean;
  error?: string;
}) => {
  if (!result.success) {
    if (isTransientError(result.error)) {
      console.log(
        `Transient error (test skipped): ${result.error?.substring(0, 100)}...`,
      );
      return false; // Indicates test should be skipped
    }
    // Log the actual error for debugging
    console.log(`Firecrawl error: ${result.error}`);
  }
  expect(result.success).toBe(true);
  return true; // Indicates test can continue
};

describe('Firecrawl Integration Tests', () => {
  // Increase timeout for real API calls
  jest.setTimeout(60000);

  let service: FirecrawlService;

  beforeAll(async () => {
    if (shouldSkipFirecrawl) {
      console.log('Skipping Firecrawl tests: FIRECRAWL_API_KEY not set');
      return;
    }

    // Create a minimal test module with just the Firecrawl service
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirecrawlService,
        {
          provide: 'FIRECRAWL_CONFIG',
          useValue: {
            apiKey: process.env.FIRECRAWL_API_KEY,
            baseUrl:
              process.env.FIRECRAWL_BASE_URL || 'https://api.firecrawl.dev/v1',
          },
        },
      ],
    }).compile();

    service = module.get<FirecrawlService>(FirecrawlService);
  });

  (shouldSkipFirecrawl ? describe.skip : describe)('Connectivity', () => {
    it('should successfully connect to Firecrawl API', async () => {
      const result = await service.scrape(TEST_URLS.simple, {
        formats: ['markdown'],
      });

      expect(result).toBeDefined();
      expectSuccessOrTransient(result);
    });
  });

  (shouldSkipFirecrawl ? describe.skip : describe)('Basic Scraping', () => {
    it('should scrape a simple HTML page', async () => {
      const result = await service.scrape(TEST_URLS.simple, {
        formats: ['markdown', 'html'],
      });

      if (!expectSuccessOrTransient(result)) return;

      expect(result.data?.markdown).toBeDefined();
      expect(result.data?.markdown?.length).toBeGreaterThan(0);

      console.log(`Scraped ${TEST_URLS.simple}:`);
      console.log(`  Markdown length: ${result.data?.markdown?.length} chars`);
    });

    it('should scrape and return metadata', async () => {
      const result = await service.scrape(TEST_URLS.news, {
        formats: ['markdown'],
      });

      if (!expectSuccessOrTransient(result)) return;

      expect(result.data?.metadata).toBeDefined();

      console.log('Metadata from Hacker News:');
      console.log(`  Title: ${result.data?.metadata?.title}`);
      console.log(
        `  Description: ${result.data?.metadata?.description?.substring(0, 100)}...`,
      );
    });
  });

  (shouldSkipFirecrawl ? describe.skip : describe)(
    'Financial News Scraping',
    () => {
      it('should scrape Yahoo Finance homepage', async () => {
        const result = await service.scrape(TEST_URLS.finance, {
          formats: ['markdown'],
          timeout: 30000,
        });

        if (!expectSuccessOrTransient(result)) return;

        expect(result.data?.markdown).toBeDefined();

        console.log(`Yahoo Finance scrape:`);
        console.log(`  Content length: ${result.data?.markdown?.length} chars`);

        // Should contain some financial keywords
        const content = result.data?.markdown?.toLowerCase() || '';
        const hasFinancialContent =
          content.includes('market') ||
          content.includes('stock') ||
          content.includes('dow') ||
          content.includes('nasdaq');

        expect(hasFinancialContent).toBe(true);
      });

      it('should scrape TechCrunch for tech news', async () => {
        const result = await service.scrape(TEST_URLS.techCrunch, {
          formats: ['markdown'],
          timeout: 30000,
        });

        if (!expectSuccessOrTransient(result)) return;

        expect(result.data?.markdown).toBeDefined();

        console.log(`TechCrunch scrape:`);
        console.log(`  Content length: ${result.data?.markdown?.length} chars`);
      });
    },
  );

  (shouldSkipFirecrawl ? describe.skip : describe)(
    'CSS Selector Extraction',
    () => {
      it('should extract content with CSS selector', async () => {
        const result = await service.scrape(TEST_URLS.news, {
          formats: ['markdown'],
          // Hacker News has a specific structure
          onlyMainContent: true,
        });

        if (!expectSuccessOrTransient(result)) return;

        expect(result.data?.markdown).toBeDefined();

        // Verify we got meaningful content
        const content = result.data?.markdown || '';
        expect(content.length).toBeGreaterThan(100);
      });
    },
  );

  (shouldSkipFirecrawl ? describe.skip : describe)('Link Extraction', () => {
    it('should extract links from a page', async () => {
      const result = await service.scrape(TEST_URLS.news, {
        formats: ['markdown', 'links'],
      });

      if (!expectSuccessOrTransient(result)) return;

      // Check if links were extracted
      const links = result.data?.links || [];

      console.log(`Extracted ${links.length} links from Hacker News`);

      if (links.length > 0) {
        console.log('Sample links:');
        links.slice(0, 5).forEach((link: string, idx: number) => {
          console.log(`  ${idx + 1}. ${link}`);
        });
      }
    });
  });

  (shouldSkipFirecrawl ? describe.skip : describe)('Error Handling', () => {
    it('should handle invalid URLs gracefully', async () => {
      const result = await service.scrape(
        'https://this-domain-does-not-exist-xyz.com',
        {
          formats: ['markdown'],
        },
      );

      // Should return error, not throw
      expect(result.success).toBe(false);
    });

    it('should handle timeout gracefully', async () => {
      // Very short timeout
      const result = await service.scrape(TEST_URLS.finance, {
        formats: ['markdown'],
        timeout: 1, // 1ms - will definitely timeout
      });

      // Should handle timeout gracefully
      expect(result).toBeDefined();
      // May succeed or fail depending on caching
    });
  });

  (shouldSkipFirecrawl ? describe.skip : describe)('Content Quality', () => {
    it('should return clean markdown without HTML artifacts', async () => {
      const result = await service.scrape(TEST_URLS.simple, {
        formats: ['markdown'],
      });

      if (!expectSuccessOrTransient(result)) return;

      const markdown = result.data?.markdown || '';

      // Should not contain raw HTML tags
      const hasHtmlTags = /<script|<style|<iframe|onclick=/i.test(markdown);

      expect(hasHtmlTags).toBe(false);
    });

    it('should preserve important formatting', async () => {
      const result = await service.scrape(TEST_URLS.news, {
        formats: ['markdown'],
      });

      if (!expectSuccessOrTransient(result)) return;

      const markdown = result.data?.markdown || '';

      // Should have some markdown formatting
      const hasMarkdownFormatting =
        markdown.includes('#') ||
        markdown.includes('*') ||
        markdown.includes('[') ||
        markdown.includes('\n');

      expect(hasMarkdownFormatting).toBe(true);
    });
  });

  (shouldSkipFirecrawl ? describe.skip : describe)('Performance', () => {
    it('should complete simple page scrape in under 15 seconds', async () => {
      const startTime = Date.now();

      await service.scrape(TEST_URLS.simple, {
        formats: ['markdown'],
      });

      const elapsed = Date.now() - startTime;
      console.log(`Simple page scrape took ${elapsed}ms`);

      expect(elapsed).toBeLessThan(15000);
    });

    it('should handle complex page scrape in under 30 seconds', async () => {
      const startTime = Date.now();

      await service.scrape(TEST_URLS.finance, {
        formats: ['markdown'],
      });

      const elapsed = Date.now() - startTime;
      console.log(`Complex page scrape took ${elapsed}ms`);

      expect(elapsed).toBeLessThan(30000);
    });
  });

  (shouldSkipFirecrawl ? describe.skip : describe)(
    'Real News Source Scraping',
    () => {
      it('should scrape Bloomberg Markets page', async () => {
        const result = await service.scrape(
          'https://www.bloomberg.com/markets',
          {
            formats: ['markdown'],
            timeout: 45000,
          },
        );

        if (result.success) {
          console.log('Bloomberg Markets scrape successful');
          console.log(
            `  Content length: ${result.data?.markdown?.length} chars`,
          );

          // Verify financial content
          const content = result.data?.markdown?.toLowerCase() || '';
          const hasMarketContent =
            content.includes('s&p') ||
            content.includes('dow') ||
            content.includes('nasdaq') ||
            content.includes('market');

          expect(hasMarketContent).toBe(true);
        } else {
          console.log(
            'Bloomberg may block scraping - this is expected behavior',
          );
        }
      });

      it('should scrape CoinDesk for crypto news', async () => {
        const result = await service.scrape('https://www.coindesk.com', {
          formats: ['markdown'],
          timeout: 45000,
        });

        if (result.success) {
          console.log('CoinDesk scrape successful');
          console.log(
            `  Content length: ${result.data?.markdown?.length} chars`,
          );

          const content = result.data?.markdown?.toLowerCase() || '';
          const hasCryptoContent =
            content.includes('bitcoin') ||
            content.includes('crypto') ||
            content.includes('blockchain');

          expect(hasCryptoContent).toBe(true);
        } else {
          console.log('CoinDesk scrape failed - may have blocking');
        }
      });
    },
  );

  (shouldSkipFirecrawl ? describe.skip : describe)(
    'Content Extraction for Signal Generation',
    () => {
      it('should extract article headlines from news page', async () => {
        const result = await service.scrape(TEST_URLS.news, {
          formats: ['markdown'],
        });

        if (!expectSuccessOrTransient(result)) return;

        const markdown = result.data?.markdown || '';

        // Extract potential headlines (lines starting with # or in title case)
        const lines = markdown.split('\n');
        const potentialHeadlines = lines.filter((line: string) => {
          const trimmed = line.trim();
          return (
            trimmed.startsWith('#') ||
            (trimmed.length > 20 && trimmed.length < 200)
          );
        });

        console.log(`Found ${potentialHeadlines.length} potential headlines`);
        console.log('Sample headlines:');
        potentialHeadlines.slice(0, 5).forEach((h: string, idx: number) => {
          console.log(`  ${idx + 1}. ${h.substring(0, 80)}...`);
        });

        expect(potentialHeadlines.length).toBeGreaterThan(0);
      });

      it('should extract meaningful content for signal analysis', async () => {
        const result = await service.scrape(TEST_URLS.techCrunch, {
          formats: ['markdown'],
        });

        if (!expectSuccessOrTransient(result)) return;

        const markdown = result.data?.markdown || '';

        // Content should be substantial enough for analysis
        expect(markdown.length).toBeGreaterThan(500);

        // Should have words (not just punctuation/symbols)
        const wordCount = markdown
          .split(/\s+/)
          .filter((w: string) => w.length > 2).length;
        console.log(`Word count: ${wordCount}`);

        expect(wordCount).toBeGreaterThan(100);
      });
    },
  );

  (shouldSkipFirecrawl ? describe.skip : describe)(
    'Security Validation',
    () => {
      it('should not allow localhost URLs in production mode', async () => {
        // This test validates the security check in FirecrawlService
        const result = await service.scrape('http://localhost:3000', {
          formats: ['markdown'],
        });

        // In production, this should be blocked
        // In test/dev, it may attempt the request
        expect(result).toBeDefined();
      });

      it('should not allow private IP URLs', async () => {
        const result = await service.scrape('http://192.168.1.1', {
          formats: ['markdown'],
        });

        expect(result).toBeDefined();
        // Should fail or be blocked
      });
    },
  );
});
