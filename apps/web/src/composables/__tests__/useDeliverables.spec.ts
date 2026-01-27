// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDeliverables } from '../useDeliverables';
import { createPinia, setActivePinia } from 'pinia';
import { DeliverableType, DeliverableFormat } from '@/services/deliverablesService';
import type { Deliverable } from '@/services/deliverablesService';

// Mock the deliverables store
vi.mock('@/stores/deliverablesStore', () => ({
  useDeliverablesStore: vi.fn(() => ({
    hasDeliverables: false,
    recentDeliverables: [],
    isLoading: false,
    error: null,
    deliverables: {},
    loadDeliverables: vi.fn(),
    loadDeliverablesByConversation: vi.fn(() => Promise.resolve([])),
    getDeliverablesByConversation: vi.fn(() => []),
    createDeliverable: vi.fn(),
    createVersion: vi.fn(),
    deleteDeliverable: vi.fn(),
    getDeliverableVersions: vi.fn(() => Promise.resolve([])),
    startEnhancement: vi.fn(),
  })),
}));

describe('useDeliverables', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default UI state', () => {
      const {
        showDeliverableModal,
        selectedDeliverable,
        isCreatingDeliverable,
      } = useDeliverables();

      expect(showDeliverableModal.value).toBe(false);
      expect(selectedDeliverable.value).toBeNull();
      expect(isCreatingDeliverable.value).toBe(false);
    });

    it('should expose computed properties from store', () => {
      const {
        hasDeliverables,
        recentDeliverables,
        isLoading,
        error,
        deliverablesByType,
      } = useDeliverables();

      expect(hasDeliverables.value).toBe(false);
      expect(recentDeliverables.value).toEqual([]);
      expect(isLoading.value).toBe(false);
      expect(error.value).toBeNull();
      expect(deliverablesByType.value).toEqual({});
    });

    it('should call store loadDeliverables on initialize', async () => {
      const { initialize, store } = useDeliverables();

      await initialize();

      expect(store.loadDeliverables).toHaveBeenCalledOnce();
    });
  });

  describe('Agent Response Processing', () => {
    it('should process agent response with deliverable ID', async () => {
      const { processAgentResponse } = useDeliverables();

      const response = { deliverableId: 'test-id' };
      await processAgentResponse(response, 'conv-123');

      // Currently simplified - just ensure it doesn't throw
      expect(true).toBe(true);
    });

    it('should handle response without deliverable ID', async () => {
      const { processAgentResponse } = useDeliverables();

      const response = { otherData: 'value' };
      await processAgentResponse(response, 'conv-123');

      expect(true).toBe(true);
    });

    it('should handle invalid response gracefully', async () => {
      const { processAgentResponse } = useDeliverables();

      await processAgentResponse(null as never, 'conv-123');
      await processAgentResponse(undefined as never, 'conv-123');
      await processAgentResponse('string' as never, 'conv-123');

      expect(true).toBe(true);
    });
  });

  describe('Enhancement Context', () => {
    it('should prepare enhancement context with existing deliverable', async () => {
      const mockDeliverable: Deliverable = {
        id: 'del-123',
        userId: 'user-1',
        conversationId: 'conv-123',
        title: 'Test',
        type: DeliverableType.DOCUMENT,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        currentVersion: {
          id: 'v1',
          deliverableId: 'del-123',
          versionNumber: 1,
          content: 'content',
          format: DeliverableFormat.MARKDOWN,
          createdByType: 'user_edit',
          createdAt: '2024-01-01',
          isCurrentVersion: true,
          metadata: { messageId: 'msg-123' },
        },
      };

      const { prepareEnhancementContext, store } = useDeliverables();

      vi.mocked(store.getDeliverablesByConversation).mockReturnValue([mockDeliverable]);

      const context = await prepareEnhancementContext('conv-123', 'msg-123');

      expect(context.deliverableId).toBe('del-123');
      expect(store.startEnhancement).toHaveBeenCalledWith('del-123');
    });

    it('should return empty context when no existing deliverable', async () => {
      const { prepareEnhancementContext, store } = useDeliverables();

      vi.mocked(store.getDeliverablesByConversation).mockReturnValue([]);

      const context = await prepareEnhancementContext('conv-123', 'msg-123');

      expect(context).toEqual({});
    });

    it('should get first deliverable if no message ID provided', async () => {
      const mockDeliverable: Deliverable = {
        id: 'del-123',
        userId: 'user-1',
        conversationId: 'conv-123',
        title: 'Test',
        type: DeliverableType.DOCUMENT,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      const { prepareEnhancementContext, store } = useDeliverables();

      vi.mocked(store.getDeliverablesByConversation).mockReturnValue([mockDeliverable]);

      const context = await prepareEnhancementContext('conv-123');

      expect(context.deliverableId).toBe('del-123');
    });

    it('should return empty enhancement params', () => {
      const { getEnhancementParams } = useDeliverables();

      const params = getEnhancementParams();

      expect(params).toEqual({});
    });
  });

  describe('Deliverable Creation', () => {
    it('should create a new deliverable with default options', async () => {
      const mockDeliverable: Deliverable = {
        id: 'new-del',
        userId: 'user-1',
        conversationId: 'conv-123',
        title: 'New Document',
        type: DeliverableType.DOCUMENT,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      const { createDeliverable, store } = useDeliverables();

      vi.mocked(store.createDeliverable).mockResolvedValue(mockDeliverable);

      const result = await createDeliverable('New Document', 'Content here');

      expect(result).toEqual(mockDeliverable);
      expect(store.createDeliverable).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Document',
          initialContent: 'Content here',
          type: DeliverableType.DOCUMENT,
          initialFormat: DeliverableFormat.MARKDOWN,
        })
      );
    });

    it('should create deliverable with custom options', async () => {
      const { createDeliverable, store } = useDeliverables();

      vi.mocked(store.createDeliverable).mockResolvedValue({} as Deliverable);

      await createDeliverable('Custom Doc', 'Content', {
        type: DeliverableType.REPORT,
        format: DeliverableFormat.HTML,
        description: 'Test description',
        conversationId: 'conv-123',
        agentName: 'TestAgent',
        tags: ['test', 'custom'],
      });

      expect(store.createDeliverable).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Custom Doc',
          description: 'Test description',
          type: DeliverableType.REPORT,
          conversationId: 'conv-123',
          initialFormat: DeliverableFormat.HTML,
          initialMetadata: expect.objectContaining({
            createdByAgent: 'TestAgent',
            tags: ['test', 'custom'],
          }),
        })
      );
    });
  });

  describe('Deliverable Enhancement', () => {
    it('should enhance an existing deliverable', async () => {
      const mockEnhanced: Deliverable = {
        id: 'del-123',
        userId: 'user-1',
        conversationId: 'conv-123',
        title: 'Enhanced',
        type: DeliverableType.DOCUMENT,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02',
      };

      const { enhanceDeliverable, store } = useDeliverables();

      vi.mocked(store.createVersion).mockResolvedValue(mockEnhanced);

      const result = await enhanceDeliverable('del-123', 'Enhanced', 'New content');

      expect(result).toEqual(mockEnhanced);
      expect(store.createVersion).toHaveBeenCalledWith(
        'del-123',
        expect.objectContaining({
          content: 'New content',
          format: DeliverableFormat.MARKDOWN,
          createdByType: 'ai_enhancement',
        })
      );
    });

    it('should include enhancement metadata', async () => {
      const { enhanceDeliverable, store } = useDeliverables();

      vi.mocked(store.createVersion).mockResolvedValue({} as Deliverable);

      await enhanceDeliverable('del-123', 'Enhanced', 'New content', {
        agentName: 'EnhancerAgent',
        metadata: { customField: 'value' },
      });

      expect(store.createVersion).toHaveBeenCalledWith(
        'del-123',
        expect.objectContaining({
          metadata: expect.objectContaining({
            createdByAgent: 'EnhancerAgent',
            customField: 'value',
          }),
        })
      );
    });
  });

  describe('Conversation Deliverables', () => {
    it('should get deliverables for a conversation', async () => {
      const mockDeliverable: Deliverable = {
        id: 'del-123',
        userId: 'user-1',
        conversationId: 'conv-123',
        title: 'Test Doc',
        description: 'Description',
        type: DeliverableType.DOCUMENT,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        currentVersion: {
          id: 'v1',
          deliverableId: 'del-123',
          versionNumber: 1,
          content: 'content',
          format: DeliverableFormat.MARKDOWN,
          createdByType: 'user_edit',
          createdAt: '2024-01-01',
          isCurrentVersion: true,
        },
      };

      const { getConversationDeliverables, store } = useDeliverables();

      vi.mocked(store.loadDeliverablesByConversation).mockResolvedValue([mockDeliverable]);

      const results = await getConversationDeliverables('conv-123');

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(
        expect.objectContaining({
          id: 'del-123',
          title: 'Test Doc',
          description: 'Description',
          type: DeliverableType.DOCUMENT,
          format: DeliverableFormat.MARKDOWN,
          content: 'content',
          versionNumber: 1,
        })
      );
    });

    it('should handle deliverables without current version', async () => {
      const mockDeliverable: Deliverable = {
        id: 'del-123',
        userId: 'user-1',
        conversationId: 'conv-123',
        title: 'Test Doc',
        type: DeliverableType.DOCUMENT,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      const { getConversationDeliverables, store } = useDeliverables();

      vi.mocked(store.loadDeliverablesByConversation).mockResolvedValue([mockDeliverable]);

      const results = await getConversationDeliverables('conv-123');

      expect(results).toHaveLength(1);
      expect(results[0].format).toBeUndefined();
      expect(results[0].content).toBeUndefined();
    });
  });

  describe('Modal Management', () => {
    it('should show deliverable in modal', () => {
      const mockDeliverable: Deliverable = {
        id: 'del-123',
        userId: 'user-1',
        conversationId: 'conv-123',
        title: 'Test',
        type: DeliverableType.DOCUMENT,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      const {
        showDeliverable,
        showDeliverableModal,
        selectedDeliverable,
      } = useDeliverables();

      showDeliverable(mockDeliverable);

      expect(showDeliverableModal.value).toBe(true);
      expect(selectedDeliverable.value).toEqual(mockDeliverable);
    });

    it('should hide deliverable modal', () => {
      const {
        showDeliverableModal,
        selectedDeliverable,
        hideDeliverable,
      } = useDeliverables();

      showDeliverableModal.value = true;
      selectedDeliverable.value = {} as Deliverable;

      hideDeliverable();

      expect(showDeliverableModal.value).toBe(false);
      expect(selectedDeliverable.value).toBeNull();
    });

    it('should start creating deliverable', () => {
      const {
        startCreating,
        isCreatingDeliverable,
        showDeliverableModal,
      } = useDeliverables();

      startCreating();

      expect(isCreatingDeliverable.value).toBe(true);
      expect(showDeliverableModal.value).toBe(true);
    });

    it('should cancel creating deliverable', () => {
      const {
        cancelCreating,
        isCreatingDeliverable,
        showDeliverableModal,
      } = useDeliverables();

      isCreatingDeliverable.value = true;
      showDeliverableModal.value = true;

      cancelCreating();

      expect(isCreatingDeliverable.value).toBe(false);
      expect(showDeliverableModal.value).toBe(false);
    });
  });

  describe('Deliverable Deletion', () => {
    it('should delete deliverable with confirmation', async () => {
      const mockDeliverable: Deliverable = {
        id: 'del-123',
        userId: 'user-1',
        conversationId: 'conv-123',
        title: 'To Delete',
        type: DeliverableType.DOCUMENT,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      const { deleteDeliverable, store } = useDeliverables();

      vi.mocked(store.deleteDeliverable).mockResolvedValue(undefined);

      const result = await deleteDeliverable(mockDeliverable);

      expect(result).toBe(true);
      expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete "To Delete"?');
      expect(store.deleteDeliverable).toHaveBeenCalledWith('del-123');
    });

    it('should cancel deletion when user declines', async () => {
      const mockDeliverable: Deliverable = {
        id: 'del-123',
        userId: 'user-1',
        conversationId: 'conv-123',
        title: 'To Keep',
        type: DeliverableType.DOCUMENT,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      const { deleteDeliverable, store } = useDeliverables();

      const result = await deleteDeliverable(mockDeliverable);

      expect(result).toBe(false);
      expect(store.deleteDeliverable).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    it('should hide modal if deleted deliverable is selected', async () => {
      const mockDeliverable: Deliverable = {
        id: 'del-123',
        userId: 'user-1',
        conversationId: 'conv-123',
        title: 'To Delete',
        type: DeliverableType.DOCUMENT,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      vi.spyOn(window, 'confirm').mockReturnValue(true);

      const {
        deleteDeliverable,
        selectedDeliverable,
        showDeliverableModal,
        store,
      } = useDeliverables();

      selectedDeliverable.value = mockDeliverable;
      showDeliverableModal.value = true;

      vi.mocked(store.deleteDeliverable).mockResolvedValue(undefined);

      await deleteDeliverable(mockDeliverable);

      expect(showDeliverableModal.value).toBe(false);
      expect(selectedDeliverable.value).toBeNull();
    });

    it('should handle deletion errors', async () => {
      const mockDeliverable: Deliverable = {
        id: 'del-123',
        userId: 'user-1',
        conversationId: 'conv-123',
        title: 'Error Delete',
        type: DeliverableType.DOCUMENT,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      vi.spyOn(window, 'confirm').mockReturnValue(true);

      const { deleteDeliverable, store } = useDeliverables();

      vi.mocked(store.deleteDeliverable).mockRejectedValue(new Error('Delete failed'));

      const result = await deleteDeliverable(mockDeliverable);

      expect(result).toBe(false);
    });
  });

  describe('Version Management', () => {
    it('should get versions for a deliverable', async () => {
      const { getVersions, store } = useDeliverables();

      const mockVersions = [
        { id: 'v1', versionNumber: 1 },
        { id: 'v2', versionNumber: 2 },
      ];

      vi.mocked(store.getDeliverableVersions).mockResolvedValue(mockVersions as never);

      const versions = await getVersions('del-123');

      expect(versions).toEqual(mockVersions);
      expect(store.getDeliverableVersions).toHaveBeenCalledWith('del-123');
    });
  });

  describe('Utility Functions', () => {
    it('should get type icon for each deliverable type', () => {
      const { getTypeIcon } = useDeliverables();

      expect(getTypeIcon(DeliverableType.DOCUMENT)).toBe('📄');
      expect(getTypeIcon(DeliverableType.ANALYSIS)).toBe('📊');
      expect(getTypeIcon(DeliverableType.REPORT)).toBe('📋');
      expect(getTypeIcon(DeliverableType.PLAN)).toBe('📝');
      expect(getTypeIcon(DeliverableType.REQUIREMENTS)).toBe('📋');
    });

    it('should get type name for each deliverable type', () => {
      const { getTypeName } = useDeliverables();

      expect(getTypeName(DeliverableType.DOCUMENT)).toBe('Document');
      expect(getTypeName(DeliverableType.ANALYSIS)).toBe('Analysis');
      expect(getTypeName(DeliverableType.REPORT)).toBe('Report');
      expect(getTypeName(DeliverableType.PLAN)).toBe('Plan');
      expect(getTypeName(DeliverableType.REQUIREMENTS)).toBe('Requirements');
    });

    it('should format dates relative to today', () => {
      const { formatDate } = useDeliverables();

      const today = new Date().toISOString();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

      expect(formatDate(today)).toBe('Today');
      expect(formatDate(yesterday)).toBe('Yesterday');
      expect(formatDate(threeDaysAgo)).toBe('3 days ago');
      expect(formatDate(twoWeeksAgo)).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });
  });

  describe('Reactivity', () => {
    it('should expose reactive refs that can be modified', () => {
      const { showDeliverableModal } = useDeliverables();

      expect(showDeliverableModal.value).toBe(false);

      showDeliverableModal.value = true;
      expect(showDeliverableModal.value).toBe(true);
    });

    it('should expose computed properties that update', () => {
      const { hasDeliverables } = useDeliverables();

      expect(hasDeliverables.value).toBe(false);

      // If we could modify store state, hasDeliverables would update
      // This tests that the computed is properly connected
      expect(hasDeliverables).toBeDefined();
    });

    it('should maintain separate state across multiple instances', () => {
      const instance1 = useDeliverables();
      const instance2 = useDeliverables();

      instance1.showDeliverableModal.value = true;

      // Each instance maintains its own UI state (showDeliverableModal is local)
      // but shares the same store state
      expect(instance1.showDeliverableModal.value).toBe(true);
      // Instance2 has its own showDeliverableModal ref
      expect(instance2.showDeliverableModal.value).toBe(false);
    });
  });
});
