import { imagingLearnerCopyErrors } from './learnerCopy'

/**
 * The three radial EBUS views of Section 9 as one table: what the fellow sees, what it establishes,
 * and the next move. The rows restate the section's own blocks; the owner's decision on what a
 * concentric view establishes (PI-FELLOW 1.3 / 3.10) governs the middle column.
 */
export interface RadialEbusViewRow {
  readonly id: 'concentric' | 'eccentric' | 'absent'
  readonly view: string
  readonly see: string
  readonly establishes: string
  readonly next: string
}

export const RADIAL_EBUS_VIEWS: readonly RadialEbusViewRow[] = [
  {
    id: 'concentric',
    view: 'Concentric',
    see: 'Lesion-like tissue all the way around the probe.',
    establishes:
      'The probe is within lesion-like tissue at this depth. Not the identity of the tissue, and not where the exchanged tool will sample.',
    next: 'Hold the scope and sheath still, exchange for the biopsy tool, then show the tool itself on a second projection, DTS or CBCT.',
  },
  {
    id: 'eccentric',
    view: 'Eccentric',
    see: 'Lesion-like tissue on one side, aerated lung around the rest.',
    establishes: 'The probe is beside the lesion, in an airway along its edge.',
    next: 'Redirect the catheter or scope toward the lesion, or enter the adjacent airway, and re-image until the view is concentric. If it stays eccentric, add DTS or CBCT before sampling.',
  },
  {
    id: 'absent',
    view: 'No lesion pattern',
    see: 'The bright, snowstorm-like pattern of aerated lung around the whole probe.',
    establishes:
      'The probe is not at the lesion: another airway, another depth, or the lesion has moved from the planned target.',
    next: 'Do not sample. Move the probe in and out along this airway, examine the adjacent airways, then relocalize with DTS or CBCT.',
  },
]

export function validateRadialEbusViews(): readonly string[] {
  return RADIAL_EBUS_VIEWS.flatMap((row) =>
    [row.view, row.see, row.establishes, row.next].flatMap((text) =>
      imagingLearnerCopyErrors(`Radial EBUS view ${row.id}`, text),
    ),
  )
}

const radialEbusErrors = validateRadialEbusViews()
if (radialEbusErrors.length > 0) {
  throw new Error(`The radial EBUS views are invalid:\n${radialEbusErrors.join('\n')}`)
}
