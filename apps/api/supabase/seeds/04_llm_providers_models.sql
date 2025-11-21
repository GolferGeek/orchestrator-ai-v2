-- =============================================================================
-- LLM PROVIDERS AND MODELS SEED DATA
-- =============================================================================
-- Popular LLM providers and their models for Orchestrator AI
-- =============================================================================

-- Insert LLM Providers
INSERT INTO public.llm_providers (name, display_name, api_base_url, configuration_json, is_active) VALUES
('anthropic', 'Anthropic', 'https://api.anthropic.com/v1', '{"api_key_env_var": "ANTHROPIC_API_KEY", "provider_type": "cloud"}'::jsonb, true),
('openai', 'OpenAI', 'https://api.openai.com/v1', '{"api_key_env_var": "OPENAI_API_KEY", "provider_type": "cloud"}'::jsonb, true),
('google', 'Google AI', 'https://generativelanguage.googleapis.com/v1', '{"api_key_env_var": "GOOGLE_API_KEY", "provider_type": "cloud"}'::jsonb, true),
('ollama', 'Ollama', 'http://localhost:11434', '{"provider_type": "local"}'::jsonb, true),
('xai', 'xAI', 'https://api.x.ai/v1', '{"api_key_env_var": "XAI_API_KEY", "provider_type": "cloud"}'::jsonb, true)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  api_base_url = EXCLUDED.api_base_url,
  configuration_json = EXCLUDED.configuration_json,
  is_active = EXCLUDED.is_active;

-- Insert LLM Models
INSERT INTO public.llm_models (
  model_name, provider_name, display_name, model_type, model_version,
  context_window, max_output_tokens, model_tier, speed_tier, capabilities
) VALUES

-- Anthropic Claude Models (Latest: Sonnet 4.5, Haiku 4.5, Opus 4.1)
('claude-sonnet-4-5-20250929', 'anthropic', 'Claude Sonnet 4.5', 'text-generation', '4.5', 200000, 16384, 'premium', 'fast', '["chat", "text-generation", "function-calling", "vision", "extended-thinking"]'::jsonb),
('claude-haiku-4-5-20250916', 'anthropic', 'Claude Haiku 4.5', 'text-generation', '4.5', 200000, 8192, 'standard', 'very-fast', '["chat", "text-generation", "function-calling", "vision"]'::jsonb),
('claude-opus-4-1-20250514', 'anthropic', 'Claude Opus 4.1', 'text-generation', '4.1', 200000, 16384, 'ultra-premium', 'medium', '["chat", "text-generation", "function-calling", "vision", "extended-thinking"]'::jsonb),
('claude-sonnet-4-20250514', 'anthropic', 'Claude Sonnet 4', 'text-generation', '4.0', 200000, 8192, 'premium', 'fast', '["chat", "text-generation", "function-calling", "vision"]'::jsonb),
('claude-opus-4-20250514', 'anthropic', 'Claude Opus 4', 'text-generation', '4.0', 200000, 16384, 'ultra-premium', 'medium', '["chat", "text-generation", "function-calling", "vision"]'::jsonb),
('claude-3-5-sonnet-20241022', 'anthropic', 'Claude 3.5 Sonnet', 'text-generation', '3.5', 200000, 8192, 'premium', 'fast', '["chat", "text-generation", "function-calling", "vision"]'::jsonb),
('claude-3-5-haiku-20241022', 'anthropic', 'Claude 3.5 Haiku', 'text-generation', '3.5', 200000, 8192, 'standard', 'very-fast', '["chat", "text-generation", "function-calling"]'::jsonb),
('claude-3-opus-20240229', 'anthropic', 'Claude 3 Opus', 'text-generation', '3.0', 200000, 4096, 'premium', 'medium', '["chat", "text-generation", "function-calling", "vision"]'::jsonb),

