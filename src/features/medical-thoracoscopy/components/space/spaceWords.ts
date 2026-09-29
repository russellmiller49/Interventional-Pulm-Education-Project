import { assertThoracoscopyCopy } from '../../content/learnerCopy'
import type {
  PivotHandDirection,
  SeenState,
  SpaceCommand,
  UnseenReason,
  ZoneLedgerEntry,
} from './types'

/**
 * Everything the space pane says, in one place, checked by the learner-copy gate as it loads. The
 * ledger's words are the survey section's own (section 11): a region is seen, seen as far as the
 * model reaches, partly seen or not seen, and one not seen whole is not looked at yet, hidden by
 * something in the way, or out of reach from this port. No word here carries a number.
 */

export const SEEN_WORDS: Readonly<Record<SeenState, string>> = {
  seen: 'Seen',
  'seen-to-reach': 'Seen as far as this model reaches',
  'partly-seen': 'Partly seen',
  'not-seen': 'Not seen',
}

export const REASON_WORDS: Readonly<Record<UnseenReason, string>> = {
  'not-looked-at': 'not looked at yet',
  hidden: 'hidden by something in the way',
  'out-of-reach': 'out of reach from this port',
}

/** One ledger row in words: "Partly seen, hidden by something in the way". */
export function ledgerWords(entry: ZoneLedgerEntry): string {
  return entry.reason === null
    ? SEEN_WORDS[entry.seen]
    : `${SEEN_WORDS[entry.seen]}, ${REASON_WORDS[entry.reason]}`
}

export const LEDGER_WORDS = {
  heading: 'The model’s estimate',
  caption:
    'What the telescope has shown of each region, as the model estimates it, in the order of the survey. It has no number and no total. The model cannot tell a glimpse from a careful look, so a region shown as seen was in view, not necessarily examined. Seeing every region whole is not the aim: in this model, from its one port, part of the pleura is out of reach or behind the lung, and the estimate says which.',
  regionColumn: 'Region',
  estimateColumn: 'Estimate',
} as const

export const PIVOT_WORDS: Readonly<Record<PivotHandDirection, string>> = {
  head: 'Hand toward the head',
  feet: 'Hand toward the feet',
  front: 'Hand toward the front',
  back: 'Hand toward the back',
}

export const DEPTH_WORDS = { in: 'In', out: 'Out' } as const
export const ROLL_WORDS = {
  clockwise: 'Turn clockwise',
  anticlockwise: 'Turn anticlockwise',
} as const

/** The forceps in the working channel (slice 13). */
export const TOOL_WORDS = {
  partName: 'Forceps',
  extend: 'Forceps out',
  retract: 'Forceps back in',
  note: 'They move along the channel; the telescope stays where it is.',
  inChannel: 'The forceps are in the channel.',
  extended: 'The forceps are out beyond the tip.',
  touching: 'The jaws are touching the nodule.',
} as const

export const DOCK_WORDS = {
  pivotNote: 'The tip swings the other way.',
  rollNote: 'As you look down the telescope.',
  holdNote: 'Hold a button to keep moving.',
  stepHeading: 'The model waits',
  stepNote: 'Motion is reduced, so the model waits for you. Step moves it on.',
  step: 'Step',
  retry: 'Try loading again',
  paused: 'The controls wait until it is ready. You can keep reading.',
} as const

/** Words for a control shown but not usable here. */
export function taughtInWords(title: string): string {
  return `Shown here, used from “${title}”.`
}

export const VIEW_WORDS = {
  paneLabel: 'The pleural space',
  chestHeading: 'Chest view, as a cut through the space',
  chestNote: 'The wall, the lung and the telescope where a cut along the telescope meets them.',
  scopeHeading: 'Scope view, in words',
  inView: 'In view now',
  nothingInView: 'No region of the wall is in view.',
  telescope: 'Telescope',
  field: 'Field of view',
  lung: 'Lung',
  port: 'Port',
  refusedPrefix: 'Stopped:',
  nodule: 'Nodule',
  forcepsShaft: 'Forceps',
  forcepsJaws: 'Forceps’ jaws',
} as const

