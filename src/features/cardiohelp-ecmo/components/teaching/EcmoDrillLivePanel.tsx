import { cardiohelpScenarioById } from '../../content/scenarios'
import type { EcmoSimulationState, SupportMode } from '../../engine/types'
import {
  OxygenatorResistanceLivePanel,
  ReturnObstructionLivePanel,
} from './drills/PostPumpResistancePanel'
import { VaLvLoadingLivePanel } from './drills/VaLvLoadingPanel'
import { hasEcmoDrillTeachingPanel } from './EcmoDrillTeachingPanel'

/**
 * Scenario id → the live readings panel for that guided drill.
 *
 * Six drills carry an authored teaching panel, which stands in for their explanation
 * (`EcmoDrillTeachingPanel`). The other fourteen show the explanation written from their own
 * data, with nothing live beside it. These are the first of those to gain a live panel, for the
 * three patterns a November 2026 learner review found hardest to see: left-ventricular loading on
 * VA, and return obstruction and oxygenator resistance on both tracks. A live panel sits above the
 * written explanation and leaves it as it was.
 *
 * Keyed on the scenario the engine has loaded, as the authored registry is: a transfer step loads a
 * different case, and this drill's readings must not be drawn over that case's circuit.
 */
export type EcmoDrillLivePanelScenarioId =
  | 'va-lv-loading'
  | 'afterload-return-obstruction'
  | 'va-afterload-arterial-return-obstruction'
  | 'afterload-oxygenator-resistance'
  | 'va-afterload-oxygenator-resistance'

interface LivePanelEntry {
  readonly supportMode: SupportMode
  readonly Panel: (props: { readonly state: EcmoSimulationState }) => React.JSX.Element
}

const livePanels: Readonly<Record<EcmoDrillLivePanelScenarioId, LivePanelEntry>> = {
  'va-lv-loading': { supportMode: 'va', Panel: VaLvLoadingLivePanel },
  'afterload-return-obstruction': { supportMode: 'vv', Panel: ReturnObstructionLivePanel },
  'va-afterload-arterial-return-obstruction': {
    supportMode: 'va',
    Panel: ReturnObstructionLivePanel,
  },
  'afterload-oxygenator-resistance': { supportMode: 'vv', Panel: OxygenatorResistanceLivePanel },
  'va-afterload-oxygenator-resistance': {
    supportMode: 'va',
    Panel: OxygenatorResistanceLivePanel,
  },
}

export const ecmoDrillLivePanelScenarioIds = Object.keys(
  livePanels,
) as readonly EcmoDrillLivePanelScenarioId[]

export function hasEcmoDrillLivePanel(
  scenarioId: string,
): scenarioId is EcmoDrillLivePanelScenarioId {
  return scenarioId in livePanels
}

/** Structural check, run at import so a mismatch fails loudly rather than rendering nothing. */
export function validateEcmoDrillLivePanelRegistry(): readonly string[] {
  const errors: string[] = []
  for (const [scenarioId, entry] of Object.entries(livePanels)) {
    const scenario = cardiohelpScenarioById.get(scenarioId)
    if (!scenario) {
      errors.push(`live panel registered for an id that is not an authored scenario: ${scenarioId}`)
      continue
    }
    if (scenario.supportMode !== entry.supportMode) {
      errors.push(
        `live panel declares ${entry.supportMode} but the scenario is ${scenario.supportMode}: ${scenarioId}`,
      )
    }
    // A drill has one or the other. Both would print two sets of readings for one circuit.
    if (hasEcmoDrillTeachingPanel(scenarioId)) {
      errors.push(`drill has an authored panel and a live panel: ${scenarioId}`)
    }
  }
  return errors
}

const registryErrors = validateEcmoDrillLivePanelRegistry()
if (registryErrors.length > 0) {
  throw new Error(`Invalid ECMO drill live-panel registry:\n- ${registryErrors.join('\n- ')}`)
}

/**
 * The live readings for whatever case the engine currently holds; nothing when it has none, or
 * when the circuit on screen is the other support configuration.
 */
export function EcmoDrillLivePanel({ state }: { readonly state: EcmoSimulationState }) {
  const scenarioId = state.scenario.scenarioId
  if (!hasEcmoDrillLivePanel(scenarioId)) return null
  const entry = livePanels[scenarioId]
  if (entry.supportMode !== state.supportMode) return null
  const { Panel } = entry
  return <Panel state={state} />
}
