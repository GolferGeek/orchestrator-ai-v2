/**
 * Privacy Indicators Integration Tests
 * Tests the integration between privacy store and UI components
 * Updated for Phase 4.3 consolidated privacyStore
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePrivacyStore } from '@/stores/privacyStore';

// Mock the deliverables store
vi.mock('@/stores/deliverablesStore', () => ({
  useDeliverablesStore: () => ({
    getDeliverableById: vi.fn(() => null),
    getDeliverablesByConversation: vi.fn(() => []),
    $state: {}
  })
}));

// Mock other stores
vi.mock('@/stores/sanitizationStore', () => ({
  useSanitizationStore: () => ({
    currentResult: {
      success: true,
      totalDetections: 2,
      totalProcessingTime: 150
    },
    isProcessing: false,
    error: null
  })
}));

vi.mock('@/stores/llmAnalyticsStore', () => ({
  useLLMAnalyticsStore: () => ({
    usageRecords: []
  })
}));

vi.mock('@/stores/agentChatStore', () => ({
  useAgentChatStore: () => ({
    conversations: []
  })
}));

describe('Privacy Indicators Integration', () => {
  let privacyStore: ReturnType<typeof usePrivacyStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    privacyStore = usePrivacyStore();
  });

  describe('Privacy Store State Management', () => {
    it('manages message privacy states correctly', () => {
      // Create privacy state for a message
      privacyStore.updateMessagePrivacyState('test-message-1', {
        conversationId: 'test-conversation',
        isDataProtected: true,
        sanitizationStatus: 'completed',
        piiDetectionCount: 3,
        routingMode: 'external',
        trustLevel: 'high',
        trustScore: 85,
        processingTimeMs: 250
      });

      const state = privacyStore.getMessagePrivacyState('test-message-1');
      expect(state).not.toBe(null);
      expect(state?.isDataProtected).toBe(true);
      expect(state?.sanitizationStatus).toBe('completed');
      expect(state?.piiDetectionCount).toBe(3);
    });

    it('manages conversation settings correctly', () => {
      privacyStore.setConversationSettings('test-conversation', {
        showDataProtection: true,
        showSanitizationStatus: true,
        showRoutingDisplay: true,
        showTrustSignal: true,
        showPiiCount: true,
        showProcessingTime: true,
        compactMode: false
      });

      const settings = privacyStore.getConversationSettings('test-conversation');
      expect(settings).not.toBe(null);
      expect(settings?.showDataProtection).toBe(true);
      expect(settings?.compactMode).toBe(false);
    });

    it('uses default settings when no conversation settings exist', () => {
      const settings = privacyStore.getConversationSettings('non-existent');
      expect(settings).toBe(null);
    });
  });

  describe('Real-time Privacy State Updates', () => {
    it('updates privacy indicators when store state changes', () => {
      // Initial state
      privacyStore.updateMessagePrivacyState('test-message-1', {
        isDataProtected: false,
        sanitizationStatus: 'processing'
      });

      let state = privacyStore.getMessagePrivacyState('test-message-1');
      expect(state?.isDataProtected).toBe(false);

      // Update store state
      privacyStore.updateMessagePrivacyState('test-message-1', {
        isDataProtected: true,
        sanitizationStatus: 'completed'
      });

      state = privacyStore.getMessagePrivacyState('test-message-1');
      expect(state?.isDataProtected).toBe(true);
      expect(state?.sanitizationStatus).toBe('completed');
    });

    it('tracks update count for message states', () => {
      privacyStore.updateMessagePrivacyState('test-msg', {});
      let state = privacyStore.getMessagePrivacyState('test-msg');
      expect(state?.updateCount).toBe(1);

      privacyStore.updateMessagePrivacyState('test-msg', { trustScore: 80 });
      state = privacyStore.getMessagePrivacyState('test-msg');
      expect(state?.updateCount).toBe(2);
    });
  });

  describe('Conversation Settings Integration', () => {
    it('applies conversation-specific display settings', () => {
      privacyStore.setConversationSettings('test-conversation', {
        showDataProtection: false,
        showSanitizationStatus: true,
        showRoutingDisplay: false,
        showTrustSignal: true,
        compactMode: true
      });

      const settings = privacyStore.getConversationSettings('test-conversation');
      expect(settings?.showDataProtection).toBe(false);
      expect(settings?.showSanitizationStatus).toBe(true);
      expect(settings?.showRoutingDisplay).toBe(false);
      expect(settings?.showTrustSignal).toBe(true);
      expect(settings?.compactMode).toBe(true);
    });

    it('handles missing conversation ID gracefully', () => {
      const settings = privacyStore.getConversationSettings('');
      expect(settings).toBe(null);
    });
  });

  describe('Privacy State Calculation', () => {
    it('stores routing mode correctly', () => {
      privacyStore.updateMessagePrivacyState('local-message', {
        routingMode: 'local'
      });

      const state = privacyStore.getMessagePrivacyState('local-message');
      expect(state?.routingMode).toBe('local');
    });

    it('stores data protection level correctly', () => {
      privacyStore.updateMessagePrivacyState('protected-msg', {
        isDataProtected: true,
        dataProtectionLevel: 'full'
      });

      const state = privacyStore.getMessagePrivacyState('protected-msg');
      expect(state?.isDataProtected).toBe(true);
      expect(state?.dataProtectionLevel).toBe('full');
    });
  });

  describe('Error Handling', () => {
    it('handles missing message metadata gracefully', () => {
      // Create state with minimal data
      privacyStore.updateMessagePrivacyState('no-metadata-message', {});

      const state = privacyStore.getMessagePrivacyState('no-metadata-message');
      expect(state).not.toBe(null);
      // Should have default values
      expect(state?.routingMode).toBe('local');
      expect(state?.processingTimeMs).toBe(0);
    });

    it('handles store errors gracefully', () => {
      // Should not throw for valid operations
      expect(() => {
        privacyStore.updateMessagePrivacyState('test', {});
        privacyStore.getMessagePrivacyState('test');
        privacyStore.setConversationSettings('test', {});
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('does not cause excessive state updates', () => {
      const conversationId = 'test-conversation';

      // Multiple rapid state updates
      for (let i = 0; i < 5; i++) {
        privacyStore.updateMessagePrivacyState('test-message-1', {
          conversationId,
          trustScore: 80 + i
        });
      }

      const state = privacyStore.getMessagePrivacyState('test-message-1');
      expect(state?.updateCount).toBe(5);
      expect(state?.trustScore).toBe(84);
    });

    it('handles large numbers of privacy states efficiently', () => {
      const startTime = Date.now();

      // Create many privacy states
      for (let i = 0; i < 1000; i++) {
        privacyStore.updateMessagePrivacyState(`message-${i}`, {
          conversationId: 'test-conversation',
          isDataProtected: i % 2 === 0,
          trustScore: 50 + (i % 50)
        });
      }

      const endTime = Date.now();

      // Should complete within reasonable time (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);

      // Verify states were created correctly
      expect(privacyStore.messageStates.size).toBe(1000);
    });
  });
});
