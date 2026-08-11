import {
  cardiohelpLearnLessonByScenarioId,
  cardiohelpLearnLessons,
} from '../../content/learnLessons'
import { ecmoLearnPredictionFor } from '../../content/learnPredictionItems'
import { ecmoFoundationSections } from '../../content/foundationLessons'
import { cardiohelpScenarioById } from '../../content/scenarios'
import type { EcmoSimulationState, SupportMode } from '../../engine/types'
import { ArterialBubbleStopPanel } from './drills/ArterialBubbleStopPanel'
import { GasSourceInterruptionPanel } from './drills/GasSourceInterruptionPanel'
import { PreloadDrainageCollapsePanel } from './drills/PreloadDrainageCollapsePanel'
import {
  remainingVaDrillPanelComponents,
  type RemainingVaDrillPanelId,
} from './drills/RemainingVaDrillPanels'
import {
  remainingVvDrillPanelComponents,
  type RemainingVvDrillId,
} from './drills/RemainingVvDrillPanels'
import { StartupSensorOrientationPanel } from './drills/StartupSensorOrientationPanel'
import { VaDifferentialHypoxemiaPanel } from './drills/VaDifferentialHypoxemiaPanel'
import { VvRecirculationPanel } from './drills/VvRecirculationPanel'
import { styles } from './shared'

/**
 * Scenario id → the live teaching panel for that guided drill.
 *
 * The six B4/B5 pilot panels remain frozen. B6 adds fourteen visibly draft, non-credit panels. The
 * draft ids are not maintained by hand: they are derived below from all authored guided Learn
 * lessons minus the frozen six and fail closed unless the difference is exactly fourteen.
 *
 * Keyed on the scenario the *engine* has loaded rather than on the lesson the learner opened. A
 * transfer step loads a different case, and rendering this lesson's teaching over that case's
 * circuit would describe a circuit that is not on screen.
 */

export const ecmoFrozenPilotPanelScenarioIds = [
  'startup-sensor-orientation',
  'preload-drainage-collapse',
  'vv-recirculation',
  'gas-source-interruption',
  'arterial-bubble-stop',
  'va-differential-hypoxemia',
] as const

export type EcmoFrozenPilotPanelScenarioId = (typeof ecmoFrozenPilotPanelScenarioIds)[number]
export type EcmoDraftDrillPanelScenarioId = RemainingVvDrillId | RemainingVaDrillPanelId
export type EcmoDrillPanelScenarioId =
  | EcmoFrozenPilotPanelScenarioId
  | EcmoDraftDrillPanelScenarioId

export type EcmoDrillPanelReviewStatus = 'frozen-pilot' | 'draft'

interface DrillPanelEntry {
  /** Declared here as well as on the scenario, so the two are reconciled rather than assumed. */
  readonly supportMode: SupportMode
  readonly reviewStatus: EcmoDrillPanelReviewStatus
  readonly creditEligible: boolean
  readonly Panel: (props: { readonly state: EcmoSimulationState }) => React.JSX.Element
}

const frozenPilotPanels: Readonly<Record<EcmoFrozenPilotPanelScenarioId, DrillPanelEntry>> = {
  'startup-sensor-orientation': {
    supportMode: 'vv',
    reviewStatus: 'frozen-pilot',
    creditEligible: true,
    Panel: StartupSensorOrientationPanel,
  },
  'preload-drainage-collapse': {
    supportMode: 'vv',
    reviewStatus: 'frozen-pilot',
    creditEligible: true,
    Panel: PreloadDrainageCollapsePanel,
  },
  'vv-recirculation': {
    supportMode: 'vv',
    reviewStatus: 'frozen-pilot',
    creditEligible: true,
    Panel: VvRecirculationPanel,
  },
  'gas-source-interruption': {
    supportMode: 'vv',
    reviewStatus: 'frozen-pilot',
    creditEligible: true,
    Panel: GasSourceInterruptionPanel,
  },
  'arterial-bubble-stop': {
    supportMode: 'vv',
    reviewStatus: 'frozen-pilot',
    creditEligible: true,
    Panel: ArterialBubbleStopPanel,
  },
  'va-differential-hypoxemia': {
    supportMode: 'va',
    reviewStatus: 'frozen-pilot',
    creditEligible: true,
    Panel: VaDifferentialHypoxemiaPanel,
  },
}

