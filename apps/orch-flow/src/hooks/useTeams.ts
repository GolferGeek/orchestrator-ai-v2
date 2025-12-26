import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Helper to use orch_flow schema
const orchFlow = () => supabase.schema('orch_flow');

export interface Team {
  id: string;
  name: string;
  description: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  is_public: boolean;
  join_passcode: string | null;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  display_name?: string;
  is_online?: boolean;
}

export function useTeams() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch teams the user is a member of
  const fetchTeams = useCallback(async () => {
    if (!user) {
      setTeams([]);
      setTeamMembers([]);
      setLoading(false);
      return;
    }

    // Get team IDs the user is a member of
    const { data: memberships, error: membershipError } = await orchFlow()
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id);

    if (membershipError) {
      console.error('Error fetching memberships:', membershipError);
      setLoading(false);
      return;
    }

    const teamIds = memberships?.map(m => m.team_id) || [];

    if (teamIds.length === 0) {
      setTeams([]);
      setTeamMembers([]);
      setLoading(false);
      return;
    }

    // Fetch teams
    const { data: teamsData, error: teamsError } = await orchFlow()
      .from('teams')
      .select('*')
      .in('id', teamIds)
      .order('name');

    if (teamsError) {
      console.error('Error fetching teams:', teamsError);
    } else {
      setTeams(teamsData || []);
    }

    // Fetch all team members for these teams with profiles
    const { data: membersData, error: membersError } = await orchFlow()
      .from('team_members')
      .select('*')
      .in('team_id', teamIds);

    if (membersError) {
      console.error('Error fetching team members:', membersError);
    } else {
      // Fetch profiles for all members (profiles table is in public schema)
      const userIds = [...new Set(membersData?.map(m => m.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.display_name]) || []);

      const membersWithProfiles = membersData?.map(m => ({
        ...m,
        display_name: profileMap.get(m.user_id) || 'Unknown User',
      })) || [];

      setTeamMembers(membersWithProfiles);
    }

    setLoading(false);
  }, [user]);

  // Fetch public teams user can join (not already a member of)
  const fetchAvailableTeams = useCallback(async () => {
    if (!user) {
      setAvailableTeams([]);
      return;
    }

    // Get team IDs the user is already a member of
    const { data: memberships } = await orchFlow()
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id);

    const memberTeamIds = memberships?.map(m => m.team_id) || [];

    // Fetch all public teams
    let query = orchFlow()
      .from('teams')
      .select('*')
      .eq('is_public', true)
      .order('name');

    // Exclude teams user is already in
    if (memberTeamIds.length > 0) {
      query = query.not('id', 'in', `(${memberTeamIds.join(',')})`);
    }

    const { data: publicTeams, error } = await query;

    if (error) {
      console.error('Error fetching available teams:', error);
    } else {
      setAvailableTeams(publicTeams || []);
    }
  }, [user]);

  useEffect(() => {
    fetchTeams();
    fetchAvailableTeams();

    // Subscribe to team changes
    const teamsChannel = supabase
      .channel('teams-changes')
      .on('postgres_changes', { event: '*', schema: 'orch_flow', table: 'teams' }, () => {
        fetchTeams();
        fetchAvailableTeams();
      })
      .subscribe();

    const membersChannel = supabase
      .channel('team-members-changes')
      .on('postgres_changes', { event: '*', schema: 'orch_flow', table: 'team_members' }, () => {
        fetchTeams();
        fetchAvailableTeams();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(teamsChannel);
      supabase.removeChannel(membersChannel);
    };
  }, [fetchTeams, fetchAvailableTeams]);

  const createTeam = useCallback(async (name: string, description?: string) => {
    if (!user) return { data: null, error: new Error('Not authenticated') };

    // Create the team
    const { data: team, error: teamError } = await orchFlow()
      .from('teams')
      .insert({
        name,
        description: description || null,
        created_by_user_id: user.id,
      })
      .select()
      .single();

    if (teamError) {
      console.error('Error creating team:', teamError);
      return { data: null, error: teamError };
    }

    // Add the creator as a member with 'owner' role
    const { error: memberError } = await orchFlow()
      .from('team_members')
      .insert({
        team_id: team.id,
        user_id: user.id,
        role: 'owner',
      });

    if (memberError) {
      console.error('Error adding creator as member:', memberError);
      return { data: team, error: memberError };
    }

    return { data: team, error: null };
  }, [user]);

  const joinTeam = useCallback(async (teamId: string, passcode?: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    // First check if team requires a passcode
    const { data: team, error: teamError } = await orchFlow()
      .from('teams')
      .select('is_public, join_passcode')
      .eq('id', teamId)
      .single();

    if (teamError) {
      console.error('Error fetching team:', teamError);
      return { error: teamError };
    }

    // If team is not public, verify passcode
    if (!team.is_public) {
      if (!passcode || passcode !== team.join_passcode) {
        return { error: new Error('Invalid passcode') };
      }
    }

    const { error } = await orchFlow()
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: user.id,
        role: 'member',
      });

    if (error) {
      console.error('Error joining team:', error);
    }

    return { error };
  }, [user]);

  const leaveTeam = useCallback(async (teamId: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    // Check if user is the last member
    const { data: members, error: countError } = await orchFlow()
      .from('team_members')
      .select('id')
      .eq('team_id', teamId);

    if (countError) {
      console.error('Error checking team members:', countError);
      return { error: countError };
    }

    const isLastMember = members?.length === 1;

    // Remove user from team
    const { error } = await orchFlow()
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error leaving team:', error);
      return { error };
    }

    // If last member, delete the team entirely
    if (isLastMember) {
      const { error: deleteError } = await orchFlow()
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (deleteError) {
        console.error('Error deleting empty team:', deleteError);
      }
    }

    return { error: null };
  }, [user]);

  const updateTeam = useCallback(async (id: string, updates: {
    name?: string;
    description?: string;
    is_public?: boolean;
    join_passcode?: string | null;
  }) => {
    const { error } = await orchFlow()
      .from('teams')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error updating team:', error);
    }

    return { error };
  }, []);

  const deleteTeam = useCallback(async (id: string) => {
    const { error } = await orchFlow().from('teams').delete().eq('id', id);

    if (error) {
      console.error('Error deleting team:', error);
    }

    return { error };
  }, []);

  const getTeamMembers = useCallback((teamId: string) => {
    return teamMembers.filter(m => m.team_id === teamId);
  }, [teamMembers]);

  return {
    teams,
    availableTeams,
    teamMembers,
    loading,
    createTeam,
    joinTeam,
    leaveTeam,
    updateTeam,
    deleteTeam,
    getTeamMembers,
    refetch: fetchTeams,
    refetchAvailable: fetchAvailableTeams,
  };
}
