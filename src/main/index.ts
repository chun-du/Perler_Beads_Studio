import { app, BrowserWindow, ipcMain, nativeTheme, shell } from 'electron'
import { join } from 'node:path'
import type { AiListModelsResult, AiProviderConnection } from '../shared/ai'
import type { ThemePreference } from '../shared/theme'

let mainWindow: BrowserWindow | null = null

const isValidThemePreference = (value: unknown): value is ThemePreference => {
  return value === 'light' || value === 'dark' || value === 'system'
}

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1180,
    minHeight: 720,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#191715' : '#f8f7f4',
    show: false,
    title: 'Perler Beads Studio',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  const devServerUrl = process.env.ELECTRON_RENDERER_URL
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const registerThemeIpc = (): void => {
  ipcMain.handle('theme:get-system-should-use-dark', () => nativeTheme.shouldUseDarkColors)

  ipcMain.handle('theme:set-native-theme-source', (_event, source: unknown) => {
    if (!isValidThemePreference(source)) {
      return false
    }

    nativeTheme.themeSource = source
    return true
  })

  nativeTheme.on('updated', () => {
    mainWindow?.webContents.send('theme:updated', nativeTheme.shouldUseDarkColors)
  })
}

const getModelsUrl = (baseUrl: string): string => {
  const normalizedUrl = new URL(baseUrl.trim())
  const trimmedPath = normalizedUrl.pathname.replace(/\/+$/, '')

  if (trimmedPath.endsWith('/models')) {
    normalizedUrl.pathname = trimmedPath
  } else {
    normalizedUrl.pathname = `${trimmedPath}/models`
  }

  return normalizedUrl.toString()
}

const registerAiIpc = (): void => {
  ipcMain.handle(
    'ai:list-models',
    async (_event, connection: AiProviderConnection): Promise<AiListModelsResult> => {
      if (!connection?.baseUrl?.trim()) {
        return { ok: false, models: [], error: 'Base URL 不能为空' }
      }

      if (!connection?.apiKey?.trim()) {
        return { ok: false, models: [], error: 'API Key 不能为空' }
      }

      try {
        const response = await fetch(getModelsUrl(connection.baseUrl), {
          headers: {
            Authorization: `Bearer ${connection.apiKey}`,
            Accept: 'application/json'
          }
        })

        if (!response.ok) {
          return {
            ok: false,
            models: [],
            error: `模型拉取失败: HTTP ${response.status}`
          }
        }

        const payload = (await response.json()) as {
          data?: Array<{ id?: string; created?: number; owned_by?: string }>
        }

        const models =
          payload.data
            ?.filter((model) => typeof model.id === 'string' && model.id.length > 0)
            .map((model) => ({
              id: model.id as string,
              created: model.created,
              ownedBy: model.owned_by
            })) ?? []

        return { ok: true, models }
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误'
        return { ok: false, models: [], error: message }
      }
    }
  )
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    if (process.platform === 'win32') {
      app.setAppUserModelId('Perler Beads Studio')
    }

    registerThemeIpc()
    registerAiIpc()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
