/**
 * Unit Tests for Analyst Store
 * Tests pure state management for prediction analysts
 *
 * Key Testing Areas:
 * - Store initialization
 * - State mutations (setters)
 * - Computed properties and getters
 * - Analyst filtering by scope/domain/universe
 * - Template management
 * - Loading and error states
 * - Reset operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAnalystStore } from '../analystStore';
import type { PredictionAnalyst, AnalystTemplate, AnalystScopeLevel } from '../analystStore';

describe('AnalystStore', () => {
  beforeEach(() => {
    // Create a fresh pinia instance for each test
    setActivePinia(createPinia());
  });

  describe('Store Initialization', () => {
    it('should initialize with empty state', () => {
      const store = useAnalystStore();

      expect(store.analysts).toEqual([]);
      expect(store.analystTemplates).toEqual([]);
      expect(store.selectedAnalystId).toBeNull();
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should have default filter values', () => {
      const store = useAnalystStore();

      expect(store.filters).toEqual({
        scopeLevel: null,
        domain: null,
        universeId: null,
        active: null,
      });
    });
  });

  describe('Analyst Mutations', () => {
    it('should set analysts', () => {
      const store = useAnalystStore();

      const analysts: PredictionAnalyst[] = [
        {
          id: 'analyst-1',
          slug: 'technical-analyst',
          name: 'Technical Analyst',
          perspective: 'Technical analysis',
          scopeLevel: 'universe',
          domain: 'stocks',
          universeId: 'universe-1',
          targetId: null,
          defaultWeight: 0.8,
          tierInstructions: { gold: 'Gold tier' },
          learnedPatterns: [],
          active: true,
          createdAt: '2026-01-09T10:00:00Z',
          updatedAt: '2026-01-09T10:00:00Z',
        },
      ];

      store.setAnalysts(analysts);

      expect(store.analysts).toHaveLength(1);
      expect(store.analysts[0].id).toBe('analyst-1');
    });

    it('should add new analyst', () => {
      const store = useAnalystStore();

      const analyst: PredictionAnalyst = {
        id: 'analyst-1',
        slug: 'technical-analyst',
        name: 'Technical Analyst',
        perspective: 'Technical analysis',
        scopeLevel: 'universe',
        domain: 'stocks',
        universeId: 'universe-1',
        targetId: null,
        defaultWeight: 0.8,
        tierInstructions: { gold: 'Gold tier' },
        learnedPatterns: [],
        active: true,
        createdAt: '2026-01-09T10:00:00Z',
        updatedAt: '2026-01-09T10:00:00Z',
      };

      store.addAnalyst(analyst);

      expect(store.analysts).toHaveLength(1);
      expect(store.analysts[0]).toEqual(analyst);
    });

    it('should update existing analyst when adding with same ID', () => {
      const store = useAnalystStore();

      const analyst: PredictionAnalyst = {
        id: 'analyst-1',
        slug: 'technical-analyst',
        name: 'Technical Analyst',
        perspective: 'Technical analysis',
        scopeLevel: 'universe',
        domain: 'stocks',
        universeId: 'universe-1',
        targetId: null,
        defaultWeight: 0.8,
        tierInstructions: { gold: 'Gold tier' },
        learnedPatterns: [],
        active: true,
        createdAt: '2026-01-09T10:00:00Z',
        updatedAt: '2026-01-09T10:00:00Z',
      };

      store.addAnalyst(analyst);
      store.addAnalyst({ ...analyst, name: 'Updated Analyst' });

      expect(store.analysts).toHaveLength(1);
      expect(store.analysts[0].name).toBe('Updated Analyst');
    });

    it('should update analyst', () => {
      const store = useAnalystStore();

      const analyst: PredictionAnalyst = {
        id: 'analyst-1',
        slug: 'technical-analyst',
        name: 'Technical Analyst',
        perspective: 'Technical analysis',
        scopeLevel: 'universe',
        domain: 'stocks',
        universeId: 'universe-1',
        targetId: null,
        defaultWeight: 0.8,
        tierInstructions: { gold: 'Gold tier' },
        learnedPatterns: [],
        active: true,
        createdAt: '2026-01-09T10:00:00Z',
        updatedAt: '2026-01-09T10:00:00Z',
      };

      store.addAnalyst(analyst);
      store.updateAnalyst('analyst-1', { name: 'Modified Analyst', defaultWeight: 0.9 });

      expect(store.analysts[0].name).toBe('Modified Analyst');
      expect(store.analysts[0].defaultWeight).toBe(0.9);
      expect(store.analysts[0].slug).toBe('technical-analyst'); // Unchanged
    });

    it('should not update non-existent analyst', () => {
      const store = useAnalystStore();

      store.updateAnalyst('non-existent', { name: 'New Name' });

      expect(store.analysts).toHaveLength(0);
    });

    it('should remove analyst', () => {
      const store = useAnalystStore();

      store.setAnalysts([
        { id: 'analyst-1', slug: 'analyst-1', name: 'Analyst 1' } as PredictionAnalyst,
        { id: 'analyst-2', slug: 'analyst-2', name: 'Analyst 2' } as PredictionAnalyst,
      ]);

      store.removeAnalyst('analyst-1');

      expect(store.analysts).toHaveLength(1);
      expect(store.analysts[0].id).toBe('analyst-2');
    });

    it('should clear selected analyst when removing it', () => {
      const store = useAnalystStore();

      store.setAnalysts([
        { id: 'analyst-1', slug: 'analyst-1', name: 'Analyst 1' } as PredictionAnalyst,
      ]);
      store.selectAnalyst('analyst-1');

      store.removeAnalyst('analyst-1');

      expect(store.selectedAnalystId).toBeNull();
    });
  });

  describe('Template Mutations', () => {
    it('should set analyst templates', () => {
      const store = useAnalystStore();

      const templates: AnalystTemplate[] = [
        {
          slug: 'technical-analyst',
          name: 'Technical Analyst',
          perspective: 'Technical analysis',
          domain: 'stocks',
          defaultWeight: 0.8,
          tierInstructions: { gold: 'Gold tier' },
        },
      ];

      store.setAnalystTemplates(templates);

      expect(store.analystTemplates).toHaveLength(1);
      expect(store.analystTemplates[0].slug).toBe('technical-analyst');
    });

    it('should add new template', () => {
      const store = useAnalystStore();

      const template: AnalystTemplate = {
        slug: 'technical-analyst',
        name: 'Technical Analyst',
        perspective: 'Technical analysis',
        domain: 'stocks',
        defaultWeight: 0.8,
        tierInstructions: { gold: 'Gold tier' },
      };

      store.addAnalystTemplate(template);

      expect(store.analystTemplates).toHaveLength(1);
      expect(store.analystTemplates[0]).toEqual(template);
    });

    it('should update existing template when adding with same slug', () => {
      const store = useAnalystStore();

      const template: AnalystTemplate = {
        slug: 'technical-analyst',
        name: 'Technical Analyst',
        perspective: 'Technical analysis',
        domain: 'stocks',
        defaultWeight: 0.8,
        tierInstructions: { gold: 'Gold tier' },
      };

      store.addAnalystTemplate(template);
      store.addAnalystTemplate({ ...template, name: 'Updated Template' });

      expect(store.analystTemplates).toHaveLength(1);
      expect(store.analystTemplates[0].name).toBe('Updated Template');
    });
  });

  describe('Selection Operations', () => {
    it('should select analyst', () => {
      const store = useAnalystStore();

      store.selectAnalyst('analyst-1');

      expect(store.selectedAnalystId).toBe('analyst-1');
    });

    it('should clear selection', () => {
      const store = useAnalystStore();

      store.selectAnalyst('analyst-1');
      store.selectAnalyst(null);

      expect(store.selectedAnalystId).toBeNull();
    });
  });

  describe('Computed Properties', () => {
    it('should compute selectedAnalyst', () => {
      const store = useAnalystStore();

      const analyst: PredictionAnalyst = {
        id: 'analyst-1',
        slug: 'technical-analyst',
        name: 'Technical Analyst',
      } as PredictionAnalyst;

      store.setAnalysts([analyst]);
      store.selectAnalyst('analyst-1');

      expect(store.selectedAnalyst).toEqual(analyst);
    });

    it('should return undefined for non-existent selected analyst', () => {
      const store = useAnalystStore();

      store.selectAnalyst('non-existent');

      expect(store.selectedAnalyst).toBeUndefined();
    });

    it('should compute activeAnalysts', () => {
      const store = useAnalystStore();

      store.setAnalysts([
        { id: 'analyst-1', active: true } as PredictionAnalyst,
        { id: 'analyst-2', active: false } as PredictionAnalyst,
        { id: 'analyst-3', active: true } as PredictionAnalyst,
      ]);

      expect(store.activeAnalysts).toHaveLength(2);
      expect(store.activeAnalysts.every((a) => a.active)).toBe(true);
    });

    it('should compute analystsByScopeLevel', () => {
      const store = useAnalystStore();

      store.setAnalysts([
        { id: 'analyst-1', scopeLevel: 'runner' } as PredictionAnalyst,
        { id: 'analyst-2', scopeLevel: 'universe' } as PredictionAnalyst,
        { id: 'analyst-3', scopeLevel: 'runner' } as PredictionAnalyst,
        { id: 'analyst-4', scopeLevel: 'target' } as PredictionAnalyst,
      ]);

      const grouped = store.analystsByScopeLevel;

      expect(grouped.runner).toHaveLength(2);
      expect(grouped.universe).toHaveLength(1);
      expect(grouped.target).toHaveLength(1);
      expect(grouped.domain).toHaveLength(0);
    });

    it('should compute analystsByDomain', () => {
      const store = useAnalystStore();

      store.setAnalysts([
        { id: 'analyst-1', domain: 'stocks' } as PredictionAnalyst,
        { id: 'analyst-2', domain: 'crypto' } as PredictionAnalyst,
        { id: 'analyst-3', domain: 'stocks' } as PredictionAnalyst,
        { id: 'analyst-4', domain: null } as PredictionAnalyst,
      ]);

      const grouped = store.analystsByDomain;

      expect(grouped['stocks']).toHaveLength(2);
      expect(grouped['crypto']).toHaveLength(1);
      expect(grouped['null']).toBeUndefined();
    });

    it('should compute templatesByDomain', () => {
      const store = useAnalystStore();

      store.setAnalystTemplates([
        { slug: 'template-1', domain: 'stocks' } as AnalystTemplate,
        { slug: 'template-2', domain: 'crypto' } as AnalystTemplate,
        { slug: 'template-3', domain: 'stocks' } as AnalystTemplate,
      ]);

      const grouped = store.templatesByDomain;

      expect(grouped['stocks']).toHaveLength(2);
      expect(grouped['crypto']).toHaveLength(1);
    });
  });

  describe('Filter Operations', () => {
    const mockAnalysts: PredictionAnalyst[] = [
      {
        id: 'analyst-1',
        slug: 'analyst-1',
        name: 'Analyst 1',
        scopeLevel: 'runner',
        domain: 'stocks',
        universeId: 'universe-1',
        active: true,
      } as PredictionAnalyst,
      {
        id: 'analyst-2',
        slug: 'analyst-2',
        name: 'Analyst 2',
        scopeLevel: 'universe',
        domain: 'crypto',
        universeId: 'universe-2',
        active: false,
      } as PredictionAnalyst,
      {
        id: 'analyst-3',
        slug: 'analyst-3',
        name: 'Analyst 3',
        scopeLevel: 'runner',
        domain: 'stocks',
        universeId: 'universe-1',
        active: true,
      } as PredictionAnalyst,
    ];

    it('should filter by scopeLevel', () => {
      const store = useAnalystStore();
      store.setAnalysts(mockAnalysts);

      store.setFilters({ scopeLevel: 'runner' });

      expect(store.filteredAnalysts).toHaveLength(2);
      expect(store.filteredAnalysts.every((a) => a.scopeLevel === 'runner')).toBe(true);
    });

    it('should filter by domain', () => {
      const store = useAnalystStore();
      store.setAnalysts(mockAnalysts);

      store.setFilters({ domain: 'stocks' });

      expect(store.filteredAnalysts).toHaveLength(2);
      expect(store.filteredAnalysts.every((a) => a.domain === 'stocks')).toBe(true);
    });

    it('should filter by universeId', () => {
      const store = useAnalystStore();
      store.setAnalysts(mockAnalysts);

      store.setFilters({ universeId: 'universe-1' });

      expect(store.filteredAnalysts).toHaveLength(2);
      expect(store.filteredAnalysts.every((a) => a.universeId === 'universe-1')).toBe(true);
    });

    it('should filter by active status', () => {
      const store = useAnalystStore();
      store.setAnalysts(mockAnalysts);

      store.setFilters({ active: true });

      expect(store.filteredAnalysts).toHaveLength(2);
      expect(store.filteredAnalysts.every((a) => a.active)).toBe(true);
    });

    it('should combine multiple filters', () => {
      const store = useAnalystStore();
      store.setAnalysts(mockAnalysts);

      store.setFilters({ scopeLevel: 'runner', domain: 'stocks', active: true });

      expect(store.filteredAnalysts).toHaveLength(2);
      expect(store.filteredAnalysts.every((a) =>
        a.scopeLevel === 'runner' && a.domain === 'stocks' && a.active
      )).toBe(true);
    });

    it('should clear filters', () => {
      const store = useAnalystStore();
      store.setAnalysts(mockAnalysts);

      store.setFilters({ scopeLevel: 'runner', domain: 'stocks' });
      store.clearFilters();

      expect(store.filters.scopeLevel).toBeNull();
      expect(store.filters.domain).toBeNull();
      expect(store.filters.universeId).toBeNull();
      expect(store.filters.active).toBeNull();
    });
  });

  describe('Getter Functions', () => {
    it('should get analyst by ID', () => {
      const store = useAnalystStore();

      const analyst: PredictionAnalyst = {
        id: 'analyst-1',
        slug: 'analyst-1',
        name: 'Analyst 1',
      } as PredictionAnalyst;

      store.setAnalysts([analyst]);

      expect(store.getAnalystById('analyst-1')).toEqual(analyst);
      expect(store.getAnalystById('non-existent')).toBeUndefined();
    });

    it('should get analyst by slug', () => {
      const store = useAnalystStore();

      const analyst: PredictionAnalyst = {
        id: 'analyst-1',
        slug: 'technical-analyst',
        name: 'Analyst 1',
      } as PredictionAnalyst;

      store.setAnalysts([analyst]);

      expect(store.getAnalystBySlug('technical-analyst')).toEqual(analyst);
      expect(store.getAnalystBySlug('non-existent')).toBeUndefined();
    });

    it('should get analysts for universe', () => {
      const store = useAnalystStore();

      store.setAnalysts([
        { id: 'analyst-1', universeId: 'universe-1' } as PredictionAnalyst,
        { id: 'analyst-2', universeId: 'universe-2' } as PredictionAnalyst,
        { id: 'analyst-3', universeId: 'universe-1' } as PredictionAnalyst,
      ]);

      const analysts = store.getAnalystsForUniverse('universe-1');

      expect(analysts).toHaveLength(2);
      expect(analysts.every((a) => a.universeId === 'universe-1')).toBe(true);
    });

    it('should get analysts for domain', () => {
      const store = useAnalystStore();

      store.setAnalysts([
        { id: 'analyst-1', domain: 'stocks' } as PredictionAnalyst,
        { id: 'analyst-2', domain: 'crypto' } as PredictionAnalyst,
        { id: 'analyst-3', domain: 'stocks' } as PredictionAnalyst,
      ]);

      const analysts = store.getAnalystsForDomain('stocks');

      expect(analysts).toHaveLength(2);
      expect(analysts.every((a) => a.domain === 'stocks')).toBe(true);
    });

    it('should get template by slug', () => {
      const store = useAnalystStore();

      const template: AnalystTemplate = {
        slug: 'technical-analyst',
        name: 'Technical Analyst',
        domain: 'stocks',
      } as AnalystTemplate;

      store.setAnalystTemplates([template]);

      expect(store.getTemplateBySlug('technical-analyst')).toEqual(template);
      expect(store.getTemplateBySlug('non-existent')).toBeUndefined();
    });

    it('should get templates for domain', () => {
      const store = useAnalystStore();

      store.setAnalystTemplates([
        { slug: 'template-1', domain: 'stocks' } as AnalystTemplate,
        { slug: 'template-2', domain: 'crypto' } as AnalystTemplate,
        { slug: 'template-3', domain: 'stocks' } as AnalystTemplate,
      ]);

      const templates = store.getTemplatesForDomain('stocks');

      expect(templates).toHaveLength(2);
      expect(templates.every((t) => t.domain === 'stocks')).toBe(true);
    });
  });

  describe('Loading and Error States', () => {
    it('should set loading state', () => {
      const store = useAnalystStore();

      store.setLoading(true);
      expect(store.isLoading).toBe(true);

      store.setLoading(false);
      expect(store.isLoading).toBe(false);
    });

    it('should set error message', () => {
      const store = useAnalystStore();

      store.setError('Something went wrong');
      expect(store.error).toBe('Something went wrong');
    });

    it('should clear error', () => {
      const store = useAnalystStore();

      store.setError('Error message');
      store.clearError();

      expect(store.error).toBeNull();
    });
  });

  describe('Reset State', () => {
    it('should reset all state to initial values', () => {
      const store = useAnalystStore();

      // Set various state
      store.setAnalysts([{ id: 'analyst-1' } as PredictionAnalyst]);
      store.setAnalystTemplates([{ slug: 'template-1' } as AnalystTemplate]);
      store.selectAnalyst('analyst-1');
      store.setFilters({ scopeLevel: 'runner', domain: 'stocks' });
      store.setError('Some error');
      store.setLoading(true);

      // Reset
      store.resetState();

      // Verify all reset
      expect(store.analysts).toEqual([]);
      expect(store.analystTemplates).toEqual([]);
      expect(store.selectedAnalystId).toBeNull();
      expect(store.filters.scopeLevel).toBeNull();
      expect(store.filters.domain).toBeNull();
      expect(store.filters.universeId).toBeNull();
      expect(store.filters.active).toBeNull();
      expect(store.error).toBeNull();
      expect(store.isLoading).toBe(false);
    });
  });
});
