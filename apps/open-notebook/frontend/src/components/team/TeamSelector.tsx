'use client'

import { useTeamContext } from '@/lib/hooks/use-team-context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Users, User, ChevronDown, Building2 } from 'lucide-react'

/**
 * Team Selector Component
 *
 * Allows users to switch between personal mode and team mode.
 * When in team mode, all new notebooks are created for that team.
 */
export function TeamSelector() {
  const {
    user,
    teams,
    currentTeam,
    currentTeamId,
    isTeamMode,
    isLoading,
    setCurrentTeamId,
  } = useTeamContext()

  if (isLoading || !user) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <Users className="h-4 w-4 mr-2" />
        Loading...
      </Button>
    )
  }

  // If user has no teams, just show personal mode
  if (teams.length === 0) {
    return (
      <Badge variant="outline" className="flex items-center gap-1.5">
        <User className="h-3 w-3" />
        Personal
      </Badge>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          {isTeamMode ? (
            <>
              <Users className="h-4 w-4" />
              <span className="max-w-[150px] truncate">{currentTeam?.name}</span>
            </>
          ) : (
            <>
              <User className="h-4 w-4" />
              <span>Personal</span>
            </>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Ownership Context
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Personal mode option */}
        <DropdownMenuItem
          onClick={() => setCurrentTeamId(null)}
          className={!isTeamMode ? 'bg-accent' : ''}
        >
          <User className="h-4 w-4 mr-2" />
          <div className="flex flex-col">
            <span>Personal</span>
            <span className="text-xs text-muted-foreground">
              Only you can see these notebooks
            </span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Teams
        </DropdownMenuLabel>

        {/* Team options */}
        {teams.map((team) => (
          <DropdownMenuItem
            key={team.id}
            onClick={() => setCurrentTeamId(team.id)}
            className={currentTeamId === team.id ? 'bg-accent' : ''}
          >
            <Users className="h-4 w-4 mr-2" />
            <div className="flex flex-col">
              <span className="truncate">{team.name}</span>
              <span className="text-xs text-muted-foreground">
                Shared with team members
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Ownership Badge Component
 *
 * Displays a small badge showing whether an item is Personal or belongs to a team.
 */
interface OwnershipBadgeProps {
  userId?: string
  teamId?: string
  className?: string
}

export function OwnershipBadge({ userId, teamId, className }: OwnershipBadgeProps) {
  const { teams, user } = useTeamContext()

  if (teamId) {
    const team = teams.find(t => t.id === teamId)
    return (
      <Badge variant="secondary" className={className}>
        <Users className="h-3 w-3 mr-1" />
        {team?.name || 'Team'}
      </Badge>
    )
  }

  // Personal ownership - only show if it matches current user
  if (userId && user && userId === user.id) {
    return (
      <Badge variant="outline" className={className}>
        <User className="h-3 w-3 mr-1" />
        Personal
      </Badge>
    )
  }

  // Unknown or other user's personal item
  return null
}
