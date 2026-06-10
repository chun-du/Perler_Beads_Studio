import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { ThemePreference } from '@shared/theme'

const storageKey = 'perler-beads.theme'

const getStoredPreference = (): ThemePreference => {
  const value = window.localStorage.getItem(storageKey)
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value
  }

  return 'system'
}

export const useTheme = () => {
  const preference = ref<ThemePreference>(getStoredPreference())
  const systemShouldUseDark = ref(window.matchMedia('(prefers-color-scheme: dark)').matches)

  const resolvedTheme = computed<'light' | 'dark'>(() => {
    if (preference.value === 'system') {
      return systemShouldUseDark.value ? 'dark' : 'light'
    }

    return preference.value
  })

  const applyTheme = (): void => {
    document.documentElement.classList.toggle('dark', resolvedTheme.value === 'dark')
    document.documentElement.style.colorScheme = resolvedTheme.value
  }

  const setPreference = (nextPreference: ThemePreference): void => {
    preference.value = nextPreference
    window.localStorage.setItem(storageKey, nextPreference)
    window.perler?.theme.setNativeThemeSource(nextPreference)
  }

  const cycleTheme = (): void => {
    const nextPreference: Record<ThemePreference, ThemePreference> = {
      system: 'light',
      light: 'dark',
      dark: 'system'
    }

    setPreference(nextPreference[preference.value])
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const onSystemThemeChange = (event: MediaQueryListEvent): void => {
    systemShouldUseDark.value = event.matches
  }

  mediaQuery.addEventListener('change', onSystemThemeChange)

  window.perler?.theme.getSystemShouldUseDark().then((shouldUseDark) => {
    systemShouldUseDark.value = shouldUseDark
  })

  const removeNativeThemeListener = window.perler?.theme.onUpdated((shouldUseDark) => {
    systemShouldUseDark.value = shouldUseDark
  })

  window.perler?.theme.setNativeThemeSource(preference.value)

  watch(resolvedTheme, applyTheme, { immediate: true })

  onBeforeUnmount(() => {
    mediaQuery.removeEventListener('change', onSystemThemeChange)
    removeNativeThemeListener?.()
  })

  return {
    preference,
    resolvedTheme,
    setPreference,
    cycleTheme
  }
}
