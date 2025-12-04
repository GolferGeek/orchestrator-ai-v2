-- Database Snapshot for Intern Setup
-- Generated: 2025-12-04 18:52:06 UTC
-- Schemas: public, rag_data, company_data, n8n_data, langgraph
--
-- WARNING: This will DROP and recreate schemas (except public)
-- All data in these schemas will be deleted!

-- Cleanup existing schemas (WARNING: This will delete all data!)
DROP SCHEMA IF EXISTS langgraph CASCADE;
DROP SCHEMA IF EXISTS n8n_data CASCADE;
DROP SCHEMA IF EXISTS company_data CASCADE;
DROP SCHEMA IF EXISTS rag_data CASCADE;
-- Note: public schema is not dropped as it's required by PostgreSQL

-- Recreate schemas
CREATE SCHEMA IF NOT EXISTS rag_data;
CREATE SCHEMA IF NOT EXISTS company_data;
CREATE SCHEMA IF NOT EXISTS n8n_data;
CREATE SCHEMA IF NOT EXISTS langgraph;

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
-- Name: company_data; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA company_data;


--
-- Name: SCHEMA company_data; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA company_data IS 'Company-specific structured data for agents to query';


--
-- Name: langgraph; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA langgraph;


--
-- Name: SCHEMA langgraph; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA langgraph IS 'LangGraph checkpoint persistence schema';


--
-- Name: n8n_data; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA n8n_data;


--
-- Name: SCHEMA n8n_data; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA n8n_data IS 'N8n workflow data and execution history';


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: rag_data; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA rag_data;


--
-- Name: SCHEMA rag_data; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA rag_data IS 'RAG collections, documents, chunks, and vector embeddings';


