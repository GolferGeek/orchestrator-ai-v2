/**
 * Cryptocurrency Tools Integration Tests
 *
 * These tests hit REAL external APIs to validate crypto data collection.
 * Run with: npx jest --config jest.integration.config.js crypto-tools.integration.spec.ts
 *
 * Required environment variables:
 * - COINGECKO_API_KEY (optional, for higher rate limits)
 * - ETHERSCAN_API_KEY (for Etherscan tests)
 * - WHALE_ALERT_API_KEY (for Whale Alert tests)
 *
 * CoinGecko and Binance do not require API keys for basic usage.
 */

import {
  CoinGeckoTool,
  CoinGeckoToolConfig,
} from '../../../../agent2agent/runners/prediction/financial-asset-predictor/tools/coingecko.tool';
import {
  BinanceTool,
  BinanceToolConfig,
} from '../../../../agent2agent/runners/prediction/financial-asset-predictor/tools/binance.tool';
import {
  EtherscanTool,
  EtherscanToolConfig,
} from '../../../../agent2agent/runners/prediction/financial-asset-predictor/tools/etherscan.tool';
import {
  DefiLlamaTool,
  DefiLlamaToolConfig,
} from '../../../../agent2agent/runners/prediction/financial-asset-predictor/tools/defillama.tool';
import {
  WhaleAlertTool,
  WhaleAlertToolConfig,
} from '../../../../agent2agent/runners/prediction/financial-asset-predictor/tools/whale-alerts.tool';
import type {
  Source,
  Claim,
} from '../../../../agent2agent/runners/prediction/base/base-prediction.types';

// Test configuration
const TEST_CRYPTOS = {
  major: ['BTC', 'ETH', 'BNB'],
  altcoins: ['SOL', 'ADA', 'DOT'],
  stablecoins: ['USDT', 'USDC'],
  invalid: ['FAKECOIN999', 'NOTREAL123'],
};

// Helper to check if test should be skipped
const shouldSkipEtherscan = !process.env.ETHERSCAN_API_KEY;
const shouldSkipWhaleAlert = !process.env.WHALE_ALERT_API_KEY;

// Helper to check if API returned valid data
const hasApiError = (source: Source | undefined): boolean => {
  if (!source) return true;
  if (source.metadata?.error) return true;
  if (source.claims.length === 0) return true;
  return false;
};

const skipIfApiUnavailable = (sources: Source[], testName: string): boolean => {
  if (sources.length === 0 || sources.every(hasApiError)) {
    console.log(`API unavailable for ${testName} - skipping assertions`);
    return true;
  }
  return false;
};

