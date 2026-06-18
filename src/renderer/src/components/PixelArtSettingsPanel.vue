<script setup lang="ts">
defineProps<{
  sourcePreviewDataUrl: string
  boardStyle: Record<string, string>
  imageStyle: Record<string, string>
  gridStyle: Record<string, string>
  pixelArtScale: number
  pixelArtOffsetX: number
  pixelArtOffsetY: number
  pixelArtCalibrationLabel: string
}>()

const emit = defineEmits<{
  reset: []
  open: []
  adjustScale: [amount: number]
  updateScale: [value: number]
  updateOffsetX: [value: number]
  updateOffsetY: [value: number]
  nudge: [axis: 'x' | 'y', amount: number]
}>()
</script>

<template>
  <div class="space-y-3 rounded-md border border-bead-sky/25 bg-bead-sky/5 p-3 dark:border-bead-sky/25 dark:bg-bead-sky/10">
    <div class="flex items-start justify-between gap-3">
      <div>
        <span class="block text-xs font-semibold text-ink-700 dark:text-ink-100">像素画校准</span>
        <span class="mt-1 block text-[11px] leading-4 text-ink-500 dark:text-ink-400">
          调整原图缩放和偏移，让原图像素块边界对齐下方方格。
        </span>
      </div>
      <button
        class="shrink-0 rounded border border-bead-sky/30 px-2 py-1 text-[11px] font-semibold text-bead-sky transition hover:bg-bead-sky/10"
        type="button"
        @click="emit('reset')"
      >
        自动适配
      </button>
    </div>

    <div
      v-if="sourcePreviewDataUrl"
      class="relative w-full cursor-zoom-in select-none overflow-hidden rounded border border-ink-200 bg-white [-webkit-user-drag:none] [user-drag:none] dark:border-white/10 dark:bg-ink-950"
      :style="boardStyle"
      title="双击打开精细校准"
      @dblclick="emit('open')"
      @dragover.prevent
      @dragstart.prevent
      @drop.prevent
    >
      <img
        class="pointer-events-none absolute max-w-none select-none [-webkit-user-drag:none] [user-drag:none] [image-rendering:pixelated]"
        :src="sourcePreviewDataUrl"
        :style="imageStyle"
        alt="像素画校准预览"
        draggable="false"
        @dragstart.prevent
      />
      <div class="pointer-events-none absolute inset-0" :style="gridStyle"></div>
      <button
        class="absolute bottom-2 right-2 rounded bg-white/90 px-2 py-1 text-[11px] font-semibold text-bead-sky shadow-sm transition hover:bg-white dark:bg-ink-900/90"
        type="button"
        @click.stop="emit('open')"
      >
        打开校准
      </button>
    </div>
    <div v-else class="rounded border border-dashed border-ink-200 p-3 text-[11px] text-ink-500 dark:border-white/10 dark:text-ink-400">
      上传图片后可预览并校准像素网格。
    </div>

    <div class="block space-y-1.5">
      <span class="flex items-center justify-between text-[11px] font-medium text-ink-600 dark:text-ink-300">
        <span>缩放</span>
        <span>{{ pixelArtScale.toFixed(3) }}</span>
      </span>
      <div class="grid grid-cols-[2rem_minmax(0,1fr)_2rem] items-center gap-2">
        <button
          class="h-8 rounded border border-ink-200 bg-white text-sm font-bold text-ink-700 transition hover:bg-ink-50 disabled:opacity-40 dark:border-white/10 dark:bg-ink-900 dark:text-ink-200 dark:hover:bg-white/5"
          type="button"
          title="缩小 0.005"
          :disabled="pixelArtScale <= 0.05"
          @click="emit('adjustScale', -0.005)"
        >
          −
        </button>
        <input
          :value="pixelArtScale"
          class="w-full accent-bead-sky"
          type="range"
          min="0.05"
          max="8"
          step="0.005"
          @input="emit('updateScale', Number(($event.target as HTMLInputElement).value))"
        />
        <button
          class="h-8 rounded border border-ink-200 bg-white text-sm font-bold text-ink-700 transition hover:bg-ink-50 disabled:opacity-40 dark:border-white/10 dark:bg-ink-900 dark:text-ink-200 dark:hover:bg-white/5"
          type="button"
          title="放大 0.005"
          :disabled="pixelArtScale >= 8"
          @click="emit('adjustScale', 0.005)"
        >
          +
        </button>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <label class="block space-y-1.5">
        <span class="text-[11px] font-medium text-ink-600 dark:text-ink-300">X 偏移</span>
        <input
          :value="pixelArtOffsetX"
          class="w-full rounded border border-ink-200 bg-white px-2 py-1 text-xs outline-none focus:border-bead-sky dark:border-white/10 dark:bg-ink-900"
          type="number"
          step="0.05"
          @input="emit('updateOffsetX', Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <label class="block space-y-1.5">
        <span class="text-[11px] font-medium text-ink-600 dark:text-ink-300">Y 偏移</span>
        <input
          :value="pixelArtOffsetY"
          class="w-full rounded border border-ink-200 bg-white px-2 py-1 text-xs outline-none focus:border-bead-sky dark:border-white/10 dark:bg-ink-900"
          type="number"
          step="0.05"
          @input="emit('updateOffsetY', Number(($event.target as HTMLInputElement).value))"
        />
      </label>
    </div>

    <div class="grid grid-cols-4 gap-1">
      <button class="rounded border border-ink-200 px-2 py-1 text-xs dark:border-white/10" type="button" @click="emit('nudge', 'x', -0.1)">←</button>
      <button class="rounded border border-ink-200 px-2 py-1 text-xs dark:border-white/10" type="button" @click="emit('nudge', 'x', 0.1)">→</button>
      <button class="rounded border border-ink-200 px-2 py-1 text-xs dark:border-white/10" type="button" @click="emit('nudge', 'y', -0.1)">↑</button>
      <button class="rounded border border-ink-200 px-2 py-1 text-xs dark:border-white/10" type="button" @click="emit('nudge', 'y', 0.1)">↓</button>
    </div>

    <span class="block text-[11px] leading-4 text-ink-500 dark:text-ink-400">
      {{ pixelArtCalibrationLabel }}
    </span>
  </div>
</template>
