import type { SourceId } from '../types'
import { imagingLearnerCopyErrors } from './learnerCopy'
import { isImagingSectionId, type ImagingSectionId } from './pathway'

/**
 * How a reconstruction is made, said once.
 *
 * The module teaches reconstruction as a stop on the chain and shows each acquisition running, but
 * it never put the two side by side: what was measured, what was computed from it, and what the
 * result can and cannot be asked. Learners see a sweep and an orbit and reasonably conclude that
 * both produce "a scan".
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
    inShort: 'A handful of directions, and depth comes back one plane at a time.',
    measured:
      'A short arc of images — here thirteen — taken as the source travels across a narrow span of directions, all of them from roughly the same side of the patient.',
    built: [
      'Choose a depth. Every structure sitting at that depth lands on the same spot in each image once the images are shifted by the amount that depth would move between views.',
      'Shift each image by that amount and average them. What sits at the chosen depth reinforces; everything nearer or further spreads out and fades into a smear.',
      'Repeat for another depth and another picture appears. The result is a stack of pictures, each sharp at one depth.',
    ],
    comesOut:
      'A stack of pictures parallel to the detector, each one sharp at a single depth. It is not a block of tissue you can cut in any direction.',
    canAsk: [
      'Which of two structures on the same ray is nearer the detector.',
      'Whether the instrument lies at the depth the lesion occupies.',
      'Whether a border that looked crisp in one picture survives at a neighbouring depth.',
    ],
    cannotAsk: [
      'How far apart two structures are along the beam, finely. The narrow span leaves that direction poorly measured — the unsampled directions are often called the missing wedge.',
      'Anything about a structure the sweep never looked at from a useful angle.',
      'A reading taken as though it came from a diagnostic scan.',
    ],
    boundary:
      'The pictures here are built by shifting and averaging thirteen parallel-beam projections of a teaching volume. No vendor algorithm, no scatter model and no measured detector response is involved.',
    sourceIds: ['saad', 'frontier'],
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
  'Both begin the same way: images from more than one direction. What separates them is how many directions and how far apart. A narrow span returns depth one plane at a time and leaves the beam direction poorly measured; a wide orbit returns a block that can be cut any way after the fact.'

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
