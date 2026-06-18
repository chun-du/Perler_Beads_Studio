<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{
  isOpen: boolean
  sourcePreviewDataUrl: string
  boardStyle: Record<string, string>
  imageStyle: Record<string, string>
  gridStyle: Record<string, string>
  draftLabel: string
  draftScale: number
  draftOffsetX: number
  draftOffsetY: number
  originalScale: number
  originalOffsetX: number
  originalOffsetY: number
}>()

const emit = defineEmits<{
  close: []
  pointerDown: [event: PointerEvent]
  pointerMove: [event: PointerEvent]
  pointerUp: [event: PointerEvent]
  wheel: [event: WheelEvent]
  adjustScale: [amount: number]
  updateDraftScale: [value: number]
  updateDraftOffsetX: [value: number]
  updateDraftOffsetY: [value: number]
  nudge: [axis: 'x' | 'y', amount: number]
  reset: []
  revert: []
  apply: []
}>()
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 p-4 backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <section class="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-white shadow-2xl dark:bg-ink-900">
      <header class="flex shrink-0 items-center justify-between gap-4 border-b border-ink-100 px-5 py-4 dark:border-white/10">
        <div class="min-w-0">
          <h3 class="truncate text-base font-black">像素画精细校准</h3>
          <p class="mt-1 text-xs text-ink-500 dark:text-ink-400">
            拖动底图移动位置，滚轮或滑杆缩放。蓝色网格固定为最终拼豆画板。
          </p>
        </div>
        <button
          class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink-200 text-ink-600 transition hover:bg-ink-50 dark:border-white/10 dark:text-ink-200 dark:hover:bg-white/5"
          type="button"
          @click="emit('close')"
        >
          <Icon icon="ri:close-line" class="h-5 w-5" />
        </button>
      </header>

      <div class="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div class="flex min-h-[420px] min-w-0 items-center justify-center overflow-hidden">
          <div
            class="relative w-full max-w-[calc(92vh-8rem)] touch-none cursor-grab select-none overflow-hidden rounded-xl border border-ink-200 bg-white [-webkit-user-drag:none] [user-drag:none] active:cursor-grabbing dark:border-white/10 dark:bg-ink-950"
            :style="boardStyle"
            @dragover.prevent
            @dragstart.prevent
            @drop.prevent
            @pointerdown="emit('pointerDown', $event)"
            @pointermove="emit('pointerMove', $event)"
            @pointerup="emit('pointerUp', $event)"
            @pointercancel="emit('pointerUp', $event)"
            @wheel="emit('wheel', $event)"
          >
            <img
              class="pointer-events-none absolute max-w-none select-none [-webkit-user-drag:none] [user-drag:none] [image-rendering:pixelated]"
              :src="sourcePreviewDataUrl"
              :style="imageStyle"
              alt="像素画精细校准底图"
              draggable="false"
              @dragstart.prevent
            />
            <div class="pointer-events-none absolute inset-0" :style="gridStyle"></div>
            <div class="pointer-events-none absolute inset-0 ring-2 ring-inset ring-bead-sky/40"></div>
          </div>
        </div>

        <aside class="min-h-0 overflow-auto rounded-xl border border-ink-100 bg-ink-50 p-4 dark:border-white/10 dark:bg-ink-800">
          <div class="space-y-4">
            <div>
              <span class="block text-xs font-bold text-ink-700 dark:text-ink-100">当前参数</span>
              <span class="mt-1 block text-[11px] leading-4 text-ink-500 dark:text-ink-400">
                {{ draftLabel }}
              </span>
            </div>

            <div class="block space-y-1.5">
              <span class="flex items-center justify-between text-xs font-semibold text-ink-600 dark:text-ink-300">
                <span>缩放</span>
                <span>{{ draftScale.toFixed(3) }}</span>
              </span>
              <div class="grid grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center gap-2">
                <button
                  class="h-9 rounded-lg border border-ink-200 bg-white text-base font-black text-ink-700 transition hover:bg-ink-50 disabled:opacity-40 dark:border-white/10 dark:bg-ink-900 dark:text-ink-200 dark:hover:bg-white/5"
                  type="button"
                  title="缩小 0.001"
                  :disabled="draftScale <= 0.01"
                  @click="emit('adjustScale', -0.001)"
                >
                  −
                </button>
                <input
                  :value="draftScale"
                  class="w-full accent-bead-sky"
                  type="range"
                  min="0.01"
                  max="12"
                  step="0.001"
                  @input="emit('updateDraftScale', Number(($event.target as HTMLInputElement).value))"
                />
                <button
                  class="h-9 rounded-lg border border-ink-200 bg-white text-base font-black text-ink-700 transition hover:bg-ink-50 disabled:opacity-40 dark:border-white/10 dark:bg-ink-900 dark:text-ink-200 dark:hover:bg-white/5"
                  type="button"
                  title="放大 0.001"
                  :disabled="draftScale >= 12"
                  @click="emit('adjustScale', 0.001)"
                >
                  +
                </button>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <label class="block space-y-1.5">
                <span class="text-xs font-semibold text-ink-600 dark:text-ink-300">X 偏移</span>
                <input
                  :value="draftOffsetX"
                  class="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-bead-sky dark:border-white/10 dark:bg-ink-900"
                  type="number"
                  step="0.01"
                  @input="emit('updateDraftOffsetX', Number(($event.target as HTMLInputElement).value))"
                />
              </label>
              <label class="block space-y-1.5">
                <span class="text-xs font-semibold text-ink-600 dark:text-ink-300">Y 偏移</span>
                <input
                  :value="draftOffsetY"
                  class="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-bead-sky dark:border-white/10 dark:bg-ink-900"
                  type="number"
                  step="0.01"
                  @input="emit('updateDraftOffsetY', Number(($event.target as HTMLInputElement).value))"
                />
              </label>
            </div>

            <div class="grid grid-cols-4 gap-1.5">
              <button class="rounded-lg border border-ink-200 bg-white px-2 py-2 text-sm font-bold dark:border-white/10 dark:bg-ink-900" type="button" @click="emit('nudge', 'x', -0.1)">←</button>
              <button class="rounded-lg border border-ink-200 bg-white px-2 py-2 text-sm font-bold dark:border-white/10 dark:bg-ink-900" type="button" @click="emit('nudge', 'x', 0.1)">→</button>
              <button class="rounded-lg border border-ink-200 bg-white px-2 py-2 text-sm font-bold dark:border-white/10 dark:bg-ink-900" type="button" @click="emit('nudge', 'y', -0.1)">↑</button>
              <button class="rounded-lg border border-ink-200 bg-white px-2 py-2 text-sm font-bold dark:border-white/10 dark:bg-ink-900" type="button" @click="emit('nudge', 'y', 0.1)">↓</button>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <button
                class="rounded-lg border border-bead-sky/30 bg-white px-3 py-2 text-sm font-bold text-bead-sky transition hover:bg-bead-sky/10 dark:bg-ink-900"
                type="button"
                @click="emit('reset')"
              >
                自动适配
              </button>
              <button
                class="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-bold text-ink-600 transition hover:bg-ink-50 dark:border-white/10 dark:bg-ink-900 dark:text-ink-200"
                type="button"
                @click="emit('revert')"
              >
                撤回
              </button>
            </div>

            <p class="rounded-lg border border-bead-amber/30 bg-bead-amber/10 px-3 py-2 text-[11px] leading-4 text-ink-700 dark:text-ink-100">
              让素材中一格像素块的边界贴齐蓝色网格线。如果原图本身不是严格像素画，仍会按覆盖区域主色投票。
            </p>
          </div>
        </aside>
      </div>

      <footer class="flex shrink-0 items-center justify-end gap-2 border-t border-ink-100 px-5 py-4 dark:border-white/10">
        <button
          class="rounded-lg border border-ink-200 px-4 py-2 text-sm font-bold text-ink-600 transition hover:bg-ink-50 dark:border-white/10 dark:text-ink-200 dark:hover:bg-white/5"
          type="button"
          @click="emit('close')"
        >
          取消
        </button>
        <button
          class="rounded-lg bg-bead-sky px-4 py-2 text-sm font-bold text-white transition hover:brightness-95"
          type="button"
          @click="emit('apply')"
        >
          应用校准
        </button>
      </footer>
    </section>
  </div>
</template>
