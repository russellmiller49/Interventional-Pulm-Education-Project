/**
 * Which surface leads each Learn section, authored once, in data.
 *
 * The workbench used to pick the pane it emphasized by string-matching the guided step's action id
 * — `inspect:*` meant the monitor, `device:select:*` meant the anatomy, everything else meant the
 * controls. That is a decision about *teaching* taken inside a component by looking at a device
 * name, and it produced sections whose emphasis had nothing to do with what the section was for.
 *
 * Here the choice is a row of data per section, and the component renders the row. Two things make
 * it fail closed rather than drift: the map must name every section the lesson catalog publishes and
 * no others, and every target must exist in one of the two surface registries below — so a target
 * cannot be renamed on one side of the boundary without breaking the build.
 *
 * The registries are not decorative. `McsMonitor` and `McsAnatomy3D` tag the corresponding regions
 * with `data-monitor-target` / `data-anatomy-target`, and a component test walks every section,
 * renders its authored starting state, and asserts the node is actually there. A registry entry with
 * no rendered node is a broken promise to the learner, not a naming inconsistency.
 */

import type { McsDeviceKind } from '../engine/types'
import { mcsLessons } from './lessons'

export type McsPrimarySurface = 'anatomy' | 'monitor'

export type McsAnatomyTargetId =
  | 'anatomy:support-pathway-overview'
  | 'anatomy:iabp-balloon-in-descending-aorta'
  | 'anatomy:left-pump-inlet-and-outlet'
  | 'anatomy:right-pump-caval-to-pulmonary-path'
  | 'anatomy:lvad-apical-inflow-and-aortic-outflow'

export type McsMonitorTargetId =
  | 'monitor:arterial-waveform'
  | 'monitor:flow-account'
  | 'monitor:filling-pressures'
  | 'monitor:power-pulsatility'
  | 'monitor:response-trend'
  | 'monitor:alarms'

export type McsPrimaryTargetId = McsAnatomyTargetId | McsMonitorTargetId

export interface McsSurfaceTarget {
  readonly id: McsPrimaryTargetId
  /** Shown on the primary pane as the highlighted region's name. */
  readonly label: string
  /**
   * The text equivalent for the highlight, so the emphasis is never carried by colour alone and a
   * screen-reader user is told the same thing a sighted learner is shown.
   */
  readonly textEquivalent: string
  /** Which device topologies actually render this target. Empty means every topology renders it. */
  readonly renderedForDevices: readonly McsDeviceKind[]
}

function anatomyTarget(
  id: McsAnatomyTargetId,
  label: string,
  textEquivalent: string,
  renderedForDevices: readonly McsDeviceKind[] = [],
): McsSurfaceTarget {
  return { id, label, textEquivalent, renderedForDevices }
}

function monitorTarget(
  id: McsMonitorTargetId,
  label: string,
  textEquivalent: string,
  renderedForDevices: readonly McsDeviceKind[] = [],
): McsSurfaceTarget {
  return { id, label, textEquivalent, renderedForDevices }
}

export const mcsAnatomyTargets: Readonly<Record<McsAnatomyTargetId, McsSurfaceTarget>> =
  Object.freeze({
    'anatomy:support-pathway-overview': anatomyTarget(
      'anatomy:support-pathway-overview',
      'Whole support pathway: where blood enters and where it returns',
      'The pathway summary beneath the model names the source compartment, the active component, and the destination compartment for the mechanism currently selected.',
    ),
    'anatomy:iabp-balloon-in-descending-aorta': anatomyTarget(
      'anatomy:iabp-balloon-in-descending-aorta',
      'Balloon in the descending thoracic aorta',
      'The balloon sits inside the descending thoracic aorta and displaces blood already there. No blood enters it and none returns from it.',
      ['iabp'],
    ),
    'anatomy:left-pump-inlet-and-outlet': anatomyTarget(
      'anatomy:left-pump-inlet-and-outlet',
      'Left-sided pump: inlet in the left ventricle, outlet in the ascending aorta',
      'The inlet sits below the aortic valve inside the left ventricle and the outlet sits above it in the ascending aorta. The placement state moves that relationship; the direction of blood travel does not change with it.',
      ['impella'],
    ),
    'anatomy:right-pump-caval-to-pulmonary-path': anatomyTarget(
      'anatomy:right-pump-caval-to-pulmonary-path',
      'Right-sided pump: inlet in the inferior vena cava, outlet in the pulmonary artery',
      'The right-sided pump draws from systemic venous blood and returns it to the pulmonary artery, bypassing the right ventricle. Its destination is the lung, not the systemic circulation.',
      ['impella'],
    ),
    'anatomy:lvad-apical-inflow-and-aortic-outflow': anatomyTarget(
      'anatomy:lvad-apical-inflow-and-aortic-outflow',
      'Durable pump: apical inflow, ascending-aortic outflow graft',
      'Inflow sits at the left ventricular apex, the pump is extracardiac, and the outflow graft returns blood to the ascending aorta.',
      ['lvad'],
    ),
  })

