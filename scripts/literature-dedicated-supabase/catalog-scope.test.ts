/** @jest-environment node */

/**
 * Third review, finding 3 — the exact catalog comparison is scoped to foundation-owned objects.
 *
 * The defect: `relations` and `types` are captured across the whole `public` namespace so that
 * collisions are visible, and the exact comparison then compared them wholesale against the
 * artifact. Planting one unrelated, non-colliding public table made the observed `relations`
 * section 9 rows where the artifact expects 8, and the postflight reported drift for an object the
 * foundation neither owns nor forbids.
 *
 * The correction separates the two concerns. This suite pins both halves:
 *
 *   - the **broad observation inventory** still sees every public relation, type, and index name,
 *     so collision detection keeps working;
 *   - the **exact comparison** sees only the eight foundation relations and the (empty) set of
 *     foundation-owned standalone types, so unrelated public objects are not drift while missing,
 *     altered, and reserved-namespace objects still are.
 *
 * A companion end-to-end proof against a real PostgreSQL 17 target lives in the disposable
 * rehearsal (scenarios `R38`–`R40`).
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  LITERATURE_FOUNDATION_INDEXES,
  LITERATURE_FOUNDATION_OWNED_TYPES,
  LITERATURE_FOUNDATION_TABLES,
} from '../../src/features/literature/dedicated-supabase/catalog-expectations'
import {
  LITERATURE_CATALOG_SECTIONS,
  LITERATURE_EXACT_CATALOG_SECTIONS,
  LITERATURE_NAME_SCOPED_EXACT_SECTIONS,
  buildCatalogExpectationArtifact,
  collectCatalogCollisionInventory,
  compareLiteratureCatalog,
  normalizeCatalogSection,
  projectFoundationOwnedSection,
  summarizeCatalogPresence,
  type LiteratureCatalogExpectationArtifact,
  type LiteratureCatalogSnapshot,
} from './lib/foundation-catalog'
import { evaluateEvidenceContentPreflight, allChecksPassed } from './lib/preflight-rules'
import { LITERATURE_PREFLIGHT_QUERY_PLAN_SHA256 } from './lib/target-observation'
import type { LiteraturePreflightEvidenceDocument } from './lib/evidence-schema'

const ROOT = process.cwd()
const ARTIFACT_PATH =
  'src/features/literature/dedicated-supabase/foundation-catalog-expectations.json'

const ROLE_ATTRIBUTE_ROWS = [
  { role: 'anon', superuser: false, bypassRls: false, canLogin: false, inherit: false },
  { role: 'authenticated', superuser: false, bypassRls: false, canLogin: false, inherit: false },
  { role: 'service_role', superuser: false, bypassRls: true, canLogin: false, inherit: false },
]

/** A foundation relation row exactly as the inspection SQL emits it. */
function foundationRelation(name: string) {
  return {
    schema: 'public',
    name,
    relkind: 'r',
    owner: 'postgres',
    persistence: 'p',
    rowLevelSecurity: true,
    forcedRowLevelSecurity: false,
  }
}

function emptySnapshot(): LiteratureCatalogSnapshot {
  return {
    ...(Object.fromEntries(
      LITERATURE_CATALOG_SECTIONS.map((section) => [section, []]),
    ) as unknown as LiteratureCatalogSnapshot),
    roleAttributes: ROLE_ATTRIBUTE_ROWS,
  }
}

/**
 * A post-application snapshot: the eight foundation relations and nothing else. Section rows for
 * the SQL-scoped sections stay empty, which is fine — the artifact this suite builds is derived
 * from the same snapshot, so the two agree by construction and the *scoping* is what is under
 * test.
 */
function foundationSnapshot(): LiteratureCatalogSnapshot {
  return {
    ...emptySnapshot(),
    relations: LITERATURE_FOUNDATION_TABLES.map((name) => foundationRelation(name)),
  }
}

function withUnrelatedObjects(snapshot: LiteratureCatalogSnapshot): LiteratureCatalogSnapshot {
  return {
    ...snapshot,
    relations: [
      ...snapshot.relations,
      {
        schema: 'public',
        name: 'unrelated_reference_notes',
        relkind: 'r',
        owner: 'postgres',
        persistence: 'p',
        rowLevelSecurity: false,
        forcedRowLevelSecurity: false,
      },
      {
        schema: 'public',
        name: 'unrelated_summary_view',
        relkind: 'v',
        owner: 'postgres',
        persistence: 'p',
        rowLevelSecurity: false,
        forcedRowLevelSecurity: false,
      },
    ],
    types: [
      ...snapshot.types,
      { schema: 'public', name: 'unrelated_workflow_state', typtype: 'e' },
    ],
    indexNames: [
      ...snapshot.indexNames,
      { schema: 'public', name: 'unrelated_reference_notes_pkey' },
    ],
  }
}

