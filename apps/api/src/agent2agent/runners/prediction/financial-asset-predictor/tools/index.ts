/**
 * Financial Asset Predictor Tools
 *
 * Barrel export for all financial asset data collection tools.
 * Includes both traditional stock and crypto tools.
 *
 * @module financial-asset-predictor/tools
 */

// Base tool interface and class
export {
  PredictionToolContract,
  BasePredictionTool,
  ToolConfig,
} from './base-tool';

// =============================================================================
// STOCK TOOLS
// =============================================================================

// Yahoo Finance tool (free, no API key required)
export { YahooFinanceTool, YahooFinanceToolConfig } from './yahoo-finance.tool';

// Alpha Vantage tool (requires API key)
export {
  AlphaVantageTool,
  AlphaVantageToolConfig,
  createAlphaVantageTool,
} from './alpha-vantage.tool';

// Bloomberg News tool (RSS feed)
export {
  BloombergNewsTool,
  BloombergNewsToolConfig,
} from './bloomberg-news.tool';

// Reuters RSS tool (RSS feed)
export { ReutersRssTool, ReutersRssToolConfig } from './reuters-rss.tool';

// SEC Filings tool (EDGAR API)
export { SecFilingsTool, SecFilingsToolConfig } from './sec-filings.tool';

// =============================================================================
// CRYPTO TOOLS
// =============================================================================

// Binance tool (free, no API key required)
export { BinanceTool, BinanceToolConfig } from './binance.tool';

// CoinGecko tool (free tier, API key optional)
export { CoinGeckoTool, CoinGeckoToolConfig } from './coingecko.tool';

// Whale Alert tool (API key required)
export { WhaleAlertTool, WhaleAlertToolConfig } from './whale-alerts.tool';

// DefiLlama tool (free, no API key required)
export { DefiLlamaTool, DefiLlamaToolConfig } from './defillama.tool';

// Etherscan tool (API key required)
export {
  EtherscanTool,
  createEtherscanTool,
  EtherscanToolConfig,
} from './etherscan.tool';
