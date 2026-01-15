# PRD: Market Prediction Runner Architecture

## Overview

This PRD defines a **generic prediction engine** architecture that supports multiple market domains (stocks, crypto, prediction markets) through a shared runner framework with domain-specific subclasses. This replaces the monolithic Finance Agent approach with a modular, extensible runner-based architecture.

### Core Philosophy

> "Universe = Agent. Each prediction universe is an agent with its own configuration, context, and learning history."

The prediction runner follows the same patterns as RAG Runner and API Runner - it lives in the API app, extends a base class, and is configured via agent definitions stored in the database.

---

## Problem Statements

### P1: Monolithic Domain Lock-in
The current Finance Agent is tightly coupled to stock market concepts. Extending to crypto or prediction markets requires duplicating large amounts of code.

### P2: Code in Wrong Location
LangGraph workflow code for predictions lives in the LangGraph app, but prediction runners should follow the same pattern as RAG runners - living in the API app with LangGraph as an embedded dependency.

### P3: Universe vs Agent Confusion
The current "universe" concept is really an "agent" - it has its own configuration, context, instruments, and learning history. This should be modeled as agents in the `agents` table.

### P4: Non-Reusable Pipeline Components
Pre-filter, triage, specialists, evaluators, and packaging stages are conceptually the same across domains but implemented as domain-specific code instead of configurable components.

---

## Architecture Overview

### Runner Hierarchy

```
apps/api/src/agent2agent/runners/prediction/
├── base/
│   ├── base-prediction-runner.service.ts    # Abstract base with LangGraph embedded
│   ├── base-prediction.state.ts             # Generic state annotation
│   ├── base-prediction.graph.ts             # The StateGraph definition
│   ├── base-prediction.types.ts             # Shared interfaces (Claim, Source, Datapoint)
│   ├── postgres-checkpointer.service.ts     # Copied from langgraph app
│   ├── nodes/
│   │   ├── poll-data.node.ts                # Run all tools, aggregate into datapoint
│   │   ├── pre-filter.node.ts               # Rule-based filtering (no LLM)
│   │   ├── triage.node.ts                   # 4 triage agents
│   │   ├── specialists.node.ts              # N specialists in parallel
│   │   ├── evaluators.node.ts               # 5 red team evaluators
│   │   └── package-output.node.ts           # Risk profile packaging
│   └── services/
│       ├── prediction-db.service.ts         # Datapoints + predictions DB ops
│       ├── learning-context.service.ts
│       ├── outcome-evaluation.service.ts
│       ├── postmortem.service.ts
│       └── missed-opportunity.service.ts
│
├── stock-predictor/
│   ├── stock-predictor-runner.service.ts    # extends BasePredictionRunner
│   ├── stock-predictor.module.ts
│   └── tools/                               # LangGraph tools = domain differentiator
│       ├── yahoo-finance.tool.ts            # Returns Source with claims
│       ├── alpha-vantage.tool.ts
│       ├── bloomberg-news.tool.ts
│       ├── reuters-rss.tool.ts
│       └── sec-filings.tool.ts
│
├── crypto-predictor/
│   ├── crypto-predictor-runner.service.ts   # extends BasePredictionRunner
│   ├── crypto-predictor.module.ts
│   └── tools/
│       ├── binance.tool.ts
│       ├── coingecko.tool.ts
│       ├── etherscan.tool.ts
│       ├── whale-alerts.tool.ts
│       └── defillama.tool.ts
│
├── market-predictor/
│   ├── market-predictor-runner.service.ts   # extends BasePredictionRunner (Polymarket)
│   ├── market-predictor.module.ts
│   └── tools/
│       ├── polymarket-odds.tool.ts
│       ├── gamma-api.tool.ts
│       ├── resolution-tracker.tool.ts
│       └── news-api.tool.ts
│
└── election-predictor/                      # Easy to add new domains!
    ├── election-predictor-runner.service.ts
    ├── election-predictor.module.ts
    └── tools/
        ├── polling-avg.tool.ts
        ├── prediction-markets.tool.ts
        ├── campaign-finance.tool.ts
        ├── early-voting.tool.ts
        └── demographics.tool.ts
```

### Key Design Decisions

1. **LangGraph in API**: Prediction runners embed LangGraph StateGraph directly in the API app, not as HTTP calls to the LangGraph app
2. **Tools as Differentiator**: Each runner type has its own set of LangGraph tools - this is what makes domains different
3. **Simplified Agent Config**: Agents are just runner + instruments + optional overrides (complexity lives in runner)
4. **Unified Datapoint Model**: One datapoint per poll cycle, containing all sources and claims as JSONB
5. **Claims-Based Data**: All data (numeric and extracted) flows as structured claims, not rigid schemas
6. **Learning Loop Updates Config**: HITL sessions can update agent's `config_json` with new lessons

---

## Data Tools Architecture

### Tools = Domain Differentiator

Each runner type has its own set of LangGraph tools. The tools are what make domains different - everything else (pipeline, triage, specialists, evaluators) is shared.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SHARED PIPELINE                                    │
│  (Base Runner: triage, specialists, evaluators, packaging, learning loop)   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┬───────────────┐
                    │               │               │               │
                    ▼               ▼               ▼               ▼
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│  STOCK TOOLS        │ │  CRYPTO TOOLS       │ │  POLYMARKET TOOLS   │ │  ELECTION TOOLS     │
├─────────────────────┤ ├─────────────────────┤ ├─────────────────────┤ ├─────────────────────┤
│ • yahoo_finance     │ │ • binance           │ │ • polymarket_odds   │ │ • polling_avg       │
│ • alpha_vantage     │ │ • coingecko         │ │ • gamma_api         │ │ • prediction_mkts   │
│ • bloomberg_news    │ │ • etherscan         │ │ • resolution_track  │ │ • campaign_finance  │
│ • reuters_rss       │ │ • whale_alerts      │ │ • news_api          │ │ • early_voting      │
│ • sec_filings       │ │ • defillama         │ │                     │ │ • demographics      │
└─────────────────────┘ └─────────────────────┘ └─────────────────────┘ └─────────────────────┘
```

### Adding a New Domain = New Tools

To add elections support:
1. Create `ElectionPredictorRunner` extending base
2. Implement election tools (polling_avg, prediction_markets, etc.)
3. Register agents with `runner: 'election-predictor'`

The specialists and evaluators work the same way - they just analyze different datapoints.

---

## Data Sources Specification

### Required vs Optional Runners

| Runner | Status | Phase | Rationale |
|--------|--------|-------|-----------|
| `stock-predictor` | **Required** | Phase 1 | Core use case, existing connectors |
| `crypto-predictor` | **Required** | Phase 5 | Free APIs available, different market dynamics |
| `market-predictor` | **Required** | Phase 5 | Polymarket API is free, unique prediction market data |
| `election-predictor` | Optional | Future | Subset of market-predictor, adds polling data |

### Stock Domain Data Sources

**Primary: Yahoo Finance** (FREE, no API key)
- Endpoint: `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}`
- Rate Limit: ~2000 requests/hour (unofficial)
- Data: OHLCV, real-time quotes (15-min delay)
- Already implemented: `apps/langgraph/src/agents/finance/connectors/yahoo-finance.connector.ts`

**Secondary: Alpha Vantage** (FREE tier, API key required)
- Endpoint: `https://www.alphavantage.co/query`
- Rate Limit: 5 calls/min, 500 calls/day (free tier)
- Data: TIME_SERIES_DAILY, GLOBAL_QUOTE
- Env: `ALPHA_VANTAGE_API_KEY`
- Already implemented: `apps/langgraph/src/agents/finance/connectors/alpha-vantage.connector.ts`

**News: RSS Feeds** (FREE)
- Bloomberg: `https://feeds.bloomberg.com/markets/news.rss`
- Reuters: `https://www.reutersagency.com/feed/`
- Yahoo Finance News: Built into Yahoo connector

**Initial Instruments (Phase 1 test set)**:
```
AAPL, MSFT, GOOGL, NVDA, META, AMZN, TSLA
```

### Crypto Domain Data Sources

**Primary: CoinGecko** (FREE, no API key for basic)
- Endpoint: `https://api.coingecko.com/api/v3/simple/price`
- Rate Limit: 10-50 calls/min (free tier)
- Data: Price, market cap, 24h volume, 24h change
- No API key required for basic endpoints

```typescript
// Example CoinGecko call
const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true';
```

**Secondary: Binance** (FREE, API key optional)
- Endpoint: `https://api.binance.com/api/v3/ticker/24hr`
- Rate Limit: 1200 requests/min
- Data: Real-time price, volume, bid/ask
- No API key for public market data

```typescript
// Example Binance call
const url = 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT';
```

**On-Chain: Etherscan** (FREE tier, API key required)
- Endpoint: `https://api.etherscan.io/api`
- Rate Limit: 5 calls/sec (free tier)
- Data: Whale transactions, gas prices
- Env: `ETHERSCAN_API_KEY`

**Initial Instruments (Phase 5 test set)**:
```
BTC, ETH, SOL, AVAX, LINK
```

### Polymarket Domain Data Sources

> **NEW (Oct 2025)**: Polymarket launched "Up/Down Equity Markets" in their new Finance section,
> allowing users to bet on whether stock prices finish higher or lower by a set time. This uses
> WSJ and Nasdaq as resolution sources. Categories include: Equities, Earnings, Indices,
> Commodities, Acquisitions, IPOs, Fed Rates, Business, Treasuries.
>
> See: [The Block - Polymarket launches up/down equity markets](https://www.theblock.co/post/374825/polymarket-launches-up-down-equity-markets-letting-users-bet-on-stock-prices)

**Primary: Polymarket CLOB API** (FREE, no auth for read)
- Base URL: `https://clob.polymarket.com`
- Endpoints (no authentication required):
  - `GET /book` - Order book for token
  - `GET /price` - Current price/odds
  - `GET /prices-history` - Historical prices
  - `GET /midpoint` - Midpoint price

```typescript
// Example Polymarket calls
const priceUrl = 'https://clob.polymarket.com/price?token_id={token_id}&side=buy';
const historyUrl = 'https://clob.polymarket.com/prices-history?market={market_id}&interval=1d';
```

**Market Discovery: Gamma API**
- Endpoint: `https://gamma-api.polymarket.com/markets`
- Data: Active markets, categories, resolution status
- No authentication required
- Finance category filter: `?category=finance`

**Finance Section Categories** (New Oct 2025):
| Category | Description | Resolution Source |
|----------|-------------|-------------------|
| Equities | Up/down bets on individual stocks | WSJ, Nasdaq |
| Earnings | Corporate earnings beat/miss | Company reports |
| Indices | S&P 500, Dow, Nasdaq movements | WSJ, Nasdaq |
| Commodities | Gold, oil price targets | WSJ |
| Fed Rates | Interest rate decisions | Federal Reserve |
| Treasuries | Bond yield movements | WSJ |
| IPOs | IPO pricing and timing | SEC filings |
| Acquisitions | M&A completion bets | Company announcements |

**Initial Markets (Phase 5 test set)**:
```
General Prediction Markets:
- Presidential Election 2028
- Fed Rate Decision (next meeting)
- S&P 500 Year-End Target

Finance Section (New):
- AAPL Up/Down by EOD Friday
- NVDA Earnings Beat/Miss Q1 2026
- S&P 500 > 6000 by end of month
```

### Cross-Domain Synergy: Polymarket Finance + Stock Predictor

The Polymarket Finance section creates a powerful synergy with our Stock Predictor:

1. **Market Sentiment Signal**: Polymarket equity odds provide crowd-sourced sentiment
2. **Calibration Data**: Compare our predictions to Polymarket consensus
3. **Resolution Verification**: Polymarket uses WSJ/Nasdaq as ground truth - same sources we use

```typescript
// Example: Enhance stock prediction with Polymarket sentiment
interface EnhancedStockDatapoint extends Datapoint {
  polymarketSentiment?: {
    marketId: string;
    upProbability: number;  // 0-1 (e.g., 0.65 = 65% think stock goes up)
    volume24h: number;
    lastUpdated: string;
  };
}
```

**Implementation Note**: The `market-predictor` can query Polymarket Finance section for stock-related markets, providing an additional data source for the `stock-predictor` through shared tooling.

### Environment Variables Summary

```bash
# Stock Predictor (Phase 1)
ALPHA_VANTAGE_API_KEY=your_key_here  # Optional, enhances data

# Crypto Predictor (Phase 5)
ETHERSCAN_API_KEY=your_key_here      # Optional, for on-chain data

# Polymarket Predictor (Phase 5)
# No API keys required for read-only access
```

### Data Source Fallback Strategy

Each domain tool should implement fallbacks:

```typescript
// Example: Stock price with fallback
async getPrice(symbol: string): Promise<PriceData> {
  // Try Yahoo first (no rate limit issues)
  try {
    return await this.yahooFinance.getQuote(symbol);
  } catch (e) {
    this.logger.warn(`Yahoo failed for ${symbol}, trying Alpha Vantage`);
  }

  // Fallback to Alpha Vantage
  if (this.alphaVantageConfigured) {
    return await this.alphaVantage.getQuote(symbol);
  }

  throw new Error(`No data source available for ${symbol}`);
}
```

---

## Tool Directory Structure

### Each Domain Has Its Own Tools Directory

Tools are the **differentiator** between domains. Each domain runner has a `tools/` directory with one file per data source:

```
apps/api/src/agent2agent/runners/prediction/
│
├── stock-predictor/
│   ├── stock-predictor-runner.service.ts
│   ├── stock-predictor.module.ts
│   └── tools/
│       ├── index.ts                    # Barrel export + registration
│       ├── base-tool.ts                # Shared tool interface
│       ├── yahoo-finance.tool.ts       # One file per source
│       ├── alpha-vantage.tool.ts
│       ├── bloomberg-news.tool.ts
│       ├── reuters-rss.tool.ts
│       ├── sec-filings.tool.ts
│       ├── finviz-screener.tool.ts
│       └── polymarket-sentiment.tool.ts # NEW: Equity up/down odds from Polymarket Finance
│
├── crypto-predictor/
│   └── tools/
│       ├── index.ts
│       ├── base-tool.ts
│       ├── binance.tool.ts
│       ├── coingecko.tool.ts
│       ├── etherscan.tool.ts
│       ├── whale-alerts.tool.ts
│       ├── defillama.tool.ts
│       └── messari.tool.ts             # New tools = new files
│
└── market-predictor/
    └── tools/
        ├── index.ts
        ├── base-tool.ts
        ├── polymarket-odds.tool.ts        # General prediction market odds
        ├── polymarket-finance.tool.ts     # NEW: Equity up/down, earnings, indices
        ├── gamma-api.tool.ts              # Market discovery
        ├── resolution-tracker.tool.ts
        └── news-api.tool.ts
```

### Tool Interface

Every tool implements the same interface - returns a `Source` with `Claim[]`:

```typescript
// base-tool.ts
export interface PredictionTool {
  name: string;
  description: string;

  /**
   * Execute the tool for given instruments
   * Returns a Source with claims
   */
  execute(instruments: string[]): Promise<Source>;
}

export interface Source {
  tool: string;
  article_url?: string;
  article_title?: string;
  published_at?: string;
  claims: Claim[];
}

export interface Claim {
  subject: string;           // Instrument: 'MSFT', 'BTC', etc.
  type: string;              // 'price', 'price_target', 'rating', 'volume', etc.
  value?: number | string;
  previous?: number | string;
  change?: number;
  direction?: 'up' | 'down' | 'neutral';
  timeframe?: string;
  reason?: string;
  source_url?: string;
}
```

### Example Tool Implementation

```typescript
// yahoo-finance.tool.ts
import { Injectable, Logger } from '@nestjs/common';
import { PredictionTool, Source, Claim } from './base-tool';

@Injectable()
export class YahooFinanceTool implements PredictionTool {
  private readonly logger = new Logger(YahooFinanceTool.name);

  name = 'yahoo_finance';
  description = 'Fetches real-time price data from Yahoo Finance';

  async execute(instruments: string[]): Promise<Source> {
    const claims: Claim[] = [];

    for (const symbol of instruments) {
      try {
        const quote = await this.fetchQuote(symbol);

        claims.push({
          subject: symbol,
          type: 'price',
          value: quote.regularMarketPrice,
          previous: quote.previousClose,
          change: (quote.regularMarketPrice - quote.previousClose) / quote.previousClose,
          direction: quote.regularMarketPrice > quote.previousClose ? 'up' : 'down',
        });

        // Add volume claim if significant
        if (quote.regularMarketVolume > quote.averageVolume * 1.5) {
          claims.push({
            subject: symbol,
            type: 'volume_spike',
            value: quote.regularMarketVolume,
            previous: quote.averageVolume,
            change: quote.regularMarketVolume / quote.averageVolume,
          });
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch ${symbol}: ${error.message}`);
      }
    }

    return {
      tool: this.name,
      claims,
    };
  }

  private async fetchQuote(symbol: string): Promise<YahooQuote> {
    // Implementation using yahoo-finance2 or similar
  }
}
```

### Tool Registration (Barrel Export)

```typescript
// tools/index.ts
import { YahooFinanceTool } from './yahoo-finance.tool';
import { AlphaVantageTool } from './alpha-vantage.tool';
import { BloombergNewsTool } from './bloomberg-news.tool';
import { ReutersRssTool } from './reuters-rss.tool';
import { SecFilingsTool } from './sec-filings.tool';

// All tools for this domain
export const STOCK_TOOLS = [
  YahooFinanceTool,
  AlphaVantageTool,
  BloombergNewsTool,
  ReutersRssTool,
  SecFilingsTool,
];

