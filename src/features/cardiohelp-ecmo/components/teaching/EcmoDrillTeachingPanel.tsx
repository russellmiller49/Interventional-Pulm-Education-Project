import { cardiohelpLearnLessonByScenarioId } from '../../content/learnLessons'
import { ecmoLearnPredictionFor } from '../../content/learnPredictionItems'
import { ecmoFoundationSections } from '../../content/foundationLessons'
import { cardiohelpScenarioById } from '../../content/scenarios'
import type { EcmoSimulationState, SupportMode } from '../../engine/types'
import { ArterialBubbleStopPanel } from './drills/ArterialBubbleStopPanel'
import { GasSourceInterruptionPanel } from './drills/GasSourceInterruptionPanel'
import { PreloadDrainageCollapsePanel } from './drills/PreloadDrainageCollapsePanel'
import { StartupSensorOrientationPanel } from './drills/StartupSensorOrientationPanel'
import { VaDifferentialHypoxemiaPanel } from './drills/VaDifferentialHypoxemiaPanel'
import { VvRecirculationPanel } from './drills/VvRecirculationPanel'
import { styles } from './shared'

/**
 * Scenario id → the live teaching panel for that guided drill.
 *
 * This is the B4 pilot slice: six of the twenty drills, chosen so that between them they exercise
 * valid against unavailable signals, a normal startup and reference state, pressure–flow preload
 * physiology, displayed flow against effective flow, blood path against gas path, a safety-critical
 * air sequence, and peripheral venoarterial dual-circulation reasoning — across the device, circuit,
 * gas, and patient domains. The other fourteen deliberately have no panel yet and fall back to the
 * neutral card below rather than borrowing one.
 *
 * Keyed on the scenario the *engine* has loaded rather than on the lesson the learner opened. A
 * transfer step loads a different case, and rendering this lesson's teaching over that case's
 * circuit would describe a circuit that is not on screen.
 */

export type EcmoDrillPanelScenarioId =
  | 'startup-sensor-orientation'
  | 'preload-drainage-collapse'
  | 'vv-recirculation'
  | 'gas-source-interruption'
  | 'arterial-bubble-stop'
  | 'va-differential-hypoxemia'

interface DrillPanelEntry {
  /** Declared here as well as on the scenario, so the two are reconciled rather than assumed. */
  readonly supportMode: SupportMode
  readonly Panel: (props: { readonly state: EcmoSimulationState }) => React.JSX.Element
}

const panels: Readonly<Record<EcmoDrillPanelScenarioId, DrillPanelEntry>> = {
  'startup-sensor-orientation': { supportMode: 'vv', Panel: StartupSensorOrientationPanel },
  'preload-drainage-collapse': { supportMode: 'vv', Panel: PreloadDrainageCollapsePanel },
  'vv-recirculation': { supportMode: 'vv', Panel: VvRecirculationPanel },
  'gas-source-interruption': { supportMode: 'vv', Panel: GasSourceInterruptionPanel },
  'arterial-bubble-stop': { supportMode: 'vv', Panel: ArterialBubbleStopPanel },
  'va-differential-hypoxemia': { supportMode: 'va', Panel: VaDifferentialHypoxemiaPanel },
}

/**
 * The pilot ids, declared separately from the registry.
 *
 * Two declarations of the same fact, compared below. A single list that the registry was derived
 * from could not catch a panel silently added or dropped, which is the whole failure this slice is
 * meant to make loud.
 */
export const ecmoDrillTeachingPanelScenarioIds: readonly EcmoDrillPanelScenarioId[] = [
  'startup-sensor-orientation',
  'preload-drainage-collapse',
  'vv-recirculation',
  'gas-source-interruption',
  'arterial-bubble-stop',
  'va-differential-hypoxemia',
]

export function hasEcmoDrillTeachingPanel(
  scenarioId: string,
): scenarioId is EcmoDrillPanelScenarioId {
  return scenarioId in panels
}

/** Structural check, run at import so a mismatch fails loudly rather than rendering nothing. */
export function validateEcmoDrillPanelRegistry(): readonly string[] {
  const errors: string[] = []
  const registered = Object.keys(panels)

  for (const scenarioId of ecmoDrillTeachingPanelScenarioIds) {
    if (!(scenarioId in panels)) errors.push(`pilot drill has no panel: ${scenarioId}`)
  }
  for (const id of registered) {
    if (!(ecmoDrillTeachingPanelScenarioIds as readonly string[]).includes(id)) {
      errors.push(`panel registered for a scenario outside the pilot slice: ${id}`)
    }
  }
  // Object keys cannot repeat, so a duplicate can only be a duplicate in the id list — which means
  // deduplicating that list before comparing it with the registry is exactly what would hide one.
  if (
    new Set(ecmoDrillTeachingPanelScenarioIds).size !== ecmoDrillTeachingPanelScenarioIds.length
  ) {
    errors.push('the pilot id list repeats a scenario id')
  }
  if (ecmoDrillTeachingPanelScenarioIds.length !== registered.length) {
    errors.push('the pilot id list and the panel registry differ in length')
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
 * none. The fallback is deliberately not a smaller version of a panel: fourteen drills have no
 * authored teaching yet, and a generic card that looked like teaching would be indistinguishable
 * from one that had been written.
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
              : 'A live teaching panel has not been written for it yet.'}
          </p>
          <p className="mt-2 text-muted-foreground">
            The lesson step, the guided task, and the console beside it are unaffected. Six drills
            carry a live panel in this release; the rest are still to be written.
          </p>
        </section>
      </div>
    )
  }

  const { Panel } = entry
  return <Panel state={state} />
}
