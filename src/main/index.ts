import { app, BrowserWindow, dialog, ipcMain, nativeTheme, safeStorage, shell } from 'electron'
import { Buffer } from 'node:buffer'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  AiImageOptimizationRequest,
  AiImageOptimizationResult,
  AiListModelsResult,
  AiModelCapability,
  AiProviderConnection,
  AiProviderProfile,
  AiProviderProfileDeleteResult,
  AiProviderProfileInput,
  AiProviderProfileListResult,
  AiProviderProfileSaveRequest,
  AiProviderProfileSaveResult
} from '../shared/ai'
import { buildAiImageEditsUrl, buildAiModelsUrl, createAiImageOptimizationPrompt } from '../shared/ai'
import type { ProjectOpenResult, ProjectSaveRequest, ProjectSaveResult, SavedProject } from '../shared/project'
import type { ThemePreference } from '../shared/theme'
import type { OpenDialogOptions, SaveDialogOptions } from 'electron'

let mainWindow: BrowserWindow | null = null

interface StoredAiProviderProfile extends Omit<AiProviderProfile, 'hasApiKey'> {
  encryptedApiKey?: string
}

interface StoredAiProviderProfilesFile {
  schemaVersion: 1
  profiles: StoredAiProviderProfile[]
}

const aiProviderProfilesFileName = 'ai-provider-profiles.json'
const aiModelCapabilities = ['image-generation', 'image-editing', 'vision', 'text'] satisfies AiModelCapability[]

