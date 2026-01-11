/**
 * Financial Asset Predictor Specialists
 *
 * Barrel export for all specialist context providers.
 *
 * Specialists are categorized as:
 * - Shared: Used for all asset types (stocks, crypto, forex)
 * - Traditional: Used for stocks/ETFs only
 * - Crypto: Used for cryptocurrencies only
 *
 * @module specialists
 */

// Shared specialists (all asset types)
export { getTechnicalAnalystContext } from './technical-analyst';
export { getSentimentAnalystContext } from './sentiment-analyst';

// Traditional specialists (stocks/ETFs only)
export { getFundamentalAnalystContext } from './fundamental-analyst';
export { getNewsAnalystContext } from './news-analyst';

// Crypto specialists (crypto only)
export { getOnChainAnalystContext } from './onchain-analyst';
export { getDeFiAnalystContext } from './defi-analyst';
