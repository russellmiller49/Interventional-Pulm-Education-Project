'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { HandoffContent } from '@/i18n/handoff'

type Theme = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

interface ThemeProviderProps {
  attribute?: 'class' | `data-${string}`
  children: ReactNode
  defaultTheme?: Theme
  disableTransitionOnChange?: boolean
  enableColorScheme?: boolean
  enableSystem?: boolean
  storageKey?: string
}

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme | ((currentTheme: Theme) => Theme)) => void
  systemTheme: ResolvedTheme
  themes: Theme[]
}

const THEME_STORAGE_KEY = 'theme'
const THEME_QUERY = '(prefers-color-scheme: dark)'
const ThemeContext = createContext<ThemeContextValue | null>(null)

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system'
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') {
    return 'light'
  }

  return window.matchMedia(THEME_QUERY).matches ? 'dark' : 'light'
}

function getStoredTheme(storageKey: string, defaultTheme: Theme) {
  if (typeof window === 'undefined') {
    return defaultTheme
  }

  const storedTheme = window.localStorage.getItem(storageKey)

  return isTheme(storedTheme) ? storedTheme : defaultTheme
}

function resolveTheme(theme: Theme, systemTheme: ResolvedTheme, enableSystem: boolean) {
  return theme === 'system' && enableSystem ? systemTheme : theme === 'dark' ? 'dark' : 'light'
}

function disableTransitionsTemporarily() {
  const style = document.createElement('style')
  style.appendChild(
    document.createTextNode(
      '*,*::before,*::after{transition:none!important;animation:none!important}',
    ),
  )
  document.head.appendChild(style)

  window.getComputedStyle(document.body)

  window.setTimeout(() => {
    document.head.removeChild(style)
  }, 1)
}

function applyTheme(
  resolvedTheme: ResolvedTheme,
  attribute: NonNullable<ThemeProviderProps['attribute']>,
  enableColorScheme: boolean,
  disableTransitionOnChange: boolean,
) {
  if (typeof document === 'undefined') {
    return
  }

  if (disableTransitionOnChange) {
    disableTransitionsTemporarily()
  }

  const root = document.documentElement

  if (attribute === 'class') {
    root.classList.remove('light', 'dark')
    root.classList.add(resolvedTheme)
  } else {
    root.setAttribute(attribute, resolvedTheme)
  }

  if (enableColorScheme) {
    root.style.colorScheme = resolvedTheme
  }
}

export function ThemeProvider({
  attribute = 'class',
  children,
  defaultTheme = 'system',
  disableTransitionOnChange = true,
  enableColorScheme = true,
  enableSystem = true,
  storageKey = THEME_STORAGE_KEY,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme(storageKey, defaultTheme))
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme())

  const resolvedTheme = resolveTheme(theme, systemTheme, enableSystem)

  useEffect(() => {
    applyTheme(resolvedTheme, attribute, enableColorScheme, disableTransitionOnChange)
  }, [attribute, disableTransitionOnChange, enableColorScheme, resolvedTheme])

  useEffect(() => {
    const mediaQuery = window.matchMedia(THEME_QUERY)
    const handleChange = () => setSystemTheme(getSystemTheme())

    handleChange()
    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) {
        return
      }

      setThemeState(isTheme(event.newValue) ? event.newValue : defaultTheme)
    }

    window.addEventListener('storage', handleStorage)

    return () => window.removeEventListener('storage', handleStorage)
  }, [defaultTheme, storageKey])

  const setTheme = useCallback(
    (nextTheme: Theme | ((currentTheme: Theme) => Theme)) => {
      setThemeState((currentTheme) => {
        const resolvedNextTheme =
          typeof nextTheme === 'function' ? nextTheme(currentTheme) : nextTheme

        window.localStorage.setItem(storageKey, resolvedNextTheme)

        return resolvedNextTheme
      })
    },
    [storageKey],
  )

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      systemTheme,
      themes: enableSystem ? ['light', 'dark', 'system'] : ['light', 'dark'],
    }),
    [enableSystem, resolvedTheme, setTheme, systemTheme, theme],
  )

  return (
    <HandoffContent>
      {<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>}
    </HandoffContent>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }

  return context
}
