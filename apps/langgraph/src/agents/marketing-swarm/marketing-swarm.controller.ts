import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { MarketingSwarmService } from './marketing-swarm.service';
import { MarketingSwarmRequestDto } from './dto';

/**
 * MarketingSwarmController
 *
 * Phase 2: REST API endpoints for the Marketing Swarm agent.
 *
 * Key change: The task and its configuration must already exist in the database
 * (created by the frontend when user submits the config form).
 * This endpoint just triggers execution.
 *
 * Endpoints:
 * - POST /marketing-swarm/execute - Start execution for an existing task
 * - GET /marketing-swarm/status/:taskId - Check execution status
 * - GET /marketing-swarm/state/:taskId - Get full execution state from DB
 */
@Controller('marketing-swarm')
export class MarketingSwarmController {
  private readonly logger = new Logger(MarketingSwarmController.name);

  constructor(private readonly marketingSwarmService: MarketingSwarmService) {}

  /**
   * Execute the marketing swarm
   *
   * Phase 2: The task must already exist in marketing.swarm_tasks table.
   * The frontend creates the task with config when user submits the form.
   * This endpoint triggers the actual processing.
   */
  @Post('execute')
  @HttpCode(HttpStatus.OK)
  async execute(@Body() request: MarketingSwarmRequestDto) {
    // ExecutionContext is required
    if (!request.context) {
      throw new BadRequestException('ExecutionContext is required');
    }

    const context = request.context;
    const taskId = context.taskId;

    this.logger.log(`Received swarm execution request: taskId=${taskId}`);

    if (!taskId) {
      throw new BadRequestException('taskId is required in context');
    }

    try {
      const result = await this.marketingSwarmService.execute({
        context,
        taskId,
      });

      return {
        success: result.status === 'completed',
        data: result,
      };
    } catch (error) {
      this.logger.error('Swarm execution failed:', error);
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Swarm execution failed',
      );
    }
  }

  /**
   * Get execution status by task ID
   */
  @Get('status/:taskId')
  @HttpCode(HttpStatus.OK)
  async getStatus(@Param('taskId') taskId: string) {
    this.logger.log(`Getting status for task: ${taskId}`);

    const status = await this.marketingSwarmService.getStatus(taskId);

    if (!status) {
      throw new NotFoundException(`Swarm task not found: ${taskId}`);
    }

    return {
      success: true,
      data: status,
    };
  }

  /**
   * Get full execution state by task ID
   *
   * Returns all outputs and evaluations from the database.
   * Used for reconnection - frontend rebuilds UI from this data.
   */
  @Get('state/:taskId')
  @HttpCode(HttpStatus.OK)
  async getState(@Param('taskId') taskId: string) {
    this.logger.log(`Getting full state for task: ${taskId}`);

    const state = await this.marketingSwarmService.getFullState(taskId);

    if (!state) {
      throw new NotFoundException(`Swarm task not found: ${taskId}`);
    }

    return {
      success: true,
      data: {
        taskId,
        outputs: state.outputs,
        evaluations: state.evaluations,
      },
    };
  }

  /**
   * Delete a task and all associated data
   *
   * Deletes evaluations, outputs, and the swarm_task from the database.
   * Called when a conversation/deliverable is deleted from the API.
   */
  @Delete(':taskId')
  @HttpCode(HttpStatus.OK)
  async deleteTask(@Param('taskId') taskId: string) {
    this.logger.log(`Deleting task: ${taskId}`);

    const success = await this.marketingSwarmService.deleteTask(taskId);

    if (!success) {
      throw new NotFoundException(`Swarm task not found: ${taskId}`);
    }

    return {
      success: true,
      message: `Task ${taskId} and all associated data deleted`,
    };
  }
}
