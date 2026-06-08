import { isAuthPath } from './access'

export const LOCAL_DEV_AUTH_COOKIE_NAME = 'ip_local_dev_auth'
export const LOCAL_DEV_AUTH_COOKIE_MAX_AGE_SECONDS = 12 * 60 * 60

type LocalDevAuthEnv = {
  NODE_ENV?: string
  LOCAL_DEV_AUTH_ENABLED?: string
  LOCAL_DEV_AUTH_TOKEN?: string
}

const DEFAULT_NEXT_PATH = '/'

export function isLocalDevHost(hostname: string) {
  const normalizedHostname = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return (
    normalizedHostname === 'localhost' ||
    normalizedHostname === '127.0.0.1' ||
    normalizedHostname === '::1'
  )
}

export function isLocalDevAuthConfigured(env: LocalDevAuthEnv = process.env) {
  return (
    env.NODE_ENV !== 'production' &&
    env.LOCAL_DEV_AUTH_ENABLED === '1' &&
    Boolean(env.LOCAL_DEV_AUTH_TOKEN?.trim())
  )
}

export function canIssueLocalDevAuth(
  requestUrl: URL,
  submittedToken: string | null | undefined,
  env: LocalDevAuthEnv = process.env,
) {
  const configuredToken = env.LOCAL_DEV_AUTH_TOKEN?.trim()
  return (
    isLocalDevAuthConfigured(env) &&
    isLocalDevHost(requestUrl.hostname) &&
    Boolean(submittedToken?.trim()) &&
    submittedToken?.trim() === configuredToken
  )
}

export function hasValidLocalDevAuthCookie(
  requestUrl: URL,
  cookieValue: string | undefined,
  env: LocalDevAuthEnv = process.env,
) {
  return (
    isLocalDevAuthConfigured(env) &&
    isLocalDevHost(requestUrl.hostname) &&
    cookieValue === env.LOCAL_DEV_AUTH_TOKEN?.trim()
  )
}

export function resolveLocalDevAuthNextPath(nextPath: string | null | undefined) {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return DEFAULT_NEXT_PATH
  }

  try {
    const target = new URL(nextPath, 'https://local-dev-auth.invalid')

    if (
      target.origin !== 'https://local-dev-auth.invalid' ||
      isAuthPath(target.pathname) ||
      target.pathname.startsWith('/api/local-dev-auth')
    ) {
      return DEFAULT_NEXT_PATH
    }

    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return DEFAULT_NEXT_PATH
  }
}

export function getLocalDevAuthCookieOptions() {
  return {
    httpOnly: true,
    maxAge: LOCAL_DEV_AUTH_COOKIE_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax' as const,
    secure: false,
  }
}
