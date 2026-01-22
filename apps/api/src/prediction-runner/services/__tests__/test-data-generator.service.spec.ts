import { Test, TestingModule } from '@nestjs/testing';
import { TestDataGeneratorService } from '../test-data-generator.service';
import {
  MockSignalConfig,
  MockPredictionConfig,
  MockArticleConfig,
} from '../../interfaces/test-data.interface';

describe('TestDataGeneratorService', () => {
  let service: TestDataGeneratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TestDataGeneratorService],
    }).compile();

    service = module.get<TestDataGeneratorService>(TestDataGeneratorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateMockArticles', () => {
    it('should generate the specified number of articles', () => {
      const config: MockArticleConfig = {
        count: 5,
        topic: 'Apple',
        sentiment: 'mixed',
      };

      const articles = service.generateMockArticles(config);

      expect(articles).toHaveLength(5);
    });

    it('should generate articles with required fields', () => {
      const config: MockArticleConfig = {
        count: 1,
        topic: 'Tesla',
        sentiment: 'bullish',
      };

      const articles = service.generateMockArticles(config);

      expect(articles[0]).toHaveProperty('title');
      expect(articles[0]).toHaveProperty('content');
      expect(articles[0]).toHaveProperty('url');
      expect(articles[0]).toHaveProperty('published_at');
      expect(articles[0]).toHaveProperty('author');
      expect(articles[0]).toHaveProperty('source_name');
    });

    it('should include topic in headlines', () => {
      const config: MockArticleConfig = {
        count: 3,
        topic: 'Microsoft',
        sentiment: 'bullish',
      };

      const articles = service.generateMockArticles(config);

      articles.forEach((article) => {
        expect(article.title).toContain('Microsoft');
      });
    });

    it('should generate bullish headlines for bullish sentiment', () => {
      const config: MockArticleConfig = {
        count: 5,
        topic: 'Amazon',
        sentiment: 'bullish',
      };

      const articles = service.generateMockArticles(config);

      // All articles should have positive-sounding headlines
      // These terms come from the service's bullishHeadlines array
      const bullishTerms = [
        'Surges',
        'Record',
        'Beats',
        'Growth',
        'Upgrade',
        'Bullish',
        'High',
        'Strong',
        'Expands',
        'Partnership',
        'Holdings',
        'Guidance',
        'Demand',
        'Markets',
      ];
      articles.forEach((article) => {
        const hasBullishTerm = bullishTerms.some((term) =>
          article.title.includes(term),
        );
        expect(hasBullishTerm).toBe(true);
      });
    });

    it('should generate bearish headlines for bearish sentiment', () => {
      const config: MockArticleConfig = {
        count: 5,
        topic: 'Meta',
        sentiment: 'bearish',
      };

      const articles = service.generateMockArticles(config);

      // All articles should have negative-sounding headlines
      const bearishTerms = [
        'Drops',
        'Weak',
        'Miss',
        'Concerns',
        'Downgrade',
        'Challenges',
        'Caution',
        'Loses',
        'Issues',
        'Layoffs',
        'Fall',
        'Supply Chain',
        'Flee',
        'Warning',
        'Restructuring',
      ];
      articles.forEach((article) => {
        const hasBearishTerm = bearishTerms.some((term) =>
          article.title.includes(term),
        );
        expect(hasBearishTerm).toBe(true);
      });
    });

    it('should generate unique URLs', () => {
      const config: MockArticleConfig = {
        count: 10,
        topic: 'Google',
        sentiment: 'mixed',
      };

      const articles = service.generateMockArticles(config);
      const urls = articles.map((a) => a.url);
      const uniqueUrls = new Set(urls);

      expect(uniqueUrls.size).toBe(10);
    });
  });

  describe('generateMockSignals', () => {
    it('should generate the specified number of signals', () => {
      const config: MockSignalConfig = {
        count: 10,
        target_id: 'target-123',
        source_id: 'source-123',
      };

      const signals = service.generateMockSignals(config);

      expect(signals).toHaveLength(10);
    });

    it('should include all required signal fields', () => {
      const config: MockSignalConfig = {
        count: 1,
        target_id: 'target-123',
        source_id: 'source-123',
        topic: 'Bitcoin',
      };

      const signals = service.generateMockSignals(config);

      expect(signals[0]).toHaveProperty('target_id', 'target-123');
      expect(signals[0]).toHaveProperty('source_id', 'source-123');
      expect(signals[0]).toHaveProperty('content');
      expect(signals[0]).toHaveProperty('direction');
      expect(signals[0]).toHaveProperty('detected_at');
      expect(signals[0]).toHaveProperty('url');
      expect(signals[0]).toHaveProperty('metadata');
    });

    it('should respect distribution ratios', () => {
      const config: MockSignalConfig = {
        count: 100,
        target_id: 'target-123',
        source_id: 'source-123',
        distribution: {
          bullish: 0.6,
          bearish: 0.3,
          neutral: 0.1,
        },
      };

      const signals = service.generateMockSignals(config);

      const bullishCount = signals.filter(
        (s) => s.direction === 'bullish',
      ).length;
      const bearishCount = signals.filter(
        (s) => s.direction === 'bearish',
      ).length;
      const neutralCount = signals.filter(
        (s) => s.direction === 'neutral',
      ).length;

      // Allow some variance due to rounding
      expect(bullishCount).toBeGreaterThanOrEqual(55);
      expect(bullishCount).toBeLessThanOrEqual(65);
      expect(bearishCount).toBeGreaterThanOrEqual(25);
      expect(bearishCount).toBeLessThanOrEqual(35);
      expect(neutralCount).toBeGreaterThanOrEqual(5);
      expect(neutralCount).toBeLessThanOrEqual(15);
    });

    it('should use default distribution when not specified', () => {
      const config: MockSignalConfig = {
        count: 100,
        target_id: 'target-123',
        source_id: 'source-123',
      };

      const signals = service.generateMockSignals(config);

      // Default is 0.4/0.4/0.2
      const bullishCount = signals.filter(
        (s) => s.direction === 'bullish',
      ).length;
      const bearishCount = signals.filter(
        (s) => s.direction === 'bearish',
      ).length;
      const neutralCount = signals.filter(
        (s) => s.direction === 'neutral',
      ).length;

      expect(bullishCount).toBeGreaterThanOrEqual(35);
      expect(bearishCount).toBeGreaterThanOrEqual(35);
      expect(neutralCount).toBeGreaterThanOrEqual(15);
    });

    it('should include test metadata', () => {
      const config: MockSignalConfig = {
        count: 1,
        target_id: 'target-123',
        source_id: 'source-123',
        topic: 'Ethereum',
      };

      const signals = service.generateMockSignals(config);
      const firstSignal = signals[0]!;

      expect(firstSignal.metadata).toHaveProperty('test_data', true);
      expect(firstSignal.metadata).toHaveProperty('generated_at');
      expect(firstSignal.metadata).toHaveProperty('topic', 'Ethereum');
    });
  });

  describe('generateMockPredictionsWithOutcomes', () => {
    it('should generate the specified number of predictions', () => {
      const config: MockPredictionConfig = {
        count: 10,
        target_id: 'target-123',
        accuracy_rate: 0.7,
      };

      const results = service.generateMockPredictionsWithOutcomes(config);

      expect(results).toHaveLength(10);
    });

    it('should include all required fields', () => {
      const config: MockPredictionConfig = {
        count: 1,
        target_id: 'target-123',
        accuracy_rate: 1.0,
      };

      const results = service.generateMockPredictionsWithOutcomes(config);
      const firstResult = results[0]!;

      expect(firstResult).toHaveProperty('prediction');
      expect(firstResult).toHaveProperty('outcome');
      expect(firstResult).toHaveProperty('actual_direction');
      expect(firstResult.prediction).toHaveProperty('target_id', 'target-123');
      expect(firstResult.prediction).toHaveProperty('direction');
      expect(firstResult.prediction).toHaveProperty('confidence');
      expect(firstResult.prediction).toHaveProperty('magnitude');
      expect(firstResult.prediction).toHaveProperty('reasoning');
      expect(firstResult.prediction).toHaveProperty('timeframe_hours');
    });

    it('should respect accuracy rate - 100% correct', () => {
      const config: MockPredictionConfig = {
        count: 20,
        target_id: 'target-123',
        accuracy_rate: 1.0,
      };

      const results = service.generateMockPredictionsWithOutcomes(config);

      const correctCount = results.filter(
        (r) => r.outcome === 'correct',
      ).length;
      expect(correctCount).toBe(20);
    });

    it('should respect accuracy rate - 0% correct', () => {
      const config: MockPredictionConfig = {
        count: 20,
        target_id: 'target-123',
        accuracy_rate: 0.0,
      };

      const results = service.generateMockPredictionsWithOutcomes(config);

      const correctCount = results.filter(
        (r) => r.outcome === 'correct',
      ).length;
      expect(correctCount).toBe(0);
    });

    it('should respect accuracy rate - approximately 70%', () => {
      const config: MockPredictionConfig = {
        count: 100,
        target_id: 'target-123',
        accuracy_rate: 0.7,
      };

      const results = service.generateMockPredictionsWithOutcomes(config);

      const correctCount = results.filter(
        (r) => r.outcome === 'correct',
      ).length;
      // Allow some variance due to rounding
      expect(correctCount).toBeGreaterThanOrEqual(65);
      expect(correctCount).toBeLessThanOrEqual(75);
    });

    it('should match actual direction with predicted direction when correct', () => {
      const config: MockPredictionConfig = {
        count: 50,
        target_id: 'target-123',
        accuracy_rate: 1.0, // All correct
      };

      const results = service.generateMockPredictionsWithOutcomes(config);

      results.forEach((result) => {
        expect(result.actual_direction).toBe(result.prediction.direction);
      });
    });

    it('should NOT match actual direction with predicted direction when incorrect', () => {
      const config: MockPredictionConfig = {
        count: 50,
        target_id: 'target-123',
        accuracy_rate: 0.0, // All incorrect
      };

      const results = service.generateMockPredictionsWithOutcomes(config);

      results.forEach((result) => {
        expect(result.actual_direction).not.toBe(result.prediction.direction);
      });
    });

    it('should generate valid confidence values', () => {
      const config: MockPredictionConfig = {
        count: 20,
        target_id: 'target-123',
        accuracy_rate: 0.7,
      };

      const results = service.generateMockPredictionsWithOutcomes(config);

      results.forEach((result) => {
        expect(result.prediction.confidence).toBeGreaterThanOrEqual(0.6);
        expect(result.prediction.confidence).toBeLessThanOrEqual(0.95);
      });
    });

    it('should generate valid price targets', () => {
      const config: MockPredictionConfig = {
        count: 10,
        target_id: 'target-123',
        accuracy_rate: 0.7,
      };

      const results = service.generateMockPredictionsWithOutcomes(config);

      results.forEach((result) => {
        expect(result.prediction.entry_price).toBeGreaterThan(0);
        expect(result.prediction.target_price).toBeGreaterThan(0);
        expect(result.prediction.stop_loss).toBeGreaterThan(0);

        // Target should be above entry for 'up', below for 'down'
        if (result.actual_direction === 'up') {
          expect(result.prediction.target_price).toBeGreaterThan(
            result.prediction.entry_price!,
          );
        } else if (result.actual_direction === 'down') {
          expect(result.prediction.target_price).toBeLessThan(
            result.prediction.entry_price!,
          );
        }
      });
    });

    it('should respect distribution ratios', () => {
      const config: MockPredictionConfig = {
        count: 100,
        target_id: 'target-123',
        accuracy_rate: 0.7,
        distribution: {
          up: 0.5,
          down: 0.4,
          flat: 0.1,
        },
      };

      const results = service.generateMockPredictionsWithOutcomes(config);

      const upCount = results.filter(
        (r) => r.prediction.direction === 'up',
      ).length;
      const downCount = results.filter(
        (r) => r.prediction.direction === 'down',
      ).length;
      const flatCount = results.filter(
        (r) => r.prediction.direction === 'flat',
      ).length;

      expect(upCount).toBeGreaterThanOrEqual(45);
      expect(upCount).toBeLessThanOrEqual(55);
      expect(downCount).toBeGreaterThanOrEqual(35);
      expect(downCount).toBeLessThanOrEqual(45);
      expect(flatCount).toBeGreaterThanOrEqual(5);
      expect(flatCount).toBeLessThanOrEqual(15);
    });
  });
});
