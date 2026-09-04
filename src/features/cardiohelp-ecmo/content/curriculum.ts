import type { FaultId, SupportMode } from '../engine/types'
import {
  cardiohelpCapstonePrerequisiteIdsBySupportMode,
  cardiohelpScenarioById,
  isCardiohelpCapstoneUnlocked,
} from './scenarios'
import { cardiohelpLearnLessonByScenarioId } from './learnLessons'
import { clinicalPracticeScenarioById } from './clinicalCases'

/**
 * A themed curriculum unit pairing guided Learn lessons with the clinical
 * Practice cases that apply the same physiology. Units are the single source
 * of ordering for pickers, the Learn -> Practice bridge, the hub map, and the
 * capstone prerequisites. Lessons are referenced by their drill scenario id
 * (a guided lesson's `scenarioId`), cases by their clinical scenario id.
 *
 * A unit's title and summary are read on the hub before any of its drills is opened, so they name
 * what the learner will see and read — never a fault, its mechanism or the move that answers it.
 * `learn-precommit-leak.test.ts` holds each unit to the deny patterns of the drills it lists.
 */
export interface CurriculumUnit {
  id: string
  supportMode: SupportMode
  title: string
  summary: string
  lessonScenarioIds: readonly string[]
  caseScenarioIds: readonly string[]
  capstoneScenarioId?: string
}

