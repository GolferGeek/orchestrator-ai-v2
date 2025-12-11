import {
  Controller,
  Post,
  Get,
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
 * REST API endpoints for the Marketing Swarm agent:
 * - POST /marketing-swarm/execute - Start a new swarm execution
 * - GET /marketing-swarm/status/:taskId - Check execution status
 * - GET /marketing-swarm/state/:taskId - Get full execution state
 */
@Controller('marketing-swarm')
export class MarketingSwarmController {
  private readonly logger = new Logger(MarketingSwarmController.name);

  constructor(private readonly marketingSwarmService: MarketingSwarmService) {}

  /**
   * Execute the marketing swarm
   */
  @Post('execute')
  @HttpCode(HttpStatus.OK)
  async execute(@Body() request: MarketingSwarmRequestDto) {
    // ExecutionContext is required
    if (!request.context) {
      throw new BadRequestException('ExecutionContext is required');
    }

    const context = request.context;
    this.logger.log(
      `Received swarm execution request: taskId=${context.taskId}, topic=${request.promptData.topic}`,
    );

    // Validate minimum configuration
    if (!request.config.writers || request.config.writers.length === 0) {
      throw new BadRequestException('At least one writer is required');
    }

    try {
      const result = await this.marketingSwarmService.execute({
        context,
        contentTypeSlug: request.contentTypeSlug,
        contentTypeContext: request.contentTypeContext,
        promptData: request.promptData,
        config: {
          ...request.config,
          maxEditCycles: request.config.maxEditCycles || 3,
        },
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
        phase: state.phase,
        contentTypeSlug: state.contentTypeSlug,
        promptData: state.promptData,
        config: state.config,
        executionQueue: state.executionQueue,
        outputs: state.outputs,
        evaluations: state.evaluations,
        error: state.error,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
      },
    };
  }
}
