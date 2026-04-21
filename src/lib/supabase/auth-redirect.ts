const DEFAULT_SIGN_IN_REDIRECT_PATH = '/dashboard'

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
