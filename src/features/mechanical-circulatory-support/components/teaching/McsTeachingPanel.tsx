import { mcsLessons } from '../../content/lessons'
import { mcsCapstoneScenarios, mcsPracticeScenarios } from '../../content/scenarios'
import { DeviceSelectionIntegrationPanel } from './DeviceSelectionIntegrationPanel'
import { IabpEfficacyLimitsPanel } from './IabpEfficacyLimitsPanel'
import { IabpTimingTriggeringPanel } from './IabpTimingTriggeringPanel'
import { ImpellaSuctionPurgeRvPanel } from './ImpellaSuctionPurgeRvPanel'
import { ImpellaUnloadingPlacementPanel } from './ImpellaUnloadingPlacementPanel'
import { LvadAlarmsEmergenciesPanel } from './LvadAlarmsEmergenciesPanel'
import { LvadParametersAssessmentPanel } from './LvadParametersAssessmentPanel'
import { SignalToPerfusionPanel } from './SignalToPerfusionPanel'
import { SupportPathwayMechanismsPanel } from './SupportPathwayMechanismsPanel'
import type { McsTeachingPanelComponent, McsTeachingPanelProps } from './panelProps'

/**
 * Section id → live teaching panel. One entry per Learn section, one file per panel.
 *
 * There is no fallback and there is deliberately no way to add one. A generic panel would mean a
 * section whose teaching pane silently stopped being about that section — which is the failure this
 * registry exists to make impossible, and the reason the validation below throws at import rather
 * than letting a missing entry render an empty pane at a learner.
 *
 * Practice and Challenge scenarios never belong here. Registering one would take a case off the
 * workbench and put its id in a Learn-only lookup, so both catalogs are checked against the keys.
 */
const panels: Readonly<Record<string, McsTeachingPanelComponent>> = {
  'mcs-foundations-signals': SignalToPerfusionPanel,
  'mcs-foundations-mechanisms': SupportPathwayMechanismsPanel,
  'iabp-timing-triggering': IabpTimingTriggeringPanel,
  'iabp-efficacy-limits': IabpEfficacyLimitsPanel,
  'impella-unloading-placement': ImpellaUnloadingPlacementPanel,
  'impella-suction-purge-rv': ImpellaSuctionPurgeRvPanel,
  'lvad-parameters-assessment': LvadParametersAssessmentPanel,
  'lvad-alarms-emergencies': LvadAlarmsEmergenciesPanel,
  'mcs-device-selection-integration': DeviceSelectionIntegrationPanel,
}

/** The count is asserted rather than derived, so removing a section and its panel together fails. */
const EXPECTED_PANEL_COUNT = 9

export const mcsTeachingPanelSectionIds: readonly string[] = Object.keys(panels)

export function hasMcsTeachingPanel(sectionId: string): boolean {
  return sectionId in panels
}

export function validateMcsTeachingPanelRegistry(): readonly string[] {
  const errors: string[] = []
  const registered = Object.keys(panels)
  const known = mcsLessons.map((lesson) => lesson.id)

  for (const sectionId of known) {
    if (!(sectionId in panels)) errors.push(`Learn section has no teaching panel: ${sectionId}`)
  }
  for (const sectionId of registered) {
    if (!known.includes(sectionId)) {
      errors.push(
        `teaching panel registered for a section the catalog does not publish: ${sectionId}`,
      )
    }
  }
  if (registered.length !== known.length) {
    errors.push('the Learn section list and the teaching-panel registry differ in length')
  }
  if (registered.length !== EXPECTED_PANEL_COUNT) {
    errors.push(`expected ${EXPECTED_PANEL_COUNT} teaching panels, found ${registered.length}`)
  }
  if (registered.join(',') !== known.join(',')) {
    errors.push('teaching panels must be registered in pathway order, one per section')
  }

  // Two sections resolving to one component is the generic-fallback failure wearing a different hat.
  const components = new Set(Object.values(panels))
  if (components.size !== registered.length) {
    errors.push('two sections resolve to the same panel component')
  }

  for (const scenario of [...mcsPracticeScenarios, ...mcsCapstoneScenarios]) {
    if (scenario.id in panels) {
      errors.push(`a patient case is registered as a Learn teaching panel: ${scenario.id}`)
    }
  }

  return errors
}

const registryErrors = validateMcsTeachingPanelRegistry()
if (registryErrors.length > 0) {
  throw new Error(`Invalid MCS teaching-panel registry:\n- ${registryErrors.join('\n- ')}`)
}

/**
 * Renders the panel authored for this section.
 *
 * Throws rather than returning null for an unknown id: a Learn section with no live teaching is a
 * broken promise to the learner, and it should be a loud failure in a test rather than a quiet gap
 * on a screen.
 */
export function McsTeachingPanel(props: McsTeachingPanelProps) {
  const Panel = panels[props.contract.sectionId]
  if (!Panel) {
    throw new Error(`No MCS teaching panel registered for section ${props.contract.sectionId}`)
  }
  return <Panel {...props} />
}
