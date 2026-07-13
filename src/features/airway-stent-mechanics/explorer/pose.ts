import { isStentExplorerStationId } from './routing'
import {
  getStentExplorerArchitectureProfile,
  hasExplorerArchitectureCover,
  hasUncoveredBodyCells,
  isMetallicExplorerArchitecture,
  stentExplorerArchitectureProfiles,
} from './architectures'
import type {
  StentExplorerArchitectureId,
  StentExplorerPose,
  StentExplorerStationId,
  StentMechanicsModifiers,
} from './types'

const architectureIds = new Set<StentExplorerArchitectureId>(
  stentExplorerArchitectureProfiles.map((profile) => profile.id),
)

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000

function smoothstep(value: number): number {
  const progress = clamp01(value)
  return progress * progress * (3 - 2 * progress)
}

function lateProgress(progress: number, start: number): number {
  return smoothstep((progress - start) / (1 - start))
}

function isContinuousWallArchitecture(architectureId: StentExplorerArchitectureId): boolean {
  return (
    architectureId === 'solid-silicone' ||
    architectureId === 'silicone-y' ||
    architectureId === 'dynamic-y'
  )
}

function createNeutralPose(): StentExplorerPose {
  return {
    airwayCompression: 0,
    axialExcursion: 0,
    axialScale: 1,
    bend: 0,
    branchCompromise: 0,
    coverFailure: 0,
    deployment: 0,
    fracture: 0,
    granulation: 0,
    kink: 0,
    migration: 0,
    mucus: 0,
    posteriorMotion: 0,
    radialCompression: 0,
    tumorIngrowth: 0,
    tumorOvergrowth: 0,
  }
}

function normalizePose(pose: StentExplorerPose): StentExplorerPose {
  const normalized = { ...pose }

  for (const key of Object.keys(normalized) as Array<keyof StentExplorerPose>) {
    const value = normalized[key]
    if (!Number.isFinite(value)) {
      throw new Error(`Explorer pose field ${key} must be finite.`)
    }
    normalized[key] = round(
      key === 'axialScale' ? Math.min(1.3, Math.max(0.7, value)) : clamp01(value),
    )
  }

  return normalized
}

/**
 * Produces deterministic qualitative state for the shared explorer scene.
 *
 * `axialScale` is an absolute relative-length scale: 1 is neutral, lower values
 * depict qualitative shortening, and higher values depict qualitative lengthening.
 * `deployment` runs from 0 constrained
 * to 1 deployed. Every other field is a normalized effect amplitude with 0 as
 * its neutral state. No field represents force, pressure, probability, airflow,
 * a clinical threshold, or patient-specific performance.
 */
