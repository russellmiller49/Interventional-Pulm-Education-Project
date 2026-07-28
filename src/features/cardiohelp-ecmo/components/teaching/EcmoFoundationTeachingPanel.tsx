import {
  ecmoSharedFoundationSectionIds,
  type EcmoSharedFoundationSectionId,
} from '../../content/foundationLessonRuntime'
import type { EcmoSimulationState } from '../../engine/types'
import { BloodFlowVsSweepPanel } from './BloodFlowVsSweepPanel'
import { CircuitFlowPathPanel } from './CircuitFlowPathPanel'
import { PumpPressureZonesPanel } from './PumpPressureZonesPanel'
import { WhyExtracorporealSupportPanel } from './WhyExtracorporealSupportPanel'

export interface EcmoFoundationTeachingPanelProps {
  readonly state: EcmoSimulationState
}

/**
 * Section id → panel. One entry per shared foundation lesson, one file per panel.
 *
 * Only the four track-shared sections belong here. The six track-specific foundation sections and
 * the twenty scenario-backed drills are deliberately absent, and a validator below proves it —
 * registering one early would silently change what its route renders.
 */
const panels: Readonly<
  Record<
    EcmoSharedFoundationSectionId,
    (props: EcmoFoundationTeachingPanelProps) => React.JSX.Element
  >
> = {
  'why-extracorporeal-support': WhyExtracorporealSupportPanel,
  'circuit-flow-path': CircuitFlowPathPanel,
  'pump-and-pressure-zones': PumpPressureZonesPanel,
  'blood-flow-versus-sweep': BloodFlowVsSweepPanel,
}

export const ecmoFoundationTeachingPanelSectionIds = Object.keys(
  panels,
) as readonly EcmoSharedFoundationSectionId[]

export function hasEcmoFoundationTeachingPanel(
  sectionId: string,
): sectionId is EcmoSharedFoundationSectionId {
  return sectionId in panels
}

/** Structural check, run at import so a mismatch fails loudly rather than rendering nothing. */
export function validateEcmoFoundationPanelRegistry(): readonly string[] {
  const errors: string[] = []
  for (const sectionId of ecmoSharedFoundationSectionIds) {
    if (!(sectionId in panels)) errors.push(`shared foundation section has no panel: ${sectionId}`)
  }
  for (const registered of Object.keys(panels)) {
    if (!(ecmoSharedFoundationSectionIds as readonly string[]).includes(registered)) {
      errors.push(`panel registered for a section outside the shared set: ${registered}`)
    }
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
}: {
  readonly sectionId: EcmoSharedFoundationSectionId
  readonly state: EcmoSimulationState
}) {
  const Panel = panels[sectionId]
  return <Panel state={state} />
}