// Re-export for individual use
export {
  YahooFinanceTool,
  AlphaVantageTool,
  BloombergNewsTool,
  ReutersRssTool,
  SecFilingsTool,
};
```

### Runner Uses Tool Registry

```typescript
// stock-predictor-runner.service.ts
@Injectable()
export class StockPredictorRunnerService extends BasePredictionRunnerService {
  constructor(
    // ... base dependencies
    private readonly yahooFinanceTool: YahooFinanceTool,
    private readonly alphaVantageTool: AlphaVantageTool,
    private readonly bloombergNewsTool: BloombergNewsTool,
    private readonly reutersRssTool: ReutersRssTool,
    private readonly secFilingsTool: SecFilingsTool,
  ) {
    super(/* ... */);
  }

  /**
   * Return all tools for this domain
   * This is the ONLY thing that differs between runners!
   */
  getTools(): PredictionTool[] {
    return [
      this.yahooFinanceTool,
      this.alphaVantageTool,
      this.bloombergNewsTool,
      this.reutersRssTool,
      this.secFilingsTool,
    ];
  }
}
```

### Adding a New Tool

To add a new data source (e.g., Finviz screener):

1. **Create the file**: `tools/finviz-screener.tool.ts`
2. **Implement PredictionTool interface**
3. **Add to barrel export**: `tools/index.ts`
4. **Inject in runner**: Add to constructor and `getTools()`
5. **Register in module**: Add to providers

```typescript
// 1. Create tools/finviz-screener.tool.ts
@Injectable()
export class FinvizScreenerTool implements PredictionTool {
  name = 'finviz_screener';
  description = 'Fetches technical signals from Finviz screener';

  async execute(instruments: string[]): Promise<Source> {
    // Implement...
  }
}

// 2. Update tools/index.ts
export const STOCK_TOOLS = [
  // ... existing tools
  FinvizScreenerTool,  // Add new tool
];

// 3. Update runner
getTools(): PredictionTool[] {
  return [
    // ... existing tools
    this.finvizScreenerTool,
  ];
}
```

---

## Datapoints & Claims Model

### Core Concept: Claims-Based Data

All data flows as **claims** - structured assertions from sources. Whether it's a stock price from Yahoo Finance or an analyst opinion from Bloomberg, it's all the same shape.

```typescript
interface Datapoint {
  agent_slug: string;            // Agent slug from ExecutionContext
  captured_at: string;           // When this poll cycle ran

  sources: Source[];             // All sources from this poll cycle
}

interface Source {
  tool: string;                  // 'yahoo_finance', 'bloomberg_news', 'binance'
  article_url?: string;          // For news sources
  article_title?: string;
  published_at?: string;

  claims: Claim[];               // What this source says
}

interface Claim {
  subject: string;               // 'MSFT', 'BTC', 'us-senate-2026'
  type: string;                  // 'price', 'price_target', 'rating', 'poll', 'odds'

  // The data (flexible - whatever makes sense)
  value?: number | string;
  previous?: number | string;
  change?: number;
  direction?: 'up' | 'down' | 'neutral';

  // Context
  timeframe?: string;            // '12 months', 'Q1 2025', 'next week'
  reason?: string;               // "AI revenue growth", "post-debate bounce"
}
```

### One Poll = One Datapoint

Each poll cycle aggregates ALL tool outputs into a single datapoint:

```json
{
  "agent_slug": "us-tech-stocks-2025",
  "captured_at": "2025-01-07T15:30:00Z",

  "sources": [
    {
      "tool": "yahoo_finance",
      "claims": [
        { "subject": "AAPL", "type": "price", "value": 185.50, "previous": 184.20, "change": 0.007 },
        { "subject": "MSFT", "type": "price", "value": 425.00, "previous": 420.00, "change": 0.012 },
        { "subject": "GOOGL", "type": "price", "value": 175.20, "previous": 176.00, "change": -0.005 }
      ]
    },
    {
      "tool": "bloomberg_news",
      "article_url": "https://bloomberg.com/news/msft-ai-revenue",
      "article_title": "Microsoft AI Revenue Exceeds Expectations",
      "published_at": "2025-01-07T14:00:00Z",
      "claims": [
        { "subject": "MSFT", "type": "price_target", "value": 480, "direction": "up", "timeframe": "12 months", "reason": "AI revenue growth" },
        { "subject": "MSFT", "type": "rating", "value": "buy", "previous": "hold" }
      ]
    },
    {
      "tool": "reuters_rss",
      "article_url": "https://reuters.com/apple-vision-pro-2",
      "article_title": "Apple to Announce Vision Pro 2 Next Week",
      "published_at": "2025-01-07T13:30:00Z",
      "claims": [
        { "subject": "AAPL", "type": "event", "value": "product_launch", "timeframe": "next week", "reason": "Vision Pro 2 announcement" }
      ]
    },
    {
      "tool": "sec_filings",
      "claims": []
    }
  ]
}
```

### Claim Extraction

- **Numeric data** (prices, volumes): Direct mapping from API response
- **News/articles**: Cheap LLM extracts structured claims ("Read this article, give me claims as JSON")
- **No judgment**: Extraction is structured, not judgmental. Triage/Specialists make judgments later.

---

## Claim-Level Processing

### Key Insight: Pipeline Runs Per-Claim, Not Per-Datapoint

A single poll cycle produces one **datapoint** containing multiple **claims** from multiple **sources**. The prediction pipeline processes claims individually (or grouped by instrument), not the entire datapoint at once.

```
Datapoint (one poll cycle)
│
├── Source: yahoo_finance
│   ├── Claim: MSFT price up 3%
│   ├── Claim: AAPL price down 1%
│   └── Claim: NVDA volume spike
│
├── Source: bloomberg_news
│   ├── Claim: MSFT price target raised to $480
│   └── Claim: MSFT rating upgrade to BUY
│
└── Source: reuters_rss
    └── Claim: AAPL Vision Pro 2 announcement
```

### Claim Processing Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLAIM PROCESSING FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Datapoint (from poll cycle)                                                 │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  CLAIM PROCESSOR (Customizable per domain/agent)                     │    │
│  │                                                                      │    │
│  │  1. Extract all claims from datapoint                                │    │
│  │  2. Group claims by instrument (MSFT, AAPL, NVDA)                    │    │
│  │  3. Enrich each group with historical context                        │    │
│  │  4. Route each group through pipeline                                │    │
│  └──────────────────────────────┬──────────────────────────────────────┘    │
│                                 │                                            │
│         ┌───────────────────────┼───────────────────────┐                    │
│         ▼                       ▼                       ▼                    │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐            │
│  │ MSFT Bundle │         │ AAPL Bundle │         │ NVDA Bundle │            │
│  │ • price +3% │         │ • price -1% │         │ • vol spike │            │
│  │ • target 480│         │ • VP2 news  │         │             │            │
│  │ • upgrade   │         │             │         │             │            │
│  │ + history   │         │ + history   │         │ + history   │            │
│  └──────┬──────┘         └──────┬──────┘         └──────┬──────┘            │
│         │                       │                       │                    │
│         ▼                       ▼                       ▼                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  FOR EACH INSTRUMENT BUNDLE:                                         │    │
│  │                                                                      │    │
│  │  Pre-filter (per claim) ──► Triage (per claim) ──► If ANY pass:     │    │
│  │                                                     │                │    │
│  │                                                     ▼                │    │
│  │                                          Specialists (analyze bundle)│    │
│  │                                                     │                │    │
│  │                                                     ▼                │    │
│  │                                          Evaluators (challenge)      │    │
│  │                                                     │                │    │
│  │                                                     ▼                │    │
│  │                                          Recommendation (for instr)  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ClaimProcessor Interface

The claim processor is **fully customizable** per domain or even per agent. You control:
- How claims are grouped
- What historical context is pulled
- How claims are compared across time
- What enrichment data is added

```typescript
/**
 * ClaimProcessor - Customizable claim handling
 * Override methods to change behavior per domain/agent
 */
export interface ClaimProcessor {
  /**
   * Extract and organize claims from a datapoint
   * Default: Group by instrument (claim.subject)
   */
  groupClaims(datapoint: Datapoint): Map<string, ClaimBundle>;

  /**
   * Enrich a claim bundle with historical context
   * This is where you pull past datapoints, compare trends, etc.
   */
  enrichWithHistory(
    bundle: ClaimBundle,
    agentSlug: string,
  ): Promise<EnrichedClaimBundle>;

  /**
   * Determine if a claim bundle should proceed to specialists
   * Default: Any claim passes triage
   */
  shouldProceedToSpecialists(
    bundle: EnrichedClaimBundle,
    triageResults: TriageResult[],
  ): boolean;
}

interface ClaimBundle {
  instrument: string;
  claims: Claim[];
  sources: Source[];  // Which sources contributed
}

interface EnrichedClaimBundle extends ClaimBundle {
  // Historical context
  history: HistoricalContext;

  // Computed comparisons
  comparisons: ClaimComparison[];
}

interface HistoricalContext {
  // Recent datapoints for this instrument
  recentDatapoints: Datapoint[];

  // Trend analysis
  priceTrend?: TrendAnalysis;
  volumeTrend?: TrendAnalysis;

  // Past predictions and outcomes
  recentPredictions?: Prediction[];
  recentOutcomes?: Outcome[];
}

interface ClaimComparison {
  currentClaim: Claim;
  historicalClaims: Claim[];
  delta: number | string;
  trend: 'accelerating' | 'decelerating' | 'reversing' | 'continuing' | 'new';
}
```

### Example: Custom Claim Processor for Stocks

```typescript
@Injectable()
export class StockClaimProcessor implements ClaimProcessor {
  constructor(
    private readonly predictionDb: PredictionDbService,
  ) {}

  /**
   * Group claims by ticker symbol
   */
  groupClaims(datapoint: Datapoint): Map<string, ClaimBundle> {
    const bundles = new Map<string, ClaimBundle>();

    for (const source of datapoint.sources) {
      for (const claim of source.claims) {
        const instrument = claim.subject;  // e.g., 'MSFT'

        if (!bundles.has(instrument)) {
          bundles.set(instrument, {
            instrument,
            claims: [],
            sources: [],
          });
        }

        const bundle = bundles.get(instrument)!;
        bundle.claims.push(claim);
        if (!bundle.sources.includes(source)) {
          bundle.sources.push(source);
        }
      }
    }

    return bundles;
  }

  /**
   * Enrich with last 5 datapoints and compute comparisons
   */
  async enrichWithHistory(
    bundle: ClaimBundle,
    agentSlug: string,
  ): Promise<EnrichedClaimBundle> {
    // Pull last 5 datapoints that have claims for this instrument
    const recentDatapoints = await this.predictionDb.getDatapointsForInstrument(
      agentSlug,
      bundle.instrument,
      5,  // limit
    );

    // Extract historical claims for comparison
    const historicalClaims = this.extractHistoricalClaims(
      recentDatapoints,
      bundle.instrument,
    );

    // Build comparisons for each current claim
    const comparisons: ClaimComparison[] = bundle.claims.map(claim => {
      const matching = historicalClaims.filter(h => h.type === claim.type);
      return this.buildComparison(claim, matching);
    });

    // Compute trends
    const priceTrend = this.computePriceTrend(historicalClaims);
    const volumeTrend = this.computeVolumeTrend(historicalClaims);

    // Get recent predictions for learning context
    const recentPredictions = await this.predictionDb.getRecentPredictions(
      agentSlug,
      bundle.instrument,
      10,
    );

    return {
      ...bundle,
      history: {
        recentDatapoints,
        priceTrend,
        volumeTrend,
        recentPredictions,
      },
      comparisons,
    };
  }

  private buildComparison(current: Claim, historical: Claim[]): ClaimComparison {
    if (historical.length === 0) {
      return { currentClaim: current, historicalClaims: [], delta: 0, trend: 'new' };
    }

    // Compare current to most recent
    const mostRecent = historical[0];
    const delta = this.computeDelta(current, mostRecent);

    // Determine trend from historical sequence
    const trend = this.determineTrend(current, historical);

    return {
      currentClaim: current,
      historicalClaims: historical,
      delta,
      trend,
    };
  }

  private determineTrend(
    current: Claim,
    historical: Claim[],
  ): 'accelerating' | 'decelerating' | 'reversing' | 'continuing' | 'new' {
    if (historical.length < 2) return 'new';

    const currentValue = current.value as number;
    const recentValue = historical[0].value as number;
    const olderValue = historical[1].value as number;

    const currentDelta = currentValue - recentValue;
    const previousDelta = recentValue - olderValue;

    // Same direction?
    if (Math.sign(currentDelta) !== Math.sign(previousDelta)) {
      return 'reversing';
    }

    // Magnitude comparison
    if (Math.abs(currentDelta) > Math.abs(previousDelta) * 1.2) {
      return 'accelerating';
    } else if (Math.abs(currentDelta) < Math.abs(previousDelta) * 0.8) {
      return 'decelerating';
    }

    return 'continuing';
  }
}
```

### Example: Custom Enrichment Queries

The `enrichWithHistory` method can do anything - here are examples of powerful queries:

```typescript
// Example 1: "Compare MSFT's current price claim to its 5-day average"
async enrichWithHistory(bundle: ClaimBundle): Promise<EnrichedClaimBundle> {
  const priceClaims = bundle.claims.filter(c => c.type === 'price');

  if (priceClaims.length > 0) {
    const fiveDayAvg = await this.predictionDb.query(`
      SELECT AVG((claim->>'value')::numeric) as avg_price
      FROM predictions.datapoints,
           jsonb_array_elements(data->'sources') as source,
           jsonb_array_elements(source->'claims') as claim
      WHERE agent_slug = $1
        AND claim->>'subject' = $2
        AND claim->>'type' = 'price'
        AND captured_at > NOW() - INTERVAL '5 days'
    `, [agentSlug, bundle.instrument]);

    // Add comparison to enrichment
    bundle.enrichment.fiveDayAvgPrice = fiveDayAvg;
    bundle.enrichment.deviationFromAvg =
      (priceClaims[0].value - fiveDayAvg) / fiveDayAvg;
  }
}

// Example 2: "Find all news claims about MSFT in last 24h"
const recentNews = await this.predictionDb.query(`
  SELECT source->>'article_title' as title,
         source->>'article_url' as url,
         claim
  FROM predictions.datapoints,
       jsonb_array_elements(data->'sources') as source,
       jsonb_array_elements(source->'claims') as claim
  WHERE agent_slug = $1
    AND claim->>'subject' = 'MSFT'
    AND source->>'tool' IN ('bloomberg_news', 'reuters_rss')
    AND captured_at > NOW() - INTERVAL '24 hours'
`);

// Example 3: "Compare this analyst upgrade to previous ratings"
const ratingHistory = await this.predictionDb.query(`
  SELECT claim->>'value' as rating,
         captured_at
  FROM predictions.datapoints,
       jsonb_array_elements(data->'sources') as source,
       jsonb_array_elements(source->'claims') as claim
  WHERE agent_slug = $1
    AND claim->>'subject' = $2
    AND claim->>'type' = 'rating'
  ORDER BY captured_at DESC
  LIMIT 10
`);
```

### Why Claim-Level Processing Matters

1. **Granular filtering** - A 3% MSFT move might pass while a 1% AAPL move is filtered, even in the same datapoint
2. **Instrument-specific context** - MSFT bundle gets MSFT history, AAPL bundle gets AAPL history
3. **Parallel processing** - Each instrument bundle can be processed independently
4. **Better recommendations** - One recommendation per instrument, not one per datapoint
5. **Accurate attribution** - Know exactly which claims drove which recommendations
6. **Flexible enrichment** - Pull whatever historical context makes sense for each analysis

---

## Poll Cycle Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           POLL CYCLE (every 5 min)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  All tools execute in parallel:                                              │
│                                                                              │
│  yahoo_finance(instruments) ──────┐                                          │
│  bloomberg_news() ────────────────┼──► Aggregate into ONE datapoint          │
│  reuters_rss() ───────────────────┤                                          │
│  sec_filings() ───────────────────┘                                          │
│                                                                              │
│                                   │                                          │
│                                   ▼                                          │
│                          Store datapoint                                     │
│                                   │                                          │
│                                   ▼                                          │
│                      ClaimProcessor.groupClaims()                            │
│                      (Group claims by instrument)                            │
│                                   │                                          │
│         ┌─────────────────────────┼─────────────────────────┐                │
│         ▼                         ▼                         ▼                │
│    MSFT Bundle              AAPL Bundle               NVDA Bundle            │
│         │                         │                         │                │
│         ▼                         ▼                         ▼                │
│  enrichWithHistory()       enrichWithHistory()       enrichWithHistory()     │
│         │                         │                         │                │
│         └─────────────────────────┼─────────────────────────┘                │
│                                   │                                          │
│                    FOR EACH ENRICHED BUNDLE:                                 │
│                                   │                                          │
│                                   ▼                                          │
│                    Pre-filter (per claim in bundle)                          │
│                                   │                                          │
│                                   ▼                                          │
│                    Triage (per claim in bundle)                              │
│                                   │                                          │
│                                   ▼                                          │
│                    If any claims pass:                                       │
│                    Specialists → Evaluators → Recommendation                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Base Prediction Runner

### Configuration Interface

```typescript
interface PredictionRunnerConfig {
  // Identity
  domain: 'stock' | 'crypto' | 'polymarket' | 'election';

  // Pre-filter (rule-based, no LLM) - operates on individual claims
  // Returns true if claim should PASS (continue to triage), false to filter out
  preFilter: (claim: Claim) => boolean;

  // Claim processor for grouping and enrichment (optional override)
  claimProcessor?: ClaimProcessor;

  // Triage agents (4 agents, cheap LLM)
  triageContexts: {
    novelty: string;                 // "Is this new information?"
    magnitude: string;               // "Is this significant enough?"
    context: string;                 // "Does this affect our instruments?"
    credibility: string;             // "Is this source trying to inform or manipulate?"
  };

