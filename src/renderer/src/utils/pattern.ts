import type { BeadColor } from '@renderer/data/palettes'

export interface PatternGrid {
  columns: number
  rows: number
  cells: string[]
  sourceName: string
}

export interface PatternGenerationOptions {
  boardSize: string
  maxColors: number
  dithering: boolean
  palette: BeadColor[]
}

export interface PatternExportOptions {
  showLabels: boolean
}

export interface BeadInventoryItem extends BeadColor {
  count: number
  percentage: number
}

interface RgbColor {
  r: number
  g: number
  b: number
  hex: string
}

const parseHex = (hex: string): RgbColor => {
  const normalized = hex.replace('#', '')
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
    hex
  }
}

export const parseBoardSize = (boardSize: string): { columns: number; rows: number } => {
  const [columns, rows] = boardSize.split('x').map((part) => Number.parseInt(part.trim(), 10))

  if (!Number.isFinite(columns) || !Number.isFinite(rows)) {
    return { columns: 48, rows: 48 }
  }

  return { columns, rows }
}

const getNearestColor = (r: number, g: number, b: number, palette: RgbColor[]): RgbColor => {
  let nearestColor = palette[0]
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const color of palette) {
    const dr = r - color.r
    const dg = g - color.g
    const db = b - color.b
    const distance = dr * dr + dg * dg + db * db

    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestColor = color
    }
  }

  return nearestColor
}

const selectPaletteForImage = (imageData: ImageData, palette: RgbColor[], maxColors: number): RgbColor[] => {
  const colorLimit = Math.max(1, Math.min(maxColors, palette.length))

  if (colorLimit >= palette.length) {
    return palette
  }

  const counts = new Map<string, { color: RgbColor; count: number }>()

  for (let index = 0; index < imageData.data.length; index += 4) {
    const nearestColor = getNearestColor(
      imageData.data[index],
      imageData.data[index + 1],
      imageData.data[index + 2],
      palette
    )
    const current = counts.get(nearestColor.hex)

    if (current) {
      current.count += 1
    } else {
      counts.set(nearestColor.hex, { color: nearestColor, count: 1 })
    }
  }

  return [...counts.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, colorLimit)
    .map((item) => item.color)
}

const loadImage = async (source: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片读取失败'))
    image.src = source
  })
}

export const readImageFileAsDataUrl = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('图片文件读取失败'))
    reader.readAsDataURL(file)
  })
}

const diffuseError = (
  data: Float32Array,
  columns: number,
  rows: number,
  x: number,
  y: number,
  error: { r: number; g: number; b: number },
  factor: number
): void => {
  if (x < 0 || x >= columns || y < 0 || y >= rows) return

  const index = (y * columns + x) * 4
  data[index] += error.r * factor
  data[index + 1] += error.g * factor
  data[index + 2] += error.b * factor
}

export const createPatternFromImageDataUrl = async (
  source: string,
  sourceName: string,
  options: PatternGenerationOptions
): Promise<PatternGrid> => {
  const { columns, rows } = parseBoardSize(options.boardSize)
  const image = await loadImage(source)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })

  if (!context) {
    throw new Error('当前环境不支持 Canvas')
  }

  canvas.width = columns
  canvas.height = rows

  const sourceRatio = image.width / image.height
  const targetRatio = columns / rows
  let sx = 0
  let sy = 0
  let sw = image.width
  let sh = image.height

  if (sourceRatio > targetRatio) {
    sw = image.height * targetRatio
    sx = (image.width - sw) / 2
  } else {
    sh = image.width / targetRatio
    sy = (image.height - sh) / 2
  }

  context.drawImage(image, sx, sy, sw, sh, 0, 0, columns, rows)

  const imageData = context.getImageData(0, 0, columns, rows)
  const rgbPalette = options.palette.map((color) => parseHex(color.hex))
  const activePalette = selectPaletteForImage(imageData, rgbPalette, options.maxColors)
  const cells: string[] = new Array(columns * rows)

  if (options.dithering) {
    const data = new Float32Array(imageData.data)

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        const index = (y * columns + x) * 4
        const nearestColor = getNearestColor(data[index], data[index + 1], data[index + 2], rgbPalette)
        const error = {
          r: data[index] - nearestColor.r,
          g: data[index + 1] - nearestColor.g,
          b: data[index + 2] - nearestColor.b
        }

        cells[y * columns + x] = nearestColor.hex
        diffuseError(data, columns, rows, x + 1, y, error, 7 / 16)
        diffuseError(data, columns, rows, x - 1, y + 1, error, 3 / 16)
        diffuseError(data, columns, rows, x, y + 1, error, 5 / 16)
        diffuseError(data, columns, rows, x + 1, y + 1, error, 1 / 16)
      }
    }
  } else {
    for (let index = 0; index < imageData.data.length; index += 4) {
      const nearestColor = getNearestColor(
        imageData.data[index],
        imageData.data[index + 1],
        imageData.data[index + 2],
        rgbPalette
      )
      cells[index / 4] = nearestColor.hex
    }
  }

  return {
    columns,
    rows,
    cells,
    sourceName
  }
}

export const createPatternFromImageFile = async (
  file: File,
  options: PatternGenerationOptions
): Promise<PatternGrid> => {
  const source = await readImageFileAsDataUrl(file)
  return createPatternFromImageDataUrl(source, file.name, options)
}

