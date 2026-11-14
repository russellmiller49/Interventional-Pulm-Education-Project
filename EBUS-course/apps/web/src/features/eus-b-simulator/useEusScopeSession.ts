import { useCallback, useMemo, useState } from 'react';
import type { AcousticPose } from '@bronchoscopy-core/acoustic';
import type { Point3 } from '@bronchoscopy-core/frame';

import { DEFAULT_EUS_CONTROLS, eusLabelAt } from './eusAcoustic';
import {
  clamp,
  computeEusPose,
  FLEX_MAX_DEG,
  FLEX_MIN_DEG,
  normalizeRollDeg,
  scopeShaftPolyline,
  type EusPose,
} from './eusPose';
import type {
  EusAcousticVolume,
  EusCaseManifest,
  EusLandmarkPose,
  EusPathLevel,
  EusScopePath,
  EusScopeState,
  EusStructure,
} from './types';

/** RGB per label id, or null where a label is never tinted. */
export type EusSessionLabelColors = Array<[number, number, number] | null>;

export type EusScopeChange =
  | Partial<EusScopeState>
  | ((current: EusScopeState) => Partial<EusScopeState>);

/**
 * One scope movement applied to a position: the change is merged, then the position is kept on
 * the path, the rotation wrapped into (-180, 180] and the tip angle kept within its range.
 */
export function applyScopeChange(
  path: Pick<EusScopePath, 'totalLengthMm'>,
  current: EusScopeState,
  change: EusScopeChange,
): EusScopeState {
  const next = { ...current, ...(typeof change === 'function' ? change(current) : change) };
  return {
    sMm: clamp(next.sMm, 0, path.totalLengthMm),
    rollDeg: normalizeRollDeg(next.rollDeg),
    flexDeg: clamp(next.flexDeg, FLEX_MIN_DEG, FLEX_MAX_DEG),
  };
}

/** The named stretch of the path a position lies in. */
export function eusLevelAt(manifest: EusCaseManifest, sMm: number): EusPathLevel {
  const levels = manifest.path.levels;
  return (
    levels.find((level) => sMm >= level.fromSMm && sMm < level.toSMm) ?? levels[levels.length - 1]
  );
}

export function eusHexToRgb(color: string): [number, number, number] {
  return [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16)) as [number, number, number];
}

export interface EusCaseData {
  manifest: EusCaseManifest | null;
  path: EusScopePath | null;
  volume: EusAcousticVolume | null;
}

export interface EusScopeSession {
  scope: EusScopeState;
  move: (change: EusScopeChange) => void;
  /** Put the scope at a position and leave the image controls alone. */
  reset: (pose: EusScopeState) => void;
  pose: EusPose | null;
  acousticPose: AcousticPose | null;
  shaftLps: Point3[];
  depthMm: number;
  setDepthMm: (depthMm: number) => void;
  gainDb: number;
  setGainDb: (gainDb: number) => void;
  structures: Map<string, EusStructure>;
  labelIds: Map<string, number>;
  labelColors: EusSessionLabelColors;
  /** Key of the named structure at a point in patient space, or null. */
  structureAt: (point: Point3) => string | null;
  landmarkPoses: Map<string, EusLandmarkPose>;
}

/**
 * The scope's position, the image controls, and what follows from them for one case: where the
 * transducer is, which way it faces, and the lookups every view needs. It draws nothing.
 */
export function useEusScopeSession(
  { manifest, path, volume }: EusCaseData,
  initial: EusScopeState,
): EusScopeSession {
  const [scope, setScope] = useState<EusScopeState>(initial);
  const [depthMm, setDepthMm] = useState(
    manifest?.probe.defaultDepthMm ?? DEFAULT_EUS_CONTROLS.depthMm,
  );
  const [gainDb, setGainDb] = useState(DEFAULT_EUS_CONTROLS.gainDb);

  const move = useCallback(
    (change: EusScopeChange) => {
      if (!path) return;
      setScope((current) => applyScopeChange(path, current, change));
    },
    [path],
  );
  const reset = useCallback(
    (pose: EusScopeState) => setScope(path ? applyScopeChange(path, pose, {}) : pose),
    [path],
  );

  const pose = useMemo(() => (path ? computeEusPose(path, scope) : null), [path, scope]);
  const shaftLps = useMemo(
    () => (path && pose ? scopeShaftPolyline(path, pose, scope.sMm) : []),
    [path, pose, scope.sMm],
  );
  const acousticPose = useMemo<AcousticPose | null>(
    () =>
      pose && {
        originLps: pose.originLps,
        depthAxisLps: pose.depthAxisLps,
        lateralAxisLps: pose.lateralAxisLps,
      },
    [pose],
  );

  const structures = useMemo(
    () => new Map((manifest?.structures ?? []).map((structure) => [structure.key, structure])),
    [manifest],
  );
  const labelIds = useMemo(
    () => new Map((volume?.metadata.labels ?? []).map((label) => [label.key, label.id])),
    [volume],
  );
  const labelColors = useMemo<EusSessionLabelColors>(() => {
    if (!manifest || !volume) return [];
    const colors = new Map(manifest.structures.map((s) => [s.key, eusHexToRgb(s.color)]));
    return volume.metadata.labels.map((label) =>
      label.reportable ? (colors.get(label.key) ?? null) : null,
    );
  }, [manifest, volume]);
  const structureAt = useCallback(
    (point: Point3) => {
      if (!volume) return null;
      const label = volume.metadata.labels[eusLabelAt(volume, ...point)];
      return label?.reportable ? label.key : null;
    },
    [volume],
  );
  const landmarkPoses = useMemo(
    () => new Map((manifest?.landmarks ?? []).map((landmark) => [landmark.key, landmark])),
    [manifest],
  );

  return {
    scope,
    move,
    reset,
    pose,
    acousticPose,
    shaftLps,
    depthMm,
    setDepthMm,
    gainDb,
    setGainDb,
    structures,
    labelIds,
    labelColors,
    structureAt,
    landmarkPoses,
  };
}
