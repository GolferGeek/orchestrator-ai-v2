import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RbacService } from '../rbac/rbac.service';
import {
  TeamResponseDto,
  TeamMemberResponseDto,
  TeamMemberRole,
  UserTeamResponseDto,
  UserContextResponseDto,
} from './teams.dto';

interface TeamDbRow {
  id: string;
  org_slug: string | null; // Nullable for global teams
  name: string;
  description?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

interface UserDbRow {
  id: string;
  email: string;
  display_name?: string | null;
}

interface UserTeamDbRow {
  team_id: string;
  team_name: string;
  team_description?: string;
  org_slug: string | null; // Nullable for global teams
  member_role: string;
  joined_at: string;
}

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly rbacService: RbacService,
  ) {}

  /**
   * Get user context including orgs and teams
   */
  async getUserContext(userId: string): Promise<UserContextResponseDto> {
    // Get user info
    const { data: userData, error: userError } = await this.supabase
      .getServiceClient()
      .from('users')
      .select('id, email, display_name')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      throw new NotFoundException('User not found');
    }

    // Get user's organizations via RBAC
    const organizations = await this.rbacService.getUserOrganizations(userId);

    // Get user's teams
    const teamsResult = await this.supabase
      .getServiceClient()
      .rpc('get_user_teams', { p_user_id: userId });
    const teamsData: unknown = teamsResult.data;
    const teamsError = teamsResult.error;

    if (teamsError) {
      this.logger.error(`Failed to get user teams: ${teamsError.message}`);
    }

    const typedTeams = (teamsData as UserTeamDbRow[]) || [];

    return {
      user: {
        id: userData.id as string,
        email: userData.email as string,
        displayName: (userData.display_name as string | undefined) ?? undefined,
      },
      organizations: organizations.map((org) => ({
        slug: org.organizationSlug,
        name: org.organizationName,
        role: org.roleName,
        isGlobal: org.isGlobal,
      })),
      teams: typedTeams.map((team) => ({
        id: team.team_id,
        name: team.team_name,
        description: team.team_description,
        orgSlug: team.org_slug,
        role: team.member_role,
        joinedAt: new Date(team.joined_at),
      })),
    };
  }

  /**
   * Get all global teams (no org)
   */
  async getGlobalTeams(): Promise<TeamResponseDto[]> {
    const { data, error } = await this.supabase
      .getServiceClient()
      .from('teams')
      .select('*')
      .is('org_slug', null)
      .order('name');

    if (error) {
      this.logger.error(`Failed to get global teams: ${error.message}`);
      throw new Error(`Failed to get global teams: ${error.message}`);
    }

    return this.mapTeamsWithCounts(data as unknown as TeamDbRow[]);
  }

  /**
   * Get all teams in an organization
   */
  async getTeamsByOrg(orgSlug: string): Promise<TeamResponseDto[]> {
    const { data, error } = await this.supabase
      .getServiceClient()
      .from('teams')
      .select('*')
      .eq('org_slug', orgSlug)
      .order('name');

    if (error) {
      this.logger.error(`Failed to get teams: ${error.message}`);
      throw new Error(`Failed to get teams: ${error.message}`);
    }

    return this.mapTeamsWithCounts(data as unknown as TeamDbRow[]);
  }

  /**
   * Helper to add member counts to teams
   */
  private async mapTeamsWithCounts(
    teams: TeamDbRow[],
  ): Promise<TeamResponseDto[]> {
    const typedData = teams || [];

    // Get member counts for each team
    const teamsWithCounts = await Promise.all(
      typedData.map(async (team) => {
        const { count } = await this.supabase
          .getServiceClient()
          .from('team_members')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', team.id);

        return {
          id: team.id,
          orgSlug: team.org_slug,
          name: team.name,
          description: team.description,
          memberCount: count || 0,
          createdBy: team.created_by,
          createdAt: new Date(team.created_at),
          updatedAt: new Date(team.updated_at),
        };
      }),
    );

    return teamsWithCounts;
  }

  /**
   * Get a single team by ID
   */
  async getTeamById(teamId: string): Promise<TeamResponseDto> {
    const result = await this.supabase
      .getServiceClient()
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();
    const data: unknown = result.data;
    const error = result.error;

    if (error || !data) {
      throw new NotFoundException('Team not found');
    }

    const team = data as unknown as TeamDbRow;

    // Get member count
    const { count } = await this.supabase
      .getServiceClient()
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId);

    return {
      id: team.id,
      orgSlug: team.org_slug,
      name: team.name,
      description: team.description,
      memberCount: count || 0,
      createdBy: team.created_by,
      createdAt: new Date(team.created_at),
      updatedAt: new Date(team.updated_at),
    };
  }

  /**
   * Create a new team
   */
  async createTeam(
    orgSlug: string | null,
    name: string,
    description: string | undefined,
    createdBy: string,
  ): Promise<TeamResponseDto> {
    // Verify user has admin access
    if (orgSlug) {
      // For org-scoped teams, verify admin access to that org
      const isAdmin = await this.rbacService.isAdmin(createdBy, orgSlug);
      if (!isAdmin) {
        throw new ForbiddenException(
          'Only admins can create teams in this organization',
        );
      }
    } else {
      // For global teams, verify user has any admin role
      const isAnyAdmin = await this.rbacService.isAdmin(createdBy, '*');
      if (!isAnyAdmin) {
        throw new ForbiddenException('Only admins can create global teams');
      }
    }

    const result = await this.supabase
      .getServiceClient()
      .from('teams')
      .insert({
        org_slug: orgSlug,
        name,
        description,
        created_by: createdBy,
      })
      .select()
      .single();
    const data: unknown = result.data;
    const error = result.error;

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          orgSlug
            ? 'A team with this name already exists in this organization'
            : 'A global team with this name already exists',
        );
      }
      this.logger.error(`Failed to create team: ${error.message}`);
      throw new Error(`Failed to create team: ${error.message}`);
    }

    const team = data as TeamDbRow;

    return {
      id: team.id,
      orgSlug: team.org_slug,
      name: team.name,
      description: team.description,
      memberCount: 0,
      createdBy: team.created_by,
      createdAt: new Date(team.created_at),
      updatedAt: new Date(team.updated_at),
    };
  }

  /**
   * Update a team
   */
  async updateTeam(
    teamId: string,
    userId: string,
    updates: { name?: string; description?: string },
  ): Promise<TeamResponseDto> {
    // Get team to check org
    const team = await this.getTeamById(teamId);

    // Verify user has admin access
    const isAdmin = await this.rbacService.isAdmin(userId, team.orgSlug ?? '*');
    if (!isAdmin) {
      throw new ForbiddenException('Only admins can update teams');
    }

    const result = await this.supabase
      .getServiceClient()
      .from('teams')
      .update(updates)
      .eq('id', teamId)
      .select()
      .single();
    const data: unknown = result.data;
    const error = result.error;

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          'A team with this name already exists in this organization',
        );
      }
      this.logger.error(`Failed to update team: ${error.message}`);
      throw new Error(`Failed to update team: ${error.message}`);
    }

    const updatedTeam = data as TeamDbRow;

    return {
      id: updatedTeam.id,
      orgSlug: updatedTeam.org_slug,
      name: updatedTeam.name,
      description: updatedTeam.description,
      memberCount: team.memberCount,
      createdBy: updatedTeam.created_by,
      createdAt: new Date(updatedTeam.created_at),
      updatedAt: new Date(updatedTeam.updated_at),
    };
  }

  /**
   * Delete a team
   */
  async deleteTeam(teamId: string, userId: string): Promise<void> {
    // Get team to check org
    const team = await this.getTeamById(teamId);

    // Verify user has admin access
    const isAdmin = await this.rbacService.isAdmin(userId, team.orgSlug ?? '*');
    if (!isAdmin) {
      throw new ForbiddenException('Only admins can delete teams');
    }

    const { error } = await this.supabase
      .getServiceClient()
      .from('teams')
      .delete()
      .eq('id', teamId);

    if (error) {
      this.logger.error(`Failed to delete team: ${error.message}`);
      throw new Error(`Failed to delete team: ${error.message}`);
    }
  }

  /**
   * Get team members
   */
  async getTeamMembers(teamId: string): Promise<TeamMemberResponseDto[]> {
    // Get team members first
    const { data: membersData, error: membersError } = await this.supabase
      .getServiceClient()
      .from('team_members')
      .select('id, team_id, user_id, role, joined_at')
      .eq('team_id', teamId)
      .order('joined_at');

    if (membersError) {
      this.logger.error(`Failed to get team members: ${membersError.message}`);
      throw new Error(`Failed to get team members: ${membersError.message}`);
    }

    if (!membersData || membersData.length === 0) {
      return [];
    }

    // Get user details for all members
    const userIds = membersData.map((m: { user_id: string }) => m.user_id);
    const usersResult = await this.supabase
      .getServiceClient()
      .from('users')
      .select('id, email, display_name')
      .in('id', userIds);
    const usersData: unknown = usersResult.data;
    const usersError = usersResult.error;

    if (usersError) {
      this.logger.error(`Failed to get user details: ${usersError.message}`);
      throw new Error(`Failed to get user details: ${usersError.message}`);
    }

    // Create a map for quick lookup
    const typedUsers = (usersData || []) as unknown as UserDbRow[];
    const userMap = new Map(
      typedUsers.map((u) => [
        u.id,
        { email: u.email, displayName: u.display_name ?? undefined },
      ]),
    );

    const typedMembers = membersData as unknown as Array<{
      id: string;
      team_id: string;
      user_id: string;
      role: string;
      joined_at: string;
    }>;

    return typedMembers.map((member) => {
      const user = userMap.get(member.user_id);
      return {
        id: member.id,
        userId: member.user_id,
        email: user?.email || '',
        displayName: user?.displayName,
        role: member.role as TeamMemberRole,
        joinedAt: new Date(member.joined_at),
      };
    });
  }

  /**
   * Add a member to a team
   */
  async addTeamMember(
    teamId: string,
    userId: string,
    role: TeamMemberRole,
    addedBy: string,
  ): Promise<TeamMemberResponseDto> {
    // Get team to check org
    const team = await this.getTeamById(teamId);

    // Verify user has admin access
    const isAdmin = await this.rbacService.isAdmin(
      addedBy,
      team.orgSlug ?? '*',
    );
    if (!isAdmin) {
      throw new ForbiddenException('Only admins can add team members');
    }

    // For org-scoped teams, verify the user being added belongs to the org
    if (team.orgSlug) {
      const userOrgs = await this.rbacService.getUserOrganizations(userId);
      const belongsToOrg = userOrgs.some(
        (org) => org.organizationSlug === team.orgSlug || org.isGlobal,
      );

      if (!belongsToOrg) {
        throw new ForbiddenException(
          'User must belong to the organization to join a team',
        );
      }
    }
    // For global teams, any user can be added (no org check needed)

    const { data, error } = await this.supabase
      .getServiceClient()
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: userId,
        role,
      })
      .select('id, team_id, user_id, role, joined_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException('User is already a member of this team');
      }
      this.logger.error(`Failed to add team member: ${error.message}`);
      throw new Error(`Failed to add team member: ${error.message}`);
    }

    // Get user details
    const { data: userData } = await this.supabase
      .getServiceClient()
      .from('users')
      .select('email, display_name')
      .eq('id', userId)
      .single();

    const typedUserData = userData as unknown as UserDbRow | null;
    const typedData = data as unknown as {
      id: string;
      user_id: string;
      role: string;
      joined_at: string;
    };

    return {
      id: typedData.id,
      userId: typedData.user_id,
      email: typedUserData?.email || '',
      displayName: typedUserData?.display_name ?? undefined,
      role: typedData.role as TeamMemberRole,
      joinedAt: new Date(typedData.joined_at),
    };
  }

  /**
   * Update a team member's role
   */
  async updateTeamMember(
    teamId: string,
    userId: string,
    role: TeamMemberRole,
    updatedBy: string,
  ): Promise<TeamMemberResponseDto> {
    // Get team to check org
    const team = await this.getTeamById(teamId);

    // Verify user has admin access
    const isAdmin = await this.rbacService.isAdmin(
      updatedBy,
      team.orgSlug ?? '*',
    );
    if (!isAdmin) {
      throw new ForbiddenException('Only admins can update team member roles');
    }

    const { data, error } = await this.supabase
      .getServiceClient()
      .from('team_members')
      .update({ role })
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .select('id, team_id, user_id, role, joined_at')
      .single();

    if (error || !data) {
      throw new NotFoundException('Team member not found');
    }

    // Get user details
    const { data: userData } = await this.supabase
      .getServiceClient()
      .from('users')
      .select('email, display_name')
      .eq('id', userId)
      .single();

    const typedUserData = userData as unknown as UserDbRow | null;
    const typedData = data as unknown as {
      id: string;
      user_id: string;
      role: string;
      joined_at: string;
    };

    return {
      id: typedData.id,
      userId: typedData.user_id,
      email: typedUserData?.email || '',
      displayName: typedUserData?.display_name ?? undefined,
      role: typedData.role as TeamMemberRole,
      joinedAt: new Date(typedData.joined_at),
    };
  }

  /**
   * Remove a member from a team
   */
  async removeTeamMember(
    teamId: string,
    userId: string,
    removedBy: string,
  ): Promise<void> {
    // Get team to check org
    const team = await this.getTeamById(teamId);

    // Allow self-removal or admin removal
    const isAdmin = await this.rbacService.isAdmin(
      removedBy,
      team.orgSlug ?? '*',
    );
    if (!isAdmin && removedBy !== userId) {
      throw new ForbiddenException('Only admins can remove other team members');
    }

    const { error } = await this.supabase
      .getServiceClient()
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`Failed to remove team member: ${error.message}`);
      throw new Error(`Failed to remove team member: ${error.message}`);
    }
  }

  /**
   * Get teams for a specific user
   */
  async getUserTeams(userId: string): Promise<UserTeamResponseDto[]> {
    const result = await this.supabase
      .getServiceClient()
      .rpc('get_user_teams', { p_user_id: userId });
    const data: unknown = result.data;
    const error = result.error;

    if (error) {
      this.logger.error(`Failed to get user teams: ${error.message}`);
      throw new Error(`Failed to get user teams: ${error.message}`);
    }

    const typedData = (data as UserTeamDbRow[]) || [];

    return typedData.map((team) => ({
      id: team.team_id,
      name: team.team_name,
      description: team.team_description,
      orgSlug: team.org_slug,
      role: team.member_role,
      joinedAt: new Date(team.joined_at),
    }));
  }
}
