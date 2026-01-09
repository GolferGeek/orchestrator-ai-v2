/**
 * Target entity interface - represents a prediction target (stock, crypto, etc.)
 * Based on prediction.targets table
 */

import { LlmConfig } from './universe.interface';

export interface Target {
  id: string;
  universe_id: string;
  symbol: string;
  name: string;
  target_type: 'stock' | 'crypto' | 'election' | 'polymarket';
  context: string | null;
  metadata: Record<string, unknown>;
  llm_config_override: LlmConfig | null;
  is_active: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTargetData {
  universe_id: string;
  symbol: string;
  name: string;
  target_type: 'stock' | 'crypto' | 'election' | 'polymarket';
  context?: string;
  metadata?: Record<string, unknown>;
  llm_config_override?: LlmConfig;
  is_active?: boolean;
}

export interface UpdateTargetData {
  symbol?: string;
  name?: string;
  context?: string;
  metadata?: Record<string, unknown>;
  llm_config_override?: LlmConfig;
  is_active?: boolean;
  is_archived?: boolean;
}
