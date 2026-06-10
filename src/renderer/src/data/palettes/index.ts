import { mard221Palette } from './mard221'
import { mard291Palette } from './mard291'
import { perlerPalette } from './perler'
import { hamaPalette } from './hama'
import { artkalPalette } from './artkal'
import { artkalMiniPalette } from './artkalMini'
import type { ManufacturerPalette } from './types'

export type { BeadColor, ManufacturerPalette } from './types'

export const manufacturerPalettes: ManufacturerPalette[] = [mard221Palette, mard291Palette, perlerPalette, hamaPalette, artkalPalette, artkalMiniPalette]
export const defaultManufacturerId = mard221Palette.id

export const getManufacturerPalette = (manufacturerId: string): ManufacturerPalette => {
  const normalizedId = manufacturerId.trim().toLowerCase()

  return (
    manufacturerPalettes.find((palette) => {
      return palette.id.toLowerCase() === normalizedId || palette.name.toLowerCase() === normalizedId
    }) ?? mard221Palette
  )
}
