/** @jest-environment node */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  LITERATURE_APPROVED_APPLICATION_MECHANISM,
  LITERATURE_DEDICATED_TARGET,
  LITERATURE_FOUNDATION_MIGRATION,
} from '../../src/features/literature/dedicated-supabase/foundation-manifest'
import {
  PROTECTED_REAL_LOCAL_CONTAINER,
  PROTECTED_REAL_LOCAL_DATABASE_PORT,
  assertLocalDockerEndpoint,
  assertNotProtectedResource,
  rehearsalResourceName,
  sanitizeRehearsalChildEnvironment,
} from './lib/disposable-target'
import { LITERATURE_CATALOG_SECTIONS } from './lib/foundation-catalog'
import {
  allChecksPassed,
  evaluateEvidenceContentPreflight,
  evaluateRepositoryPreflight,
  resolvePreflightOutcome,
  type PreflightCheck,
  type RepositoryFacts,
} from './lib/preflight-rules'
import {
  LITERATURE_POSTFLIGHT_EXISTENCE_PROBE_PLAN,
  LITERATURE_POSTFLIGHT_EXISTENCE_PROBE_SHA256,
  LITERATURE_POSTFLIGHT_QUERY_PLAN,
  LITERATURE_POSTFLIGHT_QUERY_PLAN_SHA256,
  LITERATURE_PREFLIGHT_QUERY_PLAN,
  LITERATURE_PREFLIGHT_QUERY_PLAN_SHA256,
  renderLiteratureQueryPlans,
  type LiteratureQueryPlan,
} from './lib/target-observation'
import type { LiteraturePreflightEvidenceDocument } from './lib/evidence-schema'

const ROOT = process.cwd()
const HEAD = 'a'.repeat(40)

function repositoryFacts(overrides: Partial<RepositoryFacts> = {}): RepositoryFacts {
  return {
    checkoutPath: '/Users/example/Projects/Interventional-Pulm-Education-Project',
    isPrimaryCheckout: true,
    branch: 'main',
    headCommit: HEAD,
    originMainCommit: HEAD,
    workingTreeClean: true,
    ownerApprovedCommit: HEAD,
    migrationSha256: LITERATURE_FOUNDATION_MIGRATION.sha256,
    migrationByteLength: LITERATURE_FOUNDATION_MIGRATION.byteLength,
    selectedMigrationPaths: [LITERATURE_FOUNDATION_MIGRATION.path],
    applicationMechanism: LITERATURE_APPROVED_APPLICATION_MECHANISM,
    ...overrides,
  }
}

type Catalog = LiteraturePreflightEvidenceDocument['catalog']

// The three API roles a representative target always has; the scoped prerequisite checks (E08)
// read these from the catalog itself.
const ROLE_ATTRIBUTE_ROWS = [
  { role: 'anon', superuser: false, bypassRls: false, canLogin: false, inherit: false },
  { role: 'authenticated', superuser: false, bypassRls: false, canLogin: false, inherit: false },
  { role: 'service_role', superuser: false, bypassRls: true, canLogin: false, inherit: false },
]

function emptyCatalog(): Catalog {
  return {
    ...(Object.fromEntries(
      LITERATURE_CATALOG_SECTIONS.map((section) => [section, []]),
    ) as unknown as Catalog),
    roleAttributes: ROLE_ATTRIBUTE_ROWS,
  } as Catalog
}

