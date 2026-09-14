import { EMPTY_EBUS_OBSERVATION, type EbusObservation } from '@/lib/ebus-guided-bridge'
import {
  LINKED_LANDMARKS,
  linkedTaskId,
  type LinkedLesson,
  type LinkedVariant,
} from '@/lib/ebus-linked-contract'
export function acquired(lesson: LinkedLesson, variant: LinkedVariant = 'guided'): EbusObservation {
  const source = {
    sessionId: 'test-acquisition-session',
    taskId: linkedTaskId(lesson, variant),
    taskVersion: 2 as const,
    variant,
    caseId: 'case-001' as const,
    modelRevision: 'guided-models-1',
    geometrySha256: 'a'.repeat(64),
    acousticSha256: 'b'.repeat(64),
    presetKey: 'test-preset',
    frameId: 'test-frame',
    renderSequence: 25,
    pose: {
      originLps: [0, 0, 1200] as [number, number, number],
      depthAxisLps: [1, 0, 0] as [number, number, number],
      lateralAxisLps: [0, 0, 1] as [number, number, number],
    },
    settings: {
      depthMm: 40,
      gainDb: 0,
      contactQuality: 1,
      sectorAngleDeg: 60,
      frequencyMHz: 7.5,
      tgcDb: [0, 12, 24] as [number, number, number],
    },
    scope: { roll: 0, flexion: 0, advanceMm: 40, approach: 'rms' as const },
  }
  const sweep = {
    phase: 'complete' as const,
    lastRoll: -60,
    lastFrameId: 'edge-frame',
    direction: -1,
    outside: true,
    samples: 12,
    span: 80,
    startRoll: 20,
  }
  return {
    ...EMPTY_EBUS_OBSERVATION,
    ready: true,
    frameReady: true,
    actionCount: 25,
    lastAction: lesson === 'acoustic-contact' ? 'flexion' : 'roll',
    usedControls: lesson === 'acoustic-contact' ? ['flexion'] : ['roll'],
    contactQuality: 1,
    targetVisible: true,
    linked: {
      assetsReady: true,
      modelRevision: source.modelRevision,
      selectedStructure: '',
      identifiedStructures: [...LINKED_LANDMARKS[lesson]],
      modelSectionViewed: true,
      approach: 'rms',
      scannedApproaches: ['rms', 'lms'],
      sweeps: { rms: sweep, lms: sweep, default: sweep },
      frameId: source.frameId,
      baselineFrameId: 'initial-frame',
      source,
    },
  }
}
