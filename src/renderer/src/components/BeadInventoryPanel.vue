<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { BeadInventoryItem } from '../utils/pattern'

defineProps<{
  beadInventory: BeadInventoryItem[]
}>()

const emit = defineEmits<{
  exportInventory: []
}>()
</script>

<template>
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
        @click="emit('exportInventory')"
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
</template>
