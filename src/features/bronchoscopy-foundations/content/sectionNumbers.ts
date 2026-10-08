import { numberIdsIn, resolveNumbers, unsignedNumberIds, type NumberId } from './numbers'
import type { BronchSectionDefinition } from './types'

/**
 * Turns an authored section into the one the course renders: every register token becomes its
 * value, and each card and question records which register rows it used, so it can name their
 * sources in one line. A section with no token is returned as it is.
 */
function idsIn(value: unknown): readonly NumberId[] {
  return numberIdsIn(JSON.stringify(value) ?? '')
}

function resolveDeep<T>(value: T): T {
  if (typeof value === 'string') return resolveNumbers(value) as T
  if (Array.isArray(value)) return value.map((entry) => resolveDeep(entry)) as T
  if (
    value !== null &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  )
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, resolveDeep(entry)]),
    ) as T
  return value
}

export function withResolvedNumbers(section: BronchSectionDefinition): BronchSectionDefinition {
  if (idsIn(section).length === 0) return section
  return resolveDeep({
    ...section,
    blocks: section.blocks.map((block) => ({ ...block, numberIds: idsIn(block) })),
    prediction: { ...section.prediction, numberIds: idsIn(section.prediction) },
    transfer: { ...section.transfer, numberIds: idsIn(section.transfer) },
    practice: section.practice.map((entry) => ({
      ...entry,
      item: { ...entry.item, numberIds: idsIn([entry.situation, entry.item]) },
    })),
  })
}

/** Every register row a section's copy uses, for the signature gate and the PR's numbers table. */
export function sectionNumberIds(section: BronchSectionDefinition): readonly NumberId[] {
  return idsIn(section)
}

/**
 * What stands between the course and publication: every register row a section uses that faculty
 * has not signed. Nothing while the module is an unlisted preview; the release-boundary test holds
 * the published stage to an empty list.
 */
export function publishBlockers(
  stage: 'unlisted-preview' | 'published',
  sections: readonly BronchSectionDefinition[],
): readonly string[] {
  if (stage !== 'published') return []
  return sections.flatMap((section) =>
    unsignedNumberIds(sectionNumberIds(section)).map(
      (id) => `${section.id} uses "${id}", which faculty has not signed.`,
    ),
  )
}
