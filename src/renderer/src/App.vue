<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import type {
  AiImageOptimizationRequest,
  AiImageOptimizationResult,
  AiListModelsResult,
  AiModelCapability,
  AiProviderProfile
} from '@shared/ai'
import { buildAiImageEditsUrl, buildAiModelsUrl, createAiImageOptimizationPrompt } from '@shared/ai'
import type { SavedProject } from '@shared/project'
import type { ThemePreference } from '@shared/theme'
import { useTheme } from './composables/useTheme'
import {
  defaultManufacturerId,
  getManufacturerPalette,
  manufacturerPalettes
} from './data/palettes'
import {
  buildBeadInventory,
  createPatternFromImageFile,
  createPatternFromImageDataUrl,
  createSamplePattern,
  EMPTY_CELL,
  exportBeadInventoryAsCsv,
  exportPatternAsPng,
  isEmptyCell,
  parseBoardSize,
  printPatternSheet,
  readImageFileAsDataUrl
} from './utils/pattern'
import type { PatternGrid } from './utils/pattern'

type EditorTool = 'pencil' | 'fill' | 'eyedropper' | 'eraser'
type PatternInputMode = 'image' | 'pixel-art'
type AiCreationMode = 'generate' | 'optimize'

interface CanvasPointerState {
  pointerId: number
  button: number
  isPanMode: boolean
  startClientX: number
  startClientY: number
  startPanX: number
  startPanY: number
}

interface AiProviderOption {
  id: string
  name: string
  baseUrl: string
  models: string[]
  selectedModel: string
  capabilitiesByModel: Record<string, AiModelCapability[]>
  hasApiKey: boolean
  isSavedProfile: boolean
}

const { preference, resolvedTheme, setPreference, cycleTheme } = useTheme()

const boardSizes = ['32 x 32', '48 x 48', '64 x 64', '96 x 96']
const defaultAiOptimizationMode = '拼豆图纸优化'
const aiCreationModes: Array<{ id: AiCreationMode; label: string; description: string }> = [
  { id: 'generate', label: '普通生成', description: '直接用本地确定性逻辑生成图纸' },
  { id: 'optimize', label: 'AI 优化', description: '先优化原图，再生成图纸' }
]


const imageModelKeywords = [
  'image',
  'img',
  'dall-e',
  'dalle',
  'gpt-image',
  'imagen',
  'flux',
  'stable-diffusion',
  'sdxl',
  'sd3',
  'midjourney',
  'mj',
  'seedream',
  'dreamina',
  'kolors',
  'wanx',
  'cogview',
  'ideogram',
  'recraft',
  'jimeng',
  'doubao-seedream',
  'kling-image'
]
const nonImageModelKeywords = [
  'embedding',
  'rerank',
  'whisper',
  'tts',
  'audio',
  'speech',
  'moderation',
  'transcribe',
  'translate',
  'chat',
  'code',
  'reasoner'
]

const isLikelyImageGenerationModel = (modelId: string): boolean => {
  const normalized = modelId.trim().toLowerCase()

  if (!normalized) return false
  if (nonImageModelKeywords.some((keyword) => normalized.includes(keyword))) return false

  return imageModelKeywords.some((keyword) => normalized.includes(keyword))
}

const getImageGenerationModelIds = (modelIds: string[]): string[] => {
  const uniqueModelIds = [...new Set(modelIds.map((modelId) => modelId.trim()).filter(Boolean))]
  return uniqueModelIds.filter(isLikelyImageGenerationModel)
}

const NEW_PROVIDER_ID = 'new-provider'

const editorTools: Array<{ id: EditorTool; icon: string; label: string }> = [
  { id: 'pencil', icon: 'ri:paint-brush-line', label: '画笔' },
  { id: 'fill', icon: 'ri:paint-fill', label: '填充' },
  { id: 'eyedropper', icon: 'ri:dropper-line', label: '吸管' },
  { id: 'eraser', icon: 'ri:eraser-line', label: '橡皮' }
]

const selectedManufacturer = ref(defaultManufacturerId)
const selectedBoardSize = ref(boardSizes[1])
const inputMode = ref<PatternInputMode>('image')
const maxColors = ref(24)
const enableDithering = ref(true)
const enablePixelCleanup = ref(true)
const showGridLabels = ref(true)
const activeManufacturerPalette = computed(() => getManufacturerPalette(selectedManufacturer.value))
const activePaletteColors = computed(() => activeManufacturerPalette.value.colors)
const createCurrentSamplePattern = (): PatternGrid => {
  const { columns, rows } = parseBoardSize(selectedBoardSize.value)
  return createSamplePattern(activePaletteColors.value, columns, rows)
}
const patternGrid = ref<PatternGrid>(createCurrentSamplePattern())
const sourceFile = ref<File | null>(null)
const isGenerating = ref(false)
const isOptimizingImage = ref(false)
const aiCreationMode = ref<AiCreationMode>('generate')
const hasManualEdits = ref(false)
const generationMessage = ref('示例图纸已就绪')
const generationError = ref('')
const aiOptimizeStatus = ref('')
const aiOptimizeError = ref('')
const aiOptimizeElapsedSeconds = ref(0)
const aiReferenceDataUrl = ref('')
const aiReferenceName = ref('')
const selectedColorHex = ref(activePaletteColors.value[3]?.hex ?? activePaletteColors.value[0].hex)
const isPalettePickerOpen = ref(false)
const paletteSearchQuery = ref('')
const isAiSettingsOpen = ref(false)
const aiPrompt = ref('')
const activeTool = ref<EditorTool>('pencil')
const undoStack = ref<string[][]>([])
const redoStack = ref<string[][]>([])
const projectFileInput = ref<HTMLInputElement | null>(null)
const patternPreviewPanel = ref<HTMLElement | null>(null)
const patternCanvasStage = ref<HTMLDivElement | null>(null)
const patternCanvasShell = ref<HTMLDivElement | null>(null)
const patternCanvas = ref<HTMLCanvasElement | null>(null)
const patternCanvasFrame = ref<HTMLDivElement | null>(null)
const projectStatus = ref('尚未保存')
const isPatternFullscreen = ref(false)
const isPatternOverlayFullscreen = ref(false)
const canvasZoom = ref(1)
const canvasPanX = ref(0)
const canvasPanY = ref(0)
const canvasBaseSize = ref(420)
const canvasPointerState = ref<CanvasPointerState | null>(null)
const isCanvasDragging = ref(false)
const isSpacePressed = ref(false)
const isCanvasStageHovered = ref(false)
let generationToken = 0
let isApplyingProject = false
let canvasResizeObserver: ResizeObserver | null = null
let aiOptimizeTimer: number | null = null

const selectedProviderId = ref(NEW_PROVIDER_ID)
const savedProviderProfiles = ref<AiProviderProfile[]>([])
const providerName = ref('')
const baseUrl = ref('')
const apiKey = ref('')
const modelOptions = ref<string[]>([])
const selectedModel = ref('')
const capabilitiesByModel = ref<Record<string, AiModelCapability[]>>({})
const isFetchingModels = ref(false)
const isSavingProvider = ref(false)
const isDeletingProvider = ref(false)
const modelStatus = ref('请先配置平台并拉取生图模型')
const modelError = ref('')
const providerStatus = ref('')
const providerError = ref('')
const secureStorageAvailable = ref(false)

const aiProviderOptions = computed<AiProviderOption[]>(() => {
  return savedProviderProfiles.value.map((profile) => ({
    id: profile.id,
    name: profile.name,
    baseUrl: profile.baseUrl,
    models: getImageGenerationModelIds(profile.models),
    selectedModel: getImageGenerationModelIds(profile.models).includes(profile.selectedModel)
      ? profile.selectedModel
      : getImageGenerationModelIds(profile.models)[0] ?? '',
    capabilitiesByModel: profile.capabilitiesByModel,
    hasApiKey: profile.hasApiKey,
    isSavedProfile: true
  }))
})

const selectedProvider = computed(() => {
  return aiProviderOptions.value.find((provider) => provider.id === selectedProviderId.value) ?? {
    id: NEW_PROVIDER_ID,
    name: providerName.value || '新增平台',
    baseUrl: baseUrl.value,
    models: [...modelOptions.value],
    selectedModel: selectedModel.value,
    capabilitiesByModel: { ...capabilitiesByModel.value },
    hasApiKey: false,
    isSavedProfile: false
  }
})

const selectedProviderHasStoredKey = computed(() => selectedProvider.value?.isSavedProfile === true && selectedProvider.value.hasApiKey)
const isDesktopAiRuntime = computed(() => window.perler?.ai !== undefined)
const canUseStoredApiKey = computed(() => window.perler?.ai !== undefined && selectedProviderHasStoredKey.value)
const isAiOptimizeMode = computed(() => aiCreationMode.value === 'optimize')
const aiOptimizeElapsedLabel = computed(() => {
  const minutes = Math.floor(aiOptimizeElapsedSeconds.value / 60)
  const seconds = aiOptimizeElapsedSeconds.value % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})

const previewColumns = computed(() => patternGrid.value.columns)
const previewRows = computed(() => patternGrid.value.rows)
const beadCells = computed(() => patternGrid.value.cells)
const shouldShowGridLabel = (value: number, maxValue: number): boolean => {
  return value === 1 || value === maxValue || value % 5 === 0
}
const patternStatus = computed(() => {
  if (isGenerating.value) return '生成中'
  if (generationError.value) return '需处理'
  if (hasManualEdits.value) return '已编辑'
  if (sourceFile.value && patternGrid.value.sourceName !== sourceFile.value.name && patternGrid.value.sourceName !== aiReferenceName.value) {
    return '待生成'
  }
  return sourceFile.value ? '已生成' : '草稿'
})

const beadInventory = computed(() => buildBeadInventory(patternGrid.value, activePaletteColors.value))
const usedColors = computed(() => beadInventory.value)
const actualUsedColorCount = computed(() => {
  return new Set(patternGrid.value.cells.filter((color) => !isEmptyCell(color))).size
})

const displayedColors = computed(() => beadInventory.value.slice(0, 9))
const usedColorCounts = computed(() => {
  return new Map(beadInventory.value.map((color) => [color.hex, color.count]))
})
const filteredPaletteColors = computed(() => {
  const query = paletteSearchQuery.value.trim().toLowerCase()

  if (!query) return activePaletteColors.value

  return activePaletteColors.value.filter((color) => {
    return `${color.id} ${color.name} ${color.hex}`.toLowerCase().includes(query)
  })
})
const canvasZoomPercent = computed(() => Math.round(canvasZoom.value * 100))
const canvasCursorClass = computed(() => {
  if (isCanvasDragging.value) return 'cursor-grabbing'
  if (isSpacePressed.value) return 'cursor-grab'
  return 'cursor-crosshair'
})
const canvasShellStyle = computed(() => ({
  width: `${canvasBaseSize.value}px`,
  height: `${canvasBaseSize.value}px`,
  transform: `translate3d(${canvasPanX.value}px, ${canvasPanY.value}px, 0) scale(${canvasZoom.value})`
}))

const selectedColor = computed(() => {
  return activePaletteColors.value.find((color) => color.hex === selectedColorHex.value) ?? activePaletteColors.value[0]
})
const selectedColorLabel = computed(() => `${selectedColor.value.id} ${selectedColor.value.name}`)

const isSamplePatternActive = (): boolean => {
  return patternGrid.value.sourceName === '示例图纸'
}

const isGeneratedFromSourceImage = (): boolean => {
  return Boolean(sourceFile.value && patternGrid.value.sourceName === sourceFile.value.name)
}

const isGeneratedFromAiReference = (): boolean => {
  return Boolean(aiReferenceDataUrl.value && aiReferenceName.value && patternGrid.value.sourceName === aiReferenceName.value)
}

const selectPaletteColor = (colorHex: string): void => {
  selectedColorHex.value = colorHex
  isPalettePickerOpen.value = false

  if (activeTool.value === 'eraser' || activeTool.value === 'eyedropper') {
    activeTool.value = 'pencil'
  }
}

const closePalettePicker = (): void => {
  isPalettePickerOpen.value = false
}

const themeOptions: Array<{ value: ThemePreference; icon: string; label: string }> = [
  { value: 'system', icon: 'ri:computer-line', label: '系统' },
  { value: 'light', icon: 'ri:sun-line', label: '昼' },
  { value: 'dark', icon: 'ri:moon-line', label: '夜' }
]

const themeButtonIcon = computed(() => {
  if (preference.value === 'system') return 'ri:computer-line'
  return resolvedTheme.value === 'dark' ? 'ri:moon-line' : 'ri:sun-line'
})

