-- Set require_local_model = true for all legal department agents
-- Legal agents handle sensitive client data and should use local LLMs only

UPDATE public.agents
SET require_local_model = true,
    updated_at = NOW()
WHERE department = 'legal';

-- Log the update
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % legal agents to require local model', updated_count;
END $$;
