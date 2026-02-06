import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseAvailable } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Helper to query public schema (for users table)
const publicSchema = () => supabase.schema('public');

export interface Effort {
  id: string;
  organization_slug: string;
  name: string;
  description: string | null;
  status?: string;
  order_index: number;
  icon?: string | null;
  color?: string | null;
  estimated_days?: number | null;
  created_at: string;
  updated_at?: string;
}

export interface Goal {
  id: string;
  effort_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Project {
  id: string;
  effort_id: string; // Projects link to efforts, not goals
  name: string;
  description: string | null;
  status?: string;
  order_index: number;
  created_at: string;
  updated_at?: string;
}

export function useHierarchy(organizationSlug?: string | null) {
  const { user } = useAuth();
  const [efforts, setEfforts] = useState<Effort[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    console.log('[fetchAll] Starting...');
    // If no organizationSlug provided, try to get it from the current user
    let orgSlug = organizationSlug;
    if (!orgSlug && user) {
      try {
        const { data: userData } = await publicSchema()
          .from('users')
          .select('organization_slug')
          .eq('id', user.id)
          .single();
        orgSlug = userData?.organization_slug;
      } catch (error) {
        console.warn('Could not fetch user organization (Supabase may not be accessible):', error);
      }
    }
    console.log('[fetchAll] orgSlug:', orgSlug);

    if (!orgSlug) {
      console.log('[fetchAll] No orgSlug, clearing state');
      setEfforts([]);
      setGoals([]);
      setProjects([]);
      setLoading(false);
      return;
    }

    // Fetch efforts for this organization
    const effortsRes = await supabase
      .from('efforts')
      .select('*')
      .eq('organization_slug', orgSlug)
      .order('order_index');
    console.log('[fetchAll] Efforts result:', effortsRes);

    const fetchedEfforts = effortsRes.data || [];
    console.log('[fetchAll] Setting efforts:', fetchedEfforts.length, 'items');
    setEfforts(fetchedEfforts);

    if (fetchedEfforts.length === 0) {
      setGoals([]);
      setProjects([]);
      setLoading(false);
      return;
    }

    // Fetch goals for these efforts
    const effortIds = fetchedEfforts.map(e => e.id);
    const goalsRes = await supabase
      .from('goals')
      .select('*')
      .in('effort_id', effortIds)
      .order('created_at');

    const fetchedGoals = goalsRes.data || [];
    setGoals(fetchedGoals);

    // Fetch projects for these efforts (projects link to efforts, not goals)
    const projectsRes = await supabase
      .from('projects')
      .select('*')
      .in('effort_id', effortIds)
      .order('order_index');

    setProjects(projectsRes.data || []);
    setLoading(false);
  }, [organizationSlug, user]);

