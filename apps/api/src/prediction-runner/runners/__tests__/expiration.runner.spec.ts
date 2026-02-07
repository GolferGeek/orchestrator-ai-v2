import { Test, TestingModule } from '@nestjs/testing';
import { ExpirationRunner } from '../expiration.runner';
import { PredictorRepository } from '../../repositories/predictor.repository';
import { SignalRepository } from '../../repositories/signal.repository';
import { TargetRepository } from '../../repositories/target.repository';
import { UniverseRepository } from '../../repositories/universe.repository';
import { ObservabilityEventsService } from '@/observability/observability-events.service';
import { Signal } from '../../interfaces/signal.interface';

describe('ExpirationRunner', () => {
  let runner: ExpirationRunner;
  let predictorRepository: jest.Mocked<PredictorRepository>;
  let signalRepository: jest.Mocked<SignalRepository>;
  let targetRepository: jest.Mocked<TargetRepository>;
  let universeRepository: jest.Mocked<UniverseRepository>;

  const mockUniverse = {
    id: 'universe-1',
    name: 'Test Universe',
    domain: 'stocks',
    organization_slug: 'test-org',
    agent_slug: 'test-agent',
    strategy_id: null,
    config: {},
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockTarget = {
    id: 'target-1',
    universe_id: 'universe-1',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    target_type: 'stock',
    context: 'Apple technology company',
    config: {},
    is_active: true,
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockOldSignal: Signal = {
    id: 'signal-1',
    target_id: 'target-1',
    source_id: 'source-1',
    content: 'Old signal',
    direction: 'bullish',
    disposition: 'pending',
    urgency: null,
    detected_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 48 hours ago
    url: null,
    metadata: {},
    evaluation_result: null,
    processing_worker: null,
    processing_started_at: null,
    review_queue_id: null,
    expired_at: null,
    is_test: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpirationRunner,
        {
          provide: PredictorRepository,
          useValue: {
            expireOldPredictors: jest.fn(),
          },
        },
        {
          provide: SignalRepository,
          useValue: {
            findPendingSignals: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: TargetRepository,
          useValue: {
            findActiveByUniverse: jest.fn(),
          },
        },
        {
          provide: UniverseRepository,
          useValue: {
            findAllActive: jest.fn(),
          },
        },
        {
          provide: ObservabilityEventsService,
          useValue: {
            push: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    runner = module.get<ExpirationRunner>(ExpirationRunner);
    predictorRepository = module.get(PredictorRepository);
    signalRepository = module.get(SignalRepository);
    targetRepository = module.get(TargetRepository);
    universeRepository = module.get(UniverseRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('runExpirationBatch', () => {
    it('should expire old predictors', async () => {
      universeRepository.findAllActive.mockResolvedValue([
        mockUniverse as never,
      ]);
      targetRepository.findActiveByUniverse.mockResolvedValue([
        mockTarget as never,
      ]);
      predictorRepository.expireOldPredictors.mockResolvedValue(3);
      signalRepository.findPendingSignals.mockResolvedValue([]);

      const result = await runner.runExpirationBatch();

      expect(result.predictorsExpired).toBe(3);
      expect(predictorRepository.expireOldPredictors).toHaveBeenCalledWith(
        'target-1',
      );
    });

    it('should expire old pending signals', async () => {
      universeRepository.findAllActive.mockResolvedValue([
        mockUniverse as never,
      ]);
      targetRepository.findActiveByUniverse.mockResolvedValue([
        mockTarget as never,
      ]);
      predictorRepository.expireOldPredictors.mockResolvedValue(1);
      signalRepository.findPendingSignals.mockResolvedValue([mockOldSignal]);
      signalRepository.update.mockResolvedValue(mockOldSignal);

      const result = await runner.runExpirationBatch();

      expect(result.predictorsExpired).toBe(1);
    });

    it('should not expire recent signals', async () => {
      const recentSignal: Signal = {
        ...mockOldSignal,
        detected_at: new Date().toISOString(), // Now
      };
      universeRepository.findAllActive.mockResolvedValue([
        mockUniverse as never,
      ]);
      targetRepository.findActiveByUniverse.mockResolvedValue([
        mockTarget as never,
      ]);
      predictorRepository.expireOldPredictors.mockResolvedValue(0);
      signalRepository.findPendingSignals.mockResolvedValue([recentSignal]);

      const result = await runner.runExpirationBatch();

      expect(result.predictorsExpired).toBe(0);
      expect(signalRepository.update).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      universeRepository.findAllActive.mockResolvedValue([
        mockUniverse as never,
      ]);
      targetRepository.findActiveByUniverse.mockResolvedValue([
        mockTarget as never,
      ]);
      predictorRepository.expireOldPredictors.mockRejectedValue(
        new Error('DB error'),
      );
      signalRepository.findPendingSignals.mockResolvedValue([]);

      const result = await runner.runExpirationBatch();

      expect(result.errors).toBeGreaterThan(0);
    });
  });

  describe('expireForTargetManually', () => {
    it('should expire predictors and signals for a specific target', async () => {
      predictorRepository.expireOldPredictors.mockResolvedValue(2);
      signalRepository.findPendingSignals.mockResolvedValue([mockOldSignal]);
      signalRepository.update.mockResolvedValue(mockOldSignal);

      const result = await runner.expireForTargetManually('target-1');

      expect(result.predictorsExpired).toBe(2);
    });

    it('should handle errors', async () => {
      predictorRepository.expireOldPredictors.mockRejectedValue(
        new Error('DB error'),
      );

      const result = await runner.expireForTargetManually('target-1');

      expect(result.error).toBe('DB error');
    });
  });
});
