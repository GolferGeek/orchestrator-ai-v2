import { Injectable, Logger } from '@nestjs/common';
import { LLMService } from '@/llms/llm.service';
import { SupabaseService } from '@/supabase/supabase.service';
import { DimensionRepository } from '../repositories/dimension.repository';
import type { ExecutionContext } from '@orchestrator-ai/transport-types';

// Schema constants
const RISK_SCHEMA = 'risk';
const CRAWLER_SCHEMA = 'crawler';

/**
 * Classification result for a single article
 */
export interface ArticleClassification {
  articleId: string;
  scopeId: string;
  dimensionSlugs: string[];
  confidence: number;
  sentiment: number;
  sentimentLabel: 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive';
  subjectIdentifiers: string[];
  riskIndicators: Array<{ type: string; keywords: string[] }>;
}

/**
 * Result of a classification batch
 */
export interface ClassificationBatchResult {
  scopeId: string;
  totalArticles: number;
  classified: number;
  failed: number;
  errors: string[];
}

/**
 * Unclassified article from the database
 */
interface UnclassifiedArticle {
  article_id: string;
  source_id: string;
  title: string | null;
  content: string | null;
  url: string | null;
  published_at: string | null;
  created_at: string;
}

/**
 * ArticleClassifierService
 *
 * Uses a cheap/fast LLM to classify crawler articles by relevant risk dimensions.
 * This enables efficient routing: classify once, then only run full analysis
 * on dimensions that are actually relevant to each article.
 *
 * Flow:
 * 1. Pull unclassified articles for a scope
 * 2. For each article, call cheap LLM to classify:
 *    - Which dimensions are relevant (from scope's dimension list)
 *    - Sentiment (-1 to 1)
 *    - Subject identifiers mentioned (stock symbols, company names)
 *    - Risk indicators detected
 * 3. Store classification in risk.article_classifications
 * 4. Classification is then used by dimension analysis to pull relevant articles
 */
@Injectable()
export class ArticleClassifierService {
  private readonly logger = new Logger(ArticleClassifierService.name);

  constructor(
    private readonly llmService: LLMService,
    private readonly supabase: SupabaseService,
    private readonly dimensionRepository: DimensionRepository,
  ) {}

