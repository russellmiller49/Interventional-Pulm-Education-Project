import { sponsorships, type Sponsorship } from './registry'

/**
 * What the sponsorship policy lets a page do. Pages ask here rather than reading the registry, so
 * the rule that nothing unapproved is shown lives in one place.
 */
export function sponsorshipForModule(moduleId: string): Sponsorship | null {
  return sponsorships.find((record) => record.moduleId === moduleId) ?? null
}

/**
 * The disclosure a module's pages print, or null when there is nothing the owner has approved.
 * A null here means the page shows no disclosure at all: not a placeholder, not a draft.
 */
export function approvedDisclosure(moduleId: string): string | null {
  const record = sponsorshipForModule(moduleId)
  if (!record) return null
  const { wording, approvedBy, approvedOn } = record.disclosure
  if (wording === null || approvedBy === null || approvedOn === null) return null
  return wording
}

/**
 * Words the policy keeps out of a sponsored module's learner-facing text: superlatives, praise
 * and claims of superiority. A match is a prompt for a person to read the sentence, not a verdict;
 * the module's copy check exempts a sentence only by name.
 */
export const PROMOTIONAL_WORDING =
  /\b(best|leading|superior|unrivalled|unrivaled|unique|unmatched|world-class|state-of-the-art|cutting-edge|revolutionary|innovative|optimal|optimum|maximum versatility|seamless|effortless|premium|trusted|preferred)\b/i