const syncModelSelection = (): void => {
  if (!modelOptions.value.includes(selectedModel.value)) {
    selectedModel.value = modelOptions.value[0] ?? ''
  }
}

const resetProviderForm = (): void => {
  selectedProviderId.value = NEW_PROVIDER_ID
  providerName.value = ''
  baseUrl.value = ''
  apiKey.value = ''
  modelOptions.value = []
  selectedModel.value = ''
  capabilitiesByModel.value = {}
  modelStatus.value = '请先配置平台并拉取生图模型'
  modelError.value = ''
  providerStatus.value = ''
  providerError.value = ''
}

const onProviderChange = (): void => {
  const provider = selectedProvider.value

  providerName.value = provider.name
  baseUrl.value = provider.baseUrl
  modelOptions.value = provider.models
  selectedModel.value = modelOptions.value.includes(provider.selectedModel) ? provider.selectedModel : modelOptions.value[0] || ''
  capabilitiesByModel.value = { ...provider.capabilitiesByModel }
  apiKey.value = ''
  modelStatus.value = provider.isSavedProfile ? '已载入供应商档案' : '请先拉取生图模型'
  modelError.value = ''
  providerStatus.value = provider.hasApiKey ? '已保存 API Key，可留空使用' : ''
  providerError.value = ''
  syncModelSelection()
}

const loadProviderProfiles = async (): Promise<void> => {
  if (!window.perler?.ai) {
    secureStorageAvailable.value = false
    providerStatus.value = 'Web 预览不保存供应商档案'
    return
  }

  try {
    const result = await window.perler.ai.listProviderProfiles()
    secureStorageAvailable.value = result.secureStorageAvailable

    if (!result.ok) {
      providerError.value = result.error ?? '供应商档案读取失败'
      return
    }

    savedProviderProfiles.value = result.profiles
    const selected = aiProviderOptions.value.find((provider) => provider.id === selectedProviderId.value)

    if (selected) {
      onProviderChange()
      return
    }

    if (!providerName.value && aiProviderOptions.value[0]) {
      selectedProviderId.value = aiProviderOptions.value[0].id
      onProviderChange()
    }
  } catch (error) {
    providerError.value = error instanceof Error ? error.message : '供应商档案读取失败'
  }
}

const saveProviderProfile = async (): Promise<void> => {
  providerError.value = ''
  providerStatus.value = ''

  if (!window.perler?.ai) {
    providerError.value = 'Web 预览不保存供应商档案，请在桌面端保存'
    return
  }

  if (!providerName.value.trim()) {
    providerError.value = '请先填写供应商名称'
    return
  }

  if (!baseUrl.value.trim()) {
    providerError.value = '请先填写 Base URL'
    return
  }

  if (!selectedModel.value.trim()) {
    providerError.value = '请先选择模型'
    return
  }

  isSavingProvider.value = true

  try {
    const providerId = selectedProvider.value?.isSavedProfile ? selectedProviderId.value : undefined
    const capabilitiesByImageModel = {
      [selectedModel.value]: ['image-generation' as AiModelCapability]
    }
    const result = await window.perler.ai.saveProviderProfile({
      profile: {
        id: providerId,
        name: providerName.value,
        baseUrl: baseUrl.value,
        models: [...modelOptions.value],
        selectedModel: selectedModel.value,
        capabilitiesByModel: capabilitiesByImageModel
      },
      apiKey: apiKey.value || undefined
    })
    secureStorageAvailable.value = result.secureStorageAvailable

    if (!result.ok || !result.profile) {
      providerError.value = result.error ?? '供应商档案保存失败'
      return
    }

    const profile = result.profile
    savedProviderProfiles.value = [
      profile,
      ...savedProviderProfiles.value.filter((item) => item.id !== profile.id)
    ]
    selectedProviderId.value = profile.id
    apiKey.value = ''
    onProviderChange()
    providerStatus.value = profile.hasApiKey ? '供应商档案和 API Key 已安全保存' : '供应商档案已保存'
  } catch (error) {
    providerError.value = error instanceof Error ? error.message : '供应商档案保存失败'
  } finally {
    isSavingProvider.value = false
  }
}

const deleteProviderProfile = async (): Promise<void> => {
  providerError.value = ''
  providerStatus.value = ''

  if (!window.perler?.ai || !selectedProvider.value?.isSavedProfile) {
    providerError.value = '只能删除已保存的供应商档案'
    return
  }

  isDeletingProvider.value = true

  try {
    const profileId = selectedProviderId.value
    const result = await window.perler.ai.deleteProviderProfile(profileId)
    secureStorageAvailable.value = result.secureStorageAvailable

    if (!result.ok) {
      providerError.value = result.error ?? '供应商档案删除失败'
      return
    }

    savedProviderProfiles.value = savedProviderProfiles.value.filter((profile) => profile.id !== profileId)
    const nextProvider = aiProviderOptions.value[0]
    if (nextProvider) {
      selectedProviderId.value = nextProvider.id
      onProviderChange()
    } else {
      resetProviderForm()
    }
    providerStatus.value = '供应商档案已删除'
  } catch (error) {
    providerError.value = error instanceof Error ? error.message : '供应商档案删除失败'
  } finally {
    isDeletingProvider.value = false
  }
}

const getPatternGenerationOptions = () => ({
  boardSize: selectedBoardSize.value,
  maxColors: maxColors.value,
  dithering: !isAiOptimizeMode.value && enableDithering.value,
  cleanup: !isAiOptimizeMode.value && enablePixelCleanup.value,
  inputMode: inputMode.value,
  palette: activePaletteColors.value
})

const MIN_CANVAS_ZOOM = 0.5
const MAX_CANVAS_ZOOM = 8
const CANVAS_ZOOM_STEP = 1.25
const CANVAS_DRAG_THRESHOLD = 3
const CANVAS_MIN_VISIBLE_SIZE = 48

interface CanvasMetrics {
  canvasSize: number
  gridX: number
  gridY: number
  gridSize: number
  cellSize: number
  labelSize: number
  padding: number
}

const getCanvasMetrics = (canvasSize: number): CanvasMetrics => {
  const padding = Math.max(10, Math.min(16, canvasSize * 0.028))
  const labelSize = showGridLabels.value ? Math.max(22, Math.min(32, canvasSize * 0.056)) : 0
  const availableSize = Math.max(1, canvasSize - padding * 2 - labelSize * 2)
  const gridSize = Math.floor(availableSize)

  return {
    canvasSize,
    gridX: padding + labelSize,
    gridY: padding + labelSize,
    gridSize,
    cellSize: gridSize / Math.max(1, previewColumns.value),
    labelSize,
    padding
  }
}

const clampNumber = (value: number, minimum: number, maximum: number): number => {
  return Math.min(maximum, Math.max(minimum, value))
}

const clampCanvasZoom = (zoom: number): number => {
  return clampNumber(Number.isFinite(zoom) ? zoom : 1, MIN_CANVAS_ZOOM, MAX_CANVAS_ZOOM)
}

const getClampedCanvasPan = (
  panX: number,
  panY: number,
  zoom: number,
  stageWidth: number,
  stageHeight: number,
  shellWidth: number,
  shellHeight: number
): { x: number; y: number } => {
  const scaledShellWidth = shellWidth * zoom
  const scaledShellHeight = shellHeight * zoom
  const minimumVisibleX = Math.min(CANVAS_MIN_VISIBLE_SIZE, stageWidth, scaledShellWidth)
  const minimumVisibleY = Math.min(CANVAS_MIN_VISIBLE_SIZE, stageHeight, scaledShellHeight)
  const maximumPanX = Math.max(0, (stageWidth + scaledShellWidth) / 2 - minimumVisibleX)
  const maximumPanY = Math.max(0, (stageHeight + scaledShellHeight) / 2 - minimumVisibleY)

  return {
    x: clampNumber(panX, -maximumPanX, maximumPanX),
    y: clampNumber(panY, -maximumPanY, maximumPanY)
  }
}

const getCanvasViewportMetrics = (): {
  stageWidth: number
  stageHeight: number
  shellWidth: number
  shellHeight: number
} => {
  const stageRect = patternCanvasStage.value?.getBoundingClientRect()
  const shellRect = patternCanvasShell.value?.getBoundingClientRect()

  return {
    stageWidth: Math.max(1, stageRect?.width ?? 1),
    stageHeight: Math.max(1, stageRect?.height ?? 1),
    shellWidth: Math.max(1, (shellRect?.width ?? 1) / canvasZoom.value),
    shellHeight: Math.max(1, (shellRect?.height ?? 1) / canvasZoom.value)
  }
}

const updateCanvasBaseSize = (): void => {
  const stageRect = patternCanvasStage.value?.getBoundingClientRect()
  if (!stageRect) return

  canvasBaseSize.value = Math.max(180, Math.floor(Math.min(stageRect.width, stageRect.height) - 64))
}

const setCanvasViewport = (zoom: number, panX = canvasPanX.value, panY = canvasPanY.value): void => {
  const nextZoom = clampCanvasZoom(zoom)
  const metrics = getCanvasViewportMetrics()
  const nextPan = getClampedCanvasPan(
    panX,
    panY,
    nextZoom,
    metrics.stageWidth,
    metrics.stageHeight,
    metrics.shellWidth,
    metrics.shellHeight
  )

  canvasZoom.value = nextZoom
  canvasPanX.value = nextPan.x
  canvasPanY.value = nextPan.y
}

const resetCanvasViewport = (): void => {
  setCanvasViewport(1, 0, 0)
}

const zoomCanvasAtPoint = (zoom: number, clientX?: number, clientY?: number): void => {
  const stage = patternCanvasStage.value
  const nextZoom = clampCanvasZoom(zoom)

  if (!stage) {
    setCanvasViewport(nextZoom)
    return
  }

  const rect = stage.getBoundingClientRect()
  const viewportX = clientX === undefined ? rect.width / 2 : clampNumber(clientX - rect.left, 0, rect.width)
  const viewportY = clientY === undefined ? rect.height / 2 : clampNumber(clientY - rect.top, 0, rect.height)
  const sourceX = (viewportX - rect.width / 2 - canvasPanX.value) / canvasZoom.value
  const sourceY = (viewportY - rect.height / 2 - canvasPanY.value) / canvasZoom.value
  const nextPanX = viewportX - rect.width / 2 - sourceX * nextZoom
  const nextPanY = viewportY - rect.height / 2 - sourceY * nextZoom

  setCanvasViewport(nextZoom, nextPanX, nextPanY)
}

const zoomCanvasIn = (): void => {
  zoomCanvasAtPoint(canvasZoom.value * CANVAS_ZOOM_STEP)
}

const zoomCanvasOut = (): void => {
  zoomCanvasAtPoint(canvasZoom.value / CANVAS_ZOOM_STEP)
}

const getCanvasSourcePoint = (clientX: number, clientY: number): { x: number; y: number; canvasSize: number } | null => {
  const canvas = patternCanvas.value
  if (!canvas) return null

  const rect = canvas.getBoundingClientRect()
  const zoom = Math.max(MIN_CANVAS_ZOOM, canvasZoom.value)
  const canvasSize = Math.max(1, Math.min(rect.width, rect.height) / zoom)
  const viewportX = clientX - rect.left
  const viewportY = clientY - rect.top

  if (viewportX < 0 || viewportY < 0 || viewportX > rect.width || viewportY > rect.height) {
    return null
  }

  return {
    x: viewportX / zoom,
    y: viewportY / zoom,
    canvasSize
  }
}

const drawRoundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void => {
  const safeRadius = Math.min(radius, width / 2, height / 2)

  context.beginPath()
  context.moveTo(x + safeRadius, y)
  context.lineTo(x + width - safeRadius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
  context.lineTo(x + width, y + height - safeRadius)
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height)
  context.lineTo(x + safeRadius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
  context.lineTo(x, y + safeRadius)
  context.quadraticCurveTo(x, y, x + safeRadius, y)
  context.closePath()
}

const drawPatternCanvas = (): void => {
  const canvas = patternCanvas.value
  const frame = patternCanvasFrame.value
  if (!canvas || !frame) return

  const cssSize = Math.max(1, Math.floor(Math.min(frame.clientWidth, frame.clientHeight)))
  const pixelRatio = Math.max(1, window.devicePixelRatio || 1)
  const pixelSize = Math.floor(cssSize * pixelRatio)

  if (canvas.width !== pixelSize || canvas.height !== pixelSize) {
    canvas.width = pixelSize
    canvas.height = pixelSize
    canvas.style.width = `${cssSize}px`
    canvas.style.height = `${cssSize}px`
  }

  const context = canvas.getContext('2d')
  if (!context) return

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  context.clearRect(0, 0, cssSize, cssSize)

  const isDark = resolvedTheme.value === 'dark'
  const metrics = getCanvasMetrics(cssSize)
  const cells = beadCells.value
  const rows = previewRows.value
  const columns = previewColumns.value
  const cellSize = metrics.cellSize

  context.fillStyle = isDark ? '#2a2723' : '#ffffff'
  drawRoundedRect(context, 0, 0, cssSize, cssSize, 8)
  context.fill()

  if (showGridLabels.value) {
    context.fillStyle = isDark ? '#d8d2c7' : '#5f564b'
    context.font = `700 ${Math.max(9, Math.min(12, metrics.labelSize * 0.36))}px Inter, ui-sans-serif, system-ui, sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'

    for (let x = 0; x < columns; x += 1) {
      const label = x + 1
      if (!shouldShowGridLabel(label, columns)) continue

      const labelX = metrics.gridX + x * cellSize + cellSize / 2
      context.fillText(String(label), labelX, metrics.padding + metrics.labelSize / 2)
    }

    for (let y = 0; y < rows; y += 1) {
      const label = y + 1
      if (!shouldShowGridLabel(label, rows)) continue

      const labelY = metrics.gridY + y * cellSize + cellSize / 2
      context.fillText(String(label), metrics.padding + metrics.labelSize * 0.5, labelY)
    }
  }

  context.fillStyle = isDark ? '#191715' : '#f8f7f4'
  context.fillRect(metrics.gridX, metrics.gridY, metrics.gridSize, metrics.gridSize)

  for (let index = 0; index < cells.length; index += 1) {
    const color = cells[index]
    const x = index % columns
    const y = Math.floor(index / columns)
    const cellX = metrics.gridX + x * cellSize
    const cellY = metrics.gridY + y * cellSize
    const inset = Math.max(0.8, Math.min(2.2, cellSize * 0.1))

    if (isEmptyCell(color)) {
      context.fillStyle = (x + y) % 2 === 0 ? (isDark ? '#211f1c' : '#ffffff') : (isDark ? '#25221f' : '#f3f0ea')
      context.fillRect(cellX, cellY, cellSize, cellSize)
      continue
    }

    context.fillStyle = color
    drawRoundedRect(
      context,
      cellX + inset,
      cellY + inset,
      Math.max(0.5, cellSize - inset * 2),
      Math.max(0.5, cellSize - inset * 2),
      Math.max(1, cellSize * 0.14)
    )
    context.fill()

    if (cellSize >= 7) {
      context.fillStyle = 'rgb(255 255 255 / 0.22)'
      context.beginPath()
      context.arc(cellX + cellSize * 0.36, cellY + cellSize * 0.32, Math.max(0.8, cellSize * 0.11), 0, Math.PI * 2)
      context.fill()
    }
  }

  context.strokeStyle = isDark ? 'rgb(255 255 255 / 0.12)' : 'rgb(25 23 21 / 0.14)'
  context.lineWidth = 1

  for (let x = 0; x <= columns; x += 1) {
    const lineX = Math.round(metrics.gridX + x * cellSize) + 0.5

    context.beginPath()
    context.moveTo(lineX, metrics.gridY)
    context.lineTo(lineX, metrics.gridY + metrics.gridSize)
    context.stroke()
  }

  for (let y = 0; y <= rows; y += 1) {
    const lineY = Math.round(metrics.gridY + y * cellSize) + 0.5

    context.beginPath()
    context.moveTo(metrics.gridX, lineY)
    context.lineTo(metrics.gridX + metrics.gridSize, lineY)
    context.stroke()
  }

  context.strokeStyle = isDark ? 'rgb(255 255 255 / 0.42)' : 'rgb(25 23 21 / 0.48)'
  context.lineWidth = 1.5

  for (let x = 0; x <= columns; x += 5) {
    const lineX = Math.round(metrics.gridX + x * cellSize) + 0.5

    context.beginPath()
    context.moveTo(lineX, metrics.gridY)
    context.lineTo(lineX, metrics.gridY + metrics.gridSize)
    context.stroke()
  }

  for (let y = 0; y <= rows; y += 5) {
    const lineY = Math.round(metrics.gridY + y * cellSize) + 0.5

    context.beginPath()
    context.moveTo(metrics.gridX, lineY)
    context.lineTo(metrics.gridX + metrics.gridSize, lineY)
    context.stroke()
  }

  context.strokeStyle = isDark ? 'rgb(255 255 255 / 0.55)' : 'rgb(25 23 21 / 0.55)'
  context.lineWidth = 2
  context.strokeRect(metrics.gridX + 0.5, metrics.gridY + 0.5, metrics.gridSize - 1, metrics.gridSize - 1)
}

const getCanvasCellIndex = (event: MouseEvent | PointerEvent): number | null => {
  const point = getCanvasSourcePoint(event.clientX, event.clientY)
  if (!point) return null

  const metrics = getCanvasMetrics(point.canvasSize)
  const { x, y } = point

  if (
    x < metrics.gridX ||
    y < metrics.gridY ||
    x >= metrics.gridX + metrics.gridSize ||
    y >= metrics.gridY + metrics.gridSize
  ) {
    return null
  }

  const column = Math.min(previewColumns.value - 1, Math.floor((x - metrics.gridX) / metrics.cellSize))
  const row = Math.min(previewRows.value - 1, Math.floor((y - metrics.gridY) / metrics.cellSize))

  return row * previewColumns.value + column
}

const onCanvasWheel = (event: WheelEvent): void => {
  if (!event.ctrlKey) return

  event.preventDefault()
  const nextZoom = canvasZoom.value * Math.exp(-event.deltaY * 0.0012)
  zoomCanvasAtPoint(nextZoom, event.clientX, event.clientY)
}

const onCanvasPointerDown = (event: PointerEvent): void => {
  if (event.button !== 0) return

  const isPanMode = isSpacePressed.value
  if (patternCanvasStage.value && !patternCanvasStage.value.hasPointerCapture(event.pointerId)) {
    patternCanvasStage.value.setPointerCapture(event.pointerId)
  }
  canvasPointerState.value = {
    pointerId: event.pointerId,
    button: event.button,
    isPanMode,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startPanX: canvasPanX.value,
    startPanY: canvasPanY.value
  }
  isCanvasDragging.value = false

  if (isPanMode) {
    event.preventDefault()
  }
}

const onCanvasPointerMove = (event: PointerEvent): void => {
  const pointerState = canvasPointerState.value
  if (!pointerState || pointerState.pointerId !== event.pointerId) return

  const deltaX = event.clientX - pointerState.startClientX
  const deltaY = event.clientY - pointerState.startClientY

  if (!isCanvasDragging.value && Math.hypot(deltaX, deltaY) > CANVAS_DRAG_THRESHOLD) {
    isCanvasDragging.value = true
  }

  if (!pointerState.isPanMode || !isCanvasDragging.value) return

  const metrics = getCanvasViewportMetrics()
  const nextPan = getClampedCanvasPan(
    pointerState.startPanX + deltaX,
    pointerState.startPanY + deltaY,
    canvasZoom.value,
    metrics.stageWidth,
    metrics.stageHeight,
    metrics.shellWidth,
    metrics.shellHeight
  )
  canvasPanX.value = nextPan.x
  canvasPanY.value = nextPan.y
  event.preventDefault()
}

const onCanvasPointerUp = (event: PointerEvent): void => {
  const pointerState = canvasPointerState.value
  if (!pointerState || pointerState.pointerId !== event.pointerId) return

  const didDrag = isCanvasDragging.value
  canvasPointerState.value = null
  isCanvasDragging.value = false
  if (patternCanvasStage.value?.hasPointerCapture(event.pointerId)) {
    patternCanvasStage.value.releasePointerCapture(event.pointerId)
  }

  if (pointerState.isPanMode || didDrag) return

  const index = getCanvasCellIndex(event)
  if (index === null) return

  onCellClick(index)
}

const onCanvasPointerCancel = (event: PointerEvent): void => {
  if (canvasPointerState.value?.pointerId !== event.pointerId) return

  canvasPointerState.value = null
  isCanvasDragging.value = false
  if (patternCanvasStage.value?.hasPointerCapture(event.pointerId)) {
    patternCanvasStage.value.releasePointerCapture(event.pointerId)
  }
}

const onCanvasPointerEnter = (): void => {
  isCanvasStageHovered.value = true
}

const onCanvasPointerLeave = (): void => {
  if (canvasPointerState.value) return

  isCanvasStageHovered.value = false
}

const isEditableEventTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false

  const tagName = target.tagName.toLowerCase()
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select'
}

const isSpaceKeyEvent = (event: KeyboardEvent): boolean => {
  return event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar'
}

const syncPatternFullscreenState = (): void => {
  isPatternFullscreen.value = document.fullscreenElement === patternPreviewPanel.value || isPatternOverlayFullscreen.value
  void nextTick(drawPatternCanvas)
}

const togglePatternFullscreen = async (): Promise<void> => {
  generationError.value = ''

  try {
    if (isPatternOverlayFullscreen.value) {
      isPatternOverlayFullscreen.value = false
      syncPatternFullscreenState()
      return
    }

    if (document.fullscreenElement === patternPreviewPanel.value) {
      await document.exitFullscreen()
      return
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen()
    }

    await patternPreviewPanel.value?.requestFullscreen()

    if (document.fullscreenElement !== patternPreviewPanel.value) {
      isPatternOverlayFullscreen.value = true
    }
  } catch (error) {
    isPatternOverlayFullscreen.value = true
    if (error instanceof Error) {
      console.warn(error.message)
    }
  } finally {
    syncPatternFullscreenState()
  }
}

const onPatternPreviewKeydown = (event: KeyboardEvent): void => {
  if (isSpaceKeyEvent(event) && (!isEditableEventTarget(event.target) || isCanvasStageHovered.value)) {
    isSpacePressed.value = true
    event.preventDefault()
    return
  }

  if (event.key !== 'Escape') return

  if (isAiSettingsOpen.value) {
    isAiSettingsOpen.value = false
    return
  }

  if (isPalettePickerOpen.value) {
    isPalettePickerOpen.value = false
    return
  }

  if (!isPatternOverlayFullscreen.value) return

  isPatternOverlayFullscreen.value = false
  syncPatternFullscreenState()
}

const onPatternPreviewKeyup = (event: KeyboardEvent): void => {
  if (!isSpaceKeyEvent(event)) return

  isSpacePressed.value = false
}

const resetCanvasInteraction = (): void => {
  isSpacePressed.value = false
  isCanvasStageHovered.value = false
  canvasPointerState.value = null
  isCanvasDragging.value = false
}

const getDisplayFileName = (filePath: string): string => {
  return filePath.split(/[\\/]/).pop() ?? filePath
}

const isSavedProjectPayload = (value: unknown): value is SavedProject => {
  if (typeof value !== 'object' || value === null) return false

  const project = value as Partial<SavedProject>
  return (
    project.schemaVersion === 1 &&
    project.appName === 'Perler Beads Studio' &&
    typeof project.pattern?.columns === 'number' &&
    typeof project.pattern?.rows === 'number' &&
    Array.isArray(project.pattern?.cells) &&
    project.pattern.cells.length === project.pattern.columns * project.pattern.rows
  )
}

const buildSavedProject = (): SavedProject => {
  return {
    schemaVersion: 1,
    appName: 'Perler Beads Studio',
    savedAt: new Date().toISOString(),
    board: {
      manufacturer: activeManufacturerPalette.value.id,
      boardSize: selectedBoardSize.value,
      maxColors: maxColors.value,
      inputMode: inputMode.value,
      dithering: enableDithering.value,
      cleanup: enablePixelCleanup.value,
      showLabels: showGridLabels.value
    },
    pattern: {
      columns: patternGrid.value.columns,
      rows: patternGrid.value.rows,
      cells: [...patternGrid.value.cells],
      sourceName: patternGrid.value.sourceName
    },
    ai: {
      providerId: selectedProviderId.value,
      baseUrl: baseUrl.value,
      modelId: selectedModel.value,
      optimizationMode: defaultAiOptimizationMode,
      prompt: aiPrompt.value
    }
  }
}

const applySavedProject = (project: SavedProject, displayName: string): void => {
  isApplyingProject = true
  selectedManufacturer.value = getManufacturerPalette(project.board.manufacturer).id
  selectedBoardSize.value = project.board.boardSize
  inputMode.value = project.board.inputMode ?? 'image'
  maxColors.value = project.board.maxColors
  enableDithering.value = project.board.dithering
  enablePixelCleanup.value = project.board.cleanup ?? true
  showGridLabels.value = project.board.showLabels
  patternGrid.value = {
    columns: project.pattern.columns,
    rows: project.pattern.rows,
    cells: [...project.pattern.cells],
    sourceName: project.pattern.sourceName
  }
  selectedProviderId.value = project.ai.providerId
  const matchingProvider = aiProviderOptions.value.find((provider) => provider.id === project.ai.providerId)
  providerName.value = matchingProvider?.name ?? project.ai.providerId
  baseUrl.value = project.ai.baseUrl
  aiPrompt.value = project.ai.prompt ?? ''

  if (!modelOptions.value.includes(project.ai.modelId)) {
    modelOptions.value = [project.ai.modelId, ...modelOptions.value]
  }

  selectedModel.value = project.ai.modelId
  capabilitiesByModel.value = { ...(matchingProvider?.capabilitiesByModel ?? {}) }
  sourceFile.value = null
  aiReferenceDataUrl.value = ''
  aiReferenceName.value = ''
  aiOptimizeStatus.value = ''
  aiOptimizeError.value = ''
  hasManualEdits.value = false
  undoStack.value = []
  redoStack.value = []
  generationError.value = ''
  generationMessage.value = `已打开 ${displayName}`
  projectStatus.value = `已打开 ${displayName}`
  window.setTimeout(() => {
    isApplyingProject = false
  }, 0)
}

const downloadProjectFile = (project: SavedProject): void => {
  const blob = new Blob([`${JSON.stringify(project, null, 2)}\n`], { type: 'application/json' })
  const link = document.createElement('a')
  link.download = `perler-pattern-${project.pattern.columns}x${project.pattern.rows}.pbd.json`
  link.href = URL.createObjectURL(blob)
  link.click()
  URL.revokeObjectURL(link.href)
}

const saveProject = async (): Promise<void> => {
  const project = buildSavedProject()

  if (window.perler?.project) {
    const result = await window.perler.project.saveProject({ project })

    if (result.canceled) return

    if (!result.ok) {
      generationError.value = result.error ?? '保存失败'
      return
    }

    const displayName = result.filePath ? getDisplayFileName(result.filePath) : '项目文件'
    projectStatus.value = `已保存 ${displayName}`
    generationMessage.value = `已保存 ${displayName}`
    hasManualEdits.value = false
    return
  }

  downloadProjectFile(project)
  projectStatus.value = '已下载项目文件'
  generationMessage.value = '已下载项目文件'
  hasManualEdits.value = false
}

const openProject = async (): Promise<void> => {
  if (window.perler?.project) {
    const result = await window.perler.project.openProject()

    if (result.canceled) return

    if (!result.ok || !result.project) {
      generationError.value = result.error ?? '打开失败'
      return
    }

    applySavedProject(result.project, result.filePath ? getDisplayFileName(result.filePath) : '项目文件')
    return
  }

  projectFileInput.value?.click()
}

const onProjectFileSelected = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  try {
    const payload = JSON.parse(await file.text()) as unknown

    if (!isSavedProjectPayload(payload)) {
      generationError.value = '项目文件格式不正确'
      return
    }

    applySavedProject(payload, file.name)
  } catch (error) {
    generationError.value = error instanceof Error ? error.message : '打开失败'
  } finally {
    input.value = ''
  }
}

const isLocalWebPreview = (): boolean => {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(window.location.hostname)
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const parseJsonResponse = async (response: Response): Promise<unknown> => {
  try {
    return (await response.json()) as unknown
  } catch {
    return null
  }
}

const getApiErrorMessage = (payload: unknown): string | undefined => {
  if (!isRecord(payload)) return undefined
  if (isRecord(payload.error) && typeof payload.error.message === 'string') {
    return payload.error.message
  }
  if (typeof payload.message === 'string') {
    return payload.message
  }
  return undefined
}

const stopAiOptimizeTimer = (): void => {
  if (aiOptimizeTimer === null) return

  window.clearInterval(aiOptimizeTimer)
  aiOptimizeTimer = null
}

const startAiOptimizeTimer = (): void => {
  stopAiOptimizeTimer()
  aiOptimizeElapsedSeconds.value = 0
  aiOptimizeTimer = window.setInterval(() => {
    aiOptimizeElapsedSeconds.value += 1
  }, 1000)
}

const getFirstImageResult = (
  payload: unknown
): { b64Json?: string; url?: string; revisedPrompt?: string } | null => {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return null

  for (const item of payload.data) {
    if (!isRecord(item)) continue

    const b64Json = typeof item.b64_json === 'string' ? item.b64_json : undefined
    const url = typeof item.url === 'string' ? item.url : undefined
    const revisedPrompt = typeof item.revised_prompt === 'string' ? item.revised_prompt : undefined

    if (b64Json || url) {
      return { b64Json, url, revisedPrompt }
    }
  }

  return null
}

const readBlobAsDataUrl = async (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('图片结果读取失败'))
    reader.readAsDataURL(blob)
  })
}

const readRemoteImageAsDataUrlInBrowser = async (url: string): Promise<string> => {
  if (url.startsWith('data:image/')) return url

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`图片下载失败: HTTP ${response.status}`)
  }

  return readBlobAsDataUrl(await response.blob())
}

const listModelsInBrowser = async (): Promise<AiListModelsResult> => {
  const response = await fetch(buildAiModelsUrl(baseUrl.value), {
    headers: {
      Authorization: `Bearer ${apiKey.value}`,
      Accept: 'application/json'
    }
  })

  if (!response.ok) {
    return { ok: false, models: [], error: `模型拉取失败: HTTP ${response.status}` }
  }

  const payload = (await response.json()) as {
    data?: Array<{ id?: string; created?: number; owned_by?: string }>
  }

  return {
    ok: true,
    models:
      payload.data
        ?.filter((model) => typeof model.id === 'string' && model.id.length > 0)
        .map((model) => ({ id: model.id as string, created: model.created, ownedBy: model.owned_by })) ?? []
  }
}

const optimizeImageInBrowser = async (
  imageFile: File,
  request: AiImageOptimizationRequest
): Promise<AiImageOptimizationResult> => {
  if (!isLocalWebPreview()) {
    return { ok: false, error: 'Web 预览 AI 直连仅限本地开发地址' }
  }

  const body = new FormData()

  body.append('model', request.model.trim())
  body.append('prompt', createAiImageOptimizationPrompt(request))
  body.append('size', '960x960')
  body.append('image', imageFile, imageFile.name)

  try {
    const response = await fetch(buildAiImageEditsUrl(request.baseUrl), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${request.apiKey}`,
        Accept: 'application/json'
      },
      body
    })
    const payload = await parseJsonResponse(response)

    if (!response.ok) {
      return {
        ok: false,
        error: getApiErrorMessage(payload) ?? `AI 优化失败: HTTP ${response.status}`
      }
    }

    const imageResult = getFirstImageResult(payload)

    if (!imageResult) {
      return { ok: false, error: 'AI 接口未返回图片结果' }
    }

    const imageDataUrl = imageResult.b64Json
      ? imageResult.b64Json.startsWith('data:image/')
        ? imageResult.b64Json
        : `data:image/png;base64,${imageResult.b64Json}`
      : await readRemoteImageAsDataUrlInBrowser(imageResult.url as string)

    return {
      ok: true,
      imageDataUrl,
      revisedPrompt: imageResult.revisedPrompt
    }
  } catch (error) {
    if (error instanceof TypeError) {
      return { ok: false, error: 'Web 预览直连失败，可能是接口未开启 CORS 或网络不可达' }
    }

    const message = error instanceof Error ? error.message : 'AI 优化失败'
    return { ok: false, error: message }
  }
}