  // Specialists (N specialists, parallel execution)
  specialists: SpecialistDefinition[];

  // Evaluators (5 red team members)
  evaluatorContexts: {
    devilsAdvocate: string;
    riskAssessor: string;
    dataSkeptic: string;
    historicalMatcher: string;
    confidenceCalibrator: string;
  };

  // Risk profiles
  riskProfiles: RiskProfileConfig[];
}

interface SpecialistDefinition {
  name: string;
  team: 'technical' | 'fundamental' | 'sentiment' | 'agenda' | string;
  context: string;                   // System prompt for this specialist
  modelKey?: string;                 // Reference to configured model (e.g., 'triage', 'specialist')
}

interface RiskProfileConfig {
  slug: string;
  name: string;
  minConfidence: number;            // 0-1
  maxPositions: number;
  teamWeights: Record<string, number>;
}

### Base Runner Implementation

```typescript
@Injectable()
export abstract class BasePredictionRunnerService extends BaseAgentRunner {
  protected graph: CompiledStateGraph;
  protected claimProcessor: ClaimProcessor;

  constructor(
    protected readonly checkpointer: PostgresCheckpointerService,
    protected readonly llmService: LLMService,
    protected readonly observability: ObservabilityService,
    protected readonly predictionDb: PredictionDbService,
    protected readonly config: PredictionRunnerConfig,
  ) {
    super();
    // Use custom claim processor or default
    this.claimProcessor = config.claimProcessor || new DefaultClaimProcessor(predictionDb);
    this.graph = this.buildGraph();
  }

  /**
   * Main execute() entrypoint - called by AmbientAgentOrchestrator
   * Initializes state from agent config and runs the graph
   */
  async execute(input: RunnerInput): Promise<RunnerOutput> {
    const { agentSlug, threadId } = input;

    // Load agent config from database
    const agent = await this.loadAgentConfig(agentSlug);

    // Initialize state from agent config
    const initialState: PredictionState = {
      agentId: agent.id,
      agentSlug: agent.slug,
      instruments: agent.config_json.instruments || [],
      riskProfile: agent.config_json.defaultRiskProfile || 'balanced',
      // Runtime state
      datapoint: null,
      instrumentBundles: new Map(),
      recommendations: [],
    };

    // Generate thread ID for checkpointer (agent + date for daily continuity)
    const graphThreadId = threadId || `${agentSlug}-${new Date().toISOString().split('T')[0]}`;

    // Run the graph
    const result = await this.graph.invoke(initialState, {
      configurable: { thread_id: graphThreadId },
    });

    return {
      success: true,
      recommendationCount: result.recommendations?.length || 0,
      datapointId: result.datapoint?.id,
    };
  }

  /**
   * Build the LangGraph StateGraph with all nodes
   * Pipeline operates on INSTRUMENT BUNDLES, not flat claim lists
   */
  private buildGraph(): CompiledStateGraph {
    const graph = new StateGraph(PredictionStateAnnotation)
      .addNode("poll_data", this.pollDataNode.bind(this))
      .addNode("group_claims", this.groupClaimsNode.bind(this))
      .addNode("process_bundles", this.processBundlesNode.bind(this))
      .addNode("store_results", this.storeResultsNode.bind(this))

      .addEdge("__start__", "poll_data")
      .addConditionalEdges("poll_data", this.shouldContinueAfterPoll)
      .addEdge("group_claims", "process_bundles")
      .addEdge("process_bundles", "store_results")
      .addEdge("store_results", "__end__");

    return graph.compile({ checkpointer: this.checkpointer.getSaver() });
  }

  /**
   * Poll Data node - runs all tools in parallel, aggregates into ONE datapoint
   */
  private async pollDataNode(state: PredictionState): Promise<Partial<PredictionState>> {
    const capturedAt = new Date();

    // Run all domain tools in parallel
    const tools = this.getTools();
    const sourceResults = await Promise.all(
      tools.map(tool => tool.execute(state.instruments))
    );

    // Filter out empty results
    const sources: Source[] = sourceResults.filter(s => s.claims.length > 0);

    // If no claims from any tool, nothing to do
    if (sources.length === 0 || sources.every(s => s.claims.length === 0)) {
      return { datapoint: null, hasNewClaims: false };
    }

    // Store the datapoint
    const datapoint = await this.predictionDb.storeDatapoint(
      this.config.domain,
      state.agentId,
      capturedAt,
      sources,
    );

    return {
      datapoint,
      sources,
      hasNewClaims: datapoint.has_new_claims,
    };
  }

  /**
   * Group Claims node - uses ClaimProcessor to organize claims by instrument
   * and enrich each bundle with historical context
   */
  private async groupClaimsNode(state: PredictionState): Promise<Partial<PredictionState>> {
    // Group claims by instrument
    const bundles = this.claimProcessor.groupClaims(state.datapoint);

    // Enrich each bundle with historical context (in parallel)
    const enrichedBundles = await Promise.all(
      Array.from(bundles.entries()).map(async ([instrument, bundle]) => {
        const enriched = await this.claimProcessor.enrichWithHistory(bundle, state.agentSlug);
        return [instrument, enriched] as [string, EnrichedClaimBundle];
      })
    );

    return {
      instrumentBundles: new Map(enrichedBundles),
    };
  }

  /**
   * Process Bundles node - runs pipeline FOR EACH instrument bundle
   * Pre-filter → Triage → Specialists → Evaluators → Recommendation
   */
  private async processBundlesNode(state: PredictionState): Promise<Partial<PredictionState>> {
    const recommendations: Recommendation[] = [];

    // Process each instrument bundle independently (can parallelize)
    for (const [instrument, bundle] of state.instrumentBundles) {
      const recommendation = await this.processInstrumentBundle(bundle, state);
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    return { recommendations };
  }

  /**
   * Process a single instrument bundle through the full pipeline
   */
  private async processInstrumentBundle(
    bundle: EnrichedClaimBundle,
    state: PredictionState,
  ): Promise<Recommendation | null> {
    // 1. Pre-filter: Apply to each claim in bundle
    const passedClaims = bundle.claims.filter(claim => this.config.preFilter(claim));
    if (passedClaims.length === 0) return null;

    // 2. Triage: Run 4 triage agents on passed claims
    const triageResults = await this.runTriageOnBundle(passedClaims, bundle);
    const triagePassed = this.claimProcessor.shouldProceedToSpecialists(bundle, triageResults);
    if (!triagePassed) return null;

    // 3. Specialists: All specialists analyze the bundle (with historical context)
    const specialistResults = await Promise.all(
      this.config.specialists.map(spec => this.runSpecialist(spec, bundle, state))
    );

    // 4. Evaluators: Challenge the specialist predictions
    const challenges = await this.runEvaluators(specialistResults, bundle, state);

    // 5. Confidence Calibrator: Final confidence assignment
    const calibratedConfidence = await this.runConfidenceCalibrator(
      specialistResults,
      challenges,
      bundle,
    );

    // 6. Package recommendation
    return this.packageRecommendation(
      bundle.instrument,
      specialistResults,
      calibratedConfidence,
      state.riskProfile,
    );
  }

  /**
   * Run triage agents on claims within a bundle
   */
  private async runTriageOnBundle(
    claims: Claim[],
    bundle: EnrichedClaimBundle,
  ): Promise<TriageResult[]> {
    // Run all 4 triage agents in parallel
    const [novelty, magnitude, context, credibility] = await Promise.all([
      this.runTriageAgent('novelty', this.config.triageContexts.novelty, claims, bundle),
      this.runTriageAgent('magnitude', this.config.triageContexts.magnitude, claims, bundle),
      this.runTriageAgent('context', this.config.triageContexts.context, claims, bundle),
      this.runTriageAgent('credibility', this.config.triageContexts.credibility, claims, bundle),
    ]);

    return [novelty, magnitude, context, credibility];
  }

  // Conditional edges
  private shouldContinueAfterPoll(state: PredictionState): string {
    return state.hasNewClaims ? "group_claims" : "__end__";
  }

  // Abstract methods - subclasses provide domain-specific implementations
  abstract getTools(): PredictionTool[];
}

// Types defined in base-prediction.types.ts (single source of truth)
// See "Tool Directory Structure" section for PredictionTool interface
```

### Runner Input/Output Contract

```typescript
/**
 * Input to runner.execute() - called by AmbientAgentOrchestrator
 */
interface RunnerInput {
  agentSlug: string;
  threadId?: string;  // Optional - defaults to agent+date for daily continuity
  forceRun?: boolean; // Skip poll interval checks
}

/**
 * Output from runner.execute()
 */
interface RunnerOutput {
  success: boolean;
  recommendationCount: number;
  datapointId?: string;
  error?: string;
}
```

### Runner Registration & Factory

Runners are registered via NestJS DI and discovered by the factory using the agent's `config_json.runner` field.

#### Required `public.agents` Schema Extensions (to support Prediction Runners)

**Important**: The current `public.agents` table (in this repo) does **not** include `config_json`, `is_active`, or `agent_type` values for prediction/monitoring. To implement this PRD cleanly and avoid overloading `metadata`, we must extend `public.agents`:

- **Add `config_json`**: stores **user/admin-defined configuration** for prediction agents (instruments, pollInterval, risk profile, modelConfig, etc.).
- **Add `is_active`**: controls whether an ambient agent is eligible to be started at boot.
- **Extend `agent_type`**: add `prediction` and `monitoring` values (so the lifecycle and UI can treat them as dashboard/ambient agents).
- **Adjust constraints**: prediction/monitoring agents are internal runners, so they should not be forced to have `endpoint` or `llm_config` the way `api`/`context` agents are today.

Proposed migration sketch:

```sql
-- Add config_json + is_active to public.agents
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Extend agent_type allowed values
ALTER TABLE public.agents DROP CONSTRAINT IF EXISTS agents_agent_type_check;
ALTER TABLE public.agents ADD CONSTRAINT agents_agent_type_check
  CHECK (agent_type IN ('context', 'api', 'external', 'rag-runner', 'media', 'prediction', 'monitoring', 'orchestrator'));

-- Relax endpoint/llm_config constraints for prediction/monitoring (internal runners)
ALTER TABLE public.agents DROP CONSTRAINT IF EXISTS agents_context_no_endpoint;
ALTER TABLE public.agents DROP CONSTRAINT IF EXISTS agents_api_has_endpoint;
ALTER TABLE public.agents DROP CONSTRAINT IF EXISTS agents_api_no_llm;
ALTER TABLE public.agents DROP CONSTRAINT IF EXISTS agents_context_has_llm;

-- Recreate constraints to apply only to classic agent types.
ALTER TABLE public.agents ADD CONSTRAINT agents_context_no_endpoint
  CHECK (agent_type != 'context' OR endpoint IS NULL);

ALTER TABLE public.agents ADD CONSTRAINT agents_api_has_endpoint
  CHECK (agent_type IN ('context', 'prediction', 'monitoring', 'rag-runner', 'media', 'orchestrator') OR endpoint IS NOT NULL);

ALTER TABLE public.agents ADD CONSTRAINT agents_api_no_llm
  CHECK (agent_type IN ('context', 'prediction', 'monitoring') OR llm_config IS NULL);

ALTER TABLE public.agents ADD CONSTRAINT agents_context_has_llm
  CHECK (agent_type != 'context' OR llm_config IS NOT NULL);
```

```typescript
/**
 * Runner Registry - maps runner keys to provider tokens
 */
const RUNNER_REGISTRY: Record<string, Type<BasePredictionRunnerService>> = {
  'stock-predictor': StockPredictorRunnerService,
  'crypto-predictor': CryptoPredictorRunnerService,
  'market-predictor': MarketPredictorRunnerService,
  'election-predictor': ElectionPredictorRunnerService,
};

/**
 * Runner Factory - resolves agent config to runner instance
 */
@Injectable()
export class RunnerFactoryService {
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly supabase: SupabaseService,
  ) {}

  /**
   * Get runner instance for an agent
   * Agent's `runner` field maps to a registered runner class
   */
  async getRunner(agentSlug: string): Promise<BasePredictionRunnerService> {
    // Load agent config
    const { data: agent } = await this.supabase.getServiceClient()
      .from('agents')
      .select('*')
      .eq('slug', agentSlug)
      .single();

    if (!agent) {
      throw new Error(`Agent not found: ${agentSlug}`);
    }

    // Get runner key from agent config (e.g., 'stock-predictor')
    const runnerKey = agent.config_json?.runner;
    if (!runnerKey) {
      throw new Error(`Agent ${agentSlug} missing required config_json.runner`);
    }

    // Resolve to runner class
    const RunnerClass = RUNNER_REGISTRY[runnerKey];
    if (!RunnerClass) {
      throw new Error(`Unknown runner: ${runnerKey}`);
    }

    // Get instance from NestJS DI container
    return this.moduleRef.get(RunnerClass, { strict: false });
  }
}

/**
 * Agent schema extension for prediction agents
 */
interface PredictionAgentConfig {
  // Required
  runner: 'stock-predictor' | 'crypto-predictor' | 'market-predictor' | 'election-predictor';
  instruments: string[];
  pollInterval: number;          // ms (required; ambient agents must explicitly configure)
  defaultRiskProfile: string;    // required (no silent defaults)
  modelConfig: ModelConfig;      // required (no hardcoded defaults)

  // Optional
  preFilterOverrides?: Record<string, number>;
  specialistWeights?: Record<string, number>;
}
```

### Module Registration

Each runner is registered as a NestJS provider in its domain module:

```typescript
// stock-predictor.module.ts
@Module({
  imports: [
    PostgresCheckpointerModule,
    LLMModule,
    ObservabilityModule,
    PredictionDbModule,
  ],
  providers: [
    // Tools
    YahooFinanceTool,
    AlphaVantageTool,
    BloombergNewsTool,
    ReutersRssTool,
    SecFilingsTool,
    // Runner (gets tools injected)
    StockPredictorRunnerService,
  ],
  exports: [StockPredictorRunnerService],
})
export class StockPredictorModule {}

// prediction.module.ts (parent module)
@Module({
  imports: [
    StockPredictorModule,
    CryptoPredictorModule,
    MarketPredictorModule,
    // ElectionPredictorModule, // future
  ],
  providers: [
    RunnerFactoryService,
    AmbientAgentOrchestratorService,
  ],
  exports: [RunnerFactoryService],
})
export class PredictionModule {}
```

---

## Domain-Specific Runners

### Stock Predictor Runner

```typescript
@Injectable()
export class StockPredictorRunnerService extends BasePredictionRunnerService {
  constructor(
    checkpointer: PostgresCheckpointerService,
    llmService: LLMService,
    observability: ObservabilityService,
    predictionDb: PredictionDbService,
    // Domain-specific tools injected
    private readonly yahooFinanceTool: YahooFinanceTool,
    private readonly alphaVantageTool: AlphaVantageTool,
    private readonly bloombergNewsTool: BloombergNewsTool,
    private readonly reutersRssTool: ReutersRssTool,
    private readonly secFilingsTool: SecFilingsTool,
  ) {
    super(checkpointer, llmService, observability, predictionDb, {
      domain: 'stock',

      // Pre-filter operates on CLAIMS now
      preFilter: (claim: Claim) => {
        // Stock-specific pre-filter logic
        if (claim.type === 'price') {
          return Math.abs(claim.change || 0) > 0.02;  // 2% move
        }
        if (claim.type === 'price_target' || claim.type === 'rating') {
          return true;  // Always pass analyst actions
        }
        if (claim.type === 'event') {
          return true;  // Product launches, earnings, etc.
        }
        return false;  // Filter unknown claim types
      },

      triageContexts: {
        novelty: `You evaluate stock market claims for novelty...`,
        magnitude: `You assess whether price/volume moves are significant...`,
        context: `You determine if this claim affects our tracked instruments...`,
        credibility: `You evaluate source reliability for financial news...`,
      },

      specialists: [
        // Technical Team
        { name: 'momentum', team: 'technical', context: `You are a momentum trader...` },
        { name: 'reversion', team: 'technical', context: `You look for oversold/overbought...` },
        { name: 'pattern', team: 'technical', context: `You identify classic chart patterns...` },
        // Fundamental Team
        { name: 'value', team: 'fundamental', context: `You seek undervalued stocks...` },
        { name: 'growth', team: 'fundamental', context: `You seek high growth potential...` },
        { name: 'quality', team: 'fundamental', context: `You seek high-quality businesses...` },
        // Sentiment Team
        { name: 'newsFlow', team: 'sentiment', context: `You analyze news velocity and tone...` },
        { name: 'socialMood', team: 'sentiment', context: `You track social media sentiment...` },
        { name: 'narrativeShift', team: 'sentiment', context: `You detect when the story is changing...` },
        // Agenda Team
        { name: 'manipulation', team: 'agenda', context: `You detect market manipulation...` },
        { name: 'coordinatedNarrative', team: 'agenda', context: `You detect coordinated media campaigns...` },
        { name: 'fudDetector', team: 'agenda', context: `You identify FUD campaigns...` },
      ],

      evaluatorContexts: {
        devilsAdvocate: `Find the BEST counter-argument to each prediction...`,
        riskAssessor: `Quantify the worst-case scenario...`,
        dataSkeptic: `Challenge the quality and completeness of data...`,
        historicalMatcher: `Find historical parallels to current situations...`,
        confidenceCalibrator: `Given all challenges, assign final confidence...`,
      },

      riskProfiles: [
        { slug: 'aggressive', name: 'Aggressive', minConfidence: 0.50, maxPositions: 10, teamWeights: { technical: 1.3, sentiment: 1.2 } },
        { slug: 'balanced', name: 'Balanced', minConfidence: 0.65, maxPositions: 5, teamWeights: {} },
        { slug: 'conservative', name: 'Conservative', minConfidence: 0.75, maxPositions: 3, teamWeights: { fundamental: 1.2, quality: 1.3 } },
      ],
    });
  }

  // Tools are the domain differentiator!
  getTools(): PredictionTool[] {
    return [
      this.yahooFinanceTool,
      this.alphaVantageTool,
      this.bloombergNewsTool,
      this.reutersRssTool,
      this.secFilingsTool,
    ];
  }
}
```

