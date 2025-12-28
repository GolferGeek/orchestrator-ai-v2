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
const getApiBaseUrl = () => {
  // In development, this is typically http://localhost:6100
  // In production, this would be the API server URL
  return import.meta.env.VITE_API_URL || 'http://127.0.0.1:6100'
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

          const apiBaseUrl = getApiBaseUrl()
          const response = await fetch(`${apiBaseUrl}/users/me/context`, {
            headers: {
              'Authorization': `Bearer ${authState.token}`,
              'Content-Type': 'application/json',
            },
          })

          if (!response.ok) {
            if (response.status === 401) {
              set({ isLoading: false, error: 'Authentication expired' })
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
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to fetch user context',
          })
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
