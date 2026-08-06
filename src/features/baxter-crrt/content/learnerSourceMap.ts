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
