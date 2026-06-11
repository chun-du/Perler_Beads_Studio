import { contextBridge, ipcRenderer } from 'electron'
import type { AiImageOptimizationRequest, AiProviderConnection, AiProviderProfileSaveRequest } from '../shared/ai'
import type { ProjectSaveRequest } from '../shared/project'
import type { PerlerBridge, ThemePreference } from '../shared/theme'

const perlerBridge: PerlerBridge = {
  theme: {
    getSystemShouldUseDark: () => ipcRenderer.invoke('theme:get-system-should-use-dark'),
    setNativeThemeSource: (source: ThemePreference) =>
      ipcRenderer.invoke('theme:set-native-theme-source', source),
    onUpdated: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, shouldUseDark: boolean): void => {
        callback(shouldUseDark)
      }

      ipcRenderer.on('theme:updated', listener)

      return () => {
        ipcRenderer.removeListener('theme:updated', listener)
      }
    }
  },
  ai: {
    listModels: (connection: AiProviderConnection) => ipcRenderer.invoke('ai:list-models', connection),
    optimizeImage: (request: AiImageOptimizationRequest) => ipcRenderer.invoke('ai:optimize-image', request),
    listProviderProfiles: () => ipcRenderer.invoke('ai:list-provider-profiles'),
    saveProviderProfile: (request: AiProviderProfileSaveRequest) =>
      ipcRenderer.invoke('ai:save-provider-profile', request),
    deleteProviderProfile: (profileId: string) => ipcRenderer.invoke('ai:delete-provider-profile', profileId)
  },
  project: {
    saveProject: (request: ProjectSaveRequest) => ipcRenderer.invoke('project:save', request),
    openProject: () => ipcRenderer.invoke('project:open')
  }
}

contextBridge.exposeInMainWorld('perler', perlerBridge)
