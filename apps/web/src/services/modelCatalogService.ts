import apiService from './apiService';

export interface ProviderWithModels {
  id: string;
  name: string; // provider name like 'openai', 'ollama'
  display_name?: string;
  is_local?: boolean; // whether this provider runs locally (e.g., Ollama)
  is_active?: boolean; // whether the provider is enabled
  models: Array<{
    providerName: string;
    modelName: string; // API model name like 'o4-mini', 'gpt-oss:220b'
    displayName?: string;
    model_name?: string; // alias for modelName
    display_name?: string; // alias for displayName
    is_active?: boolean;
    model_tier?: string;
    context_window?: number;
  }>;
}

export async function fetchProvidersWithModels(options: { status?: 'active' | 'inactive' | 'deprecated'; sovereignMode?: boolean } = {}) {
  const params = new URLSearchParams();
  if (options.status) params.set('status', options.status);
  if (typeof options.sovereignMode === 'boolean') params.set('sovereign_mode', String(options.sovereignMode));
  const url = `/providers/with-models${params.toString() ? `?${params.toString()}` : ''}`;
  console.log('📡 Fetching providers from:', url);
  try {
    const data = await apiService.get<ProviderWithModels[]>(url, { suppressErrors: true });
    console.log('✅ Received providers:', data);
    return data;
  } catch (error) {
    console.error('❌ Failed to fetch providers:', error);
    // Graceful fallback on error
    return [];
  }
}
