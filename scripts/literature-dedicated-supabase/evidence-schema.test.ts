/** @jest-environment node */

import { LITERATURE_CATALOG_SECTIONS } from './lib/foundation-catalog'
import type { LiteratureCatalogSection } from './lib/foundation-catalog'
import {
  LITERATURE_ACL_BEARING_CATALOG_SECTIONS,
  LITERATURE_CATALOG_ROW_SCHEMAS,
  LITERATURE_ROLE_BEARING_CATALOG_SECTIONS,
  LiteratureEvidenceError,
  assertDecodedEvidenceCarriesNoSecret,
  parseLiteraturePostflightEvidence,
  parseLiteraturePreflightEvidence,
} from './lib/evidence-schema'
import {
  LITERATURE_POSTFLIGHT_QUERY_PLAN_SHA256,
  LITERATURE_PREFLIGHT_QUERY_PLAN_SHA256,
} from './lib/target-observation'

/** One structurally valid row per catalog section, mirroring what the inspection SQL emits. */
const VALID_ROWS: Record<LiteratureCatalogSection, Record<string, unknown>> = {
  extensions: { name: 'pg_trgm', schema: 'extensions', version: '1.6' },
  relations: {
    schema: 'public',
    name: 'literature_articles',
    relkind: 'r',
    owner: 'supabase_admin',
    persistence: 'p',
    rowLevelSecurity: true,
    forcedRowLevelSecurity: false,
  },
  indexNames: { schema: 'public', name: 'literature_articles_pkey' },
  types: { schema: 'public', name: 'some_enum', typtype: 'e' },
  columns: {
    table: 'literature_articles',
    ordinal: 1,
    name: 'pmid',
    type: 'text',
    notNull: true,
    default: null,
    generated: '',
    identity: '',
    collation: null,
  },
  constraints: {
    table: 'literature_articles',
    name: 'literature_articles_pkey',
    type: 'p',
    definition: 'PRIMARY KEY (pmid)',
    validated: true,
    deferrable: false,
    deferred: false,
  },
  functions: {
    schema: 'public',
    name: 'search_literature_v1',
    argumentTypes: '',
    identityArguments: '',
    returnType: 'jsonb',
    language: 'sql',
    owner: 'supabase_admin',
    volatility: 's',
    strict: false,
    parallel: 's',
    securityDefiner: false,
    leakproof: false,
    config: ['search_path=pg_catalog, public'],
    definition: 'select 1',
    acl: ['service_role=X/supabase_admin', '=X/supabase_admin'],
    publicExecute: false,
    anonExecute: false,
    authenticatedExecute: false,
    serviceRoleExecute: true,
  },
  triggers: {
    table: 'literature_articles',
    name: 'set_literature_articles_updated_at',
    definition: 'CREATE TRIGGER set_literature_articles_updated_at ...',
    enabled: 'O',
    function: 'set_literature_updated_at',
  },
  indexes: {
    name: 'literature_articles_pkey',
    table: 'literature_articles',
    definition: 'CREATE UNIQUE INDEX literature_articles_pkey ...',
    unique: true,
    primary: true,
    valid: true,
    ready: true,
    method: 'btree',
  },
  policies: {
    table: 'literature_articles',
    name: 'some_policy',
    command: 'r',
    permissive: true,
    using: null,
    withCheck: null,
  },
  tablePrivileges: {
    table: 'literature_articles',
    role: 'service_role',
    privilege: 'SELECT',
    granted: true,
  },
  schemaPrivileges: { schema: 'public', role: 'service_role', privilege: 'USAGE', granted: true },
  defaultPrivileges: {
    owner: 'postgres',
    schema: 'public',
    objectType: 'r',
    acl: ['postgres=arwdDxt/postgres'],
  },
  roleAttributes: {
    role: 'service_role',
    superuser: false,
    bypassRls: true,
    canLogin: false,
    inherit: false,
  },
}

