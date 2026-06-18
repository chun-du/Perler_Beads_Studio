import type { BeadColor } from '@renderer/data/palettes'

export interface PatternGrid {
  columns: number
  rows: number
  cells: string[]
  sourceName: string
}

export interface PixelArtCalibration {
  scale: number
  offsetX: number
  offsetY: number
}

export interface PatternGenerationOptions {
  boardSize: string
  maxColors: number
  dithering: boolean
  cleanup: boolean
  inputMode: 'image' | 'pixel-art'
  palette: BeadColor[]
  pixelArtCalibration?: PixelArtCalibration
}

export interface PatternExportOptions {
  showLabels: boolean
  palette: BeadColor[]
  manufacturer: string
}

export interface PatternPrintOptions extends PatternExportOptions {
  title?: string
  tileColumns?: number
  tileRows?: number
}

export interface BeadInventoryItem extends BeadColor {
  count: number
  percentage: number
}

export const EMPTY_CELL = '__empty__'

export const isEmptyCell = (color: string): boolean => {
  return color === EMPTY_CELL
}

interface RgbColor {
  r: number
  g: number
  b: number
  hex: string
  lab: LabColor
}

interface LabColor {
  l: number
  a: number
  b: number
}

interface CropRect {
  sx: number
  sy: number
  sw: number
  sh: number
}

interface SimpleRgbColor {
  r: number
  g: number
  b: number
}

interface PixelArtBlankInfo {
  backgroundColor?: SimpleRgbColor
  blankMask?: Uint8Array
}

interface PixelArtFit {
  source: CropRect
  targetX: number
  targetY: number
  targetColumns: number
  targetRows: number
  blankInfo: PixelArtBlankInfo
}

interface PixelArtColorVote {
  color: SimpleRgbColor
  weight: number
}

const transparentAlphaThreshold = 16
const degreesToRadians = Math.PI / 180
const radiansToDegrees = 180 / Math.PI
const blankBackgroundTolerance = 6
const pixelArtMinimumCoverageRatio = 0.08

const isTransparentAlpha = (alpha: number): boolean => {
  return alpha <= transparentAlphaThreshold
}

const clampRgbChannel = (value: number): number => {
  return Math.min(255, Math.max(0, value))
}

const srgbToLinear = (value: number): number => {
  const normalized = clampRgbChannel(value) / 255
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
}

const xyzToLabPivot = (value: number): number => {
  return value > 216 / 24389 ? Math.cbrt(value) : (841 / 108) * value + 4 / 29
}

const rgbToLab = (r: number, g: number, b: number): LabColor => {
  const linearR = srgbToLinear(r)
  const linearG = srgbToLinear(g)
  const linearB = srgbToLinear(b)
  const x = linearR * 0.4124564 + linearG * 0.3575761 + linearB * 0.1804375
  const y = linearR * 0.2126729 + linearG * 0.7151522 + linearB * 0.072175
  const z = linearR * 0.0193339 + linearG * 0.119192 + linearB * 0.9503041
  const fx = xyzToLabPivot(x / 0.95047)
  const fy = xyzToLabPivot(y)
  const fz = xyzToLabPivot(z / 1.08883)

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz)
  }
}

const parseHex = (hex: string): RgbColor => {
  const normalized = hex.replace('#', '')
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)

  return {
    r,
    g,
    b,
    hex,
    lab: rgbToLab(r, g, b)
  }
}

const normalizeHueDegrees = (value: number): number => {
  return value >= 0 ? value % 360 : ((value % 360) + 360) % 360
}

const atan2Degrees = (y: number, x: number): number => {
  return normalizeHueDegrees(Math.atan2(y, x) * radiansToDegrees)
}

const getCiede2000Difference = (left: LabColor, right: LabColor): number => {
  const chromaLeft = Math.sqrt(left.a * left.a + left.b * left.b)
  const chromaRight = Math.sqrt(right.a * right.a + right.b * right.b)
  const meanChroma = (chromaLeft + chromaRight) / 2
  const meanChromaPower = meanChroma ** 7
  const compensation = 0.5 * (1 - Math.sqrt(meanChromaPower / (meanChromaPower + 25 ** 7)))
  const leftA = (1 + compensation) * left.a
  const rightA = (1 + compensation) * right.a
  const leftChromaPrime = Math.sqrt(leftA * leftA + left.b * left.b)
  const rightChromaPrime = Math.sqrt(rightA * rightA + right.b * right.b)
  const leftHuePrime = leftChromaPrime === 0 ? 0 : atan2Degrees(left.b, leftA)
  const rightHuePrime = rightChromaPrime === 0 ? 0 : atan2Degrees(right.b, rightA)
  const deltaLightnessPrime = right.l - left.l
  const deltaChromaPrime = rightChromaPrime - leftChromaPrime
  let deltaHuePrime = 0

  if (leftChromaPrime * rightChromaPrime !== 0) {
    deltaHuePrime = rightHuePrime - leftHuePrime

    if (deltaHuePrime > 180) {
      deltaHuePrime -= 360
    } else if (deltaHuePrime < -180) {
      deltaHuePrime += 360
    }
  }

  const deltaHueTerm =
    2 * Math.sqrt(leftChromaPrime * rightChromaPrime) * Math.sin((deltaHuePrime / 2) * degreesToRadians)
  const meanLightnessPrime = (left.l + right.l) / 2
  const meanChromaPrime = (leftChromaPrime + rightChromaPrime) / 2
  let meanHuePrime = leftHuePrime + rightHuePrime

  if (leftChromaPrime * rightChromaPrime !== 0) {
    const hueDifference = Math.abs(leftHuePrime - rightHuePrime)

    if (hueDifference <= 180) {
      meanHuePrime = (leftHuePrime + rightHuePrime) / 2
    } else if (leftHuePrime + rightHuePrime < 360) {
      meanHuePrime = (leftHuePrime + rightHuePrime + 360) / 2
    } else {
      meanHuePrime = (leftHuePrime + rightHuePrime - 360) / 2
    }
  }

  const hueWeight =
    1 -
    0.17 * Math.cos((meanHuePrime - 30) * degreesToRadians) +
    0.24 * Math.cos(2 * meanHuePrime * degreesToRadians) +
    0.32 * Math.cos((3 * meanHuePrime + 6) * degreesToRadians) -
    0.2 * Math.cos((4 * meanHuePrime - 63) * degreesToRadians)
  const lightnessAdjustment = 1 + (0.015 * (meanLightnessPrime - 50) ** 2) / Math.sqrt(20 + (meanLightnessPrime - 50) ** 2)
  const chromaAdjustment = 1 + 0.045 * meanChromaPrime
  const hueAdjustment = 1 + 0.015 * meanChromaPrime * hueWeight
  const rotationAngle = 30 * Math.exp(-(((meanHuePrime - 275) / 25) ** 2))
  const chromaRotation = Math.sqrt((meanChromaPrime ** 7) / (meanChromaPrime ** 7 + 25 ** 7))
  const rotationTerm = -2 * chromaRotation * Math.sin(2 * rotationAngle * degreesToRadians)
  const lightnessTerm = deltaLightnessPrime / lightnessAdjustment
  const chromaTerm = deltaChromaPrime / chromaAdjustment
  const hueTerm = deltaHueTerm / hueAdjustment

  return Math.sqrt(
    lightnessTerm * lightnessTerm +
      chromaTerm * chromaTerm +
      hueTerm * hueTerm +
      rotationTerm * chromaTerm * hueTerm
  )
}

