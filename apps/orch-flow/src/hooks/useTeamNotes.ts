import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface TeamNote {
  id: string;
  title: string;
  content: string | null;
  is_pinned: boolean;
  created_by_user_id: string | null;
  created_by_guest: string | null;
  created_at: string;
  updated_at: string;
}

export function useTeamNotes(teamId?: string | null) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<TeamNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotes = async () => {
      let query = supabase
        .from('team_notes')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });

      if (teamId) {
        query = query.eq('team_id', teamId);
      }

      const { data, error } = await query;

      if (!error && data) {
        setNotes(data);
      }
      setLoading(false);
    };

    fetchNotes();

    const channel = supabase
      .channel('team-notes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_notes' },
        (payload) => {
          // Only update if it's for our team
          if (teamId && (payload.new as any)?.team_id !== teamId && (payload.old as any)?.team_id !== teamId) {
            return;
          }
          if (payload.eventType === 'INSERT') {
            setNotes(prev => [payload.new as TeamNote, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setNotes(prev => prev.map(n => n.id === payload.new.id ? payload.new as TeamNote : n));
          } else if (payload.eventType === 'DELETE') {
            setNotes(prev => prev.filter(n => n.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId]);

  const createNote = useCallback(async (title: string = 'Untitled Note', content: string = '', guestName?: string) => {
    const { data, error } = await supabase.from('team_notes').insert({
      title,
      content,
      created_by_user_id: user?.id || null,
      created_by_guest: !user ? guestName || null : null,
      team_id: teamId || null,
    }).select().single();

    if (error) {
      console.error('Error creating note:', error);
      return null;
    }
    return data;
  }, [user, teamId]);

  const updateNote = useCallback(async (id: string, updates: { title?: string; content?: string; is_pinned?: boolean }) => {
    const { error } = await supabase
      .from('team_notes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error updating note:', error);
    }
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    const { error } = await supabase.from('team_notes').delete().eq('id', id);
    if (error) {
      console.error('Error deleting note:', error);
    }
  }, []);

  const togglePin = useCallback(async (id: string, currentPinned: boolean) => {
    await updateNote(id, { is_pinned: !currentPinned });
  }, [updateNote]);

  return {
    notes,
    loading,
    createNote,
    updateNote,
    deleteNote,
    togglePin,
  };
}
