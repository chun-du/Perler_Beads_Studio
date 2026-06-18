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
import AiCreationModeSelector from './components/AiCreationModeSelector.vue'
import AiOptimizeResultPanel from './components/AiOptimizeResultPanel.vue'
import AiProviderSettingsModal from './components/AiProviderSettingsModal.vue'
import AppHeader from './components/AppHeader.vue'
import BeadInventoryPanel from './components/BeadInventoryPanel.vue'
import CurrentColorBar from './components/CurrentColorBar.vue'
import GenerationSourcePanel from './components/GenerationSourcePanel.vue'
import PatternPreviewStatusBar from './components/PatternPreviewStatusBar.vue'
import PixelArtCalibrationModal from './components/PixelArtCalibrationModal.vue'
import PatternPreviewToolbar from './components/PatternPreviewToolbar.vue'
import PatternSettingsPanel from './components/PatternSettingsPanel.vue'
import ShortcutHelpPopover from './components/ShortcutHelpPopover.vue'
import { usePatternEditor } from './composables/usePatternEditor'
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
import type { PatternGrid, PixelArtCalibration } from './utils/pattern'

type EditorTool = 'pencil' | 'fill' | 'eyedropper' | 'eraser'
type PatternInputMode = 'image' | 'pixel-art'
type AiCreationMode = 'generate' | 'optimize'
type PatternPreviewMode = 'chart' | 'effect'

interface CanvasPointerState {
  pointerId: number
  button: number
  isPanMode: boolean
  isPaintMode: boolean
  startClientX: number
  startClientY: number
  startPanX: number
  startPanY: number
}

interface CanvasPaintSession {
  cells: string[]
  hasChanges: boolean
  lastIndex: number | null
  nextColor: string
  pushedHistory: boolean
}

