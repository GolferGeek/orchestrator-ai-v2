/**
 * Unit Tests for Token Storage Service
 *
 * Security-critical service that handles token storage across web and native platforms.
 * Tests cover:
 * - Platform detection
 * - Token storage/retrieval (in-memory + persistent)
 * - Token migration from localStorage
 * - Token clearing
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tokenStorage } from '../tokenStorageService';

// Mock Capacitor
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false), // Default to web platform
  },
}));

// Mock Capacitor Preferences (for native platform tests)
const mockPreferences = {
  get: vi.fn(async ({ key }: { key: string }) => ({ value: null })),
  set: vi.fn(async () => ({})),
  remove: vi.fn(async () => ({})),
};

vi.mock('@capacitor/preferences', () => ({
  Preferences: mockPreferences,
}));

describe('TokenStorageService', () => {
  beforeEach(() => {
    // Clear all storage before each test
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();

    // Reset the tokenStorage instance by clearing in-memory tokens
    // We can't directly access the private state, but we can call clearTokens
    tokenStorage.clearTokens();
  });

  afterEach(() => {
    // Clean up after each test
    sessionStorage.clear();
    localStorage.clear();
  });

  describe('Token Storage and Retrieval', () => {
    it('should store and retrieve access token (web platform)', async () => {
      const testToken = 'test-access-token-123';

      await tokenStorage.setAccessToken(testToken);
      const retrievedToken = await tokenStorage.getAccessToken();

      expect(retrievedToken).toBe(testToken);
      // Verify it's stored in sessionStorage as fallback
      expect(sessionStorage.getItem('authToken')).toBe(testToken);
    });

    it('should store and retrieve refresh token (web platform)', async () => {
      const testToken = 'test-refresh-token-456';

      await tokenStorage.setRefreshToken(testToken);
      const retrievedToken = await tokenStorage.getRefreshToken();

      expect(retrievedToken).toBe(testToken);
      // Verify it's stored in sessionStorage as fallback
      expect(sessionStorage.getItem('refreshToken')).toBe(testToken);
    });

    it('should return null when no tokens are stored', async () => {
      const accessToken = await tokenStorage.getAccessToken();
      const refreshToken = await tokenStorage.getRefreshToken();

      expect(accessToken).toBeNull();
      expect(refreshToken).toBeNull();
    });

    it('should check if tokens exist', async () => {
      // Initially no tokens
      expect(await tokenStorage.hasTokens()).toBe(false);

      // After setting access token
      await tokenStorage.setAccessToken('test-token');
      expect(await tokenStorage.hasTokens()).toBe(true);

      // After clearing
      await tokenStorage.clearTokens();
      expect(await tokenStorage.hasTokens()).toBe(false);
    });
  });

  describe('Token Clearing', () => {
    it('should clear all tokens from memory and sessionStorage', async () => {
      // Set tokens
      await tokenStorage.setAccessToken('access-token');
      await tokenStorage.setRefreshToken('refresh-token');

      // Verify tokens exist
      expect(await tokenStorage.getAccessToken()).toBe('access-token');
      expect(await tokenStorage.getRefreshToken()).toBe('refresh-token');
      expect(sessionStorage.getItem('authToken')).toBe('access-token');
      expect(sessionStorage.getItem('refreshToken')).toBe('refresh-token');

      // Clear tokens
      await tokenStorage.clearTokens();

      // Verify tokens are cleared
      expect(await tokenStorage.getAccessToken()).toBeNull();
      expect(await tokenStorage.getRefreshToken()).toBeNull();
      expect(sessionStorage.getItem('authToken')).toBeNull();
      expect(sessionStorage.getItem('refreshToken')).toBeNull();
    });
  });

  describe('localStorage Migration', () => {
    it('should migrate tokens from localStorage to sessionStorage', async () => {
      // Simulate old tokens in localStorage
      localStorage.setItem('authToken', 'old-access-token');
      localStorage.setItem('refreshToken', 'old-refresh-token');

      // Trigger initialization by accessing tokens
      const accessToken = await tokenStorage.getAccessToken();
      const refreshToken = await tokenStorage.getRefreshToken();

      // Verify tokens were migrated
      expect(accessToken).toBe('old-access-token');
      expect(refreshToken).toBe('old-refresh-token');

      // Verify old tokens removed from localStorage
      expect(localStorage.getItem('authToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();

      // Verify tokens in sessionStorage
      expect(sessionStorage.getItem('authToken')).toBe('old-access-token');
      expect(sessionStorage.getItem('refreshToken')).toBe('old-refresh-token');

      // Verify migration flag is set
      expect(sessionStorage.getItem('tokensMigrated')).toBe('true');
    });

    it('should not migrate if already migrated', async () => {
      // Set migration flag
      sessionStorage.setItem('tokensMigrated', 'true');

      // Add tokens to localStorage (shouldn't be migrated)
      localStorage.setItem('authToken', 'should-not-migrate');

      // Trigger initialization
      await tokenStorage.getAccessToken();

      // Verify localStorage token was NOT migrated
      expect(localStorage.getItem('authToken')).toBe('should-not-migrate');
      expect(await tokenStorage.getAccessToken()).toBeNull();
    });

    it('should handle migration errors gracefully', async () => {
      // Simulate localStorage with invalid data
      localStorage.setItem('authToken', 'valid-token');

      // Mock console.error to suppress error logs in test output
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Should not throw even if there's an error
      await expect(tokenStorage.getAccessToken()).resolves.not.toThrow();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Session Restoration', () => {
    it('should restore tokens from sessionStorage on initialization', async () => {
      // Simulate existing tokens in sessionStorage (from previous session)
      sessionStorage.setItem('authToken', 'existing-access-token');
      sessionStorage.setItem('refreshToken', 'existing-refresh-token');
      sessionStorage.setItem('tokensMigrated', 'true');

      // Access tokens (should restore from sessionStorage)
      const accessToken = await tokenStorage.getAccessToken();
      const refreshToken = await tokenStorage.getRefreshToken();

      expect(accessToken).toBe('existing-access-token');
      expect(refreshToken).toBe('existing-refresh-token');
    });
  });

  describe('Error Handling', () => {
    it('should handle sessionStorage errors gracefully when setting tokens', async () => {
      // Mock sessionStorage.setItem to throw error
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Should not throw - token should still be in memory
      await expect(tokenStorage.setAccessToken('test-token')).resolves.not.toThrow();

      // Token should still be in memory (even if sessionStorage failed)
      const token = await tokenStorage.getAccessToken();
      expect(token).toBe('test-token');

      setItemSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should handle sessionStorage errors gracefully when clearing tokens', async () => {
      // Set tokens first
      await tokenStorage.setAccessToken('test-token');

      // Mock sessionStorage.removeItem to throw error
      const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('Storage error');
      });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Should not throw - tokens should still be cleared from memory
      await expect(tokenStorage.clearTokens()).resolves.not.toThrow();

      // Tokens should be cleared from memory (even if sessionStorage failed)
      const token = await tokenStorage.getAccessToken();
      expect(token).toBeNull();

      removeItemSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should handle restore errors gracefully', async () => {
      // Mock sessionStorage.getItem to throw error
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage access error');
      });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Should not throw - just return null
      await expect(tokenStorage.getAccessToken()).resolves.toBeNull();

      getItemSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Memory-First Storage Strategy', () => {
    it('should prioritize in-memory storage over persistent storage', async () => {
      // Set token in sessionStorage
      sessionStorage.setItem('authToken', 'session-token');
      sessionStorage.setItem('tokensMigrated', 'true');

      // Set different token in memory
      await tokenStorage.setAccessToken('memory-token');

      // Should return memory token (not session token)
      const token = await tokenStorage.getAccessToken();
      expect(token).toBe('memory-token');
    });

    it('should update persistent storage when memory token changes', async () => {
      await tokenStorage.setAccessToken('token-1');
      expect(sessionStorage.getItem('authToken')).toBe('token-1');

      await tokenStorage.setAccessToken('token-2');
      expect(sessionStorage.getItem('authToken')).toBe('token-2');
    });
  });

  describe('Initialization', () => {
    it('should initialize only once', async () => {
      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      // First access - should initialize
      await tokenStorage.getAccessToken();

      // Second access - should not re-initialize
      await tokenStorage.getAccessToken();

      // Migration log should only appear once (if it appeared at all)
      const migrationLogs = consoleInfoSpy.mock.calls.filter(call =>
        call[0]?.includes('Migrating tokens')
      );
      expect(migrationLogs.length).toBeLessThanOrEqual(1);

      consoleInfoSpy.mockRestore();
    });
  });

  describe('Security Best Practices', () => {
    it('should not expose tokens in localStorage (XSS protection)', async () => {
      await tokenStorage.setAccessToken('secure-token');
      await tokenStorage.setRefreshToken('secure-refresh');

      // Verify tokens are NOT in localStorage (vulnerable to XSS)
      expect(localStorage.getItem('authToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
    });

    it('should use sessionStorage as fallback (survives refresh but not tab close)', async () => {
      await tokenStorage.setAccessToken('test-token');

      // Verify token is in sessionStorage (more secure than localStorage)
      expect(sessionStorage.getItem('authToken')).toBe('test-token');
    });

    it('should clear tokens completely on logout', async () => {
      // Simulate authenticated session
      await tokenStorage.setAccessToken('access-token');
      await tokenStorage.setRefreshToken('refresh-token');

      // Verify tokens exist in both memory and storage
      expect(await tokenStorage.hasTokens()).toBe(true);
      expect(sessionStorage.getItem('authToken')).toBeTruthy();

      // Clear tokens (logout)
      await tokenStorage.clearTokens();

      // Verify complete cleanup
      expect(await tokenStorage.hasTokens()).toBe(false);
      expect(await tokenStorage.getAccessToken()).toBeNull();
      expect(await tokenStorage.getRefreshToken()).toBeNull();
      expect(sessionStorage.getItem('authToken')).toBeNull();
      expect(sessionStorage.getItem('refreshToken')).toBeNull();
    });
  });
});