export const cardiohelpCurriculum: Readonly<Record<SupportMode, readonly CurriculumUnit[]>> = {
  vv: [
    {
      id: 'vv-1-foundations',
      supportMode: 'vv',
      title: 'Foundations and the console',
      summary:
        'Why the support exists, a walk round the circuit, the pump and its pressures, the three controls and the normal run — then the console, and a first run brought up from written orders.',
      lessonScenarioIds: ['startup-sensor-orientation'],
      caseScenarioIds: ['clinical-vv-initiation-ards'],
    },
    {
      id: 'vv-2-drainage-preload',
      supportMode: 'vv',
      title: 'Reading a falling flow',
      summary:
        'A run that was steady is not any more. Read the flow, the drainage pressure and the line together, then carry the same reading into two bedside cases.',
      lessonScenarioIds: ['preload-drainage-collapse'],
      caseScenarioIds: ['clinical-vv-occult-hemorrhage', 'clinical-vv-tension-pneumothorax'],
    },
    {
      id: 'vv-3-afterload',
      supportMode: 'vv',
      title: 'Reading the two pressures',
      summary:
        'Two pressures sit either side of the membrane. Learn what it means when they move together and when they pull apart, then take that reading into a case.',
      lessonScenarioIds: ['afterload-return-obstruction', 'afterload-oxygenator-resistance'],
      caseScenarioIds: ['clinical-vv-oxygenator-thrombosis'],
    },
    {
      id: 'vv-4-recirculation',
      supportMode: 'vv',
      title: 'Reading the flow number against the patient',
      summary:
        'The flow number is up and the patient is worse. Decide what the number is worth before anything is changed, then work the case where it happens.',
      lessonScenarioIds: ['vv-recirculation'],
      caseScenarioIds: ['clinical-vv-recirculation-migration'],
    },
    {
      id: 'vv-5-sweep',
      supportMode: 'vv',
      title: 'Reading CO₂',
      summary:
        'Three runs where the CO₂ is the story: one climbing, one high but steady, and one where nothing on the pressure display has moved. Decide which of them calls for a setting change and which does not.',
      lessonScenarioIds: [
        'acute-hypercapnia',
        'compensated-hypercapnia',
        'gas-source-interruption',
      ],
      caseScenarioIds: ['clinical-vv-gas-disconnection'],
    },
    {
      id: 'vv-6-emergencies',
      supportMode: 'vv',
      title: 'When the pump stops or the power goes',
      summary:
        'A bubble alarm has stopped the pump; later, the console is on battery mid-transport. Tell what the device has done from what still has to be done, then work the air emergency as a case.',
      lessonScenarioIds: ['arterial-bubble-stop', 'transport-power-loss'],
      caseScenarioIds: ['clinical-vv-circuit-air-embolism'],
    },
    {
      id: 'vv-7-capstone',
      supportMode: 'vv',
      title: 'Integration challenge',
      summary:
        'One presentation, four explanations, and no scaffolding. Every drill on the track comes first.',
      lessonScenarioIds: [],
      caseScenarioIds: [],
      capstoneScenarioId: 'vv-off-sweep-capstone',
    },
  ],
  va: [
    {
      id: 'va-1-foundations',
      supportMode: 'va',
      title: 'Foundations and the console on VA',
      summary:
        'The shared physiology, then VA’s two extra ideas, then the same console on a circuit whose return goes to an artery — and a first run brought up from written orders.',
      lessonScenarioIds: ['va-startup-sensor-orientation'],
      caseScenarioIds: ['va-clinical-initiation-shock'],
    },
    {
      id: 'va-2-drainage-preload',
      supportMode: 'va',
      title: 'Reading a falling flow on VA',
      summary:
        'Flow falls, and this time the patient’s pressure falls with it. Read the flow, the drainage pressure and the patient together, then carry the reading into a case where the cause is not on the circuit.',
      lessonScenarioIds: ['va-preload-drainage-collapse'],
      caseScenarioIds: ['va-clinical-tamponade'],
    },
    {
      id: 'va-3-afterload',
      supportMode: 'va',
      title: 'Reading the two pressures beside the patient’s own',
      summary:
        'The two circuit pressures move, and the patient’s arterial line sits beside them on its own monitor. Read them together, then work two cases where the pressure and the flow disagree.',
      lessonScenarioIds: [
        'va-afterload-arterial-return-obstruction',
        'va-afterload-oxygenator-resistance',
      ],
      caseScenarioIds: ['va-clinical-vasoplegia', 'va-clinical-oxygenator-thrombosis'],
    },
    {
      id: 'va-4-differential-hypoxemia',
      supportMode: 'va',
      title: 'Reading two circulations',
      summary:
        'One saturation from the right arm, one from the groin, and a circuit that looks fine. Say what each sample reports before deciding whether the console can change it, then work the case.',
      lessonScenarioIds: ['va-differential-hypoxemia'],
      caseScenarioIds: ['va-clinical-differential-hypoxemia'],
    },
    {
      id: 'va-5-lv-loading-gas',
      supportMode: 'va',
      title: 'Reading CO₂ and the heart',
      summary:
        'A flat pulse under an acceptable pressure, a CO₂ that is climbing, and a gas transfer that falls while arterial flow holds. Three reads where the circuit display stays reassuring.',
      lessonScenarioIds: ['va-lv-loading', 'va-acute-hypercapnia', 'va-gas-source-interruption'],
      caseScenarioIds: [],
    },
    {
      // REVIEW: va-clinical-limb-ischemia is a cannulation-site perfusion
      // complication rather than an emergency drill; it lives here so the
      // vascular-complication case sits beside the other high-acuity content.
      // Move it to va-3-afterload if you prefer grouping by hemodynamics.
      id: 'va-6-complications',
      supportMode: 'va',
      title: 'When the pump stops or the power goes, on VA',
      summary:
        'A bubble alarm stops the pump on a circuit the circulation depends on; later, the console is on battery mid-transport. Say what each stop costs and what still has to be done, then work the limb and the air emergency as cases.',
      lessonScenarioIds: ['va-arterial-bubble-stop', 'va-transport-power-loss'],
      caseScenarioIds: ['va-clinical-limb-ischemia', 'va-clinical-circuit-air-embolism'],
    },
    {
      id: 'va-7-capstone',
      supportMode: 'va',
      title: 'Integration challenge',
      summary:
        'The same unchanged flow, with a second circulation to blame, and no scaffolding. Every drill on the track comes first.',
      lessonScenarioIds: [],
      caseScenarioIds: [],
      capstoneScenarioId: 'va-mixed-circulation-capstone',
    },
  ],
}

