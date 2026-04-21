export function buildLocalSupabaseRedirectUrl(origin: string, path: string) {
  const normalizedOrigin = origin.replace(/\/$/, '')
  const redirectUrl = new URL(path, normalizedOrigin)
  return redirectUrl.toString()
}
