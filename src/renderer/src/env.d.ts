/// <reference types="vite/client" />

import type { PerlerBridge } from '@shared/theme'

declare global {
  interface Window {
    perler?: PerlerBridge
  }
}

export {}