### Crypto Predictor Runner

```typescript
@Injectable()
export class CryptoPredictorRunnerService extends BasePredictionRunnerService {
  constructor(
    checkpointer: PostgresCheckpointerService,
    llmService: LLMService,
    observability: ObservabilityService,
    predictionDb: PredictionDbService,
    // Domain-specific tools
    private readonly binanceTool: BinanceTool,
    private readonly coingeckoTool: CoinGeckoTool,
    private readonly etherscanTool: EtherscanTool,
    private readonly whaleAlertsTool: WhaleAlertsTool,
    private readonly defillamaTool: DefiLlamaTool,
  ) {
    super(checkpointer, llmService, observability, predictionDb, {
      domain: 'crypto',

      // Pre-filter operates on claims
      preFilter: (claim: Claim) => {
        // Crypto-specific: higher thresholds due to volatility
        if (claim.type === 'price') {
          return Math.abs(claim.change || 0) > 0.05;  // 5% move
        }
        if (claim.type === 'whale_transfer' || claim.type === 'exchange_flow') {
          return true;  // Always pass on-chain signals
        }
        return false;
      },

      triageContexts: {
        novelty: `You evaluate crypto claims for novelty. Consider 24/7 markets...`,
        magnitude: `You assess crypto moves. 5% is routine, 10%+ is significant...`,
        context: `You determine if this claim affects our tracked tokens...`,
        credibility: `You evaluate crypto news sources. Many are paid promotions...`,
      },

      specialists: [
        // Technical Team (adapted for crypto)
        { name: 'momentum', team: 'technical', context: `Crypto momentum with 24/7 markets...` },
        { name: 'reversion', team: 'technical', context: `Crypto mean reversion is extreme...` },
        { name: 'pattern', team: 'technical', context: `Crypto chart patterns...` },
        // On-Chain Team (crypto-specific)
        { name: 'whaleWatcher', team: 'onchain', context: `Track whale wallet movements...` },
        { name: 'exchangeFlows', team: 'onchain', context: `Monitor CEX inflows/outflows...` },
        { name: 'tokenomics', team: 'onchain', context: `Analyze token supply dynamics...` },
        // Sentiment Team
        { name: 'cryptoTwitter', team: 'sentiment', context: `Crypto Twitter sentiment...` },
        { name: 'discordMood', team: 'sentiment', context: `Discord/Telegram community mood...` },
        { name: 'narrativeShift', team: 'sentiment', context: `Detect narrative changes in crypto...` },
        // Agenda Team
        { name: 'pumpDetector', team: 'agenda', context: `Detect pump-and-dump schemes...` },
        { name: 'rugPullWarning', team: 'agenda', context: `Identify rug pull red flags...` },
        { name: 'influencerBias', team: 'agenda', context: `Detect paid influencer campaigns...` },
      ],

      evaluatorContexts: {
        devilsAdvocate: `Challenge crypto predictions. Consider regulatory risk...`,
        riskAssessor: `Crypto can drop 50%+ in days. Quantify tail risk...`,
        dataSkeptic: `On-chain data can be manipulated. Question everything...`,
        historicalMatcher: `Find similar crypto market conditions...`,
        confidenceCalibrator: `Crypto confidence should be conservative...`,
      },

      riskProfiles: [
        { slug: 'degen', name: 'Degen', minConfidence: 0.40, maxPositions: 15, teamWeights: { sentiment: 1.5 } },
        { slug: 'balanced', name: 'Balanced', minConfidence: 0.60, maxPositions: 8, teamWeights: {} },
        { slug: 'hodler', name: 'HODLer', minConfidence: 0.80, maxPositions: 3, teamWeights: { fundamental: 1.3, onchain: 1.2 } },
      ],
    });
  }

  getTools(): PredictionTool[] {
    return [
      this.binanceTool,
      this.coingeckoTool,
      this.etherscanTool,
      this.whaleAlertsTool,
      this.defillamaTool,
    ];
  }
}
```

### Market Predictor Runner (Polymarket)

```typescript
@Injectable()
export class MarketPredictorRunnerService extends BasePredictionRunnerService {
  constructor(
    checkpointer: PostgresCheckpointerService,
    llmService: LLMService,
    observability: ObservabilityService,
    predictionDb: PredictionDbService,
    // Domain-specific tools
    private readonly polymarketOddsTool: PolymarketOddsTool,
    private readonly gammaApiTool: GammaApiTool,
    private readonly resolutionTrackerTool: ResolutionTrackerTool,
    private readonly newsApiTool: NewsApiTool,
  ) {
    super(checkpointer, llmService, observability, predictionDb, {
      domain: 'polymarket',

      // Pre-filter operates on claims
      preFilter: (claim: Claim) => {
        // Polymarket-specific: odds shifts and volume
        if (claim.type === 'odds') {
          return Math.abs(claim.change || 0) > 0.05;  // 5% odds shift
        }
        if (claim.type === 'resolution') {
          return true;  // Always process resolution events
        }
        if (claim.type === 'volume') {
          return (claim.value as number) > 10000;  // $10k+ volume
        }
        return false;
      },

      triageContexts: {
        novelty: `You evaluate prediction market claims. New information vs noise...`,
        magnitude: `You assess odds movements. 5% shift is significant...`,
        context: `You determine if this claim affects our tracked markets...`,
        credibility: `You evaluate news about the underlying event...`,
      },

      specialists: [
        // Market Analysis Team
        { name: 'oddsMovement', team: 'market', context: `Analyze odds history and trends...` },
        { name: 'volumeAnalysis', team: 'market', context: `Track volume and liquidity...` },
        { name: 'arbitrage', team: 'market', context: `Find mispriced markets...` },
        // Event Analysis Team
        { name: 'resolutionCriteria', team: 'event', context: `Analyze resolution rules carefully...` },
        { name: 'eventTimeline', team: 'event', context: `Track event timeline and deadlines...` },
        { name: 'outcomeAssessor', team: 'event', context: `Assess likely outcomes...` },
        // Information Team
        { name: 'newsTracker', team: 'info', context: `Track news about the underlying event...` },
        { name: 'expertOpinion', team: 'info', context: `Find expert commentary...` },
        { name: 'consensusShift', team: 'info', context: `Detect shifts in consensus...` },
        // Agenda Team
        { name: 'marketManipulation', team: 'agenda', context: `Detect market manipulation...` },
        { name: 'insiderActivity', team: 'agenda', context: `Look for insider trading patterns...` },
        { name: 'narrativeBias', team: 'agenda', context: `Detect biased narrative pushing...` },
      ],

      evaluatorContexts: {
        devilsAdvocate: `Challenge predictions. Consider alternative outcomes...`,
        riskAssessor: `Binary outcomes: 0% or 100%. Assess probability accurately...`,
        dataSkeptic: `Question the information quality for this event...`,
        historicalMatcher: `Find similar prediction market situations...`,
        confidenceCalibrator: `Calibrate confidence for binary outcomes...`,
      },

      riskProfiles: [
        { slug: 'speculator', name: 'Speculator', minConfidence: 0.55, maxPositions: 20, teamWeights: { market: 1.3 } },
        { slug: 'balanced', name: 'Balanced', minConfidence: 0.65, maxPositions: 10, teamWeights: {} },
        { slug: 'researcher', name: 'Researcher', minConfidence: 0.80, maxPositions: 5, teamWeights: { event: 1.2, info: 1.2 } },
      ],
    });
  }

  getTools(): PredictionTool[] {
    return [
      this.polymarketOddsTool,
      this.gammaApiTool,
      this.resolutionTrackerTool,
      this.newsApiTool,
    ];
  }
}
```

---

## Agent Registration Pattern

### Universe = Agent (Simplified)

Each prediction "universe" is registered as an agent in the `agents` table. The key insight is that **agents are simple** - they're just runner + instruments + optional overrides. All complexity lives in the runner.

```typescript
// Minimal agent - just runner and instruments
{
  slug: 'us-tech-stocks-2025',
  name: 'US Tech Stocks 2025',
  type: 'prediction',
  runner: 'stock-predictor',
  org_slug: 'finance',

  config_json: {
    instruments: ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'META', 'AMZN', 'TSLA'],
  },

  description: 'Tracks major US tech stocks',
  is_active: true,
}
```

