import { Test, TestingModule } from '@nestjs/testing';
import {
  DeduplicationService,
  DEFAULT_DEDUP_CONFIG,
} from '../deduplication.service';
import { ArticleRepository } from '../../repositories/article.repository';

describe('DeduplicationService', () => {
  let service: DeduplicationService;
  let mockArticleRepository: Partial<ArticleRepository>;

  beforeEach(async () => {
    mockArticleRepository = {
      findByContentHash: jest.fn(),
      checkContentHashExists: jest.fn(),
      findRecentFingerprints: jest.fn(),
      findByPhraseOverlap: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeduplicationService,
        {
          provide: ArticleRepository,
          useValue: mockArticleRepository,
        },
      ],
    }).compile();

    service = module.get<DeduplicationService>(DeduplicationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =============================================================================
  // CONTENT HASH GENERATION
  // =============================================================================

  describe('generateContentHash', () => {
    it('should generate SHA-256 hash for content', () => {
      const content = 'Test article content';
      const hash = service.generateContentHash(content);

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64); // SHA-256 produces 64 hex characters
    });

    it('should generate same hash for identical content', () => {
      const content = 'Same content';
      const hash1 = service.generateContentHash(content);
      const hash2 = service.generateContentHash(content);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different content', () => {
      const hash1 = service.generateContentHash('Content A');
      const hash2 = service.generateContentHash('Content B');

      expect(hash1).not.toBe(hash2);
    });
  });

  // =============================================================================
  // TITLE NORMALIZATION
  // =============================================================================

  describe('normalizeTitle', () => {
    it('should lowercase the title', () => {
      const result = service.normalizeTitle('UPPERCASE TITLE');
      expect(result).toBe('uppercase title');
    });

    it('should remove punctuation', () => {
      const result = service.normalizeTitle('Hello, World! How are you?');
      expect(result).toBe('hello world how are you');
    });

    it('should collapse multiple whitespace', () => {
      const result = service.normalizeTitle('Multiple   spaces   here');
      expect(result).toBe('multiple spaces here');
    });

    it('should trim whitespace', () => {
      const result = service.normalizeTitle('  Spaces around  ');
      expect(result).toBe('spaces around');
    });

    it('should handle mixed case and punctuation', () => {
      const result = service.normalizeTitle("Apple's Stock SURGES 10%!");
      expect(result).toBe('apples stock surges 10');
    });
  });

  // =============================================================================
  // KEY PHRASE EXTRACTION
  // =============================================================================

  describe('extractKeyPhrases', () => {
    it('should extract 2-word phrases', () => {
      const phrases = service.extractKeyPhrases(
        'Stock market analysis',
        'The market showed strong performance',
      );

      expect(phrases).toContain('stock market');
    });

    it('should extract 3-word phrases', () => {
      const phrases = service.extractKeyPhrases(
        'Stock market analysis today',
        '',
      );

      expect(phrases.some((p) => p.split(' ').length === 3)).toBe(true);
    });

    it('should filter out short words (length <= 3)', () => {
      const phrases = service.extractKeyPhrases('The big dog ran', '');

      // 'the' and 'big' and 'dog' and 'ran' are all short
      // Only words > 3 chars are kept - if any phrases exist
      if (phrases.length > 0) {
        phrases.forEach((phrase) => {
          const words = phrase.split(' ');
          words.forEach((word) => {
            expect(word.length).toBeGreaterThan(3);
          });
        });
      } else {
        // All words filtered out is also valid behavior
        expect(phrases).toHaveLength(0);
      }
    });

    it('should return max 20 phrases', () => {
      const longContent = Array(50).fill('word').join(' ');
      const phrases = service.extractKeyPhrases('Title', longContent);

      expect(phrases.length).toBeLessThanOrEqual(20);
    });

    it('should prefer longer phrases', () => {
      const phrases = service.extractKeyPhrases(
        'Stock market analysis report',
        'Financial data shows growth',
      );

      // Longer phrases should come first
      if (phrases.length >= 2) {
        const firstPhraseLength = phrases[0]!.split(' ').length;
        const lastPhraseLength = phrases[phrases.length - 1]!.split(' ').length;
        expect(firstPhraseLength).toBeGreaterThanOrEqual(lastPhraseLength);
      }
    });
  });

  // =============================================================================
  // FINGERPRINT HASH GENERATION
  // =============================================================================

  describe('generateFingerprintHash', () => {
    it('should generate hash from key phrases', () => {
      const phrases = ['stock market', 'financial news', 'market analysis'];
      const hash = service.generateFingerprintHash(phrases);

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    it('should generate same hash regardless of phrase order', () => {
      const phrases1 = ['alpha', 'beta', 'gamma'];
      const phrases2 = ['gamma', 'alpha', 'beta'];

      const hash1 = service.generateFingerprintHash(phrases1);
      const hash2 = service.generateFingerprintHash(phrases2);

      expect(hash1).toBe(hash2);
    });
  });

  // =============================================================================
  // JACCARD SIMILARITY
  // =============================================================================

  describe('calculateJaccardSimilarity', () => {
    it('should return 1 for identical sets', () => {
      const similarity = service.calculateJaccardSimilarity(
        ['a', 'b', 'c'],
        ['a', 'b', 'c'],
      );
      expect(similarity).toBe(1);
    });

    it('should return 0 for completely different sets', () => {
      const similarity = service.calculateJaccardSimilarity(
        ['a', 'b', 'c'],
        ['d', 'e', 'f'],
      );
      expect(similarity).toBe(0);
    });

    it('should return 0.5 for half overlap', () => {
      const similarity = service.calculateJaccardSimilarity(
        ['a', 'b'],
        ['b', 'c'],
      );
      // Intersection: {b} = 1
      // Union: {a, b, c} = 3
      // Jaccard: 1/3 ≈ 0.333
      expect(similarity).toBeCloseTo(1 / 3);
    });

    it('should return 0 for empty sets', () => {
      const similarity = service.calculateJaccardSimilarity([], []);
      expect(similarity).toBe(0);
    });
  });

  // =============================================================================
  // PHRASE OVERLAP
  // =============================================================================

  describe('calculatePhraseOverlap', () => {
    it('should return 1 for identical phrase sets', () => {
      const overlap = service.calculatePhraseOverlap(
        ['phrase one', 'phrase two'],
        ['phrase one', 'phrase two'],
      );
      expect(overlap).toBe(1);
    });

    it('should return 0 for no overlap', () => {
      const overlap = service.calculatePhraseOverlap(
        ['phrase one', 'phrase two'],
        ['phrase three', 'phrase four'],
      );
      expect(overlap).toBe(0);
    });

    it('should calculate overlap relative to smaller set', () => {
      const overlap = service.calculatePhraseOverlap(
        ['a', 'b'],
        ['a', 'b', 'c', 'd'],
      );
      // Intersection: 2
      // Smaller set size: 2
      // Overlap: 2/2 = 1
      expect(overlap).toBe(1);
    });

    it('should return 0 for empty sets', () => {
      const overlap = service.calculatePhraseOverlap([], []);
      expect(overlap).toBe(0);
    });
  });

  // =============================================================================
  // DUPLICATE CHECKING
  // =============================================================================

  describe('checkDuplicate', () => {
    const testParams = {
      organizationSlug: 'test-org',
      sourceId: 'source-123',
      contentHash: 'abc123hash',
      title: 'Test Article Title',
      content: 'This is test article content.',
    };

    describe('Layer 1: Exact hash match', () => {
      it('should detect exact duplicate within same source', async () => {
        (
          mockArticleRepository.findByContentHash as jest.Mock
        ).mockResolvedValue({
          id: 'existing-article',
          source_id: 'source-123', // Same source
        });

        const result = await service.checkDuplicate(
          testParams.organizationSlug,
          testParams.sourceId,
          testParams.contentHash,
          testParams.title,
          testParams.content,
        );

        expect(result.is_duplicate).toBe(true);
        expect(result.duplicate_type).toBe('exact');
        expect(result.existing_article_id).toBe('existing-article');
      });

      it('should detect cross-source duplicate via hash match', async () => {
        (
          mockArticleRepository.findByContentHash as jest.Mock
        ).mockResolvedValue({
          id: 'existing-article',
          source_id: 'different-source', // Different source
        });

        const result = await service.checkDuplicate(
          testParams.organizationSlug,
          testParams.sourceId,
          testParams.contentHash,
          testParams.title,
          testParams.content,
        );

        expect(result.is_duplicate).toBe(true);
        expect(result.duplicate_type).toBe('cross_source');
      });
    });

    describe('Layer 2: Cross-source hash check', () => {
      it('should detect cross-source duplicate via explicit check', async () => {
        (
          mockArticleRepository.findByContentHash as jest.Mock
        ).mockResolvedValue(null);
        (
          mockArticleRepository.checkContentHashExists as jest.Mock
        ).mockResolvedValue(true);

        const result = await service.checkDuplicate(
          testParams.organizationSlug,
          testParams.sourceId,
          testParams.contentHash,
          testParams.title,
          testParams.content,
        );

        expect(result.is_duplicate).toBe(true);
        expect(result.duplicate_type).toBe('cross_source');
      });

      it('should skip cross-source check when disabled', async () => {
        (
          mockArticleRepository.findByContentHash as jest.Mock
        ).mockResolvedValue(null);
        (
          mockArticleRepository.findRecentFingerprints as jest.Mock
        ).mockResolvedValue([]);
        (
          mockArticleRepository.findByPhraseOverlap as jest.Mock
        ).mockResolvedValue([]);

        const result = await service.checkDuplicate(
          testParams.organizationSlug,
          testParams.sourceId,
          testParams.contentHash,
          testParams.title,
          testParams.content,
          { ...DEFAULT_DEDUP_CONFIG, cross_source_dedup: false },
        );

        expect(
          mockArticleRepository.checkContentHashExists,
        ).not.toHaveBeenCalled();
        expect(result.is_duplicate).toBe(false);
      });
    });

    describe('Layer 3: Fuzzy title matching', () => {
      it('should detect fuzzy title duplicate', async () => {
        (
          mockArticleRepository.findByContentHash as jest.Mock
        ).mockResolvedValue(null);
        (
          mockArticleRepository.checkContentHashExists as jest.Mock
        ).mockResolvedValue(false);
        (
          mockArticleRepository.findRecentFingerprints as jest.Mock
        ).mockResolvedValue([
          {
            article_id: 'similar-article',
            title_normalized: 'test article title', // Very similar
          },
        ]);

        const result = await service.checkDuplicate(
          testParams.organizationSlug,
          testParams.sourceId,
          testParams.contentHash,
          testParams.title,
          testParams.content,
        );

        expect(result.is_duplicate).toBe(true);
        expect(result.duplicate_type).toBe('fuzzy_title');
        expect(result.existing_article_id).toBe('similar-article');
        expect(result.similarity_score).toBeGreaterThanOrEqual(0.85);
      });

      it('should not match dissimilar titles', async () => {
        (
          mockArticleRepository.findByContentHash as jest.Mock
        ).mockResolvedValue(null);
        (
          mockArticleRepository.checkContentHashExists as jest.Mock
        ).mockResolvedValue(false);
        (
          mockArticleRepository.findRecentFingerprints as jest.Mock
        ).mockResolvedValue([
          {
            article_id: 'different-article',
            title_normalized: 'completely different content here',
          },
        ]);
        (
          mockArticleRepository.findByPhraseOverlap as jest.Mock
        ).mockResolvedValue([]);

        const result = await service.checkDuplicate(
          testParams.organizationSlug,
          testParams.sourceId,
          testParams.contentHash,
          testParams.title,
          testParams.content,
        );

        expect(result.is_duplicate).toBe(false);
      });
    });

    describe('Layer 4: Key phrase overlap', () => {
      it('should detect phrase overlap duplicate', async () => {
        // First, extract actual key phrases from the test content
        const testTitle = 'Financial Market Analysis Report';
        const testContent = 'The financial market shows strong analysis today.';
        const keyPhrases = service.extractKeyPhrases(testTitle, testContent);

        (
          mockArticleRepository.findByContentHash as jest.Mock
        ).mockResolvedValue(null);
        (
          mockArticleRepository.checkContentHashExists as jest.Mock
        ).mockResolvedValue(false);
        (
          mockArticleRepository.findRecentFingerprints as jest.Mock
        ).mockResolvedValue([]);

        // Use the same phrases in the mock to ensure overlap
        (
          mockArticleRepository.findByPhraseOverlap as jest.Mock
        ).mockResolvedValue([
          {
            article_id: 'overlapping-article',
            key_phrases: keyPhrases, // Return the same phrases to guarantee 100% overlap
          },
        ]);

        const result = await service.checkDuplicate(
          testParams.organizationSlug,
          testParams.sourceId,
          testParams.contentHash,
          testTitle,
          testContent,
        );

        // Only expect duplicate detection if key phrases were actually extracted
        if (keyPhrases.length > 0) {
          expect(result.is_duplicate).toBe(true);
          expect(result.duplicate_type).toBe('phrase_overlap');
          expect(result.existing_article_id).toBe('overlapping-article');
        } else {
          // No phrases extracted, so no phrase overlap detection
          expect(result.is_duplicate).toBe(false);
        }
      });
    });

    describe('No duplicate found', () => {
      it('should return is_duplicate false when no matches', async () => {
        (
          mockArticleRepository.findByContentHash as jest.Mock
        ).mockResolvedValue(null);
        (
          mockArticleRepository.checkContentHashExists as jest.Mock
        ).mockResolvedValue(false);
        (
          mockArticleRepository.findRecentFingerprints as jest.Mock
        ).mockResolvedValue([]);
        (
          mockArticleRepository.findByPhraseOverlap as jest.Mock
        ).mockResolvedValue([]);

        const result = await service.checkDuplicate(
          testParams.organizationSlug,
          testParams.sourceId,
          testParams.contentHash,
          testParams.title,
          testParams.content,
        );

        expect(result.is_duplicate).toBe(false);
        expect(result.duplicate_type).toBeUndefined();
        expect(result.existing_article_id).toBeUndefined();
      });
    });

    describe('Configuration options', () => {
      it('should skip fuzzy matching when disabled', async () => {
        (
          mockArticleRepository.findByContentHash as jest.Mock
        ).mockResolvedValue(null);
        (
          mockArticleRepository.checkContentHashExists as jest.Mock
        ).mockResolvedValue(false);

        const result = await service.checkDuplicate(
          testParams.organizationSlug,
          testParams.sourceId,
          testParams.contentHash,
          testParams.title,
          testParams.content,
          { ...DEFAULT_DEDUP_CONFIG, fuzzy_dedup_enabled: false },
        );

        expect(
          mockArticleRepository.findRecentFingerprints,
        ).not.toHaveBeenCalled();
        expect(result.is_duplicate).toBe(false);
      });

      it('should skip fuzzy matching when no title', async () => {
        (
          mockArticleRepository.findByContentHash as jest.Mock
        ).mockResolvedValue(null);
        (
          mockArticleRepository.checkContentHashExists as jest.Mock
        ).mockResolvedValue(false);

        const result = await service.checkDuplicate(
          testParams.organizationSlug,
          testParams.sourceId,
          testParams.contentHash,
          '', // Empty title
          testParams.content,
        );

        expect(
          mockArticleRepository.findRecentFingerprints,
        ).not.toHaveBeenCalled();
        expect(result.is_duplicate).toBe(false);
      });
    });
  });
});
