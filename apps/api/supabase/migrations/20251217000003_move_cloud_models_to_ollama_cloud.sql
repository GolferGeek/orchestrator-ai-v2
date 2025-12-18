-- =============================================================================
-- MOVE CLOUD MODELS TO OLLAMA-CLOUD PROVIDER
-- =============================================================================
-- Cloud models (is_local=false) were incorrectly placed in the 'ollama' provider
-- They should be in 'ollama-cloud' to distinguish local vs cloud execution
--
-- IMPORTANT: Only models that actually exist on Ollama Cloud should be here.
-- Available Ollama Cloud models (as of Dec 2025):
--   - deepseek-v3.1:671b, deepseek-v3.2
--   - gpt-oss:20b, gpt-oss:120b
--   - qwen3-next:80b, qwen3-coder:480b
--   - mistral-large-3:675b
--   - cogito-2.1:671b
--   - and others (check https://ollama.com/cloud for current list)
-- =============================================================================

-- Ensure ollama-cloud provider exists
INSERT INTO public.llm_providers (name, display_name, is_active, is_local)
VALUES ('ollama-cloud', 'Ollama Cloud', true, false)
ON CONFLICT (name) DO NOTHING;

-- Delete any invalid ollama-cloud models that don't exist on Ollama Cloud
-- These models only exist locally or in the Ollama library, not on the cloud API
DELETE FROM public.llm_models
WHERE provider_name = 'ollama-cloud'
  AND model_name IN ('llama3.2:70b', 'llama3.3:70b', 'qwen2.5:72b', 'mixtral:8x22b');

-- Fix model names to match Ollama Cloud's actual model names
-- deepseek-r1:671b -> deepseek-v3.1:671b (Ollama Cloud naming)
UPDATE public.llm_models
SET model_name = 'deepseek-v3.1:671b',
    display_name = 'DeepSeek V3.1 671B'
WHERE model_name = 'deepseek-r1:671b'
  AND provider_name = 'ollama-cloud';

-- Insert valid Ollama Cloud models
INSERT INTO public.llm_models (provider_name, model_name, display_name, is_local, is_active, context_window, max_output_tokens)
VALUES
  ('ollama-cloud', 'deepseek-v3.1:671b', 'DeepSeek V3.1 671B', false, true, 128000, 8192),
  ('ollama-cloud', 'deepseek-v3.2', 'DeepSeek V3.2 (Cloud)', false, true, 128000, 8192),
  ('ollama-cloud', 'gpt-oss:20b', 'GPT-OSS 20B (Cloud)', false, true, 128000, 8192),
  ('ollama-cloud', 'gpt-oss:120b', 'GPT-OSS 120B (Cloud)', false, true, 128000, 8192),
  ('ollama-cloud', 'qwen3-next:80b', 'Qwen3 Next 80B (Cloud)', false, true, 128000, 8192)
ON CONFLICT (provider_name, model_name) DO NOTHING;

-- Log the results
DO $$
DECLARE
  ollama_local_count INTEGER;
  ollama_cloud_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO ollama_local_count
  FROM public.llm_models
  WHERE provider_name = 'ollama' AND is_local = true;

  SELECT COUNT(*) INTO ollama_cloud_count
  FROM public.llm_models
  WHERE provider_name = 'ollama-cloud' AND is_local = false;

  RAISE NOTICE '================================================';
  RAISE NOTICE 'Ollama Cloud models configured';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Ollama (local) models: %', ollama_local_count;
  RAISE NOTICE 'Ollama Cloud models: %', ollama_cloud_count;
  RAISE NOTICE '================================================';
END $$;