-- OpenAI GPT Models (Latest: o3, o4-mini, o3-mini)
('o3-mini-2025-01-31', 'openai', 'o3 Mini', 'text-generation', 'o3-mini', 200000, 100000, 'premium', 'fast', '["chat", "text-generation", "reasoning", "function-calling"]'::jsonb),
('o3', 'openai', 'o3', 'text-generation', 'o3', 200000, 100000, 'ultra-premium', 'medium', '["chat", "text-generation", "reasoning", "function-calling"]'::jsonb),
('o4-mini', 'openai', 'o4 Mini', 'text-generation', 'o4-mini', 200000, 100000, 'premium', 'fast', '["chat", "text-generation", "reasoning", "function-calling"]'::jsonb),
('gpt-4o', 'openai', 'GPT-4o', 'text-generation', '4o', 128000, 16384, 'premium', 'fast', '["chat", "text-generation", "function-calling", "vision"]'::jsonb),
('gpt-4o-mini', 'openai', 'GPT-4o Mini', 'text-generation', '4o-mini', 128000, 16384, 'budget', 'very-fast', '["chat", "text-generation", "function-calling", "vision"]'::jsonb),
('gpt-4-turbo', 'openai', 'GPT-4 Turbo', 'text-generation', '4-turbo', 128000, 4096, 'premium', 'medium', '["chat", "text-generation", "function-calling", "vision"]'::jsonb),
('gpt-4', 'openai', 'GPT-4', 'text-generation', '4', 8192, 8192, 'premium', 'slow', '["chat", "text-generation", "function-calling"]'::jsonb),
('gpt-3.5-turbo', 'openai', 'GPT-3.5 Turbo', 'text-generation', '3.5', 16385, 4096, 'budget', 'very-fast', '["chat", "text-generation", "function-calling"]'::jsonb),

-- OpenAI Embedding Models
('text-embedding-3-large', 'openai', 'Text Embedding 3 Large', 'embedding', '3', NULL, NULL, 'standard', 'fast', '["embeddings"]'::jsonb),
('text-embedding-3-small', 'openai', 'Text Embedding 3 Small', 'embedding', '3', NULL, NULL, 'budget', 'very-fast', '["embeddings"]'::jsonb),
('text-embedding-ada-002', 'openai', 'Ada 002 Embeddings', 'embedding', '2', NULL, NULL, 'budget', 'fast', '["embeddings"]'::jsonb),

-- Google Gemini Models (Latest: 2.5 Flash, 2.0 Flash Thinking)
('gemini-2.5-flash', 'google', 'Gemini 2.5 Flash', 'text-generation', '2.5', 1000000, 8192, 'premium', 'very-fast', '["chat", "text-generation", "function-calling", "vision"]'::jsonb),
('gemini-2.0-flash-thinking-exp-01-21', 'google', 'Gemini 2.0 Flash Thinking (Experimental)', 'text-generation', '2.0', 1000000, 8192, 'premium', 'fast', '["chat", "text-generation", "function-calling", "vision", "thinking"]'::jsonb),
('gemini-2.0-flash-exp', 'google', 'Gemini 2.0 Flash (Experimental)', 'text-generation', '2.0', 1000000, 8192, 'premium', 'very-fast', '["chat", "text-generation", "function-calling", "vision"]'::jsonb),
('gemini-1.5-pro', 'google', 'Gemini 1.5 Pro', 'text-generation', '1.5', 2000000, 8192, 'premium', 'medium', '["chat", "text-generation", "function-calling", "vision"]'::jsonb),
('gemini-1.5-flash', 'google', 'Gemini 1.5 Flash', 'text-generation', '1.5', 1000000, 8192, 'standard', 'very-fast', '["chat", "text-generation", "function-calling", "vision"]'::jsonb),