/** While the anatomy loads or cannot be had. */
export const READINESS_WORDS = {
  loading: 'Loading the anatomy.',
  loadingAgain: 'Loading the anatomy again.',
  unavailable: 'The anatomy could not be loaded.',
} as const

/** The 3D scene's views (slice 11). */
export const SCENE_WORDS = {
  chestHeading: 'Chest view',
  chestNote:
    'The chest seen from the patient’s front, with the head to the right and the patient on the left side. Each region of the wall is shaded by the model’s estimate.',
  scopeHeading: 'Scope view',
  scopeNote: 'What the telescope shows, in its round field.',
  drawnWithout:
    'The chest cannot be drawn in three dimensions here, so the Chest view is shown as a cut through the space.',
} as const

export const KEY_WORDS = {
  heading: 'Keys',
  focusNote: 'The keys work while the pane has focus.',
  holdNote: 'Holding a key keeps the telescope moving.',
  reducedNote: 'Motion is reduced, so each press moves one step.',
  showHelp: 'Show the keys',
  hideHelp: 'Hide the keys',
  keyColumn: 'Key',
  actionColumn: 'Does',
} as const

/** What each command does, for the key help. */
export function commandWords(command: SpaceCommand): string {
  switch (command.kind) {
    case 'pivot':
      return `Pivot: ${PIVOT_WORDS[command.hand].toLowerCase()}`
    case 'depth':
      return `Depth: ${DEPTH_WORDS[command.direction].toLowerCase()}`
    case 'roll':
      return `Roll: ${ROLL_WORDS[command.direction].toLowerCase()}`
    case 'step-clock':
      return 'Step the waiting model on'
    case 'retry-geometry':
      return DOCK_WORDS.retry
    case 'tool':
      return `${TOOL_WORDS.partName}: ${command.direction === 'extend' ? 'out' : 'back in'}`
    case 'jaws':
      return `${TOOL_WORDS.partName}: jaws ${command.action === 'open' ? 'open' : 'closed'}`
  }
}

function validate(): void {
  const label = { allowDigits: false } as const
  assertThoracoscopyCopy([
    ...Object.entries(SEEN_WORDS).map(([key, text]) => ({
      where: `seen ${key}`,
      text,
      options: label,
    })),
    ...Object.entries(REASON_WORDS).map(([key, text]) => ({
      where: `reason ${key}`,
      text,
      options: label,
    })),
    ...Object.entries(LEDGER_WORDS).map(([key, text]) => ({
      where: `ledger ${key}`,
      text,
      options: label,
    })),
    ...Object.entries(PIVOT_WORDS).map(([key, text]) => ({
      where: `pivot ${key}`,
      text,
      options: label,
    })),
    ...Object.entries(DEPTH_WORDS).map(([key, text]) => ({
      where: `depth ${key}`,
      text,
      options: label,
    })),
    ...Object.entries(ROLL_WORDS).map(([key, text]) => ({
      where: `roll ${key}`,
      text,
      options: label,
    })),
    ...Object.entries(DOCK_WORDS).map(([key, text]) => ({
      where: `dock ${key}`,
      text,
      options: label,
    })),
    ...Object.entries(VIEW_WORDS).map(([key, text]) => ({
      where: `view ${key}`,
      text,
      options: label,
    })),
    ...Object.entries(READINESS_WORDS).map(([key, text]) => ({
      where: `readiness ${key}`,
      text,
      options: label,
    })),
    ...Object.entries(SCENE_WORDS).map(([key, text]) => ({
      where: `scene ${key}`,
      text,
      options: label,
    })),
    ...Object.entries(KEY_WORDS).map(([key, text]) => ({
      where: `keys ${key}`,
      text,
      options: label,
    })),
    ...Object.entries(TOOL_WORDS).map(([key, text]) => ({
      where: `tool ${key}`,
      text,
      options: label,
    })),
    ...(['extend', 'retract'] as const).map((direction) => ({
      where: `tool command ${direction}`,
      text: commandWords({ kind: 'tool', direction }),
      options: label,
    })),
    { where: 'taught in', text: taughtInWords('Four controls'), options: label },
  ])
}

validate()
