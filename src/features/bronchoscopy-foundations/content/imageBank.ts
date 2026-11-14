import type { SourceRef } from '../data/sources'
import type { FindFrameId } from './findFrames'
import type { BronchFind, BronchFindRow } from './types'

/**
 * The image bank (rewrite plan, practice and assessment). Every question is a click on an outlined
 * opening in a still from the survey, asked once upright and once with the view rotated. It reuses
 * the frames the two lung sections already show, so it adds no new picture.
 *
 * Only openings a fellow can find from what the question states are asked: where the scope is,
 * one orientation cue where the lung sections give one, and the branching pattern. Openings that
 * could only be told apart by a cue no one has confirmed are left out.
 *
 * The orientation cues are the ones the lung sections state. They were read from the survey's
 * outlines, not from a recorded camera roll, and wait for faculty confirmation with them.
 */

type Side = 'left' | 'top' | 'right' | 'bottom'
type Rotation = NonNullable<BronchFindRow['rotation']>

/** What the question says about which way the picture is turned. */
type Cue =
  | { readonly kind: 'side'; readonly subject: string; readonly side: Side }
  | { readonly kind: 'clock'; readonly hour: number }
  | { readonly kind: 'none' }

interface BankTarget {
  readonly targetId: string
  readonly prompt: string
  readonly rationale: string
}

interface BankFrame {
  readonly frameId: FindFrameId
  /** Where the scope is. Starts with "You". */
  readonly where: string
  readonly cue: Cue
  readonly targets: readonly BankTarget[]
}

const NONE: Cue = { kind: 'none' }

