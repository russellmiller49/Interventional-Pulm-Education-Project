/** @jest-environment node */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  LITERATURE_FOUNDATION_MIGRATION,
  LITERATURE_DEDICATED_TARGET,
} from '../../src/features/literature/dedicated-supabase/foundation-manifest'
import {
  PROTECTED_REAL_LOCAL_CONTAINER,
  PROTECTED_REAL_LOCAL_DATABASE_PORT,
  assertLocalDockerEndpoint,
  assertNotProtectedResource,
  rehearsalResourceName,
  sanitizeRehearsalChildEnvironment,
} from './lib/disposable-target'
import {
  evaluateRepositoryPreflight,
  evaluateTargetPreflight,
  preflightApproved,
  type RepositoryFacts,
} from './lib/preflight-rules'
import {
  LITERATURE_READ_ONLY_CATALOG_STATEMENT,
  LITERATURE_READ_ONLY_HISTORY_STATEMENT,
  assertObservationCarriesNoSecret,
  parseTargetObservation,
  type LiteratureTargetObservation,
} from './lib/target-observation'

const ROOT = process.cwd()
const APPROVED_REF = LITERATURE_DEDICATED_TARGET.projectRef
const HEAD = 'a'.repeat(40)

function repositoryFacts(overrides: Partial<RepositoryFacts> = {}): RepositoryFacts {
  return {
    checkoutPath: '/Users/example/Projects/Interventional-Pulm-Education-Project',
    isPrimaryCheckout: true,
    branch: 'main',
    headCommit: HEAD,
    originMainCommit: HEAD,
    workingTreeClean: true,
    approvedCommit: HEAD,
    headDescendsFromApprovedCommit: true,
    migrationSha256: LITERATURE_FOUNDATION_MIGRATION.sha256,
    migrationByteLength: LITERATURE_FOUNDATION_MIGRATION.byteLength,
    selectedMigrationPaths: [LITERATURE_FOUNDATION_MIGRATION.path],
    ...overrides,
  }
}

function emptyObservation(
  overrides: Partial<LiteratureTargetObservation> = {},
): LiteratureTargetObservation {
  return {
    projectRef: APPROVED_REF,
    hostname: `db.${APPROVED_REF}.supabase.co`,
    migrationVersions: [],
    catalog: {
      extensions: [],
      tables: [],
      policies: [],
      functions: [],
      triggers: [],
      indexes: [],
      tablePrivileges: [],
    },
    prerequisites: {
      availableExtensions: ['pg_trgm'],
      roles: ['anon', 'authenticated', 'service_role'],
      schemas: ['extensions', 'public'],
    },
    ...overrides,
  }
}

function failedIds(checks: ReturnType<typeof evaluateRepositoryPreflight>) {
  return checks.filter((entry) => !entry.passed).map((entry) => entry.id)
}

