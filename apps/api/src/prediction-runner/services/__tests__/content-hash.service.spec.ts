import { Test, TestingModule } from '@nestjs/testing';
import { ContentHashService } from '../content-hash.service';

describe('ContentHashService', () => {
  let service: ContentHashService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContentHashService],
    }).compile();

    service = module.get<ContentHashService>(ContentHashService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('hash', () => {
    it('should generate consistent SHA-256 hash for same content', () => {
      const content = 'Test content for hashing';
      const hash1 = service.hash(content);
      const hash2 = service.hash(content);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex chars
    });

    it('should generate different hashes for different content', () => {
      const hash1 = service.hash('Content A');
      const hash2 = service.hash('Content B');

      expect(hash1).not.toBe(hash2);
    });

    it('should normalize content by default', () => {
      const hash1 = service.hash('  Test   content  ');
      const hash2 = service.hash('test content');

      expect(hash1).toBe(hash2);
    });

    it('should not normalize when normalize=false', () => {
      const hash1 = service.hash('  Test   content  ', false);
      const hash2 = service.hash('test content', false);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('normalizeContent', () => {
    it('should convert to lowercase', () => {
      const result = service.normalizeContent('HELLO WORLD');
      expect(result).toBe('hello world');
    });

    it('should collapse multiple whitespace', () => {
      const result = service.normalizeContent('hello    world');
      expect(result).toBe('hello world');
    });

    it('should trim leading/trailing whitespace', () => {
      const result = service.normalizeContent('  hello world  ');
      expect(result).toBe('hello world');
    });

    it('should replace URLs with placeholder', () => {
      const result = service.normalizeContent(
        'Check out https://example.com/page?param=value for more info',
      );
      expect(result).toBe('check out [URL] for more info');
    });

    it('should decode HTML entities', () => {
      const result = service.normalizeContent('Tom &amp; Jerry');
      expect(result).toBe('tom & jerry');
    });

    it('should remove HTML tags', () => {
      const result = service.normalizeContent(
        '<p>Hello <strong>World</strong></p>',
      );
      expect(result).toBe('hello world');
    });
  });

  describe('hashArticle', () => {
    it('should combine title and content for hash', () => {
      const hash1 = service.hashArticle('Title A', 'Content here');
      const hash2 = service.hashArticle('Title B', 'Content here');

      expect(hash1).not.toBe(hash2);
    });

    it('should use only first N characters of content', () => {
      const longContent = 'x'.repeat(1000);
      const hash1 = service.hashArticle('Title', longContent, 100);
      const hash2 = service.hashArticle('Title', longContent + 'extra', 100);

      expect(hash1).toBe(hash2);
    });
  });

  describe('hashSocialPost', () => {
    it('should include author ID in hash', () => {
      const hash1 = service.hashSocialPost('author1', 'Same content');
      const hash2 = service.hashSocialPost('author2', 'Same content');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('hashRssItem', () => {
    it('should use guid if available', () => {
      const hash1 = service.hashRssItem({
        guid: 'unique-guid-123',
        title: 'Title',
      });
      const hash2 = service.hashRssItem({
        guid: 'unique-guid-123',
        title: 'Different Title',
      });

      expect(hash1).toBe(hash2);
    });

    it('should fall back to title+pubDate+link if no guid', () => {
      const hash1 = service.hashRssItem({
        title: 'Title',
        pubDate: '2024-01-01',
        link: 'https://example.com',
      });
      const hash2 = service.hashRssItem({
        title: 'Title',
        pubDate: '2024-01-01',
        link: 'https://example.com',
      });

      expect(hash1).toBe(hash2);
    });
  });

  describe('isSimilar', () => {
    it('should return true for identical normalized content', () => {
      const result = service.isSimilar('Hello World', 'hello   world');
      expect(result).toBe(true);
    });

    it('should return true when one is substring of other', () => {
      const result = service.isSimilar(
        'Breaking news: Stock surges',
        'Breaking news: Stock surges after earnings',
      );
      expect(result).toBe(true);
    });

    it('should return true for high similarity', () => {
      const content1 =
        'Apple stock rises on strong iPhone sales and services growth';
      const content2 =
        'Apple stock rises on strong iPhone sales and services growth today';
      const result = service.isSimilar(content1, content2, 0.7);
      expect(result).toBe(true);
    });

    it('should return false for dissimilar content', () => {
      const result = service.isSimilar(
        'Apple announces new iPhone',
        'Microsoft releases new Surface',
      );
      expect(result).toBe(false);
    });
  });

  describe('extractKeyPhrases', () => {
    it('should extract bigrams as phrases', () => {
      const phrases = service.extractKeyPhrases(
        'Apple stock rises on strong earnings',
        5,
      );
      expect(phrases.length).toBeGreaterThan(0);
      expect(phrases.length).toBeLessThanOrEqual(5);
    });

    it('should respect maxPhrases limit', () => {
      const longContent = 'word '.repeat(100);
      const phrases = service.extractKeyPhrases(longContent, 10);
      expect(phrases.length).toBeLessThanOrEqual(10);
    });
  });

  describe('fingerprint', () => {
    it('should return hash, keyPhrases, and wordCount', () => {
      const result = service.fingerprint(
        'Apple stock rises on strong earnings beat',
      );

      expect(result.hash).toBeDefined();
      expect(result.hash).toHaveLength(64);
      expect(result.keyPhrases).toBeInstanceOf(Array);
      expect(typeof result.wordCount).toBe('number');
      expect(result.wordCount).toBeGreaterThan(0);
    });
  });
});
