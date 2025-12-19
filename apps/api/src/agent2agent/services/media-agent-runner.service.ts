import { Injectable, Logger, Inject } from '@nestjs/common';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/agent.interface';
import type { BuildCreatePayload } from '@orchestrator-ai/transport-types/modes/build.types';
import { LLMService } from '@llm/llm.service';
import { BaseAgentRunner } from './base-agent-runner.service';
import { fetchConversationHistory } from './base-agent-runner/shared.helpers';
import { Agent2AgentConversationsService } from './agent-conversations.service';
import { TaskRequestDto, AgentTaskMode } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import {
  ContextOptimizationService,
  ConversationMessage,
} from '../context-optimization/context-optimization.service';
import type { ExecutionContext } from '@orchestrator-ai/transport-types';
import { DeliverablesService } from '../deliverables/deliverables.service';
import { PlansService } from '../plans/services/plans.service';
import { StreamingService } from './streaming.service';
import { MediaStorageHelper } from './media-storage.helper';
import type {
  ImageGenerationParams,
  ImageGenerationResponse,
  VideoGenerationParams,
} from '@/llms/services/llm-interfaces';

/**
 * Media type configuration for agent filtering
 */
export type MediaType = 'image' | 'video' | 'audio';

/**
 * Extended payload for media generation BUILD requests
 */
type MediaBuildCreatePayload = BuildCreatePayload & {
  deliverableId?: string;
  config?: {
    provider?: string;
    model?: string;
  };
  /** Media-specific parameters */
  media?: {
    /** Type of media to generate */
    type?: MediaType;
    /** Image generation parameters */
    image?: Partial<ImageGenerationParams>;
    /** Video generation parameters */
    video?: Partial<VideoGenerationParams>;
  };
};

/**
 * Media Agent Runner
 *
 * Handles execution of media generation agents - agents that generate images,
 * videos, or audio content using specialized LLM provider APIs.
 *
 * This runner provides shared media logic:
 * - Storage of generated media in Supabase → assets table
 * - Linking assets to deliverable versions
 * - Conversation history for iterative editing
 * - Provider-agnostic interface
 *
 * Agent definitions using this runner specify their media type via:
 * - `agent.config.media.type`: 'image' | 'video' | 'audio'
 * - Or via the BUILD request payload `media.type`
 *
 * The runner filters available models by `model_type` (e.g., 'image-generation')
 * and routes to the appropriate LLM service method.
 *
 * @example
 * ```typescript
 * // Agent definition for image generation
 * {
 *   type: 'media',
 *   name: 'Image Generator',
 *   slug: 'image-generator',
 *   config: {
 *     media: {
 *       type: 'image'
 *     }
 *   },
 *   llm: {
 *     provider: 'openai',
 *     model: 'gpt-image-1.5'
 *   }
 * }
 * ```
 */
@Injectable()
export class MediaAgentRunnerService extends BaseAgentRunner {
  protected readonly logger = new Logger(MediaAgentRunnerService.name);

  constructor(
    contextOptimization: ContextOptimizationService,
    llmService: LLMService,
    plansService: PlansService,
    conversationsService: Agent2AgentConversationsService,
    deliverablesService: DeliverablesService,
    streamingService: StreamingService,
    @Inject(MediaStorageHelper)
    private readonly mediaStorage: MediaStorageHelper,
  ) {
    super(
      llmService,
      contextOptimization,
      plansService,
      conversationsService,
      deliverablesService,
      streamingService,
    );
    // Debug: verify mediaStorage is properly injected
    this.logger.debug(
      `🎨 [MEDIA-RUNNER] Constructor - mediaStorage type: ${typeof this.mediaStorage}, has storeGeneratedMedia: ${typeof this.mediaStorage?.storeGeneratedMedia}`,
    );
    this.logger.debug(
      `🎨 [MEDIA-RUNNER] Constructor - mediaStorage constructor: ${this.mediaStorage?.constructor?.name}, keys: ${String(Object.keys(this.mediaStorage || {}))}`,
    );
    this.logger.debug(
      `🎨 [MEDIA-RUNNER] Constructor - mediaStorage prototype methods: ${String(Object.getOwnPropertyNames(Object.getPrototypeOf(this.mediaStorage || {})))}`,
    );
  }

