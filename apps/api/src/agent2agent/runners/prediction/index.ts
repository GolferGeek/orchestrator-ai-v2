/**
 * Prediction Runner Framework Exports
 *
 * Main entry point for the prediction runner system.
 *
 * DOMAIN PREDICTORS:
 * - stock-predictor: Stock market predictions (AAPL, TSLA, etc.)
 * - crypto-predictor: Cryptocurrency predictions (BTC, ETH, SOL, etc.)
 * - market-predictor: Prediction market predictions (Polymarket)
 */

// Base exports (types, interfaces, implementations)
export * from './base';

// Registry
export * from './runner.registry';

// Factory
export * from './runner-factory.service';

// Domain Predictors
export * from './stock-predictor';
export * from './crypto-predictor';
export * from './market-predictor';

// Ambient Agent Orchestrator
export * from './ambient-agent-orchestrator.service';

// Main Module
export { PredictionModule } from './prediction.module';
