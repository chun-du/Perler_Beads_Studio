export interface BeadColor {
  id: string
  name: string
  hex: string
}

export interface ManufacturerPalette {
  id: string
  name: string
  beadSize: string
  source: string
  colors: BeadColor[]
}
