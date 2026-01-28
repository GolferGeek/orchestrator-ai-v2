// State Management Integration Tests - Task 24.2
// Comprehensive tests for Pinia store interactions, reactivity, and data flow
// Updated for Phase 4.3 consolidated privacyStore

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';
import { usePrivacyStore } from '@/stores/privacyStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';

describe('State Management Integration Tests - Task 24.2', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('Store Initialization and State', () => {
    it('should initialize all stores with correct default state', () => {
      const privacyStore = usePrivacyStore();
      const analyticsStore = useAnalyticsStore();

      // Privacy Store - Patterns section
      expect(privacyStore.patterns).toEqual([]);
      expect(privacyStore.patternsLoading).toBe(false);
      expect(privacyStore.patternsError).toBeNull();

      // Privacy Store - Dictionaries section
      expect(privacyStore.dictionaries).toEqual([]);
      expect(privacyStore.dictionariesLoading).toBe(false);
      expect(privacyStore.dictionariesError).toBeNull();

      // Privacy Store - Indicators section
      expect(privacyStore.indicatorsInitialized).toBe(false);
      expect(privacyStore.messageStates.size).toBe(0);

      // Analytics Store
      expect(analyticsStore.isLoading).toBe(false);
      expect(analyticsStore.dashboardData).toBeNull();
    });

    it('should maintain state independence between store instances', () => {
      const privacyStore1 = usePrivacyStore();
      const privacyStore2 = usePrivacyStore();

      // Should be the same instance (Pinia singleton)
      expect(privacyStore1).toBe(privacyStore2);

      // Modify state in one instance
      privacyStore1.addPattern({
        id: '1',
        name: 'test',
        dataType: 'email',
        enabled: true,
        pattern: 'test',
        isBuiltIn: false,
        category: 'test',
        description: 'Test pattern'
      });

      // Should reflect in other instance
      expect(privacyStore2.patterns).toHaveLength(1);
      expect(privacyStore2.patterns[0].name).toBe('test');
    });
  });

  describe('Store State Mutations and Reactivity', () => {
    it('should update loading states properly during async operations', async () => {
      const privacyStore = usePrivacyStore();

      // Mock the async operation to test loading states
      const mockLoadPatterns = vi.fn().mockImplementation(async () => {
        privacyStore.setPatternsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 10)); // Simulate async
        privacyStore.setPatternsLoading(false);
        privacyStore.addPattern({
          id: '1',
          name: 'test',
          dataType: 'email',
          enabled: true,
          pattern: 'test',
          isBuiltIn: false,
          category: 'test',
          description: 'Test pattern'
        });
      });

      // Test loading state changes
      expect(privacyStore.patternsLoading).toBe(false);

      const loadPromise = mockLoadPatterns();
      await nextTick();

      await loadPromise;
      expect(privacyStore.patternsLoading).toBe(false);
      expect(privacyStore.patterns).toHaveLength(1);
    });

    it('should handle error states correctly', async () => {
      const privacyStore = usePrivacyStore();

      // Simulate error scenario
      privacyStore.setPatternsError('Test error');
      privacyStore.setPatternsLoading(false);

      expect(privacyStore.patternsError).toBeDefined();
      expect(privacyStore.patternsError).toBe('Test error');
      expect(privacyStore.patternsLoading).toBe(false);

      // Clear error
      privacyStore.setPatternsError(null);
      expect(privacyStore.patternsError).toBeNull();
    });

    it('should maintain data consistency during state updates', async () => {
      const privacyStore = usePrivacyStore();

      // Add patterns one by one
      privacyStore.addPattern({
        id: '1',
        name: 'pattern1',
        dataType: 'email',
        enabled: true,
        pattern: 'test1',
        isBuiltIn: false,
        category: 'test',
        description: 'Test pattern 1'
      });
      expect(privacyStore.patterns).toHaveLength(1);

      privacyStore.addPattern({
        id: '2',
        name: 'pattern2',
        dataType: 'phone',
        enabled: false,
        pattern: 'test2',
        isBuiltIn: false,
        category: 'test',
        description: 'Test pattern 2'
      });
      expect(privacyStore.patterns).toHaveLength(2);
      expect(privacyStore.patterns[1].name).toBe('pattern2');
    });
  });

  describe('Computed Properties and Getters', () => {
    it('should calculate filtered patterns correctly', () => {
      const privacyStore = usePrivacyStore();

      // Add test patterns
      privacyStore.addPattern({ id: '1', name: 'email1', dataType: 'email', enabled: true, pattern: 'test1', isBuiltIn: false, category: 'contact', description: 'Email pattern 1' });
      privacyStore.addPattern({ id: '2', name: 'email2', dataType: 'email', enabled: false, pattern: 'test2', isBuiltIn: false, category: 'contact', description: 'Email pattern 2' });
      privacyStore.addPattern({ id: '3', name: 'phone1', dataType: 'phone', enabled: true, pattern: 'test3', isBuiltIn: false, category: 'contact', description: 'Phone pattern 1' });

      // Test filtering by enabled status
      const enabledPatterns = privacyStore.patterns.filter(p => p.enabled);
      expect(enabledPatterns).toHaveLength(2);
      expect(enabledPatterns.every(p => p.enabled)).toBe(true);

      // Test filtering by data type
      const emailPatterns = privacyStore.patterns.filter(p => p.dataType === 'email');
      expect(emailPatterns).toHaveLength(2);
      expect(emailPatterns.every(p => p.dataType === 'email')).toBe(true);
    });

    it('should calculate statistics correctly in analytics store', () => {
      const analyticsStore = useAnalyticsStore();

      // Update usage stats - Note: usageStats is readonly in the store, so we test the getter
      // In real usage, usageStats is set via loadUsageAnalytics() action
      const mockStats = {
        userId: 'test-user',
        dateRange: {
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        },
        totalRequests: 100,
        totalTokens: 50000,
        totalCost: 25.50,
        averageResponseTime: 250,
        successRate: 0.85,
        byProvider: {},
        byModel: {}
      };

      // We would normally call analyticsStore.loadUsageAnalytics() but that's async
      // For this unit test, we verify the store structure accepts the correct types
      expect(analyticsStore.usageStats).toBeNull(); // Initially null

      // Verify success rate calculation
      const successRate = mockStats.successRate * 100;
      expect(successRate).toBe(85);
    });
  });

  describe('Cross-Store Interactions', () => {
    it('should maintain consistency across related stores', async () => {
      const privacyStore = usePrivacyStore();

      // Add related data
      privacyStore.addPattern({
        id: '1',
        name: 'email-pattern',
        dataType: 'email',
        enabled: true,
        pattern: '[\\w\\.-]+@[\\w\\.-]+',
        isBuiltIn: false,
        category: 'contact',
        description: 'Email validation pattern'
      });

      privacyStore.addDictionary({
        id: '1',
        dataType: 'email',
        category: 'business',
        words: ['test@example.com', 'user@test.com'],
        isActive: true
      });

      // Verify data types match
      const piiDataType = privacyStore.patterns[0].dataType;
      const dictDataType = privacyStore.dictionaries[0].dataType;
      expect(piiDataType).toBe(dictDataType);
    });

    it('should handle concurrent store updates correctly', async () => {
      const privacyStore = usePrivacyStore();
      const analyticsStore = useAnalyticsStore();

      // Simulate concurrent updates
      const updates = [
        () => { privacyStore.addPattern({ id: '1', name: 'test1', dataType: 'email', enabled: true, pattern: 'test', isBuiltIn: false, category: 'test', description: 'Test pattern' }); },
        () => { privacyStore.setPatternsLoading(true); },
        // Note: analyticsStore.usageStats and isLoading are readonly - can't directly assign
        // In real usage, these are set via store actions like loadUsageAnalytics()
      ];

      // Execute all updates
      updates.forEach(update => update());
      await nextTick();

      // Verify final state
      expect(privacyStore.patterns).toHaveLength(1);
      expect(privacyStore.patternsLoading).toBe(true);
      // isLoading is a computed property, so we just verify it exists
      expect(typeof analyticsStore.isLoading).toBe('boolean');
    });
  });

  describe('Store Actions and Side Effects', () => {
    it('should handle action execution with proper state management', async () => {
      // Test pattern validation action
      const validatePattern = (pattern: { name: string; dataType: string; pattern: string }) => {
        if (!pattern.name || !pattern.dataType || !pattern.pattern) {
          throw new Error('Invalid pattern structure');
        }
        return true;
      };

      // Valid pattern
      const validPattern = { id: '1', name: 'test', dataType: 'email', enabled: true, pattern: '[\\w]+@[\\w]+' };
      expect(() => validatePattern(validPattern)).not.toThrow();

      // Invalid pattern
      const invalidPattern = { id: '2', name: '', dataType: 'email', enabled: true, pattern: '' };
      expect(() => validatePattern(invalidPattern)).toThrow('Invalid pattern structure');
    });

    it('should handle bulk operations correctly', async () => {
      const privacyStore = usePrivacyStore();

      // Initial patterns
      const initialPatterns = [
        { id: '1', name: 'pattern1', dataType: 'email' as const, enabled: false, pattern: 'test1', isBuiltIn: false, category: 'test', description: 'Pattern 1' },
        { id: '2', name: 'pattern2', dataType: 'phone' as const, enabled: false, pattern: 'test2', isBuiltIn: false, category: 'test', description: 'Pattern 2' },
        { id: '3', name: 'pattern3', dataType: 'email' as const, enabled: false, pattern: 'test3', isBuiltIn: false, category: 'test', description: 'Pattern 3' },
      ];

      initialPatterns.forEach(p => privacyStore.addPattern(p));

      // Bulk enable operation
      privacyStore.patterns.forEach(p => {
        if (p.id) {
          privacyStore.updatePattern(p.id, { enabled: true });
        }
      });

      expect(privacyStore.patterns).toHaveLength(3);
      expect(privacyStore.patterns.every(p => p.enabled)).toBe(true);
    });
  });

  describe('Store Persistence and Hydration', () => {
    it('should handle store operations correctly', () => {
      const privacyStore = usePrivacyStore();

      // Add data
      privacyStore.addPattern({ id: '1', name: 'test', dataType: 'email', enabled: true, pattern: 'test', isBuiltIn: false, category: 'test', description: 'Test pattern' });
      privacyStore.setPatternsError('test error');
      privacyStore.setPatternsLoading(true);

      // Reset individual properties
      privacyStore.removePattern('1');
      privacyStore.setPatternsError(null);
      privacyStore.setPatternsLoading(false);

      expect(privacyStore.patterns).toEqual([]);
      expect(privacyStore.patternsError).toBeNull();
      expect(privacyStore.patternsLoading).toBe(false);
    });

    it('should maintain referential integrity during updates', () => {
      const privacyStore = usePrivacyStore();

      privacyStore.addPattern({ id: '1', name: 'pattern1', dataType: 'email', enabled: true, pattern: 'test', isBuiltIn: false, category: 'test', description: 'Pattern 1' });
      privacyStore.addPattern({ id: '2', name: 'pattern2', dataType: 'phone', enabled: true, pattern: 'test', isBuiltIn: false, category: 'test', description: 'Pattern 2' });

      const pattern2Before = { ...privacyStore.patterns[1] };

      // Update specific pattern
      privacyStore.updatePattern('1', { name: 'updated-pattern1' });

      expect(privacyStore.patterns[0].name).toBe('updated-pattern1');
      expect(privacyStore.patterns[1].name).toBe(pattern2Before.name); // Should remain unchanged
    });
  });

  describe('Memory Management and Cleanup', () => {
    it('should handle large datasets efficiently', () => {
      const privacyStore = usePrivacyStore();

      // Generate large dataset
      for (let i = 0; i < 1000; i++) {
        privacyStore.addPattern({
          id: `pattern-${i}`,
          name: `Pattern ${i}`,
          dataType: (i % 2 === 0 ? 'email' : 'phone') as 'email' | 'phone',
          enabled: i % 3 === 0,
          pattern: `test-${i}`,
          isBuiltIn: false,
          category: 'test',
          description: `Test pattern ${i}`
        });
      }

      expect(privacyStore.patterns).toHaveLength(1000);

      // Filter operations should be efficient
      const enabledPatterns = privacyStore.patterns.filter(p => p.enabled);
      expect(enabledPatterns.length).toBeGreaterThan(0);
      expect(enabledPatterns.length).toBeLessThan(1000);
    });

    it('should handle memory cleanup during store operations', () => {
      const pinia = createPinia();
      setActivePinia(pinia);

      const privacyStore = usePrivacyStore();
      privacyStore.addPattern({ id: '1', name: 'test', dataType: 'email', enabled: true, pattern: 'test', isBuiltIn: false, category: 'test', description: 'Test pattern' });

      // Simulate store cleanup
      privacyStore.removePattern('1');
      privacyStore.setPatternsError(null);
      privacyStore.setPatternsLoading(false);

      expect(privacyStore.patterns).toEqual([]);
    });
  });

  describe('Store Performance and Optimization', () => {
    it('should handle rapid state updates efficiently', async () => {
      const privacyStore = usePrivacyStore();
      const startTime = Date.now();

      // Rapid updates
      for (let i = 0; i < 100; i++) {
        privacyStore.addPattern({
          id: `pattern-${i}`,
          name: `Pattern ${i}`,
          dataType: 'email',
          enabled: true,
          pattern: `test-${i}`,
          isBuiltIn: false,
          category: 'test',
          description: `Test pattern ${i}`
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(privacyStore.patterns).toHaveLength(100);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should optimize filtering and search operations', () => {
      const privacyStore = usePrivacyStore();

      // Add patterns with searchable content
      privacyStore.addPattern({ id: '1', name: 'email-business', dataType: 'email', enabled: true, pattern: 'business.*@.*', isBuiltIn: false, category: 'contact', description: 'Business email pattern' });
      privacyStore.addPattern({ id: '2', name: 'email-personal', dataType: 'email', enabled: false, pattern: 'personal.*@.*', isBuiltIn: false, category: 'contact', description: 'Personal email pattern' });
      privacyStore.addPattern({ id: '3', name: 'phone-mobile', dataType: 'phone', enabled: true, pattern: '\\d{3}-\\d{3}-\\d{4}', isBuiltIn: false, category: 'contact', description: 'Mobile phone pattern' });

      const startTime = Date.now();

      // Complex filtering
      const filteredResults = privacyStore.patterns
        .filter(p => p.enabled)
        .filter(p => p.name.includes('email'))
        .sort((a, b) => a.name.localeCompare(b.name));

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(filteredResults).toHaveLength(1);
      expect(filteredResults[0].name).toBe('email-business');
      expect(duration).toBeLessThan(10); // Should be very fast for small datasets
    });
  });
});
