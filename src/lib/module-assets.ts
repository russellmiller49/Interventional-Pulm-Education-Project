const moduleAssetBaseUrl = process.env.NEXT_PUBLIC_MODULE_ASSET_BASE_URL?.trim().replace(/\/$/, '')

export function resolveModuleAssetUrl(path: string): string {
  if (!path) {
    return path
  }

  if (/^(?:https?:)?\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path
  }

  if (!moduleAssetBaseUrl) {
    return path
  }

  return `${moduleAssetBaseUrl}/${path.replace(/^\/+/, '')}`
}

export function resolveModuleAssetPath(path: string): string {
  return resolveModuleAssetUrl(path)
}
