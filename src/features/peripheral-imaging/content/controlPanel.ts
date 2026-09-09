import { SOURCE_BY_ID } from '../data/sources'
import type { SourceId } from '../types'
import { imagingLearnerCopyErrors } from './learnerCopy'

/**
 * The small control panel: the five things you can change at the C-arm, said once in the
 * `good-image` section and shown as a strip on every Explain step.
 *
 * Collapsing a console to five things turns every later problem into "which of the five, if
 * any" — and "if any" matters, because several problems have no knob: the state has changed, or
 * the question needs a different measurement. The exposure is deliberately not on the list. The
 * machine sets it and the dose readout reports it; that is monitoring, and saying so is the
 * lesson.
 */
export const imagingControlIds = ['angle', 'field', 'time', 'acquisition', 'display'] as const

export type ImagingControlId = (typeof imagingControlIds)[number]

export interface ImagingControl {
  readonly id: ImagingControlId
  readonly plainName: string
  readonly changes: string
  readonly doesNotChange: string
  /** The lab control keys this thing covers, so a strip can light the dock it means. */
  readonly controlKeys: readonly string[]
}

export interface ImagingMonitoringItem {
  readonly id: 'exposure' | 'dose-readout'
  readonly plainName: string
  readonly sentence: string
}

export interface ImagingControlPanel {
  readonly controls: readonly ImagingControl[]
  readonly monitoring: readonly ImagingMonitoringItem[]
  /** The panel in one breath, in the grammar every section reuses. */
  readonly sentence: string
  readonly sourceIds: readonly SourceId[]
}

export const IMAGING_CONTROL_PANEL: ImagingControlPanel = {
  controls: [
    {
      id: 'angle',
      plainName: 'where the beam is aimed',
      changes: 'Which ray crosses the target, and therefore what overlaps it on the image.',
      doesNotChange: 'Where the tool is. A view change alters the evidence, not the needle.',
      controlKeys: ['orbit', 'tilt', 'acquisitionOrbit'],
    },
    {
      id: 'field',
      plainName: 'how wide it is',
      changes: 'How much tissue is irradiated and how much scatter is made; the collimator blades.',
      doesNotChange:
        'Which structures lie on a given ray. A narrow field cannot remove a rib from the ray it shares with the target.',
      controlKeys: ['field'],
    },
    {
      id: 'time',
      plainName: 'how time is sampled',
      changes:
        'How often a new measurement arrives and how long each one lasts: pulse rate and pulse width.',
      doesNotChange:
        'The display refresh, which can repeat or interpolate frames without measuring anything new.',
      controlKeys: ['rate', 'width'],
    },
    {
      id: 'acquisition',
      plainName: 'what acquisition you ask for',
      changes:
        'Whether one projection, a limited sweep or a full orbit is measured, and so how much depth information exists.',
      doesNotChange:
        'The anatomy being measured. A sweep of a collapsed lung is a sweep of a collapsed lung.',
      controlKeys: ['sweep', 'kind', 'captured'],
    },
    {
      id: 'display',
      plainName: 'what the display shows',
      changes:
        'How measured pixels are presented: zoom, window and level, an overlay drawn on top.',
      doesNotChange: 'What was measured. Zoom adds no photons and a window adds no information.',
      controlKeys: ['zoom', 'crop', 'overlay', 'showCurrent', 'slab'],
    },
  ],
  monitoring: [
    {
      id: 'exposure',
      plainName: 'the exposure',
      sentence:
        'Voltage, current and filtration are chosen by automatic exposure regulation to hold the detector signal. Not a setting you turn; the readout reports what the machine did.',
    },
    {
      id: 'dose-readout',
      plainName: 'the dose readout',
      sentence:
        'The kerma–area product and the reference air kerma accumulate as the machine fires. Not a setting; the place where output is judged, because the monitor cannot show it.',
    },
  ],
  sentence:
    'At the C-arm you change five things: where the beam is aimed, how wide it is, how time is sampled, what acquisition you ask for, and what the display shows. Everything else is monitoring: the machine sets the exposure, and the dose readout tells you what it did.',
  sourceIds: ['tg272', 'tg125', 'wabip'],
}

export type ControlStripState = 'this-one' | 'not-this-one' | 'harmful-reflex' | 'monitoring'

export type ControlStripVerdict =
  | 'this-control'
  | 'no-control-change-the-question'
  | 'no-control-change-the-measurement'

export interface ControlStrip {
  readonly verdict: ControlStripVerdict
  readonly states: Readonly<Record<ImagingControlId, ControlStripState>>
  /** The strip in one sentence. */
  readonly sentence: string
}

export function imagingControl(id: ImagingControlId): ImagingControl {
  const control = IMAGING_CONTROL_PANEL.controls.find((candidate) => candidate.id === id)
  if (!control) throw new Error(`Unknown control ${id}`)
  return control
}

export function validateImagingControlPanel(
  panel: ImagingControlPanel = IMAGING_CONTROL_PANEL,
): readonly string[] {
  const errors: string[] = []
  if (panel.controls.map((control) => control.id).join('|') !== imagingControlIds.join('|')) {
    errors.push('The panel does not list the five controls in order.')
  }
  for (const control of panel.controls) {
    const where = `Control ${control.id}`
    if (!panel.sentence.includes(control.plainName)) {
      errors.push(`The panel sentence does not name "${control.plainName}".`)
    }
    errors.push(
      ...imagingLearnerCopyErrors(`${where} plain name`, control.plainName),
      ...imagingLearnerCopyErrors(`${where} changes`, control.changes),
      ...imagingLearnerCopyErrors(`${where} does not change`, control.doesNotChange),
    )
    if (control.controlKeys.length === 0) errors.push(`${where} covers no lab control.`)
  }
  for (const item of panel.monitoring) {
    if (!/not a setting/i.test(item.sentence)) {
      errors.push(`Monitoring item ${item.id} must say it is not a setting.`)
    }
    errors.push(...imagingLearnerCopyErrors(`Monitoring ${item.id}`, item.sentence))
  }
  if (!/monitoring/i.test(panel.sentence)) {
    errors.push('The panel sentence must say that everything else is monitoring.')
  }
  errors.push(...imagingLearnerCopyErrors('The panel sentence', panel.sentence))
  for (const sourceId of panel.sourceIds) {
    if (!SOURCE_BY_ID.has(sourceId))
      errors.push(`The panel cites an unregistered source ${sourceId}.`)
  }
  return errors
}

const panelErrors = validateImagingControlPanel()
if (panelErrors.length > 0) {
  throw new Error(`The imaging control panel is invalid:\n${panelErrors.join('\n')}`)
}
