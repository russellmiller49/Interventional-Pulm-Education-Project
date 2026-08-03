import { getCurrentReleaseBundle, resolveReleaseDefinitions } from '../data/release-bundles.server'
import {
  affectedRequirements,
  diffResolvedCards,
  type AffectedRequirement,
  type ReconciledItemChange,
  type ResolvedCardDelta,
} from '../domain/card-reconciliation'
import {
  diffReleaseBundles,
  type ReleaseImpactReport,
  type ReleaseResolutionErrorCode,
} from '../domain/release-bundle'
import type { ResolvedCard } from '../domain/types'
import { isReleasePinned } from '../schemas/saved-card'
import { loadCurrentCardRevision } from './card-revisions'
import type { RehydratedBuilderErrorCode } from './rebuild-builder-context'
import { loadUserCard, resolveForSave, type UserCardRecord } from './user-cards'

/**
 * Reviewing a saved card against what has moved underneath it — and changing nothing.
 *
 * Two questions, deliberately separate, because they have different causes and different
 * remedies and answering them together would blur which is which:
 *
 * 1. **Operational.** Holding the authored release fixed, what does *today's* hospital-local
 *    data do to this card? What the room stocks, how the site ranks it, and what the location
 *    can do are current by design — a physician reopening a card should see the requirements
 *    they reviewed against the equipment that actually exists. This is what that design costs,
 *    made visible.
 * 2. **Release.** How does the authored release this card pins differ from the release the
 *    procedure's explicit pointer names today? A pure definition-to-definition comparison.
 *
 * ## What this does not do
 *
 * It does not rebuild the card, upgrade it, migrate it, carry a selection forward, decide a
 * mapping, transfer a waiver, or write anything. The stored snapshot is read and never modified,
 * and the reconstructed state exists only to be compared and discarded. There is no code path
 * from here to a stored row: every function is a read, and the result is a report.
 *
 * The second question in particular is answered **without resolving the card against the newer
 * release**. Doing that would be a rebuild — it would require deciding what each of the card's
 * selections means under definitions the physician has not reviewed — and it is out of scope by
 * construction, not by discipline: nothing here builds a context from the current release.
 */

/**
 * Which exact state was reviewed.
 *
 * A card id is not enough and that is the whole reason revisions exist: the card can be edited
 * after a review, and a reference to it would then point at something nobody read. Everything
 * a later rebuild must cite is here — the card, the revision, the release, and the hashes of
 * the immutable snapshot.
 */
export interface CardReconciliationSource {
  cardId: string
  /** Null only for a card whose revision history is somehow absent; the trigger appends on insert. */
  revisionId: string | null
  revisionNumber: number | null
  snapshotHash: string
  snapshotIntegrityHash: string | null
  resolvedContentHash: string | null
  printDocumentHash: string | null
  releaseBundleId: string | null
  catalogReleaseId: string | null
  updatedAt: string
}

/**
 * Why the operational half could not be computed.
 *
 * `builder_inputs_unavailable` is this module's own; the rest are `rebuildBuilderContext`'s
 * typed failures, reported verbatim so a card that will not reconcile says the same thing here
 * as it does when someone tries to reopen it.
 */
export type OperationalReconciliationErrorCode =
  | 'builder_inputs_unavailable'
  | RehydratedBuilderErrorCode

export type OperationalReconciliationResult =
  | {
      ok: true
      /**
       * The differences current hospital-local data makes, and nothing else: the release, the
       * pinned catalog release, and every authored definition are held fixed by
       * `rebuildBuilderContext`, so `delta.otherChangedProjectionKeys` being empty is the
       * evidence rather than the claim.
       */
      delta: ResolvedCardDelta
    }
  | { ok: false; code: OperationalReconciliationErrorCode; message: string }

/**
 * Why the release halves could not be compared. `builder_inputs_not_release_pinned` matches the
 * reconstruction path's own code for the same situation, so one card never has two names for it.
 */
export type ReleaseReconciliationErrorCode =
  | 'builder_inputs_not_release_pinned'
  | ReleaseResolutionErrorCode

export type { AffectedRequirement }

export type ReleaseReconciliationResult =
  | {
      ok: true
      pinnedReleaseBundleId: string
      /** From the explicit pointer. Null when nothing points at a release for this procedure. */
      currentReleaseBundleId: string | null
      onCurrentRelease: boolean
      /** Null when the card is already on the current release, or when there is none. */
      impact: ReleaseImpactReport | null
      affecting: AffectedRequirement[]
    }
  | { ok: false; code: ReleaseReconciliationErrorCode; message: string }

export interface CardReconciliation {
  record: UserCardRecord
  source: CardReconciliationSource
  operational: OperationalReconciliationResult
  release: ReleaseReconciliationResult
}

export type CardReconciliationResult =
  | { ok: true; reconciliation: CardReconciliation }
  | { ok: false; code: 'not_found' }

/**
 * Re-resolve the card's own inputs against current operational data, and diff.
 *
 * `resolveForSave` is the reconstruction path the builder and the save path both use, and using
 * it here is the point rather than a convenience: this review is only worth reading if it
 * predicts what re-saving the card would actually produce. A second, review-only reconstruction
 * would be a second answer to that question, and the one place the two disagreed would be the
 * one place the review mattered.
 *
 * `generatedAt` is taken from the stored snapshot rather than the clock. It is outside the
 * semantic projection either way, so this changes no result; it means the reconstructed card
 * differs from the stored one only where something real differs.
 */