describe('repository preflight rules', () => {
  it('approves a clean primary checkout at the approved commit', () => {
    const checks = evaluateRepositoryPreflight(repositoryFacts())
    expect(failedIds(checks)).toEqual([])
    expect(preflightApproved(checks)).toBe(true)
  })

  it('blocks a linked worktree', () => {
    expect(
      failedIds(evaluateRepositoryPreflight(repositoryFacts({ isPrimaryCheckout: false }))),
    ).toContain('P01-primary-checkout')
  })

  it('blocks a branch other than main', () => {
    expect(
      failedIds(evaluateRepositoryPreflight(repositoryFacts({ branch: 'claude/anything' }))),
    ).toContain('P02-main-branch')
  })

  it('blocks a dirty working tree', () => {
    expect(
      failedIds(evaluateRepositoryPreflight(repositoryFacts({ workingTreeClean: false }))),
    ).toContain('P03-clean-worktree')
  })

  it('blocks when HEAD is behind origin/main', () => {
    expect(
      failedIds(evaluateRepositoryPreflight(repositoryFacts({ originMainCommit: 'b'.repeat(40) }))),
    ).toContain('P04-head-matches-origin-main')
  })

  it('blocks when no approved commit was supplied', () => {
    expect(
      failedIds(
        evaluateRepositoryPreflight(
          repositoryFacts({ approvedCommit: undefined, headDescendsFromApprovedCommit: undefined }),
        ),
      ),
    ).toContain('P05-approved-commit')
  })

  it('blocks when HEAD does not descend from the approved commit', () => {
    expect(
      failedIds(
        evaluateRepositoryPreflight(repositoryFacts({ headDescendsFromApprovedCommit: false })),
      ),
    ).toContain('P05-approved-commit')
  })

  it('blocks a drifted migration', () => {
    expect(
      failedIds(evaluateRepositoryPreflight(repositoryFacts({ migrationSha256: 'a'.repeat(64) }))),
    ).toEqual(expect.arrayContaining(['P06-migration-checksum', 'P11-manifest-approves-selection']))
  })

  it('blocks zero selected migrations', () => {
    expect(
      failedIds(evaluateRepositoryPreflight(repositoryFacts({ selectedMigrationPaths: [] }))),
    ).toContain('P07-exactly-one-migration')
  })

  it('blocks a deferred Literature migration', () => {
    const checks = evaluateRepositoryPreflight(
      repositoryFacts({
        selectedMigrationPaths: [
          'supabase/migrations/20260809231651_add_literature_gold_import_compensation_contract_v2.sql',
        ],
      }),
    )
    expect(failedIds(checks)).toEqual(
      expect.arrayContaining(['P08-migration-path', 'P09-no-deferred-literature-migration']),
    )
  })

  it('blocks an unrelated application migration', () => {
    const checks = evaluateRepositoryPreflight(
      repositoryFacts({
        selectedMigrationPaths: ['supabase/migrations/20260605041809_add_main_site_auth_usage.sql'],
      }),
    )
    expect(failedIds(checks)).toContain('P10-no-unrelated-migration')
  })

  it('blocks a prohibited deployment mechanism', () => {
    expect(
      failedIds(
        evaluateRepositoryPreflight(repositoryFacts({ deploymentMethod: 'supabase db push' })),
      ),
    ).toContain('P11-manifest-approves-selection')
  })
})

describe('target preflight rules', () => {
  it('approves a clean empty approved target', () => {
    const checks = evaluateTargetPreflight(emptyObservation())
    expect(failedIds(checks)).toEqual([])
  })

  it('fails closed when no observation was supplied', () => {
    const checks = evaluateTargetPreflight(null)
    expect(preflightApproved(checks)).toBe(false)
    expect(failedIds(checks)).toContain('T00-observation-present')
  })

  it('blocks the main application project', () => {
    const checks = evaluateTargetPreflight(
      emptyObservation({
        projectRef: 'tqnhxlwvkkswuckszlee',
        hostname: 'db.tqnhxlwvkkswuckszlee.supabase.co',
      }),
    )
    expect(failedIds(checks)).toEqual(
      expect.arrayContaining(['T01-target-ref-approved', 'T02-target-ref-not-prohibited']),
    )
  })

  it('blocks a loopback target presented as production', () => {
    expect(
      failedIds(evaluateTargetPreflight(emptyObservation({ hostname: '127.0.0.1' }))),
    ).toContain('T03-not-loopback-or-preview')
  })

  it('blocks an already-populated migration history', () => {
    const checks = evaluateTargetPreflight(
      emptyObservation({ migrationVersions: ['20260727032621'] }),
    )
    expect(failedIds(checks)).toEqual(
      expect.arrayContaining(['T04-empty-migration-history', 'T05-foundation-not-already-applied']),
    )
  })

  it('blocks a target that already holds Literature objects', () => {
    const checks = evaluateTargetPreflight(
      emptyObservation({
        catalog: {
          extensions: [],
          tables: [
            { name: 'literature_articles', rowLevelSecurity: true, rowLevelSecurityForced: false },
          ],
          policies: [],
          functions: [],
          triggers: [],
          indexes: [],
          tablePrivileges: [],
        },
      }),
    )
    expect(failedIds(checks)).toEqual(
      expect.arrayContaining([
        'T06-no-foundation-objects',
        'T07-no-name-collision',
        'T08-no-partial-schema',
      ]),
    )
  })

  it('blocks a semantic name collision on a function', () => {
    const checks = evaluateTargetPreflight(
      emptyObservation({
        catalog: {
          extensions: [],
          tables: [],
          policies: [],
          functions: [
            {
              name: 'search_literature_v1',
              argumentTypes: '',
              returnType: 'void',
              language: 'sql',
              volatility: 'v',
              securityDefiner: false,
              searchPath: null,
              owner: 'postgres',
              publicExecute: true,
              anonExecute: true,
              authenticatedExecute: true,
              serviceRoleExecute: true,
            },
          ],
          triggers: [],
          indexes: [],
          tablePrivileges: [],
        },
      }),
    )
    expect(failedIds(checks)).toContain('T07-no-name-collision')
  })

  it('blocks when the required extension or roles are unavailable', () => {
    expect(
      failedIds(
        evaluateTargetPreflight(
          emptyObservation({
            prerequisites: { availableExtensions: [], roles: [], schemas: ['public'] },
          }),
        ),
      ),
    ).toContain('T09-prerequisites-available')
  })

  it('fails closed when prerequisites were not observed at all', () => {
    expect(
      failedIds(evaluateTargetPreflight(emptyObservation({ prerequisites: undefined }))),
    ).toContain('T09-prerequisites-available')
  })
})