That's it! The runner handles everything else:
- Which tools to run (yahoo_finance, bloomberg_news, etc.)
- Pre-filter logic (2% moves, rating changes, etc.)
- Triage contexts (novelty, magnitude, context, credibility)
- Specialists (technical, fundamental, sentiment, agenda teams)
- Evaluators (devil's advocate, risk assessor, etc.)
- Risk profiles (aggressive, balanced, conservative)

### Optional Overrides

Agents can optionally override runner defaults:

```typescript
{
  slug: 'aggressive-meme-stocks',
  name: 'Aggressive Meme Stocks',
  type: 'prediction',
  runner: 'stock-predictor',
  org_slug: 'finance',

  config_json: {
    instruments: ['GME', 'AMC', 'BBBY'],

    // OPTIONAL: Override risk profile
    defaultRiskProfile: 'aggressive',

    // OPTIONAL: Lower pre-filter thresholds (more sensitive)
    preFilterOverrides: {
      priceChangeThreshold: 0.01,  // 1% instead of 2%
    },

    // OPTIONAL: Add specialist emphasis
    specialistWeights: {
      sentiment: 1.5,  // Weight sentiment team higher
    },
  },
}
```

### Crypto Agent Example

```typescript
{
  slug: 'btc-eth-tracker',
  name: 'BTC/ETH Tracker',
  type: 'prediction',
  runner: 'crypto-predictor',
  org_slug: 'crypto',

  config_json: {
    instruments: ['BTC', 'ETH'],
    // Uses all runner defaults
  },
}
```

### Polymarket Agent Example

```typescript
{
  slug: 'us-elections-2026',
  name: 'US Elections 2026',
  type: 'prediction',
  runner: 'market-predictor',
  org_slug: 'polymarket',

  config_json: {
    instruments: [
      'will-trump-win-2028',
      'senate-control-2026',
      'house-control-2026',
    ],
    defaultRiskProfile: 'researcher',  // More conservative for elections
  },
}
```

### Adding a New Domain (Elections)

Because tools are the differentiator, adding elections is straightforward:

```typescript
// 1. Create ElectionPredictorRunner with election-specific tools
@Injectable()
export class ElectionPredictorRunnerService extends BasePredictionRunnerService {
  getTools(): PredictionTool[] {
    return [
      this.pollingAvgTool,
      this.predictionMarketsTool,
      this.campaignFinanceTool,
      this.earlyVotingTool,
      this.demographicsTool,
    ];
  }
}

// 2. Register agents
{
  slug: 'senate-races-2026',
  runner: 'election-predictor',
  config_json: {
    instruments: ['AZ-senate', 'GA-senate', 'NV-senate', 'PA-senate'],
  },
}
```

---

## Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         DATA INGESTION (via Connectors)                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Stock: Yahoo Finance, Alpha Vantage, News API                                  │
│  Crypto: Binance, CoinGecko, On-Chain APIs                                      │
│  Polymarket: Polymarket API, Gamma API                                          │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    PRE-FILTER (Rule-Based, No LLM, Domain-Specific)             │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Stock: dayMove >2%? hourMove >1%? volume >1.5x?                                │
│  Crypto: dayMove >5%? hourMove >3%? whale movement?                             │
│  Polymarket: oddsShift >5%? volume >$10k?                                       │
│  (Filters ~80% of routine events with zero LLM cost)                            │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    TIER 1: TRIAGE (4 Agents - Cheap LLM)                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐         │
│  │  Novelty    │   │  Magnitude  │   │   Context   │   │ Credibility │         │
│  │  Checker    │   │  Checker    │   │   Checker   │   │  Checker    │         │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘         │
│         └──────────────────┴──────────────────┴──────────────────┘              │
│                                      │                                          │
│                         PASS (3+ votes) / REJECT                                │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                   TIER 2 - STAGE 1: SPECIALISTS (N in parallel)                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Stock: Technical(3), Fundamental(3), Sentiment(3), Agenda(3) = 12              │
│  Crypto: Technical(3), OnChain(3), Sentiment(3), Agenda(3) = 12                 │
│  Polymarket: Market(3), Event(3), Info(3), Agenda(3) = 12                       │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                   TIER 2 - STAGE 2: EVALUATORS (5 Red Team)                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Devil's Advocate → Risk Assessor → Data Skeptic → Historical Matcher           │
│                              ↓                                                  │
│                     Confidence Calibrator                                       │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                   TIER 2 - STAGE 3: RISK PROFILE PACKAGING                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Stock: Aggressive / Balanced / Conservative                                    │
│  Crypto: Degen / Balanced / HODLer                                              │
│  Polymarket: Speculator / Balanced / Researcher                                 │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            LEARNING LOOP                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Outcome Evaluation → Postmortem → Missed Opportunity → Learning Context        │
│                              ↓                                                  │
│              Update agent config_json with new lessons                          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Core Tables: Datapoints + Predictions

The database has two core concepts:
1. **Datapoints** - Raw claims captured each poll cycle (JSONB, one per poll)
2. **Predictions** - Analysis, recommendations, and outcomes

```sql
CREATE SCHEMA predictions;

-- Domain enum for type safety
CREATE TYPE predictions.domain_type AS ENUM ('stock', 'crypto', 'polymarket', 'election');

---
--- DATAPOINTS: One row per poll cycle, all sources/claims as JSONB
---

CREATE TABLE predictions.datapoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain predictions.domain_type NOT NULL,
  agent_slug TEXT REFERENCES public.agents(slug) NOT NULL,  -- Agent slug from ExecutionContext
  captured_at TIMESTAMPTZ NOT NULL,             -- When this poll cycle ran

  -- All sources and claims in one JSONB column
  -- Structure: { sources: [{ tool, article_url?, article_title?, claims: [{subject, type, value, ...}] }] }
  data JSONB NOT NULL,

  -- Metadata
  tool_count INT,                               -- How many tools returned data
  claim_count INT,                              -- Total claims across all sources
  has_new_claims BOOLEAN DEFAULT false,         -- Did this differ from previous?

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookup by agent and time
CREATE INDEX idx_datapoints_agent_time ON predictions.datapoints(agent_slug, captured_at DESC);
CREATE INDEX idx_datapoints_domain ON predictions.datapoints(domain);

-- GIN index for querying inside JSONB (e.g., find all claims about 'MSFT')
CREATE INDEX idx_datapoints_data ON predictions.datapoints USING GIN (data jsonb_path_ops);

---
--- ANALYSIS: Runs, triage, specialists, evaluators
---

CREATE TABLE predictions.runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain predictions.domain_type NOT NULL,
  agent_slug TEXT REFERENCES public.agents(slug),  -- Agent slug from ExecutionContext
  datapoint_id UUID REFERENCES predictions.datapoints(id),  -- Links to the datapoint that triggered this run

  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('running', 'completed', 'failed', 'filtered')),

  -- Where in the pipeline did it stop?
  stopped_at_stage TEXT,  -- 'pre_filter', 'triage', 'completed'

  -- Summary stats
  claims_processed INT,
  claims_passed_prefilter INT,
  claims_passed_triage INT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Triage results (4 agents)
CREATE TABLE predictions.triage_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES predictions.runs(id),
  agent_type TEXT NOT NULL,  -- novelty, magnitude, context, credibility

  decision BOOLEAN NOT NULL,
  confidence NUMERIC(3,2),
  rationale TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Specialist analyses
CREATE TABLE predictions.specialist_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES predictions.runs(id),
  specialist_name TEXT NOT NULL,  -- 'momentum', 'value', 'whaleWatcher', etc.
  team TEXT NOT NULL,             -- 'technical', 'fundamental', 'onchain', etc.

  prediction TEXT,                -- 'bullish', 'bearish', 'neutral'
  confidence NUMERIC(3,2),
  rationale TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evaluator challenges
CREATE TABLE predictions.evaluator_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES predictions.runs(id),
  evaluator_type TEXT NOT NULL,  -- devilsAdvocate, riskAssessor, dataSkeptic, historicalMatcher, confidenceCalibrator

  challenge TEXT,
  severity TEXT,  -- 'critical', 'major', 'minor'

  created_at TIMESTAMPTZ DEFAULT NOW()
);

---
--- RECOMMENDATIONS & OUTCOMES
---

CREATE TABLE predictions.recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain predictions.domain_type NOT NULL,
  run_id UUID REFERENCES predictions.runs(id),

  instrument TEXT NOT NULL,                     -- 'MSFT', 'BTC', 'senate-control-2026'
  action TEXT CHECK (action IN ('buy', 'sell', 'hold', 'yes', 'no')),
  confidence NUMERIC(3,2),
  timing_window TEXT,

  rationale TEXT,

  -- Aggregated votes from specialists
  specialist_votes JSONB,  -- { technical: 'bullish', fundamental: 'neutral', ... }

  -- Final calibrated confidence after evaluators
  calibrated_confidence NUMERIC(3,2),

  -- Risk profile versions
  risk_profiles JSONB,  -- { aggressive: {...}, balanced: {...}, conservative: {...} }

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE predictions.outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain predictions.domain_type NOT NULL,
  recommendation_id UUID REFERENCES predictions.recommendations(id),

  win_loss TEXT CHECK (win_loss IN ('win', 'loss', 'neutral', 'pending')),
  actual_return NUMERIC(8,4),
  evaluation_notes TEXT,

  evaluated_at TIMESTAMPTZ
);

---
--- LEARNING LOOP
---

CREATE TABLE predictions.postmortems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain predictions.domain_type NOT NULL,
  outcome_id UUID REFERENCES predictions.outcomes(id),

  lessons TEXT[],
  what_worked TEXT,
  what_failed TEXT,

  -- Which specialists were right/wrong?
  specialist_accuracy JSONB,  -- { momentum: true, value: false, ... }

  -- Update to agent config suggested?
  config_update_suggested JSONB,
  config_update_applied BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE predictions.missed_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain predictions.domain_type NOT NULL,
  agent_slug TEXT REFERENCES public.agents(slug),  -- Agent slug from ExecutionContext

  analysis_date DATE NOT NULL,
  instrument TEXT NOT NULL,
  actual_move NUMERIC(8,4),

  -- Where did we fail?
  was_filtered_at TEXT,  -- 'pre_filter', 'triage', 'specialists', null (never saw it)

  available_signals JSONB,  -- What claims did we have?
  why_we_missed TEXT,
  what_we_should_learn TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

---
--- INDEXES
---

CREATE INDEX idx_runs_domain ON predictions.runs(domain);
CREATE INDEX idx_runs_agent ON predictions.runs(agent_slug);
CREATE INDEX idx_runs_datapoint ON predictions.runs(datapoint_id);
CREATE INDEX idx_triage_run ON predictions.triage_results(run_id);
CREATE INDEX idx_specialist_run ON predictions.specialist_analyses(run_id);
CREATE INDEX idx_evaluator_run ON predictions.evaluator_challenges(run_id);
CREATE INDEX idx_recommendations_domain ON predictions.recommendations(domain);
CREATE INDEX idx_recommendations_run ON predictions.recommendations(run_id);
CREATE INDEX idx_outcomes_recommendation ON predictions.outcomes(recommendation_id);
CREATE INDEX idx_postmortems_outcome ON predictions.postmortems(outcome_id);
CREATE INDEX idx_missed_opportunities_agent ON predictions.missed_opportunities(agent_slug);
```

### Benefits of JSONB Datapoints

1. **Flexible claims structure** - Different domains have different claim types, no schema changes needed
2. **One row per poll** - Easy to diff against previous, simple to understand
3. **Queryable** - GIN index allows queries like "find all datapoints with MSFT claims"
4. **Auditable** - Complete snapshot of what we knew at each poll cycle
5. **Source attribution built-in** - Each claim knows which tool/article it came from

### PredictionDbService

```typescript
@Injectable()
export class PredictionDbService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Store a datapoint from a poll cycle
   */
  async storeDatapoint(
    domain: string,
    agentId: string,
    capturedAt: Date,
    sources: Source[],
  ) {
    const claimCount = sources.reduce((sum, s) => sum + s.claims.length, 0);

    // Get previous datapoint to check for changes
    const { data: previous } = await this.supabase.getServiceClient()
      .schema('predictions')
      .from('datapoints')
      .select('data')
      .eq('agent_slug', agentSlug)
      .order('captured_at', { ascending: false })
      .limit(1)
      .single();

    const hasNewClaims = this.detectNewClaims(previous?.data, { sources });

    return this.supabase.getServiceClient()
      .schema('predictions')
      .from('datapoints')
      .insert({
        domain,
        agent_slug: agentSlug,
        captured_at: capturedAt.toISOString(),
        data: { sources },
        tool_count: sources.length,
        claim_count: claimCount,
        has_new_claims: hasNewClaims,
      })
      .select()
      .single();
  }

  /**
   * Get claims for an instrument from recent datapoints
   */
  async getClaimsForInstrument(agentSlug: string, instrument: string, limit = 10) {
    // Use JSONB query to find datapoints with claims about this instrument
    return this.supabase.getServiceClient()
      .schema('predictions')
      .from('datapoints')
      .select('*')
      .eq('agent_slug', agentSlug)
      .filter('data', 'cs', `{"sources":[{"claims":[{"subject":"${instrument}"}]}]}`)
      .order('captured_at', { ascending: false })
      .limit(limit);
  }

  /**
   * Get the diff between two datapoints
   */
  getClaimsDiff(oldData: DatapointData, newData: DatapointData): Claim[] {
    const oldClaims = this.flattenClaims(oldData);
    const newClaims = this.flattenClaims(newData);

    // Return claims in new that aren't in old (by subject+type+value)
    return newClaims.filter(nc =>
      !oldClaims.some(oc =>
        oc.subject === nc.subject &&
        oc.type === nc.type &&
        oc.value === nc.value
      )
    );
  }

  private flattenClaims(data: DatapointData): Claim[] {
    return data.sources.flatMap(s => s.claims);
  }

  private detectNewClaims(oldData: DatapointData | null, newData: DatapointData): boolean {
    if (!oldData) return true;
    return this.getClaimsDiff(oldData, newData).length > 0;
  }
}

---

## Prediction Agent UI Components

### No Admin Screen - Component-Based Agent Pane

The prediction agent's conversation pane is a **dashboard of components**, not a chat interface. Each function has its own dedicated UI component with specific data sources and actions. No separate admin UI needed.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  US Tech Stocks 2025                                    [⚙️] [📊] [🔧]      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  CURRENT STATE                                                       │   │
│  │  Last poll: 2 min ago | Claims: 12 | New: 3                         │   │
│  │  MSFT  BUY   72%  ████████████░░░░  AI revenue growth               │   │
│  │  AAPL  HOLD  58%  ██████████░░░░░░  Vision Pro 2 priced in          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  INSTRUMENTS                                        [+ Add] [Edit]   │   │
│  │  AAPL  MSFT  GOOGL  NVDA  META  AMZN  TSLA                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  HISTORY                                           [Filter] [Export] │   │
│  │  Jan 7  MSFT  BUY   72%  ✅ Win   +3.2%                             │   │
│  │  Jan 6  AAPL  SELL  68%  ❌ Loss  -1.1%                             │   │
│  │  Jan 5  NVDA  BUY   81%  ✅ Win   +5.4%                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  LEARNING                                                            │   │
│  │  Win Rate: 68% | Calibration: -2% (underconfident)                  │   │
│  │  Lessons: • NVDA volatility baseline higher than other tech         │   │
│  │  Missed Opportunities (3):  [Review]                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  TOOLS                                                 [Expand All]  │   │
│  │  ✅ yahoo_finance    12 claims   2 min ago                          │   │
│  │  ✅ bloomberg_news    3 claims   2 min ago                          │   │
│  │  ⚪ sec_filings       0 claims   2 min ago                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  CONFIG                                                     [Edit]   │   │
│  │  Risk Profile: Balanced | Price Threshold: 2% | Poll: 5 min         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Specifications

| Component | Purpose | Data Source | Actions |
|-----------|---------|-------------|---------|
| **CurrentStateComponent** | Latest datapoint, active recommendations | `predictions.datapoints`, `predictions.recommendations` | View details, expand rationale |
| **InstrumentsComponent** | Manage tracked instruments | `agents.config_json.instruments` | Add, remove, reorder |
| **HistoryComponent** | Past predictions + outcomes | `predictions.recommendations`, `predictions.outcomes` | Filter by instrument, date, outcome |
| **LearningComponent** | Win rate, calibration, lessons | `predictions.postmortems`, `predictions.missed_opportunities` | Review missed, apply lessons |
| **ToolsComponent** | Data source status, raw claims | `predictions.datapoints.data.sources` | Expand to see claims, debug |
| **ConfigComponent** | Agent settings, risk profile | `agents.config_json` | Edit thresholds, change profile |

### Component File Structure

```
apps/web/src/components/agents/prediction/
├── PredictionAgentPane.vue           # Main container, orchestrates components
├── CurrentStateComponent.vue         # Latest recommendations
├── InstrumentsComponent.vue          # Instrument management
├── HistoryComponent.vue              # Prediction history with outcomes
├── LearningComponent.vue             # Learning loop insights
├── ToolsComponent.vue                # Data source status
├── ConfigComponent.vue               # Agent configuration
└── shared/
    ├── ClaimCard.vue                 # Single claim display
    ├── RecommendationRow.vue         # Single recommendation row
    ├── OutcomeBadge.vue              # Win/Loss/Pending badge
    └── ConfidenceBar.vue             # Visual confidence indicator
```

### What Each Component Replaces

| Old Admin Function | New Component |
|--------------------|---------------|
| Create/Edit universe | ConfigComponent + InstrumentsComponent |
| View universe history | HistoryComponent |
| Manage instruments | InstrumentsComponent |
| View recommendations | CurrentStateComponent |
| Learning dashboard | LearningComponent |
| Debug data sources | ToolsComponent |

### API Endpoints for Components

```typescript
// Current state
GET /api/agents/:slug/predictions/current
// Returns: { datapoint, recommendations[], lastPollAt }

// Instruments management
GET /api/agents/:slug/instruments
PUT /api/agents/:slug/instruments
// Returns/Accepts: { instruments: string[] }

// History with pagination
GET /api/agents/:slug/predictions/history?limit=20&offset=0&instrument=MSFT
// Returns: { recommendations[], total, hasMore }

// Learning insights
GET /api/agents/:slug/learning
// Returns: { winRate, calibration, lessons[], missedOpportunities[] }

// Tools status
GET /api/agents/:slug/tools
// Returns: { tools: [{ name, lastRun, claimCount, status }] }

// Config
GET /api/agents/:slug/config
PUT /api/agents/:slug/config
// Returns/Accepts: { riskProfile, thresholds, pollInterval }
```

---

## Agent Interaction Modes

### Dashboard Agents vs Conversation Agents

This introduces a fundamental distinction between two types of agents:

| Type | Interaction | Entry Point | UI | Examples |
|------|-------------|-------------|-----|----------|
| **Conversation Agent** | Chat/prompt-based | "New Conversation" button | Chat pane | Research agents, RAG agents, assistants |
| **Dashboard Agent** | Component-based UI | Click agent directly | Dashboard pane | Prediction agents, monitoring agents |

### Interaction Mode Determination

The interaction mode is derived from agent type, with optional override:

```typescript
// Derive from agent_type with optional override in metadata
function getInteractionMode(agent: Agent): 'conversation' | 'dashboard' {
  // Check for explicit override in metadata
  if (agent.metadata?.interaction_mode) {
    return agent.metadata.interaction_mode;
  }

  // Default by agent_type
  const dashboardTypes = ['prediction', 'monitoring'];
  return dashboardTypes.includes(agent.agent_type) ? 'dashboard' : 'conversation';
}
```

### UI Behavior

When user clicks on an agent in the agent list:

1. **Conversation Agent**: Opens "New Conversation" dialog, then chat pane
2. **Dashboard Agent**: Opens dashboard pane directly (no conversation needed)

### Agent Type to Interaction Mode Mapping

| Agent Type | Default Mode | Can Override |
|------------|--------------|--------------|
| `context` | conversation | Yes |
| `rag-runner` | conversation | Yes |
| `api` | conversation | Yes |
| `external` | conversation | Yes |
| `orchestrator` | conversation | Yes |
| `prediction` | dashboard | Yes |
| `monitoring` | dashboard | Yes |

### Migration: Existing Agents

All existing agents default to `conversation` mode (no migration needed). New prediction agents automatically get `dashboard` mode.

---

## Ambient Agent Lifecycle

### What is an Ambient Agent?

Ambient agents run continuously in the background with poll cycles. They:
- Start automatically when API boots
- Poll data sources on configurable intervals
- Track state across restarts
- Can be paused/resumed from the dashboard

### Ambient Agent Orchestrator Service

```typescript
@Injectable()
export class AmbientAgentOrchestratorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AmbientAgentOrchestratorService.name);
  private runningAgents = new Map<string, { interval: NodeJS.Timeout; status: AgentStatus }>();

  constructor(
    private readonly agentRegistry: AgentRegistryService,
    private readonly runnerFactory: RunnerFactoryService,
    private readonly supabase: SupabaseService,
  ) {}

  /**
   * On API startup, start all active ambient agents
   */
  async onModuleInit() {
    this.logger.log('Initializing Ambient Agent Orchestrator...');
    await this.startAllAmbientAgents();
  }

  /**
   * Clean shutdown - stop all poll cycles
   */
  onModuleDestroy() {
    this.logger.log('Shutting down Ambient Agent Orchestrator...');
    this.stopAllAgents();
  }

  /**
   * Query and start all active ambient/dashboard agents
   */
  async startAllAmbientAgents() {
    const { data: agents } = await this.supabase.getServiceClient()
      .from('agents')
      .select('*')
      .eq('is_active', true)
      .in('agent_type', ['prediction', 'monitoring']);

    for (const agent of agents || []) {
      if (!agent.metadata?.is_paused) {
        await this.startAgent(agent.slug);
      }
    }

    this.logger.log(`Started ${this.runningAgents.size} ambient agents`);
  }

  /**
   * Start polling for a specific agent
   */
  async startAgent(slug: string) {
    if (this.runningAgents.has(slug)) {
      this.logger.warn(`Agent ${slug} already running`);
      return;
    }

    const { data: agent, error } = await this.supabase.getServiceClient()
      .from('agents')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error || !agent) {
      throw new Error(`Agent not found: ${slug}`);
    }

    // FAIL-FAST: pollInterval is required config for ambient agents
    // No silent defaults - explicit configuration prevents surprises
    const pollInterval = agent.config_json?.pollInterval;
    if (pollInterval === undefined || pollInterval === null) {
      throw new Error(
        `Agent ${slug} missing required config_json.pollInterval. ` +
        `Ambient agents must explicitly configure their poll interval.`
      );
    }
    if (typeof pollInterval !== 'number' || pollInterval < 10000) {
      throw new Error(
        `Agent ${slug} has invalid pollInterval: ${pollInterval}. ` +
        `Must be a number >= 10000ms (10 seconds minimum).`
      );
    }

    // Run immediately on start
    await this.runPollCycle(slug);

    // Then schedule recurring polls
    const interval = setInterval(async () => {
      await this.runPollCycle(slug);
    }, pollInterval);

    this.runningAgents.set(slug, {
      interval,
      status: { state: 'running', lastPollAt: new Date(), nextPollAt: new Date(Date.now() + pollInterval) }
    });

    // Update agent metadata with runtime state
    await this.updateAgentRuntimeState(slug, 'running');

    this.logger.log(`Started ambient agent: ${slug} (poll every ${pollInterval / 1000}s)`);
  }

  /**
   * Stop polling for a specific agent
   */
  async stopAgent(slug: string) {
    const running = this.runningAgents.get(slug);
    if (!running) {
      return;
    }

    clearInterval(running.interval);
    this.runningAgents.delete(slug);
    await this.updateAgentRuntimeState(slug, 'stopped');

    this.logger.log(`Stopped ambient agent: ${slug}`);
  }

  /**
   * Pause agent (keeps config, stops polling)
   * IMPORTANT: Merges with existing metadata, doesn't overwrite
   */
  async pauseAgent(slug: string) {
    await this.stopAgent(slug);

    // Get current metadata to merge
    const { data: agent } = await this.supabase.getServiceClient()
      .from('agents')
      .select('metadata')
      .eq('slug', slug)
      .single();

    await this.supabase.getServiceClient()
      .from('agents')
      .update({
        metadata: {
          ...agent?.metadata,
          is_paused: true,
          runtime_state: 'paused',
          last_state_change: new Date().toISOString(),
        }
      })
      .eq('slug', slug);

    this.logger.log(`Paused ambient agent: ${slug}`);
  }

  /**
   * Resume a paused agent
   * IMPORTANT: Merges with existing metadata, doesn't overwrite
   */
  async resumeAgent(slug: string) {
    // Get current metadata to merge
    const { data: agent } = await this.supabase.getServiceClient()
      .from('agents')
      .select('metadata')
      .eq('slug', slug)
      .single();

    await this.supabase.getServiceClient()
      .from('agents')
      .update({
        metadata: {
          ...agent?.metadata,
          is_paused: false,
        }
      })
      .eq('slug', slug);

    await this.startAgent(slug);
    this.logger.log(`Resumed ambient agent: ${slug}`);
  }

  /**
   * Manual trigger - run poll cycle now
   */
  async triggerPollNow(slug: string) {
    this.logger.log(`Manual poll triggered for: ${slug}`);
    await this.runPollCycle(slug);
  }

  /**
   * Execute one poll cycle for an agent
   */
  private async runPollCycle(slug: string) {
    const startTime = Date.now();

    try {
      const runner = await this.runnerFactory.getRunner(slug);
      await runner.execute({ agentSlug: slug });

      const running = this.runningAgents.get(slug);
      if (running) {
        running.status.lastPollAt = new Date();
        running.status.lastError = undefined;
      }

      this.logger.debug(`Poll cycle complete for ${slug} (${Date.now() - startTime}ms)`);
    } catch (error) {
      this.logger.error(`Poll cycle failed for ${slug}: ${error.message}`);

      const running = this.runningAgents.get(slug);
      if (running) {
        running.status.lastError = error.message;
      }
    }
  }

  /**
   * Get status of all running agents
   */
  getRunningAgents(): Map<string, AgentStatus> {
    const statuses = new Map<string, AgentStatus>();
    for (const [slug, data] of this.runningAgents) {
      statuses.set(slug, data.status);
    }
    return statuses;
  }

  /**
   * Stop all agents (for shutdown)
   */
  private stopAllAgents() {
    for (const [slug, data] of this.runningAgents) {
      clearInterval(data.interval);
      this.logger.log(`Stopped agent: ${slug}`);
    }
    this.runningAgents.clear();
  }

  /**
   * Update runtime state in metadata (merges, doesn't overwrite)
   */
  private async updateAgentRuntimeState(slug: string, state: string) {
    // Get current metadata to merge
    const { data: agent } = await this.supabase.getServiceClient()
      .from('agents')
      .select('metadata')
      .eq('slug', slug)
      .single();

    await this.supabase.getServiceClient()
      .from('agents')
      .update({
        metadata: {
          ...agent?.metadata,
          runtime_state: state,
          last_state_change: new Date().toISOString(),
        }
      })
      .eq('slug', slug);
  }
}