const draftPanelComponents: Readonly<
  Record<EcmoDraftDrillPanelScenarioId, DrillPanelEntry['Panel']>
> = {
  ...remainingVvDrillPanelComponents,
  ...remainingVaDrillPanelComponents,
}

const draftPanels = Object.fromEntries(
  Object.entries(draftPanelComponents).map(([scenarioId, Panel]) => [
    scenarioId,
    {
      supportMode: scenarioId in remainingVvDrillPanelComponents ? 'vv' : 'va',
      reviewStatus: 'draft',
      creditEligible: false,
      Panel,
    } satisfies DrillPanelEntry,
  ]),
) as Readonly<Record<EcmoDraftDrillPanelScenarioId, DrillPanelEntry>>

const panels: Readonly<Record<EcmoDrillPanelScenarioId, DrillPanelEntry>> = {
  ...frozenPilotPanels,
  ...draftPanels,
}

/**
 * The B6 difference is derived from authored Learn content rather than copied into a second list.
 * The imported component maps remain independent declarations and are reconciled in validation.
 */
export const ecmoDraftDrillTeachingPanelScenarioIds = cardiohelpLearnLessons
  .map((lesson) => lesson.scenarioId)
  .filter(
    (scenarioId): scenarioId is EcmoDraftDrillPanelScenarioId =>
      !(ecmoFrozenPilotPanelScenarioIds as readonly string[]).includes(scenarioId),
  )

export const ecmoDrillTeachingPanelScenarioIds: readonly EcmoDrillPanelScenarioId[] = [
  ...ecmoFrozenPilotPanelScenarioIds,
  ...ecmoDraftDrillTeachingPanelScenarioIds,
]

export function ecmoDrillPanelMetadata(scenarioId: EcmoDrillPanelScenarioId) {
  const { supportMode, reviewStatus, creditEligible } = panels[scenarioId]
  return { supportMode, reviewStatus, creditEligible } as const
}

export function hasEcmoDrillTeachingPanel(
  scenarioId: string,
): scenarioId is EcmoDrillPanelScenarioId {
  return scenarioId in panels
}

/** Structural check, run at import so a mismatch fails loudly rather than rendering nothing. */
export function validateEcmoDrillPanelRegistry(): readonly string[] {
  const errors: string[] = []
  const registered = Object.keys(panels)
  const authored = cardiohelpLearnLessons.map((lesson) => lesson.scenarioId)
  const draftComponentIds = Object.keys(draftPanelComponents)

  if (ecmoFrozenPilotPanelScenarioIds.length !== 6) {
    errors.push('the frozen pilot id list is no longer exactly six')
  }
  if (ecmoDraftDrillTeachingPanelScenarioIds.length !== 14) {
    errors.push(
      `authored Learn ids minus the frozen pilots must equal fourteen, found ${ecmoDraftDrillTeachingPanelScenarioIds.length}`,
    )
  }
  if (authored.length !== 20) {
    errors.push(
      `the guided Learn registry must contain exactly twenty lessons, found ${authored.length}`,
    )
  }

  for (const scenarioId of ecmoDrillTeachingPanelScenarioIds) {
    if (!(scenarioId in panels)) errors.push(`guided Learn drill has no panel: ${scenarioId}`)
  }
  for (const id of registered) {
    if (!(ecmoDrillTeachingPanelScenarioIds as readonly string[]).includes(id)) {
      errors.push(`panel registered for a scenario outside authored guided Learn: ${id}`)
    }
  }
  // Object keys cannot repeat, so a duplicate can only be a duplicate in the id list — which means
  // deduplicating that list before comparing it with the registry is exactly what would hide one.
  if (
    new Set(ecmoDrillTeachingPanelScenarioIds).size !== ecmoDrillTeachingPanelScenarioIds.length
  ) {
    errors.push('the full panel id list repeats a scenario id')
  }
  if (ecmoDrillTeachingPanelScenarioIds.length !== registered.length) {
    errors.push('the full panel id list and registry differ in length')
  }
  if (
    [...authored].sort().join('\n') !== [...ecmoDrillTeachingPanelScenarioIds].sort().join('\n')
  ) {
    errors.push('the panel registry does not match all authored guided Learn ids')
  }
  if (
    [...draftComponentIds].sort().join('\n') !==
    [...ecmoDraftDrillTeachingPanelScenarioIds].sort().join('\n')
  ) {
    errors.push('the fourteen derived draft ids and imported draft component maps differ')
  }

  const foundationSectionIds = new Set(ecmoFoundationSections.map((section) => section.id))
  for (const [scenarioId, entry] of Object.entries(panels)) {
    const scenario = cardiohelpScenarioById.get(scenarioId)
    if (!scenario) {
      errors.push(`panel registered for an id that is not an authored scenario: ${scenarioId}`)
      continue
    }
    if (foundationSectionIds.has(scenarioId)) {
      errors.push(`foundation section is registered as a drill panel: ${scenarioId}`)
    }
    if (scenario.supportMode !== entry.supportMode) {
      errors.push(
        `panel declares ${entry.supportMode} but the scenario is ${scenario.supportMode}: ${scenarioId}`,
      )
    }
    const isFrozen = (ecmoFrozenPilotPanelScenarioIds as readonly string[]).includes(scenarioId)
    if (isFrozen && (entry.reviewStatus !== 'frozen-pilot' || !entry.creditEligible)) {
      errors.push(`frozen pilot metadata changed: ${scenarioId}`)
    }
    if (!isFrozen && (entry.reviewStatus !== 'draft' || entry.creditEligible)) {
      errors.push(`B6 panel is not draft and non-credit: ${scenarioId}`)
    }
    // A drill panel with no guided lesson could never be reached, and one with no authored
    // prediction has no commitment to withhold its mechanism behind.
    if (!cardiohelpLearnLessonByScenarioId.has(scenarioId)) {
      errors.push(`panel registered for a scenario with no guided Learn lesson: ${scenarioId}`)
    }
    if (!ecmoLearnPredictionFor(scenarioId)) {
      errors.push(`panel registered for a scenario with no authored prediction: ${scenarioId}`)
    }
  }

  // The reverse of the foundation registry's guard: a foundation section registered here would put
  // drill teaching on the guided workbench in place of the section's own panel.
  for (const section of ecmoFoundationSections) {
    if (section.id in panels)
      errors.push(`foundation section is registered as a panel: ${section.id}`)
  }

  return errors
}

