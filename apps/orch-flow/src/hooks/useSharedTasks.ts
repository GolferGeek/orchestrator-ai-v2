import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Helper to use orch_flow schema
const orchFlow = () => supabase.schema('orch_flow');

export type TaskStatus = 'projects' | 'this_week' | 'today' | 'in_progress' | 'done';

export interface Task {
  id: string;
  title: string;
  is_completed: boolean;
  assigned_to: string | null;
  user_id: string | null;
  status: TaskStatus;
  created_at: string;
  parent_task_id: string | null;
  pomodoro_count: number;
  project_id: string | null;
  sprint_id: string | null;
  due_date: string | null;
  team_id: string | null;
}

export function useSharedTasks(filterUserId?: string, includeCollaborated?: boolean, filterProjectId?: string | null, teamId?: string | null) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [collaboratedTaskIds, setCollaboratedTaskIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Fetch collaborated task IDs for the user
  useEffect(() => {
    if (!filterUserId || !includeCollaborated) return;

    const fetchCollaboratedTasks = async () => {
      const { data } = await orchFlow()
        .from('task_collaborators')
        .select('task_id')
        .eq('user_id', filterUserId);

      if (data) {
        setCollaboratedTaskIds(new Set(data.map(c => c.task_id)));
      }
    };

    fetchCollaboratedTasks();

    // Subscribe to collaborator changes
    const channel = supabase
      .channel(`user-collaborations-${filterUserId}`)
      .on('postgres_changes', { event: '*', schema: 'orch_flow', table: 'task_collaborators', filter: `user_id=eq.${filterUserId}` },
        () => fetchCollaboratedTasks()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filterUserId, includeCollaborated]);

  // Fetch initial tasks
  useEffect(() => {
    const fetchTasks = async () => {
      let query = orchFlow()
        .from('shared_tasks')
        .select('*')
        .order('created_at', { ascending: false });

      // Filter by team if specified
      if (teamId) {
        query = query.eq('team_id', teamId);
      }

      if (filterUserId && !includeCollaborated) {
        query = query.eq('user_id', filterUserId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching tasks:', error);
      } else {
        setTasks(data || []);
      }
      setLoading(false);
    };

    fetchTasks();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'orch_flow',
          table: 'shared_tasks',
        },
        (payload) => {
          console.log('Task update:', payload);

          if (payload.eventType === 'INSERT') {
            const newTask = payload.new as Task;
            setTasks((prev) => [newTask, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setTasks((prev) =>
              prev.map((task) =>
                task.id === payload.new.id ? (payload.new as Task) : task
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setTasks((prev) =>
              prev.filter((task) => task.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filterUserId, includeCollaborated, teamId]);

  // Filter tasks based on user ownership OR collaboration AND project
  let filteredTasks = filterUserId && includeCollaborated
    ? tasks.filter(t => t.user_id === filterUserId || collaboratedTaskIds.has(t.id))
    : filterUserId
    ? tasks.filter(t => t.user_id === filterUserId)
    : tasks;

  // Further filter by project if specified
  if (filterProjectId !== undefined && filterProjectId !== null) {
    filteredTasks = filteredTasks.filter(t => t.project_id === filterProjectId);
  }

  // Get shared pool tasks (no user assigned)
  const sharedPoolTasks = tasks.filter(t => !t.user_id && (filterProjectId === undefined || filterProjectId === null || t.project_id === filterProjectId));

  const addTask = useCallback(async (title: string, status: TaskStatus = 'today', assignedTo?: string, userId?: string, parentTaskId?: string, projectId?: string | null, sprintId?: string | null, taskTeamId?: string | null) => {
    const isCompleted = status === 'done';
    const { error } = await orchFlow().from('shared_tasks').insert({
      title,
      status,
      is_completed: isCompleted,
      assigned_to: assignedTo || null,
      user_id: userId || null,
      parent_task_id: parentTaskId || null,
      pomodoro_count: 0,
      project_id: projectId || null,
      sprint_id: sprintId || null,
      team_id: taskTeamId || teamId || null,
    });

    if (error) {
      console.error('Error adding task:', error);
    }
  }, [teamId]);

  const updateTaskStatus = useCallback(async (id: string, status: TaskStatus) => {
    const isCompleted = status === 'done';
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status, is_completed: isCompleted } : t));

    const { error } = await orchFlow()
      .from('shared_tasks')
      .update({
        status,
        is_completed: isCompleted,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating task status:', error);
    }
  }, []);

  const toggleTask = useCallback(async (id: string, isCompleted: boolean) => {
    const newStatus = !isCompleted ? 'done' : 'today';
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === id ? { ...t, is_completed: !isCompleted, status: newStatus } : t));

    const { error } = await orchFlow()
      .from('shared_tasks')
      .update({
        is_completed: !isCompleted,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error toggling task:', error);
    }
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    // Optimistic update
    setTasks(prev => prev.filter(t => t.id !== id));

    const { error } = await orchFlow().from('shared_tasks').delete().eq('id', id);

    if (error) {
      console.error('Error deleting task:', error);
    }
  }, []);

  const assignTask = useCallback(async (id: string, userId: string | null, assignedTo: string | null) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === id ? { ...t, user_id: userId, assigned_to: assignedTo } : t));

    const { error } = await orchFlow()
      .from('shared_tasks')
      .update({
        user_id: userId,
        assigned_to: assignedTo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error assigning task:', error);
    }
  }, []);

  const incrementPomodoro = useCallback(async (id: string) => {
    const task = tasks.find(t => t.id === id);
    const newCount = (task?.pomodoro_count || 0) + 1;
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === id ? { ...t, pomodoro_count: newCount } : t));

    const { error } = await orchFlow()
      .from('shared_tasks')
      .update({
        pomodoro_count: newCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error incrementing pomodoro:', error);
    }
  }, [tasks]);

  const updateTaskSprint = useCallback(async (id: string, sprintId: string | null) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === id ? { ...t, sprint_id: sprintId } : t));

    const { error } = await orchFlow()
      .from('shared_tasks')
      .update({
        sprint_id: sprintId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating task sprint:', error);
    }
  }, []);

  const updateTaskDueDate = useCallback(async (id: string, dueDate: string | null) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === id ? { ...t, due_date: dueDate } : t));

    const { error } = await orchFlow()
      .from('shared_tasks')
      .update({
        due_date: dueDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating task due date:', error);
    }
  }, []);

  return {
    tasks: filteredTasks,
    allTasks: tasks,
    sharedPoolTasks,
    collaboratedTaskIds,
    loading,
    addTask,
    updateTaskStatus,
    toggleTask,
    deleteTask,
    assignTask,
    incrementPomodoro,
    updateTaskSprint,
    updateTaskDueDate,
  };
}
