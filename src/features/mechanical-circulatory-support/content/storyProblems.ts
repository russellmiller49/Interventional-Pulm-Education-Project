import {
  clinicalLearningItemSchema,
  type ClinicalLearningItem,
} from '@/features/learning-module/activity/clinicalLearningItem'

import { createInitialMcsState, mcsReducer } from '../engine'
import type {
  McsAction,
  McsDerivedMetrics,
  McsDeviceKind,
  McsSimulationState,
} from '../engine/types'

/**
 * Story problems that decouple the two confusable axes: the setting and the loading.
 *
 * Each is a sixty-second constructed illustration. A colleague has just done one thing for a
 * reason that sounds sensible — raised the level for a suction alarm, raised the speed for a low
 * display — and the learner predicts what the display and the circulation do, then runs the very
 * same change on a separate copy of the circulation and reads four values. The point is not the
 * number but the axis: a setting asks the pump for more, and what it can deliver is decided by the
 * loading. The pairs are built so that the tempting control visibly helps less than the other.
 *
 * `story-problems.test.ts` derives each verdict's direction from an engine run, so the copy cannot
 * contradict the model.
 */

export type McsStoryReading = Extract<
  keyof McsDerivedMetrics,
  | 'leftDeviceFlowLMin'
  | 'deviceFlowLMin'
  | 'effectiveSystemicFlowLMin'
  | 'mapMmHg'
  | 'pcwpMmHg'
  | 'rapMmHg'
  | 'pumpPowerW'
>

export interface McsStoryProblem {
  readonly id: string
  readonly sectionId: string
  readonly title: string
  readonly item: ClinicalLearningItem
  readonly device: McsDeviceKind
  /** The colleague's starting point, built from the device's default state. */
  readonly setup: readonly McsAction[]
  /** The one thing the colleague did. */
  readonly change: readonly McsAction[]
  /** The four readings to watch after the change, in reading order. */
  readonly readings: readonly McsStoryReading[]
  /** The alarm whose state the story turns on, if any. */
  readonly alarmId?: string
  /** One line naming which axis the change actually moved. */
  readonly axisVerdict: string
}

export const MCS_STORY_READING_LABELS: Readonly<Record<McsStoryReading, string>> = {
  leftDeviceFlowLMin: 'Displayed pump flow',
  deviceFlowLMin: 'Displayed pump flow',
  effectiveSystemicFlowLMin: 'Effective systemic delivery',
  mapMmHg: 'Mean arterial pressure',
  pcwpMmHg: 'Wedge pressure',
  rapMmHg: 'Right atrial pressure',
  pumpPowerW: 'Pump power',
}

export const MCS_STORY_READING_UNITS: Readonly<Record<McsStoryReading, string>> = {
  leftDeviceFlowLMin: 'L/min',
  deviceFlowLMin: 'L/min',
  effectiveSystemicFlowLMin: 'L/min',
  mapMmHg: 'mm Hg',
  pcwpMmHg: 'mm Hg',
  rapMmHg: 'mm Hg',
  pumpPowerW: 'W',
}

const impellaSources = [
  'mcs-bedside-reference-supplied',
  'fda-impella-cp-labeling',
  'mcs-educational-model-v1',
] as const
const lvadSources = [
  'mcs-bedside-reference-supplied',
  'fda-heartmate3-ifu',
  'mcs-educational-model-v1',
] as const

const suctionStart: readonly McsAction[] = [
  { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'performanceLevel', value: 7 },
  { type: 'SET_PATIENT_CONTROL', control: 'preloadPercent', value: 55 },
]

const stiffStart: readonly McsAction[] = [
  { type: 'SET_PATIENT_CONTROL', control: 'systemicVascularResistanceDynSecCm5', value: 1900 },
]

