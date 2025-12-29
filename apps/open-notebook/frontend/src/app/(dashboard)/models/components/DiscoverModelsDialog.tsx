'use client'

import { useState, useMemo } from 'react'
import { ProviderAvailability, DiscoveredModel } from '@/lib/types/models'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDiscoverModels, useAddDiscoveredModels } from '@/lib/hooks/use-models'
import { Sparkles, Loader2, Check, Search } from 'lucide-react'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Input } from '@/components/ui/input'

interface DiscoverModelsDialogProps {
  modelType: 'language' | 'embedding' | 'text_to_speech' | 'speech_to_text'
  providers: ProviderAvailability
}

export function DiscoverModelsDialog({ modelType, providers }: DiscoverModelsDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  const { data: discoveryResult, isLoading: isDiscovering, refetch } = useDiscoverModels(
    selectedProvider,
    modelType
  )
  const addModelsMutation = useAddDiscoveredModels()

  // Get available providers that support this model type
  const availableProviders = providers.available.filter(provider =>
    providers.supported_types[provider]?.includes(modelType)
  )

  // Filter models by search query
  const filteredModels = useMemo(() => {
    if (!discoveryResult?.models) return []
    if (!searchQuery.trim()) return discoveryResult.models

    const query = searchQuery.toLowerCase()
    return discoveryResult.models.filter(m =>
      m.name.toLowerCase().includes(query) ||
      m.id.toLowerCase().includes(query)
    )
  }, [discoveryResult?.models, searchQuery])

  // Separate into already added and available
  const { alreadyAdded, available } = useMemo(() => {
    const added: DiscoveredModel[] = []
    const avail: DiscoveredModel[] = []

    for (const model of filteredModels) {
      if (model.already_added) {
        added.push(model)
      } else {
        avail.push(model)
      }
    }

    return { alreadyAdded: added, available: avail }
  }, [filteredModels])

  const handleToggleModel = (modelId: string) => {
    const newSelected = new Set(selectedModels)
    if (newSelected.has(modelId)) {
      newSelected.delete(modelId)
    } else {
      newSelected.add(modelId)
    }
    setSelectedModels(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedModels.size === available.length) {
      setSelectedModels(new Set())
    } else {
      setSelectedModels(new Set(available.map(m => m.id)))
    }
  }

  const handleAddSelected = async () => {
    if (selectedModels.size === 0) return

    await addModelsMutation.mutateAsync({
      provider: selectedProvider,
      modelIds: Array.from(selectedModels),
      modelType,
    })

    setSelectedModels(new Set())
    refetch()
  }

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      setSelectedProvider('')
      setSelectedModels(new Set())
      setSearchQuery('')
    }
  }

  const getModelTypeName = () => {
    return modelType.replace(/_/g, ' ')
  }

  if (availableProviders.length === 0) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkles className="h-4 w-4 mr-2" />
          Discover
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Discover {getModelTypeName()} Models</DialogTitle>
          <DialogDescription>
            Fetch available models from providers and add them to your configuration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Provider Selection */}
          <div className="flex gap-2">
            <Select value={selectedProvider} onValueChange={setSelectedProvider}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                {availableProviders.map((provider) => (
                  <SelectItem key={provider} value={provider}>
                    <span className="capitalize">{provider}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProvider && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => refetch()}
                disabled={isDiscovering}
              >
                {isDiscovering ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>

          {/* Search Filter */}
          {discoveryResult?.models && discoveryResult.models.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          )}

          {/* Models List */}
          <div className="flex-1 overflow-y-auto border rounded-md">
            {!selectedProvider ? (
              <div className="p-8 text-center text-muted-foreground">
                Select a provider to discover available models
              </div>
            ) : isDiscovering ? (
              <div className="p-8 flex items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : discoveryResult?.error ? (
              <div className="p-8 text-center text-destructive">
                {discoveryResult.error}
              </div>
            ) : filteredModels.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {searchQuery ? 'No models match your search' : 'No models found for this provider'}
              </div>
            ) : (
              <div className="divide-y">
                {/* Available Models */}
                {available.length > 0 && (
                  <div>
                    <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-4 py-2 flex items-center justify-between">
                      <span className="text-sm font-medium">
                        Available ({available.length})
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSelectAll}
                      >
                        {selectedModels.size === available.length ? 'Deselect All' : 'Select All'}
                      </Button>
                    </div>
                    {available.map((model) => (
                      <label
                        key={model.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedModels.has(model.id)}
                          onCheckedChange={() => handleToggleModel(model.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{model.name}</div>
                          {model.context_window && (
                            <div className="text-xs text-muted-foreground">
                              Context: {model.context_window.toLocaleString()} tokens
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {/* Already Added Models */}
                {alreadyAdded.length > 0 && (
                  <div>
                    <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-4 py-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        Already Added ({alreadyAdded.length})
                      </span>
                    </div>
                    {alreadyAdded.map((model) => (
                      <div
                        key={model.id}
                        className="flex items-center gap-3 px-4 py-3 opacity-60"
                      >
                        <Check className="h-4 w-4 text-green-500" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{model.name}</div>
                          {model.context_window && (
                            <div className="text-xs text-muted-foreground">
                              Context: {model.context_window.toLocaleString()} tokens
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs">Added</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          {selectedModels.size > 0 && (
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-muted-foreground">
                {selectedModels.size} model(s) selected
              </span>
              <Button
                onClick={handleAddSelected}
                disabled={addModelsMutation.isPending}
              >
                {addModelsMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>Add Selected</>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
