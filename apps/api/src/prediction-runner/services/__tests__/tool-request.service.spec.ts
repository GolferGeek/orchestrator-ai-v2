import { Test, TestingModule } from '@nestjs/testing';
import { ToolRequestService } from '../tool-request.service';
import { ToolRequestRepository } from '../../repositories/tool-request.repository';
import {
  ToolRequest,
  ToolSuggestion,
} from '../../interfaces/tool-request.interface';
import { MissedOpportunity } from '../../interfaces/missed-opportunity.interface';

describe('ToolRequestService', () => {
  let service: ToolRequestService;
  let repository: jest.Mocked<ToolRequestRepository>;

  const mockToolRequest: ToolRequest = {
    id: 'request-123',
    universe_id: 'universe-123',
    missed_opportunity_id: 'missed-123',
    type: 'source',
    name: 'Earnings Calendar',
    description: 'Add earnings calendar data source',
    rationale: 'Missed moves due to earnings surprises',
    suggested_url: 'https://api.earnings.com',
    suggested_config: null,
    priority: 'high',
    status: 'wishlist',
    resolution_notes: null,
    resolved_at: null,
    resolved_by_user_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolRequestService,
        {
          provide: ToolRequestRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            findByIdOrThrow: jest.fn(),
            findByStatus: jest.fn(),
            findByMissedOpportunity: jest.fn(),
            findWishlist: jest.fn(),
            findByPriority: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            updateStatus: jest.fn(),
            delete: jest.fn(),
            getStats: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ToolRequestService>(ToolRequestService);
    repository = module.get(ToolRequestRepository);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all tool requests', async () => {
      repository.findAll.mockResolvedValue([mockToolRequest]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('Earnings Calendar');
    });

    it('should filter by universe', async () => {
      repository.findAll.mockResolvedValue([mockToolRequest]);

      await service.findAll('universe-123');

      expect(repository.findAll).toHaveBeenCalledWith('universe-123');
    });
  });

  describe('getWishlist', () => {
    it('should return wishlist items', async () => {
      repository.findWishlist.mockResolvedValue([mockToolRequest]);

      const result = await service.getWishlist();

      expect(result).toHaveLength(1);
      expect(result[0]!.status).toBe('wishlist');
    });
  });

  describe('create', () => {
    it('should create a new tool request', async () => {
      repository.findAll.mockResolvedValue([]);
      repository.create.mockResolvedValue(mockToolRequest);

      const result = await service.create({
        universe_id: 'universe-123',
        type: 'source',
        name: 'Earnings Calendar',
        description: 'Add earnings calendar',
        rationale: 'Missed earnings moves',
      });

      expect(result.id).toBe('request-123');
      expect(repository.create).toHaveBeenCalled();
    });

    it('should return existing request if similar one exists', async () => {
      repository.findAll.mockResolvedValue([mockToolRequest]);

      const result = await service.create({
        universe_id: 'universe-123',
        type: 'source',
        name: 'Earnings Calendar',
        description: 'Add earnings calendar',
        rationale: 'Missed earnings moves',
      });

      expect(result.id).toBe('request-123');
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('createFromSuggestions', () => {
    it('should create requests from suggestions', async () => {
      const suggestions: ToolSuggestion[] = [
        {
          type: 'source',
          name: 'Earnings Data',
          description: 'Track earnings announcements',
          rationale: 'Missing earnings data',
          priority: 'high',
          confidence: 0.8,
        },
        {
          type: 'api',
          name: 'Fed Calendar',
          description: 'Track Fed announcements',
          rationale: 'Missing Fed impact',
          priority: 'medium',
          confidence: 0.7,
        },
      ];

      repository.findAll.mockResolvedValue([]);
      repository.create.mockResolvedValue(mockToolRequest);

      const result = await service.createFromSuggestions(
        'universe-123',
        'missed-123',
        suggestions,
      );

      expect(result).toHaveLength(2);
      expect(repository.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateStatus', () => {
    it('should update status to planned', async () => {
      repository.updateStatus.mockResolvedValue({
        ...mockToolRequest,
        status: 'planned',
      });

      const result = await service.markPlanned('request-123', 'user-123');

      expect(result.status).toBe('planned');
      expect(repository.updateStatus).toHaveBeenCalledWith(
        'request-123',
        'planned',
        'user-123',
        undefined,
      );
    });

    it('should update status to done with notes', async () => {
      repository.updateStatus.mockResolvedValue({
        ...mockToolRequest,
        status: 'done',
        resolution_notes: 'Implemented',
      });

      const result = await service.markDone(
        'request-123',
        'user-123',
        'Implemented',
      );

      expect(result.status).toBe('done');
      expect(repository.updateStatus).toHaveBeenCalledWith(
        'request-123',
        'done',
        'user-123',
        'Implemented',
      );
    });
  });

  describe('reject', () => {
    it('should reject a tool request', async () => {
      repository.updateStatus.mockResolvedValue({
        ...mockToolRequest,
        status: 'rejected',
        resolution_notes: 'Not feasible',
      });

      const result = await service.reject(
        'request-123',
        'user-123',
        'Not feasible',
      );

      expect(result.status).toBe('rejected');
    });
  });

  describe('getStats', () => {
    it('should return statistics', async () => {
      repository.getStats.mockResolvedValue({
        total: 10,
        by_status: {
          wishlist: 5,
          planned: 2,
          in_progress: 1,
          done: 2,
          rejected: 0,
        },
        by_priority: {
          low: 2,
          medium: 4,
          high: 3,
          critical: 1,
        },
      });

      const result = await service.getStats();

      expect(result.total).toBe(10);
      expect(result.by_status.wishlist).toBe(5);
    });
  });

  describe('generateSuggestionsFromAnalysis', () => {
    it('should generate suggestions from source gaps', () => {
      const analysis = {
        discovered_drivers: [],
        source_gaps: ['Earnings calendar data', 'Analyst rating changes'],
        had_relevant_signals: false,
      };
      const missedOpp: MissedOpportunity = {
        id: 'missed-123',
        target_id: 'target-123',
        detected_at: '2026-01-08T00:00:00Z',
        move_start: '2026-01-07T00:00:00Z',
        move_end: '2026-01-08T00:00:00Z',
        move_direction: 'up',
        move_percentage: 15,
        significance_score: 0.8,
        analysis_status: 'completed',
        discovered_drivers: [],
        source_gaps: [],
        suggested_learnings: [],
        created_at: '2026-01-08T00:00:00Z',
        updated_at: '2026-01-08T00:00:00Z',
      };

      const suggestions = service.generateSuggestionsFromAnalysis(
        analysis,
        missedOpp,
      );

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]!.type).toBe('source');
    });

    it('should suggest earnings API when driver mentions earnings', () => {
      const analysis = {
        discovered_drivers: ['Earnings beat by 20%'],
        source_gaps: [],
        had_relevant_signals: false,
      };
      const missedOpp: MissedOpportunity = {
        id: 'missed-123',
        target_id: 'target-123',
        detected_at: '2026-01-08T00:00:00Z',
        move_start: '2026-01-07T00:00:00Z',
        move_end: '2026-01-08T00:00:00Z',
        move_direction: 'up',
        move_percentage: 12,
        significance_score: 0.7,
        analysis_status: 'completed',
        discovered_drivers: ['Earnings beat by 20%'],
        source_gaps: [],
        suggested_learnings: [],
        created_at: '2026-01-08T00:00:00Z',
        updated_at: '2026-01-08T00:00:00Z',
      };

      const suggestions = service.generateSuggestionsFromAnalysis(
        analysis,
        missedOpp,
      );

      const earningsSuggestion = suggestions.find((s) =>
        s.name.toLowerCase().includes('earnings'),
      );
      expect(earningsSuggestion).toBeDefined();
    });

    it('should suggest Fed calendar when driver mentions Fed', () => {
      const analysis = {
        discovered_drivers: ['Fed rate hike announcement'],
        source_gaps: [],
        had_relevant_signals: false,
      };
      const missedOpp: MissedOpportunity = {
        id: 'missed-123',
        target_id: 'target-123',
        detected_at: '2026-01-08T00:00:00Z',
        move_start: '2026-01-07T00:00:00Z',
        move_end: '2026-01-08T00:00:00Z',
        move_direction: 'down',
        move_percentage: -10,
        significance_score: 0.75,
        analysis_status: 'completed',
        discovered_drivers: ['Fed rate hike'],
        source_gaps: [],
        suggested_learnings: [],
        created_at: '2026-01-08T00:00:00Z',
        updated_at: '2026-01-08T00:00:00Z',
      };

      const suggestions = service.generateSuggestionsFromAnalysis(
        analysis,
        missedOpp,
      );

      const fedSuggestion = suggestions.find((s) =>
        s.name.toLowerCase().includes('fed'),
      );
      expect(fedSuggestion).toBeDefined();
    });
  });

  describe('getActionRequired', () => {
    it('should return high priority pending requests', async () => {
      const criticalRequest = {
        ...mockToolRequest,
        priority: 'critical' as const,
        status: 'wishlist' as const,
      };
      const highRequest = {
        ...mockToolRequest,
        id: 'request-456',
        priority: 'high' as const,
        status: 'planned' as const,
      };

      repository.findByPriority
        .mockResolvedValueOnce([criticalRequest])
        .mockResolvedValueOnce([highRequest]);

      const result = await service.getActionRequired();

      expect(result).toHaveLength(2);
      expect(repository.findByPriority).toHaveBeenCalledWith(
        'critical',
        undefined,
      );
      expect(repository.findByPriority).toHaveBeenCalledWith('high', undefined);
    });
  });
});