const getReadableTextColor = (hex: string): string => {
  const color = parseHex(hex)
  const luminance = (color.r * 299 + color.g * 587 + color.b * 114) / 1000

  return luminance > 145 ? '#111111' : '#ffffff'
}

const getRelativeLuminance = (hex: string): number => {
  const color = parseHex(hex)
  return (color.r * 299 + color.g * 587 + color.b * 114) / 1000
}

export const parseBoardSize = (boardSize: string): { columns: number; rows: number } => {
  const [columns, rows] = boardSize.split('x').map((part) => Number.parseInt(part.trim(), 10))

  if (!Number.isFinite(columns) || !Number.isFinite(rows)) {
    return { columns: 48, rows: 48 }
  }

  return { columns, rows }
}

const getRgbKey = (r: number, g: number, b: number): string => {
  return `${Math.round(clampRgbChannel(r))},${Math.round(clampRgbChannel(g))},${Math.round(clampRgbChannel(b))}`
}

const getRgbDistance = (
  r: number,
  g: number,
  b: number,
  color: Pick<RgbColor, 'r' | 'g' | 'b'>
): number => {
  const redDelta = r - color.r
  const greenDelta = g - color.g
  const blueDelta = b - color.b

  return Math.sqrt(redDelta * redDelta + greenDelta * greenDelta + blueDelta * blueDelta)
}

const createExactPaletteLookup = (palette: RgbColor[]): Map<string, RgbColor> => {
  const lookup = new Map<string, RgbColor>()

  for (const color of palette) {
    const key = getRgbKey(color.r, color.g, color.b)
    if (!lookup.has(key)) {
      lookup.set(key, color)
    }
  }

  return lookup
}

const getExactPaletteColor = (
  r: number,
  g: number,
  b: number,
  exactPaletteLookup?: Map<string, RgbColor>
): RgbColor | undefined => {
  if (!exactPaletteLookup || !Number.isInteger(r) || !Number.isInteger(g) || !Number.isInteger(b)) {
    return undefined
  }

  return exactPaletteLookup.get(getRgbKey(r, g, b))
}

const getNearestColor = (
  r: number,
  g: number,
  b: number,
  palette: RgbColor[],
  exactPaletteLookup?: Map<string, RgbColor>,
  matchingMode: 'perceptual' | 'pixel-art' = 'perceptual'
): RgbColor => {
  const exactColor = getExactPaletteColor(r, g, b, exactPaletteLookup)
  if (exactColor) return exactColor

  let nearestColor = palette[0]
  let nearestDistance = Number.POSITIVE_INFINITY
  const lab = rgbToLab(r, g, b)

  for (const color of palette) {
    const perceptualDistance = getCiede2000Difference(lab, color.lab)
    const distance =
      matchingMode === 'pixel-art'
        ? perceptualDistance * 0.82 + getRgbDistance(r, g, b, color) * 0.045
        : perceptualDistance

    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestColor = color
    }
  }

  return nearestColor
}

const getCompositedRgb = (
  data: Uint8ClampedArray | Float32Array,
  index: number
): { r: number; g: number; b: number } => {
  const alpha = data[index + 3]

  if (alpha >= 255) {
    return {
      r: data[index],
      g: data[index + 1],
      b: data[index + 2]
    }
  }

  const opacity = alpha / 255
  const inverseOpacity = 1 - opacity

  return {
    r: data[index] * opacity + 255 * inverseOpacity,
    g: data[index + 1] * opacity + 255 * inverseOpacity,
    b: data[index + 2] * opacity + 255 * inverseOpacity
  }
}

const selectPaletteForImage = (imageData: ImageData, palette: RgbColor[], maxColors: number): RgbColor[] => {
  const colorLimit = Math.max(1, Math.min(maxColors, palette.length))

  if (colorLimit >= palette.length) {
    return palette
  }

  const exactPaletteLookup = createExactPaletteLookup(palette)
  const counts = new Map<string, { color: RgbColor; count: number }>()

  for (let index = 0; index < imageData.data.length; index += 4) {
    if (isTransparentAlpha(imageData.data[index + 3])) continue

    const pixel = getCompositedRgb(imageData.data, index)
    const nearestColor = getNearestColor(pixel.r, pixel.g, pixel.b, palette, exactPaletteLookup)
    const current = counts.get(nearestColor.hex)

    if (current) {
      current.count += 1
    } else {
      counts.set(nearestColor.hex, { color: nearestColor, count: 1 })
    }
  }

  const selectedColors = [...counts.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, colorLimit)
    .map((item) => item.color)

  return selectedColors.length > 0 ? selectedColors : palette.slice(0, colorLimit)
}

const loadImage = async (source: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片读取失败'))
    image.src = source
  })
}

const getCenteredCrop = (sourceWidth: number, sourceHeight: number, targetColumns: number, targetRows: number): CropRect => {
  const sourceRatio = sourceWidth / sourceHeight
  const targetRatio = targetColumns / targetRows
  let sx = 0
  let sy = 0
  let sw = sourceWidth
  let sh = sourceHeight

  if (sourceRatio > targetRatio) {
    sw = sourceHeight * targetRatio
    sx = (sourceWidth - sw) / 2
  } else {
    sh = sourceWidth / targetRatio
    sy = (sourceHeight - sh) / 2
  }

  return { sx, sy, sw, sh }
}

const getPixelRgb = (imageData: ImageData, x: number, y: number): SimpleRgbColor => {
  const index = (y * imageData.width + x) * 4

  return {
    r: imageData.data[index],
    g: imageData.data[index + 1],
    b: imageData.data[index + 2]
  }
}