const fetchModels = async (): Promise<void> => {
  modelError.value = ''
  modelStatus.value = ''

  if (!baseUrl.value.trim()) {
    modelError.value = '请先填写 Base URL'
    return
  }

  if (!apiKey.value.trim() && !canUseStoredApiKey.value) {
    modelError.value = '请先填写 API Key'
    return
  }

  isFetchingModels.value = true

  try {
    const result = window.perler?.ai
      ? await window.perler.ai.listModels({
          baseUrl: baseUrl.value,
          apiKey: apiKey.value,
          providerProfileId: selectedProvider.value?.isSavedProfile ? selectedProviderId.value : undefined
        })
      : await listModelsInBrowser()

    if (!result.ok) {
      modelError.value = result.error ?? '模型拉取失败'
      return
    }

    if (result.models.length === 0) {
      modelError.value = '接口返回了空模型列表'
      return
    }

    const previousModel = selectedModel.value
    const imageModelIds = getImageGenerationModelIds(result.models.map((model) => model.id))

    if (imageModelIds.length === 0) {
      modelOptions.value = []
      selectedModel.value = ''
      modelError.value = `已拉取 ${result.models.length} 个模型，但未识别到生图模型`
      return
    }

    modelOptions.value = imageModelIds
    selectedModel.value = modelOptions.value.includes(previousModel) ? previousModel : modelOptions.value[0]
    modelStatus.value = `已拉取 ${result.models.length} 个模型，已过滤出 ${imageModelIds.length} 个生图模型`
  } catch (error) {
    modelError.value = error instanceof Error ? error.message : '模型拉取失败'
  } finally {
    isFetchingModels.value = false
  }
}

const optimizeImageWithAi = async (): Promise<void> => {
  const imageFile = sourceFile.value

  aiOptimizeError.value = ''
  aiOptimizeStatus.value = ''
  aiReferenceDataUrl.value = ''
  aiReferenceName.value = ''
  generationError.value = ''

  if (!imageFile) {
    aiOptimizeError.value = '请先导入原图'
    return
  }

  if (!baseUrl.value.trim()) {
    aiOptimizeError.value = '请先填写 Base URL'
    return
  }

  if (!apiKey.value.trim() && !canUseStoredApiKey.value) {
    aiOptimizeError.value = '请先填写 API Key'
    return
  }

  if (!selectedModel.value.trim()) {
    aiOptimizeError.value = '请先选择模型'
    return
  }

  isOptimizingImage.value = true
  startAiOptimizeTimer()
  const runtimeLabel = window.perler?.ai ? '桌面端' : 'Web 预览'
  generationMessage.value = `正在通过${runtimeLabel}调用 AI 优化原图`
  aiOptimizeStatus.value = window.perler?.ai
    ? '正在优化原图'
    : 'Web 预览直连中，API Key 仅用于本次请求'

  try {
    const imageDataUrl = await readImageFileAsDataUrl(imageFile)
    const { columns: requestBoardColumns, rows: requestBoardRows } = parseBoardSize(selectedBoardSize.value)
    const request: AiImageOptimizationRequest = {
      baseUrl: baseUrl.value,
      apiKey: apiKey.value,
      providerProfileId: selectedProvider.value?.isSavedProfile ? selectedProviderId.value : undefined,
      model: selectedModel.value,
      optimizationMode: defaultAiOptimizationMode,
      prompt: aiPrompt.value,
      boardColumns: requestBoardColumns,
      boardRows: requestBoardRows,
      manufacturerName: activeManufacturerPalette.value.name,
      maxColors: maxColors.value,
      paletteColors: activePaletteColors.value.map((color) => ({
        id: color.id,
        name: color.name,
        hex: color.hex
      })),
      imageDataUrl,
      imageName: imageFile.name
    }
    const result = window.perler?.ai
      ? await window.perler.ai.optimizeImage(request)
      : await optimizeImageInBrowser(imageFile, request)

    if (!result.ok || !result.imageDataUrl) {
      aiOptimizeError.value = result.error ?? 'AI 优化失败'
      generationError.value = aiOptimizeError.value
      return
    }

    aiReferenceDataUrl.value = result.imageDataUrl
    aiReferenceName.value = `AI 优化 · ${imageFile.name}`

    const nextPattern = await createPatternFromImageDataUrl(
      result.imageDataUrl,
      aiReferenceName.value,
      getPatternGenerationOptions()
    )

    patternGrid.value = nextPattern
    hasManualEdits.value = false
    undoStack.value = []
    redoStack.value = []
    generationMessage.value = '已从 AI 优化图生成图纸'
    aiOptimizeStatus.value = result.revisedPrompt ? 'AI 优化完成，已应用模型修订提示' : 'AI 优化完成'
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 优化失败'
    aiOptimizeError.value = message
    generationError.value = message
  } finally {
    isOptimizingImage.value = false
    stopAiOptimizeTimer()
  }
}