const allUnits: readonly CurriculumUnit[] = [...cardiohelpCurriculum.vv, ...cardiohelpCurriculum.va]

export const curriculumUnitById = new Map(allUnits.map((unit) => [unit.id, unit]))

export const unitIdByLessonScenarioId = new Map(
  allUnits.flatMap((unit) => unit.lessonScenarioIds.map((id) => [id, unit.id] as const)),
)

export const unitIdByCaseScenarioId = new Map(
  allUnits.flatMap((unit) => unit.caseScenarioIds.map((id) => [id, unit.id] as const)),
)

export function orderedLessonScenarioIds(supportMode: SupportMode): readonly string[] {
  return cardiohelpCurriculum[supportMode].flatMap((unit) => unit.lessonScenarioIds)
}

export function orderedCaseScenarioIds(supportMode: SupportMode): readonly string[] {
  return cardiohelpCurriculum[supportMode].flatMap((unit) => unit.caseScenarioIds)
}

export function pairedCaseIdsForLesson(lessonScenarioId: string): readonly string[] {
  const unitId = unitIdByLessonScenarioId.get(lessonScenarioId)
  return unitId ? (curriculumUnitById.get(unitId)?.caseScenarioIds ?? []) : []
}

export function pairedLessonIdsForCase(caseScenarioId: string): readonly string[] {
  const unitId = unitIdByCaseScenarioId.get(caseScenarioId)
  return unitId ? (curriculumUnitById.get(unitId)?.lessonScenarioIds ?? []) : []
}

/* ------------------------------------------------------------------ *
 * Learn -> Practice pairing by mechanism (I3f)
 * ------------------------------------------------------------------ */

/**
 * The mechanism a lesson teaches or a case applies, in one vocabulary for both.
 *
 * A unit groups by theme, and a theme is not a mechanism: the VA afterload unit holds a return-side
 * drill, a membrane drill, a vasoplegia case and a membrane case. Reading a lesson's paired case as
 * "the first case in its unit" sent the membrane drill to the vasoplegia case and the VA air drill
 * to the limb-ischemia case, each under the words "apply this in Practice". The bridge is truthful
 * only when the two sides name the same mechanism, so the mechanism is declared on both sides here
 * and the pairing is validated against it. Four of these keys are the four rows of the diagnostic
 * grammar in `localizationCards.ts`, under the same names.
 */
export type EcmoCaseMechanism =
  | 'initiation'
  | 'drainage-limitation'
  | 'return-path-resistance'
  | 'membrane-resistance'
  | 'recirculation'
  | 'acute-hypercapnia'
  | 'compensated-hypercapnia'
  | 'gas-path-failure'
  | 'circuit-air'
  | 'power-loss'
  | 'differential-hypoxemia'
  | 'lv-loading'
  | 'vasoplegia'
  | 'limb-ischemia'

/**
 * The mechanism a drill teaches, read from the fault its expectation corrects.
 *
 * Both tracks share these faults, so one map covers all twenty lessons without listing them.
 */
const mechanismByDrillFault: Readonly<Partial<Record<FaultId, EcmoCaseMechanism>>> = {
  'startup-inspection': 'initiation',
  'preload-limited': 'drainage-limitation',
  'return-obstruction': 'return-path-resistance',
  'oxygenator-resistance': 'membrane-resistance',
  recirculation: 'recirculation',
  'acute-hypercapnia': 'acute-hypercapnia',
  'compensated-hypercapnia': 'compensated-hypercapnia',
  'gas-source-interruption': 'gas-path-failure',
  'arterial-bubble': 'circuit-air',
  'ac-power-loss': 'power-loss',
  'differential-hypoxemia': 'differential-hypoxemia',
  'lv-loading': 'lv-loading',
}

