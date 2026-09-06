import {
  clinicalLearningItemSchema,
  type ClinicalLearningItem,
} from '@/features/learning-module/activity/clinicalLearningItem'

import {
  createLabSession,
  labSnapshot,
  learningLabReducer,
  type LabSession,
} from '../engine/learningLab'
import type { VentilationAction, VentilatorControlKey } from '../engine/types'
import type { LabMetric } from './learningExperiments'

/**
 * Two sixty-second story problems for the pair of controls learners most often confuse on the
 * ventilation axis: the oxygen knob reached for when the carbon dioxide is the problem, and the
 * rate knob reached for when the patient cannot empty. Each is a scenario in which the tempting
 * control visibly fails, and the verdict is derived from an engine run, not written from intention.
 *
 * Authored teaching constructs on the passive teaching patient; the numbers in a verdict are that
 * run's readings and nothing else.
 */

export interface VentilationStoryProblem {
  readonly id: string
  readonly unitId: string
  readonly title: string
  readonly scenario: string
  readonly item: ClinicalLearningItem
  /** The change the story's colleague makes, applied to a fresh passive patient. */
  readonly setup: readonly VentilationAction[]
  readonly change: readonly VentilationAction[]
  readonly seconds: number
  /** The three readings the verdict compares before and after. */
  readonly triad: readonly [LabMetric, LabMetric, LabMetric]
  /** The one-line lesson, naming the axis each control lives on. */
  readonly axisVerdict: string
}

const set = (control: VentilatorControlKey, value: number): VentilationAction => ({
  type: 'SET_CONTROL',
  control,
  value,
})

export const ventilationStoryProblems: readonly VentilationStoryProblem[] = [
  {
    id: 'oxygen-for-carbon-dioxide',
    unitId: 'ventilation-and-co2',
    title: 'The oxygen setting, for a carbon dioxide problem',
    scenario:
      'The modeled carbon dioxide on this passive patient is higher than the team wants. A colleague reaches for the oxygen and turns it up from forty to eighty per cent, then waits.',
    item: clinicalLearningItemSchema.parse({
      id: 'mv:story:oxygen-for-carbon-dioxide',
      activityId: 'ventilation:learn:ventilation-and-co2',
      phase: 'predict',
      itemType: 'response-prediction',
      contextRequirement: 'context-independent',
      stem: 'Over the next minute and a half, which reading moves?',
      choices: [
        {
          id: 'saturation',
          label: 'The saturation, and the carbon dioxide stays where it was',
          rationale:
            'Oxygen lives on the oxygenation axis. It changes what fraction of the gas is oxygen and nothing about how much gas is moved or how much reaches exchanging lung.',
          plausibility: 'best',
        },
        {
          id: 'carbon-dioxide',
          label: 'The carbon dioxide falls, and the saturation stays where it was',
          rationale:
            'This is the axis confusion the story exists for. Carbon dioxide follows the gas moved each minute, which the oxygen setting does not touch.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'both',
          label: 'Both move, because more oxygen means better gas exchange overall',
          rationale:
            'Oxygen uptake and carbon dioxide removal are separate processes with separate controls. One fraction changing does not move the other.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['saturation'],
      explanation:
        'The oxygen setting reaches the saturation and nothing on the ventilation axis. A carbon dioxide problem is a rate or breath-size problem, or an emptying problem.',
      evidenceIds: ['tobin-3e-setting-ventilator'],
      reviewStatus: 'draft',
    }),
    setup: [],
    change: [set('oxygenPercent', 80)],
    seconds: 90,
    triad: ['spo2', 'co2', 'minute'],
    axisVerdict: 'Oxygen is on the oxygenation axis. Carbon dioxide is on the ventilation axis.',
  },
  {
    id: 'rate-into-trapping',
    unitId: 'ventilation-and-co2',
    title: 'The rate setting, for a patient who cannot empty',
    scenario:
      'A passive patient with narrowed airways empties slowly. The carbon dioxide is high, so a colleague raises the rate from twelve to twenty-six breaths a minute, then waits.',
    item: clinicalLearningItemSchema.parse({
      id: 'mv:story:rate-into-trapping',
      activityId: 'ventilation:learn:ventilation-and-co2',
      phase: 'predict',
      itemType: 'response-prediction',
      contextRequirement: 'context-independent',
      stem: 'When the next breath starts, what is the expiratory flow doing?',
      choices: [
        {
          id: 'running',
          label: 'Still running when the next push begins',
          rationale:
            'More breaths a minute means less time for each expiration. In a system that empties slowly, the next push arrives while gas is still leaving, and the baseline the breath starts from creeps up.',
          plausibility: 'best',
        },
        {
          id: 'zero-sooner',
          label: 'Back at zero sooner, because the breaths now come faster and each one is smaller',
          rationale:
            'The size of each breath did not change; only how often one starts. Emptying takes the time it takes, and the rate has taken time away.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'unchanged',
          label: 'Unchanged — the rate only decides how many breaths there are',
          rationale:
            'The rate also decides how long each cycle lasts. The time between the end of one push and the start of the next is what the rate spends.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      correctChoiceIds: ['running'],
      explanation:
        'In a slowly emptying system, more rate means less time to empty. Read the expiratory flow at the moment the next breath starts before deciding whether more rate helped.',
      evidenceIds: ['tobin-3e-copd'],
      reviewStatus: 'draft',
    }),
    setup: [
      { type: 'SET_TEACHING_MECHANICS', overrides: { complianceScale: 1, resistanceScale: 4 } },
      set('ratePerMin', 12),
    ],
    change: [set('ratePerMin', 26)],
    seconds: 30,
    triad: ['expiratoryFlow', 'intrinsicPeep', 'co2'],
    axisVerdict:
      'The rate is on the ventilation axis, but it spends the time expiration needs. In a slowly emptying system it can take away more than it gives.',
  },
]

export function ventilationStoryProblemsFor(unitId: string): readonly VentilationStoryProblem[] {
  return ventilationStoryProblems.filter((story) => story.unitId === unitId)
}

export interface StoryRunResult {
  readonly before: Readonly<Record<LabMetric, number>>
  readonly after: Readonly<Record<LabMetric, number>>
}

function tick(session: LabSession, seconds: number): LabSession {
  let next = session
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.1) {
    next = learningLabReducer(next, { type: 'ENGINE', action: { type: 'TICK', seconds: 0.1 } })
  }
  return next
}

/**
 * Run the story on a fresh passive patient: settle, read the triad, make the colleague's change,
 * wait the story's interval, read again. Deterministic, so a test and the screen see the same run.
 */
export function runVentilationStory(story: VentilationStoryProblem): StoryRunResult {
  let session = createLabSession(story.unitId)
  session = learningLabReducer(session, { type: 'PREDICT' })
  session = learningLabReducer(session, { type: 'COMMIT', choice: 0, confidence: 'unsure' })
  for (const action of story.setup)
    session = learningLabReducer(session, { type: 'ENGINE', action })
  session = tick(session, 15)
  const before = labSnapshot(session.simulation).values
  for (const action of story.change)
    session = learningLabReducer(session, { type: 'ENGINE', action })
  session = tick(session, story.seconds)
  const after = labSnapshot(session.simulation).values
  return { before, after }
}
