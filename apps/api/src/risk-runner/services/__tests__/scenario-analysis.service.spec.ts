import { Test, TestingModule } from '@nestjs/testing';
import {
  ScenarioAnalysisService,
  Scenario,
  ScenarioAdjustment,
} from '../scenario-analysis.service';
import { SupabaseService } from '@/supabase/supabase.service';

describe('ScenarioAnalysisService', () => {
  let service: ScenarioAnalysisService;
  let supabaseService: jest.Mocked<SupabaseService>;

  // Mock Supabase query builder
  const createMockQueryBuilder = () => {
    const builder: Record<string, jest.Mock> = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    return builder;
  };

  const mockSubjects = [
    { id: 'subject-1', name: 'Apple Inc.', identifier: 'AAPL' },
    { id: 'subject-2', name: 'Google LLC', identifier: 'GOOGL' },
  ];

  const mockDimensions = [
    { id: 'dim-1', slug: 'market-risk', name: 'Market Risk', weight: 0.4 },
    { id: 'dim-2', slug: 'credit-risk', name: 'Credit Risk', weight: 0.3 },
    { id: 'dim-3', slug: 'liquidity-risk', name: 'Liquidity Risk', weight: 0.3 },
  ];

  const mockCompositeScores = [
    {
      id: 'score-1',
      subject_id: 'subject-1',
      overall_score: 0.6,
      dimension_scores: {
        'market-risk': 0.7,
        'credit-risk': 0.5,
        'liquidity-risk': 0.6,
      },
    },
    {
      id: 'score-2',
      subject_id: 'subject-2',
      overall_score: 0.4,
      dimension_scores: {
        'market-risk': 0.4,
        'credit-risk': 0.35,
        'liquidity-risk': 0.45,
      },
    },
  ];

  const mockScenario: Scenario = {
    id: 'scenario-1',
    scope_id: 'scope-1',
    name: 'Market Stress Test',
    description: 'Test market volatility impact',
    adjustments: { 'market-risk': 0.2 },
    baseline_snapshot: { avgScore: 0.5 },
    results: null,
    is_template: false,
    created_by: 'user-1',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  };

  let mockQueryBuilder: ReturnType<typeof createMockQueryBuilder>;

  beforeEach(async () => {
    mockQueryBuilder = createMockQueryBuilder();

    const mockSupabaseClient = {
      schema: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue(mockQueryBuilder),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScenarioAnalysisService,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);

    service = module.get<ScenarioAnalysisService>(ScenarioAnalysisService);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('runScenario', () => {
    it('should calculate adjusted scores for all subjects', async () => {
      const mockClient = supabaseService.getServiceClient();

      // Setup mock responses for different queries
      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'subjects') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({
                    data: mockSubjects,
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'dimensions') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    order: jest.fn().mockResolvedValue({
                      data: mockDimensions,
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === 'composite_scores') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({
                      data: mockCompositeScores,
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          return mockQueryBuilder;
        }),
      }));

      const adjustments: ScenarioAdjustment[] = [
        { dimensionSlug: 'market-risk', adjustment: 0.1 },
      ];

      const result = await service.runScenario(
        'scope-1',
        'Market Stress Test',
        adjustments,
      );

      expect(result.scenarioName).toBe('Market Stress Test');
      expect(result.adjustments).toEqual({ 'market-risk': 0.1 });
      expect(result.subjectResults).toHaveLength(2);
      expect(result.portfolioBaseline).toBeDefined();
      expect(result.portfolioAdjusted).toBeDefined();
      expect(result.riskDistributionBefore).toBeDefined();
      expect(result.riskDistributionAfter).toBeDefined();
    });

    it('should clamp adjusted scores between 0 and 1', async () => {
      const mockClient = supabaseService.getServiceClient();

      const highScoreData = [
        {
          id: 'score-1',
          subject_id: 'subject-1',
          overall_score: 0.9,
          dimension_scores: { 'market-risk': 0.95 },
        },
      ];

      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'subjects') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({
                    data: [mockSubjects[0]],
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'dimensions') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    order: jest.fn().mockResolvedValue({
                      data: [mockDimensions[0]],
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === 'composite_scores') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({
                      data: highScoreData,
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          return mockQueryBuilder;
        }),
      }));

      const adjustments: ScenarioAdjustment[] = [
        { dimensionSlug: 'market-risk', adjustment: 0.2 }, // Would push to 1.15
      ];

      const result = await service.runScenario('scope-1', 'Test', adjustments);

      // Score should be clamped to 1
      const dimensionDetail = result.subjectResults[0]?.dimensionDetails[0];
      expect(dimensionDetail?.adjustedScore).toBeLessThanOrEqual(1);
    });

    it('should handle empty data gracefully', async () => {
      const mockClient = supabaseService.getServiceClient();

      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'subjects') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'dimensions') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    order: jest.fn().mockResolvedValue({
                      data: [],
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === 'composite_scores') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({
                      data: [],
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          return mockQueryBuilder;
        }),
      }));

      const result = await service.runScenario('scope-1', 'Empty Test', []);

      expect(result.subjectResults).toHaveLength(0);
      expect(result.portfolioBaseline).toBe(0);
      expect(result.portfolioAdjusted).toBe(0);
    });

    it('should calculate risk distribution correctly', async () => {
      const mockClient = supabaseService.getServiceClient();

      const variedScores = [
        {
          id: 'score-1',
          subject_id: 'subject-1',
          overall_score: 0.8, // Critical
          dimension_scores: { 'market-risk': 0.8 },
        },
        {
          id: 'score-2',
          subject_id: 'subject-2',
          overall_score: 0.6, // High
          dimension_scores: { 'market-risk': 0.6 },
        },
        {
          id: 'score-3',
          subject_id: 'subject-3',
          overall_score: 0.4, // Medium
          dimension_scores: { 'market-risk': 0.4 },
        },
        {
          id: 'score-4',
          subject_id: 'subject-4',
          overall_score: 0.2, // Low
          dimension_scores: { 'market-risk': 0.2 },
        },
      ];

      const subjects = [
        { id: 'subject-1', name: 'S1', identifier: 'S1' },
        { id: 'subject-2', name: 'S2', identifier: 'S2' },
        { id: 'subject-3', name: 'S3', identifier: 'S3' },
        { id: 'subject-4', name: 'S4', identifier: 'S4' },
      ];

      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'subjects') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({
                    data: subjects,
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'dimensions') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    order: jest.fn().mockResolvedValue({
                      data: [mockDimensions[0]],
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === 'composite_scores') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({
                      data: variedScores,
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          return mockQueryBuilder;
        }),
      }));

      const result = await service.runScenario('scope-1', 'Distribution Test', []);

      expect(result.riskDistributionBefore.critical).toBe(1);
      expect(result.riskDistributionBefore.high).toBe(1);
      expect(result.riskDistributionBefore.medium).toBe(1);
      expect(result.riskDistributionBefore.low).toBe(1);
    });

    it('should normalize scores stored as 0-100 to 0-1', async () => {
      const mockClient = supabaseService.getServiceClient();

      const percentScores = [
        {
          id: 'score-1',
          subject_id: 'subject-1',
          overall_score: 60, // 60% stored as integer
          dimension_scores: { 'market-risk': 65 }, // 65% stored as integer
        },
      ];

      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'subjects') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({
                    data: [mockSubjects[0]],
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'dimensions') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    order: jest.fn().mockResolvedValue({
                      data: [mockDimensions[0]],
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === 'composite_scores') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({
                      data: percentScores,
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          return mockQueryBuilder;
        }),
      }));

      const result = await service.runScenario('scope-1', 'Normalization Test', []);

      // Scores should be normalized to 0-1 range
      expect(result.subjectResults[0]?.baselineScore).toBe(0.6);
      expect(result.subjectResults[0]?.dimensionDetails[0]?.baselineScore).toBe(
        0.65,
      );
    });
  });

  describe('saveScenario', () => {
    it('should save a scenario with adjustments', async () => {
      const mockClient = supabaseService.getServiceClient();

      // Mock for baseline capture and scenario save
      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'scenarios') {
            return {
              insert: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: mockScenario,
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'subjects') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'dimensions') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    order: jest.fn().mockResolvedValue({
                      data: [],
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === 'composite_scores') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({
                      data: [],
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          return mockQueryBuilder;
        }),
      }));

      const result = await service.saveScenario({
        scopeId: 'scope-1',
        name: 'Market Stress Test',
        description: 'Test market volatility impact',
        adjustments: [{ dimensionSlug: 'market-risk', adjustment: 0.2 }],
        createdBy: 'user-1',
      });

      expect(result).toEqual(mockScenario);
    });

    it('should throw error when save fails', async () => {
      const mockClient = supabaseService.getServiceClient();

      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'scenarios') {
            return {
              insert: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Insert failed' },
                  }),
                }),
              }),
            };
          }
          if (table === 'subjects') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'dimensions') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    order: jest.fn().mockResolvedValue({
                      data: [],
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === 'composite_scores') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({
                      data: [],
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          return mockQueryBuilder;
        }),
      }));

      await expect(
        service.saveScenario({
          scopeId: 'scope-1',
          name: 'Test',
          adjustments: [],
        }),
      ).rejects.toThrow('Insert failed');
    });
  });

  describe('listScenarios', () => {
    it('should return scenarios for a scope', async () => {
      const mockClient = supabaseService.getServiceClient();

      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: [mockScenario],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }));

      const result = await service.listScenarios('scope-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockScenario);
    });

    it('should include templates when option is set', async () => {
      const mockClient = supabaseService.getServiceClient();

      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [mockScenario, { ...mockScenario, is_template: true }],
                error: null,
              }),
            }),
          }),
        }),
      }));

      const result = await service.listScenarios('scope-1', {
        includeTemplates: true,
      });

      expect(result).toHaveLength(2);
    });

    it('should throw error on query failure', async () => {
      const mockClient = supabaseService.getServiceClient();

      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Query failed' },
                }),
              }),
            }),
          }),
        }),
      }));

      await expect(service.listScenarios('scope-1')).rejects.toEqual({
        message: 'Query failed',
      });
    });
  });

  describe('getScenario', () => {
    it('should return a specific scenario', async () => {
      const mockClient = supabaseService.getServiceClient();

      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockScenario,
                error: null,
              }),
            }),
          }),
        }),
      }));

      const result = await service.getScenario('scenario-1');

      expect(result).toEqual(mockScenario);
    });

    it('should return null when scenario not found', async () => {
      const mockClient = supabaseService.getServiceClient();

      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'Not found' },
              }),
            }),
          }),
        }),
      }));

      const result = await service.getScenario('non-existent');

      expect(result).toBeNull();
    });

    it('should throw error on other query failures', async () => {
      const mockClient = supabaseService.getServiceClient();

      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'OTHER', message: 'Server error' },
              }),
            }),
          }),
        }),
      }));

      await expect(service.getScenario('scenario-1')).rejects.toThrow(
        'Server error',
      );
    });
  });

  describe('deleteScenario', () => {
    it('should delete a scenario', async () => {
      const mockClient = supabaseService.getServiceClient();

      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      }));

      await expect(
        service.deleteScenario('scenario-1'),
      ).resolves.toBeUndefined();
    });

    it('should throw error on delete failure', async () => {
      const mockClient = supabaseService.getServiceClient();

      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Delete failed' },
            }),
          }),
        }),
      }));

      await expect(service.deleteScenario('scenario-1')).rejects.toEqual({
        message: 'Delete failed',
      });
    });
  });

  describe('getTemplates', () => {
    it('should return all templates', async () => {
      const mockClient = supabaseService.getServiceClient();
      const templates = [
        { ...mockScenario, is_template: true, name: 'Market Crash' },
        { ...mockScenario, is_template: true, name: 'Interest Rate Hike' },
      ];

      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: templates,
                error: null,
              }),
            }),
          }),
        }),
      }));

      const result = await service.getTemplates();

      expect(result).toHaveLength(2);
      expect(result[0]?.is_template).toBe(true);
    });

    it('should throw error on query failure', async () => {
      const mockClient = supabaseService.getServiceClient();

      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Query failed' },
              }),
            }),
          }),
        }),
      }));

      await expect(service.getTemplates()).rejects.toEqual({
        message: 'Query failed',
      });
    });
  });
});
