import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';

/**
 * Predictor data for risk analysis
 * Read-only view of prediction.predictors with article data
 */
export interface PredictorForRisk {
  id: string;
  article_id: string | null;
  target_id: string;
  target_symbol?: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  strength: number;
  confidence: number;
  reasoning: string;
  analyst_slug: string;
  analyst_assessment: {
    direction: string;
    confidence: number;
    reasoning: string;
    key_factors: string[];
    risks: string[];
  };
  created_at: string;
  // Article data (joined)
  article_title?: string;
  article_url?: string;
  article_content?: string;
}

/**
 * PredictorReaderRepository
 *
 * Read-only repository for querying predictors from the prediction schema.
 * Used by the risk system to incorporate prediction signals into risk analysis.
 *
 * This enables the risk system to consume predictors without creating duplicate
 * article processing. The prediction system creates predictors from articles,
 * and the risk system queries those predictors for its analysis.
 */
@Injectable()
export class PredictorReaderRepository {
  private readonly logger = new Logger(PredictorReaderRepository.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private getClient() {
    return this.supabaseService.getServiceClient();
  }

  /**
   * Get predictors created since a specific timestamp
   * Used to get new predictors since last risk analysis
   *
   * @param since - ISO timestamp to fetch predictors after
   * @param limit - Maximum number of predictors to return
   */
  async findPredictorsSince(
    since: string,
    limit: number = 100,
  ): Promise<PredictorForRisk[]> {
    try {
      // Query predictors with article join
      const { data, error } = await this.getClient()
        .schema('prediction')
        .from('predictors')
        .select(
          `
          id,
          article_id,
          target_id,
          direction,
          strength,
          confidence,
          reasoning,
          analyst_slug,
          analyst_assessment,
          created_at
        `,
        )
        .gt('created_at', since)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        this.logger.error(`Failed to fetch predictors: ${error.message}`);
        throw new Error(`Failed to fetch predictors: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Fetch article data for predictors with article_id
      const articleIds = data
        .filter((p) => p.article_id)
        .map((p) => p.article_id);

      let articlesMap: Map<
        string,
        { title: string; url: string; content: string }
      > = new Map();

      if (articleIds.length > 0) {
        const { data: articles, error: articlesError } = await this.getClient()
          .schema('crawler')
          .from('articles')
          .select('id, title, url, content')
          .in('id', articleIds);

        if (!articlesError && articles) {
          articlesMap = new Map(
            articles.map((a) => [
              a.id,
              { title: a.title, url: a.url, content: a.content },
            ]),
          );
        }
      }

      // Fetch target symbols for context
      const targetIds = [...new Set(data.map((p) => p.target_id))];
      let targetsMap: Map<string, string> = new Map();

      if (targetIds.length > 0) {
        const { data: targets, error: targetsError } = await this.getClient()
          .schema('prediction')
          .from('targets')
          .select('id, symbol')
          .in('id', targetIds);

        if (!targetsError && targets) {
          targetsMap = new Map(targets.map((t) => [t.id, t.symbol]));
        }
      }

      // Combine data
      return data.map((p) => {
        const article = p.article_id
          ? articlesMap.get(p.article_id)
          : undefined;
        return {
          id: p.id,
          article_id: p.article_id,
          target_id: p.target_id,
          target_symbol: targetsMap.get(p.target_id),
          direction: p.direction,
          strength: p.strength,
          confidence: p.confidence,
          reasoning: p.reasoning,
          analyst_slug: p.analyst_slug,
          analyst_assessment: p.analyst_assessment,
          created_at: p.created_at,
          article_title: article?.title,
          article_url: article?.url,
          article_content: article?.content,
        };
      });
    } catch (error) {
      this.logger.error(
        `Error fetching predictors: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get predictors for a specific instrument (target symbol)
   * Used when analyzing a specific risk subject
   *
   * @param targetSymbol - The instrument symbol (e.g., "AAPL", "BTC")
   * @param since - ISO timestamp to fetch predictors after (optional)
   * @param limit - Maximum number of predictors to return
   */
  async findPredictorsBySymbol(
    targetSymbol: string,
    since?: string,
    limit: number = 50,
  ): Promise<PredictorForRisk[]> {
    try {
      // First get the target ID for this symbol
      const { data: targetData, error: targetError } = await this.getClient()
        .schema('prediction')
        .from('targets')
        .select('id')
        .eq('symbol', targetSymbol)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (targetError || !targetData) {
        this.logger.debug(`No target found for symbol: ${targetSymbol}`);
        return [];
      }

      // Query predictors for this target
      let query = this.getClient()
        .schema('prediction')
        .from('predictors')
        .select(
          `
          id,
          article_id,
          target_id,
          direction,
          strength,
          confidence,
          reasoning,
          analyst_slug,
          analyst_assessment,
          created_at
        `,
        )
        .eq('target_id', targetData.id)
        .eq('status', 'active');

      if (since) {
        query = query.gt('created_at', since);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        this.logger.error(
          `Failed to fetch predictors for ${targetSymbol}: ${error.message}`,
        );
        throw new Error(
          `Failed to fetch predictors for ${targetSymbol}: ${error.message}`,
        );
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Fetch article data
      const articleIds = data
        .filter((p) => p.article_id)
        .map((p) => p.article_id);
      let articlesMap: Map<
        string,
        { title: string; url: string; content: string }
      > = new Map();

      if (articleIds.length > 0) {
        const { data: articles, error: articlesError } = await this.getClient()
          .schema('crawler')
          .from('articles')
          .select('id, title, url, content')
          .in('id', articleIds);

        if (!articlesError && articles) {
          articlesMap = new Map(
            articles.map((a) => [
              a.id,
              { title: a.title, url: a.url, content: a.content },
            ]),
          );
        }
      }

      return data.map((p) => {
        const article = p.article_id
          ? articlesMap.get(p.article_id)
          : undefined;
        return {
          id: p.id,
          article_id: p.article_id,
          target_id: p.target_id,
          target_symbol: targetSymbol,
          direction: p.direction,
          strength: p.strength,
          confidence: p.confidence,
          reasoning: p.reasoning,
          analyst_slug: p.analyst_slug,
          analyst_assessment: p.analyst_assessment,
          created_at: p.created_at,
          article_title: article?.title,
          article_url: article?.url,
          article_content: article?.content,
        };
      });
    } catch (error) {
      this.logger.error(
        `Error fetching predictors for ${targetSymbol}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get predictors relevant to multiple instruments
   * Used for portfolio-level or scope-level risk analysis
   *
   * @param symbols - Array of instrument symbols
   * @param since - ISO timestamp to fetch predictors after
   * @param limit - Maximum number of predictors per symbol
   */
  async findPredictorsForSymbols(
    symbols: string[],
    since: string,
    limit: number = 20,
  ): Promise<Map<string, PredictorForRisk[]>> {
    const result = new Map<string, PredictorForRisk[]>();

    // Fetch in parallel for efficiency
    await Promise.all(
      symbols.map(async (symbol) => {
        const predictors = await this.findPredictorsBySymbol(
          symbol,
          since,
          limit,
        );
        result.set(symbol, predictors);
      }),
    );

    return result;
  }
}
