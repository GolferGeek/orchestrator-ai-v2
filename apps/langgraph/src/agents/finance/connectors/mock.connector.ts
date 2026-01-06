/**
 * Mock Connectors
 *
 * Development/testing connectors that generate realistic-looking mock data.
 * Useful when external APIs are unavailable or for testing the pipeline.
 */

import { MarketDataConnector, NewsConnector } from "./connector.interface";
import { MarketBar, NewsItem } from "../finance.state";
import { v4 as uuidv4 } from "uuid";

/**
 * Mock market data connector
 * Generates realistic price movements based on random walks
 */
export class MockMarketDataConnector implements MarketDataConnector {
  readonly name = "mock-market";
  private basePrices: Map<string, number> = new Map();

  isConfigured(): boolean {
    return true;
  }

  async fetchBars(
    symbols: string[],
    since: string,
    until?: string,
  ): Promise<MarketBar[]> {
    const bars: MarketBar[] = [];
    const startDate = new Date(since);
    const endDate = until ? new Date(until) : new Date();

    for (const symbol of symbols) {
      // Initialize or get base price
      if (!this.basePrices.has(symbol)) {
        // Generate realistic base price based on symbol
        const seed = symbol
          .split("")
          .reduce((acc, char) => acc + char.charCodeAt(0), 0);
        this.basePrices.set(symbol, 50 + (seed % 450)); // Range: 50-500
      }

      let price = this.basePrices.get(symbol)!;
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        // Skip weekends
        if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
          // Random walk with mean reversion
          const dailyReturn = (Math.random() - 0.5) * 0.04; // +/- 2% daily
          const meanReversion = (this.basePrices.get(symbol)! - price) * 0.01; // Pull towards base
          price = price * (1 + dailyReturn + meanReversion);

          // Generate intraday range
          const volatility = 0.01 + Math.random() * 0.02; // 1-3% intraday range
          const open = price * (1 + (Math.random() - 0.5) * volatility);
          const close = price;
          const high = Math.max(open, close) * (1 + Math.random() * volatility);
          const low = Math.min(open, close) * (1 - Math.random() * volatility);

          bars.push({
            id: uuidv4(),
            instrument: symbol,
            ts: new Date(currentDate).toISOString(),
            open: parseFloat(open.toFixed(2)),
            high: parseFloat(high.toFixed(2)),
            low: parseFloat(low.toFixed(2)),
            close: parseFloat(close.toFixed(2)),
            volume: Math.floor(1000000 + Math.random() * 10000000),
            vendor: this.name,
          });
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    return bars.sort(
      (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime(),
    );
  }

  async fetchQuotes(symbols: string[]): Promise<MarketBar[]> {
    // Just return the most recent bar
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const bars = await this.fetchBars(symbols, since);

    const latestBars: MarketBar[] = [];
    for (const symbol of symbols) {
      const symbolBars = bars.filter((b) => b.instrument === symbol);
      if (symbolBars.length > 0) {
        latestBars.push(symbolBars[0]);
      }
    }

    return latestBars;
  }
}

/**
 * Mock news connector
 * Generates realistic financial news headlines
 */
export class MockNewsConnector implements NewsConnector {
  readonly name = "mock-news";

  private readonly templates = [
    {
      title: "{company} reports {direction} quarterly earnings",
      snippet:
        "{company} announced {direction} than expected quarterly results, with revenue {change} from the previous quarter.",
    },
    {
      title: "Fed officials signal {policy} on interest rates",
      snippet:
        "Federal Reserve officials indicated a {policy} stance on monetary policy amid {economic_condition} concerns.",
    },
    {
      title: "{sector} stocks {movement} amid {catalyst}",
      snippet:
        "The {sector} sector saw significant {movement} today as investors reacted to {catalyst}.",
    },
    {
      title: "Analysts {action} {company} following {event}",
      snippet:
        "Wall Street analysts have {action} their outlook on {company} shares following {event}.",
    },
    {
      title: "{geopolitical} tensions impact global markets",
      snippet:
        "Markets reacted to {geopolitical} developments, with investors seeking {safe_haven} assets.",
    },
    {
      title: "{company} announces {corporate_action}",
      snippet:
        "{company} revealed plans for {corporate_action}, sending shares {price_reaction} in after-hours trading.",
    },
  ];

  private readonly variables: Record<string, string[]> = {
    company: [
      "Apple",
      "Microsoft",
      "Google",
      "Amazon",
      "Tesla",
      "NVIDIA",
      "Meta",
    ],
    direction: ["better", "worse", "stronger", "weaker"],
    change: ["up 5%", "down 3%", "flat", "up 12%", "down 8%"],
    policy: ["hawkish", "dovish", "cautious", "aggressive"],
    economic_condition: ["inflation", "recession", "employment", "growth"],
    sector: ["technology", "energy", "healthcare", "financial", "consumer"],
    movement: ["surge", "decline", "rally", "retreat"],
    catalyst: [
      "earnings reports",
      "regulatory news",
      "merger speculation",
      "guidance updates",
    ],
    action: ["upgraded", "downgraded", "maintained", "initiated coverage on"],
    event: [
      "strong earnings",
      "product launch",
      "management changes",
      "guidance revision",
    ],
    geopolitical: ["Trade war", "Regional conflict", "Diplomatic", "Sanctions"],
    safe_haven: ["safe-haven", "defensive", "traditional", "alternative"],
    corporate_action: [
      "stock buyback",
      "dividend increase",
      "acquisition",
      "spin-off",
    ],
    price_reaction: ["higher", "lower", "sharply higher", "sharply lower"],
  };

  isConfigured(): boolean {
    return true;
  }

  async fetchNews(
    since: string,
    keywords?: string[],
    _sources?: string[],
  ): Promise<NewsItem[]> {
    const newsItems: NewsItem[] = [];
    const sinceDate = new Date(since);
    const now = new Date();
    const hoursOfNews = Math.min(
      Math.floor((now.getTime() - sinceDate.getTime()) / (60 * 60 * 1000)),
      48,
    );

    // Generate 1-3 news items per hour
    for (let h = 0; h < hoursOfNews; h++) {
      const itemsThisHour = 1 + Math.floor(Math.random() * 3);

      for (let i = 0; i < itemsThisHour; i++) {
        const template =
          this.templates[Math.floor(Math.random() * this.templates.length)];
        const title = this.fillTemplate(template.title);
        const snippet = this.fillTemplate(template.snippet);

        // Filter by keywords if provided
        if (keywords && keywords.length > 0) {
          const content = `${title} ${snippet}`.toLowerCase();
          const hasKeyword = keywords.some((kw) =>
            content.includes(kw.toLowerCase()),
          );
          if (!hasKeyword) {
            continue;
          }
        }

        const publishedAt = new Date(
          now.getTime() - h * 60 * 60 * 1000 - Math.random() * 60 * 60 * 1000,
        );

        newsItems.push({
          id: uuidv4(),
          source: this.name,
          publishedAt: publishedAt.toISOString(),
          title,
          snippet,
        });
      }
    }

    return newsItems.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );
  }

  async fetchNewsForInstruments(
    symbols: string[],
    since: string,
  ): Promise<NewsItem[]> {
    // Generate news specifically about these symbols
    const newsItems: NewsItem[] = [];

    for (const symbol of symbols) {
      const items = await this.fetchNews(since, [symbol]);
      // Generate at least one item per symbol
      if (items.length === 0) {
        const template = this.templates[0]; // Use earnings template
        newsItems.push({
          id: uuidv4(),
          source: this.name,
          publishedAt: new Date().toISOString(),
          title: template.title.replace("{company}", symbol),
          snippet: template.snippet.replace("{company}", symbol),
        });
      } else {
        newsItems.push(...items);
      }
    }

    return newsItems;
  }

  private fillTemplate(template: string): string {
    return template.replace(/{(\w+)}/g, (_, varName: string) => {
      const options = this.variables[varName];
      if (options) {
        return options[Math.floor(Math.random() * options.length)];
      }
      return varName;
    });
  }
}
