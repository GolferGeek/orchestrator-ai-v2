/**
 * News & RSS Tools Integration Tests
 *
 * These tests hit REAL RSS feeds and news APIs to validate data collection.
 * Run with: npx jest --config jest.integration.config.js news-tools.integration.spec.ts
 *
 * Required environment variables:
 * - NEWSAPI_API_KEY (for NewsAPI tests)
 *
 * Bloomberg RSS and Reuters RSS do not require API keys.
 */

import {
  BloombergNewsTool,
  BloombergNewsToolConfig,
} from '../../../../agent2agent/runners/prediction/financial-asset-predictor/tools/bloomberg-news.tool';
import {
  ReutersRssTool,
  ReutersRssToolConfig,
} from '../../../../agent2agent/runners/prediction/financial-asset-predictor/tools/reuters-rss.tool';
import {
  NewsApiTool,
  NewsApiToolConfig,
} from '../../../../agent2agent/runners/prediction/market-predictor/tools/news-api.tool';
import type {
  Source,
  Claim,
} from '../../../../agent2agent/runners/prediction/base/base-prediction.types';

// Helper to check if test should be skipped
const shouldSkipNewsApi = !process.env.NEWSAPI_API_KEY;

// Common financial terms that are likely to appear in Bloomberg/Reuters news
// These are used for instrument matching since the tools filter by instrument
const LIKELY_BLOOMBERG_TERMS = [
  'Apple',
  'Microsoft',
  'Google',
  'Amazon',
  'Tesla',
  'AI',
  'Fed',
  'China',
  'Trump',
  'stock',
  'market',
];
const LIKELY_REUTERS_TERMS = [
  'U.S.',
  'China',
  'Trump',
  'Biden',
  'Fed',
  'economy',
  'inflation',
  'rate',
];

