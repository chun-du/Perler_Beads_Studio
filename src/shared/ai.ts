export interface AiProviderConnection {
  baseUrl: string
  apiKey: string
  providerProfileId?: string
}

export interface AiImageOptimizationRequest extends AiProviderConnection {
  model: string
  optimizationMode: string
  prompt?: string
  boardColumns: number
  boardRows: number
  manufacturerName: string
  maxColors: number
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

export type AiModelCapability = 'image-generation' | 'image-editing' | 'vision' | 'text'

export interface AiProviderProfile {
  id: string
  name: string
  baseUrl: string
  models: string[]
  selectedModel: string
  capabilitiesByModel: Record<string, AiModelCapability[]>
  hasApiKey: boolean
  updatedAt: string
}

export interface AiProviderProfileInput {
  id?: string
  name: string
  baseUrl: string
  models: string[]
  selectedModel: string
  capabilitiesByModel: Record<string, AiModelCapability[]>
}

export interface AiProviderProfileSaveRequest {
  profile: AiProviderProfileInput
  apiKey?: string
}

export interface AiProviderProfileListResult {
  ok: boolean
  profiles: AiProviderProfile[]
  secureStorageAvailable: boolean
  error?: string
}

export interface AiProviderProfileSaveResult {
  ok: boolean
  profile?: AiProviderProfile
  secureStorageAvailable: boolean
  error?: string
}

export interface AiProviderProfileDeleteResult {
  ok: boolean
  secureStorageAvailable: boolean
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

export const createAiImageOptimizationPrompt = (request: {
  optimizationMode: string
  prompt?: string
  boardColumns: number
  boardRows: number
  manufacturerName: string
  maxColors: number
}): string => {
  const basePrompt = [
    'Use the uploaded reference image as the primary source. Do not invent a different subject, pose, or composition.',
    'Create a clean pixel-art reference image for converting into a deterministic Perler bead pattern.',
    `The output image will be converted into a ${request.boardColumns} x ${request.boardRows} bead grid. Build the image as if the whole canvas is strictly divided into ${request.boardColumns} columns and ${request.boardRows} rows.`,
    'Every grid cell should read as one complete filled color block. Avoid gradients, sub-cell details, antialiasing blur, partial-cell strokes, soft shadows, and tiny texture that cannot occupy a full grid cell.',
    'The subject does not need to be perfectly centered if moving or scaling it helps each cell stay fully filled and readable.',
    `Use colors as close as possible to the ${request.manufacturerName} manufacturer bead palette. Refer to the manufacturer palette list on Bitbead: https://bitbead.pomodiary.com/en/colors . Prefer colors from that palette or close equivalents.`,
    `Limit the final image to no more than ${request.maxColors} distinct colors.`,
    'Preserve the main subject and recognizable silhouette while simplifying tiny details and reducing visual noise.',
    'Prefer a clean background or transparent-looking separation when it helps the subject read clearly.',
    'Do not add text, watermarks, borders, or new unrelated objects.',
    `Optimization goal: ${request.optimizationMode}.`
  ]

  const trimmedPrompt = request.prompt?.trim()
  if (trimmedPrompt) {
    basePrompt.push(`User direction: ${trimmedPrompt}`)
  }

  return basePrompt.join(' ')
}
