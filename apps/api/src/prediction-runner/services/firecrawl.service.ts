import { Injectable, Logger } from '@nestjs/common';
import {
  FirecrawlScrapeRequest,
  FirecrawlScrapeResponse,
  FirecrawlScrapeOptions,
  CrawledItem,
  CrawlResult,
} from '../interfaces/crawl-config.interface';
import {
  Source,
  CrawlConfig,
  AuthConfig,
} from '../interfaces/source.interface';

/**
 * FirecrawlService - Integration with Firecrawl API for web scraping
 *
 * Firecrawl is used to extract content from web pages, handling:
 * - JavaScript rendering
 * - CSS selector extraction
 * - Screenshot capture
 * - Link extraction
 *
 * @see https://docs.firecrawl.dev/
 */
@Injectable()
export class FirecrawlService {
  private readonly logger = new Logger(FirecrawlService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultTimeout = 30000;

  constructor() {
    this.apiKey = process.env.FIRECRAWL_API_KEY || '';
    this.baseUrl =
      process.env.FIRECRAWL_BASE_URL || 'https://api.firecrawl.dev/v1';

    if (!this.apiKey) {
      this.logger.warn(
        'FIRECRAWL_API_KEY not set - Firecrawl integration will fail',
      );
    }
  }

  /**
   * Check if Firecrawl is configured and available
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Scrape a single URL using Firecrawl
   *
   * @param url - URL to scrape
   * @param options - Scrape options
   * @returns Firecrawl response
   */
  async scrape(
    url: string,
    options?: FirecrawlScrapeOptions,
  ): Promise<FirecrawlScrapeResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Firecrawl not configured - missing API key',
      };
    }

    const startTime = Date.now();

    try {
      // Validate URL
      this.validateUrl(url);

      const request: FirecrawlScrapeRequest = {
        url,
        options: {
          formats: options?.formats || ['markdown'],
          onlyMainContent: options?.onlyMainContent ?? true,
          timeout: options?.timeout || this.defaultTimeout,
          ...options,
        },
      };

      this.logger.debug(`Scraping URL: ${url}`);

      const response = await fetch(`${this.baseUrl}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Firecrawl API error: ${response.status} - ${errorText}`,
        );
        return {
          success: false,
          error: `Firecrawl API error: ${response.status} - ${errorText}`,
        };
      }

      const result = (await response.json()) as FirecrawlScrapeResponse;

      const duration = Date.now() - startTime;
      this.logger.debug(`Scraped ${url} in ${duration}ms`);

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to scrape ${url}: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Scrape a source using its configuration
   *
   * @param source - Source entity with crawl config
   * @returns Crawl result with extracted items
   */
  async scrapeSource(source: Source): Promise<CrawlResult> {
    const startTime = Date.now();

    if (source.source_type !== 'web') {
      return {
        success: false,
        source_id: source.id,
        items: [],
        error: `Firecrawl only supports 'web' sources, got '${source.source_type}'`,
        duration_ms: Date.now() - startTime,
      };
    }

    try {
      // Build scrape options from source config
      const options = this.buildScrapeOptions(source.crawl_config);

      // Add auth headers if configured
      if (source.auth_config && source.auth_config.type !== 'none') {
        options.headers = {
          ...options.headers,
          ...this.buildAuthHeaders(source.auth_config),
        };
      }

      const response = await this.scrape(source.url, options);

      if (!response.success || !response.data) {
        return {
          success: false,
          source_id: source.id,
          items: [],
          error: response.error || 'No data returned from Firecrawl',
          duration_ms: Date.now() - startTime,
        };
      }

      // Convert Firecrawl response to CrawledItem
      const item: CrawledItem = {
        content: response.data.markdown || response.data.html || '',
        title: response.data.metadata?.title || null,
        url: response.data.metadata?.sourceURL || source.url,
        published_at: null, // Web pages don't typically have publication dates
        metadata: {
          ...response.data.metadata,
          links: response.data.links,
          screenshot: response.data.screenshot ? true : false,
        },
      };

      return {
        success: true,
        source_id: source.id,
        items: item.content ? [item] : [],
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        source_id: source.id,
        items: [],
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Test crawl a source without persisting results
   * Used for source configuration validation
   *
   * @param url - URL to test
   * @param crawlConfig - Crawl configuration
   * @param authConfig - Auth configuration
   * @returns Test crawl result
   */
  async testCrawl(
    url: string,
    crawlConfig?: CrawlConfig,
    authConfig?: AuthConfig,
  ): Promise<{
    success: boolean;
    preview: string;
    metadata?: Record<string, unknown>;
    error?: string;
    duration_ms: number;
  }> {
    const startTime = Date.now();

    try {
      this.validateUrl(url);

      const options = this.buildScrapeOptions(crawlConfig || {});

      if (authConfig && authConfig.type !== 'none') {
        options.headers = {
          ...options.headers,
          ...this.buildAuthHeaders(authConfig),
        };
      }

      const response = await this.scrape(url, options);

      if (!response.success || !response.data) {
        return {
          success: false,
          preview: '',
          error: response.error || 'No data returned',
          duration_ms: Date.now() - startTime,
        };
      }

      // Return a preview (first 1000 chars)
      const content = response.data.markdown || response.data.html || '';
      const preview = content.substring(0, 1000);

      return {
        success: true,
        preview,
        metadata: response.data.metadata,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        preview: '',
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Build Firecrawl scrape options from source crawl config
   */
  private buildScrapeOptions(config: CrawlConfig): FirecrawlScrapeOptions {
    const options: FirecrawlScrapeOptions = {
      formats: ['markdown'],
      onlyMainContent: true,
    };

    if (config.selector) {
      options.includeTags = [config.selector];
    }

    if (config.wait_for_selector) {
      // Firecrawl uses waitFor in ms, we'll approximate with a delay
      options.waitFor = config.timeout_ms || 5000;
    }

    if (config.timeout_ms) {
      options.timeout = config.timeout_ms;
    }

    if (config.headers) {
      options.headers = config.headers;
    }

    if (config.include_screenshot) {
      options.formats = ['markdown', 'screenshot'];
    }

    return options;
  }

  /**
   * Build auth headers from auth config
   * Note: This retrieves secrets from secure storage (not implemented here)
   */
  private buildAuthHeaders(authConfig: AuthConfig): Record<string, string> {
    const headers: Record<string, string> = {};

    // In production, secrets should be retrieved from a secure vault
    // This is a placeholder implementation
    switch (authConfig.type) {
      case 'bearer':
        if (authConfig.secret_ref) {
          // TODO: Retrieve secret from secure storage
          this.logger.warn(
            'Bearer auth configured but secret retrieval not implemented',
          );
        }
        break;
      case 'api_key':
        if (authConfig.secret_ref && authConfig.header_name) {
          // TODO: Retrieve secret from secure storage
          this.logger.warn(
            'API key auth configured but secret retrieval not implemented',
          );
        }
        break;
      case 'basic':
        if (authConfig.secret_ref) {
          // TODO: Retrieve secret from secure storage
          this.logger.warn(
            'Basic auth configured but secret retrieval not implemented',
          );
        }
        break;
      case 'cookie':
        // Cookie auth is handled differently
        break;
    }

    return headers;
  }

  /**
   * Validate a URL is well-formed and allowed
   */
  private validateUrl(url: string): void {
    try {
      const parsed = new URL(url);

      // Only allow http(s) protocols
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error(`Invalid protocol: ${parsed.protocol}`);
      }

      // Block localhost and private IPs in production
      if (process.env.NODE_ENV === 'production') {
        const hostname = parsed.hostname.toLowerCase();
        if (
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.startsWith('172.')
        ) {
          throw new Error('Private/localhost URLs not allowed in production');
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Invalid URL')) {
        throw new Error(`Invalid URL format: ${url}`);
      }
      throw error;
    }
  }
}