function emptyCatalog() {
  return Object.fromEntries(LITERATURE_CATALOG_SECTIONS.map((section) => [section, []]))
}

function populatedCatalog() {
  return Object.fromEntries(
    LITERATURE_CATALOG_SECTIONS.map((section) => [section, [VALID_ROWS[section]]]),
  )
}

function validPreflight(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 'literature-dedicated-preflight-observation/3.0.0',
    queryPlanSha256: LITERATURE_PREFLIGHT_QUERY_PLAN_SHA256,
    migrationHistory: { tableExists: false, versions: null },
    catalog: emptyCatalog(),
    prerequisites: {
      availableExtensions: ['pg_trgm'],
      roles: ['anon', 'authenticated', 'service_role'],
      schemas: ['extensions', 'public'],
    },
    ...overrides,
  }
}

function validPostflight(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 'literature-dedicated-postflight-observation/3.0.0',
    queryPlanSha256: LITERATURE_POSTFLIGHT_QUERY_PLAN_SHA256,
    existenceProbe: {
      migrationHistoryTableExists: true,
      presentLiteratureTables: ['literature_articles'],
    },
    migrationVersions: ['20260727032621'],
    catalog: populatedCatalog(),
    prerequisites: {
      availableExtensions: ['pg_trgm'],
      roles: ['anon', 'authenticated', 'service_role'],
      schemas: ['extensions', 'public'],
    },
    totalRowCount: 0,
    ...overrides,
  }
}

function parsePre(value: unknown) {
  return parseLiteraturePreflightEvidence(JSON.stringify(value))
}

function parsePost(value: unknown) {
  return parseLiteraturePostflightEvidence(JSON.stringify(value))
}

function expectCode(action: () => unknown, code: string): LiteratureEvidenceError {
  try {
    action()
  } catch (error) {
    expect(error).toBeInstanceOf(LiteratureEvidenceError)
    expect((error as LiteratureEvidenceError).code).toBe(code)
    return error as LiteratureEvidenceError
  }
  throw new Error(`expected a ${code} error`)
}

describe('phase-specific documents (L-1)', () => {
  it('accepts a well-formed preflight document, which has no totalRowCount', () => {
    const document = parsePre(validPreflight())
    expect(document.migrationHistory.tableExists).toBe(false)
    expect('totalRowCount' in document).toBe(false)
  })

  it('accepts a well-formed postflight document, which requires totalRowCount', () => {
    expect(parsePost(validPostflight()).totalRowCount).toBe(0)
  })

  it('rejects a totalRowCount smuggled into the preflight document', () => {
    expectCode(() => parsePre(validPreflight({ totalRowCount: 0 })), 'schema_violation')
  })

  it('rejects a postflight document without totalRowCount', () => {
    const document = validPostflight()
    delete (document as Record<string, unknown>).totalRowCount
    expectCode(() => parsePost(document), 'schema_violation')
  })

  it('rejects each phase document under the other phase parser', () => {
    expectCode(() => parsePost(validPreflight()), 'schema_violation')
    expectCode(() => parsePre(validPostflight()), 'schema_violation')
  })

  it('requires the phase plan identities to differ', () => {
    expect(LITERATURE_PREFLIGHT_QUERY_PLAN_SHA256).not.toBe(LITERATURE_POSTFLIGHT_QUERY_PLAN_SHA256)
  })

  it('rejects versions for an absent history table, and null versions for a present one', () => {
    expectCode(
      () => parsePre(validPreflight({ migrationHistory: { tableExists: false, versions: [] } })),
      'schema_violation',
    )
    expectCode(
      () => parsePre(validPreflight({ migrationHistory: { tableExists: true, versions: null } })),
      'schema_violation',
    )
    expect(
      parsePre(validPreflight({ migrationHistory: { tableExists: true, versions: [] } }))
        .migrationHistory.versions,
    ).toEqual([])
  })

  it('rejects a malformed query-plan hash', () => {
    expectCode(() => parsePre(validPreflight({ queryPlanSha256: 'nope' })), 'schema_violation')
  })
})

