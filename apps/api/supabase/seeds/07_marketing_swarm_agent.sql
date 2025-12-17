-- =============================================================================
-- MARKETING SWARM API AGENT REGISTRATION
-- =============================================================================
-- Registers marketing-swarm as an API agent that wraps the LangGraph workflow
-- Created: 2025-12-11
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
    metadata
) VALUES (
    'marketing-swarm',
    ARRAY['demo-org']::TEXT[],
    'Marketing Swarm',
    'Multi-agent marketing content generation system. Uses multiple writer agents to create drafts, editor agents for review cycles, and evaluator agents to score outputs. Compares different LLM and personality combinations.',
    '1.0.0',
    'api',
    'marketing',
    ARRAY['content-creation', 'multi-agent', 'swarm', 'marketing', 'langgraph']::TEXT[],

    -- Input/Output Schema
    '{
        "input": {
            "type": "object",
            "required": ["contentTypeSlug", "promptData", "config"],
            "properties": {
                "contentTypeSlug": {
                    "type": "string",
                    "description": "Slug of the content type to generate (e.g., blog-post, linkedin-post)"
                },
                "promptData": {
                    "type": "object",
                    "description": "Answers to the 8-question interview guiding content creation",
                    "properties": {
                        "topic": { "type": "string" },
                        "audience": { "type": "string" },
                        "goal": { "type": "string" },
                        "keyPoints": { "type": "array", "items": { "type": "string" } },
                        "tone": { "type": "string" },
                        "constraints": { "type": "string" },
                        "examples": { "type": "string" },
                        "additionalContext": { "type": "string" }
                    }
                },
                "config": {
                    "type": "object",
                    "description": "Selected agents and LLM configurations",
                    "properties": {
                        "writers": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "agentSlug": { "type": "string" },
                                    "llmConfigIds": { "type": "array", "items": { "type": "string" } }
                                }
                            }
                        },
                        "editors": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "agentSlug": { "type": "string" },
                                    "llmConfigIds": { "type": "array", "items": { "type": "string" } }
                                }
                            }
                        },
                        "evaluators": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "agentSlug": { "type": "string" },
                                    "llmConfigIds": { "type": "array", "items": { "type": "string" } }
                                }
                            }
                        },
                        "maxEditCycles": {
                            "type": "integer",
                            "default": 3,
                            "minimum": 1,
                            "maximum": 5
                        }
                    }
                }
            }
        },
        "output": {
            "type": "object",
            "properties": {
                "taskId": {
                    "type": "string",
                    "description": "UUID of the swarm task for tracking"
                },
                "status": {
                    "type": "string",
                    "enum": ["pending", "running", "completed", "failed"],
                    "description": "Current status of the swarm execution"
                },
                "progress": {
                    "type": "object",
                    "properties": {
                        "total": { "type": "integer" },
                        "completed": { "type": "integer" },
                        "percentage": { "type": "number" }
                    }
                },
                "outputs": {
                    "type": "array",
                    "description": "Generated content outputs with evaluations",
                    "items": {
                        "type": "object",
                        "properties": {
                            "outputId": { "type": "string" },
                            "writerAgent": { "type": "string" },
                            "writerLlm": { "type": "string" },
                            "editorAgent": { "type": "string" },
                            "editorLlm": { "type": "string" },
                            "content": { "type": "string" },
                            "editCycles": { "type": "integer" },
                            "averageScore": { "type": "number" },
                            "evaluations": { "type": "array" }
                        }
                    }
                },
                "rankedResults": {
                    "type": "array",
                    "description": "Outputs ranked by weighted evaluation scores"
                }
            }
        }
    }'::JSONB,

    -- Capabilities
    ARRAY['content-generation', 'multi-agent-orchestration', 'iterative-editing', 'content-evaluation', 'llm-comparison']::TEXT[],

    -- Context (JSONB with markdown content)
    '{"markdown": "# Marketing Swarm Agent\n\nA sophisticated multi-agent system for generating high-quality marketing content through collaboration and competition.\n\n## How It Works\n\n1. **Configuration**: Select content type, provide prompts, choose writer/editor/evaluator agents with LLM configurations\n2. **Writing Phase**: Multiple writer agents generate initial drafts in parallel (or sequentially for local LLMs)\n3. **Editing Phase**: Each draft is reviewed by selected editors (up to 5 revision cycles until approved)\n4. **Evaluation Phase**: All approved outputs are scored by evaluator agents\n5. **Ranking**: Outputs are ranked by weighted evaluation scores\n\n## Key Features\n\n- **Personality + LLM Separation**: Same agent personality can use different LLMs for comparison\n- **Multiplicative Combinations**: Writers × Editors × LLMs = comprehensive content exploration\n- **Iterative Refinement**: Edit cycles continue until editor approves or max cycles reached\n- **Full Audit Trail**: Every draft, revision, and evaluation is stored for analysis\n- **Reconnection Support**: Resume viewing progress from database state\n\n## Custom UI\n\nThis agent has a custom UI at `/agents/{org}/marketing-swarm` that provides:\n- Interactive configuration wizard\n- Real-time progress dashboard with agent cards\n- Side-by-side content comparison\n- Detailed audit trail viewer\n\n## SSE Progress Events\n\nThe agent streams progress via SSE messages:\n- `queue_built`: Initial execution plan ready\n- `step_started`: Agent beginning work\n- `step_completed`: Agent finished with results\n- `edit_cycle_added`: New revision cycle needed\n- `phase_changed`: Major workflow phase transition\n- `error`: Something went wrong"}'::JSONB,

    -- Endpoint configuration (API agent calling LangGraph)
    '{
        "url": "http://localhost:6200/marketing-swarm/execute",
        "method": "POST",
        "headers": {
            "Content-Type": "application/json"
        },
        "timeout": 600000,
        "responseTransform": {
            "content": "$.message",
            "metadata": {
                "taskId": "$.taskId",
                "status": "$.status",
                "progress": "$.progress"
            }
        }
    }'::JSONB,

    -- Metadata
    '{
        "provider": "langgraph",
        "langgraphEndpoint": "http://localhost:6200",
        "features": ["multi-agent", "swarm", "sse-streaming", "custom-ui"],
        "hasCustomUI": true,
        "customUIComponent": "marketing-swarm",
        "statusEndpoint": "/marketing-swarm/status/{taskId}",
        "execution_capabilities": {
            "can_converse": false,
            "can_plan": false,
            "can_build": true,
            "requires_human_gate": false
        }
    }'::JSONB
)
ON CONFLICT (organization_slug, slug) DO UPDATE SET
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
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

DO $$
BEGIN
    RAISE NOTICE 'Successfully registered marketing-swarm API agent';
END $$;
