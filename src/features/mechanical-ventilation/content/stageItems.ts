import {
  clinicalLearningItemSchema,
  type ClinicalLearningItem,
} from '@/features/learning-module/activity/clinicalLearningItem'

import { breathStopIds, type BreathStopId } from './breathSpine'
import { ventilationUnitById } from './learningCurriculum'
import { ventilationExperimentByUnit, type LabRound } from './learningExperiments'

/**
 * The stage's answerable items, derived from the experiment rounds and validated at import.
 *
 * Each experiment round authors a prediction as a prompt, three choices, a keyed index and three
 * rationales. The stage renders predictions through the shared verdict component, which takes the
 * module-wide `ClinicalLearningItem` shape — so each round becomes one item here, once, and the
 * schema's learner-copy lint runs over every stem, label and rationale before anything renders.
 *
 * Two further item kinds are authored in this file rather than derived: the location items that
 * are answered by pointing at a stop on the breath map, and the settings sort that the
 * control-panel section commits as a set.
 */

const CHOICE_IDS = ['a', 'b', 'c'] as const

export function ventilationRoundItemId(unitId: string, roundIndex: 0 | 1): string {
  return `mv:${unitId}:round-${roundIndex + 1}`
}

function roundItem(unitId: string, roundIndex: 0 | 1, round: LabRound): ClinicalLearningItem {
  const unit = ventilationUnitById.get(unitId)
  if (!unit) throw new Error(`Unknown unit ${unitId}`)
  const item = {
    id: ventilationRoundItemId(unitId, roundIndex),
    activityId: `ventilation:learn:${unitId}`,
    phase: 'predict' as const,
    itemType: 'response-prediction' as const,
    contextRequirement: 'context-independent' as const,
    stem: round.prompt,
    choices: round.choices.map((label, index) => ({
      id: CHOICE_IDS[index],
      label,
      rationale: round.rationales[index],
      plausibility: index === round.correct ? ('best' as const) : ('incorrect-mechanism' as const),
    })),
    correctChoiceIds: [CHOICE_IDS[round.correct]],
    explanation: round.explanation,
    evidenceIds: unit.evidenceIds,
    reviewStatus: 'draft' as const,
  }
  return clinicalLearningItemSchema.parse(item)
}

const roundItems = new Map<string, ClinicalLearningItem>()
for (const [unitId, experiment] of ventilationExperimentByUnit) {
  experiment.rounds.forEach((round, index) => {
    const roundIndex = index as 0 | 1
    roundItems.set(ventilationRoundItemId(unitId, roundIndex), roundItem(unitId, roundIndex, round))
  })
}

export function ventilationRoundItem(unitId: string, roundIndex: 0 | 1): ClinicalLearningItem {
  const item = roundItems.get(ventilationRoundItemId(unitId, roundIndex))
  if (!item) throw new Error(`No prediction item for ${unitId} round ${roundIndex + 1}`)
  return item
}

/** The authored choice index behind a stage choice id, for the session's committed prediction. */
export function ventilationChoiceIndex(choiceId: string): number {
  const index = (CHOICE_IDS as readonly string[]).indexOf(choiceId)
  if (index < 0) throw new Error(`Unknown choice id ${choiceId}`)
  return index
}

export const ventilationRoundItems: readonly ClinicalLearningItem[] = [...roundItems.values()]

/* ------------------------------------------------------------------------------------------------
 * Location items — answered by pointing at a stop on the breath map
 * ---------------------------------------------------------------------------------------------- */

export interface VentilationLocationItem {
  readonly unitId: string
  readonly item: ClinicalLearningItem
  /** Every choice is a stop; the mapping is total over the choices. */
  readonly targets: Readonly<Record<string, BreathStopId>>
}

const stopChoiceLabel: Readonly<Record<BreathStopId, string>> = {
  trigger: 'At the start of the breath — the trigger',
  inspiration: 'During the push — inspiration',
  cycling: 'At the switch — cycling to expiration',
  expiration: 'During emptying — expiration',
}

function locationItem(
  unitId: string,
  caseId: string,
  stem: string,
  keyed: BreathStopId,
  rationales: Readonly<Record<BreathStopId, string>>,
  explanation: string,
): VentilationLocationItem {
  const unit = ventilationUnitById.get(unitId)
  if (!unit) throw new Error(`Unknown unit ${unitId}`)
  const targets: Record<string, BreathStopId> = {}
  const choices = breathStopIds.map((stopId) => {
    const id = `stop-${stopId}`
    targets[id] = stopId
    return {
      id,
      label: stopChoiceLabel[stopId],
      rationale: rationales[stopId],
      plausibility: stopId === keyed ? ('best' as const) : ('incorrect-mechanism' as const),
    }
  })
  const item = clinicalLearningItemSchema.parse({
    id: `mv:${unitId}:where:${caseId}`,
    activityId: `ventilation:learn:${unitId}`,
    phase: 'recognize',
    itemType: 'signal-recognition',
    contextRequirement: 'context-independent',
    stem,
    choices,
    correctChoiceIds: [`stop-${keyed}`],
    explanation,
    evidenceIds: unit.evidenceIds,
    reviewStatus: 'draft',
  })
  return { unitId, item, targets }
}

/**
 * Three "where on the breath?" questions, one per application-style section whose patient shows a
 * mismatch. The learner has watched the patient for a few breaths; before predicting what a change
 * will do, they say where on the breath the problem lives — by choosing the stop on the map.
 */
