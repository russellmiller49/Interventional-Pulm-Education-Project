import type { SpaceRefusal } from '../../components/space/types'
import { assertThoracoscopyCopy } from '../../content/learnerCopy'
import { PLEURAL_ZONE_IDS, pleuralZone, type PleuralZoneId } from '../../content/pleuralZones'
import type { Limit } from './spatial/sweep'

/**
 * What the engine says when something stops, checked by the learner-copy gate as it loads. The
 * part is always named (fidelity contract, "Contact"); a hard stop is a limit of the model.
 */
const PART = { sleeve: 'The sleeve', telescope: 'The telescope' } as const

export const LIMIT_WORDS = {
  lung: 'The lung is in the way, so it goes no further this way.',
  wall: 'It is against the wall of the space, so it goes no further this way.',
  ribs: 'It rests against the ribs and tilts no further this way.',
  fullyIn: 'It is in as far as it goes.',
  backInSleeve: 'It is back in the sleeve and comes no further out.',
  lungHeld: 'It meets the telescope and is held there until there is room.',
} as const

export const CROSS_SECTION_SEEN_FROM = 'Seen from the patient’s front, with the head to the right.'

/** Against the wall, by a named region. */
export function wallWords(zone: PleuralZoneId): string {
  return `It is against the wall of the space, by the ${pleuralZone(zone).name.toLowerCase()}, so it goes no further this way.`
}

export function refusalOf(
  limit: Limit | null,
  lungHeld: boolean,
  wallZone: PleuralZoneId | null = null,
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
