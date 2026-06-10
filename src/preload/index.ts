import { contextBridge, ipcRenderer } from 'electron'
import type { AiProviderConnection } from '../shared/ai'
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
    listModels: (connection: AiProviderConnection) => ipcRenderer.invoke('ai:list-models', connection)
  }
}

contextBridge.exposeInMainWorld('perler', perlerBridge)