  /**
   * Classify unclassified articles for a scope
   */
  async classifyArticlesForScope(
    scopeId: string,
    limit: number = 50,
  ): Promise<ClassificationBatchResult> {
    const result: ClassificationBatchResult = {
      scopeId,
      totalArticles: 0,
      classified: 0,
      failed: 0,
      errors: [],
    };

    try {
      // Get unclassified articles for this scope
      // Note: rpc calls to schema-qualified functions use the schema.function_name format
      const { data: articles, error: fetchError } = await this.supabase
        .getServiceClient()
        .schema(RISK_SCHEMA)
        .rpc('get_unclassified_articles', { p_scope_id: scopeId, p_limit: limit });

      if (fetchError) {
        throw new Error(`Failed to fetch unclassified articles: ${fetchError.message}`);
      }

      if (!articles || articles.length === 0) {
        this.logger.debug(`No unclassified articles for scope ${scopeId}`);
        return result;
      }

      result.totalArticles = articles.length;
      this.logger.log(`Classifying ${articles.length} articles for scope ${scopeId}`);

      // Get dimensions for this scope (needed for the prompt)
      const dimensions = await this.dimensionRepository.findByScope(scopeId);
      const dimensionSlugs = dimensions.map((d) => d.slug);
      const dimensionDescriptions = dimensions
        .map((d) => `- ${d.slug}: ${d.name} - ${d.description?.slice(0, 100) || 'No description'}`)
        .join('\n');

      // Classify each article
      for (const article of articles as UnclassifiedArticle[]) {
        try {
          const classification = await this.classifyArticle(
            article,
            scopeId,
            dimensionSlugs,
            dimensionDescriptions,
          );

          if (classification) {
            await this.saveClassification(classification);
            result.classified++;
          } else {
            result.failed++;
            result.errors.push(`Article ${article.article_id}: Classification returned null`);
          }
        } catch (error) {
          result.failed++;
          const msg = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Article ${article.article_id}: ${msg}`);
          this.logger.error(`Failed to classify article ${article.article_id}: ${msg}`);
        }
      }

      this.logger.log(
        `Classification complete for scope ${scopeId}: ${result.classified}/${result.totalArticles} classified`,
      );

      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Batch classification failed: ${msg}`);
      this.logger.error(`Batch classification failed for scope ${scopeId}: ${msg}`);
      return result;
    }
  }

  /**
   * Classify a single article using LLM
   */
  private async classifyArticle(
    article: UnclassifiedArticle,
    scopeId: string,
    dimensionSlugs: string[],
    dimensionDescriptions: string,
  ): Promise<ArticleClassification | null> {
    // Prepare article text (truncate if too long)
    const title = article.title || 'No title';
    const content = article.content?.slice(0, 2000) || 'No content';
    const articleText = `Title: ${title}\n\nContent: ${content}`;

    // Build classification prompt
    const systemPrompt = `You are a financial risk analyst. Your task is to classify news articles by which investment risk dimensions they are relevant to.

Available risk dimensions:
${dimensionDescriptions}

For each article, you must return a JSON object with:
1. "dimensions": Array of dimension slugs that this article is relevant to (from the list above). Only include dimensions where the article provides meaningful signal.
2. "confidence": Your confidence in this classification (0.0 to 1.0)
3. "sentiment": Overall sentiment of the article (-1.0 = very negative, 0 = neutral, 1.0 = very positive)
4. "sentiment_label": One of: "very_negative", "negative", "neutral", "positive", "very_positive"
5. "subjects": Array of stock symbols, company names, or sector names mentioned (e.g., ["AAPL", "Apple Inc", "Technology"])
6. "risk_indicators": Array of objects with {type, keywords} for specific risk signals detected

Example output:
{
  "dimensions": ["regulatory", "geopolitical"],
  "confidence": 0.85,
  "sentiment": -0.6,
  "sentiment_label": "negative",
  "subjects": ["AAPL", "Apple"],
  "risk_indicators": [{"type": "regulatory", "keywords": ["antitrust", "investigation"]}]
}

IMPORTANT:
- Only return valid JSON, no explanations
- Only include dimensions that are genuinely relevant
- If no dimensions are relevant, return empty array for dimensions
- Be conservative with confidence scores`;

    const userPrompt = `Classify this article:

${articleText}

Return JSON classification:`;

    try {
      // Create minimal execution context for LLM call
      const context: ExecutionContext = {
        orgSlug: 'risk-classifier',
        userId: 'system',
        conversationId: '00000000-0000-0000-0000-000000000000',
        taskId: '00000000-0000-0000-0000-000000000000',
        planId: '00000000-0000-0000-0000-000000000000',
        deliverableId: '00000000-0000-0000-0000-000000000000',
        agentSlug: 'article-classifier',
        agentType: 'utility',
        provider: 'ollama',
        model: process.env.DEFAULT_LLM_MODEL || 'llama3.2:3b',
      };

      const response = await this.llmService.generateResponse(systemPrompt, userPrompt, {
        temperature: 0.3, // Low temperature for consistent classification
        maxTokens: 500,
        callerType: 'risk-runner',
        callerName: 'article-classifier',
        executionContext: context,
      });

      // Parse response
      const responseText = typeof response === 'string' ? response : response.content;
      const parsed = this.parseClassificationResponse(responseText, dimensionSlugs);

      if (!parsed) {
        this.logger.warn(`Failed to parse classification for article ${article.article_id}`);
        return null;
      }

      return {
        articleId: article.article_id,
        scopeId,
        dimensionSlugs: parsed.dimensions,
        confidence: parsed.confidence,
        sentiment: parsed.sentiment,
        sentimentLabel: parsed.sentiment_label,
        subjectIdentifiers: parsed.subjects,
        riskIndicators: parsed.risk_indicators,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`LLM classification failed for article ${article.article_id}: ${msg}`);
      throw error;
    }
  }

  /**
   * Parse LLM response into structured classification
   */
  private parseClassificationResponse(
    response: string,
    validDimensions: string[],
  ): {
    dimensions: string[];
    confidence: number;
    sentiment: number;
    sentiment_label: 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive';
    subjects: string[];
    risk_indicators: Array<{ type: string; keywords: string[] }>;
  } | null {
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = response.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();

      const parsed = JSON.parse(jsonStr);

      // Validate and filter dimensions to only valid ones
      const dimensions = Array.isArray(parsed.dimensions)
        ? parsed.dimensions.filter((d: string) => validDimensions.includes(d))
        : [];

      // Validate confidence
      const confidence =
        typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.5;

      // Validate sentiment
      const sentiment =
        typeof parsed.sentiment === 'number'
          ? Math.max(-1, Math.min(1, parsed.sentiment))
          : 0;

      // Validate sentiment label
      const validLabels = ['very_negative', 'negative', 'neutral', 'positive', 'very_positive'];
      const sentimentLabel = validLabels.includes(parsed.sentiment_label)
        ? parsed.sentiment_label
        : this.getSentimentLabel(sentiment);

      // Validate subjects
      const subjects = Array.isArray(parsed.subjects)
        ? parsed.subjects.filter((s: unknown) => typeof s === 'string')
        : [];

      // Validate risk indicators
      const riskIndicators = Array.isArray(parsed.risk_indicators)
        ? parsed.risk_indicators.filter(
            (r: unknown) =>
              r &&
              typeof r === 'object' &&
              'type' in r &&
              typeof (r as { type: unknown }).type === 'string',
          )
        : [];

      return {
        dimensions,
        confidence,
        sentiment,
        sentiment_label: sentimentLabel,
        subjects,
        risk_indicators: riskIndicators,
      };
    } catch (error) {
      this.logger.warn(`Failed to parse classification JSON: ${response.slice(0, 200)}`);
      return null;
    }
  }

