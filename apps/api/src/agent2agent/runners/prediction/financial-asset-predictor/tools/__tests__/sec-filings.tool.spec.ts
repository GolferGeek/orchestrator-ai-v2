/**
 * SEC Filings Tool Tests
 *
 * Tests the SecFilingsTool for fetching SEC EDGAR filings.
 * Uses mocked fetch to avoid actual API calls in unit tests.
 */

import { SecFilingsTool, SecFilingsToolConfig } from '../sec-filings.tool';
import { Claim } from '../../../base/base-prediction.types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('SecFilingsTool', () => {
  let tool: SecFilingsTool;

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new SecFilingsTool();
  });

  describe('constructor', () => {
    it('should create tool with default config', () => {
      expect(tool.name).toBe('sec-filings');
      expect(tool.description).toBe('Fetches SEC EDGAR filings for companies');
    });

    it('should accept custom config', () => {
      const config: SecFilingsToolConfig = {
        userAgentEmail: 'compliance@example.com',
        filingTypes: ['8-K', '10-K'],
        lookbackDays: 30,
        timeoutMs: 5000,
      };
      const customTool = new SecFilingsTool(config);
      expect(customTool.name).toBe('sec-filings');
    });
  });

  describe('execute', () => {
    const mockSecResponse = {
      cik: '0000320193',
      name: 'Apple Inc.',
      filings: {
        recent: {
          filingDate: [
            '2026-01-05',
            '2025-12-15',
            '2025-11-01',
            '2025-10-15',
            '2025-01-01', // Old filing, outside lookback
          ],
          form: ['8-K', '10-Q', '8-K', '10-K', '8-K'],
          filmNumber: ['12345', '12346', '12347', '12348', '12349'],
          description: [
            'Material Event',
            'Quarterly Report',
            'Leadership Change',
            'Annual Report',
            'Old Event',
          ],
          size: ['10000', '500000', '15000', '1000000', '8000'],
          primaryDocument: [
            'filing1.htm',
            'filing2.htm',
            'filing3.htm',
            'filing4.htm',
            'filing5.htm',
          ],
          accessionNumber: [
            '0000320193-26-000001',
            '0000320193-25-000002',
            '0000320193-25-000003',
            '0000320193-25-000004',
            '0000320193-25-000005',
          ],
        },
      },
    };

    it('should fetch SEC filings successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSecResponse),
      });

      const sources = await tool.execute(['AAPL']);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(sources.length).toBe(1);
    });

    it('should filter filings within lookback period', async () => {
      // Use fake timers for this test to control date
      jest.useFakeTimers();
      const now = new Date('2026-01-07');
      jest.setSystemTime(now);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSecResponse),
      });

      const sources = await tool.execute(['AAPL']);

      // Should only include filings from last 90 days (default)
      // Jan 7 2026 - 90 days = Oct 9 2025
      const claims = sources[0]?.claims || [];

      // The oldest filing (2025-01-01) should be excluded
      const oldFilingClaim = claims.find(
        (c: Claim) => c.metadata?.description === 'Old Event',
      );
      expect(oldFilingClaim).toBeUndefined();

      jest.useRealTimers();
    });

    it('should extract filing claims correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSecResponse),
      });

      const sources = await tool.execute(['AAPL']);

      const filingClaims = sources[0]?.claims.filter(
        (c: Claim) => c.type === 'filing',
      );

      expect(filingClaims?.length).toBeGreaterThan(0);

      const firstFiling = filingClaims?.[0];
      expect(firstFiling?.instrument).toBe('AAPL');
      expect(firstFiling?.value).toBe('8-K');
      expect(firstFiling?.confidence).toBe(1.0);
      expect(firstFiling?.metadata?.source).toBe('SEC EDGAR');
    });

    it('should create event claims for 8-K filings', async () => {
      const recent8kResponse = {
        cik: '0000320193',
        name: 'Apple Inc.',
        filings: {
          recent: {
            filingDate: ['2026-01-05'],
            form: ['8-K'],
            description: ['Material Event - Executive Change'],
            accessionNumber: ['0000320193-26-000001'],
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(recent8kResponse),
      });

      const sources = await tool.execute(['AAPL']);

      const eventClaims = sources[0]?.claims.filter(
        (c: Claim) => c.type === 'event',
      );

      expect(eventClaims?.length).toBe(1);
      expect(eventClaims?.[0]?.value).toBe('Material Event Reported');
      expect(eventClaims?.[0]?.metadata?.eventType).toBe('8-K Filing');
    });

    it('should create event claims for 10-K annual reports', async () => {
      const annualResponse = {
        cik: '0000320193',
        name: 'Apple Inc.',
        filings: {
          recent: {
            filingDate: ['2026-01-05'],
            form: ['10-K'],
            description: ['Annual Report'],
            accessionNumber: ['0000320193-26-000001'],
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(annualResponse),
      });

      const sources = await tool.execute(['AAPL']);

      const eventClaims = sources[0]?.claims.filter(
        (c: Claim) => c.type === 'event',
      );

      expect(eventClaims?.length).toBe(1);
      expect(eventClaims?.[0]?.value).toBe('Annual Report Filed');
      expect(eventClaims?.[0]?.metadata?.eventType).toBe('10-K Filing');
    });

    it('should create event claims for 10-Q quarterly reports', async () => {
      const quarterlyResponse = {
        cik: '0000789019',
        name: 'Microsoft Corporation',
        filings: {
          recent: {
            filingDate: ['2026-01-05'],
            form: ['10-Q'],
            description: ['Quarterly Report'],
            accessionNumber: ['0000789019-26-000001'],
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(quarterlyResponse),
      });

      const sources = await tool.execute(['MSFT']);

      const eventClaims = sources[0]?.claims.filter(
        (c: Claim) => c.type === 'event',
      );

      expect(eventClaims?.length).toBe(1);
      expect(eventClaims?.[0]?.value).toBe('Quarterly Report Filed');
      expect(eventClaims?.[0]?.metadata?.eventType).toBe('10-Q Filing');
    });

    it('should handle multiple instruments with rate limiting', async () => {
      const aaplResponse = {
        cik: '0000320193',
        name: 'Apple Inc.',
        filings: {
          recent: {
            filingDate: ['2026-01-05'],
            form: ['8-K'],
            accessionNumber: ['0000320193-26-000001'],
          },
        },
      };

      const msftResponse = {
        cik: '0000789019',
        name: 'Microsoft Corporation',
        filings: {
          recent: {
            filingDate: ['2026-01-04'],
            form: ['8-K'],
            accessionNumber: ['0000789019-26-000001'],
          },
        },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(aaplResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(msftResponse),
        });

      const sources = await tool.execute(['AAPL', 'MSFT']);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(sources.length).toBe(2);
    });

    it('should skip instruments without CIK mapping', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            cik: '0000320193',
            name: 'Apple Inc.',
            filings: {
              recent: {
                filingDate: ['2026-01-05'],
                form: ['8-K'],
                accessionNumber: ['0000320193-26-000001'],
              },
            },
          }),
      });

      // UNKNOWN has no CIK mapping
      const sources = await tool.execute(['AAPL', 'UNKNOWN']);

      // Should only fetch AAPL, not UNKNOWN
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(sources.length).toBe(1);
    });

    it('should return empty sources when no filings match', async () => {
      const noFilingsResponse = {
        cik: '0000320193',
        name: 'Apple Inc.',
        filings: {
          recent: {
            filingDate: [],
            form: [],
            accessionNumber: [],
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(noFilingsResponse),
      });

      const sources = await tool.execute(['AAPL']);

      expect(sources.length).toBe(0);
    });

    it('should filter by specified filing types', async () => {
      const customTool = new SecFilingsTool({
        filingTypes: ['10-K'], // Only annual reports
      });

      const mixedFilingsResponse = {
        cik: '0000320193',
        name: 'Apple Inc.',
        filings: {
          recent: {
            filingDate: ['2026-01-05', '2026-01-04', '2026-01-03'],
            form: ['8-K', '10-Q', '10-K'],
            accessionNumber: [
              '0000320193-26-000001',
              '0000320193-26-000002',
              '0000320193-26-000003',
            ],
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mixedFilingsResponse),
      });

      const sources = await customTool.execute(['AAPL']);

      const filingClaims = sources[0]?.claims.filter(
        (c: Claim) => c.type === 'filing',
      );

      expect(filingClaims?.length).toBe(1);
      expect(filingClaims?.[0]?.value).toBe('10-K');
    });

    it('should include source metadata', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            cik: '0000320193',
            name: 'Apple Inc.',
            filings: {
              recent: {
                filingDate: ['2026-01-05'],
                form: ['8-K'],
                accessionNumber: ['0000320193-26-000001'],
              },
            },
          }),
      });

      const sources = await tool.execute(['AAPL']);

      expect(sources[0]?.metadata?.source).toBe('SEC EDGAR');
      expect(sources[0]?.metadata?.cik).toBe('0000320193');
      expect(sources[0]?.metadata?.companyName).toBe('Apple Inc.');
    });

    it('should handle API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const sources = await tool.execute(['AAPL']);

      // Tool continues even when one company fails
      expect(sources.length).toBe(0);
    });

    it('should handle network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const sources = await tool.execute(['AAPL']);

      expect(sources.length).toBe(0);
    });

    it('should handle timeout', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const sources = await tool.execute(['AAPL']);

      expect(sources.length).toBe(0);
    });

    it('should set correct User-Agent header', async () => {
      const customTool = new SecFilingsTool({
        userAgentEmail: 'test@example.com',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            cik: '0000320193',
            name: 'Apple Inc.',
            filings: { recent: { filingDate: [], form: [] } },
          }),
      });

      await customTool.execute(['AAPL']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('test@example.com'),
          }),
        }),
      );
    });

    it('should construct correct SEC API URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            cik: '0000320193',
            name: 'Apple Inc.',
            filings: { recent: { filingDate: [], form: [] } },
          }),
      });

      await tool.execute(['AAPL']);

      // AAPL CIK is 0000320193
      expect(mockFetch).toHaveBeenCalledWith(
        'https://data.sec.gov/submissions/CIK0000320193.json',
        expect.any(Object),
      );
    });

    it('should handle missing filings data gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            cik: '0000320193',
            name: 'Apple Inc.',
            // No filings property
          }),
      });

      const sources = await tool.execute(['AAPL']);

      expect(sources.length).toBe(0);
    });

    it('should support all known ticker-CIK mappings', async () => {
      const knownTickers = [
        'AAPL',
        'MSFT',
        'GOOGL',
        'GOOG',
        'AMZN',
        'TSLA',
        'NVDA',
        'META',
        'NFLX',
        'AMD',
      ];

      // Mock all fetches
      for (const ticker of knownTickers) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              cik: '0000000001',
              name: `${ticker} Corp`,
              filings: { recent: { filingDate: [], form: [] } },
            }),
        });
      }

      await tool.execute(knownTickers);

      // All tickers should have fetched (GOOGL and GOOG share same CIK but both should work)
      expect(mockFetch).toHaveBeenCalledTimes(knownTickers.length);
    });
  });
});
