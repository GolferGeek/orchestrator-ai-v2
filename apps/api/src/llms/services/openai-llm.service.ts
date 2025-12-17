import { Injectable } from '@nestjs/common';
import {
  ExecutionContext,
  createMockExecutionContext,
} from '@orchestrator-ai/transport-types';
import { BaseLLMService } from './base-llm.service';
import {
  GenerateResponseParams,
  LLMResponse,
  LLMServiceConfig,
  ResponseMetadata,
} from './llm-interfaces';
import { PIIService } from '../pii/pii.service';
import { DictionaryPseudonymizerService } from '../pii/dictionary-pseudonymizer.service';
import { RunMetadataService } from '../run-metadata.service';
import { ProviderConfigService } from '../provider-config.service';
import { LLMPricingService } from '../llm-pricing.service';
import OpenAI from 'openai';
import { getModelRestrictions } from '../config/model-restrictions.config';
import type { OpenAIChatCompletionRequest } from '../types/provider-payload.types';
import { openAIChatCompletionSchema } from '../types/provider-schemas';
import type { OpenAIChatCompletionParsed } from '../types/provider-schemas';

/**
 * OpenAI-specific response metadata extension
 */
interface OpenAIResponseMetadata extends ResponseMetadata {
  providerSpecific: {
    finish_reason:
      | 'stop'
      | 'length'
      | 'function_call'
      | 'content_filter'
      | 'tool_calls'
      | null;
    system_fingerprint?: string;
    model_version?: string;
    logprobs?: unknown;
    // OpenAI usage details
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * OpenAI LLM Service Implementation
 *
 * This example shows how to extend BaseLLMService for OpenAI-specific functionality
 * while maintaining compatibility with the standardized interface.
 */
@Injectable()
export class OpenAILLMService extends BaseLLMService {
  private openai: OpenAI;

  constructor(
    config: LLMServiceConfig,
    piiService: PIIService,
    dictionaryPseudonymizerService: DictionaryPseudonymizerService,
    runMetadataService: RunMetadataService,
    providerConfigService: ProviderConfigService,
    llmPricingService?: LLMPricingService,
  ) {
    super(
      config,
      piiService,
      dictionaryPseudonymizerService,
      runMetadataService,
      providerConfigService,
      llmPricingService,
    );

    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      baseURL: config.baseUrl,
    });
  }

