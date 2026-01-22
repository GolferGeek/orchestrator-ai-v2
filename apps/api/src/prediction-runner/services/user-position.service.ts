import { Injectable, Logger } from '@nestjs/common';
import { PortfolioRepository } from '../repositories/portfolio.repository';
import { PredictionRepository } from '../repositories/prediction.repository';
import { TargetRepository } from '../repositories/target.repository';
import { TargetSnapshotRepository } from '../repositories/target-snapshot.repository';
import {
  UserPortfolio,
  UserPosition,
  PositionDirection,
} from '../interfaces/portfolio.interface';
import type { Prediction } from '../interfaces/prediction.interface';

/**
 * Input for creating a user position from a prediction
 */
export interface CreateUserPositionInput {
  userId: string;
  orgSlug: string;
  predictionId: string;
  quantity: number; // User's chosen quantity (may differ from recommended)
  entryPrice?: number; // Optional override, defaults to current price
}

/**
 * Result of position creation
 */
export interface UserPositionResult {
  position: UserPosition;
  portfolio: UserPortfolio;
  prediction: Prediction;
}

/**
 * Position size recommendation
 */
export interface PositionSizeRecommendation {
  recommendedQuantity: number;
  reasoning: string;
  riskAmount: number;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  potentialProfit: number;
  potentialLoss: number;
  riskRewardRatio: number;
}

/**
 * Service for managing user positions based on predictions
 * Handles position sizing recommendations and creation
 */
@Injectable()
export class UserPositionService {
  private readonly logger = new Logger(UserPositionService.name);

  // Default position sizing parameters
  private readonly DEFAULT_RISK_PERCENT = 0.02; // 2% risk per trade
  private readonly DEFAULT_STOP_DISTANCE_PERCENT = 0.05; // 5% stop loss
  private readonly CONFIDENCE_BASELINE = 0.7; // Confidence normalization baseline

  // Magnitude-based target distances
  private readonly MAGNITUDE_TARGETS: Record<string, number> = {
    small: 0.02, // 2% target
    medium: 0.05, // 5% target
    large: 0.1, // 10% target
  };

  constructor(
    private readonly portfolioRepository: PortfolioRepository,
    private readonly predictionRepository: PredictionRepository,
    private readonly targetRepository: TargetRepository,
    private readonly targetSnapshotRepository: TargetSnapshotRepository,
  ) {}

  /**
   * Get or create user portfolio
   */
  async getOrCreatePortfolio(
    userId: string,
    orgSlug: string,
  ): Promise<UserPortfolio> {
    return this.portfolioRepository.getOrCreateUserPortfolio(userId, orgSlug);
  }

  /**
   * Calculate recommended position size for a prediction
   */
  async calculateRecommendedSize(
    predictionId: string,
    portfolioBalance: number,
    currentPrice: number,
  ): Promise<PositionSizeRecommendation> {
    const prediction = await this.predictionRepository.findById(predictionId);
    if (!prediction) {
      throw new Error(`Prediction not found: ${predictionId}`);
    }

    // Get target for magnitude info
    const target = await this.targetRepository.findById(prediction.target_id);
    if (!target) {
      throw new Error(`Target not found: ${prediction.target_id}`);
    }

    // Calculate risk amount
    const riskAmount = portfolioBalance * this.DEFAULT_RISK_PERCENT;

    // Calculate stop distance based on confidence (higher confidence = tighter stop)
    const stopDistancePercent =
      this.DEFAULT_STOP_DISTANCE_PERCENT * (1 - (prediction.confidence - 0.5));
    const stopDistance = currentPrice * stopDistancePercent;

    // Calculate stop price based on direction
    const stopPrice =
      prediction.direction === 'up'
        ? currentPrice - stopDistance
        : currentPrice + stopDistance;

    // Calculate target price based on magnitude
    const targetDistancePercent =
      this.MAGNITUDE_TARGETS[prediction.magnitude ?? 'medium'] ?? 0.05;
    const targetPrice =
      prediction.direction === 'up'
        ? currentPrice * (1 + targetDistancePercent)
        : currentPrice * (1 - targetDistancePercent);

    // Base quantity calculation
    const baseQuantity = riskAmount / stopDistance;

    // Apply confidence multiplier (normalized to 70% baseline)
    const confidenceMultiplier =
      prediction.confidence / this.CONFIDENCE_BASELINE;

    // Final quantity
    const recommendedQuantity = Math.floor(baseQuantity * confidenceMultiplier);

    // Calculate potential profit/loss
    const potentialLoss = stopDistance * recommendedQuantity;
    const potentialProfit =
      Math.abs(targetPrice - currentPrice) * recommendedQuantity;
    const riskRewardRatio = potentialProfit / potentialLoss;

    // Generate reasoning
    const reasoning = this.generateSizingReasoning(
      prediction,
      portfolioBalance,
      recommendedQuantity,
      riskAmount,
      riskRewardRatio,
    );

    return {
      recommendedQuantity,
      reasoning,
      riskAmount,
      entryPrice: currentPrice,
      stopPrice,
      targetPrice,
      potentialProfit,
      potentialLoss,
      riskRewardRatio,
    };
  }

