/**
 * Unit Tests for Privacy Store - Privacy Indicators Section
 * Tests the privacy indicators functionality after Phase 4.3 consolidation into unified privacyStore
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePrivacyStore } from '../privacyStore';

describe('PrivacyStore - Privacy Indicators', () => {
  let store: ReturnType<typeof usePrivacyStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = usePrivacyStore();
  });

  describe('Initialization', () => {
    it('initializes with default state', () => {
      expect(store.indicatorsInitialized).toBe(false);
      expect(store.messageStates.size).toBe(0);
      expect(store.conversationSettings.size).toBe(0);
    });

    it('can set initialized flag', () => {
      store.setIndicatorsInitialized(true);
      expect(store.indicatorsInitialized).toBe(true);
    });
  });

  describe('Message Privacy State Management', () => {
    it('creates new message privacy state', () => {
      const messageId = 'test-message-1';
      const state = store.updateMessagePrivacyState(messageId, {
        conversationId: 'conv-1',
        isDataProtected: true,
        sanitizationStatus: 'completed',
        piiDetectionCount: 2
      });

      expect(state.messageId).toBe(messageId);
      expect(state.conversationId).toBe('conv-1');
      expect(state.isDataProtected).toBe(true);
      expect(state.sanitizationStatus).toBe('completed');
      expect(state.piiDetectionCount).toBe(2);
      expect(state.updateCount).toBe(1);
    });

    it('updates existing message privacy state', () => {
      const messageId = 'test-message-1';

      // Create initial state
      store.updateMessagePrivacyState(messageId, {
        isDataProtected: false,
        sanitizationStatus: 'processing'
      });

      // Update the state
      const updatedState = store.updateMessagePrivacyState(messageId, {
        isDataProtected: true,
        sanitizationStatus: 'completed'
      });

      expect(updatedState.isDataProtected).toBe(true);
      expect(updatedState.sanitizationStatus).toBe('completed');
      expect(updatedState.updateCount).toBe(2);
    });

    it('retrieves message privacy state', () => {
      const messageId = 'test-message-1';
      store.updateMessagePrivacyState(messageId, {
        isDataProtected: true
      });

      const retrievedState = store.getMessagePrivacyState(messageId);
      expect(retrievedState).not.toBe(null);
      expect(retrievedState?.messageId).toBe(messageId);
      expect(retrievedState?.isDataProtected).toBe(true);
    });

    it('returns null for non-existent message', () => {
      const state = store.getMessagePrivacyState('non-existent');
      expect(state).toBe(null);
    });

    it('removes message privacy state', () => {
      const messageId = 'test-message-1';
      store.updateMessagePrivacyState(messageId, {
        isDataProtected: true
      });

      const removed = store.removeMessagePrivacyState(messageId);
      expect(removed).toBe(true);

      const retrievedState = store.getMessagePrivacyState(messageId);
      expect(retrievedState).toBe(null);
    });

    it('returns false when removing non-existent message', () => {
      const removed = store.removeMessagePrivacyState('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('Conversation Settings Management', () => {
    it('sets conversation privacy settings', () => {
      const conversationId = 'conv-1';
      const settings = store.setConversationSettings(conversationId, {
        showDataProtection: false,
        enableRealTimeUpdates: false,
        compactMode: true
      });

      expect(settings.conversationId).toBe(conversationId);
      expect(settings.showDataProtection).toBe(false);
      expect(settings.enableRealTimeUpdates).toBe(false);
      expect(settings.compactMode).toBe(true);
    });

    it('uses default values for unspecified settings', () => {
      const conversationId = 'conv-1';
      const settings = store.setConversationSettings(conversationId, {});

      expect(settings.showDataProtection).toBe(true);
      expect(settings.showSanitizationStatus).toBe(true);
      expect(settings.enableRealTimeUpdates).toBe(true);
      expect(settings.compactMode).toBe(false);
    });

    it('retrieves conversation settings', () => {
      const conversationId = 'conv-1';
      store.setConversationSettings(conversationId, {
        compactMode: true
      });

      const retrievedSettings = store.getConversationSettings(conversationId);
      expect(retrievedSettings).not.toBe(null);
      expect(retrievedSettings?.conversationId).toBe(conversationId);
      expect(retrievedSettings?.compactMode).toBe(true);
    });

    it('returns null for non-existent conversation settings', () => {
      const settings = store.getConversationSettings('non-existent');
      expect(settings).toBe(null);
    });
  });

  describe('Conversation Message States', () => {
    it('retrieves message states for a conversation', () => {
      const conversationId = 'conv-1';

      store.updateMessagePrivacyState('msg-1', {
        conversationId,
        isDataProtected: true
      });

      store.updateMessagePrivacyState('msg-2', {
        conversationId,
        isDataProtected: false
      });

      store.updateMessagePrivacyState('msg-3', {
        conversationId: 'conv-2',
        isDataProtected: true
      });

      const conversationStates = store.getConversationMessageStates(conversationId);
      expect(conversationStates).toHaveLength(2);
      expect(conversationStates.every(state => state.conversationId === conversationId)).toBe(true);
    });

    it('returns empty array for conversation with no messages', () => {
      const conversationStates = store.getConversationMessageStates('empty-conv');
      expect(conversationStates).toHaveLength(0);
    });

    it('clears all message states for a conversation', () => {
      const conversationId = 'conv-1';

      store.updateMessagePrivacyState('msg-1', { conversationId });
      store.updateMessagePrivacyState('msg-2', { conversationId });
      store.setConversationSettings(conversationId, {});

      store.clearConversationPrivacyStates(conversationId);

      const conversationStates = store.getConversationMessageStates(conversationId);
      expect(conversationStates).toHaveLength(0);

      const settings = store.getConversationSettings(conversationId);
      expect(settings).toBe(null);
    });
  });

  describe('Global Settings', () => {
    it('has default global settings', () => {
      expect(store.globalSettings.enableGlobalRealTime).toBe(true);
      expect(store.globalSettings.defaultUpdateInterval).toBe(2000);
      expect(store.globalSettings.maxStoredStates).toBe(100);
    });

    it('allows modifying global settings', () => {
      store.globalSettings.maxStoredStates = 50;
      expect(store.globalSettings.maxStoredStates).toBe(50);
    });
  });

  describe('Default State Values', () => {
    it('creates message state with default values for unspecified properties', () => {
      const state = store.updateMessagePrivacyState('test-msg', {});

      expect(state.isDataProtected).toBe(false);
      expect(state.dataProtectionLevel).toBe('none');
      expect(state.sanitizationStatus).toBe('none');
      expect(state.piiDetectionCount).toBe(0);
      expect(state.routingMode).toBe('local');
      expect(state.trustLevel).toBe('medium');
      expect(state.trustScore).toBe(null);
      expect(state.processingTimeMs).toBe(0);
      expect(state.isProcessing).toBe(false);
      expect(state.hasErrors).toBe(false);
      expect(state.errorMessage).toBe(null);
    });
  });
});
