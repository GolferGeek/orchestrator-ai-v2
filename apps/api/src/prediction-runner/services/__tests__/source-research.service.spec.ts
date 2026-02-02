import { Test, TestingModule } from '@nestjs/testing';
import { SourceResearchService } from '../source-research.service';
import { LLMGenerationService } from '@/llms/services/llm-generation.service';
import { MissInvestigation } from '../../interfaces/miss-investigation.interface';

describe('SourceResearchService', () => {
  let service: SourceResearchService;
  let llmGenerationService: jest.Mocked<LLMGenerationService>;

  const mockInvestigation: MissInvestigation = {
    id: 'inv-123',
    prediction: {
      id: 'pred-123',
      target_id: 'target-123',
      direction: 'up',
      magnitude: 'medium',
      confidence: 0.8,
      status: 'resolved',
      outcome_value: -5,
      predicted_at: '2024-01-01T10:00:00Z',
      target: {
        id: 'target-123',
        symbol: 'AAPL',
        name: 'Apple',
        target_type: 'stock',
      },
      consumedPredictors: [
        {
          id: 'predictor-1',
          signal: {
            id: 'sig-1',
            content: 'Bullish momentum detected',
            direction: 'bullish',
            source: { id: 'source-1', name: 'TestSource' },
          },
        },
      ],
    },
    missType: 'direction_wrong',
    predicted: { direction: 'up', magnitude: 'medium', confidence: 0.8 },
    actual: { direction: 'down', magnitude: 5 },
    investigationLevel: 'source',
    unusedPredictors: [],
    misreadSignals: [],
    investigatedAt: '2024-01-01T16:00:00Z',
  } as unknown as MissInvestigation;

  const mockLLMResponse = JSON.stringify({
    results: [
      {
        symbol: 'AAPL',
        discoveredDrivers: ['Earnings miss announcement', 'Negative guidance'],
        signalTypesNeeded: ['earnings_report', 'guidance_update'],
        suggestedSources: [
          { name: 'SEC EDGAR', type: 'sec_filing', description: '8-K filings' },
          { name: 'Bloomberg', type: 'news', description: 'Real-time news' },
        ],
        predictability: 'predictable',
        reasoning:
          'Clear signals from earnings report would have indicated direction',
      },
    ],
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SourceResearchService,
        {
          provide: LLMGenerationService,
          useValue: {
            generateResponse: jest.fn().mockResolvedValue(mockLLMResponse),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<SourceResearchService>(SourceResearchService);
    llmGenerationService = module.get(LLMGenerationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('researchMissBatch', () => {
    it('should research multiple misses in a batch', async () => {
      const investigations = [mockInvestigation];

      const result = await service.researchMissBatch(
        investigations,
        '2024-01-01',
      );

      expect(llmGenerationService.generateResponse).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.size).toBe(1);
    });

    it('should return empty map for empty investigations', async () => {
      const result = await service.researchMissBatch([], '2024-01-01');

      expect(result.size).toBe(0);
      expect(llmGenerationService.generateResponse).not.toHaveBeenCalled();
    });

    it('should parse research result correctly', async () => {
      const investigations = [mockInvestigation];

      const result = await service.researchMissBatch(
        investigations,
        '2024-01-01',
      );

      const research = result.get('inv-123');
      expect(research).toBeDefined();
      expect(research?.discoveredDrivers).toContain(
        'Earnings miss announcement',
      );
      expect(research?.predictability).toBe('predictable');
    });

    it('should include suggested sources', async () => {
      const investigations = [mockInvestigation];

      const result = await service.researchMissBatch(
        investigations,
        '2024-01-01',
      );

      const research = result.get('inv-123');
      expect(research?.suggestedSources.length).toBeGreaterThan(0);
      expect(research?.suggestedSources[0]?.name).toBe('SEC EDGAR');
    });

    it('should map source types correctly', async () => {
      const investigations = [mockInvestigation];

      const result = await service.researchMissBatch(
        investigations,
        '2024-01-01',
      );

      const research = result.get('inv-123');
      expect(research?.suggestedSources[0]?.type).toBe('sec_filing');
      expect(research?.suggestedSources[1]?.type).toBe('news');
    });

    it('should handle LLM errors', async () => {
      (llmGenerationService.generateResponse as jest.Mock).mockRejectedValue(
        new Error('LLM unavailable'),
      );

      await expect(
        service.researchMissBatch([mockInvestigation], '2024-01-01'),
      ).rejects.toThrow('LLM unavailable');
    });

    it('should handle invalid JSON response', async () => {
      (llmGenerationService.generateResponse as jest.Mock).mockResolvedValue(
        'not valid json',
      );

      const result = await service.researchMissBatch(
        [mockInvestigation],
        '2024-01-01',
      );

      // Should return empty map when parsing fails
      expect(result.size).toBe(0);
    });

    it('should handle markdown code blocks in response', async () => {
      const markdownResponse = '```json\n' + mockLLMResponse + '\n```';
      (llmGenerationService.generateResponse as jest.Mock).mockResolvedValue(
        markdownResponse,
      );

      const result = await service.researchMissBatch(
        [mockInvestigation],
        '2024-01-01',
      );

      expect(result.size).toBe(1);
    });
  });

  describe('generateSourceLevelLearning', () => {
    it('should generate learning suggestion from research results', () => {
      const research = {
        discoveredDrivers: ['Earnings miss'],
        signalsWeHad: [],
        signalTypesNeeded: ['earnings_report'],
        suggestedSources: [
          {
            name: 'SEC EDGAR',
            type: 'sec_filing' as const,
            description: 'Filing source',
          },
        ],
        predictability: 'predictable' as const,
        reasoning: 'Clear earnings signal',
      };

      const result = service.generateSourceLevelLearning(
        mockInvestigation,
        research,
      );

      expect(result).toBeDefined();
      expect(result?.type).toBe('rule');
      expect(result?.scope).toBe('universe');
      expect(result?.title).toContain('SEC EDGAR');
    });

    it('should return null for unpredictable events', () => {
      const research = {
        discoveredDrivers: ['Black swan event'],
        signalsWeHad: [],
        signalTypesNeeded: [],
        suggestedSources: [],
        predictability: 'unpredictable' as const,
        reasoning: 'Completely unexpected',
      };

      const result = service.generateSourceLevelLearning(
        mockInvestigation,
        research,
      );

      expect(result).toBeNull();
    });

    it('should return null when no sources suggested', () => {
      const research = {
        discoveredDrivers: ['Unknown factor'],
        signalsWeHad: [],
        signalTypesNeeded: [],
        suggestedSources: [],
        predictability: 'difficult' as const,
        reasoning: 'No clear source',
      };

      const result = service.generateSourceLevelLearning(
        mockInvestigation,
        research,
      );

      expect(result).toBeNull();
    });

    it('should include evidence from research', () => {
      const research = {
        discoveredDrivers: ['Earnings miss', 'Guidance cut'],
        signalsWeHad: [],
        signalTypesNeeded: ['earnings_report'],
        suggestedSources: [
          {
            name: 'Bloomberg',
            type: 'news' as const,
            description: 'News feed',
          },
        ],
        predictability: 'predictable' as const,
        reasoning: 'Earnings signals were clear',
      };

      const result = service.generateSourceLevelLearning(
        mockInvestigation,
        research,
      );

      expect(result?.evidence?.keyFindings).toBeDefined();
      expect(
        result?.evidence?.keyFindings.some((f) =>
          f.includes('Discovered drivers'),
        ),
      ).toBe(true);
    });

    it('should include suggested test', () => {
      const research = {
        discoveredDrivers: ['Earnings miss'],
        signalsWeHad: [],
        signalTypesNeeded: ['earnings_report'],
        suggestedSources: [
          {
            name: 'SEC EDGAR',
            type: 'sec_filing' as const,
            url: 'https://sec.gov',
            description: 'Filings',
          },
        ],
        predictability: 'predictable' as const,
        reasoning: 'Clear signal',
      };

      const result = service.generateSourceLevelLearning(
        mockInvestigation,
        research,
      );

      expect(result?.suggestedTest).toBeDefined();
      expect(result?.suggestedTest?.type).toBe('backtest');
    });
  });

  describe('predictability mapping', () => {
    it('should map predictable correctly', async () => {
      const response = JSON.stringify({
        results: [
          {
            ...JSON.parse(mockLLMResponse).results[0],
            predictability: 'predictable',
          },
        ],
      });
      (llmGenerationService.generateResponse as jest.Mock).mockResolvedValue(
        response,
      );

      const result = await service.researchMissBatch(
        [mockInvestigation],
        '2024-01-01',
      );

      expect(result.get('inv-123')?.predictability).toBe('predictable');
    });

    it('should map difficult correctly', async () => {
      const response = JSON.stringify({
        results: [
          { ...JSON.parse(mockLLMResponse).results[0], predictability: 'hard' },
        ],
      });
      (llmGenerationService.generateResponse as jest.Mock).mockResolvedValue(
        response,
      );

      const result = await service.researchMissBatch(
        [mockInvestigation],
        '2024-01-01',
      );

      expect(result.get('inv-123')?.predictability).toBe('difficult');
    });

    it('should map unpredictable correctly', async () => {
      const response = JSON.stringify({
        results: [
          {
            ...JSON.parse(mockLLMResponse).results[0],
            predictability: 'black swan',
          },
        ],
      });
      (llmGenerationService.generateResponse as jest.Mock).mockResolvedValue(
        response,
      );

      const result = await service.researchMissBatch(
        [mockInvestigation],
        '2024-01-01',
      );

      expect(result.get('inv-123')?.predictability).toBe('unpredictable');
    });
  });

  describe('source type mapping', () => {
    it('should map sec to sec_filing', async () => {
      const response = JSON.stringify({
        results: [
          {
            ...JSON.parse(mockLLMResponse).results[0],
            suggestedSources: [
              { name: 'SEC', type: 'sec', description: 'SEC filings' },
            ],
          },
        ],
      });
      (llmGenerationService.generateResponse as jest.Mock).mockResolvedValue(
        response,
      );

      const result = await service.researchMissBatch(
        [mockInvestigation],
        '2024-01-01',
      );

      expect(result.get('inv-123')?.suggestedSources[0]?.type).toBe(
        'sec_filing',
      );
    });

    it('should map twitter to social', async () => {
      const response = JSON.stringify({
        results: [
          {
            ...JSON.parse(mockLLMResponse).results[0],
            suggestedSources: [
              { name: 'Twitter', type: 'twitter', description: 'Social feed' },
            ],
          },
        ],
      });
      (llmGenerationService.generateResponse as jest.Mock).mockResolvedValue(
        response,
      );

      const result = await service.researchMissBatch(
        [mockInvestigation],
        '2024-01-01',
      );

      expect(result.get('inv-123')?.suggestedSources[0]?.type).toBe('social');
    });

    it('should map unknown types to other', async () => {
      const response = JSON.stringify({
        results: [
          {
            ...JSON.parse(mockLLMResponse).results[0],
            suggestedSources: [
              {
                name: 'Custom',
                type: 'unknown_type',
                description: 'Custom source',
              },
            ],
          },
        ],
      });
      (llmGenerationService.generateResponse as jest.Mock).mockResolvedValue(
        response,
      );

      const result = await service.researchMissBatch(
        [mockInvestigation],
        '2024-01-01',
      );

      expect(result.get('inv-123')?.suggestedSources[0]?.type).toBe('other');
    });
  });

  describe('batch handling', () => {
    it('should handle multiple investigations', async () => {
      const investigations = [
        mockInvestigation,
        {
          ...mockInvestigation,
          id: 'inv-456',
          prediction: {
            ...mockInvestigation.prediction,
            target: {
              id: 'target-456',
              symbol: 'MSFT',
              name: 'Microsoft',
              target_type: 'stock',
            },
          },
        } as unknown as MissInvestigation,
      ];

      const response = JSON.stringify({
        results: [
          {
            symbol: 'AAPL',
            discoveredDrivers: ['Apple news'],
            signalTypesNeeded: [],
            suggestedSources: [],
            predictability: 'predictable',
            reasoning: '',
          },
          {
            symbol: 'MSFT',
            discoveredDrivers: ['Microsoft news'],
            signalTypesNeeded: [],
            suggestedSources: [],
            predictability: 'difficult',
            reasoning: '',
          },
        ],
      });
      (llmGenerationService.generateResponse as jest.Mock).mockResolvedValue(
        response,
      );

      const result = await service.researchMissBatch(
        investigations,
        '2024-01-01',
      );

      expect(result.size).toBe(2);
      expect(result.get('inv-123')).toBeDefined();
      expect(result.get('inv-456')).toBeDefined();
    });

    it('should handle missing symbols in response gracefully', async () => {
      const response = JSON.stringify({
        results: [
          {
            symbol: 'UNKNOWN',
            discoveredDrivers: [],
            signalTypesNeeded: [],
            suggestedSources: [],
            predictability: 'difficult',
            reasoning: '',
          },
        ],
      });
      (llmGenerationService.generateResponse as jest.Mock).mockResolvedValue(
        response,
      );

      const result = await service.researchMissBatch(
        [mockInvestigation],
        '2024-01-01',
      );

      // Should skip results for unknown symbols
      expect(result.size).toBe(0);
    });
  });
});
