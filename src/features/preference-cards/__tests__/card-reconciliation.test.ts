import { resolveDemoScenario } from '../data/demo-context.server'
import { resolvedContentHash } from '../domain/card-hashes'
import { affectedRequirements, diffResolvedCards } from '../domain/card-reconciliation'
import type { ReleaseRequirementChange } from '../domain/release-bundle'
import { stableStringify } from '../domain/stable-hash'
import type { ResolvedCard } from '../domain/types'

/**
 * The read-only comparison between two resolved states of one card.
 *
 * The load-bearing claim is the equivalence in the first block: a delta is `identical` exactly
 * when the two states hash to the same `resolvedContentHash`. Everything else in this file is a
 * consequence of it, and the reason the comparison imports the projection rather than
 * re-deriving one — two answers to "what counts as a difference" would drift, and the drift
 * would surface as a review reporting no changes on a card whose content hash had moved.
 */

const SCENARIO_ID = 'ebus-rose-molecular'

function baseCard(): ResolvedCard {
  return resolveDemoScenario(SCENARIO_ID)
}

function clone(card: ResolvedCard): ResolvedCard {
  return JSON.parse(JSON.stringify(card)) as ResolvedCard
}

describe('the comparison basis is the semantic projection', () => {
  it('reports a card against itself as identical, with nothing listed', () => {
    const card = baseCard()
    const delta = diffResolvedCards(card, card)

    expect(delta.identical).toBe(true)
    expect(delta.items).toEqual([])
    expect(delta.warnings).toEqual([])
    expect(delta.readinessState).toBeNull()
    expect(delta.governanceState).toBeNull()
    expect(delta.otherChangedProjectionKeys).toEqual([])
  })

  it('is identical exactly when the two states share a resolved content hash', () => {
    const before = baseCard()

    // Prose only: the trace explains how resolution got its answer, not what the answer is.
    const reworded = clone(before)
    expect(reworded.ruleTrace.length).toBeGreaterThan(0)
    reworded.ruleTrace[0].message = 'Rewritten explanation that decides nothing.'

    expect(resolvedContentHash(reworded)).toBe(resolvedContentHash(before))
    expect(diffResolvedCards(before, reworded).identical).toBe(true)

    // Semantic: a line now resolves to a different local item.
    const rechosen = clone(before)
    const resolvedLine = rechosen.items.find((item) => item.selectedHospitalItemId !== null)
    expect(resolvedLine).toBeDefined()
    resolvedLine!.selectedHospitalItemId = 'demo-item-that-does-not-exist'

    expect(resolvedContentHash(rechosen)).not.toBe(resolvedContentHash(before))
    expect(diffResolvedCards(before, rechosen).identical).toBe(false)
  })

  it('does not read a different generation timestamp as a change', () => {
    const before = baseCard()
    const later = clone(before)
    later.generatedAt = '2027-01-01T00:00:00.000Z'

    expect(diffResolvedCards(before, later).identical).toBe(true)
  })

  it('does not read a reworded warning as a change, and does read a new one', () => {
    const before = baseCard()
    expect(before.warnings.length).toBeGreaterThan(0)

    const reworded = clone(before)
    reworded.warnings[0].message = 'Same condition, different sentence.'
    expect(diffResolvedCards(before, reworded).warnings).toEqual([])

    const withNewWarning = clone(before)
    withNewWarning.warnings.push({
      ...before.warnings[0],
      id: 'message-invented',
      code: 'invented_condition',
    })
    const delta = diffResolvedCards(before, withNewWarning)
    expect(delta.warnings).toEqual([
      expect.objectContaining({ kind: 'added', code: 'invented_condition' }),
    ])
  })
})

