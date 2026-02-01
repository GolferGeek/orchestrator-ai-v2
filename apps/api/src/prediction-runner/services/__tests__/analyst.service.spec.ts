import { Test, TestingModule } from '@nestjs/testing';
import { AnalystService } from '../analyst.service';
import { AnalystRepository } from '../../repositories/analyst.repository';
import { PortfolioRepository } from '../../repositories/portfolio.repository';
import { CreateAnalystDto } from '../../dto/analyst.dto';
import {
  ForkType,
  PortfolioStatus,
} from '../../interfaces/portfolio.interface';

describe('AnalystService', () => {
  let service: AnalystService;
  let mockAnalystRepository: Partial<AnalystRepository>;
  let mockPortfolioRepository: Partial<PortfolioRepository>;

  const mockAnalyst = {
    id: 'analyst-123',
    slug: 'technical-tina',
    name: 'Technical Tina',
    domain: 'stock',
    scope_level: 'runner',
    perspective: 'Technical analysis expert',
    tier_instructions: { gold: 'Detailed analysis' },
    default_weight: 1.0,
    is_enabled: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockUserPortfolio = {
    id: 'portfolio-user-001',
    analyst_id: 'analyst-123',
    fork_type: 'user' as ForkType,
    initial_balance: 1000000,
    current_balance: 1000000,
    total_realized_pnl: 0,
    total_unrealized_pnl: 0,
    win_count: 0,
    loss_count: 0,
    status: 'active' as PortfolioStatus,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockAgentPortfolio = {
    id: 'portfolio-agent-001',
    analyst_id: 'analyst-123',
    fork_type: 'ai' as ForkType,
    initial_balance: 1000000,
    current_balance: 1000000,
    total_realized_pnl: 0,
    total_unrealized_pnl: 0,
    win_count: 0,
    loss_count: 0,
    status: 'active' as PortfolioStatus,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    mockAnalystRepository = {
      create: jest.fn().mockResolvedValue(mockAnalyst),
      findById: jest.fn().mockResolvedValue(mockAnalyst),
      findByIdOrThrow: jest.fn().mockResolvedValue(mockAnalyst),
      findBySlug: jest.fn().mockResolvedValue([mockAnalyst]),
      update: jest.fn().mockResolvedValue(mockAnalyst),
      delete: jest.fn().mockResolvedValue(undefined),
      findByDomain: jest.fn().mockResolvedValue([mockAnalyst]),
      findRunnerLevel: jest.fn().mockResolvedValue([mockAnalyst]),
      getActiveAnalysts: jest.fn().mockResolvedValue([]),
    };

    mockPortfolioRepository = {
      createAnalystPortfolio: jest
        .fn()
        .mockImplementation((analystId, forkType) => {
          return Promise.resolve(
            forkType === 'user' ? mockUserPortfolio : mockAgentPortfolio,
          );
        }),
      createAnalystPortfolios: jest.fn().mockResolvedValue({
        userPortfolio: mockUserPortfolio,
        aiPortfolio: mockAgentPortfolio,
      }),
      getAnalystPortfolio: jest
        .fn()
        .mockImplementation((analystId, forkType) => {
          return Promise.resolve(
            forkType === 'user' ? mockUserPortfolio : mockAgentPortfolio,
          );
        }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalystService,
        {
          provide: AnalystRepository,
          useValue: mockAnalystRepository,
        },
        {
          provide: PortfolioRepository,
          useValue: mockPortfolioRepository,
        },
      ],
    }).compile();

    service = module.get<AnalystService>(AnalystService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =============================================================================
  // CREATE WITH PORTFOLIOS
  // =============================================================================

  describe('create', () => {
    it('should create an analyst with dual portfolios', async () => {
      const dto: CreateAnalystDto = {
        slug: 'technical-tina',
        name: 'Technical Tina',
        domain: 'stock',
        scope_level: 'runner',
        perspective: 'Technical analysis expert',
        tier_instructions: { gold: 'Detailed analysis' },
        default_weight: 1.0,
        is_enabled: true,
      };

      const result = await service.create(dto);

      expect(result).toEqual(mockAnalyst);
      expect(mockAnalystRepository.create).toHaveBeenCalledWith(dto);
      expect(
        mockPortfolioRepository.createAnalystPortfolios,
      ).toHaveBeenCalledWith(mockAnalyst.id);
    });

    it('should still return analyst even if portfolio creation fails', async () => {
      const dto: CreateAnalystDto = {
        slug: 'technical-tina',
        name: 'Technical Tina',
        domain: 'stock',
        scope_level: 'runner',
        perspective: 'Technical analysis expert',
        tier_instructions: { gold: 'Detailed analysis' },
        default_weight: 1.0,
        is_enabled: true,
      };

      // Mock portfolio creation to fail
      (
        mockPortfolioRepository.createAnalystPortfolios as jest.Mock
      ).mockRejectedValue(new Error('Portfolio creation failed'));

      const result = await service.create(dto);

      // Should still return the analyst
      expect(result).toEqual(mockAnalyst);
      expect(mockAnalystRepository.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('createWithoutPortfolios', () => {
    it('should create an analyst without creating portfolios', async () => {
      const dto: CreateAnalystDto = {
        slug: 'technical-tina',
        name: 'Technical Tina',
        domain: 'stock',
        scope_level: 'runner',
        perspective: 'Technical analysis expert',
        tier_instructions: {},
        default_weight: 1.0,
        is_enabled: true,
      };

      const result = await service.createWithoutPortfolios(dto);

      expect(result).toEqual(mockAnalyst);
      expect(mockAnalystRepository.create).toHaveBeenCalledWith(dto);
      expect(
        mockPortfolioRepository.createAnalystPortfolios,
      ).not.toHaveBeenCalled();
    });
  });

  // =============================================================================
  // GET PORTFOLIOS
  // =============================================================================

  describe('getAnalystPortfolios', () => {
    it('should return both user and agent portfolios', async () => {
      const result = await service.getAnalystPortfolios('analyst-123');

      expect(result.user).toEqual(mockUserPortfolio);
      expect(result.ai).toEqual(mockAgentPortfolio);
      expect(mockPortfolioRepository.getAnalystPortfolio).toHaveBeenCalledWith(
        'analyst-123',
        'user',
      );
      expect(mockPortfolioRepository.getAnalystPortfolio).toHaveBeenCalledWith(
        'analyst-123',
        'ai',
      );
    });

    it('should return null for missing portfolios', async () => {
      (
        mockPortfolioRepository.getAnalystPortfolio as jest.Mock
      ).mockResolvedValue(null);

      const result = await service.getAnalystPortfolios('analyst-123');

      expect(result.user).toBeNull();
      expect(result.ai).toBeNull();
    });
  });

  // =============================================================================
  // ENSURE PORTFOLIOS (MIGRATION)
  // =============================================================================

  describe('ensureAnalystPortfolios', () => {
    it('should return existing portfolios if both exist', async () => {
      const result = await service.ensureAnalystPortfolios('analyst-123');

      expect(result.userPortfolio).toEqual(mockUserPortfolio);
      expect(result.aiPortfolio).toEqual(mockAgentPortfolio);
      // Should not create new portfolios
      expect(
        mockPortfolioRepository.createAnalystPortfolio,
      ).not.toHaveBeenCalled();
    });

    it('should create missing user portfolio', async () => {
      (
        mockPortfolioRepository.getAnalystPortfolio as jest.Mock
      ).mockImplementation((analystId, forkType) => {
        // Return null for user, existing for agent
        return Promise.resolve(forkType === 'ai' ? mockAgentPortfolio : null);
      });

      const result = await service.ensureAnalystPortfolios('analyst-123');

      expect(
        mockPortfolioRepository.createAnalystPortfolio,
      ).toHaveBeenCalledWith('analyst-123', 'user');
      expect(
        mockPortfolioRepository.createAnalystPortfolio,
      ).not.toHaveBeenCalledWith('analyst-123', 'ai');
      expect(result.userPortfolio).toEqual(mockUserPortfolio);
      expect(result.aiPortfolio).toEqual(mockAgentPortfolio);
    });

    it('should create missing agent portfolio', async () => {
      (
        mockPortfolioRepository.getAnalystPortfolio as jest.Mock
      ).mockImplementation((analystId, forkType) => {
        // Return existing for user, null for agent
        return Promise.resolve(forkType === 'user' ? mockUserPortfolio : null);
      });

      const result = await service.ensureAnalystPortfolios('analyst-123');

      expect(
        mockPortfolioRepository.createAnalystPortfolio,
      ).not.toHaveBeenCalledWith('analyst-123', 'user');
      expect(
        mockPortfolioRepository.createAnalystPortfolio,
      ).toHaveBeenCalledWith('analyst-123', 'ai');
      expect(result.userPortfolio).toEqual(mockUserPortfolio);
      expect(result.aiPortfolio).toEqual(mockAgentPortfolio);
    });

    it('should create both portfolios if neither exists', async () => {
      (
        mockPortfolioRepository.getAnalystPortfolio as jest.Mock
      ).mockResolvedValue(null);

      const result = await service.ensureAnalystPortfolios('analyst-123');

      expect(
        mockPortfolioRepository.createAnalystPortfolio,
      ).toHaveBeenCalledWith('analyst-123', 'user');
      expect(
        mockPortfolioRepository.createAnalystPortfolio,
      ).toHaveBeenCalledWith('analyst-123', 'ai');
      expect(result.userPortfolio).toEqual(mockUserPortfolio);
      expect(result.aiPortfolio).toEqual(mockAgentPortfolio);
    });
  });

  // =============================================================================
  // STANDARD CRUD OPERATIONS
  // =============================================================================

  describe('findById', () => {
    it('should find analyst by ID', async () => {
      const result = await service.findById('analyst-123');
      expect(result).toEqual(mockAnalyst);
      expect(mockAnalystRepository.findById).toHaveBeenCalledWith(
        'analyst-123',
      );
    });
  });

  describe('findByIdOrThrow', () => {
    it('should find analyst by ID or throw', async () => {
      const result = await service.findByIdOrThrow('analyst-123');
      expect(result).toEqual(mockAnalyst);
      expect(mockAnalystRepository.findByIdOrThrow).toHaveBeenCalledWith(
        'analyst-123',
      );
    });
  });

  describe('findBySlug', () => {
    it('should find analysts by slug', async () => {
      const result = await service.findBySlug('technical-tina');
      expect(result).toEqual([mockAnalyst]);
      expect(mockAnalystRepository.findBySlug).toHaveBeenCalledWith(
        'technical-tina',
        undefined,
        undefined,
      );
    });

    it('should filter by scope level and domain', async () => {
      await service.findBySlug('technical-tina', 'runner', 'stock');
      expect(mockAnalystRepository.findBySlug).toHaveBeenCalledWith(
        'technical-tina',
        'runner',
        'stock',
      );
    });
  });

  describe('update', () => {
    it('should update analyst', async () => {
      const result = await service.update('analyst-123', {
        name: 'Updated Tina',
      });
      expect(result).toEqual(mockAnalyst);
      expect(mockAnalystRepository.update).toHaveBeenCalledWith('analyst-123', {
        name: 'Updated Tina',
      });
    });
  });

  describe('delete', () => {
    it('should delete analyst', async () => {
      await service.delete('analyst-123');
      expect(mockAnalystRepository.delete).toHaveBeenCalledWith('analyst-123');
    });
  });

  describe('findByDomain', () => {
    it('should find analysts by domain', async () => {
      const result = await service.findByDomain('stock');
      expect(result).toEqual([mockAnalyst]);
      expect(mockAnalystRepository.findByDomain).toHaveBeenCalledWith('stock');
    });
  });

  describe('findRunnerLevel', () => {
    it('should find runner-level analysts', async () => {
      const result = await service.findRunnerLevel();
      expect(result).toEqual([mockAnalyst]);
      expect(mockAnalystRepository.findRunnerLevel).toHaveBeenCalled();
    });
  });

  describe('getActiveAnalysts', () => {
    it('should get active analysts for a target', async () => {
      await service.getActiveAnalysts('target-123', 'gold');
      expect(mockAnalystRepository.getActiveAnalysts).toHaveBeenCalledWith(
        'target-123',
        'gold',
      );
    });
  });
});