const FRAMES: readonly BankFrame[] = [
  {
    frameId: 'carina',
    where: 'You are above the carina.',
    cue: { kind: 'clock', hour: 7 },
    targets: [
      {
        targetId: 'rmb',
        prompt: 'Click the right main bronchus.',
        rationale:
          'Put the membranous wall back at 6 o’clock in your head. The patient’s right is then on your right, and that opening is the right main bronchus.',
      },
      {
        targetId: 'lmb',
        prompt: 'Click the left main bronchus.',
        rationale:
          'Put the membranous wall back at 6 o’clock in your head. The patient’s left is then on your left, and that opening is the left main bronchus.',
      },
    ],
  },
  {
    frameId: 'right-main',
    where: 'You have just entered the right main bronchus.',
    cue: NONE,
    targets: [
      {
        targetId: 'rul',
        prompt: 'Click the right upper lobe.',
        rationale:
          'The upper lobe is the side opening on the lateral wall. The lumen that runs straight on is the bronchus intermedius.',
      },
      {
        targetId: 'bronchus-intermedius',
        prompt: 'Click the bronchus intermedius.',
        rationale:
          'The bronchus intermedius is the lumen that runs straight on. The upper lobe is the side opening on the lateral wall.',
      },
    ],
  },
  {
    frameId: 'right-upper-lobe',
    where: 'You are looking into the right upper lobe.',
    cue: { kind: 'side', subject: 'Anterior is', side: 'left' },
    targets: [
      {
        targetId: 'rb1',
        prompt: 'Click RB1, the apical segment.',
        rationale:
          'RB3 is the opening on the anterior side and RB2 sits opposite it. RB1, the apical segment, is the third opening.',
      },
      {
        targetId: 'rb2',
        prompt: 'Click RB2, the posterior segment.',
        rationale:
          'RB3 is the opening on the anterior side. RB2 is posterior and sits opposite it. RB1, the apical segment, is the third.',
      },
      {
        targetId: 'rb3',
        prompt: 'Click RB3, the anterior segment.',
        rationale:
          'RB3 is the anterior segment, so it is the opening on the anterior side of the view. RB2 sits opposite it.',
      },
    ],
  },
  {
    frameId: 'intermedius-end',
    where: 'You arrived from the bronchus intermedius and stopped where it ends.',
    cue: NONE,
    targets: [
      {
        targetId: 'rml',
        prompt: 'Click the right middle lobe.',
        rationale:
          'The middle lobe is the separate opening on the anterior wall. RB6 leaves the posterior wall opposite it, and the basal openings lie beyond them both.',
      },
      {
        targetId: 'rb6',
        prompt: 'Click RB6, the superior segment.',
        rationale:
          'The middle lobe is the separate opening on the anterior wall. RB6 leaves the posterior wall opposite it, at the mouth of the lower lobe.',
      },
    ],
  },
  {
    frameId: 'right-middle-lobe',
    where: 'You are inside the middle lobe bronchus.',
    cue: { kind: 'side', subject: 'The patient’s midline is', side: 'left' },
    targets: [
      {
        targetId: 'rb4',
        prompt: 'Click RB4.',
        rationale:
          'RB5 is medial, so it is the opening toward the midline. RB4 is lateral and sits on the other side.',
      },
      {
        targetId: 'rb5',
        prompt: 'Click RB5.',
        rationale:
          'RB5 is the medial segment, so it is the opening toward the midline. RB4, the lateral segment, sits on the other side.',
      },
    ],
  },
  {
    frameId: 'right-basal',
    where: 'You are in the right lower lobe, past RB6.',
    cue: NONE,
    targets: [
      {
        targetId: 'rb7',
        prompt: 'Click RB7, the medial basal segment.',
        rationale:
          'RB7 leaves early, on the medial wall, and stands apart from the other three basal openings.',
      },
      {
        targetId: 'rb9',
        prompt: 'Click RB9, the lateral basal segment.',
        rationale:
          'Three basal openings sit together, away from RB7. RB9 is the middle one, between RB8 in front and RB10 behind.',
      },
    ],
  },
  {
    frameId: 'left-main-end',
    where: 'You have followed the left main bronchus to where it ends.',
    cue: NONE,
    targets: [
      {
        targetId: 'lll',
        prompt: 'Click the left lower lobe.',
        rationale:
          'The upper lobe opening shows its own division just inside: the upper division and the lingula. The lower lobe is the other opening.',
      },
      {
        targetId: 'lul',
        prompt: 'Click the left upper lobe.',
        rationale:
          'The upper lobe is the opening that shows its own division just inside: the upper division and the lingula.',
      },
    ],
  },
  {
    frameId: 'left-upper-lobe',
    where: 'You are inside the left upper lobe bronchus.',
    cue: { kind: 'side', subject: 'The patient’s head is', side: 'top' },
    targets: [
      {
        targetId: 'lingula',
        prompt: 'Click the lingula.',
        rationale:
          'The upper division runs up toward the apex. The lingula is the opening that runs down and forward, away from the head.',
      },
      {
        targetId: 'lul-upper',
        prompt: 'Click the upper division.',
        rationale:
          'The upper division runs up toward the apex, so it is the opening toward the head. The lingula runs down and forward.',
      },
    ],
  },
  {
    frameId: 'left-upper-division',
    where: 'You are inside the upper division.',
    cue: { kind: 'side', subject: 'Anterior is', side: 'right' },
    targets: [
      {
        targetId: 'lb1-2',
        prompt: 'Click LB1+2, the apicoposterior segment.',
        rationale:
          'LB3 is the opening on the anterior side. LB1+2 is the other one: a single opening for the apical and posterior segments.',
      },
      {
        targetId: 'lb3',
        prompt: 'Click LB3, the anterior segment.',
        rationale:
          'LB3 is the anterior segment, so it is the opening on the anterior side of the view. LB1+2 is the other one.',
      },
    ],
  },
  {
    frameId: 'lingula',
    where: 'You are in the left upper lobe, looking down the lingula.',
    cue: { kind: 'side', subject: 'The upper division lies', side: 'top' },
    targets: [
      {
        targetId: 'lb4',
        prompt: 'Click LB4.',
        rationale:
          'LB4 is the superior lingular segment, so it is the opening nearer the upper division. LB5, the inferior segment, lies on the far side.',
      },
      {
        targetId: 'lb5',
        prompt: 'Click LB5.',
        rationale:
          'LB5 is the inferior lingular segment, so it is the opening farther from the upper division. LB4 is the nearer one.',
      },
    ],
  },
  {
    frameId: 'left-lower-lobe',
    where: 'You have just entered the left lower lobe.',
    cue: NONE,
    targets: [
      {
        targetId: 'lb6',
        prompt: 'Click LB6, the superior segment.',
        rationale:
          'LB6 leaves first, from the posterior wall, and stands apart from the basal openings beyond it.',
      },
    ],
  },
  {
    frameId: 'left-basal',
    where: 'You are past LB6, at the basal openings.',
    cue: { kind: 'side', subject: 'Posterior is', side: 'right' },
    targets: [
      {
        targetId: 'lb7-8',
        prompt: 'Click LB7+8, the anteromedial basal segment.',
        rationale:
          'LB10 is posterior. LB7+8 is anteromedial and sits on the opposite side. LB9, the lateral segment, lies between them here.',
      },
      {
        targetId: 'lb9',
        prompt: 'Click LB9, the lateral basal segment.',
        rationale:
          'LB10 is the opening on the posterior side and LB7+8 sits opposite it. LB9, the lateral segment, lies between them here.',
      },
      {
        targetId: 'lb10',
        prompt: 'Click LB10, the posterior basal segment.',
        rationale:
          'LB10 is the posterior basal segment, so it is the opening on the posterior side of the view. LB7+8 sits opposite it.',
      },
    ],
  },
]