const regeneratePattern = async (): Promise<void> => {
  if (!sourceFile.value && !aiReferenceDataUrl.value) return

  const token = (generationToken += 1)
  isGenerating.value = true
  generationError.value = ''
  generationMessage.value = '正在转换图片'

  try {
    const nextPattern = aiReferenceDataUrl.value
      ? await createPatternFromImageDataUrl(
          aiReferenceDataUrl.value,
          aiReferenceName.value || 'AI 优化参考图',
          getPatternGenerationOptions()
        )
      : await createPatternFromImageFile(sourceFile.value as File, getPatternGenerationOptions())

    if (token !== generationToken) return

    patternGrid.value = nextPattern
    hasManualEdits.value = false
    undoStack.value = []
    redoStack.value = []
    generationMessage.value = `已从 ${nextPattern.sourceName} 生成图纸`
  } catch (error) {
    if (token !== generationToken) return
    generationError.value = error instanceof Error ? error.message : '图片转换失败'
    generationMessage.value = ''
  } finally {
    if (token === generationToken) {
      isGenerating.value = false
    }
  }
}

const generatePatternFromSourceImage = async (): Promise<void> => {
  if (!sourceFile.value) return

  const previousAiReferenceDataUrl = aiReferenceDataUrl.value
  const previousAiReferenceName = aiReferenceName.value
  aiReferenceDataUrl.value = ''
  aiReferenceName.value = ''

  try {
    await regeneratePattern()
  } finally {
    if (isAiOptimizeMode.value) {
      aiReferenceDataUrl.value = previousAiReferenceDataUrl
      aiReferenceName.value = previousAiReferenceName
    } else {
      aiOptimizeStatus.value = ''
      aiOptimizeError.value = ''
      aiOptimizeElapsedSeconds.value = 0
    }
  }
}

const onImageSelected = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  sourceFile.value = file
  aiReferenceDataUrl.value = ''
  aiReferenceName.value = ''
  aiOptimizeStatus.value = ''
  aiOptimizeError.value = ''
  aiOptimizeElapsedSeconds.value = 0
  generationError.value = ''
  generationMessage.value = `已选择 ${file.name}，点击${isAiOptimizeMode.value ? 'AI 优化原图' : '普通生成'}后生成图纸`
  input.value = ''
}

const onAiImageSelected = async (event: Event): Promise<void> => {
  await onImageSelected(event)
}

watch([selectedManufacturer, selectedBoardSize, inputMode, maxColors, enableDithering, enablePixelCleanup], () => {
  if (isApplyingProject) return

  const paletteColors = activePaletteColors.value

  if (maxColors.value > paletteColors.length) {
    maxColors.value = paletteColors.length
  }

  if (!paletteColors.some((color) => color.hex === selectedColorHex.value)) {
    selectedColorHex.value = paletteColors[3]?.hex ?? paletteColors[0].hex
  }
  isPalettePickerOpen.value = false
  paletteSearchQuery.value = ''

  generationError.value = ''

  if (isGeneratedFromSourceImage()) {
    void regeneratePattern()
    return
  }

  if (isGeneratedFromAiReference()) {
    void regeneratePattern()
    return
  }

  if (!sourceFile.value && isSamplePatternActive()) {
    patternGrid.value = createCurrentSamplePattern()
    hasManualEdits.value = false
    undoStack.value = []
    redoStack.value = []
    generationMessage.value = '示例图纸已按规格更新'
    return
  }

  generationMessage.value = sourceFile.value
    ? '图纸配置已更新，当前画布已保留；点击生成后应用新配置'
    : '图纸配置已更新，当前画布已保留'
})

const pushHistory = (): void => {
  undoStack.value.push([...patternGrid.value.cells])
  if (undoStack.value.length > 40) {
    undoStack.value.shift()
  }
  redoStack.value = []
}

const setPatternCells = (cells: string[]): void => {
  patternGrid.value = {
    ...patternGrid.value,
    cells
  }
  hasManualEdits.value = true
  generationMessage.value = '手工编辑未导出'
}

const replaceCell = (index: number, nextColor: string): void => {
  if (patternGrid.value.cells[index] === nextColor) return

  pushHistory()
  const nextCells = [...patternGrid.value.cells]
  nextCells[index] = nextColor
  setPatternCells(nextCells)
}

const floodFill = (startIndex: number, nextColor: string): void => {
  const targetColor = patternGrid.value.cells[startIndex]
  if (targetColor === nextColor) return

  pushHistory()
  const nextCells = [...patternGrid.value.cells]
  const stack = [startIndex]
  const visited = new Set<number>()
  const { columns, rows } = patternGrid.value

  while (stack.length > 0) {
    const index = stack.pop()
    if (index === undefined || visited.has(index) || nextCells[index] !== targetColor) continue

    visited.add(index)
    nextCells[index] = nextColor

    const x = index % columns
    const y = Math.floor(index / columns)
    if (x > 0) stack.push(index - 1)
    if (x < columns - 1) stack.push(index + 1)
    if (y > 0) stack.push(index - columns)
    if (y < rows - 1) stack.push(index + columns)
  }

  setPatternCells(nextCells)
}

const onCellClick = (index: number): void => {
  isPalettePickerOpen.value = false
  const currentColor = patternGrid.value.cells[index]

  if (activeTool.value === 'eyedropper') {
    if (isEmptyCell(currentColor)) {
      activeTool.value = 'eraser'
      return
    }

    selectedColorHex.value = currentColor
    activeTool.value = 'pencil'
    return
  }

  if (activeTool.value === 'eraser') {
    replaceCell(index, EMPTY_CELL)
    return
  }

  if (activeTool.value === 'fill') {
    floodFill(index, selectedColorHex.value)
    return
  }

  replaceCell(index, selectedColorHex.value)
}

const undo = (): void => {
  const previousCells = undoStack.value.pop()
  if (!previousCells) return

  redoStack.value.push([...patternGrid.value.cells])
  setPatternCells(previousCells)
}

const redo = (): void => {
  const nextCells = redoStack.value.pop()
  if (!nextCells) return

  undoStack.value.push([...patternGrid.value.cells])
  setPatternCells(nextCells)
}

const exportPattern = (): void => {
  try {
    exportPatternAsPng(patternGrid.value, {
      showLabels: showGridLabels.value,
      palette: activePaletteColors.value,
      manufacturer: activeManufacturerPalette.value.name
    })
    generationMessage.value = 'PNG 图纸已导出'
  } catch (error) {
    generationError.value = error instanceof Error ? error.message : '导出失败'
  }
}

const printPattern = (): void => {
  try {
    printPatternSheet(patternGrid.value, {
      showLabels: showGridLabels.value,
      palette: activePaletteColors.value,
      manufacturer: activeManufacturerPalette.value.name,
      title: patternGrid.value.sourceName
    })
    generationMessage.value = '打印预览已调用，可另存为 PDF'
  } catch (error) {
    generationError.value = error instanceof Error ? error.message : '打印失败'
  }
}

const exportInventory = (): void => {
  try {
    exportBeadInventoryAsCsv(patternGrid.value, activePaletteColors.value, activeManufacturerPalette.value.name)
    generationMessage.value = '用珠清单已导出'
  } catch (error) {
    generationError.value = error instanceof Error ? error.message : '导出失败'
  }
}

watch(selectedModel, () => {
  if (selectedModel.value && !modelOptions.value.includes(selectedModel.value)) {
    modelOptions.value = [selectedModel.value, ...modelOptions.value]
  }
})

watch(aiCreationMode, () => {
  if (!sourceFile.value) return

  generationError.value = ''
  generationMessage.value = `已选择 ${sourceFile.value.name}，点击${isAiOptimizeMode.value ? 'AI 优化原图' : '普通生成'}后生成图纸`
})

watch([patternGrid, showGridLabels, resolvedTheme], () => {
  void nextTick(drawPatternCanvas)
}, { deep: true })

watch(canvasBaseSize, () => {
  void nextTick(drawPatternCanvas)
})

onMounted(() => {
  void loadProviderProfiles()
  document.addEventListener('fullscreenchange', syncPatternFullscreenState)
  window.addEventListener('keydown', onPatternPreviewKeydown, true)
  window.addEventListener('keyup', onPatternPreviewKeyup, true)
  window.addEventListener('blur', resetCanvasInteraction)
  void nextTick(() => {
    updateCanvasBaseSize()
    drawPatternCanvas()

    if (patternCanvasStage.value) {
      canvasResizeObserver = new ResizeObserver(() => {
        updateCanvasBaseSize()
        setCanvasViewport(canvasZoom.value)
        void nextTick(drawPatternCanvas)
      })
      canvasResizeObserver.observe(patternCanvasStage.value)
    }
  })
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', syncPatternFullscreenState)
  window.removeEventListener('keydown', onPatternPreviewKeydown, true)
  window.removeEventListener('keyup', onPatternPreviewKeyup, true)
  window.removeEventListener('blur', resetCanvasInteraction)
  canvasResizeObserver?.disconnect()
  canvasResizeObserver = null
  stopAiOptimizeTimer()
})
</script>

