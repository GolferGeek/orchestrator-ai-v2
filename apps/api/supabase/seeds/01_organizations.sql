-- =============================================================================
-- ORGANIZATIONS SEED DATA
-- =============================================================================
-- Demo organizations for v2-start testing and development
-- Created: Phase 1 - Agent Infrastructure
-- =============================================================================

-- Insert demo organization
INSERT INTO public.organizations (slug, name, description, url, settings) VALUES
(
  'demo-org',
  'Demo Organization',
  'Default demonstration organization for Orchestrator AI v2-start',
  'https://orchestratorai.io',
  '{
    "theme": "light",
    "features": ["context-agents", "api-agents", "external-agents"],
    "limits": {
      "max_agents": 100,
      "max_conversations": 1000
    },
    "preferences": {
      "default_llm_provider": "anthropic",
      "default_llm_model": "claude-3-5-sonnet-20241022"
    }
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  settings = EXCLUDED.settings,
  updated_at = NOW();

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Verify insert
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE slug = 'demo-org') THEN
    RAISE EXCEPTION 'Failed to seed demo-org organization';
  END IF;

  RAISE NOTICE 'Successfully seeded 1 organization: demo-org';
END $$;
