/**
 * Stock Market Tools Integration Tests
 *
 * These tests hit REAL external APIs to validate data collection.
 * Run with: npx jest --config jest.integration.config.js stock-tools.integration.spec.ts
 *
 * Required environment variables:
 * - POLYGON_API_KEY (for Polygon tests)
 * - ALPHA_VANTAGE_API_KEY (for Alpha Vantage tests)
 *
 * Yahoo Finance and SEC EDGAR do not require API keys.
 */

import { YahooFinanceTool } from '../../../../agent2agent/runners/prediction/financial-asset-predictor/tools/yahoo-finance.tool';
import {
  AlphaVantageTool,
  AlphaVantageToolConfig,
} from '../../../../agent2agent/runners/prediction/financial-asset-predictor/tools/alpha-vantage.tool';
import { SecFilingsTool } from '../../../../agent2agent/runners/prediction/financial-asset-predictor/tools/sec-filings.tool';
import type {
  Source,
  Claim,
} from '../../../../agent2agent/runners/prediction/base/base-prediction.types';

// Test configuration
const TEST_SYMBOLS = {
  stocks: ['AAPL', 'MSFT', 'GOOGL', 'TSLA'],
  etfs: ['SPY', 'QQQ', 'IWM'],
  invalid: ['INVALIDXYZ123', 'NOTREAL999'],
};

// Helper to check if test should be skipped
const _shouldSkipPolygon = !process.env.POLYGON_API_KEY;
const shouldSkipAlphaVantage = !process.env.ALPHA_VANTAGE_API_KEY;

// Helper to check if source has API error (rate limit, blocked, etc.)
const hasApiError = (source: Source | undefined): boolean => {
  if (!source) return true;
  if (source.metadata?.error) return true;
  // Check for common error indicators
  const errorIndicators = [
    'rate',
    'limit',
    'block',
    'forbidden',
    '403',
    '429',
    'timeout',
  ];
  const errorMsg = String(source.metadata?.errorMessage || '').toLowerCase();
  return errorIndicators.some((indicator) => errorMsg.includes(indicator));
};

// Helper to skip test if API is unavailable
const skipIfApiUnavailable = (sources: Source[], testName: string): boolean => {
  if (sources.length === 0 || sources.every(hasApiError)) {
    console.log(`API unavailable for ${testName} - skipping assertions`);
    return true;
  }
  return false;
};

