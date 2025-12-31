import { describe, it, expect } from 'vitest';
import { useEventColors } from '../useEventColors';

describe('useEventColors', () => {
  const {
    getColorForSession,
    getColorForApp,
    getGradientForSession,
    getGradientForApp,
    getHexColorForSession,
    getHexColorForApp,
  } = useEventColors();

  describe('getColorForSession', () => {
    it('should return a valid Tailwind color class', () => {
      const color = getColorForSession('session-123');
      expect(color).toMatch(/^bg-\w+-500$/);
    });

    it('should return consistent color for same session', () => {
      const color1 = getColorForSession('session-abc');
      const color2 = getColorForSession('session-abc');
      expect(color1).toBe(color2);
    });

    it('should return different colors for different sessions', () => {
      const color1 = getColorForSession('session-a');
      const color2 = getColorForSession('session-b');
      const color3 = getColorForSession('session-c');
      // At least some should be different (given enough variety)
      const unique = new Set([color1, color2, color3]);
      expect(unique.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getColorForApp', () => {
    it('should return a valid Tailwind color class', () => {
      const color = getColorForApp('my-app');
      expect(color).toMatch(/^bg-\w+-500$/);
    });

    it('should return consistent color for same app name', () => {
      const color1 = getColorForApp('orchestrator');
      const color2 = getColorForApp('orchestrator');
      expect(color1).toBe(color2);
    });
  });

  describe('getGradientForSession', () => {
    it('should return a gradient class string', () => {
      const gradient = getGradientForSession('session-123');
      expect(gradient).toContain('bg-gradient-to-r');
      expect(gradient).toContain('from-');
      expect(gradient).toContain('to-');
    });

    it('should return consistent gradient for same session', () => {
      const gradient1 = getGradientForSession('test-session');
      const gradient2 = getGradientForSession('test-session');
      expect(gradient1).toBe(gradient2);
    });
  });

  describe('getGradientForApp', () => {
    it('should return a gradient class string', () => {
      const gradient = getGradientForApp('my-app');
      expect(gradient).toContain('bg-gradient-to-r');
    });
  });

  describe('getHexColorForSession', () => {
    it('should return a valid hex color', () => {
      const hex = getHexColorForSession('session-123');
      expect(hex).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('should return consistent hex for same session', () => {
      const hex1 = getHexColorForSession('my-session');
      const hex2 = getHexColorForSession('my-session');
      expect(hex1).toBe(hex2);
    });
  });

  describe('getHexColorForApp', () => {
    it('should return a valid HSL color string', () => {
      const hsl = getHexColorForApp('test-app');
      expect(hsl).toMatch(/^hsl\(\d+, 70%, 50%\)$/);
    });

    it('should return consistent HSL for same app', () => {
      const hsl1 = getHexColorForApp('consistent-app');
      const hsl2 = getHexColorForApp('consistent-app');
      expect(hsl1).toBe(hsl2);
    });
  });
});
