<script setup lang="ts">
import { Icon } from '@iconify/vue'

interface AiProviderOption {
  id: string
  name: string
}

defineProps<{
  sourcePreviewDataUrl: string
  sourceFileName: string
  patternSourceName: string
  isAiOptimizeMode: boolean
  selectedProviderId: string
  newProviderId: string
  aiProviderOptions: AiProviderOption[]
  selectedModel: string
}>()

const emit = defineEmits<{
  imageSelected: [event: Event]
  openAiSettings: []
  'update:selectedProviderId': [value: string]
  providerChange: []
}>()

const onProviderSelect = (event: Event): void => {
  emit('update:selectedProviderId', (event.target as HTMLSelectElement).value)
  emit('providerChange')
}
</script>

<template>
  <label
    class="group flex min-h-32 cursor-pointer flex-col justify-center rounded-md border border-dashed border-ink-200 bg-ink-50 p-3 text-center transition hover:border-bead-sky hover:bg-bead-sky/5 dark:border-white/10 dark:bg-ink-900 dark:hover:bg-bead-sky/10"
    title="上传 AI 参考图片"
  >
    <template v-if="sourcePreviewDataUrl">
      <div class="flex w-full items-center gap-3 text-left">
        <div class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded border border-ink-100 bg-white dark:border-white/10 dark:bg-ink-800">
          <img class="h-full w-full object-contain" :src="sourcePreviewDataUrl" :alt="sourceFileName || '原图预览'" />
        </div>
        <div class="min-w-0 flex-1">
          <span class="flex items-center gap-1.5 text-xs font-semibold text-ink-800 dark:text-ink-100">
            <Icon icon="ri:image-edit-line" class="h-3.5 w-3.5 text-bead-sky" />
            原图预览 · 点击更换
          </span>
          <span class="mt-1 block max-w-full truncate text-xs text-ink-500 dark:text-ink-400">
            {{ sourceFileName }}
          </span>
          <span class="mt-2 inline-flex items-center rounded bg-bead-sky/10 px-2 py-1 text-[11px] font-semibold text-bead-sky">
            缩略图
          </span>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="flex min-h-28 flex-col items-center justify-center px-3 py-4">
        <Icon icon="ri:image-add-line" class="h-8 w-8 text-bead-sky" />
        <span class="mt-2 text-sm font-semibold text-ink-800 dark:text-ink-100">
          {{ sourceFileName ? '更换图片' : '上传图片' }}
        </span>
        <span class="mt-1 block max-w-full truncate text-xs text-ink-500 dark:text-ink-400">
          {{ sourceFileName || patternSourceName }}
        </span>
      </div>
    </template>
    <input class="hidden" type="file" accept="image/*" @change="emit('imageSelected', $event)" />
  </label>

  <div v-if="isAiOptimizeMode" class="rounded-md border border-ink-100 bg-ink-50 p-3 dark:border-white/10 dark:bg-ink-900">
    <div class="mb-3 flex items-center justify-between gap-2">
      <div>
        <h4 class="text-xs font-semibold text-ink-700 dark:text-ink-100">AI 服务</h4>
        <p class="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400">选择 API 厂商和生图模型</p>
      </div>
      <button
        class="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-ink-200 px-2.5 py-1.5 text-xs font-semibold text-ink-700 transition hover:bg-white dark:border-white/10 dark:text-ink-100 dark:hover:bg-white/10"
        type="button"
        title="配置 API 厂商"
        @click="emit('openAiSettings')"
      >
        <Icon icon="ri:settings-4-line" class="h-3.5 w-3.5" />
        <span>配置</span>
      </button>
    </div>

    <label class="block space-y-1.5">
      <span class="block text-xs font-medium text-ink-600 dark:text-ink-300">API 厂商</span>
      <select
        :value="selectedProviderId"
        class="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-800 outline-none transition focus:border-bead-sky dark:border-white/10 dark:bg-ink-900 dark:text-ink-100"
        @change="onProviderSelect"
      >
        <option :value="newProviderId" disabled>
          {{ aiProviderOptions.length === 0 ? '请先配置 API 厂商' : '请选择 API 厂商' }}
        </option>
        <option v-for="provider in aiProviderOptions" :key="provider.id" :value="provider.id">
          {{ provider.name }}
        </option>
      </select>
    </label>

    <div class="mt-3 rounded-md border border-ink-100 bg-white px-3 py-2 text-xs dark:border-white/10 dark:bg-ink-800">
      <span class="block text-ink-500 dark:text-ink-400">模型</span>
      <strong class="mt-1 block truncate text-ink-800 dark:text-ink-100">{{ selectedModel || '未选择' }}</strong>
    </div>
  </div>
</template>
