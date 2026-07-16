import { getArchitectureProfile, supportsLoadMode } from '../content/architectureRegistry'
import type {
  AnimationProgressInput,
  BraidKinematicsInput,
  BraidKinematicsResult,
  LoadFrame,
  StentArchitectureId,
  StentArchitectureProfile,
  StentLoadMode,
} from './learningLabTypes'

const TWO_PI = Math.PI * 2

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

const round = (value: number, digits = 6) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function requireFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`)
  }
}

export function clampLoadProgress(progress: number): number {
  requireFinite(progress, 'Load progress')
  return clamp(progress, 0, 1)
}

function smoothstep(progress: number): number {
  return progress * progress * (3 - 2 * progress)
}

function resolveProfile(
  architecture?: StentArchitectureId | StentArchitectureProfile,
): StentArchitectureProfile | undefined {
  if (!architecture) return undefined
  return typeof architecture === 'string' ? getArchitectureProfile(architecture) : architecture
}

const loadCaptions: Record<StentLoadMode, string> = {
  rest: 'Unloaded reference pose. The schematic is not a device specification.',
  radial:
    'Amplified radial motion shows diameter-length coupling; resistance and tissue pressure are not calculated.',
  bend: 'Amplified centerline bending reveals conformity, straightening, end loading, and local lumen loss.',
  ovalization:
    'Amplified one-sided deformation exposes minor-axis lumen loss under an eccentric constraint.',
  breathing:
    'Amplified slow cyclic displacement represents breathing motion, not a physiologic pressure waveform.',
  cough: 'An amplified displacement pulse represents cough-like motion, not measured cough force.',
  deployment:
    'Constraint release visibly shows expansion with shortening (foreshortening); it is not a placement simulation.',
}

export type PingPongDirection = -1 | 1

export interface PingPongProgressResult {
  direction: PingPongDirection
  progress: number
}

export function getRepresentativeLoadProgress(mode: StentLoadMode): number {
  switch (mode) {
    case 'rest':
      return 0
    case 'radial':
    case 'ovalization':
      return 0.88
    case 'bend':
      return 0.82
    case 'breathing':
    case 'cough':
      return 0.5
    case 'deployment':
      return 0
  }
}

/**
 * Produces a deterministic, bounded visual pose under an imposed displacement.
 * Values are qualitative and must never be labeled as force, stiffness, pressure,
 * clinical performance, or patient-specific prediction.
 */
export function getLoadFrame(
  mode: StentLoadMode,
  rawProgress: number,
  architecture?: StentArchitectureId | StentArchitectureProfile,
): LoadFrame {
  const progress = clampLoadProgress(rawProgress)
  const profile = resolveProfile(architecture)

  if (profile && !supportsLoadMode(profile, mode)) {
    throw new Error(`${profile.id} does not support the ${mode} load mode.`)
  }

  const calibration = profile?.visualCalibration ?? {
    axialCoupling: 0.5,
    twistGain: 0.75,
    bendGain: 0.8,
    ovalizationGain: 0.8,
  }
  const eased = smoothstep(progress)

  let radialScaleX = 1
  let radialScaleZ = 1
  let axialScale = 1
  let bendRadians = 0
  let twistRadians = 0
  let axialOffset = 0

  switch (mode) {
    case 'radial':
      radialScaleX = 1 - 0.3 * eased
      radialScaleZ = 1 - 0.3 * eased
      axialScale = 1 + 0.18 * calibration.axialCoupling * eased
      twistRadians = 0.08 * calibration.twistGain * eased
      break
    case 'bend':
      bendRadians = 0.82 * calibration.bendGain * eased
      radialScaleX = 1 - 0.08 * calibration.ovalizationGain * eased
      radialScaleZ = 1 + 0.025 * calibration.ovalizationGain * eased
      axialOffset = 0.08 * eased
      break
    case 'ovalization':
      radialScaleX = 1 - 0.42 * calibration.ovalizationGain * eased
      radialScaleZ = 1 + 0.14 * calibration.ovalizationGain * eased
      axialScale = 1 + 0.05 * calibration.axialCoupling * eased
      break
    case 'breathing': {
      const cycle = (1 - Math.cos(TWO_PI * progress)) / 2
      radialScaleX = 1 - 0.13 * cycle
      radialScaleZ = 1 - 0.09 * cycle
      axialScale = 1 + 0.04 * calibration.axialCoupling * cycle
      bendRadians = 0.1 * calibration.bendGain * Math.sin(TWO_PI * progress)
      break
    }
    case 'cough': {
      const impulse = Math.sin(Math.PI * progress) ** 4
      radialScaleX = 1 - 0.3 * impulse
      radialScaleZ = 1 - 0.22 * impulse
      axialScale = 1 + 0.11 * calibration.axialCoupling * impulse
      bendRadians = 0.22 * calibration.bendGain * impulse
      twistRadians = 0.12 * calibration.twistGain * Math.sin(TWO_PI * progress) * impulse
      axialOffset = 0.07 * Math.sin(TWO_PI * progress) * impulse
      break
    }
    case 'deployment':
      radialScaleX = 0.58 + 0.42 * eased
      radialScaleZ = 0.58 + 0.42 * eased
      axialScale = 1 + 0.24 * calibration.axialCoupling * (1 - eased)
      twistRadians = 0.16 * calibration.twistGain * (1 - eased)
      axialOffset = -0.42 * (1 - eased)
      break
    case 'rest':
      break
  }

  radialScaleX = clamp(radialScaleX, 0.55, 1.15)
  radialScaleZ = clamp(radialScaleZ, 0.55, 1.15)
  axialScale = clamp(axialScale, 0.8, 1.3)
  bendRadians = clamp(bendRadians, -1.2, 1.2)
  twistRadians = clamp(twistRadians, -0.8, 0.8)
  axialOffset = clamp(axialOffset, -1, 1)

  const supportsDiameter = profile?.capabilities.supportsDiameterRetention ?? true
  const supportsLength = profile?.capabilities.supportsLengthChange ?? true

  return {
    mode,
    progress,
    radialScaleX: round(radialScaleX),
    radialScaleZ: round(radialScaleZ),
    axialScale: round(axialScale),
    bendRadians: round(bendRadians),
    twistRadians: round(twistRadians),
    axialOffset: round(axialOffset),
    normalizedDiameterRetention: supportsDiameter
      ? round(Math.min(radialScaleX, radialScaleZ))
      : null,
    normalizedLengthChange: supportsLength ? round(axialScale - 1) : null,
    caption: loadCaptions[mode],
  }
}

/**
 * Applies the learner's visible-displacement multiplier to a qualitative pose.
 * This remains a geometry-only transform and intentionally introduces no force,
 * pressure, stiffness, or patient-specific fields.
 */
export function applyLoadAmplitude(frame: LoadFrame, rawAmplitude: number): LoadFrame {
  requireFinite(rawAmplitude, 'Load amplitude')
  const amplitude = clamp(rawAmplitude, 0, 1)

  return {
    ...frame,
    axialOffset: round(frame.axialOffset * amplitude),
    axialScale: round(1 + (frame.axialScale - 1) * amplitude),
    bendRadians: round(frame.bendRadians * amplitude),
    normalizedDiameterRetention:
      frame.normalizedDiameterRetention === null
        ? null
        : round(1 + (frame.normalizedDiameterRetention - 1) * amplitude),
    normalizedLengthChange:
      frame.normalizedLengthChange === null
        ? null
        : round(frame.normalizedLengthChange * amplitude),
    radialScaleX: round(1 + (frame.radialScaleX - 1) * amplitude),
    radialScaleZ: round(1 + (frame.radialScaleZ - 1) * amplitude),
    twistRadians: round(frame.twistRadians * amplitude),
  }
}

/**
 * Idealized inextensible-wire relation for a cylindrical multiwire braid.
 * It is a geometry lesson, not a material, friction, or force calculation.
 */
export function calculateBraidKinematics(input: BraidKinematicsInput): BraidKinematicsResult {
  const { initialDiameter, initialLength, initialBraidAngleDeg, targetDiameter } = input

  requireFinite(initialDiameter, 'Initial diameter')
  requireFinite(initialLength, 'Initial length')
  requireFinite(initialBraidAngleDeg, 'Initial braid angle')
  requireFinite(targetDiameter, 'Target diameter')

  if (initialDiameter <= 0 || initialLength <= 0 || targetDiameter <= 0) {
    throw new Error('Braid diameters and length must be greater than zero.')
  }
  if (initialBraidAngleDeg <= 0 || initialBraidAngleDeg >= 90) {
    throw new Error('Initial braid angle must be between 0 and 90 degrees.')
  }

  const initialAngleRad = (initialBraidAngleDeg * Math.PI) / 180
  const diameterRatio = targetDiameter / initialDiameter
  const targetSine = diameterRatio * Math.sin(initialAngleRad)

  if (targetSine >= 1) {
    throw new Error(
      'Target diameter is incompatible with the idealized inextensible-wire braid geometry.',
    )
  }

  const targetAngleRad = Math.asin(targetSine)
  const wirePathLength = initialLength / Math.cos(initialAngleRad)
  const targetLength = wirePathLength * Math.cos(targetAngleRad)
  const turnCount = (initialLength * Math.tan(initialAngleRad)) / (Math.PI * initialDiameter)

  return {
    targetDiameter: round(targetDiameter),
    targetLength: round(targetLength),
    targetBraidAngleDeg: round((targetAngleRad * 180) / Math.PI),
    normalizedDiameterRetention: round(diameterRatio),
    normalizedLengthChange: round((targetLength - initialLength) / initialLength),
    wirePathLength: round(wirePathLength),
    turnCount: round(turnCount),
  }
}

/** Preserves the exact paused pose and loops only while animation is active. */
export function resolveAnimationProgress({
  currentProgress,
  deltaSeconds,
  isPlaying,
  speed = 0.18,
  reducedMotion = false,
}: AnimationProgressInput): number {
  requireFinite(currentProgress, 'Current animation progress')
  requireFinite(deltaSeconds, 'Animation delta')
  requireFinite(speed, 'Animation speed')

  if (currentProgress < 0 || currentProgress > 1) {
    throw new Error('Current animation progress must be between 0 and 1.')
  }
  if (deltaSeconds < 0) {
    throw new Error('Animation delta must be zero or greater.')
  }
  if (speed <= 0) {
    throw new Error('Animation speed must be greater than zero.')
  }
  if (!isPlaying || reducedMotion || deltaSeconds === 0) {
    return currentProgress
  }

  const next = currentProgress + deltaSeconds * speed
  return round(next - Math.floor(next))
}

/** Smoothly reflects a qualitative load between 0 and 1 without a wraparound snap. */
export function resolvePingPongProgress({
  currentProgress,
  deltaSeconds,
  direction,
  isPlaying,
  reducedMotion = false,
  speed = 0.3,
}: AnimationProgressInput & { direction: PingPongDirection }): PingPongProgressResult {
  requireFinite(currentProgress, 'Current animation progress')
  requireFinite(deltaSeconds, 'Animation delta')
  requireFinite(speed, 'Animation speed')
  if (currentProgress < 0 || currentProgress > 1) {
    throw new Error('Current animation progress must be between 0 and 1.')
  }
  if (deltaSeconds < 0) {
    throw new Error('Animation delta must be zero or greater.')
  }
  if (speed <= 0) {
    throw new Error('Animation speed must be greater than zero.')
  }
  if (direction !== -1 && direction !== 1) {
    throw new Error('Animation direction must be -1 or 1.')
  }
  if (!isPlaying || reducedMotion || deltaSeconds === 0) {
    return { direction, progress: currentProgress }
  }

  let nextDirection = direction
  let nextProgress = currentProgress + deltaSeconds * speed * direction
  while (nextProgress > 1 || nextProgress < 0) {
    if (nextProgress > 1) {
      nextProgress = 2 - nextProgress
      nextDirection = -1
    } else if (nextProgress < 0) {
      nextProgress = -nextProgress
      nextDirection = 1
    }
  }

  return { direction: nextDirection, progress: round(nextProgress) }
}
