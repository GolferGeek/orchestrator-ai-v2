import { Injectable, Logger } from '@nestjs/common';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { DualTrackProcessorService } from './dual-track-processor.service';
import { MarketingDbService, OutputRow, EvaluationRow } from './marketing-db.service';
import { ObservabilityService } from '../../services/observability.service';

/**
 * Input for starting a marketing swarm task
 */
export interface MarketingSwarmInput {
  context: ExecutionContext;
  taskId: string;
}

/**
 * Result of a marketing swarm execution
 */
export interface MarketingSwarmResult {
  taskId: string;
  status: 'completed' | 'failed';
  outputs: OutputRow[];
  evaluations: EvaluationRow[];
  winner?: OutputRow;
  error?: string;
  duration: number;
}

/**
 * Status response for a task
 */
export interface TaskStatus {
  taskId: string;
  status: string;
  phase?: string;
  progress: {
    total: number;
    completed: number;
    percentage: number;
  };
  error?: string;
}

/**
 * MarketingSwarmService
 *
 * Phase 2: Database-driven Marketing Swarm service.
 *
 * This service acts as the entry point for Marketing Swarm execution.
 * All state is managed in the database, not in memory.
 *
 * Key changes from Phase 1:
 * - No LangGraph state graph (database IS the state)
 * - Uses DualTrackProcessorService for execution
 * - Fat SSE messages with full row data
 * - Two-stage evaluation with weighted ranking
 */
@Injectable()
export class MarketingSwarmService {
  private readonly logger = new Logger(MarketingSwarmService.name);

  constructor(
    private readonly processor: DualTrackProcessorService,
    private readonly db: MarketingDbService,
    private readonly observability: ObservabilityService,
  ) {}

  /**
   * Execute the marketing swarm
   *
   * This is the main entry point called by the controller.
   * The actual processing is handled by DualTrackProcessorService.
   */
  async execute(input: MarketingSwarmInput): Promise<MarketingSwarmResult> {
    const startTime = Date.now();
    const { context, taskId } = input;

    this.logger.log(`Starting Marketing Swarm: taskId=${taskId}`);

    try {
      // Process the task using the dual-track processor
      await this.processor.processTask(taskId, context);

      const duration = Date.now() - startTime;

      // Get final results from database
      const outputs = await this.db.getAllOutputs(taskId);
      const evaluations = await this.db.getAllEvaluations(taskId);
      const winner = outputs.find((o) => o.final_rank === 1);

      this.logger.log(
        `Marketing Swarm completed: taskId=${taskId}, duration=${duration}ms`,
      );

      return {
        taskId,
        status: 'completed',
        outputs,
        evaluations,
        winner,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Marketing Swarm failed: taskId=${taskId}, error=${errorMessage}`,
      );

      return {
        taskId,
        status: 'failed',
        outputs: [],
        evaluations: [],
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Get status of a swarm execution by task ID
   *
   * Reads directly from the database (not from in-memory state).
   */
  async getStatus(taskId: string): Promise<TaskStatus | null> {
    try {
      // Get task from database
      const outputs = await this.db.getAllOutputs(taskId);
      const evaluations = await this.db.getAllEvaluations(taskId);

      if (outputs.length === 0) {
        return null;
      }

      // Calculate progress based on outputs and evaluations
      const writingComplete = outputs.filter(
        (o) => o.status === 'approved' || o.status === 'failed',
      ).length;
      const totalOutputs = outputs.length;

      const initialEvalsComplete = evaluations.filter(
        (e) => e.stage === 'initial' && e.status === 'completed',
      ).length;
      const totalInitialEvals = evaluations.filter(
        (e) => e.stage === 'initial',
      ).length;

      const finalEvalsComplete = evaluations.filter(
        (e) => e.stage === 'final' && e.status === 'completed',
      ).length;
      const totalFinalEvals = evaluations.filter(
        (e) => e.stage === 'final',
      ).length;

      // Determine phase
      let phase: string;
      if (writingComplete < totalOutputs) {
        phase = 'writing';
      } else if (
        totalInitialEvals > 0 &&
        initialEvalsComplete < totalInitialEvals
      ) {
        phase = 'evaluating_initial';
      } else if (
        totalFinalEvals > 0 &&
        finalEvalsComplete < totalFinalEvals
      ) {
        phase = 'evaluating_final';
      } else if (outputs.some((o) => o.final_rank !== null)) {
        phase = 'completed';
      } else {
        phase = 'processing';
      }

      // Calculate overall progress
      const totalSteps =
        totalOutputs + totalInitialEvals + totalFinalEvals;
      const completedSteps =
        writingComplete + initialEvalsComplete + finalEvalsComplete;

      return {
        taskId,
        status: phase === 'completed' ? 'completed' : 'running',
        phase,
        progress: {
          total: totalSteps,
          completed: completedSteps,
          percentage:
            totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get status for task ${taskId}:`, error);
      return null;
    }
  }

  /**
   * Get full state for a task from database
   */
  async getFullState(taskId: string): Promise<{
    outputs: OutputRow[];
    evaluations: EvaluationRow[];
  } | null> {
    try {
      const outputs = await this.db.getAllOutputs(taskId);
      const evaluations = await this.db.getAllEvaluations(taskId);

      return { outputs, evaluations };
    } catch (error) {
      this.logger.error(`Failed to get full state for task ${taskId}:`, error);
      return null;
    }
  }

  /**
   * Delete a task and all associated data
   *
   * Deletes evaluations, outputs, and the swarm_task from the database.
   * Called when a conversation/deliverable is deleted.
   *
   * @param taskId - The task ID to delete
   * @returns true if deletion was successful
   */
  async deleteTask(taskId: string): Promise<boolean> {
    this.logger.log(`Deleting task: ${taskId}`);

    // Check if task exists
    const exists = await this.db.taskExists(taskId);
    if (!exists) {
      this.logger.warn(`Task not found for deletion: ${taskId}`);
      return false;
    }

    // Delete all task data
    const success = await this.db.deleteTaskData(taskId);

    if (success) {
      this.logger.log(`Successfully deleted task: ${taskId}`);
    } else {
      this.logger.error(`Failed to delete task: ${taskId}`);
    }

    return success;
  }
}
