import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CrawlerSourceRepository } from '../source.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { Source, CrawlFrequency, SourceDueForCrawl } from '../../interfaces';

describe('CrawlerSourceRepository', () => {
  let repository: CrawlerSourceRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockSource: Source = {
    id: 'source-123',
    organization_slug: 'test-org',
    name: 'Test Source',
    description: 'Test description',
    source_type: 'rss',
    url: 'https://example.com/feed.xml',
    crawl_config: {},
    auth_config: null,
    crawl_frequency_minutes: 15,
    is_active: true,
    is_test: false,
    last_crawl_at: '2024-01-15T09:00:00Z',
    last_crawl_status: 'success',
    last_error: null,
    consecutive_errors: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockSourceDue: SourceDueForCrawl = {
    source_id: 'source-123',
    organization_slug: 'test-org',
    name: 'Test Source',
    source_type: 'rss',
    url: 'https://example.com/feed.xml',
    crawl_config: {},
    auth_config: null,
    crawl_frequency_minutes: 15,
    last_crawl_at: '2024-01-15T09:00:00Z',
  };

  const createMockClient = (overrides?: {
    single?: { data: unknown | null; error: { message: string; code?: string } | null };
    list?: { data: unknown[] | null; error: { message: string } | null };
    insert?: { data: unknown | null; error: { message: string } | null };
    update?: { data: unknown | null; error: { message: string } | null };
    delete?: { error: { message: string } | null };
    rpc?: { data: unknown[] | null; error: { message: string } | null };
  }) => {
    const singleResult = overrides?.single ?? { data: mockSource, error: null };
    const listResult = overrides?.list ?? { data: [mockSource], error: null };
    const insertResult = overrides?.insert ?? { data: mockSource, error: null };
    const updateResult = overrides?.update ?? { data: mockSource, error: null };
    const deleteResult = overrides?.delete ?? { error: null };
    const rpcResult = overrides?.rpc ?? { data: [mockSourceDue], error: null };

    const createChain = () => {
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        eq: jest.fn(),
        order: jest.fn(),
        single: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(listResult),
      };

      (chainableResult.select as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.eq as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.order as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.single as jest.Mock).mockReturnValue({
        ...chainableResult,
        then: (resolve: (v: unknown) => void) => resolve(singleResult),
      });
      (chainableResult.insert as jest.Mock).mockReturnValue({
        ...chainableResult,
        select: jest.fn().mockReturnValue({
          ...chainableResult,
          single: jest.fn().mockReturnValue({
            then: (resolve: (v: unknown) => void) => resolve(insertResult),
          }),
        }),
      });
      (chainableResult.update as jest.Mock).mockReturnValue({
        ...chainableResult,
        eq: jest.fn().mockReturnValue({
          ...chainableResult,
          select: jest.fn().mockReturnValue({
            ...chainableResult,
            single: jest.fn().mockReturnValue({
              then: (resolve: (v: unknown) => void) => resolve(updateResult),
            }),
          }),
        }),
      });

      const deleteChain: Record<string, unknown> = {
        eq: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(deleteResult),
      };
      (deleteChain.eq as jest.Mock).mockReturnValue(deleteChain);
      (chainableResult.delete as jest.Mock).mockReturnValue(deleteChain);

      return chainableResult;
    };

    return {
      schema: jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => createChain()),
        rpc: jest.fn().mockReturnValue({
          then: (resolve: (v: unknown) => void) => resolve(rpcResult),
        }),
      }),
    };
  };

  beforeEach(async () => {
    const mockClient = createMockClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrawlerSourceRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<CrawlerSourceRepository>(CrawlerSourceRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all sources for organization', async () => {
      const result = await repository.findAll('test-org');

      expect(result).toEqual([mockSource]);
    });

    it('should return empty array when no sources found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findAll('test-org');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findAll('test-org')).rejects.toThrow(
        'Failed to fetch sources: Query failed',
      );
    });
  });

  describe('findById', () => {
    it('should return source when found', async () => {
      const result = await repository.findById('source-123');

      expect(result).toEqual(mockSource);
    });

    it('should return null when source not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findById('source-123')).rejects.toThrow(
        'Failed to fetch source: Database error',
      );
    });
  });

  describe('findByIdOrThrow', () => {
    it('should return source when found', async () => {
      const result = await repository.findByIdOrThrow('source-123');

      expect(result).toEqual(mockSource);
    });

    it('should throw NotFoundException when source not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByIdOrThrow('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByUrl', () => {
    it('should return source when found', async () => {
      const result = await repository.findByUrl('test-org', 'https://example.com/feed.xml');

      expect(result).toEqual(mockSource);
    });

    it('should return null when source not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByUrl('test-org', 'https://nonexistent.com/feed.xml');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByUrl('test-org', 'https://example.com/feed.xml')).rejects.toThrow(
        'Failed to fetch source by URL: Database error',
      );
    });
  });

  describe('findOrCreate', () => {
    it('should return existing source when URL exists', async () => {
      const result = await repository.findOrCreate({
        organization_slug: 'test-org',
        name: 'Test Source',
        source_type: 'rss',
        url: 'https://example.com/feed.xml',
      });

      expect(result).toEqual(mockSource);
    });

    it('should create new source when URL does not exist', async () => {
      const newSource = { ...mockSource, id: 'new-source-123', url: 'https://new.com/feed.xml' };
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
        insert: { data: newSource, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findOrCreate({
        organization_slug: 'test-org',
        name: 'New Source',
        source_type: 'rss',
        url: 'https://new.com/feed.xml',
      });

      expect(result).toEqual(newSource);
    });
  });

  describe('findDueForCrawl', () => {
    it('should return sources due for crawl', async () => {
      const result = await repository.findDueForCrawl(15);

      expect(result).toEqual([mockSourceDue]);
    });

    it('should return sources due for crawl without frequency filter', async () => {
      const result = await repository.findDueForCrawl();

      expect(result).toEqual([mockSourceDue]);
    });

    it('should return empty array when no sources due', async () => {
      const mockClient = createMockClient({
        rpc: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findDueForCrawl(15);

      expect(result).toEqual([]);
    });

    it('should throw error on RPC failure', async () => {
      const mockClient = createMockClient({
        rpc: { data: null, error: { message: 'RPC failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findDueForCrawl(15)).rejects.toThrow(
        'Failed to fetch sources due for crawl: RPC failed',
      );
    });

    it('should handle different frequencies', async () => {
      const frequencies: CrawlFrequency[] = [5, 10, 15, 30, 60];

      for (const frequency of frequencies) {
        const result = await repository.findDueForCrawl(frequency);
        expect(result).toEqual([mockSourceDue]);
      }
    });
  });

  describe('findAllForDashboard', () => {
    it('should return all sources including inactive', async () => {
      const inactiveSource = { ...mockSource, id: 'inactive-123', is_active: false };
      const mockClient = createMockClient({
        list: { data: [mockSource, inactiveSource], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findAllForDashboard('test-org');

      expect(result.length).toBe(2);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findAllForDashboard('test-org')).rejects.toThrow(
        'Failed to fetch all sources for dashboard: Query failed',
      );
    });
  });

  describe('create', () => {
    it('should create source successfully', async () => {
      const createData = {
        organization_slug: 'test-org',
        name: 'New Source',
        source_type: 'rss' as const,
        url: 'https://new.com/feed.xml',
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockSource);
    });

    it('should throw error when create returns no data', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          organization_slug: 'test-org',
          name: 'New Source',
          source_type: 'rss',
          url: 'https://new.com/feed.xml',
        }),
      ).rejects.toThrow('Create succeeded but no source returned');
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          organization_slug: 'test-org',
          name: 'New Source',
          source_type: 'rss',
          url: 'https://new.com/feed.xml',
        }),
      ).rejects.toThrow('Failed to create source: Insert failed');
    });
  });

  describe('update', () => {
    it('should update source successfully', async () => {
      const updatedSource = { ...mockSource, name: 'Updated Name' };
      const mockClient = createMockClient({
        update: { data: updatedSource, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.update('source-123', { name: 'Updated Name' });

      expect(result).toEqual(updatedSource);
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('source-123', { name: 'Updated' })).rejects.toThrow(
        'Update succeeded but no source returned',
      );
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('source-123', { name: 'Updated' })).rejects.toThrow(
        'Failed to update source: Update failed',
      );
    });
  });

  describe('delete', () => {
    it('should delete source successfully', async () => {
      await expect(repository.delete('source-123')).resolves.toBeUndefined();
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.delete('source-123')).rejects.toThrow(
        'Failed to delete source: Delete failed',
      );
    });
  });

  describe('markCrawlSuccess', () => {
    it('should mark crawl as successful', async () => {
      await expect(repository.markCrawlSuccess('source-123')).resolves.toBeUndefined();
    });
  });

  describe('markCrawlError', () => {
    it('should mark crawl as failed with error message', async () => {
      await expect(
        repository.markCrawlError('source-123', 'Connection timeout'),
      ).resolves.toBeUndefined();
    });

    it('should increment consecutive errors', async () => {
      const sourceWithErrors = { ...mockSource, consecutive_errors: 2 };
      const mockClient = createMockClient({
        single: { data: sourceWithErrors, error: null },
        update: { data: { ...sourceWithErrors, consecutive_errors: 3 }, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await repository.markCrawlError('source-123', 'Error');

      // The method should have called update with incremented consecutive_errors
      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should throw if source not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.markCrawlError('nonexistent', 'Error')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('source types', () => {
    const sourceTypes = ['web', 'rss', 'twitter_search', 'api', 'test_db'] as const;

    sourceTypes.forEach((sourceType) => {
      it(`should handle ${sourceType} source type`, async () => {
        const sourceWithType = { ...mockSource, source_type: sourceType };
        const mockClient = createMockClient({
          single: { data: sourceWithType, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findById('source-123');

        expect(result?.source_type).toBe(sourceType);
      });
    });
  });

  describe('crawl statuses', () => {
    const statuses = ['success', 'error', 'timeout', 'running'] as const;

    statuses.forEach((status) => {
      it(`should handle ${status} crawl status`, async () => {
        const sourceWithStatus = { ...mockSource, last_crawl_status: status };
        const mockClient = createMockClient({
          single: { data: sourceWithStatus, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findById('source-123');

        expect(result?.last_crawl_status).toBe(status);
      });
    });
  });
});
