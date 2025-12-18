-- Migration: Add Image Generator Agent
-- Description: Creates a media-type agent for image generation using the MediaAgentRunner
-- This agent uses the new media runner to generate images via OpenAI and Google providers

-- ============================================================================
-- Add image-generator agent definition
-- ============================================================================

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
  'image-generator',
  ARRAY['global'],
  'Image Generator',
  'Generates high-quality images using AI models from OpenAI (GPT Image, DALL-E) and Google (Imagen 4). Supports various sizes, styles, and quality settings.',
  '1.0.0',
  'media',
  'creative',
  ARRAY['image', 'generation', 'creative', 'media', 'ai-art'],
  '{
    "input": {
      "type": "object",
      "required": ["prompt"],
      "properties": {
        "prompt": {
          "type": "string",
          "description": "Text description of the image to generate"
        },
        "size": {
          "type": "string",
          "enum": ["256x256", "512x512", "1024x1024", "1792x1024", "1024x1792"],
          "default": "1024x1024",
          "description": "Image dimensions"
        },
        "quality": {
          "type": "string",
          "enum": ["standard", "hd"],
          "default": "standard",
          "description": "Image quality level"
        },
        "style": {
          "type": "string",
          "enum": ["natural", "vivid"],
          "default": "natural",
          "description": "Image style"
        },
        "numberOfImages": {
          "type": "number",
          "minimum": 1,
          "maximum": 4,
          "default": 1,
          "description": "Number of images to generate"
        }
      }
    },
    "output": {
      "type": "object",
      "properties": {
        "success": {
          "type": "boolean"
        },
        "images": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "assetId": { "type": "string" },
              "url": { "type": "string" },
              "mimeType": { "type": "string" }
            }
          }
        },
        "metadata": {
          "type": "object",
          "properties": {
            "provider": { "type": "string" },
            "model": { "type": "string" },
            "prompt": { "type": "string" }
          }
        }
      }
    }
  }'::jsonb,
  ARRAY['image-generation'],
  '# Image Generator Agent

This agent generates high-quality images using AI models from OpenAI and Google.

## Supported Providers

### OpenAI
- **gpt-image-1.5**: Latest GPT Image model with superior quality and text rendering
- **gpt-image-1**: Flagship GPT Image model with 3 quality tiers

### Google
- **imagen-4.0-generate-001**: Imagen 4 for high-quality photorealistic images
- **imagen-4.0-ultra-generate-001**: Imagen 4 Ultra for maximum prompt alignment

## Parameters

- **prompt**: Text description of what to generate
- **size**: Image dimensions (1024x1024 default)
- **quality**: standard or hd
- **style**: natural or vivid
- **numberOfImages**: How many images (1-4)

## Output

Generated images are stored in Supabase storage and linked to the conversation/task via the assets table.',
  NULL,
  NULL,
  '{
    "mediaType": "image",
    "defaultProvider": "openai",
    "defaultModel": "gpt-image-1.5",
    "supportedProviders": ["openai", "google"],
    "supportedModels": {
      "openai": ["gpt-image-1.5", "gpt-image-1"],
      "google": ["imagen-4.0-generate-001", "imagen-4.0-ultra-generate-001"]
    },
    "executionCapabilities": {
      "supportsConverse": false,
      "supportsPlan": false,
      "supportsBuild": true
    }
  }'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  version = EXCLUDED.version,
  agent_type = EXCLUDED.agent_type,
  department = EXCLUDED.department,
  tags = EXCLUDED.tags,
  io_schema = EXCLUDED.io_schema,
  capabilities = EXCLUDED.capabilities,
  context = EXCLUDED.context,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
  agent_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.agents WHERE slug = 'image-generator' AND agent_type = 'media'
  ) INTO agent_exists;

  IF NOT agent_exists THEN
    RAISE EXCEPTION 'Image generator agent was not created successfully';
  END IF;

  RAISE NOTICE 'Successfully created image-generator agent with media type';
END $$;
