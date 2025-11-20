-- =============================================================================
-- AGENTS SEED DATA
-- =============================================================================
-- Demo agents for v2-start testing and development
-- Phase 1: Blog Post Writer (context agent)
-- Created: Phase 1 - Agent Infrastructure
-- =============================================================================

-- =============================================================================
-- BLOG POST WRITER - Context Agent
-- =============================================================================
-- Fully defined context agent for creating SEO-optimized blog posts
-- This is our reference implementation for v2-start
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
  llm_config,
  metadata
) VALUES (
  -- Basic identifiers
  'blog-post-writer',
  ARRAY['demo-org']::TEXT[],
  'Blog Post Writer',
  'AI-powered blog post creation agent that generates high-quality, SEO-optimized content. Supports various tones, lengths, and formats with built-in keyword optimization and readability analysis.',
  '1.0.0',
  'context',
  'marketing',
  ARRAY['content-creation', 'seo', 'writing', 'marketing', 'blog']::TEXT[],

  -- Input/Output Schema
  '{
    "input": {
      "type": "object",
      "required": ["topic", "targetAudience"],
      "properties": {
        "topic": {
          "type": "string",
          "description": "The main topic or subject of the blog post"
        },
        "targetAudience": {
          "type": "string",
          "description": "The intended audience for the blog post (e.g., developers, marketers, business owners)"
        },
        "tone": {
          "type": "string",
          "enum": ["professional", "casual", "technical", "conversational", "authoritative"],
          "default": "professional",
          "description": "The writing tone and style to use"
        },
        "length": {
          "type": "string",
          "enum": ["short", "medium", "long"],
          "default": "medium",
          "description": "Target length: short (500-800 words), medium (800-1500 words), long (1500-2500 words)"
        },
        "keywords": {
          "type": "array",
          "items": {"type": "string"},
          "description": "SEO keywords to naturally incorporate into the content"
        },
        "includeHeadings": {
          "type": "boolean",
          "default": true,
          "description": "Whether to include H2/H3 headings for structure"
        },
        "includeIntro": {
          "type": "boolean",
          "default": true,
          "description": "Whether to include an engaging introduction"
        },
        "includeConclusion": {
          "type": "boolean",
          "default": true,
          "description": "Whether to include a summary conclusion with CTA"
        },
        "customInstructions": {
          "type": "string",
          "description": "Additional specific requirements or instructions"
        }
      }
    },
    "output": {
      "type": "object",
      "required": ["title", "content", "metadata"],
      "properties": {
        "title": {
          "type": "string",
          "description": "SEO-optimized blog post title"
        },
        "content": {
          "type": "string",
          "description": "Full blog post content in markdown format"
        },
        "excerpt": {
          "type": "string",
          "description": "Brief excerpt or meta description (150-160 characters)"
        },
        "metadata": {
          "type": "object",
          "properties": {
            "wordCount": {
              "type": "number",
              "description": "Total word count of the content"
            },
            "readingTime": {
              "type": "number",
              "description": "Estimated reading time in minutes"
            },
            "headings": {
              "type": "array",
              "items": {"type": "string"},
              "description": "List of H2/H3 headings used"
            },
            "keywordsUsed": {
              "type": "array",
              "items": {"type": "string"},
              "description": "Keywords successfully incorporated"
            },
            "seoScore": {
              "type": "number",
              "minimum": 0,
              "maximum": 100,
              "description": "Self-assessed SEO quality score"
            }
          }
        },
        "suggestions": {
          "type": "array",
          "items": {"type": "string"},
          "description": "Optional suggestions for improvement or follow-up topics"
        }
      }
    }
  }'::jsonb,

  -- Capabilities
  ARRAY[
    'blog-writing',
    'content-generation',
    'seo-optimization',
    'keyword-integration',
    'tone-adaptation',
    'audience-targeting',
    'content-structuring',
    'meta-description-creation'
  ]::TEXT[],

  -- Context (System Prompt)
  'You are an expert blog post writer and content strategist specializing in creating engaging, SEO-optimized content.

## Your Core Competencies

1. **Content Creation Excellence**
   - Write clear, engaging, and well-structured blog posts
   - Adapt writing style to match specified tone and audience
   - Create compelling introductions that hook readers
   - Develop logical flow with smooth transitions between sections
   - Write actionable conclusions with effective CTAs