export const mcsMonitorTargets: Readonly<Record<McsMonitorTargetId, McsSurfaceTarget>> =
  Object.freeze({
    'monitor:arterial-waveform': monitorTarget(
      'monitor:arterial-waveform',
      'Arterial pressure trace',
      'The arterial strip shows the shape and timing of the pressure wave, including where an assisted beat differs from an unassisted one.',
    ),
    'monitor:flow-account': monitorTarget(
      'monitor:flow-account',
      'Flow account: native, displayed device, effective systemic',
      'Three separate flow readings sit side by side. Native is what the patient ejects, the device line is what the pump reports moving, and effective systemic is what reaches the circulation once the pathway has been accounted for.',
    ),
    'monitor:filling-pressures': monitorTarget(
      'monitor:filling-pressures',
      'Filling pressures: right atrial and wedge, with the pulmonary trace',
      'Right atrial pressure and wedge pressure are read together, because the relationship between them says which side of the heart is limiting delivery.',
    ),
    'monitor:power-pulsatility': monitorTarget(
      'monitor:power-pulsatility',
      'Durable-pump controller readout: power and pulsatility index',
      'Pump power and pulsatility index sit beside the flow the controller displays. The displayed flow is computed from power and speed, so these three move together only while the assumptions behind that computation hold.',
      ['lvad'],
    ),
    'monitor:response-trend': monitorTarget(
      'monitor:response-trend',
      'Response trend: mean pressure against effective systemic flow',
      'The trend plots mean arterial pressure and effective systemic flow on the same time axis, so a pressure that holds while flow falls is visible as two lines separating.',
    ),
    'monitor:alarms': monitorTarget(
      'monitor:alarms',
      'Alarm band and its interpretation',
      'The alarm band names each active modeled alarm with its priority, and the explanation beneath says what state produced it.',
    ),
  })

export function mcsSurfaceTarget(
  surface: McsPrimarySurface,
  target: McsPrimaryTargetId,
): McsSurfaceTarget | undefined {
  return surface === 'anatomy'
    ? mcsAnatomyTargets[target as McsAnatomyTargetId]
    : mcsMonitorTargets[target as McsMonitorTargetId]
}

export interface McsSectionPrimarySurface {
  readonly sectionId: string
  readonly primarySurface: McsPrimarySurface
  readonly primaryTarget: McsPrimaryTargetId
  readonly primaryTargetLabel: string
  /** Why this section leads with anatomy rather than the monitor, or the other way round. */
  readonly primarySurfaceRationale: string
  /** The one-sentence form of the rationale a learner reads on the primary pane. */
  readonly whyThisView: string
}

/**
 * One row per Learn section, in pathway order.
 *
 * Anatomy leads where the immediate task is topological — where blood enters, where it returns,
 * which chamber is relieved, which one inherits the burden, where the inlet is sitting. The monitor
 * leads where the immediate task is a signal — timing, waveform shape, which flow line a number
 * belongs to, whether a pressure and a flow are moving together. Sections that contain both are
 * decided by the immediate objective, and the complementary half is carried in the teaching pane.
 */
