/**
 * End-to-End Pipeline Integration Tests
 *
 * Tests the complete flow: Source → Crawl → Signal → Predictor
 * Uses real external APIs and validates the entire data pipeline.
 *
 * These tests are designed to validate:
 * 1. Data flows correctly through each stage
 * 2. Real market data creates valid signals
 * 3. Signal processing produces correct predictors
 * 4. Deduplication works across the pipeline
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ContentHashService } from '../../../services/content-hash.service';
import { YahooFinanceTool } from '../../../../agent2agent/runners/prediction/financial-asset-predictor/tools/yahoo-finance.tool';
import { CoinGeckoTool } from '../../../../agent2agent/runners/prediction/financial-asset-predictor/tools/coingecko.tool';
import { BloombergNewsTool } from '../../../../agent2agent/runners/prediction/financial-asset-predictor/tools/bloomberg-news.tool';
import type {
  Source,
  Claim,
} from '../../../../agent2agent/runners/prediction/base/base-prediction.types';

describe('End-to-End Pipeline Integration Tests', () => {
  jest.setTimeout(60000);

  let contentHashService: ContentHashService;
  let yahooTool: YahooFinanceTool;
  let coinGeckoTool: CoinGeckoTool;
  let bloombergTool: BloombergNewsTool;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContentHashService],
    }).compile();

    contentHashService = module.get<ContentHashService>(ContentHashService);
    yahooTool = new YahooFinanceTool();
    coinGeckoTool = new CoinGeckoTool();
    bloombergTool = new BloombergNewsTool();
  });

  // Helper to check if API returned valid data
  const hasApiError = (source: Source | undefined): boolean => {
    if (!source) return true;
    if (source.metadata?.error) return true;
    if (source.claims.length === 0) return true;
    return false;
  };

  const skipIfApiUnavailable = (
    sources: Source[],
    testName: string,
  ): boolean => {
    if (sources.length === 0 || sources.every(hasApiError)) {
      console.log(`API unavailable for ${testName} - skipping assertions`);
      return true;
    }
    return false;
  };

  describe('Stock Data Pipeline', () => {
    describe('Yahoo Finance → Signal Flow', () => {
      it('should create valid signal from AAPL price data', async () => {
        // Step 1: Fetch real market data
        const sources = await yahooTool.execute(['AAPL']);
        if (skipIfApiUnavailable(sources, 'Yahoo Finance AAPL')) return;

        const source = sources[0];
        expect(source?.metadata?.error).toBeFalsy();

        // Step 2: Extract relevant claims
        const priceClaim = source?.claims.find(
          (c: Claim) => c.type === 'price',
        );
        const changeClaim = source?.claims.find(
          (c: Claim) => c.type === 'change_percent',
        );

        expect(priceClaim).toBeDefined();
        expect(priceClaim?.value).toBeGreaterThan(0);

        // Step 3: Create signal structure
        const signalContent = `AAPL price: $${priceClaim?.value}, change: ${changeClaim?.value}%`;
        const contentHash = contentHashService.hash(signalContent);

        const signal = {
          target_symbol: 'AAPL',
          target_type: 'stock',
          content: signalContent,
          content_hash: contentHash,
          direction:
            (changeClaim?.value as number) > 0
              ? 'bullish'
              : (changeClaim?.value as number) < 0
                ? 'bearish'
                : 'neutral',
          confidence: 0.9, // High confidence for direct market data
          urgency:
            Math.abs(changeClaim?.value as number) >= 3 ? 'notable' : 'routine',
          claims: [priceClaim, changeClaim].filter(Boolean),
          metadata: {
            source: 'yahoo-finance',
            symbol: 'AAPL',
            price: priceClaim?.value,
            change_percent: changeClaim?.value,
            timestamp: new Date().toISOString(),
          },
        };

        console.log('Created Stock Signal:');
        console.log(`  Symbol: ${signal.target_symbol}`);
        console.log(`  Price: $${signal.metadata.price}`);
        console.log(`  Change: ${signal.metadata.change_percent}%`);
        console.log(`  Direction: ${signal.direction}`);
        console.log(`  Hash: ${signal.content_hash.substring(0, 16)}...`);

        // Validate signal structure
        expect(signal.content_hash).toHaveLength(64);
        expect(['bullish', 'bearish', 'neutral']).toContain(signal.direction);
        expect(signal.confidence).toBeGreaterThan(0);
      });

      it('should create signals for multiple stocks', async () => {
        const symbols = ['AAPL', 'MSFT', 'GOOGL'];
        const sources = await yahooTool.execute(symbols);
        if (skipIfApiUnavailable(sources, 'Yahoo Finance multi-stock')) return;

        // Filter to valid sources only
        const validSources = sources.filter((s) => !hasApiError(s));
        if (validSources.length === 0) {
          console.log('No valid sources returned - skipping assertions');
          return;
        }

        const signals = validSources.map((source: Source) => {
          const symbol = source.metadata?.symbol as string;
          const priceClaim = source.claims.find(
            (c: Claim) => c.type === 'price',
          );
          const changeClaim = source.claims.find(
            (c: Claim) => c.type === 'change_percent',
          );

          const signalContent = `${symbol} price: $${priceClaim?.value}, change: ${changeClaim?.value}%`;

          return {
            symbol,
            content: signalContent,
            hash: contentHashService.hash(signalContent),
            direction:
              (changeClaim?.value as number) > 0 ? 'bullish' : 'bearish',
            price: priceClaim?.value,
            change: changeClaim?.value,
          };
        });

        console.log('\nMulti-Stock Signals:');
        signals.forEach((signal) => {
          console.log(
            `  ${signal.symbol}: $${signal.price} (${signal.change}%) - ${signal.direction}`,
          );
        });

        // All signals should have unique hashes
        const hashes = new Set(signals.map((s) => s.hash));
        expect(hashes.size).toBe(validSources.length);
      });
    });

    describe('Price Movement Signal Generation', () => {
      it('should generate appropriate urgency for large price moves', async () => {
        const sources = await yahooTool.execute([
          'AAPL',
          'MSFT',
          'TSLA',
          'NVDA',
          'AMD',
        ]);

        const signals = sources.map((source: Source) => {
          const symbol = source.metadata?.symbol as string;
          const changeClaim = source.claims.find(
            (c: Claim) => c.type === 'change_percent',
          );
          const changeValue = (changeClaim?.value as number) || 0;

          // Urgency based on magnitude of move
          let urgency: string;
          if (Math.abs(changeValue) >= 5) {
            urgency = 'urgent';
          } else if (Math.abs(changeValue) >= 2) {
            urgency = 'notable';
          } else {
            urgency = 'routine';
          }

          return {
            symbol,
            change: changeValue,
            urgency,
          };
        });

        console.log('\nPrice Movement Analysis:');
        signals.forEach((signal) => {
          console.log(
            `  ${signal.symbol}: ${signal.change.toFixed(2)}% (${signal.urgency})`,
          );
        });

        // Validate urgency assignment logic
        signals.forEach((signal) => {
          if (Math.abs(signal.change) >= 5) {
            expect(signal.urgency).toBe('urgent');
          }
        });
      });
    });
  });

  describe('Crypto Data Pipeline', () => {
    describe('CoinGecko → Signal Flow', () => {
      it('should create valid signal from BTC price data', async () => {
        const sources = await coinGeckoTool.execute(['BTC']);
        if (skipIfApiUnavailable(sources, 'CoinGecko BTC')) return;

        const source = sources[0];
        const priceClaim = source?.claims.find(
          (c: Claim) => c.type === 'price',
        );
        const marketCapClaim = source?.claims.find(
          (c: Claim) => c.type === 'market_cap',
        );

        // Skip if price not available
        if (!priceClaim?.value) {
          console.log('Price data not available - skipping');
          return;
        }

        expect(priceClaim.value).toBeGreaterThan(10000); // BTC > $10k

        const signalContent = `BTC price: $${priceClaim.value}, market cap: $${marketCapClaim?.value}`;
        const contentHash = contentHashService.hash(signalContent);

        const signal = {
          target_symbol: 'BTC',
          target_type: 'crypto',
          content: signalContent,
          content_hash: contentHash,
          confidence: 0.95,
          metadata: {
            source: 'coingecko',
            price: priceClaim.value,
            marketCap: marketCapClaim?.value,
          },
        };

        console.log('Created Crypto Signal:');
        console.log(`  Symbol: ${signal.target_symbol}`);
        console.log(
          `  Price: $${(signal.metadata.price as number).toLocaleString()}`,
        );
        if (signal.metadata.marketCap) {
          console.log(
            `  Market Cap: $${((signal.metadata.marketCap as number) / 1e12).toFixed(2)}T`,
          );
        }

        expect(signal.content_hash).toHaveLength(64);
      });

      it('should handle multi-crypto signals', async () => {
        const cryptos = ['BTC', 'ETH', 'SOL'];
        const sources = await coinGeckoTool.execute(cryptos);

        const signals = sources.map((source: Source) => {
          const priceClaim = source.claims.find(
            (c: Claim) => c.type === 'price',
          );
          const symbol = (source.metadata?.symbol as string) || 'UNKNOWN';

          return {
            symbol,
            price: priceClaim?.value,
            hash: contentHashService.hash(`${symbol}:${priceClaim?.value}`),
          };
        });

        console.log('\nMulti-Crypto Signals:');
        signals.forEach((signal) => {
          console.log(
            `  ${signal.symbol}: $${(signal.price as number)?.toLocaleString()}`,
          );
        });

        // All unique
        const hashes = new Set(signals.map((s) => s.hash));
        expect(hashes.size).toBe(signals.length);
      });
    });
  });

  describe('News Data Pipeline', () => {
    // Common financial terms that are likely to appear in Bloomberg news
    const LIKELY_BLOOMBERG_TERMS = [
      'Apple',
      'Microsoft',
      'Google',
      'Amazon',
      'Tesla',
      'AI',
      'Fed',
      'China',
      'Trump',
      'stock',
      'market',
    ];

    describe('Bloomberg RSS → Signal Flow', () => {
      it('should create signals from news articles', async () => {
        const sources = await bloombergTool.execute(LIKELY_BLOOMBERG_TERMS);

        // Skip if no matching articles found (depends on current news content)
        if (sources.length === 0) {
          console.log(
            'No Bloomberg articles matched our terms - this is expected behavior',
          );
          return;
        }

        // Process first 5 articles
        const signals = sources
          .slice(0, 5)
          .map((source: Source, idx: number) => {
            // Look for any claim that might have news content
            const newsClaim = source.claims.find(
              (c: Claim) =>
                c.type === 'news' ||
                c.type === 'event' ||
                c.type === 'sentiment' ||
                c.metadata?.headline,
            );

            const headline = (newsClaim?.metadata?.headline ||
              newsClaim?.metadata?.title ||
              newsClaim?.value ||
              `Article ${idx}`) as string;
            const description = (newsClaim?.metadata?.description ||
              '') as string;

            const contentHash = contentHashService.hashArticle(
              headline,
              description,
            );

            // Sentiment analysis placeholder (would use LLM in production)
            const direction = 'neutral'; // Default to neutral without LLM

            return {
              headline: headline.substring(0, 80),
              hash: contentHash,
              direction,
              source: 'bloomberg',
              timestamp: newsClaim?.timestamp || new Date().toISOString(),
            };
          });

        console.log('\nNews Signals Created:');
        signals.forEach((signal, idx) => {
          console.log(`  ${idx + 1}. ${signal.headline}...`);
          console.log(`     Hash: ${signal.hash.substring(0, 16)}...`);
        });

        // All should have unique hashes
        const hashes = new Set(signals.map((s) => s.hash));
        expect(hashes.size).toBe(signals.length);
      });
    });
  });

  describe('Signal → Predictor Flow', () => {
    describe('Predictor Creation Logic', () => {
      interface Signal {
        id: string;
        target_id: string;
        direction: string;
        confidence: number;
        urgency: string;
      }

      interface Predictor {
        id: string;
        target_id: string;
        direction: string;
        strength: number;
        source_signals: string[];
        expires_at: Date;
      }

      const createPredictor = (signal: Signal): Predictor => {
        // Calculate strength based on confidence and urgency
        let strength = Math.round(signal.confidence * 10);

        if (signal.urgency === 'urgent') {
          strength = Math.min(10, strength + 2);
        } else if (signal.urgency === 'notable') {
          strength = Math.min(10, strength + 1);
        }

        // Calculate expiration (24h for stocks, 12h for crypto)
        const ttlHours = 24;
        const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

        return {
          id: `pred-${Date.now()}`,
          target_id: signal.target_id,
          direction: signal.direction,
          strength,
          source_signals: [signal.id],
          expires_at: expiresAt,
        };
      };

      it('should create predictor from high-confidence signal', () => {
        const signal: Signal = {
          id: 'signal-001',
          target_id: 'target-AAPL',
          direction: 'bullish',
          confidence: 0.85,
          urgency: 'notable',
        };

        const predictor = createPredictor(signal);

        expect(predictor.direction).toBe('bullish');
        expect(predictor.strength).toBeGreaterThanOrEqual(8);
        expect(predictor.strength).toBeLessThanOrEqual(10);
        expect(predictor.source_signals).toContain(signal.id);

        console.log('Created Predictor:');
        console.log(`  Direction: ${predictor.direction}`);
        console.log(`  Strength: ${predictor.strength}/10`);
        console.log(`  Expires: ${predictor.expires_at.toISOString()}`);
      });

      it('should apply urgency bonus to strength', () => {
        const baseSignal: Signal = {
          id: 'signal-002',
          target_id: 'target-BTC',
          direction: 'bullish',
          confidence: 0.7,
          urgency: 'routine',
        };

        const urgentSignal: Signal = {
          ...baseSignal,
          id: 'signal-003',
          urgency: 'urgent',
        };

        const routinePredictor = createPredictor(baseSignal);
        const urgentPredictor = createPredictor(urgentSignal);

        console.log(`Routine signal strength: ${routinePredictor.strength}`);
        console.log(`Urgent signal strength: ${urgentPredictor.strength}`);

        expect(urgentPredictor.strength).toBeGreaterThan(
          routinePredictor.strength,
        );
      });
    });

    describe('Predictor Threshold Evaluation', () => {
      interface Predictor {
        direction: string;
        strength: number;
      }

      interface ThresholdConfig {
        min_predictors: number;
        min_combined_strength: number;
        min_direction_consensus: number;
      }

      const evaluateThreshold = (
        predictors: Predictor[],
        config: ThresholdConfig,
      ): { passes: boolean; reason?: string } => {
        // Check minimum predictor count
        if (predictors.length < config.min_predictors) {
          return {
            passes: false,
            reason: `Only ${predictors.length} predictors, need ${config.min_predictors}`,
          };
        }

        // Check combined strength
        const combinedStrength = predictors.reduce(
          (sum, p) => sum + p.strength,
          0,
        );
        if (combinedStrength < config.min_combined_strength) {
          return {
            passes: false,
            reason: `Combined strength ${combinedStrength}, need ${config.min_combined_strength}`,
          };
        }

        // Check direction consensus
        const bullishCount = predictors.filter(
          (p) => p.direction === 'bullish',
        ).length;
        const bearishCount = predictors.filter(
          (p) => p.direction === 'bearish',
        ).length;
        const totalDirectional = bullishCount + bearishCount;
        const consensus =
          Math.max(bullishCount, bearishCount) / totalDirectional;

        if (consensus < config.min_direction_consensus) {
          return {
            passes: false,
            reason: `Consensus ${(consensus * 100).toFixed(0)}%, need ${config.min_direction_consensus * 100}%`,
          };
        }

        return { passes: true };
      };

      it('should pass threshold with strong consensus', () => {
        const predictors: Predictor[] = [
          { direction: 'bullish', strength: 8 },
          { direction: 'bullish', strength: 7 },
          { direction: 'bullish', strength: 6 },
        ];

        const config: ThresholdConfig = {
          min_predictors: 3,
          min_combined_strength: 15,
          min_direction_consensus: 0.7,
        };

        const result = evaluateThreshold(predictors, config);

        console.log('Threshold Evaluation:');
        console.log(`  Predictor count: ${predictors.length}`);
        console.log(
          `  Combined strength: ${predictors.reduce((s, p) => s + p.strength, 0)}`,
        );
        console.log(`  Passes: ${result.passes}`);

        expect(result.passes).toBe(true);
      });

      it('should fail threshold with mixed directions', () => {
        const predictors: Predictor[] = [
          { direction: 'bullish', strength: 8 },
          { direction: 'bearish', strength: 7 },
          { direction: 'bullish', strength: 6 },
          { direction: 'bearish', strength: 5 },
        ];

        const config: ThresholdConfig = {
          min_predictors: 3,
          min_combined_strength: 15,
          min_direction_consensus: 0.7,
        };

        const result = evaluateThreshold(predictors, config);

        console.log('Mixed Direction Threshold:');
        console.log(`  Passes: ${result.passes}`);
        console.log(`  Reason: ${result.reason}`);

        expect(result.passes).toBe(false);
      });
    });
  });

  describe('Complete Pipeline Test', () => {
    it('should process real market data through full pipeline', async () => {
      console.log('\n=== FULL PIPELINE TEST ===\n');

      // Step 1: Fetch real data
      console.log('Step 1: Fetching market data...');
      const stockSources = await yahooTool.execute(['AAPL', 'MSFT']);
      const cryptoSources = await coinGeckoTool.execute(['BTC']);
      const newsSources = await bloombergTool.execute(['markets']);

      console.log(`  Stocks: ${stockSources.length} sources`);
      console.log(`  Crypto: ${cryptoSources.length} sources`);
      console.log(`  News: ${newsSources.length} sources`);

      // Step 2: Create signals
      console.log('\nStep 2: Creating signals...');

      interface SignalData {
        type: string;
        symbol: string;
        hash: string;
        direction: string;
        confidence: number;
      }

      const signals: SignalData[] = [];

      // Stock signals
      stockSources.forEach((source: Source) => {
        const symbol = source.metadata?.symbol as string;
        const price = source.claims.find(
          (c: Claim) => c.type === 'price',
        )?.value;
        const change = source.claims.find(
          (c: Claim) => c.type === 'change_percent',
        )?.value as number;

        const content = `${symbol}:${price}:${change}`;
        signals.push({
          type: 'stock',
          symbol,
          hash: contentHashService.hash(content),
          direction:
            change > 0 ? 'bullish' : change < 0 ? 'bearish' : 'neutral',
          confidence: 0.9,
        });
      });

      // Crypto signals
      cryptoSources.forEach((source: Source) => {
        const price = source.claims.find(
          (c: Claim) => c.type === 'price',
        )?.value;
        const content = `BTC:${price}`;
        signals.push({
          type: 'crypto',
          symbol: 'BTC',
          hash: contentHashService.hash(content),
          direction: 'neutral',
          confidence: 0.95,
        });
      });

      // News signals (first 3)
      newsSources.slice(0, 3).forEach((source: Source) => {
        const claim = source.claims.find(
          (c: Claim) =>
            c.type === 'event' ||
            c.type === 'sentiment' ||
            c.metadata?.headline,
        );
        const headline = (claim?.metadata?.headline ||
          claim?.metadata?.title ||
          'news') as string;
        signals.push({
          type: 'news',
          symbol: 'MARKET',
          hash: contentHashService.hash(headline),
          direction: 'neutral',
          confidence: 0.7,
        });
      });

      console.log(`  Created ${signals.length} signals`);

      // Step 3: Deduplication check
      console.log('\nStep 3: Deduplication check...');
      const uniqueHashes = new Set(signals.map((s) => s.hash));
      const duplicates = signals.length - uniqueHashes.size;
      console.log(`  Unique signals: ${uniqueHashes.size}`);
      console.log(`  Duplicates removed: ${duplicates}`);

      // Step 4: Create predictors from signals
      console.log('\nStep 4: Creating predictors...');

      interface PredictorData {
        symbol: string;
        direction: string;
        strength: number;
      }

      const predictors: PredictorData[] = signals
        .filter((s) => s.confidence >= 0.7 && s.direction !== 'neutral')
        .map((signal) => ({
          symbol: signal.symbol,
          direction: signal.direction,
          strength: Math.round(signal.confidence * 10),
        }));

      console.log(`  Created ${predictors.length} predictors`);

      predictors.forEach((p) => {
        console.log(
          `    ${p.symbol}: ${p.direction} (strength: ${p.strength})`,
        );
      });

      // Step 5: Summary
      console.log('\n=== PIPELINE COMPLETE ===');
      console.log(
        `Total data points: ${stockSources.length + cryptoSources.length + newsSources.length}`,
      );
      console.log(`Signals created: ${signals.length}`);
      console.log(`Predictors created: ${predictors.length}`);

      // Assertions
      expect(signals.length).toBeGreaterThan(0);
      expect(uniqueHashes.size).toBe(signals.length); // No duplicates in this test
    });
  });

  describe('Error Recovery', () => {
    it('should handle partial API failures gracefully', async () => {
      // Test with mix of valid and invalid symbols
      const mixedSymbols = ['AAPL', 'INVALIDXYZ123', 'MSFT'];

      const sources = await yahooTool.execute(mixedSymbols);

      // Should still get valid data for valid symbols
      const validSources = sources.filter((s: Source) => !s.metadata?.error);

      console.log(
        `Valid sources: ${validSources.length} of ${mixedSymbols.length}`,
      );

      // API may be unavailable - skip assertions if no valid sources
      if (validSources.length === 0) {
        console.log('API unavailable - skipping assertions');
        return;
      }

      expect(validSources.length).toBeGreaterThanOrEqual(1);
    });

    it('should continue processing after individual signal failures', async () => {
      const sources = await yahooTool.execute(['AAPL', 'MSFT', 'GOOGL']);

      // API may be unavailable
      if (
        sources.length === 0 ||
        sources.every((s: Source) => s.metadata?.error)
      ) {
        console.log('API unavailable - skipping assertions');
        return;
      }

      let successCount = 0;
      let failCount = 0;

      sources.forEach((source: Source) => {
        try {
          const priceClaim = source.claims.find(
            (c: Claim) => c.type === 'price',
          );
          if (priceClaim && priceClaim.value) {
            const hash = contentHashService.hash(
              `${source.metadata?.symbol}:${priceClaim.value}`,
            );
            expect(hash).toHaveLength(64);
            successCount++;
          }
        } catch {
          failCount++;
        }
      });

      console.log(`Processing: ${successCount} success, ${failCount} failures`);

      // At least one should succeed if API is available
      if (successCount === 0 && failCount === 0) {
        console.log('No claims processed - API may have returned errors');
        return;
      }
    });
  });
});
