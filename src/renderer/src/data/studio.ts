export interface BeadColor {
  id: string
  name: string
  hex: string
}

export interface AiProviderPreset {
  id: string
  name: string
  baseUrl: string
  models: string[]
}

export const workflowSteps = [
  { id: 'source', label: '导入原图', icon: 'ri:image-add-line', status: 'ready' },
  { id: 'ai', label: 'AI 优化', icon: 'ri:magic-line', status: 'next' },
  { id: 'pattern', label: '生成图纸', icon: 'ri:grid-line', status: 'idle' },
  { id: 'edit', label: '手工精修', icon: 'ri:paint-brush-line', status: 'idle' },
  { id: 'export', label: '导出分享', icon: 'ri:file-pdf-2-line', status: 'idle' }
]

export const aiProviderPresets: AiProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-image-2', 'gpt-4.1']
  },
  {
    id: 'custom',
    name: 'OpenAI-compatible',
    baseUrl: 'https://api.example.com/v1',
    models: ['image-model-id']
  }
]

export const beadPalette: BeadColor[] = [
  { id: 'P01', name: 'White', hex: '#f7f4ec' },
  { id: 'P02', name: 'Black', hex: '#202124' },
  { id: 'P03', name: 'Tomato', hex: '#de4d42' },
  { id: 'P04', name: 'Apricot', hex: '#f2a65a' },
  { id: 'P05', name: 'Lemon', hex: '#f2cf4a' },
  { id: 'P06', name: 'Mint', hex: '#7cc7a1' },
  { id: 'P07', name: 'Teal', hex: '#348f8b' },
  { id: 'P08', name: 'Sky', hex: '#68a9d4' },
  { id: 'P09', name: 'Indigo', hex: '#5363b5' },
  { id: 'P10', name: 'Violet', hex: '#8b65c9' },
  { id: 'P11', name: 'Rose', hex: '#e17a9b' },
  { id: 'P12', name: 'Cocoa', hex: '#8d6247' }
]