interface AgentStatus {
  state: 'running' | 'paused' | 'stopped' | 'error';
  lastPollAt?: Date;
  nextPollAt?: Date;
  lastError?: string;
}
```

### Agent Config vs Metadata (IMPORTANT)

**config_json** = User-defined settings (static, changed by user)
**metadata** = Runtime state (dynamic, changed by orchestrator)

```typescript
// config_json: User-defined, static settings
config_json: {
  // Core config
  instruments: ['AAPL', 'MSFT', 'GOOGL'],

  // Ambient agent settings
  pollInterval: 300000,        // 5 min (in ms)

  // Risk and analysis settings
  defaultRiskProfile: 'balanced',
  preFilterOverrides: { ... },
}

// metadata: Runtime state, updated by orchestrator
metadata: {
  // Lifecycle state
  is_paused: false,
  runtime_state: 'running',    // running | paused | stopped | error
  last_state_change: '2025-01-07T10:00:00Z',

  // Interaction mode override (optional)
  interaction_mode: 'dashboard',  // Only if overriding default

  // Other system-managed metadata
  last_poll_at: '2025-01-07T10:00:00Z',
  last_error: null,
}
```

**Rule**: Orchestrator ALWAYS merges metadata updates, never overwrites the whole object.

### Per-Stage Model Configuration (Admin Only)

Each prediction pipeline stage requires an LLM call. Admins can configure the provider and model for each stage independently via the agent dashboard. These settings are shared across all users of the agent and persist until an admin changes them.

#### Model Config Structure in `config_json`

```typescript
// config_json: User-defined settings (admin-only for models)
config_json: {
  instruments: ['AAPL', 'MSFT', 'GOOGL'],
  pollInterval: 300000,
  defaultRiskProfile: 'balanced',

  // Per-stage model configuration (admin-only)
  modelConfig: {
    triage: {
      provider: 'anthropic',
      model: '<configured-triage-model>',  // MUST be explicitly configured (no defaults)
    },
    specialist: {
      provider: 'anthropic',
      model: '<configured-specialist-model>',
    },
    evaluator: {
      provider: 'anthropic',
      model: '<configured-evaluator-model>',
    },
    calibrator: {
      provider: '<configured-calibrator-provider>',
      model: '<configured-calibrator-model>',
    },
    learningAssistant: {
      provider: 'anthropic',
      model: '<configured-learning-assistant-model>',
    },
  },
}
```

#### Model Config UI Component

The ConfigComponent includes a **Model Configuration** section visible only to admins:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚙️ Model Configuration                                    [🔒 Admin Only]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Pipeline Stage           Provider              Model                       │
│  ─────────────────────────────────────────────────────────────────────────  │
│  🔍 Triage (4 agents)     [Provider ▼]          [Model ▼]                   │
│  📊 Specialists (N)       [Provider ▼]          [Model ▼]                   │
│  ⚖️ Evaluators (5)        [Provider ▼]          [Model ▼]                   │
│  📐 Calibrator            [Provider ▼]          [Model ▼]                   │
│  💬 Learning Assistant    [Provider ▼]          [Model ▼]                   │
│                                                                             │
│  ℹ️ These settings are shared by all users. Only admins can change them.   │
│                                                                             │
│                                 [Load Recommended Profile] [💾 Save]        │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Recommended Model Profiles (NOT defaults)

To comply with the project rule **NO silent defaults**, prediction agents must have an explicit `config_json.modelConfig` saved in the database before they can run.

The UI may offer **recommended profiles** (e.g., “Cheap / Balanced / Premium”) but clicking them must **write explicit provider+model values** into the agent’s `config_json.modelConfig`. Runtime code must never assume a default model when configuration is missing.

#### Access Control

```typescript
interface ModelConfigPermissions {
  // Only users with 'admin' role can modify modelConfig
  canEditModelConfig: boolean;  // Derived from user.role === 'admin'

  // All users can VIEW the config (transparency)
  canViewModelConfig: boolean;  // Always true
}

// API endpoint with admin check
@Put('/api/agents/:slug/model-config')
@UseGuards(AdminGuard)  // Requires admin role
async updateModelConfig(
  @Param('slug') slug: string,
  @Body() modelConfig: ModelConfig,
): Promise<Agent> {
  return this.agentsService.updateModelConfig(slug, modelConfig);
}
```

#### Model Configuration Service

```typescript
@Injectable()
export class ModelConfigService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly llmService: LLMService,
  ) {}

  /**
   * Get the configured model for a pipeline stage
   * FAIL-FAST: stage model config is required for prediction agents
   */
  getModelForStage(
    agentConfig: AgentConfig,
    stage: 'triage' | 'specialist' | 'evaluator' | 'calibrator' | 'learningAssistant',
  ): { provider: string; model: string } {
    const configured = agentConfig.config_json?.modelConfig?.[stage];
    if (configured) {
      return configured;
    }
    throw new Error(
      `Agent ${agentConfig.slug} missing required config_json.modelConfig.${stage}. ` +
      `Prediction runners require explicit per-stage model configuration (no defaults).`
    );
  }

  // NOTE: Available models come from existing endpoint
  // GET /models/names?status=active&model_type=text-generation
  // No custom getAvailableModels() needed - use ModelsService directly

  /**
   * Update model config (admin only, enforced at API layer)
   */
  async updateModelConfig(
    agentSlug: string,
    modelConfig: ModelConfig,
  ): Promise<void> {
    const { data: agent } = await this.supabase.getServiceClient()
      .from('agents')
      .select('config_json')
      .eq('slug', agentSlug)
      .single();

    await this.supabase.getServiceClient()
      .from('agents')
      .update({
        config_json: {
          ...agent?.config_json,  // MERGE, don't overwrite
          modelConfig,
        },
      })
      .eq('slug', agentSlug);
  }
}

interface ModelConfig {
  triage?: { provider: string; model: string };
  specialist?: { provider: string; model: string };
  evaluator?: { provider: string; model: string };
  calibrator?: { provider: string; model: string };
  learningAssistant?: { provider: string; model: string };
}

// Available models fetched from existing endpoint:
// GET /models/names?status=active&model_type=text-generation
// Returns: ModelNameDto[] from ModelsController
```

#### Usage in Pipeline

The base runner uses `ModelConfigService` to get the configured model for each stage:

```typescript
// In base-prediction-runner.service.ts
private async runTriageAgent(
  agentType: string,
  context: string,
  claims: Claim[],
  bundle: EnrichedClaimBundle,
): Promise<TriageResult> {
  // Get configured model for triage stage
  const { provider, model } = this.modelConfigService.getModelForStage(
    this.agent,
    'triage',
  );

  const response = await this.llmService.invoke({
    provider,
    model,
    messages: [
      { role: 'system', content: context },
      { role: 'user', content: this.formatTriageInput(claims, bundle) },
    ],
    executionContext: this.executionContext,
  });

  return this.parseTriageResponse(response);
}
```

### Dashboard Controls for Ambient Agents

The dashboard pane includes lifecycle controls:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  US Tech Stocks 2025                          [▶ Running] [⏸ Pause] [🔄 Now] │
├─────────────────────────────────────────────────────────────────────────────┤
│  Status: Running | Last poll: 2 min ago | Next poll: in 3 min               │
│  ...                                                                        │
```

| Control | Action |
|---------|--------|
| **Play/Resume** | Start or resume polling |
| **Pause** | Stop polling, keep config |
| **Poll Now** | Manual trigger immediate poll |
| **Stop** | Completely stop agent |

### API Endpoints for Lifecycle Control

```typescript
// Get agent status
GET /api/agents/:slug/status
// Returns: { state, lastPollAt, nextPollAt, pollInterval }

// Start agent polling
POST /api/agents/:slug/start

// Stop agent polling
POST /api/agents/:slug/stop

// Pause agent polling
POST /api/agents/:slug/pause

// Resume agent polling
POST /api/agents/:slug/resume

// Trigger immediate poll
POST /api/agents/:slug/poll-now
```

### Startup Behavior

On API startup:
1. `AmbientAgentOrchestratorService.onModuleInit()` is called
2. Queries all agents with `agent_type IN ('prediction', 'monitoring')` and `is_active = true`
3. Filters out agents where `metadata.is_paused = true`
4. Starts poll cycles for remaining agents
5. Logs count of started agents

### Graceful Shutdown

On API shutdown:
1. `AmbientAgentOrchestratorService.onModuleDestroy()` is called
2. All `setInterval` timers are cleared
3. Runtime state is NOT persisted (agents resume on next startup)

---

## RAG-Powered Learning Conversation

### Overview

The Learning component in the dashboard isn't just a display - it's a **conversational interface**. Users can interrogate the system about past predictions, explore missed opportunities, and provide insights that update the agent's context.

### SQL-Based Learning Retrieval (No RAG Needed)

**No vector embeddings needed** - structured data in predictions tables is queryable via SQL. The learning conversation uses SQL retrieval + LLM analysis.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      LEARNING CONVERSATION FLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User: "Why do we keep losing on TSLA?"                                     │
│                           │                                                  │
│                           ▼                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  SQL RETRIEVAL (Smart Query Selection)                               │   │
│  │                                                                      │   │
│  │  SELECT * FROM predictions.postmortems                              │   │
│  │  WHERE instrument = 'TSLA' AND outcome = 'loss'                     │   │
│  │  ORDER BY created_at DESC LIMIT 20                                  │   │
│  │                                                                      │   │
│  │  SELECT * FROM predictions.missed_opportunities                     │   │
│  │  WHERE instrument = 'TSLA'                                          │   │
│  │  ORDER BY actual_move DESC LIMIT 10                                 │   │
│  │                                                                      │   │
│  │  SELECT specialist_name, COUNT(*) as wrong_count                    │   │
│  │  FROM predictions.specialist_analyses sa                            │   │
│  │  JOIN predictions.outcomes o ON ...                                 │   │
│  │  WHERE instrument = 'TSLA' AND was_correct = false                  │   │
│  │  GROUP BY specialist_name                                           │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                           │
│                                 ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  BUILD FOCUSED CONTEXT (Not whole DB - just relevant rows)           │   │
│  │                                                                      │   │
│  │  ## Recent TSLA Losses (5)                                          │   │
│  │  - Jan 5: Predicted BUY 72%, actual -4.2%, momentum was wrong       │   │
│  │  - Dec 28: Predicted BUY 68%, actual -2.1%, FSD hype overweighted   │   │
│  │  ...                                                                │   │
│  │                                                                      │   │
│  │  ## Missed Opportunities (3)                                        │   │
│  │  - Jan 3: Missed +8.2% rally, filtered at triage (novelty)          │   │
│  │  ...                                                                │   │
│  │                                                                      │   │
│  │  ## Specialist Accuracy on TSLA                                     │   │
│  │  - Momentum: 45% (below average)                                    │   │
│  │  - Sentiment: 62% (overweights Elon tweets)                         │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                           │
│                                 ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  LLM ANALYSIS                                                        │   │
│  │                                                                      │   │
│  │  "Based on your TSLA history, I see a pattern: the momentum         │   │
│  │  specialist is wrong 55% of the time on TSLA specifically.          │   │
│  │  This is because TSLA moves on news/tweets more than technicals.    │   │
│  │                                                                      │   │
│  │  Recommendation: For TSLA, weight sentiment team higher and         │   │
│  │  reduce technical team weight.                                       │   │
│  │                                                                      │   │
│  │  [Apply to Context] [Modify] [Dismiss]"                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why SQL > RAG for Predictions

1. **Structured data** - postmortems have fields (instrument, outcome, specialist_accuracy) that are directly queryable
2. **Exact matches** - "Show me TSLA losses" is a SQL WHERE clause, not a fuzzy search
3. **Aggregations** - "Which specialist is worst on TSLA?" is a GROUP BY, not vector similarity
4. **No embedding cost** - no need to embed every postmortem
5. **Simpler infrastructure** - no vector indexes, no embedding pipeline
6. **Joins work** - can join postmortems → recommendations → specialist_analyses in one query

### User Insights Table (Single Addition)

The only new table needed is for storing user-provided insights from learning conversations:

```sql
---
--- USER INSIGHTS: Human knowledge additions from conversations
---
CREATE TABLE predictions.user_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug TEXT REFERENCES public.agents(slug) NOT NULL,  -- Agent slug from ExecutionContext

  -- Insight content
  content TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('conversation', 'manual', 'api')),

  -- What this insight applies to
  instrument TEXT,                -- NULL = applies to all
  target_section TEXT,            -- 'triage', 'specialists', 'evaluators', 'pre_filter', 'general'

  -- Context update tracking
  applied_to_context BOOLEAN DEFAULT false,
  dismissed BOOLEAN DEFAULT false,
  dismiss_reason TEXT,

  -- Conversation reference
  conversation_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  applied_at TIMESTAMPTZ
);

CREATE INDEX idx_user_insights_agent ON predictions.user_insights(agent_slug);
CREATE INDEX idx_user_insights_instrument ON predictions.user_insights(instrument);
```

### Learning Context Builder Service

**Simple Queries with agent_slug**: The predictions schema uses `agent_slug` (TEXT) directly as foreign key, matching `ExecutionContext.agentSlug`. No UUID resolution needed.

```
Join Path for Postmortems + Instrument:
  postmortems(outcome_id) → outcomes(recommendation_id) → recommendations(instrument)

Join Path for Specialist Accuracy:
  runs(agent_slug) → specialist_analyses(run_id)
  runs(datapoint_id) → recommendations(run_id) → outcomes(recommendation_id)
```

```typescript
@Injectable()
export class LearningContextBuilderService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Build focused context for learning conversation
   * Pulls relevant rows from predictions tables based on user query
   * Uses agent_slug directly from ExecutionContext - no UUID resolution needed
   */
  async buildContext(agentSlug: string, userQuery: string): Promise<string> {
    // Parse user query to extract filters
    const filters = this.parseQueryForFilters(userQuery);

    const context: string[] = [];

    // 1. Get relevant postmortems (joined with outcomes → recommendations for instrument)
    const postmortems = await this.getPostmortems(agentSlug, filters);
    if (postmortems.length > 0) {
      context.push(this.formatPostmortems(postmortems));
    }

    // 2. Get relevant missed opportunities (uses agent_slug directly)
    const missed = await this.getMissedOpportunities(agentSlug, filters);
    if (missed.length > 0) {
      context.push(this.formatMissedOpportunities(missed));
    }

    // 3. Get specialist accuracy stats
    const specialistStats = await this.getSpecialistStats(agentSlug, filters);
    context.push(this.formatSpecialistStats(specialistStats));

    // 4. Get user insights already applied (uses agent_slug directly)
    const insights = await this.getUserInsights(agentSlug, filters);
    if (insights.length > 0) {
      context.push(this.formatUserInsights(insights));
    }

    return context.join('\n\n---\n\n');
  }

  /**
   * Get postmortems with full join path to get instrument
   * postmortems → outcomes → recommendations (has instrument)
   */
  private async getPostmortems(agentSlug: string, filters: QueryFilters) {
    // Use nested select to join through outcomes to recommendations
    let query = this.supabase.getServiceClient()
      .schema('predictions')
      .from('postmortems')
      .select(`
        *,
        outcome:outcomes(
          *,
          recommendation:recommendations(
            instrument,
            action,
            confidence,
            run:runs!inner(agent_slug)
          )
        )
      `)
      .eq('outcome.recommendation.run.agent_slug', agentSlug)
      .order('created_at', { ascending: false })
      .limit(20);

    if (filters.outcome) {
      query = query.eq('outcome.win_loss', filters.outcome);
    }

    const { data } = await query;

    // Filter by instrument in application (join is complex)
    let results = data || [];
    if (filters.instrument) {
      results = results.filter(p =>
        p.outcome?.recommendation?.instrument === filters.instrument
      );
    }

    return results;
  }

  /**
   * Get specialist accuracy via database function
   * Uses agent_slug directly - no UUID conversion needed
   */
  private async getSpecialistStats(agentSlug: string, filters: QueryFilters) {
    const { data } = await this.supabase.getServiceClient()
      .schema('predictions')
      .rpc('get_specialist_accuracy', {
        p_agent_slug: agentSlug,  // TEXT, matches ExecutionContext
        p_instrument: filters.instrument || null,
      });

    return data || [];
  }

  private parseQueryForFilters(query: string): QueryFilters {
    const filters: QueryFilters = {};

    // Simple keyword extraction (could use LLM for better parsing)
    const instrumentMatch = query.match(/\b(AAPL|MSFT|TSLA|NVDA|GOOGL|META|AMZN)\b/i);
    if (instrumentMatch) {
      filters.instrument = instrumentMatch[1].toUpperCase();
    }

    if (/\b(loss|losing|lost|wrong)\b/i.test(query)) {
      filters.outcome = 'loss';
    } else if (/\b(win|winning|won|right)\b/i.test(query)) {
      filters.outcome = 'win';
    }

    if (/\b(missed|miss)\b/i.test(query)) {
      filters.includeMissed = true;
    }

    return filters;
  }
}

interface QueryFilters {
  instrument?: string;
  outcome?: 'win' | 'loss';
  dateFrom?: string;
  includeMissed?: boolean;
}
```

### Benefits of SQL-Based Retrieval

1. **Zero embedding infrastructure** - no vector DB, no embedding model calls
2. **Precise queries** - exact instrument, date range, outcome filters
3. **Aggregations built-in** - specialist accuracy is a GROUP BY query
4. **Joins preserve relationships** - postmortem → recommendation → specialist analysis
5. **Fast** - SQL indexes are highly optimized
6. **Debuggable** - you can run the queries directly and see what context is built