export function getStentExplorerPose(
  stationId: StentExplorerStationId,
  architectureId: StentExplorerArchitectureId,
  rawProgress: number,
): StentExplorerPose {
  if (!isStentExplorerStationId(stationId)) {
    throw new Error(`Unknown stent explorer station: ${stationId}`)
  }
  if (!architectureIds.has(architectureId)) {
    throw new Error(`Unknown stent explorer architecture: ${architectureId}`)
  }
  if (!Number.isFinite(rawProgress)) {
    throw new TypeError('Explorer progress must be a finite number.')
  }

  const progress = clamp01(rawProgress)
  const eased = smoothstep(progress)
  const architecture = getStentExplorerArchitectureProfile(architectureId)
  const calibration = architecture.visualCalibration
  const pulse = Math.sin(Math.PI * progress) ** 4
  // Preserve a representative loaded pose at the end of the scrubber so the
  // final/reduced-motion state does not erase the architecture comparison.
  const coughMotion = Math.max(pulse, 0.72 * lateProgress(progress, 0.55))
  const pose = createNeutralPose()

  switch (stationId) {
    case 'architecture-lumen': {
      const modeledWallFraction = isContinuousWallArchitecture(architectureId)
        ? architectureId === 'dynamic-y'
          ? 0.2
          : 0.3
        : 0.11
      pose.radialCompression = modeledWallFraction * eased
      pose.airwayCompression = modeledWallFraction * 0.72 * eased
      break
    }

    case 'metal-architecture': {
      const imposedLoad = Math.sin(Math.PI * progress) ** 2
      const release = lateProgress(progress, 0.55)
      const retainedSet =
        architecture.materialBehavior === 'balloon-set' ? 0.58 * release : 0.08 * release
      const deformation = Math.max(imposedLoad, retainedSet)
      pose.deployment = 1
      pose.axialScale = 1 + 0.2 * calibration.axialCoupling * deformation
      pose.axialExcursion = 0.2 * calibration.twistGain * deformation
      pose.bend = 0.58 * calibration.bendGain * deformation
      pose.radialCompression = 0.42 * calibration.ovalizationGain * deformation
      pose.airwayCompression = 0.26 * calibration.ovalizationGain * deformation
      break
    }

    case 'cough-motion':
      if (isMetallicExplorerArchitecture(architectureId)) {
        pose.axialScale = 1 + 0.21 * calibration.axialCoupling * coughMotion
        pose.axialExcursion = (0.28 + calibration.axialCoupling * 0.32) * coughMotion
        pose.bend = (0.08 + calibration.bendGain * 0.12) * coughMotion
        pose.radialCompression = 0.1 * calibration.ovalizationGain * coughMotion
      } else {
        pose.axialScale = 1
        pose.axialExcursion = 0.38 * coughMotion
        pose.bend = 0.34 * coughMotion
        pose.kink = 0.1 * coughMotion
        pose.posteriorMotion = architectureId === 'dynamic-y' ? 0.45 * coughMotion : 0
      }
      break

    case 'curve-buckle':
      pose.bend =
        (isContinuousWallArchitecture(architectureId) ? 0.72 : 0.38 + calibration.bendGain * 0.3) *
        eased
      pose.kink =
        (isContinuousWallArchitecture(architectureId)
          ? 0.88
          : 0.12 + calibration.ovalizationGain * 0.14) * eased
      pose.radialCompression =
        (isContinuousWallArchitecture(architectureId)
          ? 0.74
          : 0.18 + calibration.ovalizationGain * 0.18) * eased
      pose.airwayCompression =
        (isContinuousWallArchitecture(architectureId)
          ? 0.68
          : 0.16 + calibration.ovalizationGain * 0.16) * eased
      pose.branchCompromise = (isContinuousWallArchitecture(architectureId) ? 0.58 : 0.24) * eased
      break

    case 'migration': {
      pose.radialCompression = 0.24 * eased
      // Architecture changes the rendered construction, not the displacement
      // amplitude. The scene does not encode a family-level migration ranking.
      pose.migration = 0.82 * eased
      pose.branchCompromise = 0.42 * eased
      break
    }

    case 'mucus-obstruction':
      pose.mucus = 0.96 * eased
      pose.airwayCompression = 0.8 * eased ** 1.35
      pose.branchCompromise =
        (architectureId === 'silicone-y' || architectureId === 'metallic-y' ? 0.5 : 0.26) * eased
      break

    case 'granulation':
      pose.granulation = 0.9 * eased ** 1.25
      pose.airwayCompression = 0.66 * eased ** 1.4
      pose.axialExcursion = 0.16 * eased
      pose.mucus = 0.2 * eased
      break

    case 'tumor-ingrowth-overgrowth':
      if (hasUncoveredBodyCells(architectureId)) {
        pose.tumorIngrowth = 0.94 * eased
        pose.tumorOvergrowth = 0.2 * eased
      } else if (architecture.coverage === 'partially-covered') {
        // The covered mid-body remains intact by default. Exposed-end-cell
        // ingrowth is enabled separately from an explicit cover defect.
        pose.tumorIngrowth = 0
        pose.tumorOvergrowth = 0.48 * eased
      } else {
        // A cover redirects this generic pathway; it is not modeled as absolute protection.
        pose.tumorIngrowth = 0
        pose.tumorOvergrowth = 0.9 * eased
      }
      pose.airwayCompression = 0.7 * eased ** 1.3
      break

    case 'fracture-cover-failure': {
      const failureProgress = lateProgress(progress, 0.34)
      // Tortuosity is part of the starting anatomy; progress adds repeated loading and failure.
      pose.bend = 0.46 + 0.16 * eased
      if (isMetallicExplorerArchitecture(architectureId)) {
        pose.fracture = 0.92 * failureProgress
        pose.coverFailure = hasExplorerArchitectureCover(architectureId)
          ? 0.84 * failureProgress
          : 0
      } else {
        pose.kink = 0.48 * failureProgress
      }
      pose.airwayCompression = 0.48 * failureProgress
      break
    }

    case 'y-stent': {
      const isYArchitecture =
        architectureId === 'silicone-y' ||
        architectureId === 'dynamic-y' ||
        architectureId === 'metallic-y'
      const mismatchGain = isYArchitecture ? 1 : 0.55
      pose.bend = 0.35 * mismatchGain * eased
      pose.posteriorMotion =
        (architectureId === 'dynamic-y' ? 0.78 : 0.38) * (0.35 * eased + 0.65 * pulse)
      pose.branchCompromise = 0.76 * mismatchGain * eased
      pose.kink = (architectureId === 'silicone-y' ? 0.46 : 0.25) * eased
      pose.mucus = 0.36 * mismatchGain * eased
      break
    }

    case 'deploy-rescue':
      pose.deployment = eased
      pose.axialScale = isMetallicExplorerArchitecture(architectureId)
        ? 1 + 0.18 * calibration.axialCoupling * (1 - eased)
        : 1
      pose.radialCompression = 0.42 * (1 - eased)
      pose.branchCompromise = 0.16 * eased
      break

    default: {
      const exhaustiveStation: never = stationId
      throw new Error(`Unhandled stent explorer station: ${exhaustiveStation}`)
    }
  }

  return normalizePose(pose)
}

