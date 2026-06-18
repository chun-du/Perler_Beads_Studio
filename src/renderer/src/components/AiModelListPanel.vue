<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{
  modelOptions: string[]
  selectedModel: string
  isFetchingModels: boolean
  modelStatus: string
  modelError: string
}>()

const emit = defineEmits<{
  fetchModels: []
  'update:selectedModel': [value: string]
}>()
</script>

<template>
  <div class="rounded-xl border border-ink-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-ink-800">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h5 class="text-sm font-bold">模型列表</h5>
        <p class="mt-1 text-xs font-medium text-ink-500 dark:text-ink-400">
          从上游 API 拉取后仅展示可识别的生图模型
        </p>
      </div>
      <button
        class="inline-flex items-center justify-center gap-2 rounded-lg bg-ink-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-700 disabled:opacity-50 dark:bg-white dark:text-ink-900"
        type="button"
        title="拉取模型"
        :disabled="isFetchingModels"
        @click="emit('fetchModels')"
      >
        <Icon icon="ri:refresh-line" class="h-4 w-4" :class="isFetchingModels ? 'animate-spin' : ''" />
        <span>{{ isFetchingModels ? '拉取中' : '拉取模型' }}</span>
      </button>
    </div>

    <div class="space-y-2">
      <label
        v-for="model in modelOptions"
        :key="model"
        class="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 transition"
        :class="
          selectedModel === model
            ? 'border-bead-sky bg-bead-sky/10'
            : 'border-ink-100 bg-ink-50 hover:border-ink-200 dark:border-white/10 dark:bg-ink-900 dark:hover:border-white/20'
        "
      >
        <input
          class="sr-only"
          name="ai-image-model"
          type="radio"
          :value="model"
          :checked="selectedModel === model"
          @change="emit('update:selectedModel', model)"
        />
        <Icon icon="ri:image-line" class="h-4 w-4 text-bead-sky" />
        <span class="min-w-0 flex-1 truncate text-sm font-semibold">{{ model }}</span>
        <Icon v-if="selectedModel === model" icon="ri:check-line" class="h-4 w-4 text-bead-sky" />
      </label>

      <div
        v-if="modelOptions.length === 0"
        class="rounded-lg border border-dashed border-ink-200 px-3 py-6 text-center text-sm font-semibold text-ink-400 dark:border-white/10"
      >
        暂无生图模型
      </div>
    </div>

    <p
      v-if="modelStatus || modelError"
      class="mt-3 rounded-lg border px-3 py-2 text-xs"
      :class="
        modelError
          ? 'border-bead-coral/30 bg-bead-coral/10 text-bead-coral'
          : 'border-bead-mint/30 bg-bead-mint/10 text-ink-700 dark:text-ink-100'
      "
    >
      {{ modelError || modelStatus }}
    </p>
  </div>
</template>