describe('strict catalog structure (H-2)', () => {
  it('rejects a partial catalog', () => {
    // The exact review reproduction: catalog: {"tables":[]} previously passed.
    expectCode(() => parsePre(validPreflight({ catalog: { tables: [] } })), 'schema_violation')
  })

  it('rejects a catalog missing a single section', () => {
    const catalog = emptyCatalog()
    delete (catalog as Record<string, unknown>).tablePrivileges
    expectCode(() => parsePre(validPreflight({ catalog })), 'schema_violation')
  })

  it('rejects an unexpected extra catalog section', () => {
    expectCode(
      () => parsePre(validPreflight({ catalog: { ...emptyCatalog(), extra: [] } })),
      'schema_violation',
    )
  })

  it('rejects unknown top-level fields, including a self-declared projectRef', () => {
    expectCode(
      () => parsePre(validPreflight({ projectRef: 'itcttmkxdxvwmwcmzmey' })),
      'schema_violation',
    )
    expectCode(() => parsePre(validPreflight({ hostname: 'x.supabase.co' })), 'schema_violation')
  })

  it('rejects a malformed section that is not an array', () => {
    expectCode(
      () => parsePre(validPreflight({ catalog: { ...emptyCatalog(), functions: {} } })),
      'schema_violation',
    )
  })

  describe('strict rows for every section', () => {
    it.each(LITERATURE_CATALOG_SECTIONS)('accepts a valid %s row', (section) => {
      const catalog = { ...emptyCatalog(), [section]: [VALID_ROWS[section]] }
      expect(() => parsePre(validPreflight({ catalog }))).not.toThrow()
    })

    it.each(LITERATURE_CATALOG_SECTIONS)('rejects an unknown nested field in %s', (section) => {
      const catalog = {
        ...emptyCatalog(),
        [section]: [{ ...VALID_ROWS[section], projectRef: 'zzzzzzzzzzzzzzzzzzzz' }],
      }
      expectCode(() => parsePre(validPreflight({ catalog })), 'schema_violation')
    })

    it.each(LITERATURE_CATALOG_SECTIONS)(
      'rejects a differently cased identity in %s',
      (section) => {
        const catalog = {
          ...emptyCatalog(),
          [section]: [{ ...VALID_ROWS[section], HostName: 'forged.supabase.co' }],
        }
        expectCode(() => parsePre(validPreflight({ catalog })), 'schema_violation')
      },
    )

    it.each(LITERATURE_CATALOG_SECTIONS)('rejects a missing field in %s', (section) => {
      const row = { ...VALID_ROWS[section] }
      delete row[Object.keys(row)[0]]
      const catalog = { ...emptyCatalog(), [section]: [row] }
      expectCode(() => parsePre(validPreflight({ catalog })), 'schema_violation')
    })
  })

  it('rejects a Unicode-escaped spelling of a nested identity field', () => {
    // "projectRef" decodes to "projectRef"; screening and schema run post-decode, so the
    // escaped spelling is exactly as unrepresentable as the plain one.
    const raw = JSON.stringify(validPreflight()).replace(
      '"tableExists"',
      '"\\u0070rojectRef":"zzzzzzzzzzzzzzzzzzzz","tableExists"',
    )
    expect(raw).toContain('\\u0070rojectRef')
    expectCode(() => parseLiteraturePreflightEvidence(raw), 'schema_violation')
  })

  it('rejects numeric relation, function, and index names with a controlled error (H-2)', () => {
    // The exact reproduction: {name: 5, relkind: "r"} previously survived into catalog
    // summarization and became a raw TypeError.
    for (const [section, field] of [
      ['relations', 'name'],
      ['functions', 'name'],
      ['indexes', 'name'],
      ['indexNames', 'name'],
    ] as const) {
      const catalog = {
        ...emptyCatalog(),
        [section]: [{ ...VALID_ROWS[section], [field]: 5 }],
      }
      const error = expectCode(() => parsePre(validPreflight({ catalog })), 'schema_violation')
      expect(error).not.toBeInstanceOf(TypeError)
    }
  })

  it('rejects malformed booleans and malformed arrays inside rows', () => {
    expectCode(
      () =>
        parsePre(
          validPreflight({
            catalog: {
              ...emptyCatalog(),
              relations: [{ ...VALID_ROWS.relations, rowLevelSecurity: 'yes' }],
            },
          }),
        ),
      'schema_violation',
    )
    expectCode(
      () =>
        parsePre(
          validPreflight({
            catalog: {
              ...emptyCatalog(),
              functions: [{ ...VALID_ROWS.functions, config: 'search_path=public' }],
            },
          }),
        ),
      'schema_violation',
    )
  })

  it('rejects wrong types before any business logic runs', () => {
    expectCode(() => parsePre(validPreflight({ migrationHistory: [] })), 'schema_violation')
    expectCode(() => parsePost(validPostflight({ totalRowCount: '0' })), 'schema_violation')
    expectCode(() => parsePost(validPostflight({ totalRowCount: -1 })), 'schema_violation')
    expectCode(() => parsePost(validPostflight({ totalRowCount: 0.5 })), 'schema_violation')
  })

  it('rejects unknown fields nested in prerequisites and the existence probe', () => {
    expectCode(
      () =>
        parsePre(
          validPreflight({
            prerequisites: {
              availableExtensions: [],
              roles: [],
              schemas: [],
              projectRef: 'zzzzzzzzzzzzzzzzzzzz',
            },
          }),
        ),
      'schema_violation',
    )
    expectCode(
      () =>
        parsePost(
          validPostflight({
            existenceProbe: {
              migrationHistoryTableExists: true,
              presentLiteratureTables: [],
              hostname: 'forged',
            },
          }),
        ),
      'schema_violation',
    )
  })
})