const authored: readonly McsStoryProblem[] = [
  {
    id: 'story-level-for-suction',
    sectionId: 'impella-suction-purge-rv',
    title: 'Story problem: the level for a suction alarm',
    device: 'impella',
    setup: suctionStart,
    change: [{ type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'performanceLevel', value: 9 }],
    readings: ['leftDeviceFlowLMin', 'effectiveSystemicFlowLMin', 'pcwpMmHg', 'mapMmHg'],
    alarmId: 'impella-left-suction',
    axisVerdict:
      'The level moved the setting axis. The alarm was reporting the loading axis — what reaches the inlet — and it did not follow.',
    item: clinicalLearningItemSchema.parse({
      id: 'mcs.story.impella-suction-purge-rv.level-for-suction',
      activityId: 'mcs:learn:impella-suction-purge-rv',
      phase: 'observe',
      itemType: 'response-prediction',
      contextRequirement: 'context-independent',
      stem: 'A constructed illustration. A left-sided pump is at level seven with a suction alarm. A colleague, reading the low displayed flow, raises the level to nine. Nothing else is changed. Before the circulation responds: what happens to the displayed flow, and to the alarm?',
      choices: [
        {
          id: 'small-rise-alarm-stays',
          label:
            'The displayed flow rises a little, the alarm stays, and the ventricle empties further.',
          plausibility: 'best',
          rationale:
            'The level asks the pump for more. What it can move is decided by what has arrived in front of the inlet, so the display gains a little, the chamber empties further, and the alarm that reports an inlet pulling on an empty chamber stays.',
        },
        {
          id: 'rises-in-step-alarm-clears',
          label: 'The displayed flow rises in step with the levels added, and the alarm clears.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'A level is a request, not a delivery. A pump cannot move blood that has not reached it, and asking harder does not fill the chamber it is drawing from.',
        },
        {
          id: 'nothing-changes',
          label: 'Nothing changes, because the pump was already moving everything it could.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'The display does move — a little — which is what makes this pattern misleading. A small gain at a higher level is the pump reaching for what little is there.',
        },
        {
          id: 'keep-raising',
          label:
            'The flow rises and the alarm clears once the level is high enough, so keep raising it until it does.',
          plausibility: 'unsafe',
          rationale:
            'Raising the level against an empty chamber pulls the inlet harder onto the wall and adds blood trauma for no delivery. The move that clears this alarm is on the other axis.',
        },
      ],
      correctChoiceIds: ['small-rise-alarm-stays'],
      explanation:
        'The level asks the pump for more. What the pump can move is decided upstream of the inlet, by what has arrived, so the display gains a little, the chamber it draws from empties further, and the alarm stays. The colleague reached for the setting axis; the problem lives on the loading axis. Model boundary: the suction alarm here is a modeled state, not a device’s own alarm logic, and blood trauma from a pump pulling on an empty chamber is named but not simulated.',
      evidenceIds: [...impellaSources],
      reviewStatus: 'draft',
    }),
  },
  {
    id: 'story-volume-for-suction',
    sectionId: 'impella-suction-purge-rv',
    title: 'Story problem: volume for the same alarm',
    device: 'impella',
    setup: suctionStart,
    change: [{ type: 'SET_PATIENT_CONTROL', control: 'preloadPercent', value: 100 }],
    readings: ['leftDeviceFlowLMin', 'effectiveSystemicFlowLMin', 'pcwpMmHg', 'mapMmHg'],
    alarmId: 'impella-left-suction',
    axisVerdict:
      'Volume moved the loading axis, which is where the alarm lived. The setting did not move at all, and the display did.',
    item: clinicalLearningItemSchema.parse({
      id: 'mcs.story.impella-suction-purge-rv.volume-for-suction',
      activityId: 'mcs:learn:impella-suction-purge-rv',
      phase: 'observe',
      itemType: 'response-prediction',
      contextRequirement: 'context-independent',
      stem: 'The same constructed illustration, from the same starting point: level seven, the same suction alarm. This time the colleague leaves the level alone and gives volume. Before the circulation responds: what happens to the displayed flow, and to the alarm?',
      choices: [
        {
          id: 'larger-rise-alarm-clears',
          label:
            'The displayed flow rises by more than raising the level did, and the alarm clears.',
          plausibility: 'best',
          rationale:
            'With something arrived in front of the inlet, the pump moves what it was asked for at an unchanged setting. The alarm was reporting an empty chamber, and the chamber is no longer empty.',
        },
        {
          id: 'cannot-rise-without-level',
          label: 'The displayed flow cannot rise, because the level was not changed.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'The level was never the limit. The pump was asking for more than it could get, and the display follows what it gets.',
        },
        {
          id: 'wedge-rises-flow-falls',
          label: 'The wedge pressure rises, so the pump is now overloaded and the flow falls.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'The wedge pressure does rise as the chamber refills — that is what a chamber with something to offer looks like. The display rises with it; an overloaded ventricle is a different picture, read over time.',
        },
        {
          id: 'volume-to-specification',
          label:
            'Give volume until the displayed flow reaches the figure on the device’s specification.',
          plausibility: 'unsafe',
          rationale:
            'A product reference flow is a specification for the device, not a treatment target for the patient. Volume given to a number rather than to a finding congests the ventricle the pump was relieving.',
        },
      ],
      correctChoiceIds: ['larger-rise-alarm-clears'],
      explanation:
        'Volume answered the question the alarm was asking. With something arrived in front of the inlet the pump moves what it was asked for, the display rises by more than the level ever managed, and the alarm clears — at an unchanged setting. The wedge pressure rises as the chamber refills, which is what a chamber with something to offer looks like. Model boundary: volume here is a single slider on a simulated circulation; how much, how fast and whether to give it at all are bedside decisions this module does not make.',
      evidenceIds: [...impellaSources],
      reviewStatus: 'draft',
    }),
  },
  {
    id: 'story-speed-for-resistance',
    sectionId: 'lvad-parameters-assessment',
    title: 'Story problem: speed for a low display and a high pressure',
    device: 'lvad',
    setup: stiffStart,
    change: [
      { type: 'SET_LVAD_CONTROL', control: 'speedChangeAuthorized', value: true },
      { type: 'SET_LVAD_CONTROL', control: 'speedRpm', value: 5800 },
    ],
    readings: ['deviceFlowLMin', 'effectiveSystemicFlowLMin', 'mapMmHg', 'pumpPowerW'],
    axisVerdict:
      'Speed moved the setting axis. The number that was low lives on the loading axis — what the pump ejects against — and the pressure that was high got higher.',
    item: clinicalLearningItemSchema.parse({
      id: 'mcs.story.lvad-parameters-assessment.speed-for-resistance',
      activityId: 'mcs:learn:lvad-parameters-assessment',
      phase: 'observe',
      itemType: 'response-prediction',
      contextRequirement: 'context-independent',
      stem: 'A constructed illustration. A durable pump’s displayed flow has fallen and the mean pressure is high. A colleague, with an order in hand, raises the speed. Nothing else is changed. Before the circulation responds: what happens to the displayed flow, and to the mean pressure?',
      choices: [
        {
          id: 'small-rise-pressure-higher',
          label: 'The displayed flow rises a little, and the mean pressure rises further with it.',
          plausibility: 'best',
          rationale:
            'Speed asks the pump for more against the same stiff circulation. It gains a little, and every litre it adds is pushed into a vessel that already pushes back, so the pressure climbs further.',
        },
        {
          id: 'flow-returns-speed-sets-flow',
          label: 'The displayed flow returns to where it was, because speed sets flow.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'Speed is set; flow is a result. What crosses the pump depends on what fills the ventricle and on the pressure at the outlet, and the outlet pressure is the problem here.',
        },
        {
          id: 'pressure-falls-more-blood',
          label:
            'The mean pressure falls, because the pump now moves more blood past the resistance.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'More flow into the same resistance raises the pressure; it does not lower it. The pressure would fall if the resistance fell, not if the pump pushed harder.',
        },
        {
          id: 'keep-raising-speed',
          label: 'Keep raising the speed until the displayed flow is back where it was.',
          plausibility: 'unsafe',
          rationale:
            'Chasing the display with speed drives the pressure higher still and empties the ventricle the pump draws from. The number was reporting the circulation, and the circulation is what has to change.',
        },
      ],
      correctChoiceIds: ['small-rise-pressure-higher'],
      explanation:
        'Speed asks the pump for more against the same stiff circulation. The pump gains a little, and every litre it adds is pushed into a vessel that already pushes back, so the pressure rises further. The display rose because the estimate follows power and speed, not because more reached the organs. Model boundary: the speed change here is a simulated order; the device’s own speed logic and alarm limits are not reproduced.',
      evidenceIds: [...lvadSources],
      reviewStatus: 'draft',
    }),
  },
  {
    id: 'story-resistance-lowered',
    sectionId: 'lvad-parameters-assessment',
    title: 'Story problem: the resistance comes down',
    device: 'lvad',
    setup: stiffStart,
    change: [
      { type: 'SET_PATIENT_CONTROL', control: 'systemicVascularResistanceDynSecCm5', value: 1100 },
    ],
    readings: ['deviceFlowLMin', 'effectiveSystemicFlowLMin', 'mapMmHg', 'pumpPowerW'],
    axisVerdict:
      'The resistance moved the loading axis, which is where the low display lived. The speed did not move, and the display did.',
    item: clinicalLearningItemSchema.parse({
      id: 'mcs.story.lvad-parameters-assessment.resistance-lowered',
      activityId: 'mcs:learn:lvad-parameters-assessment',
      phase: 'observe',
      itemType: 'response-prediction',
      contextRequirement: 'context-independent',
      stem: 'The same constructed illustration, from the same starting point: the same fallen display, the same high pressure. This time the colleague leaves the speed alone and the systemic resistance comes down. Before the circulation responds: what happens to the displayed flow, and to the mean pressure?',
      choices: [
        {
          id: 'larger-rise-pressure-falls',
          label:
            'The displayed flow rises by more than the speed change managed, and the mean pressure falls.',
          plausibility: 'best',
          rationale:
            'A continuous-flow pump delivers more against less. With the circulation less stiff, the same speed moves more blood and the pressure falls at the same time — the two improvements finally pointing the same way.',
        },
        {
          id: 'flow-falls-less-driving-force',
          label: 'The displayed flow falls, because a lower pressure means less driving force.',
          plausibility: 'incorrect-mechanism',
          rationale:
            'The pressure at the outlet is what the pump works against, not what drives it. Less to push against is more delivered, not less.',
        },
        {
          id: 'pressure-falls-flow-fixed',
          label:
            'The mean pressure falls, but the displayed flow cannot change because the speed was not touched.',
          plausibility: 'reasonable-but-incomplete',
          rationale:
            'The first half holds. The second forgets that speed is a request: at the same speed the pump moves more when there is less in its way, and the display follows.',
        },
        {
          id: 'lower-until-lowest',
          label: 'Lower the resistance until the mean pressure is as low as it will go.',
          plausibility: 'unsafe',
          rationale:
            'A pressure can be lowered too far. The finding to follow is the display and the organs, not the lowest pressure the circulation will tolerate.',
        },
      ],
      correctChoiceIds: ['larger-rise-pressure-falls'],
      explanation:
        'A continuous-flow pump delivers more against less. With the circulation less stiff, the same speed moves more blood, the display rises by more than the speed change managed, and the pressure falls at the same time — the pressure improvement and the perfusion improvement finally pointing the same way. Model boundary: the resistance here is one slider; which drug, how much and how quickly are bedside decisions this module does not make, and a pressure can be lowered too far.',
      evidenceIds: [...lvadSources],
      reviewStatus: 'draft',
    }),
  },
]

