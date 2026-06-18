<script setup lang="ts">
import { Icon } from '@iconify/vue'
import PixelArtSettingsPanel from './PixelArtSettingsPanel.vue'
import SourceStatusCard from './SourceStatusCard.vue'
import type { ManufacturerPalette } from '../data/palettes'

type PatternInputMode = 'image' | 'pixel-art'

defineProps<{
  manufacturerPalettes: ManufacturerPalette[]
  selectedManufacturer: string
  boardSizes: string[]
  selectedBoardSize: string
  patternInputModes: Array<{ id: PatternInputMode; label: string; description: string }>
  inputMode: PatternInputMode
  selectedPatternInputModeDescription: string
  maxColors: number
  activePaletteColorCount: number
  isPixelArtInputMode: boolean
  isAiOptimizeMode: boolean
  sourcePreviewDataUrl: string
  pixelArtCalibrationBoardStyle: Record<string, string>
  pixelArtCalibrationImageStyle: Record<string, string>
  pixelArtCalibrationGridStyle: Record<string, string>
  pixelArtScale: number
  pixelArtOffsetX: number
  pixelArtOffsetY: number
  pixelArtCalibrationLabel: string
  enableDithering: boolean
  enablePixelCleanup: boolean
  showGridLabels: boolean
  sourceName: string
  generationMessage: string
  generationError: string
  projectStatus: string
  resolvedTheme: 'light' | 'dark'
}>()

const emit = defineEmits<{
  'update:selectedManufacturer': [value: string]
  'update:selectedBoardSize': [value: string]
  'update:inputMode': [value: PatternInputMode]
  'update:maxColors': [value: number]
  'update:enableDithering': [value: boolean]
  'update:enablePixelCleanup': [value: boolean]
  'update:showGridLabels': [value: boolean]
  resetPixelArtCalibration: []
  openPixelArtCalibration: []
  adjustPixelArtScale: [amount: number]
  updatePixelArtScale: [value: number]
  updatePixelArtOffsetX: [value: number]
  updatePixelArtOffsetY: [value: number]
  nudgePixelArtCalibration: [axis: 'x' | 'y', amount: number]
}>()
</script>

<template>
  <div>
    <div class="mb-4 flex items-center gap-2">
      <Icon icon="ri:settings-3-line" class="h-5 w-5 text-bead-coral" />
      <h3 class="text-sm font-semibold">图纸规格</h3>
    </div>

    <div class="space-y-4">
      <label class="block space-y-1.5">
        <span class="text-xs font-medium text-ink-600 dark:text-ink-300">厂商色卡</span>
        <select
          :value="selectedManufacturer"
          class="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-bead-mint dark:border-white/10 dark:bg-ink-900"
          @change="emit('update:selectedManufacturer', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="palette in manufacturerPalettes" :key="palette.id" :value="palette.id">
            {{ palette.name }} · {{ palette.colors.length }} 色
          </option>
        </select>
      </label>

      <label class="block space-y-1.5">
        <span class="text-xs font-medium text-ink-600 dark:text-ink-300">画板规格</span>
        <select
          :value="selectedBoardSize"
          class="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-bead-mint dark:border-white/10 dark:bg-ink-900"
          @change="emit('update:selectedBoardSize', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="size in boardSizes" :key="size">{{ size }}</option>
        </select>
      </label>

      <div class="space-y-2">
        <span class="text-xs font-medium text-ink-600 dark:text-ink-300">色卡匹配模式</span>
        <div class="grid grid-cols-2 gap-1 rounded-md border border-ink-200 bg-ink-100 p-1 dark:border-white/10 dark:bg-ink-900">
          <button
            v-for="mode in patternInputModes"
            :key="mode.id"
            class="rounded px-3 py-2 text-sm font-semibold transition hover:brightness-105"
            :style="
              inputMode === mode.id
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
            @click="emit('update:inputMode', mode.id)"
          >
            {{ mode.label }}
          </button>
        </div>
        <span class="block text-[11px] leading-4 text-ink-500 dark:text-ink-400">
          {{ selectedPatternInputModeDescription }}
        </span>
      </div>

      <label class="block space-y-2">
        <span class="flex items-center justify-between text-xs font-medium text-ink-600 dark:text-ink-300">
          <span>最大颜色数</span>
          <span>{{ isPixelArtInputMode ? '全色卡' : maxColors }}</span>
        </span>
        <input
          :value="maxColors"
          class="w-full accent-bead-coral"
          :class="{ 'opacity-45': isPixelArtInputMode }"
          type="range"
          min="8"
          :max="activePaletteColorCount"
          step="1"
          :disabled="isPixelArtInputMode"
          @input="emit('update:maxColors', Number(($event.target as HTMLInputElement).value))"
        />
        <span v-if="isPixelArtInputMode" class="block text-[11px] leading-4 text-ink-500 dark:text-ink-400">
          像素画模式会使用完整厂商色卡，并把素材等比放入画板，画板外侧留空。
        </span>
      </label>

      <PixelArtSettingsPanel
        v-if="isPixelArtInputMode"
        :source-preview-data-url="sourcePreviewDataUrl"
        :board-style="pixelArtCalibrationBoardStyle"
        :image-style="pixelArtCalibrationImageStyle"
        :grid-style="pixelArtCalibrationGridStyle"
        :pixel-art-scale="pixelArtScale"
        :pixel-art-offset-x="pixelArtOffsetX"
        :pixel-art-offset-y="pixelArtOffsetY"
        :pixel-art-calibration-label="pixelArtCalibrationLabel"
        @reset="emit('resetPixelArtCalibration')"
        @open="emit('openPixelArtCalibration')"
        @adjust-scale="emit('adjustPixelArtScale', $event)"
        @update-scale="emit('updatePixelArtScale', $event)"
        @update-offset-x="emit('updatePixelArtOffsetX', $event)"
        @update-offset-y="emit('updatePixelArtOffsetY', $event)"
        @nudge="(axis, amount) => emit('nudgePixelArtCalibration', axis, amount)"
      />

      <label v-if="!isAiOptimizeMode && !isPixelArtInputMode" class="flex items-center justify-between rounded-md border border-ink-100 px-3 py-2 dark:border-white/10">
        <span class="text-sm">开启抖色</span>
        <input
          :checked="enableDithering"
          class="h-4 w-4 accent-bead-mint"
          type="checkbox"
          @change="emit('update:enableDithering', ($event.target as HTMLInputElement).checked)"
        />
      </label>

      <label v-if="!isAiOptimizeMode && !isPixelArtInputMode" class="flex items-center justify-between rounded-md border border-ink-100 px-3 py-2 dark:border-white/10">
        <span class="text-sm">像素清理</span>
        <input
          :checked="enablePixelCleanup"
          class="h-4 w-4 accent-bead-amber"
          type="checkbox"
          @change="emit('update:enablePixelCleanup', ($event.target as HTMLInputElement).checked)"
        />
      </label>

      <label class="flex items-center justify-between rounded-md border border-ink-100 px-3 py-2 dark:border-white/10">
        <span class="text-sm">显示标号</span>
        <input
          :checked="showGridLabels"
          class="h-4 w-4 accent-bead-sky"
          type="checkbox"
          @change="emit('update:showGridLabels', ($event.target as HTMLInputElement).checked)"
        />
      </label>

      <SourceStatusCard
        :source-name="sourceName"
        :generation-message="generationMessage"
        :generation-error="generationError"
        :project-status="projectStatus"
        :is-ai-optimize-mode="isAiOptimizeMode"
        :is-pixel-art-input-mode="isPixelArtInputMode"
      />
    </div>
  </div>
</template>