  /**
   * Implementation of the abstract generateResponse method for OpenAI
   */
  async generateResponse(
    context: ExecutionContext,
    params: GenerateResponseParams,
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId('openai');

    try {
      // Validate configuration
      this.validateConfig(params.config);

      // Handle PII in input - use what's already been processed at LLM Service level
      let piiResult;
      if (params.options?.piiMetadata) {
        // Use existing PII metadata from LLM Service level processing

        // The text has already been pseudonymized at LLM Service level
        piiResult = {
          processedText: params.userMessage, // Already processed
          piiMetadata: params.options.piiMetadata,
          dictionaryMappings: params.options?.dictionaryMappings || [], // Already applied at LLM Service level
        };
      } else {
        // Fallback - shouldn't happen if LLM Service is processing correctly
        this.logger.warn(
          `⚠️ [PII-METADATA-DEBUG] OpenAILLMService - No PII metadata from LLM Service, skipping PII processing`,
        );
        piiResult = {
          processedText: params.userMessage,
          piiMetadata: null,
          dictionaryMappings: [],
        };
      }

      // Normalize config for model-specific restrictions
      const normalizedConfig = this.normalizeConfigForModel(params.config);

      // Prepare OpenAI request with model-specific handling
      const messages = this.prepareMessagesForModel(
        normalizedConfig.model,
        params.systemPrompt,
        piiResult.processedText,
      );

      // Build API request parameters, respecting model restrictions
      const apiParams: OpenAIChatCompletionRequest = {
        model: normalizedConfig.model,
        messages,
        stream: false,
      };

      // Only add temperature if the normalized config includes it
      if (normalizedConfig.temperature !== undefined) {
        apiParams.temperature = normalizedConfig.temperature;
      }

      // Add max_tokens or max_completion_tokens based on model requirements
      if (params.options?.maxTokens ?? normalizedConfig.maxTokens) {
        let maxTokensValue =
          params.options?.maxTokens ?? normalizedConfig.maxTokens;

        // Check if model has a minimum token requirement
        const restrictions = getModelRestrictions(
          'openai',
          normalizedConfig.model,
        );
        if (
          restrictions?.minCompletionTokens &&
          maxTokensValue &&
          maxTokensValue < restrictions.minCompletionTokens
        ) {
          maxTokensValue = restrictions.minCompletionTokens;
        }

        // Check if model requires max_completion_tokens instead of max_tokens
        if (this.requiresMaxCompletionTokens(normalizedConfig.model)) {
          apiParams.max_completion_tokens = maxTokensValue;
        } else {
          apiParams.max_tokens = maxTokensValue;
        }
      }

      // Make OpenAI API call
      const completion: OpenAIChatCompletionParsed =
        openAIChatCompletionSchema.parse(
          await this.openai.chat.completions.create(apiParams),
        );

      const choice = completion.choices[0];
      if (!choice?.message?.content) {
        // Log the full response for debugging
        this.logger.warn(
          `OpenAI returned response without content for model ${normalizedConfig.model}:`,
          {
            choices: completion.choices,
            model: completion.model,
            usage: completion.usage,
          },
        );
        throw new Error('No content in OpenAI response');
      }

      // Don't reverse pseudonyms here - it will be done at LLM Service level
      const finalContent = choice.message.content;

      const endTime = Date.now();

      // Create OpenAI-specific metadata
      const metadata = this.createOpenAIMetadata(
        completion,
        params,
        startTime,
        endTime,
        requestId,
      );

      // Track usage with full metadata for database persistence
      await this.trackUsage(
        context,
        params.config.provider,
        params.config.model,
        metadata.usage.inputTokens,
        metadata.usage.outputTokens,
        metadata.usage.cost,
        {
          requestId,
          callerType: params.options?.callerType,
          callerName: params.options?.callerName,
          piiMetadata: (piiResult.piiMetadata ?? undefined) as unknown as
            | Record<string, unknown>
            | undefined,
          startTime,
          endTime,
        },
      );

      const response: LLMResponse = {
        content: finalContent,
        metadata,
        piiMetadata: piiResult.piiMetadata ?? undefined,
      };

      // Optional LangSmith integration
      const langsmithRunId = await this.integrateLangSmith(params, response);
      if (langsmithRunId) {
        response.metadata.langsmithRunId = langsmithRunId;
      }

      // Log request/response
      this.logRequestResponse(params, response, metadata.timing.duration);

      return response;
    } catch (error) {
      this.handleError(error, 'OpenAILLMService.generateResponse');
    }
  }

  /**
   * Check if a model is part of the o1 series (with special restrictions)
   * @deprecated Use getModelRestrictions from model-restrictions.config instead
   */
  private isO1SeriesModel(model: string): boolean {
    const restrictions = getModelRestrictions('openai', model);
    return restrictions?.temperature?.supported === false;
  }

  /**
   * Check if a model requires max_completion_tokens instead of max_tokens
   */
  private requiresMaxCompletionTokens(model: string): boolean {
    const restrictions = getModelRestrictions('openai', model);
    return restrictions?.maxTokensField?.fieldName === 'max_completion_tokens';
  }

  /**
   * Normalize configuration for OpenAI model-specific restrictions
   */
  private normalizeConfigForModel(config: LLMServiceConfig): LLMServiceConfig {
    const restrictions = getModelRestrictions('openai', config.model);

    if (!restrictions) {
      // No restrictions defined, return config as-is
      return config;
    }

    const normalizedConfig = { ...config };

    // Handle temperature restrictions
    if (restrictions.temperature && !restrictions.temperature.supported) {
      if (normalizedConfig.temperature !== undefined) {
        delete normalizedConfig.temperature;
      }
    }

    return normalizedConfig;
  }