describe('JSON-compliant strict parser (H-2)', () => {
  it('rejects duplicate JSON keys instead of taking the last value', () => {
    const raw = `{"schemaVersion":"a","schemaVersion":"b"}`
    expectCode(() => parseLiteraturePreflightEvidence(raw), 'duplicate_json_key')
  })

  it('rejects duplicate keys nested deep inside the document', () => {
    const raw = JSON.stringify(validPreflight()).replace(
      '"tableExists":false',
      '"tableExists":false,"tableExists":false',
    )
    expectCode(() => parseLiteraturePreflightEvidence(raw), 'duplicate_json_key')
  })

  it('rejects malformed JSON with a typed error', () => {
    expectCode(() => parseLiteraturePreflightEvidence('{"a":'), 'malformed_json')
    expectCode(() => parseLiteraturePreflightEvidence('{} trailing'), 'malformed_json')
  })

  it.each([
    ['a literal newline U+000A', '\n'],
    ['a literal tab U+0009', '\t'],
    ['a literal carriage return U+000D', '\r'],
    ['a literal NUL U+0000', '\u0000'],
    ['a literal U+0001', '\u0001'],
    ['a literal U+001F', '\u001f'],
  ])('rejects %s inside a JSON string (RFC 8259)', (_label, character) => {
    const raw = `{"schemaVersion":"literature${character}forged"}`
    expectCode(() => parseLiteraturePreflightEvidence(raw), 'malformed_json')
  })

  it('accepts the escaped forms of the same control characters at the JSON layer', () => {
    // `\n`, `\t`, and `\u0001` written as escapes are valid JSON string content. The document
    // still fails -- but at the *schema* layer, proving the JSON parser accepted the string.
    const withEscapes = '{"a":"line\\nbreak\\ttab\\u0001"}'
    expectCode(() => parseLiteraturePreflightEvidence(withEscapes), 'schema_violation')
  })
})

