-- Educational Database Seed Data
-- Production-ready starting point for educational use
-- Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
-- 
-- Includes:
--   - Agents (all agent configurations)
--   - LLM Providers & Models (all available providers and models)
--   - Organizations (organization structure)
--   - Users (public.users and auth.users)
--   - RBAC (roles, permissions, role_permissions, user_org_roles)
--   - System Settings (global configuration)
--   - Organization Credentials (if any)
--   - Pseudonym Dictionaries (PII handling)
--   - Redaction Patterns (PII redaction)
--
-- Excludes:
--   - LangGraph checkpoints (checkpoint_*, checkpoints tables)
--   - Conversations
--   - Tasks
--   - Deliverables
--   - Plans
--   - Observability events
--   - LLM usage logs
--   - Assets
--   - Human approvals

-- Disable triggers during import for speed
SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

\restrict LTcGcLkdLxgowbeZCK6r7Bh9skhUtATqiUedJTEol6fBdhuRhNtoeglMmkQ4KxX

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

Remember: Your goal is to create content that ranks well in search engines while genuinely helping and engaging readers. Quality content that serves the audience always wins.', NULL, '{"model": "claude-3-5-sonnet-20241022", "provider": "anthropic", "parameters": {"topP": 0.9, "maxTokens": 4000, "temperature": 0.7}}', '{"author": "Orchestrator AI Team", "license": "PROPRIETARY", "limitations": ["Cannot access real-time data or current events without external tools", "May require fact-checking for highly specialized or emerging topics", "Does not automatically generate images or media assets"], "mode_profile": "full", "usage_examples": [{"input": {"tone": "technical", "topic": "Introduction to GraphQL", "length": "medium", "keywords": ["GraphQL", "API", "REST", "query language"], "targetAudience": "developers"}, "description": "Technical blog post for developers"}, {"input": {"tone": "professional", "topic": "Benefits of AI in Customer Service", "length": "long", "keywords": ["AI", "customer service", "automation", "efficiency"], "targetAudience": "business owners"}, "description": "Marketing blog for business owners"}], "execution_modes": ["immediate", "polling", "real-time"], "version_history": [{"date": "2025-01-20", "changes": "Initial release for v2-start", "version": "1.0.0"}], "documentation_url": "https://docs.orchestratorai.io/agents/blog-post-writer", "performance_notes": "Optimized for content quality over speed. Average response time: 15-30 seconds for medium-length posts.", "execution_capabilities": {"can_plan": true, "can_build": true, "can_converse": true}}', '2025-11-23 21:09:56.490914+00', '2025-11-24 22:26:41.288776+00');
INSERT INTO public.agents (slug, organization_slug, name, description, version, agent_type, department, tags, io_schema, capabilities, context, endpoint, llm_config, metadata, created_at, updated_at) VALUES ('hr-policy-agent', '{demo-org,orchestratorai}', 'HR Policy Assistant', 'AI-powered HR assistant that answers questions about company policies, benefits, procedures, and employee guidelines using the HR knowledge base.', '1.0.0', 'rag-runner', 'hr', '{hr,policy,benefits,employee,knowledge-base,rag}', '{"input": {"type": "object", "required": ["question"], "properties": {"question": {"type": "string", "description": "The HR-related question to answer"}}}, "output": {"type": "object", "required": ["message"], "properties": {"message": {"type": "string", "description": "The answer to the HR question"}, "sources": {"type": "array", "items": {"type": "object", "properties": {"score": {"type": "number"}, "excerpt": {"type": "string"}, "document": {"type": "string"}}}, "description": "Source documents used to answer the question"}}}}', '{hr-policy-lookup,benefits-information,procedure-guidance,employee-handbook,plan,build}', 'You are an HR Policy Assistant that helps employees find information about company policies, benefits, and procedures.', NULL, '{"model": "gpt-oss:20b", "provider": "ollama", "parameters": {"topP": 0.9, "maxTokens": 2000, "temperature": 0.3}}', '{"author": "Orchestrator AI Team", "license": "PROPRIETARY", "rag_config": {"top_k": 5, "collection_slug": "hr-policy", "no_access_message": "I do not have access to the HR knowledge base. Please contact HR directly.", "no_results_message": "I could not find information about that in the HR knowledge base. Please contact HR directly for assistance.", "similarity_threshold": 0.6}, "mode_profile": "full", "execution_modes": ["immediate", "polling", "real-time"], "execution_capabilities": {"can_plan": true, "can_build": true, "can_converse": true}}', '2025-11-24 14:35:09.303179+00', '2025-11-24 22:26:41.288776+00');
INSERT INTO public.agents (slug, organization_slug, name, description, version, agent_type, department, tags, io_schema, capabilities, context, endpoint, llm_config, metadata, created_at, updated_at) VALUES ('data-analyst', '{demo-org}', 'Data Analyst', 'LangGraph-powered data analyst agent that uses natural language to query databases, list tables, describe schemas, and generate SQL queries with comprehensive result summaries.', '1.0.0', 'api', 'analytics', '{data-analysis,sql,database,langgraph,tool-calling}', '{"input": {"type": "object", "required": ["question"], "properties": {"userId": {"type": "string", "description": "User ID for tracking"}, "question": {"type": "string", "description": "Natural language question about the data"}}}, "output": {"type": "object", "properties": {"status": {"type": "string", "description": "Current status of the analysis"}, "taskId": {"type": "string", "description": "Task ID for the analysis session (used as thread ID)"}, "summary": {"type": "string", "description": "Natural language summary of the analysis"}, "queryResults": {"type": "object", "description": "Results from SQL execution"}, "sqlGenerated": {"type": "string", "description": "Generated SQL query"}, "tablesDiscovered": {"type": "array", "items": {"type": "string"}, "description": "List of database tables discovered"}}}}', '{database-query,sql-generation,schema-analysis,data-summarization}', '# Data Analyst Agent

A LangGraph-powered agent that analyzes databases using natural language queries.

## Capabilities
- **Schema Discovery**: Lists and describes database tables
- **SQL Generation**: Generates SQL from natural language using Ollama/SQLCoder
- **Query Execution**: Executes read-only SQL queries safely
- **Result Summarization**: Provides clear summaries of query results

## Flow
1. User asks a question about data
2. Agent discovers relevant tables
3. Agent describes table schemas
4. Agent generates SQL query
5. Agent executes query (read-only)
6. Agent summarizes results

## Safety
- All SQL queries are read-only (SELECT only)
- Query execution is sandboxed
- Results are validated before returning', '{"url": "http://localhost:6200/data-analyst/analyze", "method": "POST", "headers": {"Content-Type": "application/json"}, "timeout": 120000, "responseTransform": {"content": "$.data.summary", "metadata": {"status": "$.data.status", "taskId": "$.data.threadId", "queryResults": "$.data.queryResults", "sqlGenerated": "$.data.sqlGenerated", "tablesDiscovered": "$.data.tablesDiscovered"}}}', NULL, '{"features": ["tool-calling", "checkpointing"], "provider": "langgraph", "statusEndpoint": "/data-analyst/status/{threadId}", "execution_modes": ["immediate", "polling", "real-time"], "historyEndpoint": "/data-analyst/history/{threadId}", "langgraphEndpoint": "http://localhost:6200", "execution_capabilities": {"can_plan": false, "can_build": true, "can_converse": true, "requires_human_gate": false}}', '2025-11-25 16:48:02.919156+00', '2025-12-02 18:00:57.038819+00');
INSERT INTO public.agents (slug, organization_slug, name, description, version, agent_type, department, tags, io_schema, capabilities, context, endpoint, llm_config, metadata, created_at, updated_at) VALUES ('extended-post-writer', '{demo-org}', 'Extended Post Writer', 'LangGraph-powered content generation agent with Human-in-the-Loop (HITL) approval. Generates blog posts, SEO descriptions, and social media posts, then pauses for human review before finalizing.', '1.0.0', 'api', 'marketing', '{content-creation,blog,seo,social-media,langgraph,hitl}', '{"input": {"type": "object", "required": ["topic"], "properties": {"tone": {"enum": ["professional", "casual", "technical", "conversational"], "type": "string", "default": "professional", "description": "Writing tone"}, "topic": {"type": "string", "description": "Topic for content generation"}, "userId": {"type": "string", "description": "User ID for tracking"}}}, "output": {"type": "object", "properties": {"status": {"enum": ["started", "generating", "hitl_waiting", "completed", "rejected", "failed"], "type": "string", "description": "Current workflow status"}, "taskId": {"type": "string", "description": "Task ID for the content generation session (used as thread ID)"}, "hitlPending": {"type": "boolean", "description": "Whether human approval is pending"}, "finalContent": {"type": "object", "description": "Final approved/edited content after HITL"}, "generatedContent": {"type": "object", "properties": {"blogPost": {"type": "string"}, "socialPosts": {"type": "array", "items": {"type": "string"}}, "seoDescription": {"type": "string"}}, "description": "Generated content awaiting review"}}}}', '{content-generation,blog-writing,seo-optimization,social-media,human-in-the-loop}', '# Extended Post Writer Agent

A LangGraph-powered content generation agent with Human-in-the-Loop (HITL) approval workflow.

## Capabilities
- **Blog Post Generation**: Creates comprehensive blog posts on any topic
- **SEO Description**: Generates optimized meta descriptions
- **Social Media Posts**: Creates multiple social media posts for different platforms
- **HITL Approval**: Pauses for human review before finalizing content

## HITL Workflow
1. User provides topic and preferences
2. Agent generates all content types
3. Workflow pauses with `hitl_waiting` status
4. Human reviews content in approval modal
5. Human can:
   - **Approve**: Accept content as-is
   - **Edit**: Modify content then approve
   - **Reject**: Reject and provide feedback
6. Workflow completes with final content

## Resume Actions
- `approve`: Accept generated content
- `edit`: Accept with modifications (provide editedContent)
- `reject`: Reject content (provide feedback)

## Endpoints
- `POST /extended-post-writer/generate` - Start generation
- `POST /extended-post-writer/resume/:threadId` - Resume with decision
- `GET /extended-post-writer/status/:threadId` - Check status', '{"url": "http://localhost:6200/extended-post-writer/generate", "method": "POST", "headers": {"Content-Type": "application/json"}, "timeout": 120000, "responseTransform": {"content": "$.data.generatedContent.blogPost", "metadata": {"status": "$.data.status", "taskId": "$.data.threadId", "hitlPending": "$.data.hitlPending", "finalContent": "$.data.finalContent", "generatedContent": "$.data.generatedContent"}}}', NULL, '{"features": ["hitl", "checkpointing", "content-generation"], "provider": "langgraph", "hitlEnabled": true, "resumeEndpoint": "/extended-post-writer/resume/{threadId}", "statusEndpoint": "/extended-post-writer/status/{threadId}", "execution_modes": ["immediate", "polling", "real-time"], "historyEndpoint": "/extended-post-writer/history/{threadId}", "langgraphEndpoint": "http://localhost:6200", "execution_capabilities": {"can_plan": false, "can_build": true, "can_converse": true, "requires_human_gate": true}}', '2025-11-25 16:48:02.92047+00', '2025-12-02 18:00:57.042704+00');


ALTER TABLE public.agents ENABLE TRIGGER ALL;

--
-- PostgreSQL database dump complete
--

\unrestrict LTcGcLkdLxgowbeZCK6r7Bh9skhUtATqiUedJTEol6fBdhuRhNtoeglMmkQ4KxX

--
-- PostgreSQL database dump
--

\restrict TZoIRUwSoyl5QpeHcweB6Ur9eyRa20SjE6Ujc67UjMj59jiNuWMwrRcOt54etMW

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
-- Data for Name: llm_providers; Type: TABLE DATA; Schema: public; Owner: -
--

SET SESSION AUTHORIZATION DEFAULT;

ALTER TABLE public.llm_providers DISABLE TRIGGER ALL;

INSERT INTO public.llm_providers (name, display_name, api_base_url, configuration_json, is_active, created_at, updated_at) VALUES ('openai', 'OpenAI', 'https://api.openai.com/v1', '{}', true, '2025-11-23 21:24:09.785462+00', '2025-11-23 21:24:09.785462+00');
INSERT INTO public.llm_providers (name, display_name, api_base_url, configuration_json, is_active, created_at, updated_at) VALUES ('google', 'Google', 'https://generativelanguage.googleapis.com/v1beta', '{}', true, '2025-11-23 21:24:09.785462+00', '2025-11-23 21:24:09.785462+00');
INSERT INTO public.llm_providers (name, display_name, api_base_url, configuration_json, is_active, created_at, updated_at) VALUES ('anthropic', 'Anthropic', 'https://api.anthropic.com/v1', '{}', true, '2025-11-23 21:24:09.785462+00', '2025-11-23 21:24:09.785462+00');
INSERT INTO public.llm_providers (name, display_name, api_base_url, configuration_json, is_active, created_at, updated_at) VALUES ('grok', 'xAI Grok', 'https://api.x.ai/v1', '{}', true, '2025-11-23 21:24:09.785462+00', '2025-11-23 21:24:09.785462+00');
INSERT INTO public.llm_providers (name, display_name, api_base_url, configuration_json, is_active, created_at, updated_at) VALUES ('ollama', 'Ollama (Local)', 'http://localhost:11434', '{}', true, '2025-11-23 21:24:09.785462+00', '2025-11-23 21:24:09.785462+00');


ALTER TABLE public.llm_providers ENABLE TRIGGER ALL;

--
-- PostgreSQL database dump complete
--

\unrestrict TZoIRUwSoyl5QpeHcweB6Ur9eyRa20SjE6Ujc67UjMj59jiNuWMwrRcOt54etMW

--
-- PostgreSQL database dump
--

\restrict GN0tB9anmJt2W1pH1tR6gzgjELbwBpFmhMBPhdHjbMt9I2dp0E8b0riXJATm5S6

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
-- Data for Name: llm_models; Type: TABLE DATA; Schema: public; Owner: -
--

SET SESSION AUTHORIZATION DEFAULT;

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
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('qwen3:8b', 'ollama', 'Qwen 3 8B', 'text-generation', NULL, 32768, 8192, '{}', '{}', '["chat", "code"]', NULL, 'fast', 5, true, true, true, NULL, '2025-11-23 21:26:34.218006+00', '2025-11-23 22:16:17.440451+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('llama3.2:1b', 'ollama', 'Llama 3.2 1B', 'text-generation', NULL, 8192, 4096, '{}', '{}', '["chat"]', NULL, 'very-fast', 5, true, true, true, NULL, '2025-11-23 21:26:34.218006+00', '2025-11-23 22:19:58.021541+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gpt-oss:20b', 'ollama', 'GPT-OSS 20B', 'text-generation', NULL, 8192, 4096, '{}', '{}', '["chat", "code"]', NULL, 'medium', 5, true, true, true, NULL, '2025-11-23 21:26:34.218006+00', '2025-11-24 16:05:23.028668+00');


ALTER TABLE public.llm_models ENABLE TRIGGER ALL;

--
-- PostgreSQL database dump complete
--

\unrestrict GN0tB9anmJt2W1pH1tR6gzgjELbwBpFmhMBPhdHjbMt9I2dp0E8b0riXJATm5S6

--
-- PostgreSQL database dump
--

\restrict XXFSqnjeoxP23RLJjQ681IeiDbc8TvGkGeDegKwUlDMJq2RxbEVHWpzQ6bead1K

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
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: -
--

SET SESSION AUTHORIZATION DEFAULT;

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
-- PostgreSQL database dump complete
--

\unrestrict XXFSqnjeoxP23RLJjQ681IeiDbc8TvGkGeDegKwUlDMJq2RxbEVHWpzQ6bead1K

--
-- PostgreSQL database dump
--

\restrict fGC6izchgFpcB1AhwEIUXnkQdK3ll1x3eGKIN1qsPjRWVpWaElcYPepG0mqpGD0

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
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

SET SESSION AUTHORIZATION DEFAULT;

ALTER TABLE public.users DISABLE TRIGGER ALL;

INSERT INTO public.users (id, email, display_name, organization_slug, status, created_at, updated_at) VALUES ('739b2b8b-0bb1-4894-b5ba-8698c8cd071a', 'admin@orchestratorai.io', 'Admin User', 'demo-org', 'active', '2025-11-23 21:08:41.846311+00', '2025-11-23 21:08:41.846311+00');
INSERT INTO public.users (id, email, display_name, organization_slug, status, created_at, updated_at) VALUES ('493101fa-8892-4de4-a0f9-daf43afdca1f', 'demo.user@orchestratorai.io', 'Demo User', 'demo-org', 'active', '2025-11-23 21:08:41.846311+00', '2025-11-23 21:08:41.846311+00');
INSERT INTO public.users (id, email, display_name, organization_slug, status, created_at, updated_at) VALUES ('618f3960-a8be-4c67-855f-aae4130699b8', 'golfergeek@orchestratorai.io', 'GolferGeek', 'my-org', 'active', '2025-11-23 21:08:41.846311+00', '2025-11-23 21:08:41.846311+00');


ALTER TABLE public.users ENABLE TRIGGER ALL;

--
-- PostgreSQL database dump complete
--

\unrestrict fGC6izchgFpcB1AhwEIUXnkQdK3ll1x3eGKIN1qsPjRWVpWaElcYPepG0mqpGD0

--
-- PostgreSQL database dump
--

\restrict vg6K07N26JswNFK35J7qGmconNX63vOAk2rCeKOxNTEuv7FLg6oWUCPf3siCypu

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
-- Data for Name: rbac_roles; Type: TABLE DATA; Schema: public; Owner: -
--

SET SESSION AUTHORIZATION DEFAULT;

ALTER TABLE public.rbac_roles DISABLE TRIGGER ALL;

INSERT INTO public.rbac_roles (id, name, display_name, description, is_system, created_at, updated_at) VALUES ('c4f9a1ab-18bf-4622-a793-ff69ac071519', 'super-admin', 'Super Administrator', 'Full access to all organizations and resources', true, '2025-11-23 21:03:21.300579+00', '2025-11-23 21:03:21.300579+00');
INSERT INTO public.rbac_roles (id, name, display_name, description, is_system, created_at, updated_at) VALUES ('bd9b27af-c78c-4490-b69e-01624488b420', 'admin', 'Administrator', 'Full access within assigned organization', true, '2025-11-23 21:03:21.300579+00', '2025-11-23 21:03:21.300579+00');
INSERT INTO public.rbac_roles (id, name, display_name, description, is_system, created_at, updated_at) VALUES ('aebbc0e1-6ba1-4c30-a606-3fa5979d9fb4', 'manager', 'Manager', 'Can manage users and resources within organization', true, '2025-11-23 21:03:21.300579+00', '2025-11-23 21:03:21.300579+00');
INSERT INTO public.rbac_roles (id, name, display_name, description, is_system, created_at, updated_at) VALUES ('8854d99f-9c5b-4805-afe2-0ee6ca8261e2', 'member', 'Member', 'Standard access within organization', true, '2025-11-23 21:03:21.300579+00', '2025-11-23 21:03:21.300579+00');
INSERT INTO public.rbac_roles (id, name, display_name, description, is_system, created_at, updated_at) VALUES ('733bbaf9-124f-4779-b629-f00c69ef35cb', 'viewer', 'Viewer', 'Read-only access within organization', true, '2025-11-23 21:03:21.300579+00', '2025-11-23 21:03:21.300579+00');


ALTER TABLE public.rbac_roles ENABLE TRIGGER ALL;

--
-- PostgreSQL database dump complete
--

\unrestrict vg6K07N26JswNFK35J7qGmconNX63vOAk2rCeKOxNTEuv7FLg6oWUCPf3siCypu

--
-- PostgreSQL database dump
--

\restrict QXnLRBIjfHkh9wLbtZnFayIq1sbjKRAFJpu7kKkQIOEfxPosxffYvDuVNZzgJrJ

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
-- Data for Name: rbac_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

SET SESSION AUTHORIZATION DEFAULT;

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
-- PostgreSQL database dump complete
--

\unrestrict QXnLRBIjfHkh9wLbtZnFayIq1sbjKRAFJpu7kKkQIOEfxPosxffYvDuVNZzgJrJ

--
-- PostgreSQL database dump
--

\restrict X20UpE2Ywi7mhHWu5K0GxfcDwmZzUnoGs3C958V6mlsijhDjbHXw5SAAwIQTm8F

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
-- Data for Name: rbac_role_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

SET SESSION AUTHORIZATION DEFAULT;

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
-- PostgreSQL database dump complete
--

\unrestrict X20UpE2Ywi7mhHWu5K0GxfcDwmZzUnoGs3C958V6mlsijhDjbHXw5SAAwIQTm8F

--
-- PostgreSQL database dump
--

\restrict a4VB5zJiHEGzu9W9gJt9sFjVPB08iAJKbgdPnN8OSHD7rB2HzrAo0up5THDfIzY

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
-- Data for Name: rbac_user_org_roles; Type: TABLE DATA; Schema: public; Owner: -
--

SET SESSION AUTHORIZATION DEFAULT;

ALTER TABLE public.rbac_user_org_roles DISABLE TRIGGER ALL;

INSERT INTO public.rbac_user_org_roles (id, user_id, organization_slug, role_id, assigned_by, assigned_at, expires_at) VALUES ('528ca2f1-fd9b-48eb-8dc4-6e7195a6a718', '618f3960-a8be-4c67-855f-aae4130699b8', '*', 'c4f9a1ab-18bf-4622-a793-ff69ac071519', NULL, '2025-11-23 21:08:41.847365+00', NULL);
INSERT INTO public.rbac_user_org_roles (id, user_id, organization_slug, role_id, assigned_by, assigned_at, expires_at) VALUES ('8787ee25-14fb-4fb3-bf0b-d6fa640e695c', '739b2b8b-0bb1-4894-b5ba-8698c8cd071a', 'demo-org', 'bd9b27af-c78c-4490-b69e-01624488b420', NULL, '2025-11-23 21:08:41.847365+00', NULL);
INSERT INTO public.rbac_user_org_roles (id, user_id, organization_slug, role_id, assigned_by, assigned_at, expires_at) VALUES ('40394502-4af7-4e21-aea7-37646307e4ee', '493101fa-8892-4de4-a0f9-daf43afdca1f', 'demo-org', '8854d99f-9c5b-4805-afe2-0ee6ca8261e2', NULL, '2025-11-23 21:08:41.847365+00', NULL);
INSERT INTO public.rbac_user_org_roles (id, user_id, organization_slug, role_id, assigned_by, assigned_at, expires_at) VALUES ('02623b93-f77b-436c-8687-2dc18f666f50', '618f3960-a8be-4c67-855f-aae4130699b8', 'orchestratorai', 'c4f9a1ab-18bf-4622-a793-ff69ac071519', NULL, '2025-11-23 22:08:53.12629+00', NULL);
INSERT INTO public.rbac_user_org_roles (id, user_id, organization_slug, role_id, assigned_by, assigned_at, expires_at) VALUES ('35f4c2dd-b237-4389-bde2-b6bf8d8c0230', '618f3960-a8be-4c67-855f-aae4130699b8', 'demo-org', 'c4f9a1ab-18bf-4622-a793-ff69ac071519', NULL, '2025-11-23 22:08:53.12629+00', NULL);


ALTER TABLE public.rbac_user_org_roles ENABLE TRIGGER ALL;

--
-- PostgreSQL database dump complete
--

\unrestrict a4VB5zJiHEGzu9W9gJt9sFjVPB08iAJKbgdPnN8OSHD7rB2HzrAo0up5THDfIzY

--
-- PostgreSQL database dump
--

\restrict UDSaT2HsaKwOJgxTKLRqrPt6lxB4DtnrUJtgdMxg8n7fnrXgplBLd5yn7Niu3zU

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
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: -
--

SET SESSION AUTHORIZATION DEFAULT;

ALTER TABLE public.system_settings DISABLE TRIGGER ALL;

INSERT INTO public.system_settings (key, value, description, created_at, updated_at) VALUES ('model_config_global', '{"model": "llama3.2:1b", "provider": "ollama", "parameters": {"maxTokens": 8000, "temperature": 0.7}}', 'Global default LLM model configuration. Used when no user preference is set.', '2025-12-01 13:33:09.06527+00', '2025-12-01 13:33:09.06527+00');


ALTER TABLE public.system_settings ENABLE TRIGGER ALL;

--
-- PostgreSQL database dump complete
--

\unrestrict UDSaT2HsaKwOJgxTKLRqrPt6lxB4DtnrUJtgdMxg8n7fnrXgplBLd5yn7Niu3zU

--
-- PostgreSQL database dump
--

\restrict t7U13btXaQ5vgRpOfLNZifltWeECKGemvtThNyCKWWpa6RLPFELCein14H4NdnZ

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
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: -
--

SET SESSION AUTHORIZATION DEFAULT;

ALTER TABLE auth.users DISABLE TRIGGER ALL;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) VALUES ('00000000-0000-0000-0000-000000000000', '739b2b8b-0bb1-4894-b5ba-8698c8cd071a', 'authenticated', 'authenticated', 'admin@orchestratorai.io', '$2a$10$IaAmRqq3qRIVivhEZigCdeveOyMKild.R4/RraUviFv4k1ZzsBycq', '2025-11-23 21:08:01.537107+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-12-01 23:16:18.114918+00', '{"provider": "email", "providers": ["email"]}', '{"display_name": "Admin User"}', NULL, '2025-11-23 21:08:01.537107+00', '2025-12-01 23:16:18.117028+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) VALUES ('00000000-0000-0000-0000-000000000000', '493101fa-8892-4de4-a0f9-daf43afdca1f', 'authenticated', 'authenticated', 'demo.user@orchestratorai.io', '$2a$10$RscEkjI.9XUDP1jtwFCHReD6pBAXyH7UECSUYoy2JBcKMxck62XFi', '2025-11-23 21:08:01.537107+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-12-02 13:15:21.516136+00', '{"provider": "email", "providers": ["email"]}', '{"display_name": "Demo User"}', NULL, '2025-11-23 21:08:01.537107+00', '2025-12-02 13:15:21.517592+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) VALUES ('00000000-0000-0000-0000-000000000000', '618f3960-a8be-4c67-855f-aae4130699b8', 'authenticated', 'authenticated', 'golfergeek@orchestratorai.io', '$2a$06$HWTSCjJieTzGzakSJKlJk.6vYFBOskSgbDOaEUqtqIZiQIRVEkhjm', '2025-11-23 21:08:01.537107+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-12-02 02:36:52.352857+00', '{"provider": "email", "providers": ["email"]}', '{"display_name": "GolferGeek"}', NULL, '2025-11-23 21:08:01.537107+00', '2025-12-03 12:10:52.700238+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


ALTER TABLE auth.users ENABLE TRIGGER ALL;

--
-- PostgreSQL database dump complete
--

\unrestrict t7U13btXaQ5vgRpOfLNZifltWeECKGemvtThNyCKWWpa6RLPFELCein14H4NdnZ

--
-- PostgreSQL database dump
--

\restrict 71Na6gV4IQ5xTlZYtHy0k4NW5twFiLhfTDDs0MEHgvfd4iJoNrsoSbljd3HTqBS

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
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: -
--

SET SESSION AUTHORIZATION DEFAULT;

ALTER TABLE auth.identities DISABLE TRIGGER ALL;



ALTER TABLE auth.identities ENABLE TRIGGER ALL;

--
-- PostgreSQL database dump complete
--

\unrestrict 71Na6gV4IQ5xTlZYtHy0k4NW5twFiLhfTDDs0MEHgvfd4iJoNrsoSbljd3HTqBS


-- Re-enable triggers
SET session_replication_role = DEFAULT;