  /**
   * BUILD mode - generate media and create deliverable with asset attachments
   */
  protected async executeBuild(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    _organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    this.logger.log(
      `🎨 [MEDIA-RUNNER] executeBuild() ENTRY - agent: ${definition.slug}`,
    );

    const payload = (request.payload ??
      {}) as unknown as MediaBuildCreatePayload;

    try {
      const userId = this.resolveUserId(request);
      if (!userId) {
        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          'User identity is required for media generation',
        );
      }

      const context = request.context;
      if (!context?.conversationId) {
        return TaskResponseDto.failure(
          AgentTaskMode.BUILD,
          'Conversation context is required for media generation',
        );
      }

      // Determine media type from agent config or payload
      const mediaType = this.resolveMediaType(definition, payload);
      this.logger.log(`🎨 [MEDIA-RUNNER] Media type: ${mediaType}`);

      // Emit observability event
      this.emitObservabilityEvent(
        'agent.started',
        `Starting ${mediaType} generation for ${definition.name}`,
        context,
        { mode: request.mode, progress: 0 },
      );

      // Fetch conversation history for context (e.g., previous edits)
      const conversationHistory = await fetchConversationHistory(
        this.conversationsService,
        request,
      );

      // Route to appropriate media generation handler
      switch (mediaType) {
        case 'image':
          return await this.executeImageGeneration(
            definition,
            request,
            context,
            payload,
            conversationHistory,
          );

        case 'video':
          return this.executeVideoGeneration(
            definition,
            request,
            context,
            payload,
            conversationHistory,
          );

        case 'audio':
          return TaskResponseDto.failure(
            AgentTaskMode.BUILD,
            'Audio generation not yet implemented',
          );

        default:
          return TaskResponseDto.failure(
            AgentTaskMode.BUILD,
            `Unknown media type: ${String(mediaType)}`,
          );
      }
    } catch (error) {
      this.logger.error(
        `Media agent ${definition.slug} BUILD failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  /**
   * Execute image generation
   */
  private async executeImageGeneration(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    context: ExecutionContext,
    payload: MediaBuildCreatePayload,
    conversationHistory: ConversationMessage[],
  ): Promise<TaskResponseDto> {
    this.logger.log(`🖼️ [MEDIA-RUNNER] executeImageGeneration()`);

    // Emit progress update
    this.streamingService.emitProgress(
      context,
      'Generating image...',
      request.userMessage || '',
      {
        step: 'Calling image generation API',
        progress: 30,
        status: 'running',
        sequence: 1,
        totalSteps: 4,
      },
    );

    // Build image generation parameters from user message and payload
    const imageParams = this.buildImageParams(
      request.userMessage || '',
      payload,
      conversationHistory,
    );

    // Get provider and model from context or definition
    const provider = context.provider || definition.llm?.provider || 'openai';
    const model = context.model || definition.llm?.model || 'gpt-image-1.5';

    // Call LLM service to generate image
    // The LLMService needs generateImage method - we'll call it through a wrapper
    const imageResponse = await this.generateImage(
      provider,
      model,
      imageParams,
      context,
    );

    if (imageResponse.error) {
      this.emitObservabilityEvent(
        'agent.failed',
        `Image generation failed: ${imageResponse.error.message}`,
        context,
        { mode: request.mode, progress: 100 },
      );
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        imageResponse.error.message,
      );
    }

    // Emit progress update
    this.streamingService.emitProgress(
      context,
      'Storing generated images...',
      request.userMessage || '',
      {
        step: 'Storing media',
        progress: 60,
        status: 'running',
        sequence: 2,
        totalSteps: 4,
      },
    );

    // Store each generated image
    this.logger.debug(
      `🎨 [MEDIA-RUNNER] About to store ${imageResponse.images.length} images, mediaStorage: ${typeof this.mediaStorage}, method: ${typeof this.mediaStorage?.storeGeneratedMedia}`,
    );

    // Guard: verify mediaStorage is properly injected
    if (
      !this.mediaStorage ||
      typeof this.mediaStorage.storeGeneratedMedia !== 'function'
    ) {
      this.logger.error(
        `🎨 [MEDIA-RUNNER] CRITICAL: mediaStorage not properly injected! type=${typeof this.mediaStorage}`,
      );
      throw new Error('MediaStorageHelper not properly injected');
    }

    const storedAssets = await Promise.all(
      imageResponse.images.map((img) =>
        this.mediaStorage.storeGeneratedMedia(img.data, context, {
          prompt: imageParams.prompt,
          revisedPrompt: img.revisedPrompt,
          provider,
          model,
          mime: 'image/png',
          width: img.metadata?.width,
          height: img.metadata?.height,
        }),
      ),
    );

    // Emit progress update
    this.streamingService.emitProgress(
      context,
      'Creating deliverable...',
      request.userMessage || '',
      {
        step: 'Creating deliverable',
        progress: 80,
        status: 'running',
        sequence: 3,
        totalSteps: 4,
      },
    );

    // Create deliverable version with media attachments
    const createResult = await this.createMediaDeliverable(
      definition,
      context,
      payload,
      storedAssets,
      {
        type: 'image-generation',
        prompt: imageParams.prompt,
        revisedPrompt: imageResponse.images[0]?.revisedPrompt,
        provider,
        model,
        imagesGenerated: storedAssets.length,
      },
    );

    if (!createResult.success || !createResult.data) {
      return TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        createResult.error?.message ?? 'Failed to create media deliverable',
      );
    }

    // Emit completion
    this.streamingService.emitProgress(
      context,
      `Generated ${storedAssets.length} image(s)`,
      request.userMessage || '',
      {
        step: 'Complete',
        progress: 100,
        status: 'completed',
        sequence: 4,
        totalSteps: 4,
      },
    );

    this.emitObservabilityEvent(
      'agent.completed',
      `Image generation completed: ${storedAssets.length} images`,
      context,
      { mode: request.mode, progress: 100 },
    );

    return TaskResponseDto.success(AgentTaskMode.BUILD, {
      content: {
        deliverable: createResult.data.deliverable,
        version: createResult.data.version,
        isNew: createResult.data.isNew,
        assets: storedAssets,
        message: `Generated ${storedAssets.length} image(s)`,
      },
      metadata: {
        ...imageResponse.metadata,
        provider,
        model,
        imagesGenerated: storedAssets.length,
      },
    });
  }

  /**
   * Execute video generation (placeholder for future implementation)
   */
  private executeVideoGeneration(
    _definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    context: ExecutionContext,
    _payload: MediaBuildCreatePayload,
    _conversationHistory: ConversationMessage[],
  ): TaskResponseDto {
    this.logger.log(`🎬 [MEDIA-RUNNER] executeVideoGeneration()`);

    // Video generation is async (requires polling)
    // For now, return a placeholder response indicating it's not implemented
    this.emitObservabilityEvent(
      'agent.failed',
      'Video generation not yet implemented',
      context,
      { mode: request.mode, progress: 100 },
    );

    return TaskResponseDto.failure(
      AgentTaskMode.BUILD,
      'Video generation is not yet implemented. Coming soon with Sora 2 and Veo 3 support.',
    );
  }

  /**
   * Resolve media type from agent definition or payload
   */
  private resolveMediaType(
    definition: AgentRuntimeDefinition,
    payload: MediaBuildCreatePayload,
  ): MediaType {
    // Priority: payload > definition config > default
    if (payload.media?.type) {
      return payload.media.type;
    }

    const configMediaType = (
      definition.config as { media?: { type?: MediaType } }
    )?.media?.type;
    if (configMediaType) {
      return configMediaType;
    }

    // Default to image
    return 'image';
  }

  /**
   * Build image generation parameters from request
   */
  private buildImageParams(
    userMessage: string,
    payload: MediaBuildCreatePayload,
    _conversationHistory: ConversationMessage[],
  ): ImageGenerationParams {
    const imageConfig = payload.media?.image || {};

    return {
      prompt: userMessage,
      size: imageConfig.size || '1024x1024',
      quality: imageConfig.quality || 'standard',
      style: imageConfig.style || 'natural',
      numberOfImages: imageConfig.numberOfImages || 1,
      referenceImageUrl: imageConfig.referenceImageUrl,
      referenceImage: imageConfig.referenceImage,
      mask: imageConfig.mask,
      aspectRatio: imageConfig.aspectRatio,
      enhancePrompt: imageConfig.enhancePrompt,
      background: imageConfig.background,
    };
  }

  /**
   * Generate image using the LLM service
   * This method routes to the appropriate provider's image generation API
   */
  private async generateImage(
    provider: string,
    model: string,
    params: ImageGenerationParams,
    context: ExecutionContext,
  ): Promise<ImageGenerationResponse> {
    // The LLMService needs to expose a generateImage method
    // For now, we'll use a direct implementation that can be refactored later
    // when OpenAI/Google services implement generateImage()

    this.logger.log(
      `🖼️ [MEDIA-RUNNER] generateImage() - provider: ${provider}, model: ${model}`,
    );

    try {
      // Call the LLM service's generateImage method
      // This will be implemented in OpenAILLMService and GoogleLLMService
      const response = await this.llmService.generateImage({
        provider,
        model,
        prompt: params.prompt,
        size: params.size,
        quality: params.quality,
        style: params.style,
        numberOfImages: params.numberOfImages,
        referenceImageUrl: params.referenceImageUrl,
        background: params.background,
        executionContext: context,
      });

      return response;
    } catch (error) {
      this.logger.error(
        `Image generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );

      return {
        images: [],
        metadata: {
          provider,
          model,
          requestId: context.taskId,
          timestamp: new Date().toISOString(),
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          timing: { startTime: Date.now(), endTime: Date.now(), duration: 0 },
          status: 'error',
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
        },
        error: {
          code: 'IMAGE_GENERATION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Create deliverable with media attachments
   */
  private async createMediaDeliverable(
    definition: AgentRuntimeDefinition,
    context: ExecutionContext,
    payload: MediaBuildCreatePayload,
    assets: Array<{ assetId: string; url: string; storagePath: string }>,
    metadata: {
      type: string;
      prompt: string;
      revisedPrompt?: string;
      provider: string;
      model: string;
      imagesGenerated?: number;
      videoDurationSeconds?: number;
    },
  ): Promise<{
    success: boolean;
    data?: {
      deliverable: unknown;
      version: unknown;
      isNew: boolean;
    };
    error?: { message: string };
  }> {
    const deliverableId = payload.deliverableId || undefined;

    // Build file attachments structure
    const fileAttachments: {
      images?: Array<{
        assetId: string;
        url: string;
        mime: string;
        thumbnailUrl?: string;
      }>;
      videos?: Array<{
        assetId: string;
        url: string;
        mime: string;
        thumbnailUrl?: string;
      }>;
    } = {};

    if (metadata.type === 'image-generation') {
      fileAttachments.images = assets.map((asset) => ({
        assetId: asset.assetId,
        url: asset.url,
        mime: 'image/png',
      }));
    } else if (metadata.type === 'video-generation') {
      fileAttachments.videos = assets.map((asset) => ({
        assetId: asset.assetId,
        url: asset.url,
        mime: 'video/mp4',
      }));
    }

    // Create deliverable version
    // Map media type to deliverable type (image-generation -> image, video-generation -> video)
    const deliverableType =
      metadata.type === 'video-generation' ? 'video' : 'image';

    const result = await this.deliverablesService.executeAction(
      'create',
      {
        title: this.resolveMediaDeliverableTitle(definition, metadata),
        content: metadata.revisedPrompt || metadata.prompt,
        format:
          metadata.type === 'video-generation' ? 'video/mp4' : 'image/png',
        type: deliverableType,
        deliverableId,
        agentName: definition.name ?? definition.slug,
        taskId: context.taskId,
        fileAttachments,
        metadata: {
          mediaType: metadata.type,
          prompt: metadata.prompt,
          revisedPrompt: metadata.revisedPrompt,
          provider: metadata.provider,
          model: metadata.model,
          imagesGenerated: metadata.imagesGenerated,
          videoDurationSeconds: metadata.videoDurationSeconds,
          assetIds: assets.map((a) => a.assetId),
        },
      },
      context,
    );

    if (!result.success || !result.data) {
      return {
        success: false,
        error: {
          message: result.error?.message ?? 'Failed to create deliverable',
        },
      };
    }

    const data = result.data as {
      deliverable: unknown;
      version: unknown;
      isNew: boolean;
    };

    return {
      success: true,
      data: {
        deliverable: data.deliverable,
        version: data.version,
        isNew: data.isNew,
      },
    };
  }

  /**
   * Resolve deliverable title for media
   */
  private resolveMediaDeliverableTitle(
    definition: AgentRuntimeDefinition,
    metadata: { type: string; prompt: string },
  ): string {
    // Use first 50 chars of prompt as title
    const promptPreview =
      metadata.prompt.length > 50
        ? `${metadata.prompt.substring(0, 50)}...`
        : metadata.prompt;

    const mediaLabel = metadata.type === 'video-generation' ? 'Video' : 'Image';

    return `${mediaLabel}: ${promptPreview}`;
  }
}