export const mcsSectionPrimarySurfaces: readonly McsSectionPrimarySurface[] = Object.freeze([
  {
    sectionId: 'mcs-foundations-signals',
    primarySurface: 'monitor',
    primaryTarget: 'monitor:arterial-waveform',
    primaryTargetLabel: mcsMonitorTargets['monitor:arterial-waveform'].label,
    primarySurfaceRationale:
      'The whole section is about which question a reading answers. The pressure is read first, on its own, and the flow account stays covered until the learner has committed what it will show. Nothing in it turns on where a catheter is sitting.',
    whyThisView:
      'The monitor leads because this section separates a pressure from a flow, and the two sit next to each other on one screen.',
  },
  {
    sectionId: 'mcs-foundations-mechanisms',
    primarySurface: 'anatomy',
    primaryTarget: 'anatomy:support-pathway-overview',
    primaryTargetLabel: mcsAnatomyTargets['anatomy:support-pathway-overview'].label,
    primarySurfaceRationale:
      'The task is to trace source, active component, and destination for three mechanisms and say which of them moves blood at all. That is a statement about topology, and the pathway summary changes visibly as each mechanism is selected.',
    whyThisView:
      'The anatomy leads because the difference between these three mechanisms is where blood enters and where it returns, not which number is larger.',
  },
  {
    sectionId: 'iabp-timing-triggering',
    primarySurface: 'monitor',
    primaryTarget: 'monitor:arterial-waveform',
    primaryTargetLabel: mcsMonitorTargets['monitor:arterial-waveform'].label,
    primarySurfaceRationale:
      'Timing is only visible as a relationship between inflation, the dicrotic notch, and the next upstroke. The balloon does not move on screen when the timing changes; the arterial trace does.',
    whyThisView:
      'The monitor leads because a timing error is a shape on the arterial trace, and it is invisible anywhere else.',
  },
  {
    sectionId: 'iabp-efficacy-limits',
    primarySurface: 'monitor',
    primaryTarget: 'monitor:response-trend',
    primaryTargetLabel: mcsMonitorTargets['monitor:response-trend'].label,
    primarySurfaceRationale:
      'The section exists to show technically correct counterpulsation failing. That is two lines on one time axis coming apart — pressure holding while effective systemic flow falls — and it cannot be read from a single frozen frame or from the anatomy.',
    whyThisView:
      'The monitor leads because the ceiling of this mechanism shows up as mean pressure and effective flow moving apart over time.',
  },
  {
    sectionId: 'impella-unloading-placement',
    primarySurface: 'anatomy',
    primaryTarget: 'anatomy:left-pump-inlet-and-outlet',
    primaryTargetLabel: mcsAnatomyTargets['anatomy:left-pump-inlet-and-outlet'].label,
    primarySurfaceRationale:
      'Placement is the subject. Whether the inlet is still in the ventricle and the outlet still in the aorta is an anatomical relationship, and the flow consequence follows from it rather than the other way round.',
    whyThisView:
      'The anatomy leads because this section is about where the inlet and outlet are sitting, and what a lost relationship costs.',
  },
  {
    sectionId: 'impella-suction-purge-rv',
    primarySurface: 'anatomy',
    primaryTarget: 'anatomy:right-pump-caval-to-pulmonary-path',
    primaryTargetLabel: mcsAnatomyTargets['anatomy:right-pump-caval-to-pulmonary-path'].label,
    primarySurfaceRationale:
      'The reason two pump flows must not be added is topological: the right-sided pump delivers into the lung and the left-sided pump draws from the left ventricle, so they handle the same blood one after the other. Showing the two pathways is what makes the arithmetic prohibition obvious; the numbers alone invite the error.',
    whyThisView:
      'The anatomy leads because the right-sided pump returns blood to the lung, not to the body — which is the whole reason its number is not a second systemic flow.',
  },
  {
    sectionId: 'lvad-parameters-assessment',
    primarySurface: 'monitor',
    primaryTarget: 'monitor:power-pulsatility',
    primaryTargetLabel: mcsMonitorTargets['monitor:power-pulsatility'].label,
    primarySurfaceRationale:
      'The claim being taught is that the displayed flow is computed from power and speed. Reading the controller values as one interdependent set requires them on screen together, and the pump does not change position while it is happening.',
    whyThisView:
      'The monitor leads because the displayed flow is calculated from power and speed, and you can only see that by watching all three at once.',
  },
  {
    sectionId: 'lvad-alarms-emergencies',
    primarySurface: 'monitor',
    primaryTarget: 'monitor:alarms',
    primaryTargetLabel: mcsMonitorTargets['monitor:alarms'].label,
    primarySurfaceRationale:
      'The section is about separating alarms that mean opposite loading conditions and recognizing a power pattern that needs urgent help. The alarm band and its interpretation are the object of study.',
    whyThisView:
      'The monitor leads because the alarm band and what produced it are what this section asks you to read.',
  },
  {
    sectionId: 'mcs-device-selection-integration',
    primarySurface: 'monitor',
    primaryTarget: 'monitor:filling-pressures',
    primaryTargetLabel: mcsMonitorTargets['monitor:filling-pressures'].label,
    primarySurfaceRationale:
      'Device selection follows the limiting problem, and the limiting problem is named from the relationship between right-sided and left-sided filling pressures. Naming a device first — which is what leading with the anatomy would invite — is the error this section exists to prevent.',
    whyThisView:
      'The monitor leads because the limiting problem is read from filling pressures, and the device follows the problem rather than choosing it.',
  },
])

