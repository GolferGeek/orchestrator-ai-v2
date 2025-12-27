import apiClient from './client'
import { Model, CreateModelRequest, ModelDefaults, ProviderAvailability, ModelDiscoveryResponse } from '@/lib/types/models'

export const modelsApi = {
  list: async () => {
    const response = await apiClient.get<Model[]>('/models')
    return response.data
  },

  get: async (id: string) => {
    const response = await apiClient.get<Model>(`/models/${id}`)
    return response.data
  },

  create: async (data: CreateModelRequest) => {
    const response = await apiClient.post<Model>('/models', data)
    return response.data
  },

  delete: async (id: string) => {
    await apiClient.delete(`/models/${id}`)
  },

  getDefaults: async () => {
    const response = await apiClient.get<ModelDefaults>('/models/defaults')
    return response.data
  },

  updateDefaults: async (data: Partial<ModelDefaults>) => {
    const response = await apiClient.put<ModelDefaults>('/models/defaults', data)
    return response.data
  },

  getProviders: async () => {
    const response = await apiClient.get<ProviderAvailability>('/models/providers')
    return response.data
  },

  discoverModels: async (provider: string, modelType?: string) => {
    const params = modelType ? { model_type: modelType } : {}
    const response = await apiClient.get<ModelDiscoveryResponse>(`/models/discover/${provider}`, { params })
    return response.data
  },

  addDiscoveredModels: async (provider: string, modelIds: string[], modelType: string) => {
    const response = await apiClient.post<Model[]>(
      `/models/discover/${provider}/add`,
      modelIds,
      { params: { model_type: modelType } }
    )
    return response.data
  }
}