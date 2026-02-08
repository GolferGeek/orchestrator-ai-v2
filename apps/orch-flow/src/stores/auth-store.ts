import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Get the main API URL for authentication and teams.
 * This is separate from the local API URL used for Flow-specific operations.
 */
export const getMainApiUrl = (): string => {
  // Use environment variable - must be configured
  const mainApiUrl = typeof window !== 'undefined'
    ? import.meta.env.VITE_MAIN_API_URL || import.meta.env.MAIN_API_URL
    : import.meta.env.MAIN_API_URL;

  if (!mainApiUrl) {
    throw new Error('VITE_MAIN_API_URL or MAIN_API_URL environment variable is required');
  }

  return mainApiUrl;
}

// Check if we're running in local development
const isLocalDev = (): boolean => {
  if (typeof window === 'undefined') return false
  const hostname = window.location.hostname
  const apiBaseUrl = getMainApiUrl()
  
  // Consider it local dev if:
  // 1. Browser is accessing via localhost/127.0.0.1, OR
  // 2. Main API URL is localhost/127.0.0.1
  const isBrowserLocal = hostname === 'localhost' || hostname === '127.0.0.1'
  const isApiLocal = apiBaseUrl.includes('localhost') || apiBaseUrl.includes('127.0.0.1')
  
  return isBrowserLocal || isApiLocal
}

interface AuthState {
  isAuthenticated: boolean
  token: string | null
  authType: 'supabase' | 'none' | null
  userEmail: string | null
  isLoading: boolean
  error: string | null
  lastAuthCheck: number | null
  isCheckingAuth: boolean
  hasHydrated: boolean
  setHasHydrated: (state: boolean) => void
  login: (email: string, password: string) => Promise<boolean>
  signup: (email: string, password: string, displayName?: string) => Promise<boolean>
  setSupabaseToken: (token: string) => Promise<boolean>
  logout: () => void
  checkAuth: () => Promise<boolean>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      token: null,
      authType: null,
      userEmail: null,
      isLoading: false,
      error: null,
      lastAuthCheck: null,
      isCheckingAuth: false,
      hasHydrated: false,

