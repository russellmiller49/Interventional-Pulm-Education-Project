import { caseCopyErrors, REWRITE_CAPS, testWiseScore } from './authoringRules'
import { isBronchSectionId } from './sectionIds'
import { vignetteItem } from './stageItems'
import { VIGNETTE_TOPIC_TITLES, VIGNETTES, type VignetteTopic } from './vignettes'

/** How many vignettes each topic holds. */
export const VIGNETTES_PER_TOPIC = 5

/**
 * What is wrong with the vignettes. Empty when every one is sound: the copy rules a section's own
 * questions are held to, a patient with numbers, one keyed move, no length or wording cue to the
 * key, and five to a topic.
 */
export function vignetteErrors(): readonly string[] {
  const errors: string[] = []
  const ids = VIGNETTES.map((vignette) => vignette.id)
  if (new Set(ids).size !== ids.length) errors.push('The vignettes repeat an id.')
  const titles = VIGNETTES.map((vignette) => vignette.presentationTitle)
  if (new Set(titles).size !== titles.length) errors.push('The vignettes repeat a title.')
  for (const topic of Object.keys(VIGNETTE_TOPIC_TITLES) as VignetteTopic[]) {
    const count = VIGNETTES.filter((vignette) => vignette.topic === topic).length
    if (count !== VIGNETTES_PER_TOPIC)
      errors.push(`Topic ${topic} has ${count} vignettes; ${VIGNETTES_PER_TOPIC} each.`)
  }
  for (const vignette of VIGNETTES) {
    const where = `vignette ${vignette.id}`
    if (!isBronchSectionId(vignette.sectionId)) {
      errors.push(`${where} pairs to an unknown section.`)
      continue
    }
    // The rules read the copy as written, with its number tokens in place.
    const item = {
      ...vignetteItem(vignette),
      choices: vignette.choices,
      explanation: vignette.explanation,
    }
    errors.push(...caseCopyErrors(where, vignette.situation, item, vignette.sums === true))
    if (/\d/.test(vignette.presentationTitle)) errors.push(`${where} title carries a digit.`)
    if (!/\d/.test(vignette.situation)) errors.push(`${where} gives the patient no numbers.`)
    const best = vignette.choices.filter((choice) => choice.plausibility === 'best')
    if (best.length !== 1 || vignette.choices.length !== 4)
      errors.push(`${where} needs four choices with one key.`)
    const longest = Math.max(
      ...vignette.choices
        .filter((choice) => choice.plausibility !== 'best')
        .map((choice) => choice.label.length),
    )
    if (best[0] && best[0].label.length > longest * 1.25)
      errors.push(
        `${where}: the keyed choice (${best[0].label.length} characters) is more than a quarter longer than the longest distractor (${longest}); length cues the key.`,
      )
    if (vignette.choices.some((choice) => choice.rationale.trim().length < 30))
      errors.push(`${where} has a reason too short to explain anything.`)
  }
  const score = testWiseScore(VIGNETTES)
  if (score > REWRITE_CAPS.testWiseScore)
    errors.push(
      `A test-wise reader gets ${(score * 100).toFixed(0)} in 100 of the vignettes; at most ${REWRITE_CAPS.testWiseScore * 100}.`,
    )
  const keyLongest = VIGNETTES.filter((vignette) => {
    const best = vignette.choices.find((choice) => choice.plausibility === 'best')!
    return vignette.choices.every((choice) => choice.label.length <= best.label.length)
  }).length
  if (keyLongest / VIGNETTES.length >= 0.5)
    errors.push(
      `The keyed choice is the longest in ${keyLongest} of ${VIGNETTES.length} vignettes.`,
    )
  const letters = new Set(
    VIGNETTES.map(
      (vignette) => vignette.choices.find((choice) => choice.plausibility === 'best')!.id,
    ),
  )
  if (letters.size < 4) errors.push('The key does not take every position across the vignettes.')
  return errors
}
