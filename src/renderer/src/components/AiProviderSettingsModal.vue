<script setup lang="ts">
import { Icon } from '@iconify/vue'
import AiModelListPanel from './AiModelListPanel.vue'
import AiProviderSidebar from './AiProviderSidebar.vue'

interface AiProviderOption {
  id: string
  name: string
  baseUrl: string
  isSavedProfile: boolean
}

interface SelectedProvider {
  name: string
  isSavedProfile: boolean
}

defineProps<{
  isOpen: boolean
  apiSettingsDescription: string
  aiProviderOptions: AiProviderOption[]
  selectedProviderId: string
  selectedProvider: SelectedProvider
  providerName: string
  baseUrl: string
  apiKey: string
  selectedProviderHasStoredKey: boolean
  apiKeyStorageHint: string
  providerNoticeMessage: string
  providerNoticeIsError: boolean
  isDeletingProvider: boolean
  isSavingProvider: boolean
  modelOptions: string[]
  selectedModel: string
  isFetchingModels: boolean
  modelStatus: string
  modelError: string
}>()

const emit = defineEmits<{
  close: []
  selectProvider: [id: string]
  resetProviderForm: []
  deleteProviderProfile: []
  saveProviderProfile: []
  fetchModels: []
  'update:providerName': [value: string]
  'update:baseUrl': [value: string]
  'update:apiKey': [value: string]
  'update:selectedModel': [value: string]
}>()
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-40 flex items-center justify-center bg-ink-900/45 p-4">
    <section class="flex max-h-[min(50rem,calc(100vh-2rem))] w-full max-w-6xl flex-col rounded-xl border border-ink-100 bg-ink-50 shadow-panel dark:border-white/10 dark:bg-ink-900">
      <div class="flex items-start justify-between gap-3 px-6 py-5">
        <div class="min-w-0">
          <div class="flex min-w-0 items-center gap-2">
            <Icon icon="ri:settings-4-line" class="h-5 w-5 text-bead-sky" />
            <h3 class="truncate text-xl font-black tracking-tight">API 设置</h3>
          </div>
          <p class="mt-1 text-xs font-medium text-ink-500 dark:text-ink-400">
            {{ apiSettingsDescription }}
          </p>
        </div>
        <button
          class="rounded-md p-2 text-ink-500 transition hover:bg-white dark:text-ink-300 dark:hover:bg-white/10"
          type="button"
          title="关闭"
          @click="emit('close')"
        >
          <Icon icon="ri:close-line" class="h-4 w-4" />
        </button>
      </div>

      <form class="tool-scroll grid min-h-0 gap-4 overflow-auto px-6 pb-6 lg:grid-cols-[17rem_minmax(0,1fr)]" @submit.prevent>
        <input autocomplete="username" class="hidden" tabindex="-1" type="text" value="ai-provider" />

        <AiProviderSidebar
          :ai-provider-options="aiProviderOptions"
          :selected-provider-id="selectedProviderId"
          @select-provider="emit('selectProvider', $event)"
          @reset-provider-form="emit('resetProviderForm')"
        />

        <div class="min-w-0 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-ink-800">
            <div class="min-w-0">
              <h4 class="truncate text-2xl font-black tracking-tight">{{ providerName || selectedProvider.name }}</h4>
              <p class="mt-1 text-xs font-semibold text-ink-500 dark:text-ink-400">
                配置基础信息、API Key 和可用生图模型
              </p>
            </div>
            <div class="flex shrink-0 gap-2">
              <button
                class="inline-flex items-center justify-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-50 disabled:opacity-50 dark:border-white/10 dark:text-ink-200 dark:hover:bg-white/5"
                type="button"
                title="删除供应商档案"
                :disabled="!selectedProvider.isSavedProfile || isDeletingProvider"
                @click="emit('deleteProviderProfile')"
              >
                <Icon icon="ri:delete-bin-line" class="h-4 w-4" :class="isDeletingProvider ? 'animate-spin' : ''" />
                <span>删除</span>
              </button>
              <button
                class="inline-flex items-center justify-center gap-2 rounded-lg bg-ink-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-700 disabled:opacity-50 dark:bg-white dark:text-ink-900"
                type="button"
                title="保存供应商档案"
                :disabled="isSavingProvider"
                @click="emit('saveProviderProfile')"
              >
                <Icon icon="ri:save-3-line" class="h-4 w-4" :class="isSavingProvider ? 'animate-spin' : ''" />
                <span>保存</span>
              </button>
            </div>
          </div>

          <div class="rounded-xl border border-ink-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-ink-800">
            <div class="grid gap-4 md:grid-cols-2">
              <label class="block space-y-1.5">
                <span class="text-xs font-semibold text-ink-600 dark:text-ink-300">平台名称</span>
                <input
                  :value="providerName"
                  class="w-full rounded-lg border border-ink-200 bg-ink-50 px-3 py-3 text-sm font-semibold outline-none focus:border-bead-sky dark:border-white/10 dark:bg-ink-900"
                  type="text"
                  @input="emit('update:providerName', ($event.target as HTMLInputElement).value)"
                />
                <span class="text-[11px] font-medium text-ink-500 dark:text-ink-400">
                  平台 ID: {{ selectedProviderId }}
                </span>
              </label>

              <label class="block space-y-1.5">
                <span class="text-xs font-semibold text-ink-600 dark:text-ink-300">请求地址</span>
                <input
                  :value="baseUrl"
                  class="w-full rounded-lg border border-ink-200 bg-ink-50 px-3 py-3 text-sm font-semibold outline-none focus:border-bead-sky dark:border-white/10 dark:bg-ink-900"
                  type="url"
                  @input="emit('update:baseUrl', ($event.target as HTMLInputElement).value)"
                />
              </label>

              <label class="block space-y-1.5 md:col-span-2">
                <span class="text-xs font-semibold text-ink-600 dark:text-ink-300">API Key</span>
                <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <input
                    :value="apiKey"
                    class="w-full rounded-lg border border-ink-200 bg-ink-50 px-3 py-3 text-sm font-semibold outline-none focus:border-bead-sky dark:border-white/10 dark:bg-ink-900"
                    autocomplete="new-password"
                    :placeholder="selectedProviderHasStoredKey ? '保持当前 Key ********' : 'sk-...'"
                    type="password"
                    @input="emit('update:apiKey', ($event.target as HTMLInputElement).value)"
                  />
                  <button
                    class="inline-flex items-center justify-center gap-2 rounded-lg border border-ink-200 px-4 py-3 text-sm font-semibold text-ink-700 transition hover:bg-ink-50 dark:border-white/10 dark:text-ink-200 dark:hover:bg-white/5"
                    type="button"
                    title="保存供应商档案"
                    :disabled="isSavingProvider"
                    @click="emit('saveProviderProfile')"
                  >
                    <Icon icon="ri:check-line" class="h-4 w-4" />
                  </button>
                </div>
                <span class="text-[11px] font-medium text-ink-500 dark:text-ink-400">
                  {{ apiKeyStorageHint }}
                </span>
              </label>
            </div>
          </div>

          <p
            v-if="providerNoticeMessage"
            class="rounded-lg border px-3 py-2 text-xs"
            :class="
              providerNoticeIsError
                ? 'border-bead-coral/30 bg-bead-coral/10 text-bead-coral'
                : 'border-bead-sky/30 bg-bead-sky/10 text-ink-700 dark:text-ink-100'
            "
          >
            {{ providerNoticeMessage }}
          </p>

          <AiModelListPanel
            :selected-model="selectedModel"
            :model-options="modelOptions"
            :is-fetching-models="isFetchingModels"
            :model-status="modelStatus"
            :model-error="modelError"
            @update:selected-model="emit('update:selectedModel', $event)"
            @fetch-models="emit('fetchModels')"
          />
        </div>
      </form>
    </section>
  </div>
</template>
