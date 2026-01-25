import { Test, TestingModule } from '@nestjs/testing';
import { RiskSourceSubscriptionRepository } from '../source-subscription.repository';
import { SupabaseService } from '@/supabase/supabase.service';

describe('RiskSourceSubscriptionRepository', () => {
  let repository: RiskSourceSubscriptionRepository;
  let mockSupabaseService: Partial<SupabaseService>;

  const mockSubscription = {
    id: 'sub-123',
    source_id: 'source-123',
    scope_id: 'scope-123',
    dimension_mapping: {
      dimensions: ['financial', 'regulatory'],
      weight: 1.0,
      auto_apply: true,
    },
    subject_filter: {
      subject_ids: [],
      subject_types: ['company'],
      identifier_pattern: null,
      apply_to_all: false,
    },
    last_processed_at: '2024-01-01T00:00:00Z',
    auto_reanalyze: true,
    reanalyze_threshold: 0.1,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  // Create a thenable object that is both chainable and resolvable
  function createThenableMock(data: unknown, error: unknown = null) {
    const result = { data, error };
    const mock = {
      schema: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue(result),
      eq: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      rpc: jest.fn().mockResolvedValue(result),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      then: (resolve: any, reject?: any) =>
        Promise.resolve(result).then(resolve, reject),
    };

    return mock;
  }

  beforeEach(async () => {
    // Create a default mock client - tests will override specific methods
    const mockClient = createThenableMock(null, null);

    mockSupabaseService = {
      getServiceClient: jest.fn().mockReturnValue(mockClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskSourceSubscriptionRepository,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    repository = module.get<RiskSourceSubscriptionRepository>(
      RiskSourceSubscriptionRepository,
    );
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  // =============================================================================
  // FIND BY ID
  // =============================================================================

  describe('findById', () => {
    it('should find subscription by ID', async () => {
      const mockClient = createThenableMock(mockSubscription, null);
      (mockSupabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findById('sub-123');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('sub-123');
      expect(mockClient.schema).toHaveBeenCalledWith('risk');
      expect(mockClient.from).toHaveBeenCalledWith('source_subscriptions');
    });

    it('should return null when not found', async () => {
      const mockClient = createThenableMock(null, {
        code: 'PGRST116',
        message: 'Not found',
      });
      (mockSupabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // =============================================================================
  // FIND BY SCOPE
  // =============================================================================

  describe('findByScope', () => {
    it('should find subscriptions by scope ID', async () => {
      const mockClient = createThenableMock([mockSubscription], null);
      (mockSupabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findByScope('scope-123');

      expect(result).toHaveLength(1);
      expect(mockClient.eq).toHaveBeenCalledWith('scope_id', 'scope-123');
      expect(mockClient.eq).toHaveBeenCalledWith('is_active', true);
    });

    it('should return empty array on error', async () => {
      const mockClient = createThenableMock(null, { message: 'Query failed' });
      (mockSupabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findByScope('scope-123');

      expect(result).toEqual([]);
    });
  });

  // =============================================================================
  // FIND BY SOURCE
  // =============================================================================

  describe('findBySource', () => {
    it('should find subscriptions by source ID', async () => {
      const mockClient = createThenableMock([mockSubscription], null);
      (mockSupabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findBySource('source-123');

      expect(result).toHaveLength(1);
      expect(mockClient.eq).toHaveBeenCalledWith('source_id', 'source-123');
    });
  });

  // =============================================================================
  // CREATE
  // =============================================================================

  describe('create', () => {
    it('should create a new subscription with defaults', async () => {
      const mockClient = createThenableMock(mockSubscription, null);
      (mockSupabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.create({
        source_id: 'source-123',
        scope_id: 'scope-123',
      });

      expect(result).toBeDefined();
      expect(mockClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          source_id: 'source-123',
          scope_id: 'scope-123',
          dimension_mapping: expect.objectContaining({
            dimensions: [],
            weight: 1.0,
            auto_apply: true,
          }),
          subject_filter: expect.objectContaining({
            subject_ids: [],
            subject_types: [],
            apply_to_all: false,
          }),
          auto_reanalyze: true,
          reanalyze_threshold: 0.1,
        }),
      );
    });

    it('should create subscription with custom dimension mapping', async () => {
      const mockClient = createThenableMock(mockSubscription, null);
      (mockSupabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await repository.create({
        source_id: 'source-123',
        scope_id: 'scope-123',
        dimension_mapping: {
          dimensions: ['financial'],
          weight: 0.8,
          auto_apply: false,
        },
      });

      expect(mockClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          dimension_mapping: expect.objectContaining({
            dimensions: ['financial'],
            weight: 0.8,
            auto_apply: false,
          }),
        }),
      );
    });

    it('should throw error when creation fails', async () => {
      const mockClient = createThenableMock(null, { message: 'Insert failed' });
      (mockSupabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.create({
          source_id: 'source-123',
          scope_id: 'scope-123',
        }),
      ).rejects.toThrow('Failed to create subscription');
    });
  });

  // =============================================================================
  // UPDATE
  // =============================================================================

  describe('update', () => {
    it('should update subscription', async () => {
      const mockClient = createThenableMock(
        { ...mockSubscription, auto_reanalyze: false },
        null,
      );
      (mockSupabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.update('sub-123', {
        auto_reanalyze: false,
      });

      expect(result.auto_reanalyze).toBe(false);
      expect(mockClient.update).toHaveBeenCalledWith({ auto_reanalyze: false });
    });

    it('should throw error when update fails', async () => {
      const mockClient = createThenableMock(null, { message: 'Update failed' });
      (mockSupabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.update('sub-123', { is_active: false }),
      ).rejects.toThrow('Failed to update subscription');
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
          title: 'Risk News',
          content: 'Content about risk',
          content_hash: 'hash123',
          first_seen_at: '2024-01-15T12:00:00Z',
        },
      ];

      const mockClient = createThenableMock(mockArticles, null);
      (mockSupabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.getNewArticles('sub-123', 50);

      expect(mockClient.rpc).toHaveBeenCalledWith(
        'get_new_articles_for_subscription',
        {
          p_subscription_id: 'sub-123',
          p_limit: 50,
        },
      );
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('article-123');
    });

    it('should use default limit of 100', async () => {
      const mockClient = createThenableMock([], null);
      (mockSupabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await repository.getNewArticles('sub-123');

      expect(mockClient.rpc).toHaveBeenCalledWith(
        'get_new_articles_for_subscription',
        {
          p_subscription_id: 'sub-123',
          p_limit: 100,
        },
      );
    });

    it('should return empty array on error', async () => {
      const mockClient = createThenableMock(null, { message: 'RPC failed' });
      (mockSupabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.getNewArticles('sub-123');

      expect(result).toEqual([]);
    });
  });

  // =============================================================================
  // GET NEW ARTICLES FOR SCOPE
  // =============================================================================

  describe('getNewArticlesForScope', () => {
    it('should call RPC function to get articles for scope', async () => {
      const mockArticles = [
        {
          article_id: 'article-123',
          subscription_id: 'sub-123',
          source_id: 'source-123',
          url: 'https://example.com/1',
          title: 'Scope News',
          content_hash: 'hash123',
          first_seen_at: '2024-01-15T12:00:00Z',
          dimension_mapping: {
            dimensions: ['financial'],
            weight: 1.0,
            auto_apply: true,
          },
          subject_filter: {
            subject_ids: [],
            subject_types: [],
            identifier_pattern: null,
            apply_to_all: false,
          },
        },
      ];

      const mockClient = createThenableMock(mockArticles, null);
      (mockSupabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.getNewArticlesForScope('scope-123', 100);

      expect(mockClient.rpc).toHaveBeenCalledWith(
        'get_new_articles_for_scope',
        {
          p_scope_id: 'scope-123',
          p_limit: 100,
        },
      );
      expect(result).toHaveLength(1);
      expect(result[0]!.subscription_id).toBe('sub-123');
      expect(result[0]!.dimension_mapping).toBeDefined();
    });
  });

  // =============================================================================
  // UPDATE WATERMARK
  // =============================================================================

  describe('updateWatermark', () => {
    it('should call RPC function to update watermark', async () => {
      const mockClient = createThenableMock(null, null);
      (mockSupabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const timestamp = new Date('2024-01-15T12:00:00Z');
      await repository.updateWatermark('sub-123', timestamp);

      expect(mockClient.rpc).toHaveBeenCalledWith(
        'update_subscription_watermark',
        {
          p_subscription_id: 'sub-123',
          p_last_processed_at: timestamp.toISOString(),
        },
      );
    });
  });

  // =============================================================================
  // GET SUBSCRIPTION STATS
  // =============================================================================

  describe('getSubscriptionStats', () => {
    it('should return subscription statistics from view', async () => {
      const mockStats = [
        {
          subscription_id: 'sub-123',
          source_id: 'source-123',
          source_name: 'Test Source',
          source_url: 'https://example.com',
          scope_id: 'scope-123',
          scope_name: 'Test Scope',
          is_active: true,
          auto_reanalyze: true,
          last_processed_at: '2024-01-15T12:00:00Z',
          pending_articles: '5',
          processed_articles: '100',
        },
      ];

      const mockClient = createThenableMock(mockStats, null);
      (mockSupabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.getSubscriptionStats('scope-123');

      expect(mockClient.schema).toHaveBeenCalledWith('risk');
      expect(mockClient.from).toHaveBeenCalledWith('subscription_stats');
      expect(result).toHaveLength(1);
      expect(result[0]!.pending_articles).toBe(5);
      expect(result[0]!.processed_articles).toBe(100);
    });

    it('should return empty array on error', async () => {
      const mockClient = createThenableMock(null, { message: 'Query failed' });
      (mockSupabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.getSubscriptionStats('scope-123');

      expect(result).toEqual([]);
    });
  });
});
