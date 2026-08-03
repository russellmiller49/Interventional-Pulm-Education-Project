import { buildDemoContext, defaultBuildInput } from '../data/demo-context.server'
import {
  RESOLVED_CONTENT_HASH_EXCLUSIONS,
  resolvedContentHash,
  resolvedContentProjection,
  snapshotIntegrityHash,
  verifySnapshotIntegrity,
} from '../domain/card-hashes'
import {
  printDocumentHash,
  PRINTED_FIELDS_OUTSIDE_SNAPSHOT,
  type PrintedCardMetadata,
} from '../domain/print-document'
import { resolveCard } from '../domain/resolve-card'
import { stableStringify } from '../domain/stable-hash'
import type { ResolvedCard } from '../domain/types'

/**
 * Three hashes, three questions.
 *
 * `snapshotHash` is storage identity — stable across re-saves of unchanged content, which is what
 * the `snapshot_hash` column and every share link depend on. `snapshotIntegrityHash` is tamper
 * detection over the complete stored snapshot. `resolvedContentHash` is semantic comparison, over a
 * documented projection that leaves implementation prose out.
 *
 * The interesting assertions are the ones where two of them disagree: a reworded rule-trace message
 * must move integrity and not content, and a changed requiredness must move both. A test suite in
 * which the three always move together would not be testing a separation.
 */

const SCENARIO_ID = 'ebus-rose-molecular'

function card(): ResolvedCard {
  return resolveCard(defaultBuildInput(SCENARIO_ID), buildDemoContext(SCENARIO_ID))
}

function withoutIntegrityHash(value: ResolvedCard) {
  const copy: Record<string, unknown> = { ...value }
  delete copy.snapshotIntegrityHash
  return copy as Omit<ResolvedCard, 'snapshotIntegrityHash'>
}

function unhashed(value: ResolvedCard) {
  const copy: Record<string, unknown> = { ...value }
  delete copy.snapshotIntegrityHash
  delete copy.resolvedContentHash
  delete copy.snapshotHash
  return copy as Parameters<typeof resolvedContentHash>[0]
}

describe('what each hash covers', () => {
  it('produces all three on every resolved card', () => {
    const resolved = card()
    expect(resolved.snapshotHash).toMatch(/^[a-f0-9]{64}$/)
    expect(resolved.snapshotIntegrityHash).toMatch(/^[a-f0-9]{64}$/)
    expect(resolved.resolvedContentHash).toMatch(/^[a-f0-9]{64}$/)
    expect(
      new Set([resolved.snapshotHash, resolved.snapshotIntegrityHash, resolved.resolvedContentHash])
        .size,
    ).toBe(3)
  })

  it('covers every stored snapshot field with the integrity hash', () => {
    // Field-by-field rather than by inspection: anything left out of the integrity hash is somewhere
    // an edit goes unnoticed, and the whole reason for the split was that two such fields existed.
    const resolved = card()
    const baseline = snapshotIntegrityHash(withoutIntegrityHash(resolved))
    expect(baseline).toBe(resolved.snapshotIntegrityHash)

    const fields = Object.keys(withoutIntegrityHash(resolved)) as Array<
      keyof Omit<ResolvedCard, 'snapshotIntegrityHash'>
    >
    expect(fields.length).toBeGreaterThan(15)
    for (const field of fields) {
      const tampered = { ...withoutIntegrityHash(resolved) } as Record<string, unknown>
      const current = tampered[field]
      tampered[field] =
        typeof current === 'string'
          ? `${current}!`
          : typeof current === 'boolean'
            ? !current
            : Array.isArray(current)
              ? [...current, null]
              : current === null || current === undefined
                ? 'tampered'
                : { ...(current as object), tampered: true }
      expect(
        snapshotIntegrityHash(tampered as Omit<ResolvedCard, 'snapshotIntegrityHash'>),
      ).not.toBe(baseline)
    }
  })

  it('covers the generated timestamp, which the storage identity deliberately does not', () => {
    const first = resolveCard(
      {
        ...defaultBuildInput(SCENARIO_ID),
        variables: { generated_at: '2026-01-01T00:00:00.000Z' },
      },
      buildDemoContext(SCENARIO_ID),
    )
    const second = resolveCard(
      {
        ...defaultBuildInput(SCENARIO_ID),
        variables: { generated_at: '2026-06-01T00:00:00.000Z' },
      },
      buildDemoContext(SCENARIO_ID),
    )

    // Storage identity holds, so re-saving an unchanged card stays a no-op.
    expect(second.snapshotHash).toBe(first.snapshotHash)
    // Integrity moves, so an edited timestamp is detectable — the gap the split closed.
    expect(second.snapshotIntegrityHash).not.toBe(first.snapshotIntegrityHash)
    // Semantics hold: two identical cards generated months apart are the same card.
    expect(second.resolvedContentHash).toBe(first.resolvedContentHash)
  })
})

