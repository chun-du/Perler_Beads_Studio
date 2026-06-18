<script setup lang="ts">
defineProps<{
  totalCells: number
  colorCount: number
  activeToolLabel: string
  patternStatus: string
  inputModeLabel: string
  ditheringStatusLabel: string
  cleanupStatusLabel: string
}>()
</script>

<template>
  <div class="grid grid-cols-6 gap-3 border-t border-ink-100 px-4 py-3 text-sm dark:border-white/10">
    <div>
      <span class="block text-xs text-ink-500 dark:text-ink-400">格子</span>
      <strong>{{ totalCells }}</strong>
    </div>
    <div>
      <span class="block text-xs text-ink-500 dark:text-ink-400">颜色</span>
      <strong>{{ colorCount }}</strong>
    </div>
    <div>
      <span class="block text-xs text-ink-500 dark:text-ink-400">工具</span>
      <strong>{{ activeToolLabel }}</strong>
    </div>
    <div>
      <span class="block text-xs text-ink-500 dark:text-ink-400">状态</span>
      <strong>{{ patternStatus }}</strong>
    </div>
    <div>
      <span class="block text-xs text-ink-500 dark:text-ink-400">模式</span>
      <strong>{{ inputModeLabel }}</strong>
    </div>
    <div>
      <span class="block text-xs text-ink-500 dark:text-ink-400">抖色 / 清理</span>
      <strong>{{ ditheringStatusLabel }} / {{ cleanupStatusLabel }}</strong>
    </div>
  </div>
</template>
