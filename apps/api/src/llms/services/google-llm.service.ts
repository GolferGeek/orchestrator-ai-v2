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
  ImageGenerationParams,
  ImageGenerationResponse,
  ImageMetadata,
} from './llm-interfaces';
import { LLMErrorMapper } from './llm-error-handling';
import { PIIService } from '../pii/pii.service';
import { DictionaryPseudonymizerService } from '../pii/dictionary-pseudonymizer.service';
import { RunMetadataService } from '../run-metadata.service';
import { ProviderConfigService } from '../provider-config.service';
import { LLMPricingService } from '../llm-pricing.service';
import {
  GoogleGenerativeAI,
  FinishReason,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';
import type {
  GoogleGenerateContentResult,
  GoogleGenerateContentResponse,
  GoogleGenerateContentCandidate,
  GoogleUsageMetadata,
  GoogleCitationSource,
} from '../types/provider-payload.types';

/**
 * Google-specific response metadata extension
 */
interface GoogleResponseMetadata extends ResponseMetadata {
  providerSpecific: {
    finish_reason: 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'RECITATION' | 'OTHER';
    safety_ratings?: Array<{
      category: string;
      probability: string;
    }>;
    citation_metadata?: {
      citation_sources: Array<{
        start_index: number;
        end_index: number;
        uri: string;
        license: string;
      }>;
    };
    // Google-specific usage details
    prompt_token_count?: number;
    candidates_token_count?: number;
    total_token_count?: number;
    // Model version and capabilities
    model_version?: string;
    generation_config?: {
      temperature?: number;
      top_p?: number;
      top_k?: number;
      max_output_tokens?: number;
    };
  };
}

/**
 * Google Gemini LLM Service Implementation
 *
 * This example shows how to extend BaseLLMService for Google's Gemini models
 * with provider-specific functionality, safety settings, and metadata handling.
 */
@Injectable()
export class GoogleLLMService extends BaseLLMService {
  private genAI: GoogleGenerativeAI;

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

    const apiKey = config.apiKey || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('Google API key is required');
    }

    // Initialize Google Generative AI
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Implementation of the abstract generateResponse method for Google Gemini
   */
  async generateResponse(
    context: ExecutionContext,
    params: GenerateResponseParams,
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId('google');

    try {
      // Validate configuration
      this.validateConfig(params.config);

      // Use LLM Service level PII pre-processing when provided
      const processedText = params.userMessage;
      const piiMetadata = params.options?.piiMetadata || null;
      const _dictionaryMappings = params.options?.dictionaryMappings || [];
      if (!piiMetadata) {
        this.logger.warn(
          `⚠️ [PII-METADATA-DEBUG] GoogleLLMService - No PII metadata from LLM Service, using raw message`,
        );
      }

      // Get the model
      const model = this.genAI.getGenerativeModel({
        model: params.config.model,
        generationConfig: {
          temperature:
            params.options?.temperature ?? params.config.temperature ?? 0.7,
          maxOutputTokens: params.options?.maxTokens ?? params.config.maxTokens,
          topP: 0.95,
          topK: 64,
        },
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
        ],
      });

      // Prepare the prompt (Google uses a different format)
      const prompt = `${params.systemPrompt}\n\nUser: ${processedText}\n\nAssistant:`;

      // Make Google API call
      const result: GoogleGenerateContentResult =
        await model.generateContent(prompt);
      const response: GoogleGenerateContentResponse = result.response;

      if (typeof response?.text !== 'function') {
        throw new Error('Unexpected Google response shape: missing text()');
      }

      const responseText = response.text();

      if (!responseText) {
        throw new Error('No content in Google response');
      }

      // Do not reverse here; LLMService handles dictionary reversal consistently
      const finalContent = responseText;

      const endTime = Date.now();

      // Create Google-specific metadata
      const metadata = this.createGoogleMetadata(
        result,
        response,
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
          piiMetadata: (piiMetadata ?? undefined) as unknown as
            | Record<string, unknown>
            | undefined,
          startTime,
          endTime,
        },
      );

      const llmResponse: LLMResponse = {
        content: finalContent,
        metadata,
        piiMetadata: piiMetadata ?? undefined,
      };

      // Optional LangSmith integration
      const langsmithRunId = await this.integrateLangSmith(params, llmResponse);
      if (langsmithRunId) {
        llmResponse.metadata.langsmithRunId = langsmithRunId;
      }

      // Log request/response
      this.logRequestResponse(params, llmResponse, metadata.timing.duration);

      return llmResponse;
    } catch (error) {
      this.handleError(error, 'GoogleLLMService.generateResponse');
    }
  }

  /**
   * Create Google-specific metadata with provider-specific fields
   */
  private createGoogleMetadata(
    result: GoogleGenerateContentResult,
    response: GoogleGenerateContentResponse,
    params: GenerateResponseParams,
    startTime: number,
    endTime: number,
    requestId: string,
  ): GoogleResponseMetadata {
    const usageMetadata: GoogleUsageMetadata | undefined =
      response.usageMetadata ?? result.response?.usageMetadata;
    const candidate: GoogleGenerateContentCandidate | undefined =
      response.candidates?.[0];

    const normalizedFinishReason = this.mapFinishReason(candidate);
    const citationMetadata = candidate?.citationMetadata;

    return {
      provider: 'google',
      model: params.config.model,
      requestId,
      timestamp: new Date().toISOString(),
      usage: {
        inputTokens: usageMetadata?.promptTokenCount || 0,
        outputTokens: usageMetadata?.candidatesTokenCount || 0,
        totalTokens: usageMetadata?.totalTokenCount || 0,
        cost: this.calculateCost(
          'google',
          params.config.model,
          usageMetadata?.promptTokenCount || 0,
          usageMetadata?.candidatesTokenCount || 0,
        ),
      },
      timing: {
        startTime,
        endTime,
        duration: endTime - startTime,
      },
      tier: params.options?.preferLocal ? 'local' : 'external',
      status: 'completed',
      // Google-specific fields
      providerSpecific: {
        finish_reason: normalizedFinishReason,
        safety_ratings: candidate?.safetyRatings?.map((rating) => ({
          category: rating.category,
          probability: rating.probability,
        })),
        citation_metadata: citationMetadata
          ? {
              citation_sources: (citationMetadata.citationSources || []).map(
                (source: GoogleCitationSource) => ({
                  start_index: source.startIndex ?? 0,
                  end_index: source.endIndex ?? 0,
                  uri: source.uri ?? '',
                  license: source.license ?? '',
                }),
              ),
            }
          : undefined,
        // Include actual token counts from Google
        prompt_token_count: usageMetadata?.promptTokenCount,
        candidates_token_count: usageMetadata?.candidatesTokenCount,
        total_token_count: usageMetadata?.totalTokenCount,
        model_version: params.config.model,
        generation_config: {
          temperature:
            params.options?.temperature ?? params.config.temperature ?? 0.7,
          top_p: 0.95,
          top_k: 64,
          max_output_tokens:
            params.options?.maxTokens ?? params.config.maxTokens,
        },
      },
    };
  }

  /**
   * Override LangSmith integration for Google-specific tracing
   */
  protected integrateLangSmith(
    _params: GenerateResponseParams,
    _response: LLMResponse,
  ): Promise<string | undefined> {
    // Example Google-specific LangSmith integration
    if (
      process.env.LANGSMITH_API_KEY &&
      process.env.LANGSMITH_TRACING === 'true'
    ) {
      try {
        // This would integrate with LangSmith for Google-specific tracing
        const runId = `google-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        return Promise.resolve(runId);
      } catch (error) {
        this.logger.warn('LangSmith integration failed:', error);
      }
    }
    return Promise.resolve(undefined);
  }

  private mapFinishReason(
    candidate?: GoogleGenerateContentCandidate,
  ): GoogleResponseMetadata['providerSpecific']['finish_reason'] {
    switch (candidate?.finishReason) {
      case FinishReason.STOP:
        return 'STOP';
      case FinishReason.MAX_TOKENS:
        return 'MAX_TOKENS';
      case FinishReason.SAFETY:
        return 'SAFETY';
      case FinishReason.RECITATION:
        return 'RECITATION';
      default:
        return 'OTHER';
    }
  }

  /**
   * Google-specific configuration validation
   */
  protected validateConfig(config: LLMServiceConfig): void {
    super.validateConfig(config);

    if (config.provider !== 'google') {
      throw new Error('GoogleLLMService requires provider to be "google"');
    }

    if (!config.apiKey && !process.env.GOOGLE_API_KEY) {
      throw new Error('Google API key is required');
    }

    // Validate Google-specific model names
    const validModels = [
      'gemini-1.5-pro',
      'gemini-1.5-pro-latest',
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.0-pro',
      'gemini-pro',
      'gemini-pro-vision',
    ];

    if (!validModels.some((model) => config.model.includes(model))) {
      this.logger.warn(
        `Unknown Google model: ${config.model}. Proceeding anyway.`,
      );
    }
  }

  /**
   * Google-specific error handling
   */
  protected handleError(error: unknown, context: string): never {
    try {
      const mapped = LLMErrorMapper.fromGoogleError(
        error,
        'google',
        this.config?.model,
      );
      super.handleError(mapped, context);
    } catch {
      super.handleError(error, context);
    }
  }

  // Note: calculateCost is now inherited from BaseLLMService which uses
  // LLMPricingService for database-driven pricing lookups

  /**
   * Generate image using Google Imagen API
   *
   * Uses Vertex AI Imagen models (imagen-4.0-generate-001, imagen-4.0-fast-generate-001)
   * Returns base64-encoded image data.
   *
   * @param context - ExecutionContext for tracing and ownership
   * @param params - Image generation parameters
   * @returns ImageGenerationResponse with generated images
   */
  async generateImage(
    context: ExecutionContext,
    params: ImageGenerationParams,
  ): Promise<ImageGenerationResponse> {
    const startTime = Date.now();
    // Use taskId as requestId - already unique, already tracked everywhere
    const requestId = context.taskId || this.generateRequestId('google-image');

    try {
      // Get model from context or fall back to config
      const model =
        context.model || this.config.model || 'imagen-4.0-generate-001';

      this.logger.log(
        `🖼️ [GOOGLE-IMAGE] Generating image with model: ${model}, requestId: ${requestId}`,
      );

      // Google Imagen uses Vertex AI predict endpoint
      // For now, we use the REST API directly since @google/generative-ai doesn't support Imagen
      const projectId = process.env.GOOGLE_CLOUD_PROJECT;
      const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

      if (!projectId) {
        throw new Error(
          'GOOGLE_CLOUD_PROJECT environment variable is required for Imagen',
        );
      }

      // Map size to aspect ratio for Google Imagen
      const aspectRatio = this.mapSizeToAspectRatio(params.size);

      // Prepare request body for Vertex AI Imagen
      const requestBody = {
        instances: [
          {
            prompt: params.prompt,
          },
        ],
        parameters: {
          sampleCount: params.numberOfImages || 1,
          aspectRatio: aspectRatio,
          // Google Imagen safety settings
          safetySetting: 'block_some',
          // Add watermark for generated content
          addWatermark: true,
        },
      };

      // Make Vertex AI API call
      const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predict`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await this.getAccessToken()}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Imagen API error: ${response.status} - ${errorText}`);
      }

      const result = (await response.json()) as {
        predictions?: Array<{
          bytesBase64Encoded?: string;
          mimeType?: string;
        }>;
      };

      if (!result.predictions || result.predictions.length === 0) {
        throw new Error('No predictions returned from Imagen API');
      }

      const endTime = Date.now();

      // Parse dimensions from size param
      const dimensions = this.parseSizeDimensions(params.size);

      // Convert predictions to image data matching ImageGenerationResponse interface
      const images = result.predictions
        .filter((pred) => pred.bytesBase64Encoded)
        .map((pred) => {
          const imageData = Buffer.from(pred.bytesBase64Encoded!, 'base64');
          const mimeType = pred.mimeType || 'image/png';
          const imageMetadata: ImageMetadata = {
            width: dimensions.width,
            height: dimensions.height,
            mimeType,
            sizeBytes: imageData.length,
          };
          return {
            data: imageData,
            metadata: imageMetadata,
          };
        });

      if (images.length === 0) {
        throw new Error('No valid images in Imagen response');
      }

      // Calculate cost based on number of images
      const cost = this.calculateImageCost(model, images.length);

      // Track usage
      await this.trackUsage(
        context,
        'google',
        model,
        0, // No input tokens for image generation
        0, // No output tokens for image generation
        cost,
        {
          requestId,
          callerType: 'image-generation',
          callerName: 'GoogleLLMService.generateImage',
          startTime,
          endTime,
        },
      );

      this.logger.log(
        `🖼️ [GOOGLE-IMAGE] Generated ${images.length} image(s) in ${endTime - startTime}ms`,
      );

      return {
        images,
        metadata: {
          provider: 'google',
          model,
          requestId,
          timestamp: new Date().toISOString(),
          usage: {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            cost,
          },
          timing: {
            startTime,
            endTime,
            duration: endTime - startTime,
          },
          tier: 'external',
          status: 'completed',
          providerSpecific: {
            imagesGenerated: images.length,
            aspectRatio,
            width: dimensions.width,
            height: dimensions.height,
          },
        },
      };
    } catch (error) {
      this.logger.error(
        `🖼️ [GOOGLE-IMAGE] Error generating image: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.handleError(error, 'GoogleLLMService.generateImage');
    }
  }

  /**
   * Get Google Cloud access token for Vertex AI API calls
   */
  private async getAccessToken(): Promise<string> {
    // Check for explicit API key first
    const apiKey = this.config.apiKey || process.env.GOOGLE_API_KEY;
    if (apiKey) {
      // For Vertex AI with API key, we need to use a different auth method
      // This is a simplified approach - in production, use google-auth-library
      return apiKey;
    }

    // Fall back to Application Default Credentials (ADC)
    // This works in GCP environments or with gcloud auth
    try {
      const { GoogleAuth } = await import('google-auth-library');
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const client = await auth.getClient();
      const token = await client.getAccessToken();
      return token.token || '';
    } catch (error) {
      this.logger.error(
        `Failed to get Google Cloud access token: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        'Failed to authenticate with Google Cloud. Set GOOGLE_API_KEY or configure Application Default Credentials.',
      );
    }
  }

  /**
   * Map size parameter to Google Imagen aspect ratio
   */
  private mapSizeToAspectRatio(
    size?: string,
  ): '1:1' | '16:9' | '9:16' | '4:3' | '3:4' {
    switch (size) {
      case '1792x1024':
        return '16:9';
      case '1024x1792':
        return '9:16';
      case '1024x1024':
      default:
        return '1:1';
    }
  }

  /**
   * Parse size string to width/height dimensions
   */
  private parseSizeDimensions(size?: string): {
    width: number;
    height: number;
  } {
    const defaultSize = { width: 1024, height: 1024 };
    if (!size) return defaultSize;

    const parts = size.split('x');
    if (parts.length !== 2) return defaultSize;

    const width = parseInt(parts[0] ?? '1024', 10);
    const height = parseInt(parts[1] ?? '1024', 10);

    return {
      width: isNaN(width) ? 1024 : width,
      height: isNaN(height) ? 1024 : height,
    };
  }

  /**
   * Calculate cost for image generation
   */
  private calculateImageCost(model: string, imageCount: number): number {
    // Google Imagen pricing (approximate, check current pricing)
    const pricePerImage: Record<string, number> = {
      'imagen-4.0-generate-001': 0.04,
      'imagen-4.0-fast-generate-001': 0.02,
      'imagen-3.0-generate-001': 0.03,
    };

    const price = pricePerImage[model] ?? 0.04;
    return price * imageCount;
  }

  /**
   * Check if content was blocked by safety filters
   */
  private checkSafetyBlocking(response: unknown): {
    blocked: boolean;
    reason?: string;
  } {
    const r = response as {
      candidates?: Array<{ finishReason?: string; safetyRatings?: unknown[] }>;
    };
    const candidate = r.candidates?.[0];

    if (candidate?.finishReason === 'SAFETY') {
      const safetyRatings = candidate.safetyRatings || [];
      const blockedRatings = safetyRatings.filter((rating: unknown) => {
        const rat = rating as { probability?: string };
        return rat.probability === 'HIGH' || rat.probability === 'MEDIUM';
      });

      if (blockedRatings.length > 0) {
        return {
          blocked: true,
          reason: `Content blocked due to: ${blockedRatings.map((r: unknown) => (r as { category?: string }).category).join(', ')}`,
        };
      }
    }

    return { blocked: false };
  }
}

/**
 * Factory function to create Google service instances
 */
export function createGoogleService(
  config: LLMServiceConfig,
  dependencies: {
    piiService: PIIService;
    dictionaryPseudonymizerService: DictionaryPseudonymizerService;
    runMetadataService: RunMetadataService;
    providerConfigService: ProviderConfigService;
  },
): GoogleLLMService {
  return new GoogleLLMService(
    { ...config, provider: 'google' },
    dependencies.piiService,
    dependencies.dictionaryPseudonymizerService,
    dependencies.runMetadataService,
    dependencies.providerConfigService,
  );
}

/**
 * Example usage and testing
 */
export async function testGoogleService() {
  // This would be used in your tests to verify the Google implementation
  const config: LLMServiceConfig = {
    provider: 'google',
    model: 'gemini-1.5-flash',
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

  const service = createGoogleService(config, mockDependencies);

  const mockContext = createMockExecutionContext();
  const params: GenerateResponseParams = {
    systemPrompt: 'You are a helpful AI assistant powered by Google Gemini.',
    userMessage: 'Explain the benefits of multimodal AI models.',
    config,
    options: {
      executionContext: mockContext,
    },
  };

  const response = await service.generateResponse(mockContext, params);
  return response;
}
