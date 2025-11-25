import {
  Controller,
  Post,
  Get,
  Body,
  Logger,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { LLMService } from './llm.service';
import { isLLMResponse } from './services/llm-interfaces';
import { LocalModelStatusService } from './local-model-status.service';
import { RunMetadataService } from './run-metadata.service';
import { RecordLLMUsageDto } from './dto/record-llm-usage.dto';

@Controller('llm')
export class LLMController {
  private readonly logger = new Logger(LLMController.name);

  constructor(
    private readonly llmService: LLMService,
    private readonly localModelStatusService: LocalModelStatusService,
    private readonly runMetadataService: RunMetadataService,
  ) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generate(
    @Body()
    request: {
      systemPrompt: string;
      userPrompt: string;
      options?: {
        temperature?: number;
        maxTokens?: number;
        provider?: 'openai' | 'anthropic' | 'ollama' | 'google';
        // Support full LLM preferences from UI
        providerName?: string;
        modelName?: string;
        // Caller tracking for usage analytics
        callerType?: string;
        callerName?: string;
        // User and conversation context for observability
        userId?: string;
        conversationId?: string;
        dataClassification?: string;
      };
    },
  ): Promise<{
    response: string;
    content?: string;
    sanitizationMetadata?: Record<string, unknown>;
    piiMetadata?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }> {
    try {
      // Guard: Conversation-based requests from frontend should use agent tasks endpoint
      // But allow external API calls (like n8n) to use conversationId for observability
      if (
        request?.options?.conversationId &&
        request?.options?.callerType !== 'external'
      ) {
        const guidance = {
          message:
            'Conversation-based requests must use the agent tasks endpoint to preserve agent + MCP context.',
          endpoint: '/agents/:agentType/:agentName/tasks',
          example: {
            url: '/agents/finance/metrics/tasks',
            body: {
              method: 'process',
              prompt: request.userPrompt,
              conversationId: request.options.conversationId,
              llmSelection: {
                providerName: request.options?.providerName,
                modelName: request.options?.modelName,
              },
            },
          },
        } as const;
        throw new BadRequestException(guidance);
      }

      // Ensure providerName and modelName are set (use provider as fallback for compatibility)
      const providerName =
        request.options?.providerName || request.options?.provider;
      const modelName = request.options?.modelName;

      const result = await this.llmService.generateResponse(
        request.systemPrompt,
        request.userPrompt,
        {
          temperature: request.options?.temperature,
          maxTokens: request.options?.maxTokens,
          provider: request.options?.provider,
          // Support full LLM preferences from UI - ensure both are set
          providerName,
          modelName,
          // Caller tracking - use provided values or defaults
          callerType: request.options?.callerType || 'api',
          callerName: request.options?.callerName || 'llm-controller',
          // User and conversation context for observability and usage tracking
          userId: request.options?.userId,
          conversationId: request.options?.conversationId,
          dataClassification: request.options?.dataClassification || 'public',
          // Request metadata for Python agents
          includeMetadata: true,
        },
      );

      // Handle both string and object responses
      if (typeof result === 'string') {
        return { response: result, content: result };
      }

      if (isLLMResponse(result)) {
        const sanitizationMetadata =
          result.sanitizationMetadata ??
          result.metadata.providerSpecific?.sanitizationMetadata ??
          null;

        const normalized = {
          response: result.content,
          content: result.content,
          sanitizationMetadata: (sanitizationMetadata ?? undefined) as
            | Record<string, unknown>
            | undefined,
          piiMetadata: (result.piiMetadata ?? undefined) as
            | Record<string, unknown>
            | undefined,
          metadata: result.metadata as unknown as Record<string, unknown>,
        };

        return normalized;
      }

      // Fallback: convert to string
      const fallback = String(result);
      return { response: fallback, content: fallback };
    } catch (error) {
      this.logger.error('Failed to generate response', error);
      throw error;
    }
  }

  @Get('local-models/status')
  @HttpCode(HttpStatus.OK)
  async getLocalModelStatus(): Promise<Record<string, unknown>> {
    try {
      const status = await this.localModelStatusService.getOllamaStatus();
      return status as unknown as Record<string, unknown>;
    } catch (error) {
      this.logger.error('Failed to get local model status', error);
      throw error;
    }
  }

  /**
   * Record LLM usage from external callers (e.g., LangGraph tools)
   *
   * This endpoint allows LangGraph tools that call specialized LLMs directly
   * (e.g., Ollama/SQLCoder) to report their usage for tracking and billing.
   */
  @Post('usage')
  @HttpCode(HttpStatus.CREATED)
  async recordUsage(
    @Body() usageDto: RecordLLMUsageDto,
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.debug(
        `Recording LLM usage: ${usageDto.provider}/${usageDto.model} from ${usageDto.callerName}`,
      );

      await this.runMetadataService.insertCompletedUsage({
        provider: usageDto.provider,
        model: usageDto.model,
        isLocal: usageDto.provider.toLowerCase() === 'ollama',
        userId: usageDto.userId,
        callerType: usageDto.callerType,
        callerName: usageDto.callerName,
        conversationId: usageDto.conversationId,
        inputTokens: usageDto.promptTokens,
        outputTokens: usageDto.completionTokens,
        totalCost: undefined, // Let the service calculate from tokens
        startTime: usageDto.timestamp
          ? new Date(usageDto.timestamp).getTime() - (usageDto.latencyMs || 0)
          : Date.now() - (usageDto.latencyMs || 0),
        endTime: usageDto.timestamp
          ? new Date(usageDto.timestamp).getTime()
          : Date.now(),
        status: 'completed',
      });

      return {
        success: true,
        message: 'Usage recorded successfully',
      };
    } catch (error) {
      this.logger.error('Failed to record LLM usage', error);
      throw error;
    }
  }
}