### Learning Conversation Interface

The Learning component includes a chat interface for exploring and contributing to the knowledge base:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  LEARNING                                                      [Expand ↗]   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Win Rate: 68% | Calibration: -2% (underconfident)                          │
│  Lessons: • NVDA volatility baseline higher than other tech                 │
│  Missed Opportunities (3):  [Review]                                        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  💬 LEARNING CONVERSATION                              [Full Screen] │   │
│  │                                                                      │   │
│  │  You: Why did we miss the TSLA rally on Jan 3?                       │   │
│  │                                                                      │   │
│  │  Agent: Looking at the Jan 3 missed opportunity for TSLA...          │   │
│  │  The pre-filter caught a 4.2% move but the triage agents rejected    │   │
│  │  it because:                                                          │   │
│  │  - Novelty: Marked as "routine volatility" (false negative)          │   │
│  │  - Magnitude: Passed (correctly)                                      │   │
│  │  - Context: Passed (correctly)                                        │   │
│  │                                                                      │   │
│  │  The signal was Elon's tweet about FSD v13. Our agenda detection      │   │
│  │  flagged it as potential manipulation but that suppressed it.         │   │
│  │                                                                      │   │
│  │  You: The FSD tweets always move TSLA. Can we learn that?            │   │
│  │                                                                      │   │
│  │  Agent: Good insight. I can add this to the context:                  │   │
│  │  "TSLA: FSD-related tweets from @elonmusk historically correlate     │   │
│  │  with 3-8% moves within 24h. Do not filter as manipulation."          │   │
│  │                                                                      │   │
│  │  [Apply to Context] [Modify] [Dismiss]                               │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  [Type your question or insight...]                          [Send]  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Learning Conversation Service

```typescript
@Injectable()
export class LearningConversationService {
  constructor(
    private readonly contextBuilder: LearningContextBuilderService,
    private readonly llmService: LLMService,
    private readonly supabase: SupabaseService,
    private readonly contextUpdateService: AgentContextUpdateService,
  ) {}

  /**
   * Process a user message in the learning conversation
   */
  async processMessage(
    agentSlug: string,
    userMessage: string,
    conversationHistory: Message[],
  ): Promise<LearningResponse> {
    // 1. Build context from SQL queries (not RAG!)
    const learningContext = await this.contextBuilder.buildContext(agentSlug, userMessage);

    // 2. Get current agent context for reference
    const { data: agent } = await this.supabase.getServiceClient()
      .from('agents')
      .select('context, config_json')
      .eq('slug', agentSlug)
      .single();

    // 3. Build prompt for learning conversation
    const prompt = this.buildLearningPrompt(
      userMessage,
      learningContext,
      conversationHistory,
      agent.context,
    );

    // 4. Get LLM response using configured model for learningAssistant stage
    const { provider, model } = this.modelConfigService.getModelForStage(
      agent,
      'learningAssistant',
    );

    const response = await this.llmService.chat({
      provider,
      model,
      messages: [{ role: 'user', content: prompt }],
      executionContext: this.executionContext,
    });

    // 5. Parse response for context update suggestions
    const parsed = this.parseResponse(response.content);

    return {
      message: parsed.message,
      suggestedContextUpdate: parsed.contextUpdate,
    };
  }

  /**
   * Apply a suggested context update
   */
  async applyContextUpdate(
    agentSlug: string,
    update: ContextUpdate,
    userApproved: boolean,
  ): Promise<void> {
    if (!userApproved) {
      // Store as dismissed suggestion
      await this.storeUserInsight(agentSlug, {
        content: update.content,
        source: 'conversation',
        dismissed: true,
        dismiss_reason: 'User dismissed',
      });
      return;
    }

    // Apply the update to agent context
    await this.contextUpdateService.appendToContext(agentSlug, {
      section: update.targetSection,
      content: update.content,
      source: 'learning_conversation',
      timestamp: new Date(),
    });

    // Store as applied insight
    await this.storeUserInsight(agentSlug, {
      content: update.content,
      source: 'conversation',
      target_section: update.targetSection,
      applied_to_context: true,
    });
  }

  private buildLearningPrompt(
    userMessage: string,
    learningContext: string,  // From SQL queries, not RAG
    history: Message[],
    currentContext: string,
  ): string {
    return `
You are a learning assistant for a prediction agent. Your role is to:
1. Answer questions about past predictions, outcomes, and missed opportunities
2. Identify patterns in wins, losses, and misses
3. Suggest context updates that could improve future predictions

## Current Agent Context (Summary)
${currentContext.slice(0, 2000)}...

## Relevant Data (from predictions database)
${learningContext}

## Conversation History
${history.map(m => `${m.role}: ${m.content}`).join('\n')}

## Current User Message
${userMessage}

## Instructions
1. Answer the user's question using the data provided
2. If the user provides an insight, acknowledge it and suggest how it could be added to the agent's context
3. For context updates, format them clearly with [CONTEXT_UPDATE] tags:

[CONTEXT_UPDATE]
target_section: triage|specialists|evaluators|pre_filter
content: The specific text to add to the context
[/CONTEXT_UPDATE]

Be specific and actionable. Reference actual data from the postmortems and stats.
    `.trim();
  }
}
```

### Context Update Flow

When a user provides an insight or the system identifies a pattern, the context can be updated:

```typescript
interface ContextUpdate {
  targetSection: 'triage' | 'specialists' | 'evaluators' | 'pre_filter' | 'general';
  content: string;
  source: 'learning_conversation' | 'automated_postmortem' | 'missed_opportunity_analysis';
}

@Injectable()
export class AgentContextUpdateService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Append learning to specific section of agent context
   */
  async appendToContext(agentSlug: string, update: ContextUpdate): Promise<void> {
    // Fetch agent with BOTH context and metadata (separate columns)
    const { data: agent, error } = await this.supabase.getServiceClient()
      .from('agents')
      .select('context, metadata')
      .eq('slug', agentSlug)
      .single();

    if (error || !agent) {
      throw new Error(`Agent not found: ${agentSlug}`);
    }

    // Parse existing context sections
    const sections = this.parseContextSections(agent.context);

    // Append to appropriate section
    const learningSection = sections.learned_patterns || '';
    const newLearning = `
### Learning from ${update.source} (${new Date().toISOString().split('T')[0]})
${update.content}
`;

    sections.learned_patterns = learningSection + newLearning;

    // Also add to specific section if applicable
    if (update.targetSection !== 'general') {
      const targetSection = sections[update.targetSection] || '';
      sections[update.targetSection] = targetSection + `\n\n**Learned:** ${update.content}`;
    }

    // Reconstruct and save context
    const newContext = this.reconstructContext(sections);

    // IMPORTANT: Merge with agent.metadata (NOT config_json.metadata)
    // metadata = runtime state, config_json = user settings
    const currentCount = agent.metadata?.context_update_count;
    if (currentCount === undefined) {
      throw new Error(`Agent ${agentSlug} missing metadata.context_update_count - check agent initialization`);
    }

    await this.supabase.getServiceClient()
      .from('agents')
      .update({
        context: newContext,
        metadata: {
          ...agent.metadata,  // MERGE existing metadata
          last_context_update: new Date().toISOString(),
          context_update_count: currentCount + 1,
        },
      })
      .eq('slug', agentSlug);
  }
}
```

### Conversation Types

| Type | Trigger | Example |
|------|---------|---------|
| **Interrogation** | User asks about past events | "Why did we miss X?" |
| **Pattern Discovery** | User or system identifies pattern | "I notice we always lose on Mondays" |
| **Insight Contribution** | User provides domain knowledge | "Elon tweets always move TSLA" |
| **Context Review** | User reviews learned patterns | "Show me what we've learned about NVDA" |
| **Correction** | User corrects a learned pattern | "Actually, that rule only applies to earnings week" |

### API Endpoints for Learning Conversation

```typescript
// Start or continue learning conversation
POST /api/agents/:slug/learning/chat
Body: { message: string, conversationId?: string }
Returns: { response: string, suggestedUpdate?: ContextUpdate }

// Apply a context update
POST /api/agents/:slug/learning/apply-update
Body: { updateId: string, approved: boolean, modified?: string }
Returns: { success: boolean, newContextVersion: number }

// Get learning stats (from SQL aggregations)
GET /api/agents/:slug/learning/stats
Returns: {
  winRate: number,
  postmortemCount: number,
  missedCount: number,
  insightCount: number,
  specialistAccuracy: { [name: string]: number }
}

// Get applied insights
GET /api/agents/:slug/learning/insights
Returns: { insights: UserInsight[] }
```

### Dashboard Learning Component (Expanded)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  LEARNING DASHBOARD                                            [Collapse ↙] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STATS                                                               │   │
│  │  Win Rate: 68% | Calibration: -2% | Total Learnings: 47              │   │
│  │  Postmortems: 32 | Missed Ops: 12 | User Insights: 3                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  LEARNED PATTERNS                                          [Edit All] │   │
│  │                                                                      │   │
│  │  📚 Triage Rules (4 learned)                                         │   │
│  │  • TSLA: FSD tweets are not manipulation, pass through               │   │
│  │  • NVDA: Baseline volatility is 3%, use 5% threshold                 │   │
│  │  • All: Ignore pre-market moves <2%                                  │   │
│  │  • AAPL: Product launches require 24h cooldown                       │   │
│  │                                                                      │   │
│  │  📚 Specialist Adjustments (2 learned)                               │   │
│  │  • Technical team overweights NVDA momentum                          │   │
│  │  • Sentiment team underweights Twitter for MSFT                      │   │
│  │                                                                      │   │
│  │  📚 Evaluator Calibrations (1 learned)                               │   │
│  │  • Confidence calibrator adds +5% for fundamentally strong stocks    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  CONVERSATION                                                        │   │
│  │  [Full chat interface here - scrollable]                             │   │
│  │                                                                      │   │
│  │  ...                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  RECENT ACTIVITY                                                     │   │
│  │  • Jan 7: Applied insight "FSD tweets are not manipulation"          │   │
│  │  • Jan 6: Ingested 3 postmortems, 1 missed opportunity               │   │
│  │  • Jan 5: User reviewed NVDA learnings                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 0: Contracts & Wiring (FOUNDATION)

**Goal**: Establish all interfaces and contracts before writing implementation code.

1. **Core Type Definitions** (`base-prediction.types.ts`)
   - `Claim`, `Source`, `Datapoint` interfaces
   - `ClaimBundle`, `EnrichedClaimBundle` interfaces
   - `RunnerInput`, `RunnerOutput` contracts
   - `PredictionRunnerConfig` interface

2. **Claim Processor Contract**
   - `ClaimProcessor` interface with `groupClaims()`, `enrichWithHistory()`, `shouldProceedToSpecialists()`
   - Default implementation in `DefaultClaimProcessor`

3. **Runner Registry Contract**
   - `RUNNER_REGISTRY` mapping runner keys to classes
   - `RunnerFactoryService` interface and implementation

4. **LLM Config Contract**
   - No hardcoded model names - all from `LLMService` config
   - Model keys: `triage`, `specialist`, `evaluator`, `calibrator`

5. **Metadata vs Config Contract**
   - Document which fields go in `config_json` vs `metadata`
   - Ensure all metadata updates use merge pattern

**Gate A**: All interfaces defined, can instantiate a no-op runner that loads agent config and returns empty result.

### Phase 1: Base Infrastructure

1. Copy `PostgresCheckpointerService` to API app
2. Create `BasePredictionRunnerService` with embedded LangGraph
3. Create generic state annotation (`PredictionStateAnnotation`)
4. Create `DefaultClaimProcessor` with grouping and enrichment
5. Create `PredictionDbService` with schema injection
6. Create `RunnerFactoryService` with registry lookup
7. Create `AmbientAgentOrchestratorService` (can start/stop agents)

**Gate B**: One agent can run one poll cycle and persist a datapoint with checkpointer state.

### Phase 2: Stock Predictor (Vertical Slice)

1. Create `StockPredictorRunnerService` extending base
2. Implement 1-2 real tools (Yahoo Finance, Alpha Vantage)
3. Run database migrations for `predictions` schema
4. Create one stock agent in database
5. Wire dashboard "Current State" component to read recommendations

**Gate C**: UI can display "Current State" from real stored recommendations for one stock agent.

### Phase 3: Expand Domain + UI

1. Finish remaining stock tools (Bloomberg, Reuters, SEC)
2. Implement dashboard components (Instruments, History, Tools, Config)
3. Create API endpoints with auth for all components
4. Add crypto domain after stock patterns are proven

### Phase 4: Learning + Outcomes

1. Implement `OutcomeEvaluationService` (domain-aware)
2. Implement `PostmortemService`
3. Implement `MissedOpportunityService`
4. Create `LearningContextBuilderService` with SQL queries
5. Create `LearningConversationService`
6. Wire learning to update agent context

**Gate D**: Learning queries work with correct joins; at least one applied insight stored.

### Phase 5: Migration & Polish

1. Create migration script for existing finance universes → agents
2. A/B test old Finance Agent vs new Stock Predictor Runner
3. Switch over when parity achieved
4. Deprecate old Finance Agent code
5. Add Polymarket runner after stock runner is stable

---

## Database Migration Strategy

### New Schema: `predictions`

All prediction-related tables live in the `predictions` schema (separate from existing `public` and `rag_data` schemas).

```sql
-- Migration 1: Create schema and types
CREATE SCHEMA IF NOT EXISTS predictions;
CREATE TYPE predictions.domain_type AS ENUM ('stock', 'crypto', 'polymarket', 'election');

-- Migration 2: Core tables
-- datapoints, runs, triage_results, specialist_analyses, evaluator_challenges

-- Migration 3: Recommendations and outcomes
-- recommendations, outcomes

-- Migration 4: Learning loop tables
-- postmortems, missed_opportunities, user_insights

-- Migration 5: Database functions
-- get_specialist_accuracy(p_agent_slug TEXT, p_instrument TEXT)
-- get_postmortems_with_instrument(p_agent_slug TEXT, p_outcome TEXT)
```

### Migration Files

```
apps/api/supabase/migrations/predictions/
├── 20250108000001_create_predictions_schema.sql
├── 20250108000002_create_core_tables.sql
├── 20250108000003_create_recommendation_tables.sql
├── 20250108000004_create_learning_tables.sql
├── 20250108000005_create_database_functions.sql
└── 20250108000006_create_indexes_and_rls.sql
```

### RLS Policy

Predictions tables use **service role only** access (no direct client access):

```sql
-- All tables in predictions schema use service_role
ALTER TABLE predictions.datapoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON predictions.datapoints
  FOR ALL USING (auth.role() = 'service_role');
```

### Existing Data Migration

The existing Finance Agent stores data in different tables. Migration script:

```typescript
// scripts/migrate-finance-to-predictions.ts
async function migrateFinanceUniverses() {
  // 1. For each universe in old finance tables:
  //    - Create agent record with runner: 'stock-predictor'
  //    - Copy instruments to config_json.instruments

  // 2. For each recommendation in old tables:
  //    - Create corresponding predictions.recommendations record
  //    - Map old fields to new schema

  // 3. Verify counts match

  // 4. Mark old records as migrated (don't delete yet)
}
```

---

## API Endpoints & Authorization

### Authentication

All prediction API endpoints require JWT authentication via Supabase Auth:

```typescript
@Controller('api/agents')
@UseGuards(JwtAuthGuard)  // Validates JWT from Supabase
export class AgentPredictionController {
  // All routes require valid JWT
}
```

### Organization Scoping

Agents are scoped to organizations. Users can only access agents in their org:

```typescript
@Get(':slug/predictions/current')
async getCurrentPredictions(
  @Param('slug') slug: string,
  @CurrentUser() user: User,  // From JWT
) {
  // Verify user has access to this agent's org
  const agent = await this.agentService.getBySlug(slug);
  if (!agent.organization_slug.includes(user.orgSlug)) {
    throw new ForbiddenException();
  }
  // ...
}
```

### Endpoint Specifications

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/agents/:slug/predictions/current` | GET | JWT | Current recommendations |
| `/api/agents/:slug/predictions/history` | GET | JWT | Historical predictions with pagination |
| `/api/agents/:slug/instruments` | GET/PUT | JWT | Read/update instruments |
| `/api/agents/:slug/tools` | GET | JWT | Tool status and recent claims |
| `/api/agents/:slug/config` | GET/PUT | JWT | Agent configuration |
| `/api/agents/:slug/learning/chat` | POST | JWT | Learning conversation |
| `/api/agents/:slug/learning/stats` | GET | JWT | Win rate, accuracy stats |
| `/api/agents/:slug/status` | GET | JWT | Runtime status (running/paused) |
| `/api/agents/:slug/start` | POST | JWT | Start polling |
| `/api/agents/:slug/stop` | POST | JWT | Stop polling |
| `/api/agents/:slug/pause` | POST | JWT | Pause (keeps config) |
| `/api/agents/:slug/resume` | POST | JWT | Resume polling |
| `/api/agents/:slug/poll-now` | POST | JWT | Trigger immediate poll |

### Response Shapes

```typescript
// GET /api/agents/:slug/predictions/current
interface CurrentPredictionsResponse {
  datapoint: {
    id: string;
    capturedAt: string;
    claimCount: number;
  } | null;
  recommendations: {
    instrument: string;
    action: 'buy' | 'sell' | 'hold';
    confidence: number;
    rationale: string;
    createdAt: string;
  }[];
  lastPollAt: string;
}

// GET /api/agents/:slug/predictions/history
interface HistoryResponse {
  items: {
    id: string;
    instrument: string;
    action: string;
    confidence: number;
    outcome?: 'win' | 'loss' | 'pending';
    actualReturn?: number;
    createdAt: string;
  }[];
  total: number;
  hasMore: boolean;
}

