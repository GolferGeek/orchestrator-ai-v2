import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Command } from '@langchain/langgraph';
import {
  createExtendedPostWriterGraph,
  ExtendedPostWriterGraph,
} from './extended-post-writer.graph';
import {
  ExtendedPostWriterInput,
  ExtendedPostWriterState,
  GeneratedContent,
  HitlResponse,
  validateExtendedPostWriterInput,
  formatValidationErrors,
} from './extended-post-writer.state';
import { LLMHttpClientService } from '../../services/llm-http-client.service';
import { ObservabilityService } from '../../services/observability.service';
import { PostgresCheckpointerService } from '../../persistence/postgres-checkpointer.service';
import { z } from 'zod';

/**
 * Result from Extended Post Writer generation
 */
export interface ExtendedPostWriterResult {
  threadId: string;
  status: ExtendedPostWriterState['status'];
  topic: string;
  generatedContent?: GeneratedContent;
  finalContent?: GeneratedContent;
  error?: string;
  duration?: number;
}

/**
 * Status response for checking thread state
 */
export interface ExtendedPostWriterStatus {
  threadId: string;
  status: ExtendedPostWriterState['status'];
  topic: string;
  generatedContent?: GeneratedContent;
  finalContent?: GeneratedContent;
  hitlPending: boolean;
  error?: string;
}

/**
 * ExtendedPostWriterService
 *
 * Manages the Extended Post Writer agent lifecycle:
 * - Creates and initializes the graph
 * - Handles content generation requests
 * - Manages HITL resume flow
 * - Provides status checking
 */
@Injectable()
export class ExtendedPostWriterService implements OnModuleInit {
  private readonly logger = new Logger(ExtendedPostWriterService.name);
  private graph!: ExtendedPostWriterGraph;

  constructor(
    private readonly llmClient: LLMHttpClientService,
    private readonly observability: ObservabilityService,
    private readonly checkpointer: PostgresCheckpointerService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing Extended Post Writer graph...');
    this.graph = createExtendedPostWriterGraph(
      this.llmClient,
      this.observability,
      this.checkpointer,
    );
    this.logger.log('Extended Post Writer graph initialized');
  }

  /**
   * Generate content (will pause at HITL)
   */
  async generate(input: ExtendedPostWriterInput): Promise<ExtendedPostWriterResult> {
    const startTime = Date.now();

    // Validate input
    let validatedInput: ExtendedPostWriterInput;
    try {
      validatedInput = validateExtendedPostWriterInput(input);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid input: ${formatValidationErrors(error)}`);
      }
      throw error;
    }

    // Generate thread ID
    const threadId = uuidv4();

    this.logger.log(
      `Starting content generation: taskId=${validatedInput.taskId}, threadId=${threadId}`,
    );

    try {
      // Initial state
      const initialState: Partial<ExtendedPostWriterState> = {
        taskId: validatedInput.taskId,
        threadId,
        userId: validatedInput.userId,
        conversationId: validatedInput.conversationId,
        organizationSlug: validatedInput.organizationSlug,
        topic: validatedInput.topic,
        context: validatedInput.context,
        keywords: validatedInput.keywords || [],
        tone: validatedInput.tone || 'professional',
        provider: validatedInput.provider || 'anthropic',
        model: validatedInput.model || 'claude-sonnet-4-20250514',
        status: 'started',
        startedAt: startTime,
      };

      const config = {
        configurable: {
          thread_id: threadId,
        },
      };

      // Run until HITL interrupt
      const result = await this.graph.invoke(initialState, config);

      // Check current state
      const state = await this.graph.getState(config);
      const isInterrupted = state.next && state.next.length > 0;

      this.logger.log(
        `Content generation paused at HITL: threadId=${threadId}, interrupted=${isInterrupted}`,
      );

      return {
        threadId,
        status: isInterrupted ? 'hitl_waiting' : result.status,
        topic: validatedInput.topic,
        generatedContent: result.generatedContent,
        error: result.error,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Content generation failed: threadId=${threadId}, error=${errorMessage}`,
      );

      return {
        threadId,
        status: 'failed',
        topic: validatedInput.topic,
        error: errorMessage,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Resume from HITL with decision
   */
  async resume(
    threadId: string,
    response: HitlResponse,
  ): Promise<ExtendedPostWriterResult> {
    this.logger.log(
      `Resuming from HITL: threadId=${threadId}, decision=${response.decision}`,
    );

    try {
      const config = {
        configurable: {
          thread_id: threadId,
        },
      };

      // Get current state to extract topic
      const currentState = await this.graph.getState(config);
      if (!currentState.values) {
        throw new Error(`Thread not found: ${threadId}`);
      }

      const values = currentState.values as ExtendedPostWriterState;

      // Resume with the HITL response using Command
      const result = await this.graph.invoke(
        new Command({ resume: response }),
        config,
      );

      const duration = Date.now() - values.startedAt;

      this.logger.log(
        `HITL resume completed: threadId=${threadId}, status=${result.status}, duration=${duration}ms`,
      );

      return {
        threadId,
        status: result.status,
        topic: values.topic,
        generatedContent: result.generatedContent,
        finalContent: result.finalContent,
        error: result.error,
        duration,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `HITL resume failed: threadId=${threadId}, error=${errorMessage}`,
      );

      throw new Error(`Resume failed: ${errorMessage}`);
    }
  }

  /**
   * Get status of content generation by thread ID
   */
  async getStatus(threadId: string): Promise<ExtendedPostWriterStatus | null> {
    try {
      const config = {
        configurable: {
          thread_id: threadId,
        },
      };

      const state = await this.graph.getState(config);

      if (!state.values) {
        return null;
      }

      const values = state.values as ExtendedPostWriterState;
      const isInterrupted = state.next && state.next.length > 0;

      return {
        threadId,
        status: isInterrupted ? 'hitl_waiting' : values.status,
        topic: values.topic,
        generatedContent: values.generatedContent,
        finalContent: values.finalContent,
        hitlPending: isInterrupted,
        error: values.error,
      };
    } catch (error) {
      this.logger.error(`Failed to get status for thread ${threadId}:`, error);
      return null;
    }
  }

  /**
   * Get full state history for a thread
   */
  async getHistory(threadId: string): Promise<ExtendedPostWriterState[]> {
    try {
      const config = {
        configurable: {
          thread_id: threadId,
        },
      };

      const history: ExtendedPostWriterState[] = [];
      for await (const state of this.graph.getStateHistory(config)) {
        history.push(state.values as ExtendedPostWriterState);
      }

      return history;
    } catch (error) {
      this.logger.error(`Failed to get history for thread ${threadId}:`, error);
      return [];
    }
  }
}
