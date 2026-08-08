import {
  projectResolvedItem,
  resolvedContentProjection,
  type UnhashedResolvedCard,
} from './card-hashes'
import type { ReleaseRequirementChange } from './release-bundle'
import { stableStringify } from './stable-hash'
import type { GovernanceState, ReadinessState, ResolvedCardItem } from './types'

/**
 * Comparing two resolved states of the same card.
 *
 * This is the read-only half of reconciliation: it says what is different, and nothing here
 * decides anything about it. It does not carry a selection forward, map an old requirement onto
 * a new one, rebuild a card, or write a row. Both inputs are read and neither is modified.
 *
 * ## Why it compares the semantic projection and not the cards
 *
 * `resolvedContentProjection` is the module's existing, documented answer to "what counts as a
 * difference between two cards" — it excludes rule-trace prose, warning message text, display
 * names where a stable id exists, and `generatedAt`, each for a recorded reason. Re-deriving a
 * second answer here would mean a review that reports no changes on a card whose
 * `resolvedContentHash` moved, or the reverse. So the projection is the comparison basis, and
 * `projectResolvedItem` is imported rather than reimplemented.
 *
 * The property that follows, and which `card-reconciliation.test.ts` pins: a delta is `identical`
 * exactly when the two states hash to the same `resolvedContentHash`.
 */

export type ProjectedResolvedItem = ReturnType<typeof projectResolvedItem>

/** Where a requirement sits in a resolved card: on it, suppressed by a kit, or not present. */
export type ResolvedItemPresence = 'active' | 'suppressed' | 'absent'

export interface ReconciledItemChange {
  itemId: string
  /** The reviewed semantic identity of the requirement, where the line carries one. */
  requirementKey: string | null
  roleCode: string
  /**
   * Display text, carried for the reader only. It is deliberately outside the projection — a
   * retitled requirement is not a changed one — so it is never a reason a change is reported.
   */
  label: string
  beforePresence: ResolvedItemPresence
  afterPresence: ResolvedItemPresence
  /** Projected fields whose value differs. Empty when only the presence moved. */
  changedFields: string[]
  before: ProjectedResolvedItem | null
  after: ProjectedResolvedItem | null
}

export interface ReconciledWarningChange {
  kind: 'added' | 'removed'
  code: string
  severity: 'info' | 'warning' | 'blocking'
  sourceType: string
  sourceId: string | null
}

export interface ReconciledStateChange<T> {
  before: T
  after: T
}

export interface ResolvedCardDelta {
  /** True exactly when both states project to the same semantic content. */
  identical: boolean
  items: ReconciledItemChange[]
  warnings: ReconciledWarningChange[]
  readinessState: ReconciledStateChange<ReadinessState> | null
  governanceState: ReconciledStateChange<GovernanceState> | null
  /**
   * Anything else in the semantic projection that differs, named by its projection key.
   *
   * A catch-all rather than a list of expected keys, so a field added to the projection later
   * cannot pass through this comparison unreported. In a comparison that holds the authored
   * release fixed this is always empty, and its being empty is the evidence that the release
   * really was held fixed — see `reconcile-card.ts`.
   */
  otherChangedProjectionKeys: string[]
}

interface IndexedItem {
  item: ResolvedCardItem
  presence: Exclude<ResolvedItemPresence, 'absent'>
}

function indexItems(card: UnhashedResolvedCard): Map<string, IndexedItem> {
  const index = new Map<string, IndexedItem>()
  for (const item of card.items) index.set(item.id, { item, presence: 'active' })
  // A requirement suppressed by a kit is still a requirement the card resolved; indexing both
  // lists under one key is what turns "gone from items, appeared in suppressedItems" into the
  // single fact it is, rather than an unexplained removal beside an unexplained addition.
  for (const item of card.suppressedItems) index.set(item.id, { item, presence: 'suppressed' })
  return index
}

function changedProjectedFields(
  before: ProjectedResolvedItem,
  after: ProjectedResolvedItem,
): string[] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()
  return keys.filter(
    (key) =>
      stableStringify((before as Record<string, unknown>)[key]) !==
      stableStringify((after as Record<string, unknown>)[key]),
  )
}

function warningKey(warning: {
  code: string
  severity: string
  sourceType: string
  sourceId: string | null
  acknowledged: boolean
}): string {
  return [
    warning.code,
    warning.severity,
    warning.sourceType,
    warning.sourceId ?? '',
    String(warning.acknowledged),
  ].join('|')
}

/**
 * What is different between two resolved states of one card.
 *
 * Neither argument is mutated, and nothing is written. `before` is conventionally the stored
 * state and `after` the reconstructed one, but the function is symmetric apart from that naming.
 */