interface PixelArtCalibrationPointerState {
  pointerId: number
  startClientX: number
  startClientY: number
  startOffsetX: number
  startOffsetY: number
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

interface BrowserStoredAiProviderProfile extends Omit<AiProviderProfile, 'hasApiKey'> {
  apiKey?: string
}

interface BrowserStoredAiProviderProfilesStorage {
  schemaVersion: 1
  profiles: BrowserStoredAiProviderProfile[]
}

const { preference, resolvedTheme, setPreference, cycleTheme } = useTheme()

const boardSizes = ['32 x 32', '48 x 48', '64 x 64', '96 x 96']
const defaultAiOptimizationMode = '强制像素画风拼豆图纸优化'
const browserAiProviderProfilesStorageKey = 'perler.aiProviderProfiles.v1'
const aiModelCapabilities = ['image-generation', 'image-editing', 'vision', 'text'] satisfies AiModelCapability[]
const aiCreationModes: Array<{ id: AiCreationMode; label: string; description: string }> = [
  { id: 'generate', label: '普通生成', description: '直接用本地确定性逻辑生成图纸' },
  { id: 'optimize', label: 'AI 优化', description: '先优化原图，再生成图纸' }
]
const patternInputModes: Array<{ id: PatternInputMode; label: string; description: string }> = [
  {
    id: 'image',
    label: '普通图片',
    description: '按每个拼豆点位覆盖的原图面积取平均色，适合照片、插画和非标准尺寸图片。'
  },
  {
    id: 'pixel-art',
    label: '像素画',
    description: '按像素块主色匹配；可手动校准缩放和偏移，让原图像素块对齐拼豆方格。'
  }
]



const shortcutGroups = [
  {
    title: '\u7f16\u8f91\u5de5\u5177',
    items: [
      { keys: 'B / P', label: '\u753b\u7b14' },
      { keys: 'E', label: '\u6a61\u76ae' },
      { keys: 'F', label: '\u586b\u5145' },
      { keys: 'I', label: '\u5438\u7ba1' }
    ]
  },
  {
    title: '\u5386\u53f2\u4e0e\u6587\u4ef6',
    items: [
      { keys: 'Ctrl Z', label: '\u64a4\u9500' },
      { keys: 'Ctrl Shift Z / Ctrl Y', label: '\u91cd\u505a' },
      { keys: 'Ctrl S', label: '\u4fdd\u5b58' },
      { keys: 'Ctrl O', label: '\u6253\u5f00' }
    ]
  },
  {
    title: '\u9884\u89c8',
    items: [
      { keys: 'Space + \u62d6\u62fd', label: '\u5e73\u79fb\u753b\u5e03' },
      { keys: 'Ctrl + \u6eda\u8f6e', label: '\u7f29\u653e\u753b\u5e03' },
      { keys: '+ / - / 0', label: '\u7f29\u653e / \u590d\u4f4d' },
      { keys: 'G / V', label: '\u6807\u53f7 / \u9884\u89c8\u6a21\u5f0f' },
      { keys: 'Esc', label: '\u5173\u95ed\u9762\u677f' }
    ]
  }
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
const pixelArtScale = ref(1)
const pixelArtOffsetX = ref(0)
const pixelArtOffsetY = ref(0)
const isPixelArtCalibrationOpen = ref(false)
const pixelArtDraftScale = ref(1)
const pixelArtDraftOffsetX = ref(0)
const pixelArtDraftOffsetY = ref(0)
const patternPreviewMode = ref<PatternPreviewMode>('chart')
const activeManufacturerPalette = computed(() => getManufacturerPalette(selectedManufacturer.value))
const activePaletteColors = computed(() => activeManufacturerPalette.value.colors)
const createCurrentSamplePattern = (): PatternGrid => {
  const { columns, rows } = parseBoardSize(selectedBoardSize.value)
  return createSamplePattern(activePaletteColors.value, columns, rows)
}
const patternGrid = ref<PatternGrid>(createCurrentSamplePattern())
const sourceFile = ref<File | null>(null)
const sourcePreviewDataUrl = ref('')
const sourceImageNaturalWidth = ref(0)
const sourceImageNaturalHeight = ref(0)
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
const isShortcutHelpOpen = ref(false)
const paletteSearchQuery = ref('')
const isAiSettingsOpen = ref(false)
const aiPrompt = ref('')
const activeTool = ref<EditorTool>('pencil')
const {
  undoStack,
  redoStack,
  pushHistory,
  setPatternCells,
  replaceCell,
  floodFill,
  onCellClick,
  undo,
  redo
} = usePatternEditor({
  patternGrid,
  activeTool,
  selectedColorHex,
  hasManualEdits,
  generationMessage,
  closeOverlays: () => {
    isPalettePickerOpen.value = false
    isShortcutHelpOpen.value = false
  }
})
const projectFileInput = ref<HTMLInputElement | null>(null)
const patternPreviewPanel = ref<HTMLElement | null>(null)
const patternCanvasStage = ref<HTMLDivElement | null>(null)
const patternCanvasShell = ref<HTMLDivElement | null>(null)
const patternCanvas = ref<HTMLCanvasElement | null>(null)
const patternCanvasFrame = ref<HTMLDivElement | null>(null)
const pixelArtCalibrationStage = ref<HTMLDivElement | null>(null)
const projectStatus = ref('尚未保存')
const isPatternFullscreen = ref(false)
const isPatternOverlayFullscreen = ref(false)
const canvasZoom = ref(1)
const canvasPanX = ref(0)
const canvasPanY = ref(0)
const canvasBaseSize = ref(420)
const canvasPointerState = ref<CanvasPointerState | null>(null)
const canvasPaintSession = ref<CanvasPaintSession | null>(null)
const isCanvasDragging = ref(false)
const isSpacePressed = ref(false)
const isCanvasStageHovered = ref(false)
const pixelArtCalibrationPointerState = ref<PixelArtCalibrationPointerState | null>(null)
let generationToken = 0
let sourcePreviewToken = 0
let isApplyingProject = false
let canvasResizeObserver: ResizeObserver | null = null
let canvasRedrawFrame: number | null = null
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
const canUseStoredApiKey = computed(() => {
  if (!selectedProviderHasStoredKey.value) return false
  if (window.perler?.ai) return true

  return Boolean(getBrowserStoredApiKey(selectedProviderId.value))
})
const apiSettingsDescription = computed(() =>
  isDesktopAiRuntime.value
    ? '管理平台地址、模型列表和 Key。Key 写入后端安全存储，页面不会显示完整内容。'
    : '管理平台地址、模型列表和 Key。Web 预览会保存到当前浏览器本地存储，页面不会显示完整内容。'
)
const apiKeyStorageHint = computed(() => {
  if (selectedProviderHasStoredKey.value) return '当前 Key 已保存，可留空继续使用'

  return isDesktopAiRuntime.value
    ? 'Key 仅保存到桌面端安全存储，不写入项目文件'
    : 'Key 保存到当前浏览器本地存储，不写入项目文件'
})
const providerNoticeIsError = computed(() => Boolean(providerError.value || (isDesktopAiRuntime.value && !secureStorageAvailable.value)))
const providerNoticeMessage = computed(() => {
  if (providerError.value) return providerError.value
  if (isDesktopAiRuntime.value && !secureStorageAvailable.value) return '当前系统安全存储不可用，API Key 未保存'

  return providerStatus.value
})
const isAiOptimizeMode = computed(() => aiCreationMode.value === 'optimize')
const isPixelArtInputMode = computed(() => inputMode.value === 'pixel-art')
const selectedPatternInputMode = computed(
  () => patternInputModes.find((mode) => mode.id === inputMode.value) ?? patternInputModes[0]
)
const ditheringStatusLabel = computed(() => {
  if (isAiOptimizeMode.value || isPixelArtInputMode.value) return '不参与'

  return enableDithering.value ? '开启' : '关闭'
})
const cleanupStatusLabel = computed(() => {
  if (isAiOptimizeMode.value || isPixelArtInputMode.value) return '不参与'

  return enablePixelCleanup.value ? '开启' : '关闭'
})
const pixelArtCalibration = computed<PixelArtCalibration>(() => ({
  scale: pixelArtScale.value,
  offsetX: pixelArtOffsetX.value,
  offsetY: pixelArtOffsetY.value
}))
const pixelArtCalibrationLabel = computed(() => {
  return `缩放 ${pixelArtScale.value.toFixed(3)} · X ${pixelArtOffsetX.value.toFixed(2)} · Y ${pixelArtOffsetY.value.toFixed(2)}`
})
const getPixelArtImageStyle = (scale: number, offsetX: number, offsetY: number): Record<string, string> => {
  const { columns, rows } = parseBoardSize(selectedBoardSize.value)

  return {
    width: `${(Math.max(1, sourceImageNaturalWidth.value) * scale * 100) / columns}%`,
    height: `${(Math.max(1, sourceImageNaturalHeight.value) * scale * 100) / rows}%`,
    left: `${(offsetX * 100) / columns}%`,
    top: `${(offsetY * 100) / rows}%`
  }
}
const pixelArtCalibrationImageStyle = computed(() =>
  getPixelArtImageStyle(pixelArtScale.value, pixelArtOffsetX.value, pixelArtOffsetY.value)
)
const pixelArtCalibrationModalImageStyle = computed(() =>
  getPixelArtImageStyle(pixelArtDraftScale.value, pixelArtDraftOffsetX.value, pixelArtDraftOffsetY.value)
)
const pixelArtCalibrationBoardStyle = computed<Record<string, string>>(() => {
  const { columns, rows } = parseBoardSize(selectedBoardSize.value)

  return {
    aspectRatio: `${columns} / ${rows}`
  }
})
const getPixelArtCalibrationGridStyle = (lineColor: string): Record<string, string> => {
  const { columns, rows } = parseBoardSize(selectedBoardSize.value)

  return {
    backgroundImage: `linear-gradient(to right, ${lineColor} 1px, transparent 1px), linear-gradient(to bottom, ${lineColor} 1px, transparent 1px)`,
    backgroundSize: `calc(100% / ${columns}) calc(100% / ${rows})`
  }
}
const pixelArtCalibrationGridStyle = computed(() => getPixelArtCalibrationGridStyle('rgb(91 167 201 / 0.3)'))
const pixelArtCalibrationModalGridStyle = computed(() => getPixelArtCalibrationGridStyle('rgb(91 167 201 / 0.35)'))
const pixelArtCalibrationDraftLabel = computed(() => {
  return `缩放 ${pixelArtDraftScale.value.toFixed(3)} · X ${pixelArtDraftOffsetX.value.toFixed(2)} · Y ${pixelArtDraftOffsetY.value.toFixed(2)}`
})
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
  if (aiReferenceDataUrl.value && aiReferenceName.value && patternGrid.value.sourceName !== aiReferenceName.value) {
    return '待生成'
  }
  return sourceFile.value || aiReferenceDataUrl.value ? '已生成' : '草稿'
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
const isActualEffectPreview = computed(() => patternPreviewMode.value === 'effect')
const activeToolLabel = computed(() => (isActualEffectPreview.value ? '效果预览' : editorTools.find((tool) => tool.id === activeTool.value)?.label ?? '画笔'))
const canvasCursorClass = computed(() => {
  if (isCanvasDragging.value) return 'cursor-grabbing'
  if (isActualEffectPreview.value) return 'cursor-grab'
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
  isShortcutHelpOpen.value = false
}

const resetPixelArtCalibration = (): void => {
  const { columns, rows } = parseBoardSize(selectedBoardSize.value)
  const sourceWidth = Math.max(1, sourceImageNaturalWidth.value)
  const sourceHeight = Math.max(1, sourceImageNaturalHeight.value)
  const scale = Math.min(columns / sourceWidth, rows / sourceHeight)
  const fittedColumns = sourceWidth * scale
  const fittedRows = sourceHeight * scale

  pixelArtScale.value = Number(scale.toFixed(4))
  pixelArtOffsetX.value = Number(((columns - fittedColumns) / 2).toFixed(3))
  pixelArtOffsetY.value = Number(((rows - fittedRows) / 2).toFixed(3))
}

const resetPixelArtDraftCalibration = (): void => {
  const { columns, rows } = parseBoardSize(selectedBoardSize.value)
  const sourceWidth = Math.max(1, sourceImageNaturalWidth.value)
  const sourceHeight = Math.max(1, sourceImageNaturalHeight.value)
  const scale = Math.min(columns / sourceWidth, rows / sourceHeight)
  const fittedColumns = sourceWidth * scale
  const fittedRows = sourceHeight * scale

  pixelArtDraftScale.value = Number(scale.toFixed(4))
  pixelArtDraftOffsetX.value = Number(((columns - fittedColumns) / 2).toFixed(3))
  pixelArtDraftOffsetY.value = Number(((rows - fittedRows) / 2).toFixed(3))
}

const adjustPixelArtScale = (amount: number): void => {
  const nextScale = clampNumber(pixelArtScale.value + amount, 0.05, 8)
  pixelArtScale.value = Number(nextScale.toFixed(4))
}

const nudgePixelArtCalibration = (axis: 'x' | 'y', amount: number): void => {
  if (axis === 'x') {
    pixelArtOffsetX.value = Number((pixelArtOffsetX.value + amount).toFixed(3))
  } else {
    pixelArtOffsetY.value = Number((pixelArtOffsetY.value + amount).toFixed(3))
  }
}

const nudgePixelArtDraftCalibration = (axis: 'x' | 'y', amount: number): void => {
  if (axis === 'x') {
    pixelArtDraftOffsetX.value = Number((pixelArtDraftOffsetX.value + amount).toFixed(3))
  } else {
    pixelArtDraftOffsetY.value = Number((pixelArtDraftOffsetY.value + amount).toFixed(3))
  }
}

const openPixelArtCalibration = (): void => {
  if (!sourcePreviewDataUrl.value) return

  pixelArtDraftScale.value = pixelArtScale.value
  pixelArtDraftOffsetX.value = pixelArtOffsetX.value
  pixelArtDraftOffsetY.value = pixelArtOffsetY.value
  isPixelArtCalibrationOpen.value = true
}

const closePixelArtCalibration = (): void => {
  isPixelArtCalibrationOpen.value = false
  pixelArtCalibrationPointerState.value = null
}

const applyPixelArtCalibration = (): void => {
  const shouldGenerateAfterApply = Boolean(sourceFile.value && !isGeneratedFromSourceImage() && !isGeneratedFromAiReference())

  pixelArtScale.value = Number(pixelArtDraftScale.value.toFixed(4))
  pixelArtOffsetX.value = Number(pixelArtDraftOffsetX.value.toFixed(3))
  pixelArtOffsetY.value = Number(pixelArtDraftOffsetY.value.toFixed(3))
  closePixelArtCalibration()

  if (shouldGenerateAfterApply) {
    void generatePatternFromSourceImage()
  }
}

const updatePixelArtDraftScale = (
  nextScale: number,
  anchorClientX?: number,
  anchorClientY?: number
): void => {
  const normalizedScale = clampNumber(Number.isFinite(nextScale) ? nextScale : 1, 0.01, 32)
  const rect = pixelArtCalibrationStage.value?.getBoundingClientRect()

  if (!rect) {
    pixelArtDraftScale.value = Number(normalizedScale.toFixed(4))
    return
  }

  const { columns, rows } = parseBoardSize(selectedBoardSize.value)
  const anchorX = anchorClientX === undefined ? rect.width / 2 : clampNumber(anchorClientX - rect.left, 0, rect.width)
  const anchorY = anchorClientY === undefined ? rect.height / 2 : clampNumber(anchorClientY - rect.top, 0, rect.height)
  const gridX = (anchorX / Math.max(1, rect.width)) * columns
  const gridY = (anchorY / Math.max(1, rect.height)) * rows
  const sourceX = (gridX - pixelArtDraftOffsetX.value) / Math.max(0.01, pixelArtDraftScale.value)
  const sourceY = (gridY - pixelArtDraftOffsetY.value) / Math.max(0.01, pixelArtDraftScale.value)

  pixelArtDraftScale.value = Number(normalizedScale.toFixed(4))
  pixelArtDraftOffsetX.value = Number((gridX - sourceX * normalizedScale).toFixed(3))
  pixelArtDraftOffsetY.value = Number((gridY - sourceY * normalizedScale).toFixed(3))
}

const adjustPixelArtDraftScale = (amount: number): void => {
  updatePixelArtDraftScale(pixelArtDraftScale.value + amount)
}

const onPixelArtCalibrationPointerDown = (event: PointerEvent): void => {
  if (!sourcePreviewDataUrl.value || event.button !== 0) return

  event.preventDefault()
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture(event.pointerId)
  pixelArtCalibrationPointerState.value = {
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startOffsetX: pixelArtDraftOffsetX.value,
    startOffsetY: pixelArtDraftOffsetY.value
  }
}

const onPixelArtCalibrationPointerMove = (event: PointerEvent): void => {
  const pointerState = pixelArtCalibrationPointerState.value
  const rect = pixelArtCalibrationStage.value?.getBoundingClientRect()
  if (!pointerState || pointerState.pointerId !== event.pointerId || !rect) return

  const { columns, rows } = parseBoardSize(selectedBoardSize.value)
  const deltaX = ((event.clientX - pointerState.startClientX) / Math.max(1, rect.width)) * columns
  const deltaY = ((event.clientY - pointerState.startClientY) / Math.max(1, rect.height)) * rows

  pixelArtDraftOffsetX.value = Number((pointerState.startOffsetX + deltaX).toFixed(3))
  pixelArtDraftOffsetY.value = Number((pointerState.startOffsetY + deltaY).toFixed(3))
}

const onPixelArtCalibrationPointerUp = (event: PointerEvent): void => {
  if (pixelArtCalibrationPointerState.value?.pointerId !== event.pointerId) return

  pixelArtCalibrationPointerState.value = null
  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture(event.pointerId)) {
    target.releasePointerCapture(event.pointerId)
  }
}

const onPixelArtCalibrationWheel = (event: WheelEvent): void => {
  event.preventDefault()
  const zoomFactor = event.deltaY > 0 ? 0.94 : 1.06
  updatePixelArtDraftScale(pixelArtDraftScale.value * zoomFactor, event.clientX, event.clientY)
}

const readImageSize = async (source: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve({ width: image.naturalWidth || image.width, height: image.naturalHeight || image.height })
    image.onerror = () => reject(new Error('图片尺寸读取失败'))
    image.src = source
  })
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

const createBrowserProviderProfileId = (): string => {
  return `provider-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

const isValidAiModelCapability = (value: unknown): value is AiModelCapability => {
  return typeof value === 'string' && aiModelCapabilities.includes(value as AiModelCapability)
}

const normalizeProviderModels = (models: string[], selectedModelValue: string): string[] => {
  const uniqueModels = [...new Set(models.map((model) => model.trim()).filter(Boolean))]
  const normalizedSelectedModel = selectedModelValue.trim()

  if (normalizedSelectedModel && !uniqueModels.includes(normalizedSelectedModel)) {
    uniqueModels.unshift(normalizedSelectedModel)
  }

  return uniqueModels
}

const isBrowserStoredAiProviderProfile = (value: unknown): value is BrowserStoredAiProviderProfile => {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.baseUrl !== 'string') {
    return false
  }
  if (!Array.isArray(value.models) || !value.models.every((model) => typeof model === 'string')) return false
  if (typeof value.selectedModel !== 'string' || typeof value.updatedAt !== 'string') return false
  if (value.apiKey !== undefined && typeof value.apiKey !== 'string') return false
  if (!isRecord(value.capabilitiesByModel)) return false

  return Object.values(value.capabilitiesByModel).every((capabilities) => {
    return Array.isArray(capabilities) && capabilities.every(isValidAiModelCapability)
  })
}

const readBrowserStoredProviderProfiles = (): BrowserStoredAiProviderProfile[] => {
  try {
    const content = window.localStorage.getItem(browserAiProviderProfilesStorageKey)
    if (!content) return []

    const payload = JSON.parse(content) as unknown
    if (!isRecord(payload) || payload.schemaVersion !== 1 || !Array.isArray(payload.profiles)) return []

    return payload.profiles.filter(isBrowserStoredAiProviderProfile)
  } catch {
    return []
  }
}

const writeBrowserStoredProviderProfiles = (profiles: BrowserStoredAiProviderProfile[]): void => {
  const payload: BrowserStoredAiProviderProfilesStorage = {
    schemaVersion: 1,
    profiles
  }

  window.localStorage.setItem(browserAiProviderProfilesStorageKey, JSON.stringify(payload))
}

const toPublicBrowserProviderProfile = (profile: BrowserStoredAiProviderProfile): AiProviderProfile => {
  return {
    id: profile.id,
    name: profile.name,
    baseUrl: profile.baseUrl,
    models: profile.models,
    selectedModel: profile.selectedModel,
    capabilitiesByModel: profile.capabilitiesByModel,
    hasApiKey: Boolean(profile.apiKey?.trim()),
    updatedAt: profile.updatedAt
  }
}

const getBrowserStoredApiKey = (profileId: string): string => {
  const profile = readBrowserStoredProviderProfiles().find((item) => item.id === profileId)

  return profile?.apiKey?.trim() ?? ''
}

const getEffectiveBrowserApiKey = (): string => {
  const typedApiKey = apiKey.value.trim()
  if (typedApiKey) return typedApiKey
  if (!selectedProvider.value?.isSavedProfile) return ''

  return getBrowserStoredApiKey(selectedProviderId.value)
}

const selectAvailableProviderProfile = (): boolean => {
  const selected = aiProviderOptions.value.find((provider) => provider.id === selectedProviderId.value)

  if (selected) {
    onProviderChange()
    return true
  }

  if (!providerName.value && aiProviderOptions.value[0]) {
    selectedProviderId.value = aiProviderOptions.value[0].id
    onProviderChange()
    return true
  }

  return false
}

const saveBrowserProviderProfile = (): AiProviderProfile => {
  const storedProfiles = readBrowserStoredProviderProfiles()
  const profileId = selectedProvider.value?.isSavedProfile ? selectedProviderId.value : createBrowserProviderProfileId()
  const existingProfile = storedProfiles.find((profile) => profile.id === profileId)
  const selectedModelValue = selectedModel.value.trim()
  const models = normalizeProviderModels(modelOptions.value, selectedModelValue)
  const modelSet = new Set(models)
  const capabilitiesByImageModel = Object.fromEntries(
    Object.entries({
      ...capabilitiesByModel.value,
      [selectedModelValue]: ['image-generation' as AiModelCapability]
    })
      .filter(([model]) => modelSet.has(model))
      .map(([model, capabilities]) => [model, [...new Set(capabilities)]])
  )
  const nextProfile: BrowserStoredAiProviderProfile = {
    id: profileId,
    name: providerName.value.trim(),
    baseUrl: baseUrl.value.trim(),
    models,
    selectedModel: selectedModelValue,
    capabilitiesByModel: capabilitiesByImageModel,
    apiKey: apiKey.value.trim() || existingProfile?.apiKey,
    updatedAt: new Date().toISOString()
  }
  const nextProfiles = existingProfile
    ? storedProfiles.map((profile) => (profile.id === profileId ? nextProfile : profile))
    : [...storedProfiles, nextProfile]

  writeBrowserStoredProviderProfiles(nextProfiles)
  return toPublicBrowserProviderProfile(nextProfile)
}

const deleteBrowserProviderProfile = (profileId: string): void => {
  writeBrowserStoredProviderProfiles(readBrowserStoredProviderProfiles().filter((profile) => profile.id !== profileId))
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
    savedProviderProfiles.value = readBrowserStoredProviderProfiles().map(toPublicBrowserProviderProfile)
    providerStatus.value = selectAvailableProviderProfile()
      ? '已从浏览器本地存储载入供应商档案'
      : 'Web 预览会保存供应商档案到当前浏览器'
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
    selectAvailableProviderProfile()
  } catch (error) {
    providerError.value = error instanceof Error ? error.message : '供应商档案读取失败'
  }
}

const saveProviderProfile = async (): Promise<void> => {
  providerError.value = ''
  providerStatus.value = ''

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
    const result = window.perler?.ai
      ? await window.perler.ai.saveProviderProfile({
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
      : {
          ok: true,
          profile: saveBrowserProviderProfile(),
          secureStorageAvailable: false
        }
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
    providerStatus.value = window.perler?.ai
      ? profile.hasApiKey
        ? '供应商档案和 API Key 已安全保存'
        : '供应商档案已保存'
      : profile.hasApiKey
        ? '供应商档案和 API Key 已保存到浏览器本地存储'
        : '供应商档案已保存到浏览器本地存储'
  } catch (error) {
    providerError.value = error instanceof Error ? error.message : '供应商档案保存失败'
  } finally {
    isSavingProvider.value = false
  }
}

const deleteProviderProfile = async (): Promise<void> => {
  providerError.value = ''
  providerStatus.value = ''

  if (!selectedProvider.value?.isSavedProfile) {
    providerError.value = '只能删除已保存的供应商档案'
    return
  }

  isDeletingProvider.value = true

  try {
    const profileId = selectedProviderId.value
    const result = window.perler?.ai
      ? await window.perler.ai.deleteProviderProfile(profileId)
      : {
          ok: true,
          secureStorageAvailable: false
        }

    if (!window.perler?.ai) {
      deleteBrowserProviderProfile(profileId)
    }

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
  dithering: !isAiOptimizeMode.value && !isPixelArtInputMode.value && enableDithering.value,
  cleanup: !isAiOptimizeMode.value && !isPixelArtInputMode.value && enablePixelCleanup.value,
  inputMode: inputMode.value,
  palette: activePaletteColors.value,
  pixelArtCalibration: isPixelArtInputMode.value ? pixelArtCalibration.value : undefined
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
  const labelSize = showGridLabels.value && !isActualEffectPreview.value ? Math.max(22, Math.min(32, canvasSize * 0.056)) : 0
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

const drawActualEffectCanvas = (
  context: CanvasRenderingContext2D,
  metrics: CanvasMetrics,
  cells: string[],
  columns: number,
  isDark: boolean
): void => {
  const cellSize = metrics.cellSize
  const beadRadius = Math.max(0.8, cellSize * 0.42)
  const holeRadius = Math.max(0.35, beadRadius * 0.28)
  const canDrawDetails = cellSize >= 4
  const boardColor = isDark ? '#211f1c' : '#fffdf8'
  const emptyHoleColor = isDark ? 'rgb(255 255 255 / 0.08)' : 'rgb(25 23 21 / 0.06)'

  context.save()
  context.shadowColor = isDark ? 'rgb(0 0 0 / 0.28)' : 'rgb(65 54 40 / 0.12)'
  context.shadowBlur = Math.max(4, cellSize * 0.45)
  context.shadowOffsetY = Math.max(1, cellSize * 0.08)
  context.fillStyle = boardColor
  drawRoundedRect(context, metrics.gridX, metrics.gridY, metrics.gridSize, metrics.gridSize, Math.max(8, cellSize * 1.2))
  context.fill()
  context.restore()

  if (cellSize >= 6) {
    context.fillStyle = emptyHoleColor
    for (let index = 0; index < cells.length; index += 1) {
      if (!isEmptyCell(cells[index])) continue

      const x = index % columns
      const y = Math.floor(index / columns)
      const centerX = metrics.gridX + x * cellSize + cellSize / 2
      const centerY = metrics.gridY + y * cellSize + cellSize / 2

      context.beginPath()
      context.arc(centerX, centerY, Math.max(0.45, cellSize * 0.08), 0, Math.PI * 2)
      context.fill()
    }
  }

  for (let index = 0; index < cells.length; index += 1) {
    const color = cells[index]
    if (isEmptyCell(color)) continue

    const x = index % columns
    const y = Math.floor(index / columns)
    const centerX = metrics.gridX + x * cellSize + cellSize / 2
    const centerY = metrics.gridY + y * cellSize + cellSize / 2

    context.save()
    context.shadowColor = isDark ? 'rgb(0 0 0 / 0.36)' : 'rgb(48 39 31 / 0.18)'
    context.shadowBlur = Math.max(0.6, cellSize * 0.16)
    context.shadowOffsetY = Math.max(0.3, cellSize * 0.04)
    context.fillStyle = color
    context.beginPath()
    context.arc(centerX, centerY, beadRadius, 0, Math.PI * 2)
    context.fill()
    context.restore()

    if (!canDrawDetails) continue

    context.strokeStyle = isDark ? 'rgb(0 0 0 / 0.25)' : 'rgb(25 23 21 / 0.16)'
    context.lineWidth = Math.max(0.4, cellSize * 0.045)
    context.beginPath()
    context.arc(centerX, centerY, beadRadius, 0, Math.PI * 2)
    context.stroke()

    context.fillStyle = 'rgb(255 255 255 / 0.26)'
    context.beginPath()
    context.arc(centerX - beadRadius * 0.28, centerY - beadRadius * 0.32, Math.max(0.35, beadRadius * 0.18), 0, Math.PI * 2)
    context.fill()

    context.fillStyle = isDark ? 'rgb(18 16 14 / 0.42)' : 'rgb(255 255 255 / 0.7)'
    context.beginPath()
    context.arc(centerX, centerY, holeRadius, 0, Math.PI * 2)
    context.fill()

    context.strokeStyle = isDark ? 'rgb(0 0 0 / 0.28)' : 'rgb(25 23 21 / 0.12)'
    context.lineWidth = Math.max(0.35, cellSize * 0.035)
    context.beginPath()
    context.arc(centerX, centerY, holeRadius, 0, Math.PI * 2)
    context.stroke()
  }
}

const drawPatternCanvas = (): void => {
  canvasRedrawFrame = null
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

  if (isActualEffectPreview.value) {
    drawActualEffectCanvas(context, metrics, cells, columns, isDark)
    return
  }

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

  const canDrawCellDetails = cellSize >= 7
  const shouldUseRoundedCells = cellSize >= 5.5

  for (let index = 0; index < cells.length; index += 1) {
    const color = cells[index]
    const x = index % columns
    const y = Math.floor(index / columns)
    const cellX = metrics.gridX + x * cellSize
    const cellY = metrics.gridY + y * cellSize
    const inset = Math.max(0.45, Math.min(2.2, cellSize * 0.1))

    if (isEmptyCell(color)) {
      context.fillStyle = (x + y) % 2 === 0 ? (isDark ? '#211f1c' : '#ffffff') : (isDark ? '#25221f' : '#f3f0ea')
      context.fillRect(cellX, cellY, cellSize, cellSize)
      continue
    }

    context.fillStyle = color
    if (shouldUseRoundedCells) {
      drawRoundedRect(
        context,
        cellX + inset,
        cellY + inset,
        Math.max(0.5, cellSize - inset * 2),
        Math.max(0.5, cellSize - inset * 2),
        Math.max(1, cellSize * 0.14)
      )
      context.fill()
    } else {
      context.fillRect(
        cellX + inset,
        cellY + inset,
        Math.max(0.5, cellSize - inset * 2),
        Math.max(0.5, cellSize - inset * 2)
      )
    }

    if (canDrawCellDetails) {
      context.fillStyle = 'rgb(255 255 255 / 0.22)'
      context.beginPath()
      context.arc(cellX + cellSize * 0.36, cellY + cellSize * 0.32, Math.max(0.8, cellSize * 0.11), 0, Math.PI * 2)
      context.fill()
    }
  }

  context.strokeStyle = isDark ? 'rgb(255 255 255 / 0.12)' : 'rgb(25 23 21 / 0.14)'
  context.lineWidth = 1
  context.beginPath()

  for (let x = 0; x <= columns; x += 1) {
    const lineX = Math.round(metrics.gridX + x * cellSize) + 0.5

    context.moveTo(lineX, metrics.gridY)
    context.lineTo(lineX, metrics.gridY + metrics.gridSize)
  }

  for (let y = 0; y <= rows; y += 1) {
    const lineY = Math.round(metrics.gridY + y * cellSize) + 0.5

    context.moveTo(metrics.gridX, lineY)
    context.lineTo(metrics.gridX + metrics.gridSize, lineY)
  }
  context.stroke()

  context.strokeStyle = isDark ? 'rgb(255 255 255 / 0.42)' : 'rgb(25 23 21 / 0.48)'
  context.lineWidth = 1.5
  context.beginPath()

  for (let x = 0; x <= columns; x += 5) {
    const lineX = Math.round(metrics.gridX + x * cellSize) + 0.5

    context.moveTo(lineX, metrics.gridY)
    context.lineTo(lineX, metrics.gridY + metrics.gridSize)
  }

  for (let y = 0; y <= rows; y += 5) {
    const lineY = Math.round(metrics.gridY + y * cellSize) + 0.5

    context.moveTo(metrics.gridX, lineY)
    context.lineTo(metrics.gridX + metrics.gridSize, lineY)
  }
  context.stroke()

  context.strokeStyle = isDark ? 'rgb(255 255 255 / 0.55)' : 'rgb(25 23 21 / 0.55)'
  context.lineWidth = 2
  context.strokeRect(metrics.gridX + 0.5, metrics.gridY + 0.5, metrics.gridSize - 1, metrics.gridSize - 1)
}

const schedulePatternCanvasDraw = (): void => {
  if (canvasRedrawFrame !== null) return

  canvasRedrawFrame = window.requestAnimationFrame(drawPatternCanvas)
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


const getPaintColorForActiveTool = (): string | null => {
  if (activeTool.value === 'pencil') return selectedColorHex.value
  if (activeTool.value === 'eraser') return EMPTY_CELL
  return null
}

const applyCanvasPaintIndex = (index: number): void => {
  const session = canvasPaintSession.value
  if (!session || session.lastIndex === index) return

  session.lastIndex = index

  if (session.cells[index] === session.nextColor) return

  if (!session.pushedHistory) {
    pushHistory()
    session.pushedHistory = true
  }

  session.cells[index] = session.nextColor
  session.hasChanges = true
  patternGrid.value = {
    ...patternGrid.value,
    cells: [...session.cells]
  }
  hasManualEdits.value = true
  generationMessage.value = '\u624b\u5de5\u7f16\u8f91\u672a\u5bfc\u51fa'
}

const beginCanvasPaintSession = (startIndex: number, nextColor: string): void => {
  canvasPaintSession.value = {
    cells: [...patternGrid.value.cells],
    hasChanges: false,
    lastIndex: null,
    nextColor,
    pushedHistory: false
  }
  applyCanvasPaintIndex(startIndex)
}

const finishCanvasPaintSession = (): void => {
  const session = canvasPaintSession.value
  if (!session) return

  canvasPaintSession.value = null
  if (session.hasChanges) return
}

const cancelCanvasPaintSession = (): void => {
  const session = canvasPaintSession.value
  if (!session) return

  canvasPaintSession.value = null
  if (!session.pushedHistory) return

  const previousCells = undoStack.value.pop()
  if (previousCells) {
    patternGrid.value = {
      ...patternGrid.value,
      cells: previousCells
    }
  }
}

const onCanvasWheel = (event: WheelEvent): void => {
  if (!event.ctrlKey) return

  event.preventDefault()
  const nextZoom = canvasZoom.value * Math.exp(-event.deltaY * 0.0012)
  zoomCanvasAtPoint(nextZoom, event.clientX, event.clientY)
}

const onCanvasPointerDown = (event: PointerEvent): void => {
  if (event.button !== 0) return

  const isPanMode = isSpacePressed.value || isActualEffectPreview.value
  const paintColor = getPaintColorForActiveTool()
  const startIndex = !isPanMode && paintColor !== null ? getCanvasCellIndex(event) : null
  const isPaintMode = startIndex !== null

  if (patternCanvasStage.value && !patternCanvasStage.value.hasPointerCapture(event.pointerId)) {
    patternCanvasStage.value.setPointerCapture(event.pointerId)
  }
  canvasPointerState.value = {
    pointerId: event.pointerId,
    button: event.button,
    isPanMode,
    isPaintMode,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startPanX: canvasPanX.value,
    startPanY: canvasPanY.value
  }
  isCanvasDragging.value = false

  if (isPaintMode && startIndex !== null && paintColor !== null) {
    beginCanvasPaintSession(startIndex, paintColor)
    event.preventDefault()
    return
  }

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

  if (pointerState.isPaintMode) {
    const index = getCanvasCellIndex(event)
    if (index !== null) {
      applyCanvasPaintIndex(index)
    }
    event.preventDefault()
    return
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

  if (pointerState.isPaintMode) {
    finishCanvasPaintSession()
    event.preventDefault()
    return
  }

  if (pointerState.isPanMode || didDrag || isActualEffectPreview.value) return

  const index = getCanvasCellIndex(event)
  if (index === null) return

  onCellClick(index)
}

const onCanvasPointerCancel = (event: PointerEvent): void => {
  if (canvasPointerState.value?.pointerId !== event.pointerId) return

  cancelCanvasPaintSession()
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
  void nextTick(schedulePatternCanvasDraw)
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

const selectEditorTool = (tool: EditorTool): void => {
  patternPreviewMode.value = 'chart'
  activeTool.value = tool
  isPalettePickerOpen.value = false
  isShortcutHelpOpen.value = false
}

const canUseEditorShortcut = (event: KeyboardEvent): boolean => {
  return !isEditableEventTarget(event.target) && !isPixelArtCalibrationOpen.value
}

const onPatternPreviewKeydown = (event: KeyboardEvent): void => {
  if (isSpaceKeyEvent(event) && (!isEditableEventTarget(event.target) || isCanvasStageHovered.value)) {
    isSpacePressed.value = true
    event.preventDefault()
    return
  }

  if (event.key === 'Escape') {
    if (isPixelArtCalibrationOpen.value) {
      closePixelArtCalibration()
      return
    }

    if (isAiSettingsOpen.value) {
      isAiSettingsOpen.value = false
      return
    }

    if (isPalettePickerOpen.value) {
      isPalettePickerOpen.value = false
      return
    }

    if (isShortcutHelpOpen.value) {
      isShortcutHelpOpen.value = false
      return
    }

    if (!isPatternOverlayFullscreen.value) return

    isPatternOverlayFullscreen.value = false
    syncPatternFullscreenState()
    return
  }

  if (!canUseEditorShortcut(event)) return

  const key = event.key.toLowerCase()
  const hasCommandModifier = event.ctrlKey || event.metaKey

  if (hasCommandModifier && key === 'z') {
    event.preventDefault()
    if (event.shiftKey) {
      redo()
    } else {
      undo()
    }
    return
  }

  if (hasCommandModifier && key === 'y') {
    event.preventDefault()
    redo()
    return
  }

  if (hasCommandModifier && key === 's') {
    event.preventDefault()
    void saveProject()
    return
  }

  if (hasCommandModifier && key === 'o') {
    event.preventDefault()
    void openProject()
    return
  }

  if (hasCommandModifier || event.altKey) return

  if (key === 'b' || key === 'p') {
    event.preventDefault()
    selectEditorTool('pencil')
    return
  }

  if (key === 'e') {
    event.preventDefault()
    selectEditorTool('eraser')
    return
  }

  if (key === 'f') {
    event.preventDefault()
    selectEditorTool('fill')
    return
  }

  if (key === 'i') {
    event.preventDefault()
    selectEditorTool('eyedropper')
    return
  }

  if (key === 'g') {
    event.preventDefault()
    showGridLabels.value = !showGridLabels.value
    return
  }

  if (key === 'v') {
    event.preventDefault()
    patternPreviewMode.value = patternPreviewMode.value === 'chart' ? 'effect' : 'chart'
    return
  }

  if (key === '+' || key === '=') {
    event.preventDefault()
    zoomCanvasIn()
    return
  }

  if (key === '-' || key === '_') {
    event.preventDefault()
    zoomCanvasOut()
    return
  }

  if (key === '0') {
    event.preventDefault()
    resetCanvasViewport()
    return
  }
}

const onPatternPreviewKeyup = (event: KeyboardEvent): void => {
  if (!isSpaceKeyEvent(event)) return

  isSpacePressed.value = false
}

const resetCanvasInteraction = (): void => {
  finishCanvasPaintSession()
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
      pixelArtCalibration: pixelArtCalibration.value,
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
  pixelArtScale.value = project.board.pixelArtCalibration?.scale ?? 1
  pixelArtOffsetX.value = project.board.pixelArtCalibration?.offsetX ?? 0
  pixelArtOffsetY.value = project.board.pixelArtCalibration?.offsetY ?? 0
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
  sourcePreviewDataUrl.value = ''
  sourceImageNaturalWidth.value = 0
  sourceImageNaturalHeight.value = 0
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
  const effectiveApiKey = getEffectiveBrowserApiKey()
  const response = await fetch(buildAiModelsUrl(baseUrl.value), {
    headers: {
      Authorization: `Bearer ${effectiveApiKey}`,
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
  const isUsingSavedBrowserKey = !window.perler?.ai && !apiKey.value.trim() && selectedProviderHasStoredKey.value
  generationMessage.value = `正在通过${runtimeLabel}调用 AI 优化原图`
  aiOptimizeStatus.value = window.perler?.ai
    ? '正在优化原图'
    : isUsingSavedBrowserKey
      ? 'Web 预览直连中，正在使用已保存 Key'
      : 'Web 预览直连中，API Key 仅用于本次请求'

  try {
    const imageDataUrl = await readImageFileAsDataUrl(imageFile)
    const { columns: requestBoardColumns, rows: requestBoardRows } = parseBoardSize(selectedBoardSize.value)
    const effectiveApiKey = window.perler?.ai ? apiKey.value : getEffectiveBrowserApiKey()
    const request: AiImageOptimizationRequest = {
      baseUrl: baseUrl.value,
      apiKey: effectiveApiKey,
      providerProfileId: selectedProvider.value?.isSavedProfile ? selectedProviderId.value : undefined,
      model: selectedModel.value,
      optimizationMode: defaultAiOptimizationMode,
      prompt: aiPrompt.value,
      boardColumns: requestBoardColumns,
      boardRows: requestBoardRows,
      manufacturerName: activeManufacturerPalette.value.name,
      maxColors: maxColors.value,
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

const onProcessedImageSelected = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file || isOptimizingImage.value || isGenerating.value) {
    input.value = ''
    return
  }

  const token = (generationToken += 1)
  isGenerating.value = true
  aiOptimizeError.value = ''
  generationError.value = ''
  aiOptimizeElapsedSeconds.value = 0
  aiOptimizeStatus.value = '正在导入已优化图，未调用 AI'
  generationMessage.value = '正在从已优化图生成图纸'

  try {
    const dataUrl = await readImageFileAsDataUrl(file)
    const referenceName = `已优化图 · ${file.name}`
    const nextPattern = await createPatternFromImageDataUrl(
      dataUrl,
      referenceName,
      getPatternGenerationOptions()
    )

    if (token !== generationToken) return

    aiReferenceDataUrl.value = dataUrl
    aiReferenceName.value = referenceName
    patternGrid.value = nextPattern
    hasManualEdits.value = false
    undoStack.value = []
    redoStack.value = []
    aiOptimizeStatus.value = '已导入已优化图并生成图纸，未调用 AI'
    generationMessage.value = `已从 ${file.name} 生成图纸（未调用 AI）`
  } catch (error) {
    if (token !== generationToken) return

    const message = error instanceof Error ? error.message : '已优化图导入失败'
    aiOptimizeError.value = message
    generationError.value = message
    generationMessage.value = ''
  } finally {
    if (token === generationToken) {
      isGenerating.value = false
    }

    input.value = ''
  }
}

const onImageSelected = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  const previewToken = (sourcePreviewToken += 1)
  sourceFile.value = file
  sourcePreviewDataUrl.value = ''
  aiReferenceDataUrl.value = ''
  aiReferenceName.value = ''
  aiOptimizeStatus.value = ''
  aiOptimizeError.value = ''
  aiOptimizeElapsedSeconds.value = 0
  generationError.value = ''
  generationMessage.value = `已选择 ${file.name}，点击${isAiOptimizeMode.value ? 'AI 优化原图' : '普通生成'}后生成图纸`
  input.value = ''

  try {
    const dataUrl = await readImageFileAsDataUrl(file)
    const imageSize = await readImageSize(dataUrl)

    if (previewToken !== sourcePreviewToken) return

    sourcePreviewDataUrl.value = dataUrl
    sourceImageNaturalWidth.value = imageSize.width
    sourceImageNaturalHeight.value = imageSize.height
    resetPixelArtCalibration()
  } catch (error) {
    if (previewToken !== sourcePreviewToken) return

    generationError.value = error instanceof Error ? error.message : '图片预览读取失败'
  }
}

const onAiImageSelected = async (event: Event): Promise<void> => {
  await onImageSelected(event)
}

watch(
  [
    selectedManufacturer,
    selectedBoardSize,
    inputMode,
    maxColors,
    enableDithering,
    enablePixelCleanup,
    pixelArtScale,
    pixelArtOffsetX,
    pixelArtOffsetY
  ],
  () => {
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
  }
)

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

watch([patternGrid, showGridLabels, resolvedTheme, patternPreviewMode], () => {
  void nextTick(schedulePatternCanvasDraw)
}, { deep: true })

watch(canvasBaseSize, () => {
  void nextTick(schedulePatternCanvasDraw)
})

onMounted(() => {
  void loadProviderProfiles()
  document.addEventListener('fullscreenchange', syncPatternFullscreenState)
  window.addEventListener('keydown', onPatternPreviewKeydown, true)
  window.addEventListener('keyup', onPatternPreviewKeyup, true)
  window.addEventListener('blur', resetCanvasInteraction)
  void nextTick(() => {
    updateCanvasBaseSize()
    schedulePatternCanvasDraw()

    if (patternCanvasStage.value) {
      canvasResizeObserver = new ResizeObserver(() => {
        updateCanvasBaseSize()
        setCanvasViewport(canvasZoom.value)
        void nextTick(schedulePatternCanvasDraw)
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
  if (canvasRedrawFrame !== null) {
    window.cancelAnimationFrame(canvasRedrawFrame)
    canvasRedrawFrame = null
  }
  stopAiOptimizeTimer()
})
</script>

<template>
  <div class="flex h-screen flex-col bg-ink-50 text-ink-900 dark:bg-ink-900 dark:text-ink-50" @click="closePalettePicker">
    <AppHeader
      :preview-columns="previewColumns"
      :preview-rows="previewRows"
      :manufacturer-name="activeManufacturerPalette.name"
      :used-color-count="usedColors.length"
      :theme-options="themeOptions"
      :preference="preference"
      :resolved-theme="resolvedTheme"
      @set-preference="setPreference"
      @open-project="openProject"
      @save-project="saveProject"
      @print-pattern="printPattern"
      @export-pattern="exportPattern"
    />
    <input
      ref="projectFileInput"
      class="hidden"
      type="file"
      accept=".pbd.json,.json,application/json"
      @change="onProjectFileSelected"
    />

    <main class="flex min-h-0 flex-1 flex-col">
      <div
        class="grid min-h-0 flex-1 grid-cols-[minmax(250px,300px)_minmax(300px,1fr)_minmax(280px,340px)] gap-4 p-4"
      >
        <section
          class="tool-scroll min-h-0 overflow-auto rounded-md border border-ink-100 bg-white p-4 shadow-panel dark:border-white/10 dark:bg-ink-800"
        >
          <PatternSettingsPanel
            v-model:selected-manufacturer="selectedManufacturer"
            v-model:selected-board-size="selectedBoardSize"
            v-model:input-mode="inputMode"
            v-model:max-colors="maxColors"
            v-model:enable-dithering="enableDithering"
            v-model:enable-pixel-cleanup="enablePixelCleanup"
            v-model:show-grid-labels="showGridLabels"
            :manufacturer-palettes="manufacturerPalettes"
            :board-sizes="boardSizes"
            :pattern-input-modes="patternInputModes"
            :selected-pattern-input-mode-description="selectedPatternInputMode.description"
            :active-palette-color-count="activePaletteColors.length"
            :is-pixel-art-input-mode="isPixelArtInputMode"
            :is-ai-optimize-mode="isAiOptimizeMode"
            :source-preview-data-url="sourcePreviewDataUrl"
            :pixel-art-calibration-board-style="pixelArtCalibrationBoardStyle"
            :pixel-art-calibration-image-style="pixelArtCalibrationImageStyle"
            :pixel-art-calibration-grid-style="pixelArtCalibrationGridStyle"
            :pixel-art-scale="pixelArtScale"
            :pixel-art-offset-x="pixelArtOffsetX"
            :pixel-art-offset-y="pixelArtOffsetY"
            :pixel-art-calibration-label="pixelArtCalibrationLabel"
            :source-name="patternGrid.sourceName"
            :generation-message="generationMessage"
            :generation-error="generationError"
            :project-status="projectStatus"
            :resolved-theme="resolvedTheme"
            @reset-pixel-art-calibration="resetPixelArtCalibration"
            @open-pixel-art-calibration="openPixelArtCalibration"
            @adjust-pixel-art-scale="adjustPixelArtScale"
            @update-pixel-art-scale="(value) => { pixelArtScale = value }"
            @update-pixel-art-offset-x="(value) => { pixelArtOffsetX = value }"
            @update-pixel-art-offset-y="(value) => { pixelArtOffsetY = value }"
            @nudge-pixel-art-calibration="nudgePixelArtCalibration"
          />

          <BeadInventoryPanel
            :bead-inventory="beadInventory"
            @export-inventory="exportInventory"
          />
        </section>

        <section
          ref="patternPreviewPanel"
          class="pattern-preview-panel flex min-h-0 flex-col rounded-md border border-ink-100 bg-white shadow-panel dark:border-white/10 dark:bg-ink-800"
          :class="{ 'is-overlay-fullscreen': isPatternOverlayFullscreen }"
        >
          <PatternPreviewToolbar
            :canvas-zoom="canvasZoom"
            :canvas-zoom-percent="canvasZoomPercent"
            :undo-count="undoStack.length"
            :redo-count="redoStack.length"
            :editor-tools="editorTools"
            :active-tool="activeTool"
            :is-actual-effect-preview="isActualEffectPreview"
            :is-pattern-fullscreen="isPatternFullscreen"
            @zoom-out="zoomCanvasOut"
            @reset-viewport="resetCanvasViewport"
            @zoom-in="zoomCanvasIn"
            @undo="undo"
            @redo="redo"
            @select-tool="selectEditorTool"
            @toggle-preview-mode="patternPreviewMode = isActualEffectPreview ? 'chart' : 'effect'"
            @toggle-fullscreen="togglePatternFullscreen"
          />

          <div
            ref="patternCanvasStage"
            class="pattern-canvas-stage relative flex min-h-0 flex-1 touch-none select-none items-center justify-center overflow-hidden bg-ink-50 p-5 dark:bg-ink-900"
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

            <ShortcutHelpPopover
              v-model:is-open="isShortcutHelpOpen"
              :shortcut-groups="shortcutGroups"
            />
          </div>

          <CurrentColorBar
            v-model:is-palette-picker-open="isPalettePickerOpen"
            v-model:palette-search-query="paletteSearchQuery"
            :selected-color-hex="selectedColorHex"
            :selected-color-id="selectedColor.id"
            :selected-color-name="selectedColor.name"
            :selected-color-label="selectedColorLabel"
            :manufacturer-name="activeManufacturerPalette.name"
            :filtered-palette-colors="filteredPaletteColors"
            :active-palette-color-count="activePaletteColors.length"
            :used-color-counts="usedColorCounts"
            :displayed-colors="displayedColors"
            @select-color="selectPaletteColor"
          />

          <PatternPreviewStatusBar
            :total-cells="previewColumns * previewRows"
            :color-count="actualUsedColorCount"
            :active-tool-label="activeToolLabel"
            :pattern-status="patternStatus"
            :input-mode-label="selectedPatternInputMode.label"
            :dithering-status-label="ditheringStatusLabel"
            :cleanup-status-label="cleanupStatusLabel"
          />
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
            <AiCreationModeSelector
              v-model:ai-creation-mode="aiCreationMode"
              :ai-creation-modes="aiCreationModes"
              :resolved-theme="resolvedTheme"
            />


            <GenerationSourcePanel
              v-model:selected-provider-id="selectedProviderId"
              :source-preview-data-url="sourcePreviewDataUrl"
              :source-file-name="sourceFile?.name || ''"
              :pattern-source-name="patternGrid.sourceName"
              :is-ai-optimize-mode="isAiOptimizeMode"
              :new-provider-id="NEW_PROVIDER_ID"
              :ai-provider-options="aiProviderOptions"
              :selected-model="selectedModel"
              @image-selected="onAiImageSelected"
              @open-ai-settings="isAiSettingsOpen = true"
              @provider-change="onProviderChange"
            />

            <label v-if="isAiOptimizeMode" class="block space-y-1.5">
              <span class="text-xs font-medium text-ink-600 dark:text-ink-300">提示词</span>
              <textarea
                v-model="aiPrompt"
                class="min-h-32 w-full resize-y rounded-md border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-bead-sky dark:border-white/10 dark:bg-ink-900"
                placeholder="例如：保持硬边像素画风，保留主体轮廓，简化背景，把颜色压成清晰的大色块"
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

            <template v-else>
              <button
                class="inline-flex w-full items-center justify-center gap-2 rounded-md bg-bead-coral px-3 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-55"
                type="button"
                title="AI 优化原图"
                :disabled="!sourceFile || isOptimizingImage || isGenerating"
                @click="optimizeImageWithAi"
              >
                <Icon :icon="isOptimizingImage ? 'ri:loader-4-line' : 'ri:magic-line'" class="h-4 w-4" :class="isOptimizingImage ? 'animate-spin' : ''" />
                <span>{{ isOptimizingImage ? 'AI 优化中' : 'AI 优化原图' }}</span>
              </button>

              <label
                class="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-bead-sky/40 bg-bead-sky/10 px-3 py-2.5 text-sm font-semibold text-bead-sky transition hover:bg-bead-sky/15 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55 dark:border-bead-sky/30 dark:bg-bead-sky/15"
                title="临时入口：上传已优化图并直接生成图纸，不调用 AI"
              >
                <Icon icon="ri:image-add-line" class="h-4 w-4" />
                <span>{{ isGenerating ? '导入中' : '上传已优化图' }}</span>
                <span class="rounded bg-white/70 px-1.5 py-0.5 text-[11px] dark:bg-ink-900/60">不调用 AI</span>
                <input
                  class="hidden"
                  type="file"
                  accept="image/*"
                  :disabled="isOptimizingImage || isGenerating"
                  @change="onProcessedImageSelected"
                />
              </label>
            </template>

            <AiOptimizeResultPanel
              v-if="isAiOptimizeMode"
              :is-optimizing-image="isOptimizingImage"
              :ai-optimize-error="aiOptimizeError"
              :ai-optimize-status="aiOptimizeStatus"
              :ai-optimize-elapsed-label="aiOptimizeElapsedLabel"
              :ai-reference-data-url="aiReferenceDataUrl"
              :ai-reference-name="aiReferenceName"
            />

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

    <AiProviderSettingsModal
      v-model:provider-name="providerName"
      v-model:base-url="baseUrl"
      v-model:api-key="apiKey"
      v-model:selected-model="selectedModel"
      :is-open="isAiSettingsOpen"
      :api-settings-description="apiSettingsDescription"
      :ai-provider-options="aiProviderOptions"
      :selected-provider-id="selectedProviderId"
      :selected-provider="selectedProvider"
      :selected-provider-has-stored-key="selectedProviderHasStoredKey"
      :api-key-storage-hint="apiKeyStorageHint"
      :provider-notice-message="providerNoticeMessage"
      :provider-notice-is-error="providerNoticeIsError"
      :is-deleting-provider="isDeletingProvider"
      :is-saving-provider="isSavingProvider"
      :model-options="modelOptions"
      :is-fetching-models="isFetchingModels"
      :model-status="modelStatus"
      :model-error="modelError"
      @close="isAiSettingsOpen = false"
      @select-provider="
        (id) => {
          selectedProviderId = id;
          onProviderChange()
        }
      "
      @reset-provider-form="resetProviderForm"
      @delete-provider-profile="deleteProviderProfile"
      @save-provider-profile="saveProviderProfile"
      @fetch-models="fetchModels"
    />

    <PixelArtCalibrationModal
      :is-open="isPixelArtCalibrationOpen"
      :source-preview-data-url="sourcePreviewDataUrl"
      :board-style="pixelArtCalibrationBoardStyle"
      :image-style="pixelArtCalibrationModalImageStyle"
      :grid-style="pixelArtCalibrationModalGridStyle"
      :draft-label="pixelArtCalibrationDraftLabel"
      :draft-scale="pixelArtDraftScale"
      :draft-offset-x="pixelArtDraftOffsetX"
      :draft-offset-y="pixelArtDraftOffsetY"
      :original-scale="pixelArtScale"
      :original-offset-x="pixelArtOffsetX"
      :original-offset-y="pixelArtOffsetY"
      @close="closePixelArtCalibration"
      @pointer-down="onPixelArtCalibrationPointerDown"
      @pointer-move="onPixelArtCalibrationPointerMove"
      @pointer-up="onPixelArtCalibrationPointerUp"
      @wheel="onPixelArtCalibrationWheel"
      @adjust-scale="adjustPixelArtDraftScale"
      @update-draft-scale="(value) => { pixelArtDraftScale = value }"
      @update-draft-offset-x="(value) => { pixelArtDraftOffsetX = value }"
      @update-draft-offset-y="(value) => { pixelArtDraftOffsetY = value }"
      @nudge="nudgePixelArtDraftCalibration"
      @reset="resetPixelArtDraftCalibration"
      @revert="
        () => {
          pixelArtDraftScale = pixelArtScale;
          pixelArtDraftOffsetX = pixelArtOffsetX;
          pixelArtDraftOffsetY = pixelArtOffsetY
        }
      "
      @apply="applyPixelArtCalibration"
    />
  </div>
</template>
