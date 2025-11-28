import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  createDataAnalystGraph,
  DataAnalystGraph,
} from './data-analyst.graph';
import {
  DataAnalystInput,
  DataAnalystState,
  DataAnalystResult,
  DataAnalystStatus,
} from './data-analyst.state';
import { LLMHttpClientService } from '../../services/llm-http-client.service';
import { ObservabilityService } from '../../services/observability.service';
import { PostgresCheckpointerService } from '../../persistence/postgres-checkpointer.service';
import {
  ListTablesTool,
  DescribeTableTool,
  SqlQueryTool,
} from '../../tools/data/database';

/**
 * Result from Data Analyst execution
 */
export interface DataAnalystResult {
  threadId: string;
  status: 'completed' | 'failed';
  userMessage: string;
  summary?: string;
  generatedSql?: string;
  sqlResults?: string;
  error?: string;
  duration: number;
}

/**
 * Status response for checking thread state
 */
export interface DataAnalystStatus {
  threadId: string;
  status: DataAnalystState['status'];
  userMessage: string;
  summary?: string;
  error?: string;
}

/**
 * DataAnalystService
 *
 * Manages the Data Analyst agent lifecycle:
 * - Creates and initializes the graph
 * - Handles analysis requests
 * - Provides status checking
 */
@Injectable()
export class DataAnalystService implements OnModuleInit {
  private readonly logger = new Logger(DataAnalystService.name);
  private graph!: DataAnalystGraph;

  constructor(
    private readonly llmClient: LLMHttpClientService,
    private readonly observability: ObservabilityService,
    private readonly checkpointer: PostgresCheckpointerService,
    private readonly listTablesTool: ListTablesTool,
    private readonly describeTableTool: DescribeTableTool,
    private readonly sqlQueryTool: SqlQueryTool,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing Data Analyst graph...');
    this.graph = createDataAnalystGraph(
      this.llmClient,
      this.observability,
      this.checkpointer,
      this.listTablesTool,
      this.describeTableTool,
      this.sqlQueryTool,
    );
    this.logger.log('Data Analyst graph initialized');
  }

  /**
   * Run a data analysis query
   *
   * @param input - Input containing ExecutionContext and analysis params
   */
  async analyze(input: DataAnalystInput): Promise<DataAnalystResult> {
    const startTime = Date.now();

    // Extract context fields
    const { context } = input;
    const taskId = context.taskId;

    // Input is already validated by NestJS DTOs at the controller level
    // Use taskId as threadId - no need for separate identifier
    const threadId = taskId;

    if (!taskId) {
      throw new Error('taskId is required in ExecutionContext');
    }

    this.logger.log(
      `Starting data analysis: taskId=${taskId}, threadId=${threadId}`,
    );

    try {
      // Initial state - extract fields from ExecutionContext
      const initialState: Partial<DataAnalystState> = {
        taskId,
        threadId,
        userId: context.userId,
        conversationId: context.conversationId,
        organizationSlug: context.orgSlug,
        userMessage: input.userMessage,
        provider: context.provider || 'anthropic',
        model: context.model || 'claude-sonnet-4-20250514',
        status: 'started',
        startedAt: startTime,
      };

      // Run the graph
      const config = {
        configurable: {
          thread_id: threadId,
        },
      };

      const finalState = await this.graph.invoke(initialState, config);

      const duration = Date.now() - startTime;

      this.logger.log(
        `Data analysis completed: threadId=${threadId}, status=${finalState.status}, duration=${duration}ms`,
      );

      return {
        threadId,
        status: finalState.status === 'completed' ? 'completed' : 'failed',
        userMessage: input.userMessage,
        summary: finalState.summary,
        generatedSql: finalState.generatedSql,
        sqlResults: finalState.sqlResults,
        error: finalState.error,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Data analysis failed: threadId=${threadId}, error=${errorMessage}`,
      );

      // Emit failure event - use context fields
      await this.observability.emitFailed({
        taskId,
        threadId,
        agentSlug: 'data-analyst',
        userId: context.userId,
        conversationId: context.conversationId,
        error: errorMessage,
        duration,
      });

      return {
        threadId,
        status: 'failed',
        userMessage: input.userMessage,
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Get status of an analysis by thread ID
   */
  async getStatus(threadId: string): Promise<DataAnalystStatus | null> {
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

      const values = state.values as DataAnalystState;

      return {
        threadId,
        status: values.status,
        userMessage: values.userMessage,
        summary: values.summary,
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
  async getHistory(threadId: string): Promise<DataAnalystState[]> {
    try {
      const config = {
        configurable: {
          thread_id: threadId,
        },
      };

      const history: DataAnalystState[] = [];
      for await (const state of this.graph.getStateHistory(config)) {
        history.push(state.values as DataAnalystState);
      }

      return history;
    } catch (error) {
      this.logger.error(`Failed to get history for thread ${threadId}:`, error);
      return [];
    }
  }
}
