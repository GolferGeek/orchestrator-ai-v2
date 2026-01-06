import { Injectable, Logger } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import {
  Instrument,
  MarketBar,
  NewsItem,
  AgendaEvent,
  Recommendation,
} from "./finance.state";

/**
 * Universe version configuration
 */
export interface UniverseVersion {
  id: string;
  universeId: string;
  version: number;
  isActive: boolean;
  config: {
    instruments: Instrument[];
    marketHours?: string;
    timezone?: string;
    timingWindows?: string[];
    dataSourceProfile?: Record<string, unknown>;
  };
}

/**
 * Recommendation run record
 */
export interface RecommendationRun {
  id: string;
  universeVersionId: string;
  runTs: string;
  producedByAgent: string;
  inputsHash?: string;
  status: "pending" | "running" | "completed" | "failed";
  taskId: string;
}

/**
 * FinanceDbService
 *
 * Database operations for the Finance workflow.
 * Implements data storage for the finance schema.
 */
@Injectable()
export class FinanceDbService {
  private readonly logger = new Logger(FinanceDbService.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private supabase: SupabaseClient<any, "finance">;

  constructor() {
    // Use API URL (6010), not database port (6012)
    const supabaseUrl = process.env.SUPABASE_URL || "http://127.0.0.1:6010";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      // Use the finance schema for all queries
      db: { schema: "finance" },
    });
  }

  /**
   * Get universe version configuration
   */
  async getUniverseVersion(
    universeVersionId: string,
  ): Promise<UniverseVersion | null> {
    const { data, error } = await this.supabase
      .from("universe_versions")
      .select("*")
      .eq("id", universeVersionId)
      .single();

    if (error || !data) {
      this.logger.error(`Failed to get universe version: ${error?.message}`);
      return null;
    }

    return {
      id: data.id,
      universeId: data.universe_id,
      version: data.version,
      isActive: data.is_active,
      config: data.config_json as UniverseVersion["config"],
    };
  }

  /**
   * Create a new recommendation run
   */
  async createRecommendationRun(
    universeVersionId: string,
    taskId: string,
    producedByAgent: string,
    runTs?: string,
  ): Promise<RecommendationRun> {
    // Use snake_case for database column names
    const run = {
      id: uuidv4(),
      universe_version_id: universeVersionId,
      run_ts: runTs || new Date().toISOString(),
      produced_by_agent: producedByAgent,
      status: "running" as const,
      task_id: taskId,
    };

    const { data, error } = await this.supabase
      .from("recommendation_runs")
      .insert(run)
      .select()
      .single();

    if (error) {
      this.logger.error(
        `Failed to create recommendation run: ${error.message}`,
      );
      throw new Error(`Failed to create recommendation run: ${error.message}`);
    }

    return {
      id: data.id,
      universeVersionId: data.universe_version_id,
      runTs: data.run_ts,
      producedByAgent: data.produced_by_agent,
      inputsHash: data.inputs_hash,
      status: data.status,
      taskId: data.task_id,
    };
  }

  /**
   * Update recommendation run status
   */
  async updateRunStatus(
    runId: string,
    status: "pending" | "running" | "completed" | "failed",
  ): Promise<void> {
    const { error } = await this.supabase
      .from("recommendation_runs")
      .update({ status })
      .eq("id", runId);

    if (error) {
      this.logger.error(`Failed to update run status: ${error.message}`);
    }
  }

  /**
   * Store market bars
   */
  async storeMarketBars(bars: MarketBar[]): Promise<void> {
    if (bars.length === 0) return;

    const { error } = await this.supabase.from("market_bars").insert(
      bars.map((bar) => ({
        id: bar.id,
        instrument: bar.instrument,
        ts: bar.ts,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
        vendor: bar.vendor,
      })),
    );

    if (error) {
      this.logger.error(`Failed to store market bars: ${error.message}`);
      throw new Error(`Failed to store market bars: ${error.message}`);
    }

    this.logger.log(`Stored ${bars.length} market bars`);
  }

  /**
   * Store news items
   */
  async storeNewsItems(items: NewsItem[]): Promise<void> {
    if (items.length === 0) return;

    const { error } = await this.supabase.from("news_items").insert(
      items.map((item) => ({
        id: item.id,
        source: item.source,
        published_at: item.publishedAt,
        url: item.url,
        title: item.title,
        snippet: item.snippet,
      })),
    );

    if (error) {
      this.logger.error(`Failed to store news items: ${error.message}`);
      throw new Error(`Failed to store news items: ${error.message}`);
    }

    this.logger.log(`Stored ${items.length} news items`);
  }

  /**
   * Store agenda events
   */
  async storeAgendaEvents(events: AgendaEvent[]): Promise<void> {
    if (events.length === 0) return;

    const { error } = await this.supabase.from("agenda_events").insert(
      events.map((event) => ({
        id: event.id,
        asof_ts: event.asofTs,
        narrative: event.narrative,
        suspected_incentive: event.suspectedIncentive,
        target_instruments: event.targetInstruments,
        confidence: event.confidence,
        evidence_json: event.evidence,
      })),
    );

    if (error) {
      this.logger.error(`Failed to store agenda events: ${error.message}`);
      throw new Error(`Failed to store agenda events: ${error.message}`);
    }

    this.logger.log(`Stored ${events.length} agenda events`);
  }

  /**
   * Store recommendations
   */
  async storeRecommendations(
    runId: string,
    recommendations: Recommendation[],
  ): Promise<void> {
    if (recommendations.length === 0) return;

    const { error } = await this.supabase.from("recommendations").insert(
      recommendations.map((rec) => ({
        id: rec.id,
        run_id: runId,
        instrument: rec.instrument,
        action: rec.action,
        timing_window: rec.timingWindow,
        entry_style: rec.entryStyle,
        intended_price: rec.intendedPrice,
        sizing_json: rec.sizing,
        rationale: rec.rationale,
        model_metadata: rec.modelMetadata,
      })),
    );

    if (error) {
      this.logger.error(`Failed to store recommendations: ${error.message}`);
      throw new Error(`Failed to store recommendations: ${error.message}`);
    }

    this.logger.log(`Stored ${recommendations.length} recommendations`);
  }

  /**
   * Get recommendations by run ID
   */
  async getRecommendationsByRun(runId: string): Promise<Recommendation[]> {
    const { data, error } = await this.supabase
      .from("recommendations")
      .select("*")
      .eq("run_id", runId)
      .order("created_at");

    if (error) {
      this.logger.error(`Failed to get recommendations: ${error.message}`);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      instrument: row.instrument,
      action: row.action,
      timingWindow: row.timing_window,
      entryStyle: row.entry_style,
      intendedPrice: row.intended_price,
      sizing: row.sizing_json,
      rationale: row.rationale,
      marketContext: row.market_context,
      agendaContext: row.agenda_context,
      modelMetadata: row.model_metadata,
    }));
  }

  /**
   * Get recent market bars for instruments
   */
  async getRecentMarketBars(
    instruments: string[],
    since: string,
  ): Promise<MarketBar[]> {
    const { data, error } = await this.supabase
      .from("market_bars")
      .select("*")
      .in("instrument", instruments)
      .gte("ts", since)
      .order("ts", { ascending: false });

    if (error) {
      this.logger.error(`Failed to get market bars: ${error.message}`);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      instrument: row.instrument,
      ts: row.ts,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
      vendor: row.vendor,
    }));
  }

  /**
   * Get recent news items
   */
  async getRecentNewsItems(since: string): Promise<NewsItem[]> {
    const { data, error } = await this.supabase
      .from("news_items")
      .select("*")
      .gte("published_at", since)
      .order("published_at", { ascending: false })
      .limit(100);

    if (error) {
      this.logger.error(`Failed to get news items: ${error.message}`);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      source: row.source,
      publishedAt: row.published_at,
      url: row.url,
      title: row.title,
      snippet: row.snippet,
    }));
  }

  /**
   * Get pending recommendations (without outcomes)
   */
  async getPendingRecommendations(lookbackHours: number = 48): Promise<
    Array<{
      id: string;
      run_id: string;
      instrument: string;
      action: string;
      timing_window: string;
      intended_price?: number;
      rationale: string;
      created_at: string;
    }>
  > {
    const since = new Date(
      Date.now() - lookbackHours * 60 * 60 * 1000,
    ).toISOString();

    // Get recommendations that don't have outcomes yet
    const { data, error } = await this.supabase
      .from("recommendations")
      .select(
        `
        id,
        run_id,
        instrument,
        action,
        timing_window,
        intended_price,
        rationale,
        created_at
      `,
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    if (error) {
      this.logger.error(
        `Failed to get pending recommendations: ${error.message}`,
      );
      return [];
    }

    // Filter out recommendations that already have outcomes
    const recommendationIds = (data || []).map((r) => r.id);
    if (recommendationIds.length === 0) {
      return [];
    }

    const { data: outcomes } = await this.supabase
      .from("recommendation_outcomes")
      .select("recommendation_id")
      .in("recommendation_id", recommendationIds);

    const evaluatedIds = new Set(
      (outcomes || []).map((o) => o.recommendation_id),
    );

    return (data || []).filter((r) => !evaluatedIds.has(r.id));
  }

  /**
   * Store recommendation outcome
   */
  async storeOutcome(outcome: {
    id: string;
    recommendationId: string;
    realizedReturnMetrics: Record<string, number>;
    winLoss: "win" | "loss" | "neutral";
    evaluationNotes: string;
    evaluatedAt: string;
  }): Promise<void> {
    const { error } = await this.supabase
      .from("recommendation_outcomes")
      .insert({
        id: outcome.id,
        recommendation_id: outcome.recommendationId,
        realized_return_metrics_json: outcome.realizedReturnMetrics,
        win_loss: outcome.winLoss,
        evaluation_notes: outcome.evaluationNotes,
        evaluated_at: outcome.evaluatedAt,
      });

    if (error) {
      this.logger.error(`Failed to store outcome: ${error.message}`);
      throw new Error(`Failed to store outcome: ${error.message}`);
    }

    this.logger.log(
      `Stored outcome for recommendation ${outcome.recommendationId}`,
    );
  }

  /**
   * Store postmortem analysis
   */
  async storePostmortem(postmortem: {
    id: string;
    recommendationId: string;
    whatHappened: string;
    whyItHappened: string;
    linkedAgendaEvents: string[];
    lessons: string[];
  }): Promise<void> {
    const { error } = await this.supabase.from("postmortems").insert({
      id: postmortem.id,
      recommendation_id: postmortem.recommendationId,
      what_happened: postmortem.whatHappened,
      why_it_happened: postmortem.whyItHappened,
      links_to_agenda_events: postmortem.linkedAgendaEvents,
      lessons: postmortem.lessons,
    });

    if (error) {
      this.logger.error(`Failed to store postmortem: ${error.message}`);
      throw new Error(`Failed to store postmortem: ${error.message}`);
    }

    this.logger.log(
      `Stored postmortem for recommendation ${postmortem.recommendationId}`,
    );
  }

  /**
   * Get recent postmortems for learning context
   */
  async getRecentPostmortems(
    instruments: string[],
    limit: number = 10,
  ): Promise<
    Array<{
      id: string;
      recommendation_id: string;
      what_happened: string;
      why_it_happened: string;
      lessons: string[];
      instrument: string;
      action: string;
      win_loss: string;
    }>
  > {
    // Join postmortems with recommendations and outcomes
    const { data, error } = await this.supabase
      .from("postmortems")
      .select(
        `
        id,
        recommendation_id,
        what_happened,
        why_it_happened,
        lessons,
        recommendations!inner(instrument, action),
        recommendation_outcomes!inner(win_loss)
      `,
      )
      .in("recommendations.instrument", instruments)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.error(`Failed to get postmortems: ${error.message}`);
      return [];
    }

    return (data || []).map((row) => {
      // The joined data may be returned as arrays (many-to-one), extract first item
      const rec = Array.isArray(row.recommendations)
        ? row.recommendations[0]
        : row.recommendations;
      const outcome = Array.isArray(row.recommendation_outcomes)
        ? row.recommendation_outcomes[0]
        : row.recommendation_outcomes;

      return {
        id: row.id,
        recommendation_id: row.recommendation_id,
        what_happened: row.what_happened,
        why_it_happened: row.why_it_happened,
        lessons: row.lessons || [],
        instrument: (rec as { instrument: string })?.instrument || "",
        action: (rec as { action: string })?.action || "",
        win_loss: (outcome as { win_loss: string })?.win_loss || "",
      };
    });
  }
}
