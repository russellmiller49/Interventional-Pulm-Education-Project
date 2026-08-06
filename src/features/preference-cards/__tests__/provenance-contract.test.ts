import fs from 'node:fs'
import path from 'node:path'

import {
  REBUILD_PROVENANCE_V1_DECISION_KEYS,
  REBUILD_PROVENANCE_V1_KEYS,
  REBUILD_PROVENANCE_V1_NULLABLE_KEYS,
  storedRebuildProvenanceSchema,
} from '../schemas/card-rebuild'

/**
 * One version-1 provenance shape, described in four places, pinned to itself.
 *
 * The database, this repository's read schema, the TypeScript writer, and the SQL verification
 * script all have to agree about what a `rebuild_provenance` document is. Before this test they
 * agreed about a *subset*: the RPC bound eight source fields and accepted any object containing
 * them, the verifier used that eight-field object as its "complete" positive fixture, and the read
 * schema required rather more. A document the database happily stored therefore failed to parse on
 * read, and `loadUserCard` turned it into `null` — presenting a row carrying rebuild evidence as an
 * ordinary card that was never rebuilt.
 *
 * Nothing about that was visible from any one file, which is why the check lives here and compares
 * the files to each other rather than each to a prose description of the shape.
 *
 * These are source-text comparisons of the SQL, not executions of it. What they establish is that
 * the three descriptions cannot drift apart silently; what a PostgreSQL server actually does with
 * the document is the verification script's job.
 */

const MIGRATION = path.join(
  process.cwd(),
  'supabase/migrations/20260804013000_add_ip_preference_card_rebuild_provenance.sql',
)
const VERIFIER = path.join(
  process.cwd(),
  'supabase/verification/20260804013000_verify_ip_preference_card_rebuild_provenance.sql',
)

const migrationSql = fs.readFileSync(MIGRATION, 'utf8')
const verifierSql = fs.readFileSync(VERIFIER, 'utf8')

/** The quoted entries of a `name text[] := array[ ... ];` declaration in the migration. */
function sqlArrayLiteral(name: string): string[] {
  const match = migrationSql.match(new RegExp(`${name} text\\[\\] := array\\[([^\\]]*)\\]`))
  if (!match) throw new Error(`the migration has no ${name} array literal`)
  return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]).sort()
}

/** The keys of the verifier's positive `provenance := jsonb_build_object(...)` fixture. */
function verifierFixtureKeys(): string[] {
  const start = verifierSql.indexOf('provenance := jsonb_build_object(')
  expect(start).toBeGreaterThan(-1)
  const end = verifierSql.indexOf('set local role service_role;', start)
  const body = verifierSql.slice(start, end)
  return [...new Set([...body.matchAll(/'([A-Za-z][A-Za-z0-9]*)',/g)].map((entry) => entry[1]))]
    .filter((key) => key !== 'jsonb_build_object')
    .sort()
}

