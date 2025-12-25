import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  CollisionDetection,
  getFirstCollision,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSharedTasks, Task, TaskStatus } from '@/hooks/useSharedTasks';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useSharedTimer } from '@/hooks/useSharedTimer';
import { useSprints } from '@/hooks/useSprints';
import { supabase } from '@/integrations/supabase/client';
import { KanbanColumn } from './KanbanColumn';
import { SprintColumn } from './SprintColumn';
import { KanbanCard } from './KanbanCard';
import { TaskDetailDialog } from './TaskDetailDialog';
import { HierarchySidebar } from './HierarchySidebar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Users } from 'lucide-react';

const COLUMNS: { id: TaskStatus | 'sprint'; title: string }[] = [
  { id: 'this_week', title: 'This Week' },
  { id: 'today', title: 'Today' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'done', title: 'Done' },
];

interface KanbanBoardProps {
  userId?: string;
  userName?: string;
  teamId?: string | null;
}

// Column IDs for collision detection
const ALL_COLUMN_IDS = ['this_week', 'today', 'in_progress', 'done', 'sprint'];

// Custom collision detection that prioritizes columns over tasks
const customCollisionDetection: CollisionDetection = (args) => {
  // Get all collisions using multiple strategies
  const pointerCollisions = pointerWithin(args);
  const rectCollisions = rectIntersection(args);
  const allCollisions = [...pointerCollisions, ...rectCollisions];
  
  // First priority: find any column collision
  for (const collision of allCollisions) {
    if (ALL_COLUMN_IDS.includes(String(collision.id))) {
      return [collision];
    }
  }
  
  // Second priority: return any collision found
  if (allCollisions.length > 0) {
    return [allCollisions[0]];
  }
  
  // Fallback to closest center
  return closestCenter(args);
};

