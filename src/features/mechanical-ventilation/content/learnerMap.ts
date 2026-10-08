import type { VentilationAction } from '../engine/types'
import {
  ventilationLearningUnits,
  ventilationUnitById,
  type VentilationLearningUnit,
} from './learningCurriculum'
import { ventilationExperimentByUnit, type LabRound } from './learningExperiments'
import { ventilationFinalQuestions, type VentilationQuestion } from './learningQuestions'
import { mechanicalVentilationCases } from './runtimeCases'

/**
 * One learner map for Overview, Learn, Practice and Applications (MV-PRE-REVIEW-04).
 *
 * Before this file each surface named the same things its own way: Practice said a case "builds on
 * Lung protection" where Learn had called that section "Is this breath appropriate for this lung?";
 * Applications numbered its ten items 1–10 in an order unrelated to the fourteen sections; the hub
 * counted fifteen clinical cases where fourteen are live. Everything here is derived from the
 * registries — the curriculum, the case set and the question set — so a count or a name cannot be
 * typed twice. Nothing in this file is an id, a URL or a stored value: it is display only.
 */

/** The canonical position of a section, one-based. */
export function ventilationSectionNumber(unitId: string): number {
  const index = ventilationLearningUnits.findIndex((unit) => unit.id === unitId)
  if (index < 0) throw new Error(`Unknown ventilation section ${unitId}`)
  return index + 1
}

/** "Section 6 · Is this breath appropriate for this lung?" — the one name a section has. */
export function ventilationSectionLabel(unitId: string): string {
  const unit = ventilationUnitById.get(unitId)
  if (!unit) throw new Error(`Unknown ventilation section ${unitId}`)
  return `Section ${ventilationSectionNumber(unitId)} · ${unit.title}`
}

/* ------------------------------------------------------------------------------------------------
 * Cases: live, or held as a worked explanation
 * ---------------------------------------------------------------------------------------------- */

/**
 * Cases whose live simulation is withheld. MV-03 has been held since MV-01 (the paired-breath
 * intrinsic-PEEP display and its initialization are with ventilation faculty/RT review); it opens
 * as a worked explanation on every entry path. This list is the one place that says so: the case
 * activity, the hub's counts and the Practice index all read it.
 */
export const ventilationHeldLiveCaseIds: readonly string[] = ['MV-03']

export function isVentilationCaseLive(caseId: string): boolean {
  return !ventilationHeldLiveCaseIds.includes(caseId)
}

export interface VentilationCaseCounts {
  readonly entries: number
  readonly live: number
  readonly held: number
}

export function ventilationCaseCounts(): VentilationCaseCounts {
  const entries = mechanicalVentilationCases.length
  const held = mechanicalVentilationCases.filter((item) => !isVentilationCaseLive(item.id)).length
  return { entries, live: entries - held, held }
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/** "14 live cases and 1 worked explanation" — never "15 cases" for fifteen entries. */
export function ventilationCaseCountPhrase(): string {
  const { live, held } = ventilationCaseCounts()
  const liveText = plural(live, 'live case', 'live cases')
  return held > 0
    ? `${liveText} and ${plural(held, 'worked explanation', 'worked explanations')}`
    : liveText
}

/** What a held entry is called beside its title. */
export const VENTILATION_HELD_CASE_TAG = 'worked explanation · live simulation held for review'

/* ------------------------------------------------------------------------------------------------
 * Applications: which section each optional item actually exercises
 * ---------------------------------------------------------------------------------------------- */

/**
 * The section an Applications item is shown under and links back to, where that differs from the
 * section in its id (A2).
 *
 * `modes-and-breath-delivery:final` asks what changes when resistance rises at a fixed volume and
 * flow: the answer is the peak pressure, which is Section 4's teaching ("Where does the pressure
 * go?"), and its review link went to Section 5. The id, the stem, the choices, the key and the
 * cited evidence are unchanged — saved records and deep links keep their meaning — and only the
 * label and the review link move.
 */
const applicationConceptOverride: Readonly<Record<string, string>> = {
  'modes-and-breath-delivery:final': 'mechanics-load-and-pressure',
}

export function ventilationApplicationConceptUnit(
  question: VentilationQuestion,
): VentilationLearningUnit {
  const unitId = applicationConceptOverride[question.id] ?? question.unitId
  const unit = ventilationUnitById.get(unitId)
  if (!unit) throw new Error(`No section for application ${question.id}`)
  return unit
}

export interface VentilationApplicationCoverage {
  readonly items: number
  readonly sections: number
  /** Sections with at least one item, in canonical order. */
  readonly covered: readonly VentilationLearningUnit[]
  /** Sections with none. */
  readonly uncovered: readonly VentilationLearningUnit[]
}

export function ventilationApplicationCoverage(
  questions: readonly VentilationQuestion[] = ventilationFinalQuestions,
): VentilationApplicationCoverage {
  const coveredIds = new Set(questions.map((item) => ventilationApplicationConceptUnit(item).id))
  return {
    items: questions.length,
    sections: ventilationLearningUnits.length,
    covered: ventilationLearningUnits.filter((unit) => coveredIds.has(unit.id)),
    uncovered: ventilationLearningUnits.filter((unit) => !coveredIds.has(unit.id)),
  }
}

/** Why there are ten items for fourteen sections, said once and counted from the registry (A1). */
export function ventilationApplicationCoverageNote(
  questions: readonly VentilationQuestion[] = ventilationFinalQuestions,
): string {
  const coverage = ventilationApplicationCoverage(questions)
  const numbers = coverage.uncovered.map((unit) => ventilationSectionNumber(unit.id))
  const list =
    numbers.length <= 1
      ? numbers.join('')
      : `${numbers.slice(0, -1).join(', ')} and ${numbers.at(-1)}`
  const none =
    numbers.length === 0
      ? ''
      : ` ${numbers.length === 1 ? 'Section' : 'Sections'} ${list} ${numbers.length === 1 ? 'has' : 'have'} no item here; their experiments are in Learn.`
  return `${coverage.items} optional items, each labelled with the section it draws on. They are a selection, not a syllabus, and they are not one per section.${none}`
}

/* ------------------------------------------------------------------------------------------------
 * Parts of a section: what is the same and what is different
 * ---------------------------------------------------------------------------------------------- */

const TEACHING_PATIENT_ID = 'MV-LAB'

function patientPhrase(caseId: string): string {
  return caseId === TEACHING_PATIENT_ID
    ? 'the passive teaching patient'
    : `the simulated patient of case ${caseId}`
}

const controlWords: Readonly<Record<string, readonly [string, string]>> = {
  vtMl: ['tidal volume', 'mL'],
  peakFlowLMin: ['inspiratory flow', 'L/min'],
  ratePerMin: ['rate', '/min'],
  deltaPControlCmH2O: ['inspiratory pressure above PEEP', 'cmH₂O'],
  inspiratoryTimeSeconds: ['inspiratory time', 's'],
  oxygenPercent: ['oxygen', '%'],
  peepCmH2O: ['PEEP', 'cmH₂O'],
}

function setupPhrases(setup: readonly VentilationAction[] | undefined): readonly string[] {
  const phrases: string[] = []
  for (const action of setup ?? []) {
    if (action.type === 'SELECT_MODE') {
      phrases.push(action.mode === 'pressure-ac' ? 'pressure control' : `mode ${action.mode}`)
    } else if (action.type === 'SET_CONTROL') {
      const words = controlWords[action.control]
      const separator = words && (words[1] === '/min' || words[1] === '%') ? '' : ' '
      phrases.push(
        words
          ? `${words[0]} ${action.value}${separator}${words[1]}`
          : `${action.control} ${action.value}`,
      )
    } else if (action.type === 'SET_TEACHING_MECHANICS') {
      const { complianceScale = 1, resistanceScale = 1 } = action.overrides
      if (complianceScale !== 1) phrases.push(`simulated compliance ×${complianceScale}`)
      if (resistanceScale !== 1) phrases.push(`simulated airway resistance ×${resistanceScale}`)
    }
  }
  return phrases
}

function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}

