import { Test, TestingModule } from '@nestjs/testing';
import { BatchSignalProcessorRunner } from '../batch-signal-processor.runner';
import { SignalRepository } from '../../repositories/signal.repository';
import { TargetRepository } from '../../repositories/target.repository';
import { UniverseRepository } from '../../repositories/universe.repository';
import { SignalDetectionService } from '../../services/signal-detection.service';
import { FastPathService } from '../../services/fast-path.service';
import { LlmTierResolverService } from '../../services/llm-tier-resolver.service';
import { ObservabilityEventsService } from '@/observability/observability-events.service';
import { Signal } from '../../interfaces/signal.interface';

describe('BatchSignalProcessorRunner', () => {
  let runner: BatchSignalProcessorRunner;
  let signalRepository: jest.Mocked<SignalRepository>;
  let _targetRepository: jest.Mocked<TargetRepository>;
  let _universeRepository: jest.Mocked<UniverseRepository>;
  let signalDetectionService: jest.Mocked<SignalDetectionService>;
  let fastPathService: jest.Mocked<FastPathService>;

  const mockSignal: Signal = {
    id: 'signal-1',
    target_id: 'target-1',
    source_id: 'source-1',
    content: 'Test signal content',
    direction: 'bullish',
    disposition: 'pending',
    urgency: null,
    detected_at: new Date().toISOString(),
    url: 'https://example.com/article',
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

  const _mockUniverse = {
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

  const _mockTarget = {
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BatchSignalProcessorRunner,
        {
          provide: SignalRepository,
          useValue: {
            findPendingSignals: jest.fn(),
            findPendingSignalsGroupedByUrl: jest.fn().mockResolvedValue([]),
            claimSignal: jest.fn(),
            updateDisposition: jest.fn().mockResolvedValue(undefined),
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
          provide: SignalDetectionService,
          useValue: {
            processSignal: jest.fn(),
          },
        },
        {
          provide: FastPathService,
          useValue: {
            processFastPath: jest.fn(),
          },
        },
        {
          provide: LlmTierResolverService,
          useValue: {
            resolveTier: jest.fn().mockResolvedValue({
              tier: 'bronze',
              provider: 'anthropic',
              model: 'claude-haiku-4',
            }),
            createTierContext: jest.fn().mockResolvedValue({
              context: {},
              resolved: {
                tier: 'bronze',
                provider: 'anthropic',
                model: 'claude-haiku-4',
              },
            }),
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

    runner = module.get<BatchSignalProcessorRunner>(BatchSignalProcessorRunner);
    signalRepository = module.get(SignalRepository);
    targetRepository = module.get(TargetRepository);
    universeRepository = module.get(UniverseRepository);
    signalDetectionService = module.get(SignalDetectionService);
    fastPathService = module.get(FastPathService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('runBatchProcessing', () => {
    const mockSignalGroup = {
      url: 'https://example.com/article',
      signals: [mockSignal],
    };

    it('should process signals and create predictors', async () => {
      signalRepository.findPendingSignalsGroupedByUrl.mockResolvedValue([
        mockSignalGroup,
      ]);
      signalRepository.claimSignal.mockResolvedValue(mockSignal);
      signalDetectionService.processSignal.mockResolvedValue({
        signal: mockSignal,
        shouldCreatePredictor: true,
        urgency: 'notable',
        confidence: 0.75,
        reasoning: 'Strong signal',
        analystSlug: 'ensemble',
        key_factors: [],
        risks: [],
      });

      const result = await runner.runBatchProcessing();

      expect(result.processed).toBe(1);
      expect(result.predictorsCreated).toBe(1);
      expect(result.rejected).toBe(0);
      expect(result.fastPathTriggered).toBe(0);
    });

    it('should trigger fast path for urgent signals', async () => {
      signalRepository.findPendingSignalsGroupedByUrl.mockResolvedValue([
        mockSignalGroup,
      ]);
      signalRepository.claimSignal.mockResolvedValue(mockSignal);
      signalDetectionService.processSignal.mockResolvedValue({
        signal: mockSignal,
        shouldCreatePredictor: true,
        urgency: 'urgent',
        confidence: 0.95,
        reasoning: 'Very strong signal',
        analystSlug: 'ensemble',
        key_factors: [],
        risks: [],
      });
      fastPathService.processFastPath.mockResolvedValue(null);

      const result = await runner.runBatchProcessing();

      expect(result.fastPathTriggered).toBe(1);
      expect(fastPathService.processFastPath).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should handle rejected signals', async () => {
      signalRepository.findPendingSignalsGroupedByUrl.mockResolvedValue([
        mockSignalGroup,
      ]);
      signalRepository.claimSignal.mockResolvedValue(mockSignal);
      signalDetectionService.processSignal.mockResolvedValue({
        signal: mockSignal,
        shouldCreatePredictor: false,
        urgency: 'routine',
        confidence: 0.3,
        reasoning: 'Weak signal',
        analystSlug: 'ensemble',
        key_factors: [],
        risks: [],
      });

      const result = await runner.runBatchProcessing();

      expect(result.processed).toBe(1);
      expect(result.predictorsCreated).toBe(0);
      expect(result.rejected).toBe(1);
    });

    it('should skip already claimed signals', async () => {
      signalRepository.findPendingSignalsGroupedByUrl.mockResolvedValue([
        mockSignalGroup,
      ]);
      signalRepository.claimSignal.mockResolvedValue(null); // Already claimed

      const result = await runner.runBatchProcessing();

      expect(result.processed).toBe(0);
      expect(signalDetectionService.processSignal).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      signalRepository.findPendingSignalsGroupedByUrl.mockResolvedValue([
        mockSignalGroup,
      ]);
      signalRepository.claimSignal.mockResolvedValue(mockSignal);
      signalDetectionService.processSignal.mockRejectedValue(
        new Error('Processing failed'),
      );

      const result = await runner.runBatchProcessing();

      expect(result.errors).toBe(1);
    });
  });

  describe('processTargetManually', () => {
    it('should process signals for a specific target', async () => {
      signalRepository.findPendingSignals.mockResolvedValue([mockSignal]);
      signalRepository.claimSignal.mockResolvedValue(mockSignal);
      signalDetectionService.processSignal.mockResolvedValue({
        signal: mockSignal,
        shouldCreatePredictor: true,
        urgency: 'notable',
        confidence: 0.75,
        reasoning: 'Strong signal',
        analystSlug: 'ensemble',
        key_factors: [],
        risks: [],
      });

      const result = await runner.processTargetManually('target-1');

      expect(result.processed).toBe(1);
      expect(result.predictorsCreated).toBe(1);
    });
  });
});
