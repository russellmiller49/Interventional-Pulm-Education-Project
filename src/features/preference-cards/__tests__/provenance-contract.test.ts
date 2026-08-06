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

/** The `'key', <expression>` pairs of one `jsonb_build_object(...)` call in the verifier. */
function fixturePairs(marker: string): Array<[string, string]> {
  const start = verifierSql.indexOf(marker)
  expect(start).toBeGreaterThan(-1)
  const body = verifierSql.slice(start, verifierSql.indexOf(');', start))
  return [...body.matchAll(/'([A-Za-z][A-Za-z0-9]*)',\s*([^\n,]+(?:,\s*64\))?)\s*,?/g)].map(
    (entry) => [entry[1], entry[2].trim().replace(/\)$/, '')],
  )
}

function verifierFixtureKeys(): string[] {
  return [...new Set(fixturePairs('provenance := jsonb_build_object(').map(([key]) => key))].sort()
}

/**
 * The verifier's positive fixture, as the value it actually builds.
 *
 * Comparing key *names* was not enough: the review's point is that the document the verifier calls
 * valid must be one the application can read, and that is a claim about values. Every SQL expression
 * the fixture uses is translated here through an explicit table, and an unrecognised expression is a
 * hard failure — so a future fixture that introduces one forces this table to be updated rather than
 * quietly falling back to something that happens to parse.
 */
