-- =============================================================================
-- PREDICTION AGENTS SEED DATA
-- =============================================================================
-- Seed data for prediction agents.
-- These agents use the prediction runner framework with embedded LangGraph.
--
-- NOTE: Run this after the predictions schema migrations.
-- Created: 2026-01-08
-- =============================================================================

-- =============================================================================
-- US TECH STOCKS PREDICTOR AGENT
-- =============================================================================
-- Stock prediction agent tracking major US tech stocks
-- Uses stock-predictor runner with Yahoo Finance + optional Alpha Vantage
-- =============================================================================

-- First, insert the base agent into public.agents
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
    'us-tech-stocks-2025',
    ARRAY['finance']::TEXT[],
    'US Tech Stocks Predictor',
    'Ambient prediction agent that continuously monitors major US technology stocks (AAPL, MSFT, GOOGL, NVDA) and generates trading recommendations based on technical and fundamental analysis.',
    '1.0.0',
    'api',
    'finance',
    ARRAY['stocks', 'prediction', 'tech', 'ambient-agent', 'trading', 'market-analysis']::TEXT[],

    -- Input/Output Schema
    '{
        "input": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "enum": ["start", "stop", "pause", "resume", "poll_now", "status"],
                    "description": "Lifecycle command for the ambient agent"
                },
                "instrumentsOverride": {
                    "type": "array",
                    "items": { "type": "string" },
                    "description": "Optional override of instruments to poll (for testing)"
                }
            }
        },
        "output": {
            "type": "object",
            "properties": {
                "success": { "type": "boolean" },
                "status": {
                    "type": "object",
                    "properties": {
                        "state": { "type": "string", "enum": ["stopped", "starting", "running", "paused", "stopping", "error"] },
                        "lastPollAt": { "type": "string", "format": "date-time" },
                        "nextPollAt": { "type": "string", "format": "date-time" },
                        "pollCount": { "type": "number" },
                        "recommendationCount": { "type": "number" }
                    }
                },
                "recommendations": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": { "type": "string", "format": "uuid" },
                            "instrument": { "type": "string" },
                            "action": { "type": "string" },
                            "confidence": { "type": "number" },
                            "rationale": { "type": "string" }
                        }
                    }
                }
            }
        }
    }'::JSONB,

    -- Capabilities
    ARRAY['stock-prediction', 'technical-analysis', 'fundamental-analysis', 'sentiment-analysis', 'ambient-monitoring', 'learning-loop']::TEXT[],

    -- Context (system prompt for specialists)
    '{
        "markdown": "# US Tech Stocks Predictor\n\nAn ambient prediction agent that continuously monitors major US technology stocks and generates trading recommendations.\n\n## Tracked Instruments\n- AAPL (Apple Inc.)\n- MSFT (Microsoft Corporation)\n- GOOGL (Alphabet Inc.)\n- NVDA (NVIDIA Corporation)\n\n## Analysis Pipeline\n1. **Data Collection**: Yahoo Finance for real-time quotes, optional Alpha Vantage for additional data\n2. **Pre-Filter**: 2% price change threshold triggers deeper analysis\n3. **Triage**: Rule-based and LLM-based assessment of opportunity/risk\n4. **Specialists**: Technical, Fundamental, Sentiment, and News analysts\n5. **Evaluators**: Contrarian, Risk Assessment, Historical Pattern red-teaming\n6. **Packaging**: Risk-adjusted recommendations based on profile\n\n## Risk Profiles\n- Conservative: Smaller positions, higher confidence threshold\n- Moderate (default): Balanced risk-reward\n- Aggressive: Larger positions, lower confidence threshold\n\n## Learning Loop\n- Tracks recommendation outcomes\n- Generates postmortems for incorrect predictions\n- Feeds lessons back into context"
    }'::JSONB,

    -- Endpoint (prediction agents run via runner, but expose an API for lifecycle control)
    '{
        "url": "http://localhost:3000/api/v1/predictions/agents/us-tech-stocks-2025"
    }'::JSONB,

    -- LLM config (for specialist analysis - uses default from org if not specified)
    '{
        "provider": "anthropic",
        "model": "claude-sonnet-4-20250514",
        "temperature": 0.3
    }'::JSONB,

    -- Metadata with runner config
    '{
        "runner": "stock-predictor",
        "hasCustomUI": true,
        "customUIComponent": "prediction-dashboard",
        "runnerConfig": {
            "runner": "stock-predictor",
            "instruments": ["AAPL", "MSFT", "GOOGL", "NVDA"],
            "riskProfile": "moderate",
            "pollIntervalMs": 60000,
            "preFilterThresholds": {
                "minPriceChangePercent": 2,
                "minSentimentShift": 0.2,
                "minSignificanceScore": 0.3
            },
            "modelConfig": {
                "triage": {
                    "provider": "anthropic",
                    "model": "claude-3-5-haiku-20241022",
                    "temperature": 0.2
                },
                "specialists": {
                    "provider": "anthropic",
                    "model": "claude-sonnet-4-20250514",
                    "temperature": 0.3
                },
                "evaluators": {
                    "provider": "anthropic",
                    "model": "claude-sonnet-4-20250514",
                    "temperature": 0.4
                },
                "learning": {
                    "provider": "anthropic",
                    "model": "claude-sonnet-4-20250514",
                    "temperature": 0.5
                }
            },
            "learningConfig": {
                "autoPostmortem": true,
                "detectMissedOpportunities": true,
                "contextLookbackHours": 24,
                "maxPostmortemsInContext": 10,
                "maxSpecialistStats": 5
            }
        }
    }'::JSONB,

    NOW(),
    NOW()
)
ON CONFLICT (slug, organization_slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    version = EXCLUDED.version,
    io_schema = EXCLUDED.io_schema,
    capabilities = EXCLUDED.capabilities,
    context = EXCLUDED.context,
    endpoint = EXCLUDED.endpoint,
    llm_config = EXCLUDED.llm_config,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- Then, insert the prediction agent configuration
INSERT INTO predictions.prediction_agents (
    agent_id,
    org_slug,
    runner_type,
    instruments,
    risk_profile,
    poll_interval_ms,
    pre_filter_thresholds,
    model_config,
    learning_config,
    lifecycle_state,
    auto_start
)
SELECT
    a.id,
    'finance',
    'stock-predictor',
    ARRAY['AAPL', 'MSFT', 'GOOGL', 'NVDA']::TEXT[],
    'moderate',
    60000,
    '{
        "minPriceChangePercent": 2,
        "minSentimentShift": 0.2,
        "minSignificanceScore": 0.3
    }'::JSONB,
    '{
        "triage": {
            "provider": "anthropic",
            "model": "claude-3-5-haiku-20241022",
            "temperature": 0.2
        },
        "specialists": {
            "provider": "anthropic",
            "model": "claude-sonnet-4-20250514",
            "temperature": 0.3
        },
        "evaluators": {
            "provider": "anthropic",
            "model": "claude-sonnet-4-20250514",
            "temperature": 0.4
        },
        "learning": {
            "provider": "anthropic",
            "model": "claude-sonnet-4-20250514",
            "temperature": 0.5
        }
    }'::JSONB,
    '{
        "autoPostmortem": true,
        "detectMissedOpportunities": true,
        "contextLookbackHours": 24,
        "maxPostmortemsInContext": 10,
        "maxSpecialistStats": 5
    }'::JSONB,
    'stopped',
    false  -- Don't auto-start initially
FROM public.agents a
WHERE a.slug = 'us-tech-stocks-2025'
  AND 'finance' = ANY(a.organization_slug)
ON CONFLICT (agent_id) DO UPDATE SET
    instruments = EXCLUDED.instruments,
    risk_profile = EXCLUDED.risk_profile,
    poll_interval_ms = EXCLUDED.poll_interval_ms,
    pre_filter_thresholds = EXCLUDED.pre_filter_thresholds,
    model_config = EXCLUDED.model_config,
    learning_config = EXCLUDED.learning_config,
    updated_at = NOW();
