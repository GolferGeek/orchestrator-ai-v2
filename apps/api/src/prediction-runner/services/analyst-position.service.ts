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
 */
@Injectable()
export class AnalystPositionService {
  private readonly logger = new Logger(AnalystPositionService.name);

  // Default position sizing parameters
  private readonly DEFAULT_RISK_PERCENT = 0.02; // 2% risk per trade
  private readonly DEFAULT_STOP_DISTANCE_PERCENT = 0.05; // 5% stop loss
  private readonly CONFIDENCE_BASELINE = 0.7; // Confidence normalization baseline

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
    if (portfolio.status === 'suspended' && forkType === 'agent') {
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

    // Calculate position size based on confidence
    const quantity = this.calculatePositionSize(
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
    agentPositions: PositionCreationResult[];
  }> {
    const userPositions: PositionCreationResult[] = [];
    const agentPositions: PositionCreationResult[] = [];

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
          assessment: { ...assessment, fork_type: 'agent' },
          target,
          entryPrice,
          predictionId,
        });
        if (result) {
          agentPositions.push(result);
        }
      } catch (error) {
        this.logger.error(
          `Failed to create agent position for ${assessment.analyst.slug}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.logger.log(
      `Created ${userPositions.length} user positions and ${agentPositions.length} agent positions for ${target.symbol}`,
    );

    return { userPositions, agentPositions };
  }

  /**
   * Calculate position size based on portfolio balance and confidence
   * Uses confidence-weighted sizing: higher confidence = larger position
   *
   * Formula: base_quantity * (confidence / 0.7)
   * Where base_quantity = (balance * risk%) / (entry_price * stop_distance%)
   */
  calculatePositionSize(
    portfolioBalance: number,
    entryPrice: number,
    confidence: number,
    riskPercent: number = this.DEFAULT_RISK_PERCENT,
    stopDistancePercent: number = this.DEFAULT_STOP_DISTANCE_PERCENT,
  ): number {
    if (stopDistancePercent <= 0 || entryPrice <= 0) {
      return 0;
    }

    // Calculate risk amount
    const riskAmount = portfolioBalance * riskPercent;

    // Calculate stop distance in dollars
    const stopDistance = entryPrice * stopDistancePercent;

    // Base quantity (how many shares/units we can buy given the risk)
    const baseQuantity = riskAmount / stopDistance;

    // Apply confidence multiplier (normalized to 70% baseline)
    const confidenceMultiplier = confidence / this.CONFIDENCE_BASELINE;

    // Final quantity
    const quantity = Math.floor(baseQuantity * confidenceMultiplier);

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
