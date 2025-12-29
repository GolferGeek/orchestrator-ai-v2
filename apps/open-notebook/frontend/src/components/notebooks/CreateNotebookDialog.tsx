'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateNotebook } from '@/lib/hooks/use-notebooks'
import { useTeamContext } from '@/lib/hooks/use-team-context'
import { Users, User } from 'lucide-react'

const createNotebookSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  team_id: z.string().optional(),
})

type CreateNotebookFormData = z.infer<typeof createNotebookSchema>

interface CreateNotebookDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateNotebookDialog({ open, onOpenChange }: CreateNotebookDialogProps) {
  const createNotebook = useCreateNotebook()
  const { teams, currentTeamId } = useTeamContext()
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    reset,
    setValue,
    watch,
  } = useForm<CreateNotebookFormData>({
    resolver: zodResolver(createNotebookSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      description: '',
      team_id: currentTeamId || undefined,
    },
  })

  const selectedTeamId = watch('team_id')

  const closeDialog = () => onOpenChange(false)

  const onSubmit = async (data: CreateNotebookFormData) => {
    await createNotebook.mutateAsync(data)
    closeDialog()
    reset()
  }

  useEffect(() => {
    if (!open) {
      reset()
    }
  }, [open, reset])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create New Notebook</DialogTitle>
          <DialogDescription>
            Start organizing your research with a dedicated space for related sources and notes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notebook-name">Name *</Label>
            <Input
              id="notebook-name"
              {...register('name')}
              placeholder="Enter notebook name"
              autoFocus
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notebook-description">Description</Label>
            <Textarea
              id="notebook-description"
              {...register('description')}
              placeholder="Describe the purpose and scope of this notebook..."
              rows={4}
            />
          </div>

          {/* Team selection - only show if user has teams */}
          {teams.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="notebook-team">Ownership</Label>
              <Select
                value={selectedTeamId || 'personal'}
                onValueChange={(value) => setValue('team_id', value === 'personal' ? undefined : value)}
              >
                <SelectTrigger id="notebook-team">
                  <SelectValue placeholder="Select ownership" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>Personal</span>
                    </div>
                  </SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>{team.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {selectedTeamId
                  ? 'This notebook will be shared with team members'
                  : 'Only you can access this notebook'}
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || createNotebook.isPending}>
              {createNotebook.isPending ? 'Creating…' : 'Create Notebook'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