export const ventilationLocationItems: readonly VentilationLocationItem[] = [
  locationItem(
    'triggering-and-cycling',
    'MV-07',
    'Watch this patient for several breaths. Some efforts on the dashed effort trace are not followed by a machine breath. Where on the breath does the mismatch live?',
    'trigger',
    {
      trigger:
        'The efforts that go unanswered are at the start of the breath: the patient asks and the machine does not begin. That is a trigger problem, and the next question is why the effort does not reach the trigger.',
      inspiration:
        'Once a breath has started, its push is delivered as set. The efforts you are looking for never reach that stage — nothing was delivered at all.',
      cycling:
        'The switch to expiration is happening at the machine’s usual time on the breaths that are delivered. The finding is breaths that never began.',
      expiration:
        'Emptying is not where an unanswered effort shows. Look at what happens just before a machine breath should have started.',
    },
    'An effort with no breath is a mismatch at the trigger — the start. Naming the place first tells you which settings and which patient factors are even candidates.',
  ),
  locationItem(
    'waveform-reading-sequence',
    'MV-08',
    'The displayed rate is higher than the set rate, and several machine breaths arrive with no preceding effort on the dashed trace. Where on the breath does the extra breath come from?',
    'trigger',
    {
      trigger:
        'A breath that starts with no effort is a trigger that was crossed by something other than the patient. The place is the start of the breath; the cause is then sought in what else can cross a trigger.',
      inspiration:
        'The push of each extra breath looks like any other push. The question is why it began, and that is decided before inspiration.',
      cycling: 'These breaths end normally. What is abnormal is that they started.',
      expiration:
        'Emptying is unremarkable here. The extra breaths are a matter of what starts a breath.',
    },
    'Breaths with no effort are a trigger-stop finding. Reading the start of every breath against the effort trace is the discriminating observation this section builds on.',
  ),
  locationItem(
    'dyssynchrony-mechanisms',
    'MV-11',
    'This patient starts each supported breath, but the early pressure trace climbs slowly toward its target while the patient keeps pulling. Where on the breath does the mismatch live?',
    'inspiration',
    {
      trigger:
        'The breath does start when the patient asks — the trigger is being met. What follows the start is where the pressure and the effort part company.',
      inspiration:
        'During the push, the delivered pressure lags behind the demand: the shape of the early inspiration is where the mismatch shows.',
      cycling:
        'The breath ends at a reasonable moment for this patient. The complaint is about how the push arrives, not how it ends.',
      expiration: 'Emptying is not the problem here. Look at the first part of the push.',
    },
    'A slow early pressure rise while the patient pulls is a mismatch during the push — inspiration. Localizing it there is what makes the pressurization setting a candidate and the trigger setting not one.',
  ),
]

export const ventilationLocationItemByUnit: ReadonlyMap<string, VentilationLocationItem> = new Map(
  ventilationLocationItems.map((entry) => [entry.unitId, entry]),
)

/* ------------------------------------------------------------------------------------------------
 * The settings sort — you set it, or the patient reports it
 * ---------------------------------------------------------------------------------------------- */

export type VentilationValueOrigin = 'set' | 'reported'

export interface VentilationSettingSortRow {
  readonly id: string
  /** The value as the console shows it. */
  readonly label: string
  readonly origin: VentilationValueOrigin
  readonly rationale: string
}

export interface VentilationSettingSort {
  readonly unitId: string
  readonly prompt: string
  readonly origins: Readonly<Record<VentilationValueOrigin, string>>
  readonly rows: readonly VentilationSettingSortRow[]
}

/**
 * Six values from the screen, two pairs of which look alike on purpose. A learner who has
 * understood that a setting is a request and a measurement is the result separates the set tidal
 * volume from the exhaled one and the set rate from the total; one who reads labels as numbers
 * does not.
 */
export const ventilationSettingSort: VentilationSettingSort = {
  unitId: 'controls-and-goals',
  prompt:
    'Six values from this screen. For each one, decide whether you set it or the patient and machine report it.',
  origins: {
    set: 'You set it — a request',
    reported: 'Reported — the result',
  },
  rows: [
    {
      id: 'set-vt',
      label: 'Tidal volume, on the settings row',
      origin: 'set',
      rationale: 'The set tidal volume is your request for each mandatory breath.',
    },
    {
      id: 'exhaled-vt',
      label: 'Exhaled tidal volume (VTE), on the monitoring screen',
      origin: 'reported',
      rationale:
        'The exhaled volume is what came back. It can differ from the request with a leak, a pressure limit, or a patient who breathes on their own.',
    },
    {
      id: 'set-rate',
      label: 'Rate, on the settings row',
      origin: 'set',
      rationale:
        'The set rate is how often the machine will start a breath if the patient does not.',
    },
    {
      id: 'total-rate',
      label: 'Total rate (fTotal), on the monitoring screen',
      origin: 'reported',
      rationale:
        'The total rate counts every breath, including the ones the patient started. It is higher than the set rate whenever the patient triggers.',
    },
    {
      id: 'peak',
      label: 'Peak pressure (Ppeak), on the monitoring screen',
      origin: 'reported',
      rationale:
        'In a volume breath the peak is the cost of delivering the volume you asked for. You do not set it; you read it.',
    },
    {
      id: 'peep',
      label: 'PEEP, on the settings row',
      origin: 'set',
      rationale: 'PEEP is the baseline you chose for the breath to rest at.',
    },
  ],
}

{
  const ids = new Set(ventilationSettingSort.rows.map((row) => row.id))
  if (ids.size !== ventilationSettingSort.rows.length) throw new Error('Duplicate sort row id')
  const origins = new Set(ventilationSettingSort.rows.map((row) => row.origin))
  if (origins.size !== 2) throw new Error('The sort must offer both origins')
}
