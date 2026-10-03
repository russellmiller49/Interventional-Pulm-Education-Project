import { resolveCourseAssetPath } from '@/lib/assets';

const CASE_ROOT = '/simulator/eus-b-case-001';
export const EUS_CASE_MANIFEST = 'case_manifest.json';

export function eusCaseAssetUrl(assetPath: string): string {
  return resolveCourseAssetPath(`${CASE_ROOT}/${assetPath.replace(/^\/+/, '')}`);
}
