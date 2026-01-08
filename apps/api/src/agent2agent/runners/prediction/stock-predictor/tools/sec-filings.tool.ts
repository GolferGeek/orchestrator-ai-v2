/**
 * SEC Filings Tool
 *
 * Fetches SEC EDGAR filings for companies (8-K, 10-K, 10-Q).
 * Extracts filing events as claims for compliance and fundamental analysis.
 *
 * FEATURES:
 * - Query SEC EDGAR API for company filings
 * - Track material events (8-K)
 * - Track quarterly (10-Q) and annual (10-K) reports
 * - No API key required (public data)
 *
 * LIMITATIONS:
 * - Rate limited to 10 requests/second by SEC
 * - Requires User-Agent header with contact info
 * - Only works for US-listed companies with CIK numbers
 *
 * @module sec-filings.tool
 */

import { Injectable } from '@nestjs/common';
import { BasePredictionTool, ToolConfig } from './base-tool';
import { Source, Claim } from '../../base/base-prediction.types';

/**
 * SEC filing item
 */
interface SecFiling {
  filingDate?: string;
  form?: string;
  filmNumber?: string;
  description?: string;
  size?: string;
  primaryDocument?: string;
  accessionNumber?: string;
}

/**
 * SEC company filings response
 */
interface SecFilingsResponse {
  filings?: {
    recent?: {
      filingDate?: string[];
      form?: string[];
      filmNumber?: string[];
      description?: string[];
      size?: string[];
      primaryDocument?: string[];
      accessionNumber?: string[];
    };
  };
  cik?: string;
  name?: string;
}

/**
 * Ticker to CIK mapping
 */
interface TickerCikMapping {
  [ticker: string]: string; // ticker -> CIK
}

/**
 * SEC Filings Tool configuration
 */
export interface SecFilingsToolConfig extends ToolConfig {
  /** User-Agent email (required by SEC) */
  userAgentEmail?: string;

  /** Filing types to track (default: 8-K, 10-K, 10-Q) */
  filingTypes?: string[];

  /** Lookback days for filings (default: 90) */
  lookbackDays?: number;
}

/**
 * SEC Filings Tool
 *
 * Fetches SEC EDGAR filings for tracked companies.
 * Creates filing claims for material events and reports.
 *
 * @example
 * ```typescript
 * const tool = new SecFilingsTool({ userAgentEmail: 'compliance@company.com' });
 * const sources = await tool.execute(['AAPL', 'MSFT', 'GOOGL']);
 * // Returns sources with filing claims
 * ```
 */
@Injectable()
export class SecFilingsTool extends BasePredictionTool {
  readonly name = 'sec-filings';
  readonly description = 'Fetches SEC EDGAR filings for companies';

  private readonly baseUrl = 'https://data.sec.gov';
  private readonly userAgentEmail: string;
  private readonly filingTypes: string[];
  private readonly lookbackDays: number;
  private readonly timeoutMs: number;

  // Static ticker -> CIK mapping (in production, fetch from SEC or use API)
  // This is a minimal set for demonstration
  private readonly tickerToCik: TickerCikMapping = {
    AAPL: '0000320193',
    MSFT: '0000789019',
    GOOGL: '0001652044',
    GOOG: '0001652044',
    AMZN: '0001018724',
    TSLA: '0001318605',
    NVDA: '0001045810',
    META: '0001326801',
    NFLX: '0001065280',
    AMD: '0000002488',
  };

  constructor(config: SecFilingsToolConfig = {}) {
    super();
    this.userAgentEmail =
      config.userAgentEmail || 'prediction-agent@orchestrator.ai';
    this.filingTypes = config.filingTypes || ['8-K', '10-K', '10-Q'];
    this.lookbackDays = config.lookbackDays ?? 90;
    this.timeoutMs = config.timeoutMs ?? 10000;
  }

