import { resolveModuleAssetPath } from '@/lib/module-assets'

const AIRWAY_ASSET_PREFIX = '/airway-anatomy/'
const ADMIN_AIRWAY_ASSET_PREFIX = '/api/admin/airway-anatomy/'

export function resolveAdminAirwayAssetPath(path: string): string {
  if (!path) {
    return path
  }

  if (/^(?:https?:)?\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path
  }

  if (path.startsWith(AIRWAY_ASSET_PREFIX)) {
    return `${ADMIN_AIRWAY_ASSET_PREFIX}${path.slice(AIRWAY_ASSET_PREFIX.length)}`
  }

  return resolveModuleAssetPath(path)
}
