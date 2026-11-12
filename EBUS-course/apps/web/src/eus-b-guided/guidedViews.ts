import type {
  EusAcousticVolume,
  EusCaseManifest,
  EusScopePath,
  EusScopeState,
} from '@/features/eus-b-simulator/types';
import { applyScopeChange } from '@/features/eus-b-simulator/useEusScopeSession';
import type { EusbLabSpec, EusbStart } from '../../../../../src/lib/eus-b-guided-contract';

/**
 * Views that exist only for the guided course, by key. The case's own landmark views come first;
 * a key listed here is used when the case has no view of that name.
 */
export const GUIDED_ONLY_VIEWS: Readonly<Record<string, EusScopeState>> = {};

/** Scope position of a named view, or null when neither the case nor the course has it. */
export function viewPose(manifest: EusCaseManifest, key: string): EusScopeState | null {
  const landmark = manifest.landmarks.find((entry) => entry.key === key);
  if (landmark)
    return { sMm: landmark.sMm, rollDeg: landmark.rollDeg, flexDeg: landmark.flexDeg };
  return Object.prototype.hasOwnProperty.call(GUIDED_ONLY_VIEWS, key)
    ? GUIDED_ONLY_VIEWS[key]
    : null;
}

/** Where a lab starts: a named view, optionally moved from it, or a fixed position. */
export function resolveStart(
  manifest: EusCaseManifest,
  path: Pick<EusScopePath, 'totalLengthMm'>,
  start: EusbStart,
): EusScopeState | null {
  if ('pose' in start) return applyScopeChange(path, start.pose, {});
  const view = viewPose(manifest, start.view);
  if (!view) return null;
  const offset = start.offset ?? {};
  return applyScopeChange(path, view, {
    sMm: view.sMm + (offset.sMm ?? 0),
    rollDeg: view.rollDeg + (offset.rollDeg ?? 0),
    flexDeg: view.flexDeg + (offset.flexDeg ?? 0),
  });
}

export interface GuidedTarget {
  key: string;
  /** The view in which the target is shown at its best. */
  pose: EusScopeState;
  /** The target's id in the label volume. */
  labelId: number;
}

/** The structure a lab asks for: its view and its label. A view key is also its structure key. */
export function resolveTarget(
  manifest: EusCaseManifest,
  volume: EusAcousticVolume,
  path: Pick<EusScopePath, 'totalLengthMm'>,
  key: string,
): GuidedTarget | null {
  const view = viewPose(manifest, key);
  const label = volume.metadata.labels.find((entry) => entry.key === key);
  if (!view || !label) return null;
  return { key, pose: applyScopeChange(path, view, {}), labelId: label.id };
}

/**
 * The picture a lab shows when it is reviewed without an image of the learner's own: the target's
 * view for a lab that asks for one, the start for the rest.
 */
export function labReviewPose(
  manifest: EusCaseManifest,
  path: Pick<EusScopePath, 'totalLengthMm'>,
  lab: EusbLabSpec,
): EusScopeState | null {
  if ((lab.kind === 'reach' || lab.kind === 'rotate') && lab.target) {
    const view = viewPose(manifest, lab.target);
    if (view) return applyScopeChange(path, view, {});
  }
  return resolveStart(manifest, path, lab.start);
}
