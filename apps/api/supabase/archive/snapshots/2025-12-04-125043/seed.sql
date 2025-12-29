-- Intern Database Seed Data
-- Complete setup for new developers
-- Generated: 2025-12-04 18:50:43 UTC
-- 
-- Includes:
--   - auth.users (all authentication users)
--   - public.users (all user records with values)
--   - public.llm_providers (all providers)
--   - public.llm_models (all models)
--   - public.organizations (organization structure)
--   - public.agents (all agent configurations)
--   - public.rbac_* (all RBAC tables)
--   - public.pseudonym_dictionaries (PII handling)
--   - public.redaction_patterns (PII patterns)
--   - public.system_settings (global configuration)
--   - public.organization_credentials (if any)
--
-- Disable triggers during import for speed
SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

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

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) VALUES ('00000000-0000-0000-0000-000000000000', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'authenticated', 'authenticated', 'admin@orchestratorai.io', '$2a$06$M40tadYZqPNpdspfzoJef.VXKwZn2919vkslDzYGS3k8RqZSNmLoC', '2025-10-09 19:28:38.352108+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-10-13 18:08:52.540281+00', NULL, NULL, NULL, '2025-10-09 19:28:38.352108+00', '2025-10-13 19:59:33.483214+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) VALUES ('00000000-0000-0000-0000-000000000000', 'b29a590e-b07f-49df-a25b-574c956b5035', 'authenticated', 'authenticated', 'demo.user@orchestratorai.io', '$2a$06$/tZEUx6gny/QngjIKoipSOeV38ng5ODmrOPNl5UqBZzpFci8XU6Lm', '2025-10-09 19:18:09.981049+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-11-11 19:03:53.699213+00', NULL, NULL, NULL, '2025-10-09 19:18:09.981049+00', '2025-11-11 19:03:53.703694+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) VALUES ('00000000-0000-0000-0000-000000000000', 'c4d5e6f7-8901-2345-6789-abcdef012345', 'authenticated', 'authenticated', 'golfergeek@orchestratorai.io', '$2a$06$NB.M8iX6siiAjTcCGdqevOqO6Xj1eicVIZ/I1cgwlGWDMUqTMxMNm', '2025-10-09 19:28:38.352108+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-12-04 17:54:31.809537+00', NULL, NULL, NULL, '2025-10-09 19:28:38.352108+00', '2025-12-04 17:54:31.810873+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


ALTER TABLE auth.users ENABLE TRIGGER ALL;

--
-- PostgreSQL database dump complete
--

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

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

INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id) VALUES ('c4d5e6f7-8901-2345-6789-abcdef012345', 'c4d5e6f7-8901-2345-6789-abcdef012345', '{"sub": "c4d5e6f7-8901-2345-6789-abcdef012345", "email": "golfergeek@orchestratorai.io"}', 'email', NULL, '2025-10-09 19:28:38.352108+00', '2025-10-09 19:28:38.352108+00', '165ba56d-bed9-45ef-8dd0-1ad7d53829ad');
INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id) VALUES ('b29a590e-b07f-49df-a25b-574c956b5035', 'b29a590e-b07f-49df-a25b-574c956b5035', '{"sub": "b29a590e-b07f-49df-a25b-574c956b5035", "email": "demo.user@orchestratorai.io"}', 'email', NULL, '2025-10-09 19:18:09.981049+00', '2025-10-10 13:38:15.147052+00', '9c14dea1-ee7b-48c6-a5c7-af91d1c7e554');
INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id) VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '{"sub": "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "email": "admin@orchestratorai.io"}', 'email', NULL, '2025-10-09 19:28:38.352108+00', '2025-10-13 19:59:33.483214+00', '6831f50d-0a98-46ac-8fa5-fb92ace01bf1');


ALTER TABLE auth.identities ENABLE TRIGGER ALL;

--
-- PostgreSQL database dump complete
--

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

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

INSERT INTO public.organizations (slug, name, description, url, settings, created_at, updated_at) VALUES ('demo-org', 'Demo Organization', 'Default demonstration organization for Orchestrator AI v2-start', 'https://orchestratorai.io', '{"theme": "light", "features": ["context-agents", "api-agents", "external-agents"]}', '2025-11-21 20:41:50.728755+00', '2025-12-03 02:36:51.207659+00');
INSERT INTO public.organizations (slug, name, description, url, settings, created_at, updated_at) VALUES ('orchestratorai', 'OrchestratorAI', 'Main Orchestrator AI organization', 'https://orchestratorai.io', '{}', '2025-12-03 02:34:13.411277+00', '2025-12-03 02:36:51.207659+00');
INSERT INTO public.organizations (slug, name, description, url, settings, created_at, updated_at) VALUES ('golfergeek', 'GolferGeek', 'GolferGeek development organization', NULL, '{}', '2025-12-03 02:34:13.411277+00', '2025-12-03 02:36:51.207659+00');
INSERT INTO public.organizations (slug, name, description, url, settings, created_at, updated_at) VALUES ('hiverarchy', 'Hiverarchy', 'Hiverarchy partner organization', NULL, '{}', '2025-12-03 02:34:13.411277+00', '2025-12-03 02:36:51.207659+00');


ALTER TABLE public.organizations ENABLE TRIGGER ALL;

--
-- PostgreSQL database dump complete
--

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

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