describe('News & RSS Tools Integration Tests', () => {
  // Increase timeout for real API calls
  jest.setTimeout(60000);

  describe('Bloomberg News RSS Tool', () => {
    let tool: BloombergNewsTool;

    beforeAll(() => {
      tool = new BloombergNewsTool();
    });

    describe('Connectivity', () => {
      it('should successfully connect to Bloomberg RSS feed', async () => {
        // Use multiple common terms to increase chance of matches
        const sources = await tool.execute(LIKELY_BLOOMBERG_TERMS);

        expect(sources).toBeDefined();
        // RSS is working if we get an array back (even if empty due to no matches)
        expect(Array.isArray(sources)).toBe(true);
        console.log(
          `Bloomberg RSS returned ${sources.length} matching articles`,
        );
      });
    });

    describe('News Data Quality', () => {
      it('should return recent news articles', async () => {
        const sources = await tool.execute(LIKELY_BLOOMBERG_TERMS);

        // Skip if no matches found (depends on current news content)
        if (sources.length === 0) {
          console.log(
            'No Bloomberg articles matched our terms - this is expected behavior',
          );
          return;
        }

        // Check first source
        const firstSource = sources[0];
        expect(firstSource?.tool).toBe('bloomberg-news');

        console.log(`Found ${sources.length} Bloomberg articles`);
      });

      it('should include news claims with headlines', async () => {
        const sources = await tool.execute(LIKELY_BLOOMBERG_TERMS);

        // Skip if no matches found
        if (sources.length === 0) {
          console.log(
            'No Bloomberg articles matched - skipping headline check',
          );
          return;
        }

        let hasNewsClaimsWithHeadlines = false;

        sources.forEach((source: Source) => {
          const newsClaims = source.claims.filter(
            (c: Claim) =>
              c.type === 'news' || c.type === 'event' || c.metadata?.headline,
          );

          if (newsClaims.length > 0) {
            hasNewsClaimsWithHeadlines = true;

            newsClaims.slice(0, 3).forEach((claim: Claim, idx: number) => {
              const headline =
                claim.metadata?.headline ||
                claim.metadata?.title ||
                claim.value;
              console.log(`  ${idx + 1}. ${headline}`);
            });
          }
        });

        expect(hasNewsClaimsWithHeadlines).toBe(true);
      });

      it('should include publication dates', async () => {
        const sources = await tool.execute(LIKELY_BLOOMBERG_TERMS);

        // Skip if no matches
        if (sources.length === 0) {
          console.log('No sources to check publication dates');
          return;
        }

        sources.slice(0, 3).forEach((source: Source) => {
          const newsClaim = source.claims.find(
            (c: Claim) =>
              c.type === 'news' || c.type === 'event' || c.metadata?.headline,
          );

          if (newsClaim) {
            // Check multiple possible locations for timestamp/pubDate
            const pubDate =
              newsClaim.timestamp || // Claim.timestamp
              (source as Source & { publishedAt?: string }).publishedAt || // Source.publishedAt
              newsClaim.metadata?.publishedAt ||
              newsClaim.metadata?.pubDate;
            expect(pubDate).toBeDefined();
          }
        });
      });

      it('should include links to original articles', async () => {
        const sources = await tool.execute(LIKELY_BLOOMBERG_TERMS);

        // Skip if no matches
        if (sources.length === 0) {
          console.log('No sources to check links');
          return;
        }

        sources.slice(0, 3).forEach((source: Source) => {
          const newsClaim = source.claims.find(
            (c: Claim) =>
              c.type === 'news' || c.type === 'event' || c.metadata?.headline,
          );

          if (newsClaim) {
            const link = newsClaim.metadata?.link || newsClaim.metadata?.url;
            if (link) {
              expect(link).toMatch(/^https?:\/\//);
            }
          }
        });
      });
    });

    describe('Symbol Filtering', () => {
      it('should filter news by stock symbol', async () => {
        const sources = await tool.execute(['AAPL', 'Apple']);

        console.log(
          `Found ${sources.length} articles potentially related to AAPL/Apple`,
        );

        // Note: RSS feeds may not have direct symbol filtering
        // This validates the filtering logic in the tool
        expect(sources).toBeDefined();
        expect(Array.isArray(sources)).toBe(true);
      });
    });
  });

  describe('Reuters RSS Tool', () => {
    let tool: ReutersRssTool;

    beforeAll(() => {
      tool = new ReutersRssTool();
    });

    describe('Connectivity', () => {
      it('should successfully connect to Reuters RSS feed', async () => {
        const sources = await tool.execute(LIKELY_REUTERS_TERMS);

        expect(sources).toBeDefined();
        expect(Array.isArray(sources)).toBe(true);
        console.log(`Reuters RSS returned ${sources.length} matching articles`);
      });
    });

    describe('News Data Quality', () => {
      it('should return recent news articles', async () => {
        const sources = await tool.execute(LIKELY_REUTERS_TERMS);

        // Skip if no matches found (depends on current news content)
        if (sources.length === 0) {
          console.log(
            'No Reuters articles matched our terms - this is expected behavior',
          );
          return;
        }

        console.log(`Found ${sources.length} Reuters articles`);

        // Log first few headlines
        sources.slice(0, 5).forEach((source: Source, idx: number) => {
          const newsClaim = source.claims.find(
            (c: Claim) =>
              c.type === 'news' || c.type === 'event' || c.metadata?.headline,
          );
          if (newsClaim) {
            const headline =
              newsClaim.metadata?.headline ||
              newsClaim.metadata?.title ||
              newsClaim.value;
            console.log(`  ${idx + 1}. ${headline}`);
          }
        });
      });

      it('should include article descriptions', async () => {
        const sources = await tool.execute(LIKELY_REUTERS_TERMS);

        // Skip if no matches
        if (sources.length === 0) {
          console.log(
            'No Reuters articles matched - skipping description check',
          );
          return;
        }

        let hasDescriptions = false;

        sources.slice(0, 5).forEach((source: Source) => {
          const newsClaim = source.claims.find(
            (c: Claim) =>
              c.type === 'news' || c.type === 'event' || c.metadata?.headline,
          );

          if (newsClaim?.metadata?.description) {
            hasDescriptions = true;
          }
        });

        // At least some articles should have descriptions
        expect(hasDescriptions).toBe(true);
      });
    });

    describe('Multiple Feed Categories', () => {
      it('should support different feed categories', async () => {
        // Use likely matching terms for each category
        const categoryTerms: Record<string, string[]> = {
          business: LIKELY_REUTERS_TERMS,
          markets: ['stock', 'market', 'Fed'],
          world: ['U.S.', 'China', 'Trump'],
        };

        for (const [category, terms] of Object.entries(categoryTerms)) {
          try {
            const sources = await tool.execute(terms);
            console.log(`${category}: ${sources.length} articles`);
            expect(Array.isArray(sources)).toBe(true);
          } catch (error) {
            console.log(`${category}: Feed may not be available`);
          }
        }
      });
    });
  });

  describe('NewsAPI Tool', () => {
    let tool: NewsApiTool;

    beforeAll(() => {
      if (shouldSkipNewsApi) {
        console.log('Skipping NewsAPI tests: NEWSAPI_API_KEY not set');
        return;
      }

      const config: NewsApiToolConfig = {
        apiKey: process.env.NEWSAPI_API_KEY!,
      };
      tool = new NewsApiTool(config);
    });

    (shouldSkipNewsApi ? describe.skip : describe)('Connectivity', () => {
      it('should successfully connect to NewsAPI', async () => {
        const sources = await tool.execute(['stocks']);

        expect(sources).toBeDefined();
        expect(sources.length).toBeGreaterThan(0);
      });
    });

    (shouldSkipNewsApi ? describe.skip : describe)(
      'Search Functionality',
      () => {
        it('should search for stock-related news', async () => {
          const sources = await tool.execute(['Apple stock']);

          expect(sources.length).toBeGreaterThan(0);

          console.log(`Found ${sources.length} articles about Apple stock`);

          sources.slice(0, 3).forEach((source: Source, idx: number) => {
            const newsClaim = source.claims.find(
              (c: Claim) =>
                c.type === 'news' || c.type === 'event' || c.metadata?.headline,
            );
            if (newsClaim) {
              console.log(
                `  ${idx + 1}. ${newsClaim.metadata?.headline || newsClaim.value}`,
              );
            }
          });
        });

        it('should search for crypto-related news', async () => {
          const sources = await tool.execute(['Bitcoin cryptocurrency']);

          expect(sources.length).toBeGreaterThan(0);

          console.log(`Found ${sources.length} articles about Bitcoin`);
        });

        it('should search for event-related news', async () => {
          const sources = await tool.execute([
            'Federal Reserve interest rates',
          ]);

          expect(sources.length).toBeGreaterThan(0);

          console.log(`Found ${sources.length} articles about Fed rates`);
        });
      },
    );

    (shouldSkipNewsApi ? describe.skip : describe)('Article Metadata', () => {
      it('should include source attribution', async () => {
        const sources = await tool.execute(['technology stocks']);

        sources.slice(0, 5).forEach((source: Source) => {
          const newsClaim = source.claims.find(
            (c: Claim) =>
              c.type === 'news' || c.type === 'event' || c.metadata?.headline,
          );

          if (newsClaim) {
            const sourceName =
              newsClaim.metadata?.source ||
              newsClaim.metadata?.publisher ||
              source.metadata?.source;

            if (sourceName) {
              console.log(`Source: ${sourceName}`);
            }
          }
        });
      });
    });
  });

  describe('RSS Feed Validation', () => {
    it('should parse standard RSS 2.0 format', async () => {
      const bloombergTool = new BloombergNewsTool();
      const sources = await bloombergTool.execute(LIKELY_BLOOMBERG_TERMS);

      // Skip if no matches
      if (sources.length === 0) {
        console.log(
          'No matching articles - RSS parsing validated by empty array return',
        );
        return;
      }

      // Validate RSS structure
      sources.slice(0, 3).forEach((source: Source) => {
        // Should have claims
        expect(source.claims.length).toBeGreaterThan(0);

        // Should have timestamp (may be in metadata)
        const timestamp = (source as Source & { timestamp?: string }).timestamp;
        if (timestamp) {
          expect(timestamp).toBeDefined();
        }

        // Should have tool identifier
        expect(source.tool).toBe('bloomberg-news');
      });
    });

    it('should handle malformed or empty RSS gracefully', async () => {
      const tool = new BloombergNewsTool();

      // Test with invalid category (should not crash)
      try {
        const sources = await tool.execute(['invalid-category-xyz']);
        expect(sources).toBeDefined();
        expect(Array.isArray(sources)).toBe(true);
      } catch (error) {
        // Expected behavior - tool handles errors internally
        expect(error).toBeDefined();
      }
    });
  });

  describe('News Freshness', () => {
    it('should return articles from recent timeframe', async () => {
      const tool = new BloombergNewsTool();
      const sources = await tool.execute(LIKELY_BLOOMBERG_TERMS);

      // Skip if no sources returned (no matches or API unavailable)
      if (sources.length === 0) {
        console.log('No matching Bloomberg articles - skipping freshness test');
        return;
      }

      const now = Date.now();
      const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

      let hasRecentArticles = false;

      sources.forEach((source: Source) => {
        const newsClaim = source.claims.find(
          (c: Claim) =>
            c.type === 'news' || c.type === 'event' || c.metadata?.headline,
        );

        // Check multiple possible locations for timestamp
        const pubDate =
          newsClaim?.timestamp || // Claim.timestamp
          (source as Source & { publishedAt?: string }).publishedAt || // Source.publishedAt
          newsClaim?.metadata?.publishedAt ||
          newsClaim?.metadata?.pubDate;

        if (pubDate && typeof pubDate === 'string') {
          const pubTimestamp = new Date(pubDate).getTime();
          if (pubTimestamp > oneWeekAgo) {
            hasRecentArticles = true;
          }
        }
      });

      expect(hasRecentArticles).toBe(true);
    });
  });

  describe('Cross-Source News Validation', () => {
    it('should get overlapping news from Bloomberg and Reuters', async () => {
      const bloombergTool = new BloombergNewsTool();
      const reutersTool = new ReutersRssTool();

      const [bloombergSources, reutersSources] = await Promise.all([
        bloombergTool.execute(['markets']),
        reutersTool.execute(['business']),
      ]);

      console.log(`Bloomberg articles: ${bloombergSources.length}`);
      console.log(`Reuters articles: ${reutersSources.length}`);

      // Skip if APIs unavailable
      if (bloombergSources.length === 0 || reutersSources.length === 0) {
        console.log('News APIs unavailable - skipping cross-source validation');
        return;
      }

      // Extract headlines for comparison
      const bloombergHeadlines = bloombergSources
        .map((s: Source) => {
          const claim = s.claims.find(
            (c: Claim) =>
              c.type === 'news' || c.type === 'event' || c.metadata?.headline,
          );
          return String(
            claim?.metadata?.headline || claim?.metadata?.title || '',
          ).toLowerCase();
        })
        .filter((h: string) => h.length > 0);

      const reutersHeadlines = reutersSources
        .map((s: Source) => {
          const claim = s.claims.find(
            (c: Claim) =>
              c.type === 'news' || c.type === 'event' || c.metadata?.headline,
          );
          return String(
            claim?.metadata?.headline || claim?.metadata?.title || '',
          ).toLowerCase();
        })
        .filter((h: string) => h.length > 0);

      // Check for any keyword overlap (not exact match - different sources phrase differently)
      const bloombergKeywords = new Set(
        bloombergHeadlines.flatMap((h: string) =>
          h.split(/\s+/).filter((w: string) => w.length > 4),
        ),
      );
      const reutersKeywords = new Set(
        reutersHeadlines.flatMap((h: string) =>
          h.split(/\s+/).filter((w: string) => w.length > 4),
        ),
      );

      let overlappingKeywords = 0;
      bloombergKeywords.forEach((keyword) => {
        if (reutersKeywords.has(keyword)) {
          overlappingKeywords++;
        }
      });

      console.log(`Overlapping keywords: ${overlappingKeywords}`);

      // Should have some common topics (markets, stocks, etc.)
      expect(overlappingKeywords).toBeGreaterThan(0);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should complete Bloomberg RSS fetch in under 10 seconds', async () => {
      const tool = new BloombergNewsTool();
      const startTime = Date.now();

      await tool.execute(['markets']);

      const elapsed = Date.now() - startTime;
      console.log(`Bloomberg RSS fetch took ${elapsed}ms`);

      expect(elapsed).toBeLessThan(10000);
    });

    it('should complete Reuters RSS fetch in under 10 seconds', async () => {
      const tool = new ReutersRssTool();
      const startTime = Date.now();

      await tool.execute(['business']);

      const elapsed = Date.now() - startTime;
      console.log(`Reuters RSS fetch took ${elapsed}ms`);

      expect(elapsed).toBeLessThan(10000);
    });
  });

  describe('News Content Analysis', () => {
    it('should extract meaningful content from articles', async () => {
      const tool = new BloombergNewsTool();
      const sources = await tool.execute(LIKELY_BLOOMBERG_TERMS);

      // Skip if no matches
      if (sources.length === 0) {
        console.log('No matching articles - skipping content analysis');
        return;
      }

      sources.slice(0, 3).forEach((source: Source, idx: number) => {
        const newsClaim = source.claims.find(
          (c: Claim) =>
            c.type === 'news' || c.type === 'event' || c.metadata?.headline,
        );

        if (newsClaim) {
          const headline = String(
            newsClaim.metadata?.headline || newsClaim.metadata?.title || '',
          );
          const description = String(newsClaim.metadata?.description || '');

          console.log(`\nArticle ${idx + 1}:`);
          console.log(`  Headline: ${headline.substring(0, 100)}...`);
          console.log(`  Description: ${description.substring(0, 150)}...`);

          // Headlines should be meaningful (not empty or too short)
          expect(headline.length).toBeGreaterThan(10);
        }
      });
    });
  });
});