--
-- Name: calculate_completion_percentage(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_completion_percentage(requirements jsonb) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    total_fields INTEGER := 12;  -- Total required fields
    completed_fields INTEGER := 0;
    field_name TEXT;
BEGIN
    -- Count non-null, non-empty required fields
    FOR field_name IN SELECT * FROM jsonb_object_keys(requirements)
    LOOP
        IF requirements ->> field_name IS NOT NULL 
           AND LENGTH(TRIM(requirements ->> field_name)) > 0 THEN
            completed_fields := completed_fields + 1;
        END IF;
    END LOOP;
    
    RETURN (completed_fields * 100 / total_fields);
END;
$$;


--
-- Name: cleanup_abandoned_conversations(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_abandoned_conversations() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete conversations abandoned for more than 7 days
    DELETE FROM agent_creation_conversations
    WHERE completion_status = 'in_progress'
      AND last_activity_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


--
-- Name: cleanup_old_jokes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_jokes() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM jokes_agent 
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;


--
-- Name: cleanup_old_observability_events(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_observability_events(days_to_keep integer DEFAULT 90) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.observability_events
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;


--
-- Name: FUNCTION cleanup_old_observability_events(days_to_keep integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cleanup_old_observability_events(days_to_keep integer) IS 'Optional cleanup function to delete events older than specified days. Not scheduled by default.';


--
-- Name: exec_sql(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.exec_sql(query text DEFAULT NULL::text, sql_query text DEFAULT NULL::text) RETURNS SETOF jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  q text := coalesce(query, sql_query);
  r record;
begin
  if q is null or length(trim(q)) = 0 then
    raise exception 'No SQL provided to exec_sql()';
  end if;

  -- Execute the query and stream rows as JSONB
  for r in execute q loop
    return next to_jsonb(r);
  end loop;
  return;

exception when others then
  -- Return a single JSON object describing the error (so callers get structured feedback)
  return query select jsonb_build_object(
    'error', true,
    'message', sqlerrm,
    'code', sqlstate
  );
end;
$$;


--
-- Name: get_global_model_config(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_global_model_config() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  -- First try to get from system_settings table
  -- If not found, return a fallback default (Ollama/llama3.2:1b)
  SELECT COALESCE(
    (SELECT value FROM public.system_settings WHERE key = 'model_config_global'),
    jsonb_build_object(
      'provider', 'ollama',
      'model', 'llama3.2:1b',
      'parameters', jsonb_build_object(
        'temperature', 0.7,
        'maxTokens', 8000
      )
    )
  );
$$;


--
-- Name: log_agent_action(character varying, uuid, jsonb, jsonb, jsonb, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_agent_action(p_action character varying, p_agent_id uuid, p_details jsonb DEFAULT '{}'::jsonb, p_previous_state jsonb DEFAULT NULL::jsonb, p_new_state jsonb DEFAULT NULL::jsonb, p_success boolean DEFAULT true, p_error_message text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO agent_creation_logs (
        action, agent_configuration_id, performed_by, details,
        previous_state, new_state, success, error_message
    ) VALUES (
        p_action, p_agent_id, auth.uid(), p_details,
        p_previous_state, p_new_state, p_success, p_error_message
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$;


--
-- Name: FUNCTION log_agent_action(p_action character varying, p_agent_id uuid, p_details jsonb, p_previous_state jsonb, p_new_state jsonb, p_success boolean, p_error_message text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.log_agent_action(p_action character varying, p_agent_id uuid, p_details jsonb, p_previous_state jsonb, p_new_state jsonb, p_success boolean, p_error_message text) IS 'Helper function to create audit log entries';


--
-- Name: rag_delete_collection(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rag_delete_collection(p_collection_id uuid, p_organization_slug text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM rag_collections
    WHERE id = p_collection_id
      AND organization_slug = p_organization_slug;
    RETURN FOUND;
END;
$$;


--
-- Name: rag_delete_document(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rag_delete_document(p_document_id uuid, p_organization_slug text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_collection_id UUID;
    v_chunk_count INTEGER;
BEGIN
    -- Get collection and chunk count before delete
    SELECT collection_id, chunk_count INTO v_collection_id, v_chunk_count
    FROM rag_documents
    WHERE id = p_document_id AND organization_slug = p_organization_slug;

    IF v_collection_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Delete document (chunks deleted via CASCADE)
    DELETE FROM rag_documents
    WHERE id = p_document_id AND organization_slug = p_organization_slug;

    -- Update collection stats
    UPDATE rag_collections
    SET document_count = document_count - 1,
        chunk_count = chunk_count - COALESCE(v_chunk_count, 0),
        updated_at = NOW()
    WHERE id = v_collection_id;

    RETURN TRUE;
END;
$$;


--
-- Name: rag_insert_chunks(uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rag_insert_chunks(p_document_id uuid, p_organization_slug text, p_chunks jsonb) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_collection_id UUID;
    v_inserted INTEGER := 0;
    v_total_tokens INTEGER := 0;
    v_chunk JSONB;
BEGIN
    -- Get collection_id and verify org ownership
    SELECT d.collection_id INTO v_collection_id
    FROM rag_documents d
    JOIN rag_collections c ON d.collection_id = c.id
    WHERE d.id = p_document_id
      AND c.organization_slug = p_organization_slug;

    IF v_collection_id IS NULL THEN
        RETURN 0;
    END IF;

    -- Insert all chunks
    FOR v_chunk IN SELECT * FROM jsonb_array_elements(p_chunks)
    LOOP
        INSERT INTO rag_document_chunks (
            document_id, collection_id, organization_slug, content, chunk_index,
            embedding, token_count, page_number, char_offset, metadata
        )
        VALUES (
            p_document_id,
            v_collection_id,
            p_organization_slug,
            v_chunk->>'content',
            (v_chunk->>'chunk_index')::INTEGER,
            CASE
                WHEN v_chunk ? 'embedding' AND v_chunk->>'embedding' IS NOT NULL
                THEN (v_chunk->>'embedding')::vector
                ELSE NULL
            END,
            COALESCE((v_chunk->>'token_count')::INTEGER, 0),
            (v_chunk->>'page_number')::INTEGER,
            (v_chunk->>'char_offset')::INTEGER,
            COALESCE(v_chunk->'metadata', '{}'::JSONB)
        );
        v_inserted := v_inserted + 1;
        v_total_tokens := v_total_tokens + COALESCE((v_chunk->>'token_count')::INTEGER, 0);
    END LOOP;

    -- Update document stats
    UPDATE rag_documents
    SET chunk_count = v_inserted,
        token_count = v_total_tokens,
        status = 'completed',
        processed_at = NOW()
    WHERE id = p_document_id;

    -- Update collection stats
    UPDATE rag_collections
    SET chunk_count = chunk_count + v_inserted,
        document_count = document_count + 1,
        total_tokens = total_tokens + v_total_tokens,
        updated_at = NOW()
    WHERE id = v_collection_id;

    RETURN v_inserted;
END;
$$;


--
-- Name: rag_user_can_access_collection(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rag_user_can_access_collection(p_collection_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_collection RECORD;
BEGIN
    SELECT allowed_users, created_by
    INTO v_collection
    FROM rag_collections
    WHERE id = p_collection_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- NULL allowed_users = everyone in org can access
    IF v_collection.allowed_users IS NULL THEN
        RETURN TRUE;
    END IF;

    -- User is the creator
    IF v_collection.created_by = p_user_id THEN
        RETURN TRUE;
    END IF;

    -- User is in allowed_users array
    IF p_user_id = ANY(v_collection.allowed_users) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;


--
-- Name: FUNCTION rag_user_can_access_collection(p_collection_id uuid, p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.rag_user_can_access_collection(p_collection_id uuid, p_user_id uuid) IS 'Check if user has access to a collection based on allowed_users or created_by';


--
-- Name: rbac_get_user_organizations(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rbac_get_user_organizations(p_user_id uuid) RETURNS TABLE(organization_slug character varying, organization_name text, role_name character varying, is_global boolean)
    LANGUAGE sql STABLE
    AS $$
    SELECT DISTINCT
        CASE WHEN uor.organization_slug = '*' THEN 'all' ELSE uor.organization_slug END AS organization_slug,
        COALESCE(o.name, 'All Organizations') AS organization_name,
        r.name AS role_name,
        (uor.organization_slug = '*') AS is_global
    FROM rbac_user_org_roles uor
    JOIN rbac_roles r ON uor.role_id = r.id
    LEFT JOIN organizations o ON uor.organization_slug = o.slug
    WHERE uor.user_id = p_user_id
      AND (uor.expires_at IS NULL OR uor.expires_at > NOW())
    ORDER BY is_global DESC, organization_slug;
$$;


--
-- Name: rbac_get_user_permissions(uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rbac_get_user_permissions(p_user_id uuid, p_organization_slug character varying) RETURNS TABLE(permission_name character varying, resource_type character varying, resource_id uuid)
    LANGUAGE sql STABLE
    AS $$
    SELECT DISTINCT
        p.name AS permission_name,
        rp.resource_type,
        rp.resource_id
    FROM rbac_user_org_roles uor
    JOIN rbac_role_permissions rp ON uor.role_id = rp.role_id
    JOIN rbac_permissions p ON rp.permission_id = p.id
    WHERE uor.user_id = p_user_id
      AND (uor.organization_slug = p_organization_slug OR uor.organization_slug = '*')
      AND (uor.expires_at IS NULL OR uor.expires_at > NOW())
    ORDER BY p.name;
$$;


--
-- Name: rbac_get_user_roles(uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rbac_get_user_roles(p_user_id uuid, p_organization_slug character varying) RETURNS TABLE(role_id uuid, role_name character varying, role_display_name character varying, is_global boolean, assigned_at timestamp with time zone, expires_at timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        r.id AS role_id,
        r.name AS role_name,
        r.display_name AS role_display_name,
        (uor.organization_slug = '*') AS is_global,
        uor.assigned_at,
        uor.expires_at
    FROM rbac_user_org_roles uor
    JOIN rbac_roles r ON uor.role_id = r.id
    WHERE uor.user_id = p_user_id
      AND (uor.organization_slug = p_organization_slug OR uor.organization_slug = '*')
      AND (uor.expires_at IS NULL OR uor.expires_at > NOW())
    ORDER BY r.name;
$$;


--
-- Name: rbac_has_permission(uuid, character varying, character varying, character varying, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rbac_has_permission(p_user_id uuid, p_organization_slug character varying, p_permission character varying, p_resource_type character varying DEFAULT NULL::character varying, p_resource_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_has_permission BOOLEAN := FALSE;
    v_permission_parts TEXT[];
    v_permission_category TEXT;
BEGIN
    -- Parse permission into category:action
    v_permission_parts := string_to_array(p_permission, ':');
    v_permission_category := v_permission_parts[1];

    -- Check for permission (including wildcards and resource scoping)
    SELECT EXISTS(
        SELECT 1
        FROM rbac_user_org_roles uor
        JOIN rbac_role_permissions rp ON uor.role_id = rp.role_id
        JOIN rbac_permissions p ON rp.permission_id = p.id
        WHERE uor.user_id = p_user_id
          -- Organization check: user's org matches OR user has global access ('*')
          AND (uor.organization_slug = p_organization_slug OR uor.organization_slug = '*')
          -- Not expired
          AND (uor.expires_at IS NULL OR uor.expires_at > NOW())
          -- Permission check: exact match, category wildcard, or full wildcard
          AND (
              p.name = p_permission                           -- Exact: rag:read
              OR p.name = v_permission_category || ':*'       -- Category wildcard: rag:*
              OR p.name = '*:*'                               -- Full wildcard
          )
          -- Resource scoping: NULL means all, or must match specific resource
          AND (
              rp.resource_type IS NULL                        -- No resource restriction
              OR (
                  rp.resource_type = p_resource_type
                  AND (rp.resource_id IS NULL OR rp.resource_id = p_resource_id)
              )
          )
    ) INTO v_has_permission;

    RETURN v_has_permission;
END;
$$;


--
-- Name: set_timestamp_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_timestamp_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_agent_configurations_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_agent_configurations_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_agent_skills_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_agent_skills_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_agent_usage_analytics(uuid, integer, integer, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_agent_usage_analytics(p_agent_id uuid, p_conversation_increment integer DEFAULT 0, p_message_increment integer DEFAULT 0, p_response_time_ms integer DEFAULT NULL::integer, p_error_increment integer DEFAULT 0, p_unique_user_increment integer DEFAULT 0) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO agent_usage_analytics (
        agent_configuration_id, agent_id, date_period,
        conversation_count, message_count, error_count, unique_users
    ) VALUES (
        p_agent_id, 
        (SELECT agent_id FROM agent_configurations WHERE id = p_agent_id),
        CURRENT_DATE,
        p_conversation_increment, p_message_increment, p_error_increment, p_unique_user_increment
    )
    ON CONFLICT (agent_configuration_id, date_period) 
    DO UPDATE SET
        conversation_count = agent_usage_analytics.conversation_count + p_conversation_increment,
        message_count = agent_usage_analytics.message_count + p_message_increment,
        error_count = agent_usage_analytics.error_count + p_error_increment,
        unique_users = agent_usage_analytics.unique_users + p_unique_user_increment,
        avg_response_time_ms = CASE 
            WHEN p_response_time_ms IS NOT NULL THEN
                COALESCE(
                    (agent_usage_analytics.avg_response_time_ms + p_response_time_ms) / 2,
                    p_response_time_ms
                )
            ELSE agent_usage_analytics.avg_response_time_ms
        END,
        last_updated = NOW();
END;
$$;


--
-- Name: FUNCTION update_agent_usage_analytics(p_agent_id uuid, p_conversation_increment integer, p_message_increment integer, p_response_time_ms integer, p_error_increment integer, p_unique_user_increment integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_agent_usage_analytics(p_agent_id uuid, p_conversation_increment integer, p_message_increment integer, p_response_time_ms integer, p_error_increment integer, p_unique_user_increment integer) IS 'Helper function to update daily usage stats';


--
-- Name: update_completion_percentage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_completion_percentage() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.completion_percentage = calculate_completion_percentage(NEW.requirements_gathered);
    RETURN NEW;
END;
$$;


--
-- Name: update_conversation_timestamps(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_conversation_timestamps() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.last_activity_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_creation_metrics(boolean, integer, integer, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_creation_metrics(p_success boolean, p_creation_time_seconds integer DEFAULT NULL::integer, p_questions_answered integer DEFAULT NULL::integer, p_department character varying DEFAULT NULL::character varying) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    current_hour INTEGER;
    dept_breakdown JSONB;
BEGIN
    current_hour := EXTRACT(hour FROM NOW());
    
    -- Get current department breakdown or initialize
    SELECT department_breakdown INTO dept_breakdown
    FROM agent_creation_metrics
    WHERE date_period = CURRENT_DATE AND hour_period = current_hour;
    
    IF dept_breakdown IS NULL THEN
        dept_breakdown := '{}';
    END IF;
    
    -- Update department count
    IF p_department IS NOT NULL THEN
        dept_breakdown := jsonb_set(
            dept_breakdown,
            ARRAY[p_department],
            to_jsonb(COALESCE((dept_breakdown ->> p_department)::INTEGER, 0) + 1)
        );
    END IF;
    
    INSERT INTO agent_creation_metrics (
        date_period, hour_period, total_attempts,
        successful_creations, failed_creations,
        avg_creation_time_seconds, avg_questions_to_completion,
        department_breakdown
    ) VALUES (
        CURRENT_DATE, current_hour, 1,
        CASE WHEN p_success THEN 1 ELSE 0 END,
        CASE WHEN p_success THEN 0 ELSE 1 END,
        p_creation_time_seconds, p_questions_answered,
        dept_breakdown
    )
    ON CONFLICT (date_period, hour_period)
    DO UPDATE SET
        total_attempts = agent_creation_metrics.total_attempts + 1,
        successful_creations = agent_creation_metrics.successful_creations + 
            CASE WHEN p_success THEN 1 ELSE 0 END,
        failed_creations = agent_creation_metrics.failed_creations + 
            CASE WHEN p_success THEN 0 ELSE 1 END,
        avg_creation_time_seconds = CASE 
            WHEN p_creation_time_seconds IS NOT NULL THEN
                COALESCE(
                    (agent_creation_metrics.avg_creation_time_seconds + p_creation_time_seconds) / 2,
                    p_creation_time_seconds
                )
            ELSE agent_creation_metrics.avg_creation_time_seconds
        END,
        avg_questions_to_completion = CASE 
            WHEN p_questions_answered IS NOT NULL THEN
                COALESCE(
                    (agent_creation_metrics.avg_questions_to_completion + p_questions_answered) / 2.0,
                    p_questions_answered::DECIMAL
                )
            ELSE agent_creation_metrics.avg_questions_to_completion
        END,
        department_breakdown = dept_breakdown,
        last_updated = NOW();
END;
$$;


--
-- Name: FUNCTION update_creation_metrics(p_success boolean, p_creation_time_seconds integer, p_questions_answered integer, p_department character varying); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_creation_metrics(p_success boolean, p_creation_time_seconds integer, p_questions_answered integer, p_department character varying) IS 'Helper function to update system creation metrics';


--
-- Name: update_llm_models_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_llm_models_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_llm_providers_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_llm_providers_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_plans_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_plans_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_rbac_roles_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_rbac_roles_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_redaction_patterns_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_redaction_patterns_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_users_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_users_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: validate_skill_examples(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_skill_examples(examples jsonb) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    example_text TEXT;
    example_value JSONB;
BEGIN
    -- Check each example in the array
    FOR example_value IN SELECT jsonb_array_elements(examples)
    LOOP
        example_text := example_value #>> '{}';
        
        -- Ensure example is not empty or too short
        IF LENGTH(TRIM(example_text)) < 5 THEN
            RETURN FALSE;
        END IF;
        
        -- Ensure example is a reasonable length (not too long)
        IF LENGTH(example_text) > 500 THEN
            RETURN FALSE;
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: rag_collections; Type: TABLE; Schema: rag_data; Owner: -
--

CREATE TABLE rag_data.rag_collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_slug text NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    description text,
    embedding_model character varying(100) DEFAULT 'nomic-embed-text'::character varying NOT NULL,
    embedding_dimensions integer DEFAULT 768 NOT NULL,
    chunk_size integer DEFAULT 1000 NOT NULL,
    chunk_overlap integer DEFAULT 200 NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    required_role text,
    document_count integer DEFAULT 0 NOT NULL,
    chunk_count integer DEFAULT 0 NOT NULL,
    total_tokens integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    allowed_users uuid[]
);


--
-- Name: TABLE rag_collections; Type: COMMENT; Schema: rag_data; Owner: -
--

COMMENT ON TABLE rag_data.rag_collections IS 'RAG collection definitions with embedding configuration (PRD §4.3.1)';


--
-- Name: rag_create_collection(text, character varying, character varying, text, character varying, integer, integer, integer, uuid); Type: FUNCTION; Schema: rag_data; Owner: -
--

CREATE FUNCTION rag_data.rag_create_collection(p_organization_slug text, p_name character varying, p_slug character varying, p_description text DEFAULT NULL::text, p_embedding_model character varying DEFAULT 'nomic-embed-text'::character varying, p_embedding_dimensions integer DEFAULT 768, p_chunk_size integer DEFAULT 1000, p_chunk_overlap integer DEFAULT 200, p_created_by uuid DEFAULT NULL::uuid) RETURNS rag_data.rag_collections
    LANGUAGE sql
    AS $$
    INSERT INTO rag_data.rag_collections (
        organization_slug, name, slug, description,
        embedding_model, embedding_dimensions, chunk_size, chunk_overlap, created_by
    )
    VALUES (
        p_organization_slug, p_name, p_slug, p_description,
        p_embedding_model, p_embedding_dimensions, p_chunk_size, p_chunk_overlap, p_created_by
    )
    RETURNING *;
$$;


--
-- Name: rag_create_collection(text, character varying, character varying, text, character varying, integer, integer, integer, uuid, text, uuid[]); Type: FUNCTION; Schema: rag_data; Owner: -
--

CREATE FUNCTION rag_data.rag_create_collection(p_organization_slug text, p_name character varying, p_slug character varying, p_description text, p_embedding_model character varying, p_embedding_dimensions integer, p_chunk_size integer, p_chunk_overlap integer, p_created_by uuid, p_required_role text DEFAULT NULL::text, p_allowed_users uuid[] DEFAULT NULL::uuid[]) RETURNS rag_data.rag_collections
    LANGUAGE sql
    AS $$
    INSERT INTO rag_data.rag_collections (
        organization_slug,
        name,
        slug,
        description,
        embedding_model,
        embedding_dimensions,
        chunk_size,
        chunk_overlap,
        created_by,
        required_role,
        allowed_users
    ) VALUES (
        p_organization_slug,
        p_name,
        p_slug,
        p_description,
        p_embedding_model,
        p_embedding_dimensions,
        p_chunk_size,
        p_chunk_overlap,
        p_created_by,
        p_required_role,
        p_allowed_users
    )
    RETURNING *;
$$;


--
-- Name: rag_delete_collection(uuid, text); Type: FUNCTION; Schema: rag_data; Owner: -
--

CREATE FUNCTION rag_data.rag_delete_collection(p_collection_id uuid, p_organization_slug text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM rag_data.rag_collections
    WHERE id = p_collection_id
      AND organization_slug = p_organization_slug;
    RETURN FOUND;
END;
$$;


--
-- Name: rag_delete_document(uuid, text); Type: FUNCTION; Schema: rag_data; Owner: -
--

CREATE FUNCTION rag_data.rag_delete_document(p_document_id uuid, p_organization_slug text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_collection_id UUID;
    v_chunk_count INTEGER;
BEGIN
    -- Get collection and chunk count before delete
    SELECT collection_id, chunk_count INTO v_collection_id, v_chunk_count
    FROM rag_data.rag_documents
    WHERE id = p_document_id AND organization_slug = p_organization_slug;

    IF v_collection_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Delete document (chunks deleted via CASCADE)
    DELETE FROM rag_data.rag_documents
    WHERE id = p_document_id AND organization_slug = p_organization_slug;

    -- Update collection stats
    UPDATE rag_data.rag_collections
    SET document_count = document_count - 1,
        chunk_count = chunk_count - COALESCE(v_chunk_count, 0),
        updated_at = NOW()
    WHERE id = v_collection_id;

    RETURN TRUE;
END;
$$;


--
-- Name: rag_get_collection(uuid, text); Type: FUNCTION; Schema: rag_data; Owner: -
--

CREATE FUNCTION rag_data.rag_get_collection(p_collection_id uuid, p_organization_slug text) RETURNS TABLE(id uuid, organization_slug text, name character varying, slug character varying, description text, embedding_model character varying, embedding_dimensions integer, chunk_size integer, chunk_overlap integer, status character varying, required_role text, document_count integer, chunk_count integer, total_tokens integer, created_at timestamp with time zone, updated_at timestamp with time zone, created_by uuid)
    LANGUAGE sql STABLE
    AS $$
    SELECT id, organization_slug, name, slug, description, embedding_model,
           embedding_dimensions, chunk_size, chunk_overlap, status, required_role,
           document_count, chunk_count, total_tokens, created_at, updated_at, created_by
    FROM rag_data.rag_collections
    WHERE id = p_collection_id
      AND organization_slug = p_organization_slug;
$$;


--
-- Name: rag_get_collections(text); Type: FUNCTION; Schema: rag_data; Owner: -
--

CREATE FUNCTION rag_data.rag_get_collections(p_organization_slug text) RETURNS TABLE(id uuid, name character varying, slug character varying, description text, embedding_model character varying, embedding_dimensions integer, chunk_size integer, chunk_overlap integer, status character varying, required_role text, document_count integer, chunk_count integer, total_tokens integer, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT id, name, slug, description, embedding_model, embedding_dimensions,
           chunk_size, chunk_overlap, status, required_role,
           document_count, chunk_count, total_tokens, created_at, updated_at
    FROM rag_data.rag_collections
    WHERE organization_slug = p_organization_slug
    ORDER BY created_at DESC;
$$;


--
-- Name: rag_get_collections(text, uuid); Type: FUNCTION; Schema: rag_data; Owner: -
--

CREATE FUNCTION rag_data.rag_get_collections(p_organization_slug text, p_user_id uuid DEFAULT NULL::uuid) RETURNS SETOF rag_data.rag_collections
    LANGUAGE sql STABLE
    AS $$
    SELECT *
    FROM rag_data.rag_collections
    WHERE organization_slug = p_organization_slug
      AND (
          -- No user filter = return all (for admin queries)
          p_user_id IS NULL
          -- Or user has access
          OR allowed_users IS NULL
          OR created_by = p_user_id
          OR p_user_id = ANY(allowed_users)
      )
    ORDER BY created_at DESC;
$$;


--
-- Name: rag_get_document(uuid, text); Type: FUNCTION; Schema: rag_data; Owner: -
--

CREATE FUNCTION rag_data.rag_get_document(p_document_id uuid, p_organization_slug text) RETURNS TABLE(id uuid, collection_id uuid, filename character varying, file_type character varying, file_size integer, file_hash character varying, storage_path text, status character varying, error_message text, chunk_count integer, token_count integer, metadata jsonb, created_at timestamp with time zone, updated_at timestamp with time zone, processed_at timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT d.id, d.collection_id, d.filename, d.file_type, d.file_size,
           d.file_hash, d.storage_path, d.status, d.error_message,
           d.chunk_count, d.token_count, d.metadata,
           d.created_at, d.updated_at, d.processed_at
    FROM rag_data.rag_documents d
    WHERE d.id = p_document_id
      AND d.organization_slug = p_organization_slug;
$$;


--
-- Name: rag_get_document_chunks(uuid, text); Type: FUNCTION; Schema: rag_data; Owner: -
--

CREATE FUNCTION rag_data.rag_get_document_chunks(p_document_id uuid, p_organization_slug text) RETURNS TABLE(id uuid, content text, chunk_index integer, token_count integer, page_number integer, metadata jsonb)
    LANGUAGE sql STABLE
    AS $$
    SELECT c.id, c.content, c.chunk_index, c.token_count, c.page_number, c.metadata
    FROM rag_data.rag_document_chunks c
    WHERE c.document_id = p_document_id
      AND c.organization_slug = p_organization_slug
    ORDER BY c.chunk_index;
$$;


--
-- Name: rag_get_documents(uuid, text); Type: FUNCTION; Schema: rag_data; Owner: -
--

CREATE FUNCTION rag_data.rag_get_documents(p_collection_id uuid, p_organization_slug text) RETURNS TABLE(id uuid, collection_id uuid, filename character varying, file_type character varying, file_size integer, status character varying, error_message text, chunk_count integer, token_count integer, metadata jsonb, created_at timestamp with time zone, processed_at timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
    SELECT d.id, d.collection_id, d.filename, d.file_type, d.file_size, d.status,
           d.error_message, d.chunk_count, d.token_count, d.metadata,
           d.created_at, d.processed_at
    FROM rag_data.rag_documents d
    JOIN rag_collections c ON d.collection_id = c.id
    WHERE d.collection_id = p_collection_id
      AND c.organization_slug = p_organization_slug
    ORDER BY d.created_at DESC;
$$;


--
-- Name: rag_insert_chunks(uuid, text, jsonb); Type: FUNCTION; Schema: rag_data; Owner: -
--

CREATE FUNCTION rag_data.rag_insert_chunks(p_document_id uuid, p_organization_slug text, p_chunks jsonb) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_collection_id UUID;
    v_inserted INTEGER := 0;
    v_total_tokens INTEGER := 0;
    v_chunk JSONB;
BEGIN
    -- Get collection_id and verify org ownership
    SELECT d.collection_id INTO v_collection_id
    FROM rag_data.rag_documents d
    JOIN rag_collections c ON d.collection_id = c.id
    WHERE d.id = p_document_id
      AND c.organization_slug = p_organization_slug;

    IF v_collection_id IS NULL THEN
        RETURN 0;
    END IF;

    -- Insert all chunks
    FOR v_chunk IN SELECT * FROM jsonb_array_elements(p_chunks)
    LOOP
        INSERT INTO rag_data.rag_document_chunks (
            document_id, collection_id, organization_slug, content, chunk_index,
            embedding, token_count, page_number, char_offset, metadata
        )
        VALUES (
            p_document_id,
            v_collection_id,
            p_organization_slug,
            v_chunk->>'content',
            (v_chunk->>'chunk_index')::INTEGER,
            CASE
                WHEN v_chunk ? 'embedding' AND v_chunk->>'embedding' IS NOT NULL
                THEN (v_chunk->>'embedding')::vector
                ELSE NULL
            END,
            COALESCE((v_chunk->>'token_count')::INTEGER, 0),
            (v_chunk->>'page_number')::INTEGER,
            (v_chunk->>'char_offset')::INTEGER,
            COALESCE(v_chunk->'metadata', '{}'::JSONB)
        );
        v_inserted := v_inserted + 1;
        v_total_tokens := v_total_tokens + COALESCE((v_chunk->>'token_count')::INTEGER, 0);
    END LOOP;

    -- Update document stats
    UPDATE rag_data.rag_documents
    SET chunk_count = v_inserted,
        token_count = v_total_tokens,
        status = 'completed',
        processed_at = NOW()
    WHERE id = p_document_id;

    -- Update collection stats
    UPDATE rag_data.rag_collections
    SET chunk_count = chunk_count + v_inserted,
        document_count = document_count + 1,
        total_tokens = total_tokens + v_total_tokens,
        updated_at = NOW()
    WHERE id = v_collection_id;

    RETURN v_inserted;
END;
$$;


--
-- Name: rag_documents; Type: TABLE; Schema: rag_data; Owner: -
--

CREATE TABLE rag_data.rag_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    collection_id uuid NOT NULL,
    organization_slug text NOT NULL,
    filename character varying(500) NOT NULL,
    file_type character varying(50) NOT NULL,
    file_size integer NOT NULL,
    file_hash character varying(64),
    storage_path text,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    error_message text,
    chunk_count integer DEFAULT 0,
    token_count integer DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    created_by uuid
);


--
-- Name: TABLE rag_documents; Type: COMMENT; Schema: rag_data; Owner: -
--

COMMENT ON TABLE rag_data.rag_documents IS 'Source documents ingested into RAG collections (PRD §4.2.2)';


--
-- Name: rag_insert_document(uuid, text, character varying, character varying, integer, character varying, text, uuid); Type: FUNCTION; Schema: rag_data; Owner: -
--

CREATE FUNCTION rag_data.rag_insert_document(p_collection_id uuid, p_organization_slug text, p_filename character varying, p_file_type character varying, p_file_size integer, p_file_hash character varying DEFAULT NULL::character varying, p_storage_path text DEFAULT NULL::text, p_created_by uuid DEFAULT NULL::uuid) RETURNS rag_data.rag_documents
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_collection_exists BOOLEAN;
    v_result rag_documents;
BEGIN
    -- Verify collection belongs to organization
    SELECT EXISTS(
        SELECT 1 FROM rag_data.rag_collections
        WHERE id = p_collection_id AND organization_slug = p_organization_slug
    ) INTO v_collection_exists;

    IF NOT v_collection_exists THEN
        RETURN NULL;
    END IF;

    INSERT INTO rag_data.rag_documents (
        collection_id, organization_slug, filename, file_type, file_size,
        file_hash, storage_path, created_by
    )
    VALUES (
        p_collection_id, p_organization_slug, p_filename, p_file_type, p_file_size,
        p_file_hash, p_storage_path, p_created_by
    )
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$;


--
-- Name: rag_search(uuid, text, rag_data.vector, integer, double precision); Type: FUNCTION; Schema: rag_data; Owner: -
--

CREATE FUNCTION rag_data.rag_search(p_collection_id uuid, p_organization_slug text, p_query_embedding rag_data.vector, p_top_k integer DEFAULT 5, p_similarity_threshold double precision DEFAULT 0.5) RETURNS TABLE(chunk_id uuid, document_id uuid, document_filename character varying, content text, score double precision, page_number integer, chunk_index integer, metadata jsonb)
    LANGUAGE sql STABLE
    AS $$
    SELECT
        c.id AS chunk_id,
        c.document_id,
        d.filename AS document_filename,
        c.content,
        1 - (c.embedding <=> p_query_embedding) AS score,
        c.page_number,
        c.chunk_index,
        c.metadata
    FROM rag_data.rag_document_chunks c
    JOIN rag_documents d ON c.document_id = d.id
    JOIN rag_collections col ON c.collection_id = col.id
    WHERE c.collection_id = p_collection_id
      AND col.organization_slug = p_organization_slug
      AND c.embedding IS NOT NULL
      AND 1 - (c.embedding <=> p_query_embedding) >= p_similarity_threshold
    ORDER BY c.embedding <=> p_query_embedding
    LIMIT p_top_k;
$$;


--
-- Name: FUNCTION rag_search(p_collection_id uuid, p_organization_slug text, p_query_embedding rag_data.vector, p_top_k integer, p_similarity_threshold double precision); Type: COMMENT; Schema: rag_data; Owner: -
--

COMMENT ON FUNCTION rag_data.rag_search(p_collection_id uuid, p_organization_slug text, p_query_embedding rag_data.vector, p_top_k integer, p_similarity_threshold double precision) IS 'Vector similarity search for RAG queries (PRD §4.4.4)';


--
-- Name: rag_update_collection(uuid, text, character varying, text, text); Type: FUNCTION; Schema: rag_data; Owner: -
--

CREATE FUNCTION rag_data.rag_update_collection(p_collection_id uuid, p_organization_slug text, p_name character varying DEFAULT NULL::character varying, p_description text DEFAULT NULL::text, p_required_role text DEFAULT NULL::text) RETURNS rag_data.rag_collections
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_result rag_collections;
BEGIN
    UPDATE rag_data.rag_collections
    SET
        name = COALESCE(p_name, name),
        description = COALESCE(p_description, description),
        required_role = p_required_role,
        updated_at = NOW()
    WHERE id = p_collection_id
      AND organization_slug = p_organization_slug
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$;


--
-- Name: rag_update_collection(uuid, text, character varying, text, text, uuid[], boolean); Type: FUNCTION; Schema: rag_data; Owner: -
--

CREATE FUNCTION rag_data.rag_update_collection(p_collection_id uuid, p_organization_slug text, p_name character varying DEFAULT NULL::character varying, p_description text DEFAULT NULL::text, p_required_role text DEFAULT NULL::text, p_allowed_users uuid[] DEFAULT NULL::uuid[], p_clear_allowed_users boolean DEFAULT false) RETURNS rag_data.rag_collections
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_result rag_data.rag_collections;
BEGIN
    UPDATE rag_data.rag_collections
    SET
        name = COALESCE(p_name, name),
        description = COALESCE(p_description, description),
        required_role = COALESCE(p_required_role, required_role),
        -- Handle allowed_users: explicit NULL clears, array updates, or keep existing
        allowed_users = CASE
            WHEN p_clear_allowed_users THEN NULL
            WHEN p_allowed_users IS NOT NULL THEN p_allowed_users
            ELSE allowed_users
        END,
        updated_at = NOW()
    WHERE id = p_collection_id
      AND organization_slug = p_organization_slug
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$;


--
-- Name: rag_update_document_status(uuid, text, character varying, text, integer, integer); Type: FUNCTION; Schema: rag_data; Owner: -
--

CREATE FUNCTION rag_data.rag_update_document_status(p_document_id uuid, p_organization_slug text, p_status character varying, p_error_message text DEFAULT NULL::text, p_chunk_count integer DEFAULT NULL::integer, p_token_count integer DEFAULT NULL::integer) RETURNS rag_data.rag_documents
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_result rag_documents;
BEGIN
    UPDATE rag_data.rag_documents
    SET
        status = p_status,
        error_message = p_error_message,
        chunk_count = COALESCE(p_chunk_count, chunk_count),
        token_count = COALESCE(p_token_count, token_count),
        processed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE processed_at END,
        updated_at = NOW()
    WHERE id = p_document_id
      AND organization_slug = p_organization_slug
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$;


--
-- Name: rag_user_can_access_collection(uuid, uuid); Type: FUNCTION; Schema: rag_data; Owner: -
--

CREATE FUNCTION rag_data.rag_user_can_access_collection(p_collection_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_collection RECORD;
BEGIN
    SELECT allowed_users, created_by
    INTO v_collection
    FROM rag_data.rag_collections
    WHERE id = p_collection_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- NULL allowed_users = everyone in org can access
    IF v_collection.allowed_users IS NULL THEN
        RETURN TRUE;
    END IF;

    -- User is the creator
    IF v_collection.created_by = p_user_id THEN
        RETURN TRUE;
    END IF;

    -- User is in allowed_users array
    IF p_user_id = ANY(v_collection.allowed_users) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;


--
-- Name: FUNCTION rag_user_can_access_collection(p_collection_id uuid, p_user_id uuid); Type: COMMENT; Schema: rag_data; Owner: -
--

COMMENT ON FUNCTION rag_data.rag_user_can_access_collection(p_collection_id uuid, p_user_id uuid) IS 'Check if user has access to a collection based on allowed_users or created_by';


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: rag_data; Owner: -
--

CREATE FUNCTION rag_data.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: checkpoint_blobs; Type: TABLE; Schema: langgraph; Owner: -
--

CREATE TABLE langgraph.checkpoint_blobs (
    thread_id text NOT NULL,
    checkpoint_ns text DEFAULT ''::text NOT NULL,
    channel text NOT NULL,
    version text NOT NULL,
    type text NOT NULL,
    blob bytea,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE checkpoint_blobs; Type: COMMENT; Schema: langgraph; Owner: -
--

COMMENT ON TABLE langgraph.checkpoint_blobs IS 'Stores large binary channel data separately from checkpoints';


--
-- Name: checkpoint_writes; Type: TABLE; Schema: langgraph; Owner: -
--

CREATE TABLE langgraph.checkpoint_writes (
    thread_id text NOT NULL,
    checkpoint_ns text DEFAULT ''::text NOT NULL,
    checkpoint_id text NOT NULL,
    task_id text NOT NULL,
    idx integer NOT NULL,
    channel text NOT NULL,
    type text,
    blob bytea NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE checkpoint_writes; Type: COMMENT; Schema: langgraph; Owner: -
--

COMMENT ON TABLE langgraph.checkpoint_writes IS 'Stores pending writes before checkpoint commit';


--
-- Name: checkpoints; Type: TABLE; Schema: langgraph; Owner: -
--

CREATE TABLE langgraph.checkpoints (
    thread_id text NOT NULL,
    checkpoint_ns text DEFAULT ''::text NOT NULL,
    checkpoint_id text NOT NULL,
    parent_checkpoint_id text,
    type text,
    checkpoint jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE checkpoints; Type: COMMENT; Schema: langgraph; Owner: -
--

COMMENT ON TABLE langgraph.checkpoints IS 'Stores graph state checkpoints for resumable workflows';


--
-- Name: annotation_tag_entity; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.annotation_tag_entity (
    id character varying(16) NOT NULL,
    name character varying(24) NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);


--
-- Name: auth_identity; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.auth_identity (
    "userId" uuid,
    "providerId" character varying(64) NOT NULL,
    "providerType" character varying(32) NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);


--
-- Name: auth_provider_sync_history; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.auth_provider_sync_history (
    id integer NOT NULL,
    "providerType" character varying(32) NOT NULL,
    "runMode" text NOT NULL,
    status text NOT NULL,
    "startedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "endedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    scanned integer NOT NULL,
    created integer NOT NULL,
    updated integer NOT NULL,
    disabled integer NOT NULL,
    error text
);


--
-- Name: auth_provider_sync_history_id_seq; Type: SEQUENCE; Schema: n8n_data; Owner: -
--

CREATE SEQUENCE n8n_data.auth_provider_sync_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auth_provider_sync_history_id_seq; Type: SEQUENCE OWNED BY; Schema: n8n_data; Owner: -
--

ALTER SEQUENCE n8n_data.auth_provider_sync_history_id_seq OWNED BY n8n_data.auth_provider_sync_history.id;


--
-- Name: credentials_entity; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.credentials_entity (
    name character varying(128) NOT NULL,
    data text NOT NULL,
    type character varying(128) NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    id character varying(36) NOT NULL,
    "isManaged" boolean DEFAULT false NOT NULL
);


--
-- Name: data_table; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.data_table (
    id character varying(36) NOT NULL,
    name character varying(128) NOT NULL,
    "projectId" character varying(36) NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);


--
-- Name: data_table_column; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.data_table_column (
    id character varying(36) NOT NULL,
    name character varying(128) NOT NULL,
    type character varying(32) NOT NULL,
    index integer NOT NULL,
    "dataTableId" character varying(36) NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);


--
-- Name: COLUMN data_table_column.type; Type: COMMENT; Schema: n8n_data; Owner: -
--

COMMENT ON COLUMN n8n_data.data_table_column.type IS 'Expected: string, number, boolean, or date (not enforced as a constraint)';


--
-- Name: COLUMN data_table_column.index; Type: COMMENT; Schema: n8n_data; Owner: -
--

COMMENT ON COLUMN n8n_data.data_table_column.index IS 'Column order, starting from 0 (0 = first column)';


--
-- Name: event_destinations; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.event_destinations (
    id uuid NOT NULL,
    destination jsonb NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);


--
-- Name: execution_annotation_tags; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.execution_annotation_tags (
    "annotationId" integer NOT NULL,
    "tagId" character varying(24) NOT NULL
);


--
-- Name: execution_annotations; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.execution_annotations (
    id integer NOT NULL,
    "executionId" integer NOT NULL,
    vote character varying(6),
    note text,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);


--
-- Name: execution_annotations_id_seq; Type: SEQUENCE; Schema: n8n_data; Owner: -
--

CREATE SEQUENCE n8n_data.execution_annotations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: execution_annotations_id_seq; Type: SEQUENCE OWNED BY; Schema: n8n_data; Owner: -
--

ALTER SEQUENCE n8n_data.execution_annotations_id_seq OWNED BY n8n_data.execution_annotations.id;


--
-- Name: execution_data; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.execution_data (
    "executionId" integer NOT NULL,
    "workflowData" json NOT NULL,
    data text NOT NULL
);


--
-- Name: execution_entity; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.execution_entity (
    id integer NOT NULL,
    finished boolean NOT NULL,
    mode character varying NOT NULL,
    "retryOf" character varying,
    "retrySuccessId" character varying,
    "startedAt" timestamp(3) with time zone,
    "stoppedAt" timestamp(3) with time zone,
    "waitTill" timestamp(3) with time zone,
    status character varying NOT NULL,
    "workflowId" character varying(36) NOT NULL,
    "deletedAt" timestamp(3) with time zone,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);


--
-- Name: execution_entity_id_seq; Type: SEQUENCE; Schema: n8n_data; Owner: -
--

CREATE SEQUENCE n8n_data.execution_entity_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: execution_entity_id_seq; Type: SEQUENCE OWNED BY; Schema: n8n_data; Owner: -
--

ALTER SEQUENCE n8n_data.execution_entity_id_seq OWNED BY n8n_data.execution_entity.id;


--
-- Name: execution_metadata; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.execution_metadata (
    id integer NOT NULL,
    "executionId" integer NOT NULL,
    key character varying(255) NOT NULL,
    value text NOT NULL
);


--
-- Name: execution_metadata_temp_id_seq; Type: SEQUENCE; Schema: n8n_data; Owner: -
--

CREATE SEQUENCE n8n_data.execution_metadata_temp_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: execution_metadata_temp_id_seq; Type: SEQUENCE OWNED BY; Schema: n8n_data; Owner: -
--

ALTER SEQUENCE n8n_data.execution_metadata_temp_id_seq OWNED BY n8n_data.execution_metadata.id;


--
-- Name: folder; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.folder (
    id character varying(36) NOT NULL,
    name character varying(128) NOT NULL,
    "parentFolderId" character varying(36),
    "projectId" character varying(36) NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);


--
-- Name: folder_tag; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.folder_tag (
    "folderId" character varying(36) NOT NULL,
    "tagId" character varying(36) NOT NULL
);


--
-- Name: insights_by_period; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.insights_by_period (
    id integer NOT NULL,
    "metaId" integer NOT NULL,
    type integer NOT NULL,
    value integer NOT NULL,
    "periodUnit" integer NOT NULL,
    "periodStart" timestamp(0) with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: COLUMN insights_by_period.type; Type: COMMENT; Schema: n8n_data; Owner: -
--

COMMENT ON COLUMN n8n_data.insights_by_period.type IS '0: time_saved_minutes, 1: runtime_milliseconds, 2: success, 3: failure';


--
-- Name: COLUMN insights_by_period."periodUnit"; Type: COMMENT; Schema: n8n_data; Owner: -
--

COMMENT ON COLUMN n8n_data.insights_by_period."periodUnit" IS '0: hour, 1: day, 2: week';


--
-- Name: insights_by_period_id_seq; Type: SEQUENCE; Schema: n8n_data; Owner: -
--

ALTER TABLE n8n_data.insights_by_period ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME n8n_data.insights_by_period_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: insights_metadata; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.insights_metadata (
    "metaId" integer NOT NULL,
    "workflowId" character varying(16),
    "projectId" character varying(36),
    "workflowName" character varying(128) NOT NULL,
    "projectName" character varying(255) NOT NULL
);


--
-- Name: insights_metadata_metaId_seq; Type: SEQUENCE; Schema: n8n_data; Owner: -
--

ALTER TABLE n8n_data.insights_metadata ALTER COLUMN "metaId" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME n8n_data."insights_metadata_metaId_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: insights_raw; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.insights_raw (
    id integer NOT NULL,
    "metaId" integer NOT NULL,
    type integer NOT NULL,
    value integer NOT NULL,
    "timestamp" timestamp(0) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: COLUMN insights_raw.type; Type: COMMENT; Schema: n8n_data; Owner: -
--

COMMENT ON COLUMN n8n_data.insights_raw.type IS '0: time_saved_minutes, 1: runtime_milliseconds, 2: success, 3: failure';


--
-- Name: insights_raw_id_seq; Type: SEQUENCE; Schema: n8n_data; Owner: -
--

ALTER TABLE n8n_data.insights_raw ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME n8n_data.insights_raw_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: installed_nodes; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.installed_nodes (
    name character varying(200) NOT NULL,
    type character varying(200) NOT NULL,
    "latestVersion" integer DEFAULT 1 NOT NULL,
    package character varying(241) NOT NULL
);


--
-- Name: installed_packages; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.installed_packages (
    "packageName" character varying(214) NOT NULL,
    "installedVersion" character varying(50) NOT NULL,
    "authorName" character varying(70),
    "authorEmail" character varying(70),
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);


--
-- Name: invalid_auth_token; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.invalid_auth_token (
    token character varying(512) NOT NULL,
    "expiresAt" timestamp(3) with time zone NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);


--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: n8n_data; Owner: -
--

CREATE SEQUENCE n8n_data.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: n8n_data; Owner: -
--

ALTER SEQUENCE n8n_data.migrations_id_seq OWNED BY n8n_data.migrations.id;


--
-- Name: processed_data; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.processed_data (
    "workflowId" character varying(36) NOT NULL,
    context character varying(255) NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    value text NOT NULL
);


--
-- Name: project; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.project (
    id character varying(36) NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(36) NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    icon json,
    description character varying(512)
);


--
-- Name: project_relation; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.project_relation (
    "projectId" character varying(36) NOT NULL,
    "userId" uuid NOT NULL,
    role character varying NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);


--
-- Name: role; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.role (
    slug character varying(128) NOT NULL,
    "displayName" text,
    description text,
    "roleType" text,
    "systemRole" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);


--
-- Name: COLUMN role.slug; Type: COMMENT; Schema: n8n_data; Owner: -
--

COMMENT ON COLUMN n8n_data.role.slug IS 'Unique identifier of the role for example: "global:owner"';


--
-- Name: COLUMN role."displayName"; Type: COMMENT; Schema: n8n_data; Owner: -
--

COMMENT ON COLUMN n8n_data.role."displayName" IS 'Name used to display in the UI';


--
-- Name: COLUMN role.description; Type: COMMENT; Schema: n8n_data; Owner: -
--

COMMENT ON COLUMN n8n_data.role.description IS 'Text describing the scope in more detail of users';


--
-- Name: COLUMN role."roleType"; Type: COMMENT; Schema: n8n_data; Owner: -
--

COMMENT ON COLUMN n8n_data.role."roleType" IS 'Type of the role, e.g., global, project, or workflow';


--
-- Name: COLUMN role."systemRole"; Type: COMMENT; Schema: n8n_data; Owner: -
--

COMMENT ON COLUMN n8n_data.role."systemRole" IS 'Indicates if the role is managed by the system and cannot be edited';


--
-- Name: role_scope; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.role_scope (
    "roleSlug" character varying(128) NOT NULL,
    "scopeSlug" character varying(128) NOT NULL
);


--
-- Name: scope; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.scope (
    slug character varying(128) NOT NULL,
    "displayName" text,
    description text
);


--
-- Name: COLUMN scope.slug; Type: COMMENT; Schema: n8n_data; Owner: -
--

COMMENT ON COLUMN n8n_data.scope.slug IS 'Unique identifier of the scope for example: "project:create"';


--
-- Name: COLUMN scope."displayName"; Type: COMMENT; Schema: n8n_data; Owner: -
--

COMMENT ON COLUMN n8n_data.scope."displayName" IS 'Name used to display in the UI';


--
-- Name: COLUMN scope.description; Type: COMMENT; Schema: n8n_data; Owner: -
--

COMMENT ON COLUMN n8n_data.scope.description IS 'Text describing the scope in more detail of users';


--
-- Name: settings; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.settings (
    key character varying(255) NOT NULL,
    value text NOT NULL,
    "loadOnStartup" boolean DEFAULT false NOT NULL
);


--
-- Name: shared_credentials; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.shared_credentials (
    "credentialsId" character varying(36) NOT NULL,
    "projectId" character varying(36) NOT NULL,
    role text NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);


--
-- Name: shared_workflow; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.shared_workflow (
    "workflowId" character varying(36) NOT NULL,
    "projectId" character varying(36) NOT NULL,
    role text NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);


--
-- Name: tag_entity; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.tag_entity (
    name character varying(24) NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    id character varying(36) NOT NULL
);


--
-- Name: test_case_execution; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.test_case_execution (
    id character varying(36) NOT NULL,
    "testRunId" character varying(36) NOT NULL,
    "executionId" integer,
    status character varying NOT NULL,
    "runAt" timestamp(3) with time zone,
    "completedAt" timestamp(3) with time zone,
    "errorCode" character varying,
    "errorDetails" json,
    metrics json,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    inputs json,
    outputs json
);


--
-- Name: test_run; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.test_run (
    id character varying(36) NOT NULL,
    "workflowId" character varying(36) NOT NULL,
    status character varying NOT NULL,
    "errorCode" character varying,
    "errorDetails" json,
    "runAt" timestamp(3) with time zone,
    "completedAt" timestamp(3) with time zone,
    metrics json,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);


--
-- Name: user; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data."user" (
    id uuid DEFAULT uuid_in((OVERLAY(OVERLAY(md5((((random())::text || ':'::text) || (clock_timestamp())::text)) PLACING '4'::text FROM 13) PLACING to_hex((floor(((random() * (((11 - 8) + 1))::double precision) + (8)::double precision)))::integer) FROM 17))::cstring) NOT NULL,
    email character varying(255),
    "firstName" character varying(32),
    "lastName" character varying(32),
    password character varying(255),
    "personalizationAnswers" json,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    settings json,
    disabled boolean DEFAULT false NOT NULL,
    "mfaEnabled" boolean DEFAULT false NOT NULL,
    "mfaSecret" text,
    "mfaRecoveryCodes" text,
    "lastActiveAt" date,
    "roleSlug" character varying(128) DEFAULT 'global:member'::character varying NOT NULL
);


--
-- Name: user_api_keys; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.user_api_keys (
    id character varying(36) NOT NULL,
    "userId" uuid NOT NULL,
    label character varying(100) NOT NULL,
    "apiKey" character varying NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    scopes json
);


--
-- Name: variables; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.variables (
    key character varying(50) NOT NULL,
    type character varying(50) DEFAULT 'string'::character varying NOT NULL,
    value character varying(255),
    id character varying(36) NOT NULL
);


--
-- Name: webhook_entity; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.webhook_entity (
    "webhookPath" character varying NOT NULL,
    method character varying NOT NULL,
    node character varying NOT NULL,
    "webhookId" character varying,
    "pathLength" integer,
    "workflowId" character varying(36) NOT NULL
);


--
-- Name: workflow_entity; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.workflow_entity (
    name character varying(128) NOT NULL,
    active boolean NOT NULL,
    nodes json NOT NULL,
    connections json NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    settings json,
    "staticData" json,
    "pinData" json,
    "versionId" character(36),
    "triggerCount" integer DEFAULT 0 NOT NULL,
    id character varying(36) NOT NULL,
    meta json,
    "parentFolderId" character varying(36) DEFAULT NULL::character varying,
    "isArchived" boolean DEFAULT false NOT NULL
);


--
-- Name: workflow_history; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.workflow_history (
    "versionId" character varying(36) NOT NULL,
    "workflowId" character varying(36) NOT NULL,
    authors character varying(255) NOT NULL,
    "createdAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    "updatedAt" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    nodes json NOT NULL,
    connections json NOT NULL
);


--
-- Name: workflow_statistics; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.workflow_statistics (
    count integer DEFAULT 0,
    "latestEvent" timestamp(3) with time zone,
    name character varying(128) NOT NULL,
    "workflowId" character varying(36) NOT NULL,
    "rootCount" integer DEFAULT 0
);


--
-- Name: workflows_tags; Type: TABLE; Schema: n8n_data; Owner: -
--

CREATE TABLE n8n_data.workflows_tags (
    "workflowId" character varying(36) NOT NULL,
    "tagId" character varying(36) NOT NULL
);


--
-- Name: agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agents (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    organization_slug text[],
    slug text NOT NULL,
    description text,
    agent_type text NOT NULL,
    version text,
    context jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    plan_structure jsonb,
    deliverable_structure jsonb,
    io_schema jsonb,
    name text NOT NULL,
    capabilities text[] DEFAULT ARRAY[]::text[] NOT NULL,
    department text DEFAULT 'general'::text NOT NULL,
    tags text[] DEFAULT ARRAY[]::text[] NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    endpoint jsonb
);


--
-- Name: TABLE agents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.agents IS 'Normalized agent configurations - single source of truth (no JSON files)';


--
-- Name: COLUMN agents.organization_slug; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agents.organization_slug IS 'Array of organization slugs this agent belongs to (supports multi-org)';


--
-- Name: COLUMN agents.slug; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agents.slug IS 'Globally unique identifier (e.g., "blog-post-writer", "hr-onboarding-agent")';


--
-- Name: COLUMN agents.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agents.description IS 'Detailed description of agent purpose and capabilities';


--
-- Name: COLUMN agents.agent_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agents.agent_type IS 'Type of agent: context (LLM-based), api (webhook/HTTP), external (A2A protocol)';


--
-- Name: COLUMN agents.version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agents.version IS 'Semantic version of agent configuration';


--
-- Name: COLUMN agents.context; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agents.context IS 'Dual purpose: system prompt (context agents) or prompt enhancement (API agents)';


--
-- Name: COLUMN agents.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agents.created_at IS 'Timestamp when agent was created';


--
-- Name: COLUMN agents.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agents.updated_at IS 'Timestamp when agent was last updated (auto-maintained by trigger)';


--
-- Name: COLUMN agents.plan_structure; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agents.plan_structure IS 'JSON Schema defining the expected structure of plans created by this agent';


--
-- Name: COLUMN agents.deliverable_structure; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agents.deliverable_structure IS 'JSON Schema defining the expected structure of deliverables created by this agent';


--
-- Name: COLUMN agents.io_schema; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agents.io_schema IS 'JSON schema defining input and output structure for agent interface';


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    storage text NOT NULL,
    path text,
    bucket text,
    object_key text,
    mime text NOT NULL,
    size bigint,
    width integer,
    height integer,
    hash text,
    user_id uuid,
    conversation_id uuid,
    deliverable_version_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source_url text,
    CONSTRAINT assets_storage_check CHECK ((storage = ANY (ARRAY['local'::text, 'supabase'::text, 'external'::text])))
);


--
-- Name: checkpoint_blobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkpoint_blobs (
    thread_id text NOT NULL,
    checkpoint_ns text DEFAULT ''::text NOT NULL,
    channel text NOT NULL,
    version text NOT NULL,
    type text NOT NULL,
    blob bytea
);


--
-- Name: checkpoint_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkpoint_migrations (
    v integer NOT NULL
);


--
-- Name: checkpoint_writes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkpoint_writes (
    thread_id text NOT NULL,
    checkpoint_ns text DEFAULT ''::text NOT NULL,
    checkpoint_id text NOT NULL,
    task_id text NOT NULL,
    idx integer NOT NULL,
    channel text NOT NULL,
    type text,
    blob bytea NOT NULL
);


--
-- Name: checkpoints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkpoints (
    thread_id text NOT NULL,
    checkpoint_ns text DEFAULT ''::text NOT NULL,
    checkpoint_id text NOT NULL,
    parent_checkpoint_id text,
    type text,
    checkpoint jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: cidafm_commands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cidafm_commands (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    type character varying(10) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    default_active boolean DEFAULT false,
    is_builtin boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cidafm_commands_type_check CHECK (((type)::text = ANY (ARRAY[('^'::character varying)::text, ('&'::character varying)::text, ('!'::character varying)::text])))
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    agent_name character varying(255),
    agent_type character varying(100),
    started_at timestamp with time zone,
    last_active_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    organization_slug text,
    ended_at timestamp with time zone,
    primary_work_product_type character varying(100),
    primary_work_product_id uuid
);


--
-- Name: COLUMN conversations.organization_slug; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conversations.organization_slug IS 'Organization slug for database agents (e.g., my-org, acme-corp). NULL for file-based agents.';


--
-- Name: COLUMN conversations.primary_work_product_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conversations.primary_work_product_type IS 'Type of the primary work product/deliverable for this conversation (e.g., blog_post, marketing_bundle, code_review)';


--
-- Name: COLUMN conversations.primary_work_product_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conversations.primary_work_product_id IS 'UUID reference to the primary work product/deliverable record';


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    conversation_id uuid,
    method character varying(255),
    params jsonb DEFAULT '{}'::jsonb,
    prompt text,
    response text,
    status character varying(50) DEFAULT 'pending'::character varying,
    progress integer DEFAULT 0,
    error_code text,
    error_message text,
    error_data jsonb,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    timeout_seconds integer DEFAULT 300,
    metadata jsonb DEFAULT '{}'::jsonb,
    llm_metadata jsonb DEFAULT '{}'::jsonb,
    response_metadata jsonb DEFAULT '{}'::jsonb,
    evaluation jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    hitl_pending boolean DEFAULT false,
    hitl_pending_since timestamp with time zone
);


--
-- Name: TABLE tasks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tasks IS 'Task records for agent execution. deliverable_type removed in favor of deliverables.type (linked via task_id)';


--
-- Name: COLUMN tasks.hitl_pending; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tasks.hitl_pending IS 'True when this task has a pending HITL review';


--
-- Name: COLUMN tasks.hitl_pending_since; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tasks.hitl_pending_since IS 'Timestamp when HITL became pending (for ordering)';


--
-- Name: conversations_with_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.conversations_with_stats AS
 SELECT c.id,
    c.user_id,
    c.agent_name,
    c.agent_type,
    c.ended_at,
    c.started_at,
    c.last_active_at,
    c.metadata,
    c.created_at,
    c.updated_at,
    COALESCE(task_stats.task_count, (0)::bigint) AS task_count,
    COALESCE(task_stats.completed_tasks, (0)::bigint) AS completed_tasks,
    COALESCE(task_stats.failed_tasks, (0)::bigint) AS failed_tasks,
    COALESCE(task_stats.active_tasks, (0)::bigint) AS active_tasks,
    c.organization_slug
   FROM (public.conversations c
     LEFT JOIN ( SELECT t.conversation_id,
            count(*) AS task_count,
            count(
                CASE
                    WHEN ((t.status)::text = 'completed'::text) THEN 1
                    ELSE NULL::integer
                END) AS completed_tasks,
            count(
                CASE
                    WHEN ((t.status)::text = 'failed'::text) THEN 1
                    ELSE NULL::integer
                END) AS failed_tasks,
            count(
                CASE
                    WHEN ((t.status)::text = ANY (ARRAY['pending'::text, 'running'::text])) THEN 1
                    ELSE NULL::integer
                END) AS active_tasks
           FROM public.tasks t
          GROUP BY t.conversation_id) task_stats ON ((c.id = task_stats.conversation_id)));


--
-- Name: deliverable_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deliverable_versions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    deliverable_id uuid NOT NULL,
    version_number integer NOT NULL,
    content text,
    format character varying(100),
    is_current_version boolean DEFAULT false,
    created_by_type character varying(50) DEFAULT 'ai_response'::character varying,
    task_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    file_attachments jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT deliverable_versions_created_by_type_check CHECK (((created_by_type)::text = ANY (ARRAY[('ai_response'::character varying)::text, ('manual_edit'::character varying)::text, ('ai_enhancement'::character varying)::text, ('user_request'::character varying)::text, ('conversation_task'::character varying)::text, ('conversation_merge'::character varying)::text, ('llm_rerun'::character varying)::text])))
);


--
-- Name: COLUMN deliverable_versions.is_current_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.deliverable_versions.is_current_version IS 'Indicates if this is the active version of the deliverable';


--
-- Name: COLUMN deliverable_versions.created_by_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.deliverable_versions.created_by_type IS 'How the version was created: user_request, agent_generated, rerun, merge';


--
-- Name: COLUMN deliverable_versions.task_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.deliverable_versions.task_id IS 'Reference to the task that created this version';


--
-- Name: COLUMN deliverable_versions.file_attachments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.deliverable_versions.file_attachments IS 'JSON object containing file attachment metadata';


--
-- Name: deliverables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deliverables (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    conversation_id uuid,
    agent_name text,
    title text NOT NULL,
    type character varying(100),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    task_id uuid
);


--
-- Name: COLUMN deliverables.task_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.deliverables.task_id IS 'Task that created this deliverable (for HITL tracking)';


--
-- Name: human_approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.human_approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_slug text,
    agent_slug text NOT NULL,
    conversation_id uuid,
    task_id text,
    mode text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    approved_by text,
    decision_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    orchestration_run_id uuid,
    orchestration_step_id uuid
);


--
-- Name: llm_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.llm_models (
    model_name text NOT NULL,
    provider_name text NOT NULL,
    display_name text,
    model_type text DEFAULT 'text-generation'::text,
    model_version text,
    context_window integer DEFAULT 4096,
    max_output_tokens integer DEFAULT 2048,
    model_parameters_json jsonb DEFAULT '{}'::jsonb,
    pricing_info_json jsonb DEFAULT '{}'::jsonb,
    capabilities jsonb DEFAULT '[]'::jsonb,
    model_tier text,
    speed_tier text DEFAULT 'medium'::text,
    loading_priority integer DEFAULT 5,
    is_local boolean DEFAULT false,
    is_currently_loaded boolean DEFAULT false,
    is_active boolean DEFAULT true,
    training_data_cutoff date,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: llm_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.llm_providers (
    name text NOT NULL,
    display_name text NOT NULL,
    api_base_url text,
    configuration_json jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_local boolean DEFAULT false
);


--
-- Name: COLUMN llm_providers.is_local; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.llm_providers.is_local IS 'Indicates if the provider runs locally (e.g., Ollama)';


--
-- Name: llm_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.llm_usage (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    run_id text NOT NULL,
    user_id uuid,
    conversation_id uuid,
    provider_name text,
    model_name text,
    input_tokens integer,
    output_tokens integer,
    input_cost numeric,
    output_cost numeric,
    duration_ms integer,
    status text DEFAULT 'completed'::text,
    caller_type text,
    agent_name text,
    is_local boolean DEFAULT false,
    model_tier text,
    fallback_used boolean DEFAULT false,
    routing_reason text,
    complexity_level text,
    complexity_score integer,
    data_classification text,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    error_message text,
    data_sanitization_applied boolean DEFAULT false,
    sanitization_level text DEFAULT 'none'::text,
    pii_detected boolean DEFAULT false,
    pii_types jsonb DEFAULT '[]'::jsonb,
    pseudonyms_used integer DEFAULT 0,
    pseudonym_types jsonb DEFAULT '[]'::jsonb,
    redactions_applied integer DEFAULT 0,
    redaction_types jsonb DEFAULT '[]'::jsonb,
    source_blinding_applied boolean DEFAULT false,
    headers_stripped boolean DEFAULT false,
    custom_user_agent_used boolean DEFAULT false,
    proxy_used boolean DEFAULT false,
    no_train_header_sent boolean DEFAULT false,
    no_retain_header_sent boolean DEFAULT false,
    sanitization_time_ms integer DEFAULT 0,
    reversal_context_size integer DEFAULT 0,
    policy_profile text,
    sovereign_mode boolean DEFAULT false,
    compliance_flags jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    route text,
    total_cost numeric,
    pseudonym_mappings jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT llm_usage_route_check CHECK (((route IS NULL) OR (route = ANY (ARRAY['local'::text, 'remote'::text]))))
);


--
-- Name: COLUMN llm_usage.total_cost; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.llm_usage.total_cost IS 'Total cost for this LLM request (input_cost + output_cost)';


--
-- Name: COLUMN llm_usage.pseudonym_mappings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.llm_usage.pseudonym_mappings IS 'Array of {original, pseudonym, dataType} objects for this run';


--
-- Name: llm_usage_analytics; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.llm_usage_analytics AS
 SELECT (date_trunc('day'::text, started_at))::date AS date,
    COALESCE(caller_type, 'unknown'::text) AS caller_type,
    count(*) AS total_requests,
    sum(
        CASE
            WHEN (status = 'completed'::text) THEN 1
            ELSE 0
        END) AS successful_requests,
    COALESCE(sum(total_cost), sum((COALESCE(input_cost, (0)::numeric) + COALESCE(output_cost, (0)::numeric)))) AS total_cost,
    avg(COALESCE(duration_ms, 0)) AS avg_duration_ms,
    sum(
        CASE
            WHEN (is_local IS TRUE) THEN 1
            ELSE 0
        END) AS local_requests,
    sum(
        CASE
            WHEN (is_local IS NOT TRUE) THEN 1
            ELSE 0
        END) AS external_requests
   FROM public.llm_usage
  GROUP BY ((date_trunc('day'::text, started_at))::date), COALESCE(caller_type, 'unknown'::text)
  ORDER BY ((date_trunc('day'::text, started_at))::date) DESC, COALESCE(caller_type, 'unknown'::text);


--
-- Name: observability_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.observability_events (
    id bigint NOT NULL,
    source_app text DEFAULT 'orchestrator-ai'::text NOT NULL,
    session_id text,
    hook_event_type text NOT NULL,
    user_id uuid,
    username text,
    conversation_id uuid,
    task_id text NOT NULL,
    agent_slug text,
    organization_slug text,
    mode text,
    status text,
    message text,
    progress integer,
    step text,
    sequence integer,
    total_steps integer,
    payload jsonb NOT NULL,
    "timestamp" bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE observability_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.observability_events IS 'Real-time agent execution events for admin observability and monitoring';


--
-- Name: COLUMN observability_events.session_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.observability_events.session_id IS 'conversationId or taskId used for grouping events';


--
-- Name: COLUMN observability_events.hook_event_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.observability_events.hook_event_type IS 'Event type: agent.started, agent.progress, agent.completed, agent.failed';


--
-- Name: COLUMN observability_events.username; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.observability_events.username IS 'Cached display_name or email for performance';


--
-- Name: COLUMN observability_events.payload; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.observability_events.payload IS 'Full event payload as JSONB (flexible structure)';


--
-- Name: COLUMN observability_events."timestamp"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.observability_events."timestamp" IS 'Event timestamp in milliseconds since epoch';


--
-- Name: observability_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.observability_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: observability_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.observability_events_id_seq OWNED BY public.observability_events.id;


--
-- Name: organization_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_credentials (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    organization_slug text NOT NULL,
    alias text NOT NULL,
    credential_type text NOT NULL,
    encrypted_value bytea NOT NULL,
    encryption_metadata jsonb DEFAULT '{}'::jsonb,
    rotated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE organization_credentials; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.organization_credentials IS 'Encrypted secrets per organization (API keys, service credentials).';


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    url text,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE organizations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.organizations IS 'Multi-tenant organizations for agent and user management';


--
-- Name: COLUMN organizations.slug; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.slug IS 'Human-readable unique identifier (e.g., "acme-corp", "demo-org")';


--
-- Name: COLUMN organizations.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.name IS 'Display name of the organization';


--
-- Name: COLUMN organizations.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.description IS 'Optional description of the organization';


--
-- Name: COLUMN organizations.url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.url IS 'Optional organization website URL';


--
-- Name: COLUMN organizations.settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.settings IS 'Flexible JSONB settings for organization preferences, features, and limits';


--
-- Name: COLUMN organizations.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.created_at IS 'Timestamp when organization was created';


--
-- Name: COLUMN organizations.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.updated_at IS 'Timestamp when organization was last updated (auto-maintained by trigger)';


--
-- Name: plan_deliverables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_deliverables (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    plan_id uuid NOT NULL,
    deliverable_id uuid,
    label text,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: plan_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    version_number integer NOT NULL,
    content text NOT NULL,
    format text DEFAULT 'markdown'::text NOT NULL,
    created_by_type text NOT NULL,
    created_by_id uuid,
    task_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_current_version boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT plan_versions_created_by_type_check CHECK ((created_by_type = ANY (ARRAY['agent'::text, 'user'::text]))),
    CONSTRAINT plan_versions_format_check CHECK ((format = ANY (ARRAY['markdown'::text, 'json'::text, 'text'::text])))
);


--
-- Name: TABLE plan_versions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.plan_versions IS 'Stores immutable versions of plans. Each edit/refinement creates a new version.';


--
-- Name: COLUMN plan_versions.created_by_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plan_versions.created_by_type IS 'Whether this version was created by an agent or manually edited by a user';


--
-- Name: COLUMN plan_versions.task_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plan_versions.task_id IS 'Reference to the agent task that created this version (if applicable)';


--
-- Name: COLUMN plan_versions.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plan_versions.metadata IS 'Additional metadata like LLM model used, merge source versions, etc.';


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    agent_name text NOT NULL,
    namespace text NOT NULL,
    title text NOT NULL,
    current_version_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    organization_slug text,
    agent_slug text,
    status text DEFAULT 'draft'::text,
    summary text,
    plan_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    approved_by uuid
);


--
-- Name: TABLE plans; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.plans IS 'Structured execution plans, replacing conversation_plans.';


--
-- Name: COLUMN plans.current_version_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plans.current_version_id IS 'Points to the currently active version of this plan';


--
-- Name: COLUMN plans.plan_json; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plans.plan_json IS 'Plan structure with phases, steps, dependencies, checkpoints.';


--
-- Name: pseudonym_dictionaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pseudonym_dictionaries (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    original_value text NOT NULL,
    pseudonym text NOT NULL,
    data_type character varying(100) NOT NULL,
    category character varying(100),
    frequency_weight integer DEFAULT 1,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    organization_slug text,
    agent_slug text,
    updated_at timestamp with time zone DEFAULT now(),
    value text
);


--
-- Name: COLUMN pseudonym_dictionaries.data_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pseudonym_dictionaries.data_type IS 'The data type of the original value (text, email, phone, etc.)';


--
-- Name: COLUMN pseudonym_dictionaries.category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pseudonym_dictionaries.category IS 'Category of the pseudonymized data (general, pii, sensitive, etc.)';


--
-- Name: COLUMN pseudonym_dictionaries.frequency_weight; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pseudonym_dictionaries.frequency_weight IS 'Weight for random selection (higher = more likely to be chosen)';


--
-- Name: COLUMN pseudonym_dictionaries.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pseudonym_dictionaries.is_active IS 'Whether this dictionary entry is active';


--
-- Name: COLUMN pseudonym_dictionaries.value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pseudonym_dictionaries.value IS 'The dictionary value used for generating pseudonyms';


--
-- Name: rbac_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rbac_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action character varying(50) NOT NULL,
    actor_id uuid,
    target_user_id uuid,
    target_role_id uuid,
    organization_slug character varying(255),
    details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rbac_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rbac_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    display_name character varying(255) NOT NULL,
    description text,
    category character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rbac_role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rbac_role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    resource_type character varying(100),
    resource_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rbac_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rbac_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    display_name character varying(255) NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rbac_user_org_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rbac_user_org_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    organization_slug character varying(255) NOT NULL,
    role_id uuid NOT NULL,
    assigned_by uuid,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone
);


--
-- Name: redaction_patterns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.redaction_patterns (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    pattern_regex text NOT NULL,
    replacement text NOT NULL,
    description text,
    category character varying(100) DEFAULT 'pii_custom'::character varying,
    priority integer DEFAULT 50,
    is_active boolean DEFAULT true,
    severity character varying(50),
    data_type character varying(50),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE redaction_patterns; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.redaction_patterns IS 'PII detection patterns for redaction and pseudonymization';


--
-- Name: COLUMN redaction_patterns.category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.redaction_patterns.category IS 'pii_builtin or pii_custom';


--
-- Name: COLUMN redaction_patterns.severity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.redaction_patterns.severity IS 'showstopper: blocks content, flagger: warns but allows';


--
-- Name: COLUMN redaction_patterns.data_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.redaction_patterns.data_type IS 'Type of PII: ssn, email, phone, credit_card, etc.';


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE system_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.system_settings IS 'System-wide settings (key/value JSON). Used for global model configuration and feature flags.';


--
-- Name: task_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_messages (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    task_id uuid NOT NULL,
    user_id uuid,
    content text NOT NULL,
    message_type text DEFAULT 'info'::text NOT NULL,
    progress_percentage numeric,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE task_messages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.task_messages IS 'Short-lived task streaming messages used for SSE + polling replay.';


--
-- Name: user_cidafm_commands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_cidafm_commands (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    command_id uuid NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    display_name character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    status text DEFAULT 'active'::text,
    organization_slug text
);


--
-- Name: rag_document_chunks; Type: TABLE; Schema: rag_data; Owner: -
--

CREATE TABLE rag_data.rag_document_chunks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    collection_id uuid NOT NULL,
    organization_slug text NOT NULL,
    content text NOT NULL,
    chunk_index integer NOT NULL,
    embedding rag_data.vector(768),
    token_count integer DEFAULT 0 NOT NULL,
    page_number integer,
    char_offset integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE rag_document_chunks; Type: COMMENT; Schema: rag_data; Owner: -
--

COMMENT ON TABLE rag_data.rag_document_chunks IS 'Document chunks with vector embeddings for semantic search (PRD §4.2.3)';


--
-- Name: auth_provider_sync_history id; Type: DEFAULT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.auth_provider_sync_history ALTER COLUMN id SET DEFAULT nextval('n8n_data.auth_provider_sync_history_id_seq'::regclass);


--
-- Name: execution_annotations id; Type: DEFAULT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.execution_annotations ALTER COLUMN id SET DEFAULT nextval('n8n_data.execution_annotations_id_seq'::regclass);


--
-- Name: execution_entity id; Type: DEFAULT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.execution_entity ALTER COLUMN id SET DEFAULT nextval('n8n_data.execution_entity_id_seq'::regclass);


--
-- Name: execution_metadata id; Type: DEFAULT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.execution_metadata ALTER COLUMN id SET DEFAULT nextval('n8n_data.execution_metadata_temp_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.migrations ALTER COLUMN id SET DEFAULT nextval('n8n_data.migrations_id_seq'::regclass);


--
-- Name: observability_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observability_events ALTER COLUMN id SET DEFAULT nextval('public.observability_events_id_seq'::regclass);


--
-- Name: checkpoint_blobs checkpoint_blobs_pkey; Type: CONSTRAINT; Schema: langgraph; Owner: -
--

ALTER TABLE ONLY langgraph.checkpoint_blobs
    ADD CONSTRAINT checkpoint_blobs_pkey PRIMARY KEY (thread_id, checkpoint_ns, channel, version);


--
-- Name: checkpoint_writes checkpoint_writes_pkey; Type: CONSTRAINT; Schema: langgraph; Owner: -
--

ALTER TABLE ONLY langgraph.checkpoint_writes
    ADD CONSTRAINT checkpoint_writes_pkey PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx);


--
-- Name: checkpoints checkpoints_pkey; Type: CONSTRAINT; Schema: langgraph; Owner: -
--

ALTER TABLE ONLY langgraph.checkpoints
    ADD CONSTRAINT checkpoints_pkey PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id);


--
-- Name: test_run PK_011c050f566e9db509a0fadb9b9; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.test_run
    ADD CONSTRAINT "PK_011c050f566e9db509a0fadb9b9" PRIMARY KEY (id);


--
-- Name: installed_packages PK_08cc9197c39b028c1e9beca225940576fd1a5804; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.installed_packages
    ADD CONSTRAINT "PK_08cc9197c39b028c1e9beca225940576fd1a5804" PRIMARY KEY ("packageName");


--
-- Name: execution_metadata PK_17a0b6284f8d626aae88e1c16e4; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.execution_metadata
    ADD CONSTRAINT "PK_17a0b6284f8d626aae88e1c16e4" PRIMARY KEY (id);


--
-- Name: project_relation PK_1caaa312a5d7184a003be0f0cb6; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.project_relation
    ADD CONSTRAINT "PK_1caaa312a5d7184a003be0f0cb6" PRIMARY KEY ("projectId", "userId");


--
-- Name: folder_tag PK_27e4e00852f6b06a925a4d83a3e; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.folder_tag
    ADD CONSTRAINT "PK_27e4e00852f6b06a925a4d83a3e" PRIMARY KEY ("folderId", "tagId");


--
-- Name: role PK_35c9b140caaf6da09cfabb0d675; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.role
    ADD CONSTRAINT "PK_35c9b140caaf6da09cfabb0d675" PRIMARY KEY (slug);


--
-- Name: project PK_4d68b1358bb5b766d3e78f32f57; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.project
    ADD CONSTRAINT "PK_4d68b1358bb5b766d3e78f32f57" PRIMARY KEY (id);


--
-- Name: invalid_auth_token PK_5779069b7235b256d91f7af1a15; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.invalid_auth_token
    ADD CONSTRAINT "PK_5779069b7235b256d91f7af1a15" PRIMARY KEY (token);


--
-- Name: shared_workflow PK_5ba87620386b847201c9531c58f; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.shared_workflow
    ADD CONSTRAINT "PK_5ba87620386b847201c9531c58f" PRIMARY KEY ("workflowId", "projectId");


--
-- Name: folder PK_6278a41a706740c94c02e288df8; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.folder
    ADD CONSTRAINT "PK_6278a41a706740c94c02e288df8" PRIMARY KEY (id);


--
-- Name: data_table_column PK_673cb121ee4a8a5e27850c72c51; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.data_table_column
    ADD CONSTRAINT "PK_673cb121ee4a8a5e27850c72c51" PRIMARY KEY (id);


--
-- Name: annotation_tag_entity PK_69dfa041592c30bbc0d4b84aa00; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.annotation_tag_entity
    ADD CONSTRAINT "PK_69dfa041592c30bbc0d4b84aa00" PRIMARY KEY (id);


--
-- Name: execution_annotations PK_7afcf93ffa20c4252869a7c6a23; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.execution_annotations
    ADD CONSTRAINT "PK_7afcf93ffa20c4252869a7c6a23" PRIMARY KEY (id);


--
-- Name: migrations PK_8c82d7f526340ab734260ea46be; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);


--
-- Name: installed_nodes PK_8ebd28194e4f792f96b5933423fc439df97d9689; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.installed_nodes
    ADD CONSTRAINT "PK_8ebd28194e4f792f96b5933423fc439df97d9689" PRIMARY KEY (name);


--
-- Name: shared_credentials PK_8ef3a59796a228913f251779cff; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.shared_credentials
    ADD CONSTRAINT "PK_8ef3a59796a228913f251779cff" PRIMARY KEY ("credentialsId", "projectId");


--
-- Name: test_case_execution PK_90c121f77a78a6580e94b794bce; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.test_case_execution
    ADD CONSTRAINT "PK_90c121f77a78a6580e94b794bce" PRIMARY KEY (id);


--
-- Name: user_api_keys PK_978fa5caa3468f463dac9d92e69; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.user_api_keys
    ADD CONSTRAINT "PK_978fa5caa3468f463dac9d92e69" PRIMARY KEY (id);


--
-- Name: execution_annotation_tags PK_979ec03d31294cca484be65d11f; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.execution_annotation_tags
    ADD CONSTRAINT "PK_979ec03d31294cca484be65d11f" PRIMARY KEY ("annotationId", "tagId");


--
-- Name: webhook_entity PK_b21ace2e13596ccd87dc9bf4ea6; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.webhook_entity
    ADD CONSTRAINT "PK_b21ace2e13596ccd87dc9bf4ea6" PRIMARY KEY ("webhookPath", method);


--
-- Name: insights_by_period PK_b606942249b90cc39b0265f0575; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.insights_by_period
    ADD CONSTRAINT "PK_b606942249b90cc39b0265f0575" PRIMARY KEY (id);


--
-- Name: workflow_history PK_b6572dd6173e4cd06fe79937b58; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.workflow_history
    ADD CONSTRAINT "PK_b6572dd6173e4cd06fe79937b58" PRIMARY KEY ("versionId");


--
-- Name: scope PK_bfc45df0481abd7f355d6187da1; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.scope
    ADD CONSTRAINT "PK_bfc45df0481abd7f355d6187da1" PRIMARY KEY (slug);


--
-- Name: processed_data PK_ca04b9d8dc72de268fe07a65773; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.processed_data
    ADD CONSTRAINT "PK_ca04b9d8dc72de268fe07a65773" PRIMARY KEY ("workflowId", context);


--
-- Name: settings PK_dc0fe14e6d9943f268e7b119f69ab8bd; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.settings
    ADD CONSTRAINT "PK_dc0fe14e6d9943f268e7b119f69ab8bd" PRIMARY KEY (key);


--
-- Name: data_table PK_e226d0001b9e6097cbfe70617cb; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.data_table
    ADD CONSTRAINT "PK_e226d0001b9e6097cbfe70617cb" PRIMARY KEY (id);


--
-- Name: user PK_ea8f538c94b6e352418254ed6474a81f; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data."user"
    ADD CONSTRAINT "PK_ea8f538c94b6e352418254ed6474a81f" PRIMARY KEY (id);


--
-- Name: insights_raw PK_ec15125755151e3a7e00e00014f; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.insights_raw
    ADD CONSTRAINT "PK_ec15125755151e3a7e00e00014f" PRIMARY KEY (id);


--
-- Name: insights_metadata PK_f448a94c35218b6208ce20cf5a1; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.insights_metadata
    ADD CONSTRAINT "PK_f448a94c35218b6208ce20cf5a1" PRIMARY KEY ("metaId");


--
-- Name: role_scope PK_role_scope; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.role_scope
    ADD CONSTRAINT "PK_role_scope" PRIMARY KEY ("roleSlug", "scopeSlug");


--
-- Name: data_table_column UQ_8082ec4890f892f0bc77473a123; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.data_table_column
    ADD CONSTRAINT "UQ_8082ec4890f892f0bc77473a123" UNIQUE ("dataTableId", name);


--
-- Name: data_table UQ_b23096ef747281ac944d28e8b0d; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.data_table
    ADD CONSTRAINT "UQ_b23096ef747281ac944d28e8b0d" UNIQUE ("projectId", name);


--
-- Name: user UQ_e12875dfb3b1d92d7d7c5377e2; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data."user"
    ADD CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e2" UNIQUE (email);


--
-- Name: auth_identity auth_identity_pkey; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.auth_identity
    ADD CONSTRAINT auth_identity_pkey PRIMARY KEY ("providerId", "providerType");


--
-- Name: auth_provider_sync_history auth_provider_sync_history_pkey; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.auth_provider_sync_history
    ADD CONSTRAINT auth_provider_sync_history_pkey PRIMARY KEY (id);


--
-- Name: credentials_entity credentials_entity_pkey; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.credentials_entity
    ADD CONSTRAINT credentials_entity_pkey PRIMARY KEY (id);


--
-- Name: event_destinations event_destinations_pkey; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.event_destinations
    ADD CONSTRAINT event_destinations_pkey PRIMARY KEY (id);


--
-- Name: execution_data execution_data_pkey; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.execution_data
    ADD CONSTRAINT execution_data_pkey PRIMARY KEY ("executionId");


--
-- Name: execution_entity pk_e3e63bbf986767844bbe1166d4e; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.execution_entity
    ADD CONSTRAINT pk_e3e63bbf986767844bbe1166d4e PRIMARY KEY (id);


--
-- Name: workflow_statistics pk_workflow_statistics; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.workflow_statistics
    ADD CONSTRAINT pk_workflow_statistics PRIMARY KEY ("workflowId", name);


--
-- Name: workflows_tags pk_workflows_tags; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.workflows_tags
    ADD CONSTRAINT pk_workflows_tags PRIMARY KEY ("workflowId", "tagId");


--
-- Name: tag_entity tag_entity_pkey; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.tag_entity
    ADD CONSTRAINT tag_entity_pkey PRIMARY KEY (id);


--
-- Name: variables variables_key_key; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.variables
    ADD CONSTRAINT variables_key_key UNIQUE (key);


--
-- Name: variables variables_pkey; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.variables
    ADD CONSTRAINT variables_pkey PRIMARY KEY (id);


--
-- Name: workflow_entity workflow_entity_pkey; Type: CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.workflow_entity
    ADD CONSTRAINT workflow_entity_pkey PRIMARY KEY (id);


--
-- Name: conversations agent_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT agent_conversations_pkey PRIMARY KEY (id);


--
-- Name: agents agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_pkey PRIMARY KEY (id);


--
-- Name: agents agents_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_slug_unique UNIQUE (organization_slug, slug);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: checkpoint_blobs checkpoint_blobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkpoint_blobs
    ADD CONSTRAINT checkpoint_blobs_pkey PRIMARY KEY (thread_id, checkpoint_ns, channel, version);


--
-- Name: checkpoint_migrations checkpoint_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkpoint_migrations
    ADD CONSTRAINT checkpoint_migrations_pkey PRIMARY KEY (v);


--
-- Name: checkpoint_writes checkpoint_writes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkpoint_writes
    ADD CONSTRAINT checkpoint_writes_pkey PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx);


--
-- Name: checkpoints checkpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkpoints
    ADD CONSTRAINT checkpoints_pkey PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id);


--
-- Name: cidafm_commands cidafm_commands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cidafm_commands
    ADD CONSTRAINT cidafm_commands_pkey PRIMARY KEY (id);


--
-- Name: deliverable_versions deliverable_versions_deliverable_id_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliverable_versions
    ADD CONSTRAINT deliverable_versions_deliverable_id_version_number_key UNIQUE (deliverable_id, version_number);


--
-- Name: deliverable_versions deliverable_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliverable_versions
    ADD CONSTRAINT deliverable_versions_pkey PRIMARY KEY (id);


--
-- Name: deliverables deliverables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliverables
    ADD CONSTRAINT deliverables_pkey PRIMARY KEY (id);


--
-- Name: human_approvals human_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.human_approvals
    ADD CONSTRAINT human_approvals_pkey PRIMARY KEY (id);


--
-- Name: llm_models llm_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_models
    ADD CONSTRAINT llm_models_pkey PRIMARY KEY (provider_name, model_name);


--
-- Name: llm_providers llm_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_providers
    ADD CONSTRAINT llm_providers_pkey PRIMARY KEY (name);


--
-- Name: llm_usage llm_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_usage
    ADD CONSTRAINT llm_usage_pkey PRIMARY KEY (id);


--
-- Name: llm_usage llm_usage_run_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_usage
    ADD CONSTRAINT llm_usage_run_id_key UNIQUE (run_id);


--
-- Name: observability_events observability_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observability_events
    ADD CONSTRAINT observability_events_pkey PRIMARY KEY (id);


--
-- Name: organization_credentials organization_credentials_alias_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_credentials
    ADD CONSTRAINT organization_credentials_alias_unique UNIQUE (organization_slug, alias);


--
-- Name: organization_credentials organization_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_credentials
    ADD CONSTRAINT organization_credentials_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (slug);


--
-- Name: plan_deliverables plan_deliverables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_deliverables
    ADD CONSTRAINT plan_deliverables_pkey PRIMARY KEY (id);


--
-- Name: plan_versions plan_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_versions
    ADD CONSTRAINT plan_versions_pkey PRIMARY KEY (id);


--
-- Name: plan_versions plan_versions_plan_id_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_versions
    ADD CONSTRAINT plan_versions_plan_id_version_number_key UNIQUE (plan_id, version_number);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: pseudonym_dictionaries pseudonym_dictionaries_original_value_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pseudonym_dictionaries
    ADD CONSTRAINT pseudonym_dictionaries_original_value_key UNIQUE (original_value);


--
-- Name: pseudonym_dictionaries pseudonym_dictionaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pseudonym_dictionaries
    ADD CONSTRAINT pseudonym_dictionaries_pkey PRIMARY KEY (id);


--
-- Name: rbac_audit_log rbac_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_audit_log
    ADD CONSTRAINT rbac_audit_log_pkey PRIMARY KEY (id);


--
-- Name: rbac_permissions rbac_permissions_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_permissions
    ADD CONSTRAINT rbac_permissions_name_key UNIQUE (name);


--
-- Name: rbac_permissions rbac_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_permissions
    ADD CONSTRAINT rbac_permissions_pkey PRIMARY KEY (id);


--
-- Name: rbac_role_permissions rbac_role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_role_permissions
    ADD CONSTRAINT rbac_role_permissions_pkey PRIMARY KEY (id);


--
-- Name: rbac_role_permissions rbac_role_permissions_role_id_permission_id_resource_type_r_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_role_permissions
    ADD CONSTRAINT rbac_role_permissions_role_id_permission_id_resource_type_r_key UNIQUE (role_id, permission_id, resource_type, resource_id);


--
-- Name: rbac_roles rbac_roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_roles
    ADD CONSTRAINT rbac_roles_name_key UNIQUE (name);


--
-- Name: rbac_roles rbac_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_roles
    ADD CONSTRAINT rbac_roles_pkey PRIMARY KEY (id);


--
-- Name: rbac_user_org_roles rbac_user_org_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_user_org_roles
    ADD CONSTRAINT rbac_user_org_roles_pkey PRIMARY KEY (id);


--
-- Name: rbac_user_org_roles rbac_user_org_roles_user_id_organization_slug_role_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_user_org_roles
    ADD CONSTRAINT rbac_user_org_roles_user_id_organization_slug_role_id_key UNIQUE (user_id, organization_slug, role_id);


--
-- Name: redaction_patterns redaction_patterns_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redaction_patterns
    ADD CONSTRAINT redaction_patterns_name_key UNIQUE (name);


--
-- Name: redaction_patterns redaction_patterns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redaction_patterns
    ADD CONSTRAINT redaction_patterns_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);


--
-- Name: task_messages task_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_messages
    ADD CONSTRAINT task_messages_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: plans unique_conversation_plan; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT unique_conversation_plan UNIQUE (conversation_id);


--
-- Name: plan_versions unique_plan_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_versions
    ADD CONSTRAINT unique_plan_version UNIQUE (plan_id, version_number);


--
-- Name: user_cidafm_commands user_cidafm_commands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_cidafm_commands
    ADD CONSTRAINT user_cidafm_commands_pkey PRIMARY KEY (id);


--
-- Name: user_cidafm_commands user_cidafm_commands_user_id_command_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_cidafm_commands
    ADD CONSTRAINT user_cidafm_commands_user_id_command_id_key UNIQUE (user_id, command_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: rag_collections rag_collections_organization_slug_slug_key; Type: CONSTRAINT; Schema: rag_data; Owner: -
--

ALTER TABLE ONLY rag_data.rag_collections
    ADD CONSTRAINT rag_collections_organization_slug_slug_key UNIQUE (organization_slug, slug);


--
-- Name: rag_collections rag_collections_pkey; Type: CONSTRAINT; Schema: rag_data; Owner: -
--

ALTER TABLE ONLY rag_data.rag_collections
    ADD CONSTRAINT rag_collections_pkey PRIMARY KEY (id);


--
-- Name: rag_document_chunks rag_document_chunks_pkey; Type: CONSTRAINT; Schema: rag_data; Owner: -
--

ALTER TABLE ONLY rag_data.rag_document_chunks
    ADD CONSTRAINT rag_document_chunks_pkey PRIMARY KEY (id);


--
-- Name: rag_documents rag_documents_pkey; Type: CONSTRAINT; Schema: rag_data; Owner: -
--

ALTER TABLE ONLY rag_data.rag_documents
    ADD CONSTRAINT rag_documents_pkey PRIMARY KEY (id);


--
-- Name: idx_checkpoint_blobs_thread; Type: INDEX; Schema: langgraph; Owner: -
--

CREATE INDEX idx_checkpoint_blobs_thread ON langgraph.checkpoint_blobs USING btree (thread_id, checkpoint_ns);


--
-- Name: idx_checkpoint_writes_thread; Type: INDEX; Schema: langgraph; Owner: -
--

CREATE INDEX idx_checkpoint_writes_thread ON langgraph.checkpoint_writes USING btree (thread_id, checkpoint_ns, checkpoint_id);


--
-- Name: idx_checkpoints_parent; Type: INDEX; Schema: langgraph; Owner: -
--

CREATE INDEX idx_checkpoints_parent ON langgraph.checkpoints USING btree (thread_id, checkpoint_ns, parent_checkpoint_id);


--
-- Name: idx_checkpoints_thread_id; Type: INDEX; Schema: langgraph; Owner: -
--

CREATE INDEX idx_checkpoints_thread_id ON langgraph.checkpoints USING btree (thread_id);


--
-- Name: IDX_14f68deffaf858465715995508; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE UNIQUE INDEX "IDX_14f68deffaf858465715995508" ON n8n_data.folder USING btree ("projectId", id);


--
-- Name: IDX_1d8ab99d5861c9388d2dc1cf73; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE UNIQUE INDEX "IDX_1d8ab99d5861c9388d2dc1cf73" ON n8n_data.insights_metadata USING btree ("workflowId");


--
-- Name: IDX_1e31657f5fe46816c34be7c1b4; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE INDEX "IDX_1e31657f5fe46816c34be7c1b4" ON n8n_data.workflow_history USING btree ("workflowId");


--
-- Name: IDX_1ef35bac35d20bdae979d917a3; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE UNIQUE INDEX "IDX_1ef35bac35d20bdae979d917a3" ON n8n_data.user_api_keys USING btree ("apiKey");


--
-- Name: IDX_5f0643f6717905a05164090dde; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE INDEX "IDX_5f0643f6717905a05164090dde" ON n8n_data.project_relation USING btree ("userId");


--
-- Name: IDX_60b6a84299eeb3f671dfec7693; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE UNIQUE INDEX "IDX_60b6a84299eeb3f671dfec7693" ON n8n_data.insights_by_period USING btree ("periodStart", type, "periodUnit", "metaId");


--
-- Name: IDX_61448d56d61802b5dfde5cdb00; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE INDEX "IDX_61448d56d61802b5dfde5cdb00" ON n8n_data.project_relation USING btree ("projectId");


--
-- Name: IDX_63d7bbae72c767cf162d459fcc; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE UNIQUE INDEX "IDX_63d7bbae72c767cf162d459fcc" ON n8n_data.user_api_keys USING btree ("userId", label);


--
-- Name: IDX_8e4b4774db42f1e6dda3452b2a; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE INDEX "IDX_8e4b4774db42f1e6dda3452b2a" ON n8n_data.test_case_execution USING btree ("testRunId");


--
-- Name: IDX_97f863fa83c4786f1956508496; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE UNIQUE INDEX "IDX_97f863fa83c4786f1956508496" ON n8n_data.execution_annotations USING btree ("executionId");


--
-- Name: IDX_a3697779b366e131b2bbdae297; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE INDEX "IDX_a3697779b366e131b2bbdae297" ON n8n_data.execution_annotation_tags USING btree ("tagId");


--
-- Name: IDX_ae51b54c4bb430cf92f48b623f; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE UNIQUE INDEX "IDX_ae51b54c4bb430cf92f48b623f" ON n8n_data.annotation_tag_entity USING btree (name);


--
-- Name: IDX_c1519757391996eb06064f0e7c; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE INDEX "IDX_c1519757391996eb06064f0e7c" ON n8n_data.execution_annotation_tags USING btree ("annotationId");


--
-- Name: IDX_cec8eea3bf49551482ccb4933e; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE UNIQUE INDEX "IDX_cec8eea3bf49551482ccb4933e" ON n8n_data.execution_metadata USING btree ("executionId", key);


--
-- Name: IDX_d6870d3b6e4c185d33926f423c; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE INDEX "IDX_d6870d3b6e4c185d33926f423c" ON n8n_data.test_run USING btree ("workflowId");


--
-- Name: IDX_execution_entity_deletedAt; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE INDEX "IDX_execution_entity_deletedAt" ON n8n_data.execution_entity USING btree ("deletedAt");


--
-- Name: IDX_role_scope_scopeSlug; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE INDEX "IDX_role_scope_scopeSlug" ON n8n_data.role_scope USING btree ("scopeSlug");


--
-- Name: IDX_workflow_entity_name; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE INDEX "IDX_workflow_entity_name" ON n8n_data.workflow_entity USING btree (name);


--
-- Name: idx_07fde106c0b471d8cc80a64fc8; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE INDEX idx_07fde106c0b471d8cc80a64fc8 ON n8n_data.credentials_entity USING btree (type);


--
-- Name: idx_16f4436789e804e3e1c9eeb240; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE INDEX idx_16f4436789e804e3e1c9eeb240 ON n8n_data.webhook_entity USING btree ("webhookId", method, "pathLength");


--
-- Name: idx_812eb05f7451ca757fb98444ce; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE UNIQUE INDEX idx_812eb05f7451ca757fb98444ce ON n8n_data.tag_entity USING btree (name);


--
-- Name: idx_execution_entity_stopped_at_status_deleted_at; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE INDEX idx_execution_entity_stopped_at_status_deleted_at ON n8n_data.execution_entity USING btree ("stoppedAt", status, "deletedAt") WHERE (("stoppedAt" IS NOT NULL) AND ("deletedAt" IS NULL));


--
-- Name: idx_execution_entity_wait_till_status_deleted_at; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE INDEX idx_execution_entity_wait_till_status_deleted_at ON n8n_data.execution_entity USING btree ("waitTill", status, "deletedAt") WHERE (("waitTill" IS NOT NULL) AND ("deletedAt" IS NULL));


--
-- Name: idx_execution_entity_workflow_id_started_at; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE INDEX idx_execution_entity_workflow_id_started_at ON n8n_data.execution_entity USING btree ("workflowId", "startedAt") WHERE (("startedAt" IS NOT NULL) AND ("deletedAt" IS NULL));


--
-- Name: idx_workflows_tags_workflow_id; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE INDEX idx_workflows_tags_workflow_id ON n8n_data.workflows_tags USING btree ("workflowId");


--
-- Name: pk_credentials_entity_id; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE UNIQUE INDEX pk_credentials_entity_id ON n8n_data.credentials_entity USING btree (id);


--
-- Name: pk_tag_entity_id; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE UNIQUE INDEX pk_tag_entity_id ON n8n_data.tag_entity USING btree (id);


--
-- Name: pk_variables_id; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE UNIQUE INDEX pk_variables_id ON n8n_data.variables USING btree (id);


--
-- Name: pk_workflow_entity_id; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE UNIQUE INDEX pk_workflow_entity_id ON n8n_data.workflow_entity USING btree (id);


--
-- Name: project_relation_role_idx; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE INDEX project_relation_role_idx ON n8n_data.project_relation USING btree (role);


--
-- Name: project_relation_role_project_idx; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE INDEX project_relation_role_project_idx ON n8n_data.project_relation USING btree ("projectId", role);


--
-- Name: user_role_idx; Type: INDEX; Schema: n8n_data; Owner: -
--

CREATE INDEX user_role_idx ON n8n_data."user" USING btree ("roleSlug");


--
-- Name: assets_conversation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assets_conversation_id_idx ON public.assets USING btree (conversation_id);


--
-- Name: assets_conversation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assets_conversation_idx ON public.assets USING btree (conversation_id);


--
-- Name: assets_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assets_user_id_idx ON public.assets USING btree (user_id);


--
-- Name: assets_version_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assets_version_idx ON public.assets USING btree (deliverable_version_id);


--
-- Name: cidafm_commands_is_builtin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cidafm_commands_is_builtin_idx ON public.cidafm_commands USING btree (is_builtin);


--
-- Name: cidafm_commands_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cidafm_commands_name_idx ON public.cidafm_commands USING btree (name);


--
-- Name: cidafm_commands_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cidafm_commands_type_idx ON public.cidafm_commands USING btree (type);


--
-- Name: conversations_agent_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversations_agent_name_idx ON public.conversations USING btree (agent_name);


--
-- Name: conversations_organization_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversations_organization_slug_idx ON public.conversations USING btree (organization_slug);


--
-- Name: conversations_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversations_user_id_idx ON public.conversations USING btree (user_id);


--
-- Name: deliverable_versions_deliverable_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX deliverable_versions_deliverable_id_idx ON public.deliverable_versions USING btree (deliverable_id);


--
-- Name: deliverables_conversation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX deliverables_conversation_id_idx ON public.deliverables USING btree (conversation_id);


--
-- Name: deliverables_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX deliverables_user_id_idx ON public.deliverables USING btree (user_id);


--
-- Name: human_approvals_conversation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX human_approvals_conversation_idx ON public.human_approvals USING btree (conversation_id);


--
-- Name: human_approvals_organization_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX human_approvals_organization_idx ON public.human_approvals USING btree (organization_slug);


--
-- Name: human_approvals_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX human_approvals_status_idx ON public.human_approvals USING btree (status);


--
-- Name: idx_agent_conversations_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_conversations_user_id ON public.conversations USING btree (user_id);


--
-- Name: idx_agents_agent_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agents_agent_type ON public.agents USING btree (agent_type);


--
-- Name: idx_agents_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agents_created_at ON public.agents USING btree (created_at DESC);


--
-- Name: idx_agents_io_schema; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agents_io_schema ON public.agents USING gin (io_schema);


--
-- Name: idx_agents_org_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agents_org_slug ON public.agents USING btree (organization_slug);


--
-- Name: idx_agents_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agents_slug ON public.agents USING btree (slug);


--
-- Name: idx_conversations_org_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_org_agent ON public.conversations USING btree (organization_slug, agent_name);


--
-- Name: idx_conversations_organization_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_organization_slug ON public.conversations USING btree (organization_slug);


--
-- Name: idx_conversations_work_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_work_product ON public.conversations USING btree (primary_work_product_type, primary_work_product_id);


--
-- Name: idx_deliverables_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deliverables_task_id ON public.deliverables USING btree (task_id) WHERE (task_id IS NOT NULL);


--
-- Name: idx_human_approvals_orch_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_human_approvals_orch_run ON public.human_approvals USING btree (orchestration_run_id);


--
-- Name: idx_human_approvals_orch_step; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_human_approvals_orch_step ON public.human_approvals USING btree (orchestration_step_id);


--
-- Name: idx_llm_usage_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_llm_usage_created_at ON public.llm_usage USING btree (created_at);


--
-- Name: idx_llm_usage_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_llm_usage_run_id ON public.llm_usage USING btree (run_id);


--
-- Name: idx_observability_events_agent_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_observability_events_agent_slug ON public.observability_events USING btree (agent_slug) WHERE (agent_slug IS NOT NULL);


--
-- Name: idx_observability_events_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_observability_events_conversation_id ON public.observability_events USING btree (conversation_id) WHERE (conversation_id IS NOT NULL);


--
-- Name: idx_observability_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_observability_events_created_at ON public.observability_events USING btree (created_at DESC);


--
-- Name: idx_observability_events_hook_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_observability_events_hook_event_type ON public.observability_events USING btree (hook_event_type);


--
-- Name: idx_observability_events_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_observability_events_task_id ON public.observability_events USING btree (task_id) WHERE (task_id IS NOT NULL);


--
-- Name: idx_observability_events_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_observability_events_timestamp ON public.observability_events USING btree ("timestamp" DESC);


--
-- Name: idx_observability_events_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_observability_events_user_id ON public.observability_events USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_org_credentials_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_credentials_org ON public.organization_credentials USING btree (organization_slug);


--
-- Name: idx_organizations_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_created_at ON public.organizations USING btree (created_at DESC);


--
-- Name: idx_organizations_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_name ON public.organizations USING btree (name);


--
-- Name: idx_organizations_settings; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_settings ON public.organizations USING gin (settings);


--
-- Name: idx_plan_deliverables_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_deliverables_plan ON public.plan_deliverables USING btree (plan_id);


--
-- Name: idx_plan_versions_is_current; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_versions_is_current ON public.plan_versions USING btree (is_current_version) WHERE (is_current_version = true);


--
-- Name: idx_plan_versions_plan_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_versions_plan_id ON public.plan_versions USING btree (plan_id);


--
-- Name: idx_plan_versions_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_versions_task_id ON public.plan_versions USING btree (task_id) WHERE (task_id IS NOT NULL);


--
-- Name: idx_plans_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plans_conversation ON public.plans USING btree (conversation_id);


--
-- Name: idx_plans_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plans_conversation_id ON public.plans USING btree (conversation_id);


--
-- Name: idx_plans_org_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plans_org_slug ON public.plans USING btree (organization_slug);


--
-- Name: idx_plans_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plans_user_id ON public.plans USING btree (user_id);


--
-- Name: idx_pseudonym_dictionaries_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pseudonym_dictionaries_agent ON public.pseudonym_dictionaries USING btree (agent_slug);


--
-- Name: idx_pseudonym_dictionaries_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pseudonym_dictionaries_org ON public.pseudonym_dictionaries USING btree (organization_slug);


--
-- Name: idx_pseudonym_dictionaries_original_value; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pseudonym_dictionaries_original_value ON public.pseudonym_dictionaries USING btree (original_value);


--
-- Name: idx_pseudonym_dictionaries_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pseudonym_dictionaries_updated_at ON public.pseudonym_dictionaries USING btree (updated_at);


--
-- Name: idx_rbac_audit_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rbac_audit_actor ON public.rbac_audit_log USING btree (actor_id);


--
-- Name: idx_rbac_audit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rbac_audit_created ON public.rbac_audit_log USING btree (created_at DESC);


--
-- Name: idx_rbac_audit_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rbac_audit_target ON public.rbac_audit_log USING btree (target_user_id);


--
-- Name: idx_redaction_patterns_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redaction_patterns_category ON public.redaction_patterns USING btree (category);


--
-- Name: idx_redaction_patterns_data_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redaction_patterns_data_type ON public.redaction_patterns USING btree (data_type);


--
-- Name: idx_redaction_patterns_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redaction_patterns_is_active ON public.redaction_patterns USING btree (is_active);


--
-- Name: idx_redaction_patterns_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redaction_patterns_severity ON public.redaction_patterns USING btree (severity);


--
-- Name: idx_role_permissions_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permissions_resource ON public.rbac_role_permissions USING btree (resource_type, resource_id) WHERE (resource_type IS NOT NULL);


--
-- Name: idx_role_permissions_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permissions_role ON public.rbac_role_permissions USING btree (role_id);


--
-- Name: idx_task_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_messages_created_at ON public.task_messages USING btree (created_at DESC);


--
-- Name: idx_task_messages_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_messages_task_id ON public.task_messages USING btree (task_id);


--
-- Name: idx_task_messages_task_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_messages_task_id_created_at ON public.task_messages USING btree (task_id, created_at DESC);


--
-- Name: idx_tasks_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_conversation_id ON public.tasks USING btree (conversation_id);


--
-- Name: idx_tasks_hitl_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_hitl_pending ON public.tasks USING btree (hitl_pending, hitl_pending_since DESC) WHERE (hitl_pending = true);


--
-- Name: idx_user_org_roles_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_org_roles_org ON public.rbac_user_org_roles USING btree (organization_slug);


--
-- Name: idx_user_org_roles_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_org_roles_user ON public.rbac_user_org_roles USING btree (user_id);


--
-- Name: idx_user_org_roles_user_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_org_roles_user_org ON public.rbac_user_org_roles USING btree (user_id, organization_slug);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: llm_models_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX llm_models_active_idx ON public.llm_models USING btree (is_active);


--
-- Name: llm_models_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX llm_models_provider_idx ON public.llm_models USING btree (provider_name);


--
-- Name: llm_models_tier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX llm_models_tier_idx ON public.llm_models USING btree (model_tier);


--
-- Name: llm_providers_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX llm_providers_active_idx ON public.llm_providers USING btree (is_active);


--
-- Name: llm_usage_conversation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX llm_usage_conversation_id_idx ON public.llm_usage USING btree (conversation_id);


--
-- Name: llm_usage_model_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX llm_usage_model_idx ON public.llm_usage USING btree (model_name);


--
-- Name: llm_usage_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX llm_usage_provider_idx ON public.llm_usage USING btree (provider_name);


--
-- Name: llm_usage_route_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX llm_usage_route_idx ON public.llm_usage USING btree (route);


--
-- Name: llm_usage_route_started_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX llm_usage_route_started_at_idx ON public.llm_usage USING btree (route, started_at DESC);


--
-- Name: llm_usage_run_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX llm_usage_run_id_unique ON public.llm_usage USING btree (run_id);


--
-- Name: llm_usage_started_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX llm_usage_started_at_idx ON public.llm_usage USING btree (started_at);


--
-- Name: llm_usage_total_cost_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX llm_usage_total_cost_idx ON public.llm_usage USING btree (total_cost) WHERE (total_cost IS NOT NULL);


--
-- Name: llm_usage_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX llm_usage_user_id_idx ON public.llm_usage USING btree (user_id);


--
-- Name: observability_events_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX observability_events_created_at_idx ON public.observability_events USING btree (created_at);


--
-- Name: observability_events_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX observability_events_source_idx ON public.observability_events USING btree (source_app);


--
-- Name: org_credentials_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_credentials_org_idx ON public.organization_credentials USING btree (organization_slug);


--
-- Name: plan_deliverables_plan_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX plan_deliverables_plan_id_idx ON public.plan_deliverables USING btree (plan_id);


--
-- Name: plan_versions_plan_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX plan_versions_plan_id_idx ON public.plan_versions USING btree (plan_id);


--
-- Name: plans_conversation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX plans_conversation_id_idx ON public.plans USING btree (conversation_id);


--
-- Name: plans_organization_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX plans_organization_idx ON public.plans USING btree (organization_slug);


--
-- Name: plans_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX plans_user_id_idx ON public.plans USING btree (user_id);


--
-- Name: task_messages_task_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_messages_task_id_idx ON public.task_messages USING btree (task_id);


--
-- Name: tasks_conversation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tasks_conversation_id_idx ON public.tasks USING btree (conversation_id);


--
-- Name: tasks_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tasks_status_idx ON public.tasks USING btree (status);


--
-- Name: tasks_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tasks_user_id_idx ON public.tasks USING btree (user_id);


--
-- Name: user_cidafm_commands_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_cidafm_commands_user_idx ON public.user_cidafm_commands USING btree (user_id);


--
-- Name: users_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_email_idx ON public.users USING btree (email);


--
-- Name: users_organization_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_organization_slug_idx ON public.users USING btree (organization_slug);


--
-- Name: users_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_status_idx ON public.users USING btree (status);


--
-- Name: idx_rag_chunks_collection; Type: INDEX; Schema: rag_data; Owner: -
--

CREATE INDEX idx_rag_chunks_collection ON rag_data.rag_document_chunks USING btree (collection_id);


--
-- Name: idx_rag_chunks_document; Type: INDEX; Schema: rag_data; Owner: -
--

CREATE INDEX idx_rag_chunks_document ON rag_data.rag_document_chunks USING btree (document_id);


--
-- Name: idx_rag_chunks_embedding; Type: INDEX; Schema: rag_data; Owner: -
--

CREATE INDEX idx_rag_chunks_embedding ON rag_data.rag_document_chunks USING hnsw (embedding rag_data.vector_cosine_ops) WITH (m='16', ef_construction='64');


--
-- Name: INDEX idx_rag_chunks_embedding; Type: COMMENT; Schema: rag_data; Owner: -
--

COMMENT ON INDEX rag_data.idx_rag_chunks_embedding IS 'HNSW index for fast vector similarity search (PRD §4.3.3)';


--
-- Name: idx_rag_chunks_org; Type: INDEX; Schema: rag_data; Owner: -
--

CREATE INDEX idx_rag_chunks_org ON rag_data.rag_document_chunks USING btree (organization_slug);


--
-- Name: idx_rag_collections_allowed_users; Type: INDEX; Schema: rag_data; Owner: -
--

CREATE INDEX idx_rag_collections_allowed_users ON rag_data.rag_collections USING gin (allowed_users);


--
-- Name: idx_rag_collections_org; Type: INDEX; Schema: rag_data; Owner: -
--

CREATE INDEX idx_rag_collections_org ON rag_data.rag_collections USING btree (organization_slug);


--
-- Name: idx_rag_collections_org_slug; Type: INDEX; Schema: rag_data; Owner: -
--

CREATE INDEX idx_rag_collections_org_slug ON rag_data.rag_collections USING btree (organization_slug, slug);


--
-- Name: idx_rag_collections_status; Type: INDEX; Schema: rag_data; Owner: -
--

CREATE INDEX idx_rag_collections_status ON rag_data.rag_collections USING btree (status);


--
-- Name: idx_rag_documents_collection; Type: INDEX; Schema: rag_data; Owner: -
--

CREATE INDEX idx_rag_documents_collection ON rag_data.rag_documents USING btree (collection_id);


--
-- Name: idx_rag_documents_hash; Type: INDEX; Schema: rag_data; Owner: -
--

CREATE INDEX idx_rag_documents_hash ON rag_data.rag_documents USING btree (file_hash);


--
-- Name: idx_rag_documents_org; Type: INDEX; Schema: rag_data; Owner: -
--

CREATE INDEX idx_rag_documents_org ON rag_data.rag_documents USING btree (organization_slug);


--
-- Name: idx_rag_documents_status; Type: INDEX; Schema: rag_data; Owner: -
--

CREATE INDEX idx_rag_documents_status ON rag_data.rag_documents USING btree (status);


--
-- Name: llm_models llm_models_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER llm_models_updated_at BEFORE UPDATE ON public.llm_models FOR EACH ROW EXECUTE FUNCTION public.update_llm_models_updated_at();


--
-- Name: llm_providers llm_providers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER llm_providers_updated_at BEFORE UPDATE ON public.llm_providers FOR EACH ROW EXECUTE FUNCTION public.update_llm_providers_updated_at();


--
-- Name: rbac_roles rbac_roles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER rbac_roles_updated_at BEFORE UPDATE ON public.rbac_roles FOR EACH ROW EXECUTE FUNCTION public.update_rbac_roles_updated_at();


--
-- Name: agents set_agents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_agents_updated_at BEFORE UPDATE ON public.agents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: organizations set_organizations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: assets set_timestamp_updated_at_assets; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_timestamp_updated_at_assets BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.set_timestamp_updated_at();


--
-- Name: human_approvals set_timestamp_updated_at_human_approvals; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_timestamp_updated_at_human_approvals BEFORE UPDATE ON public.human_approvals FOR EACH ROW EXECUTE FUNCTION public.set_timestamp_updated_at();


--
-- Name: plans trigger_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_plans_updated_at();


--
-- Name: redaction_patterns update_redaction_patterns_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_redaction_patterns_updated_at BEFORE UPDATE ON public.redaction_patterns FOR EACH ROW EXECUTE FUNCTION public.update_redaction_patterns_updated_at();


--
-- Name: users users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_users_updated_at();


--
-- Name: rag_collections set_collections_updated_at; Type: TRIGGER; Schema: rag_data; Owner: -
--

CREATE TRIGGER set_collections_updated_at BEFORE UPDATE ON rag_data.rag_collections FOR EACH ROW EXECUTE FUNCTION rag_data.set_updated_at();


--
-- Name: rag_documents set_documents_updated_at; Type: TRIGGER; Schema: rag_data; Owner: -
--

CREATE TRIGGER set_documents_updated_at BEFORE UPDATE ON rag_data.rag_documents FOR EACH ROW EXECUTE FUNCTION rag_data.set_updated_at();


--
-- Name: processed_data FK_06a69a7032c97a763c2c7599464; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.processed_data
    ADD CONSTRAINT "FK_06a69a7032c97a763c2c7599464" FOREIGN KEY ("workflowId") REFERENCES n8n_data.workflow_entity(id) ON DELETE CASCADE;


--
-- Name: insights_metadata FK_1d8ab99d5861c9388d2dc1cf733; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.insights_metadata
    ADD CONSTRAINT "FK_1d8ab99d5861c9388d2dc1cf733" FOREIGN KEY ("workflowId") REFERENCES n8n_data.workflow_entity(id) ON DELETE SET NULL;


--
-- Name: workflow_history FK_1e31657f5fe46816c34be7c1b4b; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.workflow_history
    ADD CONSTRAINT "FK_1e31657f5fe46816c34be7c1b4b" FOREIGN KEY ("workflowId") REFERENCES n8n_data.workflow_entity(id) ON DELETE CASCADE;


--
-- Name: insights_metadata FK_2375a1eda085adb16b24615b69c; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.insights_metadata
    ADD CONSTRAINT "FK_2375a1eda085adb16b24615b69c" FOREIGN KEY ("projectId") REFERENCES n8n_data.project(id) ON DELETE SET NULL;


--
-- Name: execution_metadata FK_31d0b4c93fb85ced26f6005cda3; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.execution_metadata
    ADD CONSTRAINT "FK_31d0b4c93fb85ced26f6005cda3" FOREIGN KEY ("executionId") REFERENCES n8n_data.execution_entity(id) ON DELETE CASCADE;


--
-- Name: shared_credentials FK_416f66fc846c7c442970c094ccf; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.shared_credentials
    ADD CONSTRAINT "FK_416f66fc846c7c442970c094ccf" FOREIGN KEY ("credentialsId") REFERENCES n8n_data.credentials_entity(id) ON DELETE CASCADE;


--
-- Name: project_relation FK_5f0643f6717905a05164090dde7; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.project_relation
    ADD CONSTRAINT "FK_5f0643f6717905a05164090dde7" FOREIGN KEY ("userId") REFERENCES n8n_data."user"(id) ON DELETE CASCADE;


--
-- Name: project_relation FK_61448d56d61802b5dfde5cdb002; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.project_relation
    ADD CONSTRAINT "FK_61448d56d61802b5dfde5cdb002" FOREIGN KEY ("projectId") REFERENCES n8n_data.project(id) ON DELETE CASCADE;


--
-- Name: insights_by_period FK_6414cfed98daabbfdd61a1cfbc0; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.insights_by_period
    ADD CONSTRAINT "FK_6414cfed98daabbfdd61a1cfbc0" FOREIGN KEY ("metaId") REFERENCES n8n_data.insights_metadata("metaId") ON DELETE CASCADE;


--
-- Name: insights_raw FK_6e2e33741adef2a7c5d66befa4e; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.insights_raw
    ADD CONSTRAINT "FK_6e2e33741adef2a7c5d66befa4e" FOREIGN KEY ("metaId") REFERENCES n8n_data.insights_metadata("metaId") ON DELETE CASCADE;


--
-- Name: installed_nodes FK_73f857fc5dce682cef8a99c11dbddbc969618951; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.installed_nodes
    ADD CONSTRAINT "FK_73f857fc5dce682cef8a99c11dbddbc969618951" FOREIGN KEY (package) REFERENCES n8n_data.installed_packages("packageName") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: folder FK_804ea52f6729e3940498bd54d78; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.folder
    ADD CONSTRAINT "FK_804ea52f6729e3940498bd54d78" FOREIGN KEY ("parentFolderId") REFERENCES n8n_data.folder(id) ON DELETE CASCADE;


--
-- Name: shared_credentials FK_812c2852270da1247756e77f5a4; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.shared_credentials
    ADD CONSTRAINT "FK_812c2852270da1247756e77f5a4" FOREIGN KEY ("projectId") REFERENCES n8n_data.project(id) ON DELETE CASCADE;


--
-- Name: test_case_execution FK_8e4b4774db42f1e6dda3452b2af; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.test_case_execution
    ADD CONSTRAINT "FK_8e4b4774db42f1e6dda3452b2af" FOREIGN KEY ("testRunId") REFERENCES n8n_data.test_run(id) ON DELETE CASCADE;


--
-- Name: data_table_column FK_930b6e8faaf88294cef23484160; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.data_table_column
    ADD CONSTRAINT "FK_930b6e8faaf88294cef23484160" FOREIGN KEY ("dataTableId") REFERENCES n8n_data.data_table(id) ON DELETE CASCADE;


--
-- Name: folder_tag FK_94a60854e06f2897b2e0d39edba; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.folder_tag
    ADD CONSTRAINT "FK_94a60854e06f2897b2e0d39edba" FOREIGN KEY ("folderId") REFERENCES n8n_data.folder(id) ON DELETE CASCADE;


--
-- Name: execution_annotations FK_97f863fa83c4786f19565084960; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.execution_annotations
    ADD CONSTRAINT "FK_97f863fa83c4786f19565084960" FOREIGN KEY ("executionId") REFERENCES n8n_data.execution_entity(id) ON DELETE CASCADE;


--
-- Name: execution_annotation_tags FK_a3697779b366e131b2bbdae2976; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.execution_annotation_tags
    ADD CONSTRAINT "FK_a3697779b366e131b2bbdae2976" FOREIGN KEY ("tagId") REFERENCES n8n_data.annotation_tag_entity(id) ON DELETE CASCADE;


--
-- Name: shared_workflow FK_a45ea5f27bcfdc21af9b4188560; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.shared_workflow
    ADD CONSTRAINT "FK_a45ea5f27bcfdc21af9b4188560" FOREIGN KEY ("projectId") REFERENCES n8n_data.project(id) ON DELETE CASCADE;


--
-- Name: folder FK_a8260b0b36939c6247f385b8221; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.folder
    ADD CONSTRAINT "FK_a8260b0b36939c6247f385b8221" FOREIGN KEY ("projectId") REFERENCES n8n_data.project(id) ON DELETE CASCADE;


--
-- Name: execution_annotation_tags FK_c1519757391996eb06064f0e7c8; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.execution_annotation_tags
    ADD CONSTRAINT "FK_c1519757391996eb06064f0e7c8" FOREIGN KEY ("annotationId") REFERENCES n8n_data.execution_annotations(id) ON DELETE CASCADE;


--
-- Name: data_table FK_c2a794257dee48af7c9abf681de; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.data_table
    ADD CONSTRAINT "FK_c2a794257dee48af7c9abf681de" FOREIGN KEY ("projectId") REFERENCES n8n_data.project(id) ON DELETE CASCADE;


--
-- Name: project_relation FK_c6b99592dc96b0d836d7a21db91; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.project_relation
    ADD CONSTRAINT "FK_c6b99592dc96b0d836d7a21db91" FOREIGN KEY (role) REFERENCES n8n_data.role(slug);


--
-- Name: test_run FK_d6870d3b6e4c185d33926f423c8; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.test_run
    ADD CONSTRAINT "FK_d6870d3b6e4c185d33926f423c8" FOREIGN KEY ("workflowId") REFERENCES n8n_data.workflow_entity(id) ON DELETE CASCADE;


--
-- Name: shared_workflow FK_daa206a04983d47d0a9c34649ce; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.shared_workflow
    ADD CONSTRAINT "FK_daa206a04983d47d0a9c34649ce" FOREIGN KEY ("workflowId") REFERENCES n8n_data.workflow_entity(id) ON DELETE CASCADE;


--
-- Name: folder_tag FK_dc88164176283de80af47621746; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.folder_tag
    ADD CONSTRAINT "FK_dc88164176283de80af47621746" FOREIGN KEY ("tagId") REFERENCES n8n_data.tag_entity(id) ON DELETE CASCADE;


--
-- Name: user_api_keys FK_e131705cbbc8fb589889b02d457; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.user_api_keys
    ADD CONSTRAINT "FK_e131705cbbc8fb589889b02d457" FOREIGN KEY ("userId") REFERENCES n8n_data."user"(id) ON DELETE CASCADE;


--
-- Name: test_case_execution FK_e48965fac35d0f5b9e7f51d8c44; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.test_case_execution
    ADD CONSTRAINT "FK_e48965fac35d0f5b9e7f51d8c44" FOREIGN KEY ("executionId") REFERENCES n8n_data.execution_entity(id) ON DELETE SET NULL;


--
-- Name: user FK_eaea92ee7bfb9c1b6cd01505d56; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data."user"
    ADD CONSTRAINT "FK_eaea92ee7bfb9c1b6cd01505d56" FOREIGN KEY ("roleSlug") REFERENCES n8n_data.role(slug);


--
-- Name: role_scope FK_role; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.role_scope
    ADD CONSTRAINT "FK_role" FOREIGN KEY ("roleSlug") REFERENCES n8n_data.role(slug) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: role_scope FK_scope; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.role_scope
    ADD CONSTRAINT "FK_scope" FOREIGN KEY ("scopeSlug") REFERENCES n8n_data.scope(slug) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: auth_identity auth_identity_userId_fkey; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.auth_identity
    ADD CONSTRAINT "auth_identity_userId_fkey" FOREIGN KEY ("userId") REFERENCES n8n_data."user"(id);


--
-- Name: execution_data execution_data_fk; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.execution_data
    ADD CONSTRAINT execution_data_fk FOREIGN KEY ("executionId") REFERENCES n8n_data.execution_entity(id) ON DELETE CASCADE;


--
-- Name: execution_entity fk_execution_entity_workflow_id; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.execution_entity
    ADD CONSTRAINT fk_execution_entity_workflow_id FOREIGN KEY ("workflowId") REFERENCES n8n_data.workflow_entity(id) ON DELETE CASCADE;


--
-- Name: webhook_entity fk_webhook_entity_workflow_id; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.webhook_entity
    ADD CONSTRAINT fk_webhook_entity_workflow_id FOREIGN KEY ("workflowId") REFERENCES n8n_data.workflow_entity(id) ON DELETE CASCADE;


--
-- Name: workflow_entity fk_workflow_parent_folder; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.workflow_entity
    ADD CONSTRAINT fk_workflow_parent_folder FOREIGN KEY ("parentFolderId") REFERENCES n8n_data.folder(id) ON DELETE CASCADE;


--
-- Name: workflow_statistics fk_workflow_statistics_workflow_id; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.workflow_statistics
    ADD CONSTRAINT fk_workflow_statistics_workflow_id FOREIGN KEY ("workflowId") REFERENCES n8n_data.workflow_entity(id) ON DELETE CASCADE;


--
-- Name: workflows_tags fk_workflows_tags_tag_id; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.workflows_tags
    ADD CONSTRAINT fk_workflows_tags_tag_id FOREIGN KEY ("tagId") REFERENCES n8n_data.tag_entity(id) ON DELETE CASCADE;


--
-- Name: workflows_tags fk_workflows_tags_workflow_id; Type: FK CONSTRAINT; Schema: n8n_data; Owner: -
--

ALTER TABLE ONLY n8n_data.workflows_tags
    ADD CONSTRAINT fk_workflows_tags_workflow_id FOREIGN KEY ("workflowId") REFERENCES n8n_data.workflow_entity(id) ON DELETE CASCADE;


--
-- Name: conversations agent_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT agent_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: assets assets_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;


--
-- Name: assets assets_deliverable_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_deliverable_version_id_fkey FOREIGN KEY (deliverable_version_id) REFERENCES public.deliverable_versions(id) ON DELETE SET NULL;


--
-- Name: assets assets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: deliverable_versions deliverable_versions_deliverable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliverable_versions
    ADD CONSTRAINT deliverable_versions_deliverable_id_fkey FOREIGN KEY (deliverable_id) REFERENCES public.deliverables(id) ON DELETE CASCADE;


--
-- Name: deliverable_versions deliverable_versions_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliverable_versions
    ADD CONSTRAINT deliverable_versions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;


--
-- Name: deliverables deliverables_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliverables
    ADD CONSTRAINT deliverables_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id);


--
-- Name: deliverables deliverables_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliverables
    ADD CONSTRAINT deliverables_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: plans fk_plans_current_version; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT fk_plans_current_version FOREIGN KEY (current_version_id) REFERENCES public.plan_versions(id) ON DELETE SET NULL;


--
-- Name: human_approvals human_approvals_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.human_approvals
    ADD CONSTRAINT human_approvals_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;


--
-- Name: human_approvals human_approvals_organization_slug_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.human_approvals
    ADD CONSTRAINT human_approvals_organization_slug_fkey FOREIGN KEY (organization_slug) REFERENCES public.organizations(slug) ON DELETE CASCADE;


--
-- Name: llm_models llm_models_provider_name_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_models
    ADD CONSTRAINT llm_models_provider_name_fkey FOREIGN KEY (provider_name) REFERENCES public.llm_providers(name) ON DELETE CASCADE;


--
-- Name: llm_usage llm_usage_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_usage
    ADD CONSTRAINT llm_usage_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id);


--
-- Name: llm_usage llm_usage_provider_name_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_usage
    ADD CONSTRAINT llm_usage_provider_name_fkey FOREIGN KEY (provider_name) REFERENCES public.llm_providers(name) ON DELETE SET NULL;


--
-- Name: llm_usage llm_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_usage
    ADD CONSTRAINT llm_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: observability_events observability_events_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observability_events
    ADD CONSTRAINT observability_events_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;


--
-- Name: observability_events observability_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observability_events
    ADD CONSTRAINT observability_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: organization_credentials organization_credentials_organization_slug_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_credentials
    ADD CONSTRAINT organization_credentials_organization_slug_fkey FOREIGN KEY (organization_slug) REFERENCES public.organizations(slug) ON DELETE CASCADE;


--
-- Name: plan_deliverables plan_deliverables_deliverable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_deliverables
    ADD CONSTRAINT plan_deliverables_deliverable_id_fkey FOREIGN KEY (deliverable_id) REFERENCES public.deliverables(id) ON DELETE SET NULL;


--
-- Name: plan_deliverables plan_deliverables_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_deliverables
    ADD CONSTRAINT plan_deliverables_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE CASCADE;


--
-- Name: plan_versions plan_versions_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_versions
    ADD CONSTRAINT plan_versions_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: plan_versions plan_versions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_versions
    ADD CONSTRAINT plan_versions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE CASCADE;


--
-- Name: plan_versions plan_versions_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_versions
    ADD CONSTRAINT plan_versions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;


--
-- Name: plans plans_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: plans plans_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: plans plans_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: plans plans_organization_slug_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_organization_slug_fkey FOREIGN KEY (organization_slug) REFERENCES public.organizations(slug) ON DELETE SET NULL;


--
-- Name: plans plans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: rbac_audit_log rbac_audit_log_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_audit_log
    ADD CONSTRAINT rbac_audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id);


--
-- Name: rbac_audit_log rbac_audit_log_target_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_audit_log
    ADD CONSTRAINT rbac_audit_log_target_role_id_fkey FOREIGN KEY (target_role_id) REFERENCES public.rbac_roles(id);


--
-- Name: rbac_audit_log rbac_audit_log_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_audit_log
    ADD CONSTRAINT rbac_audit_log_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES auth.users(id);


--
-- Name: rbac_role_permissions rbac_role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_role_permissions
    ADD CONSTRAINT rbac_role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.rbac_permissions(id) ON DELETE CASCADE;


--
-- Name: rbac_role_permissions rbac_role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_role_permissions
    ADD CONSTRAINT rbac_role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.rbac_roles(id) ON DELETE CASCADE;


--
-- Name: rbac_user_org_roles rbac_user_org_roles_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_user_org_roles
    ADD CONSTRAINT rbac_user_org_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id);


--
-- Name: rbac_user_org_roles rbac_user_org_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_user_org_roles
    ADD CONSTRAINT rbac_user_org_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.rbac_roles(id) ON DELETE CASCADE;


--
-- Name: rbac_user_org_roles rbac_user_org_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_user_org_roles
    ADD CONSTRAINT rbac_user_org_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: task_messages task_messages_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_messages
    ADD CONSTRAINT task_messages_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_messages task_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_messages
    ADD CONSTRAINT task_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id);


--
-- Name: tasks tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_cidafm_commands user_cidafm_commands_command_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_cidafm_commands
    ADD CONSTRAINT user_cidafm_commands_command_id_fkey FOREIGN KEY (command_id) REFERENCES public.cidafm_commands(id) ON DELETE CASCADE;


--
-- Name: user_cidafm_commands user_cidafm_commands_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_cidafm_commands
    ADD CONSTRAINT user_cidafm_commands_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: users users_organization_slug_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_slug_fkey FOREIGN KEY (organization_slug) REFERENCES public.organizations(slug) ON DELETE SET NULL;


--
-- Name: rag_document_chunks rag_document_chunks_collection_id_fkey; Type: FK CONSTRAINT; Schema: rag_data; Owner: -
--

ALTER TABLE ONLY rag_data.rag_document_chunks
    ADD CONSTRAINT rag_document_chunks_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES rag_data.rag_collections(id) ON DELETE CASCADE;


--
-- Name: rag_document_chunks rag_document_chunks_document_id_fkey; Type: FK CONSTRAINT; Schema: rag_data; Owner: -
--

ALTER TABLE ONLY rag_data.rag_document_chunks
    ADD CONSTRAINT rag_document_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES rag_data.rag_documents(id) ON DELETE CASCADE;


--
-- Name: rag_documents rag_documents_collection_id_fkey; Type: FK CONSTRAINT; Schema: rag_data; Owner: -
--

ALTER TABLE ONLY rag_data.rag_documents
    ADD CONSTRAINT rag_documents_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES rag_data.rag_collections(id) ON DELETE CASCADE;


--
-- Name: agents Users can read agents in their organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read agents in their organizations" ON public.agents FOR SELECT USING (true);


--
-- Name: organizations Users can read their organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read their organizations" ON public.organizations FOR SELECT USING (true);


--
-- Name: agents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plan_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_versions plan_versions_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plan_versions_delete_policy ON public.plan_versions FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.plans
  WHERE ((plans.id = plan_versions.plan_id) AND (plans.user_id = auth.uid())))));


--
-- Name: plan_versions plan_versions_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plan_versions_insert_policy ON public.plan_versions FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.plans
  WHERE ((plans.id = plan_versions.plan_id) AND (plans.user_id = auth.uid())))));


--
-- Name: plan_versions plan_versions_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plan_versions_select_policy ON public.plan_versions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.plans
  WHERE ((plans.id = plan_versions.plan_id) AND (plans.user_id = auth.uid())))));


--
-- Name: plan_versions plan_versions_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plan_versions_update_policy ON public.plan_versions FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.plans
  WHERE ((plans.id = plan_versions.plan_id) AND (plans.user_id = auth.uid())))));


--
-- Name: plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

--
-- Name: plans plans_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plans_delete_policy ON public.plans FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: plans plans_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plans_insert_policy ON public.plans FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: plans plans_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plans_select_policy ON public.plans FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: plans plans_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plans_update_policy ON public.plans FOR UPDATE USING ((auth.uid() = user_id));


--
-- PostgreSQL database dump complete
--

