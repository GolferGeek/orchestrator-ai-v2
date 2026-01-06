-- =============================================================================
-- REGISTER FINANCE RESEARCH AGENT
-- =============================================================================
-- Creates the Finance Research Agent for market analysis and recommendations
-- Uses LangGraph workflow with learning loop and agenda extraction
-- Features custom UI with recommendations viewer and outcomes tracking
-- Created: 2026-01-06
-- =============================================================================

INSERT INTO public.agents (
    slug,
    organization_slug,
    name,
    description,
    version,
    agent_type,
    department,
    tags,
    io_schema,
    capabilities,
    context,
    endpoint,
    llm_config,
    metadata,
    created_at,
    updated_at
)
VALUES (
    'finance-research',
    ARRAY['finance']::TEXT[],
    'Finance Research Agent',
    'LangGraph-powered finance agent that analyzes market data and news, extracts agenda/manipulation signals, generates multi-timing buy/sell recommendations, evaluates outcomes, and implements a learning loop. Includes custom UI with recommendations viewer and outcomes tracking.',
    '1.0.0',
    'api',
    'finance',
    ARRAY['finance', 'market-analysis', 'recommendations', 'learning-loop', 'agenda-extraction', 'langgraph', 'custom-ui']::TEXT[],

    -- Input/Output Schema
    '{
        "input": {
            "type": "object",
            "required": ["universeVersionId"],
            "properties": {
                "universeVersionId": {
                    "type": "string",
                    "format": "uuid",
                    "description": "Universe version ID to run analysis on"
                },
                "prompt": {
                    "type": "string",
                    "description": "Optional additional context or focus for the analysis"
                },
                "timingWindows": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": ["pre_close", "post_close", "pre_open", "intraday"]
                    },
                    "default": ["pre_close", "post_close", "pre_open"],
                    "description": "Timing windows to generate recommendations for"
                },
                "lookbackDays": {
                    "type": "number",
                    "minimum": 1,
                    "maximum": 365,
                    "default": 30,
                    "description": "Number of days of historical data to analyze"
                },
                "includeAgendaAnalysis": {
                    "type": "boolean",
                    "default": true,
                    "description": "Whether to extract and analyze agenda/manipulation signals from news"
                }
            }
        },
        "output": {
            "type": "object",
            "properties": {
                "success": {
                    "type": "boolean"
                },
                "runId": {
                    "type": "string",
                    "format": "uuid",
                    "description": "Recommendation run ID for tracking"
                },
                "recommendations": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": { "type": "string", "format": "uuid" },
                            "instrument": { "type": "string" },
                            "action": { "type": "string", "enum": ["buy", "sell", "hold"] },
                            "timingWindow": { "type": "string" },
                            "entryStyle": { "type": "string" },
                            "intendedPrice": { "type": "number" },
                            "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
                            "rationale": { "type": "string" }
                        }
                    }
                },
                "agendaSignals": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "narrative": { "type": "string" },
                            "suspectedIncentive": { "type": "string" },
                            "targetInstruments": { "type": "array", "items": { "type": "string" } },
                            "confidence": { "type": "number" }
                        }
                    },
                    "description": "Extracted agenda/manipulation signals from news analysis"
                },
                "marketSummary": {
                    "type": "object",
                    "properties": {
                        "instrumentsAnalyzed": { "type": "number" },
                        "dataPointsProcessed": { "type": "number" },
                        "newsItemsAnalyzed": { "type": "number" }
                    }
                }
            }
        }
    }'::JSONB,

    -- Capabilities
    ARRAY['market-analysis', 'news-analysis', 'agenda-extraction', 'recommendation-generation', 'multi-timing', 'learning-loop', 'outcome-evaluation']::TEXT[],

    -- Context (system prompt for the agent)
    '{"markdown": "# Finance Research Agent\n\nA LangGraph-powered agent that analyzes market data and news to generate trading recommendations with a learning loop.\n\n## Capabilities\n- **Market Data Analysis**: Processes OHLCV data and derives technical features\n- **News Analysis**: Ingests and analyzes market news from multiple sources\n- **Agenda Extraction**: Uses LLM to identify manipulation signals and narrative patterns\n- **Multi-Timing Recommendations**: Generates recommendations for different timing windows\n- **Learning Loop**: Evaluates outcomes and feeds lessons back into future decisions\n\n## Workflow\n1. Receive universe version and parameters\n2. Ingest market data for universe instruments\n3. Ingest news items for the analysis period\n4. Extract agenda/manipulation signals via LLM\n5. Build decision context combining market and agenda features\n6. Generate recommendations across timing windows\n7. Store recommendations for later evaluation\n\n## Evaluation Loop (runs separately)\n- Evaluates recommendations against realized prices\n- Generates postmortem explanations (why it happened)\n- Feeds lessons back into learning store\n\n## Custom UI\nThis agent has a custom UI with:\n- Config tab: Universe selection, timing windows, lookback period\n- Progress tab: Real-time analysis progress via SSE\n- Recommendations tab: List with outcomes, win/loss indicators, postmortem links"}'::JSONB,

    -- Endpoint (API agents need an endpoint - matches LangGraph controller POST path)
    '{"url": "http://localhost:6200/agents/finance/finance-research/run"}'::JSONB,

    -- LLM config (null for API agents - LangGraph manages its own LLM internally)
    NULL,

    -- Metadata with custom UI configuration
    '{
        "provider": "langgraph",
        "langgraphWorkflow": "finance",
        "langgraphPath": "agents/finance",
        "hasCustomUI": true,
        "customUIComponent": "finance",
        "features": [
            "market-data-analysis",
            "news-ingestion",
            "agenda-extraction",
            "multi-timing-recommendations",
            "learning-loop",
            "outcome-evaluation",
            "postmortem-generation"
        ],
        "supportedTimingWindows": ["pre_close", "post_close", "pre_open", "intraday"],
        "defaultLLM": {
            "provider": "anthropic",
            "model": "claude-sonnet-4-20250514",
            "description": "Analysis and agenda extraction model"
        },
        "defaultSettings": {
            "lookbackDays": 30,
            "includeAgendaAnalysis": true,
            "timingWindows": ["pre_close", "post_close", "pre_open"]
        },
        "executionCapabilities": {
            "canConverse": true,
            "canPlan": false,
            "canBuild": true,
            "requiresHumanGate": false
        },
        "streaming": {
            "enabled": true,
            "eventTypes": [
                "run_started",
                "market_data_ingestion",
                "news_ingestion",
                "agenda_extraction",
                "feature_building",
                "recommendation_generation",
                "recommendations_saved",
                "run_completed"
            ]
        },
        "learningLoop": {
            "enabled": true,
            "evaluationSchedule": "market_close",
            "postmortemGeneration": true
        }
    }'::JSONB,
    NOW(),
    NOW()
)
ON CONFLICT (slug) DO UPDATE SET
    organization_slug = EXCLUDED.organization_slug,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    version = EXCLUDED.version,
    agent_type = EXCLUDED.agent_type,
    department = EXCLUDED.department,
    tags = EXCLUDED.tags,
    io_schema = EXCLUDED.io_schema,
    capabilities = EXCLUDED.capabilities,
    context = EXCLUDED.context,
    endpoint = EXCLUDED.endpoint,
    llm_config = EXCLUDED.llm_config,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- =============================================================================
