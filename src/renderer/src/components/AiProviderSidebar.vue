<script setup lang="ts">
import { Icon } from '@iconify/vue'

interface AiProviderOption {
  id: string
  name: string
  baseUrl: string
  isSavedProfile: boolean
}

defineProps<{
  aiProviderOptions: AiProviderOption[]
  selectedProviderId: string
}>()

const emit = defineEmits<{
  selectProvider: [id: string]
  resetProviderForm: []
}>()
</script>

<template>
  <aside class="rounded-xl border border-ink-100 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-ink-800">
    <div class="mb-3 px-2 text-xs font-semibold text-ink-500 dark:text-ink-400">平台列表</div>
    <div class="space-y-2">
      <button
        v-for="provider in aiProviderOptions"
        :key="provider.id"
        type="button"
        class="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition"
        :class="
          selectedProviderId === provider.id
            ? 'bg-ink-100 text-ink-900 dark:bg-white/10 dark:text-white'
            : 'text-ink-600 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-white/5'
        "
        @click="emit('selectProvider', provider.id)"
      >
        <span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-50 dark:bg-ink-900">
          <Icon :icon="provider.isSavedProfile ? 'ri:key-2-line' : 'ri:apps-2-line'" class="h-4 w-4" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-bold">{{ provider.name }}</span>
          <span class="block truncate text-[11px] text-ink-500 dark:text-ink-400">
            {{ provider.baseUrl }}
          </span>
        </span>
        <span class="rounded-full bg-ink-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-500 dark:bg-ink-900 dark:text-ink-400">
          Saved
        </span>
      </button>
      <div
        v-if="aiProviderOptions.length === 0"
        class="rounded-lg border border-dashed border-ink-200 px-3 py-8 text-center text-xs font-semibold text-ink-400 dark:border-white/10"
      >
        暂无已保存平台
      </div>
    </div>

    <div class="mt-4 border-t border-ink-100 pt-4 dark:border-white/10">
      <button
        class="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-ink-200 px-3 py-2.5 text-sm font-semibold text-ink-600 transition hover:bg-ink-50 dark:border-white/10 dark:text-ink-300 dark:hover:bg-white/5"
        type="button"
        @click="emit('resetProviderForm')"
      >
        <Icon icon="ri:add-line" class="h-4 w-4" />
        <span>新增平台</span>
      </button>
    </div>
  </aside>
</template>
