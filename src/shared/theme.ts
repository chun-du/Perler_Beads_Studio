import type {
  AiImageOptimizationRequest,
  AiImageOptimizationResult,
  AiListModelsResult,
  AiProviderConnection
} from './ai'
import type { ProjectOpenResult, ProjectSaveRequest, ProjectSaveResult } from './project'

export type ThemePreference = 'light' | 'dark' | 'system'

export interface ThemeBridge {
  getSystemShouldUseDark: () => Promise<boolean>
  setNativeThemeSource: (source: ThemePreference) => Promise<boolean>
  onUpdated: (callback: (shouldUseDark: boolean) => void) => () => void
}

export interface AiBridge {
  listModels: (connection: AiProviderConnection) => Promise<AiListModelsResult>
  optimizeImage: (request: AiImageOptimizationRequest) => Promise<AiImageOptimizationResult>
}

export interface ProjectBridge {
  saveProject: (request: ProjectSaveRequest) => Promise<ProjectSaveResult>
  openProject: () => Promise<ProjectOpenResult>
}

export interface PerlerBridge {
  theme: ThemeBridge
  ai: AiBridge
  project: ProjectBridge
}
