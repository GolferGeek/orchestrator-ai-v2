import { Test, TestingModule } from '@nestjs/testing';
import { SourceSubscriptionRepository } from '../source-subscription.repository';
import { SupabaseService } from '@/supabase/supabase.service';

describe('SourceSubscriptionRepository', () => {
  let repository: SourceSubscriptionRepository;
  let mockSupabaseService: Partial<SupabaseService>;
  let mockClient: {
    schema: jest.Mock;
    from: jest.Mock;
    insert: jest.Mock;
    select: jest.Mock;
    single: jest.Mock;
    eq: jest.Mock;
    update: jest.Mock;
    rpc: jest.Mock;
    order: jest.Mock;
    limit: jest.Mock;
  };

  const mockSubscription = {
    id: 'sub-123',
    source_id: 'source-123',
    target_id: 'target-123',
    universe_id: 'universe-123',
    filter_config: {
      keywords_include: ['stock'],
      keywords_exclude: ['spam'],
    },
    last_processed_at: '2024-01-01T00:00:00Z',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    mockClient = {
      schema: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      rpc: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    };

    mockSupabaseService = {
      getServiceClient: jest.fn().mockReturnValue(mockClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SourceSubscriptionRepository,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    repository = module.get<SourceSubscriptionRepository>(SourceSubscriptionRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  // =============================================================================
  // FIND BY ID
  // =============================================================================

  describe('findById', () => {
    it('should find subscription by ID', async () => {
      mockClient.single.mockResolvedValue({
        data: mockSubscription,
        error: null,
      });

      const result = await repository.findById('sub-123');

      expect(result).toEqual(mockSubscription);
      expect(mockClient.schema).toHaveBeenCalledWith('prediction');
      expect(mockClient.from).toHaveBeenCalledWith('source_subscriptions');
      expect(mockClient.eq).toHaveBeenCalledWith('id', 'sub-123');
    });

    it('should return null when not found', async () => {
      mockClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // =============================================================================
  // FIND BY TARGET
  // =============================================================================

  describe('findByTarget', () => {
    it('should find subscriptions by target ID', async () => {
      mockClient.order.mockResolvedValue({
        data: [mockSubscription],
        error: null,
      });

      const result = await repository.findByTarget('target-123');

      expect(result).toEqual([mockSubscription]);
      expect(mockClient.eq).toHaveBeenCalledWith('target_id', 'target-123');
      expect(mockClient.eq).toHaveBeenCalledWith('is_active', true);
    });

    it('should return empty array when none found', async () => {
      mockClient.order.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await repository.findByTarget('no-subs');

      expect(result).toEqual([]);
    });
  });

  // =============================================================================
  // FIND BY UNIVERSE
  // =============================================================================

  describe('findByUniverse', () => {
    it('should find subscriptions by universe ID', async () => {
      mockClient.order.mockResolvedValue({
        data: [mockSubscription],
        error: null,
      });

      const result = await repository.findByUniverse('universe-123');

      expect(result).toHaveLength(1);
      expect(mockClient.eq).toHaveBeenCalledWith('universe_id', 'universe-123');
      expect(mockClient.eq).toHaveBeenCalledWith('is_active', true);
    });
  });

  // =============================================================================
  // CREATE
  // =============================================================================

  describe('create', () => {
    it('should create a new subscription', async () => {
      mockClient.single.mockResolvedValue({
        data: mockSubscription,
        error: null,
      });

      const createData = {
        source_id: 'source-123',
        target_id: 'target-123',
        universe_id: 'universe-123',
        filter_config: { keywords_include: ['stock'] },
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockSubscription);
      expect(mockClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          source_id: 'source-123',
          target_id: 'target-123',
          universe_id: 'universe-123',
        }),
      );
    });

    it('should throw error when creation fails', async () => {
      mockClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Insert failed' },
      });

      await expect(
        repository.create({
          source_id: 'source-123',
          target_id: 'target-123',
          universe_id: 'universe-123',
        }),
      ).rejects.toThrow('Failed to create subscription');
    });
  });

  // =============================================================================
  // UPDATE
  // =============================================================================

  describe('update', () => {
    it('should update subscription', async () => {
      const updatedSubscription = { ...mockSubscription, is_active: false };
      mockClient.single.mockResolvedValue({
        data: updatedSubscription,
        error: null,
      });

      const result = await repository.update('sub-123', { is_active: false });

      expect(result).toEqual(updatedSubscription);
      expect(mockClient.update).toHaveBeenCalledWith({ is_active: false });
      expect(mockClient.eq).toHaveBeenCalledWith('id', 'sub-123');
    });

    it('should throw error when update fails', async () => {
      mockClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Update failed' },
      });

      await expect(repository.update('sub-123', { is_active: false })).rejects.toThrow(
        'Failed to update subscription',
      );
    });
  });

  // =============================================================================
  // GET NEW ARTICLES
  // =============================================================================

  describe('getNewArticles', () => {
    it('should call RPC function to get new articles', async () => {
      const mockArticles = [
        {
          article_id: 'article-123',
          source_id: 'source-123',
          url: 'https://example.com/1',
          title: 'Test Article',
          content: 'Content here',
          summary: 'Summary',
          content_hash: 'hash123',
          first_seen_at: '2024-01-15T12:00:00Z',
        },
      ];

      mockClient.rpc.mockResolvedValue({
        data: mockArticles,
        error: null,
      });

      const result = await repository.getNewArticles('sub-123', 50);

      expect(mockClient.rpc).toHaveBeenCalledWith('get_new_articles_for_subscription', {
        p_subscription_id: 'sub-123',
        p_limit: 50,
      });
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('article-123');
    });

    it('should throw error on RPC failure', async () => {
      mockClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC failed' },
      });

      await expect(repository.getNewArticles('sub-123')).rejects.toThrow(
        'Failed to get new articles: RPC failed',
      );
    });
  });

  // =============================================================================
  // GET NEW ARTICLES FOR TARGET
  // =============================================================================

  describe('getNewArticlesForTarget', () => {
    it('should call RPC function to get articles for target', async () => {
      const mockArticles = [
        {
          article_id: 'article-123',
          subscription_id: 'sub-123',
          source_id: 'source-123',
          url: 'https://example.com/1',
          title: 'Test Article',
          content_hash: 'hash123',
          first_seen_at: '2024-01-15T12:00:00Z',
        },
      ];

      mockClient.rpc.mockResolvedValue({
        data: mockArticles,
        error: null,
      });

      const result = await repository.getNewArticlesForTarget('target-123', 100);

      expect(mockClient.rpc).toHaveBeenCalledWith('get_new_articles_for_target', {
        p_target_id: 'target-123',
        p_limit: 100,
      });
      expect(result).toHaveLength(1);
    });
  });

  // =============================================================================
  // UPDATE WATERMARK
  // =============================================================================

  describe('updateWatermark', () => {
    it('should update last_processed_at via update method', async () => {
      mockClient.single.mockResolvedValue({
        data: { ...mockSubscription, last_processed_at: '2024-01-15T12:00:00.000Z' },
        error: null,
      });

      const timestamp = new Date('2024-01-15T12:00:00Z');
      await repository.updateWatermark('sub-123', timestamp);

      expect(mockClient.update).toHaveBeenCalledWith({
        last_processed_at: timestamp.toISOString(),
      });
      expect(mockClient.eq).toHaveBeenCalledWith('id', 'sub-123');
    });

    it('should use current time when no timestamp provided', async () => {
      mockClient.single.mockResolvedValue({
        data: mockSubscription,
        error: null,
      });

      await repository.updateWatermark('sub-123');

      expect(mockClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          last_processed_at: expect.any(String),
        }),
      );
    });
  });

  // =============================================================================
  // GET SUBSCRIPTION STATS
  // =============================================================================

  describe('getStats', () => {
    it('should return all subscription statistics from view', async () => {
      const mockStats = [
        {
          subscription_id: 'sub-123',
          source_id: 'source-123',
          source_name: 'Test Source',
          source_url: 'https://example.com',
          target_id: 'target-123',
          target_symbol: 'AAPL',
          target_name: 'Apple Inc',
          universe_id: 'universe-123',
          universe_name: 'Tech Universe',
          is_active: true,
          last_processed_at: '2024-01-15T12:00:00Z',
          pending_articles: 5,
          processed_articles: 100,
        },
      ];

      mockClient.select.mockResolvedValue({
        data: mockStats,
        error: null,
      });

      const result = await repository.getStats();

      expect(result).toHaveLength(1);
      expect(result[0]!.pending_articles).toBe(5);
      expect(result[0]!.processed_articles).toBe(100);
      expect(mockClient.schema).toHaveBeenCalledWith('prediction');
      expect(mockClient.from).toHaveBeenCalledWith('subscription_stats');
    });
  });

  describe('getStatsForTarget', () => {
    it('should return subscription statistics for a specific target', async () => {
      const mockStats = [
        {
          subscription_id: 'sub-123',
          source_id: 'source-123',
          source_name: 'Test Source',
          source_url: 'https://example.com',
          target_id: 'target-123',
          target_symbol: 'AAPL',
          target_name: 'Apple Inc',
          universe_id: 'universe-123',
          universe_name: 'Tech Universe',
          is_active: true,
          last_processed_at: '2024-01-15T12:00:00Z',
          pending_articles: 5,
          processed_articles: 100,
        },
      ];

      mockClient.eq.mockResolvedValue({
        data: mockStats,
        error: null,
      });

      const result = await repository.getStatsForTarget('target-123');

      expect(result).toHaveLength(1);
      expect(mockClient.eq).toHaveBeenCalledWith('target_id', 'target-123');
    });
  });
});
