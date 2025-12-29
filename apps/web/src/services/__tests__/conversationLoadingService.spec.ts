/**
 * Unit Tests for Conversation Loading Service
 *
 * Complex service that handles conversation loading from query parameters.
 * Tests cover:
 * - Loading conversations from query parameters
 * - Store coordination and updates
 * - ExecutionContext initialization
 * - Authentication checks
 * - Error handling
 * - Router query parameter cleanup
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { conversationLoadingService } from '../conversationLoadingService';
import { useConversationsStore } from '@/stores/conversationsStore';
import { useAgentsStore } from '@/stores/agentsStore';
import { useChatUiStore } from '@/stores/ui/chatUiStore';
import { useExecutionContextStore } from '@/stores/executionContextStore';
import { useAuthStore } from '@/stores/rbacStore';
import { useLLMPreferencesStore } from '@/stores/llmPreferencesStore';
import type { Router } from 'vue-router';

// Mock service dependencies
const mockConversationCrudService = {
  getBackendConversation: vi.fn(),
};

const mockConversationMessageService = {
  loadConversationMessages: vi.fn(),
};

const mockConversationFactoryService = {
  createConversationObject: vi.fn(),
};

vi.mock('@/services/conversation/conversationCrudService', () => ({
  conversationCrudService: mockConversationCrudService,
}));

vi.mock('@/services/conversation/conversationMessageService', () => ({
  conversationMessageService: mockConversationMessageService,
}));

vi.mock('@/services/conversation/conversationFactoryService', () => ({
  conversationFactoryService: mockConversationFactoryService,
}));

describe('ConversationLoadingService', () => {
  let mockRouter: Router;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    // Mock router
    mockRouter = {
      replace: vi.fn(),
    } as unknown as Router;
  });

  describe('loadConversationFromQuery', () => {
    it('should reject if user is not authenticated', async () => {
      const authStore = useAuthStore();
      authStore.isAuthenticated = false;

      const currentRoute = {
        name: 'home',
        params: {},
        query: { conversationId: 'conv-1' },
      };

      const result = await conversationLoadingService.loadConversationFromQuery(
        'conv-1',
        mockRouter,
        currentRoute
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not authenticated');
    });

    it('should return existing conversation if already loaded', async () => {
      const authStore = useAuthStore();
      const conversationsStore = useConversationsStore();
      const chatUiStore = useChatUiStore();

      authStore.isAuthenticated = true;

      // Add existing conversation with messages
      conversationsStore.setConversation({
        id: 'conv-1',
        userId: 'user-1',
        title: 'Existing Conversation',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      conversationsStore.setMessages('conv-1', [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date().toISOString(),
        },
      ]);

      const currentRoute = {
        name: 'home',
        params: {},
        query: { conversationId: 'conv-1' },
      };

      const result = await conversationLoadingService.loadConversationFromQuery(
        'conv-1',
        mockRouter,
        currentRoute
      );

      expect(result.success).toBe(true);
      expect(result.conversationId).toBe('conv-1');
      expect(chatUiStore.activeConversationId).toBe('conv-1');

      // Should clean up query parameter
      expect(mockRouter.replace).toHaveBeenCalledWith({
        name: 'home',
        params: {},
        query: { conversationId: undefined },
      });

      // Should NOT call backend APIs
      expect(mockConversationCrudService.getBackendConversation).not.toHaveBeenCalled();
    });

    it('should load conversation from backend if not in store', async () => {
      const authStore = useAuthStore();
      const agentsStore = useAgentsStore();
      const conversationsStore = useConversationsStore();
      const chatUiStore = useChatUiStore();
      const executionContextStore = useExecutionContextStore();

      authStore.isAuthenticated = true;
      authStore.user = { id: 'user-1', email: 'test@example.com' };
      authStore.currentOrganization = 'test-org';

      // Mock agent
      const mockAgent = {
        id: 'agent-1',
        name: 'test-agent',
        type: 'context',
        execution_modes: ['immediate'],
      };
      agentsStore.availableAgents = [mockAgent];

      // Mock backend conversation
      const mockBackendConversation = {
        id: 'conv-1',
        userId: 'user-1',
        title: 'Backend Conversation',
        agentName: 'test-agent',
        createdAt: '2024-01-01T00:00:00Z',
      };
      mockConversationCrudService.getBackendConversation.mockResolvedValue(mockBackendConversation);

      // Mock messages
      const mockMessages = [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          role: 'user',
          content: 'Hello',
          timestamp: '2024-01-01T00:00:00Z',
        },
      ];
      mockConversationMessageService.loadConversationMessages.mockResolvedValue(mockMessages);

      // Mock conversation factory
      const mockConversationObject = {
        id: 'temp-id',
        userId: 'user-1',
        title: 'New Conversation',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date(),
        agentName: 'test-agent',
        agentType: 'context',
      };
      mockConversationFactoryService.createConversationObject.mockReturnValue(mockConversationObject);

      const currentRoute = {
        name: 'home',
        params: {},
        query: { conversationId: 'conv-1' },
      };

      const result = await conversationLoadingService.loadConversationFromQuery(
        'conv-1',
        mockRouter,
        currentRoute
      );

      expect(result.success).toBe(true);
      expect(result.conversationId).toBe('conv-1');

      // Verify backend APIs were called
      expect(mockConversationCrudService.getBackendConversation).toHaveBeenCalledWith('conv-1');
      expect(mockConversationMessageService.loadConversationMessages).toHaveBeenCalledWith('conv-1');

      // Verify conversation was added to store with correct ID
      const conversation = conversationsStore.conversationById('conv-1');
      expect(conversation).toBeTruthy();
      expect(conversation?.title).toBe('Backend Conversation');

      // Verify messages were set
      const messages = conversationsStore.messagesByConversation('conv-1');
      expect(messages).toEqual(mockMessages);

      // Verify active conversation was set
      expect(chatUiStore.activeConversationId).toBe('conv-1');

      // Verify ExecutionContext was initialized
      expect(executionContextStore.capsule).toBeTruthy();
      expect(executionContextStore.capsule?.conversationId).toBe('conv-1');
      expect(executionContextStore.capsule?.agentSlug).toBe('test-agent');
    });

    it('should load agents if not already loaded', async () => {
      const authStore = useAuthStore();
      const agentsStore = useAgentsStore();

      authStore.isAuthenticated = true;
      authStore.user = { id: 'user-1', email: 'test@example.com' };

      // Initially no agents
      agentsStore.availableAgents = null;

      // Mock ensureAgentsLoaded
      const ensureAgentsLoadedSpy = vi.spyOn(agentsStore, 'ensureAgentsLoaded').mockResolvedValue();

      const mockBackendConversation = {
        id: 'conv-1',
        userId: 'user-1',
        agentName: 'test-agent',
        createdAt: '2024-01-01T00:00:00Z',
      };
      mockConversationCrudService.getBackendConversation.mockResolvedValue(mockBackendConversation);
      mockConversationMessageService.loadConversationMessages.mockResolvedValue([]);

      // After ensureAgentsLoaded, agents should be available
      ensureAgentsLoadedSpy.mockImplementation(async () => {
        agentsStore.availableAgents = [
          { id: 'agent-1', name: 'test-agent', type: 'context' },
        ];
      });

      mockConversationFactoryService.createConversationObject.mockReturnValue({
        id: 'temp-id',
        userId: 'user-1',
        title: 'Test',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const currentRoute = {
        name: 'home',
        params: {},
        query: { conversationId: 'conv-1' },
      };

      await conversationLoadingService.loadConversationFromQuery('conv-1', mockRouter, currentRoute);

      expect(ensureAgentsLoadedSpy).toHaveBeenCalled();
    });

    it('should return error if agent not found', async () => {
      const authStore = useAuthStore();
      const agentsStore = useAgentsStore();

      authStore.isAuthenticated = true;
      authStore.user = { id: 'user-1', email: 'test@example.com' };

      // No matching agent
      agentsStore.availableAgents = [
        { id: 'other-agent', name: 'other-agent', type: 'context' },
      ];

      const mockBackendConversation = {
        id: 'conv-1',
        userId: 'user-1',
        agentName: 'missing-agent',
        createdAt: '2024-01-01T00:00:00Z',
      };
      mockConversationCrudService.getBackendConversation.mockResolvedValue(mockBackendConversation);
      mockConversationMessageService.loadConversationMessages.mockResolvedValue([]);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const currentRoute = {
        name: 'home',
        params: {},
        query: { conversationId: 'conv-1' },
      };

      const result = await conversationLoadingService.loadConversationFromQuery(
        'conv-1',
        mockRouter,
        currentRoute
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Agent not found: missing-agent');

      consoleErrorSpy.mockRestore();
    });

    it('should update existing conversation instead of creating new one', async () => {
      const authStore = useAuthStore();
      const agentsStore = useAgentsStore();
      const conversationsStore = useConversationsStore();

      authStore.isAuthenticated = true;
      authStore.user = { id: 'user-1', email: 'test@example.com' };

      const mockAgent = {
        id: 'agent-1',
        name: 'test-agent',
        type: 'context',
      };
      agentsStore.availableAgents = [mockAgent];

      // Add existing conversation (without messages)
      conversationsStore.setConversation({
        id: 'conv-1',
        userId: 'user-1',
        title: 'Old Title',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const mockBackendConversation = {
        id: 'conv-1',
        userId: 'user-1',
        title: 'Updated Title',
        agentName: 'test-agent',
        createdAt: '2024-01-01T00:00:00Z',
      };
      mockConversationCrudService.getBackendConversation.mockResolvedValue(mockBackendConversation);
      mockConversationMessageService.loadConversationMessages.mockResolvedValue([]);

      mockConversationFactoryService.createConversationObject.mockReturnValue({
        id: 'temp-id',
        userId: 'user-1',
        title: 'Updated Title',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date(),
      });

      const currentRoute = {
        name: 'home',
        params: {},
        query: { conversationId: 'conv-1' },
      };

      await conversationLoadingService.loadConversationFromQuery('conv-1', mockRouter, currentRoute);

      // Should update existing conversation
      const conversation = conversationsStore.conversationById('conv-1');
      expect(conversation?.title).toBe('Updated Title');
    });

    it('should initialize ExecutionContext with correct values', async () => {
      const authStore = useAuthStore();
      const agentsStore = useAgentsStore();
      const executionContextStore = useExecutionContextStore();
      const llmPreferencesStore = useLLMPreferencesStore();

      authStore.isAuthenticated = true;
      authStore.user = { id: 'user-123', email: 'test@example.com' };
      authStore.currentOrganization = 'my-org';

      const mockAgent = {
        id: 'agent-1',
        name: 'my-agent',
        type: 'workflow',
      };
      agentsStore.availableAgents = [mockAgent];

      // Mock LLM preferences
      llmPreferencesStore.selectedProvider = { name: 'openai', displayName: 'OpenAI' };
      llmPreferencesStore.selectedModel = { modelName: 'gpt-4', displayName: 'GPT-4' };

      const mockBackendConversation = {
        id: 'conv-1',
        userId: 'user-123',
        agentName: 'my-agent',
        createdAt: '2024-01-01T00:00:00Z',
      };
      mockConversationCrudService.getBackendConversation.mockResolvedValue(mockBackendConversation);
      mockConversationMessageService.loadConversationMessages.mockResolvedValue([]);

      mockConversationFactoryService.createConversationObject.mockReturnValue({
        id: 'temp-id',
        userId: 'user-123',
        title: 'Test',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const currentRoute = {
        name: 'home',
        params: {},
        query: { conversationId: 'conv-1' },
      };

      await conversationLoadingService.loadConversationFromQuery('conv-1', mockRouter, currentRoute);

      // Verify ExecutionContext
      expect(executionContextStore.capsule).toBeTruthy();
      expect(executionContextStore.capsule?.orgSlug).toBe('my-org');
      expect(executionContextStore.capsule?.userId).toBe('user-123');
      expect(executionContextStore.capsule?.conversationId).toBe('conv-1');
      expect(executionContextStore.capsule?.agentSlug).toBe('my-agent');
      expect(executionContextStore.capsule?.agentType).toBe('workflow');
      expect(executionContextStore.capsule?.provider).toBe('openai');
      expect(executionContextStore.capsule?.model).toBe('gpt-4');
    });

    it('should clean up query parameter after loading', async () => {
      const authStore = useAuthStore();
      const agentsStore = useAgentsStore();

      authStore.isAuthenticated = true;
      authStore.user = { id: 'user-1', email: 'test@example.com' };

      const mockAgent = {
        id: 'agent-1',
        name: 'test-agent',
        type: 'context',
      };
      agentsStore.availableAgents = [mockAgent];

      mockConversationCrudService.getBackendConversation.mockResolvedValue({
        id: 'conv-1',
        userId: 'user-1',
        agentName: 'test-agent',
        createdAt: '2024-01-01T00:00:00Z',
      });
      mockConversationMessageService.loadConversationMessages.mockResolvedValue([]);

      mockConversationFactoryService.createConversationObject.mockReturnValue({
        id: 'temp-id',
        userId: 'user-1',
        title: 'Test',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const currentRoute = {
        name: 'chat',
        params: { id: '123' },
        query: { conversationId: 'conv-1', otherParam: 'value' },
      };

      await conversationLoadingService.loadConversationFromQuery('conv-1', mockRouter, currentRoute);

      // Should preserve other query params
      expect(mockRouter.replace).toHaveBeenCalledWith({
        name: 'chat',
        params: { id: '123' },
        query: { conversationId: undefined, otherParam: 'value' },
      });
    });

    it('should handle router errors gracefully', async () => {
      const authStore = useAuthStore();
      const conversationsStore = useConversationsStore();

      authStore.isAuthenticated = true;

      conversationsStore.setConversation({
        id: 'conv-1',
        userId: 'user-1',
        title: 'Test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      conversationsStore.setMessages('conv-1', [
        { id: 'msg-1', conversationId: 'conv-1', role: 'user', content: 'Test', timestamp: new Date().toISOString() },
      ]);

      // Mock router to throw error
      mockRouter.replace = vi.fn().mockRejectedValue(new Error('Navigation failed'));

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const currentRoute = {
        name: 'home',
        params: {},
        query: { conversationId: 'conv-1' },
      };

      const result = await conversationLoadingService.loadConversationFromQuery(
        'conv-1',
        mockRouter,
        currentRoute
      );

      // Should still succeed even if router cleanup fails
      expect(result.success).toBe(true);

      consoleWarnSpy.mockRestore();
    });

    it('should handle loading errors', async () => {
      const authStore = useAuthStore();
      const agentsStore = useAgentsStore();

      authStore.isAuthenticated = true;
      agentsStore.availableAgents = [];

      mockConversationCrudService.getBackendConversation.mockRejectedValue(new Error('Network error'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const currentRoute = {
        name: 'home',
        params: {},
        query: { conversationId: 'conv-1' },
      };

      const result = await conversationLoadingService.loadConversationFromQuery(
        'conv-1',
        mockRouter,
        currentRoute
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Service Layer Coordination', () => {
    it('should coordinate multiple stores correctly', async () => {
      const authStore = useAuthStore();
      const agentsStore = useAgentsStore();
      const conversationsStore = useConversationsStore();
      const chatUiStore = useChatUiStore();
      const executionContextStore = useExecutionContextStore();

      authStore.isAuthenticated = true;
      authStore.user = { id: 'user-1', email: 'test@example.com' };

      const mockAgent = {
        id: 'agent-1',
        name: 'test-agent',
        type: 'context',
      };
      agentsStore.availableAgents = [mockAgent];

      mockConversationCrudService.getBackendConversation.mockResolvedValue({
        id: 'conv-1',
        userId: 'user-1',
        agentName: 'test-agent',
        createdAt: '2024-01-01T00:00:00Z',
      });
      mockConversationMessageService.loadConversationMessages.mockResolvedValue([]);
      mockConversationFactoryService.createConversationObject.mockReturnValue({
        id: 'temp-id',
        userId: 'user-1',
        title: 'Test',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const currentRoute = {
        name: 'home',
        params: {},
        query: { conversationId: 'conv-1' },
      };

      await conversationLoadingService.loadConversationFromQuery('conv-1', mockRouter, currentRoute);

      // Verify all stores were updated
      expect(conversationsStore.conversationById('conv-1')).toBeTruthy();
      expect(chatUiStore.activeConversationId).toBe('conv-1');
      expect(executionContextStore.capsule).toBeTruthy();
    });
  });
});
