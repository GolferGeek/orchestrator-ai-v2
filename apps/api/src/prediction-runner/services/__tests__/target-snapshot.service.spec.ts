import { Test, TestingModule } from '@nestjs/testing';
import { TargetSnapshotService } from '../target-snapshot.service';
import { TargetSnapshotRepository } from '../../repositories/target-snapshot.repository';
import { TargetRepository } from '../../repositories/target.repository';
import { UniverseRepository } from '../../repositories/universe.repository';
import {
  TargetSnapshot,
  DEFAULT_MOVE_DETECTION_CONFIG,
} from '../../interfaces/target-snapshot.interface';
import { Target } from '../../interfaces/target.interface';
import { Universe } from '../../interfaces/universe.interface';

describe('TargetSnapshotService', () => {
  let service: TargetSnapshotService;
  let snapshotRepository: jest.Mocked<TargetSnapshotRepository>;
  let targetRepository: jest.Mocked<TargetRepository>;
  let universeRepository: jest.Mocked<UniverseRepository>;

  const mockTarget: Target = {
    id: 'target-123',
    universe_id: 'universe-123',
    name: 'Apple Inc',
    target_type: 'stock',
    symbol: 'AAPL',
    context: 'Large cap tech company',
    is_active: true,
    is_archived: false,
    llm_config_override: null,
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  const mockUniverse: Universe = {
    id: 'universe-123',
    organization_slug: 'test-org',
    agent_slug: 'prediction-runner',
    name: 'Test Universe',
    description: null,
    domain: 'stocks',
    strategy_id: null,
    llm_config: null,
    thresholds: null,
    notification_config: {
      urgent_enabled: true,
      new_prediction_enabled: true,
      outcome_enabled: true,
      channels: ['push'],
    },
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  const mockSnapshot: TargetSnapshot = {
    id: 'snapshot-123',
    target_id: 'target-123',
    value: 150.25,
    value_type: 'price',
    captured_at: '2026-01-08T12:00:00Z',
    source: 'polygon',
    metadata: {},
    created_at: '2026-01-08T12:00:00Z',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TargetSnapshotService,
        {
          provide: TargetSnapshotRepository,
          useValue: {
            findById: jest.fn(),
            findLatest: jest.fn(),
            findAtTime: jest.fn(),
            findInRange: jest.fn(),
            findRecent: jest.fn(),
            create: jest.fn(),
            createBatch: jest.fn(),
            detectMoves: jest.fn(),
            getValueAtTime: jest.fn(),
            calculateChange: jest.fn(),
            cleanupOldSnapshots: jest.fn(),
          },
        },
        {
          provide: TargetRepository,
          useValue: {
            findById: jest.fn(),
            findByIdOrThrow: jest.fn(),
            findAll: jest.fn(),
          },
        },
        {
          provide: UniverseRepository,
          useValue: {
            findByIdOrThrow: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TargetSnapshotService>(TargetSnapshotService);
    snapshotRepository = module.get(TargetSnapshotRepository);
    targetRepository = module.get(TargetRepository);
    universeRepository = module.get(UniverseRepository);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('captureSnapshot', () => {
    it('should create a new snapshot', async () => {
      targetRepository.findByIdOrThrow.mockResolvedValue(mockTarget);
      snapshotRepository.create.mockResolvedValue(mockSnapshot);

      const result = await service.captureSnapshot(
        'target-123',
        150.25,
        'polygon',
        { high: 151.0 },
      );

      expect(result.id).toBe('snapshot-123');
      expect(snapshotRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          target_id: 'target-123',
          value: 150.25,
          value_type: 'price',
          source: 'polygon',
        }),
      );
    });
  });

  describe('getLatestValue', () => {
    it('should return latest value', async () => {
      snapshotRepository.findLatest.mockResolvedValue(mockSnapshot);

      const result = await service.getLatestValue('target-123');

      expect(result).toBe(150.25);
    });

    it('should return null when no snapshot exists', async () => {
      snapshotRepository.findLatest.mockResolvedValue(null);

      const result = await service.getLatestValue('target-123');

      expect(result).toBeNull();
    });
  });

  describe('calculateChange', () => {
    it('should calculate change between two times', async () => {
      snapshotRepository.calculateChange.mockResolvedValue({
        start_value: 100,
        end_value: 110,
        change_absolute: 10,
        change_percent: 10,
      });

      const result = await service.calculateChange(
        'target-123',
        '2026-01-01T00:00:00Z',
        '2026-01-08T00:00:00Z',
      );

      expect(result.change_percent).toBe(10);
      expect(result.change_absolute).toBe(10);
    });
  });

  describe('detectMoves', () => {
    it('should detect significant moves using domain config', async () => {
      targetRepository.findByIdOrThrow.mockResolvedValue(mockTarget);
      universeRepository.findByIdOrThrow.mockResolvedValue(mockUniverse);
      snapshotRepository.detectMoves.mockResolvedValue([
        {
          target_id: 'target-123',
          start_value: 100,
          end_value: 110,
          start_time: '2026-01-01T00:00:00Z',
          end_time: '2026-01-02T00:00:00Z',
          change_percent: 10,
          direction: 'up',
          duration_hours: 24,
        },
      ]);

      const result = await service.detectMoves('target-123');

      expect(result).toHaveLength(1);
      expect(result[0]!.direction).toBe('up');
      expect(snapshotRepository.detectMoves).toHaveBeenCalledWith(
        'target-123',
        expect.objectContaining(DEFAULT_MOVE_DETECTION_CONFIG.stocks),
      );
    });

    it('should allow custom config overrides', async () => {
      targetRepository.findByIdOrThrow.mockResolvedValue(mockTarget);
      universeRepository.findByIdOrThrow.mockResolvedValue(mockUniverse);
      snapshotRepository.detectMoves.mockResolvedValue([]);

      await service.detectMoves('target-123', {
        min_change_percent: 10,
      });

      expect(snapshotRepository.detectMoves).toHaveBeenCalledWith(
        'target-123',
        expect.objectContaining({
          min_change_percent: 10,
        }),
      );
    });
  });

  describe('detectMovesInUniverse', () => {
    it('should detect moves across all targets in universe', async () => {
      targetRepository.findAll.mockResolvedValue([
        mockTarget,
        { ...mockTarget, id: 'target-456', symbol: 'GOOGL' },
      ]);
      targetRepository.findByIdOrThrow.mockResolvedValue(mockTarget);
      universeRepository.findByIdOrThrow.mockResolvedValue(mockUniverse);
      snapshotRepository.detectMoves.mockResolvedValue([
        {
          target_id: 'target-123',
          start_value: 100,
          end_value: 110,
          start_time: '2026-01-01T00:00:00Z',
          end_time: '2026-01-02T00:00:00Z',
          change_percent: 10,
          direction: 'up',
          duration_hours: 24,
        },
      ]);

      const result = await service.detectMovesInUniverse('universe-123');

      expect(result.size).toBeGreaterThan(0);
    });
  });

  describe('getHistory', () => {
    it('should return recent snapshots', async () => {
      snapshotRepository.findRecent.mockResolvedValue([mockSnapshot]);

      const result = await service.getHistory('target-123', 24);

      expect(result).toHaveLength(1);
      expect(snapshotRepository.findRecent).toHaveBeenCalledWith(
        'target-123',
        24,
      );
    });
  });

  describe('cleanupOldSnapshots', () => {
    it('should cleanup old snapshots', async () => {
      snapshotRepository.cleanupOldSnapshots.mockResolvedValue(10);

      const result = await service.cleanupOldSnapshots('target-123', 90);

      expect(result).toBe(10);
      expect(snapshotRepository.cleanupOldSnapshots).toHaveBeenCalledWith(
        'target-123',
        90,
      );
    });
  });
});
