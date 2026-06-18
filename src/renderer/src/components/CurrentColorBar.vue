<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { BeadInventoryItem } from '../utils/pattern'
import type { BeadColor } from '../data/palettes'

defineProps<{
  selectedColorHex: string
  selectedColorId: string
  selectedColorName: string
  selectedColorLabel: string
  manufacturerName: string
  isPalettePickerOpen: boolean
  paletteSearchQuery: string
  filteredPaletteColors: BeadColor[]
  activePaletteColorCount: number
  usedColorCounts: Map<string, number>
  displayedColors: BeadInventoryItem[]
}>()

const emit = defineEmits<{
  'update:isPalettePickerOpen': [value: boolean]
  'update:paletteSearchQuery': [value: string]
  selectColor: [hex: string]
}>()
</script>

<template>
  <div class="border-t border-ink-100 px-4 py-3 dark:border-white/10">
    <div class="flex min-w-0 items-center gap-3">
      <div class="relative flex shrink-0 items-center gap-2">
        <Icon icon="ri:palette-line" class="h-4 w-4 text-bead-violet" />
        <span class="text-xs font-semibold text-ink-600 dark:text-ink-300">当前用色</span>
        <button
          class="inline-flex h-9 max-w-44 items-center gap-2 rounded-md border border-ink-200 bg-white px-2.5 text-left text-xs transition hover:border-ink-300 hover:bg-ink-50 dark:border-white/10 dark:bg-ink-800 dark:hover:bg-white/5"
          :class="isPalettePickerOpen ? 'border-bead-violet ring-2 ring-bead-violet/20' : ''"
          type="button"
          :title="`从 ${manufacturerName} 色卡选择颜色`"
          @click.stop="emit('update:isPalettePickerOpen', !isPalettePickerOpen)"
        >
          <span
            class="h-5 w-5 shrink-0 rounded border border-ink-200 dark:border-white/10"
            :style="{ backgroundColor: selectedColorHex }"
          ></span>
          <span class="min-w-0">
            <span class="block truncate font-semibold text-ink-800 dark:text-ink-100">{{ selectedColorId }}</span>
            <span class="block truncate text-[10px] text-ink-500 dark:text-ink-400">{{ selectedColorName }}</span>
          </span>
          <Icon icon="ri:arrow-down-s-line" class="h-4 w-4 shrink-0 text-ink-500 dark:text-ink-400" />
        </button>

        <div
          v-if="isPalettePickerOpen"
          class="absolute bottom-11 left-0 z-30 w-[min(34rem,calc(100vw-2rem))] rounded-md border border-ink-100 bg-white shadow-panel dark:border-white/10 dark:bg-ink-800"
          @click.stop
        >
          <div class="flex items-center gap-2 border-b border-ink-100 p-3 dark:border-white/10">
            <Icon icon="ri:search-line" class="h-4 w-4 shrink-0 text-ink-500 dark:text-ink-400" />
            <input
              :value="paletteSearchQuery"
              class="h-9 min-w-0 flex-1 rounded-md border border-ink-100 bg-ink-50 px-3 text-sm outline-none transition focus:border-bead-violet dark:border-white/10 dark:bg-ink-900"
              type="search"
              placeholder="搜索编号、名称或 HEX"
              @input="emit('update:paletteSearchQuery', ($event.target as HTMLInputElement).value)"
            />
            <button
              class="rounded-md p-2 text-ink-500 transition hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-white/10"
              type="button"
              title="关闭色卡"
              @click="emit('update:isPalettePickerOpen', false)"
            >
              <Icon icon="ri:close-line" class="h-4 w-4" />
            </button>
          </div>

          <div class="flex items-center justify-between gap-3 px-3 py-2 text-xs text-ink-500 dark:text-ink-400">
            <span class="truncate">{{ manufacturerName }} · {{ filteredPaletteColors.length }} / {{ activePaletteColorCount }} 色</span>
            <span class="shrink-0 truncate">{{ selectedColorLabel }}</span>
          </div>

          <div class="tool-scroll grid max-h-80 grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-2 overflow-y-auto px-3 pb-3">
            <button
              v-for="color in filteredPaletteColors"
              :key="color.id"
              type="button"
              class="min-h-20 rounded-md border p-2 text-left text-[11px] transition hover:border-ink-300 hover:bg-ink-50 dark:border-white/10 dark:hover:bg-white/5"
              :class="
                selectedColorHex === color.hex
                  ? 'border-bead-coral bg-bead-coral/10 ring-2 ring-bead-coral/20'
                  : 'border-ink-100'
              "
              :title="`${color.id} ${color.name} ${color.hex}`"
              @click="emit('selectColor', color.hex)"
            >
              <span class="block h-7 rounded border border-ink-100 dark:border-white/10" :style="{ backgroundColor: color.hex }"></span>
              <span class="mt-1 block truncate font-semibold text-ink-800 dark:text-ink-100">{{ color.id }}</span>
              <span class="block truncate text-ink-500 dark:text-ink-400">{{ color.name }}</span>
              <span v-if="usedColorCounts.get(color.hex)" class="mt-1 block text-[10px] text-bead-violet">
                已用 {{ usedColorCounts.get(color.hex) }}
              </span>
            </button>
          </div>

          <div v-if="filteredPaletteColors.length === 0" class="px-3 pb-3 text-sm text-ink-500 dark:text-ink-400">
            没有匹配的颜色
          </div>
        </div>
      </div>

      <div class="tool-scroll flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
        <button
          v-for="color in displayedColors"
          :key="color.id"
          type="button"
          class="grid h-14 min-w-24 grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 rounded-md border px-2 text-left text-[11px] transition hover:border-ink-300 dark:border-white/10"
          :class="
            selectedColorHex === color.hex
              ? 'border-bead-coral bg-bead-coral/10'
              : 'border-ink-100'
          "
          :title="`${color.id} ${color.name}`"
          @click="emit('selectColor', color.hex)"
        >
          <span class="h-8 w-8 rounded border border-ink-100 dark:border-white/10" :style="{ backgroundColor: color.hex }"></span>
          <span class="min-w-0">
            <span class="block truncate font-semibold">{{ color.id }}</span>
            <span class="block truncate text-ink-500 dark:text-ink-400">{{ color.count }}</span>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
