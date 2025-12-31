import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePartyFoul } from '../usePartyFoul';

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    schema: vi.fn(() => ({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      presenceState: vi.fn(() => ({})),
    })),
    removeChannel: vi.fn(),
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe('usePartyFoul', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return checkForPartyFouls function', () => {
    const { result } = renderHook(() => usePartyFoul());
    expect(result.current.checkForPartyFouls).toBeDefined();
    expect(typeof result.current.checkForPartyFouls).toBe('function');
  });

  it('checkForPartyFouls should be a stable callback', () => {
    const { result, rerender } = renderHook(() => usePartyFoul());
    const firstCallback = result.current.checkForPartyFouls;

    rerender();

    const secondCallback = result.current.checkForPartyFouls;
    expect(firstCallback).toBe(secondCallback);
  });
});