const isSimilarRgb = (left: SimpleRgbColor, right: SimpleRgbColor, tolerance: number): boolean => {
  return (
    Math.abs(left.r - right.r) <= tolerance &&
    Math.abs(left.g - right.g) <= tolerance &&
    Math.abs(left.b - right.b) <= tolerance
  )
}

const getCornerBackgroundColor = (imageData: ImageData): SimpleRgbColor | undefined => {
  const corners = [
    { x: 0, y: 0 },
    { x: imageData.width - 1, y: 0 },
    { x: 0, y: imageData.height - 1 },
    { x: imageData.width - 1, y: imageData.height - 1 }
  ]
  const opaqueCorners = corners.filter(({ x, y }) => {
    const index = (y * imageData.width + x) * 4
    return !isTransparentAlpha(imageData.data[index + 3])
  })

  if (opaqueCorners.length < 2) return undefined

  const cornerColors = opaqueCorners.map(({ x, y }) => getPixelRgb(imageData, x, y))
  const groups: Array<{ color: SimpleRgbColor; count: number }> = []

  for (const color of cornerColors) {
    const matchingGroup = groups.find((group) => isSimilarRgb(group.color, color, blankBackgroundTolerance))

    if (matchingGroup) {
      matchingGroup.count += 1
    } else {
      groups.push({ color, count: 1 })
    }
  }

  const dominant = groups.sort((left, right) => right.count - left.count)[0]

  if (!dominant || dominant.count <= opaqueCorners.length / 2) return undefined

  return dominant.color
}

const isPixelArtBackgroundCandidate = (
  imageData: ImageData,
  x: number,
  y: number,
  backgroundColor: SimpleRgbColor | undefined
): boolean => {
  const index = (y * imageData.width + x) * 4

  if (isTransparentAlpha(imageData.data[index + 3])) return true
  if (!backgroundColor) return false

  return isSimilarRgb(getPixelRgb(imageData, x, y), backgroundColor, blankBackgroundTolerance)
}

const createEdgeConnectedBlankMask = (
  imageData: ImageData,
  backgroundColor: SimpleRgbColor | undefined
): Uint8Array => {
  const mask = new Uint8Array(imageData.width * imageData.height)
  const stack: number[] = []
  const tryPush = (x: number, y: number): void => {
    if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) return

    const index = y * imageData.width + x
    if (mask[index] || !isPixelArtBackgroundCandidate(imageData, x, y, backgroundColor)) return

    mask[index] = 1
    stack.push(index)
  }

  for (let x = 0; x < imageData.width; x += 1) {
    tryPush(x, 0)
    tryPush(x, imageData.height - 1)
  }

  for (let y = 1; y < imageData.height - 1; y += 1) {
    tryPush(0, y)
    tryPush(imageData.width - 1, y)
  }

  while (stack.length > 0) {
    const index = stack.pop() as number
    const x = index % imageData.width
    const y = Math.floor(index / imageData.width)

    tryPush(x + 1, y)
    tryPush(x - 1, y)
    tryPush(x, y + 1)
    tryPush(x, y - 1)
  }

  return mask
}

const isPixelArtBlankSourcePixel = (imageData: ImageData, x: number, y: number, blankInfo: PixelArtBlankInfo): boolean => {
  if (!blankInfo.blankMask) return isPixelArtBackgroundCandidate(imageData, x, y, blankInfo.backgroundColor)

  return blankInfo.blankMask[y * imageData.width + x] === 1
}

const getPixelArtContentRect = (imageData: ImageData, blankInfo: PixelArtBlankInfo): CropRect => {
  let minX = imageData.width
  let minY = imageData.height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < imageData.height; y += 1) {
    for (let x = 0; x < imageData.width; x += 1) {
      if (isPixelArtBlankSourcePixel(imageData, x, y, blankInfo)) continue

      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  if (maxX < minX || maxY < minY) {
    return { sx: 0, sy: 0, sw: imageData.width, sh: imageData.height }
  }

  return {
    sx: minX,
    sy: minY,
    sw: maxX - minX + 1,
    sh: maxY - minY + 1
  }
}

const getPixelArtFit = (sourceImageData: ImageData, columns: number, rows: number): PixelArtFit => {
  const backgroundColor = getCornerBackgroundColor(sourceImageData)
  const blankInfo: PixelArtBlankInfo = {
    backgroundColor,
    blankMask: createEdgeConnectedBlankMask(sourceImageData, backgroundColor)
  }
  const contentRect = getPixelArtContentRect(sourceImageData, blankInfo)
  const sourceRatio = contentRect.sw / contentRect.sh
  const targetRatio = columns / rows
  let targetColumns = columns
  let targetRows = rows

  if (sourceRatio > targetRatio) {
    targetRows = Math.max(1, Math.round(columns / sourceRatio))
  } else {
    targetColumns = Math.max(1, Math.round(rows * sourceRatio))
  }

  return {
    source: contentRect,
    targetX: Math.floor((columns - targetColumns) / 2),
    targetY: Math.floor((rows - targetRows) / 2),
    targetColumns,
    targetRows,
    blankInfo
  }
}

const getSourceImageData = (image: HTMLImageElement): ImageData => {
  const sampleCanvas = document.createElement('canvas')
  const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true })

  if (!sampleContext) {
    throw new Error('当前环境不支持 Canvas')
  }

  sampleCanvas.width = image.width
  sampleCanvas.height = image.height
  sampleContext.imageSmoothingEnabled = false
  sampleContext.drawImage(image, 0, 0)

  return sampleContext.getImageData(0, 0, image.width, image.height)
}

const getPixelArtSourceRectForCell = (
  fit: PixelArtFit,
  x: number,
  y: number,
  calibration?: PixelArtCalibration
): CropRect | null => {
  if (calibration) {
    const scale = Math.max(0.01, calibration.scale)

    return {
      sx: (x - calibration.offsetX) / scale,
      sy: (y - calibration.offsetY) / scale,
      sw: 1 / scale,
      sh: 1 / scale
    }
  }

  const targetStartX = Math.max(x, fit.targetX)
  const targetStartY = Math.max(y, fit.targetY)
  const targetEndX = Math.min(x + 1, fit.targetX + fit.targetColumns)
  const targetEndY = Math.min(y + 1, fit.targetY + fit.targetRows)

  if (targetEndX <= targetStartX || targetEndY <= targetStartY) return null

  const sx = fit.source.sx + ((targetStartX - fit.targetX) / fit.targetColumns) * fit.source.sw
  const sy = fit.source.sy + ((targetStartY - fit.targetY) / fit.targetRows) * fit.source.sh
  const sourceEndX = fit.source.sx + ((targetEndX - fit.targetX) / fit.targetColumns) * fit.source.sw
  const sourceEndY = fit.source.sy + ((targetEndY - fit.targetY) / fit.targetRows) * fit.source.sh

  return {
    sx,
    sy,
    sw: sourceEndX - sx,
    sh: sourceEndY - sy
  }
}

