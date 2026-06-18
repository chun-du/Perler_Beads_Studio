<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { ThemePreference } from '@shared/theme'

defineProps<{
  previewColumns: number
  previewRows: number
  manufacturerName: string
  usedColorCount: number
  themeOptions: Array<{ value: ThemePreference; label: string; icon: string }>
  preference: ThemePreference
  resolvedTheme: 'light' | 'dark'
}>()

const emit = defineEmits<{
  setPreference: [value: ThemePreference]
  openProject: []
  saveProject: []
  printPattern: []
  exportPattern: []
}>()
</script>

<template>
  <header class="flex h-16 shrink-0 items-center justify-between border-b border-ink-100 bg-white/82 px-5 dark:border-white/10 dark:bg-ink-800/78">
    <div class="flex min-w-0 items-center gap-3">
      <div class="grid h-10 w-10 shrink-0 grid-cols-3 gap-0.5 rounded-md bg-ink-900 p-1 dark:bg-ink-50">
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
        <p class="truncate text-xs text-ink-600 dark:text-ink-300">
          {{ previewColumns }} x {{ previewRows }} · {{ manufacturerName }} · {{ usedColorCount }} 色
        </p>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <div class="grid grid-cols-3 gap-1 rounded-md border border-ink-200 bg-ink-100 p-1 dark:border-white/10 dark:bg-ink-900">
        <button
          v-for="option in themeOptions"
          :key="option.value"
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded transition hover:brightness-105"
          :style="
            preference === option.value
              ? {
                  backgroundColor: resolvedTheme === 'dark' ? '#f8f7f4' : '#ffffff',
                  color: '#191715',
                  boxShadow: '0 1px 2px rgb(25 23 21 / 0.16)'
                }
              : {
                  backgroundColor: 'transparent',
                  color: resolvedTheme === 'dark' ? '#ece8df' : '#63594d'
                }
          "
          :title="`主题: ${option.label}`"
          @click="emit('setPreference', option.value)"
        >
          <Icon :icon="option.icon" class="h-4 w-4" />
        </button>
      </div>

      <button class="inline-flex items-center gap-2 rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-700 transition hover:bg-ink-50 dark:border-white/10 dark:text-ink-200 dark:hover:bg-white/5" type="button" title="打开项目" @click="emit('openProject')">
        <Icon icon="ri:folder-open-line" class="h-4 w-4" />
        <span>打开</span>
      </button>
      <button class="inline-flex items-center gap-2 rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-700 transition hover:bg-ink-50 dark:border-white/10 dark:text-ink-200 dark:hover:bg-white/5" type="button" title="保存项目" @click="emit('saveProject')">
        <Icon icon="ri:save-3-line" class="h-4 w-4" />
        <span>保存</span>
      </button>
      <button class="inline-flex items-center gap-2 rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-700 transition hover:bg-ink-50 dark:border-white/10 dark:text-ink-200 dark:hover:bg-white/5" type="button" title="打印或另存为 PDF" @click="emit('printPattern')">
        <Icon icon="ri:printer-line" class="h-4 w-4" />
        <span>打印</span>
      </button>
      <button class="inline-flex items-center gap-2 rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-700 transition hover:bg-ink-50 dark:border-white/10 dark:text-ink-200 dark:hover:bg-white/5" type="button" title="导出 PNG 图纸" @click="emit('exportPattern')">
        <Icon icon="ri:file-download-line" class="h-4 w-4" />
        <span>导出</span>
      </button>
    </div>
  </header>
</template>
