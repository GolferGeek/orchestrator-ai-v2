import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Types matching the orch_flow schema
export interface Effort {
  id: string;
  organization_slug: string;
  name: string;
  description: string | null;
  status: 'not_started' | 'in_progress' | 'completed';
  order_index: number;
  icon: string | null;
  color: string | null;
  estimated_days: number | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  effort_id: string;
  name: string;
  description: string | null;
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'skipped';
  assignee_id: string | null;
  due_date: string | null;
  order_index: number;
  documentation_url: string | null;
  is_milestone: boolean;
  created_at: string;
  updated_at: string;
}

// Helper to get orch_flow schema client
const orchFlowSchema = () => supabase.schema('orch_flow');

export function useOrchFlow() {
  const { user } = useAuth();
  const [efforts, setEfforts] = useState<Effort[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all efforts for the user's organization
  const fetchEfforts = useCallback(async () => {
    if (!user) return;

    const { data, error } = await orchFlowSchema()
      .from('efforts')
      .select('*')
      .order('order_index');

    if (error) {
      console.error('Error fetching efforts:', error);
      setError(error.message);
    } else {
      setEfforts(data || []);
    }
  }, [user]);

  // Fetch projects for a specific effort
  const fetchProjects = useCallback(async (effortId?: string) => {
    if (!user) return;

    let query = orchFlowSchema()
      .from('projects')
      .select('*')
      .order('order_index');

    if (effortId) {
      query = query.eq('effort_id', effortId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching projects:', error);
      setError(error.message);
    } else {
      setProjects(data || []);
    }
  }, [user]);

  // Fetch tasks for a specific project
  const fetchTasks = useCallback(async (projectId?: string) => {
    if (!user) return;

    let query = orchFlowSchema()
      .from('tasks')
      .select('*')
      .order('order_index');

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching tasks:', error);
      setError(error.message);
    } else {
      setTasks(data || []);
    }
  }, [user]);

  // Fetch all data
  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchEfforts(), fetchProjects(), fetchTasks()]);
    setLoading(false);
  }, [fetchEfforts, fetchProjects, fetchTasks]);

  // CRUD for Efforts
  const createEffort = async (effort: Omit<Effort, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await orchFlowSchema()
      .from('efforts')
      .insert(effort)
      .select()
      .single();

    if (error) {
      console.error('Error creating effort:', error);
      throw error;
    }
    await fetchEfforts();
    return data;
  };

  const updateEffort = async (id: string, updates: Partial<Effort>) => {
    const { error } = await orchFlowSchema()
      .from('efforts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error updating effort:', error);
      throw error;
    }
    await fetchEfforts();
  };

  const deleteEffort = async (id: string) => {
    const { error } = await orchFlowSchema()
      .from('efforts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting effort:', error);
      throw error;
    }
    await fetchEfforts();
  };

  // CRUD for Projects
  const createProject = async (project: Omit<Project, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await orchFlowSchema()
      .from('projects')
      .insert(project)
      .select()
      .single();

    if (error) {
      console.error('Error creating project:', error);
      throw error;
    }
    await fetchProjects();
    return data;
  };

  const updateProject = async (id: string, updates: Partial<Project>) => {
    const { error } = await orchFlowSchema()
      .from('projects')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error updating project:', error);
      throw error;
    }
    await fetchProjects();
  };

  const deleteProject = async (id: string) => {
    const { error } = await orchFlowSchema()
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
    await fetchProjects();
  };

  // CRUD for Tasks
  const createTask = async (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await orchFlowSchema()
      .from('tasks')
      .insert(task)
      .select()
      .single();

    if (error) {
      console.error('Error creating task:', error);
      throw error;
    }
    await fetchTasks();
    return data;
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    const { error } = await orchFlowSchema()
      .from('tasks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error updating task:', error);
      throw error;
    }
    await fetchTasks();
  };

  const deleteTask = async (id: string) => {
    const { error } = await orchFlowSchema()
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
    await fetchTasks();
  };

  // Update task status (common operation)
  const updateTaskStatus = async (id: string, status: Task['status']) => {
    await updateTask(id, { status });
  };

  // Load data on mount
  useEffect(() => {
    if (user) {
      fetchAll();
    }
  }, [user, fetchAll]);

  return {
    // Data
    efforts,
    projects,
    tasks,
    loading,
    error,

    // Fetch functions
    fetchEfforts,
    fetchProjects,
    fetchTasks,
    fetchAll,

    // Effort CRUD
    createEffort,
    updateEffort,
    deleteEffort,

    // Project CRUD
    createProject,
    updateProject,
    deleteProject,

    // Task CRUD
    createTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
  };
}
