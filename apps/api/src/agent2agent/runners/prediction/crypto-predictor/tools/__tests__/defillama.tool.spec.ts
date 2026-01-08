/**
 * DefiLlama Tool Tests
 *
 * Tests the DefiLlamaTool for fetching DeFi protocol metrics.
 * Uses mocked fetch to avoid actual API calls in unit tests.
 */

import { DefiLlamaTool, DefiLlamaToolConfig } from '../defillama.tool';
import type { Claim } from '../../../base/base-prediction.types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('DefiLlamaTool', () => {
  let tool: DefiLlamaTool;

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new DefiLlamaTool();
  });

  describe('constructor', () => {
    it('should create tool with default config', () => {
      expect(tool.name).toBe('defillama');
      expect(tool.description).toBe(
        'Fetches DeFi protocol metrics from DefiLlama',
      );
    });

    it('should accept custom config', () => {
      const config: DefiLlamaToolConfig = {
        timeoutMs: 20000,
        includeChainTVL: false,
      };
      const customTool = new DefiLlamaTool(config);
      expect(customTool.name).toBe('defillama');
    });
  });

  describe('execute', () => {
    const mockProtocolsResponse = [
      {
        id: '1',
        name: 'Uniswap',
        address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
        symbol: 'UNI',
        url: 'https://uniswap.org',
        description: 'Decentralized exchange',
        chain: 'Ethereum',
        logo: 'https://example.com/uni.png',
        category: 'Dexes',
        chains: ['Ethereum', 'Polygon', 'Arbitrum'],
        slug: 'uniswap',
        tvl: 5_000_000_000,
        chainTvls: {
          Ethereum: 3_500_000_000,
          Polygon: 1_000_000_000,
          Arbitrum: 500_000_000,
        },
        change_1h: 0.5,
        change_1d: 2.3,
        change_7d: 5.8,
        fdv: 6_000_000_000,
        mcap: 4_500_000_000,
      },
    ];

    const mockChainsResponse = [
      {
        gecko_id: 'ethereum',
        tvl: 50_000_000_000,
        tokenSymbol: 'ETH',
        cmcId: '1027',
        name: 'Ethereum',
        chainId: 1,
      },
    ];

    it('should fetch protocol data successfully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProtocolsResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockChainsResponse),
        });

      const sources = await tool.execute(['uniswap']);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(sources.length).toBeGreaterThan(0);
    });

    it('should extract TVL claim from protocol', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProtocolsResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockChainsResponse),
        });

      const sources = await tool.execute(['uniswap']);
      const protocolSource = sources.find(
        (s) => s.metadata?.protocolId === '1',
      );

      const tvlClaim = protocolSource?.claims.find(
        (c: Claim) => c.type === 'tvl' && !c.metadata?.chain,
      );

      expect(tvlClaim).toBeDefined();
      expect(tvlClaim?.value).toBe(5_000_000_000);
      expect(tvlClaim?.unit).toBe('USD');
      expect(tvlClaim?.instrument).toBe('UNI');
      expect(tvlClaim?.confidence).toBe(1.0);
    });

    it('should extract TVL change claims', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProtocolsResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockChainsResponse),
        });

      const sources = await tool.execute(['uniswap']);
      const protocolSource = sources.find(
        (s) => s.metadata?.protocolId === '1',
      );

      const claims = protocolSource?.claims || [];

      const change1h = claims.find(
        (c: Claim) =>
          c.type === 'change_percent' && c.metadata?.period === '1h',
      );
      expect(change1h?.value).toBe(0.5);

      const change1d = claims.find(
        (c: Claim) =>
          c.type === 'change_percent' && c.metadata?.period === '1d',
      );
      expect(change1d?.value).toBe(2.3);

      const change7d = claims.find(
        (c: Claim) =>
          c.type === 'change_percent' && c.metadata?.period === '7d',
      );
      expect(change7d?.value).toBe(5.8);
    });

    it('should extract market cap claims', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProtocolsResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockChainsResponse),
        });

      const sources = await tool.execute(['uniswap']);
      const protocolSource = sources.find(
        (s) => s.metadata?.protocolId === '1',
      );

      const claims = protocolSource?.claims || [];

      const mcapClaim = claims.find(
        (c: Claim) => c.type === 'market_cap' && !c.metadata?.type,
      );
      expect(mcapClaim?.value).toBe(4_500_000_000);

      const fdvClaim = claims.find(
        (c: Claim) =>
          c.type === 'market_cap' &&
          c.metadata?.type === 'fully_diluted_valuation',
      );
      expect(fdvClaim?.value).toBe(6_000_000_000);
      expect(fdvClaim?.confidence).toBe(0.95);
    });

    it('should extract chain-specific TVL claims', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProtocolsResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockChainsResponse),
        });

      const sources = await tool.execute(['uniswap']);
      const protocolSource = sources.find(
        (s) => s.metadata?.protocolId === '1',
      );

      const claims = protocolSource?.claims || [];

      const ethereumTvl = claims.find(
        (c: Claim) => c.type === 'tvl' && c.metadata?.chain === 'Ethereum',
      );
      expect(ethereumTvl?.value).toBe(3_500_000_000);

      const polygonTvl = claims.find(
        (c: Claim) => c.type === 'tvl' && c.metadata?.chain === 'Polygon',
      );
      expect(polygonTvl?.value).toBe(1_000_000_000);

      const arbitrumTvl = claims.find(
        (c: Claim) => c.type === 'tvl' && c.metadata?.chain === 'Arbitrum',
      );
      expect(arbitrumTvl?.value).toBe(500_000_000);
    });

    it('should fetch chain-level TVL data', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockChainsResponse),
        });

      const sources = await tool.execute(['ethereum']);

      const chainSource = sources.find(
        (s) => s.metadata?.chainName === 'Ethereum',
      );

      expect(chainSource).toBeDefined();

      const tvlClaim = chainSource?.claims.find((c: Claim) => c.type === 'tvl');
      expect(tvlClaim?.value).toBe(50_000_000_000);
      expect(tvlClaim?.metadata?.type).toBe('chain_tvl');
    });

    it('should handle protocol name normalization', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProtocolsResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockChainsResponse),
        });

      const sources = await tool.execute(['Uniswap', 'UNISWAP']);

      expect(sources.length).toBeGreaterThan(0);
    });

    it('should skip chain TVL when disabled', async () => {
      const toolWithoutChain = new DefiLlamaTool({ includeChainTVL: false });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProtocolsResponse),
      });

      const sources = await toolWithoutChain.execute(['uniswap']);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(sources.every((s) => !s.metadata?.chainName)).toBe(true);
    });

    it('should return empty source when no matches found', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

      const sources = await tool.execute(['unknown-protocol']);

      expect(sources.length).toBe(1);
      expect(sources[0]?.claims.length).toBe(0);
      expect(sources[0]?.metadata?.message).toContain(
        'No matching protocols or chains found',
      );
    });

    it('should return empty source when API returns error status', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        });

      const sources = await tool.execute(['uniswap']);

      // DefiLlama tool returns empty arrays when API fails (doesn't throw)
      expect(sources.length).toBe(1);
      expect(sources[0]?.claims.length).toBe(0);
      expect(sources[0]?.metadata?.message).toContain(
        'No matching protocols or chains found',
      );
    });

    it('should return error source on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const sources = await tool.execute(['uniswap']);

      expect(sources.length).toBe(1);
      expect(sources[0]?.metadata?.error).toBe(true);
      expect(sources[0]?.metadata?.errorMessage).toContain('Network error');
    });

    it('should handle timeout', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const sources = await tool.execute(['uniswap']);

      expect(sources.length).toBe(1);
      expect(sources[0]?.metadata?.error).toBe(true);
    });
  });

  describe('source metadata', () => {
    it('should include correct protocol metadata', async () => {
      const mockProtocols = [
        {
          id: '1',
          name: 'Uniswap',
          symbol: 'UNI',
          category: 'Dexes',
          chains: ['Ethereum', 'Polygon'],
          slug: 'uniswap',
          tvl: 5_000_000_000,
          chainTvls: {},
          chain: 'Ethereum',
        },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProtocols),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

      const sources = await tool.execute(['uniswap']);

      expect(sources[0]?.metadata).toMatchObject({
        protocolId: '1',
        protocolName: 'Uniswap',
        category: 'Dexes',
        chains: ['Ethereum', 'Polygon'],
        exchange: 'defillama',
      });
    });

    it('should include correct chain metadata', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                gecko_id: 'ethereum',
                tvl: 50_000_000_000,
                tokenSymbol: 'ETH',
                cmcId: '1027',
                name: 'Ethereum',
                chainId: 1,
              },
            ]),
        });

      const sources = await tool.execute(['ethereum']);

      expect(sources[0]?.metadata).toMatchObject({
        chainName: 'Ethereum',
        chainId: 1,
        geckoId: 'ethereum',
        exchange: 'defillama',
      });
    });
  });

  describe('protocol mapping', () => {
    it('should match protocols by name', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: '1',
                name: 'Aave',
                slug: 'aave',
                symbol: 'AAVE',
                tvl: 5_000_000_000,
                chainTvls: {},
                chain: 'Ethereum',
                category: 'Lending',
                chains: ['Ethereum'],
              },
            ]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

      const sources = await tool.execute(['aave']);

      const aaveSource = sources.find(
        (s) => s.metadata?.protocolName === 'Aave',
      );
      expect(aaveSource).toBeDefined();
    });

    it('should match protocols by slug', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: '2',
                name: 'Curve Finance',
                slug: 'curve',
                symbol: 'CRV',
                tvl: 3_000_000_000,
                chainTvls: {},
                chain: 'Ethereum',
                category: 'Dexes',
                chains: ['Ethereum'],
              },
            ]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

      const sources = await tool.execute(['curve']);

      const curveSource = sources.find(
        (s) => s.metadata?.protocolName === 'Curve Finance',
      );
      expect(curveSource).toBeDefined();
    });

    it('should ignore case and special characters in matching', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: '3',
                name: 'Compound V3',
                slug: 'compound-v3',
                symbol: 'COMP',
                tvl: 2_000_000_000,
                chainTvls: {},
                chain: 'Ethereum',
                category: 'Lending',
                chains: ['Ethereum'],
              },
            ]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

      const sources = await tool.execute(['COMPOUND-V3']);

      const compoundSource = sources.find(
        (s) => s.metadata?.protocolName === 'Compound V3',
      );
      expect(compoundSource).toBeDefined();
    });
  });
});
