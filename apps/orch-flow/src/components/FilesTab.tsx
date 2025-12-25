import { useState, useRef, useEffect } from 'react';
import { useTeamFiles, TeamFile } from '@/hooks/useTeamFiles';
import { useTeamNotes } from '@/hooks/useTeamNotes';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Folder,
  File,
  FileText,
  Plus,
  Upload,
  Trash2,
  ChevronRight,
  Home,
  FolderPlus,
  FilePlus,
  Download,
  Edit,
  Save,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface Profile {
  id: string;
  display_name: string;
}

interface FilesTabProps {
  teamId?: string | null;
}

export function FilesTab({ teamId }: FilesTabProps) {
  const { user, profile } = useAuth();
  const {
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
  } = useTeamFiles(teamId);

  const [selectedFile, setSelectedFile] = useState<TeamFile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [showNewDialog, setShowNewDialog] = useState<'file' | 'folder' | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase.from('profiles').select('id, display_name');
      if (data) setProfiles(data);
    };
    fetchProfiles();
  }, []);

  const getDisplayName = (userId: string | null, guestName: string | null) => {
    if (userId) {
      const p = profiles.find(p => p.id === userId);
      return p?.display_name || 'Unknown';
    }
    return guestName || 'Guest';
  };

  const currentFiles = getFilesInPath(currentPath);
  const folders = currentFiles.filter(f => f.file_type === 'folder');
  const regularFiles = currentFiles.filter(f => f.file_type !== 'folder');

  const handleCreateFile = async () => {
    if (!newItemName.trim()) return;
    const name = newItemName.endsWith('.md') ? newItemName : `${newItemName}.md`;
    await createFile(name, '', currentPath, profile?.display_name);
    setNewItemName('');
    setShowNewDialog(null);
  };

  const handleCreateFolder = async () => {
    if (!newItemName.trim()) return;
    await createFolder(newItemName, currentPath, profile?.display_name);
    setNewItemName('');
    setShowNewDialog(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file, currentPath, profile?.display_name);
    }
  };

  const handleOpenFolder = (folder: TeamFile) => {
    setCurrentPath(currentPath === '/' ? `/${folder.name}` : `${currentPath}/${folder.name}`);
    setSelectedFile(null);
  };

  const handleSelectFile = (file: TeamFile) => {
    setSelectedFile(file);
    setEditContent(file.content || '');
    setIsEditing(false);
  };

  const handleSaveFile = async () => {
    if (selectedFile) {
      await updateFile(selectedFile.id, { content: editContent });
      setIsEditing(false);
    }
  };

  const navigateUp = () => {
    if (currentPath === '/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath(parts.length === 0 ? '/' : `/${parts.join('/')}`);
    setSelectedFile(null);
  };

  const pathParts = currentPath.split('/').filter(Boolean);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading files...</div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-180px)] gap-4">
      {/* File browser sidebar */}
      <div className="w-72 flex-shrink-0 border border-border rounded-lg bg-card flex flex-col">
        {/* Toolbar */}
        <div className="p-3 border-b border-border flex items-center gap-2">
          <Dialog open={showNewDialog === 'file'} onOpenChange={(o) => setShowNewDialog(o ? 'file' : null)}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <FilePlus className="w-4 h-4" />
                File
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New File</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="filename.md"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
                />
                <Button onClick={handleCreateFile} className="w-full">Create</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showNewDialog === 'folder'} onOpenChange={(o) => setShowNewDialog(o ? 'folder' : null)}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <FolderPlus className="w-4 h-4" />
                Folder
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Folder</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="Folder name"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                />
                <Button onClick={handleCreateFolder} className="w-full">Create</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        {/* Breadcrumb */}
        <div className="px-3 py-2 border-b border-border flex items-center gap-1 text-sm">
          <button onClick={() => { setCurrentPath('/'); setSelectedFile(null); }} className="hover:text-primary">
            <Home className="w-4 h-4" />
          </button>
          {pathParts.map((part, i) => (
            <div key={i} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
              <button
                onClick={() => {
                  setCurrentPath(`/${pathParts.slice(0, i + 1).join('/')}`);
                  setSelectedFile(null);
                }}
                className="hover:text-primary truncate max-w-[80px]"
              >
                {part}
              </button>
            </div>
          ))}
        </div>

        {/* File list */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {currentPath !== '/' && (
              <button
                onClick={navigateUp}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary text-sm"
              >
                <Folder className="w-4 h-4 text-muted-foreground" />
                <span>..</span>
              </button>
            )}

            {folders.map((folder) => (
              <ContextMenu key={folder.id}>
                <ContextMenuTrigger>
                  <button
                    onClick={() => handleOpenFolder(folder)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary text-sm"
                  >
                    <Folder className="w-4 h-4 text-yellow-500" />
                    <span className="truncate">{folder.name}</span>
                  </button>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => deleteFile(folder.id)} className="text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}

            {regularFiles.map((file) => (
              <ContextMenu key={file.id}>
                <ContextMenuTrigger>
                  <button
                    onClick={() => handleSelectFile(file)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary text-sm',
                      selectedFile?.id === file.id && 'bg-secondary'
                    )}
                  >
                    {file.file_type === 'markdown' ? (
                      <FileText className="w-4 h-4 text-blue-500" />
                    ) : (
                      <File className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="truncate">{file.name}</span>
                  </button>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => deleteFile(file.id)} className="text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}

            {folders.length === 0 && regularFiles.length === 0 && currentPath === '/' && (
              <div className="text-center text-muted-foreground text-sm py-8">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No files yet</p>
                <p className="text-xs">Create a file or upload one</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* File content area */}
      <div className="flex-1 border border-border rounded-lg bg-card flex flex-col overflow-hidden">
        {selectedFile ? (
          <>
            <div className="p-3 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-medium">{selectedFile.name}</h3>
                <p className="text-xs text-muted-foreground">
                  by {getDisplayName(selectedFile.created_by_user_id, selectedFile.created_by_guest)} · 
                  {formatDistanceToNow(new Date(selectedFile.updated_at), { addSuffix: true })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveFile}>
                      <Save className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {isEditing ? (
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-full resize-none border-0 rounded-none font-mono text-sm"
                  placeholder="Start writing..."
                />
              ) : (
                <ScrollArea className="h-full">
                  <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap font-mono text-sm">{selectedFile.content || 'Empty file'}</pre>
                  </div>
                </ScrollArea>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Select a file to view</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