/** The mechanism a lesson teaches, or null when its scenario corrects a fault with no mechanism. */
export function lessonMechanism(lessonScenarioId: string): EcmoCaseMechanism | null {
  const scenario = cardiohelpScenarioById.get(lessonScenarioId)
  return scenario ? (mechanismByDrillFault[scenario.expectation.correctiveFault] ?? null) : null
}

/**
 * The mechanism each Practice case applies. Authored, because a case's corrective fault names its
 * diagnosis (`hemorrhagic-hypovolemia`, `tamponade`) rather than the mechanism the diagnosis acts
 * through (a drainage limitation, in both). Every registered case must appear here.
 */
export const caseMechanismByCaseId: ReadonlyMap<string, EcmoCaseMechanism> = new Map<
  string,
  EcmoCaseMechanism
>([
  ['clinical-vv-initiation-ards', 'initiation'],
  ['clinical-vv-occult-hemorrhage', 'drainage-limitation'],
  ['clinical-vv-tension-pneumothorax', 'drainage-limitation'],
  ['clinical-vv-oxygenator-thrombosis', 'membrane-resistance'],
  ['clinical-vv-recirculation-migration', 'recirculation'],
  ['clinical-vv-gas-disconnection', 'gas-path-failure'],
  ['clinical-vv-circuit-air-embolism', 'circuit-air'],
  ['va-clinical-initiation-shock', 'initiation'],
  ['va-clinical-tamponade', 'drainage-limitation'],
  ['va-clinical-vasoplegia', 'vasoplegia'],
  ['va-clinical-oxygenator-thrombosis', 'membrane-resistance'],
  ['va-clinical-differential-hypoxemia', 'differential-hypoxemia'],
  ['va-clinical-limb-ischemia', 'limb-ischemia'],
  ['va-clinical-circuit-air-embolism', 'circuit-air'],
])

/**
 * The case that applies the mechanism a lesson taught, where its unit has one.
 *
 * Authored rather than derived so the pairing is readable in one place; `validateCurriculumRegistry`
 * holds every entry to the same unit, the same track and the same mechanism, and fails when a lesson
 * left off this map has a same-mechanism case sitting in its unit. Lessons absent here fall through
 * to `next-in-unit` or `none` in `pairedCaseForLesson`.
 */
export const pairedCaseIdByLessonScenarioId: ReadonlyMap<string, string> = new Map<string, string>([
  ['startup-sensor-orientation', 'clinical-vv-initiation-ards'],
  ['preload-drainage-collapse', 'clinical-vv-occult-hemorrhage'],
  ['afterload-oxygenator-resistance', 'clinical-vv-oxygenator-thrombosis'],
  ['vv-recirculation', 'clinical-vv-recirculation-migration'],
  ['gas-source-interruption', 'clinical-vv-gas-disconnection'],
  ['arterial-bubble-stop', 'clinical-vv-circuit-air-embolism'],
  ['va-startup-sensor-orientation', 'va-clinical-initiation-shock'],
  ['va-preload-drainage-collapse', 'va-clinical-tamponade'],
  ['va-afterload-oxygenator-resistance', 'va-clinical-oxygenator-thrombosis'],
  ['va-differential-hypoxemia', 'va-clinical-differential-hypoxemia'],
  ['va-arterial-bubble-stop', 'va-clinical-circuit-air-embolism'],
])

export type PairedCaseForLesson =
  /** A case in the lesson's unit that applies the mechanism the lesson taught. */
  | { readonly kind: 'mechanism-match'; readonly caseId: string }
  /** The unit's first case, offered as what comes next rather than as an application. */
  | { readonly kind: 'next-in-unit'; readonly caseId: string }
  /** The unit has no case. Three VA drills sit here until cases are authored for them. */
  | { readonly kind: 'none' }

/**
 * What the completion card may offer after a lesson, and what it may call it.
 *
 * The distinction is the copy's: "Apply this in Practice" is only true of a `mechanism-match`. A
 * `next-in-unit` case is still worth going to, and the card sends the learner there, but it says the
 * case applies a different mechanism rather than pretending otherwise.
 */
