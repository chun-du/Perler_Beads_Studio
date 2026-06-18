<script setup lang="ts">
import { Icon } from '@iconify/vue'

type EditorTool = 'pencil' | 'fill' | 'eyedropper' | 'eraser'

defineProps<{
  canvasZoom: number
  canvasZoomPercent: number
  undoCount: number
  redoCount: number
  editorTools: Array<{ id: EditorTool; icon: string; label: string }>
  activeTool: EditorTool
  isActualEffectPreview: boolean
  isPatternFullscreen: boolean
}>()

const emit = defineEmits<{
  zoomOut: []
  resetViewport: []
  zoomIn: []
  undo: []
  redo: []
  selectTool: [tool: EditorTool]
  togglePreviewMode: []
  toggleFullscreen: []
}>()
</script>

<template>
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
        @click="emit('zoomOut')"
      >
        <Icon icon="ri:zoom-out-line" class="h-4 w-4" />
      </button>
      <button
        class="min-w-14 rounded-md px-2 py-1.5 text-xs font-semibold text-ink-600 transition hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-white/10"
        type="button"
        title="重置缩放和位置"
        @click="emit('resetViewport')"
      >
        {{ canvasZoomPercent }}%
      </button>
      <button
        class="rounded-md p-2 text-ink-600 transition hover:bg-ink-100 disabled:opacity-40 dark:text-ink-300 dark:hover:bg-white/10"
        type="button"
        title="放大"
        :disabled="canvasZoom >= 8"
        @click="emit('zoomIn')"
      >
        <Icon icon="ri:zoom-in-line" class="h-4 w-4" />
      </button>
      <button
        class="rounded-md p-2 text-ink-600 transition hover:bg-ink-100 disabled:opacity-40 dark:text-ink-300 dark:hover:bg-white/10"
        type="button"
        title="撤销"
        :disabled="undoCount === 0"
        @click="emit('undo')"
      >
        <Icon icon="ri:arrow-go-back-line" class="h-4 w-4" />
      </button>
      <button
        class="rounded-md p-2 text-ink-600 transition hover:bg-ink-100 disabled:opacity-40 dark:text-ink-300 dark:hover:bg-white/10"
        type="button"
        title="重做"
        :disabled="redoCount === 0"
        @click="emit('redo')"
      >
        <Icon icon="ri:arrow-go-forward-line" class="h-4 w-4" />
      </button>
      <button
        v-for="tool in editorTools"
        :key="tool.id"
        class="rounded-md p-2 transition"
        :class="
          !isActualEffectPreview && activeTool === tool.id
            ? 'bg-ink-900 text-white dark:bg-ink-50 dark:text-ink-900'
            : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-white/10'
        "
        type="button"
        :title="tool.label"
        @click="emit('selectTool', tool.id)"
      >
        <Icon :icon="tool.icon" class="h-4 w-4" />
      </button>
      <button
        class="rounded-md p-2 transition"
        :class="
          isActualEffectPreview
            ? 'bg-ink-900 text-white dark:bg-ink-50 dark:text-ink-900'
            : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-white/10'
        "
        type="button"
        :title="isActualEffectPreview ? '返回编辑图纸' : '预览实际效果图'"
        @click="emit('togglePreviewMode')"
      >
        <Icon :icon="isActualEffectPreview ? 'ri:grid-line' : 'ri:eye-line'" class="h-4 w-4" />
      </button>
      <button
        class="rounded-md p-2 text-ink-600 transition hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-white/10"
        type="button"
        :title="isPatternFullscreen ? '退出全屏' : '全屏预览'"
        @click="emit('toggleFullscreen')"
      >
        <Icon :icon="isPatternFullscreen ? 'ri:fullscreen-exit-line' : 'ri:fullscreen-line'" class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>
