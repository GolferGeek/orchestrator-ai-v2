/**
 * Analyst entity interface - represents an analyst perspective/persona
 * Based on prediction.analysts table and prediction.get_active_analysts function
 */

// Import and re-export LlmTier for convenience
import { LlmTier } from './llm-tier.interface';
export { LlmTier };

/**
 * Analyst scope level (inheritance hierarchy)
 * - runner: System-wide default analysts
 * - domain: Domain-specific analysts (stocks, crypto, etc.)
 * - universe: Universe-specific analysts
 * - target: Target-specific analysts
 */
export type AnalystScopeLevel = 'runner' | 'domain' | 'universe' | 'target';

/**
 * Analyst entity - defines a perspective/persona for signal analysis
 */
export interface Analyst {
  id: string;
  scope_level: AnalystScopeLevel;
  domain: string | null;
  universe_id: string | null;
  target_id: string | null;
  slug: string;
  name: string;
  perspective: string;
  tier_instructions: TierInstructions;
  default_weight: number;
  learned_patterns: string[];
  agent_id: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Tier-specific instructions for analyst
 * Allows customization of prompts based on LLM tier
 */
export interface TierInstructions {
  gold?: string;
  silver?: string;
  bronze?: string;
  [key: string]: string | undefined;
}

/**
 * Active analyst with resolved configuration
 * Returned by prediction.get_active_analysts function
 */
export interface ActiveAnalyst {
  analyst_id: string;
  slug: string;
  name: string;
  perspective: string;
  effective_weight: number;
  effective_tier: LlmTier;
  tier_instructions: TierInstructions;
  learned_patterns: string[];
  scope_level: AnalystScopeLevel;
}