function verifierFixtureDocument(): Record<string, unknown> {
  const SUBSTITUTIONS: Record<string, unknown> = {
    // Local variables the verifier assigns before building the fixture.
    source_id: '00000000-0000-4000-8000-000000000001',
    source_revision: '00000000-0000-4000-9000-000000000001',
    owner_id: '00000000-0000-4000-a000-000000000001',
    source_hash: 'e'.repeat(64),
    release_id: 'release-verify-v1',
    'null::text': null,
    decisions_fixture: [
      {
        key: 'requirement:VERIFY_ONLY',
        kind: 'requirement',
        state: 'carried_requires_review',
        reasonCodes: ['requirement_definition_changed'],
        acknowledgement: 'confirmed',
      },
    ],
  }

  const value = (expression: string): unknown => {
    if (expression in SUBSTITUTIONS) return SUBSTITUTIONS[expression]
    const repeat = expression.match(/^repeat\('(.)',\s*64$/)
    if (repeat) return repeat[1].repeat(64)
    if (/^'[^']*'$/.test(expression)) return expression.slice(1, -1)
    if (/^[0-9]+$/.test(expression)) return Number(expression)
    throw new Error(`unrecognised verifier fixture expression: ${expression}`)
  }

  return Object.fromEntries(
    fixturePairs('provenance := jsonb_build_object(').map(([key, expression]) => [
      key,
      value(expression),
    ]),
  )
}

/**
 * Which SQL type array each key belongs in, derived from the schema rather than restated.
 *
 * Removing a field from `hash_keys`, `uuid_keys` or `text_keys` used to leave every test green while
 * weakening the RPC, because nothing compared the arrays to the fields they are supposed to describe.
 */
function schemaTypeClasses() {
  const uuid = '00000000-0000-4000-8000-000000000001'
  const digest = 'a'.repeat(64)
  const classes: Record<'uuid' | 'hash' | 'text', string[]> = { uuid: [], hash: [], text: [] }
  for (const key of REBUILD_PROVENANCE_V1_KEYS) {
    const field = storedRebuildProvenanceSchema.shape[key]
    const takesUuid = field.safeParse(uuid).success
    const takesDigest = field.safeParse(digest).success
    const takesWord = field.safeParse('release-fixture-v1').success
    if (takesUuid && !takesDigest) classes.uuid.push(key)
    else if (takesDigest && !takesWord) classes.hash.push(key)
    else if (takesWord) classes.text.push(key)
  }
  return {
    uuid: classes.uuid.sort(),
    hash: classes.hash.sort(),
    text: classes.text.sort(),
  }
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
    expect(sqlArrayLiteral('decision_keys')).toEqual(
      [...REBUILD_PROVENANCE_V1_DECISION_KEYS].sort(),
    )
  })

  it('compares the nested key set exactly, rather than counting to five', () => {
    // The bypass this replaces: swap `acknowledgement` for an invented key and the count still
    // passes, while `jsonb_typeof(decision -> 'acknowledgement')` on an absent key is SQL NULL — so
    // `NULL not in (...)` is NULL, the whole `if` is NULL rather than true, and nothing raises. A
    // document with a fabricated claim and a missing required one was stored, then rejected on read.
    expect(migrationSql).not.toContain('(select count(*) from jsonb_object_keys(decision)) <> 5')
    expect(migrationSql).toContain(
      'select 1 from unnest(decision_keys) as k where not (decision ? k)',
    )
    expect(migrationSql).toContain(
      'select 1 from jsonb_object_keys(decision) as k where not (k = any (decision_keys))',
    )
    // And the schema rejects the exact document that used to slip through.
    const swapped = validDocument()
    swapped.decisions = [
      {
        key: 'x',
        kind: 'requirement',
        state: 'carried_unchanged',
        reasonCodes: [],
        invented: true,
      },
    ] as never
    expect(storedRebuildProvenanceSchema.safeParse(swapped).success).toBe(false)
  })

  it.each([
    ['uuid_keys', 'uuid'],
    ['hash_keys', 'hash'],
    ['text_keys', 'text'],
  ] as const)(
    'assigns every %s member from the schema, not from a restated list',
    (array, kind) => {
      expect(sqlArrayLiteral(array)).toEqual(schemaTypeClasses()[kind])
    },
  )

  it("is the shape the verifier's positive fixture actually builds", () => {
    // The defect this test exists for: the verifier called an eight-field object "complete" and
    // used it as the case that proves the RPC accepts a valid document.
    expect(verifierFixtureKeys()).toEqual([...REBUILD_PROVENANCE_V1_KEYS].sort())
  })

  it("parses the verifier's positive fixture through the runtime schema", () => {
    // Names were never the claim. The document the verifier declares valid has to be one the
    // application can actually read back, and that is a statement about *values* — a fixture whose
    // keys are right and whose `createdAt` is `yesterday` would still store a card that comes back
    // as `invalid` on every read.
    const parsed = storedRebuildProvenanceSchema.safeParse(verifierFixtureDocument())
    expect(parsed.success).toBe(true)
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

  it('lets the writer role reach the validator its own function calls', () => {
    // Without these two grants the whole writer path is dead: the RPC is `security definer` owned by
    // the writer, so inside it `current_user` is that role, and the deployed revision migration
    // revoked all access to schema `private` from everyone else. The first statement of the RPC
    // would raise 42501 and every real rebuild write would fail at the last step.
    expect(migrationSql).toContain(
      'grant usage on schema private to ip_preference_card_rebuild_writer',
    )
    expect(migrationSql).toMatch(
      /grant execute on function private\.ip_validate_preference_card_rebuild_provenance_v1\(jsonb\)\s+to ip_preference_card_rebuild_writer/,
    )
    // Granted after the revokes, or the revoke would take it straight back off again.
    const revoke = migrationSql.indexOf(
      'revoke all on function private.ip_validate_preference_card_rebuild_provenance_v1(jsonb)\n  from anon',
    )
    const grant = migrationSql.indexOf('grant usage on schema private')
    expect(revoke).toBeGreaterThan(-1)
    expect(grant).toBeGreaterThan(revoke)
    // And still not on the API surface: the validator stays private and security invoker.
    expect(migrationSql).not.toContain('create function public.ip_validate_preference_card')
    expect(migrationSql).toMatch(
      /create function private\.ip_validate_preference_card_rebuild_provenance_v1[\s\S]{0,200}security invoker/,
    )
  })

  it('bounds and trims every text field the way the runtime schema does', () => {
    // Whitespace-only and overlong ids passed `length(...) = 0` and then failed on read.
    expect(migrationSql).toContain('length(btrim(document ->> key)) = 0')
    expect(migrationSql).toContain('length(btrim(document ->> key)) > 120')
    // An empty acknowledgement is a claim that an answer was recorded, spelled as no answer.
    expect(migrationSql).toContain(
      "length(btrim(decision ->> 'acknowledgement')) not between 1 and 40",
    )
    // And a createdAt that is shaped like a timestamp but is not one.
    expect(migrationSql).toContain("perform (document ->> 'createdAt')::timestamptz")
    expect(migrationSql).toContain('when invalid_datetime_format or datetime_field_overflow then')
    for (const bad of ['2026-99-99Tgarbage', '2026-02-01T00:00:00.000', 'yesterday']) {
      expect(
        storedRebuildProvenanceSchema.safeParse({ ...validDocument(), createdAt: bad }).success,
      ).toBe(false)
    }
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
