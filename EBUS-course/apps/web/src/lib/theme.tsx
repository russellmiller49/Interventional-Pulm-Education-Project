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

/** True when this window was opened as an open module of the main site, not as the course. */
export function isSiteModuleWindow(): boolean {
  return (
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('publicTraining') === '1'
  );
}

/** The site page that frames this window, when there is one and it is on our own origin. */
function siteHostDocument(): Document | null {
  try {
    return window.parent !== window ? window.parent.document : null;
  } catch {
    return null;
  }
}

/** The theme of the framing site page, which marks dark mode with a class on its root element. */
function readSiteHostTheme(): EffectiveTheme | null {
  const host = siteHostDocument();

  return host ? (host.documentElement.classList.contains('dark') ? 'dark' : 'light') : null;
}

/**
 * Mark the document before the first paint, so a site module never flashes the course's own
 * typeface, colors or theme while React starts.
 */
export function prepareDocumentForSiteModule(): void {
  if (!isSiteModuleWindow()) {
    return;
  }

  document.documentElement.dataset.embed = 'site';
  document.documentElement.dataset.theme = readSiteHostTheme() ?? getSystemTheme();
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredThemePreference);
  const [systemTheme, setSystemTheme] = useState<EffectiveTheme>(getSystemTheme);
  // A site module has no theme switch of its own: it follows the page that frames it, or the
  // system setting when it is opened in its own window.
  const [siteModule] = useState(isSiteModuleWindow);
  const [hostTheme, setHostTheme] = useState<EffectiveTheme | null>(() =>
    isSiteModuleWindow() ? readSiteHostTheme() : null,
  );
  const effectiveTheme = siteModule
    ? (hostTheme ?? systemTheme)
    : preference === 'system'
      ? systemTheme
      : preference;

  useEffect(() => {
    const host = siteModule ? siteHostDocument() : null;

    if (!host) {
      return;
    }

    const observer = new MutationObserver(() => setHostTheme(readSiteHostTheme()));

    observer.observe(host.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, [siteModule]);

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
