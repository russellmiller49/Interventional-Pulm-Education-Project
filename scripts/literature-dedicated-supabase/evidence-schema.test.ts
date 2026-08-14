/** @jest-environment node */

import { LITERATURE_CATALOG_SECTIONS } from './lib/foundation-catalog'
import {
  LiteratureEvidenceError,
  assertDecodedEvidenceCarriesNoSecret,
  parseLiteratureEvidence,
} from './lib/evidence-schema'

function emptyCatalog() {
  return Object.fromEntries(LITERATURE_CATALOG_SECTIONS.map((section) => [section, []]))
}

function validEvidence(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 'literature-dedicated-observation/2.0.0',
    queryBundleSha256: 'a'.repeat(64),
    migrationVersions: [],
    catalog: emptyCatalog(),
    prerequisites: {
      availableExtensions: ['pg_trgm'],
      roles: ['anon', 'authenticated', 'service_role'],
      schemas: ['extensions', 'public'],
    },
    totalRowCount: 0,
    ...overrides,
  }
}

function parse(value: unknown) {
  return parseLiteratureEvidence(JSON.stringify(value))
}

function expectCode(action: () => unknown, code: string) {
  try {
    action()
  } catch (error) {
    expect(error).toBeInstanceOf(LiteratureEvidenceError)
    expect((error as LiteratureEvidenceError).code).toBe(code)
    return
  }
  throw new Error(`expected a ${code} error`)
}

describe('strict evidence parsing (H-2)', () => {
  it('accepts a well-formed document', () => {
    expect(parse(validEvidence()).totalRowCount).toBe(0)
  })

  it('rejects a partial catalog', () => {
    // The exact review reproduction: catalog: {"tables":[]} previously passed.
    expectCode(() => parse(validEvidence({ catalog: { tables: [] } })), 'schema_violation')
  })

  it('rejects a catalog missing a single section', () => {
    const catalog = emptyCatalog()
    delete (catalog as Record<string, unknown>).tablePrivileges
    expectCode(() => parse(validEvidence({ catalog })), 'schema_violation')
  })

  it('rejects an unexpected extra catalog section', () => {
    expectCode(
      () => parse(validEvidence({ catalog: { ...emptyCatalog(), surprise: [] } })),
      'schema_violation',
    )
  })

  it('rejects unknown top-level fields, including a self-declared projectRef', () => {
    // Structural half of the B-1 fix: an evidence document cannot name its own target.
    expectCode(
      () => parse(validEvidence({ projectRef: 'itcttmkxdxvwmwcmzmey' })),
      'schema_violation',
    )
    expectCode(
      () => parse(validEvidence({ hostname: 'db.example.supabase.co' })),
      'schema_violation',
    )
  })

  it('rejects unknown nested fields', () => {
    expectCode(
      () =>
        parse(
          validEvidence({
            prerequisites: {
              availableExtensions: [],
              roles: [],
              schemas: [],
              extra: true,
            },
          }),
        ),
      'schema_violation',
    )
  })

  it('rejects missing required fields', () => {
    const evidence = validEvidence() as Record<string, unknown>
    delete evidence.totalRowCount
    expectCode(() => parse(evidence), 'schema_violation')
  })

  it('rejects wrong types before any business logic runs', () => {
    expectCode(() => parse(validEvidence({ migrationVersions: 'none' })), 'schema_violation')
    expectCode(() => parse(validEvidence({ totalRowCount: '0' })), 'schema_violation')
    expectCode(() => parse(validEvidence({ totalRowCount: -1 })), 'schema_violation')
    expectCode(() => parse(validEvidence({ totalRowCount: 1.5 })), 'schema_violation')
    expectCode(
      () => parse(validEvidence({ catalog: { ...emptyCatalog(), relations: 'nope' } })),
      'schema_violation',
    )
  })

  it('rejects malformed catalog rows rather than throwing a TypeError later', () => {
    expectCode(
      () => parse(validEvidence({ catalog: { ...emptyCatalog(), relations: [[1, 2]] } })),
      'schema_violation',
    )
    expectCode(
      () => parse(validEvidence({ catalog: { ...emptyCatalog(), relations: ['text'] } })),
      'schema_violation',
    )
  })

  it('rejects a wrong schema version', () => {
    expectCode(() => parse(validEvidence({ schemaVersion: 'v1' })), 'schema_violation')
  })

  it('rejects a malformed query bundle hash', () => {
    expectCode(() => parse(validEvidence({ queryBundleSha256: 'short' })), 'schema_violation')
  })

  it('rejects duplicate JSON keys instead of taking the last value', () => {
    const base = JSON.stringify(validEvidence())
    const duplicated = `${base.slice(0, -1)},"totalRowCount":99}`
    expectCode(() => parseLiteratureEvidence(duplicated), 'duplicate_json_key')
  })

  it('rejects duplicate keys nested inside the catalog', () => {
    const duplicated =
      '{"schemaVersion":"literature-dedicated-observation/2.0.0","queryBundleSha256":"' +
      'a'.repeat(64) +
      '","migrationVersions":[],"catalog":{"relations":[],"relations":[]},"prerequisites":' +
      '{"availableExtensions":[],"roles":[],"schemas":[]},"totalRowCount":0}'
    expectCode(() => parseLiteratureEvidence(duplicated), 'duplicate_json_key')
  })

  it('rejects malformed JSON with a typed error', () => {
    expectCode(() => parseLiteratureEvidence('{'), 'malformed_json')
    expectCode(() => parseLiteratureEvidence('{} trailing'), 'malformed_json')
  })
})

