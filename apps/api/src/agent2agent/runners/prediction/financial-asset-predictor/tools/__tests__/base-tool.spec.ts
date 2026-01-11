/**
 * Base Tool Tests
 *
 * Tests the BasePredictionTool abstract class helper methods.
 */

import {
  BasePredictionTool,
  PredictionToolContract,
  ToolConfig,
} from '../base-tool';
import type { Source, Claim } from '../../../base/base-prediction.types';

// Concrete implementation for testing
class TestTool extends BasePredictionTool {
  readonly name = 'test-tool';
  readonly description = 'A test tool for unit testing';

  private mockResponse: unknown = {};
  private shouldFail = false;
  private failureError = 'Mock error';

  setMockResponse(response: unknown): void {
    this.mockResponse = response;
  }

  setFailure(shouldFail: boolean, error = 'Mock error'): void {
    this.shouldFail = shouldFail;
    this.failureError = error;
  }

  protected async fetchData(_instruments: string[]): Promise<unknown> {
    if (this.shouldFail) {
      throw new Error(this.failureError);
    }
    return this.mockResponse;
  }

  protected parseResponse(response: unknown, _instruments: string[]): Source[] {
    const data = response as { claims?: Claim[] };
    if (data.claims) {
      return [this.createSource(data.claims)];
    }
    return [];
  }

  // Expose protected methods for testing
  public testCreateClaim(
    type: Claim['type'],
    instrument: string,
    value: number | string | boolean,
    options?: Parameters<BasePredictionTool['createClaim']>[3],
  ): Claim {
    return this.createClaim(type, instrument, value, options);
  }

  public testCreateSource(
    claims: Claim[],
    options?: Parameters<BasePredictionTool['createSource']>[1],
  ): Source {
    return this.createSource(claims, options);
  }

  public testCreateErrorSource(errorMessage: string): Source {
    return this.createErrorSource(errorMessage);
  }

  public testSafeNumber(
    value: unknown,
    fallback?: number | null,
  ): number | null {
    return this.safeNumber(value, fallback ?? null);
  }

  public testSafeString(value: unknown, fallback?: string): string {
    return this.safeString(value, fallback);
  }
}

