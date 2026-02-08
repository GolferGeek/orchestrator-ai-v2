/**
 * Shared test environment helper for LangGraph e2e tests.
 *
 * Throws immediately if a required env var is missing.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} environment variable is required for tests. ` +
        'Ensure it is set in the root .env file.',
    );
  }
  return value;
}

/** LangGraph URL — reads LANGGRAPH_URL or builds from LANGGRAPH_PORT */
export function getLanggraphUrl(): string {
  if (process.env.LANGGRAPH_URL) return process.env.LANGGRAPH_URL;
  const port = process.env.LANGGRAPH_PORT;
  if (!port) {
    throw new Error(
      'LANGGRAPH_URL or LANGGRAPH_PORT environment variable is required for tests. ' +
        'Ensure it is set in the root .env file.',
    );
  }
  return `http://127.0.0.1:${port}`;
}

/** Supabase URL */
export function getSupabaseUrl(): string {
  return requireEnv('SUPABASE_URL');
}

/** Supabase service-role key */
export function getSupabaseServiceKey(): string {
  return requireEnv('SUPABASE_SERVICE_ROLE_KEY');
}

/** API URL (for webhook callbacks etc.) */
export function getApiUrl(): string {
  const url = process.env.API_URL || process.env.API_BASE_URL;
  if (!url) {
    throw new Error(
      'API_URL environment variable is required for tests. ' +
        'Ensure it is set in the root .env file.',
    );
  }
  return url;
}
