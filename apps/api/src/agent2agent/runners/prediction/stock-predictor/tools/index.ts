/**
 * Stock Predictor Tools
 *
 * Barrel export for all stock-specific data collection tools.
 *
 * @module stock-predictor/tools
 */

// Base tool interface and class
export {
  PredictionToolContract,
  BasePredictionTool,
  ToolConfig,
} from './base-tool';

// Yahoo Finance tool (free, no API key required)
export { YahooFinanceTool, YahooFinanceToolConfig } from './yahoo-finance.tool';

// Alpha Vantage tool (requires API key)
export {
  AlphaVantageTool,
  AlphaVantageToolConfig,
  createAlphaVantageTool,
} from './alpha-vantage.tool';
