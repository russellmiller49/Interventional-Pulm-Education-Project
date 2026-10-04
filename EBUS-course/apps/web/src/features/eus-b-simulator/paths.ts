import { resolveCourseAssetPath } from '@/lib/assets';

const CASE_ROOT = '/simulator/eus-b-case-001';
export const EUS_CASE_MANIFEST = 'case_manifest.json';

/**
 * URL of a case file. Files other than the manifest keep their names across rebuilds, so they
 * carry a version taken from the manifest: a rebuilt case is then never mixed with cached files.
 */
export function eusCaseAssetUrl(assetPath: string, version?: string): string {
  const url = resolveCourseAssetPath(`${CASE_ROOT}/${assetPath.replace(/^\/+/, '')}`);
  return version ? `${url}?v=${encodeURIComponent(version.slice(0, 12))}` : url;
}
