import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Team Context Store
 *
 * Manages the current user's team context for Open Notebook.
 * Fetches org/team data from the centralized API and provides
 * team selection for ownership filtering.
 */

export interface UserOrganization {
  slug: string
  name: string
  role: string
  isGlobal: boolean
}

export interface UserTeam {
  id: string
  name: string
  description?: string
  orgSlug: string
  role: string
  joinedAt: string
}

export interface UserContext {
  user: {
    id: string
    email: string
    displayName?: string
  }
  organizations: UserOrganization[]
  teams: UserTeam[]
}

interface TeamContextState {
  // User context from API
  userContext: UserContext | null

  // Current selection
  currentTeamId: string | null
  currentOrgSlug: string | null

  // Loading state
  isLoading: boolean
  error: string | null
  lastFetch: number | null

  // Actions
  fetchUserContext: () => Promise<void>
  setCurrentTeamId: (teamId: string | null) => void
  setCurrentOrgSlug: (orgSlug: string | null) => void
  getCurrentTeam: () => UserTeam | null
  getCurrentOrg: () => UserOrganization | null
  clear: () => void
}

// API base URL for the NestJS API (not the Open Notebook API)
// This should point to api.orchestratorai.io (same as main website)
const getApiBaseUrl = () => {
  // Use environment variable if set, otherwise default to api.orchestratorai.io
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_MAIN_API_URL || 'https://api.orchestratorai.io'
  }
  return process.env.MAIN_API_URL || process.env.NEXT_PUBLIC_MAIN_API_URL || 'https://api.orchestratorai.io'
}

// Check if we're running in local development
// This checks both the browser hostname and whether the main API URL is local
const isLocalDev = () => {
  if (typeof window === 'undefined') return false
  const hostname = window.location.hostname
  const apiBaseUrl = getApiBaseUrl()
  
  // Consider it local dev if:
  // 1. Browser is accessing via localhost/127.0.0.1, OR
  // 2. Main API URL is localhost/127.0.0.1 (even if accessed via domain)
  const isBrowserLocal = hostname === 'localhost' || hostname === '127.0.0.1'
  const isApiLocal = apiBaseUrl.includes('localhost') || apiBaseUrl.includes('127.0.0.1')
  
  return isBrowserLocal || isApiLocal
}

