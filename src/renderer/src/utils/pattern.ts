import type { BeadColor } from '@renderer/data/studio'

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

const loadImage = async (source: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片读取失败'))
    image.src = source
  })
}

const readFileAsDataUrl = async (file: File): Promise<string> => {
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

export const createPatternFromImageFile = async (
  file: File,
  options: PatternGenerationOptions
): Promise<PatternGrid> => {
  const { columns, rows } = parseBoardSize(options.boardSize)
  const source = await readFileAsDataUrl(file)
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
  const activePalette = options.palette.slice(0, Math.max(1, Math.min(options.maxColors, options.palette.length)))
  const rgbPalette = activePalette.map((color) => parseHex(color.hex))
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
    sourceName: file.name
  }
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

export const exportPatternAsPng = (pattern: PatternGrid): void => {
  const cellSize = 20
  const padding = 24
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('当前环境不支持 Canvas')
  }

  canvas.width = pattern.columns * cellSize + padding * 2
  canvas.height = pattern.rows * cellSize + padding * 2
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)

  pattern.cells.forEach((color, index) => {
    const x = index % pattern.columns
    const y = Math.floor(index / pattern.columns)
    const centerX = padding + x * cellSize + cellSize / 2
    const centerY = padding + y * cellSize + cellSize / 2

    context.fillStyle = color
    context.beginPath()
    context.arc(centerX, centerY, cellSize * 0.42, 0, Math.PI * 2)
    context.fill()
    context.strokeStyle = 'rgba(0, 0, 0, 0.22)'
    context.lineWidth = 1
    context.stroke()
  })

  const link = document.createElement('a')
  link.download = `perler-pattern-${pattern.columns}x${pattern.rows}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}
