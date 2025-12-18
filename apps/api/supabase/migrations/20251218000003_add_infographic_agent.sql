-- Migration: Add Infographic Agent
-- Description: Creates a media-type agent for infographic generation (demo org, marketing)
-- This agent creates infographics from topic inputs using image generation models

-- ============================================================================
-- Add infographic-agent definition
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
  'infographic-agent',
  ARRAY['demo'],
  'Infographic Agent',
  'Creates professional infographics from any topic or input. Transforms complex information into visually appealing, easy-to-understand graphics.',
  '1.0.0',
  'media',
  'marketing',
  ARRAY['infographic', 'marketing', 'visualization', 'media', 'design'],
  '{
    "input": {
      "type": "object",
      "required": ["topic"],
      "properties": {
        "topic": {
          "type": "string",
          "description": "The topic or content to transform into an infographic"
        },
        "style": {
          "type": "string",
          "enum": ["corporate", "modern", "minimal", "colorful", "vintage"],
          "default": "modern",
          "description": "Visual style of the infographic"
        },
        "orientation": {
          "type": "string",
          "enum": ["portrait", "landscape", "square"],
          "default": "portrait",
          "description": "Orientation of the infographic"
        },
        "colorScheme": {
          "type": "string",
          "description": "Optional color scheme (e.g., blue-orange, monochrome, brand colors)"
        },
        "sections": {
          "type": "number",
          "minimum": 1,
          "maximum": 10,
          "default": 5,
          "description": "Number of sections or data points to include"
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
            "topic": { "type": "string" },
            "generatedPrompt": { "type": "string" }
          }
        }
      }
    }
  }'::jsonb,
  ARRAY['image-generation', 'infographic-creation'],
  '# Infographic Agent

You are highly capable of creating professional infographics from any input. You excel at transforming complex topics, data, and information into visually appealing, easy-to-understand graphics.

## Your Capabilities

- Transform any topic into a structured infographic layout
- Create clear visual hierarchies for information
- Design with appropriate icons, charts, and visual elements
- Apply consistent styling and color schemes
- Organize content into digestible sections

## How You Work

1. **Analyze the Input**: Understand the topic and key points to convey
2. **Structure the Content**: Organize information into logical sections
3. **Design the Layout**: Create a visual flow that guides the viewer
4. **Generate the Infographic**: Produce a professional-quality image

## Limitations

- You cannot perform external research - work with the information provided
- You create static infographics (no interactive elements)
- Complex data should be pre-processed before submission

## Best Practices

- Keep text concise and impactful
- Use visual hierarchy to guide attention
- Maintain consistent branding/styling
- Ensure readability at various sizes',
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
    },
    "promptEnhancement": {
      "enabled": true,
      "template": "Create a professional infographic about: {topic}. Style: {style}. Layout: {orientation}. Include clear sections with icons and visual hierarchy."
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
    SELECT 1 FROM public.agents
    WHERE slug = 'infographic-agent'
    AND agent_type = 'media'
    AND 'demo' = ANY(organization_slug)
    AND department = 'marketing'
  ) INTO agent_exists;

  IF NOT agent_exists THEN
    RAISE EXCEPTION 'Infographic agent was not created successfully';
  END IF;

  RAISE NOTICE 'Successfully created infographic-agent for demo org with marketing department';
END $$;
