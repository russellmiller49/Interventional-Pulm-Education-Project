import type { EusAcousticFrame } from '@/features/eus-b-simulator/eusAcoustic';
import { insertionDepthCm } from '@/features/eus-b-simulator/eusPose';
import type {
  EusAcousticVolume,
  EusCaseManifest,
  EusScopeState,
} from '@/features/eus-b-simulator/types';
import { eusLevelAt } from '@/features/eus-b-simulator/useEusScopeSession';
import {
  eusbFrameId,
  type EusbHeld,
  type EusbObservation,
} from '../../../../../src/lib/eus-b-guided-bridge';
import type { EusbControl } from '../../../../../src/lib/eus-b-guided-contract';
import { reachHeldMs, type ReachState } from './guidedTask';
import { structuresInView } from './visibleArea';

/** What one drawn image shows: travels with the render request and comes back with its frame. */
export interface GuidedFrameTag {
  /** The lab and session the image was asked for. */
  labKey: string;
  phase: 'work' | 'review';
  scope: EusScopeState;
  depthMm: number;
  gainDb: number;
}

export function sameImage(
  tag: Pick<GuidedFrameTag, 'scope' | 'depthMm' | 'gainDb'>,
  scope: EusScopeState,
  depthMm: number,
  gainDb: number,
) {
  return (
    tag.scope.sMm === scope.sMm &&
    tag.scope.rollDeg === scope.rollDeg &&
    tag.scope.flexDeg === scope.flexDeg &&
    tag.depthMm === depthMm &&
    tag.gainDb === gainDb
  );
}

/** The image a frame tag stands for, as the bridge carries it. */
export function heldImage(
  manifest: Pick<EusCaseManifest, 'caseId' | 'assetVersion'>,
  tag: Pick<GuidedFrameTag, 'scope' | 'depthMm' | 'gainDb'>,
  source: EusbHeld['source'],
): EusbHeld {
  return {
    pose: { ...tag.scope },
    depthMm: tag.depthMm,
    gainDb: tag.gainDb,
    frameId: eusbFrameId(manifest.caseId, manifest.assetVersion, tag.scope, tag.depthMm, tag.gainDb),
    source,
  };
}

export interface ObservationInput {
  labId: string;
  labKey: string;
  manifest: EusCaseManifest;
  volume: EusAcousticVolume;
  scope: EusScopeState;
  depthMm: number;
  gainDb: number;
  /** The newest drawn frame and what it was drawn for, or null before the first one. */
  frame: EusAcousticFrame | null;
  frameTag: GuidedFrameTag | null;
  usedControls: readonly EusbControl[];
  actionCount: number;
  lastAction: EusbControl | '';
  /** The lab's target and the state of its task, when it has one. */
  target: { key: string; reach: ReachState } | null;
  now: number;
}

/** Everything the lesson page is told about the lab at one moment. */
export function buildObservation(input: ObservationInput): EusbObservation {
  const { manifest, scope, frame, frameTag } = input;
  const drawn = frame && frameTag && frameTag.labKey === input.labKey ? frameTag : null;
  const frameReady = !!drawn && sameImage(drawn, scope, input.depthMm, input.gainDb);
  const observation: EusbObservation = {
    labId: input.labId,
    ready: true,
    frameReady,
    pose: { ...scope },
    level: eusLevelAt(manifest, scope.sMm).key,
    region: scope.sMm >= manifest.path.gejSMm ? 'stomach' : 'esophagus',
    depthCm: insertionDepthCm(scope.sMm, manifest.path.incisorOffsetMm),
    depthMm: input.depthMm,
    gainDb: input.gainDb,
    frameId: drawn
      ? eusbFrameId(manifest.caseId, manifest.assetVersion, drawn.scope, drawn.depthMm, drawn.gainDb)
      : '',
    usedControls: [...input.usedControls],
    actionCount: input.actionCount,
    lastAction: input.lastAction,
    inView: frame && drawn ? structuresInView(frame, input.volume) : [],
    panes: ['ultrasound'],
  };
  if (input.target) {
    const { key, reach } = input.target;
    observation.target = {
      key,
      areaRatio: Math.min(1000, Math.max(0, reach.areaRatio)),
      heldMs: reachHeldMs(reach, input.now),
      found: reach.found,
      ...(reach.found && reach.foundAt ? { foundAt: reach.foundAt } : {}),
    };
  }
  return observation;
}