<template>
  <div class="flex h-screen flex-col bg-ink-50 text-ink-900 dark:bg-ink-900 dark:text-ink-50" @click="closePalettePicker">
    <header
      class="flex h-16 shrink-0 items-center justify-between border-b border-ink-100 bg-white/82 px-5 dark:border-white/10 dark:bg-ink-800/78"
    >
      <div class="flex min-w-0 items-center gap-3">
        <div class="grid h-10 w-10 shrink-0 grid-cols-3 gap-0.5 rounded-md bg-ink-900 p-1 dark:bg-ink-50">
          <span class="rounded-sm bg-bead-coral"></span>
          <span class="rounded-sm bg-bead-mint"></span>
          <span class="rounded-sm bg-bead-amber"></span>
          <span class="rounded-sm bg-bead-sky"></span>
          <span class="rounded-sm bg-ink-50 dark:bg-ink-900"></span>
          <span class="rounded-sm bg-bead-violet"></span>
          <span class="rounded-sm bg-bead-amber"></span>
          <span class="rounded-sm bg-bead-coral"></span>
          <span class="rounded-sm bg-bead-mint"></span>
        </div>
        <div class="min-w-0">
          <h1 class="truncate text-base font-semibold">拼豆图纸工作台</h1>
          <p class="truncate text-xs text-ink-600 dark:text-ink-300">
            {{ previewColumns }} x {{ previewRows }} · {{ activeManufacturerPalette.name }} · {{ usedColors.length }} 色
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <div class="grid grid-cols-3 gap-1 rounded-md border border-ink-200 bg-ink-100 p-1 dark:border-white/10 dark:bg-ink-900">
          <button
            v-for="option in themeOptions"
            :key="option.value"
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded transition hover:brightness-105"
            :style="
              preference === option.value
                ? {
                    backgroundColor: resolvedTheme === 'dark' ? '#f8f7f4' : '#ffffff',
                    color: '#191715',
                    boxShadow: '0 1px 2px rgb(25 23 21 / 0.16)'
                  }
                : {
                    backgroundColor: 'transparent',
                    color: resolvedTheme === 'dark' ? '#ece8df' : '#63594d'
                  }
            "
            :title="`主题: ${option.label}`"
            @click="setPreference(option.value)"
          >
            <Icon :icon="option.icon" class="h-4 w-4" />
          </button>
        </div>

        <button
          class="inline-flex items-center gap-2 rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-700 transition hover:bg-ink-50 dark:border-white/10 dark:text-ink-200 dark:hover:bg-white/5"
          type="button"
          title="打开项目"
          @click="openProject"
        >
          <Icon icon="ri:folder-open-line" class="h-4 w-4" />
          <span>打开</span>
        </button>
        <button
          class="inline-flex items-center gap-2 rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-700 transition hover:bg-ink-50 dark:border-white/10 dark:text-ink-200 dark:hover:bg-white/5"
          type="button"
          title="保存项目"
          @click="saveProject"
        >
          <Icon icon="ri:save-3-line" class="h-4 w-4" />
          <span>保存</span>
        </button>
        <input
          ref="projectFileInput"
          class="hidden"
          type="file"
          accept=".pbd.json,.json,application/json"
          @change="onProjectFileSelected"
        />
        <button
          class="inline-flex items-center gap-2 rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-700 transition hover:bg-ink-50 dark:border-white/10 dark:text-ink-200 dark:hover:bg-white/5"
          type="button"
          title="打印或另存为 PDF"
          @click="printPattern"
        >
          <Icon icon="ri:printer-line" class="h-4 w-4" />
          <span>打印</span>
        </button>
        <button
          class="inline-flex items-center gap-2 rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-700 transition hover:bg-ink-50 dark:border-white/10 dark:text-ink-200 dark:hover:bg-white/5"
          type="button"
          title="导出 PNG 图纸"
          @click="exportPattern"
        >
          <Icon icon="ri:file-download-line" class="h-4 w-4" />
          <span>导出</span>
        </button>
      </div>
    </header>

    <main class="flex min-h-0 flex-1 flex-col">
      <div
        class="grid min-h-0 flex-1 grid-cols-[minmax(250px,300px)_minmax(300px,1fr)_minmax(280px,340px)] gap-4 p-4"
      >
        <section
          class="tool-scroll min-h-0 overflow-auto rounded-md border border-ink-100 bg-white p-4 shadow-panel dark:border-white/10 dark:bg-ink-800"
        >
          <div>
            <div class="mb-4 flex items-center gap-2">
              <Icon icon="ri:settings-3-line" class="h-5 w-5 text-bead-coral" />
              <h3 class="text-sm font-semibold">图纸规格</h3>
            </div>

            <div class="space-y-4">
              <label class="block space-y-1.5">
                <span class="text-xs font-medium text-ink-600 dark:text-ink-300">厂商色卡</span>
                <select
                  v-model="selectedManufacturer"
                  class="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-bead-mint dark:border-white/10 dark:bg-ink-900"
                >
                  <option
                    v-for="palette in manufacturerPalettes"
                    :key="palette.id"
                    :value="palette.id"
                  >
                    {{ palette.name }} · {{ palette.colors.length }} 色
                  </option>
                </select>
              </label>

              <label class="block space-y-1.5">
                <span class="text-xs font-medium text-ink-600 dark:text-ink-300">画板规格</span>
                <select
                  v-model="selectedBoardSize"
                  class="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-bead-mint dark:border-white/10 dark:bg-ink-900"
                >
                  <option v-for="size in boardSizes" :key="size">{{ size }}</option>
                </select>
              </label>

              <label class="block space-y-2">
                <span class="flex items-center justify-between text-xs font-medium text-ink-600 dark:text-ink-300">
                  <span>最大颜色数</span>
                  <span>{{ maxColors }}</span>
                </span>
                <input
                  v-model.number="maxColors"
                  class="w-full accent-bead-coral"
                  type="range"
                  min="8"
                  :max="activePaletteColors.length"
                  step="1"
                />
              </label>

              <label
                v-if="!isAiOptimizeMode"
                class="flex items-center justify-between rounded-md border border-ink-100 px-3 py-2 dark:border-white/10"
              >
                <span class="text-sm">开启抖色</span>
                <input v-model="enableDithering" class="h-4 w-4 accent-bead-mint" type="checkbox" />
              </label>

              <label
                v-if="!isAiOptimizeMode"
                class="flex items-center justify-between rounded-md border border-ink-100 px-3 py-2 dark:border-white/10"
              >
                <span class="text-sm">像素清理</span>
                <input v-model="enablePixelCleanup" class="h-4 w-4 accent-bead-amber" type="checkbox" />
              </label>

              <label
                class="flex items-center justify-between rounded-md border border-ink-100 px-3 py-2 dark:border-white/10"
              >
                <span class="text-sm">显示标号</span>
                <input v-model="showGridLabels" class="h-4 w-4 accent-bead-sky" type="checkbox" />
              </label>

              <div class="rounded-md border border-ink-100 p-3 text-xs dark:border-white/10">
                <span class="block text-ink-500 dark:text-ink-400">来源</span>
                <strong class="mt-1 block truncate">{{ patternGrid.sourceName }}</strong>
                <span
                  class="mt-2 block text-ink-600 dark:text-ink-300"
                  :class="generationError ? 'text-bead-coral' : ''"
                >
                  {{ generationError || generationMessage }}
                </span>
                <span class="mt-1 block text-ink-500 dark:text-ink-400">
                  {{ projectStatus }}
                </span>
                <span v-if="isAiOptimizeMode" class="mt-2 block text-bead-sky">
                  AI 优化：抖色和像素清理暂不参与本次生成
                </span>
              </div>
            </div>
          </div>

          <div class="mt-6 border-t border-ink-100 pt-4 dark:border-white/10">
            <div class="mb-3 flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <Icon icon="ri:file-list-3-line" class="h-5 w-5 text-bead-amber" />
                <h3 class="text-sm font-semibold">用珠清单</h3>
              </div>
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-md border border-ink-200 px-2 py-1 text-xs text-ink-700 transition hover:bg-ink-50 dark:border-white/10 dark:text-ink-200 dark:hover:bg-white/5"
                title="导出 CSV 清单"
                @click="exportInventory"
              >
                <Icon icon="ri:download-2-line" class="h-3.5 w-3.5" />
                <span>CSV</span>
              </button>
            </div>

            <div class="rounded-md border border-ink-100 dark:border-white/10">
              <div
                v-for="item in beadInventory"
                :key="item.hex"
                class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-ink-100 px-2 py-2 text-xs last:border-b-0 dark:border-white/10"
              >
                <span
                  class="h-5 w-5 rounded-sm border border-ink-200 dark:border-white/10"
                  :style="{ backgroundColor: item.hex }"
                ></span>
                <div class="min-w-0">
                  <strong class="block truncate">{{ item.id }} · {{ item.name }}</strong>
                  <span class="block truncate text-ink-500 dark:text-ink-400">{{ item.hex }}</span>
                </div>
                <div class="text-right">
                  <strong class="block">{{ item.count }}</strong>
                  <span class="block text-[10px] text-ink-500 dark:text-ink-400">
                    {{ (item.percentage * 100).toFixed(1) }}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          ref="patternPreviewPanel"
          class="pattern-preview-panel flex min-h-0 flex-col rounded-md border border-ink-100 bg-white shadow-panel dark:border-white/10 dark:bg-ink-800"
          :class="{ 'is-overlay-fullscreen': isPatternOverlayFullscreen }"
        >
          <div class="flex items-center justify-between border-b border-ink-100 px-4 py-3 dark:border-white/10">
            <div class="flex items-center gap-2">
              <Icon icon="ri:grid-line" class="h-5 w-5 text-bead-mint" />
              <h3 class="text-sm font-semibold">图纸预览</h3>
            </div>
            <div class="flex items-center gap-1">
              <button
                class="rounded-md p-2 text-ink-600 transition hover:bg-ink-100 disabled:opacity-40 dark:text-ink-300 dark:hover:bg-white/10"
                type="button"
                title="缩小"
                :disabled="canvasZoom <= 0.5"
                @click="zoomCanvasOut"
              >
                <Icon icon="ri:zoom-out-line" class="h-4 w-4" />
              </button>
              <button
                class="min-w-14 rounded-md px-2 py-1.5 text-xs font-semibold text-ink-600 transition hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-white/10"
                type="button"
                title="重置缩放和位置"
                @click="resetCanvasViewport"
              >
                {{ canvasZoomPercent }}%
              </button>
              <button
                class="rounded-md p-2 text-ink-600 transition hover:bg-ink-100 disabled:opacity-40 dark:text-ink-300 dark:hover:bg-white/10"
                type="button"
                title="放大"
                :disabled="canvasZoom >= 8"
                @click="zoomCanvasIn"
              >
                <Icon icon="ri:zoom-in-line" class="h-4 w-4" />
              </button>
              <button
                class="rounded-md p-2 text-ink-600 transition hover:bg-ink-100 disabled:opacity-40 dark:text-ink-300 dark:hover:bg-white/10"
                type="button"
                title="撤销"
                :disabled="undoStack.length === 0"
                @click="undo"
              >
                <Icon icon="ri:arrow-go-back-line" class="h-4 w-4" />
              </button>
              <button
                class="rounded-md p-2 text-ink-600 transition hover:bg-ink-100 disabled:opacity-40 dark:text-ink-300 dark:hover:bg-white/10"
                type="button"
                title="重做"
                :disabled="redoStack.length === 0"
                @click="redo"
              >
                <Icon icon="ri:arrow-go-forward-line" class="h-4 w-4" />
              </button>
              <button
                v-for="tool in editorTools"
                :key="tool.id"
                class="rounded-md p-2 transition"
                :class="
                  activeTool === tool.id
                    ? 'bg-ink-900 text-white dark:bg-ink-50 dark:text-ink-900'
                    : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-white/10'
                "
                type="button"
                :title="tool.label"
                @click="activeTool = tool.id"
              >
                <Icon :icon="tool.icon" class="h-4 w-4" />
              </button>
              <button
                class="rounded-md p-2 text-ink-600 transition hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-white/10"
                type="button"
                :title="isPatternFullscreen ? '退出全屏' : '全屏预览'"
                @click="togglePatternFullscreen"
              >
                <Icon :icon="isPatternFullscreen ? 'ri:fullscreen-exit-line' : 'ri:fullscreen-line'" class="h-4 w-4" />
              </button>
            </div>
          </div>

          <div
            ref="patternCanvasStage"
            class="pattern-canvas-stage flex min-h-0 flex-1 touch-none select-none items-center justify-center overflow-hidden bg-ink-50 p-5 dark:bg-ink-900"
            :class="canvasCursorClass"
            @wheel="onCanvasWheel"
            @pointerdown="onCanvasPointerDown"
            @pointermove="onCanvasPointerMove"
            @pointerup="onCanvasPointerUp"
            @pointercancel="onCanvasPointerCancel"
            @pointerenter="onCanvasPointerEnter"
            @pointerleave="onCanvasPointerLeave"
          >
            <div
              ref="patternCanvasShell"
              class="pattern-canvas-shell origin-center rounded-md border border-ink-200 bg-white p-3 shadow-panel will-change-transform dark:border-white/10 dark:bg-ink-800"
              :style="canvasShellStyle"
            >
              <div ref="patternCanvasFrame" class="flex h-full w-full items-center justify-center">
                <canvas
                  ref="patternCanvas"
                  class="h-full max-h-full max-w-full touch-none select-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ink-400/40 dark:focus-visible:ring-white/35"
                  role="img"
                  tabindex="0"
                  :aria-label="`拼豆图纸预览，${previewColumns} x ${previewRows}`"
                ></canvas>
              </div>
            </div>
          </div>

          <div class="border-t border-ink-100 px-4 py-3 dark:border-white/10">
            <div class="flex min-w-0 items-center gap-3">
              <div class="relative flex shrink-0 items-center gap-2">
                <Icon icon="ri:palette-line" class="h-4 w-4 text-bead-violet" />
                <span class="text-xs font-semibold text-ink-600 dark:text-ink-300">当前用色</span>
                <button
                  class="inline-flex h-9 max-w-44 items-center gap-2 rounded-md border border-ink-200 bg-white px-2.5 text-left text-xs transition hover:border-ink-300 hover:bg-ink-50 dark:border-white/10 dark:bg-ink-800 dark:hover:bg-white/5"
                  :class="isPalettePickerOpen ? 'border-bead-violet ring-2 ring-bead-violet/20' : ''"
                  type="button"
                  :title="`从 ${activeManufacturerPalette.name} 色卡选择颜色`"
                  @click.stop="isPalettePickerOpen = !isPalettePickerOpen"
                >
                  <span
                    class="h-5 w-5 shrink-0 rounded border border-ink-200 dark:border-white/10"
                    :style="{ backgroundColor: selectedColorHex }"
                  ></span>
                  <span class="min-w-0">
                    <span class="block truncate font-semibold text-ink-800 dark:text-ink-100">{{ selectedColor.id }}</span>
                    <span class="block truncate text-[10px] text-ink-500 dark:text-ink-400">{{ selectedColor.name }}</span>
                  </span>
                  <Icon icon="ri:arrow-down-s-line" class="h-4 w-4 shrink-0 text-ink-500 dark:text-ink-400" />
                </button>

                <div
                  v-if="isPalettePickerOpen"
                  class="absolute bottom-11 left-0 z-30 w-[min(34rem,calc(100vw-2rem))] rounded-md border border-ink-100 bg-white shadow-panel dark:border-white/10 dark:bg-ink-800"
                  @click.stop
                >
                  <div class="flex items-center gap-2 border-b border-ink-100 p-3 dark:border-white/10">
                    <Icon icon="ri:search-line" class="h-4 w-4 shrink-0 text-ink-500 dark:text-ink-400" />
                    <input
                      v-model="paletteSearchQuery"
                      class="h-9 min-w-0 flex-1 rounded-md border border-ink-100 bg-ink-50 px-3 text-sm outline-none transition focus:border-bead-violet dark:border-white/10 dark:bg-ink-900"
                      type="search"
                      placeholder="搜索编号、名称或 HEX"
                    />
                    <button
                      class="rounded-md p-2 text-ink-500 transition hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-white/10"
                      type="button"
                      title="关闭色卡"
                      @click="isPalettePickerOpen = false"
                    >
                      <Icon icon="ri:close-line" class="h-4 w-4" />
                    </button>
                  </div>

                  <div class="flex items-center justify-between gap-3 px-3 py-2 text-xs text-ink-500 dark:text-ink-400">
                    <span class="truncate">{{ activeManufacturerPalette.name }} · {{ filteredPaletteColors.length }} / {{ activePaletteColors.length }} 色</span>
                    <span class="shrink-0 truncate">{{ selectedColorLabel }}</span>
                  </div>

                  <div class="tool-scroll grid max-h-80 grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-2 overflow-y-auto px-3 pb-3">
                    <button
                      v-for="color in filteredPaletteColors"
                      :key="color.id"
                      type="button"
                      class="min-h-20 rounded-md border p-2 text-left text-[11px] transition hover:border-ink-300 hover:bg-ink-50 dark:border-white/10 dark:hover:bg-white/5"
                      :class="
                        selectedColorHex === color.hex
                          ? 'border-bead-coral bg-bead-coral/10 ring-2 ring-bead-coral/20'
                          : 'border-ink-100'
                      "
                      :title="`${color.id} ${color.name} ${color.hex}`"
                      @click="selectPaletteColor(color.hex)"
                    >
                      <span class="block h-7 rounded border border-ink-100 dark:border-white/10" :style="{ backgroundColor: color.hex }"></span>
                      <span class="mt-1 block truncate font-semibold text-ink-800 dark:text-ink-100">{{ color.id }}</span>
                      <span class="block truncate text-ink-500 dark:text-ink-400">{{ color.name }}</span>
                      <span v-if="usedColorCounts.get(color.hex)" class="mt-1 block text-[10px] text-bead-violet">
                        已用 {{ usedColorCounts.get(color.hex) }}
                      </span>
                    </button>
                  </div>

                  <div v-if="filteredPaletteColors.length === 0" class="px-3 pb-3 text-sm text-ink-500 dark:text-ink-400">
                    没有匹配的颜色
                  </div>
                </div>
              </div>
              <div class="tool-scroll flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
                <button
                  v-for="color in displayedColors"
                  :key="color.id"
                  type="button"
                  class="grid h-14 min-w-24 grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 rounded-md border px-2 text-left text-[11px] transition hover:border-ink-300 dark:border-white/10"
                  :class="
                    selectedColorHex === color.hex
                      ? 'border-bead-coral bg-bead-coral/10'
                      : 'border-ink-100'
                  "
                  :title="`${color.id} ${color.name}`"
                  @click="selectPaletteColor(color.hex)"
                >
                  <span class="h-8 w-8 rounded border border-ink-100 dark:border-white/10" :style="{ backgroundColor: color.hex }"></span>
                  <span class="min-w-0">
                    <span class="block truncate font-semibold">{{ color.id }}</span>
                    <span class="block truncate text-ink-500 dark:text-ink-400">{{ color.count }}</span>
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div
            class="grid grid-cols-6 gap-3 border-t border-ink-100 px-4 py-3 text-sm dark:border-white/10"
          >
            <div>
              <span class="block text-xs text-ink-500 dark:text-ink-400">格子</span>
              <strong>{{ previewColumns * previewRows }}</strong>
            </div>
            <div>
              <span class="block text-xs text-ink-500 dark:text-ink-400">颜色</span>
              <strong>{{ actualUsedColorCount }}</strong>
            </div>
            <div>
              <span class="block text-xs text-ink-500 dark:text-ink-400">工具</span>
              <strong>{{ editorTools.find((tool) => tool.id === activeTool)?.label }}</strong>
            </div>
            <div>
              <span class="block text-xs text-ink-500 dark:text-ink-400">状态</span>
              <strong>{{ patternStatus }}</strong>
            </div>
            <div>
              <span class="block text-xs text-ink-500 dark:text-ink-400">标号</span>
              <strong>{{ showGridLabels ? '显示' : '隐藏' }}</strong>
            </div>
            <div>
              <span class="block text-xs text-ink-500 dark:text-ink-400">清理</span>
              <strong>{{ isAiOptimizeMode ? '不参与' : enablePixelCleanup ? '开启' : '关闭' }}</strong>
            </div>
          </div>
        </section>

        <section
          class="tool-scroll min-h-0 overflow-auto rounded-md border border-ink-100 bg-white p-4 shadow-panel dark:border-white/10 dark:bg-ink-800"
        >
          <div class="mb-4 flex items-center justify-between gap-3">
            <div class="flex min-w-0 items-center gap-2">
              <Icon icon="ri:layout-grid-line" class="h-5 w-5 text-bead-sky" />
              <h3 class="text-sm font-semibold">图纸生成</h3>
            </div>
          </div>

          <form class="space-y-4" @submit.prevent>
            <div class="space-y-2">
              <span class="text-xs font-medium text-ink-600 dark:text-ink-300">生成方式</span>
              <div class="grid grid-cols-2 gap-1 rounded-md border border-ink-200 bg-ink-100 p-1 dark:border-white/10 dark:bg-ink-900">
                <button
                  v-for="mode in aiCreationModes"
                  :key="mode.id"
                  class="rounded px-3 py-2 text-sm font-semibold transition hover:brightness-105"
                  :style="
                    aiCreationMode === mode.id
                      ? {
                          backgroundColor: resolvedTheme === 'dark' ? '#f8f7f4' : '#ffffff',
                          color: '#191715',
                          boxShadow: '0 1px 2px rgb(25 23 21 / 0.16)'
                        }
                      : {
                          backgroundColor: resolvedTheme === 'dark' ? '#191715' : 'transparent',
                          color: resolvedTheme === 'dark' ? '#ece8df' : '#63594d'
                        }
                  "
                  type="button"
                  @click="aiCreationMode = mode.id"
                >
                  {{ mode.label }}
                </button>
              </div>
              <span class="block text-[11px] text-ink-500 dark:text-ink-400">
                {{ aiCreationModes.find((mode) => mode.id === aiCreationMode)?.description }}
              </span>
            </div>


            <label
              class="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-ink-200 bg-ink-50 px-3 py-6 text-center transition hover:border-bead-sky hover:bg-bead-sky/5 dark:border-white/10 dark:bg-ink-900 dark:hover:bg-bead-sky/10"
              title="上传 AI 参考图片"
            >
              <Icon icon="ri:image-add-line" class="h-8 w-8 text-bead-sky" />
              <span class="mt-2 text-sm font-semibold text-ink-800 dark:text-ink-100">
                {{ sourceFile ? '更换图片' : '上传图片' }}
              </span>
              <span class="mt-1 block max-w-full truncate text-xs text-ink-500 dark:text-ink-400">
                {{ sourceFile?.name || patternGrid.sourceName }}
              </span>
              <input class="hidden" type="file" accept="image/*" @change="onAiImageSelected" />
            </label>

            <div
              v-if="isAiOptimizeMode"
              class="rounded-md border border-ink-100 bg-ink-50 p-3 dark:border-white/10 dark:bg-ink-900"
            >
              <div class="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h4 class="text-xs font-semibold text-ink-700 dark:text-ink-100">AI 服务</h4>
                  <p class="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400">选择 API 厂商和生图模型</p>
                </div>
                <button
                  class="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-ink-200 px-2.5 py-1.5 text-xs font-semibold text-ink-700 transition hover:bg-white dark:border-white/10 dark:text-ink-100 dark:hover:bg-white/10"
                  type="button"
                  title="配置 API 厂商"
                  @click="isAiSettingsOpen = true"
                >
                  <Icon icon="ri:settings-4-line" class="h-3.5 w-3.5" />
                  <span>配置</span>
                </button>
              </div>

              <label class="block space-y-1.5">
                <span class="block text-xs font-medium text-ink-600 dark:text-ink-300">API 厂商</span>
                <select
                  v-model="selectedProviderId"
                  class="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-800 outline-none transition focus:border-bead-sky dark:border-white/10 dark:bg-ink-900 dark:text-ink-100"
                  @change="onProviderChange"
                >
                  <option :value="NEW_PROVIDER_ID" disabled>
                    {{ aiProviderOptions.length === 0 ? '请先配置 API 厂商' : '请选择 API 厂商' }}
                  </option>
                  <option v-for="provider in aiProviderOptions" :key="provider.id" :value="provider.id">
                    {{ provider.name }}
                  </option>
                </select>
              </label>

              <div class="mt-3 rounded-md border border-ink-100 bg-white px-3 py-2 text-xs dark:border-white/10 dark:bg-ink-800">
                <span class="block text-ink-500 dark:text-ink-400">模型</span>
                <strong class="mt-1 block truncate text-ink-800 dark:text-ink-100">{{ selectedModel || '未选择' }}</strong>
              </div>
            </div>

            <label v-if="isAiOptimizeMode" class="block space-y-1.5">
              <span class="text-xs font-medium text-ink-600 dark:text-ink-300">提示词</span>
              <textarea
                v-model="aiPrompt"
                class="min-h-32 w-full resize-y rounded-md border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-bead-sky dark:border-white/10 dark:bg-ink-900"
                placeholder="例如：保留主体轮廓，简化背景，把颜色压成清晰的大色块"
              ></textarea>
            </label>

            <button
              v-if="!isAiOptimizeMode"
              class="inline-flex w-full items-center justify-center gap-2 rounded-md bg-bead-mint px-3 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-55"
              type="button"
              title="普通生成图纸"
              :disabled="!sourceFile || isGenerating"
              @click="generatePatternFromSourceImage"
            >
              <Icon icon="ri:grid-line" class="h-4 w-4" :class="isGenerating ? 'animate-spin' : ''" />
              <span>{{ isGenerating ? '生成中' : '普通生成' }}</span>
            </button>

            <button
              v-else
              class="inline-flex w-full items-center justify-center gap-2 rounded-md bg-bead-coral px-3 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-55"
              type="button"
              title="AI 优化原图"
              :disabled="!sourceFile || isOptimizingImage || isGenerating"
              @click="optimizeImageWithAi"
            >
              <Icon :icon="isOptimizingImage ? 'ri:loader-4-line' : 'ri:magic-line'" class="h-4 w-4" :class="isOptimizingImage ? 'animate-spin' : ''" />
              <span>{{ isOptimizingImage ? 'AI 优化中' : 'AI 优化原图' }}</span>
            </button>

            <div
              v-if="isAiOptimizeMode"
              class="overflow-hidden rounded-md border border-ink-100 bg-ink-50 dark:border-white/10 dark:bg-ink-900"
            >
              <div
                v-if="isOptimizingImage"
                class="flex min-h-36 flex-col items-center justify-center gap-3 px-3 py-5 text-center"
              >
                <span class="relative inline-flex h-10 w-10 items-center justify-center">
                  <span class="absolute h-full w-full animate-ping rounded-full bg-bead-sky/25"></span>
                  <Icon icon="ri:loader-4-line" class="relative h-6 w-6 animate-spin text-bead-sky" />
                </span>
                <div>
                  <strong class="block text-sm">AI 正在优化原图</strong>
                  <span class="mt-1 block text-xs text-ink-500 dark:text-ink-400">
                    已等待 {{ aiOptimizeElapsedLabel }}
                  </span>
                </div>
              </div>
              <div
                v-else-if="aiOptimizeError"
                class="min-h-28 px-3 py-4 text-sm"
              >
                <div class="flex items-start gap-2 rounded-md border border-bead-coral/30 bg-bead-coral/10 px-3 py-2 text-bead-coral">
                  <Icon icon="ri:error-warning-line" class="mt-0.5 h-4 w-4 shrink-0" />
                  <div class="min-w-0">
                    <strong class="block">AI 优化失败</strong>
                    <span class="mt-1 block break-words text-xs">{{ aiOptimizeError }}</span>
                    <span class="mt-1 block text-xs">耗时 {{ aiOptimizeElapsedLabel }}</span>
                  </div>
                </div>
              </div>
              <div
                v-else-if="aiReferenceDataUrl"
                class="space-y-2 p-3"
              >
                <div class="overflow-hidden rounded-md border border-ink-100 bg-white dark:border-white/10 dark:bg-ink-800">
                  <img
                    class="max-h-48 w-full object-contain"
                    :src="aiReferenceDataUrl"
                    :alt="aiReferenceName || 'AI 优化结果'"
                  />
                </div>
                <div class="rounded-md border border-bead-mint/30 bg-bead-mint/10 px-3 py-2 text-xs text-ink-700 dark:text-ink-100">
                  <strong class="block">{{ aiOptimizeStatus || 'AI 优化完成' }}</strong>
                  <span class="mt-1 block text-ink-500 dark:text-ink-400">耗时 {{ aiOptimizeElapsedLabel }}</span>
                </div>
              </div>
              <div
                v-else
                class="flex min-h-28 flex-col items-center justify-center px-3 py-5 text-center text-xs text-ink-500 dark:text-ink-400"
              >
                <Icon icon="ri:image-edit-line" class="mb-2 h-6 w-6 text-bead-sky" />
                <span>AI 优化结果将在这里显示</span>
              </div>
            </div>

            <p
              v-if="!isAiOptimizeMode && (aiOptimizeStatus || aiOptimizeError)"
              class="rounded-md border px-3 py-2 text-xs"
              :class="
                aiOptimizeError
                  ? 'border-bead-coral/30 bg-bead-coral/10 text-bead-coral'
                  : 'border-bead-sky/30 bg-bead-sky/10 text-ink-700 dark:text-ink-100'
              "
            >
              {{ aiOptimizeError || aiOptimizeStatus }}
            </p>
          </form>

        </section>
      </div>
    </main>

    <div
      v-if="isAiSettingsOpen"
      class="fixed inset-0 z-40 flex items-center justify-center bg-ink-900/45 p-4"
    >
      <section
        class="flex max-h-[min(50rem,calc(100vh-2rem))] w-full max-w-6xl flex-col rounded-xl border border-ink-100 bg-ink-50 shadow-panel dark:border-white/10 dark:bg-ink-900"
      >
        <div class="flex items-start justify-between gap-3 px-6 py-5">
          <div class="min-w-0">
            <div class="flex min-w-0 items-center gap-2">
              <Icon icon="ri:settings-4-line" class="h-5 w-5 text-bead-sky" />
              <h3 class="truncate text-xl font-black tracking-tight">API 设置</h3>
            </div>
            <p class="mt-1 text-xs font-medium text-ink-500 dark:text-ink-400">
              管理平台地址、模型列表和 Key。Key 写入后端安全存储，页面不会显示完整内容。
            </p>
          </div>
          <button
            class="rounded-md p-2 text-ink-500 transition hover:bg-white dark:text-ink-300 dark:hover:bg-white/10"
            type="button"
            title="关闭"
            @click="isAiSettingsOpen = false"
          >
            <Icon icon="ri:close-line" class="h-4 w-4" />
          </button>
        </div>

        <form class="tool-scroll grid min-h-0 gap-4 overflow-auto px-6 pb-6 lg:grid-cols-[17rem_minmax(0,1fr)]" @submit.prevent>
          <input
            autocomplete="username"
            class="hidden"
            tabindex="-1"
            type="text"
            value="ai-provider"
          />

          <aside
            class="rounded-xl border border-ink-100 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-ink-800"
          >
            <div class="mb-3 px-2 text-xs font-semibold text-ink-500 dark:text-ink-400">平台列表</div>
            <div class="space-y-2">
              <button
                v-for="provider in aiProviderOptions"
                :key="provider.id"
                type="button"
                class="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition"
                :class="
                  selectedProviderId === provider.id
                    ? 'bg-ink-100 text-ink-900 dark:bg-white/10 dark:text-white'
                    : 'text-ink-600 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-white/5'
                "
                @click="
                  selectedProviderId = provider.id;
                  onProviderChange()
                "
              >
                <span
                  class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-50 dark:bg-ink-900"
                >
                  <Icon :icon="provider.isSavedProfile ? 'ri:key-2-line' : 'ri:apps-2-line'" class="h-4 w-4" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-bold">{{ provider.name }}</span>
                  <span class="block truncate text-[11px] text-ink-500 dark:text-ink-400">
                    {{ provider.baseUrl }}
                  </span>
                </span>
                <span
                  class="rounded-full bg-ink-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-500 dark:bg-ink-900 dark:text-ink-400"
                >
                  Saved
                </span>
              </button>
              <div
                v-if="aiProviderOptions.length === 0"
                class="rounded-lg border border-dashed border-ink-200 px-3 py-8 text-center text-xs font-semibold text-ink-400 dark:border-white/10"
              >
                暂无已保存平台
              </div>
            </div>

            <div class="mt-4 border-t border-ink-100 pt-4 dark:border-white/10">
              <button
                class="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-ink-200 px-3 py-2.5 text-sm font-semibold text-ink-600 transition hover:bg-ink-50 dark:border-white/10 dark:text-ink-300 dark:hover:bg-white/5"
                type="button"
                @click="resetProviderForm"
              >
                <Icon icon="ri:add-line" class="h-4 w-4" />
                <span>新增平台</span>
              </button>
            </div>
          </aside>

          <div class="min-w-0 space-y-4">
            <div
              class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-ink-800"
            >
              <div class="min-w-0">
                <h4 class="truncate text-2xl font-black tracking-tight">{{ providerName || selectedProvider.name }}</h4>
                <p class="mt-1 text-xs font-semibold text-ink-500 dark:text-ink-400">
                  配置基础信息、API Key 和可用生图模型
                </p>
              </div>
              <div class="flex shrink-0 gap-2">
                <button
                  class="inline-flex items-center justify-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-50 disabled:opacity-50 dark:border-white/10 dark:text-ink-200 dark:hover:bg-white/5"
                  type="button"
                  title="删除供应商档案"
                  :disabled="!selectedProvider.isSavedProfile || isDeletingProvider"
                  @click="deleteProviderProfile"
                >
                  <Icon icon="ri:delete-bin-line" class="h-4 w-4" :class="isDeletingProvider ? 'animate-spin' : ''" />
                  <span>删除</span>
                </button>
                <button
                  class="inline-flex items-center justify-center gap-2 rounded-lg bg-ink-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-700 disabled:opacity-50 dark:bg-white dark:text-ink-900"
                  type="button"
                  title="保存供应商档案"
                  :disabled="isSavingProvider"
                  @click="saveProviderProfile"
                >
                  <Icon icon="ri:save-3-line" class="h-4 w-4" :class="isSavingProvider ? 'animate-spin' : ''" />
                  <span>保存</span>
                </button>
              </div>
            </div>

            <div
              class="rounded-xl border border-ink-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-ink-800"
            >
              <div class="mb-4 border-b border-ink-100 pb-3 dark:border-white/10">
                <h5 class="text-sm font-bold">基本信息</h5>
                <p class="mt-1 text-xs font-medium text-ink-500 dark:text-ink-400">
                  平台显示名、请求地址和 API Key
                </p>
              </div>

              <div class="space-y-4">
                <label class="block space-y-1.5">
                  <span class="text-xs font-semibold text-ink-600 dark:text-ink-300">平台名称</span>
                  <input
                    v-model="providerName"
                    class="w-full rounded-lg border border-ink-200 bg-ink-50 px-3 py-3 text-sm font-semibold outline-none focus:border-bead-sky dark:border-white/10 dark:bg-ink-900"
                    type="text"
                  />
                  <span class="text-[11px] font-medium text-ink-500 dark:text-ink-400">
                    平台 ID: {{ selectedProviderId }}
                  </span>
                </label>

                <label class="block space-y-1.5">
                  <span class="text-xs font-semibold text-ink-600 dark:text-ink-300">请求地址</span>
                  <input
                    v-model="baseUrl"
                    class="w-full rounded-lg border border-ink-200 bg-ink-50 px-3 py-3 text-sm font-semibold outline-none focus:border-bead-sky dark:border-white/10 dark:bg-ink-900"
                    type="url"
                  />
                </label>

                <label class="block space-y-1.5">
                  <span class="text-xs font-semibold text-ink-600 dark:text-ink-300">API Key</span>
                  <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <input
                      v-model="apiKey"
                      class="w-full rounded-lg border border-ink-200 bg-ink-50 px-3 py-3 text-sm font-semibold outline-none focus:border-bead-sky dark:border-white/10 dark:bg-ink-900"
                      autocomplete="new-password"
                      :placeholder="selectedProviderHasStoredKey ? '保持当前 Key ********' : 'sk-...'"
                      type="password"
                    />
                    <button
                      class="inline-flex items-center justify-center gap-2 rounded-lg border border-ink-200 px-4 py-3 text-sm font-semibold text-ink-700 transition hover:bg-ink-50 dark:border-white/10 dark:text-ink-200 dark:hover:bg-white/5"
                      type="button"
                      title="保存供应商档案"
                      :disabled="isSavingProvider"
                      @click="saveProviderProfile"
                    >
                      <Icon icon="ri:check-line" class="h-4 w-4" />
                    </button>
                  </div>
                  <span class="text-[11px] font-medium text-ink-500 dark:text-ink-400">
                    {{ selectedProviderHasStoredKey ? '当前 Key 已保存，可留空继续使用' : 'Key 仅保存到桌面端安全存储，不写入项目文件' }}
                  </span>
                </label>
              </div>
            </div>

            <p
              v-if="providerStatus || providerError || (isDesktopAiRuntime && !secureStorageAvailable)"
              class="rounded-lg border px-3 py-2 text-xs"
              :class="
                providerError || (isDesktopAiRuntime && !secureStorageAvailable)
                  ? 'border-bead-coral/30 bg-bead-coral/10 text-bead-coral'
                  : 'border-bead-sky/30 bg-bead-sky/10 text-ink-700 dark:text-ink-100'
              "
            >
              {{
                providerError ||
                (!secureStorageAvailable ? '当前系统安全存储不可用，API Key 未保存' : providerStatus)
              }}
            </p>

            <div
              class="rounded-xl border border-ink-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-ink-800"
            >
              <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h5 class="text-sm font-bold">模型列表</h5>
                  <p class="mt-1 text-xs font-medium text-ink-500 dark:text-ink-400">
                    从上游 API 拉取后仅展示可识别的生图模型
                  </p>
                </div>
                <button
                  class="inline-flex items-center justify-center gap-2 rounded-lg bg-ink-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-700 disabled:opacity-50 dark:bg-white dark:text-ink-900"
                  type="button"
                  title="拉取模型"
                  :disabled="isFetchingModels"
                  @click="fetchModels"
                >
                  <Icon
                    icon="ri:refresh-line"
                    class="h-4 w-4"
                    :class="isFetchingModels ? 'animate-spin' : ''"
                  />
                  <span>{{ isFetchingModels ? '拉取中' : '拉取模型' }}</span>
                </button>
              </div>

              <div class="space-y-2">
                <label
                  v-for="model in modelOptions"
                  :key="model"
                  class="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 transition"
                  :class="
                    selectedModel === model
                      ? 'border-bead-sky bg-bead-sky/10'
                      : 'border-ink-100 bg-ink-50 hover:border-ink-200 dark:border-white/10 dark:bg-ink-900 dark:hover:border-white/20'
                  "
                >
                  <input v-model="selectedModel" class="sr-only" name="ai-image-model" type="radio" :value="model" />
                  <Icon icon="ri:image-line" class="h-4 w-4 text-bead-sky" />
                  <span class="min-w-0 flex-1 truncate text-sm font-semibold">{{ model }}</span>
                  <Icon
                    v-if="selectedModel === model"
                    icon="ri:check-line"
                    class="h-4 w-4 text-bead-sky"
                  />
                </label>

                <div
                  v-if="modelOptions.length === 0"
                  class="rounded-lg border border-dashed border-ink-200 px-3 py-6 text-center text-sm font-semibold text-ink-400 dark:border-white/10"
                >
                  暂无生图模型
                </div>
              </div>

              <p
                v-if="modelStatus || modelError"
                class="mt-3 rounded-lg border px-3 py-2 text-xs"
                :class="
                  modelError
                    ? 'border-bead-coral/30 bg-bead-coral/10 text-bead-coral'
                    : 'border-bead-mint/30 bg-bead-mint/10 text-ink-700 dark:text-ink-100'
                "
              >
                {{ modelError || modelStatus }}
              </p>
            </div>
          </div>

        </form>
      </section>
    </div>
  </div>
</template>
