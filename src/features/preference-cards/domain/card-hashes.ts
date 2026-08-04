import { stableSnapshotHash } from './stable-hash'
import type { ResolvedCard, ResolvedCardItem, RuleMessage } from './types'

/**
 * Three hashes over a resolved card, each answering exactly one question.
 *
 * There used to be one, and it was doing two jobs badly. `snapshotHash` was described as proof of
 * what was printed *and* used to decide whether two cards say the same thing, and it could not be
 * both: to keep re-saving an unchanged card from churning its identity it had to exclude
 * `generatedAt`, which means it never detected a tampered timestamp; and because it covered every
 * field including rule-trace prose, a reworded trace message read as a changed card.
 *
 * Split by question:
 *
 * - **`snapshotHash` — storage identity.** Unchanged in value and computation, because it is what
 *   the `snapshot_hash` column holds for every row already written and what share links verify
 *   against. Stable across re-saves of unchanged content. It is not evidence of what was printed
 *   and is no longer described as such.
 * - **`snapshotIntegrityHash` — tamper detection.** Covers the *complete* canonical stored
 *   snapshot: every field, including `generatedAt`, the display names, the rule-trace prose, the
 *   warnings with their acknowledgement and waiver text, provenance, included modules, selected
 *   and suppressed items, readiness — and the other two hashes, so neither can be edited to agree
 *   with a doctored payload. It excludes only itself, which is the one exclusion recursion forces.
 * - **`resolvedContentHash` — semantic comparison.** A documented projection of what the resolver
 *   decided and what the card prints as instructions. Prose-only trace messages are outside it, so
 *   rewording an explanation does not read as a clinical change; stable identifiers are used
 *   wherever one exists, so renaming a product does not read as choosing a different one.
 *
 * The projection below is the contract. It is written as one function with the fields enumerated
 * rather than as a deny-list, because a deny-list silently absorbs every field added later — and a
 * semantic hash that quietly grows to cover implementation prose is the failure this replaces.
 */

/** Bumped when the *meaning* of the projections below changes. Carried inside both new hashes. */
export const CARD_HASH_VERSION = 'ip-cards-card-hash/1'

/**
 * What the semantic projection deliberately leaves out, and why.
 *
 * Recorded as data because "the semantic hash covers the right things" is the load-bearing claim,
 * and `card-hashes.test.ts` asserts each of these individually rather than trusting the prose.
 */
export const RESOLVED_CONTENT_HASH_EXCLUSIONS: Readonly<Record<string, string>> = {
  ruleTrace:
    'Implementation prose. The trace explains how resolution reached its answer; rewording an explanation is not a change to the answer. Every decision the trace narrates is represented elsewhere in the projection by its structured form.',
  generatedAt:
    'When the card was produced, not what it says. Two identical cards generated a minute apart are the same card.',
  'warnings[].message':
    'Prose. The code, severity, and structured source identity say which condition fired; the sentence is how it is explained.',
  'warnings[].id':
    'Positional for the generic cases (`message-3`), so it moves when an unrelated message is added earlier. The structured triple below is the stable identity.',
  'items[].whyIncluded':
    'Derived prose assembled from the same facts the projection already carries.',
  'items[].label, items[].genericRequirement, items[].rationale':
    'Display text belonging to the requirement, addressed here by `requirementKey`. A retitled requirement is covered by the release definition hash, which the projection pins.',
  'items[].selectedItemSnapshot':
    'The full local item record, which carries hospital-local operational state (storage location, local item number, local description). The stable identity of what was chosen is `selectedHospitalItemId` and `selectedCatalogProductId`, both of which are in.',
  organizationName:
    'A display name. `scope.organizationId` is the stable identifier and is in the projection.',
  siteName: 'A display name. `scope.siteId` is the stable identifier and is in the projection.',
  locationName:
    'A display name. `scope.locationId` is the stable identifier and is in the projection.',
  recipeName:
    'A display name for the recipe, which is addressed by `recipeVersionId` and pinned by the release definition hash.',
  engineVersion:
    'The output shape a snapshot was written in — a property of the record, not of the clinical content. A shape change is visible as the field itself and as a different integrity hash.',
  prototype:
    'Derived entirely from `governanceState` and the item verification states already in the projection.',
}

/** A resolved card before any hash has been attached, which is what the projections read. */
export type UnhashedResolvedCard = Omit<
  ResolvedCard,
  'snapshotHash' | 'snapshotIntegrityHash' | 'resolvedContentHash'
>

/**
 * The stable, comparable form of one resolved requirement.
 *
 * Exported because the reconciliation diff compares items field by field, and it must compare
 * exactly the fields the semantic hash covers. Two definitions of "what counts as a difference"
 * would drift, and the drift would show up as a review that reports no changes on a card whose
 * content hash moved.
 */
