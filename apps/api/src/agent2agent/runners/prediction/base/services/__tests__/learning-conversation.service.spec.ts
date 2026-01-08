/**
 * LearningConversationService Tests
 *
 * Tests for learning conversation management.
 */

import { Logger } from '@nestjs/common';
import { LearningConversationService } from '../learning-conversation.service';
import { SupabaseService } from '../../../../../../supabase/supabase.service';
import { LLMGenerationService } from '../../../../../../llms/services/llm-generation.service';
import { LearningContextBuilderService } from '../learning-context.service';

describe('LearningConversationService', () => {
  let service: LearningConversationService;
  let supabaseService: jest.Mocked<SupabaseService>;
  let llmService: jest.Mocked<LLMGenerationService>;
  let learningContextService: jest.Mocked<LearningContextBuilderService>;
  let mockSingle: jest.Mock;
  let mockDirectQuery: jest.Mock;

  const mockExecutionContext = {
    orgSlug: 'test-org',
    userId: 'user-123',
    conversationId: 'conv-123',
    taskId: 'task-123',
    planId: 'plan-123',
    deliverableId: 'deliv-123',
    agentSlug: 'test-agent',
    agentType: 'context' as const,
    provider: 'anthropic' as const,
    model: 'claude-sonnet-4-20250514',
  };

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
        order: jest.fn(() => createChain()),
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

    // Mock services
    supabaseService = {
      getServiceClient: jest.fn().mockReturnValue(mockClient),
    } as unknown as jest.Mocked<SupabaseService>;

    llmService = {
      generateResponse: jest.fn(),
    } as unknown as jest.Mocked<LLMGenerationService>;

    learningContextService = {
      buildContext: jest.fn(),
      formatContextForPrompt: jest.fn(),
    } as unknown as jest.Mocked<LearningContextBuilderService>;

    service = new LearningConversationService(
      supabaseService,
      llmService,
      learningContextService,
    );

    // Spy on Logger methods
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('startConversation', () => {
    it('should create a new learning conversation', async () => {
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'conv-123',
          prediction_agent_id: 'agent-123',
          user_id: 'user-123',
          status: 'active',
          focus_type: 'general',
          focus_reference_id: null,
          focus_instrument: null,
          messages: [],
          extracted_insights: [],
          context_updates_applied: [],
          thread_id: null,
          started_at: '2026-01-07T12:00:00Z',
          last_message_at: '2026-01-07T12:00:00Z',
          completed_at: null,
        },
        error: null,
      });

      const conversation = await service.startConversation(
        'agent-123',
        'user-123',
        'general',
        null,
        null,
      );

      expect(conversation.id).toBe('conv-123');
      expect(conversation.status).toBe('active');
      expect(conversation.focusType).toBe('general');
    });

    it('should support different focus types', async () => {
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'conv-123',
          prediction_agent_id: 'agent-123',
          user_id: 'user-123',
          status: 'active',
          focus_type: 'postmortem',
          focus_reference_id: 'pm-123',
          focus_instrument: null,
          messages: [],
          extracted_insights: [],
          context_updates_applied: [],
          thread_id: null,
          started_at: '2026-01-07T12:00:00Z',
          last_message_at: '2026-01-07T12:00:00Z',
          completed_at: null,
        },
        error: null,
      });

      const conversation = await service.startConversation(
        'agent-123',
        'user-123',
        'postmortem',
        'pm-123',
        null,
      );

      expect(conversation.focusType).toBe('postmortem');
      expect(conversation.focusReferenceId).toBe('pm-123');
    });

    it('should throw error when insert fails', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Insert failed' },
      });

      await expect(
        service.startConversation('agent-123', 'user-123'),
      ).rejects.toThrow('Failed to start conversation: Insert failed');
    });
  });

  describe('processMessage', () => {
    it('should process user message and generate response', async () => {
      // Mock getConversation
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'conv-123',
          prediction_agent_id: 'agent-123',
          user_id: 'user-123',
          status: 'active',
          focus_type: 'general',
          focus_reference_id: null,
          focus_instrument: null,
          messages: [],
          extracted_insights: [],
          context_updates_applied: [],
          thread_id: null,
          started_at: '2026-01-07T12:00:00Z',
          last_message_at: '2026-01-07T12:00:00Z',
          completed_at: null,
        },
        error: null,
      });

      // Mock buildContext
      learningContextService.buildContext.mockResolvedValueOnce({
        agentId: 'agent-123',
        instrument: null,
        lookbackDays: 30,
        generatedAt: '2026-01-07T12:00:00Z',
        postmortems: [],
        missedOpportunities: [],
        userInsights: [],
        specialistStats: [],
      });

      learningContextService.formatContextForPrompt.mockReturnValueOnce('');

      // Mock LLM response
      llmService.generateResponse.mockResolvedValueOnce(
        'This is a helpful response about your predictions.',
      );

      // Mock update (direct await without .single())
      mockDirectQuery.mockResolvedValueOnce({
        error: null,
      });

      const result = await service.processMessage(
        'conv-123',
        'How is my prediction accuracy?',
        mockExecutionContext,
      );

      expect(result.response).toBe(
        'This is a helpful response about your predictions.',
      );
      expect(llmService.generateResponse).toHaveBeenCalled();
    });

    it('should extract context updates from response', async () => {
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'conv-123',
          prediction_agent_id: 'agent-123',
          user_id: 'user-123',
          status: 'active',
          focus_type: 'general',
          focus_reference_id: null,
          focus_instrument: null,
          messages: [],
          extracted_insights: [],
          context_updates_applied: [],
          thread_id: null,
          started_at: '2026-01-07T12:00:00Z',
          last_message_at: '2026-01-07T12:00:00Z',
          completed_at: null,
        },
        error: null,
      });

      learningContextService.buildContext.mockResolvedValueOnce({
        agentId: 'agent-123',
        instrument: null,
        lookbackDays: 30,
        generatedAt: '2026-01-07T12:00:00Z',
        postmortems: [],
        missedOpportunities: [],
        userInsights: [],
        specialistStats: [],
      });

      learningContextService.formatContextForPrompt.mockReturnValueOnce('');

      const responseWithUpdate = `Here's my response.

[CONTEXT_UPDATE]
Section: learned_patterns
Type: append
Content: Always check earnings calendar
Reason: User pointed out missed earnings
[/CONTEXT_UPDATE]`;

      llmService.generateResponse.mockResolvedValueOnce(responseWithUpdate);

      // Mock update (direct await without .single())
      mockDirectQuery.mockResolvedValueOnce({
        error: null,
      });

      const result = await service.processMessage(
        'conv-123',
        'I noticed you missed the earnings date',
        mockExecutionContext,
      );

      expect(result.suggestedContextUpdate).toBeDefined();
      expect(result.suggestedContextUpdate?.section).toBe('learned_patterns');
      expect(result.suggestedContextUpdate?.updateType).toBe('append');
      expect(result.shouldApplyUpdate).toBe(true);
    });

    it('should throw error for inactive conversation', async () => {
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'conv-123',
          prediction_agent_id: 'agent-123',
          user_id: 'user-123',
          status: 'completed',
          focus_type: 'general',
          focus_reference_id: null,
          focus_instrument: null,
          messages: [],
          extracted_insights: [],
          context_updates_applied: [],
          thread_id: null,
          started_at: '2026-01-07T12:00:00Z',
          last_message_at: '2026-01-07T12:00:00Z',
          completed_at: '2026-01-07T13:00:00Z',
        },
        error: null,
      });

      await expect(
        service.processMessage('conv-123', 'test', mockExecutionContext),
      ).rejects.toThrow('Conversation conv-123 is not active');
    });

    it('should throw error for non-existent conversation', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      await expect(
        service.processMessage('conv-999', 'test', mockExecutionContext),
      ).rejects.toThrow('Conversation conv-999 not found');
    });
  });

  describe('applyContextUpdate', () => {
    it('should record context update in conversation', async () => {
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'conv-123',
          prediction_agent_id: 'agent-123',
          user_id: 'user-123',
          status: 'active',
          focus_type: 'general',
          focus_reference_id: null,
          focus_instrument: null,
          messages: [],
          extracted_insights: [],
          context_updates_applied: [],
          thread_id: null,
          started_at: '2026-01-07T12:00:00Z',
          last_message_at: '2026-01-07T12:00:00Z',
          completed_at: null,
        },
        error: null,
      });

      // Mock update (direct await without .single())
      mockDirectQuery.mockResolvedValueOnce({
        error: null,
      });

      const update = {
        section: 'learned_patterns',
        updateType: 'append' as const,
        content: 'New learning',
        reason: 'User feedback',
      };

      const result = await service.applyContextUpdate('conv-123', update);

      expect(result).toBe(true);
    });

    it('should throw error for non-existent conversation', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const update = {
        section: 'learned_patterns',
        updateType: 'append' as const,
        content: 'New learning',
        reason: 'User feedback',
      };

      await expect(
        service.applyContextUpdate('conv-999', update),
      ).rejects.toThrow('Conversation conv-999 not found');
    });
  });

  describe('getConversation', () => {
    it('should retrieve conversation by ID', async () => {
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'conv-123',
          prediction_agent_id: 'agent-123',
          user_id: 'user-123',
          status: 'active',
          focus_type: 'general',
          focus_reference_id: null,
          focus_instrument: null,
          messages: [],
          extracted_insights: [],
          context_updates_applied: [],
          thread_id: null,
          started_at: '2026-01-07T12:00:00Z',
          last_message_at: '2026-01-07T12:00:00Z',
          completed_at: null,
        },
        error: null,
      });

      const conversation = await service.getConversation('conv-123');

      expect(conversation).toBeDefined();
      expect(conversation?.id).toBe('conv-123');
    });

    it('should return null for non-existent conversation', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const conversation = await service.getConversation('conv-999');

      expect(conversation).toBeNull();
    });

    it('should throw error for database failure', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(service.getConversation('conv-123')).rejects.toThrow(
        'Failed to get conversation: Database error',
      );
    });
  });

  describe('getActiveConversations', () => {
    it('should retrieve active conversations for agent', async () => {
      // Direct await without .single()
      mockDirectQuery.mockResolvedValueOnce({
        data: [
          {
            id: 'conv-1',
            prediction_agent_id: 'agent-123',
            user_id: 'user-123',
            status: 'active',
            focus_type: 'general',
            focus_reference_id: null,
            focus_instrument: null,
            messages: [],
            extracted_insights: [],
            context_updates_applied: [],
            thread_id: null,
            started_at: '2026-01-07T12:00:00Z',
            last_message_at: '2026-01-07T12:00:00Z',
            completed_at: null,
          },
        ],
        error: null,
      });

      const conversations = await service.getActiveConversations('agent-123');

      expect(conversations).toHaveLength(1);
    });

    it('should throw error when query fails', async () => {
      mockDirectQuery.mockResolvedValueOnce({
        data: null,
        error: { message: 'Query failed' },
      });

      await expect(service.getActiveConversations('agent-123')).rejects.toThrow(
        'Failed to get conversations: Query failed',
      );
    });
  });

  describe('completeConversation', () => {
    it('should mark conversation as completed', async () => {
      // Direct await without .single()
      mockDirectQuery.mockResolvedValueOnce({
        error: null,
      });

      await service.completeConversation('conv-123');

      // Verify the method completes without error
    });

    it('should throw error when update fails', async () => {
      mockDirectQuery.mockResolvedValueOnce({
        error: { message: 'Update failed' },
      });

      await expect(service.completeConversation('conv-123')).rejects.toThrow(
        'Failed to complete conversation: Update failed',
      );
    });
  });
});
