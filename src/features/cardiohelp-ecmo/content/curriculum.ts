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
      title: 'Foundations & console orientation',
      summary:
        'Tour every console screen, sensor, and physical control, then initiate VV support for refractory ARDS from written case orders.',
      lessonScenarioIds: ['startup-sensor-orientation'],
      caseScenarioIds: ['clinical-vv-initiation-ards'],
    },
    {
      id: 'vv-2-drainage-preload',
      supportMode: 'vv',
      title: 'Drainage & preload',
      summary:
        'Recognize drainage collapse from pVen and chatter, then manage its two classic patient-level causes: occult hemorrhage and tension pneumothorax.',
      lessonScenarioIds: ['preload-drainage-collapse'],
      caseScenarioIds: ['clinical-vv-occult-hemorrhage', 'clinical-vv-tension-pneumothorax'],
    },
    {
      id: 'vv-3-afterload',
      supportMode: 'vv',
      title: 'Afterload & circuit resistance',
      summary:
        'Localize resistance to the return pathway or the membrane lung using the pressure pattern, then manage oxygenator thrombosis definitively.',
      lessonScenarioIds: ['afterload-return-obstruction', 'afterload-oxygenator-resistance'],
      caseScenarioIds: ['clinical-vv-oxygenator-thrombosis'],
    },
    {
      id: 'vv-4-recirculation',
      supportMode: 'vv',
      title: 'Oxygenation & recirculation',
      summary:
        'Separate effective support from displayed flow, and correct recirculation caused by cannula migration instead of chasing RPM.',
      lessonScenarioIds: ['vv-recirculation'],
      caseScenarioIds: ['clinical-vv-recirculation-migration'],
    },
    {
      id: 'vv-5-sweep',
      supportMode: 'vv',
      title: 'Sweep gas & CO₂',
      summary:
        'Use sweep — not blood flow — to control PaCO₂ and pH, and find gas-side failures when hypercapnia appears with a quiet pump.',
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
      title: 'Emergencies & transport',
      summary:
        'Respond to an arterial bubble stop with clamp isolation, manage a full circuit-air emergency, and handle AC power loss during transport.',
      lessonScenarioIds: ['arterial-bubble-stop', 'transport-power-loss'],
      caseScenarioIds: ['clinical-vv-circuit-air-embolism'],
    },
    {
      id: 'vv-7-capstone',
      supportMode: 'vv',
      title: 'VV capstone assessment',
      summary:
        'A masked scored scenario that combines drainage, sweep, and safety reasoning. Unlocks after every VV lesson is complete.',
      lessonScenarioIds: [],
      caseScenarioIds: [],
      capstoneScenarioId: 'vv-off-sweep-capstone',
    },
  ],
  va: [
    {
      id: 'va-1-foundations',
      supportMode: 'va',
      title: 'Foundations & console orientation',
      summary:
        'Tour the console in the VA configuration, then initiate peripheral VA support for refractory cardiogenic shock from written case orders.',
      lessonScenarioIds: ['va-startup-sensor-orientation'],
      caseScenarioIds: ['va-clinical-initiation-shock'],
    },
    {
      id: 'va-2-drainage-preload',
      supportMode: 'va',
      title: 'Drainage & preload',
      summary:
        'Recognize VA drainage collapse, then manage postcardiotomy tamponade — the obstructive cause that circuit adjustments cannot fix.',
      lessonScenarioIds: ['va-preload-drainage-collapse'],
      caseScenarioIds: ['va-clinical-tamponade'],
    },
    {
      id: 'va-3-afterload',
      supportMode: 'va',
      title: 'Afterload & hemodynamics',
      summary:
        'Localize circuit resistance, distinguish vasoplegia from inadequate flow, and exchange a thrombosed oxygenator before support collapses.',
      lessonScenarioIds: [
        'va-afterload-arterial-return-obstruction',
        'va-afterload-oxygenator-resistance',
      ],
      caseScenarioIds: ['va-clinical-vasoplegia', 'va-clinical-oxygenator-thrombosis'],
    },
    {
      id: 'va-4-differential-hypoxemia',
      supportMode: 'va',
      title: 'Differential hypoxemia',
      summary:
        'Protect cerebral and coronary oxygen delivery when recovering native ejection sends poorly oxygenated blood to the upper body.',
      lessonScenarioIds: ['va-differential-hypoxemia'],
      caseScenarioIds: ['va-clinical-differential-hypoxemia'],
    },
    {
      id: 'va-5-lv-loading-gas',
      supportMode: 'va',
      title: 'LV loading & gas exchange',
      summary:
        'Recognize concerning LV-loading cues on peripheral VA support and manage sweep-side hypercapnia and gas-source failures.',
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
      title: 'Complications, emergencies & transport',
      summary:
        'Manage cannulated-limb ischemia, an arterial bubble stop with clamp isolation, a circuit-air emergency, and AC power loss during transport.',
      lessonScenarioIds: ['va-arterial-bubble-stop', 'va-transport-power-loss'],
      caseScenarioIds: ['va-clinical-limb-ischemia', 'va-clinical-circuit-air-embolism'],
    },
    {
      id: 'va-7-capstone',
      supportMode: 'va',
      title: 'VA capstone assessment',
      summary:
        'A masked scored scenario that combines mixed-circulation and safety reasoning. Unlocks after every VA lesson is complete.',
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
        if (cardiohelpScenarioById.get(scenarioId)?.hiddenUntilAssessment) {
          errors.push(`${unit.id}: hidden capstone ${scenarioId} cannot be a lesson`)
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
        } else if (!capstone.hiddenUntilAssessment) {
          errors.push(`${unit.id}: capstone ${unit.capstoneScenarioId} must be hidden`)
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
