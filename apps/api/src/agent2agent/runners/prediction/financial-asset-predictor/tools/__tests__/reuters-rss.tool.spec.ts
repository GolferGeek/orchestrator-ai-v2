/**
 * Reuters RSS Tool Tests
 *
 * Tests the ReutersRssTool for fetching multiple RSS news feeds.
 * Uses mocked fetch to avoid actual API calls in unit tests.
 */

import { ReutersRssTool, ReutersRssToolConfig } from '../reuters-rss.tool';
import type { Claim } from '../../../base/base-prediction.types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('ReutersRssTool', () => {
  let tool: ReutersRssTool;

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new ReutersRssTool();
  });

  describe('constructor', () => {
    it('should create tool with default config', () => {
      expect(tool.name).toBe('reuters-rss');
      expect(tool.description).toBe(
        'Fetches financial news from Reuters RSS feeds',
      );
    });

    it('should accept custom config', () => {
      const config: ReutersRssToolConfig = {
        feedUrls: [
          'https://custom-feed-1.example.com/rss',
          'https://custom-feed-2.example.com/rss',
        ],
        maxArticlesPerFeed: 25,
        timeoutMs: 5000,
      };
      const customTool = new ReutersRssTool(config);
      expect(customTool.name).toBe('reuters-rss');
    });
  });

  describe('execute', () => {
    const mockRssXml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <title>Reuters Markets</title>
          <item>
            <title>Google Announces AI Breakthrough</title>
            <description>GOOGL reveals new language model capabilities that surpass competitors.</description>
            <link>https://reuters.com/news/article-1</link>
            <pubDate>Mon, 06 Jan 2026 14:30:00 GMT</pubDate>
            <guid>article-1</guid>
          </item>
          <item>
            <title>NVDA Chip Demand Exceeds Supply</title>
            <description>Nvidia faces continued strong demand for AI accelerators.</description>
            <link>https://reuters.com/news/article-2</link>
            <pubDate>Mon, 06 Jan 2026 12:00:00 GMT</pubDate>
            <guid>article-2</guid>
          </item>
          <item>
            <title>Energy Markets Update</title>
            <description>Oil prices steady amid OPEC production decisions.</description>
            <link>https://reuters.com/news/article-3</link>
            <pubDate>Mon, 06 Jan 2026 10:00:00 GMT</pubDate>
            <guid>article-3</guid>
          </item>
        </channel>
      </rss>`;

    it('should fetch RSS feeds and parse articles successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockRssXml),
      });

      const sources = await tool.execute(['GOOGL', 'NVDA']);

      expect(mockFetch).toHaveBeenCalled();
      expect(sources.length).toBe(2); // 2 articles match GOOGL and NVDA
    });

    it('should extract news claims with correct instrument', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockRssXml),
      });

      const sources = await tool.execute(['GOOGL']);
      const source = sources[0];

      expect(source?.tool).toBe('reuters-rss');
      expect(source?.claims.length).toBe(1);

      const claim = source?.claims[0] as Claim;
      expect(claim.type).toBe('news');
      expect(claim.instrument).toBe('GOOGL');
      expect(claim.value).toContain('Google Announces AI Breakthrough');
      expect(claim.confidence).toBe(0.9);
    });

    it('should include Reuters source attribution in metadata', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockRssXml),
      });

      const sources = await tool.execute(['GOOGL']);
      const claim = sources[0]?.claims[0] as Claim;

      expect(claim.metadata?.source).toBe('Reuters');
      expect(sources[0]?.metadata?.source).toBe('Reuters');
    });

    it('should fetch multiple feeds in parallel', async () => {
      const toolWithMultipleFeeds = new ReutersRssTool({
        feedUrls: [
          'https://reuters.com/feed1.rss',
          'https://reuters.com/feed2.rss',
        ],
      });

      const feed1Xml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>AAPL News from Feed 1</title>
              <description>Article from first feed</description>
              <link>https://reuters.com/feed1/article</link>
              <pubDate>Mon, 06 Jan 2026 14:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`;

      const feed2Xml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>AAPL News from Feed 2</title>
              <description>Article from second feed</description>
              <link>https://reuters.com/feed2/article</link>
              <pubDate>Mon, 06 Jan 2026 15:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`;

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(feed1Xml),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(feed2Xml),
        });

      const sources = await toolWithMultipleFeeds.execute(['AAPL']);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(sources.length).toBe(2); // One article from each feed
    });

    it('should continue if one feed fails', async () => {
      const toolWithMultipleFeeds = new ReutersRssTool({
        feedUrls: [
          'https://reuters.com/working.rss',
          'https://reuters.com/broken.rss',
        ],
      });

      const workingFeedXml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>AAPL Working Feed Article</title>
              <link>https://reuters.com/working/article</link>
              <pubDate>Mon, 06 Jan 2026 14:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`;

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(workingFeedXml),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        });

      const sources = await toolWithMultipleFeeds.execute(['AAPL']);

      expect(sources.length).toBe(1);
      expect(sources[0]?.articleTitle).toBe('AAPL Working Feed Article');
    });

    it('should return empty sources when no articles match instruments', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockRssXml),
      });

      const sources = await tool.execute(['TSLA', 'AMD']); // Not in mock data

      expect(sources.length).toBe(0);
    });

    it('should handle multiple instruments in single article', async () => {
      const multiMatchXml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>Tech Rally: GOOGL MSFT AAPL All Gain</title>
              <description>Major tech stocks advanced across the board today.</description>
              <link>https://reuters.com/tech-rally</link>
              <pubDate>Mon, 06 Jan 2026 14:30:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(multiMatchXml),
      });

      const sources = await tool.execute(['GOOGL', 'MSFT', 'AAPL']);

      expect(sources.length).toBe(1);
      expect(sources[0]?.claims.length).toBe(3);

      const instruments = sources[0]?.claims.map((c) => c.instrument);
      expect(instruments).toContain('GOOGL');
      expect(instruments).toContain('MSFT');
      expect(instruments).toContain('AAPL');
    });

    it('should return error source on complete failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('All feeds failed'));

      const sources = await tool.execute(['AAPL']);

      // Tool gracefully returns empty array when all feeds fail
      expect(sources.length).toBe(0);
    });

    it('should handle timeout on individual feeds', async () => {
      const toolWithMultipleFeeds = new ReutersRssTool({
        feedUrls: [
          'https://reuters.com/fast.rss',
          'https://reuters.com/slow.rss',
        ],
      });

      const fastFeedXml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>AAPL Fast Feed</title>
              <link>https://reuters.com/fast/article</link>
              <pubDate>Mon, 06 Jan 2026 14:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`;

      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(fastFeedXml),
        })
        .mockRejectedValueOnce(abortError);

      const sources = await toolWithMultipleFeeds.execute(['AAPL']);

      // Should still return result from working feed
      expect(sources.length).toBe(1);
    });

    it('should decode HTML entities in content', async () => {
      const htmlEntitiesXml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>AAPL &amp; MSFT: Market Leaders &quot;Outperform&quot;</title>
              <description>Apple&#39;s results &lt;exceeded&gt; expectations.</description>
              <link>https://reuters.com/entities-article</link>
              <pubDate>Mon, 06 Jan 2026 14:30:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(htmlEntitiesXml),
      });

      const sources = await tool.execute(['AAPL']);

      expect(sources[0]?.articleTitle).toBe(
        'AAPL & MSFT: Market Leaders "Outperform"',
      );
    });

    it('should handle CDATA wrapped content', async () => {
      const cdataXml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title><![CDATA[NVDA Surges on Datacenter Demand]]></title>
              <description><![CDATA[Nvidia reports record datacenter revenue.]]></description>
              <link>https://reuters.com/cdata-article</link>
              <pubDate>Mon, 06 Jan 2026 14:30:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(cdataXml),
      });

      const sources = await tool.execute(['NVDA']);

      expect(sources[0]?.articleTitle).toBe('NVDA Surges on Datacenter Demand');
    });

    it('should limit articles processed per feed', async () => {
      const limitedTool = new ReutersRssTool({
        feedUrls: ['https://reuters.com/feed.rss'],
        maxArticlesPerFeed: 5,
      });

      const manyArticlesXml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            ${Array(50)
              .fill(null)
              .map(
                (_, i) => `
              <item>
                <title>AAPL Article ${i}</title>
                <description>Article number ${i}</description>
                <link>https://reuters.com/article-${i}</link>
                <pubDate>Mon, 06 Jan 2026 14:30:00 GMT</pubDate>
              </item>
            `,
              )
              .join('')}
          </channel>
        </rss>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(manyArticlesXml),
      });

      const sources = await limitedTool.execute(['AAPL']);

      expect(sources.length).toBeLessThanOrEqual(5);
    });

    it('should skip items without title or link', async () => {
      const incompleteXml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>GOOGL Complete Article</title>
              <link>https://reuters.com/complete</link>
              <pubDate>Mon, 06 Jan 2026 14:30:00 GMT</pubDate>
            </item>
            <item>
              <description>No title GOOGL</description>
              <link>https://reuters.com/no-title</link>
            </item>
            <item>
              <title>GOOGL No Link</title>
              <description>Article without link</description>
            </item>
          </channel>
        </rss>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(incompleteXml),
      });

      const sources = await tool.execute(['GOOGL']);

      expect(sources.length).toBe(1);
      expect(sources[0]?.articleTitle).toBe('GOOGL Complete Article');
    });

    it('should use current timestamp when pubDate missing', async () => {
      const noPubDateXml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>NVDA Breaking News</title>
              <link>https://reuters.com/breaking</link>
            </item>
          </channel>
        </rss>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(noPubDateXml),
      });

      const beforeExecution = new Date();
      const sources = await tool.execute(['NVDA']);
      const afterExecution = new Date();

      const publishedAt = new Date(sources[0]?.publishedAt || '');
      expect(publishedAt.getTime()).toBeGreaterThanOrEqual(
        beforeExecution.getTime(),
      );
      expect(publishedAt.getTime()).toBeLessThanOrEqual(
        afterExecution.getTime(),
      );
    });

    it('should match instruments case-insensitively', async () => {
      const mixedCaseXml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>aapl Stock Hits New Highs</title>
              <description>Apple shares reach all-time high.</description>
              <link>https://reuters.com/aapl-highs</link>
              <pubDate>Mon, 06 Jan 2026 14:30:00 GMT</pubDate>
            </item>
            <item>
              <title>Msft Cloud Revenue Grows</title>
              <description>Microsoft Azure continues growth.</description>
              <link>https://reuters.com/msft-cloud</link>
              <pubDate>Mon, 06 Jan 2026 12:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mixedCaseXml),
      });

      const sources = await tool.execute(['AAPL', 'MSFT']);

      expect(sources.length).toBe(2);
      // Instruments should be uppercase in claims
      expect(sources[0]?.claims[0]?.instrument).toBe('AAPL');
      expect(sources[1]?.claims[0]?.instrument).toBe('MSFT');
    });
  });
});
