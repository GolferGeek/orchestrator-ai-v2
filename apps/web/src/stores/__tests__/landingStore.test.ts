/**
 * Unit Tests for Landing Store
 * Tests video analytics, section progress, and founding partner tracking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLandingStore } from '../landingStore';

describe('LandingStore', () => {
  let store: ReturnType<typeof useLandingStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useLandingStore();
  });

  describe('Store Initialization', () => {
    it('should initialize with default state', () => {
      expect(store.foundingPartnerCount).toBe(0);
      expect(store.maxFoundingPartners).toBe(5);
      expect(store.currentSection).toBe(0);
      expect(store.videoAnalytics).toEqual([]);
      expect(store.emailCaptures).toEqual([]);
      expect(store.calendarBookings).toBe(0);
    });

    it('should initialize section progress correctly', () => {
      expect(store.sectionProgress).toEqual({
        heroViewed: false,
        featuresViewed: false,
        pricingViewed: false,
        ctaClicked: false,
      });
    });
  });

  describe('Computed Properties', () => {
    it('should calculate founding partners remaining', () => {
      expect(store.foundingPartnersRemaining).toBe(5);

      store.updateFoundingPartnerCount(2);
      expect(store.foundingPartnersRemaining).toBe(3);
    });

    it('should calculate progress percentage', () => {
      expect(store.progressPercentage).toBe(0);

      store.updateFoundingPartnerCount(2);
      expect(store.progressPercentage).toBe(40);

      store.updateFoundingPartnerCount(5);
      expect(store.progressPercentage).toBe(100);
    });

    it('should track founding partner availability', () => {
      expect(store.isFoundingPartnerAvailable).toBe(true);

      store.updateFoundingPartnerCount(5);
      expect(store.isFoundingPartnerAvailable).toBe(false);
    });
  });

  describe('Founding Partner Management', () => {
    it('should update founding partner count', () => {
      store.updateFoundingPartnerCount(3);
      expect(store.foundingPartnerCount).toBe(3);
    });

    it('should not exceed max founding partners', () => {
      store.updateFoundingPartnerCount(10);
      expect(store.foundingPartnerCount).toBe(5);
    });
  });

  describe('Section Progress Tracking', () => {
    it('should track hero section view', () => {
      store.trackSectionView('hero');
      expect(store.sectionProgress.heroViewed).toBe(true);
    });

    it('should track features section view', () => {
      store.trackSectionView('features');
      expect(store.sectionProgress.featuresViewed).toBe(true);
    });

    it('should track pricing section view', () => {
      store.trackSectionView('pricing');
      expect(store.sectionProgress.pricingViewed).toBe(true);
    });

    it('should advance current section', () => {
      expect(store.currentSection).toBe(0);

      store.advanceSection();
      expect(store.currentSection).toBe(1);

      store.advanceSection();
      expect(store.currentSection).toBe(2);
    });

    it('should not advance beyond max section', () => {
      // Advance to max
      for (let i = 0; i < 10; i++) {
        store.advanceSection();
      }
      expect(store.currentSection).toBe(5);
    });
  });

  describe('Video Analytics', () => {
    it('should track video view', () => {
      store.trackVideoView('intro-video');

      expect(store.videoAnalytics).toHaveLength(1);
      expect(store.videoAnalytics[0].videoId).toBe('intro-video');
      expect(store.videoAnalytics[0].views).toBe(1);
      expect(store.videoAnalytics[0].completions).toBe(0);
    });

    it('should increment views for existing video', () => {
      store.trackVideoView('intro-video');
      store.trackVideoView('intro-video');
      store.trackVideoView('intro-video');

      expect(store.videoAnalytics).toHaveLength(1);
      expect(store.videoAnalytics[0].views).toBe(3);
    });

    it('should track multiple videos separately', () => {
      store.trackVideoView('video-1');
      store.trackVideoView('video-2');

      expect(store.videoAnalytics).toHaveLength(2);
      expect(store.videoAnalytics[0].videoId).toBe('video-1');
      expect(store.videoAnalytics[1].videoId).toBe('video-2');
    });

    it('should track video completion', () => {
      store.trackVideoView('intro-video');
      store.trackVideoCompletion('intro-video');

      expect(store.videoAnalytics[0].completions).toBe(1);
    });

    it('should increment completions for existing video', () => {
      store.trackVideoView('intro-video');
      store.trackVideoCompletion('intro-video');
      store.trackVideoCompletion('intro-video');

      expect(store.videoAnalytics[0].completions).toBe(2);
    });

    it('should not track completion for non-existing video', () => {
      store.trackVideoCompletion('non-existing');

      expect(store.videoAnalytics).toHaveLength(0);
    });
  });

  describe('Email Capture', () => {
    it('should capture email', () => {
      store.captureEmail('test@example.com');

      expect(store.emailCaptures).toHaveLength(1);
      expect(store.emailCaptures[0]).toBe('test@example.com');
    });

    it('should not capture duplicate emails', () => {
      store.captureEmail('test@example.com');
      store.captureEmail('test@example.com');

      expect(store.emailCaptures).toHaveLength(1);
    });

    it('should capture multiple unique emails', () => {
      store.captureEmail('test1@example.com');
      store.captureEmail('test2@example.com');

      expect(store.emailCaptures).toHaveLength(2);
    });
  });

  describe('Calendar Booking', () => {
    it('should track calendar booking', () => {
      store.trackCalendarBooking();

      expect(store.calendarBookings).toBe(1);
      expect(store.sectionProgress.ctaClicked).toBe(true);
    });

    it('should increment booking count', () => {
      store.trackCalendarBooking();
      store.trackCalendarBooking();

      expect(store.calendarBookings).toBe(2);
    });
  });

  describe('Reset Progress', () => {
    it('should reset all progress', () => {
      // Set up some state
      store.advanceSection();
      store.advanceSection();
      store.trackSectionView('hero');
      store.trackSectionView('features');

      // Reset
      store.resetProgress();

      expect(store.currentSection).toBe(0);
      expect(store.sectionProgress).toEqual({
        heroViewed: false,
        featuresViewed: false,
        pricingViewed: false,
        ctaClicked: false,
      });
    });
  });

  describe('Page View Tracking', () => {
    it('should not throw when tracking page view', () => {
      expect(() => {
        store.trackPageView('/landing');
      }).not.toThrow();
    });
  });
});