export function pairedCaseForLesson(lessonScenarioId: string): PairedCaseForLesson {
  const matched = pairedCaseIdByLessonScenarioId.get(lessonScenarioId)
  if (matched) return { kind: 'mechanism-match', caseId: matched }
  const [first] = pairedCaseIdsForLesson(lessonScenarioId)
  return first ? { kind: 'next-in-unit', caseId: first } : { kind: 'none' }
}

export function capstoneScenarioIdForMode(supportMode: SupportMode): string {
  const capstone = cardiohelpCurriculum[supportMode].find((unit) => unit.capstoneScenarioId)
  if (!capstone?.capstoneScenarioId) {
    throw new Error(`Missing capstone unit for support mode ${supportMode}`)
  }
  return capstone.capstoneScenarioId
}

/**
 * Minimal structural slice of ProgressV2 the curriculum needs, so pure
 * helpers and tests do not have to build a full progress object.
 */
export interface CurriculumProgressInput {
  completedLabs: readonly string[]
  completedLearnLessonIds: readonly string[]
}

/**
 * The stored capstone prerequisite list is the ten drill scenario ids per
 * track, and every drill is wrapped by exactly one Learn lesson keyed by the
 * same scenario id — so completing all of a track's lessons satisfies the
 * existing unlock check. Scored Practice completions count too.
 */
export function isTrackCapstoneUnlocked(
  progress: CurriculumProgressInput,
  supportMode: SupportMode,
): boolean {
  return isCardiohelpCapstoneUnlocked(
    [...progress.completedLabs, ...progress.completedLearnLessonIds],
    supportMode,
  )
}

export interface TrackMasteryInput extends CurriculumProgressInput {
  bestScores: Readonly<Record<string, number>>
  criticalErrorStatus: Readonly<Record<string, boolean>>
}

/** Mastery of a track's clinical cases: every case completed at >=80 with no standing critical error. */
export function hasTrackMastery(progress: TrackMasteryInput, supportMode: SupportMode): boolean {
  return orderedCaseScenarioIds(supportMode).every(
    (id) =>
      progress.completedLabs.includes(id) &&
      (progress.bestScores[id] ?? 0) >= 80 &&
      progress.criticalErrorStatus[id] !== true,
  )
}

export interface CapstonePrerequisite {
  scenarioId: string
  title: string
  unitId: string
}

export function remainingCapstonePrerequisites(
  progress: CurriculumProgressInput,
  supportMode: SupportMode,
): readonly CapstonePrerequisite[] {
  const completed = new Set([...progress.completedLabs, ...progress.completedLearnLessonIds])
  return cardiohelpCapstonePrerequisiteIdsBySupportMode[supportMode]
    .filter((scenarioId) => !completed.has(scenarioId))
    .map((scenarioId) => ({
      scenarioId,
      title:
        cardiohelpLearnLessonByScenarioId.get(scenarioId)?.title ??
        cardiohelpScenarioById.get(scenarioId)?.title ??
        scenarioId,
      unitId: unitIdByLessonScenarioId.get(scenarioId) ?? '',
    }))
}

export interface RecommendedActivity {
  kind: 'lesson' | 'case' | 'capstone'
  scenarioId: string
  unitId: string
}

/**
 * Walks the track in unit order: first incomplete lesson, then the unit's
 * first incomplete case, then the capstone once unlocked. Returns null when
 * the whole track (including the capstone) is complete.
 */
