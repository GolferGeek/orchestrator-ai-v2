import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { RagDatabaseService } from './rag-database.service';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let ragDb: jest.Mocked<RagDatabaseService>;

  const mockDbDocument = {
    id: 'doc-123',
    collection_id: 'col-456',
    filename: 'test.pdf',
    file_type: 'pdf',
    file_size: 1024,
    file_hash: 'abc123',
    storage_path: '/storage/test.pdf',
    content: 'Test content',
    status: 'completed',
    error_message: null,
    chunk_count: 5,
    token_count: 100,
    metadata: { source: 'upload' },
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-02'),
    processed_at: new Date('2024-01-02'),
  };

  const mockDbChunk = {
    id: 'chunk-1',
    content: 'Chunk content',
    chunk_index: 0,
    token_count: 20,
    page_number: 1,
    metadata: { position: 'start' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: RagDatabaseService,
          useValue: {
            queryAll: jest.fn(),
            queryOne: jest.fn(),
            execute: jest.fn(),
          },
        },
      ],
    }).compile();

    module.useLogger(false);

    service = module.get<DocumentsService>(DocumentsService);
    ragDb = module.get(RagDatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDocuments', () => {
    it('should return documents for a collection', async () => {
      ragDb.queryAll.mockResolvedValue([mockDbDocument]);

      const result = await service.getDocuments('col-456', 'test-org');

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('doc-123');
      expect(result[0]!.collectionId).toBe('col-456');
      expect(result[0]!.filename).toBe('test.pdf');
      expect(ragDb.queryAll).toHaveBeenCalledWith(
        'SELECT * FROM rag_get_documents($1, $2)',
        ['col-456', 'test-org'],
      );
    });

    it('should return empty array when no documents', async () => {
      ragDb.queryAll.mockResolvedValue([]);

      const result = await service.getDocuments('col-empty', 'test-org');

      expect(result).toHaveLength(0);
    });

    it('should correctly transform snake_case to camelCase', async () => {
      ragDb.queryAll.mockResolvedValue([mockDbDocument]);

      const result = await service.getDocuments('col-456', 'test-org');

      expect(result[0]).toHaveProperty('collectionId');
      expect(result[0]).toHaveProperty('fileType');
      expect(result[0]).toHaveProperty('fileSize');
      expect(result[0]).toHaveProperty('fileHash');
      expect(result[0]).toHaveProperty('storagePath');
      expect(result[0]).toHaveProperty('errorMessage');
      expect(result[0]).toHaveProperty('chunkCount');
      expect(result[0]).toHaveProperty('tokenCount');
      expect(result[0]).toHaveProperty('createdAt');
      expect(result[0]).toHaveProperty('updatedAt');
      expect(result[0]).toHaveProperty('processedAt');
    });
  });

  describe('getDocument', () => {
    it('should return a single document', async () => {
      ragDb.queryOne.mockResolvedValue(mockDbDocument);

      const result = await service.getDocument('doc-123', 'test-org');

      expect(result.id).toBe('doc-123');
      expect(ragDb.queryOne).toHaveBeenCalledWith(
        'SELECT * FROM rag_get_document($1, $2)',
        ['doc-123', 'test-org'],
      );
    });

    it('should throw NotFoundException when document not found', async () => {
      ragDb.queryOne.mockResolvedValue(null);

      await expect(
        service.getDocument('non-existent', 'test-org'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createDocument', () => {
    it('should create a new document', async () => {
      ragDb.queryOne.mockResolvedValue(mockDbDocument);

      const result = await service.createDocument(
        'col-456',
        'test-org',
        'new.pdf',
        'pdf',
        2048,
        'hash123',
        '/storage/new.pdf',
        'user-123',
        'Initial content',
      );

      expect(result.filename).toBe('test.pdf');
      expect(ragDb.queryOne).toHaveBeenCalledWith(
        'SELECT * FROM rag_insert_document($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [
          'col-456',
          'test-org',
          'new.pdf',
          'pdf',
          2048,
          'hash123',
          '/storage/new.pdf',
          'user-123',
          'Initial content',
        ],
      );
    });

    it('should create document with optional params as null', async () => {
      ragDb.queryOne.mockResolvedValue(mockDbDocument);

      await service.createDocument(
        'col-456',
        'test-org',
        'new.pdf',
        'pdf',
        2048,
      );

      expect(ragDb.queryOne).toHaveBeenCalledWith(
        'SELECT * FROM rag_insert_document($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        ['col-456', 'test-org', 'new.pdf', 'pdf', 2048, null, null, null, null],
      );
    });

    it('should throw NotFoundException when collection not found', async () => {
      ragDb.queryOne.mockResolvedValue(null);

      await expect(
        service.createDocument(
          'non-existent-col',
          'test-org',
          'new.pdf',
          'pdf',
          2048,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateDocumentContent', () => {
    it('should update document content', async () => {
      ragDb.execute.mockResolvedValue(undefined);

      await service.updateDocumentContent(
        'doc-123',
        'test-org',
        'Updated content',
      );

      expect(ragDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE rag_data.rag_documents'),
        ['Updated content', 'doc-123', 'test-org'],
      );
    });
  });

  describe('getDocumentContent', () => {
    it('should return document content', async () => {
      ragDb.queryOne.mockResolvedValue({
        id: 'doc-123',
        filename: 'test.pdf',
        file_type: 'pdf',
        content: 'Full content',
        chunk_count: 5,
      });

      const result = await service.getDocumentContent('doc-123', 'test-org');

      expect(result).toEqual({
        id: 'doc-123',
        filename: 'test.pdf',
        fileType: 'pdf',
        content: 'Full content',
        chunkCount: 5,
      });
    });

    it('should return null when document not found', async () => {
      ragDb.queryOne.mockResolvedValue(null);

      const result = await service.getDocumentContent(
        'non-existent',
        'test-org',
      );

      expect(result).toBeNull();
    });
  });

  describe('updateDocumentStatus', () => {
    it('should update document status', async () => {
      ragDb.queryOne.mockResolvedValue(mockDbDocument);

      const result = await service.updateDocumentStatus(
        'doc-123',
        'test-org',
        'completed',
      );

      expect(result.id).toBe('doc-123');
      expect(ragDb.queryOne).toHaveBeenCalledWith(
        'SELECT * FROM rag_update_document_status($1, $2, $3, $4, $5, $6)',
        ['doc-123', 'test-org', 'completed', null, null, null],
      );
    });

    it('should update status with error message', async () => {
      ragDb.queryOne.mockResolvedValue({
        ...mockDbDocument,
        status: 'error',
        error_message: 'Processing failed',
      });

      await service.updateDocumentStatus(
        'doc-123',
        'test-org',
        'error',
        'Processing failed',
      );

      expect(ragDb.queryOne).toHaveBeenCalledWith(
        'SELECT * FROM rag_update_document_status($1, $2, $3, $4, $5, $6)',
        ['doc-123', 'test-org', 'error', 'Processing failed', null, null],
      );
    });

    it('should update status with chunk and token counts', async () => {
      ragDb.queryOne.mockResolvedValue(mockDbDocument);

      await service.updateDocumentStatus(
        'doc-123',
        'test-org',
        'completed',
        undefined,
        10,
        200,
      );

      expect(ragDb.queryOne).toHaveBeenCalledWith(
        'SELECT * FROM rag_update_document_status($1, $2, $3, $4, $5, $6)',
        ['doc-123', 'test-org', 'completed', null, 10, 200],
      );
    });

    it('should throw NotFoundException when document not found', async () => {
      ragDb.queryOne.mockResolvedValue(null);

      await expect(
        service.updateDocumentStatus('non-existent', 'test-org', 'completed'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteDocument', () => {
    it('should delete a document', async () => {
      ragDb.queryOne.mockResolvedValue({ rag_delete_document: true });

      const result = await service.deleteDocument('doc-123', 'test-org');

      expect(result).toBe(true);
      expect(ragDb.queryOne).toHaveBeenCalledWith(
        'SELECT rag_delete_document($1, $2)',
        ['doc-123', 'test-org'],
      );
    });

    it('should throw NotFoundException when document not found', async () => {
      ragDb.queryOne.mockResolvedValue({ rag_delete_document: false });

      await expect(
        service.deleteDocument('non-existent', 'test-org'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDocumentChunks', () => {
    it('should return chunks for a document', async () => {
      ragDb.queryAll.mockResolvedValue([
        mockDbChunk,
        { ...mockDbChunk, id: 'chunk-2', chunk_index: 1 },
      ]);

      const result = await service.getDocumentChunks('doc-123', 'test-org');

      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe('chunk-1');
      expect(result[0]!.content).toBe('Chunk content');
      expect(result[0]!.chunkIndex).toBe(0);
      expect(result[0]!.tokenCount).toBe(20);
      expect(result[0]!.pageNumber).toBe(1);
    });

    it('should return empty array when no chunks', async () => {
      ragDb.queryAll.mockResolvedValue([]);

      const result = await service.getDocumentChunks('doc-empty', 'test-org');

      expect(result).toHaveLength(0);
    });
  });

  describe('insertChunks', () => {
    it('should insert chunks for a document', async () => {
      ragDb.queryOne.mockResolvedValue({ rag_insert_chunks: 3 });

      const chunks = [
        {
          content: 'Chunk 1',
          chunkIndex: 0,
          embedding: [0.1, 0.2, 0.3],
          tokenCount: 10,
          pageNumber: 1,
          charOffset: 0,
          metadata: {},
        },
        {
          content: 'Chunk 2',
          chunkIndex: 1,
          embedding: [0.4, 0.5, 0.6],
          tokenCount: 15,
          pageNumber: 1,
          charOffset: 100,
          metadata: {},
        },
        {
          content: 'Chunk 3',
          chunkIndex: 2,
          tokenCount: 12,
        },
      ];

      const result = await service.insertChunks('doc-123', 'test-org', chunks);

      expect(result).toBe(3);
      expect(ragDb.queryOne).toHaveBeenCalledWith(
        'SELECT rag_insert_chunks($1, $2, $3::jsonb)',
        ['doc-123', 'test-org', expect.any(String)],
      );

      // Verify the JSON structure by parsing the third argument
      const callArgs = ragDb.queryOne.mock.calls[0];
      const jsonArg = callArgs![1]![2] as string;
      const calledJson = JSON.parse(jsonArg);
      expect(calledJson[0]).toHaveProperty('content', 'Chunk 1');
      expect(calledJson[0]).toHaveProperty('chunk_index', 0);
      expect(calledJson[0]).toHaveProperty('embedding', '[0.1,0.2,0.3]');
      expect(calledJson[2]).toHaveProperty('embedding', null);
    });

    it('should return 0 when no chunks inserted', async () => {
      ragDb.queryOne.mockResolvedValue(null);

      const result = await service.insertChunks('doc-123', 'test-org', []);

      expect(result).toBe(0);
    });

    it('should handle chunks without optional fields', async () => {
      ragDb.queryOne.mockResolvedValue({ rag_insert_chunks: 1 });

      const chunks = [
        {
          content: 'Minimal chunk',
          chunkIndex: 0,
          tokenCount: 5,
        },
      ];

      await service.insertChunks('doc-123', 'test-org', chunks);

      const callArgs = ragDb.queryOne.mock.calls[0];
      const jsonArg = callArgs![1]![2] as string;
      const calledJson = JSON.parse(jsonArg);
      expect(calledJson[0]).toHaveProperty('page_number', null);
      expect(calledJson[0]).toHaveProperty('char_offset', null);
      expect(calledJson[0]).toHaveProperty('embedding', null);
    });
  });
});
