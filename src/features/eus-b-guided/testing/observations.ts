import { EMPTY_EUSB_OBSERVATION, type EusbObservation } from '@/lib/eus-b-guided-bridge'
import { eusbLab, type EusbLabId } from '@/lib/eus-b-guided-contract'

/** A lab that is drawn and waiting: nothing held yet. */
export function searching(labId: EusbLabId): EusbObservation {
  const lab = eusbLab(labId)
  return {
    ...EMPTY_EUSB_OBSERVATION,
    labId,
    ready: true,
    frameReady: true,
    pose: { sMm: 173, rollDeg: -39, flexDeg: 0 },
    level: 'left_atrium',
    depthCm: 35,
    frameId: 'eus-b-case-001:eus-b-v3:173:-39:0:50:0',
    panes: ['ultrasound'],
    target: lab.target ? { key: lab.target, areaRatio: 0.05, heldMs: 0, found: false } : undefined,
  }
}

/** A mark-the-landmarks lab with some landmarks clicked and some shown at the learner's request. */
export function marking(
  labId: EusbLabId,
  keys: string[] = [],
  shownKeys: string[] = [],
  wrong = 0,
): EusbObservation {
  return {
    ...searching(labId),
    target: undefined,
    identified: { keys, shown: shownKeys, wrong },
  }
}

/** The same lab after the learner asked to be shown the view and the lab drove the scope to it. */
export function shown(labId: EusbLabId): EusbObservation {
  const lab = eusbLab(labId)
  const pose = { sMm: 259, rollDeg: 45, flexDeg: 0 }
  const frameId = 'eus-b-case-001:eus-b-v3:259:45:0:50:0'
  return {
    ...searching(labId),
    pose,
    level: 'stomach',
    region: 'stomach',
    depthCm: 43,
    frameId,
    panes: ['ultrasound', 'endoscope'],
    inView: [{ key: lab.target ?? 'liver', fraction: 0.8 }],
    target: lab.target
      ? {
          key: lab.target,
          areaRatio: 0,
          heldMs: 0,
          found: false,
          shown: true,
          shownAt: { pose, depthMm: 50, gainDb: 0, frameId, source: 'reference' },
        }
      : undefined,
  }
}

/** The same lab after the learner held its target for the full second. */
export function held(labId: EusbLabId): EusbObservation {
  const lab = eusbLab(labId)
  const pose = { sMm: 259, rollDeg: 45, flexDeg: 0 }
  const frameId = 'eus-b-case-001:eus-b-v3:259:45:0:50:0'
  return {
    ...searching(labId),
    pose,
    level: 'stomach',
    region: 'stomach',
    depthCm: 43,
    frameId,
    usedControls: ['advance', 'rotate'],
    actionCount: 12,
    lastAction: 'rotate',
    inView: [{ key: lab.target ?? 'liver', fraction: 0.8 }],
    target: lab.target
      ? {
          key: lab.target,
          areaRatio: 0.9,
          heldMs: 1000,
          found: true,
          foundAt: { pose, depthMm: 50, gainDb: 0, frameId, source: 'learner' },
        }
      : undefined,
  }
}
