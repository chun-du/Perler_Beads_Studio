<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{
  isOptimizingImage: boolean
  aiOptimizeError: string
  aiOptimizeStatus: string
  aiOptimizeElapsedLabel: string
  aiReferenceDataUrl: string
  aiReferenceName: string
}>()
</script>

<template>
  <div class="overflow-hidden rounded-md border border-ink-100 bg-ink-50 dark:border-white/10 dark:bg-ink-900">
    <div v-if="isOptimizingImage" class="flex min-h-36 flex-col items-center justify-center gap-3 px-3 py-5 text-center">
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

    <div v-else-if="aiOptimizeError" class="min-h-28 px-3 py-4 text-sm">
      <div class="flex items-start gap-2 rounded-md border border-bead-coral/30 bg-bead-coral/10 px-3 py-2 text-bead-coral">
        <Icon icon="ri:error-warning-line" class="mt-0.5 h-4 w-4 shrink-0" />
        <div class="min-w-0">
          <strong class="block">AI 优化失败</strong>
          <span class="mt-1 block break-words text-xs">{{ aiOptimizeError }}</span>
          <span class="mt-1 block text-xs">耗时 {{ aiOptimizeElapsedLabel }}</span>
        </div>
      </div>
    </div>

    <div v-else-if="aiReferenceDataUrl" class="space-y-2 p-3">
      <div class="overflow-hidden rounded-md border border-ink-100 bg-white dark:border-white/10 dark:bg-ink-800">
        <img class="max-h-48 w-full object-contain" :src="aiReferenceDataUrl" :alt="aiReferenceName || 'AI 优化结果'" />
      </div>
      <div class="rounded-md border border-bead-mint/30 bg-bead-mint/10 px-3 py-2 text-xs text-ink-700 dark:text-ink-100">
        <strong class="block">{{ aiOptimizeStatus || 'AI 优化完成' }}</strong>
        <span class="mt-1 block text-ink-500 dark:text-ink-400">耗时 {{ aiOptimizeElapsedLabel }}</span>
      </div>
    </div>

    <div v-else class="flex min-h-28 flex-col items-center justify-center px-3 py-5 text-center text-xs text-ink-500 dark:text-ink-400">
      <Icon icon="ri:image-edit-line" class="mb-2 h-6 w-6 text-bead-sky" />
      <span>AI 优化结果将在这里显示</span>
    </div>
  </div>
</template>