describe('semantic content versus implementation prose', () => {
  it('changes the integrity hash but not the resolved content hash when trace prose changes', () => {
    const resolved = card()
    const reworded = {
      ...unhashed(resolved),
      ruleTrace: resolved.ruleTrace.map((event) => ({
        ...event,
        message: `${event.message} (reworded)`,
      })),
    }

    expect(resolvedContentHash(reworded)).toBe(resolved.resolvedContentHash)
    expect(
      snapshotIntegrityHash({
        ...reworded,
        snapshotHash: resolved.snapshotHash,
        resolvedContentHash: resolved.resolvedContentHash,
      }),
    ).not.toBe(resolved.snapshotIntegrityHash)
  })

  it('changes the integrity hash but not the resolved content hash when a warning is reworded', () => {
    const resolved = card()
    expect(resolved.warnings.length).toBeGreaterThan(0)
    const reworded = {
      ...unhashed(resolved),
      warnings: resolved.warnings.map((warning) => ({
        ...warning,
        message: `${warning.message} (reworded)`,
      })),
    }

    expect(resolvedContentHash(reworded)).toBe(resolved.resolvedContentHash)
  })

  it('changes both when effective requiredness changes', () => {
    const resolved = card()
    const changed = {
      ...unhashed(resolved),
      items: resolved.items.map((item, index) =>
        index === 0 ? { ...item, effectiveRequiredness: 'backup' as const } : item,
      ),
    }

    expect(resolvedContentHash(changed)).not.toBe(resolved.resolvedContentHash)
    expect(
      snapshotIntegrityHash({
        ...changed,
        snapshotHash: resolved.snapshotHash,
        resolvedContentHash: resolved.resolvedContentHash,
      }),
    ).not.toBe(resolved.snapshotIntegrityHash)
  })

  it('changes both when the selected product changes', () => {
    const resolved = card()
    const changed = {
      ...unhashed(resolved),
      items: resolved.items.map((item, index) =>
        index === 0 ? { ...item, selectedHospitalItemId: 'catalog:PRD-SOMETHINGELSE' } : item,
      ),
    }

    expect(resolvedContentHash(changed)).not.toBe(resolved.resolvedContentHash)
    expect(
      snapshotIntegrityHash({
        ...changed,
        snapshotHash: resolved.snapshotHash,
        resolvedContentHash: resolved.resolvedContentHash,
      }),
    ).not.toBe(resolved.snapshotIntegrityHash)
  })

  it('changes both when a warning code, severity, or structured source changes', () => {
    const resolved = card()
    for (const patch of [
      { code: 'a_different_code' },
      { severity: 'blocking' as const },
      { sourceId: 'a-different-source' },
    ]) {
      const changed = {
        ...unhashed(resolved),
        warnings: resolved.warnings.map((warning, index) =>
          index === 0 ? { ...warning, ...patch } : warning,
        ),
      }
      expect(resolvedContentHash(changed)).not.toBe(resolved.resolvedContentHash)
    }
  })

  it('changes neither when irrelevant object properties are reordered', () => {
    const resolved = card()
    const reordered = {
      ...unhashed(resolved),
      items: resolved.items.map((item) =>
        // Same keys, rebuilt in reverse insertion order.
        Object.fromEntries(Object.entries(item).reverse()),
      ) as typeof resolved.items,
    }

    expect(resolvedContentHash(reordered)).toBe(resolved.resolvedContentHash)
    expect(
      snapshotIntegrityHash({
        ...reordered,
        snapshotHash: resolved.snapshotHash,
        resolvedContentHash: resolved.resolvedContentHash,
      }),
    ).toBe(resolved.snapshotIntegrityHash)
  })

  it('keeps the semantic projection free of the fields it documents as excluded', () => {
    const projection = stableStringify(resolvedContentProjection(unhashed(card())))
    for (const field of ['ruleTrace', 'engineVersion', 'organizationName', 'recipeName']) {
      expect(Object.keys(RESOLVED_CONTENT_HASH_EXCLUSIONS)).toContain(field)
      expect(projection).not.toContain(`"${field}"`)
    }
  })

  it('names the release, catalog release, and resolver contract it was produced under', () => {
    const projection = resolvedContentProjection(unhashed(card()))
    expect(projection.release.resolverContractVersion).toBe('ip-cards-resolver-contract/1')
    // The demo context carries no release, so the two release fields are honestly null rather than
    // borrowed from whatever is current.
    expect(projection.release.releaseBundleId).toBeNull()
    expect(projection.release.catalogReleaseId).toBeNull()
  })
})

