/**
 * News API Tool
 *
 * Fetches event-related news from NewsAPI.org.
 * Provides news claims that can influence market predictions.
 *
 * FEATURES:
 * - Search news by keywords related to markets
 * - Filter by date range, language, sources
 * - Sentiment extraction from headlines
 * - Event-driven news tracking
 *
 * API DOCUMENTATION:
 * - Base URL: https://newsapi.org/v2
 * - Requires API key (optional, env: NEWSAPI_API_KEY)
 * - Free tier: 100 requests/day, 1 month lookback
 *
 * @module news-api.tool
 */

import { Injectable } from '@nestjs/common';
import {
  BasePredictionTool,
  ToolConfig,
} from '../../stock-predictor/tools/base-tool';
import { Source, Claim } from '../../base/base-prediction.types';

/**
 * NewsAPI article response
 */
interface NewsApiArticle {
  source?: {
    id?: string;
    name?: string;
  };
  author?: string;
  title?: string;
  description?: string;
  url?: string;
  urlToImage?: string;
  publishedAt?: string;
  content?: string;
}

interface NewsApiResponse {
  status?: string;
  totalResults?: number;
  articles?: NewsApiArticle[];
  code?: string;
  message?: string;
}

/**
 * News API Tool configuration
 */
export interface NewsApiToolConfig extends ToolConfig {
  /** API key for NewsAPI.org */
  apiKey?: string;

  /** Language filter (default: 'en') */
  language?: string;

  /** Max articles to fetch per query (default: 10) */
  maxArticles?: number;

  /** Extract sentiment from headlines */
  extractSentiment?: boolean;
}

/**
 * News API Tool
 *
 * Fetches news articles related to market topics.
 * Requires NEWSAPI_API_KEY environment variable (optional).
 *
 * NOTE: Instruments should be mapped to search queries.
 * For Polymarket, instrument metadata should include keywords.
 *
 * @example
 * ```typescript
 * const tool = new NewsApiTool({ apiKey: process.env.NEWSAPI_API_KEY });
 * const sources = await tool.execute(['election-2024', 'climate-change']);
 * // Returns sources with news and event claims
 * ```
 */
@Injectable()
export class NewsApiTool extends BasePredictionTool {
  readonly name = 'news-api';
  readonly description = 'Fetches event-related news from NewsAPI.org';

  private readonly baseUrl = 'https://newsapi.org/v2';
  private readonly apiKey?: string;
  private readonly timeoutMs: number;
  private readonly language: string;
  private readonly maxArticles: number;
  private readonly extractSentiment: boolean;

  constructor(config: NewsApiToolConfig = {}) {
    super();
    this.apiKey = config.apiKey ?? process.env.NEWSAPI_API_KEY;
    this.timeoutMs = config.timeoutMs ?? 10000;
    this.language = config.language ?? 'en';
    this.maxArticles = config.maxArticles ?? 10;
    this.extractSentiment = config.extractSentiment ?? true;

    if (!this.apiKey) {
      this.logger.warn(
        'NewsAPI tool initialized without API key (NEWSAPI_API_KEY not set) - will return empty results',
      );
    }
  }

