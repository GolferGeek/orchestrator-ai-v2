import { Injectable, Logger } from '@nestjs/common';

export interface ProviderConfig {
  name: string;
  baseUrl?: string;
  apiKey?: string;
  defaultHeaders: Record<string, string>;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  rateLimits?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  features: {
    supportsStreaming: boolean;
    supportsNoTrain: boolean;
    supportsNoRetain: boolean;
    supportsFunctions: boolean;
  };
}

export interface ModelConfig {
  name: string;
  providerId: string;
  maxTokens: number;
  contextWindow: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  isLocal: boolean;
  tier?: string;
  capabilities: string[];
}

export interface RequestHeaders {
  'X-Policy-Profile': string;
  'X-Data-Class': string;
  'X-Sovereign-Mode': string;
  'X-No-Train'?: string;
  'X-No-Retain'?: string;
  [key: string]: string | undefined;
}

@Injectable()
export class ProviderConfigService {
  private readonly logger = new Logger(ProviderConfigService.name);
  private readonly providerConfigs = new Map<string, ProviderConfig>();
  private readonly modelConfigs = new Map<string, ModelConfig>();

  constructor() {
    this.initializeProviderConfigs();
    this.logger.log('ProviderConfigService initialized');
  }

  /**
   * Initialize default provider configurations
   */
  private initializeProviderConfigs(): void {
    // OpenAI Configuration
    this.providerConfigs.set('openai', {
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      defaultHeaders: {
        'User-Agent': 'OrchestratorAI/1.0',
        'X-No-Train': 'true', // OpenAI no-train header
      },
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      rateLimits: {
        requestsPerMinute: 3500,
        tokensPerMinute: 90000,
      },
      features: {
        supportsStreaming: true,
        supportsNoTrain: true,
        supportsNoRetain: false,
        supportsFunctions: true,
      },
    });

    // Anthropic Configuration
    this.providerConfigs.set('anthropic', {
      name: 'Anthropic',
      baseUrl: 'https://api.anthropic.com',
      defaultHeaders: {
        'User-Agent': 'OrchestratorAI/1.0',
        'anthropic-version': '2023-06-01',
      },
      timeout: 45000,
      retryAttempts: 3,
      retryDelay: 1500,
      rateLimits: {
        requestsPerMinute: 1000,
        tokensPerMinute: 40000,
      },
      features: {
        supportsStreaming: true,
        supportsNoTrain: false,
        supportsNoRetain: false,
        supportsFunctions: false,
      },
    });

    // Ollama Configuration (Local or Cloud)
    // Cloud mode is automatically detected when OLLAMA_CLOUD_API_KEY is set
    const isOllamaCloudMode = !!process.env.OLLAMA_CLOUD_API_KEY;
    this.providerConfigs.set('ollama', {
      name: isOllamaCloudMode ? 'Ollama Cloud' : 'Ollama',
      baseUrl: isOllamaCloudMode
        ? process.env.OLLAMA_CLOUD_BASE_URL || 'https://ollama.com'
        : process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      apiKey: isOllamaCloudMode ? process.env.OLLAMA_CLOUD_API_KEY : undefined,
      defaultHeaders: {
        'User-Agent': 'OrchestratorAI/1.0',
      },
      timeout: isOllamaCloudMode ? 60000 : 120000, // 1 min for cloud, 2 min for local
      retryAttempts: isOllamaCloudMode ? 3 : 2,
      retryDelay: isOllamaCloudMode ? 1000 : 2000,
      rateLimits: isOllamaCloudMode
        ? {
            requestsPerMinute: 500, // Estimated cloud rate limits
            tokensPerMinute: 100000,
          }
        : undefined,
      features: {
        supportsStreaming: true,
        supportsNoTrain: !isOllamaCloudMode, // Local: true, Cloud: false (may train)
        supportsNoRetain: !isOllamaCloudMode, // Local: true, Cloud: false (may retain)
        supportsFunctions: false,
      },
    });
    if (isOllamaCloudMode) {
      this.logger.log('Ollama configured in CLOUD mode');
    }

    // Google Configuration
    this.providerConfigs.set('google', {
      name: 'Google',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      defaultHeaders: {
        'User-Agent': 'OrchestratorAI/1.0',
      },
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      features: {
        supportsStreaming: true,
        supportsNoTrain: false,
        supportsNoRetain: false,
        supportsFunctions: true,
      },
    });
  }

  /**
   * Get provider configuration by name
   */
  getProviderConfig(providerName: string): ProviderConfig | null {
    return this.providerConfigs.get(providerName.toLowerCase()) || null;
  }

  /**
   * Get model configuration by name
   */
  getModelConfig(modelName: string): ModelConfig | null {
    return this.modelConfigs.get(modelName.toLowerCase()) || null;
  }

