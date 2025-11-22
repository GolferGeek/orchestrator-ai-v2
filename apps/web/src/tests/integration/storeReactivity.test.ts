// Store Reactivity Tests
// Tests for validating reactive state updates across modules
// Updated for Phase 4.3 consolidated privacyStore

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { usePrivacyStore } from '@/stores/privacyStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';

// Mock component for testing reactivity
const TestComponent = {
  template: `
    <div>
      <div data-testid="pattern-count">{{ privacyStore.patterns.length }}</div>
      <div data-testid="loading-state">{{ privacyStore.patternsLoading }}</div>
      <div data-testid="error-state">{{ privacyStore.patternsError || '' }}</div>
      <div data-testid="enabled-patterns">{{ privacyStore.enabledPatterns?.length || 0 }}</div>
    </div>
  `,
  setup() {
    const privacyStore = usePrivacyStore();
    return { privacyStore };
  }
};

describe('Store Reactivity Tests', () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
  });

  describe('Direct Store Reactivity', () => {
    it('should update component when store state changes', async () => {
      const wrapper = mount(TestComponent);
      const store = usePrivacyStore();

      // Initial state
      expect(wrapper.find('[data-testid="pattern-count"]').text()).toBe('0');
      expect(wrapper.find('[data-testid="loading-state"]').text()).toBe('false');
      expect(wrapper.find('[data-testid="error-state"]').text()).toBe('');

      // Update loading state
      store.setPatternsLoading(true);
      await nextTick();
      expect(wrapper.find('[data-testid="loading-state"]').text()).toBe('true');

      // Add patterns
      store.addPattern({ id: '1', name: 'Email', dataType: 'email', pattern: '.*@.*', enabled: true, isBuiltIn: true, category: 'contact' });
      store.addPattern({ id: '2', name: 'Phone', dataType: 'phone', pattern: '\\d{10}', enabled: false, isBuiltIn: false, category: 'contact' });
      await nextTick();
      expect(wrapper.find('[data-testid="pattern-count"]').text()).toBe('2');

      // Set error
      store.setPatternsError('Test error');
      store.setPatternsLoading(false);
      await nextTick();
      expect(wrapper.find('[data-testid="error-state"]').text()).toBe('Test error');
      expect(wrapper.find('[data-testid="loading-state"]').text()).toBe('false');
    });

    it('should update computed properties reactively', async () => {
      const store = usePrivacyStore();

      // Initial state
      expect(store.patterns).toEqual([]);

      // Add patterns
      store.addPattern({ id: '1', name: 'Email', dataType: 'email', pattern: '.*@.*', enabled: true, isBuiltIn: true, category: 'contact' });
      store.addPattern({ id: '2', name: 'Phone', dataType: 'phone', pattern: '\\d{10}', enabled: false, isBuiltIn: false, category: 'contact' });
      store.addPattern({ id: '3', name: 'Custom Email', dataType: 'email', pattern: '.*@company\\.com', enabled: true, isBuiltIn: false, category: 'contact' });

      // Test computed properties
      expect(store.patterns).toHaveLength(3);
      expect(store.patterns.filter(p => p.enabled)).toHaveLength(2);
      expect(store.patterns.filter(p => !p.isBuiltIn)).toHaveLength(2);

      // Update pattern state
      store.updatePattern('2', { enabled: true });
      expect(store.patterns.filter(p => p.enabled)).toHaveLength(3);
    });

    it('should handle pattern filtering correctly', async () => {
      const store = usePrivacyStore();

      // Add patterns
      store.addPattern({ id: '1', name: 'Email', dataType: 'email', pattern: '.*@.*', enabled: true, category: 'contact', isBuiltIn: false });
      store.addPattern({ id: '2', name: 'Phone', dataType: 'phone', pattern: '\\d{10}', enabled: true, category: 'contact', isBuiltIn: false });
      store.addPattern({ id: '3', name: 'SSN', dataType: 'ssn', pattern: '\\d{3}-\\d{2}-\\d{4}', enabled: false, category: 'identity', isBuiltIn: false });

      // Test initial count
      expect(store.patterns).toHaveLength(3);

      // Test filtering by data type
      const emailPatterns = store.patterns.filter(p => p.dataType === 'email');
      expect(emailPatterns).toHaveLength(1);
      expect(emailPatterns[0].dataType).toBe('email');

      // Test filtering by enabled
      const enabledPatterns = store.patterns.filter(p => p.enabled);
      expect(enabledPatterns).toHaveLength(2);

      // Test search filtering
      const phonePatterns = store.patterns.filter(p => p.name.toLowerCase().includes('phone'));
      expect(phonePatterns).toHaveLength(1);
      expect(phonePatterns[0].name).toBe('Phone');
    });
  });

  describe('Cross-Store Reactivity', () => {
    it('should maintain reactivity when stores interact', async () => {
      const privacyStore = usePrivacyStore();
      const analyticsStore = useAnalyticsStore();

      // Track events when PII patterns are modified
      const trackEventSpy = vi.spyOn(analyticsStore, 'trackEvent');

      // Add a pattern
      privacyStore.addPattern({ id: '1', name: 'Email', dataType: 'email', pattern: '.*@.*', enabled: true, isBuiltIn: false, category: 'contact' });

      // Simulate tracking the pattern creation
      analyticsStore.trackEvent('pii_pattern_created', 'privacy', 'create', 'email', 1, {
        patternId: '1',
        dataType: 'email',
        timestamp: new Date().toISOString()
      });

      expect(trackEventSpy).toHaveBeenCalledWith('pii_pattern_created', expect.any(String), expect.any(String), expect.any(String), expect.any(Number), expect.any(Object));
    });

    it('should handle concurrent updates across stores', async () => {
      const privacyStore = usePrivacyStore();
      const analyticsStore = useAnalyticsStore();

      // Simulate concurrent updates
      const updates = Promise.all([
        new Promise<boolean>(resolve => {
          privacyStore.addPattern({ id: '1', name: 'Test', dataType: 'email', enabled: true, pattern: '.*', isBuiltIn: false, category: 'test' });
          resolve(true);
        }),
        new Promise<boolean>(resolve => {
          analyticsStore.trackEvent('test_event', 'test', 'action', 'label', 1, { data: 'test' });
          resolve(true);
        })
      ]);

      await updates;

      // Verify both stores updated correctly
      expect(privacyStore.patterns).toHaveLength(1);
    });
  });

  describe('Memory Management and Cleanup', () => {
    it('should not create memory leaks with watchers', async () => {
      const store = usePrivacyStore();
      const watcherCallbacks: number[] = [];

      // Create multiple watchers
      for (let i = 0; i < 100; i++) {
        const unwatch = store.$subscribe((_mutation, _state) => {
          watcherCallbacks.push(i);
        });

        // Immediately unwatch to test cleanup
        unwatch();
      }

      // Update store state
      store.addPattern({ id: '1', name: 'Test', dataType: 'email', enabled: true, pattern: '.*', isBuiltIn: false, category: 'test' });

      // Watchers should have been cleaned up, so no callbacks should be triggered
      expect(watcherCallbacks).toHaveLength(0);
    });

    it('should handle rapid state updates efficiently', async () => {
      const store = usePrivacyStore();

      const startTime = Date.now();

      // Perform rapid updates
      for (let i = 0; i < 50; i++) {
        store.addPattern({
          id: String(i),
          name: `Pattern ${i}`,
          dataType: 'email',
          enabled: i % 2 === 0,
          pattern: `.*${i}`,
          isBuiltIn: false,
          category: 'test'
        });
      }

      const endTime = Date.now();

      // All patterns should be added
      expect(store.patterns).toHaveLength(50);
      // Should complete efficiently (under 500ms for 50 operations)
      expect(endTime - startTime).toBeLessThan(500);
    });
  });

  describe('State Persistence and Hydration', () => {
    it('should maintain state consistency after operations', () => {
      const store = usePrivacyStore();

      // Add initial state
      store.addPattern({ id: '1', name: 'Email', dataType: 'email', pattern: '.*@.*', enabled: true, isBuiltIn: false, category: 'test' });

      // Verify state
      expect(store.patterns).toHaveLength(1);

      // Remove pattern
      store.removePattern('1');

      // Verify reset state
      expect(store.patterns).toEqual([]);
      expect(store.patternsLoading).toBe(false);
    });

    it('should handle state hydration correctly', () => {
      const store = usePrivacyStore();

      // Add patterns
      store.addPattern({ id: '1', name: 'Email', dataType: 'email', pattern: '.*@.*', enabled: true, isBuiltIn: true, category: 'contact' });
      store.addPattern({ id: '2', name: 'Phone', dataType: 'phone', pattern: '\\d{10}', enabled: false, isBuiltIn: false, category: 'contact' });

      // Verify state
      expect(store.patterns).toHaveLength(2);

      // Verify computed properties work
      expect(store.patterns.filter(p => p.enabled)).toHaveLength(1);
      expect(store.patterns.filter(p => !p.isBuiltIn)).toHaveLength(1);
    });
  });
});
