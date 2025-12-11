import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  createMarketingSwarmGraph,
  MarketingSwarmGraph,
} from './marketing-swarm.graph';
import {
  MarketingSwarmInput,
  MarketingSwarmState,
  MarketingSwarmResult,
} from './marketing-swarm.state';
import { LLMHttpClientService } from '../../services/llm-http-client.service';
import { ObservabilityService } from '../../services/observability.service';
import { PostgresCheckpointerService } from '../../persistence/postgres-checkpointer.service';

/**
 * MarketingSwarmService
 *
 * Manages the Marketing Swarm agent lifecycle:
 * - Creates and initializes the graph
 * - Handles swarm execution requests
 * - Provides status checking
 */
@Injectable()
export class MarketingSwarmService implements OnModuleInit {
  private readonly logger = new Logger(MarketingSwarmService.name);
  private graph!: MarketingSwarmGraph;

  constructor(
    private readonly llmClient: LLMHttpClientService,
    private readonly observability: ObservabilityService,
    private readonly checkpointer: PostgresCheckpointerService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing Marketing Swarm graph...');
    this.graph = createMarketingSwarmGraph(
      this.llmClient,
      this.observability,
      this.checkpointer,
    );
    this.logger.log('Marketing Swarm graph initialized');
  }

  /**
   * Execute the marketing swarm
   */
  async execute(input: MarketingSwarmInput): Promise<MarketingSwarmResult> {
    const startTime = Date.now();
    const { context } = input;
    const taskId = context.taskId;

    this.logger.log(
      `Starting Marketing Swarm: taskId=${taskId}, topic=${input.promptData.topic}`,
    );

    try {
      // Initial state
      const initialState: Partial<MarketingSwarmState> = {
        executionContext: context,
        contentTypeSlug: input.contentTypeSlug,
        contentTypeContext: input.contentTypeContext,
        promptData: input.promptData,
        config: input.config,
        phase: 'initializing',
        startedAt: startTime,
      };

      const config = {
        configurable: {
          thread_id: taskId,
        },
      };

      const finalState = await this.graph.invoke(initialState, config);

      const duration = Date.now() - startTime;

      this.logger.log(
        `Marketing Swarm completed: taskId=${taskId}, phase=${finalState.phase}, duration=${duration}ms`,
      );

      // Calculate ranked results
      const rankedResults = finalState.outputs.map((output) => {
        const outputEvals = finalState.evaluations.filter(
          (e) => e.outputId === output.id,
        );
        const avgScore =
          outputEvals.length > 0
            ? outputEvals.reduce((sum, e) => sum + e.score, 0) /
              outputEvals.length
            : 0;
        return {
          outputId: output.id,
          averageScore: Math.round(avgScore * 10) / 10,
        };
      });

      rankedResults.sort((a, b) => b.averageScore - a.averageScore);

      return {
        taskId,
        status: finalState.phase === 'completed' ? 'completed' : 'failed',
        outputs: finalState.outputs,
        evaluations: finalState.evaluations,
        rankedResults,
        error: finalState.error,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Marketing Swarm failed: taskId=${taskId}, error=${errorMessage}`,
      );

      // Emit failure event
      await this.observability.emitFailed(context, taskId, errorMessage, duration);

      return {
        taskId,
        status: 'failed',
        outputs: [],
        evaluations: [],
        rankedResults: [],
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Get status of a swarm execution by task ID
   */
  async getStatus(taskId: string): Promise<{
    taskId: string;
    phase: MarketingSwarmState['phase'];
    progress: {
      total: number;
      completed: number;
      percentage: number;
    };
    error?: string;
  } | null> {
    try {
      const config = {
        configurable: {
          thread_id: taskId,
        },
      };

      const state = await this.graph.getState(config);

      if (!state.values) {
        return null;
      }

      const values = state.values as MarketingSwarmState;
      const total = values.executionQueue.length;
      const completed = values.executionQueue.filter(
        (q) => q.status === 'completed' || q.status === 'skipped',
      ).length;

      return {
        taskId,
        phase: values.phase,
        progress: {
          total,
          completed,
          percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        },
        error: values.error,
      };
    } catch (error) {
      this.logger.error(`Failed to get status for task ${taskId}:`, error);
      return null;
    }
  }

  /**
   * Get full state for a task
   */
  async getFullState(taskId: string): Promise<MarketingSwarmState | null> {
    try {
      const config = {
        configurable: {
          thread_id: taskId,
        },
      };

      const state = await this.graph.getState(config);
      return state.values as MarketingSwarmState;
    } catch (error) {
      this.logger.error(`Failed to get full state for task ${taskId}:`, error);
      return null;
    }
  }
}