// GET /api/agents/:slug/learning/stats
interface LearningStatsResponse {
  winRate: number;
  calibration: number;  // Positive = overconfident, negative = underconfident
  totalPredictions: number;
  postmortemCount: number;
  missedOpportunityCount: number;
  specialistAccuracy: Record<string, number>;
}
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Code reuse across domains | >70% shared in base runner |
| Time to add new domain | <1 week |
| Agent config editability | 100% via agent pane components |
| Learning loop functional | Lessons affect future predictions |
| Pre-filter efficiency | >80% events filtered (no LLM cost) |
| Triage efficiency | >50% filtered at triage stage |
| UI component completeness | All admin functions in agent pane |

---

## Migration Strategy

1. **Keep existing Finance Agent** operational during migration
2. **Build new Stock Predictor Runner** in parallel
3. **Create migration script** to convert existing universes to agents
4. **A/B test** old vs new for 2 weeks
5. **Switch over** when new runner matches or exceeds performance
6. **Deprecate** old Finance Agent code

---

## Appendix: Key Differences from Finance Agent v2 PRD

| Aspect | Finance Agent v2 | Market Prediction Runner |
|--------|------------------|--------------------------|
| Location | LangGraph app | API app (embedded LangGraph) |
| Architecture | Monolithic service | Runner inheritance hierarchy |
| Configuration | Hardcoded | Database (agent config_json) |
| Domains | Stocks only | Stocks, Crypto, Polymarket |
| Universe model | Separate concept | Universe = Agent |
| Extensibility | Requires code changes | Config + new connector |
| Pre-filter | Fixed thresholds | Domain-specific function |
| Specialists | Fixed 12 | Configurable per domain |

---

## Testing Strategy

Testing is **mandatory for every phase**. No phase is considered complete until all tests pass. This section defines the three layers of testing required.

### Testing Principles (Project-Wide)

1. **E2E Tests = NO MOCKING** - E2E tests use real database, real API calls, real authentication
2. **Use Supabase Test User** - Always authenticate with real credentials from `.env`
3. **Test Coverage Target** - Minimum 80% coverage for new code
4. **Tests Must Pass Before Merge** - CI blocks PRs with failing tests
5. **Each Phase Has Test Requirements** - Listed below per phase

### Test User Credentials

```bash
# From .env - ALWAYS use these, never hardcode
SUPABASE_TEST_USER=demo.user@playground.com
SUPABASE_TEST_PASSWORD=demouser
SUPABASE_TEST_USERID=b29a590e-b07f-49df-a25b-574c956b5035

# Alternative (admin)
SUPABASE_TEST_USER=golfergeek@orchestratorai.io
SUPABASE_TEST_PASSWORD=GolferGeek123!
```

### Layer 1: Unit Tests (Jest)

Unit tests for all services, nodes, and utilities. **No external dependencies** - these can mock.

#### Base Runner Unit Tests

```
apps/api/src/agent2agent/runners/prediction/base/
├── __tests__/
│   ├── base-prediction-runner.service.spec.ts
│   ├── base-prediction.state.spec.ts
│   ├── claim-processor.spec.ts
│   ├── nodes/
│   │   ├── poll-data.node.spec.ts
│   │   ├── pre-filter.node.spec.ts
│   │   ├── triage.node.spec.ts
│   │   ├── specialists.node.spec.ts
│   │   ├── evaluators.node.spec.ts
│   │   └── package-output.node.spec.ts
│   └── services/
│       ├── prediction-db.service.spec.ts
│       ├── learning-context.service.spec.ts
│       ├── outcome-evaluation.service.spec.ts
│       ├── postmortem.service.spec.ts
│       ├── missed-opportunity.service.spec.ts
│       └── model-config.service.spec.ts
```

#### Domain Runner Unit Tests

```
apps/api/src/agent2agent/runners/prediction/stock-predictor/
├── __tests__/
│   ├── stock-predictor-runner.service.spec.ts
│   ├── stock-claim-processor.spec.ts
│   └── tools/
│       ├── yahoo-finance.tool.spec.ts
│       ├── alpha-vantage.tool.spec.ts
│       ├── bloomberg-news.tool.spec.ts
│       └── sec-filings.tool.spec.ts
```

#### Example Unit Test

```typescript
// base-prediction-runner.service.spec.ts
describe('BasePredictionRunnerService', () => {
  describe('execute', () => {
    it('should throw if agent not found', async () => {
      mockSupabase.from.mockReturnValue({
        select: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) }),
      });

      await expect(runner.execute({ agentSlug: 'nonexistent' }))
        .rejects.toThrow('Agent not found: nonexistent');
    });

    it('should throw if pollInterval missing', async () => {
      mockSupabase.from.mockReturnValue({
        select: () => ({ eq: () => ({ single: () => ({
          data: { slug: 'test', config_json: {} },  // No pollInterval
          error: null,
        }) }) }),
      });

      await expect(runner.startAgent('test'))
        .rejects.toThrow('missing required config_json.pollInterval');
    });

    it('should use configured model for stage', async () => {
      const agent = {
        slug: 'test',
        config_json: {
          pollInterval: 60000,
          modelConfig: { triage: { provider: 'openai', model: '<configured-triage-model>' } },
        },
      };

      const model = modelConfigService.getModelForStage(agent, 'triage');
      expect(model).toEqual({ provider: 'openai', model: '<configured-triage-model>' });
    });
  });
});
```

### Layer 2: API E2E Tests (curl Scripts)

Real HTTP requests to running API. **NO MOCKING** - uses real database and real authentication.

#### Test Script Location

```
apps/api/testing/scripts/prediction-runner/
├── test-base-runner-curl.sh           # Base runner contract tests
├── test-stock-predictor-curl.sh       # Stock domain E2E
├── test-crypto-predictor-curl.sh      # Crypto domain E2E
├── test-market-predictor-curl.sh      # Polymarket domain E2E
├── test-prediction-lifecycle-curl.sh  # Full lifecycle (start → poll → recommend → outcome)
├── test-learning-conversation-curl.sh # HITL learning session
├── test-agent-model-config-curl.sh    # Admin model config (requires admin auth)
└── common/
    ├── auth-helper.sh                 # Get JWT token
    ├── assert-helper.sh               # Response assertions
    └── cleanup-helper.sh              # Test data cleanup
```

#### Example curl Test Script

```bash
#!/bin/bash
# test-stock-predictor-curl.sh
# E2E tests for Stock Predictor Runner API

set -e
source "$(dirname "$0")/common/auth-helper.sh"
source "$(dirname "$0")/common/assert-helper.sh"

# ============================================================================
# Setup: Authenticate with REAL Supabase test user
# ============================================================================
echo "🔐 Authenticating with real test user..."
TOKEN=$(get_auth_token)
if [ -z "$TOKEN" ]; then
  echo "❌ FAILED: Could not authenticate. Is Supabase running?"
  exit 1
fi
echo "✅ Authenticated"

# ============================================================================
# Test 1: Create test agent
# ============================================================================
echo "📝 Creating test stock predictor agent..."
AGENT_SLUG="test-stock-predictor-$(date +%s)"

# Create/update the agent via admin endpoint (requires agents:admin permission)
# NOTE: This assumes the agent admin DTO supports config_json for prediction agents.
RESPONSE=$(curl -s -X POST "${API_URL}/api/admin/agents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"slug\": \"$AGENT_SLUG\",
    \"display_name\": \"Test Stock Predictor\",
    \"agent_type\": \"prediction\",
    \"organization_slug\": [\"finance\"],
    \"department\": \"finance\",
    \"description\": \"E2E test stock prediction agent\",
    \"capabilities\": [\"prediction\"],
    \"io_schema\": {},
    \"context\": \"\",
    \"config_json\": {
      \"runner\": \"stock-predictor\",
      \"instruments\": [\"AAPL\", \"MSFT\"],
      \"pollInterval\": 60000,
      \"modelConfig\": {
        \"triage\": { \"provider\": \"anthropic\", \"model\": \"<configured-triage-model>\" }
      }
    }
  }")

assert_field_equals "$RESPONSE" ".slug" "$AGENT_SLUG"
echo "✅ Agent created: $AGENT_SLUG"

# ============================================================================
# Test 2: Start agent polling
# ============================================================================
echo "▶️ Starting agent..."
RESPONSE=$(curl -s -X POST "${API_URL}/api/agents/$AGENT_SLUG/start" \
  -H "Authorization: Bearer $TOKEN")

assert_field_equals "$RESPONSE" ".metadata.runtime_state" "running"
echo "✅ Agent started"

# ============================================================================
# Test 3: Verify poll creates datapoint
# ============================================================================
echo "📊 Waiting for poll cycle..."
sleep 5  # Wait for first poll

RESPONSE=$(curl -s -X GET "${API_URL}/api/agents/$AGENT_SLUG/predictions/current" \
  -H "Authorization: Bearer $TOKEN")

assert_field_exists "$RESPONSE" ".datapoint.id"
echo "✅ Datapoint created"

# ============================================================================
# Test 4: Get history
# ============================================================================
echo "📈 Fetching prediction history..."
RESPONSE=$(curl -s -X GET "${API_URL}/api/agents/$AGENT_SLUG/predictions/history" \
  -H "Authorization: Bearer $TOKEN")

assert_field_is_array "$RESPONSE" ".items"
echo "✅ History endpoint works"

# ============================================================================
# Test 5: Stop agent
# ============================================================================
echo "⏹️ Stopping agent..."
RESPONSE=$(curl -s -X POST "${API_URL}/api/agents/$AGENT_SLUG/stop" \
  -H "Authorization: Bearer $TOKEN")

assert_field_equals "$RESPONSE" ".metadata.runtime_state" "stopped"
echo "✅ Agent stopped"

# ============================================================================
# Cleanup: Delete test agent
# ============================================================================
echo "🧹 Cleaning up..."
curl -s -X DELETE "${API_URL}/api/agents/$AGENT_SLUG" \
  -H "Authorization: Bearer $TOKEN" > /dev/null

echo ""
echo "============================================"
echo "✅ ALL TESTS PASSED: Stock Predictor E2E"
echo "============================================"
```

#### auth-helper.sh

```bash
#!/bin/bash
# common/auth-helper.sh - Real authentication helper

get_auth_token() {
  local EMAIL="${SUPABASE_TEST_USER:-demo.user@playground.com}"
  local PASSWORD="${SUPABASE_TEST_PASSWORD:-demouser}"
  local SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:54321}"
  local SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY}"

  # Real authentication - NO MOCKS
  RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}")

  echo "$RESPONSE" | jq -r '.access_token'
}
```

### Layer 3: UI E2E Tests (Claude in Chrome + Cypress)

#### Option A: Claude Code + Chrome Extension

Use Claude Code's browser integration for AI-assisted UI testing:

```bash
# Start Claude Code with Chrome integration
claude --chrome

# Then tell Claude to test the UI:
# "Navigate to the prediction agent dashboard for us-tech-stocks-2025
#  and verify:
#  1. Current state component shows latest recommendations
#  2. Instruments list shows AAPL, MSFT, GOOGL
#  3. Model config shows admin-only edit for non-admin users
#  4. Start/Pause/Stop controls work correctly"
```

**Requirements:**
- Claude Code v2.0.73+
- Claude in Chrome extension v1.0.36+
- Paid Claude plan (Pro/Max/Team/Enterprise)
- See: [Claude Code Chrome docs](https://code.claude.com/docs/en/chrome)

#### Option B: Cypress Automated Tests

Traditional Cypress tests for repeatable UI automation:

```
apps/web/tests/e2e/specs/prediction-agent/
├── dashboard.cy.ts           # Dashboard component tests
├── instruments.cy.ts         # Instrument management
├── model-config.cy.ts        # Model config (admin tests)
├── learning-conversation.cy.ts # HITL session
├── lifecycle-controls.cy.ts  # Start/Stop/Pause
└── history.cy.ts             # Prediction history view
```

#### Example Cypress Test

```typescript
// dashboard.cy.ts
describe('Prediction Agent Dashboard', () => {
  beforeEach(() => {
    // Real authentication via Supabase
    cy.login(Cypress.env('SUPABASE_TEST_USER'), Cypress.env('SUPABASE_TEST_PASSWORD'));
    cy.visit('/agents/us-tech-stocks-2025');
  });

  it('should display current state component with recommendations', () => {
    cy.get('[data-testid="current-state-component"]').should('be.visible');
    cy.get('[data-testid="recommendation-card"]').should('have.length.at.least', 1);
  });

  it('should show instruments list', () => {
    cy.get('[data-testid="instruments-component"]').should('be.visible');
    cy.get('[data-testid="instrument-chip"]').should('contain', 'AAPL');
  });

  it('should allow admin to edit model config', () => {
    // Login as admin
    cy.login(Cypress.env('ADMIN_USER'), Cypress.env('ADMIN_PASSWORD'));
    cy.visit('/agents/us-tech-stocks-2025');

    cy.get('[data-testid="model-config-edit-btn"]').should('be.visible').click();
    cy.get('[data-testid="triage-provider-select"]').select('openai');
    cy.get('[data-testid="save-model-config"]').click();

    cy.get('[data-testid="toast-success"]').should('contain', 'Model config saved');
  });

  it('should hide edit button for non-admin users', () => {
    // Regular user login (from beforeEach)
    cy.get('[data-testid="model-config-edit-btn"]').should('not.exist');
    cy.get('[data-testid="model-config-view"]').should('be.visible');
  });
});
```

### Phase-Specific Test Requirements

#### Phase 0: Contracts & Wiring

| Test Type | Required Tests |
|-----------|---------------|
| **Unit** | `BasePredictionRunnerService` contract methods, `ModelConfigService` |
| **E2E** | None (no endpoints yet) |
| **UI** | None (no UI yet) |

**Gate**: All unit tests pass, coverage >80%

#### Phase 1: Base Runner + Stock Tools

| Test Type | Required Tests |
|-----------|---------------|
| **Unit** | All node specs, `PredictionDbService`, tool specs |
| **E2E** | `test-stock-predictor-curl.sh` - create agent, start/stop lifecycle |
| **UI** | None (dashboard in Phase 3) |

**Gate**: E2E script passes with real agent creation and lifecycle

#### Phase 2: Full Pipeline + DB

| Test Type | Required Tests |
|-----------|---------------|
| **Unit** | Triage node, specialist node, evaluator node, packaging node |
| **E2E** | `test-prediction-lifecycle-curl.sh` - full poll → recommend → store |
| **UI** | None |

**Gate**: Full pipeline produces recommendation stored in DB

#### Phase 3: UI Components

| Test Type | Required Tests |
|-----------|---------------|
| **Unit** | Vue component unit tests (Vitest) |
| **E2E** | `test-agent-dashboard-curl.sh` - API for UI data |
| **UI** | `dashboard.cy.ts`, `instruments.cy.ts`, `lifecycle-controls.cy.ts` |

**Gate**: Cypress tests pass, Claude in Chrome can navigate dashboard

#### Phase 4: Learning Loop

| Test Type | Required Tests |
|-----------|---------------|
| **Unit** | `LearningContextBuilderService`, `LearningConversationService`, `AgentContextUpdateService` |
| **E2E** | `test-learning-conversation-curl.sh` - full HITL session |
| **UI** | `learning-conversation.cy.ts` |

**Gate**: Context update persists and affects next prediction

#### Phase 5: Additional Domains

| Test Type | Required Tests |
|-----------|---------------|
| **Unit** | Domain-specific tools, claim processors |
| **E2E** | `test-crypto-predictor-curl.sh`, `test-market-predictor-curl.sh` |
| **UI** | Same Cypress tests work for all domains |

**Gate**: All domain runners produce valid recommendations

### Running Tests

```bash
# Unit tests (fast, can run anytime)
npm run test:api -- --testPathPattern=prediction

# E2E curl tests (requires running services)
cd apps/api/testing/scripts/prediction-runner
./test-stock-predictor-curl.sh

# Cypress UI tests
cd apps/web
npm run cypress:run -- --spec "tests/e2e/specs/prediction-agent/**/*.cy.ts"

# Claude in Chrome (interactive)
claude --chrome
# Then: "Test the prediction agent dashboard for us-tech-stocks-2025"

# All prediction tests (CI pipeline)
npm run test:prediction:all
```

### CI Pipeline Integration

```yaml
# .github/workflows/prediction-runner-tests.yml
name: Prediction Runner Tests

on:
  push:
    paths:
      - 'apps/api/src/agent2agent/runners/prediction/**'
      - 'apps/web/src/components/AgentPanes/Prediction/**'

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:api -- --testPathPattern=prediction --coverage
      - name: Check coverage
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "Coverage $COVERAGE% is below 80%"
            exit 1
          fi

  e2e-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: supabase/postgres:15.1.0.147
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run dev:supabase &
      - run: npm run dev:api &
      - run: sleep 30  # Wait for services
      - run: |
          cd apps/api/testing/scripts/prediction-runner
          for script in test-*.sh; do
            echo "Running $script..."
            ./$script || exit 1
          done

  cypress-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run dev:all &
      - run: sleep 60
      - run: npm run cypress:run -- --spec "tests/e2e/specs/prediction-agent/**"
```

### Test Coverage Targets

| Component | Target | Current |
|-----------|--------|---------|
| Base Runner | 85% | TBD |
| Stock Tools | 80% | TBD |
| Prediction DB Service | 90% | TBD |
| Learning Services | 85% | TBD |
| Vue Dashboard Components | 75% | TBD |
| API Endpoints | 100% (E2E) | TBD |

---

*This PRD supersedes the Finance Agent v2 enhancements for the core prediction pipeline. The learning loop, HITL sessions, and UI components from that PRD remain valid and should be implemented on top of this runner architecture.*