      setHasHydrated: (state: boolean) => {
        set({ hasHydrated: state })
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          const mainApiUrl = getMainApiUrl()
          const isLocal = isLocalDev()
          
          // In local dev, use local API if available, otherwise use main API
          const localApiUrl = import.meta.env.VITE_API_URL;
          if (!localApiUrl) {
            throw new Error('VITE_API_URL environment variable is required');
          }
          const authApiUrl = isLocal ? localApiUrl : mainApiUrl
          const authEndpoint = '/auth/login'
          
          const response = await fetch(`${authApiUrl}${authEndpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
          })

          if (!response.ok) {
            let errorMessage = 'Authentication failed'
            if (response.status === 401) {
              errorMessage = 'Invalid email or password. Please try again.'
            } else if (response.status === 403) {
              errorMessage = 'Please confirm your email before logging in.'
            } else if (response.status === 503) {
              errorMessage = 'Authentication service is not available. Please check server configuration.'
            } else {
              const errorData = await response.json().catch(() => ({}))
              errorMessage = errorData.detail || errorData.message || `Authentication failed (${response.status})`
            }

            set({
              error: errorMessage,
              isLoading: false,
              isAuthenticated: false,
              token: null,
              userEmail: null
            })
            return false
          }

          const data = await response.json()
          // API returns accessToken or access_token for compatibility
          const token = data.accessToken || data.access_token

          if (!token) {
            set({
              error: 'No token returned from authentication',
              isLoading: false,
              isAuthenticated: false,
              token: null,
              userEmail: null
            })
            return false
          }

          set({
            isAuthenticated: true,
            token: token,
            authType: 'supabase',
            userEmail: data.user?.email || email,
            isLoading: false,
            lastAuthCheck: Date.now(),
            error: null
          })
          return true
        } catch (error) {
          console.error('Login error:', error)
          let errorMessage = 'Authentication failed'

          if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            errorMessage = 'Unable to connect to authentication server.'
          } else if (error instanceof Error) {
            errorMessage = error.message
          }

          set({
            error: errorMessage,
            isLoading: false,
            isAuthenticated: false,
            token: null,
            userEmail: null
          })
          return false
        }
      },

      signup: async (email: string, password: string, displayName?: string) => {
        set({ isLoading: true, error: null })
        try {
          const mainApiUrl = getMainApiUrl()
          const isLocal = isLocalDev()

          const localApiUrl = import.meta.env.VITE_API_URL;
          if (!localApiUrl) {
            throw new Error('VITE_API_URL environment variable is required');
          }
          const authApiUrl = isLocal ? localApiUrl : mainApiUrl
          const authEndpoint = '/auth/signup'
          
          const response = await fetch(`${authApiUrl}${authEndpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password, displayName })
          })

          if (!response.ok) {
            let errorMessage = 'Signup failed'
            if (response.status === 400) {
              errorMessage = 'User might already exist or invalid input.'
            } else if (response.status === 202) {
              // Email confirmation required
              const errorData = await response.json().catch(() => ({}))
              errorMessage = errorData.message || 'User created successfully. Please check your email to confirm your account before logging in.'
              set({
                error: errorMessage,
                isLoading: false,
                isAuthenticated: false,
                token: null,
                userEmail: null
              })
              return false
            } else {
              const errorData = await response.json().catch(() => ({}))
              errorMessage = errorData.detail || errorData.message || `Signup failed (${response.status})`
            }

            set({
              error: errorMessage,
              isLoading: false,
              isAuthenticated: false,
              token: null,
              userEmail: null
            })
            return false
          }

          const data = await response.json()
          const token = data.accessToken || data.access_token

          if (!token) {
            set({
              error: 'No token returned from signup',
              isLoading: false,
              isAuthenticated: false,
              token: null,
              userEmail: null
            })
            return false
          }

          set({
            isAuthenticated: true,
            token: token,
            authType: 'supabase',
            userEmail: data.user?.email || email,
            isLoading: false,
            lastAuthCheck: Date.now(),
            error: null
          })
          return true
        } catch (error) {
          console.error('Signup error:', error)
          let errorMessage = 'Signup failed'

          if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            errorMessage = 'Unable to connect to authentication server.'
          } else if (error instanceof Error) {
            errorMessage = error.message
          }

          set({
            error: errorMessage,
            isLoading: false,
            isAuthenticated: false,
            token: null,
            userEmail: null
          })
          return false
        }
      },

      setSupabaseToken: async (token: string) => {
        set({ isLoading: true, error: null })
        try {
          const mainApiUrl = getMainApiUrl()
          
          // Validate token with API by fetching user context
          const response = await fetch(`${mainApiUrl}/users/me/context`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })

          if (response.ok) {
            const data = await response.json()
            set({
              isAuthenticated: true,
              token: token,
              authType: 'supabase',
              userEmail: data.user?.email || null,
              isLoading: false,
              lastAuthCheck: Date.now(),
              error: null
            })
            return true
          } else {
            set({
              error: 'Invalid Supabase token',
              isLoading: false,
              isAuthenticated: false,
              token: null
            })
            return false
          }
        } catch (error) {
          console.error('Supabase token validation error:', error)
          set({
            error: 'Failed to validate Supabase token',
            isLoading: false,
            isAuthenticated: false,
            token: null
          })
          return false
        }
      },

      logout: async () => {
        // Clear local auth state (backend doesn't maintain sessions, so no need to call logout endpoint)
        set({
          isAuthenticated: false,
          token: null,
          authType: null,
          userEmail: null,
          error: null
        })
      },

      checkAuth: async () => {
        const state = get()
        
        // If we have a token and it's recent (within 5 minutes), consider it valid
        if (state.token && state.lastAuthCheck) {
          const now = Date.now()
          const fiveMinutes = 5 * 60 * 1000
          if (now - state.lastAuthCheck < fiveMinutes) {
            return state.isAuthenticated
          }
        }

        // If no token, not authenticated (only update if state changed)
        if (!state.token) {
          if (state.isAuthenticated) {
            set({ isAuthenticated: false })
          }
          return false
        }

        // Don't check if already checking
        if (state.isCheckingAuth) {
          return state.isAuthenticated
        }

        // Validate token with API
        set({ isCheckingAuth: true })
        try {
          const mainApiUrl = getMainApiUrl()
          const response = await fetch(`${mainApiUrl}/users/me/context`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${state.token}`,
              'Content-Type': 'application/json'
            }
          })

          if (response.ok) {
            const data = await response.json()
            set({
              isAuthenticated: true,
              userEmail: data.user?.email || state.userEmail,
              lastAuthCheck: Date.now(),
              isCheckingAuth: false,
              error: null
            })
            return true
          } else {
            set({
              isAuthenticated: false,
              token: null,
              isCheckingAuth: false,
              error: 'Session expired'
            })
            return false
          }
        } catch (error) {
          console.error('Auth check error:', error)
          // Don't fail auth check on network errors - might be temporary
          set({ isCheckingAuth: false })
          return state.isAuthenticated
        }
      }
    }),
    {
      name: 'auth-storage',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      }
    }
  )
)