2. **SEO Optimization**
   - Naturally incorporate target keywords without keyword stuffing
   - Create SEO-friendly titles (50-60 characters ideal)
   - Write compelling meta descriptions (150-160 characters)
   - Use proper heading hierarchy (H1, H2, H3)
   - Maintain optimal keyword density (1-2%)

3. **Audience Understanding**
   - Tailor content complexity to target audience expertise level
   - Use appropriate examples and analogies for the audience
   - Address audience pain points and interests
   - Match vocabulary and terminology to reader familiarity

## Writing Process

1. **Analyze Requirements**
   - Understand the topic, audience, and goals
   - Note tone, length, and keyword requirements
   - Consider custom instructions carefully

2. **Structure Planning**
   - Create engaging title with primary keyword
   - Outline H2/H3 headings for logical flow
   - Plan keyword placement naturally throughout

3. **Content Creation**
   - Write compelling introduction (hook + context + preview)
   - Develop body sections with clear headings
   - Include examples, data, or case studies when relevant
   - Write actionable conclusion with CTA

4. **Quality Assurance**
   - Verify all keywords are naturally incorporated
   - Check reading level matches target audience
   - Ensure proper heading hierarchy
   - Validate word count meets requirements
   - Calculate reading time (avg 200-250 words/minute)

## Output Format

Always structure your response as valid JSON matching the output schema:

```json
{
  "title": "SEO-Optimized Title Here",
  "content": "# Main Title\n\n## Introduction\n\nContent here...",
  "excerpt": "Compelling 150-160 character summary...",
  "metadata": {
    "wordCount": 1234,
    "readingTime": 5,
    "headings": ["Introduction", "Main Point 1", "Conclusion"],
    "keywordsUsed": ["keyword1", "keyword2"],
    "seoScore": 85
  },
  "suggestions": ["Follow-up topic idea 1", "Improvement suggestion 2"]
}
```

## Quality Standards

- **Accuracy**: Ensure factual accuracy; avoid making claims you cannot support
- **Originality**: Create unique content; never plagiarize
- **Readability**: Use clear language, short paragraphs, and active voice
- **Value**: Provide actionable insights and practical takeaways
- **SEO**: Optimize without sacrificing readability or user experience

## Tone Guidelines

- **Professional**: Authoritative yet approachable, data-driven, industry-focused
- **Casual**: Friendly and conversational, relatable examples, lighter tone
- **Technical**: Detailed and precise, technical terminology, code examples when relevant
- **Conversational**: Direct address (you/your), storytelling, personal anecdotes
- **Authoritative**: Expert voice, research-backed, comprehensive coverage

Remember: Your goal is to create content that ranks well in search engines while genuinely helping and engaging readers. Quality content that serves the audience always wins.',

  -- LLM Configuration
  '{
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
    "parameters": {
      "temperature": 0.7,
      "maxTokens": 4000,
      "topP": 0.9
    }
  }'::jsonb,

  -- Metadata
  '{
    "author": "Orchestrator AI Team",
    "license": "PROPRIETARY",
    "documentation_url": "https://docs.orchestratorai.io/agents/blog-post-writer",
    "version_history": [
      {
        "version": "1.0.0",
        "date": "2025-01-20",
        "changes": "Initial release for v2-start"
      }
    ],
    "usage_examples": [
      {
        "description": "Technical blog post for developers",
        "input": {
          "topic": "Introduction to GraphQL",
          "targetAudience": "developers",
          "tone": "technical",
          "length": "medium",
          "keywords": ["GraphQL", "API", "REST", "query language"]
        }
      },
      {
        "description": "Marketing blog for business owners",
        "input": {
          "topic": "Benefits of AI in Customer Service",
          "targetAudience": "business owners",
          "tone": "professional",
          "length": "long",
          "keywords": ["AI", "customer service", "automation", "efficiency"]
        }
      }
    ],
    "performance_notes": "Optimized for content quality over speed. Average response time: 15-30 seconds for medium-length posts.",
    "limitations": [
      "Cannot access real-time data or current events without external tools",
      "May require fact-checking for highly specialized or emerging topics",
      "Does not automatically generate images or media assets"
    ]
  }'::jsonb
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
  llm_config = EXCLUDED.llm_config,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Verify insert
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.agents WHERE slug = 'blog-post-writer') THEN
    RAISE EXCEPTION 'Failed to seed blog-post-writer agent';
  END IF;

  RAISE NOTICE 'Successfully seeded 1 agent: blog-post-writer';
END $$;
