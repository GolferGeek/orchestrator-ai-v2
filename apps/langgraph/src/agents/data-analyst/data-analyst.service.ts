import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  createDataAnalystGraph,
  DataAnalystGraph,
} from './data-analyst.graph';
import {
  DataAnalystInput,
  DataAnalystState,
  validateDataAnalystInput,
  formatValidationErrors,
} from './data-analyst.state';
import { LLMHttpClientService } from '../../services/llm-http-client.service';
import { ObservabilityService } from '../../services/observability.service';
import { PostgresCheckpointerService } from '../../persistence/postgres-checkpointer.service';
import { ListTablesTool } from '../../tools/list-tables.tool';
import { DescribeTableTool } from '../../tools/describe-table.tool';
import { SqlQueryTool } from '../../tools/sql-query.tool';
import { z } from 'zod';

/**
 * Result from Data Analyst execution
 */
export interface DataAnalystResult {
  threadId: string;
  status: 'completed' | 'failed';
  question: string;
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
  question: string;
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
   */
  async analyze(input: DataAnalystInput): Promise<DataAnalystResult> {
    const startTime = Date.now();

    // Validate input
    let validatedInput: DataAnalystInput;
    try {
      validatedInput = validateDataAnalystInput(input);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid input: ${formatValidationErrors(error)}`);
      }
      throw error;
    }

    // Generate thread ID for this analysis
    const threadId = uuidv4();

    this.logger.log(
      `Starting data analysis: taskId=${validatedInput.taskId}, threadId=${threadId}`,
    );

    try {
      // Initial state
      const initialState: Partial<DataAnalystState> = {
        taskId: validatedInput.taskId,
        threadId,
        userId: validatedInput.userId,
        conversationId: validatedInput.conversationId,
        organizationSlug: validatedInput.organizationSlug,
        question: validatedInput.question,
        provider: validatedInput.provider || 'anthropic',
        model: validatedInput.model || 'claude-sonnet-4-20250514',
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
        question: validatedInput.question,
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

      // Emit failure event
      await this.observability.emitFailed({
        taskId: validatedInput.taskId,
        threadId,
        agentSlug: 'data-analyst',
        userId: validatedInput.userId,
        conversationId: validatedInput.conversationId,
        error: errorMessage,
        duration,
      });

      return {
        threadId,
        status: 'failed',
        question: validatedInput.question,
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
        question: values.question,
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
