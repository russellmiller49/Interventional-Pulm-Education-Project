/**
 * The one registry a learner-facing CRRT citation resolves against.
 *
 * This exists because the module used to merge only two of its three source
 * registries when rendering evidence, and dropped anything it could not find
 * without complaining. `MATH-PM-002` — the TMP formula, and the most important
 * citation on the pressure view — lives only in the device-math registry, so it
 * silently vanished wherever it was cited. `FLUID-PM-002`, which the fluid
 * ledger is built on, had the same problem.
 *
 * Merging here rather than at each call site means there is a single definition
 * to test against, and a citation cannot resolve on one surface while
 * disappearing on another.
 *
 * This module deliberately imports registries only. Lesson and anchor content
 * reaches `@/features/learning-module/*` for runtime values, and pulling that in
 * would break the CRRT harnesses that run under plain `npx tsx`. Enumerating
 * what the lessons actually cite is the test's job, not this file's.
 */

import { baxterCrrtSupplementalSourceReferences } from './phase7ReviewSources'
import {
  baxterCrrtEngineSourceRecords,
  baxterCrrtPilotSourceReferences,
  baxterCrrtSourceRecords,
  type BaxterCrrtSourceRecord,
} from './provenance'
import type { SourceReference } from './schema'

/**
 * The device-profile registry is a fourth shape, and lessons cite it —
 * `DEV-PM-008`, `DEV-PM-012`, and `DEV-PM-014` are cited by a Learn lesson and by
 * a clinical anchor, and resolved nowhere before this projection existed.
 *
 * The mapping is faithful rather than inventive: the record's limitation becomes
 * `value`, which is how the module already carries a qualifying sentence on a
 * non-numeric record (see `DEV-PM-005` in the pilot registry), and the
 * implementation location is the device profile that lists these ids.
 */
function asSourceReference(record: BaxterCrrtSourceRecord): SourceReference {
  return Object.freeze({
    id: record.id,
    claim: record.claim,
    value: record.limitation,
    sourceTitle: record.sourceTitle,
    sourceType: 'device-manual' as const,
    documentVersion: record.documentIdentity,
    pageOrSection: record.pageOrSection,
    implementationLocation: 'content/deviceProfiles.ts',
    reviewer: null,
    reviewStatus: record.reviewStatus,
  })
}

/**
 * Pilot and supplemental records are listed first so that where an id appears in
 * more than one registry the record the module already rendered keeps winning,
 * and the later registries only fill genuine gaps.
 */
export const baxterCrrtLearnerFacingSourceReferences: readonly SourceReference[] = Object.freeze([
  ...baxterCrrtPilotSourceReferences,
  ...baxterCrrtSupplementalSourceReferences,
  ...baxterCrrtEngineSourceRecords,
  ...baxterCrrtSourceRecords.map(asSourceReference),
])

const byId = new Map<string, SourceReference>()
for (const reference of baxterCrrtLearnerFacingSourceReferences) {
  if (!byId.has(reference.id)) byId.set(reference.id, reference)
}

export const baxterCrrtLearnerFacingSourceById: ReadonlyMap<string, SourceReference> = byId

export function crrtLearnerFacingSourceIds(): readonly string[] {
  return [...byId.keys()].sort()
}

/** True when a citation will render rather than silently disappear. */
export function isResolvableCrrtSourceId(id: string): boolean {
  return byId.has(id)
}

/**
 * Fail-closed lookup for code that must not carry an unresolvable citation.
 * The learner-facing renderer stays tolerant — a broken citation should not blank
 * a lesson — so the guarantee that nothing is silently dropped is enforced by
 * tests over the authored content instead.
 */
export function resolveCrrtLearnerFacingSource(id: string): SourceReference {
  const reference = byId.get(id)
  if (!reference) {
    throw new Error(
      `CRRT citation ${id} resolves in no registered source registry. Add the record, or remove the citation.`,
    )
  }
  return reference
}

/** Returns the unresolvable members of a citation list, for validators and tests. */
export function unresolvableCrrtSourceIds(ids: Iterable<string>): readonly string[] {
  const missing = new Set<string>()
  for (const id of ids) {
    if (!byId.has(id)) missing.add(id)
  }
  return [...missing].sort()
}

/* ------------------------------------------------------------------ *
 * Claim-specific support — a different question from resolution
 * ------------------------------------------------------------------ */

