import type { AiListModelsResult, AiProviderConnection } from './ai'

export type ThemePreference = 'light' | 'dark' | 'system'

export interface ThemeBridge {
  getSystemShouldUseDark: () => Promise<boolean>
  setNativeThemeSource: (source: ThemePreference) => Promise<boolean>
  onUpdated: (callback: (shouldUseDark: boolean) => void) => () => void
}

export interface AiBridge {
  listModels: (connection: AiProviderConnection) => Promise<AiListModelsResult>
}

export interface PerlerBridge {
  theme: ThemeBridge
  ai: AiBridge
}
