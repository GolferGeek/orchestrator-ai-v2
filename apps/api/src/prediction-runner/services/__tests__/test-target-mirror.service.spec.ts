import { Test, TestingModule } from '@nestjs/testing';
import { TestTargetMirrorService } from '../test-target-mirror.service';
import {
  TestTargetMirrorRepository,
  TestTargetMirror,
} from '../../repositories/test-target-mirror.repository';
import { TargetRepository } from '../../repositories/target.repository';
import { Target } from '../../interfaces/target.interface';

describe('TestTargetMirrorService', () => {
  let service: TestTargetMirrorService;
  let testTargetMirrorRepository: jest.Mocked<TestTargetMirrorRepository>;
  let targetRepository: jest.Mocked<TargetRepository>;

  const mockProductionTarget: Target = {
    id: 'prod-target-123',
    universe_id: 'universe-123',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    target_type: 'stock',
    context: 'Tech company',
    metadata: {},
    llm_config_override: null,
    is_active: true,
    is_archived: false,
    current_price: 150.0,
    price_updated_at: '2024-01-01T10:00:00Z',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockTestTarget: Target = {
    id: 'test-target-123',
    universe_id: 'universe-123',
    symbol: 'T_AAPL',
    name: 'TEST: Apple Inc.',
    target_type: 'stock',
    context: 'Test mirror of AAPL. Tech company',
    metadata: {
      is_test_mirror: true,
      real_target_id: 'prod-target-123',
      real_symbol: 'AAPL',
    },
    llm_config_override: null,
    is_active: true,
    is_archived: false,
    current_price: null,
    price_updated_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockMirror: TestTargetMirror = {
    id: 'mirror-123',
    real_target_id: 'prod-target-123',
    test_target_id: 'test-target-123',
    created_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestTargetMirrorService,
        {
          provide: TestTargetMirrorRepository,
          useValue: {
            findByRealTarget: jest.fn(),
            findByTestTarget: jest.fn(),
            findAll: jest.fn().mockResolvedValue([mockMirror]),
            create: jest.fn().mockResolvedValue(mockMirror),
            delete: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TargetRepository,
          useValue: {
            findById: jest.fn(),
            findByIdOrThrow: jest.fn().mockResolvedValue(mockProductionTarget),
            findBySymbol: jest.fn(),
            create: jest.fn().mockResolvedValue(mockTestTarget),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<TestTargetMirrorService>(TestTargetMirrorService);
    testTargetMirrorRepository = module.get(TestTargetMirrorRepository);
    targetRepository = module.get(TargetRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureMirror', () => {
    it('should return existing mirror if already exists', async () => {
      (
        testTargetMirrorRepository.findByRealTarget as jest.Mock
      ).mockResolvedValue(mockMirror);
      (targetRepository.findById as jest.Mock).mockResolvedValue(
        mockTestTarget,
      );

      const result = await service.ensureMirror('prod-target-123', 'test-org');

      expect(testTargetMirrorRepository.findByRealTarget).toHaveBeenCalledWith(
        'prod-target-123',
      );
      expect(result).toEqual(mockTestTarget);
    });

    it('should create mirror if it does not exist', async () => {
      (
        testTargetMirrorRepository.findByRealTarget as jest.Mock
      ).mockResolvedValue(null);
      (targetRepository.findBySymbol as jest.Mock).mockResolvedValue(null);

      const result = await service.ensureMirror('prod-target-123', 'test-org');

      expect(targetRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'T_AAPL',
          name: 'TEST: Apple Inc.',
        }),
      );
      expect(testTargetMirrorRepository.create).toHaveBeenCalled();
      expect(result).toEqual(mockTestTarget);
    });

    it('should use existing test target if found by symbol', async () => {
      (
        testTargetMirrorRepository.findByRealTarget as jest.Mock
      ).mockResolvedValue(null);
      (targetRepository.findBySymbol as jest.Mock).mockResolvedValue(
        mockTestTarget,
      );

      const result = await service.ensureMirror('prod-target-123', 'test-org');

      expect(targetRepository.create).not.toHaveBeenCalled();
      expect(testTargetMirrorRepository.create).toHaveBeenCalled();
      expect(result).toEqual(mockTestTarget);
    });

    it('should throw error for test target ID (already a test target)', async () => {
      (targetRepository.findByIdOrThrow as jest.Mock).mockResolvedValue(
        mockTestTarget,
      );

      await expect(
        service.ensureMirror('test-target-123', 'test-org'),
      ).rejects.toThrow('is already a test target');
    });

    it('should throw error when test target not found for existing mirror', async () => {
      (
        testTargetMirrorRepository.findByRealTarget as jest.Mock
      ).mockResolvedValue(mockMirror);
      (targetRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        service.ensureMirror('prod-target-123', 'test-org'),
      ).rejects.toThrow('Test target test-target-123 not found');
    });
  });

  describe('getMirror', () => {
    it('should return test target if mirror exists', async () => {
      (
        testTargetMirrorRepository.findByRealTarget as jest.Mock
      ).mockResolvedValue(mockMirror);
      (targetRepository.findById as jest.Mock).mockResolvedValue(
        mockTestTarget,
      );

      const result = await service.getMirror('prod-target-123');

      expect(result).toEqual(mockTestTarget);
    });

    it('should return null if no mirror exists', async () => {
      (
        testTargetMirrorRepository.findByRealTarget as jest.Mock
      ).mockResolvedValue(null);

      const result = await service.getMirror('prod-target-123');

      expect(result).toBeNull();
    });

    it('should return null if test target not found', async () => {
      (
        testTargetMirrorRepository.findByRealTarget as jest.Mock
      ).mockResolvedValue(mockMirror);
      (targetRepository.findById as jest.Mock).mockResolvedValue(null);

      const result = await service.getMirror('prod-target-123');

      expect(result).toBeNull();
    });
  });

  describe('getTestSymbol', () => {
    it('should return test symbol if mirror exists', async () => {
      (
        testTargetMirrorRepository.findByRealTarget as jest.Mock
      ).mockResolvedValue(mockMirror);
      (targetRepository.findById as jest.Mock).mockResolvedValue(
        mockTestTarget,
      );

      const result = await service.getTestSymbol('prod-target-123');

      expect(result).toBe('T_AAPL');
    });

    it('should return null if no mirror exists', async () => {
      (
        testTargetMirrorRepository.findByRealTarget as jest.Mock
      ).mockResolvedValue(null);

      const result = await service.getTestSymbol('prod-target-123');

      expect(result).toBeNull();
    });
  });

  describe('getProductionTarget', () => {
    it('should return production target from test target ID', async () => {
      (
        testTargetMirrorRepository.findByTestTarget as jest.Mock
      ).mockResolvedValue(mockMirror);
      (targetRepository.findById as jest.Mock).mockResolvedValue(
        mockProductionTarget,
      );

      const result = await service.getProductionTarget('test-target-123');

      expect(result).toEqual(mockProductionTarget);
    });

    it('should return null if no mirror exists', async () => {
      (
        testTargetMirrorRepository.findByTestTarget as jest.Mock
      ).mockResolvedValue(null);

      const result = await service.getProductionTarget('test-target-123');

      expect(result).toBeNull();
    });
  });

  describe('getProductionTargetBySymbol', () => {
    it('should return production target from test symbol', async () => {
      (targetRepository.findBySymbol as jest.Mock).mockResolvedValue(
        mockTestTarget,
      );
      (
        testTargetMirrorRepository.findByTestTarget as jest.Mock
      ).mockResolvedValue(mockMirror);
      (targetRepository.findById as jest.Mock).mockResolvedValue(
        mockProductionTarget,
      );

      const result = await service.getProductionTargetBySymbol(
        'universe-123',
        'T_AAPL',
      );

      expect(targetRepository.findBySymbol).toHaveBeenCalledWith(
        'universe-123',
        'T_AAPL',
      );
      expect(result).toEqual(mockProductionTarget);
    });

    it('should return null if test target not found', async () => {
      (targetRepository.findBySymbol as jest.Mock).mockResolvedValue(null);

      const result = await service.getProductionTargetBySymbol(
        'universe-123',
        'T_AAPL',
      );

      expect(result).toBeNull();
    });

    it('should throw error for invalid test symbol', async () => {
      await expect(
        service.getProductionTargetBySymbol('universe-123', 'AAPL'),
      ).rejects.toThrow('Invalid test symbol: AAPL (must start with T_)');
    });
  });

  describe('listMirrors', () => {
    it('should return list of mirrors with targets', async () => {
      (testTargetMirrorRepository.findAll as jest.Mock).mockResolvedValue([
        mockMirror,
      ]);
      (targetRepository.findById as jest.Mock)
        .mockResolvedValueOnce(mockProductionTarget)
        .mockResolvedValueOnce(mockTestTarget);

      const result = await service.listMirrors();

      expect(result.length).toBe(1);
      expect(result[0]?.mirror).toEqual(mockMirror);
      expect(result[0]?.productionTarget).toEqual(mockProductionTarget);
      expect(result[0]?.testTarget).toEqual(mockTestTarget);
    });

    it('should filter out mirrors with missing production targets', async () => {
      (testTargetMirrorRepository.findAll as jest.Mock).mockResolvedValue([
        mockMirror,
      ]);
      (targetRepository.findById as jest.Mock).mockResolvedValue(null);

      const result = await service.listMirrors();

      expect(result.length).toBe(0);
    });

    it('should return empty array when no mirrors exist', async () => {
      (testTargetMirrorRepository.findAll as jest.Mock).mockResolvedValue([]);

      const result = await service.listMirrors();

      expect(result).toEqual([]);
    });
  });

  describe('deleteMirror', () => {
    it('should delete mirror mapping', async () => {
      await service.deleteMirror('mirror-123');

      expect(testTargetMirrorRepository.delete).toHaveBeenCalledWith(
        'mirror-123',
      );
    });
  });

  describe('isTestMirror', () => {
    it('should return true for test targets', () => {
      const result = service.isTestMirror(mockTestTarget);

      expect(result).toBe(true);
    });

    it('should return false for production targets', () => {
      const result = service.isTestMirror(mockProductionTarget);

      expect(result).toBe(false);
    });
  });

  describe('getProductionSymbol', () => {
    it('should remove T_ prefix', () => {
      const result = service.getProductionSymbol('T_AAPL');

      expect(result).toBe('AAPL');
    });

    it('should throw error for invalid test symbol', () => {
      expect(() => service.getProductionSymbol('AAPL')).toThrow(
        'Invalid test symbol: AAPL (must start with T_)',
      );
    });

    it('should handle symbols with underscore', () => {
      const result = service.getProductionSymbol('T_BRK_A');

      expect(result).toBe('BRK_A');
    });
  });

  describe('edge cases', () => {
    it('should handle production target with null context', async () => {
      const targetWithNullContext: Target = {
        ...mockProductionTarget,
        context: null,
      };
      (targetRepository.findByIdOrThrow as jest.Mock).mockResolvedValue(
        targetWithNullContext,
      );
      (
        testTargetMirrorRepository.findByRealTarget as jest.Mock
      ).mockResolvedValue(null);
      (targetRepository.findBySymbol as jest.Mock).mockResolvedValue(null);

      await service.ensureMirror('prod-target-123', 'test-org');

      expect(targetRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          context: 'Test mirror of AAPL. ',
        }),
      );
    });

    it('should preserve production target active state', async () => {
      const inactiveTarget: Target = {
        ...mockProductionTarget,
        is_active: false,
      };
      (targetRepository.findByIdOrThrow as jest.Mock).mockResolvedValue(
        inactiveTarget,
      );
      (
        testTargetMirrorRepository.findByRealTarget as jest.Mock
      ).mockResolvedValue(null);
      (targetRepository.findBySymbol as jest.Mock).mockResolvedValue(null);

      await service.ensureMirror('prod-target-123', 'test-org');

      expect(targetRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: false,
        }),
      );
    });

    it('should include proper metadata in created test target', async () => {
      (
        testTargetMirrorRepository.findByRealTarget as jest.Mock
      ).mockResolvedValue(null);
      (targetRepository.findBySymbol as jest.Mock).mockResolvedValue(null);

      await service.ensureMirror('prod-target-123', 'test-org');

      expect(targetRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            is_test_mirror: true,
            real_target_id: 'prod-target-123',
            real_symbol: 'AAPL',
          },
        }),
      );
    });
  });
});
