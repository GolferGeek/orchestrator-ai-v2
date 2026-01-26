import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AgentIdeasService } from './agent-ideas.service';
import { GetRecommendationsDto, SubmitInterestDto } from './dto';

/**
 * AgentIdeasController
 *
 * Public endpoints for the "Agent Ideas" landing page feature.
 * No authentication required - these are for landing page visitors.
 *
 * Endpoints:
 * - POST /agent-ideas/recommendations - Get AI agent recommendations for an industry
 * - POST /agent-ideas/submit - Submit interest in selected agents
 */
@Controller('agent-ideas')
export class AgentIdeasController {
  private readonly logger = new Logger(AgentIdeasController.name);

  constructor(private readonly agentIdeasService: AgentIdeasService) {}

  /**
   * Get agent recommendations for an industry
   *
   * Public endpoint - no auth required.
   * Calls the LangGraph Business Automation Advisor workflow.
   */
  @Post('recommendations')
  @HttpCode(HttpStatus.OK)
  async getRecommendations(@Body() dto: GetRecommendationsDto) {
    this.logger.log(`Received recommendations request: industry=${dto.industry}`);

    const result = await this.agentIdeasService.getRecommendations(dto.industry);

    return result;
  }

  /**
   * Submit interest in selected agents
   *
   * Public endpoint - no auth required.
   * Stores the lead submission for follow-up.
   */
  @Post('submit')
  @HttpCode(HttpStatus.CREATED)
  async submitInterest(@Body() dto: SubmitInterestDto) {
    this.logger.log(
      `Received submit request: email=${dto.email}, selectedAgents=${dto.selectedAgents.length}`,
    );

    const result = await this.agentIdeasService.submitInterest(dto);

    return result;
  }
}