export function projectResolvedItem(item: ResolvedCardItem) {
  return {
    id: item.id,
    requirementKey: item.requirementKey ?? null,
    sourceSlotId: item.sourceSlotId,
    sourceModuleVersionIds: [...(item.sourceModuleVersionIds ?? [])].sort(),
    roleCode: item.roleCode,
    requiredness: item.requiredness,
    effectiveRequiredness: item.effectiveRequiredness,
    conditionalState: item.conditionalState,
    dependencyRule: item.dependencyRule,
    quantityDisplay: item.quantityDisplay,
    setupZone: item.setupZone,
    proceduralPhase: item.proceduralPhase,
    setupSequence: item.setupSequence,
    openHoldStatus: item.openHoldStatus,
    selectedHospitalItemId: item.selectedHospitalItemId,
    selectedCatalogProductId: item.selectedCatalogProductId,
    resolutionState: item.resolutionState,
    verificationState: item.verificationState,
    compatibilityState: item.compatibilityState,
    // Operationally meaningful: a note is an instruction to the person setting up the room.
    notes: item.notes,
  }
}

/** Warnings by what fired, not by how it was worded or where it landed in the list. */
function projectWarnings(warnings: RuleMessage[]) {
  return warnings
    .map((warning) => ({
      code: warning.code,
      severity: warning.severity,
      sourceType: warning.sourceType,
      sourceId: warning.sourceId,
      acknowledged: warning.acknowledged,
    }))
    .sort((left, right) =>
      [left.code, left.sourceType, left.sourceId ?? '', String(left.acknowledged)]
        .join('|')
        .localeCompare(
          [right.code, right.sourceType, right.sourceId ?? '', String(right.acknowledged)].join(
            '|',
          ),
        ),
    )
}

/**
 * The documented semantic projection of a resolved card.
 *
 * Exported so a reviewer, a test, and any future comparison view all read the same object rather
 * than three implementations of "what counts as a difference".
 */
export function resolvedContentProjection(card: UnhashedResolvedCard) {
  return {
    release: {
      releaseBundleId: card.resolutionProvenance.releaseBundleId,
      releaseDefinitionHash: card.resolutionProvenance.releaseDefinitionHash,
      catalogReleaseId: card.resolutionProvenance.catalogReleaseId,
      resolverContractVersion: card.resolutionProvenance.resolverContractVersion,
    },
    recipeVersionId: card.recipeVersionId,
    recipeVersion: card.recipeVersion,
    sourceProcedureCode: card.sourceProcedureCode,
    scope: {
      organizationId: card.scope.organizationId,
      siteId: card.scope.siteId,
      locationId: card.scope.locationId,
    },
    selectedModifiers: [...card.selectedModifiers].sort(),
    includedModules: [...(card.includedModules ?? [])]
      .map((module) => ({
        moduleVersionId: module.moduleVersionId,
        moduleVersion: module.moduleVersion,
        selectionBehavior: module.selectionBehavior,
        selectionSource: module.selectionSource,
        governanceState: module.governanceState,
      }))
      .sort((left, right) => left.moduleVersionId.localeCompare(right.moduleVersionId)),
    items: card.items.map(projectResolvedItem),
    suppressedItems: card.suppressedItems.map(projectResolvedItem),
    warnings: projectWarnings(card.warnings),
    readinessState: card.readinessState,
    governanceState: card.governanceState,
  }
}

export function resolvedContentHash(card: UnhashedResolvedCard): string {
  return stableSnapshotHash({
    v: CARD_HASH_VERSION,
    kind: 'resolved-content',
    payload: resolvedContentProjection(card),
  })
}

/**
 * The tamper-detection hash: the complete stored snapshot, minus only itself.
 *
 * No projection, no normalization beyond canonical key ordering, no omissions. That is the point —
 * anything left out is somewhere an edit goes unnoticed, and the two things previously left out
 * (`generatedAt`, and each warning's acknowledgement and waiver text) are exactly the fields an
 * after-the-fact edit would reach for.
 */
export function snapshotIntegrityHash(card: Omit<ResolvedCard, 'snapshotIntegrityHash'>): string {
  return stableSnapshotHash({ v: CARD_HASH_VERSION, kind: 'snapshot-integrity', payload: card })
}

/**
 * Verify a stored snapshot against the integrity hash it carries.
 *
 * Returns `null` for a snapshot written before integrity hashing existed. That is deliberately not
 * `false`: an older row is not a tampered row, and treating "we cannot check this" as "this failed"
 * would make every pre-existing card unopenable. Callers keep verifying those against the storage
 * identity hash, which is what they were written with.
 */
export function verifySnapshotIntegrity(snapshot: unknown): boolean | null {
  if (!snapshot || typeof snapshot !== 'object') return null
  const record = snapshot as Record<string, unknown>
  const recorded = record.snapshotIntegrityHash
  if (typeof recorded !== 'string' || recorded.length === 0) return null
  const withoutIntegrityHash: Record<string, unknown> = { ...record }
  delete withoutIntegrityHash.snapshotIntegrityHash
  return (
    stableSnapshotHash({
      v: CARD_HASH_VERSION,
      kind: 'snapshot-integrity',
      payload: withoutIntegrityHash,
    }) === recorded
  )
}