function reconcileOperational(
  record: UserCardRecord,
  storedCard: ResolvedCard,
): OperationalReconciliationResult {
  if (!record.builderInputs) {
    return {
      ok: false,
      code: 'builder_inputs_unavailable',
      message:
        'This card was created with an earlier builder version, so its selections cannot be re-resolved. Its saved snapshot is unaffected and remains available to view, print, and share.',
    }
  }

  const resolved = resolveForSave(record.builderInputs, storedCard.generatedAt)
  if (!resolved.ok) return { ok: false, code: resolved.code, message: resolved.error }

  return { ok: true, delta: diffResolvedCards(storedCard, resolved.card) }
}

/**
 * Compare the release the card pins with the one the procedure's pointer currently names.
 *
 * Both sides are resolved through `resolveReleaseDefinitions`, which verifies every pin, so a
 * release whose definitions have been edited since publication is reported rather than compared
 * — comparing against mutated content would produce a diff that describes neither release.
 *
 * "Current" is the explicit pointer and nothing else. No version sorting, no newest
 * `publishedAt`, no last entry in the file.
 */
function reconcileRelease(
  record: UserCardRecord,
  storedCard: ResolvedCard,
): ReleaseReconciliationResult {
  const inputs = record.builderInputs
  if (!inputs || !isReleasePinned(inputs)) {
    return {
      ok: false,
      code: 'builder_inputs_not_release_pinned',
      message:
        'This card was built before releases pinned the full rule set, so there is no pinned release to compare against the current one.',
    }
  }

  const pinned = resolveReleaseDefinitions(inputs.releaseBundleId)
  if (!pinned.ok) return { ok: false, code: pinned.code, message: pinned.message }

  const current = getCurrentReleaseBundle(pinned.bundle.sourceProcedureCode)
  if (!current) {
    return {
      ok: true,
      pinnedReleaseBundleId: pinned.bundle.id,
      currentReleaseBundleId: null,
      onCurrentRelease: false,
      impact: null,
      affecting: [],
    }
  }
  if (current.id === pinned.bundle.id) {
    return {
      ok: true,
      pinnedReleaseBundleId: pinned.bundle.id,
      currentReleaseBundleId: current.id,
      onCurrentRelease: true,
      impact: null,
      affecting: [],
    }
  }

  const currentDefinitions = resolveReleaseDefinitions(current.id)
  if (!currentDefinitions.ok) {
    return { ok: false, code: currentDefinitions.code, message: currentDefinitions.message }
  }

  const impact = diffReleaseBundles(
    { bundle: pinned.bundle, sources: pinned.sources },
    { bundle: currentDefinitions.bundle, sources: currentDefinitions.sources },
  )

  return {
    ok: true,
    pinnedReleaseBundleId: pinned.bundle.id,
    currentReleaseBundleId: current.id,
    onCurrentRelease: false,
    impact,
    affecting: affectedRequirements(impact.requirementChanges, storedCard),
  }
}

/**
 * Everything the reconciliation view needs, for one card the caller owns.
 *
 * The two halves are computed independently and reported independently on purpose. A card whose
 * product line is named by a discovery key cannot be re-resolved at all, and its release can
 * still be compared perfectly well; folding them together would hide the answer that exists
 * behind the one that does not.
 *
 * Row-level security scopes every read to the caller, so a card that is not theirs is
 * `not_found` — the same answer an id that does not exist gets.
 */
export async function reconcileSavedCard(cardId: string): Promise<CardReconciliationResult> {
  const record = await loadUserCard(cardId)
  if (!record) return { ok: false, code: 'not_found' }

  const currentRevision = await loadCurrentCardRevision(cardId)
  const storedCard = record.card

  const source: CardReconciliationSource = {
    cardId,
    revisionId: currentRevision?.id ?? null,
    revisionNumber: currentRevision?.revisionNumber ?? null,
    snapshotHash: storedCard.snapshotHash,
    snapshotIntegrityHash: storedCard.snapshotIntegrityHash ?? null,
    resolvedContentHash: storedCard.resolvedContentHash ?? null,
    printDocumentHash: currentRevision?.printDocumentHash ?? null,
    releaseBundleId: storedCard.resolutionProvenance?.releaseBundleId ?? null,
    catalogReleaseId: storedCard.resolutionProvenance?.catalogReleaseId ?? null,
    updatedAt: record.updatedAt,
  }

  return {
    ok: true,
    reconciliation: {
      record,
      source,
      operational: reconcileOperational(record, storedCard),
      release: reconcileRelease(record, storedCard),
    },
  }
}

/** Whether a delta has anything a reader needs to look at. Kept here so the view does not decide. */
export function deltaIsEmpty(delta: ResolvedCardDelta): boolean {
  return delta.identical
}

/** Item changes worth surfacing first: a line that gained, lost, or changed what it resolves to. */
export function resolutionAffectingChanges(delta: ResolvedCardDelta): ReconciledItemChange[] {
  return delta.items.filter(
    (change) =>
      change.beforePresence !== change.afterPresence ||
      change.changedFields.some((field) =>
        [
          'selectedHospitalItemId',
          'selectedCatalogProductId',
          'resolutionState',
          'verificationState',
          'compatibilityState',
        ].includes(field),
      ),
  )
}
