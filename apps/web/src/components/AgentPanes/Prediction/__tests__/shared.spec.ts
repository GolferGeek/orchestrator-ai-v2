/**
 * Unit Tests for Shared Prediction Components
 * Tests ConfidenceBar, OutcomeBadge, ClaimCard, and RecommendationRow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ConfidenceBar from '../shared/ConfidenceBar.vue';
import OutcomeBadge from '../shared/OutcomeBadge.vue';
import ClaimCard from '../shared/ClaimCard.vue';
import RecommendationRow from '../shared/RecommendationRow.vue';
import type { Claim, Recommendation, OutcomeStatus } from '@/types/prediction-agent';

describe('ConfidenceBar', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const createWrapper = (props: { confidence: number; showLabel?: boolean }) => {
    return mount(ConfidenceBar, { props });
  };

  describe('Rendering', () => {
    it('renders without crashing', () => {
      const wrapper = createWrapper({ confidence: 75 });
      expect(wrapper.exists()).toBe(true);
    });

    it('displays correct width based on confidence', () => {
      const wrapper = createWrapper({ confidence: 75 });
      const fill = wrapper.find('.confidence-bar-fill');
      expect(fill.attributes('style')).toContain('width: 75%');
    });

    it('handles 0% confidence', () => {
      const wrapper = createWrapper({ confidence: 0 });
      const fill = wrapper.find('.confidence-bar-fill');
      expect(fill.attributes('style')).toContain('width: 0%');
    });

    it('handles 100% confidence', () => {
      const wrapper = createWrapper({ confidence: 100 });
      const fill = wrapper.find('.confidence-bar-fill');
      expect(fill.attributes('style')).toContain('width: 100%');
    });
  });

  describe('Color Coding', () => {
    it('shows red color for low confidence (< 40%)', () => {
      const wrapper = createWrapper({ confidence: 35 });
      const fill = wrapper.find('.confidence-bar-fill');
      expect(fill.attributes('style')).toContain('rgb(239, 68, 68)'); // #ef4444
    });

    it('shows yellow color for medium confidence (40-60%)', () => {
      const wrapper = createWrapper({ confidence: 55 });
      const fill = wrapper.find('.confidence-bar-fill');
      expect(fill.attributes('style')).toContain('rgb(245, 158, 11)'); // #f59e0b
    });

    it('shows green color for high confidence (>= 80%)', () => {
      const wrapper = createWrapper({ confidence: 85 });
      const fill = wrapper.find('.confidence-bar-fill');
      expect(fill.attributes('style')).toContain('rgb(16, 185, 129)'); // #10b981
    });
  });

  describe('Label Display', () => {
    it('shows label by default', () => {
      const wrapper = createWrapper({ confidence: 75 });
      const label = wrapper.find('.confidence-label');
      expect(label.exists()).toBe(true);
      expect(label.text()).toBe('75%');
    });
  });
});

describe('OutcomeBadge', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const createWrapper = (props: { status: OutcomeStatus }) => {
    return mount(OutcomeBadge, { props });
  };

  describe('Rendering', () => {
    it('renders without crashing', () => {
      const wrapper = createWrapper({ status: 'pending' });
      expect(wrapper.exists()).toBe(true);
    });

    it('displays pending badge', () => {
      const wrapper = createWrapper({ status: 'pending' });
      const badge = wrapper.find('.outcome-badge');
      expect(badge.classes()).toContain('outcome-badge-warning');
      expect(badge.text()).toBe('Pending');
    });

    it('displays correct badge', () => {
      const wrapper = createWrapper({ status: 'correct' });
      const badge = wrapper.find('.outcome-badge');
      expect(badge.classes()).toContain('outcome-badge-success');
      expect(badge.text()).toBe('Correct');
    });

    it('displays incorrect badge', () => {
      const wrapper = createWrapper({ status: 'incorrect' });
      const badge = wrapper.find('.outcome-badge');
      expect(badge.classes()).toContain('outcome-badge-danger');
      expect(badge.text()).toBe('Incorrect');
    });

    it('displays expired badge', () => {
      const wrapper = createWrapper({ status: 'expired' });
      const badge = wrapper.find('.outcome-badge');
      expect(badge.classes()).toContain('outcome-badge-neutral');
      expect(badge.text()).toBe('Expired');
    });
  });
});

describe('ClaimCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const mockClaim: Claim = {
    type: 'price',
    instrument: 'AAPL',
    value: 175.5,
    unit: 'USD',
    confidence: 0.95,
    timestamp: '2026-01-07T10:00:00Z',
  };

  const createWrapper = (props: { claim: Claim; source?: string }) => {
    return mount(ClaimCard, { props });
  };

  describe('Rendering', () => {
    it('renders without crashing', () => {
      const wrapper = createWrapper({ claim: mockClaim });
      expect(wrapper.exists()).toBe(true);
    });

    it('displays claim type', () => {
      const wrapper = createWrapper({ claim: mockClaim });
      const type = wrapper.find('.claim-type-badge');
      expect(type.text()).toBe('price');
    });

    it('displays instrument', () => {
      const wrapper = createWrapper({ claim: mockClaim });
      const instrument = wrapper.find('.claim-instrument');
      expect(instrument.text()).toBe('AAPL');
    });

    it('displays value with USD unit', () => {
      const wrapper = createWrapper({ claim: mockClaim });
      const value = wrapper.find('.value-text');
      expect(value.text()).toBe('$175.50');
    });

    it('displays confidence bar', () => {
      const wrapper = createWrapper({ claim: mockClaim });
      expect(wrapper.findComponent(ConfidenceBar).exists()).toBe(true);
    });

    it('displays source when provided', () => {
      const wrapper = createWrapper({ claim: mockClaim, source: 'Yahoo Finance' });
      const sourceValue = wrapper.find('.meta-value');
      expect(sourceValue.text()).toBe('Yahoo Finance');
    });
  });

  describe('Different Claim Types', () => {
    it('handles volume claims', () => {
      const volumeClaim: Claim = {
        type: 'volume',
        instrument: 'AAPL',
        value: 50000000,
        unit: 'shares',
        confidence: 1.0,
        timestamp: '2026-01-07T10:00:00Z',
      };

      const wrapper = createWrapper({ claim: volumeClaim });
      expect(wrapper.find('.value-text').text()).toContain('50000000.00 shares');
    });

    it('handles string value claims', () => {
      const stringClaim: Claim = {
        type: 'news',
        instrument: 'AAPL',
        value: 'Strong earnings',
        confidence: 0.9,
        timestamp: '2026-01-07T10:00:00Z',
      };

      const wrapper = createWrapper({ claim: stringClaim });
      expect(wrapper.find('.value-text').text()).toBe('Strong earnings');
    });

    it('handles percent unit', () => {
      const percentClaim: Claim = {
        type: 'change',
        instrument: 'AAPL',
        value: 5.25,
        unit: 'percent',
        confidence: 0.9,
        timestamp: '2026-01-07T10:00:00Z',
      };

      const wrapper = createWrapper({ claim: percentClaim });
      expect(wrapper.find('.value-text').text()).toBe('5.25%');
    });
  });
});

describe('RecommendationRow', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const mockRecommendation: Recommendation = {
    id: 'rec-1',
    instrument: 'AAPL',
    action: 'buy',
    confidence: 0.85,
    targetPrice: 180.0,
    rationale: 'Strong earnings beat and positive guidance',
    evidence: [
      { specialist: 'PriceAnalyst', summary: 'Price trending up', confidence: 0.9 },
      { specialist: 'NewsAnalyst', summary: 'Positive sentiment', confidence: 0.85 },
    ],
  };

  const createWrapper = (props: { recommendation: Recommendation; showEvidence?: boolean }) => {
    return mount(RecommendationRow, { props });
  };

  describe('Rendering', () => {
    it('renders without crashing', () => {
      const wrapper = createWrapper({ recommendation: mockRecommendation });
      expect(wrapper.exists()).toBe(true);
    });

    it('displays instrument', () => {
      const wrapper = createWrapper({ recommendation: mockRecommendation });
      const instrument = wrapper.find('.instrument-symbol');
      expect(instrument.text()).toBe('AAPL');
    });

    it('displays action', () => {
      const wrapper = createWrapper({ recommendation: mockRecommendation });
      const action = wrapper.find('.action-badge');
      expect(action.text()).toBe('BUY');
    });

    it('displays confidence', () => {
      const wrapper = createWrapper({ recommendation: mockRecommendation });
      expect(wrapper.findComponent(ConfidenceBar).exists()).toBe(true);
    });

    it('displays target price', () => {
      const wrapper = createWrapper({ recommendation: mockRecommendation });
      const target = wrapper.find('.detail-value');
      expect(target.text()).toContain('180.00');
    });

    it('displays rationale', () => {
      const wrapper = createWrapper({ recommendation: mockRecommendation });
      const rationale = wrapper.find('.recommendation-rationale p');
      expect(rationale.text()).toContain('Strong earnings beat');
    });
  });

  describe('Action Styles', () => {
    it('shows buy action with correct style', () => {
      const wrapper = createWrapper({ recommendation: mockRecommendation });
      const action = wrapper.find('.action-badge');
      expect(action.classes()).toContain('action-buy');
    });

    it('shows sell action with correct style', () => {
      const sellRec = { ...mockRecommendation, action: 'sell' as const };
      const wrapper = createWrapper({ recommendation: sellRec });
      const action = wrapper.find('.action-badge');
      expect(action.classes()).toContain('action-sell');
    });

    it('shows hold action with correct style', () => {
      const holdRec = { ...mockRecommendation, action: 'hold' as const };
      const wrapper = createWrapper({ recommendation: holdRec });
      const action = wrapper.find('.action-badge');
      expect(action.classes()).toContain('action-hold');
    });
  });

  describe('Evidence Display', () => {
    it('displays evidence when showEvidence is true', () => {
      const wrapper = createWrapper({ recommendation: mockRecommendation, showEvidence: true });
      const evidenceSection = wrapper.find('.recommendation-evidence');
      expect(evidenceSection.exists()).toBe(true);
    });

    it('hides evidence when showEvidence is false', () => {
      const wrapper = createWrapper({ recommendation: mockRecommendation, showEvidence: false });
      const evidenceSection = wrapper.find('.recommendation-evidence');
      expect(evidenceSection.exists()).toBe(false);
    });

    it('displays correct number of evidence items', () => {
      const wrapper = createWrapper({ recommendation: mockRecommendation, showEvidence: true });
      const evidenceItems = wrapper.findAll('.evidence-item');
      expect(evidenceItems.length).toBe(2);
    });
  });

  describe('Missing Optional Fields', () => {
    it('handles missing target price', () => {
      const recWithoutTarget = { ...mockRecommendation, targetPrice: undefined };
      const wrapper = createWrapper({ recommendation: recWithoutTarget });
      // Should not have target price detail item
      const targetDetailItem = wrapper.findAll('.detail-item').find((item) =>
        item.find('.detail-label').text().includes('Target'),
      );
      expect(targetDetailItem).toBeUndefined();
    });

    it('handles empty evidence array', () => {
      const recWithoutEvidence = { ...mockRecommendation, evidence: [] };
      const wrapper = createWrapper({ recommendation: recWithoutEvidence, showEvidence: true });
      const evidenceSection = wrapper.find('.recommendation-evidence');
      // Evidence section should not render when evidence is empty
      expect(evidenceSection.exists()).toBe(false);
    });
  });
});
