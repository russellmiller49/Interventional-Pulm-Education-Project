import { caseCopyErrors, REWRITE_CAPS, testWiseScore } from './authoringRules'
import { CAPSTONE_CASES } from './capstone'
import { BRONCH_SECTIONS } from './sections'

/**
 * What is wrong with the integrated cases under the rewrite rules. Empty when every one is sound:
 * the copy rules a section's questions are held to, a patient with numbers, a key that is not
 * cued by its length, `unsafe` only on the paired section's named reflex, and no reward for a
 * test-wise reader.
 */
export function capstoneRuleErrors(): readonly string[] {
  const errors: string[] = []
  for (const entry of CAPSTONE_CASES) {
    const where = `integrated case ${entry.id}`
    errors.push(...caseCopyErrors(where, entry.situation, entry.item))
    if (!/^(You |A |An |After )/.test(entry.situation) || !/\byou(r)?\b/i.test(entry.situation))
      errors.push(`${where} does not put the reader in the room.`)
    if (!/\d/.test(entry.situation)) errors.push(`${where} gives the patient no numbers.`)
    const best = entry.item.choices.find((choice) => choice.plausibility === 'best')
    const longest = Math.max(
      ...entry.item.choices
        .filter((choice) => choice.plausibility !== 'best')
        .map((choice) => choice.label.length),
    )
    if (best && best.label.length > longest * 1.25)
      errors.push(`${where}: the keyed choice is more than a quarter longer than any other.`)
    const patterns =
      BRONCH_SECTIONS.find((section) => section.id === entry.pairedSectionId)
        ?.harmfulReflexPatterns ?? []
    for (const choice of entry.item.choices)
      if (
        choice.plausibility === 'unsafe' &&
        !patterns.some((pattern) => pattern.test(choice.label))
      )
        errors.push(
          `${where} choice ${choice.id} is flagged unsafe but is not the harmful reflex of ${entry.pairedSectionId}.`,
        )
  }
  const items = CAPSTONE_CASES.map((entry) => entry.item)
  const score = testWiseScore(items)
  if (score > REWRITE_CAPS.testWiseScore)
    errors.push(
      `A test-wise reader gets ${(score * 100).toFixed(0)} in 100 of the integrated cases; at most ${REWRITE_CAPS.testWiseScore * 100}.`,
    )
  const letters = new Set(
    items.map((item) => item.choices.find((choice) => choice.plausibility === 'best')?.id),
  )
  if (letters.size < 4)
    errors.push('The key does not take every position across the integrated cases.')
  return errors
}
