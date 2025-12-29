import { useEffect } from 'react'
import { useTeamContextStore } from '@/lib/stores/team-context-store'
import { useAuthStore } from '@/lib/stores/auth-store'

/**
 * Hook to access and manage team context
 *
 * Automatically fetches user context when authenticated
 * Provides team/org selection and ownership info
 */
export function useTeamContext() {
  const { isAuthenticated } = useAuthStore()
  const {
    userContext,
    currentTeamId,
    currentOrgSlug,
    isLoading,
    error,
    fetchUserContext,
    setCurrentTeamId,
    setCurrentOrgSlug,
    getCurrentTeam,
    getCurrentOrg,
    clear,
  } = useTeamContextStore()

  // Fetch user context when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchUserContext()
    } else {
      clear()
    }
  }, [isAuthenticated, fetchUserContext, clear])

  // Get teams for current org
  const teamsInCurrentOrg = userContext?.teams.filter(
    t => t.orgSlug === currentOrgSlug
  ) || []

  // Check if currently in team mode
  const isTeamMode = !!currentTeamId

  // Get ownership info for creating new items
  const getOwnershipForCreate = () => {
    if (currentTeamId) {
      return { team_id: currentTeamId }
    }
    return {} // Personal mode - backend will set user_id
  }

  // Check if an item belongs to current user/team
  const isOwnedByCurrentContext = (item: { user_id?: string; team_id?: string }) => {
    if (currentTeamId) {
      return item.team_id === currentTeamId
    }
    // In personal mode, check user_id matches
    if (userContext?.user?.id) {
      return item.user_id === userContext.user.id && !item.team_id
    }
    return false
  }

  // Get display name for ownership badge
  const getOwnershipLabel = (item: { user_id?: string; team_id?: string }) => {
    if (item.team_id) {
      const team = userContext?.teams.find(t => t.id === item.team_id)
      return team?.name || 'Team'
    }
    return 'Personal'
  }

  return {
    // User and context
    user: userContext?.user,
    organizations: userContext?.organizations || [],
    teams: userContext?.teams || [],
    teamsInCurrentOrg,

    // Current selection
    currentTeamId,
    currentOrgSlug,
    currentTeam: getCurrentTeam(),
    currentOrg: getCurrentOrg(),

    // Status
    isLoading,
    error,
    isTeamMode,

    // Actions
    setCurrentTeamId,
    setCurrentOrgSlug,
    refetch: fetchUserContext,

    // Helpers
    getOwnershipForCreate,
    isOwnedByCurrentContext,
    getOwnershipLabel,
  }
}