/**
 * Everything above answers one question: *does this citation resolve to a registered record?*
 * That is syntactic closure, and it is necessary but not sufficient. A citation can resolve
 * perfectly and still be misleading, because the record it resolves to says nothing about the
 * statement it is attached to.
 *
 * The C0/C1 citrate first-use terms were the case that made the distinction concrete. All seven
 * cited `REVIEW-CKRT-CORE-2025`, `TEXT-CRRT-NEYRA-2026`, and `GUID-RRT-ICU-2026`, all three ids
 * resolved, and the panel printed them as "Sources:" under each definition — yet those records'
 * registered claims are about transport mechanisms, modality concepts, treatment goals, delivered
 * therapy, access, fluid-removal tolerance, and the prescribed-versus-delivered gap. None of them
 * says anything about where citrate enters a circuit, what it binds, which sample describes which
 * compartment, or where calcium replacement runs.
 *
 * So this second layer asks: *does the record's own registered `claim` string cover the topic the
 * statement needs?* The map below is a hand audit of those `claim` strings and nothing more. It is
 * deliberately conservative: a topic is listed only when the record's claim names it. Adding a
 * topic to a record here is a provenance decision, not a formatting one.
 */
export const CRRT_CLAIM_TOPICS = [
  /* Topics the registered clinical records do cover. */
  'solute-transport-mechanisms',
  'modality-concepts',
  'modality-selection',
  'treatment-goals',
  'modality-logistics',
  'delivered-therapy',
  'prescribed-versus-delivered',
  'vascular-access',
  'fluid-removal-tolerance',
  'continuous-therapy-for-instability',
  /* Topics this module's own authored artefacts cover. */
  'circuit-topology',
  'authored-citrate-teaching-structure',
  /**
   * Deliberately unmapped. No record in this module's registered set carries a claim about what
   * citrate binds, what becomes of it, or how it moves across a membrane. A statement needing this
   * topic is a source gap by construction, and stays one until an SME expands the source set.
   */
  'citrate-pharmacology',
] as const

export type CrrtClaimTopic = (typeof CRRT_CLAIM_TOPICS)[number]

/**
 * Source id → the topics that record's own registered `claim` string actually covers.
 *
 * Only records cited as claim support need an entry. An unmapped id supports nothing, which is the
 * safe default: a new citation has to be audited into this map before it can be presented as
 * support for anything.
 */
const claimTopicsBySourceId: ReadonlyMap<string, readonly CrrtClaimTopic[]> = new Map([
  // "The review describes diffusion, convection, ultrafiltration, adsorption, and continuous
  //  kidney-replacement modality concepts."
  ['REVIEW-CKRT-CORE-2025', ['solute-transport-mechanisms', 'modality-concepts'] as const],
  // "The chapter frames kidney-replacement decisions around patient-specific solute and
  //  volume-control goals, modality logistics, delivered therapy, access, and iterative tolerance
  //  of fluid removal."
  [
    'TEXT-CRRT-NEYRA-2026',
    [
      'treatment-goals',
      'modality-logistics',
      'delivered-therapy',
      'vascular-access',
      'fluid-removal-tolerance',
    ] as const,
  ],
  // "The multidisciplinary guideline describes individualized modality selection, continuous or
  //  prolonged therapy for hemodynamic instability, and the gap between prescribed and delivered
  //  continuous therapy during interruptions."
  [
    'GUID-RRT-ICU-2026',
    [
      'modality-selection',
      'continuous-therapy-for-instability',
      'prescribed-versus-delivered',
    ] as const,
  ],
  // The module's own authored citrate-teaching record, whose claim covers the authored structure
  // and the circuit schematic those statements are read off.
  ['SYNTH-LAB-CITRATE-001', ['authored-citrate-teaching-structure', 'circuit-topology'] as const],
])

/**
 * True only when the record resolves *and* its registered claim covers the topic.
 *
 * `isResolvableCrrtSourceId(id)` being true says nothing about this.
 */
export function crrtSourceSupportsClaim(sourceId: string, topic: CrrtClaimTopic): boolean {
  if (!byId.has(sourceId)) return false
  return (claimTopicsBySourceId.get(sourceId) ?? []).includes(topic)
}

/** Every registered record whose claim covers the topic. Empty means the set has a gap. */
export function crrtSourcesSupportingClaim(topic: CrrtClaimTopic): readonly string[] {
  return [...claimTopicsBySourceId]
    .filter(([, topics]) => topics.includes(topic))
    .map(([id]) => id)
    .sort()
}

export interface CrrtClaimCitation {
  /** Where the citation appears, for the failure message. */
  readonly label: string
  readonly sourceId: string
  readonly topic: CrrtClaimTopic
}

/**
 * The semantic counterpart of `unresolvableCrrtSourceIds`. Returns the citations that resolve but
 * are not supported by the record they resolve to.
 */
export function unsupportedCrrtClaimCitations(
  citations: Iterable<CrrtClaimCitation>,
): readonly CrrtClaimCitation[] {
  return [...citations].filter(
    (citation) => !crrtSourceSupportsClaim(citation.sourceId, citation.topic),
  )
}
