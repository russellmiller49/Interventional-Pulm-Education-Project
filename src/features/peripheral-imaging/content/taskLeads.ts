import { imagingLearnerCopyErrors } from './learnerCopy'
import { IMAGING_LAB_GOALS } from './labGoals'
import type { ImagingSectionId } from './pathway'

/**
 * What a hands-on step asks for, in the words printed above its checklist in the text column.
 *
 * Owner feedback, 2026-10-11: on a hands-on step the text column was an empty box, so the step read
 * as if an instruction were missing. Each lead says what to move and what to watch change, using
 * only the controls that step shows; the checklist under it is the step's own goals
 * (`labGoals.ts`), ticked as they are met.
 */
export interface ImagingTaskLead {
  readonly act: string
  readonly observe?: string
}

export const IMAGING_TASK_LEADS: Readonly<Partial<Record<ImagingSectionId, ImagingTaskLead>>> = {
  'chain-walk': {
    act: 'Move the C-arm obliquity slider. The tube, the beam and the detector swing around the patient together, and the projection beside the 3D view changes with them.',
  },
  'good-image': {
    act: 'Rotate the C-arm, then zoom the image. Rotation changes the projection, so the tool and the lesion separate. Zoom enlarges the image already acquired and separates nothing.',
  },
  'current-anatomy': {
    act: 'Shift the anatomy and leave the stored contour on. The contour stays where it was drawn while the lesion moves away from it.',
    observe:
      'Capture a new contour. Only a new acquisition puts the contour back on the lesion; switching the old one off does not.',
  },
  projection: {
    act: 'Rotate the C-arm with the tool and the lesion held still. Their separation on the image changes although neither has moved.',
    observe:
      'Bring the C-arm back to 0° and compare with the saved baseline. The tool and the lesion overlap again: the depth between them is still there, and the frontal view cannot show it.',
  },
  signal: {
    act: 'Rotate the C-arm and follow the X-ray path through the lesion. Watch which dense structures cross it at each angle.',
  },
  field: {
    act: 'Close the collimators in two stages and watch the image. First narrow the field as far as the planned tool path and both landmarks allow: this is the field for advancing the tool. Then, with the tool at the lesion, keep narrowing until the spine is outside the field, and see the lung, the lesion and the tool gain contrast.',
    observe:
      'Crop the stored image, then zoom it, and compare each with the saved baseline. Neither changes the acquired field or adds exposure.',
  },
  time: {
    act: 'Lengthen the pulse and leave the pulse rate and the tool speed alone. The blur within each frame grows. The distance the tool travels between frames does not.',
    observe:
      'Set the pulse width back, then lower the pulse rate. The tool now travels farther between frames, with the same blur in each.',
  },
  'two-dimensional': {
    act: 'Work the image as you would at the table: change the projection, collimate around the lesion without losing the tool path, then zoom the stored image to inspect it.',
  },
  'dts-acquisition': {
    act: 'Scroll the plane through the tool, then through the lesion. Each is sharp at its own depth and blurs as the plane moves away from it.',
    observe:
      'Change the sweep angle and scroll again. A wider arc shortens the range of depth over which a structure stays sharp.',
  },
  'cbct-acquisition': {
    act: 'Center the lesion on both scout images, go through the four checks you would call out with the team before a spin, then run the spin.',
    observe:
      'After the spin, change the lesion offset. The lesion is no longer centered, and the checks made at the old position are cleared.',
  },
  'fixed-suite': {
    act: 'Rotate the gantry through its path, then change the lesion’s horizontal offset and watch the scout image follow. A setup that has moved is checked again before any spin.',
  },
  'mobile-suite': {
    act: 'Center the lesion on both scout images, then rotate the gantry through its path around the table.',
  },
  'tool-confirmation': {
    act: 'Move the needle until its side-cutting window, not only its tip, lies inside the lesion. Read thin slices in all three planes to confirm it.',
    observe:
      'Reveal the geometric explanation, then switch the thick slab on and off. A thick slab can show the window inside the lesion when it lies in front of or behind it.',
  },
  'changing-anatomy': {
    act: 'Capture a contour of the target, then shift the anatomy. The contour stays where it was captured.',
    observe:
      'Turn the contour off and read the current image on its own, without the earlier annotation.',
  },
  'staff-protection': {
    act: 'Move the operator closer to the patient and farther away. Scatter exposure falls with the square of the distance from the patient.',
    observe:
      'Place the shield, then rotate the C-arm. See where the tube, the patient and the shield now sit relative to the operator.',
  },
  'dose-reporting': {
    act: 'Change the field area and leave the air kerma alone. The kerma–area product changes in proportion to the area.',
  },
}

export function imagingTaskLead(
  sectionId: ImagingSectionId,
  step: 'act' | 'observe',
): string | null {
  return IMAGING_TASK_LEADS[sectionId]?.[step] ?? null
}

export function validateImagingTaskLeads(): readonly string[] {
  const errors: string[] = []
  for (const [sectionId, goals] of Object.entries(IMAGING_LAB_GOALS)) {
    if (!goals) continue
    const lead = IMAGING_TASK_LEADS[sectionId as ImagingSectionId]
    if (!lead) {
      errors.push(`${sectionId} has hands-on goals and no task lead.`)
      continue
    }
    errors.push(...imagingLearnerCopyErrors(`Task lead for ${sectionId} (act)`, lead.act))
    if (goals.observe.length > 0 && !lead.observe)
      errors.push(`${sectionId} has an observe step and no task lead for it.`)
    if (lead.observe)
      errors.push(...imagingLearnerCopyErrors(`Task lead for ${sectionId} (observe)`, lead.observe))
  }
  return errors
}

const leadErrors = validateImagingTaskLeads()
if (leadErrors.length > 0) {
  throw new Error(`The imaging task leads are invalid:\n${leadErrors.join('\n')}`)
}
