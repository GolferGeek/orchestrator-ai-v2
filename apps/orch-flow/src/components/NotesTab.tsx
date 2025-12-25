import { useState, useEffect } from 'react';
import { useTeamNotes, TeamNote } from '@/hooks/useTeamNotes';
import { useTeamFiles } from '@/hooks/useTeamFiles';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Pin,
  PinOff,
  Trash2,
  Save,
  FileDown,
  MoreVertical,
  StickyNote,
  Edit,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface Profile {
  id: string;
  display_name: string;
}

interface NotesTabProps {
  teamId?: string | null;
}

export function NotesTab({ teamId }: NotesTabProps) {
  const { user, profile } = useAuth();
  const { notes, loading, createNote, updateNote, deleteNote, togglePin } = useTeamNotes(teamId);
  const { createFile } = useTeamFiles(teamId);
  const [selectedNote, setSelectedNote] = useState<TeamNote | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);

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

  const handleCreateNote = async () => {
    const newNote = await createNote('Untitled Note', '', profile?.display_name);
    if (newNote) {
      setSelectedNote(newNote);
      setEditTitle(newNote.title);
      setEditContent(newNote.content || '');
      setIsEditing(true);
    }
  };

  const handleSelectNote = (note: TeamNote) => {
    // Save current note if editing
    if (isEditing && selectedNote) {
      handleSaveNote();
    }
    setSelectedNote(note);
    setEditTitle(note.title);
    setEditContent(note.content || '');
    setIsEditing(false);
  };

  const handleSaveNote = async () => {
    if (selectedNote) {
      await updateNote(selectedNote.id, { title: editTitle, content: editContent });
      setIsEditing(false);
    }
  };

  const handleSaveAsFile = async () => {
    if (selectedNote) {
      const fileName = `${selectedNote.title.replace(/[^a-zA-Z0-9]/g, '-')}.md`;
      await createFile(fileName, selectedNote.content || '', '/', profile?.display_name);
      toast.success('Note saved as file');
    }
  };

  const handleDeleteNote = async (id: string) => {
    await deleteNote(id);
    if (selectedNote?.id === id) {
      setSelectedNote(null);
    }
  };

  const pinnedNotes = notes.filter(n => n.is_pinned);
  const unpinnedNotes = notes.filter(n => !n.is_pinned);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading notes...</div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-180px)] gap-4">
      {/* Notes list */}
      <div className="w-72 flex-shrink-0 border border-border rounded-lg bg-card flex flex-col">
        <div className="p-3 border-b border-border">
          <Button onClick={handleCreateNote} className="w-full gap-2">
            <Plus className="w-4 h-4" />
            New Note
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {pinnedNotes.length > 0 && (
              <>
                <p className="text-xs font-medium text-muted-foreground px-2 py-1">Pinned</p>
                {pinnedNotes.map((note) => (
                  <NoteItem
                    key={note.id}
                    note={note}
                    isSelected={selectedNote?.id === note.id}
                    onSelect={handleSelectNote}
                    onDelete={handleDeleteNote}
                    onTogglePin={togglePin}
                    getDisplayName={getDisplayName}
                  />
                ))}
                {unpinnedNotes.length > 0 && <div className="py-1" />}
              </>
            )}

            {unpinnedNotes.length > 0 && (
              <>
                {pinnedNotes.length > 0 && (
                  <p className="text-xs font-medium text-muted-foreground px-2 py-1">Others</p>
                )}
                {unpinnedNotes.map((note) => (
                  <NoteItem
                    key={note.id}
                    note={note}
                    isSelected={selectedNote?.id === note.id}
                    onSelect={handleSelectNote}
                    onDelete={handleDeleteNote}
                    onTogglePin={togglePin}
                    getDisplayName={getDisplayName}
                  />
                ))}
              </>
            )}

            {notes.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8">
                <StickyNote className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No notes yet</p>
                <p className="text-xs">Create a note to get started</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Note editor */}
      <div className="flex-1 border border-border rounded-lg bg-card flex flex-col overflow-hidden">
        {selectedNote ? (
          <>
            <div className="p-3 border-b border-border flex items-center justify-between gap-4">
              {isEditing ? (
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="font-medium text-lg h-auto py-1 border-0 bg-transparent focus-visible:ring-0 px-0"
                  placeholder="Note title..."
                />
              ) : (
                <h3 className="font-medium text-lg truncate">{selectedNote.title}</h3>
              )}
              <div className="flex items-center gap-2 flex-shrink-0">
                {isEditing ? (
                  <Button size="sm" onClick={handleSaveNote}>
                    <Save className="w-4 h-4 mr-1" />
                    Save
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleSaveAsFile}>
                      <FileDown className="w-4 h-4 mr-2" />
                      Save as File
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => togglePin(selectedNote.id, selectedNote.is_pinned)}>
                      {selectedNote.is_pinned ? (
                        <>
                          <PinOff className="w-4 h-4 mr-2" />
                          Unpin
                        </>
                      ) : (
                        <>
                          <Pin className="w-4 h-4 mr-2" />
                          Pin
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDeleteNote(selectedNote.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="px-3 py-1 text-xs text-muted-foreground border-b border-border">
              by {getDisplayName(selectedNote.created_by_user_id, selectedNote.created_by_guest)} · 
              {formatDistanceToNow(new Date(selectedNote.updated_at), { addSuffix: true })}
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
                  <div className="p-4">
                    <pre className="whitespace-pre-wrap font-mono text-sm">{selectedNote.content || 'Empty note'}</pre>
                  </div>
                </ScrollArea>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <StickyNote className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Select a note or create a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NoteItem({
  note,
  isSelected,
  onSelect,
  onDelete,
  onTogglePin,
  getDisplayName,
}: {
  note: TeamNote;
  isSelected: boolean;
  onSelect: (note: TeamNote) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, isPinned: boolean) => void;
  getDisplayName: (userId: string | null, guestName: string | null) => string;
}) {
  return (
    <div
      onClick={() => onSelect(note)}
      className={cn(
        'group px-3 py-2 rounded-lg cursor-pointer transition-colors',
        isSelected ? 'bg-primary/10' : 'hover:bg-secondary'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            {note.is_pinned && <Pin className="w-3 h-3 text-primary flex-shrink-0" />}
            <p className="font-medium text-sm truncate">{note.title}</p>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {note.content?.slice(0, 50) || 'Empty note'}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTogglePin(note.id, note.is_pinned); }}>
              {note.is_pinned ? (
                <>
                  <PinOff className="w-4 h-4 mr-2" />
                  Unpin
                </>
              ) : (
                <>
                  <Pin className="w-4 h-4 mr-2" />
                  Pin
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
              className="text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
