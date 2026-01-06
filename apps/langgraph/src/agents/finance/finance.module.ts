import { Module } from "@nestjs/common";
import { FinanceController } from "./finance.controller";
import { FinanceService } from "./finance.service";
import { FinanceDbService } from "./finance-db.service";
import { EvaluationService } from "./evaluation.service";

/**
 * FinanceModule
 *
 * Provides the Finance Research agent for generating multi-timing
 * buy/sell/hold recommendations based on market data and agenda signals.
 *
 * Workflow:
 * 1. Ingest market data (OHLCV bars)
 * 2. Ingest news items
 * 3. Extract agenda/manipulation signals via LLM
 * 4. Build market + agenda features
 * 5. Generate multi-timing recommendations (pre-close, post-close, pre-open, intraday)
 * 6. Write recommendations to database
 *
 * Evaluation Loop:
 * 7. Run evaluation for pending recommendations (POST /finance/evaluate)
 * 8. Get realized prices and compute outcomes
 * 9. Generate postmortem explanations via LLM
 * 10. Store results for future learning
 *
 * Key features:
 * - Multi-timing recommendations (run all timing windows in one pass)
 * - Dual-schema inputs (market data + agenda signals)
 * - Learning loop with outcome evaluation and postmortem generation
 * - Versioned universes for A/B testing
 * - Connector chain for market data and news (Yahoo/Alpha Vantage/RSS with mock fallback)
 */
@Module({
  controllers: [FinanceController],
  providers: [FinanceService, FinanceDbService, EvaluationService],
  exports: [FinanceService, FinanceDbService, EvaluationService],
})
export class FinanceModule {}