const getPixelArtDominantColor = (
  sourceImageData: ImageData,
  sourceRect: CropRect,
  blankInfo: PixelArtBlankInfo
): SimpleRgbColor | null => {
  if (sourceRect.sw <= 0 || sourceRect.sh <= 0) return null

  const sourceWidth = sourceImageData.width
  const sourceHeight = sourceImageData.height
  const pixelStartX = Math.max(0, Math.floor(sourceRect.sx))
  const pixelStartY = Math.max(0, Math.floor(sourceRect.sy))
  const pixelEndX = Math.min(sourceWidth, Math.ceil(sourceRect.sx + sourceRect.sw))
  const pixelEndY = Math.min(sourceHeight, Math.ceil(sourceRect.sy + sourceRect.sh))
  const votes = new Map<string, PixelArtColorVote>()
  const foregroundVotes = new Map<string, PixelArtColorVote>()
  let visibleWeight = 0
  let foregroundWeight = 0

  for (let sourceY = pixelStartY; sourceY < pixelEndY; sourceY += 1) {
    const yWeight = Math.max(
      0,
      Math.min(sourceRect.sy + sourceRect.sh, sourceY + 1) - Math.max(sourceRect.sy, sourceY)
    )
    if (yWeight <= 0) continue

    for (let sourceX = pixelStartX; sourceX < pixelEndX; sourceX += 1) {
      const xWeight = Math.max(
        0,
        Math.min(sourceRect.sx + sourceRect.sw, sourceX + 1) - Math.max(sourceRect.sx, sourceX)
      )
      const overlapWeight = xWeight * yWeight
      if (overlapWeight <= 0) continue

      const sourceIndex = (sourceY * sourceWidth + sourceX) * 4
      const alpha = sourceImageData.data[sourceIndex + 3]
      if (isTransparentAlpha(alpha)) continue

      const pixel = getCompositedRgb(sourceImageData.data, sourceIndex)
      const key = getRgbKey(pixel.r, pixel.g, pixel.b)
      const voteWeight = overlapWeight * (alpha / 255)
      const current = votes.get(key)
      const isBackground = blankInfo.backgroundColor
        ? isSimilarRgb(
            {
              r: Math.round(clampRgbChannel(pixel.r)),
              g: Math.round(clampRgbChannel(pixel.g)),
              b: Math.round(clampRgbChannel(pixel.b))
            },
            blankInfo.backgroundColor,
            blankBackgroundTolerance
          )
        : false

      visibleWeight += voteWeight

      if (current) {
        current.weight += voteWeight
      } else {
        votes.set(key, {
          color: {
            r: Math.round(clampRgbChannel(pixel.r)),
            g: Math.round(clampRgbChannel(pixel.g)),
            b: Math.round(clampRgbChannel(pixel.b))
          },
          weight: voteWeight
        })
      }

      if (!isBackground) {
        const foregroundCurrent = foregroundVotes.get(key)
        foregroundWeight += voteWeight

        if (foregroundCurrent) {
          foregroundCurrent.weight += voteWeight
        } else {
          foregroundVotes.set(key, {
            color: {
              r: Math.round(clampRgbChannel(pixel.r)),
              g: Math.round(clampRgbChannel(pixel.g)),
              b: Math.round(clampRgbChannel(pixel.b))
            },
            weight: voteWeight
          })
        }
      }
    }
  }

  if (visibleWeight < sourceRect.sw * sourceRect.sh * pixelArtMinimumCoverageRatio) return null

  const votePool = foregroundWeight >= visibleWeight * 0.16 ? foregroundVotes : votes
  const dominant = [...votePool.values()].sort((left, right) => right.weight - left.weight)[0]
  return dominant?.color ?? null
}

const samplePixelArtImageData = (
  sourceImageData: ImageData,
  fit: PixelArtFit,
  columns: number,
  rows: number,
  context: CanvasRenderingContext2D,
  calibration?: PixelArtCalibration
): ImageData => {
  const targetImageData = context.createImageData(columns, rows)

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const targetIndex = (y * columns + x) * 4
      const sourceRect = getPixelArtSourceRectForCell(fit, x, y, calibration)

      if (!sourceRect) {
        targetImageData.data[targetIndex + 3] = 0
        continue
      }

      const dominantColor = getPixelArtDominantColor(sourceImageData, sourceRect, fit.blankInfo)

      if (!dominantColor) {
        targetImageData.data[targetIndex + 3] = 0
        continue
      }

      targetImageData.data[targetIndex] = dominantColor.r
      targetImageData.data[targetIndex + 1] = dominantColor.g
      targetImageData.data[targetIndex + 2] = dominantColor.b
      targetImageData.data[targetIndex + 3] = 255
    }
  }

  clearEdgeConnectedPixelArtBackground(targetImageData, fit.blankInfo.backgroundColor)

  return targetImageData
}

const clearEdgeConnectedPixelArtBackground = (imageData: ImageData, backgroundColor: SimpleRgbColor | undefined): void => {
  if (!backgroundColor) return

  const mask = new Uint8Array(imageData.width * imageData.height)
  const stack: number[] = []
  const tryPush = (x: number, y: number): void => {
    if (x < 0 || x >= imageData.width || y < 0 || y >= imageData.height) return

    const index = y * imageData.width + x
    const dataIndex = index * 4
    if (mask[index] || isTransparentAlpha(imageData.data[dataIndex + 3])) return

    const color = {
      r: imageData.data[dataIndex],
      g: imageData.data[dataIndex + 1],
      b: imageData.data[dataIndex + 2]
    }

    if (!isSimilarRgb(color, backgroundColor, blankBackgroundTolerance)) return

    mask[index] = 1
    stack.push(index)
  }

  for (let x = 0; x < imageData.width; x += 1) {
    tryPush(x, 0)
    tryPush(x, imageData.height - 1)
  }

  for (let y = 1; y < imageData.height - 1; y += 1) {
    tryPush(0, y)
    tryPush(imageData.width - 1, y)
  }

  while (stack.length > 0) {
    const index = stack.pop() as number
    const x = index % imageData.width
    const y = Math.floor(index / imageData.width)
    const dataIndex = index * 4

    imageData.data[dataIndex + 3] = 0
    tryPush(x + 1, y)
    tryPush(x - 1, y)
    tryPush(x, y + 1)
    tryPush(x, y - 1)
  }
}

