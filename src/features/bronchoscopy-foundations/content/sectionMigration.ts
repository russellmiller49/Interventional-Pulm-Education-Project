import { isBronchSectionId } from './sectionIds'

/**
 * The fifteen sections the rewrite ends at, in order (rewrite plan, 2026-10-08). Two do not exist
 * yet: `biopsy-and-specimens` and `ventilated-patient` are authored in their batches.
 */
export const REWRITE_SECTION_ORDER = [
  'clinical-question',
  'pre-use-check',
  'sedation-and-monitoring',
  'five-controls',
  'larynx-and-entry',
  'right-side',
  'left-side',
  'view-loss',
  'systematic-survey',
  'describe-findings',
  'washing-and-lavage',
  'biopsy-and-specimens',
  'deterioration',
  'bleeding-priorities',
  'ventilated-patient',
] as const

/**
 * Where each section the rewrite retires leads. A saved place or a link that names a retired
 * section opens the section that absorbed it, so a returning learner lands somewhere sensible
 * instead of losing the place.
 */
export const RETIRED_SECTION_FORWARD: Readonly<Record<string, string>> = {
  'shared-airway': 'clinical-question',
  'branch-entry': 'five-controls',
  'reference-frames': 'right-side',
  'poor-return': 'washing-and-lavage',
  'protected-accessories': 'biopsy-and-specimens',
  'specimen-pathway': 'biopsy-and-specimens',
  'scope-in-a-tube': 'ventilated-patient',
  'icu-physiology': 'ventilated-patient',
  'honest-report': 'describe-findings',
  'what-completion-means': 'ventilated-patient',
}

/**
 * The section an id names today: itself while it is still in the course, otherwise the section
 * that absorbed it, otherwise nothing. `isCurrent` is a parameter so the end state can be tested
 * before the last section is retired.
 */
export function forwardSectionId(
  id: string,
  isCurrent: (id: string) => boolean = isBronchSectionId,
): string | null {
  if (isCurrent(id)) return id
  const target = RETIRED_SECTION_FORWARD[id]
  return target && isCurrent(target) ? target : null
}

/** A saved list of section ids, carried forward: retired ids replaced, unknown ids dropped. */
export function forwardSectionIds(
  ids: readonly string[],
  isCurrent: (id: string) => boolean = isBronchSectionId,
): string[] {
  return [
    ...new Set(
      ids.flatMap((id) => {
        const forwarded = forwardSectionId(id, isCurrent)
        return forwarded ? [forwarded] : []
      }),
    ),
  ]
}
