import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Effort {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Goal {
  id: string;
  effort_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  goal_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export function useHierarchy(teamId?: string | null) {
  const [efforts, setEfforts] = useState<Effort[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    // Fetch efforts for this team
    let effortsQuery = supabase.from('efforts').select('*').order('created_at');
    if (teamId) {
      effortsQuery = effortsQuery.eq('team_id', teamId);
    }
    
    const effortsRes = await effortsQuery;
    const fetchedEfforts = effortsRes.data || [];
    setEfforts(fetchedEfforts);

    if (fetchedEfforts.length === 0) {
      setGoals([]);
      setProjects([]);
      setLoading(false);
      return;
    }

    // Fetch goals for the team's efforts
    const effortIds = fetchedEfforts.map(e => e.id);
    const goalsRes = await supabase
      .from('goals')
      .select('*')
      .in('effort_id', effortIds)
      .order('created_at');
    
    const fetchedGoals = goalsRes.data || [];
    setGoals(fetchedGoals);

    if (fetchedGoals.length === 0) {
      setProjects([]);
      setLoading(false);
      return;
    }

    // Fetch projects for the team's goals
    const goalIds = fetchedGoals.map(g => g.id);
    const projectsRes = await supabase
      .from('projects')
      .select('*')
      .in('goal_id', goalIds)
      .order('created_at');
    
    setProjects(projectsRes.data || []);
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetchAll();

    const effortChannel = supabase
      .channel('efforts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'efforts' }, fetchAll)
      .subscribe();

    const goalChannel = supabase
      .channel('goals-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, fetchAll)
      .subscribe();

    const projectChannel = supabase
      .channel('projects-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, fetchAll)
      .subscribe();

    return () => {
      supabase.removeChannel(effortChannel);
      supabase.removeChannel(goalChannel);
      supabase.removeChannel(projectChannel);
    };
  }, [fetchAll]);

  // CRUD operations - refetch after each mutation for immediate UI update
  const addEffort = async (name: string) => {
    const { data, error } = await supabase
      .from('efforts')
      .insert({ name, team_id: teamId || null })
      .select()
      .single();
    if (!error) fetchAll();
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

  const addProject = async (goalId: string, name: string) => {
    const { data, error } = await supabase
      .from('projects')
      .insert({ goal_id: goalId, name })
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