describe('the version-1 provenance shape is one shape', () => {
  it('is the same key set in the schema and in the SQL validator', () => {
    expect(sqlArrayLiteral('required_keys')).toEqual([...REBUILD_PROVENANCE_V1_KEYS].sort())
  })

  it('is the same nullable key set in the schema and in the SQL validator', () => {
    expect(sqlArrayLiteral('nullable_keys')).toEqual(
      [...REBUILD_PROVENANCE_V1_NULLABLE_KEYS].sort(),
    )
  })

  it('names exactly the schema keys that actually accept null', () => {
    // Derived from the schema rather than restated, so a field that becomes nullable and is not
    // added to the SQL list fails here instead of at the database.
    const acceptsNull = REBUILD_PROVENANCE_V1_KEYS.filter((key) => {
      const field = storedRebuildProvenanceSchema.shape[key]
      return field.safeParse(null).success
    }).sort()
    expect(acceptsNull).toEqual([...REBUILD_PROVENANCE_V1_NULLABLE_KEYS].sort())
  })

  it('is the same decision shape in the schema and in the SQL validator', () => {
    for (const key of REBUILD_PROVENANCE_V1_DECISION_KEYS) {
      expect(migrationSql).toContain(`decision -> '${key}'`)
    }
    // Five keys exactly: an extra key in a decision entry is a claim nothing reads.
    expect(migrationSql).toContain('(select count(*) from jsonb_object_keys(decision)) <> 5')
    expect(REBUILD_PROVENANCE_V1_DECISION_KEYS).toHaveLength(5)
  })

  it("is the shape the verifier's positive fixture actually builds", () => {
    // The defect this test exists for: the verifier called an eight-field object "complete" and
    // used it as the case that proves the RPC accepts a valid document.
    expect(verifierFixtureKeys()).toEqual([...REBUILD_PROVENANCE_V1_KEYS].sort())
  })

  it('rejects an unknown top-level key in both descriptions', () => {
    expect(
      storedRebuildProvenanceSchema.safeParse({ ...validDocument(), invented: true }).success,
    ).toBe(false)
    expect(migrationSql).toContain(
      'the provenance document carries a key version 1 does not define',
    )
  })

  it('requires an explicitly stated null rather than an absent key', () => {
    const document = validDocument()
    delete (document as Record<string, unknown>).sourceSnapshotIntegrityHash
    expect(storedRebuildProvenanceSchema.safeParse(document).success).toBe(false)
    expect(migrationSql).toContain('the provenance document is missing a required version-1 key')
  })

  it.each([...REBUILD_PROVENANCE_V1_KEYS])('requires %s', (key) => {
    const document = validDocument() as Record<string, unknown>
    delete document[key]
    expect(storedRebuildProvenanceSchema.safeParse(document).success).toBe(false)
  })

  it('accepts the complete document', () => {
    expect(storedRebuildProvenanceSchema.safeParse(validDocument()).success).toBe(true)
  })

  it('binds the document owner to the scalar owner and to both source rows', () => {
    expect(migrationSql).toContain(
      "or p_rebuild_provenance->>'sourceOwnerId' is distinct from p_owner_id::text",
    )
    expect(migrationSql).toContain(
      "and revision.user_id::text = p_rebuild_provenance->>'sourceOwnerId'",
    )
    expect(migrationSql).toContain(
      "and source.user_id::text = p_rebuild_provenance->>'sourceOwnerId'",
    )
  })

  it('raises invalid_parameter_value, never a generic error, for every shape failure', () => {
    const validator = migrationSql.slice(
      migrationSql.indexOf(
        'create function private.ip_validate_preference_card_rebuild_provenance_v1',
      ),
      migrationSql.indexOf(
        'revoke all on function private.ip_validate_preference_card_rebuild_provenance_v1',
      ),
    )
    const raises = validator.match(/raise exception/g) ?? []
    const codes = validator.match(/using errcode = 'invalid_parameter_value'/g) ?? []
    expect(raises.length).toBeGreaterThan(8)
    expect(codes).toHaveLength(raises.length)
  })
})

/** A complete, internally consistent version-1 document. The tests above mutate copies of it. */
function validDocument() {
  return {
    version: 'ip-cards-rebuild/1' as const,
    sourceCardId: '00000000-0000-4000-8000-000000000001',
    sourceRevisionId: '00000000-0000-4000-9000-000000000001',
    sourceOwnerId: '00000000-0000-4000-a000-000000000001',
    sourceRevisionNumber: 1,
    sourceReleaseBundleId: 'release-fixture-procedure-v1-0',
    sourceReleaseDefinitionHash: 'e'.repeat(64),
    sourceSnapshotHash: 'a'.repeat(64),
    sourceSnapshotIntegrityHash: 'b'.repeat(64),
    sourceResolvedContentHash: 'c'.repeat(64),
    sourcePrintDocumentHash: 'd'.repeat(64),
    targetReleaseBundleId: 'release-fixture-procedure-v1-1',
    targetReleaseDefinitionHash: 'f'.repeat(64),
    targetCatalogReleaseId: 'fixture-catalog-import-0001',
    operationalReconciliationHash: '2'.repeat(64),
    authoredReleaseDiffHash: '3'.repeat(64),
    mappingPlanHash: '1'.repeat(64),
    allowedFinalStateHash: '4'.repeat(64),
    decisions: [
      {
        key: 'requirement:FIXTURE_BACKUP_SCOPE',
        kind: 'requirement',
        state: 'carried_requires_review',
        reasonCodes: ['requirement_definition_changed'],
        acknowledgement: 'confirmed',
      },
    ],
    createdAt: '2026-02-01T00:00:00.000Z',
  }
}