export const useTeamContextStore = create<TeamContextState>()(
  persist(
    (set, get) => ({
      userContext: null,
      currentTeamId: null,
      currentOrgSlug: null,
      isLoading: false,
      error: null,
      lastFetch: null,

      fetchUserContext: async () => {
        const state = get()

        // Skip if we fetched recently (within 60 seconds)
        const now = Date.now()
        if (state.lastFetch && (now - state.lastFetch) < 60000 && state.userContext) {
          return
        }

        set({ isLoading: true, error: null })

        try {
          // Get the auth token from the auth store
          const authStorage = localStorage.getItem('auth-storage')
          if (!authStorage) {
            set({ isLoading: false, error: 'Not authenticated' })
            return
          }

          const { state: authState } = JSON.parse(authStorage)
          if (!authState?.token) {
            set({ isLoading: false, error: 'No auth token' })
            return
          }

          // In local development, skip fetching user context if main API is not available
          // This prevents CORS errors when the main API isn't running locally
          if (isLocalDev()) {
            const apiBaseUrl = getApiBaseUrl()
            // Check if the main API is accessible (not localhost)
            const isMainApiLocal = apiBaseUrl.includes('localhost') || apiBaseUrl.includes('127.0.0.1')
            
            if (isMainApiLocal) {
              // Main API is also local, try to fetch
              // If it fails, we'll handle it gracefully below
            } else {
              // Main API is production, but we're running locally
              // Skip fetching to avoid CORS issues
              console.warn('⚠️ Skipping user context fetch in local dev (main API not accessible)')
              set({
                isLoading: false,
                error: null,
                // Use empty context - app will work without team context
                userContext: {
                  user: {
                    id: authState.userEmail || 'local-user',
                    email: authState.userEmail || 'local@example.com',
                  },
                  organizations: [],
                  teams: [],
                },
                lastFetch: now,
              })
              return
            }
          }

          const apiBaseUrl = getApiBaseUrl()
          const response = await fetch(`${apiBaseUrl}/users/me/context`, {
            headers: {
              'Authorization': `Bearer ${authState.token}`,
              'Content-Type': 'application/json',
            },
            // Add timeout to prevent hanging
            signal: AbortSignal.timeout(5000),
          })

          if (!response.ok) {
            if (response.status === 401) {
              set({ isLoading: false, error: 'Authentication expired' })
              return
            }
            // In local dev, don't throw error - just use empty context
            if (isLocalDev()) {
              console.warn('⚠️ Failed to fetch user context, using empty context')
              set({
                isLoading: false,
                error: null,
                userContext: {
                  user: {
                    id: authState.userEmail || 'local-user',
                    email: authState.userEmail || 'local@example.com',
                  },
                  organizations: [],
                  teams: [],
                },
                lastFetch: now,
              })
              return
            }
            throw new Error(`Failed to fetch user context: ${response.status}`)
          }

          const userContext: UserContext = await response.json()

          // Auto-select first org and team if none selected
          let { currentOrgSlug, currentTeamId } = get()

          if (!currentOrgSlug && userContext.organizations.length > 0) {
            // Prefer non-global org
            const defaultOrg = userContext.organizations.find(o => !o.isGlobal) || userContext.organizations[0]
            currentOrgSlug = defaultOrg.slug
          }

          if (!currentTeamId && userContext.teams.length > 0) {
            // Prefer team in current org
            const teamInOrg = userContext.teams.find(t => t.orgSlug === currentOrgSlug)
            currentTeamId = teamInOrg?.id || userContext.teams[0].id
          }

          set({
            userContext,
            currentOrgSlug,
            currentTeamId,
            isLoading: false,
            lastFetch: now,
          })
        } catch (error) {
          console.error('Error fetching user context:', error)
          // In local dev, use empty context instead of showing error
          if (isLocalDev() && (error instanceof TypeError || error instanceof DOMException)) {
            console.warn('⚠️ User context fetch failed (likely CORS or network), using empty context')
            const authStorage = localStorage.getItem('auth-storage')
            const authState = authStorage ? JSON.parse(authStorage).state : null
            set({
              isLoading: false,
              error: null,
              userContext: {
                user: {
                  id: authState?.userEmail || 'local-user',
                  email: authState?.userEmail || 'local@example.com',
                },
                organizations: [],
                teams: [],
              },
              lastFetch: now,
            })
          } else {
            set({
              isLoading: false,
              error: error instanceof Error ? error.message : 'Failed to fetch user context',
            })
          }
        }
      },

      setCurrentTeamId: (teamId: string | null) => {
        set({ currentTeamId: teamId })
      },

      setCurrentOrgSlug: (orgSlug: string | null) => {
        set({ currentOrgSlug: orgSlug })
      },

      getCurrentTeam: () => {
        const { userContext, currentTeamId } = get()
        if (!userContext || !currentTeamId) return null
        return userContext.teams.find(t => t.id === currentTeamId) || null
      },

      getCurrentOrg: () => {
        const { userContext, currentOrgSlug } = get()
        if (!userContext || !currentOrgSlug) return null
        return userContext.organizations.find(o => o.slug === currentOrgSlug) || null
      },

      clear: () => {
        set({
          userContext: null,
          currentTeamId: null,
          currentOrgSlug: null,
          isLoading: false,
          error: null,
          lastFetch: null,
        })
      },
    }),
    {
      name: 'team-context-storage',
      partialize: (state) => ({
        currentTeamId: state.currentTeamId,
        currentOrgSlug: state.currentOrgSlug,
      }),
    }
  )
)
