/**
 * The canonical order: the one ordering authority every surface lists content from. Everything
 * that counts, numbers or groups sections derives from this array at render; nothing writes a
 * count down.
 */
export const dolphinSectionIds = [
  'why-scope-a-dolphin',
  'an-airway-apart-from-the-mouth',
  'from-blowhole-to-spout',
  'below-the-larynx',
  'the-numbered-map',
  'same-in-every-dolphin',
  'reading-the-picture',
  'finding-a-named-branch',
  'choosing-the-instrument',
  'before-the-day',
  'the-room-and-the-team',
  'sedation-and-numbing',
  'entering-the-blowhole',
  'the-survey-and-the-record',
  'lavage',
  'brush-and-biopsy',
  'trouble-during-the-procedure',
  'recovery-and-return',
  'beyond-the-survey',
  'what-this-module-can-say',
] as const

export type DolphinSectionId = (typeof dolphinSectionIds)[number]

export function isDolphinSectionId(value: unknown): value is DolphinSectionId {
  return typeof value === 'string' && (dolphinSectionIds as readonly string[]).includes(value)
}
