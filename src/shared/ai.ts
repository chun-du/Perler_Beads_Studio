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
  const size = 960
  // const basePrompt = [
  //   'Use the uploaded reference image as the primary source. Do not invent a different subject, pose, or composition.',
  //   `The canvas is divided into a ${request.boardColumns} x ${request.boardRows} grid layout, which is then drawn as pixel art within the canvas.`,
  //   `The final file can be high resolution, but the visible artwork must be built from a ${size/request.boardColumns} x ${size/request.boardRows} square-pixel grid.`,
  //   `Every visible pixel block should align to that ${request.boardColumns} x ${request.boardRows} grid and read as one complete filled color block.`,
  //   'Use hard square edges, flat fills, and clear stepped silhouettes. Avoid anti-aliased edges, gradients, painterly shading, soft shadows, vector-smooth curves, tiny texture, and sub-cell details.',
  //   'The subject does not need to be perfectly centered if moving or scaling it helps each cell stay fully filled and readable.',
  //   `Use colors as close as possible to the ${request.manufacturerName} manufacturer bead palette. Refer to the manufacturer palette list on Bitbead: https://bitbead.pomodiary.com/en/colors . Prefer colors from that palette or close equivalents.`,
  //   `Limit the final image to no more than ${request.maxColors} distinct colors.`,
  //   'Preserve the main subject and recognizable silhouette while simplifying tiny details and reducing visual noise.',
  //   'Prefer a clean background or transparent-looking separation when it helps the subject read clearly.',
  //   'If there is a conflict between preserving smooth source details and making pixel art, prioritize the pixel-art grid.',
  //   'Do not add text, watermarks, borders, or new unrelated objects.',
  // ]

  const basePrompt = [
      `The canvas size is fixed at ${size}x${size} pixels, a square composition, and the canvas is composed of ${request.boardColumns}x${request.boardRows} small squares, each strictly ${size/request.boardColumns}x${size/request.boardRows} pixels. Draw grid lines. Please create a pixel art piece based on the reference image I uploaded.`,
      `Using the main elements in the reference image as prototypes, their core outlines, postures, and main color relationships are preserved, and they are redrawn in a clear pixel art style.`,
      `All pixel blocks must be strictly aligned to the ${size/request.boardColumns}x${size/request.boardRows} grid, and each pixel block must completely fill its corresponding small square. Half-squares, beveled squares, blurred edges, or anti-aliased transitions are not allowed.`,
      `The image needs to completely fill the ${size}x${size} canvas. The subject should be centered or reasonably occupy the main visual area. The background can be simplified to block colors suitable for pixel art.`,
      `Use colors as close as possible to the ${request.manufacturerName} manufacturer bead palette. Refer to the manufacturer palette list on Bitbead: https://bitbead.pomodiary.com/en/colors . Prefer colors from that palette or close equivalents. Limit the final image to no more than ${request.maxColors} distinct colors. Preserve the main subject and recognizable silhouette while simplifying tiny details and reducing visual noise.`
  ]

  const trimmedPrompt = request.prompt?.trim()
  if (trimmedPrompt) {
    basePrompt.push(`User direction: ${trimmedPrompt}`)
  }

  return basePrompt.join(' ')
}
