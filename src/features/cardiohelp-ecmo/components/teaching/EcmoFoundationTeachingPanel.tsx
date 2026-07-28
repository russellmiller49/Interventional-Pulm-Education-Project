import {
  ecmoInteractiveFoundationSectionIds,
  isEcmoVvOnlyFoundationSectionId,
  type EcmoInteractiveFoundationSectionId,
} from '../../content/foundationLessonRuntime'
import { ecmoFoundationSections } from '../../content/foundationLessons'
import { cardiohelpScenarios } from '../../content/scenarios'
import type { EcmoSimulationState } from '../../engine/types'
import type { EcmoFoundationSnapshot } from '../../session/foundationSession'
import { BloodFlowVsSweepPanel } from './BloodFlowVsSweepPanel'
import { CircuitFlowPathPanel } from './CircuitFlowPathPanel'
import { PumpPressureZonesPanel } from './PumpPressureZonesPanel'
import { VvIntegrationCapstonePanel } from './VvIntegrationCapstonePanel'
import { VvNormalStatePanel } from './VvNormalStatePanel'
import { VvSeriesPhysiologyPanel } from './VvSeriesPhysiologyPanel'
import { WhyExtracorporealSupportPanel } from './WhyExtracorporealSupportPanel'

export interface EcmoFoundationTeachingPanelProps {
  readonly state: EcmoSimulationState
  /** A baseline captured in this session, for the panels that compare a circuit with itself. */
  readonly snapshot?: EcmoFoundationSnapshot | null
}

/**
 * Section id → panel. One entry per interactive foundation lesson, one file per panel.
 *
 * Exactly the seven sections that open the live workspace belong here: the four shared by both
 * tracks and the three VV-only ones. The three VA sections are deliberately absent and stay on the
 * prose route until their own package lands, and the twenty scenario-backed drills never belong
 * here at all — registering either early would silently change what a route renders.
 */
const panels: Readonly<
  Record<
    EcmoInteractiveFoundationSectionId,
    (props: EcmoFoundationTeachingPanelProps) => React.JSX.Element
  >
> = {
  'why-extracorporeal-support': WhyExtracorporealSupportPanel,
  'circuit-flow-path': CircuitFlowPathPanel,
  'pump-and-pressure-zones': PumpPressureZonesPanel,
  'blood-flow-versus-sweep': BloodFlowVsSweepPanel,
  'vv-series-physiology': VvSeriesPhysiologyPanel,
  'vv-normal-state': VvNormalStatePanel,
  'vv-integration-capstone': VvIntegrationCapstonePanel,
}

export const ecmoFoundationTeachingPanelSectionIds = Object.keys(
  panels,
) as readonly EcmoInteractiveFoundationSectionId[]

export function hasEcmoFoundationTeachingPanel(
  sectionId: string,
): sectionId is EcmoInteractiveFoundationSectionId {
  return sectionId in panels
}

/** Structural check, run at import so a mismatch fails loudly rather than rendering nothing. */
export function validateEcmoFoundationPanelRegistry(): readonly string[] {
  const errors: string[] = []
  const registered = Object.keys(panels)

  for (const sectionId of ecmoInteractiveFoundationSectionIds) {
    if (!(sectionId in panels)) {
      errors.push(`interactive foundation section has no panel: ${sectionId}`)
    }
  }
  for (const id of registered) {
    if (!(ecmoInteractiveFoundationSectionIds as readonly string[]).includes(id)) {
      errors.push(`panel registered for a section outside the interactive set: ${id}`)
    }
  }
  // Object keys cannot repeat, so a duplicate would have to be a duplicate in the id list itself.
  if (new Set(ecmoInteractiveFoundationSectionIds).size !== registered.length) {
    errors.push('the interactive section list and the panel registry differ in length')
  }

  // A VA-only foundation section registered here would take a VA lesson off its prose route.
  for (const section of ecmoFoundationSections) {
    if (
      section.supportMode === 'va' &&
      section.id in panels &&
      !isEcmoVvOnlyFoundationSectionId(section.id)
    ) {
      errors.push(`VA-only foundation section is registered: ${section.id}`)
    }
  }

  // A drill scenario registered here would take a Practice drill off the guided workbench.
  for (const scenario of cardiohelpScenarios) {
    if (scenario.id in panels)
      errors.push(`drill scenario is registered as a panel: ${scenario.id}`)
  }

  return errors
}

const registryErrors = validateEcmoFoundationPanelRegistry()
if (registryErrors.length > 0) {
  throw new Error(`Invalid ECMO foundation panel registry:\n- ${registryErrors.join('\n- ')}`)
}

export function EcmoFoundationTeachingPanel({
  sectionId,
  state,
  snapshot,
}: {
  readonly sectionId: EcmoInteractiveFoundationSectionId
  readonly state: EcmoSimulationState
  readonly snapshot?: EcmoFoundationSnapshot | null
}) {
  const Panel = panels[sectionId]
  return <Panel state={state} snapshot={snapshot} />
}
