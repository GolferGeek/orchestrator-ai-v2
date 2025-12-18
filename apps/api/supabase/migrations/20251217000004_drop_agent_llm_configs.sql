-- =============================================================================
-- DROP AGENT_LLM_CONFIGS TABLE (DEAD CODE CLEANUP)
-- =============================================================================
-- The agent_llm_configs table is no longer used. LLM model selection is now:
-- 1. Fetched from public.llm_models via /llm/models endpoint
-- 2. Selected directly in the frontend UI
-- 3. Sent as llmProvider/llmModel in the request config
--
-- This removes:
-- - The agent_llm_configs_with_pricing view (created in 20251217000002)
-- - The foreign key constraint to public.llm_models
-- - The agent_llm_configs table
-- =============================================================================

-- Drop the view first (depends on the table)
DROP VIEW IF EXISTS marketing.agent_llm_configs_with_pricing;

-- Drop the foreign key constraint (may not exist if migration was rolled back)
ALTER TABLE IF EXISTS marketing.agent_llm_configs
DROP CONSTRAINT IF EXISTS agent_llm_configs_llm_model_fkey;

-- Drop the table
DROP TABLE IF EXISTS marketing.agent_llm_configs;

-- Log the cleanup
DO $$
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Dropped marketing.agent_llm_configs table';
  RAISE NOTICE 'LLM model selection now uses public.llm_models';
  RAISE NOTICE 'via /llm/models endpoint';
  RAISE NOTICE '================================================';
END $$;
