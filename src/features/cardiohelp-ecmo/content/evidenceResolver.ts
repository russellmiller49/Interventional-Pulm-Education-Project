import type { EvidenceReference } from '../engine/types'
import { cardiohelpEvidence, evidenceById } from './evidence'

/**
 * One resolver for every place this module cites a source.
 *
 * Four renderers used to read the evidence registry four different ways: the hub's card grid
 * resolved titles and linked `url`, the localization card resolved titles beside a per-row claim,
 * and the circuit walk, the foundation narrative and the VA configuration card printed raw registry
 * ids into learner-facing copy. A raw id is an implementation token — it names nothing a learner can
 * look up. Everything that shows a source now resolves it here and renders it through
 * `EcmoSourceList`, so a title, a source class, a claim scope and an openable link arrive together
 * wherever a source is named.
 *
 * Ids appear only in `data-evidence-id` attributes, never in copy. That is what lets a test scan a
 * rendered surface for every registered id and treat any hit as a defect.
 */

export type EcmoSourceClass = EvidenceReference['sourceClass']

/** Registry order for grouped rendering: the device first, then guidance, teaching, the model. */
export const ecmoSourceClasses: readonly EcmoSourceClass[] = [
  'manufacturer',
  'clinical-guidance',
  'textbook',
  'educational-model',
]

/** The wording every badge and group heading reads. Formerly private to the hub's sources panel. */
export const ecmoSourceClassLabels: Readonly<Record<EcmoSourceClass, string>> = {
  manufacturer: 'Manufacturer behavior',
  'clinical-guidance': 'ECMO clinical guidance',
  textbook: 'Textbook teaching',
  'educational-model': 'Simplified educational model',
}

/**
 * What a learner reads in production when an id resolves to nothing. Never the id itself.
 *
 * Outside production the same condition throws, because a cited id that no longer resolves is a
 * registry defect to fix, not a state to render around.
 */
export const ECMO_UNREGISTERED_SOURCE_TITLE =
  "This source is not registered in the module's evidence list."
export const ECMO_UNREGISTERED_SOURCE_NOTE =
  'Treat any claim that relies on it as unsupported until it is registered.'
export const ECMO_UNREGISTERED_SOURCE_LABEL = 'Unregistered source'

export type EcmoCitationSourceClass = EcmoSourceClass | 'unregistered'

export interface EcmoResolvedCitation {
  readonly id: string
  readonly title: string
  readonly citation: string
  readonly pages?: string
  readonly sourceClass: EcmoCitationSourceClass
  readonly sourceClassLabel: string
  readonly url?: string
  readonly doi?: string
  /** The link to open: the DOI resolver when a DOI is registered, otherwise the record's URL. */
  readonly href?: string
  /** The caller's claim for this id when one was given, otherwise what the record itself supports. */
  readonly supports: readonly string[]
  readonly limitations: string
  /** One line a learner can paste into a reference list. */
  readonly copyText: string
}

export interface ResolveEcmoEvidenceOptions {
  /** Evidence id → the specific claim the citing surface takes from that source. */
  readonly claims?: Readonly<Record<string, string>>
}

export function ecmoEvidenceHref(
  reference: Pick<EvidenceReference, 'doi' | 'url'>,
): string | undefined {
  if (reference.doi) return `https://doi.org/${reference.doi}`
  return reference.url
}

export function ecmoCitationCopyText(
  citation: Pick<EcmoResolvedCitation, 'title' | 'citation' | 'pages' | 'href'>,
): string {
  const pages = citation.pages ? ` Pages ${citation.pages}.` : ''
  const link = citation.href ? ` ${citation.href}` : ''
  return `${citation.title}. ${citation.citation}${pages}${link}`
}

/** The production stand-in for an id that resolves to nothing. Carries the id in no text field. */
export function unregisteredEcmoCitation(id: string): EcmoResolvedCitation {
  return {
    id,
    title: ECMO_UNREGISTERED_SOURCE_TITLE,
    citation: ECMO_UNREGISTERED_SOURCE_NOTE,
    sourceClass: 'unregistered',
    sourceClassLabel: ECMO_UNREGISTERED_SOURCE_LABEL,
    supports: [],
    limitations: '',
    copyText: ECMO_UNREGISTERED_SOURCE_TITLE,
  }
}

function claimFor(
  claims: Readonly<Record<string, string>> | undefined,
  id: string,
): string | undefined {
  // Own keys only: a claims map is authored data, and a registry id must never be answered by
  // something inherited from Object.prototype.
  if (!claims || !Object.hasOwn(claims, id)) return undefined
  const claim = claims[id]
  return typeof claim === 'string' && claim.length > 0 ? claim : undefined
}

export function resolveEcmoCitation(
  id: string,
  options: ResolveEcmoEvidenceOptions = {},
): EcmoResolvedCitation {
  const record = evidenceById.get(id)
  if (!record) {
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(`Unregistered CARDIOHELP ECMO evidence id: ${id}`)
    }
    return unregisteredEcmoCitation(id)
  }
  const href = ecmoEvidenceHref(record)
  const claim = claimFor(options.claims, id)
  const resolved = {
    id: record.id,
    title: record.title,
    citation: record.citation,
    ...(record.pages ? { pages: record.pages } : {}),
    sourceClass: record.sourceClass,
    sourceClassLabel: ecmoSourceClassLabels[record.sourceClass],
    ...(record.url ? { url: record.url } : {}),
    ...(record.doi ? { doi: record.doi } : {}),
    ...(href ? { href } : {}),
    supports: claim ? [claim] : record.supports,
    limitations: record.limitations,
  }
  return { ...resolved, copyText: ecmoCitationCopyText(resolved) }
}

/**
 * Resolve each id once, in the caller's order.
 *
 * Duplicates collapse to their first position: a surface that names the same record twice is making
 * one citation, and two identical rows would hand a list two keys for one thing.
 */
export function resolveEcmoEvidence(
  ids: readonly string[],
  options: ResolveEcmoEvidenceOptions = {},
): readonly EcmoResolvedCitation[] {
  return [...new Set(ids)].map((id) => resolveEcmoCitation(id, options))
}

/** Registry ids of one source class, in registry order. */
export function ecmoEvidenceIdsBySourceClass(sourceClass: EcmoSourceClass): readonly string[] {
  return cardiohelpEvidence
    .filter((reference) => reference.sourceClass === sourceClass)
    .map((reference) => reference.id)
}
