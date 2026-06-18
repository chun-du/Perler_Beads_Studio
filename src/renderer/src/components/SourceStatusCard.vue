<script setup lang="ts">
defineProps<{
  sourceName: string
  generationMessage: string
  generationError: string
  projectStatus: string
  isAiOptimizeMode: boolean
  isPixelArtInputMode: boolean
}>()
</script>

<template>
  <div class="rounded-md border border-ink-100 p-3 text-xs dark:border-white/10">
    <span class="block text-ink-500 dark:text-ink-400">来源</span>
    <strong class="mt-1 block truncate">{{ sourceName }}</strong>
    <span class="mt-2 block text-ink-600 dark:text-ink-300" :class="generationError ? 'text-bead-coral' : ''">
      {{ generationError || generationMessage }}
    </span>
    <span class="mt-1 block text-ink-500 dark:text-ink-400">
      {{ projectStatus }}
    </span>
    <span v-if="isAiOptimizeMode" class="mt-2 block text-bead-sky">
      AI 优化：抖色和像素清理暂不参与本次生成
    </span>
    <span v-else-if="isPixelArtInputMode" class="mt-2 block text-bead-sky">
      像素画模式：自动去外部空白、等比适配画板，抖色、像素清理和最大颜色限制不参与
    </span>
  </div>
</template>
