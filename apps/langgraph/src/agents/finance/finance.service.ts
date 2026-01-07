import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ExecutionContext } from "@orchestrator-ai/transport-types";
import { LLMHttpClientService } from "../../services/llm-http-client.service";
import { ObservabilityService } from "../../services/observability.service";
import { PostgresCheckpointerService } from "../../persistence/postgres-checkpointer.service";
import { FinanceDbService } from "./finance-db.service";
import { createFinanceGraph, FinanceGraph } from "./finance.graph";
import { FinanceWorkflowResult } from "./finance.state";

/**
 * Input for starting a finance workflow task
 */
export interface FinanceWorkflowInput {
  context: ExecutionContext;
  universeVersionId: string;
  runTs?: string;
}

/**
 * FinanceService
 *
 * Orchestrates the Finance Research workflow.
 * Manages the LangGraph execution and result delivery.
 */
@Injectable()
export class FinanceService implements OnModuleInit {
  private readonly logger = new Logger(FinanceService.name);
  private graph!: FinanceGraph;

  constructor(
    private readonly llmClient: LLMHttpClientService,
    private readonly observability: ObservabilityService,
    private readonly checkpointer: PostgresCheckpointerService,
    private readonly financeDb: FinanceDbService,
  ) {
    // Graph initialization deferred to onModuleInit to ensure checkpointer is ready
  }

  /**
   * Initialize the graph after all dependencies are ready
   * This runs after PostgresCheckpointerService.onModuleInit() completes
   */
  async onModuleInit() {
    this.logger.log("Initializing Finance graph...");
    this.graph = createFinanceGraph(
      this.llmClient,
      this.observability,
      this.checkpointer,
      this.financeDb,
    );
    this.logger.log("Finance graph initialized successfully");
  }

  /**
   * Execute the finance research workflow
   *
   * This is the main entry point called by the controller.
   */
  async execute(input: FinanceWorkflowInput): Promise<FinanceWorkflowResult> {
    const startTime = Date.now();
    const { context, universeVersionId, runTs } = input;

    this.logger.log(
      `Starting Finance Research: taskId=${context.taskId}, universeVersionId=${universeVersionId}`,
    );

    try {
      // Execute the graph
      const result = await this.graph.invoke(
        {
          executionContext: context,
          universeVersionId,
          runTs: runTs || new Date().toISOString(),
        },
        {
          configurable: {
            thread_id: context.taskId,
          },
        },
      );

      const duration = Date.now() - startTime;

      // Check if execution was successful
      if (result.phase === "failed") {
        this.logger.error(
          `Finance Research failed: taskId=${context.taskId}, error=${result.error}`,
        );

        return {
          taskId: context.taskId,
          status: "failed",
          runId: result.runId || "",
          recommendations: [],
          error: result.error,
          duration,
        };
      }

      this.logger.log(
        `Finance Research completed: taskId=${context.taskId}, runId=${result.runId}, duration=${duration}ms`,
      );

      return {
        taskId: context.taskId,
        status: "completed",
        runId: result.runId,
        recommendations: result.recommendations,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Finance Research failed: taskId=${context.taskId}, error=${errorMessage}`,
      );

      return {
        taskId: context.taskId,
        status: "failed",
        runId: "",
        recommendations: [],
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Get recommendations for a run
   */
  async getRecommendations(runId: string) {
    return this.financeDb.getRecommendationsByRun(runId);
  }
}
