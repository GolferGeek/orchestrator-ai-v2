/**
 * Crawler Service
 *
 * Handles all crawler-related API calls for central crawler admin.
 * Components/stores should use this service for crawler data operations.
 */

import { apiService } from './apiService';

// Types
export type SourceType = 'web' | 'rss' | 'twitter_search' | 'api' | 'test_db';
export type CrawlFrequency = 5 | 10 | 15 | 30 | 60;
export type CrawlStatus = 'running' | 'success' | 'error' | 'timeout';

export interface CrawlConfig {
  selector?: string | null;
  wait_for_element?: string | null;
  extract_rules?: Record<string, unknown>;
  filters?: Record<string, unknown>;
}

export interface Source {
  id: string;
  organization_slug: string;
  name: string;
  description?: string | null;
  source_type: SourceType;
  url: string;
  crawl_config: CrawlConfig;
  crawl_frequency_minutes: CrawlFrequency;
  is_active: boolean;
  is_test: boolean;
  last_crawl_at?: string | null;
  last_crawl_status?: CrawlStatus | null;
  last_error?: string | null;
  consecutive_errors: number;
  created_at: string;
  updated_at: string;
}

export interface Article {
  id: string;
  organization_slug: string;
  source_id: string;
  url: string;
  title?: string | null;
  content?: string | null;
  summary?: string | null;
  author?: string | null;
  published_at?: string | null;
  content_hash: string;
  title_normalized?: string | null;
  key_phrases?: string[] | null;
  fingerprint_hash?: string | null;
  is_test: boolean;
  first_seen_at: string;
  metadata: Record<string, unknown>;
}

export interface SourceCrawl {
  id: string;
  source_id: string;
  started_at: string;
  completed_at?: string | null;
  crawl_duration_ms?: number | null;
  status: CrawlStatus;
  articles_found: number;
  articles_new: number;
  duplicates_exact: number;
  duplicates_cross_source: number;
  duplicates_fuzzy_title: number;
  duplicates_phrase_overlap: number;
  error_message?: string | null;
  retry_count: number;
  metadata: Record<string, unknown>;
}

export interface CrawlStats {
  total_crawls: number;
  successful_crawls: number;
  total_articles_found: number;
  total_articles_new: number;
  total_duplicates: number;
  avg_duration_ms: number;
}

export interface SubscriptionInfo {
  agent_type: 'prediction' | 'risk';
  subscription_id: string;
  target_name?: string;
  scope_name?: string;
  is_active: boolean;
  last_processed_at: string | null;
}

export interface SourceWithStats extends Source {
  article_count: number;
  subscriptions: SubscriptionInfo[];
  crawl_stats: CrawlStats;
}

export interface DashboardStats {
  total_sources: number;
  active_sources: number;
  total_articles: number;
  articles_today: number;
  total_crawls_24h: number;
  successful_crawls_24h: number;
  deduplication_stats: {
    exact: number;
    cross_source: number;
    fuzzy_title: number;
    phrase_overlap: number;
  };
}

export interface CreateSourceData {
  name: string;
  description?: string;
  source_type: SourceType;
  url: string;
  crawl_config?: CrawlConfig;
  crawl_frequency_minutes?: CrawlFrequency;
  is_test?: boolean;
}

export interface UpdateSourceData {
  name?: string;
  description?: string;
  source_type?: SourceType;
  url?: string;
  crawl_config?: CrawlConfig;
  crawl_frequency_minutes?: CrawlFrequency;
  is_active?: boolean;
  is_test?: boolean;
}

const API_BASE = '/api/crawler/admin';

/**
 * Crawler Admin Service
 */
class CrawlerService {
  private getOrgHeader(organizationSlug: string): Record<string, string> {
    return { 'x-organization-slug': organizationSlug };
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(organizationSlug: string): Promise<DashboardStats> {
    return apiService.get<DashboardStats>(`${API_BASE}/stats`, {
      headers: this.getOrgHeader(organizationSlug),
    });
  }

  /**
   * Get all sources with stats
   */
  async getSources(
    organizationSlug: string,
    includeInactive = false,
  ): Promise<SourceWithStats[]> {
    const query = includeInactive ? '?includeInactive=true' : '';
    return apiService.get<SourceWithStats[]>(`${API_BASE}/sources${query}`, {
      headers: this.getOrgHeader(organizationSlug),
    });
  }

  /**
   * Get a single source with full details
   */
  async getSource(organizationSlug: string, id: string): Promise<SourceWithStats> {
    return apiService.get<SourceWithStats>(`${API_BASE}/sources/${id}`, {
      headers: this.getOrgHeader(organizationSlug),
    });
  }

  /**
   * Create a new source
   */
  async createSource(
    organizationSlug: string,
    data: CreateSourceData,
  ): Promise<Source> {
    return apiService.post<Source>(`${API_BASE}/sources`, data, {
      headers: this.getOrgHeader(organizationSlug),
    });
  }

  /**
   * Update a source
   */
  async updateSource(
    organizationSlug: string,
    id: string,
    data: UpdateSourceData,
  ): Promise<Source> {
    return apiService.put<Source>(`${API_BASE}/sources/${id}`, data, {
      headers: this.getOrgHeader(organizationSlug),
    });
  }

  /**
   * Delete a source (soft delete)
   */
  async deleteSource(
    organizationSlug: string,
    id: string,
  ): Promise<{ success: boolean }> {
    return apiService.delete<{ success: boolean }>(`${API_BASE}/sources/${id}`, {
      headers: this.getOrgHeader(organizationSlug),
    });
  }

  /**
   * Get crawl history for a source
   */
  async getSourceCrawls(
    organizationSlug: string,
    sourceId: string,
    limit = 10,
  ): Promise<SourceCrawl[]> {
    return apiService.get<SourceCrawl[]>(
      `${API_BASE}/sources/${sourceId}/crawls?limit=${limit}`,
      { headers: this.getOrgHeader(organizationSlug) },
    );
  }

  /**
   * Get articles for a source
   */
  async getSourceArticles(
    organizationSlug: string,
    sourceId: string,
    options: { limit?: number; since?: string } = {},
  ): Promise<Article[]> {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', String(options.limit));
    if (options.since) params.append('since', options.since);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiService.get<Article[]>(
      `${API_BASE}/sources/${sourceId}/articles${query}`,
      { headers: this.getOrgHeader(organizationSlug) },
    );
  }
}

export const crawlerService = new CrawlerService();
export default crawlerService;
