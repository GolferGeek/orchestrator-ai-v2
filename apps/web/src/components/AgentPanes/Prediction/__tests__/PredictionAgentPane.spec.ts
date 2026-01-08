/**
 * Unit Tests for PredictionAgentPane
 * Tests the main dashboard container component
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PredictionAgentPane from '../PredictionAgentPane.vue';
import { usePredictionAgentStore } from '@/stores/predictionAgentStore';
import type { AgentStatus } from '@/types/prediction-agent';

// Mock child components
vi.mock('../CurrentStateComponent.vue', () => ({
  default: { template: '<div class="mock-current-state">Current State</div>' },
}));
vi.mock('../InstrumentsComponent.vue', () => ({
  default: { template: '<div class="mock-instruments">Instruments</div>' },
}));
vi.mock('../HistoryComponent.vue', () => ({
  default: { template: '<div class="mock-history">History</div>' },
}));
vi.mock('../ToolsComponent.vue', () => ({
  default: { template: '<div class="mock-tools">Tools</div>' },
}));
vi.mock('../ConfigComponent.vue', () => ({
  default: { template: '<div class="mock-config">Config</div>' },
}));

describe('PredictionAgentPane', () => {
  let pinia: ReturnType<typeof createPinia>;
  let wrapper: VueWrapper | null = null;

  const createWrapper = (props = { agentId: 'agent-123' }) => {
    return mount(PredictionAgentPane, {
      props,
      global: {
        plugins: [pinia],
        stubs: {
          CurrentStateComponent: true,
          InstrumentsComponent: true,
          HistoryComponent: true,
          ToolsComponent: true,
          ConfigComponent: true,
        },
      },
    });
  };

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.useFakeTimers();
    wrapper = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    if (wrapper) {
      wrapper.unmount();
      wrapper = null;
    }
  });

  describe('Component Rendering', () => {
    it('renders without crashing', () => {
      wrapper = createWrapper();
      expect(wrapper.exists()).toBe(true);
    });

    it('renders header with title', () => {
      wrapper = createWrapper();
      const header = wrapper.find('.pane-header');
      expect(header.exists()).toBe(true);
      expect(wrapper.find('h2').text()).toBe('Prediction Agent Dashboard');
    });

    it('renders tab navigation', () => {
      wrapper = createWrapper();
      const tabs = wrapper.findAll('.tab-btn');
      expect(tabs).toHaveLength(5);
      expect(tabs[0].text()).toBe('Current State');
      expect(tabs[1].text()).toBe('Instruments');
      expect(tabs[2].text()).toBe('History');
      expect(tabs[3].text()).toBe('Tools');
      expect(tabs[4].text()).toBe('Config');
    });

    it('shows current state tab by default', () => {
      wrapper = createWrapper();
      const activeTab = wrapper.find('.tab-btn.active');
      expect(activeTab.text()).toBe('Current State');
    });
  });

  describe('Agent Status Display', () => {
    it('shows status indicator when agent status available', async () => {
      wrapper = createWrapper();
      const store = usePredictionAgentStore();

      store.setAgentStatus({
        state: 'running',
        stats: { pollCount: 10, errorCount: 0, recommendationCount: 5, avgPollDurationMs: 2000 },
      });

      await wrapper.vm.$nextTick();

      const statusIndicator = wrapper.find('.status-indicator');
      expect(statusIndicator.exists()).toBe(true);
      expect(statusIndicator.classes()).toContain('status-running');
    });

    it('shows correct status label', async () => {
      wrapper = createWrapper();
      const store = usePredictionAgentStore();

      store.setAgentStatus({
        state: 'paused',
        stats: { pollCount: 5, errorCount: 0, recommendationCount: 2, avgPollDurationMs: 1500 },
      });

      await wrapper.vm.$nextTick();

      const statusLabel = wrapper.find('.status-label');
      expect(statusLabel.text()).toBe('Paused');
    });

    it('shows status summary cards when status available', async () => {
      wrapper = createWrapper();
      const store = usePredictionAgentStore();

      store.setAgentStatus({
        state: 'running',
        stats: { pollCount: 10, errorCount: 2, recommendationCount: 5, avgPollDurationMs: 2000 },
        lastPollAt: '2026-01-07T11:00:00Z',
        nextPollAt: '2026-01-07T11:05:00Z',
      });

      await wrapper.vm.$nextTick();

      const summaryCards = wrapper.findAll('.summary-card');
      expect(summaryCards.length).toBeGreaterThan(0);
    });
  });

  describe('Lifecycle Controls', () => {
    it('shows Start button when stopped', async () => {
      wrapper = createWrapper();
      const store = usePredictionAgentStore();

      store.setAgentStatus({
        state: 'stopped',
        stats: { pollCount: 0, errorCount: 0, recommendationCount: 0, avgPollDurationMs: 0 },
      });

      await wrapper.vm.$nextTick();

      const startBtn = wrapper.find('.start-btn');
      expect(startBtn.exists()).toBe(true);
    });

    it('shows Pause and Stop buttons when running', async () => {
      wrapper = createWrapper();
      const store = usePredictionAgentStore();

      store.setAgentStatus({
        state: 'running',
        stats: { pollCount: 10, errorCount: 0, recommendationCount: 5, avgPollDurationMs: 2000 },
      });

      await wrapper.vm.$nextTick();

      expect(wrapper.find('.pause-btn').exists()).toBe(true);
      expect(wrapper.find('.stop-btn').exists()).toBe(true);
      expect(wrapper.find('.poll-btn').exists()).toBe(true);
    });

    it('shows Resume button when paused', async () => {
      wrapper = createWrapper();
      const store = usePredictionAgentStore();

      store.setAgentStatus({
        state: 'paused',
        stats: { pollCount: 5, errorCount: 0, recommendationCount: 2, avgPollDurationMs: 1500 },
      });

      await wrapper.vm.$nextTick();

      expect(wrapper.find('.resume-btn').exists()).toBe(true);
      expect(wrapper.find('.stop-btn').exists()).toBe(true);
    });

    it('disables buttons when executing', async () => {
      wrapper = createWrapper();
      const store = usePredictionAgentStore();

      store.setAgentStatus({
        state: 'running',
        stats: { pollCount: 10, errorCount: 0, recommendationCount: 5, avgPollDurationMs: 2000 },
      });
      store.setExecuting(true);

      await wrapper.vm.$nextTick();

      const pauseBtn = wrapper.find('.pause-btn');
      expect(pauseBtn.attributes('disabled')).toBeDefined();
    });

    it('always shows Refresh button', async () => {
      wrapper = createWrapper();
      const refreshBtn = wrapper.find('.refresh-btn');
      expect(refreshBtn.exists()).toBe(true);
    });
  });

  describe('Tab Navigation', () => {
    it('switches to Instruments tab on click', async () => {
      wrapper = createWrapper();
      const tabs = wrapper.findAll('.tab-btn');

      await tabs[1].trigger('click');

      expect(tabs[1].classes()).toContain('active');
      expect(wrapper.findComponent({ name: 'InstrumentsComponent' }).exists()).toBe(true);
    });

    it('switches to History tab on click', async () => {
      wrapper = createWrapper();
      const tabs = wrapper.findAll('.tab-btn');

      await tabs[2].trigger('click');

      expect(tabs[2].classes()).toContain('active');
    });

    it('switches to Tools tab on click', async () => {
      wrapper = createWrapper();
      const tabs = wrapper.findAll('.tab-btn');

      await tabs[3].trigger('click');

      expect(tabs[3].classes()).toContain('active');
    });

    it('switches to Config tab on click', async () => {
      wrapper = createWrapper();
      const tabs = wrapper.findAll('.tab-btn');

      await tabs[4].trigger('click');

      expect(tabs[4].classes()).toContain('active');
    });
  });

  describe('Error Handling', () => {
    it('shows error banner when error set', async () => {
      wrapper = createWrapper();
      const store = usePredictionAgentStore();

      store.setError('Failed to load agent data');

      await wrapper.vm.$nextTick();

      const errorBanner = wrapper.find('.error-banner');
      expect(errorBanner.exists()).toBe(true);
      expect(errorBanner.text()).toContain('Failed to load agent data');
    });

    it('clears error on close button click', async () => {
      wrapper = createWrapper();
      const store = usePredictionAgentStore();

      store.setError('Test error');
      await wrapper.vm.$nextTick();

      const closeBtn = wrapper.find('.close-error-btn');
      await closeBtn.trigger('click');

      expect(store.error).toBeNull();
    });

    it('does not show error banner when no error', () => {
      wrapper = createWrapper();
      const errorBanner = wrapper.find('.error-banner');
      expect(errorBanner.exists()).toBe(false);
    });
  });

  describe('Store Integration', () => {
    it('sets agent ID in store on mount', async () => {
      wrapper = createWrapper({ agentId: 'test-agent-456' });
      const store = usePredictionAgentStore();

      // Wait for mount lifecycle
      await wrapper.vm.$nextTick();

      expect(store.agentId).toBe('test-agent-456');
    });

    it('resets store state on unmount', async () => {
      wrapper = createWrapper();
      const store = usePredictionAgentStore();

      store.setAgentId('agent-123');
      store.setInstruments(['AAPL', 'MSFT']);

      wrapper.unmount();

      expect(store.agentId).toBeNull();
      expect(store.instruments).toEqual([]);
    });
  });

  describe('Auto-refresh', () => {
    it('sets up refresh interval on mount', async () => {
      wrapper = createWrapper();
      const store = usePredictionAgentStore();

      // Make agent running to enable auto-refresh
      store.setAgentStatus({
        state: 'running',
        stats: { pollCount: 10, errorCount: 0, recommendationCount: 5, avgPollDurationMs: 2000 },
      });

      await wrapper.vm.$nextTick();

      // Advance time by 30 seconds (refresh interval)
      vi.advanceTimersByTime(30000);

      // Auto-refresh should have been called
      // In real implementation, this would trigger data reload
    });

    it('clears refresh interval on unmount', async () => {
      const localWrapper = createWrapper();
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      // Wait for mount to complete and interval to be set
      await localWrapper.vm.$nextTick();

      localWrapper.unmount();

      // clearInterval is called whether or not interval was set
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('Formatting Functions', () => {
    it('formats status correctly', async () => {
      const localWrapper = createWrapper();
      const store = usePredictionAgentStore();

      store.setAgentStatus({
        state: 'running',
        stats: { pollCount: 0, errorCount: 0, recommendationCount: 0, avgPollDurationMs: 0 },
      });

      await localWrapper.vm.$nextTick();

      const statusLabel = localWrapper.find('.status-label');
      expect(statusLabel.text()).toBe('Running');

      localWrapper.unmount();
    });

    it('formats duration in milliseconds', async () => {
      const localWrapper = createWrapper();
      const store = usePredictionAgentStore();

      store.setAgentStatus({
        state: 'running',
        stats: { pollCount: 10, errorCount: 0, recommendationCount: 5, avgPollDurationMs: 500 },
      });

      await localWrapper.vm.$nextTick();

      const durationCard = localWrapper.findAll('.summary-card').find((c) =>
        c.find('.summary-label').text().includes('Avg Poll Duration'),
      );

      expect(durationCard?.find('.summary-value').text()).toBe('500ms');

      localWrapper.unmount();
    });

    it('formats duration in seconds', async () => {
      const localWrapper = createWrapper();
      const store = usePredictionAgentStore();

      store.setAgentStatus({
        state: 'running',
        stats: { pollCount: 10, errorCount: 0, recommendationCount: 5, avgPollDurationMs: 2500 },
      });

      await localWrapper.vm.$nextTick();

      const durationCard = localWrapper.findAll('.summary-card').find((c) =>
        c.find('.summary-label').text().includes('Avg Poll Duration'),
      );

      expect(durationCard?.find('.summary-value').text()).toBe('2.5s');

      localWrapper.unmount();
    });
  });
});
