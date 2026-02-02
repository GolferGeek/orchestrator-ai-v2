import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmbeddingService } from './embedding.service';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let _configService: jest.Mocked<ConfigService>;

  const mockEmbedding = Array(768).fill(0.1);

  beforeEach(async () => {
    mockFetch.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'OLLAMA_BASE_URL':
                  return 'http://localhost:11434';
                case 'EMBEDDING_MODEL':
                  return 'nomic-embed-text';
                case 'EMBEDDING_DIMENSIONS':
                  return '768';
                default:
                  return undefined;
              }
            }),
          },
        },
      ],
    }).compile();

    module.useLogger(false);

    service = module.get<EmbeddingService>(EmbeddingService);
    _configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getModel', () => {
    it('should return the configured model name', () => {
      expect(service.getModel()).toBe('nomic-embed-text');
    });
  });

  describe('getDimensions', () => {
    it('should return the configured dimensions', () => {
      expect(service.getDimensions()).toBe(768);
    });
  });

  describe('embed', () => {
    it('should return embedding array for text', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: mockEmbedding }),
      });

      const result = await service.embed('test text');

      expect(result).toEqual(mockEmbedding);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'nomic-embed-text',
            prompt: 'test text',
          }),
        }),
      );
    });

    it('should throw error when API call fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      await expect(service.embed('test text')).rejects.toThrow(
        'Ollama API error: 500 - Internal Server Error',
      );
    });
  });

  describe('embedWithTokenCount', () => {
    it('should return embedding with token count from API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          embedding: mockEmbedding,
          prompt_eval_count: 5,
        }),
      });

      const result = await service.embedWithTokenCount('hello world');

      expect(result.embedding).toEqual(mockEmbedding);
      expect(result.tokenCount).toBe(5);
    });

    it('should estimate token count when API does not provide it', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: mockEmbedding }),
      });

      const result = await service.embedWithTokenCount('hello world test'); // 16 chars

      expect(result.embedding).toEqual(mockEmbedding);
      // Estimated: Math.ceil(16 / 4) = 4
      expect(result.tokenCount).toBe(4);
    });

    it('should throw error for invalid response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: null }),
      });

      await expect(service.embedWithTokenCount('test')).rejects.toThrow(
        'Invalid embedding response from Ollama',
      );
    });

    it('should throw error when embedding is not an array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: 'not an array' }),
      });

      await expect(service.embedWithTokenCount('test')).rejects.toThrow(
        'Invalid embedding response from Ollama',
      );
    });
  });

  describe('embedBatch', () => {
    it('should embed multiple texts', async () => {
      const texts = ['text1', 'text2', 'text3'];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            embedding: mockEmbedding,
            prompt_eval_count: 2,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            embedding: mockEmbedding,
            prompt_eval_count: 2,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            embedding: mockEmbedding,
            prompt_eval_count: 2,
          }),
        });

      const results = await service.embedBatch(texts);

      expect(results).toHaveLength(3);
      expect(results[0]!.embedding).toEqual(mockEmbedding);
      expect(results[0]!.tokenCount).toBe(2);
    });

    it('should handle empty array', async () => {
      const results = await service.embedBatch([]);

      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should process in batches of 10', async () => {
      const texts = Array(15).fill('text');

      // Mock 15 responses
      for (let i = 0; i < 15; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ embedding: mockEmbedding }),
        });
      }

      const results = await service.embedBatch(texts);

      expect(results).toHaveLength(15);
      expect(mockFetch).toHaveBeenCalledTimes(15);
    });

    it('should propagate errors from individual embeddings', async () => {
      const texts = ['text1', 'text2'];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ embedding: mockEmbedding }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Error',
        });

      await expect(service.embedBatch(texts)).rejects.toThrow(
        'Ollama API error',
      );
    });
  });

  describe('checkHealth', () => {
    it('should return ok status when Ollama and model are available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            { name: 'nomic-embed-text:latest' },
            { name: 'llama3:latest' },
          ],
        }),
      });

      const result = await service.checkHealth();

      expect(result.status).toBe('ok');
      expect(result.message).toContain('available');
      expect(result.model).toBe('nomic-embed-text');
    });

    it('should return warning when model is not available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: 'llama3:latest' }],
        }),
      });

      const result = await service.checkHealth();

      expect(result.status).toBe('warning');
      expect(result.message).toContain('not found');
      expect(result.message).toContain('ollama pull');
    });

    it('should return error when Ollama is not available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      const result = await service.checkHealth();

      expect(result.status).toBe('error');
      expect(result.message).toContain('not available');
    });

    it('should return error when connection fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await service.checkHealth();

      expect(result.status).toBe('error');
      expect(result.message).toContain('Cannot connect to Ollama');
      expect(result.message).toContain('Connection refused');
    });

    it('should match model with version suffix', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: 'nomic-embed-text:v1.5' }],
        }),
      });

      const result = await service.checkHealth();

      expect(result.status).toBe('ok');
    });
  });
});
