import { useState, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';
import { useSprints } from '@/hooks/useSprints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Plus } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

interface SprintColumnProps {
  taskCount: number;
  children: ReactNode;
  onAddTask?: (title: string) => void;
  isOwnBoard?: boolean;
}

export function SprintColumn({ taskCount, children, onAddTask, isOwnBoard = true }: SprintColumnProps) {
  const { activeSprint, createSprint, updateSprint, loading } = useSprints();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [hasAutoCreated, setHasAutoCreated] = useState(false);

  const { setNodeRef, isOver, active } = useDroppable({
    id: 'sprint',
    data: {
      type: 'column',
      columnId: 'sprint',
    },
  });

  // Auto-create a default sprint if none exists (after loading is complete)
  useEffect(() => {
    if (!loading && !activeSprint && !hasAutoCreated) {
      setHasAutoCreated(true);
      const now = new Date();
      const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      createSprint('Sprint', now.toISOString(), twoWeeksLater.toISOString());
    }
  }, [loading, activeSprint, hasAutoCreated, createSprint]);

  const daysRemaining = activeSprint 
    ? differenceInDays(new Date(activeSprint.end_date), new Date())
    : 0;

  const handleAddTask = () => {
    if (newTaskTitle.trim() && onAddTask) {
      onAddTask(newTaskTitle.trim());
      setNewTaskTitle('');
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-shrink-0 w-72 bg-primary/5 border border-primary/20 rounded-lg p-3 flex flex-col transition-all duration-200',
        isOver && 'ring-2 ring-primary bg-primary/20 scale-[1.02]',
        active && !isOver && 'opacity-90'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-sm text-primary">Sprint</h3>
        <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-0.5 rounded-full">
          {taskCount}
        </span>
      </div>
      
      {/* Sprint dates - directly editable */}
      {activeSprint && (
        <div className="mb-3 space-y-1">
          <div className="flex items-center gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  {format(new Date(activeSprint.start_date), 'MMM d')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={new Date(activeSprint.start_date)}
                  onSelect={(date) => date && updateSprint(activeSprint.id, { start_date: date.toISOString() })}
                />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">-</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  {format(new Date(activeSprint.end_date), 'MMM d')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={new Date(activeSprint.end_date)}
                  onSelect={(date) => date && updateSprint(activeSprint.id, { end_date: date.toISOString() })}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className={cn(
            "text-xs font-medium",
            daysRemaining < 0 ? "text-destructive" :
            daysRemaining <= 2 ? "text-orange-500" :
            "text-muted-foreground"
          )}>
            {daysRemaining < 0 
              ? `${Math.abs(daysRemaining)} days overdue`
              : daysRemaining === 0 
                ? 'Ends today'
                : `${daysRemaining} days left`
            }
          </div>
        </div>
      )}

      {/* Add task input - before tasks */}
      {isOwnBoard && onAddTask && (
        <div className="mb-3 pb-3 border-b border-border">
          <div className="flex gap-2">
            <Input
              placeholder="Add task..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddTask();
                }
              }}
              className="h-8 text-sm"
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              onClick={handleAddTask}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Tasks */}
      <div className="flex-1 overflow-y-auto min-h-[150px]">{children}</div>
    </div>
  );
}