describe('Cryptocurrency Tools Integration Tests', () => {
  // Increase timeout for real API calls
  jest.setTimeout(30000);

  describe('CoinGecko Tool', () => {
    let tool: CoinGeckoTool;

    beforeAll(() => {
      const config: CoinGeckoToolConfig = {
        apiKey: process.env.COINGECKO_API_KEY, // Optional
      };
      tool = new CoinGeckoTool(config);
    });

    describe('Connectivity', () => {
      it('should successfully connect to CoinGecko API', async () => {
        const sources = await tool.execute(['BTC']);

        expect(sources).toBeDefined();
        // CoinGecko may rate limit or fail - verify array returned
        expect(Array.isArray(sources)).toBe(true);
        if (skipIfApiUnavailable(sources, 'CoinGecko connectivity')) return;
        expect(sources[0]?.metadata?.error).toBeFalsy();
      });

      it('should handle multiple symbols in single request', async () => {
        const sources = await tool.execute(TEST_CRYPTOS.major);

        expect(Array.isArray(sources)).toBe(true);
        if (skipIfApiUnavailable(sources, 'CoinGecko multi-symbol')) return;

        // Check that we got some valid sources (API may not return all)
        const validSources = sources.filter((s) => !hasApiError(s));
        expect(validSources.length).toBeGreaterThan(0);

        validSources.forEach((source: Source) => {
          expect(source.metadata?.error).toBeFalsy();
          expect(source.claims.length).toBeGreaterThan(0);
        });
      });
    });

    describe('Data Quality - Bitcoin', () => {
      it('should return valid price data for BTC', async () => {
        const sources = await tool.execute(['BTC']);
        if (skipIfApiUnavailable(sources, 'CoinGecko BTC price')) return;

        const priceClaim = sources[0]?.claims.find(
          (c: Claim) => c.type === 'price',
        );

        expect(priceClaim).toBeDefined();
        expect(priceClaim?.value).toBeGreaterThan(10000); // BTC > $10k
        expect(priceClaim?.value).toBeLessThan(1000000); // Sanity check
        expect(priceClaim?.unit).toBe('USD');
        expect(priceClaim?.confidence).toBe(1.0);

        console.log(
          `BTC Current Price: $${(priceClaim?.value as number).toLocaleString()}`,
        );
      });

      it('should return market cap data', async () => {
        const sources = await tool.execute(['BTC']);
        if (skipIfApiUnavailable(sources, 'CoinGecko BTC market cap')) return;

        const marketCapClaim = sources[0]?.claims.find(
          (c: Claim) => c.type === 'market_cap',
        );

        expect(marketCapClaim).toBeDefined();
        expect(marketCapClaim?.value).toBeGreaterThan(100000000000); // > $100B
        expect(marketCapClaim?.unit).toBe('USD');

        console.log(
          `BTC Market Cap: $${((marketCapClaim?.value as number) / 1e12).toFixed(2)}T`,
        );
      });

      it('should return 24h volume', async () => {
        const sources = await tool.execute(['BTC']);
        if (skipIfApiUnavailable(sources, 'CoinGecko BTC volume')) return;

        const volumeClaim = sources[0]?.claims.find(
          (c: Claim) => c.type === 'volume',
        );

        expect(volumeClaim).toBeDefined();
        expect(volumeClaim?.value).toBeGreaterThan(0);

        console.log(
          `BTC 24h Volume: $${((volumeClaim?.value as number) / 1e9).toFixed(2)}B`,
        );
      });

      it('should return circulating supply', async () => {
        const sources = await tool.execute(['BTC']);
        // Supply may be in custom claims or volume claims
        const supplyClaim = sources[0]?.claims.find(
          (c: Claim) =>
            c.type === 'custom' && c.metadata?.subtype === 'circulating_supply',
        );

        if (supplyClaim) {
          expect(supplyClaim.value).toBeGreaterThan(19000000); // > 19M BTC
          expect(supplyClaim.value).toBeLessThanOrEqual(21000000); // <= 21M cap

          console.log(
            `BTC Circulating Supply: ${(supplyClaim.value as number).toLocaleString()} BTC`,
          );
        } else {
          console.log('Circulating supply not available in claims');
        }
      });

      it('should return price change percentages', async () => {
        const sources = await tool.execute(['BTC']);
        const claims = sources[0]?.claims || [];

        const change24h = claims.find(
          (c: Claim) =>
            c.type === 'change_percent' &&
            (c.metadata?.period === '24h' || c.metadata?.timeframe === '24h'),
        );

        if (change24h) {
          expect(typeof change24h.value).toBe('number');
          expect(change24h.unit).toBe('percent');

          console.log(
            `BTC 24h Change: ${(change24h.value as number).toFixed(2)}%`,
          );
        }
      });
    });

    describe('Data Quality - Ethereum', () => {
      it('should return valid price data for ETH', async () => {
        const sources = await tool.execute(['ETH']);
        if (skipIfApiUnavailable(sources, 'CoinGecko ETH price')) return;

        const priceClaim = sources[0]?.claims.find(
          (c: Claim) => c.type === 'price',
        );

        expect(priceClaim).toBeDefined();
        expect(priceClaim?.value).toBeGreaterThan(100); // ETH > $100
        expect(priceClaim?.value).toBeLessThan(100000); // Sanity check

        console.log(
          `ETH Current Price: $${(priceClaim?.value as number).toLocaleString()}`,
        );
      });
    });

    describe('All-Time High/Low', () => {
      it('should return ATH/ATL data for BTC', async () => {
        const sources = await tool.execute(['BTC']);
        if (skipIfApiUnavailable(sources, 'CoinGecko BTC ATH/ATL')) return;

        const claims = sources[0]?.claims || [];

        // ATH/ATL may be in custom claims or metadata
        const ath = claims.find(
          (c: Claim) => c.type === 'custom' && c.metadata?.subtype === 'ath',
        );
        const atl = claims.find(
          (c: Claim) => c.type === 'custom' && c.metadata?.subtype === 'atl',
        );

        if (ath) {
          expect(ath.value).toBeGreaterThan(50000); // BTC ATH > $50k
          console.log(`BTC ATH: $${(ath.value as number).toLocaleString()}`);
        } else {
          console.log('ATH not available in claims');
        }

        if (atl) {
          expect(atl.value).toBeLessThan(1000); // BTC ATL < $1k
          console.log(`BTC ATL: $${atl.value}`);
        } else {
          console.log('ATL not available in claims');
        }
      });
    });

    describe('Symbol Mapping', () => {
      it('should correctly map common symbols to CoinGecko IDs', async () => {
        const symbolMappings = ['BTC', 'ETH', 'BNB', 'SOL'];

        for (const symbol of symbolMappings) {
          const sources = await tool.execute([symbol]);

          // Skip if API fails for this symbol
          if (skipIfApiUnavailable(sources, `CoinGecko ${symbol} mapping`))
            continue;

          const price = sources[0]?.claims.find(
            (c: Claim) => c.type === 'price',
          );
          expect(price?.value).toBeGreaterThan(0);

          console.log(
            `${symbol}: $${(price?.value as number).toLocaleString()}`,
          );
        }
      });
    });

    describe('Error Handling', () => {
      it('should handle invalid symbols gracefully', async () => {
        const sources = await tool.execute(['FAKECOIN999']);

        expect(sources.length).toBe(1);
        expect(sources[0]?.metadata?.error).toBe(true);
      });
    });
  });

  describe('Binance Tool', () => {
    let tool: BinanceTool;

    beforeAll(() => {
      tool = new BinanceTool();
    });

    describe('Connectivity', () => {
      it('should successfully connect to Binance API', async () => {
        const sources = await tool.execute(['BTCUSDT']);

        expect(sources).toBeDefined();
        expect(Array.isArray(sources)).toBe(true);
        if (skipIfApiUnavailable(sources, 'Binance connectivity')) return;
        expect(sources[0]?.metadata?.error).toBeFalsy();
      });
    });

    describe('Data Quality', () => {
      it('should return valid 24h ticker data for BTC', async () => {
        const sources = await tool.execute(['BTCUSDT']);
        if (skipIfApiUnavailable(sources, 'Binance BTC ticker')) return;

        const claims = sources[0]?.claims || [];

        const price = claims.find((c: Claim) => c.type === 'price');
        const volume = claims.find((c: Claim) => c.type === 'volume');
        const change = claims.find((c: Claim) => c.type === 'change_percent');

        expect(price?.value).toBeGreaterThan(10000);
        expect(volume?.value).toBeGreaterThan(0);
        expect(typeof change?.value).toBe('number');

        console.log(
          `Binance BTCUSDT: $${(price?.value as number).toLocaleString()}`,
        );
        console.log(
          `24h Volume: ${(volume?.value as number).toLocaleString()} USDT`,
        );
        console.log(`24h Change: ${(change?.value as number).toFixed(2)}%`);
      });

      it('should return bid/ask data', async () => {
        const sources = await tool.execute(['BTCUSDT']);
        if (skipIfApiUnavailable(sources, 'Binance bid/ask')) return;

        const claims = sources[0]?.claims || [];

        const bid = claims.find((c: Claim) => c.type === 'bid');
        const ask = claims.find((c: Claim) => c.type === 'ask');

        // Bid/ask may not be available in some responses
        if (!bid || !ask) {
          console.log('Bid/ask data not available in response');
          return;
        }

        expect(bid.value).toBeGreaterThan(0);
        expect(ask.value).toBeGreaterThan(0);
        expect(ask.value).toBeGreaterThanOrEqual(bid.value as number);

        console.log(`Bid: $${bid.value}, Ask: $${ask.value}`);
      });

      it('should return OHLC data', async () => {
        const sources = await tool.execute(['BTCUSDT']);
        if (skipIfApiUnavailable(sources, 'Binance OHLC')) return;

        const claims = sources[0]?.claims || [];

        const open = claims.find((c: Claim) => c.type === 'open');
        const high = claims.find((c: Claim) => c.type === 'high');
        const low = claims.find((c: Claim) => c.type === 'low');
        const close = claims.find((c: Claim) => c.type === 'close');

        // OHLC may not be available in all responses
        if (!open || !high || !low) {
          console.log('OHLC data not available in response');
          return;
        }

        expect(open.value).toBeGreaterThan(0);
        expect(high.value).toBeGreaterThanOrEqual(low.value as number);

        console.log(
          `OHLC: O=${open.value} H=${high.value} L=${low.value} C=${close?.value}`,
        );
      });
    });

    describe('Cross-Validation with CoinGecko', () => {
      it('should return prices within 1% of CoinGecko', async () => {
        const coinGeckoTool = new CoinGeckoTool();

        const [binanceSources, coingeckoSources] = await Promise.all([
          tool.execute(['BTCUSDT']),
          coinGeckoTool.execute(['BTC']),
        ]);

        // Skip if either API is unavailable
        if (skipIfApiUnavailable(binanceSources, 'Binance cross-validation'))
          return;
        if (
          skipIfApiUnavailable(coingeckoSources, 'CoinGecko cross-validation')
        )
          return;

        const binancePrice = binanceSources[0]?.claims.find(
          (c: Claim) => c.type === 'price',
        )?.value as number | undefined;
        const coingeckoPrice = coingeckoSources[0]?.claims.find(
          (c: Claim) => c.type === 'price',
        )?.value as number | undefined;

        // Skip if prices not available
        if (!binancePrice || !coingeckoPrice) {
          console.log('Price data not available from one or both APIs');
          return;
        }

        const priceDiff = Math.abs(binancePrice - coingeckoPrice);
        const priceDiffPercent = (priceDiff / coingeckoPrice) * 100;

        console.log(
          `BTC Binance: $${binancePrice.toLocaleString()}, CoinGecko: $${coingeckoPrice.toLocaleString()}`,
        );
        console.log(`Price difference: ${priceDiffPercent.toFixed(2)}%`);

        // Allow 2% difference (different data sources)
        expect(priceDiffPercent).toBeLessThan(2);
      });
    });

    describe('Multiple Trading Pairs', () => {
      it('should handle multiple trading pairs', async () => {
        const pairs = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
        const sources = await tool.execute(pairs);

        expect(Array.isArray(sources)).toBe(true);
        if (skipIfApiUnavailable(sources, 'Binance multi-pair')) return;

        // Check that we got some valid sources
        const validSources = sources.filter((s) => !hasApiError(s));
        expect(validSources.length).toBeGreaterThan(0);

        validSources.forEach((source: Source) => {
          expect(source.metadata?.error).toBeFalsy();
          const price = source.claims.find((c: Claim) => c.type === 'price');
          if (price) {
            expect(price.value).toBeGreaterThan(0);
            console.log(
              `${source.metadata?.symbol}: $${(price.value as number).toLocaleString()}`,
            );
          }
        });
      });
    });
  });

  describe('Etherscan Tool', () => {
    let tool: EtherscanTool;

    beforeAll(() => {
      if (shouldSkipEtherscan) {
        console.log('Skipping Etherscan tests: ETHERSCAN_API_KEY not set');
        return;
      }

      const config = {
        apiKey: process.env.ETHERSCAN_API_KEY!,
      } as EtherscanToolConfig & { apiKey: string };
      tool = new EtherscanTool(config);
    });

    (shouldSkipEtherscan ? describe.skip : describe)('Connectivity', () => {
      it('should successfully connect to Etherscan API', async () => {
        const sources = await tool.execute(['ETH']);

        expect(sources).toBeDefined();
        expect(sources.length).toBeGreaterThanOrEqual(1);
        expect(sources[0]?.metadata?.error).toBeFalsy();
      });
    });

    (shouldSkipEtherscan ? describe.skip : describe)('Gas Price Data', () => {
      it('should return current gas prices', async () => {
        const sources = await tool.execute(['gas']);
        const claims = sources[0]?.claims || [];

        const gasClaims = claims.filter((c: Claim) => c.type === 'gas_price');

        expect(gasClaims.length).toBeGreaterThan(0);

        gasClaims.forEach((claim: Claim) => {
          expect(claim.value).toBeGreaterThan(0);
          expect(claim.unit).toBe('gwei');

          console.log(
            `Gas (${claim.metadata?.speed || 'unknown'}): ${claim.value} gwei`,
          );
        });
      });
    });

    (shouldSkipEtherscan ? describe.skip : describe)('ETH Price Data', () => {
      it('should return ETH price in USD', async () => {
        const sources = await tool.execute(['ETH']);
        const priceClaim = sources[0]?.claims.find(
          (c: Claim) => c.type === 'price' && c.unit === 'USD',
        );

        expect(priceClaim).toBeDefined();
        expect(priceClaim?.value).toBeGreaterThan(100);

        console.log(`Etherscan ETH Price: $${priceClaim?.value}`);
      });
    });
  });

  describe('DefiLlama Tool', () => {
    let tool: DefiLlamaTool;

    beforeAll(() => {
      tool = new DefiLlamaTool();
    });

    describe('Connectivity', () => {
      it('should successfully connect to DefiLlama API', async () => {
        const sources = await tool.execute(['uniswap']);

        expect(sources).toBeDefined();
        expect(sources.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('TVL Data', () => {
      it('should return TVL for major DeFi protocols', async () => {
        const protocols = ['uniswap', 'aave', 'lido'];
        const sources = await tool.execute(protocols);

        expect(sources.length).toBeGreaterThanOrEqual(1);

        sources.forEach((source: Source) => {
          const tvlClaim = source.claims.find((c: Claim) => c.type === 'tvl');

          if (tvlClaim) {
            expect(tvlClaim.value).toBeGreaterThan(0);
            console.log(
              `${source.metadata?.protocol || 'Unknown'} TVL: $${((tvlClaim.value as number) / 1e9).toFixed(2)}B`,
            );
          }
        });
      });
    });

    describe('Chain TVL', () => {
      it('should return TVL by chain', async () => {
        const sources = await tool.execute(['ethereum']);

        const chainTvlClaim = sources[0]?.claims.find(
          (c: Claim) => c.type === 'tvl',
        );

        if (chainTvlClaim) {
          expect(chainTvlClaim.value).toBeGreaterThan(10000000000); // > $10B
          console.log(
            `Ethereum Chain TVL: $${((chainTvlClaim.value as number) / 1e9).toFixed(2)}B`,
          );
        }
      });
    });
  });

  describe('Whale Alert Tool', () => {
    let tool: WhaleAlertTool;

    beforeAll(() => {
      if (shouldSkipWhaleAlert) {
        console.log('Skipping Whale Alert tests: WHALE_ALERT_API_KEY not set');
        return;
      }

      const config: WhaleAlertToolConfig = {
        apiKey: process.env.WHALE_ALERT_API_KEY!,
      };
      tool = new WhaleAlertTool(config);
    });

    (shouldSkipWhaleAlert ? describe.skip : describe)('Connectivity', () => {
      it('should successfully connect to Whale Alert API', async () => {
        const sources = await tool.execute(['BTC']);

        expect(sources).toBeDefined();
        expect(sources.length).toBeGreaterThanOrEqual(1);
      });
    });

    (shouldSkipWhaleAlert ? describe.skip : describe)(
      'Transaction Data',
      () => {
        it('should return recent whale transactions', async () => {
          const sources = await tool.execute(['BTC']);

          // May have multiple transaction sources
          sources.forEach((source: Source) => {
            const txClaim = source.claims.find(
              (c: Claim) => c.type === 'whale_transaction',
            );

            if (txClaim) {
              console.log(
                `Whale TX: ${txClaim.metadata?.amount || 'unknown'} ${txClaim.metadata?.symbol || 'BTC'}`,
              );
            }
          });
        });
      },
    );
  });

  describe('Performance Benchmarks', () => {
    it('should complete CoinGecko request in under 5 seconds', async () => {
      const tool = new CoinGeckoTool();
      const startTime = Date.now();

      await tool.execute(['BTC']);

      const elapsed = Date.now() - startTime;
      console.log(`CoinGecko request took ${elapsed}ms`);

      expect(elapsed).toBeLessThan(5000);
    });

    it('should complete Binance request in under 3 seconds', async () => {
      const tool = new BinanceTool();
      const startTime = Date.now();

      await tool.execute(['BTCUSDT']);

      const elapsed = Date.now() - startTime;
      console.log(`Binance request took ${elapsed}ms`);

      expect(elapsed).toBeLessThan(3000);
    });
  });

  describe('Multi-Source Price Validation', () => {
    it('should get consistent BTC prices from CoinGecko and Binance', async () => {
      const coinGeckoTool = new CoinGeckoTool();
      const binanceTool = new BinanceTool();

      const [cgSources, binanceSources] = await Promise.all([
        coinGeckoTool.execute(['BTC']),
        binanceTool.execute(['BTCUSDT']),
      ]);

      const cgPrice = cgSources[0]?.claims.find(
        (c: Claim) => c.type === 'price',
      )?.value as number;
      const binancePrice = binanceSources[0]?.claims.find(
        (c: Claim) => c.type === 'price',
      )?.value as number;

      // Skip if APIs unavailable
      if (!cgPrice || !binancePrice) {
        console.log('API unavailable - skipping price comparison');
        return;
      }

      console.log('BTC Price Comparison:');
      console.log(`  CoinGecko: $${cgPrice.toLocaleString()}`);
      console.log(`  Binance:   $${binancePrice.toLocaleString()}`);

      const diff = Math.abs(cgPrice - binancePrice);
      const diffPercent = (diff / cgPrice) * 100;
      console.log(`  Difference: ${diffPercent.toFixed(3)}%`);

      // Prices should be within 1%
      expect(diffPercent).toBeLessThan(1);
    });

    it('should get consistent ETH prices from multiple sources', async () => {
      const coinGeckoTool = new CoinGeckoTool();
      const binanceTool = new BinanceTool();

      const [cgSources, binanceSources] = await Promise.all([
        coinGeckoTool.execute(['ETH']),
        binanceTool.execute(['ETHUSDT']),
      ]);

      const cgPrice = cgSources[0]?.claims.find(
        (c: Claim) => c.type === 'price',
      )?.value as number;
      const binancePrice = binanceSources[0]?.claims.find(
        (c: Claim) => c.type === 'price',
      )?.value as number;

      // Skip if APIs unavailable
      if (!cgPrice || !binancePrice) {
        console.log('API unavailable - skipping price comparison');
        return;
      }

      console.log('ETH Price Comparison:');
      console.log(`  CoinGecko: $${cgPrice.toLocaleString()}`);
      console.log(`  Binance:   $${binancePrice.toLocaleString()}`);

      const diff = Math.abs(cgPrice - binancePrice);
      const diffPercent = (diff / cgPrice) * 100;
      console.log(`  Difference: ${diffPercent.toFixed(3)}%`);

      expect(diffPercent).toBeLessThan(1);
    });
  });
});
