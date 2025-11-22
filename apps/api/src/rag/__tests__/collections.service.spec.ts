import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CollectionsService } from '../collections.service';
import { RagDatabaseService } from '../rag-database.service';

describe('CollectionsService', () => {
  let service: CollectionsService;
  let ragDb: jest.Mocked<RagDatabaseService>;

  const mockCollection = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    organization_slug: 'test-org',
    name: 'Test Collection',
    slug: 'test-collection',
    description: 'A test collection',
    embedding_model: 'nomic-embed-text',
    embedding_dimensions: 768,
    chunk_size: 1000,
    chunk_overlap: 200,
    status: 'active',
    required_role: null,
    document_count: 5,
    chunk_count: 100,
    total_tokens: 50000,
    created_at: new Date(),
    updated_at: new Date(),
    created_by: null,
  };

  beforeEach(async () => {
    const mockRagDb = {
      queryAll: jest.fn(),
      queryOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionsService,
        { provide: RagDatabaseService, useValue: mockRagDb },
      ],
    }).compile();

    service = module.get<CollectionsService>(CollectionsService);
    ragDb = module.get(RagDatabaseService);
  });

  describe('getCollections', () => {
    it('should return collections for an organization', async () => {
      ragDb.queryAll.mockResolvedValue([mockCollection]);

      const result = await service.getCollections('test-org');

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Test Collection');
      expect(result[0]?.organizationSlug).toBe('test-org');
      expect(ragDb.queryAll).toHaveBeenCalledWith(
        'SELECT * FROM rag_get_collections($1)',
        ['test-org'],
      );
    });

    it('should return empty array when no collections exist', async () => {
      ragDb.queryAll.mockResolvedValue([]);

      const result = await service.getCollections('empty-org');

      expect(result).toEqual([]);
    });
  });

  describe('getCollection', () => {
    it('should return a single collection', async () => {
      ragDb.queryOne.mockResolvedValue(mockCollection);

      const result = await service.getCollection(mockCollection.id, 'test-org');

      expect(result.id).toBe(mockCollection.id);
      expect(result.name).toBe('Test Collection');
    });

    it('should throw NotFoundException when collection not found', async () => {
      ragDb.queryOne.mockResolvedValue(null);

      await expect(
        service.getCollection('nonexistent-id', 'test-org'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createCollection', () => {
    it('should create a collection with default settings', async () => {
      ragDb.queryOne.mockResolvedValue(mockCollection);

      const result = await service.createCollection('test-org', {
        name: 'Test Collection',
      });

      expect(result.name).toBe('Test Collection');
      expect(ragDb.queryOne).toHaveBeenCalled();
    });

    it('should generate slug from name', async () => {
      ragDb.queryOne.mockResolvedValue({
        ...mockCollection,
        slug: 'my-new-collection',
      });

      await service.createCollection('test-org', {
        name: 'My New Collection',
      });

      // The service should generate a slug
      const callArgs = ragDb.queryOne.mock.calls[0] as unknown[];
      expect(callArgs?.[1]).toContain('my-new-collection');
    });

    it('should use provided slug', async () => {
      ragDb.queryOne.mockResolvedValue({
        ...mockCollection,
        slug: 'custom-slug',
      });

      await service.createCollection('test-org', {
        name: 'Test Collection',
        slug: 'custom-slug',
      });

      const callArgs = ragDb.queryOne.mock.calls[0] as unknown[];
      expect(callArgs?.[1]).toContain('custom-slug');
    });
  });

  describe('updateCollection', () => {
    it('should update collection name', async () => {
      ragDb.queryOne.mockResolvedValue({
        ...mockCollection,
        name: 'Updated Name',
      });

      const result = await service.updateCollection(
        mockCollection.id,
        'test-org',
        { name: 'Updated Name' },
      );

      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundException when collection not found', async () => {
      ragDb.queryOne.mockResolvedValue(null);

      await expect(
        service.updateCollection('nonexistent-id', 'test-org', {
          name: 'New Name',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteCollection', () => {
    it('should delete collection and return true', async () => {
      ragDb.queryOne.mockResolvedValue({ rag_delete_collection: true });

      const result = await service.deleteCollection(mockCollection.id, 'test-org');

      expect(result).toBe(true);
    });

    it('should throw NotFoundException when collection not found', async () => {
      ragDb.queryOne.mockResolvedValue({ rag_delete_collection: false });

      await expect(
        service.deleteCollection('nonexistent-id', 'test-org'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
