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
