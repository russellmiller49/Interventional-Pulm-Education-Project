import {
  ecmoInteractiveFoundationSectionIds,
  isEcmoVaOnlyFoundationSectionId,
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
import { VaIntegrationCapstonePanel } from './VaIntegrationCapstonePanel'
import { VaNormalStatePanel } from './VaNormalStatePanel'
import { VaParallelPhysiologyPanel } from './VaParallelPhysiologyPanel'
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
 * Exactly the ten sections that open the live workspace belong here: the four shared by both tracks,
 * the three VV-only ones, and the three VA-only ones. The twenty scenario-backed drills never belong
 * here at all — registering one would silently take a Practice drill off the guided workbench.
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
  'va-parallel-physiology': VaParallelPhysiologyPanel,
  'va-normal-state': VaNormalStatePanel,
  'va-integration-capstone': VaIntegrationCapstonePanel,
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
  // Object keys cannot repeat, so a duplicate can only be a duplicate in the id list itself —
  // which means deduplicating that list before comparing it with the registry is precisely what
  // would hide one. The two questions are asked separately for that reason.
  if (
    new Set(ecmoInteractiveFoundationSectionIds).size !== ecmoInteractiveFoundationSectionIds.length
  ) {
    errors.push('the interactive section list repeats a section id')
  }
  if (ecmoInteractiveFoundationSectionIds.length !== registered.length) {
    errors.push('the interactive section list and the panel registry differ in length')
  }

  // The section records in `foundationLessons.ts` and the track-fixed id lists in the runtime are
  // two separate declarations of the same fact. A registered panel whose section record disagrees
  // with the list it was placed in would render one track's teaching over the other's circuit, so
  // the two are reconciled here rather than trusted to stay in step.
  for (const section of ecmoFoundationSections) {
    if (!(section.id in panels)) continue
    if (section.supportMode === 'va' && !isEcmoVaOnlyFoundationSectionId(section.id)) {
      errors.push(`VA section is registered but is not declared VA-only: ${section.id}`)
    }
    if (section.supportMode === 'vv' && !isEcmoVvOnlyFoundationSectionId(section.id)) {
      errors.push(`VV section is registered but is not declared VV-only: ${section.id}`)
    }
    if (section.supportMode === undefined && isEcmoVvOnlyFoundationSectionId(section.id)) {
      errors.push(`shared section is declared VV-only: ${section.id}`)
    }
    if (section.supportMode === undefined && isEcmoVaOnlyFoundationSectionId(section.id)) {
      errors.push(`shared section is declared VA-only: ${section.id}`)
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