const averageImageDataToBoard = (
  sourceImageData: ImageData,
  crop: CropRect,
  columns: number,
  rows: number,
  context: CanvasRenderingContext2D
): ImageData => {
  const targetImageData = context.createImageData(columns, rows)
  const sourceWidth = sourceImageData.width
  const sourceHeight = sourceImageData.height

  for (let y = 0; y < rows; y += 1) {
    const cellStartY = crop.sy + (y / rows) * crop.sh
    const cellEndY = crop.sy + ((y + 1) / rows) * crop.sh
    const pixelStartY = Math.max(0, Math.floor(cellStartY))
    const pixelEndY = Math.min(sourceHeight, Math.ceil(cellEndY))

    for (let x = 0; x < columns; x += 1) {
      const cellStartX = crop.sx + (x / columns) * crop.sw
      const cellEndX = crop.sx + ((x + 1) / columns) * crop.sw
      const pixelStartX = Math.max(0, Math.floor(cellStartX))
      const pixelEndX = Math.min(sourceWidth, Math.ceil(cellEndX))
      let totalWeight = 0
      let alphaWeight = 0
      let redSum = 0
      let greenSum = 0
      let blueSum = 0

      for (let sourceY = pixelStartY; sourceY < pixelEndY; sourceY += 1) {
        const yWeight = Math.max(0, Math.min(cellEndY, sourceY + 1) - Math.max(cellStartY, sourceY))
        if (yWeight <= 0) continue

        for (let sourceX = pixelStartX; sourceX < pixelEndX; sourceX += 1) {
          const xWeight = Math.max(0, Math.min(cellEndX, sourceX + 1) - Math.max(cellStartX, sourceX))
          const weight = xWeight * yWeight
          if (weight <= 0) continue

          const sourceIndex = (sourceY * sourceWidth + sourceX) * 4
          const alpha = sourceImageData.data[sourceIndex + 3] / 255
          const weightedAlpha = alpha * weight

          totalWeight += weight
          alphaWeight += weightedAlpha
          redSum += sourceImageData.data[sourceIndex] * weightedAlpha
          greenSum += sourceImageData.data[sourceIndex + 1] * weightedAlpha
          blueSum += sourceImageData.data[sourceIndex + 2] * weightedAlpha
        }
      }

      const targetIndex = (y * columns + x) * 4

      if (totalWeight <= 0 || alphaWeight <= 0) {
        targetImageData.data[targetIndex + 3] = 0
        continue
      }

      const averageAlpha = (alphaWeight / totalWeight) * 255

      if (isTransparentAlpha(averageAlpha)) {
        targetImageData.data[targetIndex + 3] = 0
        continue
      }

      targetImageData.data[targetIndex] = redSum / alphaWeight
      targetImageData.data[targetIndex + 1] = greenSum / alphaWeight
      targetImageData.data[targetIndex + 2] = blueSum / alphaWeight
      targetImageData.data[targetIndex + 3] = averageAlpha
    }
  }

  return targetImageData
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

const getNeighborIndexes = (index: number, columns: number, rows: number): number[] => {
  const x = index % columns
  const y = Math.floor(index / columns)
  const indexes: number[] = []

  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      if (offsetX === 0 && offsetY === 0) continue

      const nextX = x + offsetX
      const nextY = y + offsetY

      if (nextX >= 0 && nextX < columns && nextY >= 0 && nextY < rows) {
        indexes.push(nextY * columns + nextX)
      }
    }
  }

  return indexes
}

const getDominantNeighborColor = (
  cells: string[],
  index: number,
  columns: number,
  rows: number
): { color: string; count: number; orthogonalCount: number } | null => {
  const neighborIndexes = getNeighborIndexes(index, columns, rows)
  const counts = new Map<string, { count: number; orthogonalCount: number }>()
  const x = index % columns
  const y = Math.floor(index / columns)

  for (const neighborIndex of neighborIndexes) {
    const color = cells[neighborIndex]
    if (isEmptyCell(color)) continue

    const neighborX = neighborIndex % columns
    const neighborY = Math.floor(neighborIndex / columns)
    const isOrthogonal = neighborX === x || neighborY === y
    const current = counts.get(color)

    if (current) {
      current.count += 1
      current.orthogonalCount += isOrthogonal ? 1 : 0
    } else {
      counts.set(color, { count: 1, orthogonalCount: isOrthogonal ? 1 : 0 })
    }
  }

  const [dominant] = [...counts.entries()].sort((left, right) => {
    const countDelta = right[1].count - left[1].count
    return countDelta !== 0 ? countDelta : right[1].orthogonalCount - left[1].orthogonalCount
  })

  if (!dominant) return null

  return {
    color: dominant[0],
    count: dominant[1].count,
    orthogonalCount: dominant[1].orthogonalCount
  }
}

const getSameColorNeighborCount = (cells: string[], index: number, columns: number, rows: number): number => {
  const color = cells[index]
  if (isEmptyCell(color)) return 0

  return getNeighborIndexes(index, columns, rows).filter((neighborIndex) => cells[neighborIndex] === color).length
}

const isDarkLineColor = (color: string): boolean => {
  return !isEmptyCell(color) && getRelativeLuminance(color) < 92
}

const isDarkConnectedColor = (color: string, neighborColor: string): boolean => {
  if (!isDarkLineColor(color) || !isDarkLineColor(neighborColor)) return false
  return color === neighborColor || getCiede2000Difference(parseHex(color).lab, parseHex(neighborColor).lab) < 9
}

const getDirectionalLineScore = (cells: string[], index: number, columns: number, rows: number): number => {
  const color = cells[index]
  const x = index % columns
  const y = Math.floor(index / columns)
  const directions = [
    [
      [-1, 0],
      [1, 0]
    ],
    [
      [0, -1],
      [0, 1]
    ],
    [
      [-1, -1],
      [1, 1]
    ],
    [
      [-1, 1],
      [1, -1]
    ]
  ]

  return directions.reduce((score, direction) => {
    const matches = direction.filter(([offsetX, offsetY]) => {
      const nextX = x + offsetX
      const nextY = y + offsetY

      if (nextX < 0 || nextX >= columns || nextY < 0 || nextY >= rows) return false

      return isDarkConnectedColor(color, cells[nextY * columns + nextX])
    }).length

    return Math.max(score, matches)
  }, 0)
}

