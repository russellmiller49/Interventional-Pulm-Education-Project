const DEFAULT_SIGN_IN_REDIRECT_PATH = '/dashboard'

export const SHARED_AUTH_CALLBACK_TARGETS = {
  'socal-ebus-course': '/socal-ebus-course/app/',
} as const

type SharedAuthCallbackApp = keyof typeof SHARED_AUTH_CALLBACK_TARGETS

type SharedAuthCallbackRedirect =
  | {
      status: 'ok'
      app: SharedAuthCallbackApp
      destination: string
    }
  | {
      status: 'error'
      reason: 'missing-app' | 'unknown-app'
    }

export function resolvePostAuthRedirectPath(next: string | null | undefined) {
  if (!next) {
    return DEFAULT_SIGN_IN_REDIRECT_PATH
  }

  const trimmed = next.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return DEFAULT_SIGN_IN_REDIRECT_PATH
  }

  return trimmed
}

export function buildSignInRedirectUrl(origin: string, nextPath: string) {
  const callbackUrl = new URL('/auth/callback', origin)
  callbackUrl.searchParams.set('next', resolvePostAuthRedirectPath(nextPath))
  return callbackUrl.toString()
}

function normalizeRawSearch(rawSearch: string) {
  return rawSearch.startsWith('?') ? rawSearch.slice(1) : rawSearch
}

function normalizeRawHash(rawHash: string) {
  if (!rawHash) {
    return ''
  }

  return rawHash.startsWith('#') ? rawHash : `#${rawHash}`
}

function getRawSearchSegments(rawSearch: string) {
  const normalizedSearch = normalizeRawSearch(rawSearch)

  if (!normalizedSearch) {
    return []
  }

  return normalizedSearch.split('&').filter(Boolean)
}

function getRawSearchSegmentKey(segment: string) {
  const separatorIndex = segment.indexOf('=')
  const rawKey = separatorIndex === -1 ? segment : segment.slice(0, separatorIndex)

  try {
    return decodeURIComponent(rawKey.replace(/\+/g, ' '))
  } catch {
    return rawKey
  }
}

function getSearchParam(rawSearch: string, name: string) {
  return new URLSearchParams(normalizeRawSearch(rawSearch)).get(name)
}

function hasRecoveryType(rawSearch: string, rawHash: string) {
  const normalizedHash = normalizeRawHash(rawHash)
  const hashParams = new URLSearchParams(
    normalizedHash.startsWith('#') ? normalizedHash.slice(1) : normalizedHash,
  )

  return hashParams.get('type') === 'recovery' || getSearchParam(rawSearch, 'type') === 'recovery'
}

export function resolveSharedAuthCallbackRedirect(
  rawSearch: string,
  rawHash: string,
): SharedAuthCallbackRedirect {
  const app = getSearchParam(rawSearch, 'app')

  if (!app) {
    return {
      status: 'error',
      reason: 'missing-app',
    }
  }

  const sharedApp = app as SharedAuthCallbackApp
  const destinationPath = SHARED_AUTH_CALLBACK_TARGETS[sharedApp]

  if (!destinationPath) {
    return {
      status: 'error',
      reason: 'unknown-app',
    }
  }

  const segments = getRawSearchSegments(rawSearch)
  const authModeSegment = segments.find((segment) => getRawSearchSegmentKey(segment) === 'authMode')
  const forwardedSegments = segments.filter((segment) => {
    const key = getRawSearchSegmentKey(segment)
    return key !== 'app' && key !== 'authMode'
  })

  if (authModeSegment) {
    forwardedSegments.push(authModeSegment)
  } else if (hasRecoveryType(rawSearch, rawHash)) {
    forwardedSegments.push('authMode=reset-password')
  }

  return {
    status: 'ok',
    app: sharedApp,
    destination: `${destinationPath}${forwardedSegments.length ? `?${forwardedSegments.join('&')}` : ''}${normalizeRawHash(rawHash)}`,
  }
}
