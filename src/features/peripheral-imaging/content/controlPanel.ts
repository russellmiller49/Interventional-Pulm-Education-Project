import { SOURCE_BY_ID } from '../data/sources'
import type { SourceId } from '../types'
import { imagingLearnerCopyErrors } from './learnerCopy'

/**
 * The fluoroscopy controls: the five things you control at the C-arm, taught in the `good-image`
 * section and shown as a strip on every Explain step.
 *
 * Naming the five turns every later problem into "which control, if any" — and "if any" matters,
 * because several problems have no control: the anatomy has changed, or the question needs a
 * different acquisition. Exposure factors are deliberately not on the list. Automatic exposure
 * regulation sets them and the dose readout reports them; that is monitoring, and saying so is the
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
      plainName: 'C-arm projection',
      changes:
        'which anatomy is superimposed on the lesion. Obliquity rotates the C-arm around the patient; cranial or caudal angulation tilts it along the body axis.',
      doesNotChange:
        'where the tool is. Changing the projection changes what the image shows, not the position of the needle.',
      controlKeys: ['orbit', 'tilt', 'acquisitionOrbit'],
    },
    {
      id: 'field',
      plainName: 'collimation',
      changes: 'the irradiated field, and with it the volume of tissue generating scatter.',
      doesNotChange:
        'what is superimposed on the lesion. Tighter collimation cannot remove a rib that shares the lesion’s projection.',
      controlKeys: ['field'],
    },
    {
      id: 'time',
      plainName: 'pulse rate and pulse width',
      changes:
        'how often a new image is acquired (pulse rate) and how long each exposure lasts (pulse width), which governs motion blur within a frame.',
      doesNotChange:
        'the display refresh rate, which can repeat or interpolate frames without acquiring anything new.',
      controlKeys: ['rate', 'width'],
    },
    {
      id: 'acquisition',
      plainName: 'the acquisition mode',
      changes:
        'whether you acquire a single fluoroscopic projection, a DTS acquisition or a CBCT spin, and therefore how much depth information exists.',
      doesNotChange:
        'the anatomy being imaged. A CBCT spin of an atelectatic segment shows an atelectatic segment.',
      controlKeys: ['sweep', 'kind', 'captured'],
    },
    {
      id: 'display',
      plainName: 'display zoom and processing',
      changes:
        'how acquired pixels are presented: display zoom, window/level, and overlays drawn on top.',
      doesNotChange:
        'what was acquired. Display zoom adds no X-ray information; acquisition magnification is a different control that can change the acquisition, the detector readout and the exposure.',
      controlKeys: ['zoom', 'crop', 'overlay', 'showCurrent', 'slab'],
    },
  ],
  monitoring: [
    {
      id: 'exposure',
      plainName: 'exposure factors',
      sentence:
        'kV, mA and pulse duration are selected by automatic exposure regulation to hold the detector signal. Not a setting you adjust directly; the dose readout reports what the system did.',
    },
    {
      id: 'dose-readout',
      plainName: 'the dose readout',
      sentence:
        'The kerma–area product and the cumulative reference air kerma accumulate with each exposure. Not a setting; it is where radiation output is judged, because image brightness cannot show it.',
    },
  ],
  sentence:
    'At the C-arm you control five things: the C-arm projection, collimation, pulse rate and pulse width, the acquisition mode, and display zoom and processing. Exposure factors are chosen by automatic exposure regulation; that is monitoring, so check the dose-rate and cumulative dose readouts.',
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
