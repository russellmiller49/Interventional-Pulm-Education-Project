import type { SourceId } from '../types'
import { imagingLearnerCopyErrors } from './learnerCopy'
import { isImagingSectionId, type ImagingSectionId } from './pathway'

/**
 * How a reconstruction is made, said once.
 *
 * The module teaches reconstruction as a stop on the chain and shows each acquisition running, but
 * it never put the two side by side: what was measured, what was computed from it, and what the
 * result can and cannot be asked.
 *
 * The distinction is not the shape of the output. Both of these can end as a picture the operator
 * cuts in any plane, and on the platforms in use a limited sweep often does exactly that. The
 * distinction is how much of that picture was measured, and that is the axis `provenance` names.
 * Getting this backwards is the failure worth guarding against: a learner told that a sweep cannot
 * produce a scan-like image will meet one on the second monitor and have no idea what to ask of it.
 *
 * One artifact, in the pattern the diagnostic table already uses: authored here, drawn in the
 * teaching column of the sections that build a reconstruction, and repeated nowhere.
 */
export interface ReconstructionAccount {
  readonly id: 'tomosynthesis' | 'cone-beam'
  readonly name: string
  /** The one-line contrast that separates it from the other. */
  readonly inShort: string
  /** What the machine actually collects. */
  readonly measured: string
  /** How the collected images become the picture. */
  readonly built: readonly string[]
  /** The shape of the result: what a learner is looking at. */
  readonly comesOut: string
  /** Which part of that result the acquisition measured, and where the rest of it came from. */
  readonly provenance: string
  readonly canAsk: readonly string[]
  readonly cannotAsk: readonly string[]
  /** What this module's version of it is not. */
  readonly boundary: string
  readonly sourceIds: readonly SourceId[]
  /** The section whose suite shows this being built. */
  readonly shownIn: ImagingSectionId
}

export const RECONSTRUCTION_ACCOUNTS: readonly ReconstructionAccount[] = [
  {
    id: 'tomosynthesis',
    name: 'A limited sweep',
    inShort:
      'A narrow span of directions, and something else standing in for the ones the arc never travelled.',
    measured:
      'A short arc of images — thirteen in this section — taken as the source travels a narrow span of directions, all of them from roughly the same side of the patient. On the bronchoscopy systems in use that span is usually fifty to seventy degrees. A scanner collects over a hundred and eighty degrees or more.',
    built: [
      'Choose a depth. Every structure sitting at that depth lands on the same spot in each image once the images are shifted by the amount that depth would move between views.',
      'Shift each image by that amount and average them. What sits at the chosen depth reinforces; everything nearer or further spreads out and fades into a smear. Repeat for another depth and another picture appears.',
      'Now the part the arc cannot settle. Because it travelled only a narrow span, a great many different volumes would have produced exactly the images that were collected, and the collected images do not single one of them out.',
      'So the system chooses, and what it starts from decides which one it lands on: the planning scan, registered onto the sweep, or a model built from scans. Many platforms finish here and render something shaped like a scan, cut across, front to back and side to side. Others stop at the stack of planes and use the sweep to update a navigation map instead.',
    ],
    comesOut:
      'It depends on the platform, and the word tomosynthesis does not tell you which. Some render a set that resembles a scan and is cut in more than one plane. Others return the stack of planes only, or use the sweep to move a virtual target and show no reconstruction at all. Ask what the system does with the sweep.',
    provenance:
      'The direction across the image was measured. The direction along the beam was measured poorly, and where a scan-like set is rendered, that direction is largely supplied — by an older scan, or by a model. Nothing in the picture marks where the measurement ends and the inference begins.',
    canAsk: [
      'Which of two structures on the same ray is nearer the detector.',
      'Whether the instrument lies at the depth the lesion occupies. The arc answers that better than one image does, and it is what these platforms are built for.',
      'Whether a border that looked crisp on one plane survives at a neighbouring depth.',
    ],
    cannotAsk: [
      'Which parts of the picture the arc measured and which were filled in. The smear that gives the limit away on a plain stack of planes is the very thing a scan-like rendering removes.',
      'A separation taken as exact. Against a full orbit of the same target, the centre of a lesion drawn from a sweep has been reported to sit as much as 16.2 mm from where the orbit puts it.',
      'Anything about a structure the sweep never looked at from a useful angle, however clean the picture of it looks.',
    ],
    boundary:
      'This section shows the plain version and only that: thirteen parallel-beam projections of a teaching volume, shifted and averaged, with no registered prior scan and no learned model behind them. The smear is visible here on purpose — it is the cue a scan-like rendering does not leave you. No vendor algorithm, no scatter model and no measured detector response is involved.',
    sourceIds: ['saad', 'sumner', 'podder', 'frontier'],
    shownIn: 'dts-acquisition',
  },
  {
    id: 'cone-beam',
    name: 'A full orbit',
    inShort: 'Directions from all around, and a block of tissue comes back.',
    measured:
      'Hundreds of images taken as the source travels a wide arc around the patient, so the same tissue is seen from directions that differ by a large angle.',
    built: [
      'Take each image and spread its darkness back along the ray it came from, into an empty block of space.',
      'Do that for every direction. Where many rays agree, a structure builds up; where only a few agree, the contribution washes out.',
      'Filter as you go, so the structures come back sharp rather than blurred, and the block fills in.',
    ],
    comesOut:
      'A block of tissue, sampled about equally in every direction, that can be cut in any plane after the fact — across, front to back, or side to side.',
    provenance:
      'Every direction in it was measured, inside the volume the orbit covered. Outside that volume nothing was measured, and the picture stops rather than filling in — which is why this one shows its limit as an edge you can see.',
    canAsk: [
      'Where the instrument sits relative to the lesion in three dimensions, inside the volume that was covered.',
      'What the lesion looks like on a plane the acquisition never pointed along.',
      'Whether tissue that looked separate on one view is separate in space.',
    ],
    cannotAsk: [
      'Anything about tissue that fell outside the covered volume; a target off centre can be cut off at the edge.',
      'A reading from a volume the patient moved during. Movement across the orbit disagrees with itself and the block is built from the disagreement.',
      'The detail of a diagnostic scan. It answers where things are, in the room, at that moment.',
    ],
    boundary:
      'What this module displays after the orbit is the original planning scan standing in for a reconstructed block, labelled as such. Those pictures were not reconstructed from the projections the orbit collected.',
    sourceIds: ['setser', 'mobile'],
    shownIn: 'cbct-acquisition',
  },
]

