import {
  clinicalLearningItemSchema,
  type ClinicalLearningItem,
} from '@/features/learning-module/activity'

import { freshTeachingState, reduceAll } from '../engine/stageRuntime'
import type { HemodynamicAction, HemodynamicSimulationState } from '../engine/types'
import { hemodynamicsLearnerCopyErrors } from './controlPanel'
import type { HemodynamicsSectionId } from './sectionSpecs'

/**
 * Story problems: sixty-second scenarios in which a colleague reaches for the tempting control.
 *
 * "Level and zero move the number, damping changes the shape" is an assertion; a colleague who
 * re-zeros a ringing line and gets the same ringing back is an experience. Each story is a
 * prediction committed before the colleague's move is made on the engine, then the readings the
 * move actually produced, then one line naming the axis the control lives on. The verdict copy is
 * checked against an engine run in `story-problems.test.ts`, so the story cannot say something
 * the model does not do.
 */
export type StoryReading =
  | 'papSystolic'
  | 'papDiastolic'
  | 'pulsePressure'
  | 'flushFinding'
  | 'storedWedge'
  | 'papDiastolicFloor'
  | 'safety'

export const storyReadingLabels: Readonly<Record<StoryReading, string>> = {
  papSystolic: 'PA systolic',
  papDiastolic: 'PA diastolic',
  pulsePressure: 'PA pulse pressure',
  flushFinding: 'Flush response',
  storedWedge: 'Stored wedge',
  papDiastolicFloor: 'PA diastolic (the floor the wedge must sit under)',
  safety: 'What the simulation did with the move',
}

export interface HemodynamicsStoryProblem {
  readonly id: string
  readonly sectionId: HemodynamicsSectionId
  readonly title: string
  readonly item: ClinicalLearningItem
  /** Engine actions that build the story's opening state on top of the section's runtime state. */
  readonly setup: readonly HemodynamicAction[]
  /** The colleague's move, on the engine. */
  readonly move: readonly HemodynamicAction[]
  /** The readings to watch after the move, in reading order. */
  readonly readings: readonly StoryReading[]
  /** One line naming which axis the control actually moved. */
  readonly axisVerdict: string
}

function item(input: unknown): ClinicalLearningItem {
  return clinicalLearningItemSchema.parse(input)
}

const lineEvidence = ['arterial-pressure-five-step-2020', 'monitor-workflow-supplied']

