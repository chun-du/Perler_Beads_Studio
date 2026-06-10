export interface AiProviderConnection {
  baseUrl: string
  apiKey: string
}

export interface AiImageOptimizationRequest extends AiProviderConnection {
  model: string
  optimizationMode: string
  imageDataUrl: string
  imageName?: string
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

export interface AiImageOptimizationResult {
  ok: boolean
  imageDataUrl?: string
  revisedPrompt?: string
  error?: string
}

const buildAiEndpointUrl = (baseUrl: string, endpoint: string): string => {
  const normalizedUrl = new URL(baseUrl.trim())
  const trimmedPath = normalizedUrl.pathname.replace(/\/+$/, '')

  if (trimmedPath.endsWith(`/${endpoint}`) || trimmedPath === `/${endpoint}`) {
    normalizedUrl.pathname = trimmedPath
  } else {
    normalizedUrl.pathname = `${trimmedPath}/${endpoint}`
  }

  return normalizedUrl.toString()
}

export const buildAiModelsUrl = (baseUrl: string): string => {
  return buildAiEndpointUrl(baseUrl, 'models')
}

export const buildAiImageEditsUrl = (baseUrl: string): string => {
  return buildAiEndpointUrl(baseUrl, 'images/edits')
}

export const createAiImageOptimizationPrompt = (mode: string): string => {
  return [
    'Create a clean reference image for converting into a Perler bead pattern.',
    'Preserve the main subject and recognizable silhouette.',
    'Simplify tiny details, reduce visual noise, use flatter color regions, and keep the subject centered.',
    'Do not add text, watermarks, borders, or new unrelated objects.',
    `Optimization mode: ${mode}.`
  ].join(' ')
}