describe('observation documents carry no credential', () => {
  it('rejects a document containing a secret-shaped value', () => {
    for (const shape of [
      'sb_secret_' + 'x'.repeat(20),
      'sb_publishable_' + 'x'.repeat(20),
      'eyJhbGciOiJIUzI1NiJ9',
    ]) {
      expect(() =>
        assertObservationCarriesNoSecret(JSON.stringify({ projectRef: APPROVED_REF, shape })),
      ).toThrow(/credential-shaped/u)
    }
  })

  it('accepts a clean observation document', () => {
    expect(() => parseTargetObservation(JSON.stringify(emptyObservation()))).not.toThrow()
  })

  it('requires the observation to record which project was inspected', () => {
    expect(() => parseTargetObservation(JSON.stringify({ migrationVersions: [] }))).toThrow(
      /projectRef/u,
    )
  })

  it('emits read-only statements only', () => {
    for (const statement of [
      LITERATURE_READ_ONLY_CATALOG_STATEMENT,
      LITERATURE_READ_ONLY_HISTORY_STATEMENT,
    ]) {
      expect(statement).toMatch(/^begin read only;/u)
      expect(statement).toMatch(/set transaction read only;/u)
      expect(statement).toMatch(/rollback;$/u)

      // Privilege names such as 'INSERT' appear legitimately as quoted literals in the probe
      // arrays, so string literals are stripped before looking for an actual DML or DDL keyword.
      const withoutLiterals = statement.replaceAll(/'[^']*'/gu, "''")
      expect(withoutLiterals).not.toMatch(
        /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate)\b/iu,
      )

      // Every statement in the body must start with a read-only verb.
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
    const second = rehearsalResourceName('target')
    expect(first).not.toBe(second)
    expect(first).toMatch(/^literature-dedicated-bootstrap-target-\d+-[a-f0-9]{8}$/u)
  })

  it('requires a local Docker socket', () => {
    expect(assertLocalDockerEndpoint('unix:///var/run/docker.sock')).toBe('unix-domain-socket')
    expect(assertLocalDockerEndpoint('npipe:////./pipe/docker_engine')).toBe('windows-named-pipe')
    expect(() => assertLocalDockerEndpoint('tcp://10.0.0.5:2375')).toThrow(/local Docker socket/u)
    expect(() => assertLocalDockerEndpoint('')).toThrow(/local Docker socket/u)
  })

  it('strips every credential-bearing variable from rehearsal child processes', () => {
    const sanitized = sanitizeRehearsalChildEnvironment({
      PATH: '/usr/bin',
      LITERATURE_SUPABASE_URL: 'https://example.supabase.co',
      LITERATURE_SUPABASE_SECRET_KEY: 'sb_secret_EXAMPLE',
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

  it('the rehearsal never publishes a port and never names the protected stack', async () => {
    const source = await readFile(
      resolve(ROOT, 'scripts/literature-dedicated-supabase/rehearse-foundation.ts'),
      'utf8',
    )
    // No published port at all means there is no TCP surface that could reach 55322.
    expect(source).not.toMatch(/'--publish'|"-p"|'-p'/u)
    expect(source).toMatch(/removeContainerByExactName/u)
    // Cleanup is by exact name; a prefix or wildcard removal could take an unrelated container.
    expect(source).not.toMatch(/docker.*prune|--filter.*name=literature-dedicated-bootstrap\*/u)
  })
})
