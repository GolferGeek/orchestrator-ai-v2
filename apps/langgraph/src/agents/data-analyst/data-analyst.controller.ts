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
import { DataAnalystService } from './data-analyst.service';
import { DataAnalystRequestDto } from './dto';
import { ExecutionContext } from '@orchestrator-ai/transport-types';

/**
 * DataAnalystController
 *
 * REST API endpoints for the Data Analyst agent:
 * - POST /data-analyst/analyze - Start a new analysis
 * - GET /data-analyst/status/:threadId - Check analysis status
 * - GET /data-analyst/history/:threadId - Get full state history
 */
@Controller('data-analyst')
export class DataAnalystController {
  private readonly logger = new Logger(DataAnalystController.name);

  constructor(private readonly dataAnalystService: DataAnalystService) {}

  /**
   * Start a new data analysis
   */
  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  async analyze(@Body() request: DataAnalystRequestDto) {
    // Build ExecutionContext from request (supports both context object and individual fields)
    const context: ExecutionContext = {
      taskId: request.context?.taskId || request.taskId || '',
      userId: request.context?.userId || request.userId || '',
      conversationId: request.context?.conversationId || request.conversationId || '',
      orgSlug: request.context?.orgSlug || request.orgSlug || request.organizationSlug || '',
      agentSlug: 'data-analyst',
      agentType: 'langgraph',
      provider: request.context?.provider || request.provider,
      model: request.context?.model || request.model,
    };

    this.logger.log(`Received analysis request: taskId=${context.taskId}, userId=${context.userId}`);

    try {
      const result = await this.dataAnalystService.analyze({
        context,
        userMessage: request.userMessage,
      });

      return {
        success: result.status === 'completed',
        data: result,
      };
    } catch (error) {
      this.logger.error('Analysis failed:', error);
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Analysis failed',
      );
    }
  }

  /**
   * Get analysis status by thread ID
   */
  @Get('status/:threadId')
  @HttpCode(HttpStatus.OK)
  async getStatus(@Param('threadId') threadId: string) {
    this.logger.log(`Getting status for thread: ${threadId}`);

    const status = await this.dataAnalystService.getStatus(threadId);

    if (!status) {
      throw new NotFoundException(`Analysis not found: ${threadId}`);
    }

    return {
      success: true,
      data: status,
    };
  }

  /**
   * Get full state history for a thread
   */
  @Get('history/:threadId')
  @HttpCode(HttpStatus.OK)
  async getHistory(@Param('threadId') threadId: string) {
    this.logger.log(`Getting history for thread: ${threadId}`);

    const history = await this.dataAnalystService.getHistory(threadId);

    if (history.length === 0) {
      throw new NotFoundException(`Analysis not found: ${threadId}`);
    }

    return {
      success: true,
      data: history,
      count: history.length,
    };
  }
}
