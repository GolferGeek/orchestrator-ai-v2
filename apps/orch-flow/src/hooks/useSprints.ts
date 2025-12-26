import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Helper to use orch_flow schema
const orchFlow = () => supabase.schema('orch_flow');

export interface Sprint {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  team_id: string | null;
}

export function useSprints(teamId?: string | null) {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [activeSprint, setActiveSprint] = useState<Sprint | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSprints = async () => {
      let query = orchFlow()
        .from('sprints')
        .select('*')
        .order('created_at', { ascending: false });

      if (teamId) {
        query = query.eq('team_id', teamId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching sprints:', error);
      } else {
        setSprints(data || []);
        const active = data?.find(s => s.is_active);
        setActiveSprint(active || null);
      }
      setLoading(false);
    };

    fetchSprints();

    const channel = supabase
      .channel('sprints-changes')
      .on('postgres_changes', { event: '*', schema: 'orch_flow', table: 'sprints' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setSprints(prev => [payload.new as Sprint, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setSprints(prev => prev.map(s => s.id === payload.new.id ? payload.new as Sprint : s));
            if ((payload.new as Sprint).is_active) {
              setActiveSprint(payload.new as Sprint);
            } else if (activeSprint?.id === payload.new.id) {
              setActiveSprint(null);
            }
          } else if (payload.eventType === 'DELETE') {
            setSprints(prev => prev.filter(s => s.id !== payload.old.id));
            if (activeSprint?.id === payload.old.id) {
              setActiveSprint(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId]);

  const createSprint = useCallback(async (name: string, startDate: string, endDate: string) => {
    // Deactivate other sprints for this team first
    let deactivateQuery = orchFlow().from('sprints').update({ is_active: false }).eq('is_active', true);
    if (teamId) {
      deactivateQuery = deactivateQuery.eq('team_id', teamId);
    }
    await deactivateQuery;

    const { data, error } = await orchFlow()
      .from('sprints')
      .insert({
        name,
        start_date: startDate,
        end_date: endDate,
        is_active: true,
        team_id: teamId || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating sprint:', error);
      return null;
    }
    return data;
  }, [teamId]);

  const updateSprint = useCallback(async (id: string, updates: Partial<Pick<Sprint, 'name' | 'start_date' | 'end_date'>>) => {
    // Optimistic update
    setSprints(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    if (activeSprint?.id === id) {
      setActiveSprint(prev => prev ? { ...prev, ...updates } : prev);
    }
    
    const { error } = await orchFlow()
      .from('sprints')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error updating sprint:', error);
    }
  }, [activeSprint?.id]);

  const setActiveSprintById = useCallback(async (id: string) => {
    // Deactivate all sprints
    await orchFlow().from('sprints').update({ is_active: false }).eq('is_active', true);

    // Activate the selected sprint
    const { error } = await orchFlow()
      .from('sprints')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error activating sprint:', error);
    }
  }, []);

  const deleteSprint = useCallback(async (id: string) => {
    const { error } = await orchFlow().from('sprints').delete().eq('id', id);
    if (error) {
      console.error('Error deleting sprint:', error);
    }
  }, []);

  return {
    sprints,
    activeSprint,
    loading,
    createSprint,
    updateSprint,
    setActiveSprintById,
    deleteSprint,
  };
}