  /**
   * Convert sentiment score to label
   */
  private getSentimentLabel(
    sentiment: number,
  ): 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive' {
    if (sentiment <= -0.6) return 'very_negative';
    if (sentiment <= -0.2) return 'negative';
    if (sentiment <= 0.2) return 'neutral';
    if (sentiment <= 0.6) return 'positive';
    return 'very_positive';
  }

  /**
   * Save classification to database
   */
  private async saveClassification(classification: ArticleClassification): Promise<void> {
    const { error } = await this.supabase
      .getServiceClient()
      .schema(RISK_SCHEMA)
      .from('article_classifications')
      .insert({
        scope_id: classification.scopeId,
        article_id: classification.articleId,
        dimension_slugs: classification.dimensionSlugs,
        confidence: classification.confidence,
        sentiment: classification.sentiment,
        sentiment_label: classification.sentimentLabel,
        subject_identifiers: classification.subjectIdentifiers,
        risk_indicators: classification.riskIndicators,
        llm_provider: 'ollama',
        llm_model: process.env.DEFAULT_LLM_MODEL || 'llama3.2:3b',
        status: 'classified',
      });

    if (error) {
      throw new Error(`Failed to save classification: ${error.message}`);
    }
  }

  /**
   * Get classification statistics for a scope
   */
  async getClassificationStats(scopeId: string): Promise<{
    totalArticles: number;
    classifiedArticles: number;
    unclassifiedArticles: number;
    classificationRate: number;
    avgDimensionsPerArticle: number;
    sentimentDistribution: Record<string, number>;
    topDimensions: Array<{ dimension: string; count: number }>;
  }> {
    const { data, error } = await this.supabase
      .getServiceClient()
      .schema(RISK_SCHEMA)
      .rpc('get_classification_stats', { p_scope_id: scopeId });

    if (error) {
      throw new Error(`Failed to get classification stats: ${error.message}`);
    }

    const stats = data?.[0] || {};
    return {
      totalArticles: stats.total_articles || 0,
      classifiedArticles: stats.classified_articles || 0,
      unclassifiedArticles: stats.unclassified_articles || 0,
      classificationRate: stats.classification_rate || 0,
      avgDimensionsPerArticle: stats.avg_dimensions_per_article || 0,
      sentimentDistribution: stats.sentiment_distribution || {},
      topDimensions: stats.top_dimensions || [],
    };
  }

  /**
   * Get articles classified for a specific dimension
   */
  async getArticlesForDimension(
    scopeId: string,
    dimensionSlug: string,
    since: Date = new Date(Date.now() - 24 * 60 * 60 * 1000),
    limit: number = 100,
  ): Promise<
    Array<{
      articleId: string;
      title: string;
      url: string;
      publishedAt: string;
      sentiment: number;
      sentimentLabel: string;
      confidence: number;
      riskIndicators: Array<{ type: string; keywords: string[] }>;
    }>
  > {
    const { data, error } = await this.supabase
      .getServiceClient()
      .schema(RISK_SCHEMA)
      .rpc('get_articles_for_dimension', {
        p_scope_id: scopeId,
        p_dimension_slug: dimensionSlug,
        p_since: since.toISOString(),
        p_limit: limit,
      });

    if (error) {
      throw new Error(`Failed to get articles for dimension: ${error.message}`);
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      articleId: row.article_id as string,
      title: row.title as string,
      url: row.url as string,
      publishedAt: row.published_at as string,
      sentiment: row.sentiment as number,
      sentimentLabel: row.sentiment_label as string,
      confidence: row.confidence as number,
      riskIndicators: row.risk_indicators as Array<{ type: string; keywords: string[] }>,
    }));
  }

  /**
   * Get articles for a specific subject AND dimension
   * This is the key method for subject-aware dimension analysis
   */
  async getArticlesForSubjectDimension(
    scopeId: string,
    subjectIdentifier: string,
    dimensionSlug: string,
    since: Date = new Date(Date.now() - 24 * 60 * 60 * 1000),
    limit: number = 100,
  ): Promise<
    Array<{
      articleId: string;
      title: string;
      content: string;
      url: string;
      publishedAt: string;
      sentiment: number;
      sentimentLabel: string;
      confidence: number;
      riskIndicators: Array<{ type: string; keywords: string[] }>;
      subjectIdentifiers: string[];
    }>
  > {
    const { data, error } = await this.supabase
      .getServiceClient()
      .schema(RISK_SCHEMA)
      .rpc('get_articles_for_subject_dimension', {
        p_scope_id: scopeId,
        p_subject_identifier: subjectIdentifier,
        p_dimension_slug: dimensionSlug,
        p_since: since.toISOString(),
        p_limit: limit,
      });

    if (error) {
      throw new Error(`Failed to get articles for subject dimension: ${error.message}`);
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      articleId: row.article_id as string,
      title: row.title as string,
      content: row.content as string,
      url: row.url as string,
      publishedAt: row.published_at as string,
      sentiment: row.sentiment as number,
      sentimentLabel: row.sentiment_label as string,
      confidence: row.confidence as number,
      riskIndicators: row.risk_indicators as Array<{ type: string; keywords: string[] }>,
      subjectIdentifiers: row.subject_identifiers as string[],
    }));
  }

  /**
   * Get all articles mentioning a specific subject (across all dimensions)
   */
  async getArticlesForSubject(
    scopeId: string,
    subjectIdentifier: string,
    since: Date = new Date(Date.now() - 24 * 60 * 60 * 1000),
    limit: number = 100,
  ): Promise<
    Array<{
      articleId: string;
      title: string;
      content: string;
      url: string;
      publishedAt: string;
      dimensionSlugs: string[];
      sentiment: number;
      sentimentLabel: string;
      confidence: number;
      riskIndicators: Array<{ type: string; keywords: string[] }>;
      subjectIdentifiers: string[];
    }>
  > {
    const { data, error } = await this.supabase
      .getServiceClient()
      .schema(RISK_SCHEMA)
      .rpc('get_articles_for_subject', {
        p_scope_id: scopeId,
        p_subject_identifier: subjectIdentifier,
        p_since: since.toISOString(),
        p_limit: limit,
      });

    if (error) {
      throw new Error(`Failed to get articles for subject: ${error.message}`);
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      articleId: row.article_id as string,
      title: row.title as string,
      content: row.content as string,
      url: row.url as string,
      publishedAt: row.published_at as string,
      dimensionSlugs: row.dimension_slugs as string[],
      sentiment: row.sentiment as number,
      sentimentLabel: row.sentiment_label as string,
      confidence: row.confidence as number,
      riskIndicators: row.risk_indicators as Array<{ type: string; keywords: string[] }>,
      subjectIdentifiers: row.subject_identifiers as string[],
    }));
  }

  /**
   * Get subject coverage summary (which subjects have classified articles)
   */
  async getSubjectCoverage(
    scopeId: string,
    since: Date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  ): Promise<
    Array<{
      subjectIdentifier: string;
      articleCount: number;
      avgSentiment: number;
      dimensionCoverage: string[];
      latestArticle: string;
    }>
  > {
    const { data, error } = await this.supabase
      .getServiceClient()
      .schema(RISK_SCHEMA)
      .rpc('get_subject_coverage', {
        p_scope_id: scopeId,
        p_since: since.toISOString(),
      });

    if (error) {
      throw new Error(`Failed to get subject coverage: ${error.message}`);
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      subjectIdentifier: row.subject_identifier as string,
      articleCount: row.article_count as number,
      avgSentiment: row.avg_sentiment as number,
      dimensionCoverage: row.dimension_coverage as string[],
      latestArticle: row.latest_article as string,
    }));
  }
}
