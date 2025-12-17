/**
 * LLM Service
 *
 * Handles fetching LLM providers and models with pricing from the API.
 * Used for populating provider/model selection dropdowns in the UI.
 */

import { apiService } from './apiService';

export interface LLMProvider {
  name: string;
  displayName: string;
  isLocal: boolean;
}

export interface LLMModel {
  provider: string;
  model: string;
  displayName: string;
  inputPer1k: number;
  outputPer1k: number;
  modelTier: string;
  speedTier: string;
  isLocal: boolean;
}

class LLMService {
  /**
   * Get all active LLM providers
   */
  async getProviders(): Promise<LLMProvider[]> {
    return apiService.get<LLMProvider[]>('/llm/providers');
  }

  /**
   * Get all models with pricing, optionally filtered by provider
   */
  async getModels(provider?: string): Promise<LLMModel[]> {
    const url = provider ? `/llm/models?provider=${encodeURIComponent(provider)}` : '/llm/models';
    return apiService.get<LLMModel[]>(url);
  }

  /**
   * Format price for display (e.g., "$0.003/1K tokens")
   */
  formatPrice(pricePerK: number): string {
    if (pricePerK === 0) return 'Free';
    if (pricePerK < 0.001) {
      return `$${(pricePerK * 1000).toFixed(4)}/1M`;
    }
    return `$${pricePerK.toFixed(4)}/1K`;
  }

  /**
   * Get model display name with pricing
   */
  getModelDisplayWithPrice(model: LLMModel): string {
    const inputPrice = this.formatPrice(model.inputPer1k);
    const outputPrice = this.formatPrice(model.outputPer1k);
    return `${model.displayName} (in: ${inputPrice}, out: ${outputPrice})`;
  }
}

// Export singleton instance
export const llmService = new LLMService();

export default llmService;