const shouldPreserveLinePixel = (cells: string[], index: number, columns: number, rows: number): boolean => {
  const color = cells[index]
  if (!isDarkLineColor(color)) return false

  const darkNeighbors = getNeighborIndexes(index, columns, rows).filter((neighborIndex) =>
    isDarkConnectedColor(color, cells[neighborIndex])
  ).length
  const directionalLineScore = getDirectionalLineScore(cells, index, columns, rows)

  return darkNeighbors >= 1 || directionalLineScore >= 1
}

const cleanupIsolatedPixels = (cells: string[], columns: number, rows: number): string[] => {
  const nextCells = [...cells]

  for (let index = 0; index < cells.length; index += 1) {
    const color = cells[index]
    if (isEmptyCell(color)) continue
    if (shouldPreserveLinePixel(cells, index, columns, rows)) continue

    const sameColorNeighbors = getSameColorNeighborCount(cells, index, columns, rows)
    const dominant = getDominantNeighborColor(cells, index, columns, rows)

    if (!dominant || dominant.color === color) continue

    if (sameColorNeighbors <= 1 && dominant.count >= 5 && dominant.orthogonalCount >= 2) {
      nextCells[index] = dominant.color
    }
  }

  return nextCells
}

const cleanupEdgeTransitions = (cells: string[], columns: number, rows: number): string[] => {
  const nextCells = [...cells]

  for (let y = 1; y < rows - 1; y += 1) {
    for (let x = 1; x < columns - 1; x += 1) {
      const index = y * columns + x
      const color = cells[index]
      if (isEmptyCell(color)) continue
      if (shouldPreserveLinePixel(cells, index, columns, rows)) continue

      const left = cells[index - 1]
      const right = cells[index + 1]
      const top = cells[index - columns]
      const bottom = cells[index + columns]
      const sameColorNeighbors = getSameColorNeighborCount(cells, index, columns, rows)

      if (sameColorNeighbors > 2) continue

      if (!isEmptyCell(left) && left === right && left !== color) {
        nextCells[index] = left
      } else if (!isEmptyCell(top) && top === bottom && top !== color) {
        nextCells[index] = top
      }
    }
  }

  return nextCells
}

const cleanupPatternCells = (cells: string[], columns: number, rows: number): string[] => {
  return cleanupEdgeTransitions(cleanupIsolatedPixels(cells, columns, rows), columns, rows)
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
  context.imageSmoothingEnabled = options.inputMode !== 'pixel-art'

  const sourceImageData = getSourceImageData(image)
  const imageData =
    options.inputMode === 'pixel-art'
      ? samplePixelArtImageData(
          sourceImageData,
          getPixelArtFit(sourceImageData, columns, rows),
          columns,
          rows,
          context,
          options.pixelArtCalibration
        )
      : averageImageDataToBoard(
          sourceImageData,
          getCenteredCrop(image.width, image.height, columns, rows),
          columns,
          rows,
          context
        )
  const rgbPalette = options.palette.map((color) => parseHex(color.hex))
  const activePalette =
    options.inputMode === 'pixel-art' ? rgbPalette : selectPaletteForImage(imageData, rgbPalette, options.maxColors)
  const exactPaletteLookup = createExactPaletteLookup(activePalette)
  const cells: string[] = new Array(columns * rows)

  if (options.dithering && options.inputMode !== 'pixel-art') {
    const data = new Float32Array(imageData.data)

    for (let index = 0; index < data.length; index += 4) {
      if (isTransparentAlpha(imageData.data[index + 3])) continue

      const pixel = getCompositedRgb(imageData.data, index)
      data[index] = pixel.r
      data[index + 1] = pixel.g
      data[index + 2] = pixel.b
    }

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        const index = (y * columns + x) * 4

        if (isTransparentAlpha(imageData.data[index + 3])) {
          cells[y * columns + x] = EMPTY_CELL
          continue
        }

        const nearestColor = getNearestColor(
          data[index],
          data[index + 1],
          data[index + 2],
          activePalette,
          exactPaletteLookup
        )
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
      if (isTransparentAlpha(imageData.data[index + 3])) {
        cells[index / 4] = EMPTY_CELL
        continue
      }

      const pixel = getCompositedRgb(imageData.data, index)
      const nearestColor = getNearestColor(
        pixel.r,
        pixel.g,
        pixel.b,
        activePalette,
        exactPaletteLookup,
        options.inputMode === 'pixel-art' ? 'pixel-art' : 'perceptual'
      )
      cells[index / 4] = nearestColor.hex
    }
  }

  return {
    columns,
    rows,
    cells: options.cleanup && options.inputMode !== 'pixel-art' ? cleanupPatternCells(cells, columns, rows) : cells,
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
    if (isEmptyCell(color)) return counts

    counts[color] = (counts[color] ?? 0) + 1
    return counts
  }, {})
  const totalCount = Math.max(
    1,
    Object.values(countMap).reduce((total, count) => total + count, 0)
  )
  const knownColors = palette
    .filter((color) => countMap[color.hex] > 0)
    .map((color) => ({
      ...color,
      count: countMap[color.hex],
      percentage: countMap[color.hex] / totalCount
    }))

  const knownHexes = new Set(palette.map((color) => color.hex))
  const unknownColors = Object.entries(countMap)
    .filter(([hex]) => !knownHexes.has(hex) && !isEmptyCell(hex))
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

