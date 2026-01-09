/**
 * Source entity interface - represents a data source for signals
 * Based on prediction.sources table
 */

/**
 * Source type - the type of data source
 * - web: Regular web page (scraped with Firecrawl)
 * - rss: RSS feed
 * - twitter_search: Twitter/X search query
 * - api: External API endpoint
 */
export type SourceType = 'web' | 'rss' | 'twitter_search' | 'api';

/**
 * Source scope level - determines visibility and applicability
 * - runner: Global source (available to all)
 * - domain: Domain-specific (stocks, crypto, etc.)
 * - universe: Universe-specific
 * - target: Target-specific
 */
export type SourceScopeLevel = 'runner' | 'domain' | 'universe' | 'target';

/**
 * Crawl frequency in minutes
 */
export type CrawlFrequency = 5 | 10 | 15 | 30 | 60;

/**
 * Source status
 */
export type SourceStatus = 'active' | 'paused' | 'error' | 'archived';

/**
 * Crawl configuration for a source
 */
export interface CrawlConfig {
  /** CSS selector to extract content */
  selector?: string;
  /** Wait for this selector before extracting (for JS-heavy pages) */
  wait_for_selector?: string;
  /** Timeout in milliseconds */
  timeout_ms?: number;
  /** Headers to send with request */
  headers?: Record<string, string>;
  /** Include screenshots in crawl */
  include_screenshot?: boolean;
  /** Extract links from page */
  extract_links?: boolean;
  /** Custom user agent */
  user_agent?: string;
  /** Proxy configuration */
  proxy?: string;
}

/**
 * Authentication configuration for paywalled sources
 */
export interface AuthConfig {
  /** Auth type */
  type: 'none' | 'basic' | 'bearer' | 'cookie' | 'api_key';
  /** Secret reference (never store actual credentials) */
  secret_ref?: string;
  /** Header name for API key auth */
  header_name?: string;
  /** Cookie name for cookie auth */
  cookie_name?: string;
}

/**
 * Source entity
 */
export interface Source {
  id: string;
  name: string;
  description: string | null;
  source_type: SourceType;
  url: string;
  scope_level: SourceScopeLevel;
  domain: 'stocks' | 'crypto' | 'elections' | 'polymarket' | null;
  universe_id: string | null;
  target_id: string | null;
  crawl_config: CrawlConfig;
  auth_config: AuthConfig;
  crawl_frequency_minutes: CrawlFrequency;
  is_active: boolean;
  last_crawl_at: string | null;
  last_crawl_status: 'success' | 'error' | null;
  last_error: string | null;
  consecutive_errors: number;
  created_at: string;
  updated_at: string;
}

/**
 * Create source data
 */
export interface CreateSourceData {
  name: string;
  description?: string;
  source_type: SourceType;
  url: string;
  scope_level: SourceScopeLevel;
  domain?: 'stocks' | 'crypto' | 'elections' | 'polymarket';
  universe_id?: string;
  target_id?: string;
  crawl_config?: CrawlConfig;
  auth_config?: AuthConfig;
  crawl_frequency_minutes?: CrawlFrequency;
  is_active?: boolean;
}

/**
 * Update source data
 */
export interface UpdateSourceData {
  name?: string;
  description?: string;
  url?: string;
  crawl_config?: CrawlConfig;
  auth_config?: AuthConfig;
  crawl_frequency_minutes?: CrawlFrequency;
  is_active?: boolean;
  last_crawl_at?: string;
  last_crawl_status?: 'success' | 'error';
  last_error?: string | null;
  consecutive_errors?: number;
}

/**
 * Source crawl record - history of crawls
 */
export interface SourceCrawl {
  id: string;
  source_id: string;
  started_at: string;
  completed_at: string | null;
  status: 'pending' | 'running' | 'success' | 'error';
  items_found: number;
  signals_created: number;
  duplicates_skipped: number;
  error_message: string | null;
  crawl_duration_ms: number | null;
  metadata: Record<string, unknown>;
}

/**
 * Create source crawl data
 */
export interface CreateSourceCrawlData {
  source_id: string;
  started_at?: string;
  status?: 'pending' | 'running';
}

/**
 * Update source crawl data
 */
export interface UpdateSourceCrawlData {
  completed_at?: string;
  status?: 'success' | 'error';
  items_found?: number;
  signals_created?: number;
  duplicates_skipped?: number;
  error_message?: string;
  crawl_duration_ms?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Source seen item - tracks processed content for deduplication
 */
export interface SourceSeenItem {
  id: string;
  source_id: string;
  content_hash: string;
  original_url: string | null;
  first_seen_at: string;
  last_seen_at: string;
  signal_id: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Create source seen item data
 */
export interface CreateSourceSeenItemData {
  source_id: string;
  content_hash: string;
  original_url?: string;
  signal_id?: string;
  metadata?: Record<string, unknown>;
}