export function diffResolvedCards(
  before: UnhashedResolvedCard,
  after: UnhashedResolvedCard,
): ResolvedCardDelta {
  const beforeProjection = resolvedContentProjection(before)
  const afterProjection = resolvedContentProjection(after)

  const beforeItems = indexItems(before)
  const afterItems = indexItems(after)

  const items: ReconciledItemChange[] = []
  for (const itemId of [...new Set([...beforeItems.keys(), ...afterItems.keys()])].sort()) {
    const beforeEntry = beforeItems.get(itemId)
    const afterEntry = afterItems.get(itemId)
    const beforeProjected = beforeEntry ? projectResolvedItem(beforeEntry.item) : null
    const afterProjected = afterEntry ? projectResolvedItem(afterEntry.item) : null

    const beforePresence: ResolvedItemPresence = beforeEntry?.presence ?? 'absent'
    const afterPresence: ResolvedItemPresence = afterEntry?.presence ?? 'absent'
    const changedFields =
      beforeProjected && afterProjected
        ? changedProjectedFields(beforeProjected, afterProjected)
        : []

    if (beforePresence === afterPresence && changedFields.length === 0) continue

    const describing = afterEntry?.item ?? beforeEntry?.item
    items.push({
      itemId,
      requirementKey: describing?.requirementKey ?? null,
      roleCode: describing?.roleCode ?? '',
      label: describing?.label ?? '',
      beforePresence,
      afterPresence,
      changedFields,
      before: beforeProjected,
      after: afterProjected,
    })
  }

  const beforeWarnings = new Map(beforeProjection.warnings.map((w) => [warningKey(w), w]))
  const afterWarnings = new Map(afterProjection.warnings.map((w) => [warningKey(w), w]))
  const warnings: ReconciledWarningChange[] = []
  for (const key of [...new Set([...beforeWarnings.keys(), ...afterWarnings.keys()])].sort()) {
    const inBefore = beforeWarnings.get(key)
    const inAfter = afterWarnings.get(key)
    if (inBefore && inAfter) continue
    const warning = inAfter ?? inBefore!
    warnings.push({
      kind: inAfter ? 'added' : 'removed',
      code: warning.code,
      severity: warning.severity,
      sourceType: warning.sourceType,
      sourceId: warning.sourceId,
    })
  }

  // Everything in the projection the three lists above already account for. Whatever remains is
  // compared generically, so nothing added to the projection later escapes the comparison.
  const accountedFor = new Set(['items', 'suppressedItems', 'warnings'])
  const otherChangedProjectionKeys = [
    ...new Set([...Object.keys(beforeProjection), ...Object.keys(afterProjection)]),
  ]
    .filter(
      (key) => !accountedFor.has(key) && key !== 'readinessState' && key !== 'governanceState',
    )
    .filter(
      (key) =>
        stableStringify((beforeProjection as Record<string, unknown>)[key]) !==
        stableStringify((afterProjection as Record<string, unknown>)[key]),
    )
    .sort()

  return {
    identical: stableStringify(beforeProjection) === stableStringify(afterProjection),
    items,
    warnings,
    readinessState:
      before.readinessState === after.readinessState
        ? null
        : { before: before.readinessState, after: after.readinessState },
    governanceState:
      before.governanceState === after.governanceState
        ? null
        : { before: before.governanceState, after: after.governanceState },
    otherChangedProjectionKeys,
  }
}

/** One requirement the current release changes, and what that means for one particular card. */
export interface AffectedRequirement extends ReleaseRequirementChange {
  /**
   * Whether the card carries a line with this requirement key.
   *
   * Matched on `requirementKey` and on nothing else. That key is the module's reviewed semantic
   * identity for a requirement — two slots are the same requirement only when a reviewed mapping
   * file says so — which is why it is the one comparison available here. Role-code equality is
   * never sufficient (the same role legitimately appears more than once on a card) and label
   * resemblance is not a comparison at all.
   */
  onCard: boolean
  presence: ResolvedItemPresence
  /** Whether the card's line for it holds a selection, which is what makes a removal matter. */
  hasSelection: boolean
  label: string | null
}

/**
 * Annotate a release-to-release requirement diff with what each change means for one card.
 *
 * Reporting only. Nothing here decides that a changed requirement should be carried forward,
 * matched to a different key, or resolved — a requirement the newer release *added* is reported
 * as absent from the card and is not mapped onto anything the card already has.
 */
export function affectedRequirements(
  requirementChanges: readonly ReleaseRequirementChange[],
  card: UnhashedResolvedCard,
): AffectedRequirement[] {
  const onCard = new Map<string, { presence: ResolvedItemPresence; item: ResolvedCardItem }>()
  for (const item of card.items) {
    if (item.requirementKey) onCard.set(item.requirementKey, { presence: 'active', item })
  }
  for (const item of card.suppressedItems) {
    if (item.requirementKey) onCard.set(item.requirementKey, { presence: 'suppressed', item })
  }

  return requirementChanges.map((change) => {
    const entry = onCard.get(change.requirementKey)
    return {
      ...change,
      onCard: entry !== undefined,
      presence: entry?.presence ?? 'absent',
      hasSelection: Boolean(
        entry?.item.selectedHospitalItemId || entry?.item.selectedCatalogProductId,
      ),
      label: entry?.item.label ?? null,
    }
  })
}
