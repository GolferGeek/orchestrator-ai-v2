import { StateGraph, END } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
import { v4 as uuidv4 } from "uuid";
import {
  FinanceStateAnnotation,
  FinanceState,
  MarketBar,
  NewsItem,
  AgendaEvent,
  Recommendation,
} from "./finance.state";
import { LLMHttpClientService } from "../../services/llm-http-client.service";
import { ObservabilityService } from "../../services/observability.service";
import { PostgresCheckpointerService } from "../../persistence/postgres-checkpointer.service";
import { FinanceDbService } from "./finance-db.service";
import {
  createMarketDataChain,
  createNewsChain,
  MarketDataConnectorChain,
  NewsConnectorChain,
} from "./connectors";

const AGENT_SLUG = "finance-research";

/**
 * Create the Finance workflow graph
 *
 * Flow:
 * 1. Initialize → Load universe config, create run record
 * 2. Ingest Market Data → Fetch/store recent market bars
 * 3. Ingest News → Fetch/store recent news items
 * 4. Extract Agenda → LLM-based narrative/manipulation extraction
 * 5. Build Features → Derive technical + agenda features
 * 6. Generate Recommendations → Multi-timing buy/sell/hold decisions
 * 7. Write Recommendations → Persist to database
 * 8. Complete → Done
 */
