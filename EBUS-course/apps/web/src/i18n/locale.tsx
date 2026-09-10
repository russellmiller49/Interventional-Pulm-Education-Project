import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

export const supportedLocales = ['en', 'es', 'zh-CN'] as const;

export type AppLocale = (typeof supportedLocales)[number];

const DEFAULT_LOCALE: AppLocale = 'en';
const PRESERVED_QUERY_KEYS = ['publicTraining', 'publicScope', 'adminPreview'] as const;

interface LocaleContextValue {
  locale: AppLocale;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

function getHashSearch(hash: string) {
  const queryIndex = hash.indexOf('?');

  return queryIndex >= 0 ? hash.slice(queryIndex) : '';
}

function readWindowSearch() {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.location.search;
}

function readWindowHashSearch() {
  if (typeof window === 'undefined') {
    return '';
  }

  return getHashSearch(window.location.hash);
}

export function normalizeLocale(value: string | null | undefined): AppLocale | null {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  if (normalized === 'zh-Hans' || normalized.toLowerCase() === 'zh-cn') {
    return 'zh-CN';
  }

  if (normalized === 'en' || normalized === 'es' || normalized === 'zh-CN') {
    return normalized;
  }

  return null;
}

export function getLocaleFromSearch(search: string): AppLocale | null {
  const params = new URLSearchParams(search);

  return normalizeLocale(params.get('locale'));
}

export function getLocaleFromRuntimeSearch(routerSearch = ''): AppLocale {
  return (
    getLocaleFromSearch(readWindowSearch()) ??
    getLocaleFromSearch(readWindowHashSearch()) ??
    getLocaleFromSearch(routerSearch) ??
    DEFAULT_LOCALE
  );
}

function getPreservedSourceParams(routerSearch: string) {
  const sourceParams = new URLSearchParams();

  for (const search of [readWindowSearch(), readWindowHashSearch(), routerSearch]) {
    for (const [key, value] of new URLSearchParams(search)) {
      if (!sourceParams.has(key)) {
        sourceParams.set(key, value);
      }
    }
  }

  return sourceParams;
}

export function withPreservedCourseQuery(to: string, locale: AppLocale, routerSearch = '') {
  if (!to || to.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(to)) {
    return to;
  }

  const [pathAndQuery, hash = ''] = to.split('#');
  const [pathname, query = ''] = pathAndQuery.split('?');
  const targetParams = new URLSearchParams(query);
  const sourceParams = getPreservedSourceParams(routerSearch);
  const sourceLocale = normalizeLocale(sourceParams.get('locale'));

  if ((sourceParams.has('locale') || locale !== DEFAULT_LOCALE) && !targetParams.has('locale')) {
    targetParams.set('locale', sourceLocale ?? locale);
  }

  for (const key of PRESERVED_QUERY_KEYS) {
    if (sourceParams.has(key) && !targetParams.has(key)) {
      const value = sourceParams.get(key);

      if (value !== null) {
        targetParams.set(key, value);
      }
    }
  }

  const nextQuery = targetParams.toString();
  const nextHash = hash ? `#${hash}` : '';

  return `${pathname}${nextQuery ? `?${nextQuery}` : ''}${nextHash}`;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const locale = useMemo(() => getLocaleFromRuntimeSearch(location.search), [location.search]);
  const value = useMemo(() => ({ locale }), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);

  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider.');
  }

  return context;
}

export function useLocalizedPath() {
  const location = useLocation();
  const { locale } = useLocale();

  return useMemo(
    () => (to: string) => withPreservedCourseQuery(to, locale, location.search),
    [locale, location.search],
  );
}
