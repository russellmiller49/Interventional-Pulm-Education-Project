import type { GuidedControlId, GuidedTarget } from '../../engine/types'
import type { StageSurfaceId } from '../stage/stageModel'
import type { EcmoPracticeStage } from './stages'

/**
 * Which monitor surfaces a Practice stage opens beside the console.
 *
 * Declared per stage rather than left open: the brief and plan are read on the circuit and the
 * patient, management on the console and circuit, the reassessment on the monitor and the trends.
 * A prompted machine task or a clue that lives on a surface opens it as well. The learner can
 * open the rest at any time; nothing closes mid-stage.
 */
export function surfacesForStage(
  stage: EcmoPracticeStage,
  extras: readonly GuidedTarget[] = [],
): readonly StageSurfaceId[] {
  const base: StageSurfaceId[] =
    stage === 'brief'
      ? ['circuit']
      : stage === 'plan'
        ? ['circuit', 'monitor']
        : stage === 'manage'
          ? ['circuit']
          : ['monitor', 'trends']
  for (const target of extras) {
    const surface = surfaceForTarget(target)
    if (surface && !base.includes(surface)) base.push(surface)
  }
  return base
}

export function surfaceForTarget(target: GuidedTarget | null | undefined): StageSurfaceId | null {
  switch (target) {
    case 'circuit':
      return 'circuit'
    case 'gas-panel':
      return 'gas'
    case 'patient-monitor':
      return 'monitor'
    case 'trend-panel':
      return 'trends'
    default:
      return null
  }
}

export function surfaceForControl(controlId: GuidedControlId | string): StageSurfaceId | null {
  switch (controlId) {
    case 'cardiohelp-circuit-panel':
    case 'cardiohelp-circuit-check':
    case 'cardiohelp-clamp-drainage':
    case 'cardiohelp-clamp-return':
    case 'cardiohelp-resume-support':
      return 'circuit'
    case 'cardiohelp-gas-panel':
    case 'cardiohelp-sweep-control':
    case 'cardiohelp-fio2-control':
    case 'cardiohelp-restore-gas-source':
      return 'gas'
    case 'cardiohelp-patient-monitor':
      return 'monitor'
    case 'cardiohelp-trend-panel':
      return 'trends'
    default:
      return null
  }
}