describe('post-decode credential screening (M-2)', () => {
  it('rejects a top-level secret-shaped value', () => {
    expectCode(
      () => parsePre(validPreflight({ queryPlanSha256: 'sb_secret_0000' })),
      'credential_shaped_value',
    )
  })

  it('rejects a nested secret-shaped value', () => {
    expectCode(
      () =>
        parsePre(
          validPreflight({
            prerequisites: {
              availableExtensions: ['sb_secret_nested'],
              roles: [],
              schemas: [],
            },
          }),
        ),
      'credential_shaped_value',
    )
  })

  it('rejects a secret written with Unicode escapes', () => {
    const raw = JSON.stringify(validPreflight()).replace('"pg_trgm"', '"\\u0073b_secret_hidden"')
    expectCode(() => parseLiteraturePreflightEvidence(raw), 'credential_shaped_value')
  })

  it('rejects a mixed-case secret', () => {
    expectCode(
      () =>
        parsePre(
          validPreflight({
            prerequisites: { availableExtensions: ['SB_Secret_Mixed'], roles: [], schemas: [] },
          }),
        ),
      'credential_shaped_value',
    )
  })

  it('rejects a JWT-shaped value and an inline-credential connection string', () => {
    expectCode(
      () => assertDecodedEvidenceCarriesNoSecret({ x: `eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoieCJ9.zz` }),
      'credential_shaped_value',
    )
    expectCode(
      () => assertDecodedEvidenceCarriesNoSecret({ x: 'postgresql://user:pw@host/db' }),
      'credential_shaped_value',
    )
  })

  it('rejects a credential-shaped key without echoing it', () => {
    const error = expectCode(
      () => assertDecodedEvidenceCarriesNoSecret({ nested: { password: 'x' } }),
      'credential_shaped_value',
    )
    expect(error.message).not.toContain('password')
    expect(error.message).toContain('[redacted-key]')
  })

  describe('prohibited vocabulary in decoded string values', () => {
    it.each([
      ['password', 'password'],
      ['Authorization', 'Authorization'],
      ['a secret mention', 'this is my secret'],
      ['a token mention', 'access token here'],
      ['bearer', 'Bearer something'],
      ['api key with space', 'api key'],
      ['api_key', 'api_key'],
      ['apikey', 'apikey'],
      ['connection string', 'connection string'],
      ['connection_string', 'connection_string'],
      ['database URL', 'database URL'],
      ['database_url', 'database_url'],
      ['service role free text', 'use the service role for this'],
      ['service-role', 'service-role'],
      ['mixed case', 'PaSsWoRd'],
    ])('rejects %s as a decoded value', (_label, value) => {
      const error = expectCode(
        () => assertDecodedEvidenceCarriesNoSecret({ harmlessKey: value }),
        'credential_shaped_value',
      )
      // Never echo the rejected content.
      expect(error.message).not.toContain(value)
    })

    it('rejects vocabulary in values nested inside arrays and objects', () => {
      expectCode(
        () => assertDecodedEvidenceCarriesNoSecret({ a: [{ b: ['fine', 'Password!'] }] }),
        'credential_shaped_value',
      )
    })

    it('rejects a Unicode-escaped vocabulary value after decoding', () => {
      const raw = '{"a":"\\u0070assword"}'
      expectCode(() => parseLiteraturePreflightEvidence(raw), 'credential_shaped_value')
    })
  })

  describe('typed non-secret allowances instead of weakened screening', () => {
    it('permits the exact role name service_role in role positions', () => {
      expect(() =>
        assertDecodedEvidenceCarriesNoSecret(
          { role: 'service_role', granted: true },
          '$.catalog.tablePrivileges[0]',
        ),
      ).not.toThrow()
    })

    it('permits PostgreSQL ACL grammar entries', () => {
      expect(() =>
        assertDecodedEvidenceCarriesNoSecret(
          { acl: ['service_role=arwdDxt/supabase_admin', '=X/supabase_admin'] },
          '$.catalog.functions[0]',
        ),
      ).not.toThrow()
    })

    it('permits the contract-owned serviceRoleExecute field name', () => {
      expect(() =>
        assertDecodedEvidenceCarriesNoSecret(
          { serviceRoleExecute: true },
          '$.catalog.functions[0]',
        ),
      ).not.toThrow()
    })

    it('still rejects service_role embedded in free text or padded forms', () => {
      expectCode(
        () => assertDecodedEvidenceCarriesNoSecret({ x: 'service_role_key_material' }),
        'credential_shaped_value',
      )
      expectCode(
        () => assertDecodedEvidenceCarriesNoSecret({ x: ' service_role ' }),
        'credential_shaped_value',
      )
    })
  })

  /**
   * Third review, finding 2. The allowances above used to apply wherever a string appeared, so an
   * ACL-shaped string in `owner` or `definition` — `password=foo/grantor`, `token=abc/grantor` —
   * passed screening inside otherwise valid evidence. Position is now part of the allowance.
   *
   * These run through the **full parser**, not only the scanner, because that is the surface the
   * preflight and postflight actually use.
   */
  describe('allowances are position-specific (third review, finding 2)', () => {
    /** A postflight document with one catalog row field overridden. */
    function postflightWith(
      section: LiteratureCatalogSection,
      field: string,
      value: unknown,
      extraRow: Record<string, unknown> = {},
    ) {
      const catalog = populatedCatalog()
      catalog[section] = [{ ...VALID_ROWS[section], ...extraRow, [field]: value }]
      return validPostflight({ catalog })
    }

    it.each([
      ['relations', 'owner', 'password=foo/grantor'],
      ['relations', 'name', 'authorization=abc/grantor'],
      ['relations', 'schema', 'token=abc/grantor'],
      ['constraints', 'definition', 'token=abc/grantor'],
      ['constraints', 'type', 'secret=x/grantor'],
      ['functions', 'owner', 'password=foo/grantor'],
      ['functions', 'definition', 'token=abc/grantor'],
      ['functions', 'returnType', 'authorization=abc/grantor'],
      ['indexes', 'definition', 'password=foo/grantor'],
      ['triggers', 'definition', 'token=abc/grantor'],
      ['policies', 'name', 'authorization=abc/grantor'],
      ['types', 'name', 'password=foo/grantor'],
      ['extensions', 'version', 'token=abc/grantor'],
      ['indexNames', 'name', 'password=foo/grantor'],
    ] as [LiteratureCatalogSection, string, string][])(
      'rejects an ACL-shaped secret in catalog.%s[0].%s',
      (section, field, value) => {
        const error = expectCode(
          () => parsePost(postflightWith(section, field, value)),
          'credential_shaped_value',
        )
        expect(error.message).not.toContain(value)
      },
    )

    it('rejects an ACL-shaped secret outside the catalog entirely', () => {
      expectCode(
        () => parsePost(validPostflight({ migrationVersions: ['password=foo/grantor'] })),
        'credential_shaped_value',
      )
      expectCode(
        () =>
          parsePost(
            validPostflight({
              existenceProbe: {
                migrationHistoryTableExists: true,
                presentLiteratureTables: ['token=abc/grantor'],
              },
            }),
          ),
        'credential_shaped_value',
      )
    })

    it('accepts the same values inside the actual ACL arrays', () => {
      expect(() =>
        parsePost(
          postflightWith('functions', 'acl', ['password=foo/grantor', 'token=abc/grantor']),
        ),
      ).not.toThrow()
      expect(() =>
        parsePost(postflightWith('defaultPrivileges', 'acl', ['authorization=abc/grantor'])),
      ).not.toThrow()
    })

    it('rejects a malformed ACL value inside an ACL array', () => {
      // Vocabulary matches but the ACL grammar does not, so the position allowance does not apply.
      for (const malformed of [
        'password=foo/grantor extra',
        'password=foo',
        'token/grantor',
        'password = foo/grantor',
        ' password=foo/grantor',
      ]) {
        expectCode(
          () => parsePost(postflightWith('functions', 'acl', [malformed])),
          'credential_shaped_value',
        )
      }
    })

    it('rejects a credential shape inside an ACL array, which has no position allowance', () => {
      expectCode(
        () => parsePost(postflightWith('functions', 'acl', ['sb_secret_planted'])),
        'credential_shaped_value',
      )
    })

    it('rejects the literal service_role outside a role position', () => {
      expectCode(
        () => parsePost(postflightWith('relations', 'owner', 'service_role')),
        'credential_shaped_value',
      )
      expectCode(
        () => parsePost(postflightWith('defaultPrivileges', 'owner', 'service_role')),
        'credential_shaped_value',
      )
    })

    it('accepts the literal service_role in every real role position', () => {
      for (const section of ['tablePrivileges', 'schemaPrivileges', 'roleAttributes'] as const) {
        expect(() => parsePost(postflightWith(section, 'role', 'service_role'))).not.toThrow()
      }
      expect(() =>
        parsePost(
          validPostflight({
            prerequisites: {
              availableExtensions: ['pg_trgm'],
              roles: ['anon', 'authenticated', 'service_role'],
              schemas: ['extensions', 'public'],
            },
          }),
        ),
      ).not.toThrow()
    })

    it('rejects a serviceRoleExecute key outside a functions row', () => {
      expectCode(
        () => assertDecodedEvidenceCarriesNoSecret({ serviceRoleExecute: true }),
        'credential_shaped_value',
      )
      expectCode(
        () =>
          assertDecodedEvidenceCarriesNoSecret(
            { serviceRoleExecute: true },
            '$.catalog.relations[0]',
          ),
        'credential_shaped_value',
      )
    })

    it.each([
      ['mixed case', 'PassWord=Foo/Grantor'],
      ['escaped', '\\u0070assword=foo/grantor'],
    ])('rejects the %s variant in a non-ACL position', (_label, value) => {
      const raw = JSON.stringify(postflightWith('relations', 'owner', 'PLACEHOLDER')).replace(
        '"PLACEHOLDER"',
        `"${value}"`,
      )
      expectCode(() => parseLiteraturePostflightEvidence(raw), 'credential_shaped_value')
    })

    it('accepts a nested-array escaped ACL entry in the real ACL position', () => {
      const raw = JSON.stringify(postflightWith('functions', 'acl', ['PLACEHOLDER'])).replace(
        '"PLACEHOLDER"',
        '"\\u0070assword=foo/grantor"',
      )
      expect(() => parseLiteraturePostflightEvidence(raw)).not.toThrow()
    })

    it('derives the allowed ACL and role positions from the row schemas themselves', () => {
      const fieldsOf = (section: LiteratureCatalogSection) =>
        Object.keys(
          (LITERATURE_CATALOG_ROW_SCHEMAS[section] as unknown as { shape: Record<string, unknown> })
            .shape,
        )

      expect(LITERATURE_CATALOG_SECTIONS.filter((s) => fieldsOf(s).includes('acl')).sort()).toEqual(
        [...LITERATURE_ACL_BEARING_CATALOG_SECTIONS].sort(),
      )
      expect(
        LITERATURE_CATALOG_SECTIONS.filter((s) => fieldsOf(s).includes('role')).sort(),
      ).toEqual([...LITERATURE_ROLE_BEARING_CATALOG_SECTIONS].sort())
    })
  })

  it('does not false-positive on ordinary catalog content', () => {
    expect(() => parsePost(validPostflight())).not.toThrow()
  })
})
