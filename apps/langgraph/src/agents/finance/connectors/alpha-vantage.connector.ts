/**
 * Alpha Vantage Connector
 *
 * Free tier market data connector using Alpha Vantage API.
 * Requires API key (free tier available).
 * Rate limited to 5 API calls per minute, 500 per day (free tier).
 */

import { MarketDataConnector } from "./connector.interface";
import { MarketBar } from "../finance.state";
import { v4 as uuidv4 } from "uuid";

interface AlphaVantageTimeSeriesResponse {
  "Meta Data"?: {
    "1. Information": string;
    "2. Symbol": string;
    "3. Last Refreshed": string;
  };
  "Time Series (Daily)"?: Record<
    string,
    {
      "1. open": string;
      "2. high": string;
      "3. low": string;
      "4. close": string;
      "5. volume": string;
    }
  >;
  "Global Quote"?: {
    "01. symbol": string;
    "02. open": string;
    "03. high": string;
    "04. low": string;
    "05. price": string;
    "06. volume": string;
    "07. latest trading day": string;
  };
  Note?: string;
  "Error Message"?: string;
}

export class AlphaVantageConnector implements MarketDataConnector {
  readonly name = "alpha-vantage";
  private readonly baseUrl = "https://www.alphavantage.co/query";
  private readonly apiKey: string;

  constructor() {
    this.apiKey = process.env.ALPHA_VANTAGE_API_KEY || "";
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async fetchBars(
    symbols: string[],
    since: string,
    _until?: string,
  ): Promise<MarketBar[]> {
    if (!this.isConfigured()) {
      console.warn("Alpha Vantage: API key not configured");
      return [];
    }

    const bars: MarketBar[] = [];
    const sinceDate = new Date(since);

    for (const symbol of symbols) {
      try {
        // Use TIME_SERIES_DAILY for historical data
        const url = `${this.baseUrl}?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=compact&apikey=${this.apiKey}`;
        const response = await fetch(url);

        if (!response.ok) {
          console.warn(
            `Alpha Vantage: Failed to fetch ${symbol}: ${response.status}`,
          );
          continue;
        }

        const data: AlphaVantageTimeSeriesResponse = await response.json();

        // Check for rate limit or error
        if (data.Note) {
          console.warn(`Alpha Vantage: Rate limit note: ${data.Note}`);
          break; // Stop processing, rate limited
        }

        if (data["Error Message"]) {
          console.warn(
            `Alpha Vantage: Error for ${symbol}: ${data["Error Message"]}`,
          );
          continue;
        }

        const timeSeries = data["Time Series (Daily)"];
        if (!timeSeries) {
          continue;
        }

        for (const [dateStr, values] of Object.entries(timeSeries)) {
          const barDate = new Date(dateStr);
          if (barDate >= sinceDate) {
            bars.push({
              id: uuidv4(),
              instrument: symbol,
              ts: barDate.toISOString(),
              open: parseFloat(values["1. open"]),
              high: parseFloat(values["2. high"]),
              low: parseFloat(values["3. low"]),
              close: parseFloat(values["4. close"]),
              volume: parseInt(values["5. volume"], 10),
              vendor: this.name,
            });
          }
        }

        // Rate limit: wait 12 seconds between requests (5 per minute limit)
        if (symbols.indexOf(symbol) < symbols.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 12000));
        }
      } catch (error) {
        console.error(`Alpha Vantage: Error fetching ${symbol}:`, error);
      }
    }

    return bars;
  }

  async fetchQuotes(symbols: string[]): Promise<MarketBar[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const bars: MarketBar[] = [];

    for (const symbol of symbols) {
      try {
        const url = `${this.baseUrl}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${this.apiKey}`;
        const response = await fetch(url);

        if (!response.ok) {
          continue;
        }

        const data: AlphaVantageTimeSeriesResponse = await response.json();

        if (data.Note || data["Error Message"]) {
          continue;
        }

        const quote = data["Global Quote"];
        if (quote) {
          bars.push({
            id: uuidv4(),
            instrument: symbol,
            ts: new Date(quote["07. latest trading day"]).toISOString(),
            open: parseFloat(quote["02. open"]),
            high: parseFloat(quote["03. high"]),
            low: parseFloat(quote["04. low"]),
            close: parseFloat(quote["05. price"]),
            volume: parseInt(quote["06. volume"], 10),
            vendor: this.name,
          });
        }

        // Rate limit
        if (symbols.indexOf(symbol) < symbols.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 12000));
        }
      } catch (error) {
        console.error(
          `Alpha Vantage: Error fetching quote for ${symbol}:`,
          error,
        );
      }
    }

    return bars;
  }
}
