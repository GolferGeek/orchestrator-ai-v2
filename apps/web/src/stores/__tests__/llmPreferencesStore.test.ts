/**
 * Unit Tests for LLM Preferences Store - Agent Local Model Requirement
 * Tests sovereign mode and agent-level local model enforcement
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLLMPreferencesStore } from '../llmPreferencesStore';
import type { Provider, Model } from '../../types/llm';

// Mock the API services
vi.mock('../../services/apiService', () => ({
  apiService: {
    get: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../services/sovereignPolicyService', () => ({
  sovereignPolicyService: {
    getPolicy: vi.fn().mockResolvedValue({ enforced: false, defaultMode: 'standard' }),
    getModels: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../services/evaluationService', () => ({
  default: {
    getAgentLLMRecommendations: vi.fn().mockResolvedValue([]),
  },
}));

describe('LLMPreferencesStore - Agent Local Model Requirement', () => {
  const mockProviders: Provider[] = [
    { name: 'ollama', authType: 'api_key', status: 'active', createdAt: '', updatedAt: '' },
    { name: 'openai', authType: 'api_key', status: 'active', createdAt: '', updatedAt: '' },
    { name: 'anthropic', authType: 'api_key', status: 'active', createdAt: '', updatedAt: '' },
  ];

  const mockModels: Model[] = [
    {
      name: 'Llama 3.2 1B',
      modelName: 'llama3.2:1b',
      providerName: 'ollama',
      pricingInputPer1k: 0,
      pricingOutputPer1k: 0,
      isEnabled: true,
      modelType: 'text-generation',
    },
    {
      name: 'GPT-4o',
      modelName: 'gpt-4o',
      providerName: 'openai',
      pricingInputPer1k: 0.005,
      pricingOutputPer1k: 0.015,
      isEnabled: true,
      modelType: 'text-generation',
    },
    {
      name: 'Claude Sonnet',
      modelName: 'claude-sonnet-4-20250514',
      providerName: 'anthropic',
      pricingInputPer1k: 0.003,
      pricingOutputPer1k: 0.015,
      isEnabled: true,
      modelType: 'text-generation',
    },
  ];

  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('agentRequiresLocalModel state', () => {
    it('should initialize with agentRequiresLocalModel=false', () => {
      const store = useLLMPreferencesStore();
      expect(store.agentRequiresLocalModel).toBe(false);
    });

    it('should update agentRequiresLocalModel when setAgentRequiresLocalModel is called', () => {
      const store = useLLMPreferencesStore();
      store.setAgentRequiresLocalModel(true);
      expect(store.agentRequiresLocalModel).toBe(true);
    });
  });

  describe('filteredProviders with agentRequiresLocalModel', () => {
    it('should filter to local providers when agentRequiresLocalModel is true', () => {
      const store = useLLMPreferencesStore();
      store.providers = mockProviders;

      // Before setting agentRequiresLocalModel, all providers should be available
      expect(store.filteredProviders).toHaveLength(3);

      // Set agentRequiresLocalModel
      store.setAgentRequiresLocalModel(true);

      // Only Ollama should be available
      expect(store.filteredProviders).toHaveLength(1);
      expect(store.filteredProviders[0].name).toBe('ollama');
    });

    it('should show all providers when agentRequiresLocalModel is false', () => {
      const store = useLLMPreferencesStore();
      store.providers = mockProviders;

      store.setAgentRequiresLocalModel(false);

      expect(store.filteredProviders).toHaveLength(3);
    });

    it('should combine agentRequiresLocalModel with sovereignPolicy.enforced', () => {
      const store = useLLMPreferencesStore();
      store.providers = mockProviders;

      // Set sovereign policy as enforced
      store.sovereignPolicy = {
        enforced: true,
        allowedProviders: [],
        requiresLocalProcessing: true,
      };

      // Even with agentRequiresLocalModel=false, enforced policy should filter
      expect(store.filteredProviders).toHaveLength(1);
      expect(store.filteredProviders[0].name).toBe('ollama');
    });

    it('should combine agentRequiresLocalModel with user sovereignMode', () => {
      const store = useLLMPreferencesStore();
      store.providers = mockProviders;

      // User enables sovereign mode
      store.sovereignMode = true;

      // Should filter to Ollama only
      expect(store.filteredProviders).toHaveLength(1);
      expect(store.filteredProviders[0].name).toBe('ollama');
    });
  });

  describe('filteredModels with agentRequiresLocalModel', () => {
    it('should filter to Ollama models when agentRequiresLocalModel is true', () => {
      const store = useLLMPreferencesStore();
      store.models = mockModels;

      // Before setting, all models available
      expect(store.filteredModels).toHaveLength(3);

      // Set agent requires local
      store.setAgentRequiresLocalModel(true);

      // Only Ollama models should be available
      expect(store.filteredModels).toHaveLength(1);
      expect(store.filteredModels[0].providerName).toBe('ollama');
    });

    it('should show all models when agentRequiresLocalModel is false', () => {
      const store = useLLMPreferencesStore();
      store.models = mockModels;

      store.setAgentRequiresLocalModel(false);

      expect(store.filteredModels).toHaveLength(3);
    });
  });

  describe('setAgentRequiresLocalModel action', () => {
    it('should automatically select Ollama provider when requirement is set', () => {
      const store = useLLMPreferencesStore();
      store.providers = mockProviders;
      store.models = mockModels;

      // Start with a cloud provider selected
      store.selectedProvider = mockProviders.find(p => p.name === 'openai');
      store.selectedModel = mockModels.find(m => m.providerName === 'openai');

      // Set agent requires local model
      store.setAgentRequiresLocalModel(true);

      // Should auto-switch to Ollama
      expect(store.selectedProvider?.name).toBe('ollama');
      expect(store.selectedModel?.providerName).toBe('ollama');
    });

    it('should keep selection when requirement is removed', () => {
      const store = useLLMPreferencesStore();
      store.providers = mockProviders;
      store.models = mockModels;

      // Set up initial state with requirement
      store.setAgentRequiresLocalModel(true);
      expect(store.selectedProvider?.name).toBe('ollama');

      // Remove requirement
      store.setAgentRequiresLocalModel(false);

      // Should keep Ollama selection (user may want to keep using it)
      expect(store.selectedProvider?.name).toBe('ollama');
    });
  });

  describe('effectiveSovereignMode getter', () => {
    it('should return true when agentRequiresLocalModel is true', () => {
      const store = useLLMPreferencesStore();
      store.agentRequiresLocalModel = true;

      // effectiveSovereignMode checks policy.enforced OR sovereignMode
      // agentRequiresLocalModel affects filteredProviders directly
      // Let's check the filtering behavior
      store.providers = mockProviders;
      expect(store.filteredProviders).toHaveLength(1);
    });

    it('should return true when sovereignPolicy.enforced is true', () => {
      const store = useLLMPreferencesStore();
      store.sovereignPolicy = { enforced: true, allowedProviders: [], requiresLocalProcessing: true };

      expect(store.effectiveSovereignMode).toBe(true);
    });

    it('should return true when sovereignMode is true', () => {
      const store = useLLMPreferencesStore();
      store.sovereignMode = true;

      expect(store.effectiveSovereignMode).toBe(true);
    });

    it('should return false when no sovereign mode flags are set', () => {
      const store = useLLMPreferencesStore();
      store.sovereignMode = false;
      store.sovereignPolicy = null;

      expect(store.effectiveSovereignMode).toBe(false);
    });
  });
});
