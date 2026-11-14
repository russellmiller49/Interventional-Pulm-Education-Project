import { DOLPHIN_SPINE } from './spine'
import { dolphinFrameById, learnerVisibleFrames, type DolphinFrame } from './frameBank'

/**
 * Frame drills: still views from the frame bank, one question each, no labels on the image and
 * nothing counted. "Where is the tip?" names the place on the passage; the rationale reads the
 * landmarks in order.
 */
export interface FrameDrillItem {
  readonly id: string
  readonly frameId: string
  readonly prompt: string
  readonly choices: readonly { readonly id: string; readonly label: string }[]
  readonly answerId: string
  readonly rationale: string
}

export interface FrameDrill {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly items: readonly FrameDrillItem[]
}

const PLACE_NAMES: Readonly<Record<string, string>> = {
  LNP: 'Bony nasal passage',
  RNP: 'Bony nasal passage',
  NPX: 'Nasopharynx',
  NPF: 'Nasopharyngeal fornix',
  LS: 'Laryngeal spout',
  LX: 'Larynx',
  TRA: 'Trachea',
  RTB: 'Right tracheal bronchus',
  RMB: 'Right main bronchus',
  LMB: 'Left main bronchus',
}

function placeOf(abbr: string): string {
  if (/^RB\d+$/.test(abbr)) return 'Right main bronchus'
  if (/^LB\d+$/.test(abbr)) return 'Left main bronchus'
  if (/^RT\d$/.test(abbr)) return 'Right tracheal bronchus'
  return PLACE_NAMES[abbr] ?? abbr
}

const PLACE_OPTIONS = [
  'Bony nasal passage',
  'Nasopharynx',
  'Nasopharyngeal fornix',
  'Larynx',
  'Trachea',
  'Right tracheal bronchus',
  'Right main bronchus',
  'Left main bronchus',
] as const

function stopNoteFor(place: string): string {
  const stop = DOLPHIN_SPINE.find((candidate) =>
    candidate.name.toLowerCase().startsWith(place.toLowerCase().split(' ')[0]),
  )
  return stop?.note ?? ''
}

/** Four place choices around the answer, the same for a frame every time. */
function whereItem(frame: DolphinFrame): FrameDrillItem {
  const answer = placeOf(frame.location)
  const at = PLACE_OPTIONS.indexOf(answer as (typeof PLACE_OPTIONS)[number])
  const neighbours = PLACE_OPTIONS.filter((option) => option !== answer)
  const start = Math.max(0, Math.min(at - 1, neighbours.length - 3))
  const options = [answer, ...neighbours.slice(start, start + 3)]
  return {
    id: `where-${frame.id}`,
    frameId: frame.id,
    prompt: 'Where is the scope tip?',
    choices: options.map((label) => ({ id: label.toLowerCase().replace(/\s+/g, '-'), label })),
    answerId: answer.toLowerCase().replace(/\s+/g, '-'),
    rationale: `${frame.postCommitAlt} ${stopNoteFor(answer)}`.trim(),
  }
}

const frames = learnerVisibleFrames()

const opening = (
  id: string,
  frameId: string,
  prompt: string,
  answer: string,
  others: readonly string[],
  rationale: string,
): FrameDrillItem => ({
  id,
  frameId,
  prompt,
  choices: [answer, ...others].map((label) => ({ id: label, label })),
  answerId: answer,
  rationale,
})

/** Which opening is which, read in sternal recumbency: dorsal at the top, the animal's right on the screen left. */
const NAME_THE_OPENING: readonly FrameDrillItem[] = [
  opening(
    'opening-trachea-side',
    'trachea-rtb',
    'The opening in the side wall on the screen left, above the far division, is…',
    'RTB',
    ['RMB', 'LMB', 'NPF'],
    'It leaves the trachea above the carina, and the animal’s right is on the screen left: the right tracheal bronchus.',
  ),
  opening(
    'opening-carina-left',
    'carina',
    'At the carina, the opening on the screen left is…',
    'RMB',
    ['LMB', 'RTB', 'RB1'],
    'With the animal sternal, its right is on the screen left, so the left-hand opening is the right main bronchus.',
  ),
  opening(
    'opening-rmb-first',
    'rmb-rb1',
    'This is the right main bronchus. The side opening ahead, upper left, is…',
    'RB1',
    ['RB2', 'RT1', 'LB1'],
    'Counted from the carina it is the first opening off the right main bronchus. Here it leaves dorsolaterally, upper left on the screen.',
  ),
  opening(
    'opening-lmb-first',
    'lmb-origin',
    'This is the left main bronchus just past the carina. The opening close ahead is…',
    'LB1',
    ['LB2', 'RB1', 'RTB'],
    'The first branch of the left main bronchus leaves close to the carina, well before the first branch on the right.',
  ),
  opening(
    'opening-lmb-second',
    'lmb-lb2',
    'This is the left main bronchus, past its first branch. The opening ahead at the top of the view is…',
    'LB2',
    ['LB1', 'LB3', 'RB2'],
    'One branch has already left; the next counted from the carina is LB2. Here it leaves dorsally, at the top of the view.',
  ),
]

export const DOLPHIN_FRAME_DRILLS: readonly FrameDrill[] = [
  {
    id: 'where-is-the-tip',
    title: 'Where is the tip?',
    description: 'Name the place on the passage from one still, labels off.',
    items: frames.map(whereItem),
  },
  {
    id: 'name-the-opening',
    title: 'Name the opening',
    description:
      'Read the view in sternal recumbency and count from the carina to name each opening.',
    items: NAME_THE_OPENING.filter((item) => frames.some((frame) => frame.id === item.frameId)),
  },
]

export const dolphinFrameDrillById: ReadonlyMap<string, FrameDrill> = new Map(
  DOLPHIN_FRAME_DRILLS.map((drill) => [drill.id, drill] as const),
)

export function frameDrillErrors(): readonly string[] {
  const errors: string[] = []
  for (const drill of DOLPHIN_FRAME_DRILLS) {
    for (const item of drill.items) {
      if (!dolphinFrameById.has(item.frameId)) errors.push(`${drill.id} ${item.id}: unknown frame.`)
      if (!item.choices.some((choice) => choice.id === item.answerId)) {
        errors.push(`${drill.id} ${item.id}: the answer is not among the choices.`)
      }
      if (new Set(item.choices.map((c) => c.id)).size !== item.choices.length) {
        errors.push(`${drill.id} ${item.id}: two choices share an id.`)
      }
    }
  }
  return errors
}
