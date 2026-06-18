export interface SavedProject {
  schemaVersion: 1
  appName: 'Perler Beads Studio'
  savedAt: string
  board: {
    manufacturer: string
    boardSize: string
    maxColors: number
    inputMode: 'image' | 'pixel-art'
    pixelArtCalibration?: {
      scale: number
      offsetX: number
      offsetY: number
    }
    dithering: boolean
    cleanup: boolean
    showLabels: boolean
  }
  pattern: {
    columns: number
    rows: number
    cells: string[]
    sourceName: string
  }
  ai: {
    providerId: string
    baseUrl: string
    modelId: string
    optimizationMode: string
    prompt?: string
  }
}

export interface ProjectSaveRequest {
  project: SavedProject
}

export interface ProjectSaveResult {
  ok: boolean
  filePath?: string
  canceled?: boolean
  error?: string
}

export interface ProjectOpenResult {
  ok: boolean
  project?: SavedProject
  filePath?: string
  canceled?: boolean
  error?: string
}
