import type { SiteAnalyticsPayload } from '@/lib/analytics'

import { clinicalPracticeScenarios } from '../content/clinicalCases'
import { orderedCaseScenarioIds } from '../content/curriculum'
import type {
  GuidedLessonDefinition,
  ModuleSection,
  ProgressV2,
  ScenarioDefinition,
  ScenarioOutcome,
  SimulationMode,
  SupportMode,
} from '../engine'

/**
 * The site-analytics payloads the ECMO module emits, built as data.
 *
 * `/api/analytics` validates these shapes strictly, so the strings below — the `section`
 * conventions (`${stationId}`, `${supportMode}:${section}`, `${supportMode}:mastery`,
 * `${supportMode}:capstone-unlocked`) and every `completionId` — are a cross-module contract.
 * They were previously written inline in the workbench; lifting them into pure functions lets a
 * test pin them without mounting a workspace, and lets the Learn stage and the Practice activity
 * share one definition instead of two copies that could drift.
 */

export const ECMO_MODULE_ID = 'cardiohelp-ecmo'

export type EcmoSiteEvent = Omit<SiteAnalyticsPayload, 'routePath'>

export const REQUIRED_SCENARIO_IDS_BY_MODE: Readonly<Record<SupportMode, readonly string[]>> = {
  vv: orderedCaseScenarioIds('vv'),
  va: orderedCaseScenarioIds('va'),
}

export function hasModeMastery(progress: ProgressV2, supportMode: SupportMode): boolean {
  return REQUIRED_SCENARIO_IDS_BY_MODE[supportMode].every(
    (id) =>
      progress.completedLabs.includes(id) &&
      (progress.bestScores[id] ?? 0) >= 80 &&
      progress.criticalErrorStatus[id] !== true,
  )
}

export function guidedLessonLoadedEvent(
  lesson: Pick<GuidedLessonDefinition, 'scenarioId' | 'supportMode'>,
): EcmoSiteEvent {
  return {
    eventType: 'module_interaction',
    moduleId: ECMO_MODULE_ID,
    section: 'learn',
    eventPayload: {
      interaction: 'guided_lesson_loaded',
      scenarioId: lesson.scenarioId,
      supportMode: lesson.supportMode,
      experience: 'learn',
    },
  }
}

export function practiceScenarioLoadedEvent(
  definition: Pick<ScenarioDefinition, 'id' | 'supportMode' | 'stationId'>,
  simulationMode: SimulationMode,
): EcmoSiteEvent {
  return {
    eventType: 'module_interaction',
    moduleId: ECMO_MODULE_ID,
    section: definition.stationId,
    eventPayload: {
      interaction: 'practice_scenario_loaded',
      scenarioId: definition.id,
      supportMode: definition.supportMode,
      experience: 'practice',
      simulationMode,
    },
  }
}

export function supportModeSelectedEvent(
  nextMode: SupportMode,
  section: ModuleSection,
): EcmoSiteEvent {
  return {
    eventType: 'module_interaction',
    moduleId: ECMO_MODULE_ID,
    section: `${nextMode}:${section}`,
    eventPayload: {
      interaction: 'support_mode_selected',
      supportMode: nextMode,
      experience: section,
    },
  }
}

export function capstoneUnlockedEvent(supportMode: SupportMode): EcmoSiteEvent {
  return {
    eventType: 'section_completed',
    moduleId: ECMO_MODULE_ID,
    section: `${supportMode}:capstone-unlocked`,
    eventPayload: {
      completionId: `cardiohelp-ecmo-${supportMode}-capstone-unlocked-v1`,
      supportMode,
      experience: 'learn',
    },
  }
}

export function guidedWalkthroughCompletedEvent(
  scenarioId: string,
  supportMode: SupportMode,
): EcmoSiteEvent {
  return {
    eventType: 'module_interaction',
    moduleId: ECMO_MODULE_ID,
    section: 'learn',
    eventPayload: {
      interaction: 'guided_walkthrough_completed',
      scenarioId,
      supportMode,
      experience: 'learn',
    },
  }
}