describe('post-decode credential screening (M-2)', () => {
  it('rejects a top-level secret', () => {
    expectCode(
      () => parse(validEvidence({ migrationVersions: ['sb_secret_' + 'x'.repeat(20)] })),
      'credential_shaped_value',
    )
  })

  it('rejects a nested secret', () => {
    expectCode(
      () =>
        parse(
          validEvidence({
            catalog: {
              ...emptyCatalog(),
              relations: [{ name: 'x', note: 'sb_secret_' + 'y'.repeat(20) }],
            },
          }),
        ),
      'credential_shaped_value',
    )
  })

  it('rejects a secret inside an array', () => {
    expectCode(
      () =>
        parse(
          validEvidence({
            prerequisites: {
              availableExtensions: ['sb_publishable_' + 'z'.repeat(20)],
              roles: [],
              schemas: [],
            },
          }),
        ),
      'credential_shaped_value',
    )
  })

  it('rejects a secret written with Unicode escapes', () => {
    // sb_secret_… decodes to sb_secret_… — the old raw-text scan missed this entirely.
    const escaped =
      '{"schemaVersion":"literature-dedicated-observation/2.0.0","queryBundleSha256":"' +
      'a'.repeat(64) +
      '","migrationVersions":["sb\\u005fsecret\\u005fAAAAAAAAAAAAAAAAAAAA"],"catalog":' +
      JSON.stringify(emptyCatalog()) +
      ',"prerequisites":{"availableExtensions":[],"roles":[],"schemas":[]},"totalRowCount":0}'
    expectCode(() => parseLiteratureEvidence(escaped), 'credential_shaped_value')
  })

  it('rejects a mixed-case secret', () => {
    expectCode(
      () => parse(validEvidence({ migrationVersions: ['SB_SeCrEt_' + 'q'.repeat(20)] })),
      'credential_shaped_value',
    )
  })

  it('rejects a JWT-shaped value', () => {
    expectCode(
      () =>
        parse(validEvidence({ migrationVersions: ['eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9'] })),
      'credential_shaped_value',
    )
  })

  it('rejects an inline-credential connection string', () => {
    expectCode(
      () => parse(validEvidence({ migrationVersions: ['postgresql://user:pw@host:5432/db'] })),
      'credential_shaped_value',
    )
  })

  it('rejects a credential-shaped key', () => {
    expectCode(
      () =>
        assertDecodedEvidenceCarriesNoSecret({
          catalog: { relations: [{ service_role_key: 'anything' }] },
        }),
      'credential_shaped_value',
    )
    expectCode(
      () => assertDecodedEvidenceCarriesNoSecret({ authorization: 'x' }),
      'credential_shaped_value',
    )
    expectCode(
      () => assertDecodedEvidenceCarriesNoSecret({ apiKey: 'x' }),
      'credential_shaped_value',
    )
  })

  it('does not false-positive on ordinary catalog content', () => {
    expect(() =>
      assertDecodedEvidenceCarriesNoSecret({
        functions: [
          {
            name: 'search_literature_v1',
            acl: ['service_role=X/supabase_admin'],
            definition: 'CREATE OR REPLACE FUNCTION public.search_literature_v1() ...',
          },
        ],
      }),
    ).not.toThrow()
  })
})