  /**
   * Create a user position from a prediction
   */
  async createPositionFromPrediction(
    input: CreateUserPositionInput,
  ): Promise<UserPositionResult> {
    const { userId, orgSlug, predictionId, quantity, entryPrice } = input;

    // Get or create user portfolio
    const portfolio = await this.getOrCreatePortfolio(userId, orgSlug);

    // Get prediction
    const prediction = await this.predictionRepository.findById(predictionId);
    if (!prediction) {
      throw new Error(`Prediction not found: ${predictionId}`);
    }

    // Get target
    const target = await this.targetRepository.findById(prediction.target_id);
    if (!target) {
      throw new Error(`Target not found: ${prediction.target_id}`);
    }

    // Get current price if not provided
    let price = entryPrice;
    if (!price) {
      const snapshot = await this.targetSnapshotRepository.findLatest(
        prediction.target_id,
      );
      if (snapshot?.value) {
        price = snapshot.value;
      } else {
        throw new Error(
          `No entry price provided and no current price available for ${target.symbol}`,
        );
      }
    }

    // Determine position direction
    const direction: PositionDirection =
      prediction.direction === 'up' ? 'long' : 'short';

    // Create the position
    const position = await this.portfolioRepository.createUserPosition(
      portfolio.id,
      predictionId,
      prediction.target_id,
      target.symbol,
      direction,
      quantity,
      price,
    );

    this.logger.log(
      `Created user position: ${direction} ${quantity} ${target.symbol} @ $${price} for user ${userId}`,
    );

    return { position, portfolio, prediction };
  }

  /**
   * Get open positions for a user
   */
  async getOpenPositions(
    userId: string,
    orgSlug: string,
  ): Promise<UserPosition[]> {
    const portfolio = await this.portfolioRepository.getUserPortfolio(
      userId,
      orgSlug,
    );
    if (!portfolio) {
      return [];
    }
    return this.portfolioRepository.getOpenUserPositions(portfolio.id);
  }

  /**
   * Get portfolio summary for a user
   */
  async getPortfolioSummary(
    userId: string,
    orgSlug: string,
  ): Promise<{
    portfolio: UserPortfolio | null;
    openPositions: UserPosition[];
    totalUnrealizedPnl: number;
    totalRealizedPnl: number;
    winRate: number;
  }> {
    const portfolio = await this.portfolioRepository.getUserPortfolio(
      userId,
      orgSlug,
    );

    if (!portfolio) {
      return {
        portfolio: null,
        openPositions: [],
        totalUnrealizedPnl: 0,
        totalRealizedPnl: 0,
        winRate: 0,
      };
    }

    const openPositions = await this.portfolioRepository.getOpenUserPositions(
      portfolio.id,
    );

    // Calculate total unrealized P&L
    const totalUnrealizedPnl = openPositions.reduce(
      (sum, pos) => sum + pos.unrealized_pnl,
      0,
    );

    return {
      portfolio,
      openPositions,
      totalUnrealizedPnl,
      totalRealizedPnl: portfolio.total_realized_pnl,
      winRate: 0, // TODO: Calculate from closed positions
    };
  }

  /**
   * Generate human-readable reasoning for position sizing
   */
  private generateSizingReasoning(
    prediction: Prediction,
    portfolioBalance: number,
    recommendedQuantity: number,
    riskAmount: number,
    riskRewardRatio: number,
  ): string {
    const confidenceLabel =
      prediction.confidence >= 0.8
        ? 'high'
        : prediction.confidence >= 0.6
          ? 'moderate'
          : 'low';

    const magnitudeLabel = prediction.magnitude ?? 'medium';

    return (
      `Based on ${confidenceLabel} confidence (${(prediction.confidence * 100).toFixed(0)}%) ` +
      `and ${magnitudeLabel} expected move, risking $${riskAmount.toFixed(0)} ` +
      `(2% of $${portfolioBalance.toFixed(0)} portfolio). ` +
      `Position size of ${recommendedQuantity} units provides ${riskRewardRatio.toFixed(1)}:1 risk/reward ratio.`
    );
  }
}