export function nextRecommendedActivity(
  progress: CurriculumProgressInput,
  supportMode: SupportMode,
): RecommendedActivity | null {
  const completedLessons = new Set(progress.completedLearnLessonIds)
  const completedCases = new Set(progress.completedLabs)
  for (const unit of cardiohelpCurriculum[supportMode]) {
    for (const scenarioId of unit.lessonScenarioIds) {
      if (!completedLessons.has(scenarioId)) {
        return { kind: 'lesson', scenarioId, unitId: unit.id }
      }
    }
    for (const scenarioId of unit.caseScenarioIds) {
      if (!completedCases.has(scenarioId)) {
        return { kind: 'case', scenarioId, unitId: unit.id }
      }
    }
    if (unit.capstoneScenarioId && !completedCases.has(unit.capstoneScenarioId)) {
      if (isTrackCapstoneUnlocked(progress, supportMode)) {
        return { kind: 'capstone', scenarioId: unit.capstoneScenarioId, unitId: unit.id }
      }
      return null
    }
  }
  return null
}

export function validateCurriculumRegistry(): string[] {
  const errors: string[] = []
  const capstoneIds = new Set(['vv-off-sweep-capstone', 'va-mixed-circulation-capstone'])

  for (const supportMode of ['vv', 'va'] as const) {
    const units = cardiohelpCurriculum[supportMode]
    const seenLessons = new Set<string>()
    const seenCases = new Set<string>()
    let capstoneCount = 0

    for (const unit of units) {
      if (unit.supportMode !== supportMode) {
        errors.push(`${unit.id}: filed under ${supportMode} but declares ${unit.supportMode}`)
      }
      if (!unit.title.trim() || !unit.summary.trim()) {
        errors.push(`${unit.id}: missing title or summary`)
      }
      for (const scenarioId of unit.lessonScenarioIds) {
        if (seenLessons.has(scenarioId)) {
          errors.push(`${unit.id}: lesson ${scenarioId} appears in more than one unit`)
        }
        seenLessons.add(scenarioId)
        const lesson = cardiohelpLearnLessonByScenarioId.get(scenarioId)
        if (!lesson) errors.push(`${unit.id}: no guided lesson wraps scenario ${scenarioId}`)
        if (lesson && lesson.supportMode !== supportMode) {
          errors.push(`${unit.id}: lesson ${scenarioId} belongs to ${lesson.supportMode}`)
        }
        if (capstoneIds.has(scenarioId) && lesson?.curriculumStage !== 'integration') {
          errors.push(
            `${unit.id}: capstone ${scenarioId} may only be listed as an integration-stage lesson`,
          )
        }
      }
      for (const scenarioId of unit.caseScenarioIds) {
        if (seenCases.has(scenarioId)) {
          errors.push(`${unit.id}: case ${scenarioId} appears in more than one unit`)
        }
        seenCases.add(scenarioId)
        const clinical = clinicalPracticeScenarioById.get(scenarioId)
        if (!clinical) errors.push(`${unit.id}: unknown clinical case ${scenarioId}`)
        if (clinical && clinical.supportMode !== supportMode) {
          errors.push(`${unit.id}: case ${scenarioId} belongs to ${clinical.supportMode}`)
        }
      }
      if (unit.capstoneScenarioId) {
        capstoneCount += 1
        const capstone = cardiohelpScenarioById.get(unit.capstoneScenarioId)
        if (!capstone) {
          errors.push(`${unit.id}: unknown capstone ${unit.capstoneScenarioId}`)
        } else if (!capstoneIds.has(capstone.id)) {
          errors.push(`${unit.id}: ${unit.capstoneScenarioId} is not a registered capstone`)
        }
        if (unit.lessonScenarioIds.length || unit.caseScenarioIds.length) {
          errors.push(`${unit.id}: capstone units cannot also list lessons or cases`)
        }
      }
    }

    if (capstoneCount !== 1) {
      errors.push(`${supportMode}: expected exactly one capstone unit, found ${capstoneCount}`)
    }

    for (const lesson of cardiohelpLearnLessonByScenarioId.values()) {
      if (lesson.supportMode === supportMode && !seenLessons.has(lesson.scenarioId)) {
        errors.push(`${supportMode}: lesson ${lesson.scenarioId} is missing from the curriculum`)
      }
    }
    for (const clinical of clinicalPracticeScenarioById.values()) {
      if (clinical.supportMode === supportMode && !seenCases.has(clinical.id)) {
        errors.push(`${supportMode}: case ${clinical.id} is missing from the curriculum`)
      }
    }
    for (const scenarioId of cardiohelpCapstonePrerequisiteIdsBySupportMode[supportMode]) {
      if (!seenLessons.has(scenarioId)) {
        errors.push(
          `${supportMode}: capstone prerequisite ${scenarioId} has no curriculum lesson, so the capstone could never unlock through Learn`,
        )
      }
    }
  }

  errors.push(...validatePracticePairing())

  return errors
}