-- Verification
-- =============================================================================

DO $$
DECLARE
    agent_exists BOOLEAN;
    has_custom_ui BOOLEAN;
    is_finance_org BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM public.agents
        WHERE slug = 'finance-research'
        AND agent_type = 'api'
    ) INTO agent_exists;

    SELECT (metadata->>'hasCustomUI')::BOOLEAN
    INTO has_custom_ui
    FROM public.agents
    WHERE slug = 'finance-research';

    SELECT 'finance' = ANY(organization_slug)
    INTO is_finance_org
    FROM public.agents
    WHERE slug = 'finance-research';

    IF NOT agent_exists THEN
        RAISE EXCEPTION 'Finance Research Agent was not created successfully';
    END IF;

    IF NOT has_custom_ui THEN
        RAISE EXCEPTION 'Finance Research Agent hasCustomUI metadata not set correctly';
    END IF;

    IF NOT is_finance_org THEN
        RAISE EXCEPTION 'Finance Research Agent organization_slug does not include finance';
    END IF;

    RAISE NOTICE '================================================';
    RAISE NOTICE 'Finance Research Agent registered successfully';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Slug: finance-research';
    RAISE NOTICE 'Type: api (LangGraph backend)';
    RAISE NOTICE 'Endpoint: http://localhost:6200/agents/finance/finance-research/run';
    RAISE NOTICE 'Organizations: finance';
    RAISE NOTICE 'Custom UI: enabled (finance component)';
    RAISE NOTICE 'Learning Loop: enabled';
    RAISE NOTICE '================================================';
END $$;