  /**
   * Generate default headers for a request
   */
  getDefaultHeaders(
    providerName: string,
    options: {
      policyProfile?: string;
      dataClass?: string;
      sovereignMode?: string;
      noTrain?: boolean;
      noRetain?: boolean;
      customHeaders?: Record<string, string>;
    } = {},
  ): RequestHeaders {
    const provider = this.getProviderConfig(providerName);
    const defaultHeaders = provider?.defaultHeaders || {};

    const headers: RequestHeaders = {
      'X-Policy-Profile': options.policyProfile || 'standard',
      'X-Data-Class': options.dataClass || 'public',
      'X-Sovereign-Mode': options.sovereignMode || 'false',
      ...defaultHeaders,
    };

    // Add no-train/no-retain headers if supported and requested
    if (provider?.features.supportsNoTrain && options.noTrain !== false) {
      headers['X-No-Train'] = 'true';
    }

    if (provider?.features.supportsNoRetain && options.noRetain) {
      headers['X-No-Retain'] = 'true';
    }

    // Merge custom headers
    if (options.customHeaders) {
      Object.assign(headers, options.customHeaders);
    }

    return headers;
  }

  /**
   * Get timeout configuration for a provider
   */
  getTimeout(providerName: string): number {
    const provider = this.getProviderConfig(providerName);
    return provider?.timeout || 30000; // Default 30 seconds
  }

  /**
   * Get retry configuration for a provider
   */
  getRetryConfig(providerName: string): { attempts: number; delay: number } {
    const provider = this.getProviderConfig(providerName);
    return {
      attempts: provider?.retryAttempts || 3,
      delay: provider?.retryDelay || 1000,
    };
  }

  /**
   * Check if provider supports a specific feature
   */
  supportsFeature(
    providerName: string,
    feature: keyof ProviderConfig['features'],
  ): boolean {
    const provider = this.getProviderConfig(providerName);
    return provider?.features[feature] || false;
  }

  /**
   * Get rate limit information for a provider
   */
  getRateLimits(
    providerName: string,
  ): { requestsPerMinute: number; tokensPerMinute: number } | null {
    const provider = this.getProviderConfig(providerName);
    return provider?.rateLimits || null;
  }

  /**
   * Update provider configuration (for dynamic configuration)
   */
  updateProviderConfig(
    providerName: string,
    updates: Partial<ProviderConfig>,
  ): void {
    const existing = this.getProviderConfig(providerName);
    if (existing) {
      const updated = { ...existing, ...updates };
      this.providerConfigs.set(providerName.toLowerCase(), updated);
      this.logger.log(`Updated configuration for provider: ${providerName}`);
    } else {
      this.logger.warn(
        `Attempted to update non-existent provider: ${providerName}`,
      );
    }
  }

  /**
   * Add or update model configuration
   */
  setModelConfig(modelName: string, config: ModelConfig): void {
    this.modelConfigs.set(modelName.toLowerCase(), config);
    this.logger.debug(`Set configuration for model: ${modelName}`);
  }

  /**
   * Get all available providers
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providerConfigs.keys());
  }

  /**
   * Get provider configuration with environment variable overrides
   */
  getEnhancedProviderConfig(providerName: string): ProviderConfig | null {
    const baseConfig = this.getProviderConfig(providerName);
    if (!baseConfig) return null;

    // Apply environment variable overrides
    const envPrefix = providerName.toUpperCase();
    const enhanced = { ...baseConfig };

    // Override API key from environment
    const envApiKey = process.env[`${envPrefix}_API_KEY`];
    if (envApiKey) {
      enhanced.apiKey = envApiKey;
    }

    // Override base URL from environment
    const envBaseUrl = process.env[`${envPrefix}_BASE_URL`];
    if (envBaseUrl) {
      enhanced.baseUrl = envBaseUrl;
    }

    // Override timeout from environment
    const envTimeout = process.env[`${envPrefix}_TIMEOUT`];
    if (envTimeout) {
      enhanced.timeout = parseInt(envTimeout, 10);
    }

    return enhanced;
  }

  /**
   * Validate provider configuration
   */
  validateProviderConfig(providerName: string): {
    valid: boolean;
    errors: string[];
  } {
    const config = this.getEnhancedProviderConfig(providerName);
    const errors: string[] = [];

    if (!config) {
      errors.push(`Provider '${providerName}' not found`);
      return { valid: false, errors };
    }

    // Check required fields
    if (!config.baseUrl) {
      errors.push('Base URL is required');
    }

    // API key validation: required for external providers and Ollama Cloud
    const isOllamaCloudMode = !!process.env.OLLAMA_CLOUD_API_KEY;
    if (providerName === 'ollama') {
      // Ollama: API key required only in cloud mode
      if (isOllamaCloudMode && !config.apiKey) {
        errors.push('API key is required for Ollama Cloud mode');
      }
    } else if (!config.apiKey) {
      // Other providers: always require API key
      errors.push('API key is required for external providers');
    }

    if (config.timeout < 1000) {
      errors.push('Timeout must be at least 1000ms');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalProviders: number;
    totalModels: number;
    localProviders: number;
    externalProviders: number;
  } {
    const providers = Array.from(this.providerConfigs.values());
    // Ollama in local mode is a local provider; cloud mode is external
    const localProviderNames = ['Ollama']; // Ollama Cloud is not local

    return {
      totalProviders: providers.length,
      totalModels: this.modelConfigs.size,
      localProviders: providers.filter((p) =>
        localProviderNames.includes(p.name),
      ).length,
      externalProviders: providers.filter(
        (p) => !localProviderNames.includes(p.name),
      ).length,
    };
  }

  /**
   * Check if Ollama is running in cloud mode
   */
  isOllamaCloudMode(): boolean {
    return !!process.env.OLLAMA_CLOUD_API_KEY;
  }
}
