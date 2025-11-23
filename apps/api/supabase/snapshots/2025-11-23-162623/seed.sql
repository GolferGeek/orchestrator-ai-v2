-- Full Database Seed Data
-- Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
-- Contains ALL data from critical tables across all schemas

-- Disable triggers during import for speed
SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

\restrict n6I2AgYS4YMJ7FXcez6uBQ73a0vo0PY1MbWR53Y63ylHe5QLDKVCa4IvVUXSa9c

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: agents; Type: TABLE DATA; Schema: public; Owner: -
--

SET SESSION AUTHORIZATION DEFAULT;

ALTER TABLE public.agents DISABLE TRIGGER ALL;

INSERT INTO public.agents (slug, organization_slug, name, description, version, agent_type, department, tags, io_schema, capabilities, context, endpoint, llm_config, metadata, created_at, updated_at) VALUES ('blog-post-writer', '{demo-org}', 'Blog Post Writer', 'AI-powered blog post creation agent that generates high-quality, SEO-optimized content. Supports various tones, lengths, and formats with built-in keyword optimization and readability analysis.', '1.0.0', 'context', 'marketing', '{content-creation,seo,writing,marketing,blog}', '{"input": {"type": "object", "required": ["topic", "targetAudience"], "properties": {"tone": {"enum": ["professional", "casual", "technical", "conversational", "authoritative"], "type": "string", "default": "professional", "description": "The writing tone and style to use"}, "topic": {"type": "string", "description": "The main topic or subject of the blog post"}, "length": {"enum": ["short", "medium", "long"], "type": "string", "default": "medium", "description": "Target length: short (500-800 words), medium (800-1500 words), long (1500-2500 words)"}, "keywords": {"type": "array", "items": {"type": "string"}, "description": "SEO keywords to naturally incorporate into the content"}, "includeIntro": {"type": "boolean", "default": true, "description": "Whether to include an engaging introduction"}, "targetAudience": {"type": "string", "description": "The intended audience for the blog post (e.g., developers, marketers, business owners)"}, "includeHeadings": {"type": "boolean", "default": true, "description": "Whether to include H2/H3 headings for structure"}, "includeConclusion": {"type": "boolean", "default": true, "description": "Whether to include a summary conclusion with CTA"}, "customInstructions": {"type": "string", "description": "Additional specific requirements or instructions"}}}, "output": {"type": "object", "required": ["title", "content", "metadata"], "properties": {"title": {"type": "string", "description": "SEO-optimized blog post title"}, "content": {"type": "string", "description": "Full blog post content in markdown format"}, "excerpt": {"type": "string", "description": "Brief excerpt or meta description (150-160 characters)"}, "metadata": {"type": "object", "properties": {"headings": {"type": "array", "items": {"type": "string"}, "description": "List of H2/H3 headings used"}, "seoScore": {"type": "number", "maximum": 100, "minimum": 0, "description": "Self-assessed SEO quality score"}, "wordCount": {"type": "number", "description": "Total word count of the content"}, "readingTime": {"type": "number", "description": "Estimated reading time in minutes"}, "keywordsUsed": {"type": "array", "items": {"type": "string"}, "description": "Keywords successfully incorporated"}}}, "suggestions": {"type": "array", "items": {"type": "string"}, "description": "Optional suggestions for improvement or follow-up topics"}}}}', '{blog-writing,content-generation,seo-optimization,keyword-integration,tone-adaptation,audience-targeting,content-structuring,meta-description-creation,plan,build}', 'You are an expert blog post writer and content strategist specializing in creating engaging, SEO-optimized content.

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

Remember: Your goal is to create content that ranks well in search engines while genuinely helping and engaging readers. Quality content that serves the audience always wins.', NULL, '{"model": "claude-3-5-sonnet-20241022", "provider": "anthropic", "parameters": {"topP": 0.9, "maxTokens": 4000, "temperature": 0.7}}', '{"author": "Orchestrator AI Team", "license": "PROPRIETARY", "limitations": ["Cannot access real-time data or current events without external tools", "May require fact-checking for highly specialized or emerging topics", "Does not automatically generate images or media assets"], "mode_profile": "full", "usage_examples": [{"input": {"tone": "technical", "topic": "Introduction to GraphQL", "length": "medium", "keywords": ["GraphQL", "API", "REST", "query language"], "targetAudience": "developers"}, "description": "Technical blog post for developers"}, {"input": {"tone": "professional", "topic": "Benefits of AI in Customer Service", "length": "long", "keywords": ["AI", "customer service", "automation", "efficiency"], "targetAudience": "business owners"}, "description": "Marketing blog for business owners"}], "version_history": [{"date": "2025-01-20", "changes": "Initial release for v2-start", "version": "1.0.0"}], "documentation_url": "https://docs.orchestratorai.io/agents/blog-post-writer", "performance_notes": "Optimized for content quality over speed. Average response time: 15-30 seconds for medium-length posts.", "execution_capabilities": {"can_plan": true, "can_build": true, "can_converse": true}}', '2025-11-23 21:09:56.490914+00', '2025-11-23 21:09:56.490914+00');


ALTER TABLE public.agents ENABLE TRIGGER ALL;

--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.organizations DISABLE TRIGGER ALL;

INSERT INTO public.organizations (slug, name, description, url, settings, created_at, updated_at) VALUES ('my-org', 'My Organization', 'Personal organization', NULL, '{}', '2025-11-23 21:08:41.845477+00', '2025-11-23 21:08:41.845477+00');
INSERT INTO public.organizations (slug, name, description, url, settings, created_at, updated_at) VALUES ('demo-org', 'Demo Organization', 'Default demo organization', 'https://orchestratorai.io', '{"theme": "light", "limits": {"max_agents": 100, "max_conversations": 1000}, "features": ["context-agents", "api-agents", "external-agents"], "preferences": {"default_llm_model": "claude-3-5-sonnet-20241022", "default_llm_provider": "anthropic"}}', '2025-11-23 21:08:41.845477+00', '2025-11-23 21:23:57.24728+00');
INSERT INTO public.organizations (slug, name, description, url, settings, created_at, updated_at) VALUES ('orchestratorai', 'OrchestratorAI', 'Main OrchestratorAI organization', NULL, '{}', '2025-11-23 21:23:57.24728+00', '2025-11-23 21:23:57.24728+00');
INSERT INTO public.organizations (slug, name, description, url, settings, created_at, updated_at) VALUES ('law-firm', 'Law Firm', 'Law firm demo organization', NULL, '{}', '2025-11-23 21:23:57.24728+00', '2025-11-23 21:23:57.24728+00');
INSERT INTO public.organizations (slug, name, description, url, settings, created_at, updated_at) VALUES ('finance-firm', 'Finance Firm', 'Finance firm demo organization', NULL, '{}', '2025-11-23 21:23:57.24728+00', '2025-11-23 21:23:57.24728+00');
INSERT INTO public.organizations (slug, name, description, url, settings, created_at, updated_at) VALUES ('manufacturing-firm', 'Manufacturing Firm', 'Manufacturing firm demo organization', NULL, '{}', '2025-11-23 21:23:57.24728+00', '2025-11-23 21:23:57.24728+00');
INSERT INTO public.organizations (slug, name, description, url, settings, created_at, updated_at) VALUES ('marketing-firm', 'Marketing Firm', 'Marketing firm demo organization', NULL, '{}', '2025-11-23 21:23:57.24728+00', '2025-11-23 21:23:57.24728+00');
INSERT INTO public.organizations (slug, name, description, url, settings, created_at, updated_at) VALUES ('golfergeek', 'GolferGeek', 'GolferGeek personal organization', NULL, '{}', '2025-11-23 21:23:57.24728+00', '2025-11-23 21:23:57.24728+00');
INSERT INTO public.organizations (slug, name, description, url, settings, created_at, updated_at) VALUES ('hiverarchy', 'Hiverarchy', 'Hiverarchy organization', NULL, '{}', '2025-11-23 21:23:57.24728+00', '2025-11-23 21:23:57.24728+00');
INSERT INTO public.organizations (slug, name, description, url, settings, created_at, updated_at) VALUES ('*', 'All Organizations', 'Special organization representing access to all organizations (superadmin)', NULL, '{}', '2025-11-23 22:07:03.948684+00', '2025-11-23 22:07:03.948684+00');
INSERT INTO public.organizations (slug, name, description, url, settings, created_at, updated_at) VALUES ('all', 'All Organizations', 'Special organization representing access to all organizations', NULL, '{}', '2025-11-23 22:07:23.905444+00', '2025-11-23 22:07:23.905444+00');


ALTER TABLE public.organizations ENABLE TRIGGER ALL;

--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.conversations DISABLE TRIGGER ALL;

INSERT INTO public.conversations (id, user_id, agent_name, agent_type, started_at, last_active_at, ended_at, primary_work_product_type, primary_work_product_id, organization_slug, metadata, created_at, updated_at) VALUES ('d4de0d8d-e56f-4ed0-bb42-cca569793905', '618f3960-a8be-4c67-855f-aae4130699b8', 'blog-post-writer', 'context', '2025-11-23 22:22:25.288+00', '2025-11-23 22:22:25.288+00', NULL, NULL, NULL, 'demo-org', '{"title": "Blog-Post-Writer 04:22 PM", "source": "frontend"}', '2025-11-23 22:22:25.289288+00', '2025-11-23 22:22:25.289288+00');


ALTER TABLE public.conversations ENABLE TRIGGER ALL;

--
-- Data for Name: assets; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.assets DISABLE TRIGGER ALL;



ALTER TABLE public.assets ENABLE TRIGGER ALL;

--
-- Data for Name: cidafm_commands; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.cidafm_commands DISABLE TRIGGER ALL;



ALTER TABLE public.cidafm_commands ENABLE TRIGGER ALL;

--
-- Data for Name: deliverables; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.deliverables DISABLE TRIGGER ALL;

INSERT INTO public.deliverables (id, user_id, conversation_id, agent_name, title, type, created_at, updated_at) VALUES ('09d89c38-54ed-4966-82f7-cd1ac8db3831', '618f3960-a8be-4c67-855f-aae4130699b8', 'd4de0d8d-e56f-4ed0-bb42-cca569793905', 'Blog Post Writer', 'Blog Post Writer Deliverable', 'document', '2025-11-23 22:23:04.125842+00', '2025-11-23 22:23:04.125842+00');


ALTER TABLE public.deliverables ENABLE TRIGGER ALL;

--
-- Data for Name: deliverable_versions; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.deliverable_versions DISABLE TRIGGER ALL;

INSERT INTO public.deliverable_versions (id, deliverable_id, version_number, content, format, metadata, created_at, is_current_version, created_by_type, task_id, file_attachments) VALUES ('88a0ac80-1a81-4db6-b4ad-fac262289a98', '09d89c38-54ed-4966-82f7-cd1ac8db3831', 1, '# Playing Golf in the Rain: Tips and Tricks for Wet Weather Rounds

## Introduction

As a passionate golfer, you know that the game waits for no one—not even Mother Nature. While playing golf in the rain may seem daunting, it can be a unique and rewarding experience when you''re properly prepared. In this post, we''ll explore some essential tips and tricks for mastering your wet weather rounds and making the most of your time on the course, rain or shine.

## Dress for Success

The key to enjoying your rainy round is wearing the right gear. Invest in a quality, waterproof golf jacket and pants to keep you dry and comfortable throughout your game. Look for breathable, lightweight materials that won''t restrict your swing. Don''t forget to pack a pair of rain gloves to maintain your grip on the club, even when your hands are wet.

## Prepare Your Equipment

Before heading out, make sure your golf bag is equipped with rain gear essentials. Pack an extra towel or two to dry your clubs and balls between shots. Consider using a golf umbrella to shield yourself and your clubs from the elements. If you have one, bring along a golf bag rain cover to protect your clubs and keep them dry.

## Adjust Your Strategy

Playing golf in the rain requires a different approach than playing in dry conditions. The wet turf will affect your ball''s roll and distance, so take this into account when selecting your clubs. Opt for more club than you would normally use to compensate for the lack of roll. Focus on hitting the ball solidly rather than trying to generate extra power, as a well-struck shot will be more effective in wet conditions.

## Embrace the Elements

Instead of letting the rain dampen your spirits, embrace the unique challenges it presents. The soft greens can work to your advantage, allowing you to attack the pin with more confidence. Take a moment to appreciate the beauty of the course in the rain—the glistening droplets on the grass and the misty atmosphere can create a serene and memorable golfing experience.

## Stay Safe and Have Fun

Remember to prioritize safety when playing golf in the rain. If you hear thunder or see lightning, seek shelter immediately. Don''t take unnecessary risks by standing under trees or near metal objects. Most importantly, maintain a positive attitude and enjoy the opportunity to test your skills in a different setting. Embrace the camaraderie of your fellow golfers who brave the elements alongside you.

## Conclusion

Playing golf in the rain may present some challenges, but with the right preparation and mindset, it can be an enjoyable and rewarding experience. By dressing appropriately, adjusting your strategy, and embracing the elements, you''ll be well on your way to mastering your wet weather rounds. So, the next time the forecast calls for rain, don''t let it stop you from hitting the links and making the most of your time on the course.', 'markdown', '{"llm": {"tier": "external", "model": "claude-3-opus-20240229", "usage": {"cost": 0.002169, "inputTokens": 911, "totalTokens": 1540, "outputTokens": 629}, "status": "completed", "timing": {"endTime": 1763936584113, "duration": 20365, "startTime": 1763936563748}, "provider": "anthropic", "requestId": "anthropic-1763936563748-1jdukyj5q", "timestamp": "2025-11-23T22:23:04.113Z", "providerSpecific": {"usage": {"input_tokens": 911, "output_tokens": 629}, "stop_reason": "end_turn", "input_tokens": 911, "model_version": "claude-3-opus-20240229", "output_tokens": 629}}, "planSource": "none", "ioSchemaApplied": true, "conversationMessageCount": 1, "deliverableStructureApplied": false}', '2025-11-23 22:23:04.129954+00', true, 'ai_response', '6b736942-b006-47c6-bdbd-a8ba7e065690', '{}');


ALTER TABLE public.deliverable_versions ENABLE TRIGGER ALL;

--
-- Data for Name: human_approvals; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.human_approvals DISABLE TRIGGER ALL;



ALTER TABLE public.human_approvals ENABLE TRIGGER ALL;

--
-- Data for Name: llm_providers; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.llm_providers DISABLE TRIGGER ALL;

INSERT INTO public.llm_providers (name, display_name, api_base_url, configuration_json, is_active, created_at, updated_at) VALUES ('openai', 'OpenAI', 'https://api.openai.com/v1', '{}', true, '2025-11-23 21:24:09.785462+00', '2025-11-23 21:24:09.785462+00');
INSERT INTO public.llm_providers (name, display_name, api_base_url, configuration_json, is_active, created_at, updated_at) VALUES ('google', 'Google', 'https://generativelanguage.googleapis.com/v1beta', '{}', true, '2025-11-23 21:24:09.785462+00', '2025-11-23 21:24:09.785462+00');
INSERT INTO public.llm_providers (name, display_name, api_base_url, configuration_json, is_active, created_at, updated_at) VALUES ('anthropic', 'Anthropic', 'https://api.anthropic.com/v1', '{}', true, '2025-11-23 21:24:09.785462+00', '2025-11-23 21:24:09.785462+00');
INSERT INTO public.llm_providers (name, display_name, api_base_url, configuration_json, is_active, created_at, updated_at) VALUES ('grok', 'xAI Grok', 'https://api.x.ai/v1', '{}', true, '2025-11-23 21:24:09.785462+00', '2025-11-23 21:24:09.785462+00');
INSERT INTO public.llm_providers (name, display_name, api_base_url, configuration_json, is_active, created_at, updated_at) VALUES ('ollama', 'Ollama (Local)', 'http://localhost:11434', '{}', true, '2025-11-23 21:24:09.785462+00', '2025-11-23 21:24:09.785462+00');


ALTER TABLE public.llm_providers ENABLE TRIGGER ALL;

--
-- Data for Name: llm_models; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.llm_models DISABLE TRIGGER ALL;

INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gpt-4.1', 'openai', 'GPT-4.1', 'text-generation', NULL, 1000000, 32768, '{}', '{}', '["chat", "code", "analysis", "vision"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.215705+00', '2025-11-23 21:26:34.215705+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gpt-4.1-mini', 'openai', 'GPT-4.1 Mini', 'text-generation', NULL, 1000000, 32768, '{}', '{}', '["chat", "code", "analysis"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.215705+00', '2025-11-23 21:26:34.215705+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gpt-4.1-nano', 'openai', 'GPT-4.1 Nano', 'text-generation', NULL, 1000000, 32768, '{}', '{}', '["chat", "code"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.215705+00', '2025-11-23 21:26:34.215705+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gpt-4o', 'openai', 'GPT-4o', 'text-generation', NULL, 128000, 16384, '{}', '{}', '["chat", "code", "analysis", "vision"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.215705+00', '2025-11-23 21:26:34.215705+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gpt-4o-mini', 'openai', 'GPT-4o Mini', 'text-generation', NULL, 128000, 16384, '{}', '{}', '["chat", "code", "analysis"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.215705+00', '2025-11-23 21:26:34.215705+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('o3', 'openai', 'o3', 'text-generation', NULL, 200000, 100000, '{}', '{}', '["chat", "reasoning", "code", "analysis"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.215705+00', '2025-11-23 21:26:34.215705+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('o3-pro', 'openai', 'o3 Pro', 'text-generation', NULL, 200000, 100000, '{}', '{}', '["chat", "reasoning", "code", "analysis"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.215705+00', '2025-11-23 21:26:34.215705+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('o4-mini', 'openai', 'o4 Mini', 'text-generation', NULL, 200000, 100000, '{}', '{}', '["chat", "reasoning", "code", "math"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.215705+00', '2025-11-23 21:26:34.215705+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('o1', 'openai', 'o1', 'text-generation', NULL, 200000, 100000, '{}', '{}', '["chat", "reasoning", "code"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.215705+00', '2025-11-23 21:26:34.215705+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('o1-mini', 'openai', 'o1 Mini', 'text-generation', NULL, 128000, 65536, '{}', '{}', '["chat", "reasoning", "code"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.215705+00', '2025-11-23 21:26:34.215705+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('text-embedding-3-large', 'openai', 'Text Embedding 3 Large', 'embedding', NULL, 8191, 0, '{}', '{}', '["embedding"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.215705+00', '2025-11-23 21:26:34.215705+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('text-embedding-3-small', 'openai', 'Text Embedding 3 Small', 'embedding', NULL, 8191, 0, '{}', '{}', '["embedding"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.215705+00', '2025-11-23 21:26:34.215705+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gemini-3.0-pro', 'google', 'Gemini 3.0 Pro', 'text-generation', NULL, 2000000, 8192, '{}', '{}', '["chat", "code", "analysis", "vision"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.216825+00', '2025-11-23 21:26:34.216825+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gemini-3.0-deep-think', 'google', 'Gemini 3.0 Deep Think', 'text-generation', NULL, 2000000, 8192, '{}', '{}', '["chat", "reasoning", "code", "analysis"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.216825+00', '2025-11-23 21:26:34.216825+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gemini-2.5-pro', 'google', 'Gemini 2.5 Pro', 'text-generation', NULL, 2000000, 8192, '{}', '{}', '["chat", "code", "analysis", "vision"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.216825+00', '2025-11-23 21:26:34.216825+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gemini-2.5-flash', 'google', 'Gemini 2.5 Flash', 'text-generation', NULL, 1000000, 8192, '{}', '{}', '["chat", "code", "analysis", "vision"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.216825+00', '2025-11-23 21:26:34.216825+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gemini-2.5-flash-lite', 'google', 'Gemini 2.5 Flash Lite', 'text-generation', NULL, 1000000, 8192, '{}', '{}', '["chat", "code"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.216825+00', '2025-11-23 21:26:34.216825+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gemini-2.0-flash', 'google', 'Gemini 2.0 Flash', 'text-generation', NULL, 1000000, 8192, '{}', '{}', '["chat", "code", "analysis", "vision"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.216825+00', '2025-11-23 21:26:34.216825+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gemini-2.0-pro', 'google', 'Gemini 2.0 Pro', 'text-generation', NULL, 2000000, 8192, '{}', '{}', '["chat", "code", "analysis", "vision"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.216825+00', '2025-11-23 21:26:34.216825+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gemini-1.5-pro', 'google', 'Gemini 1.5 Pro', 'text-generation', NULL, 2000000, 8192, '{}', '{}', '["chat", "code", "analysis", "vision"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.216825+00', '2025-11-23 21:26:34.216825+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gemini-1.5-flash', 'google', 'Gemini 1.5 Flash', 'text-generation', NULL, 1000000, 8192, '{}', '{}', '["chat", "code", "analysis", "vision"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.216825+00', '2025-11-23 21:26:34.216825+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('claude-sonnet-4-5-20250929', 'anthropic', 'Claude Sonnet 4.5', 'text-generation', NULL, 200000, 8192, '{}', '{}', '["chat", "code", "analysis", "vision", "computer-use"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.217245+00', '2025-11-23 21:26:34.217245+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('claude-haiku-4-5-20251015', 'anthropic', 'Claude Haiku 4.5', 'text-generation', NULL, 200000, 8192, '{}', '{}', '["chat", "code", "analysis", "computer-use"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.217245+00', '2025-11-23 21:26:34.217245+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('claude-opus-4-1-20250805', 'anthropic', 'Claude Opus 4.1', 'text-generation', NULL, 200000, 8192, '{}', '{}', '["chat", "code", "analysis", "vision", "agents"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.217245+00', '2025-11-23 21:26:34.217245+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('claude-opus-4-20250514', 'anthropic', 'Claude Opus 4', 'text-generation', NULL, 200000, 8192, '{}', '{}', '["chat", "code", "analysis", "vision", "agents"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.217245+00', '2025-11-23 21:26:34.217245+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('claude-sonnet-4-20250514', 'anthropic', 'Claude Sonnet 4', 'text-generation', NULL, 200000, 8192, '{}', '{}', '["chat", "code", "analysis", "vision"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.217245+00', '2025-11-23 21:26:34.217245+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('claude-3-5-sonnet-20241022', 'anthropic', 'Claude 3.5 Sonnet', 'text-generation', NULL, 200000, 8192, '{}', '{}', '["chat", "code", "analysis", "vision"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.217245+00', '2025-11-23 21:26:34.217245+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('claude-3-5-haiku-20241022', 'anthropic', 'Claude 3.5 Haiku', 'text-generation', NULL, 200000, 8192, '{}', '{}', '["chat", "code", "analysis"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.217245+00', '2025-11-23 21:26:34.217245+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('claude-3-opus-20240229', 'anthropic', 'Claude 3 Opus', 'text-generation', NULL, 200000, 4096, '{}', '{}', '["chat", "code", "analysis", "vision"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.217245+00', '2025-11-23 21:26:34.217245+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('grok-4.1', 'grok', 'Grok 4.1', 'text-generation', NULL, 2000000, 16384, '{}', '{}', '["chat", "code", "analysis", "reasoning"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.217639+00', '2025-11-23 21:26:34.217639+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('grok-4', 'grok', 'Grok 4', 'text-generation', NULL, 1000000, 16384, '{}', '{}', '["chat", "code", "analysis", "reasoning"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.217639+00', '2025-11-23 21:26:34.217639+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('grok-4-heavy', 'grok', 'Grok 4 Heavy', 'text-generation', NULL, 1000000, 16384, '{}', '{}', '["chat", "code", "analysis", "reasoning"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.217639+00', '2025-11-23 21:26:34.217639+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('grok-4-fast', 'grok', 'Grok 4 Fast', 'text-generation', NULL, 2000000, 16384, '{}', '{}', '["chat", "code", "analysis"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.217639+00', '2025-11-23 21:26:34.217639+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('grok-3', 'grok', 'Grok 3', 'text-generation', NULL, 1000000, 8192, '{}', '{}', '["chat", "code", "analysis"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.217639+00', '2025-11-23 21:26:34.217639+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('grok-3-reasoning', 'grok', 'Grok 3 Reasoning', 'text-generation', NULL, 1000000, 8192, '{}', '{}', '["chat", "reasoning", "code"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.217639+00', '2025-11-23 21:26:34.217639+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('grok-2', 'grok', 'Grok 2', 'text-generation', NULL, 131072, 8192, '{}', '{}', '["chat", "code", "analysis"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.217639+00', '2025-11-23 21:26:34.217639+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('llama3.2:3b', 'ollama', 'Llama 3.2 3B', 'text-generation', NULL, 8192, 4096, '{}', '{}', '["chat", "code"]', NULL, 'very-fast', 5, true, true, true, NULL, '2025-11-23 21:26:34.218006+00', '2025-11-23 22:19:58.021541+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('nomic-embed-text:latest', 'ollama', 'Nomic Embed Text', 'embedding', NULL, 8192, 0, '{}', '{}', '["embedding"]', NULL, 'medium', 5, true, true, true, NULL, '2025-11-23 21:26:34.218006+00', '2025-11-23 22:16:17.440451+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('llama3.2:latest', 'ollama', 'Llama 3.2', 'text-generation', NULL, 8192, 4096, '{}', '{}', '["chat", "code"]', NULL, 'medium', 5, true, true, true, NULL, '2025-11-23 21:26:34.218006+00', '2025-11-23 22:16:17.440451+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('qwq:latest', 'ollama', 'QwQ', 'text-generation', NULL, 32768, 8192, '{}', '{}', '["chat", "reasoning"]', NULL, 'medium', 5, true, true, true, NULL, '2025-11-23 21:26:34.218006+00', '2025-11-23 22:16:17.440451+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('deepseek-r1:latest', 'ollama', 'DeepSeek R1', 'text-generation', NULL, 64000, 8192, '{}', '{}', '["chat", "reasoning", "code"]', NULL, 'medium', 5, true, true, true, NULL, '2025-11-23 21:26:34.218006+00', '2025-11-23 22:16:17.440451+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gpt-oss:20b', 'ollama', 'GPT-OSS 20B', 'text-generation', NULL, 8192, 4096, '{}', '{}', '["chat", "code"]', NULL, 'medium', 5, true, true, true, NULL, '2025-11-23 21:26:34.218006+00', '2025-11-23 22:16:17.440451+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('qwen3:8b', 'ollama', 'Qwen 3 8B', 'text-generation', NULL, 32768, 8192, '{}', '{}', '["chat", "code"]', NULL, 'fast', 5, true, true, true, NULL, '2025-11-23 21:26:34.218006+00', '2025-11-23 22:16:17.440451+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('llama3.2:1b', 'ollama', 'Llama 3.2 1B', 'text-generation', NULL, 8192, 4096, '{}', '{}', '["chat"]', NULL, 'very-fast', 5, true, true, true, NULL, '2025-11-23 21:26:34.218006+00', '2025-11-23 22:19:58.021541+00');


ALTER TABLE public.llm_models ENABLE TRIGGER ALL;

--
-- Data for Name: llm_usage; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.llm_usage DISABLE TRIGGER ALL;

INSERT INTO public.llm_usage (id, run_id, user_id, conversation_id, provider_name, model_name, route, input_tokens, output_tokens, input_cost, output_cost, total_cost, duration_ms, status, caller_type, agent_name, is_local, model_tier, fallback_used, routing_reason, complexity_level, complexity_score, data_classification, started_at, completed_at, error_message, data_sanitization_applied, sanitization_level, pii_detected, pii_types, pseudonyms_used, pseudonym_types, pseudonym_mappings, redactions_applied, redaction_types, source_blinding_applied, headers_stripped, custom_user_agent_used, proxy_used, no_train_header_sent, no_retain_header_sent, sanitization_time_ms, reversal_context_size, policy_profile, sovereign_mode, compliance_flags, created_at) VALUES ('b61a3bb0-f9fb-4a3a-8b02-731d6e56e444', 'anthropic-1763936563748-1jdukyj5q', '618f3960-a8be-4c67-855f-aae4130699b8', 'd4de0d8d-e56f-4ed0-bb42-cca569793905', 'anthropic', 'claude-3-opus-20240229', 'remote', 911, 629, NULL, NULL, 0.002169, 20365, 'completed', 'agent', 'blog-post-writer-build-create', false, 'external', false, NULL, NULL, NULL, NULL, '2025-11-23 22:22:43.748+00', '2025-11-23 22:23:04.113+00', NULL, false, 'pseudonymized', false, '{}', 0, '[]', '[]', 0, '[]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-23 22:23:04.117078+00');


ALTER TABLE public.llm_usage ENABLE TRIGGER ALL;

--
-- Data for Name: observability_events; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.observability_events DISABLE TRIGGER ALL;



ALTER TABLE public.observability_events ENABLE TRIGGER ALL;

--
-- Data for Name: organization_credentials; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.organization_credentials DISABLE TRIGGER ALL;



ALTER TABLE public.organization_credentials ENABLE TRIGGER ALL;

--
-- Data for Name: plans; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.plans DISABLE TRIGGER ALL;



ALTER TABLE public.plans ENABLE TRIGGER ALL;

--
-- Data for Name: plan_deliverables; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.plan_deliverables DISABLE TRIGGER ALL;



ALTER TABLE public.plan_deliverables ENABLE TRIGGER ALL;

--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.tasks DISABLE TRIGGER ALL;

INSERT INTO public.tasks (id, user_id, conversation_id, method, params, prompt, response, status, progress, error_code, error_message, error_data, started_at, completed_at, timeout_seconds, deliverable_type, metadata, llm_metadata, response_metadata, evaluation, created_at, updated_at) VALUES ('6b736942-b006-47c6-bdbd-a8ba7e065690', '618f3960-a8be-4c67-855f-aae4130699b8', 'd4de0d8d-e56f-4ed0-bb42-cca569793905', 'build', '{"method": "build", "prompt": "can you write a blog post about playing golf in the rain?", "metadata": {"jsonrpc": {"id": "6b736942-b006-47c6-bdbd-a8ba7e065690", "method": "build"}, "protocol": "a2a-google", "llmSelection": {"model": "claude-3-opus-20240229", "provider": "anthropic"}, "conversationHistory": [{"role": "user", "content": "can you write a blog post about playing golf in the rain?", "timestamp": "2025-11-23T22:22:34.628Z"}]}, "conversationId": "d4de0d8d-e56f-4ed0-bb42-cca569793905"}', 'can you write a blog post about playing golf in the rain?', '{"success":true,"mode":"build","payload":{"content":{"deliverable":{"id":"09d89c38-54ed-4966-82f7-cd1ac8db3831","userId":"618f3960-a8be-4c67-855f-aae4130699b8","conversationId":"d4de0d8d-e56f-4ed0-bb42-cca569793905","agentName":"Blog Post Writer","title":"Blog Post Writer Deliverable","type":"document","createdAt":"2025-11-23T22:23:04.125Z","updatedAt":"2025-11-23T22:23:04.125Z","currentVersion":{"id":"88a0ac80-1a81-4db6-b4ad-fac262289a98","deliverableId":"09d89c38-54ed-4966-82f7-cd1ac8db3831","versionNumber":1,"content":"# Playing Golf in the Rain: Tips and Tricks for Wet Weather Rounds\n\n## Introduction\n\nAs a passionate golfer, you know that the game waits for no one—not even Mother Nature. While playing golf in the rain may seem daunting, it can be a unique and rewarding experience when you''re properly prepared. In this post, we''ll explore some essential tips and tricks for mastering your wet weather rounds and making the most of your time on the course, rain or shine.\n\n## Dress for Success\n\nThe key to enjoying your rainy round is wearing the right gear. Invest in a quality, waterproof golf jacket and pants to keep you dry and comfortable throughout your game. Look for breathable, lightweight materials that won''t restrict your swing. Don''t forget to pack a pair of rain gloves to maintain your grip on the club, even when your hands are wet.\n\n## Prepare Your Equipment\n\nBefore heading out, make sure your golf bag is equipped with rain gear essentials. Pack an extra towel or two to dry your clubs and balls between shots. Consider using a golf umbrella to shield yourself and your clubs from the elements. If you have one, bring along a golf bag rain cover to protect your clubs and keep them dry.\n\n## Adjust Your Strategy\n\nPlaying golf in the rain requires a different approach than playing in dry conditions. The wet turf will affect your ball''s roll and distance, so take this into account when selecting your clubs. Opt for more club than you would normally use to compensate for the lack of roll. Focus on hitting the ball solidly rather than trying to generate extra power, as a well-struck shot will be more effective in wet conditions.\n\n## Embrace the Elements\n\nInstead of letting the rain dampen your spirits, embrace the unique challenges it presents. The soft greens can work to your advantage, allowing you to attack the pin with more confidence. Take a moment to appreciate the beauty of the course in the rain—the glistening droplets on the grass and the misty atmosphere can create a serene and memorable golfing experience.\n\n## Stay Safe and Have Fun\n\nRemember to prioritize safety when playing golf in the rain. If you hear thunder or see lightning, seek shelter immediately. Don''t take unnecessary risks by standing under trees or near metal objects. Most importantly, maintain a positive attitude and enjoy the opportunity to test your skills in a different setting. Embrace the camaraderie of your fellow golfers who brave the elements alongside you.\n\n## Conclusion\n\nPlaying golf in the rain may present some challenges, but with the right preparation and mindset, it can be an enjoyable and rewarding experience. By dressing appropriately, adjusting your strategy, and embracing the elements, you''ll be well on your way to mastering your wet weather rounds. So, the next time the forecast calls for rain, don''t let it stop you from hitting the links and making the most of your time on the course.","format":"markdown","isCurrentVersion":true,"createdByType":"ai_response","taskId":"6b736942-b006-47c6-bdbd-a8ba7e065690","metadata":{"llm":{"tier":"external","model":"claude-3-opus-20240229","usage":{"cost":0.002169,"inputTokens":911,"totalTokens":1540,"outputTokens":629},"status":"completed","timing":{"endTime":1763936584113,"duration":20365,"startTime":1763936563748},"provider":"anthropic","requestId":"anthropic-1763936563748-1jdukyj5q","timestamp":"2025-11-23T22:23:04.113Z","providerSpecific":{"usage":{"input_tokens":911,"output_tokens":629},"stop_reason":"end_turn","input_tokens":911,"model_version":"claude-3-opus-20240229","output_tokens":629}},"planSource":"none","ioSchemaApplied":true,"conversationMessageCount":1,"deliverableStructureApplied":false},"fileAttachments":{},"createdAt":"2025-11-23T22:23:04.129Z","updatedAt":null}},"version":{"id":"88a0ac80-1a81-4db6-b4ad-fac262289a98","deliverableId":"09d89c38-54ed-4966-82f7-cd1ac8db3831","versionNumber":1,"content":"# Playing Golf in the Rain: Tips and Tricks for Wet Weather Rounds\n\n## Introduction\n\nAs a passionate golfer, you know that the game waits for no one—not even Mother Nature. While playing golf in the rain may seem daunting, it can be a unique and rewarding experience when you''re properly prepared. In this post, we''ll explore some essential tips and tricks for mastering your wet weather rounds and making the most of your time on the course, rain or shine.\n\n## Dress for Success\n\nThe key to enjoying your rainy round is wearing the right gear. Invest in a quality, waterproof golf jacket and pants to keep you dry and comfortable throughout your game. Look for breathable, lightweight materials that won''t restrict your swing. Don''t forget to pack a pair of rain gloves to maintain your grip on the club, even when your hands are wet.\n\n## Prepare Your Equipment\n\nBefore heading out, make sure your golf bag is equipped with rain gear essentials. Pack an extra towel or two to dry your clubs and balls between shots. Consider using a golf umbrella to shield yourself and your clubs from the elements. If you have one, bring along a golf bag rain cover to protect your clubs and keep them dry.\n\n## Adjust Your Strategy\n\nPlaying golf in the rain requires a different approach than playing in dry conditions. The wet turf will affect your ball''s roll and distance, so take this into account when selecting your clubs. Opt for more club than you would normally use to compensate for the lack of roll. Focus on hitting the ball solidly rather than trying to generate extra power, as a well-struck shot will be more effective in wet conditions.\n\n## Embrace the Elements\n\nInstead of letting the rain dampen your spirits, embrace the unique challenges it presents. The soft greens can work to your advantage, allowing you to attack the pin with more confidence. Take a moment to appreciate the beauty of the course in the rain—the glistening droplets on the grass and the misty atmosphere can create a serene and memorable golfing experience.\n\n## Stay Safe and Have Fun\n\nRemember to prioritize safety when playing golf in the rain. If you hear thunder or see lightning, seek shelter immediately. Don''t take unnecessary risks by standing under trees or near metal objects. Most importantly, maintain a positive attitude and enjoy the opportunity to test your skills in a different setting. Embrace the camaraderie of your fellow golfers who brave the elements alongside you.\n\n## Conclusion\n\nPlaying golf in the rain may present some challenges, but with the right preparation and mindset, it can be an enjoyable and rewarding experience. By dressing appropriately, adjusting your strategy, and embracing the elements, you''ll be well on your way to mastering your wet weather rounds. So, the next time the forecast calls for rain, don''t let it stop you from hitting the links and making the most of your time on the course.","format":"markdown","isCurrentVersion":true,"createdByType":"ai_response","taskId":"6b736942-b006-47c6-bdbd-a8ba7e065690","metadata":{"llm":{"tier":"external","model":"claude-3-opus-20240229","usage":{"cost":0.002169,"inputTokens":911,"totalTokens":1540,"outputTokens":629},"status":"completed","timing":{"endTime":1763936584113,"duration":20365,"startTime":1763936563748},"provider":"anthropic","requestId":"anthropic-1763936563748-1jdukyj5q","timestamp":"2025-11-23T22:23:04.113Z","providerSpecific":{"usage":{"input_tokens":911,"output_tokens":629},"stop_reason":"end_turn","input_tokens":911,"model_version":"claude-3-opus-20240229","output_tokens":629}},"planSource":"none","ioSchemaApplied":true,"conversationMessageCount":1,"deliverableStructureApplied":false},"fileAttachments":{},"createdAt":"2025-11-23T22:23:04.129Z","updatedAt":null},"isNew":true},"metadata":{"provider":"anthropic","model":"claude-3-opus-20240229","usage":{"inputTokens":911,"outputTokens":629,"totalTokens":1540,"cost":0.002169},"resolvedOrgSlug":"demo-org","planSource":"none","conversationMessageCount":1,"deliverableStructureApplied":false,"ioSchemaApplied":true,"streamEndpoint":"/agent-to-agent/demo-org/blog-post-writer/tasks/6b736942-b006-47c6-bdbd-a8ba7e065690/stream","streamTokenEndpoint":"/agent-to-agent/demo-org/blog-post-writer/tasks/6b736942-b006-47c6-bdbd-a8ba7e065690/stream-token","streaming":{"streamEndpoint":"/agent-to-agent/demo-org/blog-post-writer/tasks/6b736942-b006-47c6-bdbd-a8ba7e065690/stream","streamTokenEndpoint":"/agent-to-agent/demo-org/blog-post-writer/tasks/6b736942-b006-47c6-bdbd-a8ba7e065690/stream-token","streamUrl":"http://localhost:6100/agent-to-agent/demo-org/blog-post-writer/tasks/6b736942-b006-47c6-bdbd-a8ba7e065690/stream","streamTokenUrl":"http://localhost:6100/agent-to-agent/demo-org/blog-post-writer/tasks/6b736942-b006-47c6-bdbd-a8ba7e065690/stream-token","conversationId":"d4de0d8d-e56f-4ed0-bb42-cca569793905"}}}}', 'completed', 0, NULL, NULL, NULL, '2025-11-23 22:22:34.633+00', '2025-11-23 22:23:04.141+00', 300, 'document', '{"jsonrpc": {"id": "6b736942-b006-47c6-bdbd-a8ba7e065690", "method": "build"}, "agentName": "blog-post-writer", "createdAt": "2025-11-23T22:22:34.630Z", "organizationSlug": "demo-org"}', '{"createdAt": "2025-11-23T22:22:34.630Z", "originalLLMSelection": {"model": "claude-3-opus-20240229", "provider": "anthropic"}}', '{"model": "claude-3-opus-20240229", "usage": {"cost": 0.002169, "inputTokens": 911, "totalTokens": 1540, "outputTokens": 629}, "provider": "anthropic", "streaming": {"streamUrl": "http://localhost:6100/agent-to-agent/demo-org/blog-post-writer/tasks/6b736942-b006-47c6-bdbd-a8ba7e065690/stream", "conversationId": "d4de0d8d-e56f-4ed0-bb42-cca569793905", "streamEndpoint": "/agent-to-agent/demo-org/blog-post-writer/tasks/6b736942-b006-47c6-bdbd-a8ba7e065690/stream", "streamTokenUrl": "http://localhost:6100/agent-to-agent/demo-org/blog-post-writer/tasks/6b736942-b006-47c6-bdbd-a8ba7e065690/stream-token", "streamTokenEndpoint": "/agent-to-agent/demo-org/blog-post-writer/tasks/6b736942-b006-47c6-bdbd-a8ba7e065690/stream-token"}, "planSource": "none", "streamEndpoint": "/agent-to-agent/demo-org/blog-post-writer/tasks/6b736942-b006-47c6-bdbd-a8ba7e065690/stream", "ioSchemaApplied": true, "resolvedOrgSlug": "demo-org", "streamTokenEndpoint": "/agent-to-agent/demo-org/blog-post-writer/tasks/6b736942-b006-47c6-bdbd-a8ba7e065690/stream-token", "conversationMessageCount": 1, "deliverableStructureApplied": false}', NULL, '2025-11-23 22:22:34.630349+00', '2025-11-23 22:23:04.141+00');


ALTER TABLE public.tasks ENABLE TRIGGER ALL;

--
-- Data for Name: plan_versions; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.plan_versions DISABLE TRIGGER ALL;



ALTER TABLE public.plan_versions ENABLE TRIGGER ALL;

--
-- Data for Name: pseudonym_dictionaries; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.pseudonym_dictionaries DISABLE TRIGGER ALL;



ALTER TABLE public.pseudonym_dictionaries ENABLE TRIGGER ALL;

--
-- Data for Name: rbac_roles; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.rbac_roles DISABLE TRIGGER ALL;

INSERT INTO public.rbac_roles (id, name, display_name, description, is_system, created_at, updated_at) VALUES ('c4f9a1ab-18bf-4622-a793-ff69ac071519', 'super-admin', 'Super Administrator', 'Full access to all organizations and resources', true, '2025-11-23 21:03:21.300579+00', '2025-11-23 21:03:21.300579+00');
INSERT INTO public.rbac_roles (id, name, display_name, description, is_system, created_at, updated_at) VALUES ('bd9b27af-c78c-4490-b69e-01624488b420', 'admin', 'Administrator', 'Full access within assigned organization', true, '2025-11-23 21:03:21.300579+00', '2025-11-23 21:03:21.300579+00');
INSERT INTO public.rbac_roles (id, name, display_name, description, is_system, created_at, updated_at) VALUES ('aebbc0e1-6ba1-4c30-a606-3fa5979d9fb4', 'manager', 'Manager', 'Can manage users and resources within organization', true, '2025-11-23 21:03:21.300579+00', '2025-11-23 21:03:21.300579+00');
INSERT INTO public.rbac_roles (id, name, display_name, description, is_system, created_at, updated_at) VALUES ('8854d99f-9c5b-4805-afe2-0ee6ca8261e2', 'member', 'Member', 'Standard access within organization', true, '2025-11-23 21:03:21.300579+00', '2025-11-23 21:03:21.300579+00');
INSERT INTO public.rbac_roles (id, name, display_name, description, is_system, created_at, updated_at) VALUES ('733bbaf9-124f-4779-b629-f00c69ef35cb', 'viewer', 'Viewer', 'Read-only access within organization', true, '2025-11-23 21:03:21.300579+00', '2025-11-23 21:03:21.300579+00');


ALTER TABLE public.rbac_roles ENABLE TRIGGER ALL;

--
-- Data for Name: rbac_audit_log; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.rbac_audit_log DISABLE TRIGGER ALL;



ALTER TABLE public.rbac_audit_log ENABLE TRIGGER ALL;

--
-- Data for Name: rbac_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.rbac_permissions DISABLE TRIGGER ALL;

INSERT INTO public.rbac_permissions (id, name, display_name, description, category, created_at) VALUES ('ea946e3a-3184-4b90-8b23-91d50a871206', '*:*', 'Full Access', 'Complete access to everything', 'system', '2025-11-23 21:03:21.301022+00');
INSERT INTO public.rbac_permissions (id, name, display_name, description, category, created_at) VALUES ('d4c4e1ac-b224-4257-9853-82ad6513367e', 'rag:read', 'Read RAG', 'Query RAG collections and view documents', 'rag', '2025-11-23 21:03:21.301022+00');
INSERT INTO public.rbac_permissions (id, name, display_name, description, category, created_at) VALUES ('ff60135f-a1f0-43d4-ac49-99154c0603d3', 'rag:write', 'Write RAG', 'Upload documents and manage collections', 'rag', '2025-11-23 21:03:21.301022+00');
INSERT INTO public.rbac_permissions (id, name, display_name, description, category, created_at) VALUES ('112f60a3-6fbd-44e3-bb5a-0d6f9d959b97', 'rag:delete', 'Delete RAG', 'Delete documents and collections', 'rag', '2025-11-23 21:03:21.301022+00');
INSERT INTO public.rbac_permissions (id, name, display_name, description, category, created_at) VALUES ('4e229741-1d06-45b7-96c7-1e431cf48e67', 'rag:admin', 'Administer RAG', 'Full RAG administration', 'rag', '2025-11-23 21:03:21.301022+00');
INSERT INTO public.rbac_permissions (id, name, display_name, description, category, created_at) VALUES ('c4b4a28a-f859-488a-970e-fdc757892f22', 'agents:execute', 'Execute Agents', 'Run agent conversations', 'agents', '2025-11-23 21:03:21.301022+00');
INSERT INTO public.rbac_permissions (id, name, display_name, description, category, created_at) VALUES ('f2dfb4bf-216f-41cd-83c8-0b4ac8c3cff1', 'agents:manage', 'Manage Agents', 'Create and configure agents', 'agents', '2025-11-23 21:03:21.301022+00');
INSERT INTO public.rbac_permissions (id, name, display_name, description, category, created_at) VALUES ('0d4d16ab-061c-4088-9db6-b20029639cd8', 'agents:admin', 'Administer Agents', 'Full agent administration', 'agents', '2025-11-23 21:03:21.301022+00');
INSERT INTO public.rbac_permissions (id, name, display_name, description, category, created_at) VALUES ('b66db4cd-ce3d-41fd-a98b-181cc319a415', 'admin:users', 'Manage Users', 'Invite and manage organization users', 'admin', '2025-11-23 21:03:21.301022+00');
INSERT INTO public.rbac_permissions (id, name, display_name, description, category, created_at) VALUES ('8729aa8f-c62e-470c-a136-2a49cb16fc51', 'admin:roles', 'Manage Roles', 'Assign roles to users', 'admin', '2025-11-23 21:03:21.301022+00');
INSERT INTO public.rbac_permissions (id, name, display_name, description, category, created_at) VALUES ('1c9a0a11-e3b5-4933-be13-97629eaa0c7d', 'admin:settings', 'Manage Settings', 'Configure organization settings', 'admin', '2025-11-23 21:03:21.301022+00');
INSERT INTO public.rbac_permissions (id, name, display_name, description, category, created_at) VALUES ('d349d570-4695-4df7-bd55-4afea43bd853', 'admin:billing', 'Manage Billing', 'View and manage billing', 'admin', '2025-11-23 21:03:21.301022+00');
INSERT INTO public.rbac_permissions (id, name, display_name, description, category, created_at) VALUES ('3df49429-d033-4dd1-ae24-7dbeca883232', 'admin:audit', 'View Audit Logs', 'Access audit and usage logs', 'admin', '2025-11-23 21:03:21.301022+00');
INSERT INTO public.rbac_permissions (id, name, display_name, description, category, created_at) VALUES ('ac19f208-fb8e-4fcf-9c81-ad9b84412167', 'llm:use', 'Use LLM', 'Make LLM API calls', 'llm', '2025-11-23 21:03:21.301022+00');
INSERT INTO public.rbac_permissions (id, name, display_name, description, category, created_at) VALUES ('042204d5-8900-49f1-b15b-c19bf415986c', 'llm:admin', 'Administer LLM', 'Configure models and usage limits', 'llm', '2025-11-23 21:03:21.301022+00');
INSERT INTO public.rbac_permissions (id, name, display_name, description, category, created_at) VALUES ('e6b755b8-9ae6-42e6-9be4-7dc4a01e24d5', 'deliverables:read', 'Read Deliverables', 'View deliverables', 'deliverables', '2025-11-23 21:03:21.301022+00');
INSERT INTO public.rbac_permissions (id, name, display_name, description, category, created_at) VALUES ('0632295d-29d9-4793-b4e5-af81ac73a0a0', 'deliverables:write', 'Write Deliverables', 'Create and edit deliverables', 'deliverables', '2025-11-23 21:03:21.301022+00');
INSERT INTO public.rbac_permissions (id, name, display_name, description, category, created_at) VALUES ('64302704-84c4-4314-a287-c07bf5e4562e', 'deliverables:delete', 'Delete Deliverables', 'Delete deliverables', 'deliverables', '2025-11-23 21:03:21.301022+00');


ALTER TABLE public.rbac_permissions ENABLE TRIGGER ALL;

--
-- Data for Name: rbac_role_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.rbac_role_permissions DISABLE TRIGGER ALL;

INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('fc54593f-a042-4348-9366-3f1a18e29987', 'c4f9a1ab-18bf-4622-a793-ff69ac071519', 'ea946e3a-3184-4b90-8b23-91d50a871206', NULL, NULL, '2025-11-23 21:03:21.301426+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('657b3040-624a-47cc-b42d-1b949794aa39', 'bd9b27af-c78c-4490-b69e-01624488b420', '4e229741-1d06-45b7-96c7-1e431cf48e67', NULL, NULL, '2025-11-23 21:03:21.301963+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('b468ca35-b3f7-41dc-b9e3-762cc22d50d8', 'bd9b27af-c78c-4490-b69e-01624488b420', '0d4d16ab-061c-4088-9db6-b20029639cd8', NULL, NULL, '2025-11-23 21:03:21.301963+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('245ede8a-c832-40ac-8b1d-4e465c5bf1be', 'bd9b27af-c78c-4490-b69e-01624488b420', 'b66db4cd-ce3d-41fd-a98b-181cc319a415', NULL, NULL, '2025-11-23 21:03:21.301963+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('9d1f502c-8923-4de6-a367-dbba0ad03bbc', 'bd9b27af-c78c-4490-b69e-01624488b420', '8729aa8f-c62e-470c-a136-2a49cb16fc51', NULL, NULL, '2025-11-23 21:03:21.301963+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('b4c1df5a-e7ad-42fd-9b44-086f8f490ced', 'bd9b27af-c78c-4490-b69e-01624488b420', '1c9a0a11-e3b5-4933-be13-97629eaa0c7d', NULL, NULL, '2025-11-23 21:03:21.301963+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('3655a574-3657-4540-a60a-3c3af24f8010', 'bd9b27af-c78c-4490-b69e-01624488b420', '3df49429-d033-4dd1-ae24-7dbeca883232', NULL, NULL, '2025-11-23 21:03:21.301963+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('20355f6f-0601-4c74-a9f8-11cfe136a0e7', 'bd9b27af-c78c-4490-b69e-01624488b420', '042204d5-8900-49f1-b15b-c19bf415986c', NULL, NULL, '2025-11-23 21:03:21.301963+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('236da8e9-9124-43f5-8245-2ecf7dbd91f9', 'bd9b27af-c78c-4490-b69e-01624488b420', 'e6b755b8-9ae6-42e6-9be4-7dc4a01e24d5', NULL, NULL, '2025-11-23 21:03:21.301963+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('09237953-a492-4a97-b176-c100bddd169c', 'bd9b27af-c78c-4490-b69e-01624488b420', '0632295d-29d9-4793-b4e5-af81ac73a0a0', NULL, NULL, '2025-11-23 21:03:21.301963+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('2635e4e0-c9ac-4e22-8ab7-84c80e9d2a17', 'bd9b27af-c78c-4490-b69e-01624488b420', '64302704-84c4-4314-a287-c07bf5e4562e', NULL, NULL, '2025-11-23 21:03:21.301963+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('437ac544-571e-426e-a89d-15bdf1b69d88', 'aebbc0e1-6ba1-4c30-a606-3fa5979d9fb4', 'd4c4e1ac-b224-4257-9853-82ad6513367e', NULL, NULL, '2025-11-23 21:03:21.302416+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('092335b6-0423-4380-aad8-4fbed48397b1', 'aebbc0e1-6ba1-4c30-a606-3fa5979d9fb4', 'ff60135f-a1f0-43d4-ac49-99154c0603d3', NULL, NULL, '2025-11-23 21:03:21.302416+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('e13a829b-9a43-4a15-af62-28151eca6f73', 'aebbc0e1-6ba1-4c30-a606-3fa5979d9fb4', 'c4b4a28a-f859-488a-970e-fdc757892f22', NULL, NULL, '2025-11-23 21:03:21.302416+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('a0bf6418-044e-4e59-b7d9-f2b4982da219', 'aebbc0e1-6ba1-4c30-a606-3fa5979d9fb4', 'f2dfb4bf-216f-41cd-83c8-0b4ac8c3cff1', NULL, NULL, '2025-11-23 21:03:21.302416+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('fb0bffcd-8214-4d92-9f59-2ce567f37bc6', 'aebbc0e1-6ba1-4c30-a606-3fa5979d9fb4', 'b66db4cd-ce3d-41fd-a98b-181cc319a415', NULL, NULL, '2025-11-23 21:03:21.302416+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('d19ff1a8-1af7-4042-8677-567604d2124a', 'aebbc0e1-6ba1-4c30-a606-3fa5979d9fb4', 'ac19f208-fb8e-4fcf-9c81-ad9b84412167', NULL, NULL, '2025-11-23 21:03:21.302416+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('988e646e-95d8-42ae-97b7-c6b1564974cd', 'aebbc0e1-6ba1-4c30-a606-3fa5979d9fb4', 'e6b755b8-9ae6-42e6-9be4-7dc4a01e24d5', NULL, NULL, '2025-11-23 21:03:21.302416+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('81330cc8-740c-4c60-b711-5e119edcc34a', 'aebbc0e1-6ba1-4c30-a606-3fa5979d9fb4', '0632295d-29d9-4793-b4e5-af81ac73a0a0', NULL, NULL, '2025-11-23 21:03:21.302416+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('459dd75f-6930-4e49-96cc-13475eb04ee2', '8854d99f-9c5b-4805-afe2-0ee6ca8261e2', 'd4c4e1ac-b224-4257-9853-82ad6513367e', NULL, NULL, '2025-11-23 21:03:21.302784+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('70c6439b-9913-42ec-aaad-0eb064eefad7', '8854d99f-9c5b-4805-afe2-0ee6ca8261e2', 'c4b4a28a-f859-488a-970e-fdc757892f22', NULL, NULL, '2025-11-23 21:03:21.302784+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('420c0dc1-6596-4d61-ac7e-e1d130088b57', '8854d99f-9c5b-4805-afe2-0ee6ca8261e2', 'ac19f208-fb8e-4fcf-9c81-ad9b84412167', NULL, NULL, '2025-11-23 21:03:21.302784+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('a4020f84-50e2-4c3d-a864-c0309e4db0bf', '8854d99f-9c5b-4805-afe2-0ee6ca8261e2', 'e6b755b8-9ae6-42e6-9be4-7dc4a01e24d5', NULL, NULL, '2025-11-23 21:03:21.302784+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('93ffa76c-5801-4aff-b120-3f764c683bb2', '8854d99f-9c5b-4805-afe2-0ee6ca8261e2', '0632295d-29d9-4793-b4e5-af81ac73a0a0', NULL, NULL, '2025-11-23 21:03:21.302784+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('0adf3bd9-b674-4fa6-a967-2dec083954b9', '733bbaf9-124f-4779-b629-f00c69ef35cb', 'd4c4e1ac-b224-4257-9853-82ad6513367e', NULL, NULL, '2025-11-23 21:03:21.303087+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('a47c1fbc-94a0-405c-a63b-2aa8a0b72ab0', '733bbaf9-124f-4779-b629-f00c69ef35cb', 'e6b755b8-9ae6-42e6-9be4-7dc4a01e24d5', NULL, NULL, '2025-11-23 21:03:21.303087+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('a809fa68-247a-4710-95d6-a0ee0e769e97', 'c4f9a1ab-18bf-4622-a793-ff69ac071519', 'ea946e3a-3184-4b90-8b23-91d50a871206', NULL, NULL, '2025-11-23 21:06:15.64796+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('a0bd7e69-a556-442e-8acc-f23bfa8d78d9', 'bd9b27af-c78c-4490-b69e-01624488b420', '4e229741-1d06-45b7-96c7-1e431cf48e67', NULL, NULL, '2025-11-23 21:06:15.648515+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('3f77a5f3-c0e2-4965-ba26-e5b2c5480788', 'bd9b27af-c78c-4490-b69e-01624488b420', '0d4d16ab-061c-4088-9db6-b20029639cd8', NULL, NULL, '2025-11-23 21:06:15.648515+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('d9381038-53dd-40ad-a99f-20737e34c58f', 'bd9b27af-c78c-4490-b69e-01624488b420', 'b66db4cd-ce3d-41fd-a98b-181cc319a415', NULL, NULL, '2025-11-23 21:06:15.648515+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('bf32fc16-8865-4d91-8eaf-df2ec6e49ae6', 'bd9b27af-c78c-4490-b69e-01624488b420', '8729aa8f-c62e-470c-a136-2a49cb16fc51', NULL, NULL, '2025-11-23 21:06:15.648515+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('f3689729-1987-4481-9d45-c1c6ac72175a', 'bd9b27af-c78c-4490-b69e-01624488b420', '1c9a0a11-e3b5-4933-be13-97629eaa0c7d', NULL, NULL, '2025-11-23 21:06:15.648515+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('7dcd646d-3952-4d16-bb09-c4dcba8c5f7a', 'bd9b27af-c78c-4490-b69e-01624488b420', '3df49429-d033-4dd1-ae24-7dbeca883232', NULL, NULL, '2025-11-23 21:06:15.648515+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('cc495739-c951-4c07-b5df-effb142e0902', 'bd9b27af-c78c-4490-b69e-01624488b420', '042204d5-8900-49f1-b15b-c19bf415986c', NULL, NULL, '2025-11-23 21:06:15.648515+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('24b0bbed-05b6-4fa6-b1a0-4c1c5028f241', 'bd9b27af-c78c-4490-b69e-01624488b420', 'e6b755b8-9ae6-42e6-9be4-7dc4a01e24d5', NULL, NULL, '2025-11-23 21:06:15.648515+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('dcff7ed4-5eae-48df-a8a3-53c01d41aa70', 'bd9b27af-c78c-4490-b69e-01624488b420', '0632295d-29d9-4793-b4e5-af81ac73a0a0', NULL, NULL, '2025-11-23 21:06:15.648515+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('11571101-dc58-43fd-8ccb-352bac5cabad', 'bd9b27af-c78c-4490-b69e-01624488b420', '64302704-84c4-4314-a287-c07bf5e4562e', NULL, NULL, '2025-11-23 21:06:15.648515+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('7c702552-816a-498c-a0cb-df2b91cb089b', 'aebbc0e1-6ba1-4c30-a606-3fa5979d9fb4', 'd4c4e1ac-b224-4257-9853-82ad6513367e', NULL, NULL, '2025-11-23 21:06:15.649001+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('1e01e32a-a715-4ab4-9de9-863e0086d7dd', 'aebbc0e1-6ba1-4c30-a606-3fa5979d9fb4', 'ff60135f-a1f0-43d4-ac49-99154c0603d3', NULL, NULL, '2025-11-23 21:06:15.649001+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('d64a12d1-e653-485c-86a1-b31bf370c8b3', 'aebbc0e1-6ba1-4c30-a606-3fa5979d9fb4', 'c4b4a28a-f859-488a-970e-fdc757892f22', NULL, NULL, '2025-11-23 21:06:15.649001+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('cd60bcd2-9551-429d-b75a-9eef60301b9c', 'aebbc0e1-6ba1-4c30-a606-3fa5979d9fb4', 'f2dfb4bf-216f-41cd-83c8-0b4ac8c3cff1', NULL, NULL, '2025-11-23 21:06:15.649001+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('d815a8da-10cb-4010-87bd-4fc59687157f', 'aebbc0e1-6ba1-4c30-a606-3fa5979d9fb4', 'b66db4cd-ce3d-41fd-a98b-181cc319a415', NULL, NULL, '2025-11-23 21:06:15.649001+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('d7e711e8-eb27-455a-b29d-7309969701ed', 'aebbc0e1-6ba1-4c30-a606-3fa5979d9fb4', 'ac19f208-fb8e-4fcf-9c81-ad9b84412167', NULL, NULL, '2025-11-23 21:06:15.649001+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('44ae561a-ce3b-412b-a0c4-60eb25e467cc', 'aebbc0e1-6ba1-4c30-a606-3fa5979d9fb4', 'e6b755b8-9ae6-42e6-9be4-7dc4a01e24d5', NULL, NULL, '2025-11-23 21:06:15.649001+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('84407453-8e06-4a8e-88dc-733d4c312906', 'aebbc0e1-6ba1-4c30-a606-3fa5979d9fb4', '0632295d-29d9-4793-b4e5-af81ac73a0a0', NULL, NULL, '2025-11-23 21:06:15.649001+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('418ca653-1288-4fea-a0ea-b4bdd7667162', '8854d99f-9c5b-4805-afe2-0ee6ca8261e2', 'd4c4e1ac-b224-4257-9853-82ad6513367e', NULL, NULL, '2025-11-23 21:06:15.649304+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('10edcdc8-7114-462f-9c85-86c5413b87a2', '8854d99f-9c5b-4805-afe2-0ee6ca8261e2', 'c4b4a28a-f859-488a-970e-fdc757892f22', NULL, NULL, '2025-11-23 21:06:15.649304+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('fee314cb-5c30-4f01-ae2f-1af2bac2b60e', '8854d99f-9c5b-4805-afe2-0ee6ca8261e2', 'ac19f208-fb8e-4fcf-9c81-ad9b84412167', NULL, NULL, '2025-11-23 21:06:15.649304+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('15358a21-e322-4385-9696-9947f383bced', '8854d99f-9c5b-4805-afe2-0ee6ca8261e2', 'e6b755b8-9ae6-42e6-9be4-7dc4a01e24d5', NULL, NULL, '2025-11-23 21:06:15.649304+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('1d8467d6-9290-4a91-a46e-7bbb026808f0', '8854d99f-9c5b-4805-afe2-0ee6ca8261e2', '0632295d-29d9-4793-b4e5-af81ac73a0a0', NULL, NULL, '2025-11-23 21:06:15.649304+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('b4096788-69de-4aee-9e12-fbf0351394d6', '733bbaf9-124f-4779-b629-f00c69ef35cb', 'd4c4e1ac-b224-4257-9853-82ad6513367e', NULL, NULL, '2025-11-23 21:06:15.649517+00');
INSERT INTO public.rbac_role_permissions (id, role_id, permission_id, resource_type, resource_id, created_at) VALUES ('a85630ca-559c-4075-9d32-2489cf193528', '733bbaf9-124f-4779-b629-f00c69ef35cb', 'e6b755b8-9ae6-42e6-9be4-7dc4a01e24d5', NULL, NULL, '2025-11-23 21:06:15.649517+00');


ALTER TABLE public.rbac_role_permissions ENABLE TRIGGER ALL;

--
-- Data for Name: rbac_user_org_roles; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.rbac_user_org_roles DISABLE TRIGGER ALL;

INSERT INTO public.rbac_user_org_roles (id, user_id, organization_slug, role_id, assigned_by, assigned_at, expires_at) VALUES ('528ca2f1-fd9b-48eb-8dc4-6e7195a6a718', '618f3960-a8be-4c67-855f-aae4130699b8', '*', 'c4f9a1ab-18bf-4622-a793-ff69ac071519', NULL, '2025-11-23 21:08:41.847365+00', NULL);
INSERT INTO public.rbac_user_org_roles (id, user_id, organization_slug, role_id, assigned_by, assigned_at, expires_at) VALUES ('8787ee25-14fb-4fb3-bf0b-d6fa640e695c', '739b2b8b-0bb1-4894-b5ba-8698c8cd071a', 'demo-org', 'bd9b27af-c78c-4490-b69e-01624488b420', NULL, '2025-11-23 21:08:41.847365+00', NULL);
INSERT INTO public.rbac_user_org_roles (id, user_id, organization_slug, role_id, assigned_by, assigned_at, expires_at) VALUES ('40394502-4af7-4e21-aea7-37646307e4ee', '493101fa-8892-4de4-a0f9-daf43afdca1f', 'demo-org', '8854d99f-9c5b-4805-afe2-0ee6ca8261e2', NULL, '2025-11-23 21:08:41.847365+00', NULL);
INSERT INTO public.rbac_user_org_roles (id, user_id, organization_slug, role_id, assigned_by, assigned_at, expires_at) VALUES ('02623b93-f77b-436c-8687-2dc18f666f50', '618f3960-a8be-4c67-855f-aae4130699b8', 'orchestratorai', 'c4f9a1ab-18bf-4622-a793-ff69ac071519', NULL, '2025-11-23 22:08:53.12629+00', NULL);
INSERT INTO public.rbac_user_org_roles (id, user_id, organization_slug, role_id, assigned_by, assigned_at, expires_at) VALUES ('35f4c2dd-b237-4389-bde2-b6bf8d8c0230', '618f3960-a8be-4c67-855f-aae4130699b8', 'demo-org', 'c4f9a1ab-18bf-4622-a793-ff69ac071519', NULL, '2025-11-23 22:08:53.12629+00', NULL);


ALTER TABLE public.rbac_user_org_roles ENABLE TRIGGER ALL;

--
-- Data for Name: redaction_patterns; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.redaction_patterns DISABLE TRIGGER ALL;



ALTER TABLE public.redaction_patterns ENABLE TRIGGER ALL;

--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.system_settings DISABLE TRIGGER ALL;



ALTER TABLE public.system_settings ENABLE TRIGGER ALL;

--
-- Data for Name: task_messages; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.task_messages DISABLE TRIGGER ALL;



ALTER TABLE public.task_messages ENABLE TRIGGER ALL;

--
-- Data for Name: user_cidafm_commands; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.user_cidafm_commands DISABLE TRIGGER ALL;



ALTER TABLE public.user_cidafm_commands ENABLE TRIGGER ALL;

--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.users DISABLE TRIGGER ALL;

INSERT INTO public.users (id, email, display_name, organization_slug, status, created_at, updated_at) VALUES ('739b2b8b-0bb1-4894-b5ba-8698c8cd071a', 'admin@orchestratorai.io', 'Admin User', 'demo-org', 'active', '2025-11-23 21:08:41.846311+00', '2025-11-23 21:08:41.846311+00');
INSERT INTO public.users (id, email, display_name, organization_slug, status, created_at, updated_at) VALUES ('493101fa-8892-4de4-a0f9-daf43afdca1f', 'demo.user@orchestratorai.io', 'Demo User', 'demo-org', 'active', '2025-11-23 21:08:41.846311+00', '2025-11-23 21:08:41.846311+00');
INSERT INTO public.users (id, email, display_name, organization_slug, status, created_at, updated_at) VALUES ('618f3960-a8be-4c67-855f-aae4130699b8', 'golfergeek@orchestratorai.io', 'GolferGeek', 'my-org', 'active', '2025-11-23 21:08:41.846311+00', '2025-11-23 21:08:41.846311+00');


ALTER TABLE public.users ENABLE TRIGGER ALL;

--
-- PostgreSQL database dump complete
--

\unrestrict n6I2AgYS4YMJ7FXcez6uBQ73a0vo0PY1MbWR53Y63ylHe5QLDKVCa4IvVUXSa9c

--
-- PostgreSQL database dump
--

\restrict CbNNWJWvwqIKfqzYqhCtjW1os0BUeYVpAbeSIR7E80t5Odw28JUkqr5VCcujVD9

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: -
--

SET SESSION AUTHORIZATION DEFAULT;

ALTER TABLE auth.audit_log_entries DISABLE TRIGGER ALL;

INSERT INTO auth.audit_log_entries (instance_id, id, payload, created_at, ip_address) VALUES ('00000000-0000-0000-0000-000000000000', '528e9a85-7176-4268-8787-ae22ad4381a1', '{"action":"login","actor_id":"618f3960-a8be-4c67-855f-aae4130699b8","actor_username":"golfergeek@orchestratorai.io","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-11-23 22:01:16.866001+00', '');
INSERT INTO auth.audit_log_entries (instance_id, id, payload, created_at, ip_address) VALUES ('00000000-0000-0000-0000-000000000000', '4521bfd0-1e44-4f44-8965-c62b8ed3d6d8', '{"action":"login","actor_id":"618f3960-a8be-4c67-855f-aae4130699b8","actor_username":"golfergeek@orchestratorai.io","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-11-23 22:01:33.188574+00', '');
INSERT INTO auth.audit_log_entries (instance_id, id, payload, created_at, ip_address) VALUES ('00000000-0000-0000-0000-000000000000', 'a51dfe6b-4725-4986-8d71-7e84c7796064', '{"action":"login","actor_id":"618f3960-a8be-4c67-855f-aae4130699b8","actor_username":"golfergeek@orchestratorai.io","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-11-23 22:09:09.73684+00', '');
INSERT INTO auth.audit_log_entries (instance_id, id, payload, created_at, ip_address) VALUES ('00000000-0000-0000-0000-000000000000', 'c6ff4f64-8394-4987-95da-b16f4d047631', '{"action":"login","actor_id":"618f3960-a8be-4c67-855f-aae4130699b8","actor_username":"golfergeek@orchestratorai.io","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-11-23 22:10:59.438463+00', '');
INSERT INTO auth.audit_log_entries (instance_id, id, payload, created_at, ip_address) VALUES ('00000000-0000-0000-0000-000000000000', 'c512577d-c092-4365-bda3-d723a3292ead', '{"action":"login","actor_id":"618f3960-a8be-4c67-855f-aae4130699b8","actor_username":"golfergeek@orchestratorai.io","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-11-23 22:21:48.484873+00', '');
INSERT INTO auth.audit_log_entries (instance_id, id, payload, created_at, ip_address) VALUES ('00000000-0000-0000-0000-000000000000', '9ce589d7-8614-47ce-a763-cee22ab2e149', '{"action":"login","actor_id":"618f3960-a8be-4c67-855f-aae4130699b8","actor_username":"golfergeek@orchestratorai.io","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-11-23 22:22:47.809083+00', '');


ALTER TABLE auth.audit_log_entries ENABLE TRIGGER ALL;

--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state DISABLE TRIGGER ALL;



ALTER TABLE auth.flow_state ENABLE TRIGGER ALL;

--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.users DISABLE TRIGGER ALL;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) VALUES ('00000000-0000-0000-0000-000000000000', '739b2b8b-0bb1-4894-b5ba-8698c8cd071a', 'authenticated', 'authenticated', 'admin@orchestratorai.io', '$2a$10$IaAmRqq3qRIVivhEZigCdeveOyMKild.R4/RraUviFv4k1ZzsBycq', '2025-11-23 21:08:01.537107+00', NULL, '', NULL, '', NULL, '', '', NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{"display_name": "Admin User"}', NULL, '2025-11-23 21:08:01.537107+00', '2025-11-23 21:08:01.537107+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) VALUES ('00000000-0000-0000-0000-000000000000', '493101fa-8892-4de4-a0f9-daf43afdca1f', 'authenticated', 'authenticated', 'demo.user@orchestratorai.io', '$2a$10$RscEkjI.9XUDP1jtwFCHReD6pBAXyH7UECSUYoy2JBcKMxck62XFi', '2025-11-23 21:08:01.537107+00', NULL, '', NULL, '', NULL, '', '', NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{"display_name": "Demo User"}', NULL, '2025-11-23 21:08:01.537107+00', '2025-11-23 21:08:01.537107+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) VALUES ('00000000-0000-0000-0000-000000000000', '618f3960-a8be-4c67-855f-aae4130699b8', 'authenticated', 'authenticated', 'golfergeek@orchestratorai.io', '$2a$06$HWTSCjJieTzGzakSJKlJk.6vYFBOskSgbDOaEUqtqIZiQIRVEkhjm', '2025-11-23 21:08:01.537107+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-11-23 22:22:47.809789+00', '{"provider": "email", "providers": ["email"]}', '{"display_name": "GolferGeek"}', NULL, '2025-11-23 21:08:01.537107+00', '2025-11-23 22:22:47.8116+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


ALTER TABLE auth.users ENABLE TRIGGER ALL;

--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.identities DISABLE TRIGGER ALL;



ALTER TABLE auth.identities ENABLE TRIGGER ALL;

--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.instances DISABLE TRIGGER ALL;



ALTER TABLE auth.instances ENABLE TRIGGER ALL;

--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.oauth_clients DISABLE TRIGGER ALL;



ALTER TABLE auth.oauth_clients ENABLE TRIGGER ALL;

--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions DISABLE TRIGGER ALL;

INSERT INTO auth.sessions (id, user_id, created_at, updated_at, factor_id, aal, not_after, refreshed_at, user_agent, ip, tag, oauth_client_id, refresh_token_hmac_key, refresh_token_counter) VALUES ('cd429307-700f-482a-86d4-9391ff5380e0', '618f3960-a8be-4c67-855f-aae4130699b8', '2025-11-23 22:01:16.866738+00', '2025-11-23 22:01:16.866738+00', NULL, 'aal1', NULL, NULL, 'curl/8.7.1', '172.21.0.1', NULL, NULL, NULL, NULL);
INSERT INTO auth.sessions (id, user_id, created_at, updated_at, factor_id, aal, not_after, refreshed_at, user_agent, ip, tag, oauth_client_id, refresh_token_hmac_key, refresh_token_counter) VALUES ('37f1b27c-675f-4279-bd5c-412efccea5ed', '618f3960-a8be-4c67-855f-aae4130699b8', '2025-11-23 22:01:33.189219+00', '2025-11-23 22:01:33.189219+00', NULL, 'aal1', NULL, NULL, 'node', '172.21.0.1', NULL, NULL, NULL, NULL);
INSERT INTO auth.sessions (id, user_id, created_at, updated_at, factor_id, aal, not_after, refreshed_at, user_agent, ip, tag, oauth_client_id, refresh_token_hmac_key, refresh_token_counter) VALUES ('3f67f6d7-a41b-48e0-9360-80c1c5b2bbc7', '618f3960-a8be-4c67-855f-aae4130699b8', '2025-11-23 22:09:09.739856+00', '2025-11-23 22:09:09.739856+00', NULL, 'aal1', NULL, NULL, 'node', '172.21.0.1', NULL, NULL, NULL, NULL);
INSERT INTO auth.sessions (id, user_id, created_at, updated_at, factor_id, aal, not_after, refreshed_at, user_agent, ip, tag, oauth_client_id, refresh_token_hmac_key, refresh_token_counter) VALUES ('2ed906a8-7f28-47f2-8b02-c297d1da00ca', '618f3960-a8be-4c67-855f-aae4130699b8', '2025-11-23 22:10:59.439199+00', '2025-11-23 22:10:59.439199+00', NULL, 'aal1', NULL, NULL, 'node', '172.21.0.1', NULL, NULL, NULL, NULL);
INSERT INTO auth.sessions (id, user_id, created_at, updated_at, factor_id, aal, not_after, refreshed_at, user_agent, ip, tag, oauth_client_id, refresh_token_hmac_key, refresh_token_counter) VALUES ('b5805c8d-1870-41d2-9114-1daceca30c14', '618f3960-a8be-4c67-855f-aae4130699b8', '2025-11-23 22:21:48.485442+00', '2025-11-23 22:21:48.485442+00', NULL, 'aal1', NULL, NULL, 'node', '172.21.0.1', NULL, NULL, NULL, NULL);
INSERT INTO auth.sessions (id, user_id, created_at, updated_at, factor_id, aal, not_after, refreshed_at, user_agent, ip, tag, oauth_client_id, refresh_token_hmac_key, refresh_token_counter) VALUES ('40647675-da0e-4a53-8a00-098ab19b10ca', '618f3960-a8be-4c67-855f-aae4130699b8', '2025-11-23 22:22:47.809833+00', '2025-11-23 22:22:47.809833+00', NULL, 'aal1', NULL, NULL, 'node', '172.21.0.1', NULL, NULL, NULL, NULL);


ALTER TABLE auth.sessions ENABLE TRIGGER ALL;

--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims DISABLE TRIGGER ALL;

INSERT INTO auth.mfa_amr_claims (session_id, created_at, updated_at, authentication_method, id) VALUES ('cd429307-700f-482a-86d4-9391ff5380e0', '2025-11-23 22:01:16.868924+00', '2025-11-23 22:01:16.868924+00', 'password', 'c72bcca1-294e-41de-a7f3-966cb48eb00e');
INSERT INTO auth.mfa_amr_claims (session_id, created_at, updated_at, authentication_method, id) VALUES ('37f1b27c-675f-4279-bd5c-412efccea5ed', '2025-11-23 22:01:33.191008+00', '2025-11-23 22:01:33.191008+00', 'password', 'aa23df3b-7bc2-440e-8847-e2cc13c2aa4b');
INSERT INTO auth.mfa_amr_claims (session_id, created_at, updated_at, authentication_method, id) VALUES ('3f67f6d7-a41b-48e0-9360-80c1c5b2bbc7', '2025-11-23 22:09:09.742121+00', '2025-11-23 22:09:09.742121+00', 'password', '7ff26b74-c4a5-426c-9f3a-1682e4e645c6');
INSERT INTO auth.mfa_amr_claims (session_id, created_at, updated_at, authentication_method, id) VALUES ('2ed906a8-7f28-47f2-8b02-c297d1da00ca', '2025-11-23 22:10:59.440899+00', '2025-11-23 22:10:59.440899+00', 'password', '43119851-fd4a-4ccb-ad7f-0e2c92209180');
INSERT INTO auth.mfa_amr_claims (session_id, created_at, updated_at, authentication_method, id) VALUES ('b5805c8d-1870-41d2-9114-1daceca30c14', '2025-11-23 22:21:48.487204+00', '2025-11-23 22:21:48.487204+00', 'password', '5f7468aa-164b-44a8-8f99-3cf019a5ca21');
INSERT INTO auth.mfa_amr_claims (session_id, created_at, updated_at, authentication_method, id) VALUES ('40647675-da0e-4a53-8a00-098ab19b10ca', '2025-11-23 22:22:47.81196+00', '2025-11-23 22:22:47.81196+00', 'password', 'aa780d78-56e9-47a3-82a7-71385c3aef35');


ALTER TABLE auth.mfa_amr_claims ENABLE TRIGGER ALL;

--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors DISABLE TRIGGER ALL;



ALTER TABLE auth.mfa_factors ENABLE TRIGGER ALL;

--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges DISABLE TRIGGER ALL;



ALTER TABLE auth.mfa_challenges ENABLE TRIGGER ALL;

--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.oauth_authorizations DISABLE TRIGGER ALL;



ALTER TABLE auth.oauth_authorizations ENABLE TRIGGER ALL;

--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.oauth_consents DISABLE TRIGGER ALL;



ALTER TABLE auth.oauth_consents ENABLE TRIGGER ALL;

--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens DISABLE TRIGGER ALL;



ALTER TABLE auth.one_time_tokens ENABLE TRIGGER ALL;

--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens DISABLE TRIGGER ALL;

INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 1, 'whfb6s4n25ow', '618f3960-a8be-4c67-855f-aae4130699b8', false, '2025-11-23 22:01:16.86779+00', '2025-11-23 22:01:16.86779+00', NULL, 'cd429307-700f-482a-86d4-9391ff5380e0');
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 2, 'hulmciazb6cs', '618f3960-a8be-4c67-855f-aae4130699b8', false, '2025-11-23 22:01:33.190141+00', '2025-11-23 22:01:33.190141+00', NULL, '37f1b27c-675f-4279-bd5c-412efccea5ed');
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 3, 'btkwqfamrnb5', '618f3960-a8be-4c67-855f-aae4130699b8', false, '2025-11-23 22:09:09.741216+00', '2025-11-23 22:09:09.741216+00', NULL, '3f67f6d7-a41b-48e0-9360-80c1c5b2bbc7');
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 4, 'fegcys65iueh', '618f3960-a8be-4c67-855f-aae4130699b8', false, '2025-11-23 22:10:59.440178+00', '2025-11-23 22:10:59.440178+00', NULL, '2ed906a8-7f28-47f2-8b02-c297d1da00ca');
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 5, 'orr2wtbfcx6w', '618f3960-a8be-4c67-855f-aae4130699b8', false, '2025-11-23 22:21:48.486378+00', '2025-11-23 22:21:48.486378+00', NULL, 'b5805c8d-1870-41d2-9114-1daceca30c14');
INSERT INTO auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) VALUES ('00000000-0000-0000-0000-000000000000', 6, 'pkmxx7y2knoe', '618f3960-a8be-4c67-855f-aae4130699b8', false, '2025-11-23 22:22:47.81096+00', '2025-11-23 22:22:47.81096+00', NULL, '40647675-da0e-4a53-8a00-098ab19b10ca');


ALTER TABLE auth.refresh_tokens ENABLE TRIGGER ALL;

--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers DISABLE TRIGGER ALL;



ALTER TABLE auth.sso_providers ENABLE TRIGGER ALL;

--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers DISABLE TRIGGER ALL;



ALTER TABLE auth.saml_providers ENABLE TRIGGER ALL;

--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states DISABLE TRIGGER ALL;



ALTER TABLE auth.saml_relay_states ENABLE TRIGGER ALL;

--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations DISABLE TRIGGER ALL;

INSERT INTO auth.schema_migrations (version) VALUES ('20171026211738');
INSERT INTO auth.schema_migrations (version) VALUES ('20171026211808');
INSERT INTO auth.schema_migrations (version) VALUES ('20171026211834');
INSERT INTO auth.schema_migrations (version) VALUES ('20180103212743');
INSERT INTO auth.schema_migrations (version) VALUES ('20180108183307');
INSERT INTO auth.schema_migrations (version) VALUES ('20180119214651');
INSERT INTO auth.schema_migrations (version) VALUES ('20180125194653');
INSERT INTO auth.schema_migrations (version) VALUES ('00');
INSERT INTO auth.schema_migrations (version) VALUES ('20210710035447');
INSERT INTO auth.schema_migrations (version) VALUES ('20210722035447');
INSERT INTO auth.schema_migrations (version) VALUES ('20210730183235');
INSERT INTO auth.schema_migrations (version) VALUES ('20210909172000');
INSERT INTO auth.schema_migrations (version) VALUES ('20210927181326');
INSERT INTO auth.schema_migrations (version) VALUES ('20211122151130');
INSERT INTO auth.schema_migrations (version) VALUES ('20211124214934');
INSERT INTO auth.schema_migrations (version) VALUES ('20211202183645');
INSERT INTO auth.schema_migrations (version) VALUES ('20220114185221');
INSERT INTO auth.schema_migrations (version) VALUES ('20220114185340');
INSERT INTO auth.schema_migrations (version) VALUES ('20220224000811');
INSERT INTO auth.schema_migrations (version) VALUES ('20220323170000');
INSERT INTO auth.schema_migrations (version) VALUES ('20220429102000');
INSERT INTO auth.schema_migrations (version) VALUES ('20220531120530');
INSERT INTO auth.schema_migrations (version) VALUES ('20220614074223');
INSERT INTO auth.schema_migrations (version) VALUES ('20220811173540');
INSERT INTO auth.schema_migrations (version) VALUES ('20221003041349');
INSERT INTO auth.schema_migrations (version) VALUES ('20221003041400');
INSERT INTO auth.schema_migrations (version) VALUES ('20221011041400');
INSERT INTO auth.schema_migrations (version) VALUES ('20221020193600');
INSERT INTO auth.schema_migrations (version) VALUES ('20221021073300');
INSERT INTO auth.schema_migrations (version) VALUES ('20221021082433');
INSERT INTO auth.schema_migrations (version) VALUES ('20221027105023');
INSERT INTO auth.schema_migrations (version) VALUES ('20221114143122');
INSERT INTO auth.schema_migrations (version) VALUES ('20221114143410');
INSERT INTO auth.schema_migrations (version) VALUES ('20221125140132');
INSERT INTO auth.schema_migrations (version) VALUES ('20221208132122');
INSERT INTO auth.schema_migrations (version) VALUES ('20221215195500');
INSERT INTO auth.schema_migrations (version) VALUES ('20221215195800');
INSERT INTO auth.schema_migrations (version) VALUES ('20221215195900');
INSERT INTO auth.schema_migrations (version) VALUES ('20230116124310');
INSERT INTO auth.schema_migrations (version) VALUES ('20230116124412');
INSERT INTO auth.schema_migrations (version) VALUES ('20230131181311');
INSERT INTO auth.schema_migrations (version) VALUES ('20230322519590');
INSERT INTO auth.schema_migrations (version) VALUES ('20230402418590');
INSERT INTO auth.schema_migrations (version) VALUES ('20230411005111');
INSERT INTO auth.schema_migrations (version) VALUES ('20230508135423');
INSERT INTO auth.schema_migrations (version) VALUES ('20230523124323');
INSERT INTO auth.schema_migrations (version) VALUES ('20230818113222');
INSERT INTO auth.schema_migrations (version) VALUES ('20230914180801');
INSERT INTO auth.schema_migrations (version) VALUES ('20231027141322');
INSERT INTO auth.schema_migrations (version) VALUES ('20231114161723');
INSERT INTO auth.schema_migrations (version) VALUES ('20231117164230');
INSERT INTO auth.schema_migrations (version) VALUES ('20240115144230');
INSERT INTO auth.schema_migrations (version) VALUES ('20240214120130');
INSERT INTO auth.schema_migrations (version) VALUES ('20240306115329');
INSERT INTO auth.schema_migrations (version) VALUES ('20240314092811');
INSERT INTO auth.schema_migrations (version) VALUES ('20240427152123');
INSERT INTO auth.schema_migrations (version) VALUES ('20240612123726');
INSERT INTO auth.schema_migrations (version) VALUES ('20240729123726');
INSERT INTO auth.schema_migrations (version) VALUES ('20240802193726');
INSERT INTO auth.schema_migrations (version) VALUES ('20240806073726');
INSERT INTO auth.schema_migrations (version) VALUES ('20241009103726');
INSERT INTO auth.schema_migrations (version) VALUES ('20250717082212');
INSERT INTO auth.schema_migrations (version) VALUES ('20250731150234');
INSERT INTO auth.schema_migrations (version) VALUES ('20250804100000');
INSERT INTO auth.schema_migrations (version) VALUES ('20250901200500');
INSERT INTO auth.schema_migrations (version) VALUES ('20250903112500');
INSERT INTO auth.schema_migrations (version) VALUES ('20250904133000');
INSERT INTO auth.schema_migrations (version) VALUES ('20250925093508');
INSERT INTO auth.schema_migrations (version) VALUES ('20251007112900');


ALTER TABLE auth.schema_migrations ENABLE TRIGGER ALL;

--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains DISABLE TRIGGER ALL;



ALTER TABLE auth.sso_domains ENABLE TRIGGER ALL;

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: -
--

SELECT pg_catalog.setval('auth.refresh_tokens_id_seq', 6, true);


--
-- PostgreSQL database dump complete
--

\unrestrict CbNNWJWvwqIKfqzYqhCtjW1os0BUeYVpAbeSIR7E80t5Odw28JUkqr5VCcujVD9


-- Re-enable triggers
SET session_replication_role = DEFAULT;
