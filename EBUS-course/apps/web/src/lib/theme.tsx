import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type ThemePreference = 'system' | 'light' | 'dark';
type EffectiveTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'socal-ebus-prep.web.theme';

interface ThemeContextValue {
  effectiveTheme: EffectiveTheme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function readStoredThemePreference(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);

  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'dark';
}

function getSystemTheme(): EffectiveTheme {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function resolveEffectiveTheme(preference: ThemePreference): EffectiveTheme {
  return preference === 'system' ? getSystemTheme() : preference;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredThemePreference);
  const [systemTheme, setSystemTheme] = useState<EffectiveTheme>(getSystemTheme);
  const effectiveTheme = preference === 'system' ? systemTheme : preference;

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');

    function handleChange() {
      setSystemTheme(media.matches ? 'light' : 'dark');
    }

    media.addEventListener('change', handleChange);

    return () => media.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme;
  }, [effectiveTheme]);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
    setPreferenceState(nextPreference);
  }, []);

  const toggleTheme = useCallback(() => {
    setPreference(resolveEffectiveTheme(preference) === 'dark' ? 'light' : 'dark');
  }, [preference, setPreference]);

  const value = useMemo(
    () => ({
      effectiveTheme,
      preference,
      setPreference,
      toggleTheme,
    }),
    [effectiveTheme, preference, setPreference, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider.');
  }

  return context;
}
