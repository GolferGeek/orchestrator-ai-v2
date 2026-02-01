import { Injectable, Logger } from '@nestjs/common';
import { PortfolioRepository } from '../repositories/portfolio.repository';
import { AnalystAssessmentResult } from '../interfaces/ensemble.interface';
import { Target } from '../interfaces/target.interface';
import {
  AnalystPosition,
  AnalystPortfolio,
  PositionDirection,
} from '../interfaces/portfolio.interface';

/**
 * Input for creating a position from an analyst assessment
 */
export interface CreatePositionFromAssessmentInput {
  assessment: AnalystAssessmentResult;
  target: Target;
  entryPrice: number;
  predictionId?: string;
}

/**
 * Result of position creation
 */
export interface PositionCreationResult {
  position: AnalystPosition;
  portfolio: AnalystPortfolio;
}

/**
 * Service for managing analyst positions based on their assessments
 * Handles position sizing, creation, and P&L tracking per fork
 *
 * Position sizing is tiered based on confidence (configurable in database):
 * - 60-70% confidence → 5% of portfolio
 * - 70-80% confidence → 10% of portfolio
 * - 80%+ confidence → 15% of portfolio
 */
@Injectable()
export class AnalystPositionService {
  private readonly logger = new Logger(AnalystPositionService.name);

  // Default position sizing parameters (used as fallback)
  private readonly DEFAULT_POSITION_PERCENT = 0.05; // 5% default position
  private readonly MIN_CONFIDENCE_FOR_POSITION = 0.6; // Minimum 60% confidence to take position

  constructor(private readonly portfolioRepository: PortfolioRepository) {}

  /**
   * Create a position for an analyst assessment
   * Position size is based on the analyst's confidence
   */
  async createPositionFromAssessment(
    input: CreatePositionFromAssessmentInput,
  ): Promise<PositionCreationResult | null> {
    const { assessment, target, entryPrice, predictionId } = input;

    // Determine fork type from assessment
    const forkType = assessment.fork_type || 'user';

    // Get analyst's portfolio for this fork
    const portfolio = await this.portfolioRepository.getAnalystPortfolio(
      assessment.analyst.analyst_id,
      forkType,
    );

    if (!portfolio) {
      this.logger.warn(
        `No ${forkType} portfolio found for analyst ${assessment.analyst.slug}`,
      );
      return null;
    }

    // Skip if portfolio is suspended (paper-only mode)
    if (portfolio.status === 'suspended' && forkType === 'ai') {
      this.logger.log(
        `Analyst ${assessment.analyst.slug} is suspended - creating paper-only position`,
      );
    }

    // Determine position direction from assessment direction
    const direction = this.mapAssessmentToPosition(assessment.direction);
    if (!direction) {
      this.logger.log(
        `Assessment direction ${assessment.direction} doesn't translate to a position`,
      );
      return null;
    }

    // Calculate position size based on confidence (using tiered sizing from DB)
    const quantity = await this.calculatePositionSize(
      portfolio.current_balance,
      entryPrice,
      assessment.confidence,
    );

    if (quantity <= 0) {
      this.logger.warn(
        `Calculated position size is 0 or negative for analyst ${assessment.analyst.slug}`,
      );
      return null;
    }

    // Create the position
    const position = await this.portfolioRepository.createAnalystPosition({
      portfolio_id: portfolio.id,
      analyst_assessment_id: undefined, // Will be linked if we store assessments
      prediction_id: predictionId,
      target_id: target.id,
      symbol: target.symbol,
      direction,
      quantity,
      entry_price: entryPrice,
      is_paper_only: portfolio.status === 'suspended',
    });

    this.logger.log(
      `Created ${forkType} position for analyst ${assessment.analyst.slug}: ${direction} ${quantity} ${target.symbol} @ $${entryPrice}`,
    );

    return { position, portfolio };
  }

