export const HYDROSTATIC_PRESSURE_MMHG_PER_CM = 0.74

export type DynamicResponseKind = 'acceptable' | 'overdamped' | 'underdamped'

export interface DynamicResponseDefinition {
  readonly id: DynamicResponseKind
  readonly label: string
  readonly shortLabel: string
  readonly observation: string
  readonly interpretation: string
  readonly pressureEffect: string
  readonly artifact: 'none' | 'overdamped' | 'underdamped'
}

export const dynamicResponseDefinitions: readonly DynamicResponseDefinition[] = [
  {
    id: 'acceptable',
    label: 'Acceptable dynamic response',
    shortLabel: 'Acceptable',
    observation: 'Prompt return with a small number of rapidly settling oscillations.',
    interpretation: 'The monitoring system reproduces the pressure signal without obvious damping.',
    pressureEffect: 'Systolic, diastolic, and pulse-pressure morphology are not visibly distorted.',
    artifact: 'none',
  },
  {
    id: 'overdamped',
    label: 'Overdamped response',
    shortLabel: 'Overdamped',
    observation: 'Sluggish return toward baseline with little or no oscillation.',
    interpretation: 'The monitoring system attenuates rapid pressure changes.',
    pressureEffect: 'Pulse pressure narrows as systolic pressure is attenuated.',
    artifact: 'overdamped',
  },
  {
    id: 'underdamped',
    label: 'Underdamped response',
    shortLabel: 'Underdamped',
    observation: 'Several oscillations persist after release before the trace settles.',
    interpretation: 'The monitoring system resonates and exaggerates rapid pressure changes.',
    pressureEffect: 'Pulse pressure widens as systolic pressure is exaggerated.',
    artifact: 'underdamped',
  },
] as const

export const dynamicResponseChallenges = [
  { id: 'response-a', label: 'Response A', response: 'underdamped' },
  { id: 'response-b', label: 'Response B', response: 'acceptable' },
  { id: 'response-c', label: 'Response C', response: 'overdamped' },
] as const

export type DynamicResponseChallengeId = (typeof dynamicResponseChallenges)[number]['id']

export function getDynamicResponseDefinition(
  response: DynamicResponseKind,
): DynamicResponseDefinition {
  const definition = dynamicResponseDefinitions.find((candidate) => candidate.id === response)
  if (!definition) throw new Error(`Unknown dynamic-response definition: ${response}`)
  return definition
}

export function getDynamicResponseChallenge(challengeId: DynamicResponseChallengeId) {
  const challenge = dynamicResponseChallenges.find((candidate) => candidate.id === challengeId)
  if (!challenge) throw new Error(`Unknown dynamic-response challenge: ${challengeId}`)
  return challenge
}

export function classifyDynamicResponse(measurementSystem: {
  readonly artifact: string
  readonly dampingRatio: number
}): DynamicResponseKind {
  if (measurementSystem.artifact === 'overdamped' || measurementSystem.dampingRatio > 0.95) {
    return 'overdamped'
  }
  if (measurementSystem.artifact === 'underdamped' || measurementSystem.dampingRatio < 0.4) {
    return 'underdamped'
  }
  return 'acceptable'
}

export function hydrostaticPressureOffsetMmHg(transducerLevelCm: number): number {
  if (transducerLevelCm === 0) return 0
  return -transducerLevelCm * HYDROSTATIC_PRESSURE_MMHG_PER_CM
}

export function formatSignedPressure(value: number): string {
  const rounded = Math.abs(value) < 0.05 ? 0 : value
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)} mmHg`
}

function clampTraceY(value: number): number {
  return Math.max(7, Math.min(103, value))
}

/**
 * Qualitative, normalized step-response drawing for education. It is intentionally
 * not a calibrated device trace and does not alter the hemodynamics engine.
 */
export function fastFlushTracePath(response: DynamicResponseKind): string {
  const baselineY = 68
  const plateauY = 18
  const releaseX = 126
  const traceEndX = 300
  const commands = [
    `M 0 ${baselineY}`,
    `L 38 ${baselineY}`,
    `L 38 ${plateauY}`,
    `L ${releaseX} ${plateauY}`,
  ]

  for (let x = releaseX; x <= traceEndX; x += 3) {
    const elapsed = (x - releaseX) / (traceEndX - releaseX)
    let y: number
    if (response === 'overdamped') {
      y = baselineY - (baselineY - plateauY) * Math.exp(-3.1 * elapsed)
    } else {
      const decay = response === 'acceptable' ? 7.4 : 1.75
      const cycles = response === 'acceptable' ? 2.4 : 6
      y =
        baselineY -
        (baselineY - plateauY) *
          Math.exp(-decay * elapsed) *
          Math.cos(elapsed * Math.PI * 2 * cycles)
    }
    commands.push(`L ${x} ${clampTraceY(y).toFixed(1)}`)
  }

  return commands.join(' ')
}

export const levelingPressureTracePath =
  'M 0 66 C 12 66, 15 63, 19 44 C 23 22, 29 20, 35 34 C 42 49, 48 54, 56 54 C 64 54, 69 50, 76 50 C 83 50, 88 56, 96 60 C 108 66, 117 66, 128 66 C 140 66, 143 63, 147 44 C 151 22, 157 20, 163 34 C 170 49, 176 54, 184 54 C 192 54, 197 50, 204 50 C 211 50, 216 56, 224 60 C 236 66, 246 66, 258 66 C 270 66, 273 63, 277 44 C 281 22, 287 20, 293 34 C 300 49, 306 54, 314 54 C 322 54, 327 50, 334 50 C 341 50, 346 56, 354 60 C 366 66, 376 66, 388 66'