export function createFinanceGraph(
  llmClient: LLMHttpClientService,
  observability: ObservabilityService,
  checkpointer: PostgresCheckpointerService,
  financeDb: FinanceDbService,
  marketDataConnector?: MarketDataConnectorChain,
  newsConnector?: NewsConnectorChain,
) {
  // Initialize connectors with fallback chains
  const marketChain = marketDataConnector || createMarketDataChain();
  const newsChain = newsConnector || createNewsChain();
  // Node: Initialize workflow
  async function initializeNode(
    state: FinanceState,
  ): Promise<Partial<FinanceState>> {
    const ctx = state.executionContext;

    await observability.emitStarted(
      ctx,
      ctx.taskId,
      `Starting Finance Research workflow for universe ${state.universeVersionId}`,
    );

    // Load universe version config
    const universeVersion = await financeDb.getUniverseVersion(
      state.universeVersionId,
    );

    if (!universeVersion) {
      return {
        phase: "failed",
        error: `Universe version not found: ${state.universeVersionId}`,
        completedAt: Date.now(),
      };
    }

    // Create recommendation run
    const run = await financeDb.createRecommendationRun(
      state.universeVersionId,
      ctx.taskId,
      AGENT_SLUG,
      state.runTs,
    );

    await observability.emitProgress(ctx, ctx.taskId, "Workflow initialized", {
      step: "initialized",
      progress: 5,
      metadata: {
        runId: run.id,
        instruments: universeVersion.config.instruments.length,
      },
    });

    return {
      runId: run.id,
      instruments: universeVersion.config.instruments,
      phase: "ingesting_market_data",
      startedAt: Date.now(),
    };
  }

  // Node: Ingest market data
  async function ingestMarketDataNode(
    state: FinanceState,
  ): Promise<Partial<FinanceState>> {
    const ctx = state.executionContext;

    await observability.emitProgress(ctx, ctx.taskId, "Ingesting market data", {
      step: "ingest_market_data",
      progress: 15,
    });

    const symbols = state.instruments.map((i) => i.symbol);
    const lookbackMs = state.lookbackDays * 24 * 60 * 60 * 1000;
    const since = new Date(Date.now() - lookbackMs).toISOString();

    // First check database for existing data
    let marketData = await financeDb.getRecentMarketBars(symbols, since);

    // If no data in database, fetch from connectors
    if (marketData.length === 0) {
      await observability.emitProgress(
        ctx,
        ctx.taskId,
        "Fetching market data from external sources",
        {
          step: "fetch_market_data",
          progress: 18,
        },
      );

      try {
        // Use connector chain (tries Yahoo, then Alpha Vantage, then mock)
        marketData = await marketChain.fetchBars(symbols, since);

        // Store fetched data in database for future runs
        if (marketData.length > 0) {
          await financeDb.storeMarketBars(marketData);
        }
      } catch (error) {
        // Log error but continue - recommendations can still be made with partial data
        console.error("Market data ingestion error:", error);
      }
    }

    await observability.emitProgress(
      ctx,
      ctx.taskId,
      `Ingested ${marketData.length} market bars from ${marketData.length > 0 ? marketData[0].vendor : "none"}`,
      {
        step: "market_data_ingested",
        progress: 25,
        metadata: {
          barCount: marketData.length,
          instrumentCount: new Set(marketData.map((b) => b.instrument)).size,
        },
      },
    );

    return {
      marketData,
      phase: "ingesting_news",
    };
  }

  // Node: Ingest news
  async function ingestNewsNode(
    state: FinanceState,
  ): Promise<Partial<FinanceState>> {
    const ctx = state.executionContext;

    await observability.emitProgress(ctx, ctx.taskId, "Ingesting news items", {
      step: "ingest_news",
      progress: 35,
    });

    // Look back 24-48 hours for news (news is more time-sensitive than market data)
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    // First check database for existing news
    let newsItems = await financeDb.getRecentNewsItems(since);

    // If no news in database, fetch from connectors
    if (newsItems.length === 0) {
      await observability.emitProgress(
        ctx,
        ctx.taskId,
        "Fetching news from external sources",
        {
          step: "fetch_news",
          progress: 38,
        },
      );

      try {
        // Use connector chain (tries RSS feeds, then mock)
        const symbols = state.instruments.map((i) => i.symbol);
        newsItems = await newsChain.fetchNewsForInstruments(symbols, since);

        // Store fetched news in database
        if (newsItems.length > 0) {
          await financeDb.storeNewsItems(newsItems);
        }
      } catch (error) {
        // Log error but continue - agenda extraction can be skipped if no news
        console.error("News ingestion error:", error);
      }
    }

    await observability.emitProgress(
      ctx,
      ctx.taskId,
      `Ingested ${newsItems.length} news items from ${newsItems.length > 0 ? newsItems[0].source : "none"}`,
      {
        step: "news_ingested",
        progress: 45,
        metadata: {
          newsCount: newsItems.length,
          sources: [...new Set(newsItems.map((n) => n.source))],
        },
      },
    );

    return {
      newsItems,
      phase: "extracting_agenda",
    };
  }

  // Node: Extract agenda signals
  async function extractAgendaNode(
    state: FinanceState,
  ): Promise<Partial<FinanceState>> {
    const ctx = state.executionContext;

    await observability.emitProgress(
      ctx,
      ctx.taskId,
      "Extracting agenda signals from news",
      {
        step: "extract_agenda",
        progress: 55,
      },
    );

    if (state.newsItems.length === 0) {
      return {
        agendaEvents: [],
        phase: "building_features",
      };
    }

    // Build prompt for agenda extraction
    const newsContext = state.newsItems
      .map((n) => `[${n.publishedAt}] ${n.title}: ${n.snippet}`)
      .join("\n\n");

    const systemMessage = `You are a financial narrative analyst. Your task is to extract potential market manipulation signals, hidden agendas, and coordinated narratives from news items.

For each significant narrative pattern you detect, provide:
1. A concise description of the narrative
2. The suspected incentive (who benefits and how)
3. Target instruments likely to be affected
4. Confidence level (0-1)
5. Evidence from the news items

Format your response as JSON array of objects with fields: narrative, suspectedIncentive, targetInstruments (array), confidence, evidence.`;

    const userMessage = `Analyze these recent financial news items and extract any potential agenda/manipulation signals:

${newsContext}

Instruments in universe: ${state.instruments.map((i) => i.symbol).join(", ")}`;

    try {
      const response = await llmClient.callLLM({
        context: ctx,
        systemMessage,
        userMessage,
        temperature: 0.3,
        callerName: `${AGENT_SLUG}:extract_agenda`,
      });

      // Parse LLM response
      let agendaEvents: AgendaEvent[] = [];
      try {
        const parsed = JSON.parse(response.text);
        agendaEvents = (Array.isArray(parsed) ? parsed : [parsed]).map(
          (item) => ({
            id: uuidv4(),
            asofTs: new Date().toISOString(),
            narrative: item.narrative || "",
            suspectedIncentive: item.suspectedIncentive || "",
            targetInstruments: item.targetInstruments || [],
            confidence: item.confidence || 0.5,
            evidence: item.evidence || {},
          }),
        );
      } catch (parseError) {
        // If JSON parsing fails, create a single agenda event with the raw response
        agendaEvents = [
          {
            id: uuidv4(),
            asofTs: new Date().toISOString(),
            narrative: "General market sentiment analysis",
            suspectedIncentive: response.text.substring(0, 200),
            targetInstruments: state.instruments.map((i) => i.symbol),
            confidence: 0.3,
            evidence: { rawResponse: response.text },
          },
        ];
      }

      // Store agenda events
      if (agendaEvents.length > 0) {
        await financeDb.storeAgendaEvents(agendaEvents);
      }

      await observability.emitProgress(
        ctx,
        ctx.taskId,
        `Extracted ${agendaEvents.length} agenda signals`,
        {
          step: "agenda_extracted",
          progress: 65,
        },
      );

      return {
        agendaEvents,
        phase: "building_features",
      };
    } catch (error) {
      // Non-fatal error - continue without agenda signals
      await observability.emitProgress(
        ctx,
        ctx.taskId,
        "Agenda extraction failed, continuing without signals",
        {
          step: "agenda_extraction_failed",
          progress: 65,
        },
      );

      return {
        agendaEvents: [],
        phase: "building_features",
      };
    }
  }

  // Node: Build features
  async function buildFeaturesNode(
    state: FinanceState,
  ): Promise<Partial<FinanceState>> {
    const ctx = state.executionContext;

    await observability.emitProgress(ctx, ctx.taskId, "Building features", {
      step: "build_features",
      progress: 75,
    });

    // TODO: Implement actual feature engineering
    // For now, create simple features from market data
    const marketFeatures: Record<string, unknown> = {};
    const agendaFeatures: Record<string, unknown> = {};

    // Simple market features: price changes, volatility
    for (const instrument of state.instruments) {
      const bars = state.marketData.filter(
        (b) => b.instrument === instrument.symbol,
      );
      if (bars.length > 0) {
        const latestBar = bars[0];
        const priceChange =
          bars.length > 1
            ? ((latestBar.close - bars[1].close) / bars[1].close) * 100
            : 0;

        marketFeatures[instrument.symbol] = {
          latestPrice: latestBar.close,
          priceChange,
          volume: latestBar.volume,
          volatility: (latestBar.high - latestBar.low) / latestBar.close,
        };
      }
    }

    // Agenda features: sentiment by instrument
    for (const instrument of state.instruments) {
      const relatedEvents = state.agendaEvents.filter((e) =>
        e.targetInstruments.includes(instrument.symbol),
      );

      agendaFeatures[instrument.symbol] = {
        narrativeCount: relatedEvents.length,
        avgConfidence:
          relatedEvents.length > 0
            ? relatedEvents.reduce((sum, e) => sum + e.confidence, 0) /
              relatedEvents.length
            : 0,
        narratives: relatedEvents.map((e) => e.narrative),
      };
    }

    await observability.emitProgress(
      ctx,
      ctx.taskId,
      "Features built successfully",
      {
        step: "features_built",
        progress: 85,
      },
    );

    return {
      marketFeatures,
      agendaFeatures,
      phase: "generating_recommendations",
    };
  }

  // Node: Generate recommendations
  async function generateRecommendationsNode(
    state: FinanceState,
  ): Promise<Partial<FinanceState>> {
    const ctx = state.executionContext;

    await observability.emitProgress(
      ctx,
      ctx.taskId,
      "Generating recommendations",
      {
        step: "generate_recommendations",
        progress: 90,
      },
    );

    // Build context for LLM
    const marketContext = Object.entries(state.marketFeatures)
      .map(([symbol, features]) => `${symbol}: ${JSON.stringify(features)}`)
      .join("\n");

    const agendaContext = Object.entries(state.agendaFeatures)
      .map(([symbol, features]) => `${symbol}: ${JSON.stringify(features)}`)
      .join("\n");

    const systemMessage = `You are a financial research analyst generating buy/sell/hold recommendations based on market data and narrative analysis.

Consider both:
1. Market features (price, volume, volatility)
2. Agenda signals (narratives, manipulation patterns)

Generate recommendations for multiple timing windows: pre_close, post_close, pre_open, intraday.

For each instrument, provide:
- action: buy, sell, or hold
- timingWindow: when to execute
- entryStyle: market, limit, or conditional
- intendedPrice: target price (if applicable)
- rationale: brief explanation combining market and narrative factors

Format your response as JSON array of recommendation objects.`;

    const userMessage = `Generate multi-timing recommendations for these instruments:

Market Features:
${marketContext}

Agenda Features:
${agendaContext}

Provide recommendations for timing windows: pre_close, post_close, pre_open, intraday.`;

    try {
      const response = await llmClient.callLLM({
        context: ctx,
        systemMessage,
        userMessage,
        temperature: 0.5,
        callerName: `${AGENT_SLUG}:generate_recommendations`,
      });

      // Parse recommendations
      let recommendations: Recommendation[] = [];
      try {
        const parsed = JSON.parse(response.text);
        recommendations = (Array.isArray(parsed) ? parsed : [parsed]).map(
          (item) => ({
            id: uuidv4(),
            instrument: item.instrument || "",
            action: item.action || "hold",
            timingWindow: item.timingWindow || "intraday",
            entryStyle: item.entryStyle || "market",
            intendedPrice: item.intendedPrice,
            sizing: item.sizing,
            rationale: item.rationale || "",
            marketContext: state.marketFeatures[item.instrument],
            agendaContext: state.agendaFeatures[item.instrument],
            modelMetadata: {
              provider: ctx.provider,
              model: ctx.model,
              tokensUsed: response.usage?.totalTokens,
            },
          }),
        );
      } catch (parseError) {
        // If parsing fails, generate default hold recommendations
        recommendations = state.instruments.map((instrument) => ({
          id: uuidv4(),
          instrument: instrument.symbol,
          action: "hold" as const,
          timingWindow: "intraday" as const,
          entryStyle: "market",
          rationale: "Default recommendation due to parsing error",
          modelMetadata: {
            parseError: String(parseError),
          },
        }));
      }

      await observability.emitProgress(
        ctx,
        ctx.taskId,
        `Generated ${recommendations.length} recommendations`,
        {
          step: "recommendations_generated",
          progress: 95,
        },
      );

      return {
        recommendations,
        phase: "writing_recommendations",
      };
    } catch (error) {
      return {
        phase: "failed",
        error: `Failed to generate recommendations: ${error instanceof Error ? error.message : String(error)}`,
        completedAt: Date.now(),
      };
    }
  }

  // Node: Write recommendations to database
  async function writeRecommendationsNode(
    state: FinanceState,
  ): Promise<Partial<FinanceState>> {
    const ctx = state.executionContext;

    await observability.emitProgress(
      ctx,
      ctx.taskId,
      "Writing recommendations to database",
      {
        step: "write_recommendations",
        progress: 98,
      },
    );

    try {
      await financeDb.storeRecommendations(state.runId, state.recommendations);
      await financeDb.updateRunStatus(state.runId, "completed");

      await observability.emitCompleted(ctx, ctx.taskId, {
        runId: state.runId,
        recommendationCount: state.recommendations.length,
      });

      return {
        phase: "completed",
        completedAt: Date.now(),
        messages: [
          ...state.messages,
          new AIMessage(
            `Finance research completed! Generated ${state.recommendations.length} recommendations.`,
          ),
        ],
      };
    } catch (error) {
      return {
        phase: "failed",
        error: `Failed to write recommendations: ${error instanceof Error ? error.message : String(error)}`,
        completedAt: Date.now(),
      };
    }
  }

  // Node: Handle errors
  async function handleErrorNode(
    state: FinanceState,
  ): Promise<Partial<FinanceState>> {
    const ctx = state.executionContext;

    if (state.runId) {
      await financeDb.updateRunStatus(state.runId, "failed");
    }

    await observability.emitFailed(
      ctx,
      ctx.taskId,
      state.error || "Unknown error",
      Date.now() - state.startedAt,
    );

    return {
      phase: "failed",
      completedAt: Date.now(),
    };
  }

  // Build the graph
  const graph = new StateGraph(FinanceStateAnnotation)
    .addNode("initialize", initializeNode)
    .addNode("ingest_market_data", ingestMarketDataNode)
    .addNode("ingest_news", ingestNewsNode)
    .addNode("extract_agenda", extractAgendaNode)
    .addNode("build_features", buildFeaturesNode)
    .addNode("generate_recommendations", generateRecommendationsNode)
    .addNode("write_recommendations", writeRecommendationsNode)
    .addNode("handle_error", handleErrorNode)
    // Edges
    .addEdge("__start__", "initialize")
    .addConditionalEdges("initialize", (state) => {
      if (state.error || state.phase === "failed") return "handle_error";
      return "ingest_market_data";
    })
    .addEdge("ingest_market_data", "ingest_news")
    .addEdge("ingest_news", "extract_agenda")
    .addEdge("extract_agenda", "build_features")
    .addEdge("build_features", "generate_recommendations")
    .addConditionalEdges("generate_recommendations", (state) => {
      if (state.error || state.phase === "failed") return "handle_error";
      return "write_recommendations";
    })
    .addEdge("write_recommendations", END)
    .addEdge("handle_error", END);

  // Compile with checkpointer
  return graph.compile({
    checkpointer: checkpointer.getSaver(),
  });
}

export type FinanceGraph = ReturnType<typeof createFinanceGraph>;
