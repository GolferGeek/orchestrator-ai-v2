/**
 * Bloomberg News Tool Tests
 *
 * Tests the BloombergNewsTool for fetching RSS news feeds.
 * Uses mocked fetch to avoid actual API calls in unit tests.
 */

import {
  BloombergNewsTool,
  BloombergNewsToolConfig,
} from '../bloomberg-news.tool';
import type { Claim } from '../../../base/base-prediction.types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('BloombergNewsTool', () => {
  let tool: BloombergNewsTool;

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new BloombergNewsTool();
  });

  describe('constructor', () => {
    it('should create tool with default config', () => {
      expect(tool.name).toBe('bloomberg-news');
      expect(tool.description).toBe(
        'Fetches financial news from Bloomberg RSS feeds',
      );
    });

    it('should accept custom config', () => {
      const config: BloombergNewsToolConfig = {
        feedUrl: 'https://custom-feed.example.com/rss',
        maxArticles: 25,
        timeoutMs: 5000,
      };
      const customTool = new BloombergNewsTool(config);
      expect(customTool.name).toBe('bloomberg-news');
    });
  });

  describe('execute', () => {
    const mockRssXml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <title>Bloomberg Markets</title>
          <item>
            <title>Apple Reports Strong iPhone Sales for Q4</title>
            <description>AAPL stock rises after quarterly earnings beat expectations. The company reported strong demand for its latest iPhone models.</description>
            <link>https://bloomberg.com/news/article-1</link>
            <pubDate>Mon, 06 Jan 2026 14:30:00 GMT</pubDate>
            <guid>article-1</guid>
          </item>
          <item>
            <title>Microsoft Cloud Business Continues Growth</title>
            <description>MSFT Azure revenue increased 25% year-over-year as enterprise customers migrate to cloud.</description>
            <link>https://bloomberg.com/news/article-2</link>
            <pubDate>Mon, 06 Jan 2026 12:00:00 GMT</pubDate>
            <guid>article-2</guid>
          </item>
          <item>
            <title>General Market Update</title>
            <description>Markets were mixed today with tech stocks leading gains.</description>
            <link>https://bloomberg.com/news/article-3</link>
            <pubDate>Mon, 06 Jan 2026 10:00:00 GMT</pubDate>
            <guid>article-3</guid>
          </item>
        </channel>
      </rss>`;

    it('should fetch RSS feed and parse articles successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockRssXml),
      });

      const sources = await tool.execute(['AAPL', 'MSFT']);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(sources.length).toBe(2); // 2 articles match AAPL and MSFT
    });

    it('should extract news claims with correct instrument', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockRssXml),
      });

      const sources = await tool.execute(['AAPL']);
      const source = sources[0];

      expect(source?.tool).toBe('bloomberg-news');
      expect(source?.claims.length).toBe(1);

      const claim = source?.claims[0] as Claim;
      expect(claim.type).toBe('news');
      expect(claim.instrument).toBe('AAPL');
      expect(claim.value).toContain('Apple Reports Strong iPhone Sales');
      expect(claim.confidence).toBe(0.9);
    });

    it('should include article metadata in claims', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockRssXml),
      });

      const sources = await tool.execute(['AAPL']);
      const claim = sources[0]?.claims[0] as Claim;

      expect(claim.metadata?.headline).toBe(
        'Apple Reports Strong iPhone Sales for Q4',
      );
      expect(claim.metadata?.url).toBe('https://bloomberg.com/news/article-1');
      expect(claim.metadata?.source).toBe('Bloomberg');
    });

    it('should include source metadata with matched instruments', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockRssXml),
      });

      const sources = await tool.execute(['AAPL']);

      expect(sources[0]?.metadata?.source).toBe('Bloomberg');
      expect(sources[0]?.metadata?.matchedInstruments).toContain('AAPL');
      expect(sources[0]?.articleUrl).toBe(
        'https://bloomberg.com/news/article-1',
      );
      expect(sources[0]?.articleTitle).toBe(
        'Apple Reports Strong iPhone Sales for Q4',
      );
    });

    it('should handle multiple instruments mentioned in single article', async () => {
      const multiMatchXml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>Tech Giants AAPL and MSFT Lead Market Rally</title>
              <description>Apple and Microsoft shares both rose over 2% today.</description>
              <link>https://bloomberg.com/multi-article</link>
              <pubDate>Mon, 06 Jan 2026 14:30:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(multiMatchXml),
      });

      const sources = await tool.execute(['AAPL', 'MSFT', 'GOOGL']);

      expect(sources.length).toBe(1); // One article
      expect(sources[0]?.claims.length).toBe(2); // Two claims (AAPL and MSFT)

      const instruments = sources[0]?.claims.map((c) => c.instrument);
      expect(instruments).toContain('AAPL');
      expect(instruments).toContain('MSFT');
    });

    it('should return empty sources when no articles match instruments', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockRssXml),
      });

      const sources = await tool.execute(['NVDA', 'AMD']); // Not in mock data

      expect(sources.length).toBe(0);
    });

    it('should return error source on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      const sources = await tool.execute(['AAPL']);

      expect(sources.length).toBe(1);
      expect(sources[0]?.metadata?.error).toBe(true);
      expect(sources[0]?.metadata?.errorMessage).toContain('503');
    });

    it('should return error source on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const sources = await tool.execute(['AAPL']);

      expect(sources.length).toBe(1);
      expect(sources[0]?.metadata?.error).toBe(true);
      expect(sources[0]?.metadata?.errorMessage).toContain('Network failure');
    });

    it('should handle timeout', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const sources = await tool.execute(['AAPL']);

      expect(sources.length).toBe(1);
      expect(sources[0]?.metadata?.error).toBe(true);
      expect(sources[0]?.metadata?.errorMessage).toContain('timed out');
    });

    it('should decode HTML entities in content', async () => {
      const htmlEntitiesXml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>AAPL &amp; MSFT: Tech Giants &quot;Outperform&quot;</title>
              <description>Apple&#39;s &lt;strong&gt;results&lt;/strong&gt; exceeded expectations.</description>
              <link>https://bloomberg.com/article</link>
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
        'AAPL & MSFT: Tech Giants "Outperform"',
      );
      expect(sources[0]?.claims[0]?.metadata?.summary).toContain("Apple's");
    });

    it('should handle CDATA wrapped content', async () => {
      const cdataXml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title><![CDATA[AAPL Stock Surges on Earnings Beat]]></title>
              <description><![CDATA[Apple Inc. reported earnings above expectations.]]></description>
              <link>https://bloomberg.com/cdata-article</link>
              <pubDate>Mon, 06 Jan 2026 14:30:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(cdataXml),
      });

      const sources = await tool.execute(['AAPL']);

      expect(sources[0]?.articleTitle).toBe(
        'AAPL Stock Surges on Earnings Beat',
      );
    });

    it('should limit articles processed to maxArticles config', async () => {
      // Create XML with many articles
      const manyArticlesXml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            ${Array(100)
              .fill(null)
              .map(
                (_, i) => `
              <item>
                <title>AAPL Article ${i}</title>
                <description>Article about AAPL number ${i}</description>
                <link>https://bloomberg.com/article-${i}</link>
                <pubDate>Mon, 06 Jan 2026 14:30:00 GMT</pubDate>
              </item>
            `,
              )
              .join('')}
          </channel>
        </rss>`;

      // Tool with maxArticles = 10
      const limitedTool = new BloombergNewsTool({ maxArticles: 10 });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(manyArticlesXml),
      });

      const sources = await limitedTool.execute(['AAPL']);

      // Should only process first 10 articles
      expect(sources.length).toBeLessThanOrEqual(10);
    });

    it('should skip items without title or link', async () => {
      const incompleteXml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>AAPL Complete Article</title>
              <link>https://bloomberg.com/complete</link>
              <pubDate>Mon, 06 Jan 2026 14:30:00 GMT</pubDate>
            </item>
            <item>
              <description>No title AAPL article</description>
              <link>https://bloomberg.com/no-title</link>
            </item>
            <item>
              <title>AAPL No Link Article</title>
              <description>No link</description>
            </item>
          </channel>
        </rss>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(incompleteXml),
      });

      const sources = await tool.execute(['AAPL']);

      // Should only include the complete article
      expect(sources.length).toBe(1);
      expect(sources[0]?.articleTitle).toBe('AAPL Complete Article');
    });

    it('should use current timestamp when pubDate missing', async () => {
      const noPubDateXml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>AAPL Breaking News</title>
              <link>https://bloomberg.com/breaking</link>
            </item>
          </channel>
        </rss>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(noPubDateXml),
      });

      const beforeExecution = new Date();
      const sources = await tool.execute(['AAPL']);
      const afterExecution = new Date();

      const publishedAt = new Date(sources[0]?.publishedAt || '');
      expect(publishedAt.getTime()).toBeGreaterThanOrEqual(
        beforeExecution.getTime(),
      );
      expect(publishedAt.getTime()).toBeLessThanOrEqual(
        afterExecution.getTime(),
      );
    });
  });
});
