import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Helper to use orch_flow schema
const orchFlow = () => supabase.schema('orch_flow');

export interface TeamFile {
  id: string;
  name: string;
  path: string;
  content: string | null;
  file_type: string;
  storage_path: string | null;
  size_bytes: number;
  created_by_user_id: string | null;
  created_by_guest: string | null;
  created_at: string;
  updated_at: string;
}

export function useTeamFiles(teamId?: string | null) {
  const { user, profile } = useAuth();
  const [files, setFiles] = useState<TeamFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState('/');

  useEffect(() => {
    const fetchFiles = async () => {
      let query = orchFlow()
        .from('team_files')
        .select('*')
        .order('file_type', { ascending: true })
        .order('name', { ascending: true });

      if (teamId) {
        query = query.eq('team_id', teamId);
      }

      const { data, error } = await query;

      if (!error && data) {
        setFiles(data);
      }
      setLoading(false);
    };

    fetchFiles();

    const channel = supabase
      .channel('team-files-changes')
      .on('postgres_changes', { event: '*', schema: 'orch_flow', table: 'team_files' },
        (payload) => {
          // Only update if it's for our team
          if (teamId && (payload.new as any)?.team_id !== teamId && (payload.old as any)?.team_id !== teamId) {
            return;
          }
          if (payload.eventType === 'INSERT') {
            setFiles(prev => [...prev, payload.new as TeamFile]);
          } else if (payload.eventType === 'UPDATE') {
            setFiles(prev => prev.map(f => f.id === payload.new.id ? payload.new as TeamFile : f));
          } else if (payload.eventType === 'DELETE') {
            setFiles(prev => prev.filter(f => f.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId]);

  const createFile = useCallback(async (name: string, content: string = '', path: string = '/', guestName?: string) => {
    const { data, error } = await orchFlow().from('team_files').insert({
      name,
      content,
      path,
      file_type: 'markdown',
      created_by_user_id: user?.id || null,
      created_by_guest: !user ? guestName || null : null,
      team_id: teamId || null,
    }).select().single();

    if (error) {
      console.error('Error creating file:', error);
      return null;
    }
    return data;
  }, [user, teamId]);

  const createFolder = useCallback(async (name: string, path: string = '/', guestName?: string) => {
    const { data, error } = await orchFlow().from('team_files').insert({
      name,
      path,
      file_type: 'folder',
      created_by_user_id: user?.id || null,
      created_by_guest: !user ? guestName || null : null,
      team_id: teamId || null,
    }).select().single();

    if (error) {
      console.error('Error creating folder:', error);
      return null;
    }
    return data;
  }, [user, teamId]);

  const updateFile = useCallback(async (id: string, updates: { name?: string; content?: string }) => {
    const { error } = await orchFlow()
      .from('team_files')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error updating file:', error);
    }
  }, []);

  const deleteFile = useCallback(async (id: string) => {
    const file = files.find(f => f.id === id);
    
    // Delete from storage if it has a storage path
    if (file?.storage_path) {
      await supabase.storage.from('team-files').remove([file.storage_path]);
    }
    
    const { error } = await orchFlow().from('team_files').delete().eq('id', id);
    if (error) {
      console.error('Error deleting file:', error);
    }
  }, [files]);

  const uploadFile = useCallback(async (file: File, path: string = '/', guestName?: string) => {
    const fileName = `${Date.now()}-${file.name}`;
    const storagePath = `uploads/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('team-files')
      .upload(storagePath, file);

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      return null;
    }

    const { data } = supabase.storage.from('team-files').getPublicUrl(storagePath);

    const { data: fileRecord, error } = await orchFlow().from('team_files').insert({
      name: file.name,
      path,
      file_type: file.type || 'binary',
      storage_path: storagePath,
      size_bytes: file.size,
      created_by_user_id: user?.id || null,
      created_by_guest: !user ? guestName || null : null,
      team_id: teamId || null,
    }).select().single();

    if (error) {
      console.error('Error creating file record:', error);
      return null;
    }

    return { ...fileRecord, publicUrl: data.publicUrl };
  }, [user, teamId]);

  const getFilesInPath = useCallback((path: string) => {
    return files.filter(f => f.path === path);
  }, [files]);

  const getFolders = useCallback(() => {
    return files.filter(f => f.file_type === 'folder');
  }, [files]);

  return {
    files,
    loading,
    currentPath,
    setCurrentPath,
    createFile,
    createFolder,
    updateFile,
    deleteFile,
    uploadFile,
    getFilesInPath,
    getFolders,
  };
}