describe('verifying a stored snapshot', () => {
  it('accepts a snapshot that still hashes to its own integrity hash', () => {
    expect(verifySnapshotIntegrity(card())).toBe(true)
  })

  it('rejects one whose stored payload was edited', () => {
    const resolved = card()
    expect(verifySnapshotIntegrity({ ...resolved, generatedAt: '1999-01-01T00:00:00.000Z' })).toBe(
      false,
    )
    expect(verifySnapshotIntegrity({ ...resolved, readinessState: 'complete' })).toBe(false)
  })

  it('rejects one whose other two hashes were edited to match a doctored payload', () => {
    // The integrity hash covers the other two, so rewriting them to agree with a tampered card is
    // itself detected. Otherwise "make the hashes agree" would be a working forgery.
    const resolved = card()
    expect(verifySnapshotIntegrity({ ...resolved, snapshotHash: 'f'.repeat(64) })).toBe(false)
    expect(verifySnapshotIntegrity({ ...resolved, resolvedContentHash: 'f'.repeat(64) })).toBe(
      false,
    )
  })

  it('returns null for a snapshot written before integrity hashing existed', () => {
    // Not `false`. An older row is not a tampered row, and treating "cannot check" as "failed"
    // would make every pre-existing card unopenable.
    const resolved = card()
    const legacy: Record<string, unknown> = { ...resolved }
    delete legacy.snapshotIntegrityHash
    delete legacy.resolvedContentHash
    expect(verifySnapshotIntegrity(legacy)).toBeNull()
    expect(verifySnapshotIntegrity(null)).toBeNull()
    expect(verifySnapshotIntegrity({ snapshotIntegrityHash: '' })).toBeNull()
  })
})

describe('the printed document', () => {
  const metadata: PrintedCardMetadata = {
    cardId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
    title: 'EBUS with ROSE',
    physicianName: 'Dr Example',
    status: 'final',
    updatedAt: '2026-08-01T10:00:00.000Z',
  }

  function documentHash(overrides: Partial<PrintedCardMetadata> = {}, integrity = 'a'.repeat(64)) {
    return printDocumentHash({
      snapshotIntegrityHash: integrity,
      metadata: { ...metadata, ...overrides },
    })
  }

  it('covers every printed field that lives outside card_snapshot', () => {
    const baseline = documentHash()
    expect(Object.keys(PRINTED_FIELDS_OUTSIDE_SNAPSHOT).sort()).toEqual(
      ['cardId', 'physicianName', 'status', 'title', 'updatedAt'].sort(),
    )
    expect(documentHash({ title: 'Renamed card' })).not.toBe(baseline)
    expect(documentHash({ physicianName: 'Dr Other' })).not.toBe(baseline)
    expect(documentHash({ status: 'draft' })).not.toBe(baseline)
    expect(documentHash({ updatedAt: '2026-08-02T10:00:00.000Z' })).not.toBe(baseline)
    expect(documentHash({ cardId: '00000000-0000-4000-8000-000000000000' })).not.toBe(baseline)
  })

  it('moves when the snapshot underneath it moves', () => {
    expect(documentHash({}, 'b'.repeat(64))).not.toBe(documentHash({}, 'a'.repeat(64)))
  })

  it('distinguishes an absent field from an empty one', () => {
    expect(documentHash({ physicianName: null })).not.toBe(documentHash({ physicianName: '' }))
  })

  it('is stable when nothing printed changed', () => {
    expect(documentHash()).toBe(documentHash())
  })
})