const registryErrors = validateEcmoDrillPanelRegistry()
if (registryErrors.length > 0) {
  throw new Error(`Invalid ECMO drill panel registry:\n- ${registryErrors.join('\n- ')}`)
}

/**
 * The teaching pane's content for the guided drill Learn route.
 *
 * Renders the panel for whatever case the engine currently holds, and says so plainly when there is
 * none. All twenty authored guided Learn drills have panels on this branch. Transfer, Practice, and
 * assessment scenarios can still be loaded without one, and the neutral fallback refuses to
 * describe a case whose panel was not authored.
 */
export function EcmoDrillTeachingPanel({ state }: { readonly state: EcmoSimulationState }) {
  const scenarioId = state.scenario.scenarioId
  const entry = hasEcmoDrillTeachingPanel(scenarioId) ? panels[scenarioId] : undefined
  const scenario = cardiohelpScenarioById.get(scenarioId)

  // A VA panel rendered against a VV circuit — or the reverse — would describe a flow topology that
  // is not the one on screen, so the mismatch is refused rather than rendered.
  if (!entry || entry.supportMode !== state.supportMode) {
    return (
      <div className={styles.panel} data-drill-panel-unavailable={scenarioId}>
        <section className={styles.section} aria-labelledby="drill-panel-unavailable-heading">
          <h3 id="drill-panel-unavailable-heading" className={styles.heading}>
            No live teaching panel for this case
          </h3>
          <p className="mt-2">
            {scenario
              ? `The circuit on screen is running ${scenario.title}.`
              : 'The circuit on screen is running a case this panel does not recognise.'}{' '}
            {entry
              ? 'It has an authored panel, but for the other support configuration, so it is not shown against this circuit.'
              : 'A live teaching panel has not been authored for it yet.'}
          </p>
          <p className="mt-2 text-muted-foreground">
            The lesson step, the guided task, and the console beside it are unaffected. All twenty
            authored guided Learn drills have panels on this branch; other cases keep this neutral
            fallback rather than borrowing a panel.
          </p>
        </section>
      </div>
    )
  }

  const { Panel } = entry
  return <Panel state={state} />
}