export function KanbanBoard({ userId, userName, teamId }: KanbanBoardProps) {
  const { user, profile } = useAuth();
  const isOwnBoard = !userId || userId === user?.id;
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [hierarchyCollapsed, setHierarchyCollapsed] = useState(false);
  const { tasks, allTasks, sharedPoolTasks, collaboratedTaskIds, loading, addTask, updateTaskStatus, deleteTask, toggleTask, assignTask, incrementPomodoro, updateTaskSprint, updateTaskDueDate } = useSharedTasks(userId, true, selectedProjectId, teamId);
  const { activeSprint } = useSprints(teamId);
  const { createNotification } = useNotifications();
  
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showSharedPool, setShowSharedPool] = useState(false);
  const [collaboratorCounts, setCollaboratorCounts] = useState<Record<string, number>>({});
  const [newTaskInputs, setNewTaskInputs] = useState<Record<string, string>>({
    projects: '',
    this_week: '',
    today: '',
    in_progress: '',
    sprint: '',
    done: '',
  });
  const [sharedPoolInput, setSharedPoolInput] = useState('');

  // Track pomodoro on in_progress tasks when timer completes
  const handleTimerComplete = useCallback(() => {
    // Find all in_progress tasks for this user
    const inProgressTasks = tasks.filter(t => 
      t.status === 'in_progress' && 
      !t.parent_task_id &&
      (t.user_id === user?.id || collaboratedTaskIds.has(t.id))
    );
    
    // Increment pomodoro for all in_progress tasks
    inProgressTasks.forEach(task => {
      incrementPomodoro(task.id);
    });
  }, [tasks, user?.id, collaboratedTaskIds, incrementPomodoro]);

  // Use shared timer with callback
  useSharedTimer(handleTimerComplete);

  // Fetch collaborator counts
  useEffect(() => {
    const fetchCollaboratorCounts = async () => {
      const { data } = await supabase
        .from('task_collaborators')
        .select('task_id');
      
      if (data) {
        const counts: Record<string, number> = {};
        data.forEach(c => {
          counts[c.task_id] = (counts[c.task_id] || 0) + 1;
        });
        setCollaboratorCounts(counts);
      }
    };
    
    fetchCollaboratorCounts();
    
    const channel = supabase
      .channel('collaborator-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_collaborators' },
        () => fetchCollaboratorCounts()
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Only show root tasks (no parent) in columns
  const tasksByColumn = useMemo(() => {
    const grouped: Record<string, Task[]> = {
      projects: [],
      this_week: [],
      today: [],
      in_progress: [],
      sprint: [],
      done: [],
    };
    
    tasks
      .filter(task => !task.parent_task_id) // Only root tasks
      .forEach((task) => {
        // If task has sprint_id, show in sprint column (unless done)
        if (task.sprint_id && task.status !== 'done') {
          grouped.sprint.push(task);
        } else if (grouped[task.status]) {
          grouped[task.status].push(task);
        }
      });
    
    return grouped;
  }, [tasks]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // Check if dropped on sprint column
    if (overId === 'sprint') {
      if (activeSprint) {
        updateTaskSprint(taskId, activeSprint.id);
      }
      return;
    }

    // Check if dropped on a regular column
    const targetColumn = COLUMNS.find((col) => col.id === overId);
    if (targetColumn) {
      // Moving to regular column - remove from sprint and update status
      updateTaskSprint(taskId, null);
      updateTaskStatus(taskId, targetColumn.id as TaskStatus);
      return;
    }

    // Check if dropped on another task
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask) {
      // Check which column the target task is in
      if (overTask.sprint_id && overTask.status !== 'done') {
        if (activeSprint) {
          updateTaskSprint(taskId, activeSprint.id);
        }
      } else {
        updateTaskSprint(taskId, null);
        updateTaskStatus(taskId, overTask.status);
      }
    }
  };

  const handleAddTask = (status: TaskStatus) => {
    const title = newTaskInputs[status].trim();
    if (!title) return;
    
    addTask(title, status, profile?.display_name, user?.id, undefined, selectedProjectId);
    setNewTaskInputs((prev) => ({ ...prev, [status]: '' }));
  };

  const handleAddSharedTask = (status: TaskStatus) => {
    const title = sharedPoolInput.trim();
    if (!title) return;
    
    // Add task without user_id (shared pool)
    addTask(title, status, undefined, undefined, undefined, selectedProjectId);
    setSharedPoolInput('');
  };

  const handleAddSprintTask = (title: string) => {
    if (!activeSprint) return;
    addTask(title, 'in_progress', profile?.display_name, user?.id, undefined, selectedProjectId, activeSprint.id);
  };

  const handleAddSubtask = (parentId: string, title: string) => {
    const parentTask = tasks.find(t => t.id === parentId) || sharedPoolTasks.find(t => t.id === parentId);
    addTask(title, parentTask?.status || 'today', profile?.display_name, user?.id, parentId, parentTask?.project_id);
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setDialogOpen(true);
  };

  // Shared pool tasks grouped by status
  const sharedPoolByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      projects: [],
      this_week: [],
      today: [],
      in_progress: [],
      done: [],
    };
    
    sharedPoolTasks
      .filter(task => !task.parent_task_id)
      .forEach((task) => {
        if (grouped[task.status]) {
          grouped[task.status].push(task);
        }
      });
    
    return grouped;
  }, [sharedPoolTasks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      <HierarchySidebar 
        selectedProjectId={selectedProjectId} 
        onSelectProject={setSelectedProjectId}
        collapsed={hierarchyCollapsed}
        onToggleCollapse={() => setHierarchyCollapsed(!hierarchyCollapsed)}
        teamId={teamId}
      />
      <div className="flex-1 px-4 overflow-hidden flex flex-col">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {isOwnBoard ? 'My Tasks' : `${userName}'s Tasks`}
              {collaboratedTaskIds.size > 0 && (
                <Badge variant="secondary" className="ml-2">
                  +{collaboratedTaskIds.size} collaborated
                </Badge>
              )}
            </h2>
            <p className="text-sm text-muted-foreground">
              Drag tasks between columns to update their status
            </p>
          </div>
          <Button
            variant={showSharedPool ? "default" : "outline"}
            size="sm"
            onClick={() => setShowSharedPool(!showSharedPool)}
          >
            <Users className="w-4 h-4 mr-2" />
            Shared Pool ({sharedPoolTasks.filter(t => !t.parent_task_id).length})
          </Button>
        </div>

        {/* Shared Pool Section */}
        {showSharedPool && (
          <div className="mb-4 p-4 bg-secondary/30 rounded-lg border border-border">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Shared Pool - Unassigned Tasks
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Tasks anyone can pick up. Click a task to assign it to yourself.
            </p>
            
            {/* Add shared task input */}
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Add shared task..."
                value={sharedPoolInput}
                onChange={(e) => setSharedPoolInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddSharedTask('today');
                  }
                }}
                className="h-8 text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAddSharedTask('today')}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2">
              {COLUMNS.map((column) => {
                const columnTasks = sharedPoolByStatus[column.id];
                if (columnTasks.length === 0) return null;
                
                return (
                  <div key={column.id} className="min-w-[180px]">
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      {column.title} ({columnTasks.length})
                    </div>
                    <div className="space-y-1">
                      {columnTasks.map((task) => (
                        <button
                          key={task.id}
                          onClick={() => handleTaskClick(task)}
                          className="w-full text-left p-2 bg-background rounded border border-border hover:border-primary text-sm transition-colors"
                        >
                          <div className="truncate">{task.title}</div>
                          {task.pomodoro_count > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              🍅 {task.pomodoro_count}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {sharedPoolTasks.filter(t => !t.parent_task_id).length === 0 && (
                <div className="text-sm text-muted-foreground py-4 text-center w-full">
                  No shared tasks yet. Add one above!
                </div>
              )}
            </div>
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={customCollisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
            {/* Sprint Column - First */}
            <SprintColumn 
              taskCount={tasksByColumn.sprint?.length || 0}
              onAddTask={handleAddSprintTask}
              isOwnBoard={isOwnBoard}
            >
              <SortableContext
                items={(tasksByColumn.sprint || []).map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2 min-h-[100px]">
                  {(tasksByColumn.sprint || []).map((task) => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      onDelete={deleteTask}
                      onToggle={toggleTask}
                      isOwnBoard={isOwnBoard}
                      onClick={() => handleTaskClick(task)}
                      subtaskCount={tasks.filter(t => t.parent_task_id === task.id).length}
                      collaboratorCount={collaboratorCounts[task.id] || 0}
                      isCollaborated={collaboratedTaskIds.has(task.id)}
                      subtasks={tasks.filter(t => t.parent_task_id === task.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </SprintColumn>

            {/* Regular columns */}
            {COLUMNS.filter(c => c.id !== 'done').map((column) => (
              <KanbanColumn
                key={column.id}
                id={column.id}
                title={column.title}
                taskCount={tasksByColumn[column.id]?.length || 0}
              >
                {isOwnBoard && (
                  <div className="mb-3 pb-3 border-b border-border">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add task..."
                        value={newTaskInputs[column.id] || ''}
                        onChange={(e) =>
                          setNewTaskInputs((prev) => ({
                            ...prev,
                            [column.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddTask(column.id as TaskStatus);
                          }
                        }}
                        className="h-8 text-sm"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0"
                        onClick={() => handleAddTask(column.id as TaskStatus)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                <SortableContext
                  items={(tasksByColumn[column.id] || []).map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2 min-h-[100px]">
                    {(tasksByColumn[column.id] || []).map((task) => (
                      <KanbanCard
                        key={task.id}
                        task={task}
                        onDelete={deleteTask}
                        onToggle={toggleTask}
                        isOwnBoard={isOwnBoard}
                        onClick={() => handleTaskClick(task)}
                        subtaskCount={tasks.filter(t => t.parent_task_id === task.id).length}
                        collaboratorCount={collaboratorCounts[task.id] || 0}
                        isCollaborated={collaboratedTaskIds.has(task.id)}
                        subtasks={tasks.filter(t => t.parent_task_id === task.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </KanbanColumn>
            ))}

            {/* Done Column */}
            <KanbanColumn
              id="done"
              title="Done"
              taskCount={tasksByColumn.done?.length || 0}
            >
              <SortableContext
                items={(tasksByColumn.done || []).map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2 min-h-[100px]">
                  {(tasksByColumn.done || []).map((task) => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      onDelete={deleteTask}
                      onToggle={toggleTask}
                      isOwnBoard={isOwnBoard}
                      onClick={() => handleTaskClick(task)}
                      subtaskCount={tasks.filter(t => t.parent_task_id === task.id).length}
                      collaboratorCount={collaboratorCounts[task.id] || 0}
                      isCollaborated={collaboratedTaskIds.has(task.id)}
                      subtasks={tasks.filter(t => t.parent_task_id === task.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </KanbanColumn>
          </div>

          <DragOverlay>
            {activeTask && (
              <KanbanCard task={activeTask} onDelete={() => {}} isOverlay />
            )}
          </DragOverlay>
        </DndContext>

        <TaskDetailDialog
          task={selectedTask}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onAddSubtask={handleAddSubtask}
          onToggleTask={toggleTask}
          onDeleteTask={deleteTask}
          subtasks={[...tasks, ...sharedPoolTasks].filter(t => t.parent_task_id)}
          onAssignTask={assignTask}
          onUpdateDueDate={updateTaskDueDate}
        />
      </div>
    </div>
  );
}