describe('what a line-level change looks like', () => {
  it('names the projected fields that moved', () => {
    const before = baseCard()
    const after = clone(before)
    const line = after.items.find((item) => item.selectedHospitalItemId !== null)!
    line.selectedHospitalItemId = 'demo-item-replaced'
    line.resolutionState = 'unresolved'

    const delta = diffResolvedCards(before, after)
    const change = delta.items.find((item) => item.itemId === line.id)

    expect(change).toBeDefined()
    expect(change!.changedFields).toEqual(
      expect.arrayContaining(['selectedHospitalItemId', 'resolutionState']),
    )
    expect(change!.beforePresence).toBe('active')
    expect(change!.afterPresence).toBe('active')
    expect(change!.roleCode).toBe(line.roleCode)
  })

  it('reports a line moving into kit suppression once, not as a removal beside an addition', () => {
    const before = baseCard()
    const after = clone(before)
    const moved = after.items.shift()!
    moved.resolutionState = 'suppressed_by_kit'
    after.suppressedItems.push(moved)

    const delta = diffResolvedCards(before, after)
    const changes = delta.items.filter((item) => item.itemId === moved.id)

    expect(changes).toHaveLength(1)
    expect(changes[0].beforePresence).toBe('active')
    expect(changes[0].afterPresence).toBe('suppressed')
  })

  it('reports a line that disappears entirely as absent', () => {
    const before = baseCard()
    const after = clone(before)
    const dropped = after.items.shift()!

    const delta = diffResolvedCards(before, after)
    const change = delta.items.find((item) => item.itemId === dropped.id)

    expect(change).toBeDefined()
    expect(change!.beforePresence).toBe('active')
    expect(change!.afterPresence).toBe('absent')
    expect(change!.after).toBeNull()
  })

  it('does not report a retitled requirement, which the projection excludes on purpose', () => {
    const before = baseCard()
    const after = clone(before)
    after.items[0].label = 'A different way of writing the same requirement'

    expect(diffResolvedCards(before, after).identical).toBe(true)
  })
})

describe('nothing outside the item, warning, and readiness lists escapes the comparison', () => {
  it('catches a top-level projection change generically', () => {
    const before = baseCard()
    const after = clone(before)
    after.selectedModifiers = [...after.selectedModifiers, 'INVENTED_MODIFIER']

    const delta = diffResolvedCards(before, after)
    expect(delta.identical).toBe(false)
    expect(delta.otherChangedProjectionKeys).toContain('selectedModifiers')
  })

  it('reports a readiness move as its own field rather than burying it in the catch-all', () => {
    const before = baseCard()
    const after = clone(before)
    after.readinessState = after.readinessState === 'complete' ? 'blocked' : 'complete'

    const delta = diffResolvedCards(before, after)
    expect(delta.readinessState).toEqual({
      before: before.readinessState,
      after: after.readinessState,
    })
    expect(delta.otherChangedProjectionKeys).not.toContain('readinessState')
  })
})

describe('comparing changes nothing', () => {
  it('leaves both arguments byte-identical', () => {
    const before = baseCard()
    const after = clone(before)
    after.items[0].resolutionState = 'unresolved'

    const beforeSerialized = stableStringify(before)
    const afterSerialized = stableStringify(after)

    diffResolvedCards(before, after)

    expect(stableStringify(before)).toBe(beforeSerialized)
    expect(stableStringify(after)).toBe(afterSerialized)
  })
})

describe('annotating a release requirement diff for one card', () => {
  function change(
    requirementKey: string,
    kind: ReleaseRequirementChange['kind'],
  ): ReleaseRequirementChange {
    return { requirementKey, kind, moduleVersionIds: [], changedFields: [] }
  }

  it('matches on the reviewed requirement key and reports whether the card holds a selection', () => {
    const card = baseCard()
    const chosen = card.items.find(
      (item) => item.requirementKey && item.selectedHospitalItemId !== null,
    )
    expect(chosen).toBeDefined()

    const [annotated] = affectedRequirements([change(chosen!.requirementKey!, 'changed')], card)

    expect(annotated.onCard).toBe(true)
    expect(annotated.presence).toBe('active')
    expect(annotated.hasSelection).toBe(true)
    expect(annotated.label).toBe(chosen!.label)
  })

  it('reports a requirement the newer release adds as absent, and maps it onto nothing', () => {
    const card = baseCard()
    const [annotated] = affectedRequirements(
      [change('requirement.that.this.card.never.had', 'added')],
      card,
    )

    expect(annotated.onCard).toBe(false)
    expect(annotated.presence).toBe('absent')
    expect(annotated.hasSelection).toBe(false)
    // The one guarantee that matters: an added requirement is not quietly attached to a line the
    // card already has. Nothing here decides that two requirements are "really" the same one.
    expect(annotated.label).toBeNull()
  })

  it('never matches on role code alone', () => {
    const card = baseCard()
    const line = card.items.find((item) => item.requirementKey)!

    // The role is real and is on the card; the requirement key is not. A matcher that fell back
    // to role equality — the failure this module names explicitly — would report `onCard: true`.
    const [annotated] = affectedRequirements([change(line.roleCode, 'changed')], card)
    expect(annotated.onCard).toBe(false)
  })

  it('finds a requirement that is on the card but suppressed by a kit', () => {
    const card = clone(baseCard())
    const moved = card.items.shift()!
    card.suppressedItems.push(moved)

    const [annotated] = affectedRequirements([change(moved.requirementKey!, 'changed')], card)
    expect(annotated.onCard).toBe(true)
    expect(annotated.presence).toBe('suppressed')
  })
})