/**
 * One line that says what a part starts from, derived from the round itself (N2, S6-3).
 *
 * "This original patient is making an inspiratory effort" did not say whether the patient was the
 * one from Part 1, and nothing said what had been set up. The patient is the round's `caseId`; the
 * starting changes are its `setup` actions; neither is authored a second time here. The last
 * sentence is what moving between parts has always done — it is stated, not changed.
 */
export function ventilationPartSetupLine(unitId: string, roundIndex: 0 | 1): string {
  const experiment = ventilationExperimentByUnit.get(unitId)
  if (!experiment) throw new Error(`Unknown ventilation section ${unitId}`)
  const round: LabRound = experiment.rounds[roundIndex]
  const other: LabRound = experiment.rounds[roundIndex === 0 ? 1 : 0]
  const changes = setupPhrases(round.setup)
  const starting =
    changes.length > 0
      ? ` It starts with ${joinList(changes)}.`
      : ' It starts from that patient’s own settings.'
  if (roundIndex === 0) return `Part 1 uses ${patientPhrase(round.caseId)}.${starting}`
  const same = round.caseId === other.caseId
  const who = same
    ? `the same simulated patient as Part 1 (${patientPhrase(round.caseId)})`
    : `a different simulated patient from Part 1: ${patientPhrase(round.caseId)}`
  return `Part 2 uses ${who}.${starting} It opens on a fresh, paused patient; the run and the captured breaths from Part 1 are not carried over.`
}

/** "Revisit · Section 4 · Where does the pressure go?, Part 2" with its authored note. */
export function ventilationRoundRelationLine(round: LabRound): string | null {
  const relation = round.relation
  if (!relation) return null
  const where = `${ventilationSectionLabel(relation.unitId)}${relation.part ? `, Part ${relation.part}` : ''}`
  const lead = relation.kind === 'revisit' ? `Revisit of ${where}.` : `Preview of ${where}.`
  return `${lead} ${relation.note}`
}

/* ------------------------------------------------------------------------------------------------
 * Time: an estimate, and what it does not include
 * ---------------------------------------------------------------------------------------------- */

/**
 * The simulated seconds a section's two optional experiments ask the learner to watch, from the
 * rounds' own intervals. This is model time at 1×: a faster clock shortens the wait, and reading,
 * choosing and holds are not counted. It is not a measured learner duration.
 */
export function ventilationExperimentSeconds(unitId: string): number {
  const experiment = ventilationExperimentByUnit.get(unitId)
  if (!experiment) throw new Error(`Unknown ventilation section ${unitId}`)
  return experiment.rounds.reduce((total, round) => total + round.seconds, 0)
}

export function ventilationSectionTimeLine(unitId: string): string {
  const unit = ventilationUnitById.get(unitId)
  if (!unit) throw new Error(`Unknown ventilation section ${unitId}`)
  const seconds = ventilationExperimentSeconds(unitId)
  const experiments =
    seconds > 0
      ? ` The optional experiments add about ${seconds} seconds of simulated time at 1×, less on a faster clock.`
      : ' The optional parts here have no timed run.'
  return `About ${unit.minutes} minutes to read: an author’s estimate, not timed with learners.${experiments}`
}