const escapeHtml = (value: string | number): string => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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
  const cellSize = 26
  const labelSize = 28
  const padding = 24
  const titleHeight = 56
  const legendGap = 18
  const legendItemWidth = 78
  const legendItemHeight = 52
  const legendSwatchSize = 30
  const inventory = buildBeadInventory(pattern, options.palette)
  const gridWidth = pattern.columns * cellSize
  const gridHeight = pattern.rows * cellSize
  const chartWidth = gridWidth + labelSize * 2
  const chartHeight = gridHeight + labelSize * 2
  const legendColumns = Math.max(1, Math.floor(chartWidth / legendItemWidth))
  const legendRows = Math.ceil(inventory.length / legendColumns)
  const legendHeight = inventory.length > 0 ? legendRows * legendItemHeight : 0
  const inventoryByHex = new Map(inventory.map((item) => [item.hex, item]))
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('当前环境不支持 Canvas')
  }

  canvas.width = chartWidth + padding * 2
  canvas.height = titleHeight + chartHeight + legendGap + legendHeight + padding * 2

  const chartX = padding
  const chartY = padding + titleHeight
  const gridX = chartX + labelSize
  const gridY = chartY + labelSize
  const legendY = chartY + chartHeight + legendGap

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)

  context.fillStyle = '#161719'
  context.font = '700 24px Arial, sans-serif'
  context.textAlign = 'left'
  context.textBaseline = 'top'
  context.fillText('拼豆图纸', padding, padding)
  context.font = '14px Arial, sans-serif'
  context.fillStyle = '#55585f'
  context.fillText(
    `${pattern.columns} x ${pattern.rows} · ${options.manufacturer} · ${inventory.length} 色`,
    padding,
    padding + 32
  )

  context.fillStyle = '#d5d5d5'
  context.fillRect(gridX, chartY, gridWidth, labelSize)
  context.fillRect(gridX, gridY + gridHeight, gridWidth, labelSize)
  context.fillRect(chartX, gridY, labelSize, gridHeight)
  context.fillRect(gridX + gridWidth, gridY, labelSize, gridHeight)
  context.fillStyle = '#fdfdfd'
  context.fillRect(gridX, gridY, gridWidth, gridHeight)

  if (options.showLabels) {
    context.font = '9px Arial, sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = '#1d1d1f'

    for (let x = 0; x < pattern.columns; x += 1) {
      const label = x + 1
      const labelX = gridX + x * cellSize + cellSize / 2

      context.fillText(String(label), labelX, chartY + labelSize / 2)
      context.fillText(String(label), labelX, gridY + gridHeight + labelSize / 2)
    }

    for (let y = 0; y < pattern.rows; y += 1) {
      const label = y + 1
      const labelY = gridY + y * cellSize + cellSize / 2

      context.fillText(String(label), chartX + labelSize / 2, labelY)
      context.fillText(String(label), gridX + gridWidth + labelSize / 2, labelY)
    }
  }

  pattern.cells.forEach((color, index) => {
    const x = index % pattern.columns
    const y = Math.floor(index / pattern.columns)
    const cellX = gridX + x * cellSize
    const cellY = gridY + y * cellSize

    if (!isEmptyCell(color)) {
      const colorInfo = inventoryByHex.get(color)

      context.fillStyle = color
      context.fillRect(cellX + 1, cellY + 1, cellSize - 2, cellSize - 2)
      context.font = '8px Arial, sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillStyle = getReadableTextColor(color)
      context.fillText(colorInfo?.id ?? '', cellX + cellSize / 2, cellY + cellSize / 2)
    }
  })

  for (let x = 0; x <= pattern.columns; x += 1) {
    const lineX = gridX + x * cellSize + 0.5

    context.beginPath()
    context.moveTo(lineX, gridY)
    context.lineTo(lineX, gridY + gridHeight)
    context.strokeStyle = x % 5 === 0 ? '#111111' : '#8a8a8a'
    context.lineWidth = x % 5 === 0 ? 2 : 1
    context.stroke()
  }

  for (let y = 0; y <= pattern.rows; y += 1) {
    const lineY = gridY + y * cellSize + 0.5

    context.beginPath()
    context.moveTo(gridX, lineY)
    context.lineTo(gridX + gridWidth, lineY)
    context.strokeStyle = y % 5 === 0 ? '#111111' : '#8a8a8a'
    context.lineWidth = y % 5 === 0 ? 2 : 1
    context.stroke()
  }

  context.strokeStyle = '#111111'
  context.lineWidth = 2
  context.strokeRect(chartX + 0.5, chartY + 0.5, chartWidth - 1, chartHeight - 1)

  inventory.forEach((item, index) => {
    const row = Math.floor(index / legendColumns)
    const column = index % legendColumns
    const itemX = chartX + column * legendItemWidth
    const itemY = legendY + row * legendItemHeight
    const swatchX = itemX + 2
    const swatchY = itemY

    context.fillStyle = item.hex
    context.fillRect(swatchX, swatchY, legendSwatchSize, legendSwatchSize)
    context.strokeStyle = '#bfc1c5'
    context.lineWidth = 1
    context.strokeRect(swatchX + 0.5, swatchY + 0.5, legendSwatchSize - 1, legendSwatchSize - 1)
    context.font = '10px Arial, sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = getReadableTextColor(item.hex)
    context.fillText(item.id, swatchX + legendSwatchSize / 2, swatchY + legendSwatchSize / 2)
    context.font = '11px Arial, sans-serif'
    context.fillStyle = '#1d1d1f'
    context.fillText(String(item.count), swatchX + legendSwatchSize / 2, swatchY + legendSwatchSize + 13)
  })

  const link = document.createElement('a')
  link.download = `perler-pattern-${pattern.columns}x${pattern.rows}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

export const buildPatternPrintHtml = (pattern: PatternGrid, options: PatternPrintOptions): string => {
  const inventory = buildBeadInventory(pattern, options.palette)
  const inventoryByHex = new Map(inventory.map((item) => [item.hex, item]))
  const tileColumns = Math.max(1, options.tileColumns ?? 48)
  const tileRows = Math.max(1, options.tileRows ?? 48)
  const columnTiles = Math.ceil(pattern.columns / tileColumns)
  const rowTiles = Math.ceil(pattern.rows / tileRows)
  const title = options.title?.trim() || '拼豆图纸'
  const now = new Date().toLocaleString()

  const renderLabels = (start: number, count: number, maxValue: number, axis: 'x' | 'y'): string => {
    return Array.from({ length: count }, (_item, index) => {
      const value = start + index + 1
      const text = options.showLabels && shouldShowLabel(value, maxValue) ? String(value) : ''
      return `<span class="label label-${axis}">${escapeHtml(text)}</span>`
    }).join('')
  }

  const renderTile = (tileX: number, tileY: number): string => {
    const startColumn = tileX * tileColumns
    const startRow = tileY * tileRows
    const columns = Math.min(tileColumns, pattern.columns - startColumn)
    const rows = Math.min(tileRows, pattern.rows - startRow)
    const cells = Array.from({ length: columns * rows }, (_item, index) => {
      const x = index % columns
      const y = Math.floor(index / columns)
      const color = pattern.cells[(startRow + y) * pattern.columns + startColumn + x]
      const colorInfo = inventoryByHex.get(color)
      const cellClass = isEmptyCell(color) ? 'cell empty' : 'cell'
      const style = isEmptyCell(color) ? '' : ` style="background:${escapeHtml(color)};color:${getReadableTextColor(color)}"`
      const label = isEmptyCell(color) ? '' : escapeHtml(colorInfo?.id ?? '')

      return `<span class="${cellClass}"${style}>${label}</span>`
    }).join('')

    return `
      <section class="print-page">
        <header class="page-header">
          <div>
            <h1>${escapeHtml(title)}</h1>
            <p>${pattern.columns} x ${pattern.rows} · ${escapeHtml(options.manufacturer)} · ${inventory.length} 色</p>
          </div>
          <div class="page-meta">
            <strong>分页 ${tileY + 1}-${tileX + 1}</strong>
            <span>列 ${startColumn + 1}-${startColumn + columns}</span>
            <span>行 ${startRow + 1}-${startRow + rows}</span>
          </div>
        </header>
        <div class="chart-wrap">
          <div class="corner"></div>
          <div class="column-labels" style="grid-template-columns: repeat(${columns}, 1fr)">
            ${renderLabels(startColumn, columns, pattern.columns, 'x')}
          </div>
          <div class="row-labels" style="grid-template-rows: repeat(${rows}, 1fr)">
            ${renderLabels(startRow, rows, pattern.rows, 'y')}
          </div>
          <div class="print-grid" style="grid-template-columns: repeat(${columns}, 1fr)">
            ${cells}
          </div>
        </div>
      </section>
    `
  }

  const chartPages = Array.from({ length: rowTiles * columnTiles }, (_item, index) => {
    const tileX = index % columnTiles
    const tileY = Math.floor(index / columnTiles)
    return renderTile(tileX, tileY)
  }).join('')

  const inventoryRows = inventory
    .map((item) => `
      <tr>
        <td><span class="swatch" style="background:${escapeHtml(item.hex)}"></span></td>
        <td>${escapeHtml(item.id)}</td>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.hex)}</td>
        <td>${item.count}</td>
        <td>${(item.percentage * 100).toFixed(2)}%</td>
      </tr>
    `)
    .join('')

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(title)} · 打印</title>
    <style>
      @page {
        size: A4 portrait;
        margin: 10mm;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        color: #151515;
        background: #ffffff;
        font-family: Arial, "Microsoft YaHei", sans-serif;
      }

      .print-page {
        break-after: page;
        page-break-after: always;
        min-height: 270mm;
      }

      .print-page:last-child {
        break-after: auto;
        page-break-after: auto;
      }

      .page-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 8mm;
      }

      h1 {
        margin: 0 0 4px;
        font-size: 18pt;
      }

      p {
        margin: 0;
        color: #5b5b5b;
        font-size: 10pt;
      }

      .page-meta {
        display: grid;
        gap: 2px;
        min-width: 32mm;
        text-align: right;
        font-size: 8pt;
        color: #555;
      }

      .page-meta strong {
        color: #151515;
        font-size: 9pt;
      }

      .chart-wrap {
        display: grid;
        grid-template-columns: 9mm 1fr;
        grid-template-rows: 9mm 1fr;
        width: 100%;
        max-width: 188mm;
        margin: 0 auto;
        border: 1px solid #222;
        background: #e9e9e9;
      }

      .corner,
      .column-labels,
      .row-labels {
        background: #d7d7d7;
      }

      .column-labels,
      .row-labels,
      .print-grid {
        display: grid;
      }

      .label {
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        font-size: 6pt;
        font-weight: 700;
        line-height: 1;
      }

      .label-y {
        justify-content: flex-end;
        padding-right: 1.5mm;
      }

      .print-grid {
        background: #777;
        gap: 0.2mm;
        aspect-ratio: 1 / 1;
      }

      .cell {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 0;
        min-height: 0;
        border: 0;
        box-shadow: inset 0 0 0 0.2mm rgb(0 0 0 / 0.18);
        font-size: clamp(4pt, 1.1vw, 6pt);
        font-weight: 700;
        line-height: 1;
      }

      .empty {
        background: #fff;
        color: transparent;
      }

      .inventory-page {
        break-before: page;
        page-break-before: always;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 8mm;
        font-size: 9pt;
      }

      th,
      td {
        border: 1px solid #c9c9c9;
        padding: 5px 7px;
        text-align: left;
      }

      th {
        background: #efefef;
      }

      .swatch {
        display: inline-block;
        width: 14px;
        height: 14px;
        border: 1px solid #999;
        vertical-align: middle;
      }

      .screen-actions {
        position: sticky;
        top: 0;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 10px;
        background: #ffffff;
        border-bottom: 1px solid #e1e1e1;
      }

      .screen-actions button {
        border: 1px solid #cfcfcf;
        border-radius: 6px;
        background: #151515;
        color: #ffffff;
        padding: 8px 12px;
        font: inherit;
        cursor: pointer;
      }

      @media print {
        .screen-actions {
          display: none;
        }
      }
    </style>
  </head>
  <body>
    <div class="screen-actions">
      <button onclick="window.print()">打印 / 另存为 PDF</button>
    </div>
    ${chartPages}
    <section class="print-page inventory-page">
      <header class="page-header">
        <div>
          <h1>用珠统计</h1>
          <p>${escapeHtml(title)} · ${escapeHtml(options.manufacturer)} · ${now}</p>
        </div>
        <div class="page-meta">
          <strong>${inventory.length} 色</strong>
          <span>${pattern.columns * pattern.rows} 格</span>
        </div>
      </header>
      <table>
        <thead>
          <tr>
            <th>色块</th>
            <th>色号</th>
            <th>名称</th>
            <th>HEX</th>
            <th>数量</th>
            <th>占比</th>
          </tr>
        </thead>
        <tbody>
          ${inventoryRows}
        </tbody>
      </table>
    </section>
  </body>
</html>`
}

export const printPatternSheet = (pattern: PatternGrid, options: PatternPrintOptions): void => {
  const frameId = 'perler-print-frame'
  const existingFrame = document.getElementById(frameId)

  existingFrame?.remove()

  const printFrame = document.createElement('iframe')

  printFrame.id = frameId
  printFrame.title = '拼豆图纸打印'
  printFrame.style.position = 'fixed'
  printFrame.style.right = '0'
  printFrame.style.bottom = '0'
  printFrame.style.width = '1px'
  printFrame.style.height = '1px'
  printFrame.style.border = '0'
  printFrame.style.opacity = '0'
  printFrame.style.pointerEvents = 'none'

  document.body.appendChild(printFrame)

  const printDocument = printFrame.contentDocument

  if (!printDocument) {
    printFrame.remove()
    throw new Error('当前环境不支持打印预览')
  }

  printDocument.open()
  printDocument.write(buildPatternPrintHtml(pattern, options))
  printDocument.close()

  window.setTimeout(() => {
    printFrame.contentWindow?.focus()
    printFrame.contentWindow?.print()
  }, 100)
}