function evidence(
  overrides: Partial<LiteraturePreflightEvidenceDocument> = {},
): LiteraturePreflightEvidenceDocument {
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

function withCatalog(section: keyof Catalog, rows: Record<string, unknown>[]) {
  return evidence({
    catalog: { ...emptyCatalog(), [section]: rows } as unknown as Catalog,
  })
}

function failedIds(checks: readonly PreflightCheck[]) {
  return checks.filter((entry) => !entry.passed).map((entry) => entry.id)
}

describe('repository preflight (Layer 1)', () => {
  it('approves a clean primary checkout at the exact approved commit', () => {
    const checks = evaluateRepositoryPreflight(repositoryFacts())
    expect(failedIds(checks)).toEqual([])
    expect(allChecksPassed(checks)).toBe(true)
  })

  it('blocks a linked worktree, a non-main branch, and a dirty tree', () => {
    expect(
      failedIds(evaluateRepositoryPreflight(repositoryFacts({ isPrimaryCheckout: false }))),
    ).toContain('P01-primary-checkout')
    expect(
      failedIds(evaluateRepositoryPreflight(repositoryFacts({ branch: 'claude/anything' }))),
    ).toContain('P02-main-branch')
    expect(
      failedIds(evaluateRepositoryPreflight(repositoryFacts({ workingTreeClean: false }))),
    ).toContain('P03-clean-worktree')
  })

  describe('exact approved commit (H-4)', () => {
    it('passes only when HEAD == origin/main == approved', () => {
      expect(failedIds(evaluateRepositoryPreflight(repositoryFacts()))).not.toContain(
        'P04-exact-approved-commit',
      )
    })

    it('rejects a descendant of the approved commit', () => {
      // The review defeated the old rule by advancing main past the reviewed commit.
      const descendant = 'b'.repeat(40)
      expect(
        failedIds(
          evaluateRepositoryPreflight(
            repositoryFacts({
              headCommit: descendant,
              originMainCommit: descendant,
              ownerApprovedCommit: HEAD,
            }),
          ),
        ),
      ).toContain('P04-exact-approved-commit')
    })

    it('rejects HEAD behind origin/main', () => {
      expect(
        failedIds(
          evaluateRepositoryPreflight(repositoryFacts({ originMainCommit: 'c'.repeat(40) })),
        ),
      ).toContain('P04-exact-approved-commit')
    })

    it('rejects a missing approved commit', () => {
      expect(
        failedIds(evaluateRepositoryPreflight(repositoryFacts({ ownerApprovedCommit: undefined }))),
      ).toContain('P04-exact-approved-commit')
    })
  })

  it('blocks drift, zero selections, deferred and unrelated migrations', () => {
    expect(
      failedIds(evaluateRepositoryPreflight(repositoryFacts({ migrationSha256: 'a'.repeat(64) }))),
    ).toEqual(expect.arrayContaining(['P05-migration-checksum', 'P11-manifest-approves-selection']))
    expect(
      failedIds(evaluateRepositoryPreflight(repositoryFacts({ selectedMigrationPaths: [] }))),
    ).toContain('P06-exactly-one-migration')
    expect(
      failedIds(
        evaluateRepositoryPreflight(
          repositoryFacts({
            selectedMigrationPaths: [
              'supabase/migrations/20260809231651_add_literature_gold_import_compensation_contract_v2.sql',
            ],
          }),
        ),
      ),
    ).toEqual(
      expect.arrayContaining(['P07-migration-path', 'P08-no-deferred-literature-migration']),
    )
    expect(
      failedIds(
        evaluateRepositoryPreflight(
          repositoryFacts({
            selectedMigrationPaths: [
              'supabase/migrations/20260605041809_add_main_site_auth_usage.sql',
            ],
          }),
        ),
      ),
    ).toContain('P09-no-unrelated-migration')
  })

  describe('application mechanism (H-5)', () => {
    it('blocks an omitted mechanism', () => {
      expect(
        failedIds(
          evaluateRepositoryPreflight(repositoryFacts({ applicationMechanism: undefined })),
        ),
      ).toContain('P10-application-mechanism')
    })

    it.each([
      'supabase db push',
      'npx supabase db push',
      'supabase db push --linked',
      "bash -lc 'supabase db push'",
      'supabase migration repair',
      'anything at all',
      '',
    ])('blocks mechanism %s', (mechanism) => {
      expect(
        failedIds(
          evaluateRepositoryPreflight(repositoryFacts({ applicationMechanism: mechanism })),
        ),
      ).toContain('P10-application-mechanism')
    })

    it.each([
      ['null', null],
      ['an array', [LITERATURE_APPROVED_APPLICATION_MECHANISM]],
      ['an object', { mechanism: LITERATURE_APPROVED_APPLICATION_MECHANISM }],
      ['a number', 42],
      ['a boolean', true],
    ])(
      'blocks a %s mechanism with a controlled failure, never a TypeError (H-5)',
      (_label, value) => {
        const checks = evaluateRepositoryPreflight(repositoryFacts({ applicationMechanism: value }))
        expect(failedIds(checks)).toEqual(
          expect.arrayContaining(['P10-application-mechanism', 'P11-manifest-approves-selection']),
        )
      },
    )
  })
})

describe('evidence content preflight (Layer 2, non-authoritative)', () => {
  it('passes a clean empty catalog with an absent history table', () => {
    expect(failedIds(evaluateEvidenceContentPreflight(evidence()))).toEqual([])
  })

  it('passes a present-but-empty history table', () => {
    expect(
      failedIds(
        evaluateEvidenceContentPreflight(
          evidence({ migrationHistory: { tableExists: true, versions: [] } }),
        ),
      ),
    ).toEqual([])
  })

  it('fails closed when no evidence was supplied', () => {
    const checks = evaluateEvidenceContentPreflight(null)
    expect(allChecksPassed(checks)).toBe(false)
    expect(failedIds(checks)).toContain('E00-evidence-present')
  })

  it('blocks an already-populated migration history', () => {
    expect(
      failedIds(
        evaluateEvidenceContentPreflight(
          evidence({ migrationHistory: { tableExists: true, versions: ['20260727032621'] } }),
        ),
      ),
    ).toContain('E01-empty-migration-history')
  })

  describe('same-name collision detection (H-2)', () => {
    it('detects a VIEW occupying a Literature table name', () => {
      // The exact reproduction: public.literature_journals as a view previously passed preflight
      // and then broke the migration.
      const checks = evaluateEvidenceContentPreflight(
        withCatalog('relations', [{ name: 'literature_journals', relkind: 'v' }]),
      )
      expect(failedIds(checks)).toContain('E05-no-name-collision')
      const collision = checks.find((entry) => entry.id === 'E05-no-name-collision')
      expect(collision?.detail).toMatch(/view literature_journals/u)
    })

    it.each([
      ['materialized view', 'm'],
      ['partitioned table', 'p'],
      ['foreign table', 'f'],
      ['sequence', 'S'],
      ['table', 'r'],
    ])('detects a %s occupying a Literature table name', (_label, relkind) => {
      expect(
        failedIds(
          evaluateEvidenceContentPreflight(
            withCatalog('relations', [{ name: 'literature_articles', relkind }]),
          ),
        ),
      ).toContain('E05-no-name-collision')
    })

    it('detects a composite/enum/domain type collision', () => {
      expect(
        failedIds(
          evaluateEvidenceContentPreflight(
            withCatalog('types', [{ name: 'literature_topics', typtype: 'e' }]),
          ),
        ),
      ).toContain('E05-no-name-collision')
    })

    it('detects a same-name function that CREATE OR REPLACE could overwrite', () => {
      expect(
        failedIds(
          evaluateEvidenceContentPreflight(
            withCatalog('functions', [{ name: 'search_literature_v1' }]),
          ),
        ),
      ).toEqual(expect.arrayContaining(['E03-no-literature-functions', 'E05-no-name-collision']))
    })

    it('detects an index name collision on a Literature table', () => {
      expect(
        failedIds(
          evaluateEvidenceContentPreflight(
            withCatalog('indexes', [{ name: 'literature_articles_pkey' }]),
          ),
        ),
      ).toContain('E05-no-name-collision')
    })

    it('detects an expected index name occupied by an index on an UNRELATED table (H-2)', () => {
      // The exact reproduction: literature_articles_search_vector_idx on some unrelated table.
      // The old query scoped index observation through Literature tables and missed it; the
      // indexNames section observes every public index relation name independently.
      const checks = evaluateEvidenceContentPreflight(
        withCatalog('indexNames', [
          { schema: 'public', name: 'literature_articles_search_vector_idx' },
        ]),
      )
      expect(failedIds(checks)).toContain('E05-no-name-collision')
      const collision = checks.find((entry) => entry.id === 'E05-no-name-collision')
      expect(collision?.detail).toMatch(/literature_articles_search_vector_idx/u)
      expect(collision?.detail).toMatch(/owning table irrelevant/u)
    })

    it('does not flag unrelated index names', () => {
      expect(
        failedIds(
          evaluateEvidenceContentPreflight(
            withCatalog('indexNames', [{ schema: 'public', name: 'unrelated_notes_idx' }]),
          ),
        ),
      ).toEqual([])
    })
  })

  describe('pg_trgm location (H-2)', () => {
    it('permits pg_trgm absent', () => {
      expect(failedIds(evaluateEvidenceContentPreflight(evidence()))).toEqual([])
    })

    it('permits pg_trgm installed in the extensions schema', () => {
      expect(
        failedIds(
          evaluateEvidenceContentPreflight(
            withCatalog('extensions', [{ name: 'pg_trgm', schema: 'extensions', version: '1.6' }]),
          ),
        ),
      ).toEqual([])
    })

    it('rejects pg_trgm installed anywhere else', () => {
      // CREATE EXTENSION IF NOT EXISTS ... WITH SCHEMA extensions does not relocate an existing
      // installation, and extensions.gin_trgm_ops would then fail mid-migration.
      const checks = evaluateEvidenceContentPreflight(
        withCatalog('extensions', [{ name: 'pg_trgm', schema: 'public', version: '1.6' }]),
      )
      expect(failedIds(checks)).toContain('E08-Q01-pg-trgm-location')
      const detail = checks.find((entry) => entry.id === 'E08-Q01-pg-trgm-location')?.detail
      expect(detail).toMatch(/cannot relocate/u)
    })
  })

  it('blocks a partial Literature schema', () => {
    expect(
      failedIds(
        evaluateEvidenceContentPreflight(
          withCatalog('relations', [
            { name: 'literature_articles', relkind: 'r' },
            { name: 'literature_topics', relkind: 'r' },
          ]),
        ),
      ),
    ).toContain('E06-no-partial-schema')
  })

  it('blocks missing prerequisites', () => {
    expect(
      failedIds(
        evaluateEvidenceContentPreflight(
          evidence({
            prerequisites: { availableExtensions: [], roles: [], schemas: ['public'] },
          }),
        ),
      ),
    ).toContain('E07-prerequisites-available')
  })

  it('blocks missing or tampered API roles via the scoped role checks (H-1)', () => {
    expect(failedIds(evaluateEvidenceContentPreflight(withCatalog('roleAttributes', [])))).toEqual(
      expect.arrayContaining(['E08-Q02-api-roles-exist']),
    )
    expect(
      failedIds(
        evaluateEvidenceContentPreflight(
          withCatalog(
            'roleAttributes',
            ROLE_ATTRIBUTE_ROWS.map((row) =>
              row.role === 'service_role' ? { ...row, bypassRls: false } : row,
            ),
          ),
        ),
      ),
    ).toContain('E08-Q04-rls-bypass-shape')
  })

  it('blocks evidence produced by a different query plan (L-1)', () => {
    expect(
      failedIds(
        evaluateEvidenceContentPreflight(
          evidence({ queryPlanSha256: LITERATURE_POSTFLIGHT_QUERY_PLAN_SHA256 }),
        ),
      ),
    ).toContain('E09-preflight-plan-identity')
  })
})

describe('preflight outcome has no success verdict (B-1/M-3)', () => {
  const passing = [{ id: 'x', description: 'x', passed: true, detail: '' }]
  const failing = [{ id: 'y', description: 'y', passed: false, detail: '' }]

  it('blocks on a repository failure', () => {
    const outcome = resolvePreflightOutcome({ repositoryChecks: failing, evidenceChecks: passing })
    expect(outcome.verdict).toBe('blocked')
    expect(outcome.layerSummaries).toContain('repository_checks_failed')
  })

  it('blocks on an evidence-content failure', () => {
    const outcome = resolvePreflightOutcome({ repositoryChecks: passing, evidenceChecks: failing })
    expect(outcome.verdict).toBe('blocked')
    expect(outcome.layerSummaries).toContain('content_checks_failed')
  })

  it('resolves to provider_attestation_required when both layers pass', () => {
    const outcome = resolvePreflightOutcome({ repositoryChecks: passing, evidenceChecks: passing })
    expect(outcome.verdict).toBe('provider_attestation_required')
    expect(outcome.layerSummaries).toEqual([
      'repository_checks_passed_nonauthoritative',
      'content_checks_passed_nonauthoritative',
    ])
    expect(outcome.summary).toMatch(/NON-AUTHORITATIVE/u)
  })

  it('cannot be moved past provider_attestation_required by attestation-shaped extras', () => {
    // The prior design accepted an attestation status string here; a forged 'attested' then
    // produced ready_to_apply. The input type no longer has such a field, and smuggling one in
    // through a cast changes nothing.
    const outcome = resolvePreflightOutcome({
      repositoryChecks: passing,
      evidenceChecks: passing,
      attestationStatus: 'attested',
      attestation: { status: 'attested' },
      authoritative: true,
    } as never)
    expect(outcome.verdict).toBe('provider_attestation_required')
    expect(JSON.stringify(outcome)).not.toContain('ready_to_apply')
    expect(JSON.stringify(outcome)).not.toContain('"authoritative":true')
  })

  it('exposes only blocked and provider_attestation_required as reachable verdicts', () => {
    for (const [repositoryChecks, evidenceChecks] of [
      [passing, passing],
      [passing, failing],
      [failing, passing],
      [failing, failing],
    ] as const) {
      const outcome = resolvePreflightOutcome({ repositoryChecks, evidenceChecks })
      expect(['blocked', 'provider_attestation_required']).toContain(outcome.verdict)
    }
  })
})

describe('phase-specific query plans (L-1)', () => {
  const plans: readonly [string, LiteratureQueryPlan, string][] = [
    ['preflight', LITERATURE_PREFLIGHT_QUERY_PLAN, LITERATURE_PREFLIGHT_QUERY_PLAN_SHA256],
    [
      'postflight existence probe',
      LITERATURE_POSTFLIGHT_EXISTENCE_PROBE_PLAN,
      LITERATURE_POSTFLIGHT_EXISTENCE_PROBE_SHA256,
    ],
    [
      'postflight complete',
      LITERATURE_POSTFLIGHT_QUERY_PLAN,
      LITERATURE_POSTFLIGHT_QUERY_PLAN_SHA256,
    ],
  ]

  it('binds three distinct plan identities that cannot be substituted', () => {
    const identities = plans.map(([, , identity]) => identity)
    expect(new Set(identities).size).toBe(3)
    for (const identity of identities) expect(identity).toMatch(/^[a-f0-9]{64}$/u)
  })

  it('no preflight statement references an optional relation unconditionally', () => {
    for (const step of LITERATURE_PREFLIGHT_QUERY_PLAN.steps) {
      if (step.conditionalOnProbe) continue
      expect(step.statement).not.toMatch(/from\s+supabase_migrations\.schema_migrations/iu)
      expect(step.statement).not.toMatch(/from\s+public\.literature/iu)
    }
  })

  it('the preflight versions statement is conditional on the existence probe', () => {
    const versions = LITERATURE_PREFLIGHT_QUERY_PLAN.steps.find(
      (step) => step.id === 'historyVersions',
    )
    expect(versions?.conditionalOnProbe).toBe('historyTableExists')
  })

  it('the preflight plan has no row-count step at all', () => {
    expect(LITERATURE_PREFLIGHT_QUERY_PLAN.steps.some((step) => step.id === 'totalRowCount')).toBe(
      false,
    )
  })

  it('the postflight existence probe is pg_catalog-only', () => {
    for (const step of LITERATURE_POSTFLIGHT_EXISTENCE_PROBE_PLAN.steps) {
      expect(step.conditionalOnProbe).toBeUndefined()
      expect(step.statement).not.toMatch(/from\s+supabase_migrations\.schema_migrations/iu)
      expect(step.statement).not.toMatch(/from\s+public\.literature/iu)
    }
  })

  it('the postflight row count and history dump are conditional on the probe', () => {
    const rowCount = LITERATURE_POSTFLIGHT_QUERY_PLAN.steps.find(
      (step) => step.id === 'totalRowCount',
    )
    const versions = LITERATURE_POSTFLIGHT_QUERY_PLAN.steps.find(
      (step) => step.id === 'historyVersions',
    )
    expect(rowCount?.conditionalOnProbe).toBe('presentLiteratureTables')
    expect(versions?.conditionalOnProbe).toBe('historyTableExists')
  })

  it('emits read-only statements only', () => {
    for (const [, plan] of plans) {
      for (const step of plan.steps) {
        expect(step.statement).toMatch(/^begin read only;/u)
        expect(step.statement).toMatch(/set transaction read only;/u)
        expect(step.statement).toMatch(/rollback;$/u)

        // Privilege names such as 'INSERT' appear legitimately as quoted literals in the probe
        // arrays, so string literals are stripped before looking for an actual DML or DDL
        // keyword.
        const withoutLiterals = step.statement.replaceAll(/'[^']*'/gu, "''")
        expect(withoutLiterals).not.toMatch(
          /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate)\b/iu,
        )
        const verbs = withoutLiterals
          .split(';')
          .map((part) => part.trim())
          .filter((part) => part.length > 0)
          .map((part) => part.split(/\s+/u)[0].toLowerCase())
        expect(verbs.every((verb) => ['begin', 'set', 'select', 'rollback'].includes(verb))).toBe(
          true,
        )
      }
    }
  })

  it('prints every plan identity and the no-authorization warning', () => {
    const rendered = renderLiteratureQueryPlans()
    for (const [, , identity] of plans) expect(rendered).toContain(identity)
    expect(rendered).toMatch(/can never authorize a\s+-- migration/u)
    expect(rendered).toMatch(/list_migrations/u)
  })
})

