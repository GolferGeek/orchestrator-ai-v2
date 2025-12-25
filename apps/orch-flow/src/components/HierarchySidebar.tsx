import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Plus, Pencil, Trash2, FolderKanban, Target, Rocket, Check, X, PanelLeftClose, PanelLeft } from 'lucide-react';
import { useHierarchy, Effort, Goal, Project } from '@/hooks/useHierarchy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface HierarchySidebarProps {
  selectedProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  teamId?: string | null;
}

export function HierarchySidebar({ selectedProjectId, onSelectProject, collapsed = false, onToggleCollapse, teamId }: HierarchySidebarProps) {
  const {
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
  } = useHierarchy(teamId);

  const [expandedEfforts, setExpandedEfforts] = useState<Set<string>>(new Set());
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  
  // Auto-expand first effort/goal on initial load
  useEffect(() => {
    if (!loading && efforts.length > 0 && !initialized) {
      const firstEffort = efforts[0];
      const firstGoal = goals.find(g => g.effort_id === firstEffort.id);
      setExpandedEfforts(new Set([firstEffort.id]));
      if (firstGoal) {
        setExpandedGoals(new Set([firstGoal.id]));
      }
      setInitialized(true);
    }
  }, [loading, efforts, goals, initialized]);
  
  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [addingTo, setAddingTo] = useState<{ type: 'effort' | 'goal' | 'project'; parentId?: string } | null>(null);
  const [newItemName, setNewItemName] = useState('');

  const toggleEffort = (id: string) => {
    setExpandedEfforts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGoal = (id: string) => {
    setExpandedGoals(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStartEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingValue(currentName);
  };

  const handleSaveEdit = async (type: 'effort' | 'goal' | 'project') => {
    if (!editingId || !editingValue.trim()) return;
    
    if (type === 'effort') await updateEffort(editingId, editingValue.trim());
    else if (type === 'goal') await updateGoal(editingId, editingValue.trim());
    else await updateProject(editingId, editingValue.trim());
    
    setEditingId(null);
    setEditingValue('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingValue('');
  };

  const handleAdd = async () => {
    if (!addingTo || !newItemName.trim()) return;

    if (addingTo.type === 'effort') {
      const { data } = await addEffort(newItemName.trim());
      if (data) setExpandedEfforts(prev => new Set([...prev, data.id]));
    } else if (addingTo.type === 'goal' && addingTo.parentId) {
      const { data } = await addGoal(addingTo.parentId, newItemName.trim());
      if (data) {
        setExpandedEfforts(prev => new Set([...prev, addingTo.parentId!]));
        setExpandedGoals(prev => new Set([...prev, data.id]));
      }
    } else if (addingTo.type === 'project' && addingTo.parentId) {
      await addProject(addingTo.parentId, newItemName.trim());
      setExpandedGoals(prev => new Set([...prev, addingTo.parentId!]));
    }

    setAddingTo(null);
    setNewItemName('');
  };

  const handleDelete = async (type: 'effort' | 'goal' | 'project', id: string) => {
    if (type === 'effort') await deleteEffort(id);
    else if (type === 'goal') await deleteGoal(id);
    else {
      await deleteProject(id);
      if (selectedProjectId === id) onSelectProject(null);
    }
  };

  if (loading) {
    return (
      <div className={cn("border-r border-border bg-card p-4 transition-all", collapsed ? "w-12" : "w-64")}>
        <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="w-12 border-r border-border bg-card flex flex-col h-full">
        <div className="p-2 border-b border-border flex justify-center">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleCollapse}>
            <PanelLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 border-r border-border bg-card flex flex-col h-full">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-sm">Hierarchy</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setAddingTo({ type: 'effort' })}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleCollapse}>
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* Add new effort input */}
          {addingTo?.type === 'effort' && !addingTo.parentId && (
            <div className="flex items-center gap-1 mb-2 pl-2">
              <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Effort name..."
                className="h-7 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd();
                  if (e.key === 'Escape') setAddingTo(null);
                }}
              />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleAdd}>
                <Check className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAddingTo(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {efforts.map((effort) => (
            <div key={effort.id} className="mb-1">
              {/* Effort row */}
              <div className="flex items-center group">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => toggleEffort(effort.id)}
                >
                  {expandedEfforts.has(effort.id) ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </Button>

                {editingId === effort.id ? (
                  <div className="flex items-center gap-1 flex-1">
                    <Input
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      className="h-6 text-xs"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit('effort');
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                    />
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleSaveEdit('effort')}>
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCancelEdit}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Rocket className="h-3 w-3 mr-1.5 text-accent shrink-0" />
                    <span className="text-sm truncate flex-1">{effort.name}</span>
                    <div className="hidden group-hover:flex items-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setAddingTo({ type: 'goal', parentId: effort.id })}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleStartEdit(effort.id, effort.name)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => handleDelete('effort', effort.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {/* Goals under effort */}
              {expandedEfforts.has(effort.id) && (
                <div className="ml-4 border-l border-border pl-2">
                  {/* Add goal input */}
                  {addingTo?.type === 'goal' && addingTo.parentId === effort.id && (
                    <div className="flex items-center gap-1 my-1">
                      <Input
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        placeholder="Goal name..."
                        className="h-6 text-xs"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAdd();
                          if (e.key === 'Escape') setAddingTo(null);
                        }}
                      />
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleAdd}>
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAddingTo(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}

                  {goals
                    .filter((g) => g.effort_id === effort.id)
                    .map((goal) => (
                      <div key={goal.id} className="mb-1">
                        {/* Goal row */}
                        <div className="flex items-center group">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => toggleGoal(goal.id)}
                          >
                            {expandedGoals.has(goal.id) ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                          </Button>

                          {editingId === goal.id ? (
                            <div className="flex items-center gap-1 flex-1">
                              <Input
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                className="h-6 text-xs"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEdit('goal');
                                  if (e.key === 'Escape') handleCancelEdit();
                                }}
                              />
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleSaveEdit('goal')}>
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCancelEdit}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <Target className="h-3 w-3 mr-1.5 text-primary shrink-0" />
                              <span className="text-sm truncate flex-1">{goal.name}</span>
                              <div className="hidden group-hover:flex items-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => setAddingTo({ type: 'project', parentId: goal.id })}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => handleStartEdit(goal.id, goal.name)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive"
                                  onClick={() => handleDelete('goal', goal.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Projects under goal */}
                        {expandedGoals.has(goal.id) && (
                          <div className="ml-4 border-l border-border pl-2">
                            {/* Add project input */}
                            {addingTo?.type === 'project' && addingTo.parentId === goal.id && (
                              <div className="flex items-center gap-1 my-1">
                                <Input
                                  value={newItemName}
                                  onChange={(e) => setNewItemName(e.target.value)}
                                  placeholder="Project name..."
                                  className="h-6 text-xs"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAdd();
                                    if (e.key === 'Escape') setAddingTo(null);
                                  }}
                                />
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleAdd}>
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAddingTo(null)}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            )}

                            {projects
                              .filter((p) => p.goal_id === goal.id)
                              .map((project) => (
                                <div key={project.id} className="flex items-center group py-0.5">
                                  {editingId === project.id ? (
                                    <div className="flex items-center gap-1 flex-1 ml-6">
                                      <Input
                                        value={editingValue}
                                        onChange={(e) => setEditingValue(e.target.value)}
                                        className="h-6 text-xs"
                                        autoFocus
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleSaveEdit('project');
                                          if (e.key === 'Escape') handleCancelEdit();
                                        }}
                                      />
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleSaveEdit('project')}>
                                        <Check className="h-3 w-3" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCancelEdit}>
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <button
                                      className={cn(
                                        "flex items-center flex-1 px-2 py-1 rounded text-sm hover:bg-secondary/50 transition-colors",
                                        selectedProjectId === project.id && "bg-primary/10 text-primary font-medium"
                                      )}
                                      onClick={() => onSelectProject(project.id)}
                                    >
                                      <FolderKanban className="h-3 w-3 mr-1.5 shrink-0" />
                                      <span className="truncate">{project.name}</span>
                                    </button>
                                  )}
                                  {editingId !== project.id && (
                                    <div className="hidden group-hover:flex items-center">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => handleStartEdit(project.id, project.name)}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-destructive"
                                        onClick={() => handleDelete('project', project.id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              ))}

                            {projects.filter((p) => p.goal_id === goal.id).length === 0 &&
                              addingTo?.parentId !== goal.id && (
                                <div className="text-xs text-muted-foreground py-1 pl-6">No projects</div>
                              )}
                          </div>
                        )}
                      </div>
                    ))}

                  {goals.filter((g) => g.effort_id === effort.id).length === 0 &&
                    addingTo?.parentId !== effort.id && (
                      <div className="text-xs text-muted-foreground py-1">No goals</div>
                    )}
                </div>
              )}
            </div>
          ))}

          {efforts.length === 0 && !addingTo && (
            <div className="text-sm text-muted-foreground text-center py-4">
              No efforts yet. Click + to add one.
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Show all tasks button */}
      <div className="p-2 border-t border-border">
        <Button
          variant={selectedProjectId === null ? "default" : "outline"}
          size="sm"
          className="w-full"
          onClick={() => onSelectProject(null)}
        >
          Show All Tasks
        </Button>
      </div>
    </div>
  );
}
