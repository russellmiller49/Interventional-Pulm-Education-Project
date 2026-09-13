/**
 * Synchronized anatomy assets stay on this origin so CT range requests and loaders
 * use the same delivery path as the module. The module is now public-unlisted;
 * proxy.ts applies noindex/noarchive to its pages and /airway-anatomy assets.
 * Heavy assets are trimmed from the standalone bundle; the /airway-anatomy/:path*
 * fallback rewrite proxies them from MODULE_ASSET_ORIGIN when absent locally.
 * Do not replace this with a filesystem-only API route: production has no local copy.
 * Retain this helper name to avoid changing all existing asset-loader callers.
 */
export function resolveAdminAirwayAssetPath(path: string): string {
  return path
}