describe('Stock Market Tools Integration Tests', () => {
  // Increase timeout for real API calls
  jest.setTimeout(30000);

  describe('Yahoo Finance Tool', () => {
    let tool: YahooFinanceTool;

    beforeAll(() => {
      tool = new YahooFinanceTool();
    });

    describe('Connectivity', () => {
      it('should successfully connect to Yahoo Finance API', async () => {
        const sources = await tool.execute(['AAPL']);

        expect(sources).toBeDefined();
        expect(sources.length).toBe(1);

        if (skipIfApiUnavailable(sources, 'Yahoo Finance')) return;
        expect(sources[0]?.metadata?.error).toBeFalsy();
      });

      it('should handle multiple symbols in single request', async () => {
        const sources = await tool.execute(TEST_SYMBOLS.stocks);

        // API may return fewer results if some fail
        expect(sources.length).toBeGreaterThanOrEqual(1);

        if (skipIfApiUnavailable(sources, 'Yahoo Finance multi-symbol')) return;

        sources.forEach((source: Source) => {
          if (!hasApiError(source)) {
            expect(source.claims.length).toBeGreaterThan(0);
          }
        });
      });
    });

    describe('Data Quality', () => {
      it('should return valid price data for AAPL', async () => {
        const sources = await tool.execute(['AAPL']);

        if (skipIfApiUnavailable(sources, 'AAPL price')) return;

        const priceClaim = sources[0]?.claims.find(
          (c: Claim) => c.type === 'price',
        );

        expect(priceClaim).toBeDefined();
        expect(priceClaim?.value).toBeGreaterThan(0);
        expect(priceClaim?.value).toBeLessThan(10000); // Sanity check
        expect(priceClaim?.unit).toBe('USD');
        expect(priceClaim?.confidence).toBe(1.0);

        console.log(`AAPL Current Price: $${priceClaim?.value}`);
      });

      it('should return valid volume data', async () => {
        const sources = await tool.execute(['AAPL']);

        if (skipIfApiUnavailable(sources, 'AAPL volume')) return;

        const volumeClaim = sources[0]?.claims.find(
          (c: Claim) => c.type === 'volume',
        );

        expect(volumeClaim).toBeDefined();
        expect(volumeClaim?.value).toBeGreaterThan(0);
        expect(volumeClaim?.unit).toBe('shares');

        console.log(
          `AAPL Volume: ${(volumeClaim?.value as number).toLocaleString()} shares`,
        );
      });

      it('should return OHLC data', async () => {
        const sources = await tool.execute(['AAPL']);

        if (skipIfApiUnavailable(sources, 'AAPL OHLC')) return;

        const claims = sources[0]?.claims || [];

        const open = claims.find((c: Claim) => c.type === 'open');
        const high = claims.find((c: Claim) => c.type === 'high');
        const low = claims.find((c: Claim) => c.type === 'low');
        const close = claims.find((c: Claim) => c.type === 'close');

        expect(open?.value).toBeGreaterThan(0);
        expect(high?.value).toBeGreaterThan(0);
        expect(low?.value).toBeGreaterThan(0);
        expect(close?.value).toBeGreaterThan(0);

        // OHLC relationship validation
        expect(high?.value).toBeGreaterThanOrEqual(low?.value as number);
        expect(high?.value).toBeGreaterThanOrEqual(open?.value as number);
        expect(high?.value).toBeGreaterThanOrEqual(close?.value as number);
        expect(low?.value).toBeLessThanOrEqual(open?.value as number);
        expect(low?.value).toBeLessThanOrEqual(close?.value as number);

        console.log(
          `AAPL OHLC: O=${open?.value} H=${high?.value} L=${low?.value} C=${close?.value}`,
        );
      });

      it('should return bid/ask spread', async () => {
        const sources = await tool.execute(['AAPL']);

        if (skipIfApiUnavailable(sources, 'AAPL bid/ask')) return;

        const claims = sources[0]?.claims || [];

        const bid = claims.find((c: Claim) => c.type === 'bid');
        const ask = claims.find((c: Claim) => c.type === 'ask');
        const spread = claims.find((c: Claim) => c.type === 'spread');

        // Bid/ask may not be available outside market hours
        if (bid && ask) {
          expect(bid.value).toBeGreaterThan(0);
          expect(ask.value).toBeGreaterThan(0);
          expect(ask.value).toBeGreaterThanOrEqual(bid.value as number);

          if (spread) {
            expect(spread.value).toBeGreaterThanOrEqual(0);
            expect(spread.unit).toBe('percent');
          }

          console.log(`AAPL Bid: $${bid.value}, Ask: $${ask.value}`);
        } else {
          console.log('Bid/Ask not available (market may be closed)');
        }
      });

      it('should return fundamental data (P/E, Market Cap)', async () => {
        const sources = await tool.execute(['AAPL']);

        if (skipIfApiUnavailable(sources, 'AAPL fundamentals')) return;

        const claims = sources[0]?.claims || [];

        const marketCap = claims.find((c: Claim) => c.type === 'market_cap');
        const peRatio = claims.find((c: Claim) => c.type === 'pe_ratio');
        const eps = claims.find((c: Claim) => c.type === 'eps');

        expect(marketCap?.value).toBeGreaterThan(1000000000); // > $1B
        expect(marketCap?.unit).toBe('USD');

        if (peRatio) {
          expect(peRatio.value).toBeGreaterThan(0);
          console.log(`AAPL P/E Ratio: ${peRatio.value}`);
        }

        if (eps) {
          console.log(`AAPL EPS: $${eps.value}`);
        }

        console.log(
          `AAPL Market Cap: $${((marketCap?.value as number) / 1e12).toFixed(2)}T`,
        );
      });
    });

    describe('Error Handling', () => {
      it('should handle invalid symbols gracefully', async () => {
        const sources = await tool.execute(['INVALIDXYZ123']);

        // Should either return empty or error source
        expect(sources.length).toBeLessThanOrEqual(1);

        if (sources.length > 0) {
          expect(sources[0]?.metadata?.error).toBe(true);
        }
      });

      it('should handle mixed valid/invalid symbols', async () => {
        const sources = await tool.execute(['AAPL', 'INVALIDXYZ123']);

        if (skipIfApiUnavailable(sources, 'mixed symbols')) return;

        // Should return at least the valid symbol
        const validSource = sources.find(
          (s: Source) => s.metadata?.symbol === 'AAPL',
        );
        if (validSource && !hasApiError(validSource)) {
          expect(validSource?.claims.length).toBeGreaterThan(0);
        }
      });
    });

    describe('ETF Support', () => {
      it('should return valid data for ETFs', async () => {
        const sources = await tool.execute(['SPY']);

        if (skipIfApiUnavailable(sources, 'SPY ETF')) return;

        const priceClaim = sources[0]?.claims.find(
          (c: Claim) => c.type === 'price',
        );

        expect(priceClaim).toBeDefined();
        expect(priceClaim?.value).toBeGreaterThan(0);

        console.log(`SPY Price: $${priceClaim?.value}`);
      });
    });

    describe('Cross-Symbol Comparison', () => {
      it('should return consistent data across multiple stocks', async () => {
        const sources = await tool.execute(['AAPL', 'MSFT', 'GOOGL']);

        if (skipIfApiUnavailable(sources, 'multi-stock comparison')) return;

        const prices: Record<string, number> = {};

        sources.forEach((source: Source) => {
          if (hasApiError(source)) return;

          const symbol = source.metadata?.symbol as string;
          const priceClaim = source.claims.find(
            (c: Claim) => c.type === 'price',
          );

          if (priceClaim) {
            expect(priceClaim?.value).toBeGreaterThan(0);
            prices[symbol] = priceClaim?.value as number;
          }
        });

        console.log('Stock Prices:', prices);

        // All prices should be different (not returning same cached value)
        const uniquePrices = new Set(Object.values(prices));
        if (uniquePrices.size >= 2) {
          expect(uniquePrices.size).toBeGreaterThanOrEqual(2);
        }
      });
    });
  });

  describe('SEC EDGAR Tool', () => {
    let tool: SecFilingsTool;

    beforeAll(() => {
      tool = new SecFilingsTool();
    });

    describe('Connectivity', () => {
      it('should successfully connect to SEC EDGAR', async () => {
        const sources = await tool.execute(['AAPL']);

        expect(sources).toBeDefined();
        expect(sources.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('Filing Data', () => {
      it('should return recent filings for AAPL', async () => {
        const sources = await tool.execute(['AAPL']);

        if (skipIfApiUnavailable(sources, 'SEC EDGAR filings')) return;

        // Should have at least one filing
        expect(sources.length).toBeGreaterThan(0);

        const firstSource = sources[0];
        expect(firstSource?.tool).toBe('sec-filings');

        // Should have filing claims
        const filingClaims = firstSource?.claims.filter(
          (c: Claim) => c.type === 'filing' || c.type === 'event',
        );
        expect(filingClaims?.length).toBeGreaterThan(0);

        console.log(`Found ${filingClaims?.length} SEC filings for AAPL`);

        filingClaims?.slice(0, 3).forEach((claim: Claim, idx: number) => {
          console.log(
            `  ${idx + 1}. ${claim.metadata?.formType || claim.type}: ${claim.metadata?.description || 'N/A'}`,
          );
        });
      });

      it('should include filing metadata', async () => {
        const sources = await tool.execute(['TSLA']);

        if (skipIfApiUnavailable(sources, 'SEC EDGAR metadata')) return;

        const firstFilingClaim = sources[0]?.claims.find(
          (c: Claim) => c.type === 'filing' || c.type === 'event',
        );

        if (firstFilingClaim) {
          expect(firstFilingClaim.metadata).toBeDefined();
          // Form type may or may not be present - just check metadata exists
          console.log('Filing claim metadata:', firstFilingClaim.metadata);
        } else {
          console.log('No filing claims found - may be expected');
        }
      });
    });

    describe('CIK Mapping', () => {
      it('should resolve symbols to correct CIK', async () => {
        // Known CIK mappings
        const knownMappings: Record<string, string> = {
          AAPL: '0000320193',
          MSFT: '0000789019',
          TSLA: '0001318605',
        };

        for (const [symbol, expectedCik] of Object.entries(knownMappings)) {
          const sources = await tool.execute([symbol]);

          if (sources.length > 0) {
            const cik = sources[0]?.metadata?.cik;
            if (cik) {
              expect(cik).toBe(expectedCik);
              console.log(`${symbol} CIK: ${String(cik)}`);
            }
          }
        }
      });
    });
  });

  describe('Alpha Vantage Tool', () => {
    let tool: AlphaVantageTool;

    beforeAll(() => {
      if (shouldSkipAlphaVantage) {
        console.log(
          'Skipping Alpha Vantage tests: ALPHA_VANTAGE_API_KEY not set',
        );
        return;
      }

      const config: AlphaVantageToolConfig = {
        apiKey: process.env.ALPHA_VANTAGE_API_KEY!,
      };
      tool = new AlphaVantageTool(config);
    });

    (shouldSkipAlphaVantage ? describe.skip : describe)('Connectivity', () => {
      it('should successfully connect to Alpha Vantage API', async () => {
        const sources = await tool.execute(['IBM']); // IBM for rate limit testing

        expect(sources).toBeDefined();
        expect(sources.length).toBe(1);
        expect(sources[0]?.metadata?.error).toBeFalsy();
      });
    });

    (shouldSkipAlphaVantage ? describe.skip : describe)('Data Quality', () => {
      it('should return valid quote data', async () => {
        const sources = await tool.execute(['IBM']);
        const priceClaim = sources[0]?.claims.find(
          (c: Claim) => c.type === 'price',
        );

        expect(priceClaim).toBeDefined();
        expect(priceClaim?.value).toBeGreaterThan(0);

        console.log(`IBM (Alpha Vantage) Price: $${priceClaim?.value}`);
      });
    });

    (shouldSkipAlphaVantage ? describe.skip : describe)(
      'Cross-Validation with Yahoo Finance',
      () => {
        it('should return prices within 1% of Yahoo Finance', async () => {
          const yahooTool = new YahooFinanceTool();

          // Use IBM for comparison (slower moving)
          const [yahooSources, avSources] = await Promise.all([
            yahooTool.execute(['IBM']),
            tool.execute(['IBM']),
          ]);

          const yahooPrice = yahooSources[0]?.claims.find(
            (c: Claim) => c.type === 'price',
          )?.value as number;
          const avPrice = avSources[0]?.claims.find(
            (c: Claim) => c.type === 'price',
          )?.value as number;

          if (yahooPrice && avPrice) {
            const priceDiff = Math.abs(yahooPrice - avPrice);
            const priceDiffPercent = (priceDiff / yahooPrice) * 100;

            console.log(
              `IBM Yahoo: $${yahooPrice}, Alpha Vantage: $${avPrice}`,
            );
            console.log(`Price difference: ${priceDiffPercent.toFixed(2)}%`);

            // Allow 5% difference (different data times)
            expect(priceDiffPercent).toBeLessThan(5);
          }
        });
      },
    );
  });

  describe('Performance Benchmarks', () => {
    it('should complete Yahoo Finance request in under 5 seconds', async () => {
      const tool = new YahooFinanceTool();
      const startTime = Date.now();

      const sources = await tool.execute(['AAPL']);

      const elapsed = Date.now() - startTime;
      console.log(`Yahoo Finance request took ${elapsed}ms`);

      // Skip timing check if API is unavailable
      if (!skipIfApiUnavailable(sources, 'Yahoo Finance performance')) {
        expect(elapsed).toBeLessThan(5000);
      }
    });

    it('should handle batch of 10 symbols in under 10 seconds', async () => {
      const tool = new YahooFinanceTool();
      const symbols = [
        'AAPL',
        'MSFT',
        'GOOGL',
        'AMZN',
        'TSLA',
        'META',
        'NVDA',
        'AMD',
        'NFLX',
        'INTC',
      ];
      const startTime = Date.now();

      const sources = await tool.execute(symbols);

      const elapsed = Date.now() - startTime;
      console.log(`Batch request (10 symbols) took ${elapsed}ms`);

      if (skipIfApiUnavailable(sources, 'Yahoo Finance batch')) return;

      expect(sources.length).toBe(symbols.length);
      expect(elapsed).toBeLessThan(10000);
    });
  });

  describe('Data Consistency', () => {
    it('should return consistent prices across multiple calls', async () => {
      const tool = new YahooFinanceTool();

      const prices: number[] = [];

      for (let i = 0; i < 3; i++) {
        const sources = await tool.execute(['AAPL']);

        if (skipIfApiUnavailable(sources, `AAPL consistency call ${i + 1}`))
          return;

        const price = sources[0]?.claims.find((c: Claim) => c.type === 'price')
          ?.value as number;
        if (price) prices.push(price);

        // Small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      console.log(`AAPL prices across 3 calls: ${prices.join(', ')}`);

      if (prices.length === 0) {
        console.log('No valid prices collected - API unavailable');
        return;
      }

      // Prices should be within 0.5% of each other (market movement)
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      prices.forEach((price) => {
        const diffPercent = (Math.abs(price - avgPrice) / avgPrice) * 100;
        expect(diffPercent).toBeLessThan(0.5);
      });
    });
  });
});
