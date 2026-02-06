import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getApiUrl } from '@/lib/config'

/**
 * Get the main API URL (api.orchestratorai.io) for authentication and teams.
 * This is separate from the Open Notebook API URL.
 */
const getMainApiUrl = (): string => {
  // Use environment variable if set, otherwise default to api.orchestratorai.io
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_MAIN_API_URL || 'https://api.orchestratorai.io'
  }
  return process.env.MAIN_API_URL || process.env.NEXT_PUBLIC_MAIN_API_URL || 'https://api.orchestratorai.io'
}

interface AuthStatusResponse {
  auth_enabled: boolean
  auth_type: 'supabase' | 'none'
  message: string
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
  authRequired: boolean | null
  setHasHydrated: (state: boolean) => void
  checkAuthRequired: () => Promise<boolean>
  login: (email: string, password: string) => Promise<boolean>
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
      authRequired: null,

      setHasHydrated: (state: boolean) => {
        set({ hasHydrated: state })
      },

      checkAuthRequired: async () => {
        try {
          const apiUrl = await getApiUrl()
          const response = await fetch(`${apiUrl}/api/auth/status`, {
            cache: 'no-store',
          })

          if (!response.ok) {
            throw new Error(`Auth status check failed: ${response.status}`)
          }

          const data: AuthStatusResponse = await response.json()
          const required = data.auth_enabled || false
          set({ authRequired: required, authType: data.auth_type })

          // If auth is not required, mark as authenticated
          if (!required) {
            set({ isAuthenticated: true, token: 'not-required', authType: 'none' })
          }

          return required
        } catch (error) {
          console.error('Failed to check auth status:', error)

          // If it's a network error, set a more helpful error message
          if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            set({
              error: 'Unable to connect to server. Please check if the API is running.',
              authRequired: null  // Don't assume auth is required if we can't connect
            })
          } else {
            // For other errors, default to requiring auth to be safe
            set({ authRequired: true })
          }

          // Re-throw the error so the UI can handle it
          throw error
        }
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          // For local development, use Notebook API's login endpoint
          // For production, use main API (api.orchestratorai.io)
          const { getApiUrl } = await import('@/lib/config')
          const notebookApiUrl = await getApiUrl()
          const mainApiUrl = getMainApiUrl()
          
          // Use Notebook API if it's localhost (local dev), otherwise use main API
          const isLocalDev = notebookApiUrl.includes('localhost') || notebookApiUrl.includes('127.0.0.1')
          const authApiUrl = isLocalDev ? notebookApiUrl : mainApiUrl
          const authEndpoint = isLocalDev ? '/api/auth/login' : '/auth/login'
          
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
              errorMessage = errorData.detail || `Authentication failed (${response.status})`
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
          // Notebook API returns access_token, Main API returns accessToken
          const token = data.access_token || data.accessToken

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

          // Token is already validated by the backend, so we can use it directly
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

      setSupabaseToken: async (token: string) => {
        set({ isLoading: true, error: null })
        try {
          const apiUrl = await getApiUrl()

          // Validate token with API
          const response = await fetch(`${apiUrl}/api/notebooks`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })

          if (response.ok) {
            set({
              isAuthenticated: true,
              token: token,
              authType: 'supabase',
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
        const { token, lastAuthCheck, isCheckingAuth, isAuthenticated } = state

        // If already checking, return current auth state
        if (isCheckingAuth) {
          return isAuthenticated
        }

        // If no token, not authenticated
        if (!token) {
          return false
        }

        // If we checked recently (within 30 seconds) and are authenticated, skip
        const now = Date.now()
        if (isAuthenticated && lastAuthCheck && (now - lastAuthCheck) < 30000) {
          return true
        }

        set({ isCheckingAuth: true })

        try {
          const apiUrl = await getApiUrl()

          const response = await fetch(`${apiUrl}/api/notebooks`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })

          if (response.ok) {
            set({
              isAuthenticated: true,
              lastAuthCheck: now,
              isCheckingAuth: false
            })
            return true
          } else {
            set({
              isAuthenticated: false,
              token: null,
              lastAuthCheck: null,
              isCheckingAuth: false
            })
            return false
          }
        } catch (error) {
          console.error('checkAuth error:', error)
          set({
            isAuthenticated: false,
            token: null,
            lastAuthCheck: null,
            isCheckingAuth: false
          })
          return false
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        authType: state.authType,
        userEmail: state.userEmail
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      }
    }
  )
)
