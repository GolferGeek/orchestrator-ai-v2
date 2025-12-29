-- =============================================================================
-- ORGANIZATIONS SEED DATA (FULL SET)
-- =============================================================================
-- Real organizations for Orchestrator AI v2
-- =============================================================================

-- Insert organizations
INSERT INTO public.organizations (slug, name, description, url, settings) VALUES
-- System/Global
('global', 'Global', 'System-wide global organization for shared resources and agents', NULL,
  '{"theme": "system", "features": ["context-agents", "api-agents", "external-agents", "rag", "langgraph", "n8n"], "limits": {"max_agents": 10000, "max_conversations": 1000000}}'::jsonb),

-- Personal/Demo
('demo-org', 'Demo Organization', 'Default demonstration organization for Orchestrator AI v2-start', 'https://orchestratorai.io',
  '{"theme": "light", "features": ["context-agents", "api-agents", "external-agents"], "limits": {"max_agents": 100, "max_conversations": 1000}}'::jsonb),

-- Real Organizations
('golfergeek', 'GolferGeek', 'Personal organization for GolferGeek development and consulting', 'https://golfergeek.com',
  '{"theme": "dark", "features": ["context-agents", "api-agents", "external-agents", "rag", "langgraph"], "limits": {"max_agents": 500, "max_conversations": 10000}}'::jsonb),

('hiverarchy', 'Hiverarchy', 'Enterprise collaboration and workflow automation platform', 'https://hiverarchy.com',
  '{"theme": "light", "features": ["context-agents", "api-agents", "external-agents", "rag", "langgraph", "n8n"], "limits": {"max_agents": 1000, "max_conversations": 50000}}'::jsonb),

('ifm', 'Industrial Floor Maintenance', 'Industrial floor maintenance and cleaning solutions', 'https://industrialfloormaintenance.com',
  '{"theme": "light", "features": ["context-agents", "api-agents"], "limits": {"max_agents": 50, "max_conversations": 5000}}'::jsonb),

-- Industry-specific organizations
('law-firms', 'Law Firms', 'Legal services and law firm operations', NULL,
  '{"theme": "professional", "features": ["context-agents", "rag"], "limits": {"max_agents": 200, "max_conversations": 20000}}'::jsonb),

('finance-firms', 'Finance Firms', 'Financial services and investment management', NULL,
  '{"theme": "professional", "features": ["context-agents", "api-agents", "rag"], "limits": {"max_agents": 200, "max_conversations": 20000}}'::jsonb),

('marketing-firms', 'Marketing Firms', 'Marketing and advertising agencies', NULL,
  '{"theme": "creative", "features": ["context-agents", "api-agents", "rag"], "limits": {"max_agents": 200, "max_conversations": 20000}}'::jsonb),

('manufacturing-firms', 'Manufacturing Firms', 'Manufacturing and industrial operations', NULL,
  '{"theme": "industrial", "features": ["context-agents", "api-agents"], "limits": {"max_agents": 200, "max_conversations": 20000}}'::jsonb)

ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  settings = EXCLUDED.settings,
  updated_at = NOW();

-- Verification
DO $$
DECLARE
  org_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO org_count FROM public.organizations;

  RAISE NOTICE '================================================';
  RAISE NOTICE 'Organizations seeded: %', org_count;
  RAISE NOTICE '================================================';

  IF org_count < 9 THEN
    RAISE EXCEPTION 'Expected at least 9 organizations, found %', org_count;
  END IF;

  RAISE NOTICE 'All organizations seeded successfully ✓';
END $$;
