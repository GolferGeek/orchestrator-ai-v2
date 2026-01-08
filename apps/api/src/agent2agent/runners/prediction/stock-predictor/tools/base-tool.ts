/**
 * Base Tool Interface for Prediction Tools
 *
 * Defines the contract for all data collection tools in the prediction system.
 * Tools are responsible for fetching data from external sources and converting
 * it to the standard Source/Claim format.
 *
 * DESIGN NOTES:
 * - Tools are stateless - they receive instruments and return sources
 * - Tools handle their own error recovery and rate limiting
 * - Tools emit structured claims with source attribution
 * - Tools should never throw - return empty sources on error
 *
 * @module base-tool
 */

import { Logger } from '@nestjs/common';
import { Source, Claim, ClaimType } from '../../base/base-prediction.types';

/**
 * PredictionTool interface.
 * All data collection tools must implement this interface.
 *
 * Tools are executed in parallel during the poll_data node.
 * Each tool returns an array of Source objects containing claims.
 *
 * @example
 * ```typescript
 * class YahooFinanceTool implements PredictionToolContract {
 *   name = 'yahoo-finance';
 *   description = 'Fetches stock quotes from Yahoo Finance API';
 *   async execute(instruments: string[]): Promise<Source[]> {
 *     // Fetch and return sources with claims
 *   }
 * }
 * ```
 */
export interface PredictionToolContract {
  /** Tool identifier (e.g., 'yahoo-finance', 'coingecko') */
  readonly name: string;

  /** Human-readable description of what this tool does */
  readonly description: string;

  /**
   * Execute the tool and return sources with claims.
   *
   * @param instruments - Array of instrument identifiers to fetch data for
   * @returns Promise resolving to array of Source objects
   */
  execute(instruments: string[]): Promise<Source[]>;
}

/**
 * Abstract base class for prediction tools.
 * Provides common functionality like logging, error handling, and claim creation.
 *
 * Subclasses implement:
 * - fetchData(): Domain-specific API calls
 * - parseResponse(): Convert API response to claims
 */
export abstract class BasePredictionTool implements PredictionToolContract {
  protected readonly logger: Logger;

  abstract readonly name: string;
  abstract readonly description: string;

  constructor() {
    this.logger = new Logger(this.constructor.name);
  }

  /**
   * Execute the tool for the given instruments.
   * Handles error recovery and always returns a result (never throws).
   */
  async execute(instruments: string[]): Promise<Source[]> {
    const startTime = Date.now();
    const sources: Source[] = [];

    this.logger.debug(
      `Fetching data for ${instruments.length} instruments: ${instruments.join(', ')}`,
    );

    try {
      const response = await this.fetchData(instruments);
      const parsedSources = this.parseResponse(response, instruments);
      sources.push(...parsedSources);

      const duration = Date.now() - startTime;
      this.logger.debug(
        `Fetched ${sources.length} sources with ${sources.reduce((acc, s) => acc + s.claims.length, 0)} claims in ${duration}ms`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to fetch data: ${errorMessage}`);

      // Return an error source so the pipeline knows what happened
      sources.push(this.createErrorSource(errorMessage));
    }

    return sources;
  }

  /**
   * Fetch data from the external source.
   * Subclasses implement this to make API calls.
   *
   * @param instruments - Instruments to fetch data for
   * @returns Raw API response
   */
  protected abstract fetchData(instruments: string[]): Promise<unknown>;

  /**
   * Parse the API response into sources with claims.
   * Subclasses implement this to convert API data to claims.
   *
   * @param response - Raw API response
   * @param instruments - Instruments that were requested
   * @returns Array of Source objects with claims
   */
  protected abstract parseResponse(
    response: unknown,
    instruments: string[],
  ): Source[];

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  /**
   * Create a claim object with standard structure.
   */
  protected createClaim(
    type: ClaimType,
    instrument: string,
    value: number | string | boolean,
    options: {
      unit?: string;
      confidence?: number;
      timestamp?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): Claim {
    return {
      type,
      instrument,
      value,
      unit: options.unit,
      confidence: options.confidence ?? 1.0,
      timestamp: options.timestamp ?? new Date().toISOString(),
      metadata: options.metadata,
    };
  }

  /**
   * Create a source object with claims.
   */
  protected createSource(
    claims: Claim[],
    options: {
      articleUrl?: string;
      articleTitle?: string;
      publishedAt?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): Source {
    return {
      tool: this.name,
      fetchedAt: new Date().toISOString(),
      claims,
      articleUrl: options.articleUrl,
      articleTitle: options.articleTitle,
      publishedAt: options.publishedAt,
      metadata: options.metadata,
    };
  }

  /**
   * Create an error source when fetching fails.
   * This allows the pipeline to see what went wrong.
   */
  protected createErrorSource(errorMessage: string): Source {
    return {
      tool: this.name,
      fetchedAt: new Date().toISOString(),
      claims: [],
      metadata: {
        error: true,
        errorMessage,
      },
    };
  }

  /**
   * Safely extract a numeric value from an API response.
   */
  protected safeNumber(
    value: unknown,
    fallback: number | null = null,
  ): number | null {
    if (typeof value === 'number' && !isNaN(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    return fallback;
  }

  /**
   * Safely extract a string value from an API response.
   */
  protected safeString(value: unknown, fallback: string = ''): string {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return fallback;
  }
}

/**
 * Tool configuration options.
 * Used when instantiating tools with customization.
 */
export interface ToolConfig {
  /** API key if required */
  apiKey?: string;

  /** Base URL override */
  baseUrl?: string;

  /** Request timeout in ms */
  timeoutMs?: number;

  /** Max retries on failure */
  maxRetries?: number;

  /** Rate limit: max requests per minute */
  rateLimit?: number;
}
