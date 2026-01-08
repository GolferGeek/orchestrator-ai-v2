/**
 * LearningController Tests
 *
 * Tests for the REST API endpoints for prediction agent learning loop.
 */

import { Logger, NotFoundException } from '@nestjs/common';
import { LearningController } from '../learning.controller';
import { SupabaseService } from '../../../../supabase/supabase.service';
import { LearningContextBuilderService } from '../base/services/learning-context.service';
import { LearningConversationService } from '../base/services/learning-conversation.service';
import { AgentContextUpdateService } from '../base/services/agent-context-update.service';
import { PostmortemService } from '../base/services/postmortem.service';
import { MissedOpportunityService } from '../base/services/missed-opportunity.service';

describe('LearningController', () => {
  let controller: LearningController;
  let supabaseService: jest.Mocked<SupabaseService>;
  let learningContext: jest.Mocked<LearningContextBuilderService>;
  let learningConversation: jest.Mocked<LearningConversationService>;
  let contextUpdate: jest.Mocked<AgentContextUpdateService>;
  let postmortemService: jest.Mocked<PostmortemService>;
  let missedOpportunityService: jest.Mocked<MissedOpportunityService>;
  let mockSingle: jest.Mock;
  let mockRpc: jest.Mock;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  // Mock for direct query results (without .single())
  let mockDirectQuery: jest.Mock;

  // Create a chainable mock for Supabase queries
  const createChainableMock = (
    singleMock: jest.Mock,
    rpcMock: jest.Mock,
    directQueryMock: jest.Mock,
  ) => {
    // Create the chain object that's also a Promise
    const createChain = (): Record<string, unknown> => {
      const chain: Record<string, unknown> = {
        from: jest.fn(() => createChain()),
        select: jest.fn(() => createChain()),
        eq: jest.fn(() => createChain()),
        gte: jest.fn(() => createChain()),
        lte: jest.fn(() => createChain()),
        update: jest.fn(() => createChain()),
        insert: jest.fn(() => createChain()),
        single: singleMock,
        rpc: rpcMock,
        // Make chain thenable for direct await (non-single queries)

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
    mockRpc = jest.fn();
    // Default to returning empty array for direct queries
    mockDirectQuery = jest.fn().mockResolvedValue({ data: [], error: null });
    const mockClient = createChainableMock(
      mockSingle,
      mockRpc,
      mockDirectQuery,
    );

    // Mock services
    supabaseService = {
      getServiceClient: jest.fn().mockReturnValue(mockClient),
    } as unknown as jest.Mocked<SupabaseService>;

    learningContext = {
      getPostmortems: jest.fn(),
      getUserInsights: jest.fn(),
      getSpecialistStats: jest.fn(),
    } as unknown as jest.Mocked<LearningContextBuilderService>;

    learningConversation = {
      startConversation: jest.fn(),
      processMessage: jest.fn(),
    } as unknown as jest.Mocked<LearningConversationService>;

    contextUpdate = {
      appendToContext: jest.fn(),
      applyAllUnappliedLearnings: jest.fn(),
    } as unknown as jest.Mocked<AgentContextUpdateService>;

    postmortemService = {} as jest.Mocked<PostmortemService>;

    missedOpportunityService = {
      getMissedOpportunities: jest.fn(),
    } as unknown as jest.Mocked<MissedOpportunityService>;

    controller = new LearningController(
      supabaseService,
      learningContext,
      learningConversation,
      contextUpdate,
      postmortemService,
      missedOpportunityService,
    );

    // Spy on Logger methods
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Helper to setup ownership verification mocks
  // Flow: predictions.prediction_agents -> single() -> agents -> single() -> organization_members -> (direct await)
  const setupOwnershipMocks = () => {
    mockSingle
      .mockResolvedValueOnce({
        data: { agent_slug: 'test-agent' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { org_slug: 'test-org' },
        error: null,
      });
    // The organization_members query doesn't call .single() - it's awaited directly
    mockDirectQuery.mockResolvedValueOnce({
      data: [{ organizations: { slug: 'test-org' } }],
      error: null,
    });
  };

  describe('getSummary', () => {
    it('should return learning summary for agent', async () => {
      setupOwnershipMocks();

      // Mock learning summary RPC
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            accuracy_rate: 0.75,
            total_recommendations: 100,
            correct_recommendations: 75,
            postmortem_count: 50,
            unapplied_count: 5,
            recent_insights: 10,
          },
        ],
        error: null,
      });

      const result = await controller.getSummary(
        'agent-123',
        mockUser as never,
      );

      expect(result.agentId).toBe('agent-123');
      expect(result.accuracy).toBe(0.75);
      expect(result.totalRecommendations).toBe(100);
      expect(result.correctRecommendations).toBe(75);
    });

    it('should throw NotFoundException for non-existent agent', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      await expect(
        controller.getSummary('agent-999', mockUser as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for unauthorized access', async () => {
      mockSingle
        .mockResolvedValueOnce({
          data: { agent_slug: 'test-agent' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { org_slug: 'other-org' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: [{ organizations: { slug: 'user-org' } }],
          error: null,
        });

      await expect(
        controller.getSummary('agent-123', mockUser as never),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPostmortems', () => {
    it('should retrieve postmortems for agent', async () => {
      setupOwnershipMocks();

      learningContext.getPostmortems.mockResolvedValueOnce([
        {
          instrument: 'AAPL',
          action: 'buy',
          outcome: 'correct',
          returnPercent: 5.0,
          whatWorked: ['Good analysis'],
          whatFailed: [],
          rootCause: null,
          keyLearnings: ['Learning'],
          missingContext: [],
          createdAt: '2026-01-06T12:00:00Z',
        },
      ]);

      const result = await controller.getPostmortems(
        'agent-123',
        undefined,
        undefined,
        mockUser as never,
      );

      expect(result.agentId).toBe('agent-123');
      expect(result.total).toBe(1);
      expect(result.postmortems).toHaveLength(1);
    });

    it('should filter by instrument when provided', async () => {
      setupOwnershipMocks();

      learningContext.getPostmortems.mockResolvedValueOnce([]);

      await controller.getPostmortems(
        'agent-123',
        'AAPL',
        undefined,
        mockUser as never,
      );

      expect(learningContext.getPostmortems).toHaveBeenCalledWith(
        'agent-123',
        'AAPL',
        20,
      );
    });
  });

  describe('getMissedOpportunities', () => {
    it('should retrieve missed opportunities for agent', async () => {
      setupOwnershipMocks();

      missedOpportunityService.getMissedOpportunities.mockResolvedValueOnce([
        {
          id: 'missed-1',
          predictionAgentId: 'agent-123',
          instrument: 'TSLA',
          missedType: 'price_move',
          description: 'Missed 7% move',
          moveStartTimestamp: '2026-01-05T10:00:00Z',
          moveEndTimestamp: '2026-01-05T12:00:00Z',
          startPrice: 100,
          endPrice: 107,
          movePercent: 7.0,
          detectionFailureReason: 'below_threshold',
          availableSignals: [],
          signalAnalysis: null,
          whatWouldHaveHelped: ['Lower threshold'],
          preFilterResult: null,
          suggestedThresholdChanges: {},
          appliedToContext: false,
          appliedAt: null,
        },
      ]);

      const result = await controller.getMissedOpportunities(
        'agent-123',
        undefined,
        undefined,
        undefined,
        mockUser as never,
      );

      expect(result.agentId).toBe('agent-123');
      expect(result.total).toBe(1);
      expect(result.missedOpportunities).toHaveLength(1);
    });
  });

  describe('getUserInsights', () => {
    it('should retrieve user insights for agent', async () => {
      setupOwnershipMocks();

      learningContext.getUserInsights.mockResolvedValueOnce([
        {
          type: 'domain_knowledge',
          instrument: 'AAPL',
          insight: 'Apple rallies in January',
          structured: null,
          effectivenessScore: 0.8,
          createdAt: '2026-01-04T12:00:00Z',
        },
      ]);

      const result = await controller.getUserInsights(
        'agent-123',
        undefined,
        undefined,
        mockUser as never,
      );

      expect(result.agentId).toBe('agent-123');
      expect(result.total).toBe(1);
      expect(result.insights).toHaveLength(1);
    });
  });

  describe('getSpecialistStats', () => {
    it('should retrieve specialist stats for agent', async () => {
      setupOwnershipMocks();

      learningContext.getSpecialistStats.mockResolvedValueOnce([
        {
          specialist: 'technical-analyst',
          instrument: null,
          accuracyPercent: 75.0,
          avgConfidence: 0.8,
          totalAnalyses: 100,
          confidenceWhenCorrect: 0.85,
          confidenceWhenIncorrect: 0.7,
        },
      ]);

      const result = await controller.getSpecialistStats(
        'agent-123',
        mockUser as never,
      );

      expect(result.agentId).toBe('agent-123');
      expect(result.specialists).toHaveLength(1);
    });
  });

  describe('applyAllLearnings', () => {
    it('should apply all unapplied learnings', async () => {
      setupOwnershipMocks();

      contextUpdate.applyAllUnappliedLearnings.mockResolvedValueOnce({
        postmortemResults: [
          { success: true, previousValue: null, newValue: null, appliedAt: '' },
        ],
        missedOpportunityResults: [
          { success: true, previousValue: null, newValue: null, appliedAt: '' },
        ],
        userInsightResults: [
          { success: true, previousValue: null, newValue: null, appliedAt: '' },
        ],
      });

      const result = await controller.applyAllLearnings(
        'agent-123',
        mockUser as never,
      );

      expect(result.success).toBe(true);
      expect(result.applied.postmortems).toBe(1);
      expect(result.applied.missedOpportunities).toBe(1);
      expect(result.applied.userInsights).toBe(1);
    });
  });

  describe('startChat', () => {
    it('should start a learning conversation', async () => {
      setupOwnershipMocks();

      learningConversation.startConversation.mockResolvedValueOnce({
        id: 'conv-123',
        predictionAgentId: 'agent-123',
        userId: 'user-123',
        status: 'active',
        focusType: 'general',
        focusReferenceId: null,
        focusInstrument: null,
        messages: [],
        extractedInsights: [],
        contextUpdatesApplied: [],
        threadId: null,
        startedAt: '2026-01-07T12:00:00Z',
        lastMessageAt: '2026-01-07T12:00:00Z',
        completedAt: null,
      });

      const result = await controller.startChat(
        'agent-123',
        { focus: 'general' },
        mockUser as never,
      );

      expect(result.conversationId).toBe('conv-123');
      expect(learningConversation.startConversation).toHaveBeenCalledWith(
        'agent-123',
        'user-123',
        'general',
        null,
        null,
      );
    });
  });

  describe('sendMessage', () => {
    it('should process message in conversation', async () => {
      // Setup ownership mocks: prediction_agents -> agents -> (direct) organization_members
      // Then additional calls for execution context: prediction_agents -> agents
      mockSingle
        .mockResolvedValueOnce({
          data: { agent_slug: 'test-agent' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { org_slug: 'test-org' },
          error: null,
        })
        // Execution context calls
        .mockResolvedValueOnce({
          data: { agent_slug: 'test-agent' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { org_slug: 'test-org', agent_type: 'context', metadata: {} },
          error: null,
        });

      // organization_members uses direct query (no .single())
      mockDirectQuery.mockResolvedValueOnce({
        data: [{ organizations: { slug: 'test-org' } }],
        error: null,
      });

      learningConversation.processMessage.mockResolvedValueOnce({
        response: 'Here is my response',
        extractedInsight: null,
        suggestedContextUpdate: null,
        shouldApplyUpdate: false,
      });

      const result = await controller.sendMessage(
        'agent-123',
        'conv-123',
        { message: 'How is my accuracy?' },
        mockUser as never,
      );

      expect(result.conversationId).toBe('conv-123');
      expect(result.assistantMessage).toBe('Here is my response');
      expect(result.contextUpdates).toHaveLength(0);
    });

    it('should include context updates in response', async () => {
      // Setup ownership mocks: prediction_agents -> agents -> (direct) organization_members
      // Then additional calls for execution context: prediction_agents -> agents
      mockSingle
        .mockResolvedValueOnce({
          data: { agent_slug: 'test-agent' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { org_slug: 'test-org' },
          error: null,
        })
        // Execution context calls
        .mockResolvedValueOnce({
          data: { agent_slug: 'test-agent' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { org_slug: 'test-org', agent_type: 'context', metadata: {} },
          error: null,
        });

      // organization_members uses direct query (no .single())
      mockDirectQuery.mockResolvedValueOnce({
        data: [{ organizations: { slug: 'test-org' } }],
        error: null,
      });

      learningConversation.processMessage.mockResolvedValueOnce({
        response: 'I will update your context',
        extractedInsight: null,
        suggestedContextUpdate: {
          section: 'learned_patterns',
          updateType: 'append',
          content: 'New pattern',
          reason: 'User feedback',
        },
        shouldApplyUpdate: true,
      });

      const result = await controller.sendMessage(
        'agent-123',
        'conv-123',
        { message: 'Add this pattern' },
        mockUser as never,
      );

      expect(result.contextUpdates).toHaveLength(1);
      expect(result.contextUpdates[0]?.section).toBe('learned_patterns');
      expect(result.contextUpdates[0]?.applied).toBe(true);
    });
  });

  describe('endChat', () => {
    it('should end a learning conversation', async () => {
      // Setup ownership mocks: prediction_agents -> agents -> (direct) organization_members
      // Then conversation data: select conversation -> update conversation
      mockSingle
        .mockResolvedValueOnce({
          data: { agent_slug: 'test-agent' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { org_slug: 'test-org' },
          error: null,
        })
        // Conversation queries
        .mockResolvedValueOnce({
          data: {
            summary: 'Conversation completed',
            insights_extracted: 3,
            context_updates_applied: 2,
          },
          error: null,
        })
        .mockResolvedValueOnce({
          error: null,
        });

      // organization_members uses direct query (no .single())
      mockDirectQuery.mockResolvedValueOnce({
        data: [{ organizations: { slug: 'test-org' } }],
        error: null,
      });

      const result = await controller.endChat(
        'agent-123',
        'conv-123',
        mockUser as never,
      );

      expect(result.conversationId).toBe('conv-123');
      expect(result.summary).toBe('Conversation completed');
      expect(result.insightsRecorded).toBe(3);
      expect(result.contextUpdatesApplied).toBe(2);
    });
  });

  describe('applyUpdate', () => {
    it('should apply a context update', async () => {
      setupOwnershipMocks();

      contextUpdate.appendToContext.mockResolvedValueOnce({
        success: true,
        previousValue: [],
        newValue: ['New pattern'],
        appliedAt: '2026-01-07T12:00:00Z',
      });

      const result = await controller.applyUpdate(
        'agent-123',
        {
          section: 'learned_patterns',
          updateType: 'append',
          content: 'New pattern',
          reason: 'User request',
          sourceType: 'user_insight',
        },
        mockUser as never,
      );

      expect(result.success).toBe(true);
      expect(result.section).toBe('learned_patterns');
      expect(result.newValue).toEqual(['New pattern']);
    });
  });
});
