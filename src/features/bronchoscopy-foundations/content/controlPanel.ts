import type { ScopeControlId } from '../components/scope/types'
import type { SourceRef } from '../data/sources'

/**
 * The small control panel: the five things you control at the scope, taught in `five-controls` and
 * shown as a strip on every Explain step (medical-education-modules P3).
 *
 * Naming the five turns every later problem into "which control, if any" — and "if any" matters:
 * a patient who is hypoventilating, a bleed held by a wedge, or a report that claims too much has no
 * control that fixes it. The image and the patient are on the panel as monitoring, because the
 * commonest novice error is to treat the picture as the patient.
 */
export interface ScopeControl {
  readonly id: ScopeControlId
  readonly plainName: string
  readonly changes: string
  readonly doesNotChange: string
}

export interface ScopeMonitoringItem {
  readonly id: 'image' | 'patient'
  readonly plainName: string
  readonly sentence: string
}

export interface ScopeControlPanel {
  readonly controls: readonly ScopeControl[]
  readonly monitoring: readonly ScopeMonitoringItem[]
  readonly sentence: string
  readonly sourceRefs: readonly SourceRef[]
}

export const SCOPE_CONTROL_PANEL: ScopeControlPanel = {
  controls: [
    {
      id: 'insertion',
      plainName: 'Insertion and withdrawal',
      changes:
        'the depth of the tip. Advance in small increments while looking along the visible airway; withdrawal is steering too.',
      doesNotChange:
        'which way the tip faces. Advancing does not aim the tip; aiming comes from rotation and deflection.',
    },
    {
      id: 'rotation',
      plainName: 'Shaft rotation',
      changes:
        'the orientation of the camera and of the one plane the tip bends in, so rotation brings a target into that plane.',
      doesNotChange:
        'the anatomy. The image turns; the airway’s identity and the patient’s right and left do not.',
    },
    {
      id: 'deflection',
      plainName: 'Distal deflection',
      changes:
        'the bend of the distal tip within its plane, toward the top or the bottom of the image.',
      doesNotChange:
        'the plane itself. Lever movement is not “go left” or “go right” in the patient; rotation chooses the plane.',
    },
    {
      id: 'suction',
      plainName: 'Suction',
      changes:
        'what is drawn through the working channel: secretions, fluid, and gas along with them.',
      doesNotChange:
        'where the tip is. Suction against mucosa draws the wall onto the tip; more suction does not repair a poor view.',
    },
    {
      id: 'accessory',
      plainName: 'Accessory state',
      changes:
        'what is exposed at the tip: closed or open forceps, a sheathed or exposed brush, a retracted or deployed needle.',
      doesNotChange:
        'what may move through the channel. Only a protected accessory moves through the working channel.',
    },
  ],
  monitoring: [
    {
      id: 'image',
      plainName: 'The image',
      sentence:
        'A moving camera view: it shows where the lens faces, not which airway it is. Identity comes from landmarks and the branches already travelled. Not a setting.',
    },
    {
      id: 'patient',
      plainName: 'The patient',
      sentence:
        'Responsiveness, respiratory effort, airflow, oximetry, capnography and, on a ventilator, delivered and exhaled volumes and pressures. The airway view reports none of them. Not a setting.',
    },
  ],
  sentence:
    'At the scope you control five things: insertion and withdrawal, shaft rotation, distal deflection, suction, and the accessory state. The image and the patient are monitoring.',
  sourceRefs: [
    { sourceId: 'S1', location: { kind: 'pdf-pages', from: 89, to: 99 } },
    { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
    { sourceId: 'T10', location: { kind: 'time-span', start: '00:06:57', end: '00:09:28' } },
  ],
}

export type ControlStripState = 'this-one' | 'not-this-one' | 'harmful-reflex' | 'monitoring'

export type ControlStripVerdict =
  /** One of the five controls is the answer. */
  | 'this-control'
  /** No control fixes it: stop, name the last certain landmark, retrace. */
  | 'no-control-retrace'
  /** No control fixes it: stop the provoking action, communicate, get help. */
  | 'no-control-stop-and-communicate'
  /** No control fixes it: the plan, the question or the record has to change. */
  | 'no-control-change-the-plan'

export interface ControlStrip {
  readonly verdict: ControlStripVerdict
  readonly states: Readonly<Record<ScopeControlId, ControlStripState>>
  /** The strip in one sentence, shown at Explain. */
  readonly sentence: string
}

export function scopeControl(id: ScopeControlId): ScopeControl {
  const control = SCOPE_CONTROL_PANEL.controls.find((candidate) => candidate.id === id)
  if (!control) throw new Error(`Unknown control ${id}`)
  return control
}