describe('BasePredictionTool', () => {
  let tool: TestTool;

  beforeEach(() => {
    tool = new TestTool();
  });

  describe('execute', () => {
    it('should return sources on success', async () => {
      tool.setMockResponse({
        claims: [
          {
            type: 'price',
            instrument: 'AAPL',
            value: 175.5,
            confidence: 1,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      const sources = await tool.execute(['AAPL']);

      expect(sources.length).toBe(1);
      expect(sources[0]?.claims.length).toBe(1);
      expect(sources[0]?.tool).toBe('test-tool');
    });

    it('should return error source on failure', async () => {
      tool.setFailure(true, 'API rate limit exceeded');

      const sources = await tool.execute(['AAPL']);

      expect(sources.length).toBe(1);
      expect(sources[0]?.metadata?.error).toBe(true);
      expect(sources[0]?.metadata?.errorMessage).toContain('rate limit');
    });

    it('should never throw exceptions', async () => {
      tool.setFailure(true, 'Network timeout');

      await expect(tool.execute(['AAPL'])).resolves.not.toThrow();
    });
  });

  describe('createClaim', () => {
    it('should create claim with required fields', () => {
      const claim = tool.testCreateClaim('price', 'AAPL', 175.5);

      expect(claim.type).toBe('price');
      expect(claim.instrument).toBe('AAPL');
      expect(claim.value).toBe(175.5);
      expect(claim.confidence).toBe(1.0);
      expect(claim.timestamp).toBeDefined();
    });

    it('should accept optional fields', () => {
      const timestamp = '2026-01-07T10:00:00Z';
      const claim = tool.testCreateClaim('price', 'AAPL', 175.5, {
        unit: 'USD',
        confidence: 0.95,
        timestamp,
        metadata: { source: 'test' },
      });

      expect(claim.unit).toBe('USD');
      expect(claim.confidence).toBe(0.95);
      expect(claim.timestamp).toBe(timestamp);
      expect(claim.metadata).toEqual({ source: 'test' });
    });

    it('should handle string values', () => {
      const claim = tool.testCreateClaim('sentiment', 'AAPL', 'bullish');

      expect(claim.value).toBe('bullish');
    });

    it('should handle boolean values', () => {
      const claim = tool.testCreateClaim('news', 'AAPL', true);

      expect(claim.value).toBe(true);
    });
  });

  describe('createSource', () => {
    it('should create source with claims', () => {
      const claims: Claim[] = [
        {
          type: 'price',
          instrument: 'AAPL',
          value: 175.5,
          confidence: 1,
          timestamp: new Date().toISOString(),
        },
      ];

      const source = tool.testCreateSource(claims);

      expect(source.tool).toBe('test-tool');
      expect(source.claims).toBe(claims);
      expect(source.fetchedAt).toBeDefined();
    });

    it('should accept optional metadata', () => {
      const claims: Claim[] = [];
      const source = tool.testCreateSource(claims, {
        articleUrl: 'https://example.com/article',
        articleTitle: 'Test Article',
        publishedAt: '2026-01-07T10:00:00Z',
        metadata: { custom: 'data' },
      });

      expect(source.articleUrl).toBe('https://example.com/article');
      expect(source.articleTitle).toBe('Test Article');
      expect(source.publishedAt).toBe('2026-01-07T10:00:00Z');
      expect(source.metadata).toEqual({ custom: 'data' });
    });
  });

  describe('createErrorSource', () => {
    it('should create error source with message', () => {
      const source = tool.testCreateErrorSource('Connection timeout');

      expect(source.tool).toBe('test-tool');
      expect(source.claims).toEqual([]);
      expect(source.metadata?.error).toBe(true);
      expect(source.metadata?.errorMessage).toBe('Connection timeout');
    });
  });

  describe('safeNumber', () => {
    it('should return number for valid number', () => {
      expect(tool.testSafeNumber(42)).toBe(42);
      expect(tool.testSafeNumber(3.14159)).toBeCloseTo(3.14159);
      expect(tool.testSafeNumber(-100)).toBe(-100);
    });

    it('should parse string numbers', () => {
      expect(tool.testSafeNumber('42')).toBe(42);
      expect(tool.testSafeNumber('3.14')).toBeCloseTo(3.14);
      expect(tool.testSafeNumber('-50.5')).toBe(-50.5);
    });

    it('should return null for invalid values', () => {
      expect(tool.testSafeNumber(null)).toBeNull();
      expect(tool.testSafeNumber(undefined)).toBeNull();
      expect(tool.testSafeNumber('abc')).toBeNull();
      expect(tool.testSafeNumber({})).toBeNull();
      expect(tool.testSafeNumber([])).toBeNull();
    });

    it('should return null for NaN', () => {
      expect(tool.testSafeNumber(NaN)).toBeNull();
      expect(tool.testSafeNumber(Infinity)).toBe(Infinity); // Infinity is a valid number
    });

    it('should return fallback for invalid values', () => {
      expect(tool.testSafeNumber(null, 0)).toBe(0);
      expect(tool.testSafeNumber('invalid', -1)).toBe(-1);
    });
  });

  describe('safeString', () => {
    it('should return string for valid string', () => {
      expect(tool.testSafeString('hello')).toBe('hello');
      expect(tool.testSafeString('')).toBe('');
    });

    it('should convert numbers to string', () => {
      expect(tool.testSafeString(42)).toBe('42');
      expect(tool.testSafeString(3.14)).toBe('3.14');
    });

    it('should convert booleans to string', () => {
      expect(tool.testSafeString(true)).toBe('true');
      expect(tool.testSafeString(false)).toBe('false');
    });

    it('should return fallback for invalid values', () => {
      expect(tool.testSafeString(null)).toBe('');
      expect(tool.testSafeString(undefined)).toBe('');
      expect(tool.testSafeString({})).toBe('');
      expect(tool.testSafeString([])).toBe('');
    });

    it('should accept custom fallback', () => {
      expect(tool.testSafeString(null, 'default')).toBe('default');
      expect(tool.testSafeString(undefined, 'N/A')).toBe('N/A');
    });
  });
});

describe('PredictionToolContract interface', () => {
  it('should be implementable', () => {
    const mockTool: PredictionToolContract = {
      name: 'mock-tool',
      description: 'A mock tool',
      execute: async (_instruments: string[]): Promise<Source[]> => [],
    };

    expect(mockTool.name).toBe('mock-tool');
    expect(mockTool.description).toBe('A mock tool');
    expect(typeof mockTool.execute).toBe('function');
  });
});

describe('ToolConfig interface', () => {
  it('should allow all optional fields', () => {
    const config: ToolConfig = {};
    expect(config).toBeDefined();
  });

  it('should accept API key', () => {
    const config: ToolConfig = {
      apiKey: 'secret-key',
    };
    expect(config.apiKey).toBe('secret-key');
  });

  it('should accept all config options', () => {
    const config: ToolConfig = {
      apiKey: 'secret',
      baseUrl: 'https://api.example.com',
      timeoutMs: 5000,
      maxRetries: 3,
      rateLimit: 100,
    };

    expect(config.apiKey).toBe('secret');
    expect(config.baseUrl).toBe('https://api.example.com');
    expect(config.timeoutMs).toBe(5000);
    expect(config.maxRetries).toBe(3);
    expect(config.rateLimit).toBe(100);
  });
});
