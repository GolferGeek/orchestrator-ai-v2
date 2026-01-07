-- =============================================================================
-- Create Finance Organization for Finance Research Learning Loop
-- =============================================================================
-- Per Finance Research Learning Loop Plan (20260106-finance-research-learning-loop-agent.plan.md)
-- =============================================================================

-- =============================================================================
-- CREATE FINANCE ORGANIZATION
-- =============================================================================

INSERT INTO public.organizations (slug, name, description, url, settings)
VALUES (
    'finance',
    'Finance Research',
    'Finance research organization for market analysis, company research, and financial modeling agents',
    'https://finance.orchestratorai.io',
    '{
        "theme": "dark",
        "features": [
            "context-agents",
            "api-agents",
            "external-agents",
            "langgraph-agents",
            "rag"
        ],
        "limits": {
            "max_agents": 100,
            "max_conversations": 5000
        },
        "preferences": {
            "default_llm_provider": "ollama",
            "default_llm_model": "qwen2.5-coder:7b"
        },
        "finance": {
            "default_currency": "USD",
            "default_market": "US",
            "research_sources": ["sec_edgar", "financial_modeling_prep", "web_search"],
            "analysis_types": ["fundamental", "technical", "sentiment", "competitive"]
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
-- ASSIGN GOLFERGEEK USER TO FINANCE ORG
-- =============================================================================

DO $$
DECLARE
    v_golfergeek_user_id UUID := '618f3960-a8be-4c67-855f-aae4130699b8';
    v_admin_role_id UUID;
BEGIN
    -- Get admin role ID
    SELECT id INTO v_admin_role_id FROM public.rbac_roles WHERE name = 'admin';

    -- Add golfergeek as admin for finance org
    IF v_admin_role_id IS NOT NULL THEN
        INSERT INTO public.rbac_user_org_roles (user_id, organization_slug, role_id, assigned_by)
        VALUES (v_golfergeek_user_id, 'finance', v_admin_role_id, v_golfergeek_user_id)
        ON CONFLICT (user_id, organization_slug, role_id) DO NOTHING;
    END IF;
END $$;

-- =============================================================================
-- ASSIGN TEST USERS TO FINANCE ORG (FOR E2E + DEMO)
-- =============================================================================
-- Keep this email-based so it works across different environments where UUIDs differ.
DO $$
DECLARE
    v_admin_role_id UUID;
BEGIN
    SELECT id INTO v_admin_role_id FROM public.rbac_roles WHERE name = 'admin';

    IF v_admin_role_id IS NOT NULL THEN
        INSERT INTO public.rbac_user_org_roles (user_id, organization_slug, role_id)
        SELECT u.id, 'finance', v_admin_role_id
        FROM public.users u
        WHERE u.email IN (
            'demo.user@orchestratorai.io',
            'demo.user@playground.com'
        )
        ON CONFLICT (user_id, organization_slug, role_id) DO NOTHING;
    END IF;
END $$;

-- =============================================================================
-- LOG SUCCESS
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Finance organization created';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Organization:';
    RAISE NOTICE '  - Slug: finance';
    RAISE NOTICE '  - Name: Finance Research';
    RAISE NOTICE '  - Features: RAG, LangGraph, Context/API/External agents';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'User Access:';
    RAISE NOTICE '  - Email: golfergeek@orchestratorai.io';
    RAISE NOTICE '  - Role: admin';
    RAISE NOTICE '  - Organization: finance';
    RAISE NOTICE '================================================';
END $$;
