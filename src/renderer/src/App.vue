<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import type { AiListModelsResult } from '@shared/ai'
import type { ThemePreference } from '@shared/theme'
import { useTheme } from './composables/useTheme'
import { beadPalette, aiProviderPresets, workflowSteps } from './data/studio'
import {
  createPatternFromImageFile,
  createSamplePattern,
  exportPatternAsPng,
  parseBoardSize
} from './utils/pattern'
import type { PatternGrid } from './utils/pattern'

type EditorTool = 'pencil' | 'fill' | 'eyedropper' | 'eraser'

const { preference, resolvedTheme, setPreference, cycleTheme } = useTheme()

const manufacturers = ['Perler', 'Hama', 'Artkal', 'Nabbi', '自定义色卡']
const boardSizes = ['32 x 32', '48 x 48', '64 x 64', '96 x 96']
const optimizationModes = ['主体增强', '去背景', '像素画参考', '低色数简化']
const editorTools: Array<{ id: EditorTool; icon: string; label: string }> = [
  { id: 'pencil', icon: 'ri:paint-brush-line', label: '画笔' },
  { id: 'fill', icon: 'ri:paint-fill', label: '填充' },
  { id: 'eyedropper', icon: 'ri:contrast-dropper-line', label: '吸管' },
  { id: 'eraser', icon: 'ri:eraser-line', label: '橡皮' }
]

const selectedManufacturer = ref(manufacturers[0])
const selectedBoardSize = ref(boardSizes[1])
const maxColors = ref(24)
const enableDithering = ref(true)
const createCurrentSamplePattern = (): PatternGrid => {
  const { columns, rows } = parseBoardSize(selectedBoardSize.value)
  return createSamplePattern(beadPalette, columns, rows)
}
const patternGrid = ref<PatternGrid>(createCurrentSamplePattern())
const sourceFile = ref<File | null>(null)
const isGenerating = ref(false)
const hasManualEdits = ref(false)
const generationMessage = ref('示例图纸已就绪')
const generationError = ref('')
const selectedColorHex = ref(beadPalette[3].hex)
const activeTool = ref<EditorTool>('pencil')
const undoStack = ref<string[][]>([])
const redoStack = ref<string[][]>([])
let generationToken = 0

const selectedProviderId = ref(aiProviderPresets[0].id)
const baseUrl = ref(aiProviderPresets[0].baseUrl)
const apiKey = ref('')
const modelOptions = ref<string[]>([...aiProviderPresets[0].models])
const selectedModel = ref(aiProviderPresets[0].models[0])
const selectedMode = ref(optimizationModes[0])
const isFetchingModels = ref(false)
const modelStatus = ref('使用内置模型列表')
const modelError = ref('')

const selectedProvider = computed(() => {
  return aiProviderPresets.find((provider) => provider.id === selectedProviderId.value) ?? aiProviderPresets[0]
})

const previewColumns = computed(() => patternGrid.value.columns)
const previewRows = computed(() => patternGrid.value.rows)
const beadCells = computed(() => patternGrid.value.cells)
const patternStatus = computed(() => {
  if (isGenerating.value) return '生成中'
  if (generationError.value) return '需处理'
  if (hasManualEdits.value) return '已编辑'
  return sourceFile.value ? '已生成' : '草稿'
})

const usedColors = computed(() => {
  const usedSet = new Set(beadCells.value)
  return beadPalette.filter((color) => usedSet.has(color.hex))
})

const displayedColors = computed(() => usedColors.value.slice(0, 9))

const beadCountByColor = computed(() => {
  return beadCells.value.reduce<Record<string, number>>((countMap, color) => {
    countMap[color] = (countMap[color] ?? 0) + 1
    return countMap
  }, {})
})

const selectedColor = computed(() => {
  return beadPalette.find((color) => color.hex === selectedColorHex.value) ?? beadPalette[0]
})

const themeOptions: Array<{ value: ThemePreference; icon: string; label: string }> = [
  { value: 'system', icon: 'ri:computer-line', label: '系统' },
  { value: 'light', icon: 'ri:sun-line', label: '昼' },
  { value: 'dark', icon: 'ri:moon-line', label: '夜' }
]

