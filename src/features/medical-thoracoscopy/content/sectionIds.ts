/**
 * The nineteen Learn sections, in the canonical order. Ids never change: progress, links and the
 * claim register all name sections by them. A test pins this list to the implementation manifest.
 */
export const THORACOSCOPY_SECTION_IDS = [
  'why-thoracoscopy',
  'patient-selection',
  'the-instrument',
  'room-and-tower',
  'the-chest-wall',
  'normal-pleural-space',
  'four-controls',
  'choosing-the-port',
  'entry',
  'making-room',
  'systematic-survey',
  'reading-the-pleura',
  'taking-biopsies',
  'energy-and-bleeding',
  'adhesions',
  'talc-poudrage',
  'finishing',
  'complications',
  'what-completion-means',
] as const

export type ThoracoscopySectionId = (typeof THORACOSCOPY_SECTION_IDS)[number]

export function isThoracoscopySectionId(value: unknown): value is ThoracoscopySectionId {
  return (
    typeof value === 'string' && (THORACOSCOPY_SECTION_IDS as readonly string[]).includes(value)
  )
}
