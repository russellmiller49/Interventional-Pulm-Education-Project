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
  LITERATURE_QUERY_BUNDLE_SHA256,
  LITERATURE_READ_ONLY_QUERY_BUNDLE,
  renderLiteratureQueryBundle,
} from './lib/target-observation'
import type { LiteratureEvidenceDocument } from './lib/evidence-schema'

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

function emptyCatalog() {
  return Object.fromEntries(
    LITERATURE_CATALOG_SECTIONS.map((section) => [section, []]),
  ) as unknown as LiteratureEvidenceDocument['catalog']
}

function evidence(overrides: Partial<LiteratureEvidenceDocument> = {}): LiteratureEvidenceDocument {
  return {
    schemaVersion: 'literature-dedicated-observation/2.0.0',
    queryBundleSha256: LITERATURE_QUERY_BUNDLE_SHA256,
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

function withCatalog(section: string, rows: Record<string, unknown>[]) {
  return evidence({
    catalog: { ...emptyCatalog(), [section]: rows } as LiteratureEvidenceDocument['catalog'],
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
    ])('blocks mechanism %s', (mechanism) => {
      expect(
        failedIds(
          evaluateRepositoryPreflight(repositoryFacts({ applicationMechanism: mechanism })),
        ),
      ).toContain('P10-application-mechanism')
    })
  })
})

describe('evidence content preflight (Layer 2, non-authoritative)', () => {
  it('passes a clean empty catalog', () => {
    expect(failedIds(evaluateEvidenceContentPreflight(evidence()))).toEqual([])
  })

  it('fails closed when no evidence was supplied', () => {
    const checks = evaluateEvidenceContentPreflight(null)
    expect(allChecksPassed(checks)).toBe(false)
    expect(failedIds(checks)).toContain('E00-evidence-present')
  })

  it('blocks an already-populated migration history', () => {
    expect(
      failedIds(
        evaluateEvidenceContentPreflight(evidence({ migrationVersions: ['20260727032621'] })),
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

    it('detects an unexpected index name collision', () => {
      expect(
        failedIds(
          evaluateEvidenceContentPreflight(
            withCatalog('indexes', [{ name: 'literature_articles_pkey' }]),
          ),
        ),
      ).toContain('E05-no-name-collision')
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
})

describe('preflight outcome layering (B-1)', () => {
  const passing = [{ id: 'x', description: 'x', passed: true, detail: '' }]
  const failing = [{ id: 'y', description: 'y', passed: false, detail: '' }]

  it('blocks on a repository failure', () => {
    expect(
      resolvePreflightOutcome({
        repositoryChecks: failing,
        evidenceChecks: passing,
        attestationStatus: 'attested',
        attestationDetail: '',
      }).verdict,
    ).toBe('blocked')
  })

  it('blocks on an evidence-content failure', () => {
    expect(
      resolvePreflightOutcome({
        repositoryChecks: passing,
        evidenceChecks: failing,
        attestationStatus: 'attested',
        attestationDetail: '',
      }).verdict,
    ).toBe('blocked')
  })

  it('never reaches ready_to_apply without provider attestation, however good the evidence is', () => {
    const outcome = resolvePreflightOutcome({
      repositoryChecks: passing,
      evidenceChecks: passing,
      attestationStatus: 'rejected',
      attestationDetail: 'adapter not implemented',
    })
    expect(outcome.verdict).toBe('provider_attestation_required')
    expect(outcome.authoritative).toBe(false)
    expect(outcome.summary).toMatch(/NON-AUTHORITATIVE/u)
  })

  it('reaches ready_to_apply only with all three layers', () => {
    expect(
      resolvePreflightOutcome({
        repositoryChecks: passing,
        evidenceChecks: passing,
        attestationStatus: 'attested',
        attestationDetail: '',
      }),
    ).toMatchObject({ verdict: 'ready_to_apply', authoritative: true })
  })
})

describe('read-only query bundle (L-1)', () => {
  it('includes every statement the evidence schema needs, including the row count', () => {
    const ids = LITERATURE_READ_ONLY_QUERY_BUNDLE.map((entry) => entry.id)
    expect(ids).toEqual(['migrationVersions', 'catalog', 'prerequisites', 'totalRowCount'])
  })

  it('marks the row count as post-application only', () => {
    const rowCount = LITERATURE_READ_ONLY_QUERY_BUNDLE.find((entry) => entry.id === 'totalRowCount')
    expect(rowCount?.postApplicationOnly).toBe(true)
  })

  it('binds a stable bundle identity and prints it', () => {
    expect(LITERATURE_QUERY_BUNDLE_SHA256).toMatch(/^[a-f0-9]{64}$/u)
    expect(renderLiteratureQueryBundle()).toContain(LITERATURE_QUERY_BUNDLE_SHA256)
  })

  it('emits read-only statements only', () => {
    for (const entry of LITERATURE_READ_ONLY_QUERY_BUNDLE) {
      expect(entry.statement).toMatch(/^begin read only;/u)
      expect(entry.statement).toMatch(/set transaction read only;/u)
      expect(entry.statement).toMatch(/rollback;$/u)

      // Privilege names such as 'INSERT' appear legitimately as quoted literals in the probe
      // arrays, so string literals are stripped before looking for an actual DML or DDL keyword.
      const withoutLiterals = entry.statement.replaceAll(/'[^']*'/gu, "''")
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
  })

  it('tells the operator that hand-assembled evidence cannot authorize anything', () => {
    expect(renderLiteratureQueryBundle()).toMatch(/can never authorize a\s+-- migration/u)
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