const isValidThemePreference = (value: unknown): value is ThemePreference => {
  return value === 'light' || value === 'dark' || value === 'system'
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const isSavedProject = (value: unknown): value is SavedProject => {
  if (!isRecord(value)) return false
  if (value.schemaVersion !== 1 || value.appName !== 'Perler Beads Studio') return false
  if (!isRecord(value.board) || !isRecord(value.pattern) || !isRecord(value.ai)) return false

  const pattern = value.pattern
  return (
    typeof pattern.columns === 'number' &&
    typeof pattern.rows === 'number' &&
    Array.isArray(pattern.cells) &&
    pattern.cells.every((cell) => typeof cell === 'string') &&
    pattern.cells.length === pattern.columns * pattern.rows
  )
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
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  mainWindow.setMenu(null)

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

const isAiImageOptimizationRequest = (value: unknown): value is AiImageOptimizationRequest => {
  if (!isRecord(value)) return false

  return (
    typeof value.baseUrl === 'string' &&
    typeof value.apiKey === 'string' &&
    typeof value.model === 'string' &&
    typeof value.optimizationMode === 'string' &&
    typeof value.imageDataUrl === 'string' &&
    (value.prompt === undefined || typeof value.prompt === 'string') &&
    (value.imageName === undefined || typeof value.imageName === 'string')
  )
}

const getAiProviderProfilesPath = (): string => {
  return join(app.getPath('userData'), aiProviderProfilesFileName)
}

const createProfileId = (): string => {
  return `provider-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

const isValidAiModelCapability = (value: unknown): value is AiModelCapability => {
  return typeof value === 'string' && aiModelCapabilities.includes(value as AiModelCapability)
}

const normalizeModelList = (models: string[], selectedModel: string): string[] => {
  const uniqueModels = [...new Set(models.map((model) => model.trim()).filter(Boolean))]
  const normalizedSelectedModel = selectedModel.trim()

  if (normalizedSelectedModel && !uniqueModels.includes(normalizedSelectedModel)) {
    uniqueModels.unshift(normalizedSelectedModel)
  }

  return uniqueModels
}

const isAiProviderProfileInput = (value: unknown): value is AiProviderProfileInput => {
  if (!isRecord(value)) return false
  if (value.id !== undefined && typeof value.id !== 'string') return false
  if (typeof value.name !== 'string' || typeof value.baseUrl !== 'string') return false
  if (typeof value.selectedModel !== 'string' || !Array.isArray(value.models)) return false
  if (!value.models.every((model) => typeof model === 'string')) return false
  if (!isRecord(value.capabilitiesByModel)) return false

  return Object.entries(value.capabilitiesByModel).every(([model, capabilities]) => {
    return typeof model === 'string' && Array.isArray(capabilities) && capabilities.every(isValidAiModelCapability)
  })
}

const toPublicAiProviderProfile = (profile: StoredAiProviderProfile): AiProviderProfile => {
  return {
    id: profile.id,
    name: profile.name,
    baseUrl: profile.baseUrl,
    models: profile.models,
    selectedModel: profile.selectedModel,
    capabilitiesByModel: profile.capabilitiesByModel,
    hasApiKey: Boolean(profile.encryptedApiKey),
    updatedAt: profile.updatedAt
  }
}

const readStoredAiProviderProfiles = async (): Promise<StoredAiProviderProfile[]> => {
  try {
    const content = await readFile(getAiProviderProfilesPath(), 'utf8')
    const payload = JSON.parse(content) as unknown

    if (!isRecord(payload) || payload.schemaVersion !== 1 || !Array.isArray(payload.profiles)) {
      return []
    }

    return payload.profiles.filter((profile): profile is StoredAiProviderProfile => {
      if (!isRecord(profile)) return false
      if (typeof profile.id !== 'string' || typeof profile.name !== 'string' || typeof profile.baseUrl !== 'string') {
        return false
      }
      if (!Array.isArray(profile.models) || !profile.models.every((model) => typeof model === 'string')) return false
      if (typeof profile.selectedModel !== 'string' || typeof profile.updatedAt !== 'string') return false
      if (!isRecord(profile.capabilitiesByModel)) return false
      if (profile.encryptedApiKey !== undefined && typeof profile.encryptedApiKey !== 'string') return false

      return Object.values(profile.capabilitiesByModel).every((capabilities) => {
        return Array.isArray(capabilities) && capabilities.every(isValidAiModelCapability)
      })
    })
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return []
    }

    throw error
  }
}

const writeStoredAiProviderProfiles = async (profiles: StoredAiProviderProfile[]): Promise<void> => {
  const payload: StoredAiProviderProfilesFile = {
    schemaVersion: 1,
    profiles
  }

  await writeFile(getAiProviderProfilesPath(), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

const encryptApiKey = (apiKey: string): string => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('当前系统不可用安全存储，未保存 API Key')
  }

  return safeStorage.encryptString(apiKey).toString('base64')
}

const decryptApiKey = (encryptedApiKey: string): string => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('当前系统不可用安全存储，无法读取 API Key')
  }

  return safeStorage.decryptString(Buffer.from(encryptedApiKey, 'base64'))
}

const getStoredApiKey = async (profileId: string | undefined): Promise<string> => {
  if (!profileId) return ''

  const profiles = await readStoredAiProviderProfiles()
  const profile = profiles.find((item) => item.id === profileId)

  if (!profile?.encryptedApiKey) return ''

  return decryptApiKey(profile.encryptedApiKey)
}

const parseImageDataUrl = (dataUrl: string): { mimeType: string; buffer: Buffer } | null => {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(dataUrl)

  if (!match) return null

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64')
  }
}

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

const getApiErrorMessage = (payload: unknown): string | undefined => {
  if (!isRecord(payload)) return undefined
  if (isRecord(payload.error) && typeof payload.error.message === 'string') {
    return payload.error.message
  }
  if (typeof payload.message === 'string') {
    return payload.message
  }
  return undefined
}

const getFirstImageResult = (
  payload: unknown
): { b64Json?: string; url?: string; revisedPrompt?: string } | null => {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return null

  for (const item of payload.data) {
    if (!isRecord(item)) continue

    const b64Json = typeof item.b64_json === 'string' ? item.b64_json : undefined
    const url = typeof item.url === 'string' ? item.url : undefined
    const revisedPrompt = typeof item.revised_prompt === 'string' ? item.revised_prompt : undefined

    if (b64Json || url) {
      return { b64Json, url, revisedPrompt }
    }
  }

  return null
}

const readRemoteImageAsDataUrl = async (url: string): Promise<string> => {
  if (url.startsWith('data:image/')) return url

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`图片下载失败: HTTP ${response.status}`)
  }

  const mimeType = response.headers.get('content-type')?.split(';')[0] || 'image/png'
  const bytes = Buffer.from(await response.arrayBuffer())
  return `data:${mimeType};base64,${bytes.toString('base64')}`
}

const registerAiIpc = (): void => {
  ipcMain.handle('ai:list-provider-profiles', async (): Promise<AiProviderProfileListResult> => {
    try {
      const profiles = await readStoredAiProviderProfiles()

      return {
        ok: true,
        profiles: profiles.map(toPublicAiProviderProfile),
        secureStorageAvailable: safeStorage.isEncryptionAvailable()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '供应商配置读取失败'
      return {
        ok: false,
        profiles: [],
        secureStorageAvailable: safeStorage.isEncryptionAvailable(),
        error: message
      }
    }
  })

  ipcMain.handle(
    'ai:save-provider-profile',
    async (_event, request: AiProviderProfileSaveRequest): Promise<AiProviderProfileSaveResult> => {
      if (!isRecord(request) || !isAiProviderProfileInput(request.profile)) {
        return {
          ok: false,
          secureStorageAvailable: safeStorage.isEncryptionAvailable(),
          error: '供应商配置格式不正确'
        }
      }

      const profileInput = request.profile
      const name = profileInput.name.trim()
      const baseUrl = profileInput.baseUrl.trim()
      const selectedModel = profileInput.selectedModel.trim()

      if (!name) {
        return {
          ok: false,
          secureStorageAvailable: safeStorage.isEncryptionAvailable(),
          error: '供应商名称不能为空'
        }
      }

      if (!baseUrl) {
        return {
          ok: false,
          secureStorageAvailable: safeStorage.isEncryptionAvailable(),
          error: 'Base URL 不能为空'
        }
      }

      try {
        new URL(baseUrl)
      } catch {
        return {
          ok: false,
          secureStorageAvailable: safeStorage.isEncryptionAvailable(),
          error: 'Base URL 格式不正确'
        }
      }

      if (!selectedModel) {
        return {
          ok: false,
          secureStorageAvailable: safeStorage.isEncryptionAvailable(),
          error: '模型不能为空'
        }
      }

      try {
        const profiles = await readStoredAiProviderProfiles()
        const profileId = profileInput.id?.trim() || createProfileId()
        const existingProfile = profiles.find((profile) => profile.id === profileId)
        const models = normalizeModelList(profileInput.models, selectedModel)
        const modelSet = new Set(models)
        const capabilitiesByModel = Object.fromEntries(
          Object.entries(profileInput.capabilitiesByModel)
            .filter(([model]) => modelSet.has(model))
            .map(([model, capabilities]) => [model, [...new Set(capabilities)]])
        )
        let encryptedApiKey = existingProfile?.encryptedApiKey

        if (typeof request.apiKey === 'string' && request.apiKey.trim()) {
          encryptedApiKey = encryptApiKey(request.apiKey.trim())
        }

        const nextProfile: StoredAiProviderProfile = {
          id: profileId,
          name,
          baseUrl,
          models,
          selectedModel,
          capabilitiesByModel,
          encryptedApiKey,
          updatedAt: new Date().toISOString()
        }
        const nextProfiles = existingProfile
          ? profiles.map((profile) => (profile.id === profileId ? nextProfile : profile))
          : [...profiles, nextProfile]

        await writeStoredAiProviderProfiles(nextProfiles)

        return {
          ok: true,
          profile: toPublicAiProviderProfile(nextProfile),
          secureStorageAvailable: safeStorage.isEncryptionAvailable()
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '供应商配置保存失败'
        return {
          ok: false,
          secureStorageAvailable: safeStorage.isEncryptionAvailable(),
          error: message
        }
      }
    }
  )

  ipcMain.handle('ai:delete-provider-profile', async (_event, profileId: unknown): Promise<AiProviderProfileDeleteResult> => {
    if (typeof profileId !== 'string' || !profileId.trim()) {
      return {
        ok: false,
        secureStorageAvailable: safeStorage.isEncryptionAvailable(),
        error: '供应商配置 ID 不正确'
      }
    }

    try {
      const profiles = await readStoredAiProviderProfiles()
      await writeStoredAiProviderProfiles(profiles.filter((profile) => profile.id !== profileId))

      return {
        ok: true,
        secureStorageAvailable: safeStorage.isEncryptionAvailable()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '供应商配置删除失败'
      return {
        ok: false,
        secureStorageAvailable: safeStorage.isEncryptionAvailable(),
        error: message
      }
    }
  })

  ipcMain.handle(
    'ai:list-models',
    async (_event, connection: AiProviderConnection): Promise<AiListModelsResult> => {
      if (!connection?.baseUrl?.trim()) {
        return { ok: false, models: [], error: 'Base URL 不能为空' }
      }

      let apiKey = ''

      try {
        apiKey = connection.apiKey?.trim() || (await getStoredApiKey(connection.providerProfileId))
      } catch (error) {
        const message = error instanceof Error ? error.message : 'API Key 读取失败'
        return { ok: false, models: [], error: message }
      }

      if (!apiKey) {
        return { ok: false, models: [], error: 'API Key 不能为空' }
      }

      try {
        const response = await fetch(buildAiModelsUrl(connection.baseUrl), {
          headers: {
            Authorization: `Bearer ${apiKey}`,
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

  ipcMain.handle(
    'ai:optimize-image',
    async (_event, request: AiImageOptimizationRequest): Promise<AiImageOptimizationResult> => {
      if (!isAiImageOptimizationRequest(request)) {
        return { ok: false, error: 'AI 优化请求格式不正确' }
      }

      if (!request.baseUrl.trim()) {
        return { ok: false, error: 'Base URL 不能为空' }
      }

      let apiKey = ''

      try {
        apiKey = request.apiKey.trim() || (await getStoredApiKey(request.providerProfileId))
      } catch (error) {
        const message = error instanceof Error ? error.message : 'API Key 读取失败'
        return { ok: false, error: message }
      }

      if (!apiKey) {
        return { ok: false, error: 'API Key 不能为空' }
      }

      if (!request.model.trim()) {
        return { ok: false, error: '模型不能为空' }
      }

      const image = parseImageDataUrl(request.imageDataUrl)

      if (!image) {
        return { ok: false, error: '图片数据格式不正确' }
      }

      const body = new FormData()
      const imageBlob = new Blob([new Uint8Array(image.buffer)], { type: image.mimeType })

      body.append('model', request.model.trim())
      body.append('prompt', createAiImageOptimizationPrompt(request.optimizationMode, request.prompt))
      body.append('image', imageBlob, request.imageName?.trim() || 'source-image.png')

      try {
        const response = await fetch(buildAiImageEditsUrl(request.baseUrl), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json'
          },
          body
        })
        const responseText = await response.text()
        const payload = parseJson(responseText)

        if (!response.ok) {
          return {
            ok: false,
            error: getApiErrorMessage(payload) ?? `AI 优化失败: HTTP ${response.status}`
          }
        }

        const imageResult = getFirstImageResult(payload)

        if (!imageResult) {
          return { ok: false, error: 'AI 接口未返回图片结果' }
        }

        const imageDataUrl = imageResult.b64Json
          ? `data:image/png;base64,${imageResult.b64Json}`
          : await readRemoteImageAsDataUrl(imageResult.url as string)

        return {
          ok: true,
          imageDataUrl,
          revisedPrompt: imageResult.revisedPrompt
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'AI 优化失败'
        return { ok: false, error: message }
      }
    }
  )
}

const registerProjectIpc = (): void => {
  ipcMain.handle(
    'project:save',
    async (_event, request: ProjectSaveRequest): Promise<ProjectSaveResult> => {
      if (!isSavedProject(request?.project)) {
        return { ok: false, error: '项目数据格式不正确' }
      }

      const defaultFileName = `perler-pattern-${request.project.pattern.columns}x${request.project.pattern.rows}.pbd.json`
      const saveDialogOptions: SaveDialogOptions = {
        title: '保存拼豆项目',
        defaultPath: defaultFileName,
        filters: [
          { name: 'Perler Beads Project', extensions: ['json'] },
          { name: 'JSON', extensions: ['json'] }
        ]
      }
      const result = mainWindow
        ? await dialog.showSaveDialog(mainWindow, saveDialogOptions)
        : await dialog.showSaveDialog(saveDialogOptions)

      if (result.canceled || !result.filePath) {
        return { ok: false, canceled: true }
      }

      try {
        await writeFile(result.filePath, `${JSON.stringify(request.project, null, 2)}\n`, 'utf8')
        return { ok: true, filePath: result.filePath }
      } catch (error) {
        const message = error instanceof Error ? error.message : '保存失败'
        return { ok: false, error: message }
      }
    }
  )

  ipcMain.handle('project:open', async (): Promise<ProjectOpenResult> => {
    const openDialogOptions: OpenDialogOptions = {
      title: '打开拼豆项目',
      properties: ['openFile'],
      filters: [
        { name: 'Perler Beads Project', extensions: ['json'] },
        { name: 'JSON', extensions: ['json'] }
      ]
    }
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, openDialogOptions)
      : await dialog.showOpenDialog(openDialogOptions)

    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, canceled: true }
    }

    const filePath = result.filePaths[0]

    try {
      const content = await readFile(filePath, 'utf8')
      const project = JSON.parse(content) as unknown

      if (!isSavedProject(project)) {
        return { ok: false, filePath, error: '项目文件格式不正确' }
      }

      return { ok: true, project, filePath }
    } catch (error) {
      const message = error instanceof Error ? error.message : '打开失败'
      return { ok: false, filePath, error: message }
    }
  })
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
    registerProjectIpc()
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
