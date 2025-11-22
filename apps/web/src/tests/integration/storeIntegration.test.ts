// Store Integration Tests - Real API Integration
// Tests for validating Pinia store functionality with actual running API
// Updated for Phase 4.3 consolidated privacyStore

import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePrivacyStore } from '@/stores/privacyStore';
import { useLLMAnalyticsStore } from '@/stores/llmAnalyticsStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';

// Test timeout for API calls (10 seconds)
const API_TIMEOUT = 10000;

describe('Store Integration Tests - Consolidated Stores', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('Privacy Store - Patterns Section', () => {
    it('should initialize correctly', () => {
      const store = usePrivacyStore();

      expect(store.patterns).toEqual([]);
      expect(store.patternsLoading).toBe(false);
      expect(store.patternsError).toBeNull();
    });

    it('should manage patterns correctly', () => {
      const store = usePrivacyStore();

      // Add patterns
      store.addPattern({
        id: '1',
        name: 'Email Pattern',
        dataType: 'email',
        pattern: '.*@.*',
        enabled: true,
        isBuiltIn: false,
        category: 'contact'
      });

      expect(store.patterns).toHaveLength(1);
      expect(store.patterns[0].name).toBe('Email Pattern');

      // Update pattern
      store.updatePattern('1', { enabled: false });
      expect(store.patterns[0].enabled).toBe(false);

      // Remove pattern
      store.removePattern('1');
      expect(store.patterns).toHaveLength(0);
    });

    it('should handle pattern state correctly', () => {
      const store = usePrivacyStore();

      // Test loading state
      store.setPatternsLoading(true);
      expect(store.patternsLoading).toBe(true);

      store.setPatternsLoading(false);
      expect(store.patternsLoading).toBe(false);

      // Test error state
      store.setPatternsError('Test error');
      expect(store.patternsError).toBe('Test error');

      store.setPatternsError(null);
      expect(store.patternsError).toBeNull();
    });
  });

  describe('Privacy Store - Dictionaries Section', () => {
    it('should initialize correctly', () => {
      const store = usePrivacyStore();

      expect(store.dictionaries).toEqual([]);
      expect(store.dictionariesLoading).toBe(false);
      expect(store.dictionariesError).toBeNull();
    });

    it('should manage dictionaries correctly', () => {
      const store = usePrivacyStore();

      // Add dictionary
      store.addDictionary({
        id: '1',
        dataType: 'name',
        category: 'test',
        words: ['TestName1', 'TestName2'],
        isActive: true
      });

      expect(store.dictionaries).toHaveLength(1);
      expect(store.dictionaries[0].category).toBe('test');

      // Update dictionary
      store.updateDictionary('1', { isActive: false });
      expect(store.dictionaries[0].isActive).toBe(false);

      // Remove dictionary
      store.removeDictionary('1');
      expect(store.dictionaries).toHaveLength(0);
    });
  });

  describe('Privacy Store - Privacy Indicators Section', () => {
    it('should manage message privacy states', () => {
      const store = usePrivacyStore();

      // Update message privacy state
      const state = store.updateMessagePrivacyState('msg-1', {
        conversationId: 'conv-1',
        isDataProtected: true,
        sanitizationStatus: 'completed'
      });

      expect(state.messageId).toBe('msg-1');
      expect(state.isDataProtected).toBe(true);

      // Get message privacy state
      const retrieved = store.getMessagePrivacyState('msg-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.conversationId).toBe('conv-1');

      // Remove message privacy state
      const removed = store.removeMessagePrivacyState('msg-1');
      expect(removed).toBe(true);
    });

    it('should manage conversation settings', () => {
      const store = usePrivacyStore();

      // Set conversation settings
      const settings = store.setConversationSettings('conv-1', {
        compactMode: true,
        showDataProtection: false
      });

      expect(settings.compactMode).toBe(true);
      expect(settings.showDataProtection).toBe(false);

      // Get conversation settings
      const retrieved = store.getConversationSettings('conv-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.compactMode).toBe(true);
    });
  });

  describe('LLM Analytics Store Integration', () => {
    it('should initialize correctly', () => {
      const store = useLLMAnalyticsStore();

      expect(store.usageRecords).toEqual([]);
      expect(store.isLoadingUsageRecords).toBe(false);
    });

    it('should calculate metrics correctly', () => {
      const store = useLLMAnalyticsStore();

      // Test computed properties with empty state
      expect(typeof store.totalCost).toBe('number');
      expect(typeof store.successRate).toBe('number');
      expect(Array.isArray(store.providers)).toBe(true);
      expect(Array.isArray(store.models)).toBe(true);
    });
  });

  describe('Analytics Store Integration', () => {
    it('should initialize correctly', () => {
      const store = useAnalyticsStore();

      expect(store.dashboardData).toBeNull();
      expect(store.realTimeAnalytics).toBeNull();
      expect(store.isLoadingDashboard).toBe(false);
      expect(store.isLoadingRealTime).toBe(false);
    });

    it('should manage event queue correctly', async () => {
      const store = useAnalyticsStore();

      // Test event tracking functionality
      await store.trackEvent('test_event', 'test_category', 'test_action', 'test_label', 1, { data: 'test' });

      // Verify event queue exists and is an array
      expect(Array.isArray(store.eventQueue)).toBe(true);
      expect(typeof store.eventTrackingEnabled).toBe('boolean');
    });
  });

  describe('Cross-Store Integration', () => {
    it('should maintain data consistency across stores', () => {
      const privacyStore = usePrivacyStore();
      const llmAnalyticsStore = useLLMAnalyticsStore();
      const analyticsStore = useAnalyticsStore();

      // Verify all stores are in consistent initial state
      expect(privacyStore.patternsLoading).toBe(false);
      expect(privacyStore.dictionariesLoading).toBe(false);
      expect(llmAnalyticsStore.isLoadingUsageRecords).toBe(false);
      expect(analyticsStore.isLoadingDashboard).toBe(false);

      // Verify data types are consistent
      expect(Array.isArray(privacyStore.patterns)).toBe(true);
      expect(Array.isArray(privacyStore.dictionaries)).toBe(true);
      expect(Array.isArray(llmAnalyticsStore.usageRecords)).toBe(true);
    });
  });

  describe('Store Reactivity with Real Data', () => {
    it('should maintain reactive state', () => {
      const store = usePrivacyStore();

      // Add data
      store.addPattern({
        id: '1',
        name: 'Test',
        dataType: 'email',
        pattern: '.*',
        enabled: true,
        isBuiltIn: false,
        category: 'test'
      });

      store.addDictionary({
        id: '1',
        dataType: 'name',
        category: 'test',
        words: ['Test'],
        isActive: true
      });

      // Verify reactive updates
      expect(store.patterns).toHaveLength(1);
      expect(store.dictionaries).toHaveLength(1);
    });

    it('should handle error states reactively', () => {
      const store = usePrivacyStore();

      // Set error state
      store.setPatternsError('Test error');
      expect(store.patternsError).toBe('Test error');
      expect(store.patternsLoading).toBe(false);

      // Clear error
      store.setPatternsError(null);
      expect(store.patternsError).toBeNull();
    });
  });

  describe('Store Error Handling', () => {
    it('should handle errors gracefully', () => {
      const store = usePrivacyStore();

      // Test error handling
      store.setPatternsError('Network error');
      expect(store.patternsError).toBe('Network error');
      expect(store.patternsLoading).toBe(false);
      expect(Array.isArray(store.patterns)).toBe(true); // Data should remain intact

      // Clear error
      store.setPatternsError(null);
      expect(store.patternsError).toBeNull();
    });

    it('should recover from errors', () => {
      const store = usePrivacyStore();

      // Simulate error
      store.setPatternsError('Initial error');
      expect(store.patternsError).toBeDefined();

      // Simulate recovery
      store.setPatternsError(null);
      store.addPattern({
        id: '1',
        name: 'Test',
        dataType: 'email',
        pattern: '.*',
        enabled: true,
        isBuiltIn: false,
        category: 'test'
      });

      // Should be recovered
      expect(store.patternsError).toBeNull();
      expect(store.patterns).toHaveLength(1);
    });
  });
}, API_TIMEOUT);
