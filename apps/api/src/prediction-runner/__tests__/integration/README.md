# Prediction Runner Integration Tests

These tests hit **real external APIs** to validate data collection and processing.

## Running Integration Tests

```bash
# Run all integration tests (requires API keys)
npm run test:integration

# Run specific test file
npx jest --config jest.integration.config.js apps/api/src/prediction-runner/__tests__/integration/tools/

# Run with verbose output
npx jest --config jest.integration.config.js --verbose
```

## Required Environment Variables

### Stock Market Tools
- `POLYGON_API_KEY` - For Polygon stock data
- `ALPHA_VANTAGE_API_KEY` - For Alpha Vantage data (free tier: 25 calls/day)

### Crypto Tools
- `COINGECKO_API_KEY` - Optional, for higher rate limits
- `ETHERSCAN_API_KEY` - For Ethereum on-chain data
- `WHALE_ALERT_API_KEY` - For whale transaction alerts

### News Tools
- `NEWSAPI_API_KEY` - For NewsAPI.org (free tier: 100 calls/day)

### Web Scraping
- `FIRECRAWL_API_KEY` - For Firecrawl web scraping

## Test Categories

### 1. Tool Connectivity Tests (`tools/`)
Verify we can connect to and receive valid data from external APIs:
- Yahoo Finance (no API key required)
- CoinGecko (no API key required)
- Binance (no API key required)
- Bloomberg RSS (no API key required)
- SEC EDGAR (no API key required)

### 2. Data Quality Tests (`data-quality/`)
Validate the data we receive is correct:
- Prices are positive numbers
- Timestamps are recent (within market hours)
- Required fields are present
- Values are within expected ranges

### 3. Signal Processing Tests (`signal-processing/`)
Verify signal creation from crawled content:
- RSS feed parsing creates signals
- Deduplication works correctly
- Content hashing is consistent

### 4. Deduplication Tests (`deduplication/`)
Test all 4 layers of deduplication:
- Layer 1: Exact hash match
- Layer 2: Cross-source deduplication
- Layer 3: Fuzzy title matching
- Layer 4: Key phrase overlap

### 5. End-to-End Pipeline Tests (`e2e/`)
Test the full flow:
- Source crawl → Signal creation → Predictor creation
- Multi-source aggregation
- Real-time price updates

## Skipping Tests

Tests are automatically skipped if required API keys are missing.
Each test file checks for required environment variables at the top.

## Rate Limiting

These tests are designed to respect rate limits:
- Yahoo Finance: ~2000 req/hour (no limit enforced)
- CoinGecko: 10-50 req/min (free tier)
- Alpha Vantage: 5 req/min, 25 req/day (free tier)
- SEC EDGAR: 10 req/sec
- Etherscan: 5 req/sec (free tier)

## Adding New Tests

1. Create test file in appropriate subdirectory
2. Add skip condition for missing API keys
3. Include rate limit awareness (use `jest.setTimeout()`)
4. Validate both success and error cases