export const mcsPrimarySurfaceBySectionId: ReadonlyMap<string, McsSectionPrimarySurface> = new Map(
  mcsSectionPrimarySurfaces.map((entry) => [entry.sectionId, entry]),
)

function validatePrimarySurfaces(): readonly string[] {
  const errors: string[] = []
  const authored = mcsSectionPrimarySurfaces.map((entry) => entry.sectionId)
  const known = mcsLessons.map((lesson) => lesson.id)

  for (const id of known) {
    if (!authored.includes(id)) errors.push(`no primary surface authored for section ${id}`)
  }
  for (const id of authored) {
    if (!known.includes(id)) errors.push(`primary surface authored for unknown section ${id}`)
  }
  if (new Set(authored).size !== authored.length) {
    errors.push('a section appears more than once, so it would carry more than one primary surface')
  }
  if (authored.join(',') !== known.join(',')) {
    errors.push('primary surfaces must be authored in pathway order')
  }

  for (const entry of mcsSectionPrimarySurfaces) {
    const target = mcsSurfaceTarget(entry.primarySurface, entry.primaryTarget)
    if (!target) {
      errors.push(
        `${entry.sectionId}: target ${entry.primaryTarget} does not exist on the ${entry.primarySurface} surface`,
      )
      continue
    }
    if (target.label !== entry.primaryTargetLabel) {
      errors.push(`${entry.sectionId}: primary target label disagrees with the surface registry`)
    }
    if (!entry.primarySurfaceRationale.trim()) {
      errors.push(`${entry.sectionId}: no rationale for the anatomy-versus-monitor choice`)
    }
    if (!entry.whyThisView.trim()) errors.push(`${entry.sectionId}: no learner-facing view reason`)
  }

  for (const [id, target] of Object.entries(mcsAnatomyTargets)) {
    if (target.id !== id) errors.push(`anatomy target ${id} disagrees with its own id`)
    if (!target.textEquivalent.trim()) errors.push(`anatomy target ${id}: no text equivalent`)
  }
  for (const [id, target] of Object.entries(mcsMonitorTargets)) {
    if (target.id !== id) errors.push(`monitor target ${id} disagrees with its own id`)
    if (!target.textEquivalent.trim()) errors.push(`monitor target ${id}: no text equivalent`)
  }

  return errors
}

const primarySurfaceErrors = validatePrimarySurfaces()
if (primarySurfaceErrors.length > 0) {
  throw new Error(`Invalid MCS primary-surface map:\n- ${primarySurfaceErrors.join('\n- ')}`)
}