  /**
   * Prepare messages for OpenAI API based on model capabilities
   */
  private prepareMessagesForModel(
    model: string,
    systemPrompt: string,
    userMessage: string,
  ): Array<{ role: 'system' | 'user'; content: string }> {
    const restrictions = getModelRestrictions('openai', model);

    if (
      restrictions?.systemMessages &&
      !restrictions.systemMessages.supported
    ) {
      // Model doesn't support system messages

      if (restrictions.systemMessages.workaround === 'combine_with_user') {
        return [
          {
            role: 'user' as const,
            content: `${systemPrompt}\n\n${userMessage}`,
          },
        ];
      }
    }

    // Standard models support system messages
    return [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userMessage },
    ];
  }

  /**
   * Create OpenAI-specific metadata with provider-specific fields
   */
  private createOpenAIMetadata(
    completion: OpenAIChatCompletionParsed,
    params: GenerateResponseParams,
    startTime: number,
    endTime: number,
    requestId: string,
  ): OpenAIResponseMetadata {
    const choice = completion.choices[0];
    const usage = completion.usage;
    // Fallback estimation if usage is missing (not always present for some models)
    const estInput = this.estimateTokens(
      `${params.systemPrompt}${params.systemPrompt ? '\n\n' : ''}${params.userMessage}`,
    );
    const estOutput = this.estimateTokens(choice?.message?.content || '');
    const inputTokens = usage?.prompt_tokens ?? estInput;
    const outputTokens = usage?.completion_tokens ?? estOutput;

    return {
      provider: 'openai',
      model: completion.model,
      requestId,
      timestamp: new Date().toISOString(),
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: (usage?.total_tokens ?? inputTokens + outputTokens) || 0,
        cost: this.calculateCost(
          'openai',
          completion.model,
          inputTokens,
          outputTokens,
        ),
      },
      timing: {
        startTime,
        endTime,
        duration: endTime - startTime,
      },
      tier: params.options?.preferLocal ? 'local' : 'external',
      status: 'completed',
      // OpenAI-specific fields
      providerSpecific: {
        finish_reason: choice?.finish_reason ?? null,
        system_fingerprint: completion.system_fingerprint ?? undefined,
        model_version: completion.model,
        logprobs: choice?.logprobs,
        // Include actual token counts from OpenAI
        prompt_tokens: usage?.prompt_tokens,
        completion_tokens: usage?.completion_tokens,
        total_tokens: usage?.total_tokens,
      },
    };
  }

  /**
   * Override LangSmith integration for OpenAI-specific tracing
   */
  protected integrateLangSmith(
    _params: GenerateResponseParams,
    _response: LLMResponse,
  ): Promise<string | undefined> {
    // Example OpenAI-specific LangSmith integration
    if (
      process.env.LANGSMITH_API_KEY &&
      process.env.LANGSMITH_TRACING === 'true'
    ) {
      try {
        // This would integrate with LangSmith for OpenAI-specific tracing
        const runId = `openai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        return Promise.resolve(runId);
      } catch (error) {
        this.logger.warn('LangSmith integration failed:', error);
      }
    }
    return Promise.resolve(undefined);
  }

  /**
   * OpenAI-specific configuration validation
   */
  protected validateConfig(config: LLMServiceConfig): void {
    super.validateConfig(config);

    if (config.provider !== 'openai') {
      throw new Error('OpenAILLMService requires provider to be "openai"');
    }

    if (!config.apiKey && !process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is required');
    }

    // Validate OpenAI-specific model names
    const validModels = [
      'gpt-4',
      'gpt-4-turbo',
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k',
    ];

    if (!validModels.some((model) => config.model.startsWith(model))) {
      this.logger.warn(
        `Unknown OpenAI model: ${config.model}. Proceeding anyway.`,
      );
    }
  }
}

/**
 * Factory function to create OpenAI service instances
 */
export function createOpenAIService(
  config: LLMServiceConfig,
  dependencies: {
    piiService: PIIService;
    dictionaryPseudonymizerService: DictionaryPseudonymizerService;
    runMetadataService: RunMetadataService;
    providerConfigService: ProviderConfigService;
  },
): OpenAILLMService {
  return new OpenAILLMService(
    { ...config, provider: 'openai' },
    dependencies.piiService,
    dependencies.dictionaryPseudonymizerService,
    dependencies.runMetadataService,
    dependencies.providerConfigService,
  );
}

/**
 * Example usage and testing
 */
export async function testOpenAIService() {
  // This would be used in your tests to verify the OpenAI implementation
  const config: LLMServiceConfig = {
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 1000,
  };

  // Mock dependencies for testing
  const mockDependencies = {
    piiService: {} as PIIService,
    dictionaryPseudonymizerService: {} as DictionaryPseudonymizerService,
    runMetadataService: {} as RunMetadataService,
    providerConfigService: {} as ProviderConfigService,
  };

  const service = createOpenAIService(config, mockDependencies);

  const mockContext = createMockExecutionContext();
  const params: GenerateResponseParams = {
    systemPrompt: 'You are a helpful assistant.',
    userMessage: 'Hello, how are you?',
    config,
    options: {
      executionContext: mockContext,
    },
  };

  const response = await service.generateResponse(mockContext, params);
  return response;
}