export const hemodynamicsStoryProblems: readonly HemodynamicsStoryProblem[] = Object.freeze([
  {
    id: 'story-rezero-for-ringing',
    sectionId: 'pressure-system',
    title: 'A fresh zero for a ringing line',
    item: item({
      id: 'hd-story-rezero-1',
      activityId: 'hemodynamics:learn:pressure-system',
      phase: 'observe',
      itemType: 'response-prediction',
      contextRequirement: 'technical',
      clinicalContextId: 'story-rezero-for-ringing',
      visualAssetIds: ['fast-flush-trace'],
      stem: 'The pulmonary-artery line has never been zeroed, and its fast-flush release rings for several beats. A colleague opens the transducer to air and zeros it. What happens to the tracing?',
      choices: [
        {
          id: 'shifts-not-shape',
          label:
            'Every displayed pressure moves by the same amount; the ringing and the pulse pressure are unchanged.',
          rationale:
            'Zero sets the reference. It moves the whole tracing and touches nothing about how the line follows a quick change.',
          plausibility: 'best',
        },
        {
          id: 'ringing-settles',
          label: 'The ringing settles, because a fresh zero resets the transducer.',
          rationale:
            'Zeroing tells the monitor what atmospheric pressure reads as. The resonance lives in the tubing and its components, which zero cannot reach.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'peaks-fall-to-true',
          label:
            'The systolic peaks fall to their true value, since the overshoot was part of the offset.',
          rationale:
            'The overshoot is an exaggeration of a fast change, not an offset. Removing the offset moves the peak and the trough together and leaves the exaggeration.',
          plausibility: 'reasonable-but-incomplete',
        },
      ],
      correctChoiceIds: ['shifts-not-shape'],
      explanation:
        'Zero and level are the reference. They move every number by one amount and change no shape; the response is the line’s own, and only the line repairs it.',
      evidenceIds: lineEvidence,
      reviewStatus: 'draft',
    }),
    setup: [
      { type: 'SET_TRANSDUCER_LEVEL', levelCm: 0 },
      { type: 'SET_DAMPING', dampingRatio: 0.28 },
      { type: 'SET_ARTIFACT', artifact: 'underdamped' },
    ],
    move: [{ type: 'ZERO_TRANSDUCER' }, { type: 'FAST_FLUSH', lineType: 'pulmonary-artery' }],
    readings: ['papSystolic', 'papDiastolic', 'pulsePressure', 'flushFinding'],
    axisVerdict:
      'Zero is the reference axis: it moved the whole tracing and left the response exactly as it was.',
  },
  {
    id: 'story-relevel-for-flat',
    sectionId: 'pressure-system',
    title: 'A lower transducer for a narrow tracing',
    item: item({
      id: 'hd-story-relevel-1',
      activityId: 'hemodynamics:learn:pressure-system',
      phase: 'observe',
      itemType: 'response-prediction',
      contextRequirement: 'technical',
      clinicalContextId: 'story-relevel-for-flat',
      visualAssetIds: ['pressure-level-diagram'],
      stem: 'The pulmonary-artery tracing is rounded, its peak is blunted and its pulse pressure is narrow; the flush creeps back without a ring. A colleague, wanting a larger tracing, lowers the transducer several centimetres. What happens?',
      choices: [
        {
          id: 'all-rise-shape-same',
          label:
            'Every pressure reads higher by the same amount; the tracing stays rounded and the pulse pressure stays narrow.',
          rationale:
            'A lower transducer adds a hydrostatic column to every reading. It cannot sharpen an upstroke or widen the distance between peak and trough.',
          plausibility: 'best',
        },
        {
          id: 'pulse-widens',
          label: 'The pulse pressure widens, because a lower transducer reads higher pressures.',
          rationale:
            'It reads higher, but the peak and the trough rise together. The pulse pressure is their difference, and the difference does not move.',
          plausibility: 'reasonable-but-incomplete',
        },
        {
          id: 'shape-recovers',
          label:
            'The upstroke sharpens, since the tracing was small because the transducer was high.',
          rationale:
            'Height changes offset. A rounded upstroke and a lost notch are the fluid path failing to follow a fast change, and no height repairs that.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['all-rise-shape-same'],
      explanation:
        'Level is the reference axis. It moved every number by the same amount and left the narrow, rounded shape untouched; the shape lives in the fluid path.',
      evidenceIds: lineEvidence,
      reviewStatus: 'draft',
    }),
    setup: [
      { type: 'SET_TRANSDUCER_LEVEL', levelCm: 0 },
      { type: 'ZERO_TRANSDUCER' },
      { type: 'SET_DAMPING', dampingRatio: 1.15 },
      { type: 'SET_ARTIFACT', artifact: 'overdamped' },
    ],
    move: [
      { type: 'SET_TRANSDUCER_LEVEL', levelCm: -8 },
      { type: 'FAST_FLUSH', lineType: 'pulmonary-artery' },
    ],
    readings: ['papSystolic', 'papDiastolic', 'pulsePressure', 'flushFinding'],
    axisVerdict:
      'Level is the reference axis: it moved every number and changed no shape. The response is the line’s.',
  },
  {
    id: 'story-more-balloon',
    sectionId: 'pawp-capture',
    title: 'More balloon for a wedge that does not look right',
    item: item({
      id: 'hd-story-more-balloon-1',
      activityId: 'hemodynamics:learn:pawp-capture',
      phase: 'observe',
      itemType: 'response-prediction',
      contextRequirement: 'technical',
      clinicalContextId: 'story-more-balloon',
      visualAssetIds: ['pac-live-waveform'],
      stem: 'With the balloon up, the tracing still carries some pulsatility and the stored value sits above the pulmonary-artery diastolic pressure. A colleague adds more air to the balloon to complete the occlusion. What happens?',
      choices: [
        {
          id: 'reject-and-deflate',
          label:
            'Nothing improves. The value is rejected as a poor occlusion, and the balloon should come down.',
          rationale:
            'A wedge that sits above the artery’s diastolic pressure is not reading the left atrium. More volume does not make it one; it risks the vessel.',
          plausibility: 'best',
        },
        {
          id: 'more-completes-it',
          label: 'The extra volume completes the occlusion and the value becomes usable.',
          rationale:
            'An occlusion that needs more than the labelled volume is in a branch or a lung zone that cannot give a wedge. Adding air is how vessels are injured.',
          plausibility: 'unsafe',
        },
        {
          id: 'falls-to-true',
          label: 'The value falls to the true wedge as the branch fills in behind the balloon.',
          rationale:
            'A balloon that occludes reads the pressure beyond it at once. A value that has to be waited for is not a wedge.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['reject-and-deflate'],
      explanation:
        'The balloon is the control here, and its only safe directions are up briefly and then down. A poor occlusion is rejected, not improved.',
      evidenceIds: ['pac-waveforms-part-1-2021', 'edwards-swan-ganz-ifu-2023'],
      reviewStatus: 'draft',
    }),
    setup: [
      { type: 'SET_TRANSDUCER_LEVEL', levelCm: 0 },
      { type: 'ZERO_TRANSDUCER' },
      { type: 'SET_CATHETER_POSITION', position: 'pa' },
      { type: 'SET_ARTIFACT', artifact: 'false-wedge' },
      { type: 'START_WEDGE' },
      { type: 'TICK', seconds: 8 },
      { type: 'PLACE_WEDGE_CURSOR' },
      { type: 'STORE_WEDGE' },
    ],
    move: [{ type: 'START_WEDGE' }],
    readings: ['storedWedge', 'papDiastolicFloor', 'safety'],
    axisVerdict:
      'The balloon is the control, and more of it is the harmful reflex: the simulation refuses the second inflation and records it.',
  },
])

export type StoryReadingValue = number | string | null

export interface StoryRun {
  readonly before: Readonly<Record<StoryReading, StoryReadingValue>>
  readonly after: Readonly<Record<StoryReading, StoryReadingValue>>
}

export function storyReading(
  reading: StoryReading,
  state: HemodynamicSimulationState,
): StoryReadingValue {
  switch (reading) {
    case 'papSystolic':
      return state.measurements.papSystolicMmHg
    case 'papDiastolic':
    case 'papDiastolicFloor':
      return state.measurements.papDiastolicMmHg
    case 'pulsePressure':
      return state.measurements.papSystolicMmHg - state.measurements.papDiastolicMmHg
    case 'flushFinding':
      return state.measurementSystem.lastFastFlushFinding ?? 'No flush run yet'
    case 'storedWedge':
      return state.catheter.storedWedgeMmHg
    case 'safety':
      return state.criticalErrors.includes('overwedge-balloon-reinflation')
        ? 'Refused, and recorded as unsafe'
        : state.criticalErrors.length > 0
          ? 'Recorded as unsafe'
          : 'Allowed'
    default:
      return null
  }
}

/**
 * Run a story on the engine: the setup, a reading, the move, a reading.
 *
 * Every story opens on the teaching patient as authored — level, not yet zeroed, well damped —
 * and never on the learner's own patient, so a story about a line that has never been zeroed
 * is not run on a line the learner zeroed a minute ago.
 */
export function runHemodynamicsStory(
  story: HemodynamicsStoryProblem,
  base: HemodynamicSimulationState = freshTeachingState(),
): StoryRun {
  const opening = reduceAll(base, story.setup)
  const closing = reduceAll(opening, story.move)
  const read = (state: HemodynamicSimulationState) =>
    Object.fromEntries(
      story.readings.map((reading) => [reading, storyReading(reading, state)]),
    ) as Record<StoryReading, StoryReadingValue>
  return { before: read(opening), after: read(closing) }
}

export function hemodynamicsStoryProblemsFor(
  sectionId: HemodynamicsSectionId,
): readonly HemodynamicsStoryProblem[] {
  return hemodynamicsStoryProblems.filter((story) => story.sectionId === sectionId)
}

export function validateHemodynamicsStoryProblems(
  stories: readonly HemodynamicsStoryProblem[] = hemodynamicsStoryProblems,
): readonly string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const story of stories) {
    if (ids.has(story.id)) errors.push(`Story ${story.id} is declared twice.`)
    ids.add(story.id)
    if (story.readings.length < 2 || story.readings.length > 4) {
      errors.push(`Story ${story.id} needs two to four readings.`)
    }
    if (story.move.length === 0) errors.push(`Story ${story.id} has no move.`)
    errors.push(
      ...hemodynamicsLearnerCopyErrors(`Story ${story.id} title`, story.title),
      ...hemodynamicsLearnerCopyErrors(`Story ${story.id} verdict`, story.axisVerdict),
    )
    if (story.item.activityId !== `hemodynamics:learn:${story.sectionId}`) {
      errors.push(`Story ${story.id} belongs to ${story.item.activityId}.`)
    }
  }
  return errors
}

const storyErrors = validateHemodynamicsStoryProblems()
if (storyErrors.length > 0) {
  throw new Error(`Hemodynamics story problems are invalid:\n${storyErrors.join('\n')}`)
}
