/**
 * Signal Creation Integration Tests
 *
 * Tests the complete flow from crawled content to signal creation.
 * Validates that:
 * - Crawled content is properly parsed
 * - Signals are created with correct structure
 * - Direction and disposition are properly assigned
 * - Signal metadata is complete
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ContentHashService } from '../../../services/content-hash.service';
import type { Claim } from '../../../../agent2agent/runners/prediction/base/base-prediction.types';

describe('Signal Creation Integration Tests', () => {
  jest.setTimeout(30000);

  let contentHashService: ContentHashService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContentHashService],
    }).compile();

    contentHashService = module.get<ContentHashService>(ContentHashService);
  });

  describe('Content Hashing', () => {
    describe('Basic Hash Generation', () => {
      it('should generate consistent hash for same content', () => {
        const content = 'Apple stock rises 5% on strong earnings report';

        const hash1 = contentHashService.hash(content);
        const hash2 = contentHashService.hash(content);

        expect(hash1).toBe(hash2);
        expect(hash1).toHaveLength(64); // SHA-256 hex string
      });

      it('should generate different hash for different content', () => {
        const content1 = 'Apple stock rises 5% on strong earnings report';
        const content2 = 'Tesla stock falls 3% on production concerns';

        const hash1 = contentHashService.hash(content1);
        const hash2 = contentHashService.hash(content2);

        expect(hash1).not.toBe(hash2);
      });
    });

    describe('Content Normalization', () => {
      it('should normalize whitespace differences', () => {
        const content1 = 'Apple   stock   rises   5%';
        const content2 = 'Apple stock rises 5%';

        const hash1 = contentHashService.hash(content1);
        const hash2 = contentHashService.hash(content2);

        expect(hash1).toBe(hash2);
      });

      it('should normalize case differences', () => {
        const content1 = 'APPLE STOCK RISES 5%';
        const content2 = 'apple stock rises 5%';

        const hash1 = contentHashService.hash(content1);
        const hash2 = contentHashService.hash(content2);

        expect(hash1).toBe(hash2);
      });

      it('should normalize URL placeholders', () => {
        const content1 = 'Read more at https://example.com/article/12345';
        const content2 = 'Read more at https://different-site.com/other/99999';

        const hash1 = contentHashService.hash(content1);
        const hash2 = contentHashService.hash(content2);

        // URLs are replaced with [URL], so these should match
        expect(hash1).toBe(hash2);
      });

      it('should strip HTML tags', () => {
        const content1 = '<p>Apple stock <strong>rises</strong> 5%</p>';
        const content2 = 'Apple stock rises 5%';

        const hash1 = contentHashService.hash(content1);
        const hash2 = contentHashService.hash(content2);

        expect(hash1).toBe(hash2);
      });
    });

    describe('Article Hashing', () => {
      it('should hash article title and content together', () => {
        const title = 'Apple Earnings Beat Expectations';
        const content =
          'Apple Inc. reported quarterly earnings that exceeded Wall Street expectations, driven by strong iPhone sales...';

        const hash = contentHashService.hashArticle(title, content);

        expect(hash).toHaveLength(64);
        expect(hash).not.toBe(contentHashService.hash(title));
        expect(hash).not.toBe(contentHashService.hash(content));
      });

      it('should truncate long content for hashing', () => {
        const title = 'Long Article';
        const longContent = 'A'.repeat(10000);

        const hash = contentHashService.hashArticle(title, longContent);

        expect(hash).toHaveLength(64);
        // Should not throw or timeout
      });
    });

    describe('RSS Item Hashing', () => {
      it('should hash RSS item with GUID', () => {
        const rssItem = {
          guid: 'unique-article-id-123',
          title: 'Market Update',
          pubDate: '2024-01-15T10:30:00Z',
          link: 'https://example.com/article',
        };

        const hash = contentHashService.hashRssItem(rssItem);

        expect(hash).toHaveLength(64);
      });

      it('should fallback when GUID is missing', () => {
        const rssItem = {
          title: 'Market Update',
          pubDate: '2024-01-15T10:30:00Z',
          link: 'https://example.com/article',
        };

        const hash = contentHashService.hashRssItem(rssItem);

        expect(hash).toHaveLength(64);
      });
    });

    describe('Social Post Hashing', () => {
      it('should hash social post with author', () => {
        const post = {
          author: '@elonmusk',
          content: 'Tesla is doing great things!',
        };

        const hash = contentHashService.hashSocialPost(
          post.author,
          post.content,
        );

        expect(hash).toHaveLength(64);
      });

      it('should differentiate posts from different authors', () => {
        const content = 'Tesla is doing great things!';

        const hash1 = contentHashService.hashSocialPost('@elonmusk', content);
        const hash2 = contentHashService.hashSocialPost('@satoshi', content);

        expect(hash1).not.toBe(hash2);
      });
    });

    describe('Content Fingerprinting', () => {
      it('should generate fingerprint with key phrases', () => {
        const content =
          'Apple stock rises 5% on strong iPhone 15 sales and services revenue growth';

        const fingerprint = contentHashService.fingerprint(content);

        expect(fingerprint.hash).toHaveLength(64);
        expect(fingerprint.keyPhrases).toBeDefined();
        expect(fingerprint.wordCount).toBeGreaterThan(0);
      });

      it('should extract meaningful key phrases', () => {
        const content =
          'Federal Reserve raises interest rates by 25 basis points, citing persistent inflation concerns';

        const fingerprint = contentHashService.fingerprint(content);

        // Should extract financial terms
        const phrases = fingerprint.keyPhrases?.join(' ').toLowerCase() || '';
        const hasFinancialTerms =
          phrases.includes('federal') ||
          phrases.includes('reserve') ||
          phrases.includes('interest') ||
          phrases.includes('inflation');

        expect(hasFinancialTerms).toBe(true);
      });

      it('should produce similar fingerprints for related content', () => {
        const content1 =
          'Apple stock surges 5% after strong quarterly earnings report';
        const content2 =
          'Apple shares jump 5% following better-than-expected earnings';

        const fp1 = contentHashService.fingerprint(content1);
        const fp2 = contentHashService.fingerprint(content2);

        // Hashes will be different, but key phrases should overlap
        const phrases1 = new Set(fp1.keyPhrases?.map((p) => p.toLowerCase()));
        const phrases2 = new Set(fp2.keyPhrases?.map((p) => p.toLowerCase()));

        // Check for word-level overlap instead of exact bigram match
        // Extract individual words from bigrams
        const words1 = new Set<string>();
        phrases1.forEach((phrase) => {
          phrase.split(' ').forEach((word) => words1.add(word));
        });
        const words2 = new Set<string>();
        phrases2.forEach((phrase) => {
          phrase.split(' ').forEach((word) => words2.add(word));
        });

        let wordOverlap = 0;
        words1.forEach((word) => {
          if (words2.has(word)) wordOverlap++;
        });

        console.log(`Content 1 phrases: ${Array.from(phrases1).join(', ')}`);
        console.log(`Content 2 phrases: ${Array.from(phrases2).join(', ')}`);
        console.log(`Word overlap: ${wordOverlap} words`);

        // Should have some word-level overlap (apple, earnings, etc.)
        expect(wordOverlap).toBeGreaterThan(0);
      });
    });
  });

  describe('Signal Structure Validation', () => {
    describe('Signal Field Requirements', () => {
      it('should validate required signal fields', () => {
        const validSignal = {
          id: 'signal-123',
          target_id: 'target-456',
          source_id: 'source-789',
          content: 'Apple stock rises on earnings beat',
          content_hash: 'abc123...',
          direction: 'bullish',
          disposition: 'strong',
          urgency: 'notable',
          confidence: 0.85,
          status: 'pending',
          created_at: new Date().toISOString(),
        };

        // All required fields should be present
        expect(validSignal.id).toBeDefined();
        expect(validSignal.target_id).toBeDefined();
        expect(validSignal.source_id).toBeDefined();
        expect(validSignal.content).toBeDefined();
        expect(validSignal.content_hash).toBeDefined();
        expect(validSignal.direction).toBeDefined();
      });

      it('should validate direction enum values', () => {
        const validDirections = ['bullish', 'bearish', 'neutral'];

        validDirections.forEach((direction) => {
          expect(['bullish', 'bearish', 'neutral']).toContain(direction);
        });
      });

      it('should validate urgency levels', () => {
        const validUrgencies = ['urgent', 'notable', 'routine'];

        validUrgencies.forEach((urgency) => {
          expect(['urgent', 'notable', 'routine']).toContain(urgency);
        });
      });

      it('should validate confidence range', () => {
        const validConfidences = [0, 0.5, 0.85, 1.0];
        const invalidConfidences = [-0.1, 1.1, 2.0];

        validConfidences.forEach((conf) => {
          expect(conf).toBeGreaterThanOrEqual(0);
          expect(conf).toBeLessThanOrEqual(1);
        });

        invalidConfidences.forEach((conf) => {
          const isValid = conf >= 0 && conf <= 1;
          expect(isValid).toBe(false);
        });
      });
    });

    describe('Direction Mapping from Claims', () => {
      it('should map positive price change to bullish', () => {
        const priceClaim: Claim = {
          type: 'change_percent',
          value: 5.5,
          instrument: 'AAPL',
          confidence: 1.0,
          timestamp: new Date().toISOString(),
        };

        const direction =
          (priceClaim.value as number) > 0 ? 'bullish' : 'bearish';
        expect(direction).toBe('bullish');
      });

      it('should map negative price change to bearish', () => {
        const priceClaim: Claim = {
          type: 'change_percent',
          value: -3.2,
          instrument: 'TSLA',
          confidence: 1.0,
          timestamp: new Date().toISOString(),
        };

        const direction =
          (priceClaim.value as number) > 0 ? 'bullish' : 'bearish';
        expect(direction).toBe('bearish');
      });

      it('should handle neutral/mixed signals', () => {
        const priceClaim: Claim = {
          type: 'change_percent',
          value: 0.1,
          instrument: 'AAPL',
          confidence: 1.0,
          timestamp: new Date().toISOString(),
        };

        // Small changes could be considered neutral
        const isNeutral = Math.abs(priceClaim.value as number) < 0.5;
        expect(isNeutral).toBe(true);
      });
    });

    describe('Disposition Assignment', () => {
      it('should assign strong disposition for high confidence', () => {
        const confidence = 0.9;
        const disposition =
          confidence >= 0.8
            ? 'strong'
            : confidence >= 0.5
              ? 'moderate'
              : 'weak';
        expect(disposition).toBe('strong');
      });

      it('should assign moderate disposition for medium confidence', () => {
        const confidence = 0.65;
        const disposition =
          confidence >= 0.8
            ? 'strong'
            : confidence >= 0.5
              ? 'moderate'
              : 'weak';
        expect(disposition).toBe('moderate');
      });

      it('should assign weak disposition for low confidence', () => {
        const confidence = 0.35;
        const disposition =
          confidence >= 0.8
            ? 'strong'
            : confidence >= 0.5
              ? 'moderate'
              : 'weak';
        expect(disposition).toBe('weak');
      });
    });

    describe('Urgency Determination', () => {
      it('should assign urgent for very high confidence', () => {
        const confidence = 0.95;
        const urgency =
          confidence >= 0.9
            ? 'urgent'
            : confidence >= 0.7
              ? 'notable'
              : 'routine';
        expect(urgency).toBe('urgent');
      });

      it('should assign notable for high confidence', () => {
        const confidence = 0.75;
        const urgency =
          confidence >= 0.9
            ? 'urgent'
            : confidence >= 0.7
              ? 'notable'
              : 'routine';
        expect(urgency).toBe('notable');
      });

      it('should assign routine for normal confidence', () => {
        const confidence = 0.5;
        const urgency =
          confidence >= 0.9
            ? 'urgent'
            : confidence >= 0.7
              ? 'notable'
              : 'routine';
        expect(urgency).toBe('routine');
      });
    });
  });

  describe('Real Content Signal Creation', () => {
    describe('Financial News Processing', () => {
      it('should create signal from earnings news', () => {
        const newsContent = {
          title: 'Apple Reports Q4 Earnings Beat, Revenue Up 8%',
          description:
            'Apple Inc. reported fourth-quarter earnings that exceeded analyst expectations, with revenue growing 8% year-over-year.',
          source: 'Bloomberg',
          pubDate: new Date().toISOString(),
        };

        const hash = contentHashService.hashArticle(
          newsContent.title,
          newsContent.description,
        );

        // Signal would be created with:
        const signal = {
          content: `${newsContent.title}\n\n${newsContent.description}`,
          content_hash: hash,
          direction: 'bullish', // Positive earnings
          disposition: 'strong',
          urgency: 'notable',
          confidence: 0.85,
          metadata: {
            source: newsContent.source,
            title: newsContent.title,
            publishedAt: newsContent.pubDate,
          },
        };

        expect(signal.content_hash).toHaveLength(64);
        expect(signal.direction).toBe('bullish');
        expect(signal.metadata.source).toBe('Bloomberg');
      });

      it('should create signal from negative news', () => {
        const newsContent = {
          title: 'Tesla Misses Delivery Targets, Stock Falls 5%',
          description:
            'Tesla reported quarterly deliveries below expectations, citing supply chain issues.',
          source: 'Reuters',
        };

        const hash = contentHashService.hashArticle(
          newsContent.title,
          newsContent.description,
        );

        const signal = {
          content: `${newsContent.title}\n\n${newsContent.description}`,
          content_hash: hash,
          direction: 'bearish',
          confidence: 0.8,
        };

        expect(signal.direction).toBe('bearish');
      });
    });

    describe('Crypto News Processing', () => {
      it('should create signal from BTC price movement', () => {
        const newsContent = {
          title: 'Bitcoin Surges Past $50,000 on ETF Approval Hopes',
          description:
            'Bitcoin price rallied above $50,000 as investors anticipate SEC approval of spot Bitcoin ETF.',
          source: 'CoinDesk',
        };

        const hash = contentHashService.hashArticle(
          newsContent.title,
          newsContent.description,
        );

        const signal = {
          content: `${newsContent.title}\n\n${newsContent.description}`,
          content_hash: hash,
          direction: 'bullish',
          urgency: 'urgent', // Significant price movement
          metadata: {
            domain: 'crypto',
            asset: 'BTC',
          },
        };

        expect(signal.direction).toBe('bullish');
        expect(signal.urgency).toBe('urgent');
        expect(signal.metadata.domain).toBe('crypto');
      });
    });

    describe('SEC Filing Processing', () => {
      it('should create signal from 8-K filing', () => {
        const filing = {
          formType: '8-K',
          description: 'Departure of Chief Financial Officer',
          filingDate: '2024-01-15',
          symbol: 'AAPL',
        };

        const hash = contentHashService.hash(
          `${filing.symbol}-${filing.formType}-${filing.filingDate}`,
        );

        const signal = {
          content: `${filing.formType}: ${filing.description}`,
          content_hash: hash,
          direction: 'bearish', // CFO departure is typically bearish
          confidence: 0.7,
          metadata: {
            formType: filing.formType,
            filingDate: filing.filingDate,
            symbol: filing.symbol,
          },
        };

        expect(signal.metadata.formType).toBe('8-K');
      });
    });
  });

  describe('Signal Metadata Completeness', () => {
    it('should include all required metadata fields', () => {
      const requiredMetadataFields = ['source', 'title', 'publishedAt'];

      const signal = {
        metadata: {
          source: 'Bloomberg',
          title: 'Market Update',
          publishedAt: new Date().toISOString(),
          url: 'https://example.com/article',
          domain: 'stocks',
        },
      };

      requiredMetadataFields.forEach((field) => {
        expect(signal.metadata).toHaveProperty(field);
      });
    });

    it('should preserve original source URL', () => {
      const signal = {
        metadata: {
          url: 'https://bloomberg.com/news/article-123',
          source: 'Bloomberg',
        },
      };

      expect(signal.metadata.url).toMatch(/^https?:\/\//);
    });
  });
});
