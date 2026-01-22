import { Test, TestingModule } from '@nestjs/testing';
import { SourceCrawlerService } from '../source-crawler.service';
import { SourceRepository } from '../../repositories/source.repository';
import { SourceCrawlRepository } from '../../repositories/source-crawl.repository';
import { SourceSeenItemRepository } from '../../repositories/source-seen-item.repository';
import { SignalRepository } from '../../repositories/signal.repository';
import { SignalFingerprintRepository } from '../../repositories/signal-fingerprint.repository';
import { FirecrawlService } from '../firecrawl.service';
import { ContentHashService } from '../content-hash.service';
import { TestDbSourceCrawlerService } from '../test-db-source-crawler.service';
import { ObservabilityEventsService } from '@/observability/observability-events.service';
import { Source } from '../../interfaces/source.interface';

describe('SourceCrawlerService', () => {
  let service: SourceCrawlerService;
  let mockSourceRepository: Partial<SourceRepository>;
  let mockSourceCrawlRepository: Partial<SourceCrawlRepository>;
  let mockSourceSeenItemRepository: Partial<SourceSeenItemRepository>;
  let mockSignalRepository: Partial<SignalRepository>;
  let mockSignalFingerprintRepository: Partial<SignalFingerprintRepository>;
  let mockFirecrawlService: Partial<FirecrawlService>;

  const mockSource: Source = {
    id: 'source-123',
    name: 'Test Source',
    description: 'Test description',
    source_type: 'rss',
    url: 'https://example.com/rss',
    scope_level: 'target',
    domain: 'stocks',
    universe_id: 'universe-1',
    target_id: 'target-1',
    crawl_config: {
      fuzzy_dedup_enabled: true,
      cross_source_dedup: true,
      title_similarity_threshold: 0.85,
      phrase_overlap_threshold: 0.7,
      dedup_hours_back: 72,
    },
    auth_config: { type: 'none' },
    crawl_frequency_minutes: 15,
    is_active: true,
    is_test: false,
    last_crawl_at: null,
    last_crawl_status: null,
    last_error: null,
    consecutive_errors: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockCrawl = {
    id: 'crawl-123',
    source_id: 'source-123',
    started_at: '2024-01-01T00:00:00Z',
    completed_at: null,
    status: 'running' as const,
    items_found: 0,
    items_new: 0,
    signals_created: 0,
    duplicates_skipped: 0,
    duplicates_exact: 0,
    duplicates_cross_source: 0,
    duplicates_fuzzy_title: 0,
    duplicates_phrase_overlap: 0,
    error_message: null,
    crawl_duration_ms: null,
    metadata: {},
  };

  beforeEach(async () => {
    mockSourceRepository = {
      markCrawlSuccess: jest.fn().mockResolvedValue(undefined),
      markCrawlError: jest.fn().mockResolvedValue(undefined),
    };

    mockSourceCrawlRepository = {
      create: jest.fn().mockResolvedValue(mockCrawl),
      markSuccess: jest.fn().mockResolvedValue(undefined),
      markError: jest.fn().mockResolvedValue(undefined),
      findByIdOrThrow: jest.fn().mockResolvedValue(mockCrawl),
    };

    mockSourceSeenItemRepository = {
      markSeen: jest.fn().mockResolvedValue({ isNew: true, seenItem: null }),
      hasBeenSeenForTarget: jest.fn().mockResolvedValue(false),
    };

    mockSignalRepository = {
      create: jest.fn().mockImplementation((data) =>
        Promise.resolve({
          id: `signal-${Date.now()}`,
          ...data,
        }),
      ),
    };

    mockSignalFingerprintRepository = {
      create: jest.fn().mockResolvedValue({}),
      findRecentForTarget: jest.fn().mockResolvedValue([]),
      findByPhraseOverlap: jest.fn().mockResolvedValue([]),
    };

    mockFirecrawlService = {
      scrapeSource: jest.fn().mockResolvedValue({
        success: true,
        source_id: 'source-123',
        items: [],
        duration_ms: 100,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SourceCrawlerService,
        ContentHashService,
        { provide: SourceRepository, useValue: mockSourceRepository },
        { provide: SourceCrawlRepository, useValue: mockSourceCrawlRepository },
        {
          provide: SourceSeenItemRepository,
          useValue: mockSourceSeenItemRepository,
        },
        { provide: SignalRepository, useValue: mockSignalRepository },
        {
          provide: SignalFingerprintRepository,
          useValue: mockSignalFingerprintRepository,
        },
        { provide: FirecrawlService, useValue: mockFirecrawlService },
        {
          provide: TestDbSourceCrawlerService,
          useValue: {
            crawlTestDbSource: jest.fn().mockResolvedValue({
              success: true,
              source_id: 'source-123',
              items: [],
              duration_ms: 100,
            }),
          },
        },
        {
          provide: ObservabilityEventsService,
          useValue: {
            push: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<SourceCrawlerService>(SourceCrawlerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('4-Layer Deduplication', () => {
    describe('Layer 1: Exact Hash Match', () => {
      it('should detect exact hash duplicates from same source', async () => {
        // First call: content is new
        mockSourceSeenItemRepository.markSeen = jest
          .fn()
          .mockResolvedValueOnce({ isNew: true, seenItem: {} })
          // Second call: same content already seen
          .mockResolvedValueOnce({ isNew: false, seenItem: {} });

        // Mock RSS response with two identical items
        const rssResponse = `
          <rss><channel>
            <item>
              <title>Apple Stock Surges</title>
              <description>Apple stock rises 5%</description>
              <link>https://example.com/1</link>
            </item>
            <item>
              <title>Apple Stock Surges</title>
              <description>Apple stock rises 5%</description>
              <link>https://example.com/2</link>
            </item>
          </channel></rss>
        `;

        // Mock fetch for RSS
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(rssResponse),
        });

        const result = await service.crawlSource(mockSource, 'target-1');

        expect(result.dedupMetrics.duplicates_exact).toBe(1);
        expect(result.signalsCreated).toBe(1);
      });
    });

    describe('Layer 2: Cross-Source Hash Check', () => {
      it('should detect duplicates from different sources for same target', async () => {
        // Content is new to this source
        mockSourceSeenItemRepository.markSeen = jest
          .fn()
          .mockResolvedValue({ isNew: true, seenItem: {} });

        // But exists in another source for same target
        mockSourceSeenItemRepository.hasBeenSeenForTarget = jest
          .fn()
          .mockResolvedValue(true);

        const rssResponse = `
          <rss><channel>
            <item>
              <title>Apple Stock Surges</title>
              <description>Apple stock rises 5%</description>
              <link>https://example.com/1</link>
            </item>
          </channel></rss>
        `;

        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(rssResponse),
        });

        const result = await service.crawlSource(mockSource, 'target-1');

        expect(result.dedupMetrics.duplicates_cross_source).toBe(1);
        expect(result.signalsCreated).toBe(0);
        expect(
          mockSourceSeenItemRepository.hasBeenSeenForTarget,
        ).toHaveBeenCalled();
      });

      it('should skip cross-source check when disabled', async () => {
        const sourceWithoutCrossSource = {
          ...mockSource,
          crawl_config: {
            ...mockSource.crawl_config,
            cross_source_dedup: false,
          },
        };

        mockSourceSeenItemRepository.markSeen = jest
          .fn()
          .mockResolvedValue({ isNew: true, seenItem: {} });

        const rssResponse = `
          <rss><channel>
            <item>
              <title>Test Article</title>
              <description>Test content</description>
              <link>https://example.com/1</link>
            </item>
          </channel></rss>
        `;

        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(rssResponse),
        });

        await service.crawlSource(sourceWithoutCrossSource, 'target-1');

        expect(
          mockSourceSeenItemRepository.hasBeenSeenForTarget,
        ).not.toHaveBeenCalled();
      });
    });

    describe('Layer 3: Fuzzy Title Matching', () => {
      it('should detect similar titles using Jaccard similarity', async () => {
        mockSourceSeenItemRepository.markSeen = jest
          .fn()
          .mockResolvedValue({ isNew: true, seenItem: {} });
        mockSourceSeenItemRepository.hasBeenSeenForTarget = jest
          .fn()
          .mockResolvedValue(false);

        // Existing signal with similar title (note: using nearly identical title for high similarity)
        // The incoming title "Apple Stock Surges on Earnings" normalizes to "apple stock surges earnings"
        // The existing title needs to be similar enough to pass 0.85 Jaccard threshold
        mockSignalFingerprintRepository.findRecentForTarget = jest
          .fn()
          .mockResolvedValue([
            {
              signal_id: 'existing-signal',
              title_normalized: 'apple stock surges earnings beat today',
              key_phrases: ['apple stock', 'stock surges'],
              fingerprint_hash: 'hash-1',
              created_at: '2024-01-01T00:00:00Z',
            },
          ]);

        // Title will normalize to something very similar
        const rssResponse = `
          <rss><channel>
            <item>
              <title>Apple Stock Surges on Earnings Beat Today</title>
              <description>The tech giant reported better than expected results</description>
              <link>https://example.com/1</link>
            </item>
          </channel></rss>
        `;

        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(rssResponse),
        });

        const result = await service.crawlSource(mockSource, 'target-1');

        expect(result.dedupMetrics.duplicates_fuzzy_title).toBe(1);
        expect(result.signalsCreated).toBe(0);
      });

      it('should allow through when titles are different enough', async () => {
        mockSourceSeenItemRepository.markSeen = jest
          .fn()
          .mockResolvedValue({ isNew: true, seenItem: {} });
        mockSourceSeenItemRepository.hasBeenSeenForTarget = jest
          .fn()
          .mockResolvedValue(false);

        // Existing signal with different title
        mockSignalFingerprintRepository.findRecentForTarget = jest
          .fn()
          .mockResolvedValue([
            {
              signal_id: 'existing-signal',
              title_normalized: 'microsoft announces new surface laptop',
              key_phrases: ['microsoft announces', 'surface laptop'],
              fingerprint_hash: 'hash-1',
              created_at: '2024-01-01T00:00:00Z',
            },
          ]);

        mockSignalFingerprintRepository.findByPhraseOverlap = jest
          .fn()
          .mockResolvedValue([]);

        const rssResponse = `
          <rss><channel>
            <item>
              <title>Apple Reports Record iPhone Sales</title>
              <description>The tech giant sold more iPhones than expected</description>
              <link>https://example.com/1</link>
            </item>
          </channel></rss>
        `;

        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(rssResponse),
        });

        const result = await service.crawlSource(mockSource, 'target-1');

        expect(result.signalsCreated).toBe(1);
        expect(result.dedupMetrics.duplicates_fuzzy_title).toBe(0);
      });
    });

    describe('Layer 4: Key Phrase Overlap', () => {
      it('should detect articles with high key phrase overlap', async () => {
        mockSourceSeenItemRepository.markSeen = jest
          .fn()
          .mockResolvedValue({ isNew: true, seenItem: {} });
        mockSourceSeenItemRepository.hasBeenSeenForTarget = jest
          .fn()
          .mockResolvedValue(false);

        // No fuzzy title match
        mockSignalFingerprintRepository.findRecentForTarget = jest
          .fn()
          .mockResolvedValue([]);

        // But high key phrase overlap
        mockSignalFingerprintRepository.findByPhraseOverlap = jest
          .fn()
          .mockResolvedValue([
            {
              signal_id: 'existing-signal',
              title_normalized: 'different title',
              key_phrases: ['apple iphone', 'iphone sales', 'sales growth'],
              overlap_count: 11, // 73% of 15 phrases
              created_at: '2024-01-01T00:00:00Z',
            },
          ]);

        const rssResponse = `
          <rss><channel>
            <item>
              <title>Complete Different Title</title>
              <description>Apple iPhone sales growth continues with record breaking numbers this quarter as consumers upgrade to the latest models featuring improved cameras and battery life</description>
              <link>https://example.com/1</link>
            </item>
          </channel></rss>
        `;

        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(rssResponse),
        });

        const result = await service.crawlSource(mockSource, 'target-1');

        expect(result.dedupMetrics.duplicates_phrase_overlap).toBe(1);
        expect(result.signalsCreated).toBe(0);
      });
    });

    describe('Fuzzy Dedup Disabled', () => {
      it('should skip Layer 3 and 4 when fuzzy_dedup_enabled is false', async () => {
        const sourceWithoutFuzzy = {
          ...mockSource,
          crawl_config: {
            ...mockSource.crawl_config,
            fuzzy_dedup_enabled: false,
          },
        };

        mockSourceSeenItemRepository.markSeen = jest
          .fn()
          .mockResolvedValue({ isNew: true, seenItem: {} });
        mockSourceSeenItemRepository.hasBeenSeenForTarget = jest
          .fn()
          .mockResolvedValue(false);

        const rssResponse = `
          <rss><channel>
            <item>
              <title>Apple Stock Surges</title>
              <description>Apple stock rises 5%</description>
              <link>https://example.com/1</link>
            </item>
          </channel></rss>
        `;

        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(rssResponse),
        });

        await service.crawlSource(sourceWithoutFuzzy, 'target-1');

        // Fuzzy matching functions should not be called
        expect(
          mockSignalFingerprintRepository.findRecentForTarget,
        ).not.toHaveBeenCalled();
        expect(
          mockSignalFingerprintRepository.findByPhraseOverlap,
        ).not.toHaveBeenCalled();
      });
    });
  });

  describe('Signal and Fingerprint Creation', () => {
    it('should create signal and fingerprint for new unique content', async () => {
      mockSourceSeenItemRepository.markSeen = jest
        .fn()
        .mockResolvedValue({ isNew: true, seenItem: {} });
      mockSourceSeenItemRepository.hasBeenSeenForTarget = jest
        .fn()
        .mockResolvedValue(false);
      mockSignalFingerprintRepository.findRecentForTarget = jest
        .fn()
        .mockResolvedValue([]);
      mockSignalFingerprintRepository.findByPhraseOverlap = jest
        .fn()
        .mockResolvedValue([]);

      const rssResponse = `
        <rss><channel>
          <item>
            <title>Unique Article Title</title>
            <description>Unique content that has never been seen before</description>
            <link>https://example.com/unique</link>
          </item>
        </channel></rss>
      `;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(rssResponse),
      });

      const result = await service.crawlSource(mockSource, 'target-1');

      expect(result.signalsCreated).toBe(1);
      expect(mockSignalRepository.create).toHaveBeenCalledTimes(1);
      expect(mockSignalFingerprintRepository.create).toHaveBeenCalledTimes(1);

      // Verify fingerprint was created with correct data
      const fingerprintCall = (
        mockSignalFingerprintRepository.create as jest.Mock
      ).mock.calls[0][0];
      expect(fingerprintCall.target_id).toBe('target-1');
      expect(fingerprintCall.title_normalized).toBeDefined();
      expect(fingerprintCall.key_phrases).toBeInstanceOf(Array);
      expect(fingerprintCall.fingerprint_hash).toBeDefined();
    });
  });

  describe('Dedup Metrics Tracking', () => {
    it('should track dedup metrics in crawl record', async () => {
      // Mix of duplicates from different layers
      mockSourceSeenItemRepository.markSeen = jest
        .fn()
        .mockResolvedValueOnce({ isNew: true, seenItem: {} }) // Item 1: new
        .mockResolvedValueOnce({ isNew: false, seenItem: {} }); // Item 2: exact dup

      mockSourceSeenItemRepository.hasBeenSeenForTarget = jest
        .fn()
        .mockResolvedValue(false);
      mockSignalFingerprintRepository.findRecentForTarget = jest
        .fn()
        .mockResolvedValue([]);
      mockSignalFingerprintRepository.findByPhraseOverlap = jest
        .fn()
        .mockResolvedValue([]);

      const rssResponse = `
        <rss><channel>
          <item>
            <title>Unique Article</title>
            <description>Unique content</description>
            <link>https://example.com/1</link>
          </item>
          <item>
            <title>Duplicate Article</title>
            <description>Same content as before</description>
            <link>https://example.com/2</link>
          </item>
        </channel></rss>
      `;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(rssResponse),
      });

      await service.crawlSource(mockSource, 'target-1');

      // Verify markSuccess was called with correct dedup metrics
      expect(mockSourceCrawlRepository.markSuccess).toHaveBeenCalledWith(
        'crawl-123',
        expect.objectContaining({
          items_found: 2,
          signals_created: 1,
          duplicates_exact: 1,
          duplicates_cross_source: 0,
          duplicates_fuzzy_title: 0,
          duplicates_phrase_overlap: 0,
        }),
      );
    });
  });

  describe('Direction Inference', () => {
    it('should infer bullish direction from positive terms', async () => {
      mockSourceSeenItemRepository.markSeen = jest
        .fn()
        .mockResolvedValue({ isNew: true, seenItem: {} });
      mockSourceSeenItemRepository.hasBeenSeenForTarget = jest
        .fn()
        .mockResolvedValue(false);
      mockSignalFingerprintRepository.findRecentForTarget = jest
        .fn()
        .mockResolvedValue([]);
      mockSignalFingerprintRepository.findByPhraseOverlap = jest
        .fn()
        .mockResolvedValue([]);

      const rssResponse = `
        <rss><channel>
          <item>
            <title>Stock Surges on Bullish News</title>
            <description>Shares rally as company beats expectations with strong growth</description>
            <link>https://example.com/1</link>
          </item>
        </channel></rss>
      `;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(rssResponse),
      });

      await service.crawlSource(mockSource, 'target-1');

      const signalCall = (mockSignalRepository.create as jest.Mock).mock
        .calls[0][0];
      expect(signalCall.direction).toBe('bullish');
    });

    it('should infer bearish direction from negative terms', async () => {
      mockSourceSeenItemRepository.markSeen = jest
        .fn()
        .mockResolvedValue({ isNew: true, seenItem: {} });
      mockSourceSeenItemRepository.hasBeenSeenForTarget = jest
        .fn()
        .mockResolvedValue(false);
      mockSignalFingerprintRepository.findRecentForTarget = jest
        .fn()
        .mockResolvedValue([]);
      mockSignalFingerprintRepository.findByPhraseOverlap = jest
        .fn()
        .mockResolvedValue([]);

      const rssResponse = `
        <rss><channel>
          <item>
            <title>Stock Plunges on Bearish News</title>
            <description>Shares crash as company misses expectations with weak decline</description>
            <link>https://example.com/1</link>
          </item>
        </channel></rss>
      `;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(rssResponse),
      });

      await service.crawlSource(mockSource, 'target-1');

      const signalCall = (mockSignalRepository.create as jest.Mock).mock
        .calls[0][0];
      expect(signalCall.direction).toBe('bearish');
    });
  });
});
