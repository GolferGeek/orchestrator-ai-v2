/**
 * Finance Agent Migration Script
 *
 * Migrates existing Finance Agent universe agents to the new prediction runner system.
 *
 * WHAT THIS DOES:
 * 1. Finds existing Finance Agent universes (context agents with finance metadata)
 * 2. Creates corresponding prediction_agents entries
 * 3. Maps universe instruments to runner config
 * 4. Preserves existing agent relationships
 *
 * USAGE:
 * npx ts-node scripts/migrate-finance-to-predictions.ts [--dry-run]
 *
 * OPTIONS:
 * --dry-run: Show what would be migrated without making changes
 *
 * PREREQUISITES:
 * - Predictions schema must be created (migrations run)
 * - Existing Finance Agent universes in agents table
 * - DATABASE_URL environment variable set
 *
 * @module migrate-finance-to-predictions
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Types
interface FinanceAgent {
  slug: string;
  organization_slug: string[];
  name: string;
  description: string;
  metadata: {
    universe?: {
      instruments?: string[];
      type?: string; // 'stocks', 'crypto', 'prediction_markets'
    };
    riskProfile?: string;
    pollIntervalMs?: number;
  };
  context?: {
    markdown?: string;
  };
  llm_config?: {
    provider?: string;
    model?: string;
    temperature?: number;
  };
}

interface MigrationResult {
  slug: string;
  orgSlug: string;
  runnerType: string;
  instruments: string[];
  status: 'success' | 'skipped' | 'error';
  reason?: string;
}

/**
 * Determine the appropriate runner type based on agent metadata.
 */
function determineRunnerType(agent: FinanceAgent): string {
  const universeType = agent.metadata?.universe?.type?.toLowerCase();

  if (universeType === 'crypto' || universeType === 'cryptocurrency') {
    return 'crypto-predictor';
  }

  if (
    universeType === 'prediction_markets' ||
    universeType === 'polymarket' ||
    universeType === 'markets'
  ) {
    return 'market-predictor';
  }

  // Default to stock predictor for anything else
  return 'stock-predictor';
}

/**
 * Determine the risk profile based on agent metadata.
 */
function determineRiskProfile(agent: FinanceAgent, runnerType: string): string {
  const existingProfile = agent.metadata?.riskProfile?.toLowerCase();

  // Map existing profiles to new ones
  if (runnerType === 'crypto-predictor') {
    if (existingProfile === 'aggressive' || existingProfile === 'degen') {
      return 'degen';
    }
    if (existingProfile === 'conservative' || existingProfile === 'hodler') {
      return 'hodler';
    }
    return 'trader'; // default for crypto
  }

  if (runnerType === 'market-predictor') {
    if (existingProfile === 'aggressive' || existingProfile === 'speculator') {
      return 'speculator';
    }
    return 'researcher'; // default for markets
  }

  // Stock predictor profiles
  if (existingProfile === 'aggressive') {
    return 'aggressive';
  }
  if (existingProfile === 'conservative') {
    return 'conservative';
  }
  return 'moderate'; // default for stocks
}

/**
 * Determine pre-filter thresholds based on runner type.
 */
function getPreFilterThresholds(runnerType: string): object {
  if (runnerType === 'crypto-predictor') {
    return {
      minPriceChangePercent: 5,
      minSentimentShift: 0.3,
      minSignificanceScore: 0.4,
    };
  }

  if (runnerType === 'market-predictor') {
    return {
      minPriceChangePercent: 5, // 5% odds shift
      minSentimentShift: 0.3,
      minSignificanceScore: 0.4,
    };
  }

  // Stock predictor defaults
  return {
    minPriceChangePercent: 2,
    minSentimentShift: 0.2,
    minSignificanceScore: 0.3,
  };
}

/**
 * Determine poll interval based on runner type.
 */
function getPollInterval(agent: FinanceAgent, runnerType: string): number {
  // Use existing interval if specified
  if (agent.metadata?.pollIntervalMs) {
    return agent.metadata.pollIntervalMs;
  }

  // Default intervals by runner type
  if (runnerType === 'crypto-predictor') {
    return 30000; // 30 seconds for crypto
  }

  return 60000; // 1 minute for stocks and markets
}

/**
 * Find Finance Agent universes that can be migrated.
 */
async function findFinanceAgents(): Promise<FinanceAgent[]> {
  const { data, error } = await supabase
    .from('agents')
    .select('slug, organization_slug, name, description, metadata, context, llm_config')
    .or(
      `department.eq.finance,tags.cs.{"finance"},tags.cs.{"trading"},tags.cs.{"stocks"},tags.cs.{"crypto"},tags.cs.{"prediction"}`
    )
    .not('metadata', 'is', null);

  if (error) {
    console.error('Error fetching agents:', error);
    return [];
  }

  // Filter to agents that have universe metadata
  return (data || []).filter((agent) => {
    const metadata = agent.metadata as FinanceAgent['metadata'];
    return metadata?.universe?.instruments && metadata.universe.instruments.length > 0;
  }) as FinanceAgent[];
}

/**
 * Check if agent already has a prediction_agents entry.
 */
async function isAlreadyMigrated(agentSlug: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('prediction_agents')
    .select('id')
    .eq('agent_slug', agentSlug)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 is "not found"
    console.error(`Error checking migration status for ${agentSlug}:`, error);
  }

  return !!data;
}