-- Ollama Models (Local - including user-requested models)
('llama3.2:1b', 'ollama', 'Llama 3.2 1B', 'text-generation', '3.2', 128000, 4096, 'local', 'very-fast', '["chat", "text-generation"]'::jsonb),
('llama3.2', 'ollama', 'Llama 3.2', 'text-generation', '3.2', 128000, 4096, 'local', 'medium', '["chat", "text-generation"]'::jsonb),
('llama3.2:3b', 'ollama', 'Llama 3.2 3B', 'text-generation', '3.2', 128000, 4096, 'local', 'fast', '["chat", "text-generation"]'::jsonb),
('deepseek-r1:32b', 'ollama', 'DeepSeek R1 32B', 'text-generation', 'r1', 65536, 4096, 'local', 'medium', '["chat", "text-generation", "reasoning"]'::jsonb),
('deepseek-r1:70b', 'ollama', 'DeepSeek R1 70B', 'text-generation', 'r1', 65536, 4096, 'local', 'slow', '["chat", "text-generation", "reasoning"]'::jsonb),
('qwen2.5:32b', 'ollama', 'Qwen 2.5 32B', 'text-generation', '2.5', 32768, 4096, 'local', 'medium', '["chat", "text-generation"]'::jsonb),
('mistral', 'ollama', 'Mistral 7B', 'text-generation', '7b', 32768, 4096, 'local', 'fast', '["chat", "text-generation"]'::jsonb),
('phi4', 'ollama', 'Phi 4', 'text-generation', '4', 16384, 4096, 'local', 'very-fast', '["chat", "text-generation"]'::jsonb),
('gemma3', 'ollama', 'Gemma 3', 'text-generation', '3', 32768, 4096, 'local', 'fast', '["chat", "text-generation"]'::jsonb),

-- xAI Grok Models (Latest: Grok 4.1)
('grok-4-1-fast-reasoning', 'xai', 'Grok 4.1 Fast (Reasoning)', 'text-generation', '4.1', 131072, 32768, 'premium', 'fast', '["chat", "text-generation", "reasoning"]'::jsonb),
('grok-4-1-fast-non-reasoning', 'xai', 'Grok 4.1 Fast (Non-Reasoning)', 'text-generation', '4.1', 131072, 32768, 'premium', 'fast', '["chat", "text-generation"]'::jsonb),
('grok-4', 'xai', 'Grok 4', 'text-generation', '4', 131072, 32768, 'premium', 'medium', '["chat", "text-generation", "vision"]'::jsonb),
('grok-3', 'xai', 'Grok 3', 'text-generation', '3', 131072, 32768, 'standard', 'fast', '["chat", "text-generation"]'::jsonb),
('grok-3-mini', 'xai', 'Grok 3 Mini', 'text-generation', '3', 131072, 32768, 'budget', 'very-fast', '["chat", "text-generation"]'::jsonb)

ON CONFLICT (model_name, provider_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  model_type = EXCLUDED.model_type,
  model_version = EXCLUDED.model_version,
  context_window = EXCLUDED.context_window,
  max_output_tokens = EXCLUDED.max_output_tokens,
  model_tier = EXCLUDED.model_tier,
  speed_tier = EXCLUDED.speed_tier,
  capabilities = EXCLUDED.capabilities;

-- Verification
DO $$
DECLARE
  provider_count INTEGER;
  model_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO provider_count FROM public.llm_providers;
  SELECT COUNT(*) INTO model_count FROM public.llm_models;

  RAISE NOTICE '================================================';
  RAISE NOTICE 'LLM Providers seeded: %', provider_count;
  RAISE NOTICE 'LLM Models seeded: %', model_count;
  RAISE NOTICE '================================================';

  IF provider_count < 5 THEN
    RAISE EXCEPTION 'Expected at least 5 providers, found %', provider_count;
  END IF;

  IF model_count < 38 THEN
    RAISE EXCEPTION 'Expected at least 38 models, found %', model_count;
  END IF;

  RAISE NOTICE 'All providers and models seeded successfully ✓';
END $$;