function preflightEvidence(
  snapshot: LiteratureCatalogSnapshot,
): LiteraturePreflightEvidenceDocument {
  return {
    schemaVersion: 'literature-dedicated-preflight-observation/3.0.0',
    queryPlanSha256: LITERATURE_PREFLIGHT_QUERY_PLAN_SHA256,
    migrationHistory: { tableExists: true, versions: [] },
    catalog: snapshot as unknown as LiteraturePreflightEvidenceDocument['catalog'],
    prerequisites: {
      availableExtensions: ['pg_trgm'],
      roles: ['anon', 'authenticated', 'service_role'],
      schemas: ['extensions', 'public'],
    },
  }
}

describe('exact scope versus broad observation scope', () => {
  it('names exactly the sections that need a name projection', () => {
    expect([...LITERATURE_NAME_SCOPED_EXACT_SECTIONS]).toEqual(['relations', 'types'])
    for (const section of LITERATURE_NAME_SCOPED_EXACT_SECTIONS) {
      expect(LITERATURE_EXACT_CATALOG_SECTIONS).toContain(section)
    }
  })

  it('records that the foundation defines no standalone type', () => {
    // The emptiness is the contract: an unrelated public enum is not foundation drift.
    expect(LITERATURE_FOUNDATION_OWNED_TYPES).toEqual([])
  })

  it('projects relations down to the eight foundation tables and types down to none', () => {
    const snapshot = withUnrelatedObjects(foundationSnapshot())

    expect(normalizeCatalogSection('relations', snapshot)).toHaveLength(
      LITERATURE_FOUNDATION_TABLES.length + 2,
    )
    expect(
      projectFoundationOwnedSection('relations', snapshot).map(
        (row) => (row as { name: string }).name,
      ),
    ).toEqual([...LITERATURE_FOUNDATION_TABLES])

    expect(normalizeCatalogSection('types', snapshot)).toHaveLength(1)
    expect(projectFoundationOwnedSection('types', snapshot)).toEqual([])
  })

  it('leaves every SQL-scoped exact section untouched by the projection', () => {
    const snapshot = withUnrelatedObjects(foundationSnapshot())
    for (const section of LITERATURE_EXACT_CATALOG_SECTIONS) {
      if ((LITERATURE_NAME_SCOPED_EXACT_SECTIONS as readonly string[]).includes(section)) continue
      expect(projectFoundationOwnedSection(section, snapshot)).toEqual(
        normalizeCatalogSection(section, snapshot),
      )
    }
  })

  it('keeps the broad inventory unfiltered so collisions stay visible', () => {
    const inventory = collectCatalogCollisionInventory(withUnrelatedObjects(foundationSnapshot()))
    expect(inventory.relations.map((entry) => entry.name)).toContain('unrelated_reference_notes')
    expect(inventory.relations.map((entry) => entry.name)).toContain('unrelated_summary_view')
    expect(inventory.typeNames).toContain('unrelated_workflow_state')
    expect(inventory.indexNames).toContain('unrelated_reference_notes_pkey')
  })
})

describe('unrelated public objects are not drift (third review, finding 3)', () => {
  const artifact = buildCatalogExpectationArtifact(foundationSnapshot())

  it('produces an identical artifact with and without unrelated public objects', () => {
    expect(buildCatalogExpectationArtifact(withUnrelatedObjects(foundationSnapshot()))).toEqual(
      artifact,
    )
  })

  it('matches the artifact when unrelated public relations and types are present', () => {
    // The exact reproduction: 10 public relations observed, 8 foundation-owned, no drift.
    const snapshot = withUnrelatedObjects(foundationSnapshot())
    expect(snapshot.relations).toHaveLength(LITERATURE_FOUNDATION_TABLES.length + 2)
    const comparison = compareLiteratureCatalog(snapshot, artifact)
    expect(comparison.failures).toEqual([])
    expect(comparison.matches).toBe(true)
  })

  it('passes every preflight content check with unrelated public objects present', () => {
    const checks = evaluateEvidenceContentPreflight(
      preflightEvidence(withUnrelatedObjects(emptySnapshot())),
    )
    expect(checks.filter((entry) => !entry.passed).map((entry) => entry.id)).toEqual([])
    expect(allChecksPassed(checks)).toBe(true)
  })
})

