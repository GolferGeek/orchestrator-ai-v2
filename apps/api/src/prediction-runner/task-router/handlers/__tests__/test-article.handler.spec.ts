/**
 * Test Article Handler Tests
 *
 * Comprehensive test suite for the TestArticleHandler including:
 * - CRUD operations (list, get, create, update, delete)
 * - Bulk operations (bulk-create)
 * - Processing operations (mark-processed, list-unprocessed)
 * - AI generation operations (generate)
 * - Error handling and validation
 * - Case insensitivity for action names
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TestArticleHandler } from '../test-article.handler';
import {
  TestArticleRepository,
  TestArticle,
} from '../../../repositories/test-article.repository';
import { AiArticleGeneratorService } from '../../../services/ai-article-generator.service';
import {
  ExecutionContext,
  DashboardRequestPayload,
} from '@orchestrator-ai/transport-types';
import {
  TestArticleGenerationRequest,
  TestArticleGenerationResult,
} from '../../../interfaces/ai-generation.interface';

describe('TestArticleHandler', () => {
  let handler: TestArticleHandler;
  let mockRepository: Partial<TestArticleRepository>;
  let mockAiGeneratorService: Partial<AiArticleGeneratorService>;

  const mockContext: ExecutionContext = {
    userId: 'user-123',
    orgSlug: 'test-org',
    agentSlug: 'prediction-runner',
    conversationId: 'conv-123',
    taskId: 'task-123',
    planId: 'plan-123',
    deliverableId: '',
    provider: 'anthropic',
    model: 'claude-sonnet-4',
    agentType: 'context',
  };

  const mockArticle: TestArticle = {
    id: 'article-123',
    organization_slug: 'test-org',
    scenario_id: 'scenario-123',
    title: 'Test Article Title',
    content: 'Test article content',
    source_name: 'Test News Source',
    published_at: '2024-01-15T00:00:00Z',
    target_symbols: ['T_AAPL', 'T_MSFT'],
    sentiment_expected: 'positive',
    strength_expected: 0.8,
    is_synthetic: true,
    synthetic_marker: '[SYNTHETIC TEST ARTICLE]',
    processed: false,
    processed_at: null,
    created_by: 'user-123',
    created_at: '2024-01-15T00:00:00Z',
    metadata: {},
  };

  beforeEach(async () => {
    mockRepository = {
      findById: jest.fn(),
      findByOrganization: jest.fn(),
      findByScenario: jest.fn(),
      findByTargetSymbol: jest.fn(),
      findUnprocessed: jest.fn(),
      create: jest.fn(),
      bulkCreate: jest.fn(),
      update: jest.fn(),
      markProcessed: jest.fn(),
      delete: jest.fn(),
    };

    mockAiGeneratorService = {
      generateArticles: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestArticleHandler,
        { provide: TestArticleRepository, useValue: mockRepository },
        {
          provide: AiArticleGeneratorService,
          useValue: mockAiGeneratorService,
        },
      ],
    }).compile();

    handler = module.get<TestArticleHandler>(TestArticleHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('getSupportedActions', () => {
    it('should return all supported actions', () => {
      const actions = handler.getSupportedActions();

      expect(actions).toContain('list');
      expect(actions).toContain('get');
      expect(actions).toContain('create');
      expect(actions).toContain('update');
      expect(actions).toContain('delete');
      expect(actions).toContain('bulk-create');
      expect(actions).toContain('mark-processed');
      expect(actions).toContain('list-unprocessed');
      expect(actions).toContain('generate');
      expect(actions.length).toBe(9);
    });
  });

  describe('execute - unsupported action', () => {
    it('should return error for unsupported action', async () => {
      const payload: DashboardRequestPayload = {
        action: 'unsupported',
        params: {},
      };

      const result = await handler.execute('unsupported', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNSUPPORTED_ACTION');
      expect(result.error?.message).toContain('unsupported');
      expect(result.error?.details?.supportedActions).toBeDefined();
    });
  });

  describe('list action', () => {
    it('should list articles by organization when no filters', async () => {
      (mockRepository.findByOrganization as jest.Mock).mockResolvedValue([
        mockArticle,
      ]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };

      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(mockRepository.findByOrganization).toHaveBeenCalledWith(
        'test-org',
      );
      expect(result.data).toHaveLength(1);
    });

    it('should list articles by scenario when scenarioId filter provided', async () => {
      (mockRepository.findByScenario as jest.Mock).mockResolvedValue([
        mockArticle,
      ]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {
          filters: { scenarioId: 'scenario-123' },
        },
      };

      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(mockRepository.findByScenario).toHaveBeenCalledWith(
        'scenario-123',
      );
      expect(result.data).toHaveLength(1);
    });

    it('should list articles by target symbol when targetSymbol filter provided', async () => {
      (mockRepository.findByTargetSymbol as jest.Mock).mockResolvedValue([
        mockArticle,
      ]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {
          filters: { targetSymbol: 'T_AAPL' },
        },
      };

      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(mockRepository.findByTargetSymbol).toHaveBeenCalledWith('T_AAPL');
      expect(result.data).toHaveLength(1);
    });

    it('should filter by processed status', async () => {
      const processedArticle = { ...mockArticle, processed: true };
      const unprocessedArticle = {
        ...mockArticle,
        id: 'article-456',
        processed: false,
      };
      (mockRepository.findByOrganization as jest.Mock).mockResolvedValue([
        processedArticle,
        unprocessedArticle,
      ]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {
          filters: { processed: true },
        },
      };

      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as TestArticle[];
      expect(data).toHaveLength(1);
      expect(data[0]?.processed).toBe(true);
    });

    it('should filter by sentiment', async () => {
      const positiveArticle = {
        ...mockArticle,
        sentiment_expected: 'positive',
      };
      const negativeArticle = {
        ...mockArticle,
        id: 'article-456',
        sentiment_expected: 'negative',
      };
      (mockRepository.findByOrganization as jest.Mock).mockResolvedValue([
        positiveArticle,
        negativeArticle,
      ]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {
          filters: { sentiment: 'positive' },
        },
      };

      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as TestArticle[];
      expect(data).toHaveLength(1);
      expect(data[0]?.sentiment_expected).toBe('positive');
    });

    it('should paginate results', async () => {
      const articles = Array.from({ length: 25 }, (_, i) => ({
        ...mockArticle,
        id: `article-${i}`,
      }));
      (mockRepository.findByOrganization as jest.Mock).mockResolvedValue(
        articles,
      );

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { page: 2, pageSize: 10 },
      };

      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as TestArticle[];
      expect(data).toHaveLength(10);
      expect(result.metadata?.page).toBe(2);
      expect(result.metadata?.pageSize).toBe(10);
      expect(result.metadata?.totalCount).toBe(25);
      expect(result.metadata?.hasMore).toBe(true);
    });

    it('should handle list service error', async () => {
      (mockRepository.findByOrganization as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };

      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LIST_FAILED');
      expect(result.error?.message).toContain('Database error');
    });
  });

  describe('get action', () => {
    it('should return error if id is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'get',
        params: {},
      };

      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
      expect(result.error?.message).toContain('required');
    });

    it('should get article by id', async () => {
      (mockRepository.findById as jest.Mock).mockResolvedValue(mockArticle);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'article-123' },
      };

      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(true);
      expect(mockRepository.findById).toHaveBeenCalledWith('article-123');
      const data = result.data as TestArticle;
      expect(data.id).toBe('article-123');
    });

    it('should return NOT_FOUND error if article does not exist', async () => {
      (mockRepository.findById as jest.Mock).mockResolvedValue(null);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'nonexistent' },
      };

      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
      expect(result.error?.message).toContain('nonexistent');
    });

    it('should handle get service error', async () => {
      (mockRepository.findById as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'article-123' },
      };

      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GET_FAILED');
      expect(result.error?.message).toContain('Database error');
    });
  });

  describe('create action', () => {
    it('should return error if required fields are missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          title: 'Test Title',
        },
      };

      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
      expect(result.error?.message).toContain('required');
    });

    it('should return error if target symbols do not have T_ prefix', async () => {
      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          title: 'Test Title',
          content: 'Test content',
          published_at: '2024-01-15T00:00:00Z',
          target_symbols: ['AAPL', 'MSFT'],
        },
      };

      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_SYMBOLS');
      expect(result.error?.message).toContain('T_ prefix');
      expect(result.error?.message).toContain('AAPL');
    });

    it('should create article successfully with required fields', async () => {
      (mockRepository.create as jest.Mock).mockResolvedValue(mockArticle);

      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          title: 'Test Title',
          content: 'Test content',
          published_at: '2024-01-15T00:00:00Z',
        },
      };

      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(true);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_slug: 'test-org',
          title: 'Test Title',
          content: 'Test content',
          published_at: '2024-01-15T00:00:00Z',
          created_by: 'user-123',
          processed: false,
          is_synthetic: true,
          source_name: 'Test News Source',
          synthetic_marker: '[SYNTHETIC TEST ARTICLE]',
        }),
      );
    });

    it('should create article with all optional fields', async () => {
      (mockRepository.create as jest.Mock).mockResolvedValue(mockArticle);

      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          scenario_id: 'scenario-123',
          title: 'Test Title',
          content: 'Test content',
          source_name: 'Custom Source',
          published_at: '2024-01-15T00:00:00Z',
          target_symbols: ['T_AAPL'],
          sentiment_expected: 'positive',
          strength_expected: 0.8,
          is_synthetic: false,
          synthetic_marker: '[CUSTOM MARKER]',
          metadata: { custom: 'data' },
        },
      };

      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(true);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          scenario_id: 'scenario-123',
          source_name: 'Custom Source',
          target_symbols: ['T_AAPL'],
          sentiment_expected: 'positive',
          strength_expected: 0.8,
          is_synthetic: false,
          synthetic_marker: '[CUSTOM MARKER]',
          metadata: { custom: 'data' },
        }),
      );
    });

    it('should handle create service error', async () => {
      (mockRepository.create as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          title: 'Test Title',
          content: 'Test content',
          published_at: '2024-01-15T00:00:00Z',
        },
      };

      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CREATE_FAILED');
      expect(result.error?.message).toContain('Database error');
    });
  });

  describe('update action', () => {
    it('should return error if id is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'update',
        params: { title: 'New Title' },
      };

      const result = await handler.execute('update', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should return error if target symbols do not have T_ prefix', async () => {
      const payload: DashboardRequestPayload = {
        action: 'update',
        params: {
          id: 'article-123',
          target_symbols: ['AAPL'],
        },
      };

      const result = await handler.execute('update', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_SYMBOLS');
      expect(result.error?.message).toContain('T_ prefix');
    });

    it('should update article successfully', async () => {
      const updatedArticle = { ...mockArticle, title: 'Updated Title' };
      (mockRepository.update as jest.Mock).mockResolvedValue(updatedArticle);

      const payload: DashboardRequestPayload = {
        action: 'update',
        params: {
          id: 'article-123',
          title: 'Updated Title',
        },
      };

      const result = await handler.execute('update', payload, mockContext);

      expect(result.success).toBe(true);
      expect(mockRepository.update).toHaveBeenCalledWith('article-123', {
        title: 'Updated Title',
      });
    });

    it('should update multiple fields', async () => {
      (mockRepository.update as jest.Mock).mockResolvedValue(mockArticle);

      const payload: DashboardRequestPayload = {
        action: 'update',
        params: {
          id: 'article-123',
          title: 'Updated Title',
          content: 'Updated content',
          sentiment_expected: 'negative',
          strength_expected: 0.5,
        },
      };

      const result = await handler.execute('update', payload, mockContext);

      expect(result.success).toBe(true);
      expect(mockRepository.update).toHaveBeenCalledWith('article-123', {
        title: 'Updated Title',
        content: 'Updated content',
        sentiment_expected: 'negative',
        strength_expected: 0.5,
      });
    });

    it('should handle update service error', async () => {
      (mockRepository.update as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'update',
        params: {
          id: 'article-123',
          title: 'Updated Title',
        },
      };

      const result = await handler.execute('update', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UPDATE_FAILED');
      expect(result.error?.message).toContain('Database error');
    });
  });

  describe('delete action', () => {
    it('should return error if id is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'delete',
        params: {},
      };

      const result = await handler.execute('delete', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should delete article successfully', async () => {
      (mockRepository.delete as jest.Mock).mockResolvedValue(undefined);

      const payload: DashboardRequestPayload = {
        action: 'delete',
        params: { id: 'article-123' },
      };

      const result = await handler.execute('delete', payload, mockContext);

      expect(result.success).toBe(true);
      expect(mockRepository.delete).toHaveBeenCalledWith('article-123');
      const data = result.data as { deleted: boolean; id: string };
      expect(data.deleted).toBe(true);
      expect(data.id).toBe('article-123');
    });

    it('should handle delete service error', async () => {
      (mockRepository.delete as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'delete',
        params: { id: 'article-123' },
      };

      const result = await handler.execute('delete', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DELETE_FAILED');
      expect(result.error?.message).toContain('Database error');
    });
  });

  describe('bulk-create action', () => {
    it('should return error if articles array is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'bulk-create',
        params: {},
      };

      const result = await handler.execute('bulk-create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
      expect(result.error?.message).toContain('articles array');
    });

    it('should return error if articles is not an array', async () => {
      const payload: DashboardRequestPayload = {
        action: 'bulk-create',
        params: {
          articles: 'not-an-array',
        },
      };

      const result = await handler.execute('bulk-create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
    });

    it('should return error if article is missing required fields', async () => {
      const payload: DashboardRequestPayload = {
        action: 'bulk-create',
        params: {
          articles: [
            {
              title: 'Test Title',
              // missing content and published_at
            },
          ],
        },
      };

      const result = await handler.execute('bulk-create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
      expect(result.error?.message).toContain('index 0');
    });

    it('should return error if article has invalid symbols', async () => {
      const payload: DashboardRequestPayload = {
        action: 'bulk-create',
        params: {
          articles: [
            {
              title: 'Test Title',
              content: 'Test content',
              published_at: '2024-01-15T00:00:00Z',
              target_symbols: ['AAPL'],
            },
          ],
        },
      };

      const result = await handler.execute('bulk-create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_SYMBOLS');
      expect(result.error?.message).toContain('index 0');
    });

    it('should bulk create articles successfully', async () => {
      const articles = [mockArticle, { ...mockArticle, id: 'article-456' }];
      (mockRepository.bulkCreate as jest.Mock).mockResolvedValue(articles);

      const payload: DashboardRequestPayload = {
        action: 'bulk-create',
        params: {
          articles: [
            {
              title: 'Test Title 1',
              content: 'Test content 1',
              published_at: '2024-01-15T00:00:00Z',
            },
            {
              title: 'Test Title 2',
              content: 'Test content 2',
              published_at: '2024-01-15T00:00:00Z',
            },
          ],
        },
      };

      const result = await handler.execute('bulk-create', payload, mockContext);

      expect(result.success).toBe(true);
      expect(mockRepository.bulkCreate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Test Title 1' }),
          expect.objectContaining({ title: 'Test Title 2' }),
        ]),
      );
      const data = result.data as {
        created_count: number;
        articles: TestArticle[];
      };
      expect(data.created_count).toBe(2);
      expect(data.articles).toHaveLength(2);
    });

    it('should handle bulk create service error', async () => {
      (mockRepository.bulkCreate as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'bulk-create',
        params: {
          articles: [
            {
              title: 'Test Title',
              content: 'Test content',
              published_at: '2024-01-15T00:00:00Z',
            },
          ],
        },
      };

      const result = await handler.execute('bulk-create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('BULK_CREATE_FAILED');
      expect(result.error?.message).toContain('Database error');
    });
  });

  describe('bulk-create action - case insensitivity', () => {
    it('should handle bulkcreate (no hyphen)', async () => {
      const articles = [mockArticle];
      (mockRepository.bulkCreate as jest.Mock).mockResolvedValue(articles);

      const payload: DashboardRequestPayload = {
        action: 'bulkcreate',
        params: {
          articles: [
            {
              title: 'Test Title',
              content: 'Test content',
              published_at: '2024-01-15T00:00:00Z',
            },
          ],
        },
      };

      const result = await handler.execute('bulkcreate', payload, mockContext);

      expect(result.success).toBe(true);
      expect(mockRepository.bulkCreate).toHaveBeenCalled();
    });
  });

  describe('mark-processed action', () => {
    it('should return error if id is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'mark-processed',
        params: {},
      };

      const result = await handler.execute(
        'mark-processed',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should mark article as processed', async () => {
      const processedArticle = { ...mockArticle, processed: true };
      (mockRepository.markProcessed as jest.Mock).mockResolvedValue(
        processedArticle,
      );

      const payload: DashboardRequestPayload = {
        action: 'mark-processed',
        params: { id: 'article-123' },
      };

      const result = await handler.execute(
        'mark-processed',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(mockRepository.markProcessed).toHaveBeenCalledWith('article-123');
      const data = result.data as TestArticle;
      expect(data.processed).toBe(true);
    });

    it('should handle mark-processed service error', async () => {
      (mockRepository.markProcessed as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'mark-processed',
        params: { id: 'article-123' },
      };

      const result = await handler.execute(
        'mark-processed',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MARK_PROCESSED_FAILED');
      expect(result.error?.message).toContain('Database error');
    });
  });

  describe('mark-processed action - case insensitivity', () => {
    it('should handle markprocessed (no hyphen)', async () => {
      const processedArticle = { ...mockArticle, processed: true };
      (mockRepository.markProcessed as jest.Mock).mockResolvedValue(
        processedArticle,
      );

      const payload: DashboardRequestPayload = {
        action: 'markprocessed',
        params: { id: 'article-123' },
      };

      const result = await handler.execute(
        'markprocessed',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(mockRepository.markProcessed).toHaveBeenCalled();
    });
  });

  describe('list-unprocessed action', () => {
    it('should list unprocessed articles without scenario filter', async () => {
      (mockRepository.findUnprocessed as jest.Mock).mockResolvedValue([
        mockArticle,
      ]);

      const payload: DashboardRequestPayload = {
        action: 'list-unprocessed',
        params: {},
      };

      const result = await handler.execute(
        'list-unprocessed',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(mockRepository.findUnprocessed).toHaveBeenCalledWith(undefined);
      expect(result.data).toHaveLength(1);
    });

    it('should list unprocessed articles with scenario filter', async () => {
      (mockRepository.findUnprocessed as jest.Mock).mockResolvedValue([
        mockArticle,
      ]);

      const payload: DashboardRequestPayload = {
        action: 'list-unprocessed',
        params: {
          filters: { scenarioId: 'scenario-123' },
        },
      };

      const result = await handler.execute(
        'list-unprocessed',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(mockRepository.findUnprocessed).toHaveBeenCalledWith(
        'scenario-123',
      );
    });

    it('should paginate unprocessed articles', async () => {
      const articles = Array.from({ length: 25 }, (_, i) => ({
        ...mockArticle,
        id: `article-${i}`,
      }));
      (mockRepository.findUnprocessed as jest.Mock).mockResolvedValue(articles);

      const payload: DashboardRequestPayload = {
        action: 'list-unprocessed',
        params: { page: 2, pageSize: 10 },
      };

      const result = await handler.execute(
        'list-unprocessed',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as TestArticle[];
      expect(data).toHaveLength(10);
      expect(result.metadata?.page).toBe(2);
      expect(result.metadata?.pageSize).toBe(10);
      expect(result.metadata?.totalCount).toBe(25);
    });

    it('should handle list-unprocessed service error', async () => {
      (mockRepository.findUnprocessed as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'list-unprocessed',
        params: {},
      };

      const result = await handler.execute(
        'list-unprocessed',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LIST_UNPROCESSED_FAILED');
      expect(result.error?.message).toContain('Database error');
    });
  });

  describe('list-unprocessed action - case insensitivity', () => {
    it('should handle listunprocessed (no hyphen)', async () => {
      (mockRepository.findUnprocessed as jest.Mock).mockResolvedValue([]);

      const payload: DashboardRequestPayload = {
        action: 'listunprocessed',
        params: {},
      };

      const result = await handler.execute(
        'listunprocessed',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(mockRepository.findUnprocessed).toHaveBeenCalled();
    });
  });

  describe('generate action', () => {
    const mockGenerationRequest: TestArticleGenerationRequest = {
      target_symbols: ['T_AAPL'],
      scenario_type: 'earnings_beat',
      sentiment: 'bullish',
      strength: 'strong',
    };

    const mockGenerationResult: TestArticleGenerationResult = {
      success: true,
      articles: [
        {
          title: 'Apple Crushes Earnings Expectations',
          content: 'Apple Inc. reported quarterly earnings...',
          target_symbols: ['T_AAPL'],
          intended_sentiment: 'bullish',
          intended_strength: 'strong',
          simulated_published_at: '2024-01-15T00:00:00Z',
          simulated_source_name: 'Tech News Daily',
        },
      ],
      generation_metadata: {
        model_used: 'claude-sonnet-4',
        tokens_used: 500,
        generation_time_ms: 1000,
      },
    };

    it('should return error if target_symbols is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'generate',
        params: {
          scenario_type: 'earnings_beat',
          sentiment: 'bullish',
          strength: 'strong',
        },
      };

      const result = await handler.execute('generate', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_REQUEST');
      expect(result.error?.message).toContain('target_symbols');
    });

    it('should return error if target_symbols is empty', async () => {
      const payload: DashboardRequestPayload = {
        action: 'generate',
        params: {
          target_symbols: [],
          scenario_type: 'earnings_beat',
          sentiment: 'bullish',
          strength: 'strong',
        },
      };

      const result = await handler.execute('generate', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_REQUEST');
    });

    it('should return error if target symbols do not have T_ prefix', async () => {
      const payload: DashboardRequestPayload = {
        action: 'generate',
        params: {
          target_symbols: ['AAPL', 'MSFT'],
          scenario_type: 'earnings_beat',
          sentiment: 'bullish',
          strength: 'strong',
        },
      };

      const result = await handler.execute('generate', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_SYMBOLS');
      expect(result.error?.message).toContain('T_ prefix');
      expect(result.error?.message).toContain('INV-08');
    });

    it('should return error if scenario_type is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'generate',
        params: {
          target_symbols: ['T_AAPL'],
          sentiment: 'bullish',
          strength: 'strong',
        },
      };

      const result = await handler.execute('generate', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_REQUEST');
      expect(result.error?.message).toContain('scenario_type');
    });

    it('should return error if sentiment is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'generate',
        params: {
          target_symbols: ['T_AAPL'],
          scenario_type: 'earnings_beat',
          strength: 'strong',
        },
      };

      const result = await handler.execute('generate', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_REQUEST');
      expect(result.error?.message).toContain('sentiment');
    });

    it('should return error if strength is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'generate',
        params: {
          target_symbols: ['T_AAPL'],
          scenario_type: 'earnings_beat',
          sentiment: 'bullish',
        },
      };

      const result = await handler.execute('generate', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_REQUEST');
      expect(result.error?.message).toContain('strength');
    });

    it('should generate articles successfully', async () => {
      (mockAiGeneratorService.generateArticles as jest.Mock).mockResolvedValue(
        mockGenerationResult,
      );
      (mockRepository.bulkCreate as jest.Mock).mockResolvedValue([mockArticle]);

      const payload: DashboardRequestPayload = {
        action: 'generate',
        params: mockGenerationRequest as any,
      };

      const result = await handler.execute('generate', payload, mockContext);

      expect(result.success).toBe(true);
      expect(mockAiGeneratorService.generateArticles).toHaveBeenCalledWith(
        mockGenerationRequest,
        mockContext,
      );
      expect(mockRepository.bulkCreate).toHaveBeenCalled();
      const data = result.data as {
        articles: TestArticle[];
        generation_metadata: Record<string, unknown>;
        created_count: number;
      };
      expect(data.created_count).toBe(1);
      expect(data.generation_metadata).toBeDefined();
    });

    it('should return error if AI generation fails', async () => {
      const failedResult = {
        ...mockGenerationResult,
        success: false,
        articles: [],
        errors: ['Generation failed'],
      };
      (mockAiGeneratorService.generateArticles as jest.Mock).mockResolvedValue(
        failedResult,
      );

      const payload: DashboardRequestPayload = {
        action: 'generate',
        params: mockGenerationRequest as any,
      };

      const result = await handler.execute('generate', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GENERATION_FAILED');
      expect(result.error?.details?.errors).toEqual(['Generation failed']);
    });

    it('should handle generate service error', async () => {
      (mockAiGeneratorService.generateArticles as jest.Mock).mockRejectedValue(
        new Error('AI service error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'generate',
        params: mockGenerationRequest as any,
      };

      const result = await handler.execute('generate', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GENERATION_FAILED');
      expect(result.error?.message).toContain('AI service error');
    });

    it('should map sentiment correctly (bullish to positive)', async () => {
      (mockAiGeneratorService.generateArticles as jest.Mock).mockResolvedValue(
        mockGenerationResult,
      );
      (mockRepository.bulkCreate as jest.Mock).mockResolvedValue([mockArticle]);

      const payload: DashboardRequestPayload = {
        action: 'generate',
        params: mockGenerationRequest as any,
      };

      await handler.execute('generate', payload, mockContext);

      expect(mockRepository.bulkCreate).toHaveBeenCalledWith([
        expect.objectContaining({
          sentiment_expected: 'positive',
        }),
      ]);
    });

    it('should map sentiment correctly (bearish to negative)', async () => {
      const bearishResult = {
        ...mockGenerationResult,
        articles: [
          {
            ...mockGenerationResult.articles[0]!,
            intended_sentiment: 'bearish',
          },
        ],
      };
      (mockAiGeneratorService.generateArticles as jest.Mock).mockResolvedValue(
        bearishResult,
      );
      (mockRepository.bulkCreate as jest.Mock).mockResolvedValue([mockArticle]);

      const payload: DashboardRequestPayload = {
        action: 'generate',
        params: {
          ...mockGenerationRequest,
          sentiment: 'bearish',
        } as any,
      };

      await handler.execute('generate', payload, mockContext);

      expect(mockRepository.bulkCreate).toHaveBeenCalledWith([
        expect.objectContaining({
          sentiment_expected: 'negative',
        }),
      ]);
    });

    it('should map strength correctly (strong to 0.8)', async () => {
      (mockAiGeneratorService.generateArticles as jest.Mock).mockResolvedValue(
        mockGenerationResult,
      );
      (mockRepository.bulkCreate as jest.Mock).mockResolvedValue([mockArticle]);

      const payload: DashboardRequestPayload = {
        action: 'generate',
        params: mockGenerationRequest as any,
      };

      await handler.execute('generate', payload, mockContext);

      expect(mockRepository.bulkCreate).toHaveBeenCalledWith([
        expect.objectContaining({
          strength_expected: 0.8,
        }),
      ]);
    });

    it('should map strength correctly (moderate to 0.5)', async () => {
      const moderateResult = {
        ...mockGenerationResult,
        articles: [
          {
            ...mockGenerationResult.articles[0]!,
            intended_strength: 'moderate',
          },
        ],
      };
      (mockAiGeneratorService.generateArticles as jest.Mock).mockResolvedValue(
        moderateResult,
      );
      (mockRepository.bulkCreate as jest.Mock).mockResolvedValue([mockArticle]);

      const payload: DashboardRequestPayload = {
        action: 'generate',
        params: {
          ...mockGenerationRequest,
          strength: 'moderate',
        } as any,
      };

      await handler.execute('generate', payload, mockContext);

      expect(mockRepository.bulkCreate).toHaveBeenCalledWith([
        expect.objectContaining({
          strength_expected: 0.5,
        }),
      ]);
    });

    it('should map strength correctly (weak to 0.2)', async () => {
      const weakResult = {
        ...mockGenerationResult,
        articles: [
          {
            ...mockGenerationResult.articles[0]!,
            intended_strength: 'weak',
          },
        ],
      };
      (mockAiGeneratorService.generateArticles as jest.Mock).mockResolvedValue(
        weakResult,
      );
      (mockRepository.bulkCreate as jest.Mock).mockResolvedValue([mockArticle]);

      const payload: DashboardRequestPayload = {
        action: 'generate',
        params: {
          ...mockGenerationRequest,
          strength: 'weak',
        } as any,
      };

      await handler.execute('generate', payload, mockContext);

      expect(mockRepository.bulkCreate).toHaveBeenCalledWith([
        expect.objectContaining({
          strength_expected: 0.2,
        }),
      ]);
    });

    it('should include AI metadata in created articles', async () => {
      (mockAiGeneratorService.generateArticles as jest.Mock).mockResolvedValue(
        mockGenerationResult,
      );
      (mockRepository.bulkCreate as jest.Mock).mockResolvedValue([mockArticle]);

      const payload: DashboardRequestPayload = {
        action: 'generate',
        params: mockGenerationRequest as any,
      };

      await handler.execute('generate', payload, mockContext);

      expect(mockRepository.bulkCreate).toHaveBeenCalledWith([
        expect.objectContaining({
          metadata: expect.objectContaining({
            ai_generated: true,
            model_used: 'claude-sonnet-4',
            scenario_type: 'earnings_beat',
          }),
        }),
      ]);
    });
  });

  describe('case insensitivity', () => {
    it('should handle uppercase action names', async () => {
      (mockRepository.findByOrganization as jest.Mock).mockResolvedValue([]);

      const payload: DashboardRequestPayload = {
        action: 'LIST',
        params: {},
      };

      const result = await handler.execute('LIST', payload, mockContext);

      expect(result.success).toBe(true);
    });

    it('should handle mixed case action names', async () => {
      (mockRepository.findByOrganization as jest.Mock).mockResolvedValue([]);

      const payload: DashboardRequestPayload = {
        action: 'LiSt',
        params: {},
      };

      const result = await handler.execute('LiSt', payload, mockContext);

      expect(result.success).toBe(true);
    });
  });
});
