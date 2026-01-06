import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { FinanceService } from "./finance.service";
import { EvaluationService } from "./evaluation.service";
import { FinanceRequestDto } from "./dto";

/**
 * FinanceController
 *
 * REST API endpoints for the Finance Research agent.
 *
 * Endpoints:
 * - POST /finance/run - Execute finance research workflow
 * - GET /finance/recommendations/:runId - Get recommendations for a run
 */
@Controller("finance")
export class FinanceController {
  private readonly logger = new Logger(FinanceController.name);

  constructor(
    private readonly financeService: FinanceService,
    private readonly evaluationService: EvaluationService,
  ) {}

  /**
   * Execute the finance research workflow
   *
   * Accepts ExecutionContext + universeVersionId payload.
   * Returns recommendations for the universe.
   */
  @Post("run")
  @HttpCode(HttpStatus.OK)
  async run(@Body() request: FinanceRequestDto) {
    // ExecutionContext is required
    if (!request.context) {
      throw new BadRequestException("ExecutionContext is required");
    }

    const context = request.context;
    const taskId = context.taskId;

    this.logger.log(
      `Received finance workflow request: taskId=${taskId}, universeVersionId=${request.universeVersionId}`,
    );

    if (!taskId) {
      throw new BadRequestException("taskId is required in context");
    }

    if (!request.universeVersionId) {
      throw new BadRequestException("universeVersionId is required");
    }

    try {
      const result = await this.financeService.execute({
        context,
        universeVersionId: request.universeVersionId,
        runTs: request.runTs,
      });

      // If execution failed, return error response
      if (result.status !== "completed") {
        return {
          success: false,
          status: "failed",
          error: result.error || "Execution failed",
        };
      }

      // Return result with recommendations
      return {
        success: true,
        data: {
          taskId: result.taskId,
          runId: result.runId,
          recommendationCount: result.recommendations.length,
          recommendations: result.recommendations,
          duration: result.duration,
        },
      };
    } catch (error) {
      this.logger.error("Finance workflow execution failed:", error);
      throw new BadRequestException(
        error instanceof Error ? error.message : "Finance workflow failed",
      );
    }
  }

  /**
   * Get recommendations by run ID
   */
  @Get("recommendations/:runId")
  @HttpCode(HttpStatus.OK)
  async getRecommendations(@Param("runId") runId: string) {
    this.logger.log(`Getting recommendations for run: ${runId}`);

    const recommendations = await this.financeService.getRecommendations(runId);

    if (!recommendations || recommendations.length === 0) {
      throw new NotFoundException(`No recommendations found for run: ${runId}`);
    }

    return {
      success: true,
      data: {
        runId,
        recommendations,
      },
    };
  }

  /**
   * Run evaluation for pending recommendations
   *
   * This endpoint triggers the learning loop evaluation:
   * 1. Fetches pending recommendations (without outcomes)
   * 2. Gets realized prices for each recommendation
   * 3. Computes win/loss outcomes
   * 4. Generates postmortem explanations via LLM
   * 5. Stores results for future learning
   *
   * Can be called:
   * - Manually via API
   * - Via scheduled job (cron) at market close
   */
  @Post("evaluate")
  @HttpCode(HttpStatus.OK)
  async evaluate(
    @Body() request: { context: FinanceRequestDto["context"] },
    @Query("lookbackHours") lookbackHours?: string,
  ) {
    if (!request.context) {
      throw new BadRequestException("ExecutionContext is required");
    }

    const hours = lookbackHours ? parseInt(lookbackHours, 10) : 48;

    this.logger.log(
      `Starting evaluation for pending recommendations (lookback: ${hours}h)`,
    );

    try {
      const results =
        await this.evaluationService.evaluatePendingRecommendations(
          request.context,
          hours,
        );

      const summary = {
        evaluated: results.length,
        wins: results.filter((r) => r.outcome.winLoss === "win").length,
        losses: results.filter((r) => r.outcome.winLoss === "loss").length,
        neutral: results.filter((r) => r.outcome.winLoss === "neutral").length,
        withPostmortems: results.filter((r) => r.postmortem).length,
      };

      return {
        success: true,
        data: {
          summary,
          results,
        },
      };
    } catch (error) {
      this.logger.error("Evaluation failed:", error);
      throw new BadRequestException(
        error instanceof Error ? error.message : "Evaluation failed",
      );
    }
  }

  /**
   * Get learning context for instruments
   *
   * Returns aggregated lessons from recent postmortems
   * that can be used to inform future recommendations.
   */
  @Get("learning-context")
  @HttpCode(HttpStatus.OK)
  async getLearningContext(
    @Query("instruments") instruments: string,
    @Query("limit") limit?: string,
  ) {
    if (!instruments) {
      throw new BadRequestException("instruments query param is required");
    }

    const symbolList = instruments.split(",").map((s) => s.trim());
    const limitNum = limit ? parseInt(limit, 10) : 10;

    const context = await this.evaluationService.getLearningContext(
      symbolList,
      limitNum,
    );

    return {
      success: true,
      data: {
        instruments: symbolList,
        context,
      },
    };
  }
}