describe('disposable rehearsal safety guards', () => {
  it('refuses the protected real-local container and port by name', () => {
    expect(() => assertNotProtectedResource(PROTECTED_REAL_LOCAL_CONTAINER)).toThrow(/protected/u)
    expect(() => assertNotProtectedResource('anything-ip-literature-local')).toThrow(/protected/u)
    expect(() =>
      assertNotProtectedResource(`target-${PROTECTED_REAL_LOCAL_DATABASE_PORT}`),
    ).toThrow(/protected database port/u)
  })

  it('generates unique operation-owned resource names', () => {
    const first = rehearsalResourceName('target')
    expect(first).not.toBe(rehearsalResourceName('target'))
    expect(first).toMatch(/^literature-dedicated-bootstrap-target-\d+-[a-f0-9]{8}$/u)
  })

  it('requires a local Docker socket', () => {
    expect(assertLocalDockerEndpoint('unix:///var/run/docker.sock')).toBe('unix-domain-socket')
    expect(() => assertLocalDockerEndpoint('tcp://10.0.0.5:2375')).toThrow(/local Docker socket/u)
    expect(() => assertLocalDockerEndpoint('')).toThrow(/local Docker socket/u)
  })

  it('strips every credential-bearing variable from rehearsal child processes', () => {
    const sanitized = sanitizeRehearsalChildEnvironment({
      PATH: '/usr/bin',
      LITERATURE_SUPABASE_URL: 'https://example.supabase.co',
      LITERATURE_SUPABASE_SECRET_KEY: 'placeholder',
      LITERATURE_SUPABASE_SERVICE_ROLE_KEY: 'legacy',
      SUPABASE_SERVICE_ROLE_KEY: 'main',
      PGPASSWORD: 'nope',
      POSTGRES_PASSWORD: 'nope',
      DATABASE_URL: 'postgres://nope',
      DOCKER_HOST: 'tcp://elsewhere',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    })
    expect(sanitized.PATH).toBe('/usr/bin')
    for (const key of [
      'LITERATURE_SUPABASE_URL',
      'LITERATURE_SUPABASE_SECRET_KEY',
      'LITERATURE_SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'PGPASSWORD',
      'POSTGRES_PASSWORD',
      'DATABASE_URL',
      'DOCKER_HOST',
      'NEXT_PUBLIC_SUPABASE_URL',
    ]) {
      expect(sanitized[key]).toBeUndefined()
    }
  })

  it('the rehearsal never publishes a port and cleans up by exact name', async () => {
    const source = await readFile(
      resolve(ROOT, 'scripts/literature-dedicated-supabase/rehearse-foundation.ts'),
      'utf8',
    )
    expect(source).not.toMatch(/'--publish'|"-p"|'-p'/u)
    expect(source).toMatch(/removeContainerByExactName/u)
    expect(source).not.toMatch(/docker.*prune|--filter.*name=literature-dedicated-bootstrap\*/u)
  })

  it('the rehearsal labels its migration-history recording as modeled, not proven', async () => {
    const source = await readFile(
      resolve(ROOT, 'scripts/literature-dedicated-supabase/rehearse-foundation.ts'),
      'utf8',
    )
    expect(source).toMatch(/MODELED, not proven/u)
    expect(source).toMatch(/Modeled locally/u)
  })
})

