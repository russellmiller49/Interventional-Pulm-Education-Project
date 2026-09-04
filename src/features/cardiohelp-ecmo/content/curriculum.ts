import type { SupportMode } from '../engine/types'
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

  return errors
}