  /**
   * Fetch news articles for instruments.
   */
  protected async fetchData(
    instruments: string[],
  ): Promise<Map<string, NewsApiResponse>> {
    this.logger.debug(`Fetching news for: ${instruments.join(', ')}`);

    const results = new Map<string, NewsApiResponse>();

    // If no API key, return empty results
    if (!this.apiKey) {
      this.logger.debug('Skipping NewsAPI fetch - no API key configured');
      return results;
    }

    // Fetch news for each instrument
    for (const instrument of instruments) {
      try {
        const query = this.buildSearchQuery(instrument);
        const response = await this.fetchNews(query);
        if (response) {
          results.set(instrument, response);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to fetch news for ${instrument}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return results;
  }

  /**
   * Build search query from instrument.
   * For now, use instrument as-is. In production, this would:
   * 1. Look up market metadata to get keywords
   * 2. Build optimized search query
   * 3. Include synonyms and related terms
   */
  private buildSearchQuery(instrument: string): string {
    // Simple implementation: replace dashes/underscores with spaces
    return instrument.replace(/[-_]/g, ' ');
  }

  /**
   * Fetch news from NewsAPI
   */
  private async fetchNews(query: string): Promise<NewsApiResponse | null> {
    if (!this.apiKey) {
      return null;
    }

    // Use "everything" endpoint for broader search
    const params = new URLSearchParams({
      q: query,
      language: this.language,
      sortBy: 'publishedAt',
      pageSize: String(this.maxArticles),
      apiKey: this.apiKey,
    });
    const url = `${this.baseUrl}/everything?${params.toString()}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.debug(
          `NewsAPI error: ${response.status} ${response.statusText}`,
        );
        return null;
      }

      const data = (await response.json()) as NewsApiResponse;

      // Check for API errors
      if (data.status === 'error') {
        this.logger.warn(`NewsAPI error: ${data.code} - ${data.message}`);
        return null;
      }

      return data;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        this.logger.debug(
          `Error fetching news: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse NewsAPI response into sources with claims.
   */
  protected parseResponse(
    response: Map<string, NewsApiResponse>,
    _instruments: string[],
  ): Source[] {
    const sources: Source[] = [];

    // Create sources for each instrument's news
    for (const [instrument, newsResponse] of response.entries()) {
      const articles = newsResponse.articles ?? [];

      // Create a source for each article
      for (const article of articles) {
        if (!article.title || !article.url) continue;

        const claims = this.extractClaims(instrument, article);

        if (claims.length > 0) {
          sources.push(
            this.createSource(claims, {
              articleUrl: article.url,
              articleTitle: article.title,
              publishedAt: article.publishedAt,
              metadata: {
                source: article.source?.name,
                author: article.author,
                description: article.description,
                imageUrl: article.urlToImage,
              },
            }),
          );
        }
      }
    }

    return sources;
  }

  /**
   * Extract claims from a news article.
   */
  private extractClaims(instrument: string, article: NewsApiArticle): Claim[] {
    const claims: Claim[] = [];
    const timestamp = article.publishedAt || new Date().toISOString();

    // News claim - headline as the value
    claims.push(
      this.createClaim('news', instrument, article.title || '', {
        timestamp,
        confidence: 1.0,
        metadata: {
          source: article.source?.name,
          author: article.author,
          description: article.description,
          url: article.url,
        },
      }),
    );

    // Event claim - treat news as an event
    claims.push(
      this.createClaim('event', instrument, article.title || '', {
        timestamp,
        confidence: 0.9, // Slightly lower since news != confirmed event
        metadata: {
          eventType: 'news',
          source: article.source?.name,
          url: article.url,
        },
      }),
    );

    // Sentiment claim (if enabled)
    if (this.extractSentiment) {
      const sentiment = this.extractSentimentFromText(
        article.title || '',
        article.description,
      );
      if (sentiment !== null) {
        claims.push(
          this.createClaim('sentiment_score', instrument, sentiment.score, {
            unit: 'score',
            timestamp,
            confidence: sentiment.confidence,
            metadata: {
              label: sentiment.label,
              source: 'newsapi',
              basedOn: 'headline',
            },
          }),
        );

        claims.push(
          this.createClaim('sentiment_label', instrument, sentiment.label, {
            timestamp,
            confidence: sentiment.confidence,
            metadata: {
              score: sentiment.score,
              source: 'newsapi',
            },
          }),
        );
      }
    }

    return claims;
  }

  /**
   * Extract sentiment from text (simple keyword-based approach).
   * In production, this would use a proper sentiment analysis model.
   */
  private extractSentimentFromText(
    title: string,
    description?: string,
  ): { score: number; label: string; confidence: number } | null {
    const text = `${title} ${description || ''}`.toLowerCase();

    // Simple keyword lists (in production, use ML model)
    const positiveKeywords = [
      'wins',
      'victory',
      'success',
      'breakthrough',
      'achieves',
      'gains',
      'surges',
      'rallies',
      'boost',
      'positive',
      'optimistic',
      'bullish',
      'triumph',
      'beats',
      'exceeds',
      'record',
      'high',
    ];

    const negativeKeywords = [
      'loses',
      'defeat',
      'fails',
      'crisis',
      'crash',
      'drops',
      'plunges',
      'falls',
      'decline',
      'negative',
      'pessimistic',
      'bearish',
      'concern',
      'warning',
      'risk',
      'threat',
      'low',
      'worst',
    ];

    let positiveCount = 0;
    let negativeCount = 0;

    for (const keyword of positiveKeywords) {
      if (text.includes(keyword)) positiveCount++;
    }

    for (const keyword of negativeKeywords) {
      if (text.includes(keyword)) negativeCount++;
    }

    const totalCount = positiveCount + negativeCount;
    if (totalCount === 0) {
      // Neutral - no strong sentiment keywords
      return {
        score: 0.5,
        label: 'neutral',
        confidence: 0.5,
      };
    }

    // Calculate sentiment score (-1 to 1, then normalize to 0-1)
    const rawScore = (positiveCount - negativeCount) / Math.max(totalCount, 1);
    const normalizedScore = (rawScore + 1) / 2; // Convert -1..1 to 0..1

    // Determine label
    let label: string;
    if (normalizedScore > 0.6) {
      label = 'positive';
    } else if (normalizedScore < 0.4) {
      label = 'negative';
    } else {
      label = 'neutral';
    }

    // Confidence based on total keyword matches
    const confidence = Math.min(0.5 + totalCount * 0.1, 0.9);

    return {
      score: normalizedScore,
      label,
      confidence,
    };
  }
}

/**
 * Factory function to create NewsApiTool with optional API key.
 * Returns null if no API key is available.
 */
export function createNewsApiTool(): NewsApiTool | null {
  const apiKey = process.env.NEWSAPI_API_KEY;

  if (!apiKey) {
    return null;
  }

  return new NewsApiTool({ apiKey });
}
