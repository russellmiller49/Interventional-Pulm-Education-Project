import type { SpaceRefusal } from '../../components/space/types'
import { assertThoracoscopyCopy } from '../../content/learnerCopy'
import { PLEURAL_ZONE_IDS, pleuralZone, type PleuralZoneId } from '../../content/pleuralZones'
import type { Limit } from './spatial/sweep'

/**
 * What the engine says when something stops, checked by the learner-copy gate as it loads. The
 * part is always named (fidelity contract, "Contact"); a hard stop is a limit of the model.
 */
const PART = {
  sleeve: 'The sleeve',
  telescope: 'The telescope',
  'tool-shaft': 'The forceps’ shaft',
  'working-element': 'The forceps’ jaws',
  forceps: 'The forceps',
} as const

export const LIMIT_WORDS = {
  lung: 'The lung is in the way, so it goes no further this way.',
  wall: 'It is against the wall of the space, so it goes no further this way.',
  ribs: 'It rests against the ribs and tilts no further this way.',
  fullyIn: 'It is in as far as it goes.',
  backInSleeve: 'It is back in the sleeve and comes no further out.',
  lungHeld: 'It meets the telescope and is held there until there is room.',
  target: 'It is against the nodule and is kept clear of it, so it goes no further this way.',
  touching: 'They touch the nodule and go no further this way.',
  toolOut: 'They are out as far as this model lets them go.',
  toolIn: 'They are back in the channel and go no further in.',
  jawsOpen: 'Their jaws are open. Close them before bringing them back.',
  jawsInChannel: 'Their jaws open only once they are all the way out of the channel.',
} as const

export const CROSS_SECTION_SEEN_FROM = 'Seen from the patient’s front, with the head to the right.'

/** Against the wall, by a named region. */
export function wallWords(zone: PleuralZoneId): string {
  return `It is against the wall of the space, by the ${pleuralZone(zone).name.toLowerCase()}, so it goes no further this way.`
}

/**
 * What stopped the last move, in words. `touching` says a part the contact table lets touch is
 * touching: then the forceps' jaws stopped at the nodule because they are touching it, not because
 * they are kept clear of it.
 */
export function refusalOf(
  limit: Limit | null,
  lungHeld: boolean,
  wallZone: PleuralZoneId | null = null,
  touching = false,
): SpaceRefusal | null {
  if (lungHeld) return { part: 'The lung', words: LIMIT_WORDS.lungHeld }
  if (!limit) return null
  switch (limit.kind) {
    case 'lung':
      return { part: PART[limit.part], words: LIMIT_WORDS.lung }
    case 'wall':
      return {
        part: PART[limit.part],
        words: wallZone ? wallWords(wallZone) : LIMIT_WORDS.wall,
      }
    case 'ribs':
      return { part: PART.sleeve, words: LIMIT_WORDS.ribs }
    case 'fully-in':
      return { part: PART.telescope, words: LIMIT_WORDS.fullyIn }
    case 'back-in-sleeve':
      return { part: PART.telescope, words: LIMIT_WORDS.backInSleeve }
    case 'target':
      return {
        part: PART[limit.part],
        words:
          touching && limit.part === 'working-element' ? LIMIT_WORDS.touching : LIMIT_WORDS.target,
      }
    case 'tool-out':
      return { part: PART.forceps, words: LIMIT_WORDS.toolOut }
    case 'tool-in':
      return { part: PART.forceps, words: LIMIT_WORDS.toolIn }
    case 'jaws-open':
      return { part: PART['working-element'], words: LIMIT_WORDS.jawsOpen }
    case 'jaws-in-channel':
      return { part: PART['working-element'], words: LIMIT_WORDS.jawsInChannel }
  }
}

assertThoracoscopyCopy([
  ...Object.entries(LIMIT_WORDS).map(([key, text]) => ({
    where: `limit ${key}`,
    text,
    options: { allowDigits: false },
  })),
  ...Object.values(PART).map((text) => ({ where: 'part', text, options: { allowDigits: false } })),
  { where: 'seen from', text: CROSS_SECTION_SEEN_FROM, options: { allowDigits: false } },
  ...PLEURAL_ZONE_IDS.map((zone) => ({
    where: `wall by ${zone}`,
    text: wallWords(zone),
    options: { allowDigits: false },
  })),
])
