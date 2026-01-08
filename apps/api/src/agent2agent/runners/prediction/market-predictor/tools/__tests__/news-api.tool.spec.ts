/**
 * News API Tool Tests
 *
 * Tests the NewsApiTool for fetching news articles.
 * Uses mocked fetch to avoid actual API calls in unit tests.
 */

import { NewsApiTool, createNewsApiTool } from '../news-api.tool';
import type { Claim } from '../../../base/base-prediction.types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('NewsApiTool', () => {
  let tool: NewsApiTool;

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new NewsApiTool({ apiKey: 'test-api-key' });
  });

  describe('constructor', () => {
    it('should create tool with default config', () => {
      expect(tool.name).toBe('news-api');
      expect(tool.description).toBe(
        'Fetches event-related news from NewsAPI.org',
      );
    });

    it('should accept custom config', () => {
      const customTool = new NewsApiTool({
        apiKey: 'custom-key',
        timeoutMs: 5000,
        language: 'es',
        maxArticles: 5,
        extractSentiment: false,
      });
      expect(customTool.name).toBe('news-api');
    });

    it('should warn when no API key is provided', () => {
      const toolWithoutKey = new NewsApiTool();
      expect(toolWithoutKey.name).toBe('news-api');
      // Tool should still be created but won't fetch data
    });
  });

  describe('execute with API key', () => {
    const mockNewsResponse = {
      status: 'ok',
      totalResults: 2,
      articles: [
        {
          source: {
            id: 'reuters',
            name: 'Reuters',
          },
          author: 'John Doe',
          title: 'Bitcoin surges to new high',
          description: 'Bitcoin reached $100k for the first time',
          url: 'https://example.com/article1',
          urlToImage: 'https://example.com/image1.jpg',
          publishedAt: '2024-01-08T12:00:00Z',
          content: 'Full article content here',
        },
        {
          source: {
            id: 'bloomberg',
            name: 'Bloomberg',
          },
          author: 'Jane Smith',
          title: 'Crypto markets rally on positive news',
          description: 'Markets show strong bullish sentiment',
          url: 'https://example.com/article2',
          urlToImage: 'https://example.com/image2.jpg',
          publishedAt: '2024-01-08T11:00:00Z',
          content: 'Full article content here',
        },
      ],
    };

    it('should fetch news articles successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNewsResponse),
      });

      const sources = await tool.execute(['bitcoin']);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(sources.length).toBe(2); // One source per article

      expect(sources[0]?.tool).toBe('news-api');
      expect(sources[1]?.tool).toBe('news-api');
    });

    it('should extract news claims correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNewsResponse),
      });

      const sources = await tool.execute(['bitcoin']);
      const newsClaim = sources[0]?.claims.find(
        (c: Claim) => c.type === 'news',
      );

      expect(newsClaim).toBeDefined();
      expect(newsClaim?.value).toBe('Bitcoin surges to new high');
      expect(newsClaim?.instrument).toBe('bitcoin');
      expect(newsClaim?.confidence).toBe(1.0);
      expect(newsClaim?.metadata?.source).toBe('Reuters');
      expect(newsClaim?.metadata?.author).toBe('John Doe');
    });

    it('should extract event claims correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNewsResponse),
      });

      const sources = await tool.execute(['bitcoin']);
      const eventClaim = sources[0]?.claims.find(
        (c: Claim) => c.type === 'event',
      );

      expect(eventClaim).toBeDefined();
      expect(eventClaim?.value).toBe('Bitcoin surges to new high');
      expect(eventClaim?.confidence).toBe(0.9);
      expect(eventClaim?.metadata?.eventType).toBe('news');
    });

    it('should extract sentiment claims when enabled', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNewsResponse),
      });

      const sources = await tool.execute(['bitcoin']);
      const sentimentScoreClaim = sources[0]?.claims.find(
        (c: Claim) => c.type === 'sentiment_score',
      );
      const sentimentLabelClaim = sources[0]?.claims.find(
        (c: Claim) => c.type === 'sentiment_label',
      );

      expect(sentimentScoreClaim).toBeDefined();
      expect(sentimentScoreClaim?.unit).toBe('score');
      expect(sentimentScoreClaim?.value).toBeGreaterThanOrEqual(0);
      expect(sentimentScoreClaim?.value).toBeLessThanOrEqual(1);

      expect(sentimentLabelClaim).toBeDefined();
      expect(['positive', 'negative', 'neutral']).toContain(
        sentimentLabelClaim?.value,
      );
    });

    it('should detect positive sentiment', async () => {
      const positiveNews = {
        status: 'ok',
        totalResults: 1,
        articles: [
          {
            source: { name: 'Test' },
            title: 'Bitcoin wins with record gains, surges to victory',
            description: 'Positive breakthrough achieves new high',
            url: 'https://example.com',
            publishedAt: '2024-01-08T12:00:00Z',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(positiveNews),
      });

      const sources = await tool.execute(['bitcoin']);
      const sentimentLabel = sources[0]?.claims.find(
        (c: Claim) => c.type === 'sentiment_label',
      );

      expect(sentimentLabel?.value).toBe('positive');
    });

    it('should detect negative sentiment', async () => {
      const negativeNews = {
        status: 'ok',
        totalResults: 1,
        articles: [
          {
            source: { name: 'Test' },
            title: 'Bitcoin crashes, plunges to new low amid crisis',
            description: 'Negative decline fails, worst drop',
            url: 'https://example.com',
            publishedAt: '2024-01-08T12:00:00Z',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(negativeNews),
      });

      const sources = await tool.execute(['bitcoin']);
      const sentimentLabel = sources[0]?.claims.find(
        (c: Claim) => c.type === 'sentiment_label',
      );

      expect(sentimentLabel?.value).toBe('negative');
    });

    it('should detect neutral sentiment when no keywords found', async () => {
      const neutralNews = {
        status: 'ok',
        totalResults: 1,
        articles: [
          {
            source: { name: 'Test' },
            title: 'Bitcoin price remains stable',
            description: 'Trading continues as expected',
            url: 'https://example.com',
            publishedAt: '2024-01-08T12:00:00Z',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(neutralNews),
      });

      const sources = await tool.execute(['bitcoin']);
      const sentimentLabel = sources[0]?.claims.find(
        (c: Claim) => c.type === 'sentiment_label',
      );

      expect(sentimentLabel?.value).toBe('neutral');
    });

    it('should not extract sentiment when disabled', async () => {
      const toolWithoutSentiment = new NewsApiTool({
        apiKey: 'test-api-key',
        extractSentiment: false,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNewsResponse),
      });

      const sources = await toolWithoutSentiment.execute(['bitcoin']);
      const sentimentClaims = sources[0]?.claims.filter(
        (c: Claim) =>
          c.type === 'sentiment_score' || c.type === 'sentiment_label',
      );

      expect(sentimentClaims?.length).toBe(0);
    });

    it('should handle multiple instruments', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockNewsResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockNewsResponse),
        });

      const sources = await tool.execute(['bitcoin', 'ethereum']);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(sources.length).toBe(4); // 2 articles per instrument
    });

    it('should skip articles without title or url', async () => {
      const incompleteNews = {
        status: 'ok',
        totalResults: 3,
        articles: [
          {
            source: { name: 'Test' },
            title: 'Valid article',
            url: 'https://example.com',
            publishedAt: '2024-01-08T12:00:00Z',
          },
          {
            source: { name: 'Test' },
            // Missing title
            url: 'https://example.com',
            publishedAt: '2024-01-08T12:00:00Z',
          },
          {
            source: { name: 'Test' },
            title: 'Missing URL',
            // Missing url
            publishedAt: '2024-01-08T12:00:00Z',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(incompleteNews),
      });

      const sources = await tool.execute(['bitcoin']);

      expect(sources.length).toBe(1); // Only valid article
    });

    it('should handle API error response', async () => {
      const errorResponse = {
        status: 'error',
        code: 'apiKeyInvalid',
        message: 'Your API key is invalid',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(errorResponse),
      });

      const sources = await tool.execute(['bitcoin']);

      expect(sources.length).toBe(0);
    });

    it('should handle HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const sources = await tool.execute(['bitcoin']);

      expect(sources.length).toBe(0);
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const sources = await tool.execute(['bitcoin']);

      expect(sources.length).toBe(0);
    });

    it('should handle timeout error', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const sources = await tool.execute(['bitcoin']);

      expect(sources.length).toBe(0);
    });

    it('should build search query from instrument', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', articles: [] }),
      });

      await tool.execute(['bitcoin-price-prediction']);

      const callUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(callUrl).toContain('q=bitcoin+price+prediction');
    });

    it('should include correct request parameters', async () => {
      const customTool = new NewsApiTool({
        apiKey: 'test-key',
        language: 'es',
        maxArticles: 5,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', articles: [] }),
      });

      await customTool.execute(['test']);

      const callUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(callUrl).toContain('language=es');
      expect(callUrl).toContain('pageSize=5');
      expect(callUrl).toContain('apiKey=test-key');
      expect(callUrl).toContain('sortBy=publishedAt');
    });
  });

  describe('execute without API key', () => {
    it('should return empty results when no API key', async () => {
      const toolWithoutKey = new NewsApiTool();

      const sources = await toolWithoutKey.execute(['bitcoin']);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(sources.length).toBe(0);
    });
  });

  describe('source metadata', () => {
    it('should include correct metadata', async () => {
      const newsResponse = {
        status: 'ok',
        articles: [
          {
            source: { name: 'Reuters' },
            author: 'John Doe',
            title: 'Test article',
            description: 'Test description',
            url: 'https://example.com/article',
            urlToImage: 'https://example.com/image.jpg',
            publishedAt: '2024-01-08T12:00:00Z',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(newsResponse),
      });

      const sources = await tool.execute(['test']);

      expect(sources[0]?.articleUrl).toBe('https://example.com/article');
      expect(sources[0]?.articleTitle).toBe('Test article');
      expect(sources[0]?.publishedAt).toBe('2024-01-08T12:00:00Z');
      expect(sources[0]?.metadata).toEqual({
        source: 'Reuters',
        author: 'John Doe',
        description: 'Test description',
        imageUrl: 'https://example.com/image.jpg',
      });
    });
  });

  describe('createNewsApiTool factory', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should create tool when API key is in env', () => {
      process.env.NEWSAPI_API_KEY = 'test-env-key';

      const tool = createNewsApiTool();

      expect(tool).toBeDefined();
      expect(tool).toBeInstanceOf(NewsApiTool);
    });

    it('should return null when no API key in env', () => {
      delete process.env.NEWSAPI_API_KEY;

      const tool = createNewsApiTool();

      expect(tool).toBeNull();
    });
  });
});