/**
 * The mechanism pairing, held to the units on one side and the mechanisms on the other.
 *
 * Same unit and same track are the structural half; same mechanism is the half that makes the
 * completion card's "apply this" truthful. The completeness check closes the gap the first two leave
 * open: a lesson missing from the map would silently become `next-in-unit` even when a case that
 * applies its mechanism is sitting beside it. The two maps are parameters so a test can prove each
 * check bites; the registry validator calls it with the authored ones.
 */
export function validatePracticePairing(
  pairs: ReadonlyMap<string, string> = pairedCaseIdByLessonScenarioId,
  mechanisms: ReadonlyMap<string, EcmoCaseMechanism> = caseMechanismByCaseId,
): string[] {
  const errors: string[] = []

  for (const lesson of cardiohelpLearnLessonByScenarioId.values()) {
    if (lessonMechanism(lesson.scenarioId) === null) {
      errors.push(
        `pairing: lesson ${lesson.scenarioId} corrects a fault with no declared mechanism`,
      )
    }
  }
  for (const clinical of clinicalPracticeScenarioById.values()) {
    if (!mechanisms.has(clinical.id)) {
      errors.push(`pairing: case ${clinical.id} declares no mechanism`)
    }
  }
  for (const caseId of mechanisms.keys()) {
    if (!clinicalPracticeScenarioById.has(caseId)) {
      errors.push(`pairing: ${caseId} declares a mechanism but is not a registered case`)
    }
  }

  for (const [lessonId, caseId] of pairs) {
    const lessonUnitId = unitIdByLessonScenarioId.get(lessonId)
    const caseUnitId = unitIdByCaseScenarioId.get(caseId)
    if (!lessonUnitId) errors.push(`pairing: ${lessonId} is not a curriculum lesson`)
    if (!caseUnitId) errors.push(`pairing: ${caseId} is not a curriculum case`)
    if (lessonUnitId && caseUnitId && lessonUnitId !== caseUnitId) {
      errors.push(
        `pairing: ${lessonId} (${lessonUnitId}) is paired with ${caseId} (${caseUnitId}); a paired case sits in its lesson's unit`,
      )
    }
    const lesson = cardiohelpLearnLessonByScenarioId.get(lessonId)
    const clinical = clinicalPracticeScenarioById.get(caseId)
    if (lesson && clinical && lesson.supportMode !== clinical.supportMode) {
      errors.push(
        `pairing: ${lessonId} is on ${lesson.supportMode} but ${caseId} is on ${clinical.supportMode}`,
      )
    }
    const taught = lessonMechanism(lessonId)
    const applied = mechanisms.get(caseId)
    if (taught && applied && taught !== applied) {
      errors.push(`pairing: ${lessonId} teaches ${taught} but ${caseId} applies ${applied}`)
    }
  }

  for (const unit of allUnits) {
    for (const lessonId of unit.lessonScenarioIds) {
      if (pairs.has(lessonId)) continue
      const taught = lessonMechanism(lessonId)
      const unpaired = unit.caseScenarioIds.find(
        (caseId) => taught !== null && mechanisms.get(caseId) === taught,
      )
      if (unpaired) {
        errors.push(
          `pairing: ${lessonId} and ${unpaired} share the ${taught} mechanism in ${unit.id} but are not paired`,
        )
      }
    }
  }

  return errors
}
