import { Test, TestingModule } from '@nestjs/testing';
import { SignalFingerprintRepository } from '../signal-fingerprint.repository';
import { SupabaseService } from '@/supabase/supabase.service';

describe('SignalFingerprintRepository', () => {
  let repository: SignalFingerprintRepository;
  let mockSupabaseService: Partial<SupabaseService>;
  let mockClient: {
    schema: jest.Mock;
    from: jest.Mock;
    rpc: jest.Mock;
    insert: jest.Mock;
    select: jest.Mock;
    single: jest.Mock;
    eq: jest.Mock;
    gte: jest.Mock;
    lt: jest.Mock;
    overlaps: jest.Mock;
    order: jest.Mock;
    limit: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    // Create chainable mock client
    mockClient = {
      schema: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      rpc: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      overlaps: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
    };

    mockSupabaseService = {
      getServiceClient: jest.fn().mockReturnValue(mockClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignalFingerprintRepository,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    repository = module.get<SignalFingerprintRepository>(
      SignalFingerprintRepository,
    );
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('create', () => {
    it('should create a fingerprint record', async () => {
      const fingerprintData = {
        signal_id: 'signal-123',
        target_id: 'target-456',
        title_normalized: 'apple stock rises',
        key_phrases: ['apple stock', 'stock rises'],
        fingerprint_hash: 'hash-789',
      };

      const expectedResult = {
        id: 'fp-001',
        ...fingerprintData,
        created_at: '2024-01-01T00:00:00Z',
      };

      mockClient.single.mockResolvedValue({
        data: expectedResult,
        error: null,
      });

      const result = await repository.create(fingerprintData);

      expect(result).toEqual(expectedResult);
      expect(mockClient.schema).toHaveBeenCalledWith('prediction');
      expect(mockClient.from).toHaveBeenCalledWith('signal_fingerprints');
      expect(mockClient.insert).toHaveBeenCalledWith(fingerprintData);
    });

    it('should throw error on create failure', async () => {
      mockClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Insert failed' },
      });

      await expect(
        repository.create({
          signal_id: 'signal-123',
          target_id: 'target-456',
          title_normalized: 'test',
          key_phrases: [],
          fingerprint_hash: 'hash',
        }),
      ).rejects.toThrow('Failed to create signal fingerprint: Insert failed');
    });
  });

  describe('findBySignalId', () => {
    it('should find fingerprint by signal ID', async () => {
      const expectedResult = {
        id: 'fp-001',
        signal_id: 'signal-123',
        target_id: 'target-456',
        title_normalized: 'test title',
        key_phrases: ['test', 'title'],
        fingerprint_hash: 'hash-123',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockClient.single.mockResolvedValue({
        data: expectedResult,
        error: null,
      });

      const result = await repository.findBySignalId('signal-123');

      expect(result).toEqual(expectedResult);
      expect(mockClient.eq).toHaveBeenCalledWith('signal_id', 'signal-123');
    });

    it('should return null when not found', async () => {
      mockClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      const result = await repository.findBySignalId('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByFingerprintHash', () => {
    it('should find fingerprint by hash', async () => {
      const expectedResult = {
        id: 'fp-001',
        signal_id: 'signal-123',
        target_id: 'target-456',
        title_normalized: 'test',
        key_phrases: ['test'],
        fingerprint_hash: 'hash-123',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockClient.single.mockResolvedValue({
        data: expectedResult,
        error: null,
      });

      const result = await repository.findByFingerprintHash(
        'target-456',
        'hash-123',
      );

      expect(result).toEqual(expectedResult);
      expect(mockClient.eq).toHaveBeenCalledWith('target_id', 'target-456');
      expect(mockClient.eq).toHaveBeenCalledWith(
        'fingerprint_hash',
        'hash-123',
      );
    });
  });

  describe('findRecentForTarget', () => {
    it('should call RPC function when available', async () => {
      const expectedResults = [
        {
          signal_id: 'signal-1',
          title_normalized: 'title 1',
          key_phrases: ['phrase 1'],
          fingerprint_hash: 'hash-1',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      // RPC call succeeds
      mockClient.rpc.mockResolvedValue({
        data: expectedResults,
        error: null,
      });

      const result = await repository.findRecentForTarget(
        'target-123',
        72,
        100,
      );

      expect(result).toEqual(expectedResults);
      expect(mockClient.rpc).toHaveBeenCalledWith(
        'find_recent_signal_fingerprints',
        {
          p_target_id: 'target-123',
          p_hours_back: 72,
          p_limit: 100,
        },
      );
    });

    it('should fall back to direct query when RPC not found', async () => {
      const expectedResults = [
        {
          signal_id: 'signal-1',
          title_normalized: 'title 1',
          key_phrases: ['phrase 1'],
          fingerprint_hash: 'hash-1',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      // RPC call fails with function not found
      mockClient.rpc.mockResolvedValue({
        data: null,
        error: { code: 'PGRST202', message: 'Function not found' },
      });

      // Direct query succeeds
      mockClient.limit.mockResolvedValue({
        data: expectedResults,
        error: null,
      });

      const result = await repository.findRecentForTarget(
        'target-123',
        72,
        100,
      );

      expect(result).toEqual(expectedResults);
      expect(mockClient.from).toHaveBeenCalledWith('signal_fingerprints');
    });
  });

  describe('findByPhraseOverlap', () => {
    it('should call RPC function for phrase overlap', async () => {
      const keyPhrases = ['apple stock', 'stock rises'];
      const expectedResults = [
        {
          signal_id: 'signal-1',
          title_normalized: 'title 1',
          key_phrases: ['apple stock', 'price target'],
          overlap_count: 1,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockClient.rpc.mockResolvedValue({
        data: expectedResults,
        error: null,
      });

      const result = await repository.findByPhraseOverlap(
        'target-123',
        keyPhrases,
        72,
        50,
      );

      expect(result).toEqual(expectedResults);
      expect(mockClient.rpc).toHaveBeenCalledWith(
        'find_signals_by_phrase_overlap',
        {
          p_target_id: 'target-123',
          p_key_phrases: keyPhrases,
          p_hours_back: 72,
          p_limit: 50,
        },
      );
    });

    it('should fall back to direct query and calculate overlaps', async () => {
      const keyPhrases = ['apple stock', 'stock rises'];
      const directResults = [
        {
          signal_id: 'signal-1',
          title_normalized: 'title 1',
          key_phrases: ['apple stock', 'price target'],
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      // RPC fails
      mockClient.rpc.mockResolvedValue({
        data: null,
        error: { code: 'PGRST202', message: 'Function not found' },
      });

      // Direct query succeeds
      mockClient.limit.mockResolvedValue({
        data: directResults,
        error: null,
      });

      const result = await repository.findByPhraseOverlap(
        'target-123',
        keyPhrases,
        72,
        50,
      );

      // Should have calculated overlap_count in application code
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.overlap_count).toBe(1); // 'apple stock' matches
      expect(mockClient.overlaps).toHaveBeenCalledWith(
        'key_phrases',
        keyPhrases,
      );
    });
  });

  describe('deleteBySignalId', () => {
    it('should delete fingerprint by signal ID', async () => {
      mockClient.eq.mockResolvedValue({
        error: null,
      });

      await repository.deleteBySignalId('signal-123');

      expect(mockClient.delete).toHaveBeenCalled();
      expect(mockClient.eq).toHaveBeenCalledWith('signal_id', 'signal-123');
    });
  });

  describe('cleanupOldFingerprints', () => {
    it('should delete fingerprints older than retention period', async () => {
      mockClient.select.mockResolvedValue({
        data: [{ id: 'fp-1' }, { id: 'fp-2' }],
        error: null,
      });

      const deletedCount = await repository.cleanupOldFingerprints(30);

      expect(deletedCount).toBe(2);
      expect(mockClient.delete).toHaveBeenCalled();
      expect(mockClient.lt).toHaveBeenCalled();
    });
  });
});