/**
 * Create prediction_agents entry for an agent.
 */
async function createPredictionAgent(
  agent: FinanceAgent,
  dryRun: boolean
): Promise<MigrationResult> {
  const runnerType = determineRunnerType(agent);
  const instruments = agent.metadata?.universe?.instruments || [];
  const orgSlug = agent.organization_slug[0] || 'default';

  // Skip if already migrated
  if (await isAlreadyMigrated(agent.slug)) {
    return {
      slug: agent.slug,
      orgSlug,
      runnerType,
      instruments,
      status: 'skipped',
      reason: 'Already migrated',
    };
  }

  // Skip if no instruments
  if (instruments.length === 0) {
    return {
      slug: agent.slug,
      orgSlug,
      runnerType,
      instruments,
      status: 'skipped',
      reason: 'No instruments configured',
    };
  }

  if (dryRun) {
    return {
      slug: agent.slug,
      orgSlug,
      runnerType,
      instruments,
      status: 'success',
      reason: 'Dry run - would create prediction_agents entry',
    };
  }

  // Create the prediction_agents entry
  const { error } = await supabase.from('prediction_agents').insert({
    agent_slug: agent.slug,
    org_slug: orgSlug,
    runner_type: runnerType,
    instruments,
    risk_profile: determineRiskProfile(agent, runnerType),
    poll_interval_ms: getPollInterval(agent, runnerType),
    pre_filter_thresholds: getPreFilterThresholds(runnerType),
    model_config: agent.llm_config
      ? {
          triage: {
            provider: 'anthropic',
            model: 'claude-3-5-haiku-20241022',
            temperature: 0.2,
          },
          specialists: {
            provider: agent.llm_config.provider || 'anthropic',
            model: agent.llm_config.model || 'claude-sonnet-4-20250514',
            temperature: agent.llm_config.temperature || 0.3,
          },
          evaluators: {
            provider: agent.llm_config.provider || 'anthropic',
            model: agent.llm_config.model || 'claude-sonnet-4-20250514',
            temperature: 0.4,
          },
          learning: {
            provider: agent.llm_config.provider || 'anthropic',
            model: agent.llm_config.model || 'claude-sonnet-4-20250514',
            temperature: 0.5,
          },
        }
      : null,
    learning_config: {
      autoPostmortem: true,
      detectMissedOpportunities: true,
      contextLookbackHours: 24,
      maxPostmortemsInContext: 10,
      maxSpecialistStats: 5,
    },
    lifecycle_state: 'stopped',
    auto_start: false,
  });

  if (error) {
    return {
      slug: agent.slug,
      orgSlug,
      runnerType,
      instruments,
      status: 'error',
      reason: error.message,
    };
  }

  // Update the agent metadata to include runner config
  const { error: updateError } = await supabase
    .from('agents')
    .update({
      metadata: {
        ...agent.metadata,
        runner: runnerType,
        hasCustomUI: true,
        customUIComponent: 'prediction-dashboard',
        runnerConfig: {
          runner: runnerType,
          instruments,
          riskProfile: determineRiskProfile(agent, runnerType),
          pollIntervalMs: getPollInterval(agent, runnerType),
          preFilterThresholds: getPreFilterThresholds(runnerType),
        },
      },
    })
    .eq('slug', agent.slug);

  if (updateError) {
    console.warn(`Warning: Failed to update agent metadata for ${agent.slug}:`, updateError);
  }

  return {
    slug: agent.slug,
    orgSlug,
    runnerType,
    instruments,
    status: 'success',
  };
}

/**
 * Main migration function.
 */
async function migrate(dryRun: boolean): Promise<void> {
  console.log('Finance Agent to Prediction Runner Migration');
  console.log('==========================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  // Find Finance Agents
  console.log('Finding Finance Agent universes...');
  const agents = await findFinanceAgents();
  console.log(`Found ${agents.length} potential agents to migrate`);
  console.log('');

  if (agents.length === 0) {
    console.log('No Finance Agent universes found to migrate.');
    return;
  }

  // Migrate each agent
  const results: MigrationResult[] = [];

  for (const agent of agents) {
    console.log(`Processing: ${agent.slug}...`);
    const result = await createPredictionAgent(agent, dryRun);
    results.push(result);

    const statusEmoji = result.status === 'success' ? '✓' : result.status === 'skipped' ? '⏭' : '✗';
    console.log(
      `  ${statusEmoji} ${result.status}: ${result.runnerType} with ${result.instruments.length} instruments`
    );
    if (result.reason) {
      console.log(`     ${result.reason}`);
    }
  }

  // Summary
  console.log('');
  console.log('Migration Summary');
  console.log('=================');
  console.log(`Total agents processed: ${results.length}`);
  console.log(`  Successful: ${results.filter((r) => r.status === 'success').length}`);
  console.log(`  Skipped: ${results.filter((r) => r.status === 'skipped').length}`);
  console.log(`  Errors: ${results.filter((r) => r.status === 'error').length}`);

  if (dryRun) {
    console.log('');
    console.log('This was a dry run. No changes were made.');
    console.log('Run without --dry-run to apply changes.');
  }
}

// Main execution
const dryRun = process.argv.includes('--dry-run');
migrate(dryRun)
  .then(() => {
    console.log('');
    console.log('Migration complete.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