const themeButtonIcon = computed(() => {
  if (preference.value === 'system') return 'ri:computer-line'
  return resolvedTheme.value === 'dark' ? 'ri:moon-line' : 'ri:sun-line'
})

const onProviderChange = (): void => {
  baseUrl.value = selectedProvider.value.baseUrl
  modelOptions.value = [...selectedProvider.value.models]
  selectedModel.value = modelOptions.value[0] ?? ''
  modelStatus.value = '使用内置模型列表'
  modelError.value = ''
}

const buildModelsUrl = (providerBaseUrl: string): string => {
  const url = new URL(providerBaseUrl.trim())
  const trimmedPath = url.pathname.replace(/\/+$/, '')
  url.pathname = trimmedPath.endsWith('/models') ? trimmedPath : `${trimmedPath}/models`
  return url.toString()
}

const listModelsInBrowser = async (): Promise<AiListModelsResult> => {
  const response = await fetch(buildModelsUrl(baseUrl.value), {
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

const fetchModels = async (): Promise<void> => {
  modelError.value = ''
  modelStatus.value = ''

  if (!baseUrl.value.trim()) {
    modelError.value = '请先填写 Base URL'
    return
  }

  if (!apiKey.value.trim()) {
    modelError.value = '请先填写 API Key'
    return
  }

  isFetchingModels.value = true

  try {
    const result = window.perler?.ai
      ? await window.perler.ai.listModels({ baseUrl: baseUrl.value, apiKey: apiKey.value })
      : await listModelsInBrowser()

    if (!result.ok) {
      modelError.value = result.error ?? '模型拉取失败'
      return
    }

    if (result.models.length === 0) {
      modelError.value = '接口返回了空模型列表'
      return
    }

    modelOptions.value = result.models.map((model) => model.id)
    selectedModel.value = modelOptions.value[0]
    modelStatus.value = `已拉取 ${result.models.length} 个模型`
  } catch (error) {
    modelError.value = error instanceof Error ? error.message : '模型拉取失败'
  } finally {
    isFetchingModels.value = false
  }
}

const regeneratePattern = async (): Promise<void> => {
  if (!sourceFile.value) return

  const token = (generationToken += 1)
  isGenerating.value = true
  generationError.value = ''
  generationMessage.value = '正在转换图片'

  try {
    const nextPattern = await createPatternFromImageFile(sourceFile.value, {
      boardSize: selectedBoardSize.value,
      maxColors: maxColors.value,
      dithering: enableDithering.value,
      palette: beadPalette
    })

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

const onImageSelected = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  sourceFile.value = file
  await regeneratePattern()
  input.value = ''
}

watch([selectedBoardSize, maxColors, enableDithering], () => {
  if (sourceFile.value) {
    void regeneratePattern()
  } else {
    patternGrid.value = createCurrentSamplePattern()
    hasManualEdits.value = false
    undoStack.value = []
    redoStack.value = []
    generationError.value = ''
    generationMessage.value = '示例图纸已按规格更新'
  }
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
  const currentColor = patternGrid.value.cells[index]

  if (activeTool.value === 'eyedropper') {
    selectedColorHex.value = currentColor
    activeTool.value = 'pencil'
    return
  }

  if (activeTool.value === 'eraser') {
    replaceCell(index, beadPalette[0].hex)
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
    exportPatternAsPng(patternGrid.value)
    generationMessage.value = 'PNG 图纸已导出'
  } catch (error) {
    generationError.value = error instanceof Error ? error.message : '导出失败'
  }
}
</script>

<template>
  <div class="flex h-screen bg-ink-50 text-ink-900 dark:bg-ink-900 dark:text-ink-50">
    <aside
      class="flex w-64 shrink-0 flex-col border-r border-ink-100 bg-white/78 px-4 py-4 dark:border-white/10 dark:bg-ink-800/80"
    >
      <div class="flex items-center gap-3 border-b border-ink-100 pb-4 dark:border-white/10">
        <div class="grid h-10 w-10 grid-cols-3 gap-0.5 rounded-md bg-ink-900 p-1 dark:bg-ink-50">
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
          <p class="truncate text-xs text-ink-600 dark:text-ink-300">Perler Beads Studio</p>
        </div>
      </div>

      <nav class="mt-5 space-y-2">
        <button
          v-for="step in workflowSteps"
          :key="step.id"
          class="flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition"
          :class="
            step.status === 'ready'
              ? 'border-bead-mint/60 bg-bead-mint/12 text-ink-900 dark:text-ink-50'
              : step.status === 'next'
                ? 'border-bead-amber/60 bg-bead-amber/12 text-ink-900 dark:text-ink-50'
                : 'border-transparent text-ink-600 hover:border-ink-100 hover:bg-ink-50 dark:text-ink-300 dark:hover:border-white/10 dark:hover:bg-white/5'
          "
          type="button"
        >
          <Icon :icon="step.icon" class="h-5 w-5 shrink-0" />
          <span class="truncate">{{ step.label }}</span>
        </button>
      </nav>

      <div class="mt-auto space-y-3 border-t border-ink-100 pt-4 dark:border-white/10">
        <div class="grid grid-cols-3 gap-1 rounded-md bg-ink-100 p-1 dark:bg-white/10">
          <button
            v-for="option in themeOptions"
            :key="option.value"
            type="button"
            class="flex items-center justify-center gap-1 rounded px-2 py-1.5 text-xs transition"
            :class="
              preference === option.value
                ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-ink-50'
                : 'text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-white'
            "
            :title="`主题: ${option.label}`"
            @click="setPreference(option.value)"
          >
            <Icon :icon="option.icon" class="h-4 w-4" />
            <span>{{ option.label }}</span>
          </button>
        </div>

        <button
          type="button"
          class="flex w-full items-center justify-center gap-2 rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-700 transition hover:border-ink-300 hover:bg-ink-50 dark:border-white/10 dark:text-ink-200 dark:hover:bg-white/5"
          title="循环切换主题"
          @click="cycleTheme"
        >
          <Icon :icon="themeButtonIcon" class="h-4 w-4" />
          <span>快速切换</span>
        </button>
      </div>
    </aside>

    <main class="flex min-w-0 flex-1 flex-col">
      <header
        class="flex h-16 shrink-0 items-center justify-between border-b border-ink-100 bg-white/72 px-5 dark:border-white/10 dark:bg-ink-800/70"
      >
        <div class="min-w-0">
          <h2 class="truncate text-lg font-semibold">图片转拼豆图纸</h2>
          <p class="truncate text-xs text-ink-600 dark:text-ink-300">
            {{ previewColumns }} x {{ previewRows }} · {{ selectedManufacturer }} · {{ usedColors.length }} 色
          </p>
        </div>

        <div class="flex items-center gap-2">
          <label
            class="inline-flex cursor-pointer items-center gap-2 rounded-md bg-ink-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-ink-800 dark:bg-ink-50 dark:text-ink-900 dark:hover:bg-white"
            title="导入图片"
          >
            <Icon icon="ri:image-add-line" class="h-4 w-4" />
            <span>{{ isGenerating ? '转换中' : '导入图片' }}</span>
            <input class="hidden" type="file" accept="image/*" @change="onImageSelected" />
          </label>
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

      <div
        class="grid min-h-0 flex-1 grid-cols-[minmax(240px,280px)_minmax(340px,1fr)_minmax(280px,320px)] gap-4 p-4"
      >
        <section
          class="tool-scroll min-h-0 overflow-auto rounded-md border border-ink-100 bg-white p-4 shadow-panel dark:border-white/10 dark:bg-ink-800"
        >
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
                <option v-for="manufacturer in manufacturers" :key="manufacturer">
                  {{ manufacturer }}
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
                v-model="maxColors"
                class="w-full accent-bead-coral"
                type="range"
                min="8"
                max="64"
                step="1"
              />
            </label>

            <label
              class="flex items-center justify-between rounded-md border border-ink-100 px-3 py-2 dark:border-white/10"
            >
              <span class="text-sm">开启抖色</span>
              <input v-model="enableDithering" class="h-4 w-4 accent-bead-mint" type="checkbox" />
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
            </div>
          </div>

          <div class="mt-6 border-t border-ink-100 pt-4 dark:border-white/10">
            <div class="mb-3 flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <Icon icon="ri:palette-line" class="h-5 w-5 text-bead-violet" />
                <h3 class="text-sm font-semibold">当前用色</h3>
              </div>
              <span
                class="h-5 w-5 rounded-full border border-ink-200 dark:border-white/10"
                :style="{ backgroundColor: selectedColorHex }"
                :title="selectedColor.name"
              ></span>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="color in displayedColors"
                :key="color.id"
                type="button"
                class="rounded-md border p-2 text-left text-[11px] transition hover:border-ink-300 dark:border-white/10"
                :class="
                  selectedColorHex === color.hex
                    ? 'border-bead-coral bg-bead-coral/10'
                    : 'border-ink-100'
                "
                :title="`${color.id} ${color.name}`"
                @click="selectedColorHex = color.hex"
              >
                <span class="mb-2 block h-7 rounded" :style="{ backgroundColor: color.hex }"></span>
                <span class="block truncate font-semibold">{{ color.id }}</span>
                <span class="block truncate text-ink-500 dark:text-ink-400">{{ color.name }}</span>
                <span class="block truncate text-ink-500 dark:text-ink-400">
                  {{ beadCountByColor[color.hex] ?? 0 }}
                </span>
              </button>
            </div>
          </div>
        </section>

        <section
          class="flex min-h-0 flex-col rounded-md border border-ink-100 bg-white shadow-panel dark:border-white/10 dark:bg-ink-800"
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
            </div>
          </div>

          <div class="flex min-h-0 flex-1 items-center justify-center bg-ink-50 p-5 dark:bg-ink-900">
            <div
              class="aspect-square w-full max-w-[620px] rounded-md border border-ink-200 bg-white p-3 shadow-panel dark:border-white/10 dark:bg-ink-800"
            >
              <div
                class="grid h-full w-full gap-px rounded bg-ink-200 p-1 dark:bg-black/30"
                :style="{ gridTemplateColumns: `repeat(${previewColumns}, minmax(0, 1fr))` }"
              >
                <button
                  v-for="(color, index) in beadCells"
                  :key="index"
                  class="bead-cell aspect-square rounded-full outline-none transition hover:scale-110 focus:scale-110 focus:ring-1 focus:ring-bead-coral"
                  :style="{ backgroundColor: color }"
                  type="button"
                  :title="`${index % previewColumns}, ${Math.floor(index / previewColumns)}`"
                  @click="onCellClick(index)"
                ></button>
              </div>
            </div>
          </div>

          <div
            class="grid grid-cols-4 gap-3 border-t border-ink-100 px-4 py-3 text-sm dark:border-white/10"
          >
            <div>
              <span class="block text-xs text-ink-500 dark:text-ink-400">格子</span>
              <strong>{{ previewColumns * previewRows }}</strong>
            </div>
            <div>
              <span class="block text-xs text-ink-500 dark:text-ink-400">颜色</span>
              <strong>{{ usedColors.length }}</strong>
            </div>
            <div>
              <span class="block text-xs text-ink-500 dark:text-ink-400">工具</span>
              <strong>{{ editorTools.find((tool) => tool.id === activeTool)?.label }}</strong>
            </div>
            <div>
              <span class="block text-xs text-ink-500 dark:text-ink-400">状态</span>
              <strong>{{ patternStatus }}</strong>
            </div>
          </div>
        </section>

        <section
          class="tool-scroll min-h-0 overflow-auto rounded-md border border-ink-100 bg-white p-4 shadow-panel dark:border-white/10 dark:bg-ink-800"
        >
          <div class="mb-4 flex items-center gap-2">
            <Icon icon="ri:robot-2-line" class="h-5 w-5 text-bead-sky" />
            <h3 class="text-sm font-semibold">AI 平台</h3>
          </div>

          <form class="space-y-4" @submit.prevent>
            <input
              autocomplete="username"
              class="hidden"
              tabindex="-1"
              type="text"
              value="ai-provider"
            />

            <label class="block space-y-1.5">
              <span class="text-xs font-medium text-ink-600 dark:text-ink-300">供应商</span>
              <select
                v-model="selectedProviderId"
                class="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-bead-sky dark:border-white/10 dark:bg-ink-900"
                @change="onProviderChange"
              >
                <option v-for="provider in aiProviderPresets" :key="provider.id" :value="provider.id">
                  {{ provider.name }}
                </option>
              </select>
            </label>

            <label class="block space-y-1.5">
              <span class="text-xs font-medium text-ink-600 dark:text-ink-300">Base URL</span>
              <input
                v-model="baseUrl"
                class="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-bead-sky dark:border-white/10 dark:bg-ink-900"
                type="url"
              />
            </label>

            <label class="block space-y-1.5">
              <span class="text-xs font-medium text-ink-600 dark:text-ink-300">API Key</span>
              <input
                v-model="apiKey"
                class="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-bead-sky dark:border-white/10 dark:bg-ink-900"
                autocomplete="new-password"
                placeholder="sk-..."
                type="password"
              />
            </label>

            <div class="grid grid-cols-[1fr_auto] gap-2">
              <label class="block space-y-1.5">
                <span class="text-xs font-medium text-ink-600 dark:text-ink-300">模型</span>
                <select
                  v-model="selectedModel"
                  class="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-bead-sky dark:border-white/10 dark:bg-ink-900"
                >
                  <option v-for="model in modelOptions" :key="model">{{ model }}</option>
                </select>
              </label>

              <button
                class="mt-5 inline-flex h-10 items-center justify-center rounded-md border border-ink-200 px-3 text-sm text-ink-700 transition hover:bg-ink-50 disabled:opacity-50 dark:border-white/10 dark:text-ink-200 dark:hover:bg-white/5"
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
              </button>
            </div>

            <p
              v-if="modelStatus || modelError"
              class="rounded-md border px-3 py-2 text-xs"
              :class="
                modelError
                  ? 'border-bead-coral/30 bg-bead-coral/10 text-bead-coral'
                  : 'border-bead-mint/30 bg-bead-mint/10 text-ink-700 dark:text-ink-100'
              "
            >
              {{ modelError || modelStatus }}
            </p>

            <label class="block space-y-1.5">
              <span class="text-xs font-medium text-ink-600 dark:text-ink-300">优化模式</span>
              <select
                v-model="selectedMode"
                class="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-bead-sky dark:border-white/10 dark:bg-ink-900"
              >
                <option v-for="mode in optimizationModes" :key="mode">{{ mode }}</option>
              </select>
            </label>

            <button
              class="inline-flex w-full items-center justify-center gap-2 rounded-md bg-bead-coral px-3 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-55"
              type="button"
              title="AI 优化原图"
              :disabled="!sourceFile"
            >
              <Icon icon="ri:magic-line" class="h-4 w-4" />
              <span>AI 优化原图</span>
            </button>
          </form>

          <div class="mt-6 border-t border-ink-100 pt-4 dark:border-white/10">
            <div class="mb-3 flex items-center gap-2">
              <Icon icon="ri:list-check-3" class="h-5 w-5 text-bead-amber" />
              <h3 class="text-sm font-semibold">模型能力</h3>
            </div>
            <div class="flex flex-wrap gap-2">
              <span
                class="rounded-full border border-bead-mint/40 bg-bead-mint/10 px-3 py-1 text-xs text-ink-700 dark:text-ink-100"
              >
                图片生成
              </span>
              <span
                class="rounded-full border border-bead-sky/40 bg-bead-sky/10 px-3 py-1 text-xs text-ink-700 dark:text-ink-100"
              >
                图片编辑
              </span>
              <span
                class="rounded-full border border-bead-amber/40 bg-bead-amber/10 px-3 py-1 text-xs text-ink-700 dark:text-ink-100"
              >
                多模态理解
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>