describe('the narrowed scope still detects everything it must', () => {
  const artifact = buildCatalogExpectationArtifact(foundationSnapshot())

  it('detects a missing foundation relation', () => {
    const snapshot = foundationSnapshot()
    snapshot.relations = snapshot.relations.filter(
      (relation) => relation.name !== 'literature_journals',
    )
    const comparison = compareLiteratureCatalog(snapshot, artifact)
    expect(comparison.matches).toBe(false)
    expect(comparison.failures.join(' ')).toContain('relations')
  })

  it('detects altered semantics on a foundation relation', () => {
    for (const mutate of [
      (relation: Record<string, unknown>) => (relation.rowLevelSecurity = false),
      (relation: Record<string, unknown>) => (relation.owner = 'anon'),
      (relation: Record<string, unknown>) => (relation.relkind = 'v'),
      (relation: Record<string, unknown>) => (relation.schema = 'other'),
      (relation: Record<string, unknown>) => (relation.forcedRowLevelSecurity = true),
    ]) {
      const snapshot = foundationSnapshot()
      snapshot.relations = snapshot.relations.map((relation) => ({ ...relation }))
      mutate(snapshot.relations[0] as unknown as Record<string, unknown>)
      expect(compareLiteratureCatalog(snapshot, artifact).matches).toBe(false)
    }
  })

  it('detects a duplicate of an expected relation name', () => {
    const snapshot = foundationSnapshot()
    snapshot.relations = [...snapshot.relations, foundationRelation('literature_journals')]
    expect(compareLiteratureCatalog(snapshot, artifact).matches).toBe(false)
  })

  it('still reports a reserved-namespace extra as an unexpected Literature object', () => {
    const snapshot = foundationSnapshot()
    snapshot.relations = [...snapshot.relations, foundationRelation('literature_extra_notes')]
    expect(summarizeCatalogPresence(snapshot).unexpectedLiteratureObjects).toEqual([
      'r:literature_extra_notes',
    ])
  })

  it('still refuses a Literature-named object at preflight, of any relkind', () => {
    for (const relkind of ['r', 'v', 'm', 'S', 'p', 'f']) {
      const snapshot = emptySnapshot()
      snapshot.relations = [{ ...foundationRelation('literature_journals'), relkind }]
      const checks = evaluateEvidenceContentPreflight(preflightEvidence(snapshot))
      expect(allChecksPassed(checks)).toBe(false)
      const collision = checks.find((entry) => entry.id === 'E05-no-name-collision')
      expect(collision?.passed).toBe(false)
    }
  })

  it('still refuses an unrelated object occupying an expected index or type name', () => {
    const indexSnapshot = emptySnapshot()
    indexSnapshot.indexNames = [{ schema: 'public', name: LITERATURE_FOUNDATION_INDEXES[0] }]
    expect(
      evaluateEvidenceContentPreflight(preflightEvidence(indexSnapshot)).find(
        (entry) => entry.id === 'E05-no-name-collision',
      )?.passed,
    ).toBe(false)

    const typeSnapshot = emptySnapshot()
    typeSnapshot.types = [{ schema: 'public', name: LITERATURE_FOUNDATION_TABLES[0], typtype: 'e' }]
    expect(
      evaluateEvidenceContentPreflight(preflightEvidence(typeSnapshot)).find(
        (entry) => entry.id === 'E05-no-name-collision',
      )?.passed,
    ).toBe(false)
  })
})

describe('the committed artifact holds only foundation-owned objects', () => {
  it('expects exactly the eight foundation relations and zero standalone types', async () => {
    const artifact = JSON.parse(
      await readFile(resolve(ROOT, ARTIFACT_PATH), 'utf8'),
    ) as LiteratureCatalogExpectationArtifact

    expect(artifact.sectionCounts.relations).toBe(LITERATURE_FOUNDATION_TABLES.length)
    expect(artifact.sectionCounts.types).toBe(LITERATURE_FOUNDATION_OWNED_TYPES.length)
    for (const section of LITERATURE_EXACT_CATALOG_SECTIONS) {
      expect(typeof artifact.sectionCounts[section]).toBe('number')
      expect(artifact.sectionSha256[section]).toMatch(/^[a-f0-9]{64}$/u)
    }
  })
})
