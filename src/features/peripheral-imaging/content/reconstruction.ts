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
    name: 'Digital tomosynthesis (DTS)',
    inShort:
      'A limited arc of projections, with an older scan or a model standing in for the directions the arc never covered.',
    measured:
      'A short arc of images — thirteen in this section — acquired as the C-arm moves through a limited arc, all from roughly the same side of the patient. On the bronchoscopy systems in use that arc is usually fifty to seventy degrees; CT acquires over a hundred and eighty degrees or more.',
    built: [
      'Choose a depth. Every structure sitting at that depth lands on the same spot in each image once the images are shifted by the amount that depth would move between views.',
      'Shift each image by that amount and average them. What sits at the chosen depth reinforces; everything nearer or further spreads out and fades into a smear. Repeat for another depth and another picture appears.',
      'Now the part the arc cannot settle. Because it covered only a limited range of angles, a great many different volumes would have produced exactly the projections that were acquired, and those projections do not single one of them out.',
      'So the system chooses, and what it starts from decides which one it lands on: the planning CT, registered to the acquisition, or a model built from scans. Many platforms finish here and render CT-like multiplanar images, axial, coronal and sagittal. Others stop at the stack of planes and use the acquisition to update the navigation target instead.',
    ],
    comesOut:
      'It depends on the platform, and the word tomosynthesis does not tell you which. Some render a set that resembles a scan and is cut in more than one plane. Others return the stack of planes only, or use the acquisition to move the virtual target and show no reconstruction at all. Ask what the system does with the DTS acquisition.',
    provenance:
      'The direction across the image was acquired. The direction along the beam was acquired poorly, and where a CT-like image is rendered, that direction is largely supplied — by an older scan, or by a model. Nothing in the image marks where the acquired content ends and the inference begins.',
    canAsk: [
      'Which of two superimposed structures is nearer the detector.',
      'Whether the instrument lies at the depth the lesion occupies. The arc answers that better than one image does, and it is what these platforms are built for.',
      'Whether a border that looked crisp on one plane survives at a neighbouring depth.',
    ],
    cannotAsk: [
      'Which parts of the image the arc acquired and which were filled in. The out-of-plane blur that gives the limit away on a plain stack of planes is the very thing a CT-like rendering removes.',
      'A separation taken as exact. Compared with CBCT of the same target, the centre of a lesion localized by DTS has been reported to sit as much as 16.2 mm from where CBCT places it.',
      'Anything about a structure the arc never covered from a useful angle, however clean the image of it looks.',
    ],
    boundary:
      'This section shows the plain version and only that: thirteen parallel-beam projections of a teaching volume, shifted and averaged, with no registered prior scan and no learned model behind them. The out-of-plane blur is visible here on purpose — it is the cue a CT-like rendering does not leave you. No vendor algorithm, no scatter model and no measured detector response is involved.',
    sourceIds: ['saad', 'sumner', 'podder', 'frontier'],
    shownIn: 'dts-acquisition',
  },
  {
    id: 'cone-beam',
    name: 'Cone-beam CT (CBCT)',
    inShort: 'Projections from a wide rotation, and a volume comes back.',
    measured:
      'Hundreds of projections acquired as the C-arm rotates around the patient during the CBCT spin, so the same tissue is seen from directions that differ by a large angle.',
    built: [
      'Take each projection and back-project its attenuation along the X-ray paths it came from, into an empty volume.',
      'Do that for every direction. Where many paths agree, a structure builds up; where only a few agree, the contribution washes out.',
      'Filter as you go, so structures come back sharp rather than blurred, and the volume fills in.',
    ],
    comesOut:
      'A volume, sampled about equally in every direction, that can be reviewed in any plane after the fact — axial, coronal, sagittal or oblique.',
    provenance:
      'Every direction in it was acquired, inside the reconstruction volume. Outside that volume nothing was acquired, and the image stops rather than filling in — which is why CBCT shows its limit as a truncation edge you can see.',
    canAsk: [
      'Where the biopsy tool sits relative to the lesion in three dimensions, inside the reconstruction volume.',
      'What the lesion looks like on a plane the acquisition never pointed along.',
      'Whether tissue that looked separate on one view is separate in space.',
    ],
    cannotAsk: [
      'Anything about tissue outside the reconstruction volume; a lesion off centre can be truncated at the edge.',
      'A reading from a volume the patient moved during. Motion during the spin makes the projections disagree, and the volume is built from the disagreement.',
      'The detail of a diagnostic scan. It answers where things are, in the room, at that moment.',
    ],
    boundary:
      'What this module displays after the spin is the original planning CT standing in for a reconstructed volume, labelled as such. Those images were not reconstructed from the projections the spin acquired.',
    sourceIds: ['setser', 'mobile'],
    shownIn: 'cbct-acquisition',
  },
]

/** The sentence that holds the two together, and the reason the comparison exists. */
export const RECONSTRUCTION_CONTRAST =
  'Both begin the same way — projections from more than one direction — and both can end as images reviewed in any plane. What separates them is how much of that image was acquired. A CBCT spin acquires every direction inside the reconstruction volume, and at the edge of that volume it stops. A DTS acquisition resolves one direction well and the other poorly, so something else stands in for the second — an older scan, or a model built from scans. That is how DTS can show a plane its arc never covered, and how it can be confidently off.'

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
