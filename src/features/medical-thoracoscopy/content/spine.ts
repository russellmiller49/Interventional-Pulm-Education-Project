/**
 * The procedure spine: the eight phases every section, scenario and case is placed on, in the
 * order the procedure runs. Imported from the original plan; a test pins it to the manifest.
 */
export const THORACOSCOPY_SPINE = [
  'Decide',
  'Set up',
  'Enter',
  'Make room',
  'Survey',
  'Sample',
  'Treat',
  'Finish',
] as const

export type ThoracoscopySpinePhase = (typeof THORACOSCOPY_SPINE)[number]

/** "Decide, set up, enter, make room, survey, sample, treat and finish." The hub's heading. */
export function spineSentence(): string {
  const words = THORACOSCOPY_SPINE.map((phase, index) =>
    index === 0 ? phase : phase.toLowerCase(),
  )
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}.`
}