  /**
   * Create positions for all assessments in a dual-fork result
   * Returns positions grouped by fork type
   */
  async createPositionsFromDualForkAssessments(
    userAssessments: AnalystAssessmentResult[],
    agentAssessments: AnalystAssessmentResult[],
    target: Target,
    entryPrice: number,
    predictionId?: string,
  ): Promise<{
    userPositions: PositionCreationResult[];
    aiPositions: PositionCreationResult[];
  }> {
    const userPositions: PositionCreationResult[] = [];
    const aiPositions: PositionCreationResult[] = [];

    // Create user fork positions
    for (const assessment of userAssessments) {
      try {
        const result = await this.createPositionFromAssessment({
          assessment: { ...assessment, fork_type: 'user' },
          target,
          entryPrice,
          predictionId,
        });
        if (result) {
          userPositions.push(result);
        }
      } catch (error) {
        this.logger.error(
          `Failed to create user position for ${assessment.analyst.slug}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Create agent fork positions
    for (const assessment of agentAssessments) {
      try {
        const result = await this.createPositionFromAssessment({
          assessment: { ...assessment, fork_type: 'ai' },
          target,
          entryPrice,
          predictionId,
        });
        if (result) {
          aiPositions.push(result);
        }
      } catch (error) {
        this.logger.error(
          `Failed to create agent position for ${assessment.analyst.slug}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.logger.log(
      `Created ${userPositions.length} user positions and ${aiPositions.length} ai positions for ${target.symbol}`,
    );

    return { userPositions, aiPositions };
  }

  /**
   * Calculate position size based on portfolio balance and confidence
   * Uses tiered position sizing from database configuration:
   * - 60-70% confidence → 5% of portfolio
   * - 70-80% confidence → 10% of portfolio
   * - 80%+ confidence → 15% of portfolio
   *
   * Formula: quantity = (balance * position_percent) / entry_price
   */
  async calculatePositionSize(
    portfolioBalance: number,
    entryPrice: number,
    confidence: number,
    orgSlug: string = '*',
  ): Promise<number> {
    if (entryPrice <= 0) {
      return 0;
    }

    // Require minimum confidence to take a position
    if (confidence < this.MIN_CONFIDENCE_FOR_POSITION) {
      this.logger.debug(
        `Confidence ${(confidence * 100).toFixed(1)}% below minimum threshold ${(this.MIN_CONFIDENCE_FOR_POSITION * 100).toFixed(1)}%`,
      );
      return 0;
    }

    // Get the position percent for this confidence level from database
    let positionPercent: number;
    try {
      positionPercent =
        await this.portfolioRepository.getPositionPercentForConfidence(
          confidence,
          orgSlug,
        );
    } catch (error) {
      this.logger.warn(
        `Failed to get position sizing config, using default: ${error instanceof Error ? error.message : String(error)}`,
      );
      positionPercent = this.DEFAULT_POSITION_PERCENT;
    }

    // Calculate position value and quantity
    const positionValue = portfolioBalance * positionPercent;
    const quantity = Math.floor(positionValue / entryPrice);

    this.logger.debug(
      `Position sizing: confidence=${(confidence * 100).toFixed(1)}%, tier=${(positionPercent * 100).toFixed(0)}%, value=$${positionValue.toFixed(2)}, quantity=${quantity}`,
    );

    return Math.max(0, quantity);
  }

  /**
   * Map assessment direction to position direction
   * Returns null if direction doesn't translate to a trade
   */
  private mapAssessmentToPosition(
    assessmentDirection: string,
  ): PositionDirection | null {
    const normalizedDirection = assessmentDirection.toLowerCase();

    // Bullish directions -> long
    if (['bullish', 'up', 'buy', 'long'].includes(normalizedDirection)) {
      return 'long';
    }

    // Bearish directions -> short
    if (['bearish', 'down', 'sell', 'short'].includes(normalizedDirection)) {
      return 'short';
    }

    // Neutral doesn't create a position
    return null;
  }

  /**
   * Close a position at the given price
   * Returns the realized P&L
   */
  async closePosition(
    positionId: string,
    exitPrice: number,
  ): Promise<{ realizedPnl: number; isWin: boolean }> {
    // Get the position first to calculate P&L
    const openPositions =
      await this.portfolioRepository.getOpenAnalystPositions();
    const openPosition = openPositions.find((p) => p.id === positionId);

    if (!openPosition) {
      throw new Error(`Position ${positionId} not found or already closed`);
    }

    // Calculate P&L
    const realizedPnl = this.portfolioRepository.calculatePnL(
      openPosition.direction,
      openPosition.entry_price,
      exitPrice,
      openPosition.quantity,
    );

    const isWin = realizedPnl > 0;

    // Close the position with calculated P&L
    const position = await this.portfolioRepository.closeAnalystPosition(
      positionId,
      exitPrice,
      realizedPnl,
    );

    // Record the trade result in the portfolio
    await this.portfolioRepository.recordAnalystTradeResult(
      position.portfolio_id,
      realizedPnl,
      isWin,
    );

    this.logger.log(
      `Closed position ${positionId}: ${position.direction} ${position.symbol}, P&L: $${realizedPnl.toFixed(2)} (${isWin ? 'WIN' : 'LOSS'})`,
    );

    return { realizedPnl, isWin };
  }

  /**
   * Update unrealized P&L for all open positions of a target
   */
  async updateTargetPositionPrices(
    targetId: string,
    currentPrice: number,
  ): Promise<void> {
    const positions =
      await this.portfolioRepository.getOpenPositionsByTarget(targetId);

    for (const position of positions) {
      const unrealizedPnl = this.portfolioRepository.calculatePnL(
        position.direction,
        position.entry_price,
        currentPrice,
        position.quantity,
      );

      await this.portfolioRepository.updateAnalystPositionPrice(
        position.id,
        currentPrice,
        unrealizedPnl,
      );
    }

    this.logger.log(
      `Updated ${positions.length} positions for target ${targetId} to price $${currentPrice}`,
    );
  }
}