export interface RoundSubmittedInput {
  readonly current: ProgressV2
  readonly next: ProgressV2
  readonly scenario: Pick<ScenarioDefinition, 'id' | 'supportMode' | 'stationId'>
  readonly outcome: Pick<ScenarioOutcome, 'score' | 'criticalErrors' | 'mastery'>
}

/**
 * Everything a revealed debrief reports, in emission order: the round itself, then the station,
 * track and module completions that this round was the one to finish.
 */
export function roundSubmittedEvents({
  current,
  next,
  scenario,
  outcome,
}: RoundSubmittedInput): readonly EcmoSiteEvent[] {
  const events: EcmoSiteEvent[] = []
  const modeScenarios = REQUIRED_SCENARIO_IDS_BY_MODE[scenario.supportMode]
  const modeCompletedCount = modeScenarios.filter((id) => next.completedLabs.includes(id)).length
  const modePercentComplete = Math.round((modeCompletedCount / modeScenarios.length) * 100)
  const modeWasMastered = hasModeMastery(current, scenario.supportMode)
  const modeIsMastered = hasModeMastery(next, scenario.supportMode)
  const moduleWasMastered = hasModeMastery(current, 'vv') && hasModeMastery(current, 'va')
  const moduleIsMastered = hasModeMastery(next, 'vv') && hasModeMastery(next, 'va')
  const aggregateCompletedCount = clinicalPracticeScenarios.filter((item) =>
    next.completedLabs.includes(item.id),
  ).length
  const rawAggregatePercent = Math.round(
    (aggregateCompletedCount / clinicalPracticeScenarios.length) * 100,
  )
  const aggregatePercentComplete = moduleIsMastered ? 100 : Math.min(rawAggregatePercent, 99)

  events.push({
    eventType: 'quiz_submitted',
    moduleId: ECMO_MODULE_ID,
    section: `${scenario.supportMode}:${scenario.stationId}`,
    percentComplete: aggregatePercentComplete,
    eventPayload: {
      scenarioId: scenario.id,
      supportMode: scenario.supportMode,
      experience: 'practice',
      score: outcome.score,
      criticalErrorCount: outcome.criticalErrors.length,
      roundMastery: outcome.mastery,
      modeMastery: modeIsMastered,
      modePercentComplete,
      aggregatePercentComplete,
    },
  })

  const stationScenarioIds = clinicalPracticeScenarios
    .filter(
      (item) => item.stationId === scenario.stationId && item.supportMode === scenario.supportMode,
    )
    .map((item) => item.id)
  const stationWasComplete = stationScenarioIds.every((id) => current.completedLabs.includes(id))
  const stationIsComplete = stationScenarioIds.every((id) => next.completedLabs.includes(id))
  if (!stationWasComplete && stationIsComplete) {
    events.push({
      eventType: 'section_completed',
      moduleId: ECMO_MODULE_ID,
      section: `${scenario.supportMode}:${scenario.stationId}`,
      eventPayload: {
        completionId: `${scenario.supportMode}-${scenario.stationId}-complete`,
        supportMode: scenario.supportMode,
        experience: 'practice',
      },
    })
  }
  if (!modeWasMastered && modeIsMastered) {
    events.push({
      eventType: 'section_completed',
      moduleId: ECMO_MODULE_ID,
      section: `${scenario.supportMode}:mastery`,
      eventPayload: {
        completionId: `cardiohelp-ecmo-${scenario.supportMode}-mastery-v1`,
        supportMode: scenario.supportMode,
        experience: 'practice',
        modePercentComplete: 100,
      },
    })
  }
  if (!moduleWasMastered && moduleIsMastered) {
    events.push({
      eventType: 'module_completed',
      moduleId: ECMO_MODULE_ID,
      percentComplete: 100,
      eventPayload: {
        completionId: 'cardiohelp-ecmo-vv-va-mastery-v1',
        supportMode: scenario.supportMode,
        experience: 'practice',
        masteredSupportModes: ['vv', 'va'],
      },
    })
  }
  return events
}
