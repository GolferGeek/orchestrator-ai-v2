/**
 * Token Storage Service
 *
 * Provides secure token storage abstraction for both web and native (Capacitor) environments.
 *
 * Security Strategy:
 * - Web Browser: In-memory storage (most secure, lost on refresh) with sessionStorage fallback
 * - Native (Capacitor): Capacitor Preferences (encrypted platform storage)
 * - Protects against XSS attacks by avoiding localStorage
 *
 * Migration:
 * - Automatically migrates tokens from localStorage on first use
 * - Clears old localStorage tokens after migration
 */

import { Capacitor } from '@capacitor/core';

// In-memory token storage (most secure for web)
let inMemoryAccessToken: string | null = null;
let inMemoryRefreshToken: string | null = null;

// Storage keys
const ACCESS_TOKEN_KEY = 'authToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const MIGRATION_FLAG_KEY = 'tokensMigrated';

/**
 * Platform detection
 */
const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Get Capacitor Preferences dynamically (only when needed)
 */
const getCapacitorPreferences = async () => {
  if (!isNativePlatform()) {
    throw new Error('Capacitor Preferences only available on native platforms');
  }

  // Dynamic import to avoid bundling on web
  const { Preferences } = await import('@capacitor/preferences');
  return Preferences;
};

/**
 * Storage layer abstraction
 */
class TokenStorage {
  private initialized = false;

  /**
   * Initialize token storage and migrate from localStorage if needed
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Check if migration is needed
    const migrated = sessionStorage.getItem(MIGRATION_FLAG_KEY);
    if (!migrated) {
      await this.migrateFromLocalStorage();
      sessionStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    }

    // Restore tokens from persistent storage on page load
    await this.restoreTokensFromPersistentStorage();

    this.initialized = true;
  }

  /**
   * Migrate tokens from localStorage to secure storage
   */
  private async migrateFromLocalStorage(): Promise<void> {
    try {
      const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

      if (accessToken || refreshToken) {
        console.info('[TokenStorage] Migrating tokens from localStorage to secure storage');

        if (accessToken) {
          await this.setAccessToken(accessToken);
        }
        if (refreshToken) {
          await this.setRefreshToken(refreshToken);
        }

        // Clear from localStorage after successful migration
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);

        console.info('[TokenStorage] Migration completed successfully');
      }
    } catch (error) {
      console.error('[TokenStorage] Migration failed:', error);
      // Don't throw - allow app to continue with empty tokens
    }
  }

  /**
   * Restore tokens from persistent storage on app startup
   */
  private async restoreTokensFromPersistentStorage(): Promise<void> {
    try {
      if (isNativePlatform()) {
        // Native: Load from Capacitor Preferences
        const Preferences = await getCapacitorPreferences();
        const { value: accessToken } = await Preferences.get({ key: ACCESS_TOKEN_KEY });
        const { value: refreshToken } = await Preferences.get({ key: REFRESH_TOKEN_KEY });

        if (accessToken) {
          inMemoryAccessToken = accessToken;
        }
        if (refreshToken) {
          inMemoryRefreshToken = refreshToken;
        }
      } else {
        // Web: Load from sessionStorage (survives page refresh but not tab close)
        const accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
        const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);

        if (accessToken) {
          inMemoryAccessToken = accessToken;
        }
        if (refreshToken) {
          inMemoryRefreshToken = refreshToken;
        }
      }
    } catch (error) {
      console.error('[TokenStorage] Failed to restore tokens:', error);
      // Don't throw - allow app to continue with empty tokens
    }
  }

  /**
   * Set access token
   */
  async setAccessToken(token: string): Promise<void> {
    inMemoryAccessToken = token;

    try {
      if (isNativePlatform()) {
        // Native: Store in Capacitor Preferences (encrypted)
        const Preferences = await getCapacitorPreferences();
        await Preferences.set({ key: ACCESS_TOKEN_KEY, value: token });
      } else {
        // Web: Store in sessionStorage as fallback (survives refresh)
        sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
      }
    } catch (error) {
      console.error('[TokenStorage] Failed to persist access token:', error);
      // Token is still in memory, so don't throw
    }
  }

  /**
   * Get access token
   */
  async getAccessToken(): Promise<string | null> {
    await this.initialize();
    return inMemoryAccessToken;
  }

  /**
   * Set refresh token
   */
  async setRefreshToken(token: string): Promise<void> {
    inMemoryRefreshToken = token;

    try {
      if (isNativePlatform()) {
        // Native: Store in Capacitor Preferences (encrypted)
        const Preferences = await getCapacitorPreferences();
        await Preferences.set({ key: REFRESH_TOKEN_KEY, value: token });
      } else {
        // Web: Store in sessionStorage as fallback (survives refresh)
        sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
      }
    } catch (error) {
      console.error('[TokenStorage] Failed to persist refresh token:', error);
      // Token is still in memory, so don't throw
    }
  }

  /**
   * Get refresh token
   */
  async getRefreshToken(): Promise<string | null> {
    await this.initialize();
    return inMemoryRefreshToken;
  }

  /**
   * Clear all tokens
   */
  async clearTokens(): Promise<void> {
    inMemoryAccessToken = null;
    inMemoryRefreshToken = null;

    try {
      if (isNativePlatform()) {
        // Native: Clear from Capacitor Preferences
        const Preferences = await getCapacitorPreferences();
        await Preferences.remove({ key: ACCESS_TOKEN_KEY });
        await Preferences.remove({ key: REFRESH_TOKEN_KEY });
      } else {
        // Web: Clear from sessionStorage
        sessionStorage.removeItem(ACCESS_TOKEN_KEY);
        sessionStorage.removeItem(REFRESH_TOKEN_KEY);
      }
    } catch (error) {
      console.error('[TokenStorage] Failed to clear persistent tokens:', error);
      // Tokens are cleared from memory, so don't throw
    }
  }

  /**
   * Check if tokens exist
   */
  async hasTokens(): Promise<boolean> {
    await this.initialize();
    return inMemoryAccessToken !== null || inMemoryRefreshToken !== null;
  }
}

// Export singleton instance
export const tokenStorage = new TokenStorage();
