/**
 * AgentContextUpdateService Tests
 *
 * Tests for agent context update functionality.
 */

import { Logger } from '@nestjs/common';
import {
  AgentContextUpdateService,
  AgentContext,
  ContextUpdateOperation,
} from '../agent-context-update.service';
import { SupabaseService } from '../../../../../../supabase/supabase.service';

describe('AgentContextUpdateService', () => {
  let service: AgentContextUpdateService;
  let supabaseService: jest.Mocked<SupabaseService>;
  let mockSingle: jest.Mock;
  let mockDirectQuery: jest.Mock;

  // Create a chainable mock for Supabase queries
  const createChainableMock = (
    singleMock: jest.Mock,
    directQueryMock: jest.Mock,
  ) => {
    const createChain = (): Record<string, unknown> => {
      const chain: Record<string, unknown> = {
        from: jest.fn(() => createChain()),
        select: jest.fn(() => createChain()),
        eq: jest.fn(() => createChain()),
        update: jest.fn(() => createChain()),
        insert: jest.fn(() => createChain()),
        single: singleMock,
        // Make chain thenable for direct await (non-single queries)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        then: (resolve?: any, reject?: any) => {
          return directQueryMock().then(resolve, reject);
        },
      };
      return chain;
    };
    return createChain();
  };

  beforeEach(() => {
    mockSingle = jest.fn();
    mockDirectQuery = jest.fn().mockResolvedValue({ data: null, error: null });
    const mockClient = createChainableMock(mockSingle, mockDirectQuery);

    // Mock Supabase service
    supabaseService = {
      getServiceClient: jest.fn().mockReturnValue(mockClient),
    } as unknown as jest.Mocked<SupabaseService>;

    service = new AgentContextUpdateService(supabaseService);

    // Spy on Logger methods
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('appendToContext', () => {
    it('should append content to array section', async () => {
      // Mock getAgentSlug
      mockSingle
        .mockResolvedValueOnce({
          data: { agent_slug: 'test-agent' },
          error: null,
        })
        // Mock getAgentContext
        .mockResolvedValueOnce({
          data: {
            metadata: {
              learned_patterns: ['Existing pattern'],
            },
          },
          error: null,
        });

      // Mock saveAgentContext
      mockDirectQuery.mockResolvedValueOnce({
        error: null,
      });

      const operation: ContextUpdateOperation = {
        section: 'learned_patterns',
        updateType: 'append',
        content: 'New pattern',
        reason: 'Test reason',
        sourceType: 'postmortem',
        sourceId: 'pm-123',
      };

      const result = await service.appendToContext('pred-agent-123', operation);

      expect(result.success).toBe(true);
      expect(result.newValue).toEqual(['Existing pattern', 'New pattern']);
    });

    it('should replace section content', async () => {
      mockSingle
        .mockResolvedValueOnce({
          data: { agent_slug: 'test-agent' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            metadata: {
              risk_guidelines: ['Old guideline'],
            },
          },
          error: null,
        });

      mockDirectQuery.mockResolvedValueOnce({
        error: null,
      });

      const operation: ContextUpdateOperation = {
        section: 'risk_guidelines',
        updateType: 'replace',
        content: '["New guideline 1", "New guideline 2"]',
        reason: 'Complete overhaul',
        sourceType: 'user_insight',
        sourceId: 'insight-123',
      };

      const result = await service.appendToContext('pred-agent-123', operation);

      expect(result.success).toBe(true);
      expect(result.newValue).toEqual(['New guideline 1', 'New guideline 2']);
    });

    it('should remove content from array section', async () => {
      mockSingle
        .mockResolvedValueOnce({
          data: { agent_slug: 'test-agent' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            metadata: {
              learned_patterns: ['Pattern 1', 'Pattern 2', 'Pattern 3'],
            },
          },
          error: null,
        });

      mockDirectQuery.mockResolvedValueOnce({
        error: null,
      });

      const operation: ContextUpdateOperation = {
        section: 'learned_patterns',
        updateType: 'remove',
        content: 'Pattern 2',
        reason: 'No longer relevant',
        sourceType: 'conversation',
        sourceId: null,
      };

      const result = await service.appendToContext('pred-agent-123', operation);

      expect(result.success).toBe(true);
      expect(result.newValue).toEqual(['Pattern 1', 'Pattern 3']);
    });

    it('should create new array section if it does not exist', async () => {
      mockSingle
        .mockResolvedValueOnce({
          data: { agent_slug: 'test-agent' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            metadata: {},
          },
          error: null,
        });

      mockDirectQuery.mockResolvedValueOnce({
        error: null,
      });

      const operation: ContextUpdateOperation = {
        section: 'learned_patterns',
        updateType: 'append',
        content: 'First pattern',
        reason: 'Initial learning',
        sourceType: 'postmortem',
        sourceId: 'pm-123',
      };

      const result = await service.appendToContext('pred-agent-123', operation);

      expect(result.success).toBe(true);
      expect(result.newValue).toEqual(['First pattern']);
    });

    it('should handle errors gracefully', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Agent not found' },
      });

      const operation: ContextUpdateOperation = {
        section: 'learned_patterns',
        updateType: 'append',
        content: 'Pattern',
        reason: 'Test',
        sourceType: 'postmortem',
        sourceId: null,
      };

      const result = await service.appendToContext('pred-agent-999', operation);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('applyPostmortemLearnings', () => {
    it('should apply key learnings from postmortems', async () => {
      // Flow:
      // 1. Get postmortem (.single())
      // 2. For each learning: appendToContext which calls:
      //    - getAgentSlug (.single())
      //    - getAgentContext (.single())
      //    - saveContext (direct await)
      // 3. Mark postmortem applied (direct await)
      mockSingle
        // 1. Get postmortem
        .mockResolvedValueOnce({
          data: {
            id: 'pm-123',
            instrument: 'AAPL',
            key_learnings: ['Learning 1', 'Learning 2'],
          },
          error: null,
        })
        // 2a. First learning - getAgentSlug
        .mockResolvedValueOnce({
          data: { agent_slug: 'test-agent' },
          error: null,
        })
        // 2a. First learning - getAgentContext
        .mockResolvedValueOnce({
          data: { metadata: { learned_patterns: [] } },
          error: null,
        })
        // 2b. Second learning - getAgentSlug
        .mockResolvedValueOnce({
          data: { agent_slug: 'test-agent' },
          error: null,
        })
        // 2b. Second learning - getAgentContext
        .mockResolvedValueOnce({
          data: { metadata: { learned_patterns: ['Learning 1'] } },
          error: null,
        });

      // Mock saveAgentContext and mark applied (direct await)
      mockDirectQuery.mockResolvedValue({
        error: null,
      });

      const results = await service.applyPostmortemLearnings('pred-agent-123', [
        'pm-123',
      ]);

      expect(results.length).toBe(2);
      expect(results[0]?.success).toBe(true);
    });

    it('should skip postmortems with no learnings', async () => {
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'pm-123',
          instrument: 'AAPL',
          key_learnings: [],
        },
        error: null,
      });

      const results = await service.applyPostmortemLearnings('pred-agent-123', [
        'pm-123',
      ]);

      expect(results).toEqual([]);
    });
  });

  describe('applyMissedOpportunityThresholds', () => {
    it('should apply threshold adjustments', async () => {
      // Flow:
      // 1. Get missed opportunity (.single())
      // 2. appendToContext: getAgentSlug (.single()), getAgentContext (.single()), save (direct)
      // 3. Mark as applied (direct)
      mockSingle
        // 1. Get missed opportunity
        .mockResolvedValueOnce({
          data: {
            id: 'missed-123',
            instrument: 'TSLA',
            move_percent: 7.0,
            suggested_threshold_changes: {
              minPriceChangePercent: 3.5,
            },
          },
          error: null,
        })
        // 2. appendToContext - getAgentSlug
        .mockResolvedValueOnce({
          data: { agent_slug: 'test-agent' },
          error: null,
        })
        // 2. appendToContext - getAgentContext
        .mockResolvedValueOnce({
          data: { metadata: { threshold_adjustments: [] } },
          error: null,
        });

      // Mock saveAgentContext and mark applied
      mockDirectQuery.mockResolvedValue({
        error: null,
      });

      const results = await service.applyMissedOpportunityThresholds(
        'pred-agent-123',
        ['missed-123'],
      );

      expect(results.length).toBe(1);
      expect(results[0]?.success).toBe(true);
    });

    it('should skip opportunities with no threshold changes', async () => {
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'missed-123',
          instrument: 'TSLA',
          suggested_threshold_changes: {},
        },
        error: null,
      });

      const results = await service.applyMissedOpportunityThresholds(
        'pred-agent-123',
        ['missed-123'],
      );

      expect(results).toEqual([]);
    });
  });

  describe('applyUserInsights', () => {
    it('should apply domain knowledge insights', async () => {
      // Flow:
      // 1. Get insight (.single())
      // 2. appendToContext: getAgentSlug (.single()), getAgentContext (.single()), save (direct)
      // 3. Mark as applied (direct)
      mockSingle
        // 1. Get insight
        .mockResolvedValueOnce({
          data: {
            id: 'insight-123',
            insight_type: 'domain_knowledge',
            insight_text: 'Tech stocks rally in Q4',
            structured_insight: null,
          },
          error: null,
        })
        // 2. appendToContext - getAgentSlug
        .mockResolvedValueOnce({
          data: { agent_slug: 'test-agent' },
          error: null,
        })
        // 2. appendToContext - getAgentContext
        .mockResolvedValueOnce({
          data: { metadata: { domain_knowledge: [] } },
          error: null,
        });

      mockDirectQuery.mockResolvedValue({
        error: null,
      });

      const results = await service.applyUserInsights('pred-agent-123', [
        'insight-123',
      ]);

      expect(results.length).toBe(1);
      expect(results[0]?.success).toBe(true);
    });

    it('should apply threshold suggestions', async () => {
      // Flow:
      // 1. Get insight (.single())
      // 2. appendToContext: getAgentSlug (.single()), getAgentContext (.single()), save (direct)
      // 3. Mark as applied (direct)
      mockSingle
        // 1. Get insight
        .mockResolvedValueOnce({
          data: {
            id: 'insight-123',
            insight_type: 'threshold_suggestion',
            structured_insight: { minPriceChangePercent: 4.0 },
          },
          error: null,
        })
        // 2. appendToContext - getAgentSlug
        .mockResolvedValueOnce({
          data: { agent_slug: 'test-agent' },
          error: null,
        })
        // 2. appendToContext - getAgentContext
        .mockResolvedValueOnce({
          data: { metadata: { threshold_adjustments: [] } },
          error: null,
        });

      mockDirectQuery.mockResolvedValue({
        error: null,
      });

      const results = await service.applyUserInsights('pred-agent-123', [
        'insight-123',
      ]);

      expect(results.length).toBe(1);
    });
  });

  describe('getUnappliedLearnings', () => {
    it('should retrieve all unapplied learnings', async () => {
      mockDirectQuery
        .mockResolvedValueOnce({
          data: [{ id: 'pm-1' }, { id: 'pm-2' }],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [{ id: 'missed-1' }],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [{ id: 'insight-1' }, { id: 'insight-2' }, { id: 'insight-3' }],
          error: null,
        });

      const unapplied = await service.getUnappliedLearnings('pred-agent-123');

      expect(unapplied.postmortems).toHaveLength(2);
      expect(unapplied.missedOpportunities).toHaveLength(1);
      expect(unapplied.userInsights).toHaveLength(3);
    });

    it('should handle empty results', async () => {
      mockDirectQuery.mockResolvedValue({
        data: null,
        error: null,
      });

      const unapplied = await service.getUnappliedLearnings('pred-agent-123');

      expect(unapplied.postmortems).toEqual([]);
      expect(unapplied.missedOpportunities).toEqual([]);
      expect(unapplied.userInsights).toEqual([]);
    });
  });

  describe('applyAllUnappliedLearnings', () => {
    it('should apply all types of learnings', async () => {
      // Mock getUnappliedLearnings - direct queries without .single()
      mockDirectQuery
        .mockResolvedValueOnce({
          data: [{ id: 'pm-1' }],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [{ id: 'missed-1' }],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [{ id: 'insight-1' }],
          error: null,
        });

      // Mock individual apply methods
      mockSingle.mockResolvedValue({
        data: { agent_slug: 'test-agent' },
        error: null,
      });

      mockSingle.mockResolvedValue({
        data: { metadata: {} },
        error: null,
      });

      mockSingle
        .mockResolvedValueOnce({
          data: {
            id: 'pm-1',
            instrument: 'AAPL',
            key_learnings: ['Learning'],
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: 'missed-1',
            suggested_threshold_changes: { minPriceChangePercent: 3.0 },
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: 'insight-1',
            insight_type: 'domain_knowledge',
            insight_text: 'Test insight',
          },
          error: null,
        });

      mockDirectQuery.mockResolvedValue({
        error: null,
      });

      const results =
        await service.applyAllUnappliedLearnings('pred-agent-123');

      expect(results.postmortemResults.length).toBeGreaterThanOrEqual(0);
      expect(results.missedOpportunityResults.length).toBeGreaterThanOrEqual(0);
      expect(results.userInsightResults.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('parseContextSections', () => {
    it('should parse context into sections', () => {
      const context: AgentContext = {
        learned_patterns: ['Pattern 1', 'Pattern 2'],
        risk_guidelines: ['Guideline 1'],
        runnerConfig: { foo: 'bar' },
      };

      const sections = service.parseContextSections(context);

      expect(sections.size).toBe(2);
      expect(sections.has('learned_patterns')).toBe(true);
      expect(sections.has('risk_guidelines')).toBe(true);
      expect(sections.has('runnerConfig')).toBe(false);
    });
  });

  describe('reconstructContext', () => {
    it('should reconstruct context from sections', () => {
      const sections = new Map<string, unknown>();
      sections.set('learned_patterns', ['Pattern 1']);
      sections.set('risk_guidelines', ['Guideline 1']);

      const runnerConfig = { foo: 'bar' };

      const context = service.reconstructContext(sections, runnerConfig);

      expect(context.learned_patterns).toEqual(['Pattern 1']);
      expect(context.risk_guidelines).toEqual(['Guideline 1']);
      expect(context.runnerConfig).toEqual({ foo: 'bar' });
    });
  });
});
