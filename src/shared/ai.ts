export interface AiProviderConnection {
  baseUrl: string
  apiKey: string
}

export interface AiModelInfo {
  id: string
  created?: number
  ownedBy?: string
}

export interface AiListModelsResult {
  ok: boolean
  models: AiModelInfo[]
  error?: string
}
