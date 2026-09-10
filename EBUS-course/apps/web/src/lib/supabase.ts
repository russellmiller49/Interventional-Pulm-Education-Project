import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null | undefined;

export type AuthCallbackMode = 'sign-in' | 'reset-password';
export interface BrowserRecoverySessionTokens {
  accessToken: string;
  refreshToken: string;
}

const COURSE_AUTH_CALLBACK_APP = 'socal-ebus-course';
const RECOVERY_SESSION_STORAGE_KEY = 'socal-ebus-recovery-session';
const RECOVERY_SESSION_STORAGE_TTL_MS = 15 * 60 * 1000;
const AUTH_TOKEN_PARAM_KEYS = [
  'access_token',
  'code',
  'expires_at',
  'expires_in',
  'refresh_token',
  'sb',
  'token_type',
  'type',
] as const;

function resolveSupabaseUrl() {
  const directUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || import.meta.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (directUrl) {
    return directUrl;
  }

  const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_REF?.trim() || import.meta.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF?.trim();

  return projectRef ? `https://${projectRef}.supabase.co` : '';
}

function resolveSupabaseAnonKey() {
  return import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';
}

export function isSupabaseConfigured() {
  return Boolean(resolveSupabaseUrl() && resolveSupabaseAnonKey());
}

export function getSupabaseBrowserClient() {
  if (typeof window === 'undefined' || !isSupabaseConfigured()) {
    return null;
  }

  if (browserClient) {
    return browserClient;
  }

  browserClient = createClient(resolveSupabaseUrl(), resolveSupabaseAnonKey(), {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
    },
  });

  return browserClient;
}

export function getSiteUrl() {
  const configured = import.meta.env.VITE_SITE_URL?.trim();
  const basePath = import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL.replace(/\/+$/, '');

  if (configured) {
    const normalized = configured.replace(/\/+$/, '');

    if (!basePath) {
      return normalized;
    }

    try {
      const configuredUrl = new URL(normalized);

      if (configuredUrl.pathname === '' || configuredUrl.pathname === '/') {
        return `${configuredUrl.origin}${basePath}`;
      }
    } catch {
      return normalized;
    }

    return normalized;
  }

  if (typeof window !== 'undefined') {
    return `${window.location.origin}${basePath}`;
  }

  return '';
}

export function buildAuthCallbackUrl(siteUrl: string, mode: AuthCallbackMode) {
  if (!siteUrl) {
    return '';
  }

  const url = new URL(`${siteUrl}/`);
  url.searchParams.set('authMode', mode);

  return url.toString();
}

export function buildSharedAuthCallbackUrl(callbackUrl: string, mode: AuthCallbackMode) {
  if (!callbackUrl) {
    return '';
  }

  const url = new URL(callbackUrl);

  if (!url.searchParams.has('app')) {
    url.searchParams.set('app', COURSE_AUTH_CALLBACK_APP);
  }

  url.searchParams.set('authMode', mode);

  return url.toString();
}

export function getAuthCallbackUrl(mode: AuthCallbackMode) {
  const sharedCallbackUrl = import.meta.env.VITE_SUPABASE_AUTH_CALLBACK_URL?.trim();

  if (sharedCallbackUrl) {
    return buildSharedAuthCallbackUrl(sharedCallbackUrl, mode);
  }

  return buildAuthCallbackUrl(getSiteUrl(), mode);
}

export function getBrowserAuthCallbackMode(): AuthCallbackMode | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const mode = getBrowserAuthUrlParams().get('mode') ?? getBrowserAuthUrlParams().get('authMode');

  return mode === 'sign-in' || mode === 'reset-password' ? mode : null;
}

function appendParams(target: URLSearchParams, source: URLSearchParams) {
  source.forEach((value, key) => {
    if (!target.has(key)) {
      target.set(key, value);
    }
  });
}

export function readAuthParamsFromUrlParts(search: string, hash: string) {
  const params = new URLSearchParams();
  const normalizedSearch = search.startsWith('?') ? search.slice(1) : search;
  const normalizedHash = hash.startsWith('#') ? hash.slice(1) : hash;

  appendParams(params, new URLSearchParams(normalizedSearch));

  if (normalizedHash) {
    appendParams(params, new URLSearchParams(normalizedHash));

    const hashQueryStart = normalizedHash.indexOf('?');

    if (hashQueryStart !== -1) {
      appendParams(params, new URLSearchParams(normalizedHash.slice(hashQueryStart + 1)));
    }
  }

  return params;
}

export function getBrowserAuthUrlParams() {
  if (typeof window === 'undefined') {
    return new URLSearchParams();
  }

  return readAuthParamsFromUrlParts(window.location.search, window.location.hash);
}

function readRecoverySessionTokens(params: URLSearchParams): BrowserRecoverySessionTokens | null {
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const tokenType = params.get('token_type');
  const callbackType = params.get('type');

  if (!accessToken || !refreshToken || tokenType !== 'bearer' || callbackType !== 'recovery') {
    return null;
  }

  return {
    accessToken,
    refreshToken,
  };
}

export function getBrowserRecoverySessionTokensFromUrl() {
  return readRecoverySessionTokens(getBrowserAuthUrlParams());
}

export function storeBrowserRecoverySessionTokens(tokens: BrowserRecoverySessionTokens) {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(
    RECOVERY_SESSION_STORAGE_KEY,
    JSON.stringify({
      ...tokens,
      createdAt: Date.now(),
    }),
  );
}

export function getStoredBrowserRecoverySessionTokens(): BrowserRecoverySessionTokens | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.sessionStorage.getItem(RECOVERY_SESSION_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<BrowserRecoverySessionTokens> & { createdAt?: unknown };

    if (
      typeof parsed.accessToken === 'string' &&
      typeof parsed.refreshToken === 'string' &&
      typeof parsed.createdAt === 'number' &&
      Date.now() - parsed.createdAt < RECOVERY_SESSION_STORAGE_TTL_MS
    ) {
      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
      };
    }
  } catch {
    // Clear malformed recovery state so a future reset link can recover cleanly.
  }

  window.sessionStorage.removeItem(RECOVERY_SESSION_STORAGE_KEY);
  return null;
}

export function getBrowserRecoverySessionTokens() {
  return getBrowserRecoverySessionTokensFromUrl() ?? getStoredBrowserRecoverySessionTokens();
}

export function getBrowserAuthCodeFromUrl() {
  const params = getBrowserAuthUrlParams();
  const code = params.get('code');

  return code || null;
}

export function clearStoredBrowserRecoverySessionTokens() {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(RECOVERY_SESSION_STORAGE_KEY);
}

export function clearBrowserAuthTokensFromUrl() {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  const hashQueryStart = hash.indexOf('?');

  AUTH_TOKEN_PARAM_KEYS.forEach((key) => {
    url.searchParams.delete(key);
  });

  if (hashQueryStart !== -1) {
    const hashPath = hash.slice(0, hashQueryStart);
    const hashParams = new URLSearchParams(hash.slice(hashQueryStart + 1));

    AUTH_TOKEN_PARAM_KEYS.forEach((key) => {
      hashParams.delete(key);
    });

    const nextHashParams = hashParams.toString();
    url.hash = nextHashParams ? `${hashPath}?${nextHashParams}` : hashPath;
  } else if (hash) {
    const hashParams = new URLSearchParams(hash);

    AUTH_TOKEN_PARAM_KEYS.forEach((key) => {
      hashParams.delete(key);
    });

    const nextHashParams = hashParams.toString();
    url.hash = nextHashParams ? `#${nextHashParams}` : '';
  }

  window.history.replaceState(window.history.state, '', url.toString());
}
