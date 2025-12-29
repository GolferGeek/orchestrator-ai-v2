-- =============================================================================
-- ORGANIZATIONS SEED DATA
-- =============================================================================
-- Demo organizations for v2-start testing and development
-- Created: Phase 1 - Agent Infrastructure
-- =============================================================================

-- Insert organizations
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
),
(
  'golfergeek',
  'GolferGeek',
  'GolferGeek personal organization',
  'https://golfergeek.com',
  '{
    "theme": "dark",
    "features": ["context-agents", "api-agents", "external-agents", "langgraph-agents"],
    "limits": {
      "max_agents": 1000,
      "max_conversations": 10000
    },
    "preferences": {
      "default_llm_provider": "anthropic",
      "default_llm_model": "claude-3-5-sonnet-20241022"
    }
  }'::jsonb
),
(
  'hiverarchy',
  'Hiverarchy',
  'Hiverarchy organization',
  'https://hiverarchy.com',
  '{
    "theme": "light",
    "features": ["context-agents", "api-agents", "external-agents"],
    "limits": {
      "max_agents": 500,
      "max_conversations": 5000
    },
    "preferences": {
      "default_llm_provider": "anthropic",
      "default_llm_model": "claude-3-5-sonnet-20241022"
    }
  }'::jsonb
),
(
  'law-firm',
  'Law Firm',
  'Legal services organization',
  'https://example.com/law-firm',
  '{
    "theme": "light",
    "features": ["context-agents", "api-agents"],
    "limits": {
      "max_agents": 200,
      "max_conversations": 2000
    },
    "preferences": {
      "default_llm_provider": "anthropic",
      "default_llm_model": "claude-3-5-sonnet-20241022"
    }
  }'::jsonb
),
(
  'manufacturing-firm',
  'Manufacturing Firm',
  'Manufacturing organization',
  'https://example.com/manufacturing-firm',
  '{
    "theme": "light",
    "features": ["context-agents", "api-agents"],
    "limits": {
      "max_agents": 200,
      "max_conversations": 2000
    },
    "preferences": {
      "default_llm_provider": "anthropic",
      "default_llm_model": "claude-3-5-sonnet-20241022"
    }
  }'::jsonb
),
(
  'marketing-firm',
  'Marketing Firm',
  'Marketing services organization',
  'https://example.com/marketing-firm',
  '{
    "theme": "light",
    "features": ["context-agents", "api-agents"],
    "limits": {
      "max_agents": 200,
      "max_conversations": 2000
    },
    "preferences": {
      "default_llm_provider": "anthropic",
      "default_llm_model": "claude-3-5-sonnet-20241022"
    }
  }'::jsonb
),
(
  'finance-firm',
  'Finance Firm',
  'Financial services organization',
  'https://example.com/finance-firm',
  '{
    "theme": "light",
    "features": ["context-agents", "api-agents"],
    "limits": {
      "max_agents": 200,
      "max_conversations": 2000
    },
    "preferences": {
      "default_llm_provider": "anthropic",
      "default_llm_model": "claude-3-5-sonnet-20241022"
    }
  }'::jsonb
),
(
  'ifm',
  'Industrial Floor Maintenance',
  'Industrial Floor Maintenance organization',
  'https://industrialfloormaintenance.com',
  '{
    "theme": "light",
    "features": ["context-agents", "api-agents"],
    "limits": {
      "max_agents": 200,
      "max_conversations": 2000
    },
    "preferences": {
      "default_llm_provider": "anthropic",
      "default_llm_model": "claude-3-5-sonnet-20241022"
    }
  }'::jsonb
),
(
  'global',
  'Global',
  'Global/system-wide organization',
  'https://orchestratorai.io/global',
  '{
    "theme": "light",
    "features": ["context-agents", "api-agents", "external-agents", "langgraph-agents"],
    "limits": {
      "max_agents": 10000,
      "max_conversations": 100000
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
DECLARE
  org_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO org_count FROM public.organizations;

  IF org_count < 9 THEN
    RAISE EXCEPTION 'Expected at least 9 organizations, found %', org_count;
  END IF;

  RAISE NOTICE 'Successfully seeded % organizations', org_count;
  RAISE NOTICE 'Organizations: demo-org, golfergeek, hiverarchy, law-firm, manufacturing-firm, marketing-firm, finance-firm, ifm, global';
END $$;
