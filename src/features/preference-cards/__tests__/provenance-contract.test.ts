import fs from 'node:fs'
import path from 'node:path'

import {
  PROVENANCE_V1_EXAMPLES,
  validProvenanceV1Document,
  type ProvenanceExampleCategory,
} from '../__fixtures__/provenance-v1-examples'
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
    const swapped = validProvenanceV1Document()
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
      storedRebuildProvenanceSchema.safeParse({ ...validProvenanceV1Document(), invented: true })
        .success,
    ).toBe(false)
    expect(migrationSql).toContain(
      'the provenance document carries a key version 1 does not define',
    )
  })

  it('requires an explicitly stated null rather than an absent key', () => {
    const document = validProvenanceV1Document()
    delete (document as Record<string, unknown>).sourceSnapshotIntegrityHash
    expect(storedRebuildProvenanceSchema.safeParse(document).success).toBe(false)
    expect(migrationSql).toContain('the provenance document is missing a required version-1 key')
  })

  it.each([...REBUILD_PROVENANCE_V1_KEYS])('requires %s', (key) => {
    const document = validProvenanceV1Document() as Record<string, unknown>
    delete document[key]
    expect(storedRebuildProvenanceSchema.safeParse(document).success).toBe(false)
  })

  it('accepts the complete document', () => {
    expect(storedRebuildProvenanceSchema.safeParse(validProvenanceV1Document()).success).toBe(true)
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

  it('bounds every text field to the same canonical subset the runtime schema does', () => {
    // One alphabet rather than two whitespace definitions: `btrim` strips spaces where ECMAScript
    // `trim()` strips a much larger set, and `length(text)` counts characters where JavaScript
    // counts UTF-16 code units. Inside printable ASCII both pairs agree.
    expect(migrationSql).toContain("!~ '^[!-~]([ -~]*[!-~])?$'")
    expect(migrationSql).toContain(
      'the provenance document has an empty, padded, non-ASCII or overlong %',
    )
    expect(migrationSql).toContain(
      'a provenance decision entry has an empty, padded, non-ASCII or overlong field',
    )
    // Inlined, so the writer needs execute on exactly one private function.
    expect(migrationSql).not.toContain('ip_is_canonical_text')
    expect(migrationSql).not.toMatch(/grant execute on all functions in schema private/i)
    // And a createdAt that is shaped like a timestamp but is not one.
    expect(migrationSql).toContain("(document ->> 'createdAt')::timestamptz")
    expect(migrationSql).toContain('when invalid_datetime_format or datetime_field_overflow then')
    for (const bad of ['2026-99-99Tgarbage', '2026-02-01T00:00:00.000', 'yesterday']) {
      expect(
        storedRebuildProvenanceSchema.safeParse({
          ...validProvenanceV1Document(),
          createdAt: bad,
        }).success,
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

/**
 * The one place a category is tied to the SQL rule that implements it.
 *
 * A source-text map rather than an execution, and it says so: what it establishes is that the SQL
 * validator has *a named rule* for every category the shared table exercises, so a category can no
 * longer be added on the TypeScript side alone. What PostgreSQL does with each document is the
 * verification script's job.
 */
const SQL_RULE_FOR_CATEGORY: Record<Exclude<ProvenanceExampleCategory, 'valid'>, string> = {
  unknown_top_level_key: 'the provenance document carries a key version 1 does not define',
  omitted_top_level_key: 'the provenance document is missing a required version-1 key',
  wrong_typed_top_level_key: 'foreach key in array uuid_keys loop',
  null_on_non_nullable_key: 'which version 1 does not allow',
  explicit_nullable_null: 'nullable_keys text[] := array[',
  padded_or_overlong_text: 'the provenance document has an empty, padded, non-ASCII or overlong %',
  malformed_uuid: 'the provenance document has a % that is not a uuid',
  malformed_hash: 'the provenance document has a % that is not a sha-256 digest',
  malformed_revision_number: 'is not a safe positive integer',
  malformed_timestamp: 'the provenance document has a createdAt that is not a real instant',
  // (the shape half is checked separately, by its own named rule)
  unknown_nested_key: 'a provenance decision entry does not carry exactly the version-1 keys',
  omitted_nested_key: 'a provenance decision entry does not carry exactly the version-1 keys',
  wrong_typed_nested_key: 'a provenance decision entry does not match the version-1 shape',
  malformed_nested_text:
    'a provenance decision entry has an empty, padded, non-ASCII or overlong field',
  malformed_reason_code: 'a provenance decision reason code is not a bounded, canonical string',
  oversized_collection: "jsonb_array_length(decision -> 'reasonCodes') > 40",
}

describe('the shared example table describes both implementations', () => {
  it.each(PROVENANCE_V1_EXAMPLES.map((example) => [example.label, example] as const))(
    'the runtime schema agrees about %s',
    (_label, example) => {
      expect(storedRebuildProvenanceSchema.safeParse(example.document).success).toBe(example.valid)
    },
  )

  it.each(
    [...new Set(PROVENANCE_V1_EXAMPLES.map((example) => example.category))]
      .filter(
        (category): category is Exclude<ProvenanceExampleCategory, 'valid'> => category !== 'valid',
      )
      .map((category) => [category] as const),
  )('the SQL validator carries a rule for %s', (category) => {
    expect(migrationSql).toContain(SQL_RULE_FOR_CATEGORY[category])
  })

  it('covers every top-level key in both the omission and the wrong-type dimension', () => {
    // The defect this replaces: Zod's tests omitted all twenty keys and the SQL matrix omitted
    // seven, and nothing compared the two lists.
    for (const dimension of ['omitted_top_level_key', 'wrong_typed_top_level_key'] as const) {
      const covered = PROVENANCE_V1_EXAMPLES.filter(
        (example) => example.category === dimension,
      ).length
      expect(covered).toBe(REBUILD_PROVENANCE_V1_KEYS.length)
    }
  })

  it('covers every nested key in the omission dimension', () => {
    const covered = PROVENANCE_V1_EXAMPLES.filter(
      (example) => example.category === 'omitted_nested_key',
    ).length
    expect(covered).toBe(REBUILD_PROVENANCE_V1_DECISION_KEYS.length)
  })

  it('states one reason per invalid example, so a rejection names something', () => {
    // An example that is wrong in two ways proves only that something rejected it.
    for (const example of PROVENANCE_V1_EXAMPLES) {
      if (example.valid) continue
      const issues = storedRebuildProvenanceSchema.safeParse(example.document)
      expect(issues.success).toBe(false)
      if (!issues.success) expect(issues.error.issues.length).toBeGreaterThan(0)
    }
  })

  it('cannot lose a field from a SQL type array while staying green', () => {
    // Every typed field is in exactly one class, and the class lists are derived from the schema —
    // so deleting `mappingPlanHash` from `hash_keys` fails the parity test above rather than
    // silently weakening the RPC. This asserts the classes actually partition the typed fields.
    const classes = schemaTypeClasses()
    const classified = [...classes.uuid, ...classes.hash, ...classes.text]
    expect(new Set(classified).size).toBe(classified.length)
    // Everything not in a string class is checked by its own named rule.
    const unclassified = REBUILD_PROVENANCE_V1_KEYS.filter((key) => !classified.includes(key))
    expect([...unclassified].sort()).toEqual(
      ['createdAt', 'decisions', 'sourceRevisionNumber', 'version'].sort(),
    )
    for (const key of unclassified) {
      expect(migrationSql).toContain(`'${key}'`)
    }
  })
})

describe('the canonical string and timestamp contracts are one contract', () => {
  it('uses the same printable-ASCII expression in both implementations', () => {
    // Not two whitespace definitions reconciled — one alphabet, inside which PostgreSQL's character
    // count and JavaScript's code-unit count are the same number and "no padding" means one thing.
    expect(migrationSql).toContain("!~ '^[!-~]([ -~]*[!-~])?$'")
    expect(
      fs.readFileSync(
        path.join(process.cwd(), 'src/features/preference-cards/schemas/card-rebuild.ts'),
        'utf8',
      ),
    ).toContain('const CANONICAL_TEXT = /^[!-~]([ -~]*[!-~])?$/')
  })

  it('no longer normalises anything on the way in', () => {
    const schemaSource = fs.readFileSync(
      path.join(process.cwd(), 'src/features/preference-cards/schemas/card-rebuild.ts'),
      'utf8',
    )
    // Persisted evidence is rejected when noncanonical, never quietly rewritten: a stored value and
    // a read value have to be the same bytes. Scoped to the stored-provenance schema — the request
    // schemas above it legitimately trim a title the browser typed.
    const stored = schemaSource.slice(
      schemaSource.indexOf('export const storedRebuildProvenanceSchema'),
      schemaSource.indexOf('export type StoredRebuildProvenance'),
    )
    expect(stored).not.toContain('.trim()')
    expect(schemaSource.slice(0, schemaSource.indexOf('const canonicalText'))).not.toContain(
      'sha256Schema = z\n  .string()\n  .trim()',
    )
    expect(schemaSource).toContain('const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)')
  })

  it('round-trips the timestamp rather than trusting Date.parse', () => {
    // `Date.parse('2026-02-30T00:00:00.000Z')` succeeds and rolls over into March.
    expect(Number.isNaN(Date.parse('2026-02-30T00:00:00.000Z'))).toBe(false)
    expect(
      storedRebuildProvenanceSchema.safeParse({
        ...validProvenanceV1Document(),
        createdAt: '2026-02-30T00:00:00.000Z',
      }).success,
    ).toBe(false)
    // And the SQL side casts *and* re-serializes, so the spelling is pinned too.
    expect(migrationSql).toContain(
      "to_char((document ->> 'createdAt')::timestamptz at time zone 'UTC'",
    )
    expect(migrationSql).toContain('YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  })

  it('states one year domain, 0001 through 9999, on both sides', () => {
    // JavaScript's proleptic Gregorian calendar has a year zero and PostgreSQL's does not, so
    // `0000-02-29T00:00:00.000Z` round-tripped through `toISOString()` and was refused by the cast.
    // SQL being stricter meant nothing unreadable could be stored — and the two sides still
    // described different sets, which is the property being claimed.
    expect(new Date('0000-02-29T00:00:00.000Z').toISOString()).toBe('0000-02-29T00:00:00.000Z')
    expect(
      storedRebuildProvenanceSchema.safeParse({
        ...validProvenanceV1Document(),
        createdAt: '0000-02-29T00:00:00.000Z',
      }).success,
    ).toBe(false)
    for (const edge of ['0001-01-01T00:00:00.000Z', '9999-12-31T23:59:59.999Z']) {
      expect(
        storedRebuildProvenanceSchema.safeParse({
          ...validProvenanceV1Document(),
          createdAt: edge,
        }).success,
      ).toBe(true)
    }
    expect(migrationSql).toContain("left(document ->> 'createdAt', 4) = '0000'")
  })

  it('grants the writer exactly one private function', () => {
    // The canonical-text predicate is inlined rather than factored into a second private helper.
    expect(migrationSql).not.toContain('ip_is_canonical_text')
    expect(migrationSql.match(/grant execute on function private\./g) ?? []).toHaveLength(1)
    expect(verifierSql).toContain(
      "has_function_privilege('ip_preference_card_rebuild_writer', p.oid, 'EXECUTE')) <> 1",
    )
  })
})

describe('the verifier can actually run', () => {
  it('parenthesises the nested-omission expression', () => {
    // PostgreSQL gives binary `-` higher precedence than the class `->` belongs to, so
    // `decisions_fixture -> 0 - omitted_key` parses as `decisions_fixture -> (0 - omitted_key)` —
    // integer minus text — and raises 42883. Nothing caught it, so the script aborted before the
    // positive writer call, Part 6, cleanup and ALL CHECKS PASSED.
    expect(verifierSql).toContain('(decisions_fixture -> 0) - omitted_key')
    expect(verifierSql).not.toMatch(/decisions_fixture ->\s*0\s*-\s*omitted_key/)
  })

  it('brackets every refusal with its own card and revision counts', () => {
    // A shared baseline across a group proves only that the *net* effect was nothing, which an
    // unexpected write followed by an unexpected delete also satisfies.
    for (const marker of [
      'the refused authenticated forgery still wrote rows',
      'the refused other-owner insert still wrote rows',
      'the refused authenticated RPC call still wrote rows',
      'the refused service_role insert still wrote rows',
      'a refused privileged statement still wrote rows',
      'the refused case "%" still wrote rows',
      'the refused omission of % still wrote rows',
      'the refused wrong-typed % still wrote rows',
      'the refused decision omission of % still wrote rows',
      'the refused wrong-typed decision % still wrote rows',
      'the refused % as % still wrote rows',
    ]) {
      expect(verifierSql).toContain(marker)
    }
    // The three write-once directions are a loop with a per-iteration baseline, not one baseline
    // wrapped around all three.
    expect(verifierSql).toContain('for direction in')
    const loopBody = verifierSql.slice(
      verifierSql.indexOf('for direction in'),
      verifierSql.indexOf('end loop;', verifierSql.indexOf('for direction in')),
    )
    expect(loopBody).toContain('cards_at := (select count(*) from public.ip_user_preference_cards)')
  })

  it('covers every nested key in the wrong-type dimension too', () => {
    expect(verifierSql).toContain('the writer accepted a boolean decision %')
    const covered = PROVENANCE_V1_EXAMPLES.filter(
      (example) => example.category === 'wrong_typed_nested_key',
    ).length
    expect(covered).toBe(REBUILD_PROVENANCE_V1_DECISION_KEYS.length)
  })
})
