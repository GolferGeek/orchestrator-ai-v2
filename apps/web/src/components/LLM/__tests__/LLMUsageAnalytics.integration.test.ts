/**
 * LLMUsageAnalytics Integration Tests
 * Tests for the LLM usage analytics component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import LLMUsageAnalytics from '../LLMUsageAnalytics.vue';

// Mock Ionic components
vi.mock('@ionic/vue', () => ({
  IonButton: { template: '<button><slot /></button>' },
  IonCard: { template: '<div><slot /></div>' },
  IonCardContent: { template: '<div><slot /></div>' },
  IonCardHeader: { template: '<div><slot /></div>' },
  IonCardTitle: { template: '<div><slot /></div>' },
  IonCardSubtitle: { template: '<div><slot /></div>' },
  IonCol: { template: '<div><slot /></div>' },
  IonGrid: { template: '<div><slot /></div>' },
  IonIcon: { template: '<span></span>' },
  IonLabel: { template: '<label><slot /></label>' },
  IonRow: { template: '<div><slot /></div>' },
  IonSelect: { template: '<select><slot /></select>', props: ['modelValue'] },
  IonSelectOption: { template: '<option><slot /></option>' },
  IonSpinner: { template: '<span></span>' },
  IonNote: { template: '<span><slot /></span>' },
  IonSegment: { template: '<div><slot /></div>', props: ['modelValue'] },
  IonSegmentButton: { template: '<button><slot /></button>' },
}));

// Mock ionicons
vi.mock('ionicons/icons', () => ({
  refreshOutline: 'refresh-outline',
  optionsOutline: 'options-outline',
  pulseOutline: 'pulse-outline',
  timeOutline: 'time-outline',
  cashOutline: 'cash-outline',
  shieldCheckmarkOutline: 'shield-checkmark-outline',
  barChartOutline: 'bar-chart-outline',
  pieChartOutline: 'pie-chart-outline',
  speedometerOutline: 'speedometer-outline',
  analyticsOutline: 'analytics-outline',
  gitNetworkOutline: 'git-network-outline',
  trendingUpOutline: 'trending-up-outline',
  alertCircleOutline: 'alert-circle-outline',
  arrowUpOutline: 'arrow-up-outline',
  arrowDownOutline: 'arrow-down-outline',
  bulbOutline: 'bulb-outline',
  informationCircleOutline: 'information-circle-outline',
  warningOutline: 'warning-outline',
  checkmarkCircleOutline: 'checkmark-circle-outline',
  flashOutline: 'flash-outline',
}));

// Mock chart components
vi.mock('@/components/Charts/BarChart.vue', () => ({
  default: { template: '<div class="bar-chart"></div>' },
}));

vi.mock('@/components/Charts/LineChart.vue', () => ({
  default: { template: '<div class="line-chart"></div>' },
}));

vi.mock('@/components/Charts/DoughnutChart.vue', () => ({
  default: { template: '<div class="doughnut-chart"></div>' },
}));

// Mock the LLMRoutingDashboard component
vi.mock('../LLMRoutingDashboard.vue', () => ({
  default: { template: '<div class="llm-routing-dashboard"></div>' },
}));

// Mock the analytics store
vi.mock('@/stores/llmAnalyticsStore', () => ({
  useLLMAnalyticsStore: vi.fn(() => ({
    loading: false,
    error: null,
    usageRecords: [],
    analytics: {},
    avgDuration: 0,
    totalCost: 0,
    fetchUsageRecords: vi.fn(),
    fetchAnalytics: vi.fn(),
    fetchStats: vi.fn(),
    initialize: vi.fn(),
    startAutoRefresh: vi.fn(),
    stopAutoRefresh: vi.fn(),
    updateAnalyticsFilters: vi.fn(),
  })),
}));

// Mock utility functions
vi.mock('@/utils/analyticsTransformations', () => ({
  transformToTimeSeries: vi.fn(() => ({ labels: [], values: [] })),
  calculateProviderStats: vi.fn(() => []),
  calculateProviderResponseTimes: vi.fn(() => ({ providers: [], responseTimes: [] })),
  calculateSanitizationBreakdown: vi.fn(() => null),
  calculateTrend: vi.fn(() => 'stable'),
  generateAnalyticsInsights: vi.fn(() => []),
  sanitizeUsageRecords: vi.fn((records) => records),
}));

describe('LLMUsageAnalytics.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('Component Rendering', () => {
    it('renders the main analytics structure', () => {
      const wrapper = mount(LLMUsageAnalytics);

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.find('.llm-usage-analytics').exists()).toBe(true);
    });

    it('renders analytics header with title', () => {
      const wrapper = mount(LLMUsageAnalytics);

      expect(wrapper.find('.analytics-header').exists()).toBe(true);
      expect(wrapper.find('h2').text()).toBe('LLM Usage Analytics');
    });

    it('renders header controls with refresh and filter buttons', () => {
      const wrapper = mount(LLMUsageAnalytics);

      const headerControls = wrapper.find('.header-controls');
      expect(headerControls.exists()).toBe(true);

      const buttons = headerControls.findAll('button');
      expect(buttons.length).toBeGreaterThanOrEqual(2); // Refresh and Filters
    });

    it('renders tab navigation', () => {
      const wrapper = mount(LLMUsageAnalytics);

      expect(wrapper.find('.dashboard-tabs').exists()).toBe(true);
    });
  });

  describe('Metrics Overview', () => {
    it('renders metrics overview section', () => {
      const wrapper = mount(LLMUsageAnalytics);

      expect(wrapper.find('.metrics-overview').exists()).toBe(true);
    });

    it('displays metric cards', () => {
      const wrapper = mount(LLMUsageAnalytics);

      const metricCards = wrapper.findAll('.metric-card');
      expect(metricCards.length).toBeGreaterThanOrEqual(4); // Requests, Response Time, Cost, Sanitization
    });

    it('displays metric values and labels', () => {
      const wrapper = mount(LLMUsageAnalytics);

      expect(wrapper.find('.metric-value').exists()).toBe(true);
      expect(wrapper.find('.metric-label').exists()).toBe(true);
    });
  });

  describe('Charts Section', () => {
    it('renders charts section', () => {
      const wrapper = mount(LLMUsageAnalytics);

      expect(wrapper.find('.charts-section').exists()).toBe(true);
    });

    it('renders chart cards', () => {
      const wrapper = mount(LLMUsageAnalytics);

      const chartCards = wrapper.findAll('.chart-card');
      expect(chartCards.length).toBeGreaterThan(0);
    });
  });

  describe('Insights Section', () => {
    it('renders insights section', () => {
      const wrapper = mount(LLMUsageAnalytics);

      expect(wrapper.find('.insights-section').exists()).toBe(true);
    });

    it('shows no insights message when empty', () => {
      const wrapper = mount(LLMUsageAnalytics);

      expect(wrapper.find('.no-insights').exists()).toBe(true);
    });
  });

  describe('Filter Controls', () => {
    it('has filter toggle functionality', () => {
      const wrapper = mount(LLMUsageAnalytics);

      // Filter button exists
      const filterButton = wrapper.findAll('button').find(btn => btn.text().includes('Filters'));
      expect(filterButton).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('handles error states gracefully', () => {
      const wrapper = mount(LLMUsageAnalytics);

      // Component should render without crashing even with no data
      expect(wrapper.exists()).toBe(true);
    });
  });
});