  useEffect(() => {
    fetchAll();

    // Subscribe to realtime changes only if Supabase is accessible
    let effortChannel: ReturnType<typeof supabase.channel> | null = null;
    let goalChannel: ReturnType<typeof supabase.channel> | null = null;
    let projectChannel: ReturnType<typeof supabase.channel> | null = null;

    // Check if Supabase is available before attempting subscriptions
    isSupabaseAvailable().then((isAvailable) => {
      if (!isAvailable) {
        // Supabase is not accessible - skip realtime subscriptions
        console.debug('[useHierarchy] Supabase not accessible - skipping realtime subscriptions');
        return;
      }

      // Supabase is available - set up subscriptions
      try {
        effortChannel = supabase
          .channel('efforts-changes')
          .on('postgres_changes', { event: '*', schema: 'orch_flow', table: 'efforts' }, fetchAll)
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('[useHierarchy] Subscribed to efforts changes');
            } else if (status === 'CHANNEL_ERROR') {
              console.warn('⚠️ Could not subscribe to efforts changes (Supabase may not be accessible)');
            }
          });

        goalChannel = supabase
          .channel('goals-changes')
          .on('postgres_changes', { event: '*', schema: 'orch_flow', table: 'goals' }, fetchAll)
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('[useHierarchy] Subscribed to goals changes');
            } else if (status === 'CHANNEL_ERROR') {
              console.warn('⚠️ Could not subscribe to goals changes (Supabase may not be accessible)');
            }
          });

        projectChannel = supabase
          .channel('projects-changes')
          .on('postgres_changes', { event: '*', schema: 'orch_flow', table: 'projects' }, fetchAll)
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('[useHierarchy] Subscribed to projects changes');
            } else if (status === 'CHANNEL_ERROR') {
              console.warn('⚠️ Could not subscribe to projects changes (Supabase may not be accessible)');
            }
          });
      } catch (error) {
        console.warn('⚠️ Could not set up realtime subscriptions (Supabase may not be accessible):', error);
      }
    });

    return () => {
      if (effortChannel) {
        supabase.removeChannel(effortChannel).catch(() => {
          // Ignore cleanup errors
        });
      }
      if (goalChannel) {
        supabase.removeChannel(goalChannel).catch(() => {
          // Ignore cleanup errors
        });
      }
      if (projectChannel) {
        supabase.removeChannel(projectChannel).catch(() => {
          // Ignore cleanup errors
        });
      }
    };
  }, [fetchAll]);

  // CRUD operations - refetch after each mutation for immediate UI update
  const addEffort = async (name: string) => {
    console.log('[addEffort] Starting with name:', name);

    if (!user) {
      console.error('[addEffort] User not authenticated');
      return { data: null, error: new Error('User not authenticated') };
    }

    // Get organization_slug from current user
    let orgSlug: string | undefined;
    try {
      const { data: userData, error: userError } = await publicSchema()
        .from('users')
        .select('organization_slug')
        .eq('id', user.id)
        .single();
      console.log('[addEffort] User data result:', { userData, userError });
      orgSlug = userData?.organization_slug;
    } catch (error) {
      console.warn('Could not fetch user organization (Supabase may not be accessible):', error);
    }

    if (!orgSlug) {
      console.error('[addEffort] User organization not found');
      return { data: null, error: new Error('User organization not found') };
    }

    console.log('[addEffort] Inserting effort with org:', orgSlug);
    const { data, error } = await supabase
      .from('efforts')
      .insert({
        name,
        organization_slug: orgSlug,
        order_index: 0
      })
      .select()
      .single();
    console.log('[addEffort] Insert result:', { data, error });

    if (!error) {
      console.log('[addEffort] Success, calling fetchAll');
      fetchAll();
    }
    return { data, error };
  };

  const updateEffort = async (id: string, name: string) => {
    const { error } = await supabase
      .from('efforts')
      .update({ name })
      .eq('id', id);
    if (!error) fetchAll();
    return { error };
  };

  const deleteEffort = async (id: string) => {
    const { error } = await supabase.from('efforts').delete().eq('id', id);
    if (!error) fetchAll();
    return { error };
  };

  const addGoal = async (effortId: string, name: string) => {
    const { data, error } = await supabase
      .from('goals')
      .insert({ effort_id: effortId, name })
      .select()
      .single();
    if (!error) fetchAll();
    return { data, error };
  };

  const updateGoal = async (id: string, name: string) => {
    const { error } = await supabase
      .from('goals')
      .update({ name })
      .eq('id', id);
    if (!error) fetchAll();
    return { error };
  };

  const deleteGoal = async (id: string) => {
    const { error } = await supabase.from('goals').delete().eq('id', id);
    if (!error) fetchAll();
    return { error };
  };

  const addProject = async (effortId: string, name: string) => {
    const { data, error } = await supabase
      .from('projects')
      .insert({
        effort_id: effortId,
        name,
        order_index: 0
      })
      .select()
      .single();
    if (!error) fetchAll();
    return { data, error };
  };

  const updateProject = async (id: string, name: string) => {
    const { error } = await supabase
      .from('projects')
      .update({ name })
      .eq('id', id);
    if (!error) fetchAll();
    return { error };
  };

  const deleteProject = async (id: string) => {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (!error) fetchAll();
    return { error };
  };

  return {
    efforts,
    goals,
    projects,
    loading,
    addEffort,
    updateEffort,
    deleteEffort,
    addGoal,
    updateGoal,
    deleteGoal,
    addProject,
    updateProject,
    deleteProject,
  };
}