export const createSamplePattern = (palette: BeadColor[], columns = 24, rows = 24): PatternGrid => {
  const cells: string[] = []
  const centerX = (columns - 1) / 2
  const centerY = (rows - 1) / 2
  const radius = Math.min(columns, rows) * 0.42
  const leftEyeX = centerX - radius * 0.35
  const rightEyeX = centerX + radius * 0.35
  const eyeY = centerY - radius * 0.2
  const mouthY = centerY + radius * 0.28

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const dx = x - centerX
      const dy = y - centerY
      const distance = Math.sqrt(dx * dx + dy * dy)
      const isLeftEye = Math.abs(x - leftEyeX) <= Math.max(1, radius * 0.07) && Math.abs(y - eyeY) <= Math.max(1, radius * 0.07)
      const isRightEye =
        Math.abs(x - rightEyeX) <= Math.max(1, radius * 0.07) && Math.abs(y - eyeY) <= Math.max(1, radius * 0.07)
      const isMouth =
        Math.abs(y - mouthY) <= Math.max(1, radius * 0.08) && Math.abs(x - centerX) < radius * 0.34

      if (distance > radius) {
        cells.push(palette[0].hex)
      } else if (isLeftEye || isRightEye) {
        cells.push(palette[1].hex)
      } else if (isMouth) {
        cells.push(palette[10].hex)
      } else if ((x + y) % 7 === 0) {
        cells.push(palette[5].hex)
      } else if ((x * 3 + y) % 11 === 0) {
        cells.push(palette[7].hex)
      } else {
        cells.push(palette[(x + y) % 5 === 0 ? 3 : 4].hex)
      }
    }
  }

  return { columns, rows, cells, sourceName: '示例图纸' }
}

const shouldShowLabel = (value: number, maxValue: number): boolean => {
  return value === 1 || value === maxValue || value % 5 === 0
}

export const buildBeadInventory = (pattern: PatternGrid, palette: BeadColor[]): BeadInventoryItem[] => {
  const countMap = pattern.cells.reduce<Record<string, number>>((counts, color) => {
    counts[color] = (counts[color] ?? 0) + 1
    return counts
  }, {})
  const totalCount = Math.max(1, pattern.cells.length)
  const knownColors = palette
    .filter((color) => countMap[color.hex] > 0)
    .map((color) => ({
      ...color,
      count: countMap[color.hex],
      percentage: countMap[color.hex] / totalCount
    }))

  const knownHexes = new Set(palette.map((color) => color.hex))
  const unknownColors = Object.entries(countMap)
    .filter(([hex]) => !knownHexes.has(hex))
    .map(([hex, count], index) => ({
      id: `C${String(index + 1).padStart(2, '0')}`,
      name: 'Custom',
      hex,
      count,
      percentage: count / totalCount
    }))

  return [...knownColors, ...unknownColors].sort((left, right) => right.count - left.count)
}

const escapeCsvValue = (value: string | number): string => {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export const exportBeadInventoryAsCsv = (
  pattern: PatternGrid,
  palette: BeadColor[],
  manufacturer: string
): void => {
  const inventory = buildBeadInventory(pattern, palette)
  const header = ['manufacturer', 'color_id', 'color_name', 'hex', 'count', 'percentage']
  const rows = inventory.map((item) => [
    manufacturer,
    item.id,
    item.name,
    item.hex,
    item.count,
    `${(item.percentage * 100).toFixed(2)}%`
  ])
  const csv = [header, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\n')
  const blob = new Blob([`\ufeff${csv}\n`], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')

  link.download = `perler-bead-list-${pattern.columns}x${pattern.rows}.csv`
  link.href = URL.createObjectURL(blob)
  link.click()
  URL.revokeObjectURL(link.href)
}

export const exportPatternAsPng = (pattern: PatternGrid, options: PatternExportOptions): void => {
  const cellSize = 20
  const labelSize = options.showLabels ? 30 : 0
  const padding = 24
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('当前环境不支持 Canvas')
  }

  canvas.width = pattern.columns * cellSize + padding * 2 + labelSize
  canvas.height = pattern.rows * cellSize + padding * 2 + labelSize
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.font = '12px Arial, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = '#63594d'

  if (options.showLabels) {
    for (let x = 0; x < pattern.columns; x += 1) {
      const label = x + 1
      if (!shouldShowLabel(label, pattern.columns)) continue
      context.fillText(String(label), padding + labelSize + x * cellSize + cellSize / 2, padding + labelSize / 2)
    }

    for (let y = 0; y < pattern.rows; y += 1) {
      const label = y + 1
      if (!shouldShowLabel(label, pattern.rows)) continue
      context.fillText(String(label), padding + labelSize / 2, padding + labelSize + y * cellSize + cellSize / 2)
    }
  }

  pattern.cells.forEach((color, index) => {
    const x = index % pattern.columns
    const y = Math.floor(index / pattern.columns)
    const cellX = padding + labelSize + x * cellSize
    const cellY = padding + labelSize + y * cellSize

    context.fillStyle = color
    context.fillRect(cellX + 1, cellY + 1, cellSize - 2, cellSize - 2)
    context.strokeStyle = 'rgba(0, 0, 0, 0.22)'
    context.lineWidth = 1
    context.strokeRect(cellX + 0.5, cellY + 0.5, cellSize - 1, cellSize - 1)
  })

  const link = document.createElement('a')
  link.download = `perler-pattern-${pattern.columns}x${pattern.rows}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}