describe('capability boundaries', () => {
  it('the target is the approved dedicated project', () => {
    expect(LITERATURE_DEDICATED_TARGET.projectRef).toBe('itcttmkxdxvwmwcmzmey')
  })

  it('no dedicated-supabase module can apply, repair, or reach a protected operation', async () => {
    for (const file of [
      'scripts/literature-dedicated-supabase/preflight.ts',
      'scripts/literature-dedicated-supabase/postflight.ts',
      'scripts/literature-dedicated-supabase/lib/reconciliation.ts',
      'scripts/literature-dedicated-supabase/lib/preflight-rules.ts',
      'scripts/literature-dedicated-supabase/lib/foundation-catalog.ts',
      'scripts/literature-dedicated-supabase/lib/target-observation.ts',
      'scripts/literature-dedicated-supabase/lib/evidence-schema.ts',
    ]) {
      const source = await readFile(resolve(ROOT, file), 'utf8')
      expect(source).not.toMatch(
        /apply_literature_gold_import_v2|compensate_literature_gold_import/u,
      )
      expect(source).not.toMatch(/generate-gold-import-compensation-package/u)
      expect(source).not.toMatch(/held[-_]?out/iu)

      // No module may *invoke* the Supabase CLI. Prose that forbids `migration repair` is
      // desirable, so the check targets invocation shapes rather than the phrase itself.
      expect(source).not.toMatch(/runCommand\(\s*['"]supabase['"]/u)
      expect(source).not.toMatch(/spawn\(\s*['"]supabase['"]/u)
      expect(source).not.toMatch(/execFile\w*\(\s*['"]supabase['"]/u)
    }
  })
})