  /**
   * Fetch SEC filings for instruments.
   * SEC API requires sequential requests with rate limiting.
   */
  protected async fetchData(
    instruments: string[],
  ): Promise<Map<string, SecFilingsResponse>> {
    const results = new Map<string, SecFilingsResponse>();

    this.logger.debug(
      `Fetching SEC filings for ${instruments.length} instruments`,
    );

    // Fetch each instrument sequentially to respect rate limits
    // SEC allows 10 requests/second
    for (const ticker of instruments) {
      const cik = this.tickerToCik[ticker];
      if (!cik) {
        this.logger.debug(`No CIK mapping for ${ticker}, skipping SEC filings`);
        continue;
      }

      try {
        const filings = await this.fetchCompanyFilings(cik, ticker);
        results.set(ticker, filings);

        // Add delay to respect SEC rate limit (10 req/sec = 100ms between)
        if (instruments.indexOf(ticker) < instruments.length - 1) {
          await this.delay(100);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to fetch SEC filings for ${ticker}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return results;
  }

  /**
   * Fetch filings for a single company by CIK.
   */
  private async fetchCompanyFilings(
    cik: string,
    ticker: string,
  ): Promise<SecFilingsResponse> {
    // SEC submissions endpoint returns all filings for a company
    const url = `${this.baseUrl}/submissions/CIK${cik}.json`;

    this.logger.debug(`Fetching SEC filings for ${ticker} (CIK: ${cik})`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': `OrchAI Prediction Agent (${this.userAgentEmail})`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `SEC API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as SecFilingsResponse;
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('SEC API request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse SEC filings responses into sources with filing claims.
   */
  protected parseResponse(
    response: Map<string, SecFilingsResponse>,
    _instruments: string[],
  ): Source[] {
    const sources: Source[] = [];
    const cutoffDate = new Date(
      Date.now() - this.lookbackDays * 24 * 60 * 60 * 1000,
    );

    for (const [ticker, data] of response) {
      const filings = this.extractRecentFilings(data, cutoffDate);

      if (filings.length > 0) {
        const claims = this.extractClaims(ticker, filings);

        if (claims.length > 0) {
          sources.push(
            this.createSource(claims, {
              metadata: {
                cik: data.cik,
                companyName: data.name,
                filingCount: filings.length,
                source: 'SEC EDGAR',
              },
            }),
          );
        }
      }
    }

    this.logger.debug(
      `Found ${sources.reduce((acc, s) => acc + s.claims.length, 0)} SEC filing claims across ${sources.length} companies`,
    );

    return sources;
  }

  /**
   * Extract recent filings from SEC response.
   */
  private extractRecentFilings(
    data: SecFilingsResponse,
    cutoffDate: Date,
  ): SecFiling[] {
    const filings: SecFiling[] = [];
    const recent = data.filings?.recent;

    if (!recent || !recent.filingDate || !recent.form) {
      return filings;
    }

    // SEC API returns parallel arrays
    const count = recent.filingDate.length;
    for (let i = 0; i < count; i++) {
      const filingDate = recent.filingDate[i];
      const form = recent.form[i];

      // Filter by filing type and date
      if (
        filingDate &&
        form &&
        this.filingTypes.includes(form) &&
        new Date(filingDate) >= cutoffDate
      ) {
        filings.push({
          filingDate,
          form,
          filmNumber: recent.filmNumber?.[i],
          description: recent.description?.[i],
          size: recent.size?.[i],
          primaryDocument: recent.primaryDocument?.[i],
          accessionNumber: recent.accessionNumber?.[i],
        });
      }
    }

    return filings;
  }

  /**
   * Extract claims from filings.
   */
  private extractClaims(ticker: string, filings: SecFiling[]): Claim[] {
    const claims: Claim[] = [];

    for (const filing of filings) {
      if (!filing.filingDate || !filing.form) {
        continue;
      }

      const timestamp = new Date(filing.filingDate).toISOString();
      const filingUrl = filing.accessionNumber
        ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${ticker}&type=${filing.form}&dateb=&owner=exclude&count=40`
        : undefined;

      // Create filing claim
      claims.push(
        this.createClaim('filing', ticker, filing.form, {
          confidence: 1.0, // Filings are factual
          timestamp,
          metadata: {
            filingType: filing.form,
            filingDate: filing.filingDate,
            description: filing.description,
            accessionNumber: filing.accessionNumber,
            url: filingUrl,
            source: 'SEC EDGAR',
          },
        }),
      );

      // For 8-K filings, also create an event claim
      if (filing.form === '8-K') {
        claims.push(
          this.createClaim('event', ticker, 'Material Event Reported', {
            confidence: 1.0,
            timestamp,
            metadata: {
              eventType: '8-K Filing',
              description: filing.description || 'Material event disclosure',
              filingDate: filing.filingDate,
              url: filingUrl,
            },
          }),
        );
      }

      // For 10-K/10-Q filings, create earnings/report event
      if (filing.form === '10-K' || filing.form === '10-Q') {
        const reportType = filing.form === '10-K' ? 'Annual' : 'Quarterly';
        claims.push(
          this.createClaim('event', ticker, `${reportType} Report Filed`, {
            confidence: 1.0,
            timestamp,
            metadata: {
              eventType: `${filing.form} Filing`,
              description: `${reportType} financial report`,
              filingDate: filing.filingDate,
              url: filingUrl,
            },
          }),
        );
      }
    }

    return claims;
  }

  /**
   * Delay helper for rate limiting.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