/**
 * Separates fixed airway anatomy from device deformation. A curved or tortuous
 * airway is present before animation; device kink, migration, and tissue effects
 * never deform the airway wall itself.
 */
export function getStentExplorerAirwayPose(
  stationId: StentExplorerStationId,
  devicePose: StentExplorerPose,
  modifiers?: StentMechanicsModifiers,
): StentExplorerPose {
  const controlledCurvature = modifiers?.curvature ?? 0.75
  const fixedAirwayBend =
    stationId === 'curve-buckle'
      ? 0.25 + controlledCurvature * 0.7
      : stationId === 'fracture-cover-failure'
        ? 0.3 + controlledCurvature * 0.5
        : stationId === 'cough-motion'
          ? controlledCurvature * 0.35
          : 0

  return normalizePose({
    ...devicePose,
    airwayCompression: 0,
    axialExcursion: 0,
    axialScale: 1,
    bend: fixedAirwayBend,
    branchCompromise: 0,
    coverFailure: 0,
    deployment: 1,
    fracture: 0,
    granulation: 0,
    kink: 0,
    migration: 0,
    mucus: 0,
    posteriorMotion: 0,
    radialCompression: 0,
    tumorIngrowth: 0,
    tumorOvergrowth: 0,
  })
}

/** Applies station-local qualitative controls to the scripted animation pose. */
export function applyStentMechanicsModifiers(
  stationId: StentExplorerStationId,
  pose: StentExplorerPose,
  modifiers?: StentMechanicsModifiers,
): StentExplorerPose {
  if (!modifiers) return pose

  const next = { ...pose }
  const consequenceProgress = Math.max(
    pose.airwayCompression,
    pose.branchCompromise,
    pose.coverFailure,
    pose.deployment,
    pose.fracture,
    pose.granulation,
    pose.migration,
    pose.mucus,
    pose.tumorIngrowth,
    pose.tumorOvergrowth,
    1 - pose.axialScale,
  )

  switch (stationId) {
    case 'architecture-lumen':
      next.radialCompression = Math.max(next.radialCompression, modifiers.wallOccupancy * 0.3)
      break
    case 'metal-architecture': {
      const amplitude = 0.2 + modifiers.constraintAmplitude * 0.8
      const radialWeight = modifiers.radialConstraint
      const bendWeight = modifiers.bendConstraint
      const ovalWeight = modifiers.ovalConstraint

      next.axialScale = 1 - (1 - next.axialScale) * amplitude * (0.2 + radialWeight * 0.8)
      next.axialExcursion *= amplitude * (0.25 + radialWeight * 0.75)
      next.bend *= amplitude * (0.15 + bendWeight * 0.85)
      next.radialCompression *= amplitude * (0.12 + radialWeight * 0.53 + ovalWeight * 0.35)
      next.airwayCompression *= amplitude * (0.15 + ovalWeight * 0.85)
      break
    }
    case 'cough-motion': {
      const amplitude = 0.2 + modifiers.motionAmplitude * 0.8
      next.axialExcursion *= amplitude
      next.axialScale = 1 - (1 - next.axialScale) * amplitude
      next.bend = next.bend * amplitude + modifiers.curvature * 0.16
      next.kink *= amplitude
      break
    }
    case 'curve-buckle':
      next.bend *= 0.35 + modifiers.curvature * 0.9
      next.kink *= 0.2 + modifiers.curvature * 0.8
      next.airwayCompression *= 0.25 + modifiers.airwayCompression * 0.75
      next.branchCompromise *= 0.25 + modifiers.branchProximity * 0.75
      break
    case 'migration': {
      const displacement = Math.max(
        modifiers.proximalDisplacement,
        modifiers.distalDisplacement,
        modifiers.appositionLoss,
      )
      next.migration *= 0.2 + displacement * 0.8
      next.radialCompression *= 0.25 + modifiers.appositionLoss * 0.75
      break
    }
    case 'mucus-obstruction':
      next.mucus *= 0.2 + modifiers.secretionBurden * 0.8
      next.mucus += modifiers.retentionPocket * consequenceProgress * 0.18
      next.airwayCompression *= 0.25 + modifiers.obstructionExtent * 0.75
      break
    case 'granulation': {
      const contributorSignal =
        (modifiers.endContact +
          modifiers.relativeMotion +
          modifiers.biologicContext +
          modifiers.secretoryInfectiousContext) /
        4
      next.granulation *= 0.2 + contributorSignal * 0.8
      next.axialExcursion = Math.max(
        next.axialExcursion,
        modifiers.relativeMotion * consequenceProgress * 0.16,
      )
      next.mucus = Math.max(
        next.mucus,
        modifiers.secretoryInfectiousContext * consequenceProgress * 0.32,
      )
      break
    }
    case 'tumor-ingrowth-overgrowth': {
      const extent = 0.2 + modifiers.obstructionExtent * 0.8
      if (modifiers.exposedEndIngrowth > 0) {
        next.tumorIngrowth = modifiers.exposedEndIngrowth * consequenceProgress * extent * 0.72
      } else if (modifiers.tumorIngrowth > 0 && next.tumorIngrowth > 0) {
        // An uncovered body already has a scripted open-cell pathway.
        next.tumorIngrowth *= extent
      } else if (modifiers.tumorIngrowth > 0 && modifiers.coverFailure > 0.01) {
        // A covered or partially covered body requires an explicit defect.
        next.tumorIngrowth =
          modifiers.tumorIngrowth * modifiers.coverFailure * consequenceProgress * extent * 0.58
      } else {
        next.tumorIngrowth = 0
      }
      next.tumorOvergrowth =
        modifiers.tumorOvergrowth > 0
          ? Math.max(next.tumorOvergrowth, consequenceProgress * 0.82) * extent
          : 0
      next.coverFailure = modifiers.coverFailure * consequenceProgress
      break
    }
    case 'fracture-cover-failure': {
      const loading = 0.25 + modifiers.repeatedLoading * 0.75
      next.bend = Math.max(next.bend, 0.32 + modifiers.curvature * 0.36)
      next.fracture *= modifiers.fracture * loading
      next.coverFailure *= modifiers.coverFailure * loading
      break
    }
    case 'y-stent':
      next.bend *= 0.25 + modifiers.saddleMismatch * 0.75
      next.branchCompromise *=
        0.2 + modifiers.branchAngleMismatch * 0.4 + modifiers.distalOrificeCompromise * 0.4
      next.posteriorMotion *= 0.25 + modifiers.posteriorMotion * 0.75
      next.mucus *= 0.35 + modifiers.saddleMismatch * 0.65
      break
    case 'deploy-rescue':
      next.deployment = Math.max(next.deployment, modifiers.deployment)
      next.radialCompression = Math.max(
        next.radialCompression,
        modifiers.incompleteExpansion * (1 - next.deployment * 0.65) * 0.7,
      )
      next.branchCompromise *= 0.25 + modifiers.repositioningConstraint * 0.75
      break
  }

  return normalizePose(next)
}
