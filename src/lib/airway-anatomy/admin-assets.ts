/**
 * Resolve the URL the airway-anatomy module should fetch for an admin-only asset.
 *
 * The heavy airway assets are intentionally trimmed from the Railway standalone bundle
 * (see `scripts/prepare-standalone.mjs` `remoteAssetPrefixes`) and `airway_large.stl` is not even
 * committed to git, so in production these bytes live in Supabase Storage and are delivered through
 * the `/airway-anatomy/:path*` fallback rewrite (`MODULE_ASSET_ORIGIN` in `next.config.mjs`).
 *
 * We therefore keep requests on the raw `/airway-anatomy/*` route because that route is where:
 *   1. middleware (`proxy.ts` + `isDevOnlyAirwayAnatomyPath`) enforces the `site_admin` gate, and
 *   2. the fallback rewrite proxies the bytes from Storage when they are absent on local disk.
 *
 * Do NOT route these through `resolveModuleAssetPath`: when `NEXT_PUBLIC_MODULE_ASSET_BASE_URL` is
 * set on Railway it rewrites to the ungated `/module-assets/v1/*` path (or straight to the public
 * CDN), escaping the admin gate. Do NOT route them through a `/api/admin/.../[...path]` file route
 * either: that reads from `process.cwd()/public/airway-anatomy`, which is empty in the standalone
 * output, so every request 404s.
 */
export function resolveAdminAirwayAssetPath(path: string): string {
  return path
}
