import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { BusinessAutomationAdvisorService } from "./business-automation-advisor.service";
import { BusinessAutomationAdvisorRequestDto } from "./dto";

/**
 * BusinessAutomationAdvisorController
 *
 * REST API endpoint for the Business Automation Advisor agent:
 * - POST /business-automation-advisor/generate - Get agent recommendations for an industry
 */
@Controller("business-automation-advisor")
export class BusinessAutomationAdvisorController {
  private readonly logger = new Logger(BusinessAutomationAdvisorController.name);

  constructor(
    private readonly businessAutomationAdvisorService: BusinessAutomationAdvisorService,
  ) {}

  /**
   * Generate agent recommendations for an industry
   *
   * Takes an industry/business type and returns 8-10 AI agent recommendations
   * that could help automate their business processes.
   */
  @Post("generate")
  @HttpCode(HttpStatus.OK)
  async generate(@Body() request: BusinessAutomationAdvisorRequestDto) {
    // ExecutionContext is required
    if (!request.context) {
      throw new BadRequestException("ExecutionContext is required");
    }

    // Industry is required
    if (!request.industry || request.industry.trim().length === 0) {
      throw new BadRequestException("Industry input is required");
    }

    const context = request.context;
    this.logger.log(
      `Received generation request: taskId=${context.taskId}, industry=${request.industry}`,
    );

    try {
      const result = await this.businessAutomationAdvisorService.generate({
        context,
        industry: request.industry,
      });

      // Return the result directly - it has its own status field
      return result;
    } catch (error) {
      this.logger.error("Generation failed:", error);
      throw new BadRequestException(
        error instanceof Error ? error.message : "Generation failed",
      );
    }
  }
}
