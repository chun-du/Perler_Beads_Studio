import { shallowRef } from 'vue'
﻿import type { Ref } from 'vue'
import { EMPTY_CELL, isEmptyCell } from '../utils/pattern'
import type { PatternGrid } from '../utils/pattern'

export type EditorTool = 'pencil' | 'fill' | 'eyedropper' | 'eraser'

interface UsePatternEditorOptions {
  patternGrid: Ref<PatternGrid>
  activeTool: Ref<EditorTool>
  selectedColorHex: Ref<string>
  hasManualEdits: Ref<boolean>
  generationMessage: Ref<string>
  closeOverlays?: () => void
}

export const usePatternEditor = ({
  patternGrid,
  activeTool,
  selectedColorHex,
  hasManualEdits,
  generationMessage,
  closeOverlays
}: UsePatternEditorOptions): {
  undoStack: Ref<string[][]>
  redoStack: Ref<string[][]>
  pushHistory: () => void
  setPatternCells: (cells: string[]) => void
  replaceCell: (index: number, nextColor: string) => void
  floodFill: (startIndex: number, nextColor: string) => void
  onCellClick: (index: number) => void
  undo: () => void
  redo: () => void
} => {
  const undoStack = shallowRef<string[][]>([])
  const redoStack = shallowRef<string[][]>([])

  const pushHistory = (): void => {
    undoStack.value = [...undoStack.value, [...patternGrid.value.cells]].slice(-40)
    redoStack.value = []
  }

  const setPatternCells = (cells: string[]): void => {
    patternGrid.value = {
      ...patternGrid.value,
      cells
    }
    hasManualEdits.value = true
    generationMessage.value = '手工编辑未导出'
  }

  const replaceCell = (index: number, nextColor: string): void => {
    if (patternGrid.value.cells[index] === nextColor) return

    pushHistory()
    const nextCells = [...patternGrid.value.cells]
    nextCells[index] = nextColor
    setPatternCells(nextCells)
  }

  const floodFill = (startIndex: number, nextColor: string): void => {
    const targetColor = patternGrid.value.cells[startIndex]
    if (targetColor === nextColor) return

    pushHistory()
    const nextCells = [...patternGrid.value.cells]
    const stack = [startIndex]
    const visited = new Set<number>()
    const { columns, rows } = patternGrid.value

    while (stack.length > 0) {
      const index = stack.pop()
      if (index === undefined || visited.has(index) || nextCells[index] !== targetColor) continue

      visited.add(index)
      nextCells[index] = nextColor

      const x = index % columns
      const y = Math.floor(index / columns)
      if (x > 0) stack.push(index - 1)
      if (x < columns - 1) stack.push(index + 1)
      if (y > 0) stack.push(index - columns)
      if (y < rows - 1) stack.push(index + columns)
    }

    setPatternCells(nextCells)
  }

  const onCellClick = (index: number): void => {
    closeOverlays?.()
    const currentColor = patternGrid.value.cells[index]

    if (activeTool.value === 'eyedropper') {
      if (isEmptyCell(currentColor)) {
        activeTool.value = 'eraser'
        return
      }

      selectedColorHex.value = currentColor
      activeTool.value = 'pencil'
      return
    }

    if (activeTool.value === 'eraser') {
      replaceCell(index, EMPTY_CELL)
      return
    }

    if (activeTool.value === 'fill') {
      floodFill(index, selectedColorHex.value)
      return
    }

    replaceCell(index, selectedColorHex.value)
  }

  const undo = (): void => {
    const previousCells = undoStack.value.at(-1)
    if (!previousCells) return

    undoStack.value = undoStack.value.slice(0, -1)
    redoStack.value = [...redoStack.value, [...patternGrid.value.cells]]
    setPatternCells(previousCells)
  }

  const redo = (): void => {
    const nextCells = redoStack.value.at(-1)
    if (!nextCells) return

    redoStack.value = redoStack.value.slice(0, -1)
    undoStack.value = [...undoStack.value, [...patternGrid.value.cells]]
    setPatternCells(nextCells)
  }

  return {
    undoStack,
    redoStack,
    pushHistory,
    setPatternCells,
    replaceCell,
    floodFill,
    onCellClick,
    undo,
    redo
  }
}
