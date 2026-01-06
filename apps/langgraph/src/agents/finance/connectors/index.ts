/**
 * Finance Connectors Module
 *
 * Re-exports all connector interfaces, implementations, and factories.
 */

// Interfaces
export {
  MarketDataConnector,
  NewsConnector,
  ConnectorResponse,
  ConnectorFactory,
  MarketDataConnectorType,
  NewsConnectorType,
} from "./connector.interface";

// Market Data Connectors
export { YahooFinanceConnector } from "./yahoo-finance.connector";
export { AlphaVantageConnector } from "./alpha-vantage.connector";
export { MockMarketDataConnector, MockNewsConnector } from "./mock.connector";

// News Connectors
export { RSSNewsConnector } from "./rss-news.connector";

// Factory and Chains
export {
  DefaultConnectorFactory,
  MarketDataConnectorChain,
  NewsConnectorChain,
  createMarketDataChain,
  createNewsChain,
} from "./connector.factory";
