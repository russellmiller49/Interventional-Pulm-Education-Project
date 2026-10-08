'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

/**
 * Storage can be refused: a browser that blocks site data may throw from the `localStorage` getter
 * itself or from `getItem`/`setItem`. The theme then falls back to the default and changes last for
 * the visit; nothing claims it was saved.
 */
function readStoredTheme(storageKey: string): string | null {
  try {
    return window.localStorage.getItem(storageKey)
  } catch {
    return null
  }
}

function writeStoredTheme(storageKey: string, theme: Theme) {
  try {
    window.localStorage.setItem(storageKey, theme)
  } catch {
    // refused: the theme applies for this visit only
  }
}

function getStoredTheme(storageKey: string, defaultTheme: Theme) {
  if (typeof window === 'undefined') {
    return defaultTheme
  }

  const storedTheme = readStoredTheme(storageKey)

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

  // A change the visitor asks for is saved once it has applied, outside the state updater, which
  // must stay pure; a change that came from another tab's storage is not written back.
  const saveRequested = useRef(false)
  const setTheme = useCallback((nextTheme: Theme | ((currentTheme: Theme) => Theme)) => {
    saveRequested.current = true
    setThemeState((currentTheme) =>
      typeof nextTheme === 'function' ? nextTheme(currentTheme) : nextTheme,
    )
  }, [])

  useEffect(() => {
    if (!saveRequested.current) return
    saveRequested.current = false
    writeStoredTheme(storageKey, theme)
  }, [storageKey, theme])

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