export const mcsStoryProblems: readonly McsStoryProblem[] = Object.freeze(authored)

export function mcsStoryProblemsFor(sectionId: string): readonly McsStoryProblem[] {
  return mcsStoryProblems.filter((story) => story.sectionId === sectionId)
}

export interface McsStoryRun {
  readonly before: McsSimulationState
  readonly after: McsSimulationState
}

/** Settle a state for a few seconds of simulated time so the fixed-step model has caught up. */
function settle(state: McsSimulationState, seconds = 5): McsSimulationState {
  let next = state
  const steps = Math.round(seconds / 0.25)
  for (let index = 0; index < steps; index += 1) {
    next = mcsReducer(next, { type: 'TICK', seconds: 0.25 })
  }
  return next
}

/**
 * Run a story on a separate copy of the circulation: the colleague's starting point, then the one
 * change, each settled. Pure over the story, so the panel and the test read the same run.
 */
export function runMcsStory(story: McsStoryProblem): McsStoryRun {
  let state = createInitialMcsState('learn', story.device)
  for (const action of story.setup) state = mcsReducer(state, action)
  const before = settle(state)
  let changed = before
  for (const action of story.change) changed = mcsReducer(changed, action)
  const after = settle(changed)
  return { before, after }
}

export function validateMcsStoryProblems(): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const story of mcsStoryProblems) {
    if (ids.has(story.id)) errors.push(`duplicate story id ${story.id}`)
    ids.add(story.id)
    if (story.readings.length !== 4) errors.push(`${story.id}: the story must name four readings`)
    if (!story.axisVerdict.trim()) errors.push(`${story.id}: axisVerdict is empty`)
    if (story.change.length === 0) errors.push(`${story.id}: the colleague did nothing`)
  }
  return errors
}

const storyErrors = validateMcsStoryProblems()
if (storyErrors.length > 0) {
  throw new Error(`mcsStoryProblems registry invalid:\n${storyErrors.join('\n')}`)
}