/** The sentence that holds the two together, and the reason the comparison exists. */
export const RECONSTRUCTION_CONTRAST =
  'Both begin the same way: images from more than one direction, and both can end as a picture that is cut in any plane. What separates them is how much of that picture was measured. A wide orbit measures every direction inside the volume it covers, and at the edge of that volume it stops. A narrow span measures one direction well and the other poorly, so something else stands in for the second — an older scan, or a model built from scans. That is how a sweep can show a plane it never travelled, and how it can be confidently off.'

export function reconstructionAccount(id: ReconstructionAccount['id']): ReconstructionAccount {
  const found = RECONSTRUCTION_ACCOUNTS.find((account) => account.id === id)
  if (!found) throw new Error(`Unknown reconstruction account ${id}`)
  return found
}

/** The sections whose teaching column draws this comparison. */
export const RECONSTRUCTION_SECTIONS: readonly ImagingSectionId[] = [
  'dts-acquisition',
  'dts-interpretation',
  'cbct-acquisition',
]

export function validateImagingReconstruction(): readonly string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const account of RECONSTRUCTION_ACCOUNTS) {
    const where = `Reconstruction account ${account.id}`
    if (ids.has(account.id)) errors.push(`${where} is declared twice.`)
    ids.add(account.id)
    if (!isImagingSectionId(account.shownIn)) {
      errors.push(`${where} names a section that is not on the pathway.`)
    }
    if (account.built.length < 2) errors.push(`${where} does not say how the picture is built.`)
    if (account.canAsk.length === 0 || account.cannotAsk.length === 0) {
      errors.push(`${where} must say both what the result answers and what it does not.`)
    }
    if (account.sourceIds.length === 0) errors.push(`${where} cites no source.`)
    for (const [field, text] of [
      ['name', account.name],
      ['in short', account.inShort],
      ['measured', account.measured],
      ['comes out', account.comesOut],
      ['provenance', account.provenance],
      ['boundary', account.boundary],
    ] as const) {
      errors.push(...imagingLearnerCopyErrors(`${where} ${field}`, text))
    }
    for (const step of account.built)
      errors.push(...imagingLearnerCopyErrors(`${where} step`, step))
    for (const line of account.canAsk)
      errors.push(...imagingLearnerCopyErrors(`${where} can ask`, line))
    for (const line of account.cannotAsk)
      errors.push(...imagingLearnerCopyErrors(`${where} cannot ask`, line))
  }
  errors.push(...imagingLearnerCopyErrors('The reconstruction contrast', RECONSTRUCTION_CONTRAST))
  for (const sectionId of RECONSTRUCTION_SECTIONS) {
    if (!isImagingSectionId(sectionId)) {
      errors.push(`The reconstruction comparison names an unknown section ${sectionId}.`)
    }
  }
  return errors
}

const reconstructionErrors = validateImagingReconstruction()
if (reconstructionErrors.length > 0) {
  throw new Error(`The reconstruction accounts are invalid:\n${reconstructionErrors.join('\n')}`)
}
