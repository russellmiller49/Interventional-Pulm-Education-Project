import { resolveCourseAssetPath } from '@/lib/assets';

const CASE_ROOT = '/simulator/case-001';
const DEFAULT_SIMULATOR_MANIFEST = 'case_manifest.simplified.web.json';

export function simulatorCaseAssetUrl(assetPath: string): string {
  return resolveCourseAssetPath(`${CASE_ROOT}/${assetPath.replace(/^\/+/, '')}`);
}

export function simulatorManifestUrl(): string {
  return simulatorCaseAssetUrl(DEFAULT_SIMULATOR_MANIFEST);
}