INSERT INTO public.llm_providers (name, display_name, api_base_url, configuration_json, is_active, created_at, updated_at, is_local) VALUES ('openai', 'OpenAI', 'https://api.openai.com/v1', '{"timeout": 30, "max_retries": 3}', true, '2025-10-12 18:39:12.714052+00', '2025-10-12 18:39:12.714052+00', false);
INSERT INTO public.llm_providers (name, display_name, api_base_url, configuration_json, is_active, created_at, updated_at, is_local) VALUES ('google', 'Google Gemini', 'https://generativelanguage.googleapis.com/v1', '{"timeout": 30, "max_retries": 3}', true, '2025-10-12 18:39:12.714052+00', '2025-10-12 18:39:12.714052+00', false);
INSERT INTO public.llm_providers (name, display_name, api_base_url, configuration_json, is_active, created_at, updated_at, is_local) VALUES ('anthropic', 'Anthropic Claude', 'https://api.anthropic.com/v1', '{"timeout": 30, "max_retries": 3}', true, '2025-10-12 18:39:12.714052+00', '2025-10-12 18:39:12.714052+00', false);
INSERT INTO public.llm_providers (name, display_name, api_base_url, configuration_json, is_active, created_at, updated_at, is_local) VALUES ('grok', 'Grok (xAI)', 'https://api.xai.com', '{"timeout": 30, "max_retries": 3}', true, '2025-10-12 18:39:12.714052+00', '2025-10-12 18:39:12.714052+00', false);
INSERT INTO public.llm_providers (name, display_name, api_base_url, configuration_json, is_active, created_at, updated_at, is_local) VALUES ('ollama', 'Ollama', 'http://localhost:11434', '{"local": true, "timeout": 30, "max_retries": 3}', true, '2025-10-12 18:39:12.714052+00', '2025-12-04 12:57:52.68547+00', true);


ALTER TABLE public.llm_providers ENABLE TRIGGER ALL;

--
-- PostgreSQL database dump complete
--

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

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

INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gpt-5', 'openai', 'GPT-5', 'text-generation', NULL, 128000, 8192, '{}', '{}', '[]', 'fast-thinking', 'medium', 5, false, false, true, NULL, '2025-10-12 18:39:12.714052+00', '2025-10-12 18:39:12.714052+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('o4-mini', 'openai', 'o4-mini', 'text-generation', NULL, 32000, 8192, '{}', '{}', '[]', 'general', 'medium', 5, false, false, true, NULL, '2025-10-12 18:39:12.714052+00', '2025-10-12 18:39:12.714052+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('o1-mini', 'openai', 'o1-mini', 'text-generation', NULL, 8000, 2048, '{}', '{}', '[]', 'ultra-fast', 'medium', 5, false, false, true, NULL, '2025-10-12 18:39:12.714052+00', '2025-10-12 18:39:12.714052+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gemini-2.5-pro', 'google', 'Gemini 2.5 Pro', 'text-generation', NULL, 1000000, 8192, '{}', '{}', '[]', 'fast-thinking', 'medium', 5, false, false, true, NULL, '2025-10-12 18:39:12.714052+00', '2025-10-12 18:39:12.714052+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gemini-2.5-flash', 'google', 'Gemini 2.5 Flash', 'text-generation', NULL, 1000000, 8192, '{}', '{}', '[]', 'ultra-fast', 'medium', 5, false, false, true, NULL, '2025-10-12 18:39:12.714052+00', '2025-10-12 18:39:12.714052+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gemini-2.0-pro', 'google', 'Gemini 2.0 Pro', 'text-generation', NULL, 1000000, 8192, '{}', '{}', '[]', 'general', 'medium', 5, false, false, true, NULL, '2025-10-12 18:39:12.714052+00', '2025-10-12 18:39:12.714052+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('claude-opus-4-1-20250805', 'anthropic', 'Claude Opus 4.1', 'text-generation', NULL, 200000, 8192, '{}', '{"input_cost_per_token": 0.000015, "output_cost_per_token": 0.000075}', '["function_calling", "streaming", "vision", "coding", "reasoning", "agentic"]', 'fast-thinking', 'medium', 5, false, false, true, NULL, '2025-10-12 18:39:12.714052+00', '2025-10-12 18:39:12.714052+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('claude-sonnet-4-20250514', 'anthropic', 'Claude Sonnet 4', 'text-generation', NULL, 200000, 64000, '{}', '{"input_cost_per_token": 0.000003, "output_cost_per_token": 0.000015}', '["function_calling", "streaming", "vision", "balanced", "high_output"]', 'general', 'medium', 5, false, false, true, NULL, '2025-10-12 18:39:12.714052+00', '2025-10-12 18:39:12.714052+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('grok-4', 'grok', 'Grok 4', 'text-generation', NULL, 128000, 8192, '{}', '{"api_pricing": "custom", "monthly_cost": 40, "subscription_tier": "SuperGrok"}', '["function_calling", "streaming", "tool_use", "real_time_search", "multimodal"]', 'fast-thinking', 'medium', 5, false, false, true, NULL, '2025-10-12 18:39:12.714052+00', '2025-10-12 18:39:12.714052+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('grok-4-heavy', 'grok', 'Grok 4 Heavy', 'text-generation', NULL, 256000, 8192, '{}', '{"api_pricing": "custom", "monthly_cost": 120, "subscription_tier": "SuperGrok Heavy"}', '["function_calling", "streaming", "tool_use", "max_accuracy", "enterprise"]', 'fast-thinking', 'medium', 5, false, false, true, NULL, '2025-10-12 18:39:12.714052+00', '2025-10-12 18:39:12.714052+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('grok-3', 'grok', 'Grok 3', 'text-generation', NULL, 128000, 8192, '{}', '{"api_pricing": "custom", "monthly_cost": 20, "subscription_tier": "Standard Grok"}', '["streaming", "reasoning", "think_mode"]', 'general', 'medium', 5, false, false, true, NULL, '2025-10-12 18:39:12.714052+00', '2025-10-12 18:39:12.714052+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('grok-3-mini', 'grok', 'Grok 3 mini', 'text-generation', NULL, 64000, 4096, '{}', '{"api_pricing": "low_cost", "subscription_tier": "included"}', '["streaming", "fast", "lower_accuracy"]', 'ultra-fast', 'medium', 5, false, false, true, NULL, '2025-10-12 18:39:12.714052+00', '2025-10-12 18:39:12.714052+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('grok-code-fast-1', 'grok', 'Grok Code Fast 1', 'text-generation', NULL, 256000, 8192, '{}', '{"pricing": "custom", "api_only": true, "specialized": "coding"}', '["function_calling", "tool_use", "coding", "ide_integration", "agentic"]', 'general', 'medium', 5, false, false, true, NULL, '2025-10-12 18:39:12.714052+00', '2025-10-12 18:39:12.714052+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('phi3.5:latest', 'ollama', 'Phi 3.5 Latest', 'text-generation', NULL, 32000, 4096, '{}', '{"cost": 0, "local": true}', '["streaming", "local", "efficient"]', 'ultra-fast', 'medium', 6, true, false, true, NULL, '2025-10-12 18:39:12.714052+00', '2025-10-12 18:39:12.714052+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('claude-3-5-sonnet-20241022', 'anthropic', 'Claude 3.5 Sonnet', 'text-generation', NULL, 200000, 8192, '{}', '{"input_cost_per_token": 0.000003, "output_cost_per_token": 0.000015}', '["function_calling", "streaming", "balanced", "reasoning"]', 'general', 'fast', 5, false, false, true, NULL, '2025-10-12 18:39:12.714052+00', '2025-12-03 02:36:51.216452+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('claude-3-5-haiku-20241022', 'anthropic', 'Claude 3.5 Haiku', 'text-generation', NULL, 200000, 8192, '{}', '{"input_cost_per_token": 0.0008, "output_cost_per_token": 0.004}', '["streaming", "fast", "low_latency", "cost_effective"]', 'ultra-fast', 'very-fast', 5, false, false, true, NULL, '2025-10-12 18:39:12.714052+00', '2025-12-03 02:36:51.216452+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('o1-preview', 'openai', 'o1 Preview', 'text-generation', NULL, 16000, 4096, '{}', '{}', '[]', 'general', 'slow', 5, false, false, true, NULL, '2025-10-12 18:39:12.714052+00', '2025-12-03 02:36:51.218655+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gemini-2.0-flash', 'google', 'Gemini 2.0 Flash', 'text-generation', NULL, 1048576, 8192, '{}', '{}', '[]', 'general', 'very-fast', 5, false, false, true, NULL, '2025-10-12 18:39:12.714052+00', '2025-12-03 02:36:51.219772+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('llama3.2:latest', 'ollama', 'Llama 3.2 Latest', 'text-generation', NULL, 128000, 4096, '{}', '{"cost": 0, "local": true}', '["streaming", "local", "open_source"]', 'general', 'fast', 8, true, true, true, NULL, '2025-10-12 18:39:12.714052+00', '2025-12-03 02:36:51.21541+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('qwen3:8b', 'ollama', 'Qwen 3 8B', 'text-generation', NULL, 32000, 4096, '{}', '{"cost": 0, "local": true}', '["streaming", "local", "multilingual", "efficient"]', 'general', 'fast', 7, true, true, true, NULL, '2025-10-12 18:39:12.714052+00', '2025-12-03 02:36:51.21541+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('deepseek-r1:latest', 'ollama', 'DeepSeek R1', 'text-generation', NULL, 64000, 4096, '{}', '{"cost": 0, "local": true}', '["streaming", "local", "reasoning", "coding"]', 'fast-thinking', 'medium', 9, true, true, true, NULL, '2025-10-12 18:39:12.714052+00', '2025-12-03 02:36:51.21541+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('qwq:latest', 'ollama', 'QwQ', 'text-generation', NULL, 32000, 4096, '{}', '{"cost": 0, "local": true}', '["streaming", "local", "reasoning"]', 'general', 'medium', 5, true, true, true, NULL, '2025-10-12 18:39:12.714052+00', '2025-12-03 02:36:51.21541+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gpt-oss:20b', 'ollama', 'GPT-OSS 20B', 'text-generation', NULL, 32000, 4096, '{}', '{"cost": 0, "local": true}', '["streaming", "local", "open_source", "efficient"]', 'ultra-fast', 'medium', 8, true, true, true, NULL, '2025-10-12 18:39:12.714052+00', '2025-12-03 02:36:51.21541+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('llama3.2:1b', 'ollama', 'Llama 3.2 1B', 'text-generation', NULL, 8192, 4096, '{}', '{}', '[]', NULL, 'very-fast', 5, true, true, true, NULL, '2025-12-03 02:34:13.424255+00', '2025-12-03 02:36:51.21541+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('llama3.2:3b', 'ollama', 'Llama 3.2 3B', 'text-generation', NULL, 8192, 4096, '{}', '{}', '[]', NULL, 'very-fast', 5, true, true, true, NULL, '2025-12-03 02:34:13.424255+00', '2025-12-03 02:36:51.21541+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('nomic-embed-text:latest', 'ollama', 'Nomic Embed Text', 'embedding', NULL, 8192, 768, '{}', '{}', '[]', NULL, 'fast', 5, true, true, true, NULL, '2025-12-03 02:34:13.424255+00', '2025-12-03 02:36:51.21541+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('claude-sonnet-4-5-20250514', 'anthropic', 'Claude Sonnet 4.5', 'text-generation', NULL, 200000, 8192, '{}', '{}', '[]', NULL, 'fast', 5, false, false, true, NULL, '2025-12-03 02:34:13.426282+00', '2025-12-03 02:36:51.216452+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('claude-3-opus-20240229', 'anthropic', 'Claude 3 Opus', 'text-generation', NULL, 200000, 4096, '{}', '{}', '[]', NULL, 'slow', 5, false, false, true, NULL, '2025-12-03 02:34:13.426282+00', '2025-12-03 02:36:51.216452+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gpt-4o', 'openai', 'GPT-4o', 'text-generation', NULL, 128000, 4096, '{}', '{}', '[]', NULL, 'fast', 5, false, false, true, NULL, '2025-12-03 02:34:13.427089+00', '2025-12-03 02:36:51.218655+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gpt-4o-mini', 'openai', 'GPT-4o Mini', 'text-generation', NULL, 128000, 4096, '{}', '{}', '[]', NULL, 'very-fast', 5, false, false, true, NULL, '2025-12-03 02:34:13.427089+00', '2025-12-03 02:36:51.218655+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gpt-4-turbo', 'openai', 'GPT-4 Turbo', 'text-generation', NULL, 128000, 4096, '{}', '{}', '[]', NULL, 'medium', 5, false, false, true, NULL, '2025-12-03 02:34:13.427089+00', '2025-12-03 02:36:51.218655+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gemini-1.5-pro', 'google', 'Gemini 1.5 Pro', 'text-generation', NULL, 2000000, 8192, '{}', '{}', '[]', NULL, 'fast', 5, false, false, true, NULL, '2025-12-03 02:34:13.428104+00', '2025-12-03 02:36:51.219772+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gemini-1.5-flash', 'google', 'Gemini 1.5 Flash', 'text-generation', NULL, 1000000, 8192, '{}', '{}', '[]', NULL, 'very-fast', 5, false, false, true, NULL, '2025-12-03 02:34:13.428104+00', '2025-12-03 02:36:51.219772+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gpt-4.1', 'openai', 'GPT-4.1', 'text-generation', NULL, 1000000, 32768, '{}', '{}', '["chat", "code", "analysis", "vision"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.215705+00', '2025-11-23 21:26:34.215705+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gpt-4.1-mini', 'openai', 'GPT-4.1 Mini', 'text-generation', NULL, 1000000, 32768, '{}', '{}', '["chat", "code", "analysis"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.215705+00', '2025-11-23 21:26:34.215705+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gpt-4.1-nano', 'openai', 'GPT-4.1 Nano', 'text-generation', NULL, 1000000, 32768, '{}', '{}', '["chat", "code"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.215705+00', '2025-11-23 21:26:34.215705+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('o3', 'openai', 'o3', 'text-generation', NULL, 200000, 100000, '{}', '{}', '["chat", "reasoning", "code", "analysis"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.215705+00', '2025-11-23 21:26:34.215705+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('o3-pro', 'openai', 'o3 Pro', 'text-generation', NULL, 200000, 100000, '{}', '{}', '["chat", "reasoning", "code", "analysis"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.215705+00', '2025-11-23 21:26:34.215705+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('o1', 'openai', 'o1', 'text-generation', NULL, 200000, 100000, '{}', '{}', '["chat", "reasoning", "code"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.215705+00', '2025-11-23 21:26:34.215705+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('text-embedding-3-large', 'openai', 'Text Embedding 3 Large', 'embedding', NULL, 8191, 0, '{}', '{}', '["embedding"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.215705+00', '2025-11-23 21:26:34.215705+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('text-embedding-3-small', 'openai', 'Text Embedding 3 Small', 'embedding', NULL, 8191, 0, '{}', '{}', '["embedding"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.215705+00', '2025-11-23 21:26:34.215705+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gemini-3.0-pro', 'google', 'Gemini 3.0 Pro', 'text-generation', NULL, 2000000, 8192, '{}', '{}', '["chat", "code", "analysis", "vision"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.216825+00', '2025-11-23 21:26:34.216825+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gemini-3.0-deep-think', 'google', 'Gemini 3.0 Deep Think', 'text-generation', NULL, 2000000, 8192, '{}', '{}', '["chat", "reasoning", "code", "analysis"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.216825+00', '2025-11-23 21:26:34.216825+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('gemini-2.5-flash-lite', 'google', 'Gemini 2.5 Flash Lite', 'text-generation', NULL, 1000000, 8192, '{}', '{}', '["chat", "code"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.216825+00', '2025-11-23 21:26:34.216825+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('claude-sonnet-4-5-20250929', 'anthropic', 'Claude Sonnet 4.5', 'text-generation', NULL, 200000, 8192, '{}', '{}', '["chat", "code", "analysis", "vision", "computer-use"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.217245+00', '2025-11-23 21:26:34.217245+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('claude-haiku-4-5-20251015', 'anthropic', 'Claude Haiku 4.5', 'text-generation', NULL, 200000, 8192, '{}', '{}', '["chat", "code", "analysis", "computer-use"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.217245+00', '2025-11-23 21:26:34.217245+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('claude-opus-4-20250514', 'anthropic', 'Claude Opus 4', 'text-generation', NULL, 200000, 8192, '{}', '{}', '["chat", "code", "analysis", "vision", "agents"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.217245+00', '2025-11-23 21:26:34.217245+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('grok-4.1', 'grok', 'Grok 4.1', 'text-generation', NULL, 2000000, 16384, '{}', '{}', '["chat", "code", "analysis", "reasoning"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.217639+00', '2025-11-23 21:26:34.217639+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('grok-4-fast', 'grok', 'Grok 4 Fast', 'text-generation', NULL, 2000000, 16384, '{}', '{}', '["chat", "code", "analysis"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.217639+00', '2025-11-23 21:26:34.217639+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('grok-3-reasoning', 'grok', 'Grok 3 Reasoning', 'text-generation', NULL, 1000000, 8192, '{}', '{}', '["chat", "reasoning", "code"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.217639+00', '2025-11-23 21:26:34.217639+00');
INSERT INTO public.llm_models (model_name, provider_name, display_name, model_type, model_version, context_window, max_output_tokens, model_parameters_json, pricing_info_json, capabilities, model_tier, speed_tier, loading_priority, is_local, is_currently_loaded, is_active, training_data_cutoff, created_at, updated_at) VALUES ('grok-2', 'grok', 'Grok 2', 'text-generation', NULL, 131072, 8192, '{}', '{}', '["chat", "code", "analysis"]', NULL, 'medium', 5, false, false, true, NULL, '2025-11-23 21:26:34.217639+00', '2025-11-23 21:26:34.217639+00');


ALTER TABLE public.llm_models ENABLE TRIGGER ALL;

--
-- PostgreSQL database dump complete
--

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

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

INSERT INTO public.system_settings (key, value, updated_at) VALUES ('model_config_global', '{"default": {"model": "llama3.2:3b", "provider": "ollama", "parameters": {"temperature": 0.7}}, "localOnly": {"model": "gpt-oss:20b", "provider": "ollama", "parameters": {"temperature": 0.7}}}', '2025-12-04 16:24:09.198+00');


ALTER TABLE public.system_settings ENABLE TRIGGER ALL;

--
-- PostgreSQL database dump complete
--

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

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

INSERT INTO public.users (id, email, display_name, created_at, updated_at, status, organization_slug) VALUES ('b29a590e-b07f-49df-a25b-574c956b5035', 'demo.user@orchestratorai.io', 'Demo User', '2025-10-12 18:39:12.714052+00', '2025-10-12 18:39:12.714052+00', 'active', NULL);
INSERT INTO public.users (id, email, display_name, created_at, updated_at, status, organization_slug) VALUES ('c4d5e6f7-8901-2345-6789-abcdef012345', 'golfergeek@orchestratorai.io', 'GolferGeek', '2025-10-09 19:28:38.352108+00', '2025-10-09 19:28:38.352108+00', 'active', NULL);
INSERT INTO public.users (id, email, display_name, created_at, updated_at, status, organization_slug) VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'admin@orchestratorai.io', 'Admin', '2025-10-09 19:28:38.352108+00', '2025-10-09 19:28:38.352108+00', 'active', NULL);


ALTER TABLE public.users ENABLE TRIGGER ALL;

--
-- PostgreSQL database dump complete
--

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

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

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

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

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

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

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

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

INSERT INTO public.rbac_user_org_roles (id, user_id, organization_slug, role_id, assigned_by, assigned_at, expires_at) VALUES ('8787ee25-14fb-4fb3-bf0b-d6fa640e695c', '739b2b8b-0bb1-4894-b5ba-8698c8cd071a', 'demo-org', 'bd9b27af-c78c-4490-b69e-01624488b420', NULL, '2025-11-23 21:08:41.847365+00', NULL);
INSERT INTO public.rbac_user_org_roles (id, user_id, organization_slug, role_id, assigned_by, assigned_at, expires_at) VALUES ('40394502-4af7-4e21-aea7-37646307e4ee', '493101fa-8892-4de4-a0f9-daf43afdca1f', 'demo-org', '8854d99f-9c5b-4805-afe2-0ee6ca8261e2', NULL, '2025-11-23 21:08:41.847365+00', NULL);
INSERT INTO public.rbac_user_org_roles (id, user_id, organization_slug, role_id, assigned_by, assigned_at, expires_at) VALUES ('02623b93-f77b-436c-8687-2dc18f666f50', '618f3960-a8be-4c67-855f-aae4130699b8', 'orchestratorai', 'c4f9a1ab-18bf-4622-a793-ff69ac071519', NULL, '2025-11-23 22:08:53.12629+00', NULL);
INSERT INTO public.rbac_user_org_roles (id, user_id, organization_slug, role_id, assigned_by, assigned_at, expires_at) VALUES ('35f4c2dd-b237-4389-bde2-b6bf8d8c0230', '618f3960-a8be-4c67-855f-aae4130699b8', 'demo-org', 'c4f9a1ab-18bf-4622-a793-ff69ac071519', NULL, '2025-11-23 22:08:53.12629+00', NULL);
INSERT INTO public.rbac_user_org_roles (id, user_id, organization_slug, role_id, assigned_by, assigned_at, expires_at) VALUES ('ba179d84-3098-4628-a943-7453255c78c9', 'c4d5e6f7-8901-2345-6789-abcdef012345', 'demo-org', 'c4f9a1ab-18bf-4622-a793-ff69ac071519', NULL, '2025-12-03 03:16:22.866275+00', NULL);
INSERT INTO public.rbac_user_org_roles (id, user_id, organization_slug, role_id, assigned_by, assigned_at, expires_at) VALUES ('1f8a3f88-f66e-41c9-ac53-13e246ec3c26', 'c4d5e6f7-8901-2345-6789-abcdef012345', 'orchestratorai', 'c4f9a1ab-18bf-4622-a793-ff69ac071519', NULL, '2025-12-03 03:16:22.866275+00', NULL);
INSERT INTO public.rbac_user_org_roles (id, user_id, organization_slug, role_id, assigned_by, assigned_at, expires_at) VALUES ('954309b6-f936-4590-906c-1b1872ec205b', 'c4d5e6f7-8901-2345-6789-abcdef012345', 'golfergeek', 'c4f9a1ab-18bf-4622-a793-ff69ac071519', NULL, '2025-12-03 03:16:22.866275+00', NULL);
INSERT INTO public.rbac_user_org_roles (id, user_id, organization_slug, role_id, assigned_by, assigned_at, expires_at) VALUES ('3524ee69-3adb-400a-8a37-2df22c7231d8', 'c4d5e6f7-8901-2345-6789-abcdef012345', 'hiverarchy', 'c4f9a1ab-18bf-4622-a793-ff69ac071519', NULL, '2025-12-03 03:16:22.866275+00', NULL);
INSERT INTO public.rbac_user_org_roles (id, user_id, organization_slug, role_id, assigned_by, assigned_at, expires_at) VALUES ('cfa8ee84-537f-4edf-9836-ff6b7c9e6757', 'c4d5e6f7-8901-2345-6789-abcdef012345', '*', 'c4f9a1ab-18bf-4622-a793-ff69ac071519', NULL, '2025-12-03 13:18:32.89542+00', NULL);


ALTER TABLE public.rbac_user_org_roles ENABLE TRIGGER ALL;

--
-- PostgreSQL database dump complete
--

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

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

INSERT INTO public.agents (id, organization_slug, slug, description, agent_type, version, context, created_at, updated_at, plan_structure, deliverable_structure, io_schema, name, capabilities, department, tags, metadata, endpoint) VALUES ('f9521e73-1886-4983-9243-e5568cf8c7a1', '{demo-org}', 'blog-post-writer', 'AI-powered blog post creation agent that generates high-quality, SEO-optimized content. Supports various tones, lengths, and formats with built-in keyword optimization and readability analysis.', 'context', '1.0.0', '{"input_modes": ["text/plain"], "output_modes": ["text/markdown"]}', '2025-12-03 03:05:44.681397+00', '2025-12-03 13:40:27.370113+00', NULL, NULL, '{"input": {"type": "object", "required": ["topic", "targetAudience"], "properties": {"tone": {"enum": ["professional", "casual", "technical", "conversational", "authoritative"], "type": "string", "default": "professional"}, "topic": {"type": "string", "description": "The main topic or subject of the blog post"}, "length": {"enum": ["short", "medium", "long"], "type": "string", "default": "medium"}, "targetAudience": {"type": "string", "description": "The intended audience for the blog post"}}}, "output": {"type": "object", "required": ["title", "content"], "properties": {"title": {"type": "string", "description": "SEO-optimized blog post title"}, "content": {"type": "string", "description": "Full blog post content in Markdown"}}}}', 'Blog Post Writer', '{content-creation,seo,writing,marketing,blog}', 'marketing', '{}', '{"mode_profile": "autonomous_build", "execution_modes": ["real-time", "polling", "immediate"], "execution_capabilities": {"can_plan": true, "can_build": true, "can_converse": true}}', NULL);
INSERT INTO public.agents (id, organization_slug, slug, description, agent_type, version, context, created_at, updated_at, plan_structure, deliverable_structure, io_schema, name, capabilities, department, tags, metadata, endpoint) VALUES ('b7970fec-7a71-4db8-9703-08c7afa79ffd', '{demo-org}', 'hr-policy-agent', 'AI-powered HR assistant that answers questions about company policies, benefits, procedures, and employee guidelines using the HR knowledge base.', 'rag-runner', '1.0.0', '{"rag_config": {"top_k": 5, "collection_slug": "hr-policy", "similarity_threshold": 0.6}}', '2025-12-03 03:05:44.685753+00', '2025-12-03 13:55:52.133657+00', NULL, NULL, '{"input": {"type": "object", "required": ["question"], "properties": {"question": {"type": "string", "description": "The HR-related question to answer"}}}, "output": {"type": "object", "required": ["message"], "properties": {"message": {"type": "string", "description": "The answer to the HR question"}, "sources": {"type": "array", "items": {"type": "object"}, "description": "Source documents used"}}}}', 'HR Policy Assistant', '{hr-policy-lookup,benefits-information,procedure-guidance,employee-handbook,plan,build}', 'hr', '{}', '{"rag_config": {"top_k": 5, "collection_slug": "hr-policy", "no_access_message": "I do not have access to the HR knowledge base. Please contact HR directly.", "no_results_message": "I could not find information about that in the HR knowledge base. Please contact HR directly for assistance.", "similarity_threshold": 0.6}, "mode_profile": "autonomous_build", "execution_modes": ["real-time", "polling", "immediate"], "execution_capabilities": {"can_plan": true, "can_build": true, "can_converse": true}}', NULL);
INSERT INTO public.agents (id, organization_slug, slug, description, agent_type, version, context, created_at, updated_at, plan_structure, deliverable_structure, io_schema, name, capabilities, department, tags, metadata, endpoint) VALUES ('29abf105-1e31-43ba-8395-56f4c4c793ac', '{demo-org}', 'data-analyst', 'LangGraph-powered data analyst agent that uses natural language to query databases, list tables, describe schemas, and generate SQL queries with comprehensive result summaries.', 'api', '1.0.0', '{"provider": "langgraph", "statusEndpoint": "/data-analyst/status/{threadId}", "historyEndpoint": "/data-analyst/history/{threadId}", "langgraphEndpoint": "http://localhost:6200"}', '2025-12-03 03:05:44.686107+00', '2025-12-03 14:12:57.298784+00', NULL, NULL, '{"input": {"type": "object", "required": ["question"], "properties": {"userId": {"type": "string", "description": "User ID for tracking"}, "question": {"type": "string", "description": "Natural language question about the data"}}}, "output": {"type": "object", "properties": {"status": {"type": "string", "description": "Current status of the analysis"}, "taskId": {"type": "string", "description": "Task ID for the analysis session"}, "summary": {"type": "string", "description": "Natural language summary of the analysis"}}}}', 'Data Analyst', '{database-query,sql-generation,schema-analysis,data-summarization}', 'analytics', '{}', '{"mode_profile": "autonomous_build", "execution_modes": ["real-time", "polling", "immediate"], "execution_capabilities": {"can_plan": true, "can_build": true, "can_converse": true}}', '{"url": "http://localhost:6200/data-analyst/analyze", "method": "POST", "headers": {"Content-Type": "application/json"}, "timeout": 120000, "responseTransform": {"content": "$.data.summary", "metadata": {"status": "$.data.status", "taskId": "$.data.threadId", "queryResults": "$.data.queryResults", "sqlGenerated": "$.data.sqlGenerated", "tablesDiscovered": "$.data.tablesDiscovered"}}}');
INSERT INTO public.agents (id, organization_slug, slug, description, agent_type, version, context, created_at, updated_at, plan_structure, deliverable_structure, io_schema, name, capabilities, department, tags, metadata, endpoint) VALUES ('b107f5ff-5d46-403c-90ba-2dc61366deb0', '{demo-org}', 'extended-post-writer', 'LangGraph-powered HITL agent that generates blog posts, SEO descriptions, and social posts. Pauses for human review before finalizing.', 'api', '1.0.0', '{"provider": "langgraph", "resumeEndpoint": "/extended-post-writer/resume/{threadId}", "statusEndpoint": "/extended-post-writer/status/{threadId}", "historyEndpoint": "/extended-post-writer/history/{threadId}", "langgraphEndpoint": "http://localhost:6200"}', '2025-12-03 03:05:44.686493+00', '2025-12-03 14:16:05.292569+00', NULL, NULL, '{"input": {"type": "object", "required": ["topic"], "properties": {"tone": {"type": "string", "description": "Writing tone"}, "topic": {"type": "string", "description": "Topic for the blog post"}, "targetAudience": {"type": "string", "description": "Target audience"}}}, "output": {"type": "object", "properties": {"status": {"type": "string", "description": "Current status"}, "taskId": {"type": "string", "description": "Task ID for the generation session"}, "content": {"type": "string", "description": "Generated content"}}}}', 'Extended Post Writer', '{blog-post-generation,seo-optimization,social-post-creation,human-in-the-loop}', 'analytics', '{}', '{"mode_profile": "autonomous_build", "execution_modes": ["real-time", "polling", "immediate"], "execution_capabilities": {"can_plan": true, "can_build": true, "can_converse": true}}', '{"url": "http://localhost:6200/extended-post-writer/generate", "method": "POST", "headers": {"Content-Type": "application/json"}, "timeout": 120000, "responseTransform": {"content": "$.data.generatedContent.blogPost", "metadata": {"status": "$.data.status", "taskId": "$.data.threadId", "hitlPending": "$.data.hitlPending", "finalContent": "$.data.finalContent", "generatedContent": "$.data.generatedContent"}}}');


ALTER TABLE public.agents ENABLE TRIGGER ALL;

--
-- PostgreSQL database dump complete
--

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

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
-- Data for Name: pseudonym_dictionaries; Type: TABLE DATA; Schema: public; Owner: -
--

SET SESSION AUTHORIZATION DEFAULT;

ALTER TABLE public.pseudonym_dictionaries DISABLE TRIGGER ALL;

INSERT INTO public.pseudonym_dictionaries (id, original_value, pseudonym, data_type, category, frequency_weight, is_active, created_at, organization_slug, agent_slug, updated_at, value) VALUES ('70483fac-3d77-48b3-bd67-41340d257bc7', 'Orchestrator AI', '@company_orchestrator', 'custom', 'business', 1, true, '2025-10-12 18:39:12.714052+00', NULL, NULL, '2025-10-12 18:39:12.714052+00', NULL);
INSERT INTO public.pseudonym_dictionaries (id, original_value, pseudonym, data_type, category, frequency_weight, is_active, created_at, organization_slug, agent_slug, updated_at, value) VALUES ('8fdc6421-b4f0-4187-ba9e-ce598cc6b96a', 'OrchestratorAI', '@company_orchestratorai', 'custom', 'business', 1, true, '2025-12-04 12:34:20.697903+00', NULL, NULL, '2025-12-04 12:34:20.697903+00', NULL);
INSERT INTO public.pseudonym_dictionaries (id, original_value, pseudonym, data_type, category, frequency_weight, is_active, created_at, organization_slug, agent_slug, updated_at, value) VALUES ('70eff867-319c-4054-9516-870a1659b27c', 'Matt Weber', '@person_matt_weber', 'name', 'person', 1, true, '2025-12-04 12:41:25.294265+00', NULL, NULL, '2025-12-04 12:41:25.294265+00', NULL);
INSERT INTO public.pseudonym_dictionaries (id, original_value, pseudonym, data_type, category, frequency_weight, is_active, created_at, organization_slug, agent_slug, updated_at, value) VALUES ('facf17a2-015e-46e4-b053-35ff1dcdc623', 'Matthew Weber', '@person_matthew_weber', 'name', 'person', 1, true, '2025-12-04 12:41:25.294265+00', NULL, NULL, '2025-12-04 12:41:25.294265+00', NULL);
INSERT INTO public.pseudonym_dictionaries (id, original_value, pseudonym, data_type, category, frequency_weight, is_active, created_at, organization_slug, agent_slug, updated_at, value) VALUES ('b145c7bf-b49a-4a78-86c3-ae176c99c9a8', 'GolferGeek', '@user_golfer', 'username', 'person', 1, true, '2025-12-04 12:47:01.336836+00', NULL, NULL, '2025-12-04 12:47:01.336836+00', NULL);
INSERT INTO public.pseudonym_dictionaries (id, original_value, pseudonym, data_type, category, frequency_weight, is_active, created_at, organization_slug, agent_slug, updated_at, value) VALUES ('a5000def-86a2-4d76-b4de-731fa02243a8', 'GolferGeekKing', '@user_golfergeekking', 'username', 'person', 1, true, '2025-12-04 12:47:01.336836+00', NULL, NULL, '2025-12-04 12:47:01.336836+00', NULL);


ALTER TABLE public.pseudonym_dictionaries ENABLE TRIGGER ALL;

--
-- PostgreSQL database dump complete
--

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

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
-- Data for Name: redaction_patterns; Type: TABLE DATA; Schema: public; Owner: -
--

SET SESSION AUTHORIZATION DEFAULT;

ALTER TABLE public.redaction_patterns DISABLE TRIGGER ALL;

INSERT INTO public.redaction_patterns (id, name, pattern_regex, replacement, description, category, priority, is_active, severity, data_type, created_at, updated_at) VALUES ('ac115de9-c8d7-4cfe-b18f-a82c35c17253', 'Email Address', '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL_REDACTED]', 'Detects email addresses', 'pii_builtin', 20, true, 'flagger', 'email', '2025-12-04 03:09:05.845378+00', '2025-12-04 03:09:05.845378+00');
INSERT INTO public.redaction_patterns (id, name, pattern_regex, replacement, description, category, priority, is_active, severity, data_type, created_at, updated_at) VALUES ('363fccd5-500e-443d-9048-51801676e476', 'Phone - US Format', '\b(\+1[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b', '[PHONE_REDACTED]', 'Detects US phone numbers in various formats', 'pii_builtin', 30, true, 'flagger', 'phone', '2025-12-04 03:09:05.845378+00', '2025-12-04 03:09:05.845378+00');
INSERT INTO public.redaction_patterns (id, name, pattern_regex, replacement, description, category, priority, is_active, severity, data_type, created_at, updated_at) VALUES ('a4d28ba0-a189-4ac2-9abe-aa3d13bb831d', 'IP Address - IPv4', '\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b', '[IP_REDACTED]', 'Detects IPv4 addresses', 'pii_builtin', 40, true, 'flagger', 'ip_address', '2025-12-04 03:09:05.845378+00', '2025-12-04 03:09:05.845378+00');
INSERT INTO public.redaction_patterns (id, name, pattern_regex, replacement, description, category, priority, is_active, severity, data_type, created_at, updated_at) VALUES ('bf9172b3-99aa-42b3-8bf6-f1eef9d09f04', 'SSN - US Social Security Number', '\b\d{3}-\d{2}-\d{4}\b', '[SSN_REDACTED]', 'Detects US Social Security Numbers in XXX-XX-XXXX format', 'pii_builtin', 10, true, 'showstopper', 'ssn', '2025-12-04 03:09:05.845378+00', '2025-12-04 11:03:34.343536+00');
INSERT INTO public.redaction_patterns (id, name, pattern_regex, replacement, description, category, priority, is_active, severity, data_type, created_at, updated_at) VALUES ('fcbb6abd-80b9-4638-a777-0a9cef287424', 'Credit Card - Generic', '\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b', '[CREDIT_CARD_REDACTED]', 'Detects credit card numbers and stuff', 'pii_builtin', 5, true, 'showstopper', 'credit_card', '2025-12-04 03:09:05.845378+00', '2025-12-04 11:04:11.722181+00');


ALTER TABLE public.redaction_patterns ENABLE TRIGGER ALL;

--
-- PostgreSQL database dump complete
--


-- Re-enable triggers
SET session_replication_role = DEFAULT;
