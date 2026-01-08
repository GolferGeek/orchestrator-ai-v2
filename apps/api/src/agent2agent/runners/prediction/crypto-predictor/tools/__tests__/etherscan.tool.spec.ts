/**
 * Etherscan Tool Tests
 *
 * Tests the EtherscanTool for fetching Ethereum on-chain data.
 * Uses mocked fetch to avoid actual API calls in unit tests.
 */

import {
  EtherscanTool,
  createEtherscanTool,
  EtherscanToolConfig,
} from '../etherscan.tool';
import type { Claim } from '../../../base/base-prediction.types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('EtherscanTool', () => {
  let tool: EtherscanTool;

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new EtherscanTool({ apiKey: 'test-api-key' });
  });

  describe('constructor', () => {
    it('should create tool with API key', () => {
      expect(tool.name).toBe('etherscan');
      expect(tool.description).toBe(
        'Fetches Ethereum on-chain data from Etherscan',
      );
    });

    it('should accept custom config', () => {
      const config: EtherscanToolConfig & { apiKey: string } = {
        timeoutMs: 5000,
        includeGasPrices: false,
        includeEthPrice: true,
        apiKey: 'custom-key',
      };
      const customTool = new EtherscanTool(config);
      expect(customTool.name).toBe('etherscan');
    });
  });

  describe('execute', () => {
    const mockGasOracleResponse = {
      status: '1',
      message: 'OK',
      result: {
        SafeGasPrice: '25',
        ProposeGasPrice: '30',
        FastGasPrice: '35',
        suggestBaseFee: '24',
        gasUsedRatio: '0.5,0.6,0.7',
      },
    };

    const mockEthPriceResponse = {
      status: '1',
      message: 'OK',
      result: {
        ethbtc: '0.055',
        ethbtc_timestamp: '1704710400',
        ethusd: '3000',
        ethusd_timestamp: '1704710400',
      },
    };

    it('should fetch gas prices successfully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockGasOracleResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockEthPriceResponse),
        });

      const sources = await tool.execute(['ETH']);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(sources.length).toBe(1);

      const source = sources[0]!;
      expect(source.tool).toBe('etherscan');
      expect(source.claims.length).toBeGreaterThan(0);
    });

    it('should extract safe gas price claim', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockGasOracleResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockEthPriceResponse),
        });

      const sources = await tool.execute(['ETH']);
      const safeGasClaim = sources[0]?.claims.find(
        (c: Claim) => c.type === 'gas_price' && c.metadata?.type === 'safe',
      );

      expect(safeGasClaim).toBeDefined();
      expect(safeGasClaim?.value).toBe(25);
      expect(safeGasClaim?.instrument).toBe('ETH');
      expect(safeGasClaim?.unit).toBe('gwei');
      expect(safeGasClaim?.confidence).toBe(1.0);
    });

    it('should extract propose gas price claim', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockGasOracleResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockEthPriceResponse),
        });

      const sources = await tool.execute(['ETH']);
      const proposeGasClaim = sources[0]?.claims.find(
        (c: Claim) => c.type === 'gas_price' && c.metadata?.type === 'propose',
      );

      expect(proposeGasClaim).toBeDefined();
      expect(proposeGasClaim?.value).toBe(30);
    });

    it('should extract fast gas price claim', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockGasOracleResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockEthPriceResponse),
        });

      const sources = await tool.execute(['ETH']);
      const fastGasClaim = sources[0]?.claims.find(
        (c: Claim) => c.type === 'gas_price' && c.metadata?.type === 'fast',
      );

      expect(fastGasClaim).toBeDefined();
      expect(fastGasClaim?.value).toBe(35);
    });

    it('should extract base fee claim', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockGasOracleResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockEthPriceResponse),
        });

      const sources = await tool.execute(['ETH']);
      const baseFeeClaim = sources[0]?.claims.find(
        (c: Claim) => c.type === 'gas_price' && c.metadata?.type === 'base_fee',
      );

      expect(baseFeeClaim).toBeDefined();
      expect(baseFeeClaim?.value).toBe(24);
    });

    it('should extract ETH price in USD', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockGasOracleResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockEthPriceResponse),
        });

      const sources = await tool.execute(['ETH']);
      const ethUsdClaim = sources[0]?.claims.find(
        (c: Claim) => c.type === 'price' && c.unit === 'USD',
      );

      expect(ethUsdClaim).toBeDefined();
      expect(ethUsdClaim?.value).toBe(3000);
      expect(ethUsdClaim?.instrument).toBe('ETH');
      expect(ethUsdClaim?.metadata?.source).toBe('etherscan');
    });

    it('should extract ETH price in BTC', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockGasOracleResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockEthPriceResponse),
        });

      const sources = await tool.execute(['ETH']);
      const ethBtcClaim = sources[0]?.claims.find(
        (c: Claim) => c.type === 'price' && c.unit === 'BTC',
      );

      expect(ethBtcClaim).toBeDefined();
      expect(ethBtcClaim?.value).toBe(0.055);
    });

    it('should handle only gas prices when ETH price disabled', async () => {
      const toolWithoutPrice = new EtherscanTool({
        apiKey: 'test-key',
        includeEthPrice: false,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGasOracleResponse),
      });

      const sources = await toolWithoutPrice.execute(['ETH']);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(
        sources[0]?.claims.some((c: Claim) => c.type === 'gas_price'),
      ).toBe(true);
      expect(sources[0]?.claims.some((c: Claim) => c.type === 'price')).toBe(
        false,
      );
    });

    it('should handle only ETH price when gas prices disabled', async () => {
      const toolWithoutGas = new EtherscanTool({
        apiKey: 'test-key',
        includeGasPrices: false,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEthPriceResponse),
      });

      const sources = await toolWithoutGas.execute(['ETH']);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(sources[0]?.claims.some((c: Claim) => c.type === 'price')).toBe(
        true,
      );
      expect(
        sources[0]?.claims.some((c: Claim) => c.type === 'gas_price'),
      ).toBe(false);
    });

    it('should handle API error for gas oracle', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              status: '0',
              message: 'NOTOK',
              result: 'Max rate limit reached',
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockEthPriceResponse),
        });

      const sources = await tool.execute(['ETH']);

      // Should still return ETH price data
      expect(sources.length).toBe(1);
      expect(sources[0]?.claims.some((c: Claim) => c.type === 'price')).toBe(
        true,
      );
    });

    it('should return error source when no data available', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              status: '0',
              message: 'NOTOK',
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              status: '0',
              message: 'NOTOK',
            }),
        });

      const sources = await tool.execute(['ETH']);

      expect(sources.length).toBe(1);
      expect(sources[0]?.metadata?.error).toBe(true);
    });

    it('should return error source on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const sources = await tool.execute(['ETH']);

      expect(sources.length).toBe(1);
      expect(sources[0]?.metadata?.error).toBe(true);
      expect(sources[0]?.metadata?.errorMessage).toContain('Network error');
    });

    it('should handle timeout', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const sources = await tool.execute(['ETH']);

      expect(sources.length).toBe(1);
      expect(sources[0]?.metadata?.error).toBe(true);
    });
  });

  describe('source metadata', () => {
    it('should include correct metadata', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              status: '1',
              message: 'OK',
              result: {
                SafeGasPrice: '25',
                ProposeGasPrice: '30',
                FastGasPrice: '35',
                suggestBaseFee: '24',
                gasUsedRatio: '0.5,0.6,0.7',
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              status: '1',
              message: 'OK',
              result: {
                ethbtc: '0.055',
                ethbtc_timestamp: '1704710400',
                ethusd: '3000',
                ethusd_timestamp: '1704710400',
              },
            }),
        });

      const sources = await tool.execute(['ETH']);

      expect(sources[0]?.metadata).toMatchObject({
        exchange: 'etherscan',
        chain: 'ethereum',
      });
    });
  });
});

describe('createEtherscanTool factory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ETHERSCAN_API_KEY;
  });

  it('should return null when no API key is configured', () => {
    const tool = createEtherscanTool();
    expect(tool).toBeNull();
  });

  it('should create tool when API key is provided in config', () => {
    const tool = createEtherscanTool({ apiKey: 'test-key' });
    expect(tool).toBeInstanceOf(EtherscanTool);
    expect(tool?.name).toBe('etherscan');
  });

  it('should create tool when API key is in environment', () => {
    process.env.ETHERSCAN_API_KEY = 'env-api-key';
    const tool = createEtherscanTool();
    expect(tool).toBeInstanceOf(EtherscanTool);
  });

  it('should prefer config API key over environment', () => {
    process.env.ETHERSCAN_API_KEY = 'env-key';
    const tool = createEtherscanTool({ apiKey: 'config-key' });
    expect(tool).toBeInstanceOf(EtherscanTool);
  });
});