const SIDES: readonly Side[] = ['left', 'top', 'right', 'bottom']
const SIDE_WORDS: Record<Side, string> = {
  left: 'to the left of this view',
  top: 'toward the top of this view',
  right: 'to the right of this view',
  bottom: 'toward the bottom of this view',
}
const TURN_WORDS: Record<Rotation, string> = {
  90: 'a quarter turn clockwise',
  180: 'a half turn',
  270: 'a quarter turn counterclockwise',
}

/** Where a cue points once the picture has been turned clockwise by `rotation` degrees. */
function cueSentence(cue: Cue, rotation: 0 | Rotation): string {
  const quarterTurns = rotation / 90
  if (cue.kind === 'side') {
    const side = SIDES[(SIDES.indexOf(cue.side) + quarterTurns) % SIDES.length]
    return `${cue.subject} ${SIDE_WORDS[side]}.`
  }
  if (cue.kind === 'clock') {
    const hour = ((cue.hour + quarterTurns * 3 - 1) % 12) + 1
    return `The membranous wall is at ${hour} o’clock.`
  }
  return ''
}

function contextFor(frame: BankFrame, rotation: 0 | Rotation): string {
  const turned = rotation === 0 ? '' : `The view is rotated ${TURN_WORDS[rotation]}.`
  return [frame.where, turned, cueSentence(frame.cue, rotation)].filter(Boolean).join(' ')
}

const ROTATIONS: readonly Rotation[] = [90, 180, 270]

interface Asked {
  readonly frame: BankFrame
  readonly target: BankTarget
}

const ASKED: readonly Asked[] = FRAMES.flatMap((frame) =>
  frame.targets.map((target) => ({ frame, target })),
)

/** A fixed mix: stepping through the openings by a stride puts neighbours in different lungs. */
const STRIDE = 7
const MIXED: readonly Asked[] = ASKED.map((_, index) => ASKED[(index * STRIDE) % ASKED.length])

function row(asked: Asked, rotation: 0 | Rotation): BronchFindRow {
  const { frame, target } = asked
  return {
    id: `${frame.frameId}-${target.targetId}-${rotation === 0 ? 'upright' : 'turned'}`,
    frameId: frame.frameId,
    context: contextFor(frame, rotation),
    prompt: target.prompt,
    targetId: target.targetId,
    ...(rotation === 0 ? {} : { rotation }),
    rationale: target.rationale,
  }
}

/** How many questions a set holds: half upright, half rotated. */
export const IMAGE_BANK_SET_SIZE = 10
const HALF = IMAGE_BANK_SET_SIZE / 2

/**
 * The sets, in order. Each takes five openings upright and five others rotated, alternating. An
 * opening's rotated question sits two sets after its upright one, so a set never shows the same
 * opening twice.
 */
export const IMAGE_BANK_SETS: readonly (readonly BronchFindRow[])[] = Array.from(
  { length: Math.ceil(MIXED.length / HALF) },
  (_, set) => {
    const upright = MIXED.slice(set * HALF, set * HALF + HALF)
    const offset = (set * HALF + 2 * HALF) % MIXED.length
    const turned = Array.from({ length: upright.length }, (_, index) => {
      const position = (offset + index) % MIXED.length
      return { asked: MIXED[position], rotation: ROTATIONS[position % ROTATIONS.length] }
    })
    return upright.flatMap((asked, index) => [
      row(asked, 0),
      row(turned[index].asked, turned[index].rotation),
    ])
  },
)

export const IMAGE_BANK_ROWS: readonly BronchFindRow[] = IMAGE_BANK_SETS.flat()

const SOURCES: readonly SourceRef[] = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
]

/** One set as the click-on-the-picture control takes it. `number` counts from 1. */
export function imageBankSet(number: number): BronchFind | null {
  const rows = IMAGE_BANK_SETS[number - 1]
  if (!rows) return null
  return {
    id: `image-bank-set-${number}`,
    prompt: 'Click the opening each picture asks for.',
    rows,
    sourceRefs: SOURCES,
  }
}
