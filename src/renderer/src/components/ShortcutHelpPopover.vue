<script setup lang="ts">
import { Icon } from '@iconify/vue'

interface ShortcutGroup {
  title: string
  items: Array<{ keys: string; label: string }>
}

defineProps<{
  isOpen: boolean
  shortcutGroups: ShortcutGroup[]
}>()

const emit = defineEmits<{
  'update:isOpen': [value: boolean]
}>()
</script>

<template>
  <div
    class="absolute bottom-4 right-4 z-20"
    @click.stop
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
    @pointercancel.stop
    @wheel.stop
  >
    <button
      class="flex h-11 w-11 items-center justify-center rounded-md border border-ink-200 bg-white/92 text-ink-600 shadow-panel backdrop-blur transition hover:border-bead-sky hover:text-bead-sky dark:border-white/10 dark:bg-ink-800/92 dark:text-ink-200 dark:hover:text-bead-sky"
      :class="isOpen ? 'border-bead-sky text-bead-sky ring-2 ring-bead-sky/20' : ''"
      type="button"
      title="查看快捷键"
      aria-label="查看快捷键"
      :aria-expanded="isOpen"
      @click.stop="emit('update:isOpen', !isOpen)"
    >
      <Icon icon="ri:keyboard-line" class="h-5 w-5" />
    </button>

    <div
      v-if="isOpen"
      class="absolute bottom-14 right-0 w-[min(24rem,calc(100vw-2rem))] rounded-md border border-ink-100 bg-white p-3 text-xs shadow-panel dark:border-white/10 dark:bg-ink-800"
    >
      <div class="mb-3 flex items-center justify-between gap-3">
        <span class="inline-flex items-center gap-2 font-semibold text-ink-800 dark:text-ink-100">
          <Icon icon="ri:keyboard-line" class="h-4 w-4 text-bead-sky" />
          快捷键
        </span>
        <button
          class="rounded p-1 text-ink-500 transition hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-white/10 dark:hover:text-ink-50"
          type="button"
          title="关闭快捷键"
          @click.stop="emit('update:isOpen', false)"
        >
          <Icon icon="ri:close-line" class="h-4 w-4" />
        </button>
      </div>

      <div class="space-y-3">
        <div v-for="group in shortcutGroups" :key="group.title">
          <span class="mb-1.5 block text-[11px] font-semibold text-ink-500 dark:text-ink-400">{{ group.title }}</span>
          <div class="space-y-1.5">
            <div
              v-for="item in group.items"
              :key="`${group.title}-${item.keys}`"
              class="flex items-center justify-between gap-3"
            >
              <span class="min-w-0 truncate text-ink-600 dark:text-ink-300">{{ item.label }}</span>
              <kbd class="shrink-0 rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-700 shadow-sm dark:border-white/10 dark:bg-ink-900 dark:text-ink-100">
                {{ item.keys }}
              </kbd>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
