import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Collaborator {
  id: string;
  task_id: string;
  user_id: string | null;
  guest_name: string | null;
  joined_at: string;
}

export interface Watcher {
  id: string;
  task_id: string;
  user_id: string | null;
  guest_name: string | null;
  created_at: string;
}

export interface UpdateRequest {
  id: string;
  task_id: string;
  requested_by_user_id: string | null;
  requested_by_guest: string | null;
  message: string | null;
  created_at: string;
  is_resolved: boolean;
}

export function useTaskCollaboration(taskId?: string) {
  const { user, profile } = useAuth();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [watchers, setWatchers] = useState<Watcher[]>([]);
  const [updateRequests, setUpdateRequests] = useState<UpdateRequest[]>([]);

  // Fetch collaborators
  useEffect(() => {
    if (!taskId) return;

    const fetchData = async () => {
      const [collabRes, watchRes, requestRes] = await Promise.all([
        supabase.from('task_collaborators').select('*').eq('task_id', taskId),
        supabase.from('task_watchers').select('*').eq('task_id', taskId),
        supabase.from('task_update_requests').select('*').eq('task_id', taskId).order('created_at', { ascending: false }),
      ]);

      if (collabRes.data) setCollaborators(collabRes.data);
      if (watchRes.data) setWatchers(watchRes.data);
      if (requestRes.data) setUpdateRequests(requestRes.data);
    };

    fetchData();

    // Subscribe to realtime changes
    const collabChannel = supabase
      .channel(`collaborators-${taskId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_collaborators', filter: `task_id=eq.${taskId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setCollaborators(prev => [...prev, payload.new as Collaborator]);
          } else if (payload.eventType === 'DELETE') {
            setCollaborators(prev => prev.filter(c => c.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    const watchChannel = supabase
      .channel(`watchers-${taskId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_watchers', filter: `task_id=eq.${taskId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setWatchers(prev => [...prev, payload.new as Watcher]);
          } else if (payload.eventType === 'DELETE') {
            setWatchers(prev => prev.filter(w => w.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    const requestChannel = supabase
      .channel(`requests-${taskId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_update_requests', filter: `task_id=eq.${taskId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setUpdateRequests(prev => [payload.new as UpdateRequest, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setUpdateRequests(prev => prev.map(r => r.id === payload.new.id ? payload.new as UpdateRequest : r));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(collabChannel);
      supabase.removeChannel(watchChannel);
      supabase.removeChannel(requestChannel);
    };
  }, [taskId]);

  const addCollaborator = useCallback(async (taskIdParam: string, userId?: string, guestName?: string) => {
    const { error } = await supabase.from('task_collaborators').insert({
      task_id: taskIdParam,
      user_id: userId || null,
      guest_name: guestName || null,
    });
    if (error) console.error('Error adding collaborator:', error);
  }, []);

  const removeCollaborator = useCallback(async (collaboratorId: string) => {
    const { error } = await supabase.from('task_collaborators').delete().eq('id', collaboratorId);
    if (error) console.error('Error removing collaborator:', error);
  }, []);

  const toggleWatching = useCallback(async (taskIdParam: string, guestName?: string) => {
    // Fetch current watchers directly from DB to avoid stale state
    const { data: currentWatchers } = await supabase
      .from('task_watchers')
      .select('*')
      .eq('task_id', taskIdParam);

    const existingWatcher = currentWatchers?.find(w => 
      (user && w.user_id === user.id) || (!user && guestName && w.guest_name === guestName)
    );

    if (existingWatcher) {
      const { error } = await supabase.from('task_watchers').delete().eq('id', existingWatcher.id);
      if (error) console.error('Error removing watcher:', error);
    } else {
      const { error } = await supabase.from('task_watchers').insert({
        task_id: taskIdParam,
        user_id: user?.id || null,
        guest_name: !user ? guestName || null : null,
      });
      if (error) console.error('Error adding watcher:', error);
    }
  }, [user]);

  const isWatching = useCallback((guestName?: string) => {
    return watchers.some(w => 
      (user && w.user_id === user.id) || (!user && guestName && w.guest_name === guestName)
    );
  }, [user, watchers]);

  const requestUpdate = useCallback(async (taskIdParam: string, message?: string, guestName?: string) => {
    const { error } = await supabase.from('task_update_requests').insert({
      task_id: taskIdParam,
      requested_by_user_id: user?.id || null,
      requested_by_guest: !user ? guestName || null : null,
      message: message || null,
    });
    if (error) console.error('Error requesting update:', error);
  }, [user]);

  const resolveRequest = useCallback(async (requestId: string) => {
    const { error } = await supabase
      .from('task_update_requests')
      .update({ is_resolved: true })
      .eq('id', requestId);
    if (error) console.error('Error resolving request:', error);
  }, []);

  const joinTask = useCallback(async (taskIdParam: string, guestName?: string) => {
    await addCollaborator(taskIdParam, user?.id, !user ? guestName : undefined);
  }, [user, addCollaborator]);

  const leaveTask = useCallback(async (taskIdParam: string, guestName?: string) => {
    const { data: currentCollaborators } = await supabase
      .from('task_collaborators')
      .select('*')
      .eq('task_id', taskIdParam);

    const myCollaboration = currentCollaborators?.find(c => 
      (user && c.user_id === user.id) || (!user && guestName && c.guest_name === guestName)
    );

    if (myCollaboration) {
      await removeCollaborator(myCollaboration.id);
    }
  }, [user, removeCollaborator]);

  const isCollaborator = useCallback((guestName?: string) => {
    return collaborators.some(c => 
      (user && c.user_id === user.id) || (!user && guestName && c.guest_name === guestName)
    );
  }, [user, collaborators]);

  return {
    collaborators,
    watchers,
    updateRequests,
    addCollaborator,
    removeCollaborator,
    toggleWatching,
    isWatching,
    requestUpdate,
    resolveRequest,
    joinTask,
    leaveTask,
    isCollaborator,
  };
}
