<script setup lang="ts">
type AiCreationMode = 'generate' | 'optimize'

defineProps<{
  aiCreationModes: Array<{ id: AiCreationMode; label: string; description: string }>
  aiCreationMode: AiCreationMode
  resolvedTheme: 'light' | 'dark'
}>()

const emit = defineEmits<{
  'update:aiCreationMode': [mode: AiCreationMode]
}>()
</script>

<template>
  <div class="space-y-2">
    <span class="text-xs font-medium text-ink-600 dark:text-ink-300">生成方式</span>
    <div class="grid grid-cols-2 gap-1 rounded-md border border-ink-200 bg-ink-100 p-1 dark:border-white/10 dark:bg-ink-900">
      <button
        v-for="mode in aiCreationModes"
        :key="mode.id"
        class="rounded px-3 py-2 text-sm font-semibold transition hover:brightness-105"
        :style="
          aiCreationMode === mode.id
            ? {
                backgroundColor: resolvedTheme === 'dark' ? '#f8f7f4' : '#ffffff',
                color: '#191715',
                boxShadow: '0 1px 2px rgb(25 23 21 / 0.16)'
              }
            : {
                backgroundColor: resolvedTheme === 'dark' ? '#191715' : 'transparent',
                color: resolvedTheme === 'dark' ? '#ece8df' : '#63594d'
              }
        "
        type="button"
        @click="emit('update:aiCreationMode', mode.id)"
      >
        {{ mode.label }}
      </button>
    </div>
    <span class="block text-[11px] text-ink-500 dark:text-ink-400">
      {{ aiCreationModes.find((mode) => mode.id === aiCreationMode)?.description }}
    </span>
  </div>
</template>
