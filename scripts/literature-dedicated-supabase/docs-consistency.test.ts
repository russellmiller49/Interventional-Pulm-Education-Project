/** @jest-environment node */

/**
 * Third review, findings 5 and 6 — the five dedicated-Supabase documents match the code.
 *
 * The defects were ordinary documentation rot with real consequences: the runbook printed the
 * production URL without the trailing slash the executable contract requires byte-for-byte, so an
 * operator copying it would have configured a value the runtime refuses; the threat model still
 * named check IDs and outcomes (`T03`, `T06`, `T07`, `T08`, `partial_incident`, `ambiguous`,
 * `applied_drifted`) from iterations that no longer exist; and a hardcoded "Layer 2 (13 checks)"
 * had drifted from the actual 12.
 *
 * Two remedies, applied together: brittle counts are removed from prose rather than corrected, and
 * the claims that remain are bound to production exports here. A future correction that renames a
 * check or an outcome fails this suite instead of quietly leaving the documents wrong.
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  LITERATURE_APPROVED_APPLICATION_MECHANISM,
  LITERATURE_FOUNDATION_MIGRATION,
} from '../../src/features/literature/dedicated-supabase/foundation-manifest'
import { LITERATURE_CANONICAL_PRODUCTION_URL_EXACT } from '../../src/features/literature/server/dedicated-project-contract'
import { LITERATURE_CATALOG_SECTIONS } from './lib/foundation-catalog'
import {
  evaluateEvidenceContentPreflight,
  evaluateRepositoryPreflight,
  type PreflightCheck,
  type RepositoryFacts,
} from './lib/preflight-rules'
import { LITERATURE_CONTENT_ASSESSMENTS } from './lib/reconciliation'
import { LITERATURE_PREFLIGHT_QUERY_PLAN_SHA256 } from './lib/target-observation'
import type { LiteraturePreflightEvidenceDocument } from './lib/evidence-schema'

const ROOT = process.cwd()
const DOCS_DIRECTORY = 'docs/ip-literature'

const DOCUMENTS = [
  'dedicated-supabase-architecture.md',
  'dedicated-supabase-codex-review-handoff.md',
  'dedicated-supabase-provenance.md',
  'dedicated-supabase-rollout-runbook.md',
  'dedicated-supabase-threat-model.md',
] as const

const RUNBOOK = 'dedicated-supabase-rollout-runbook.md'
const ARCHITECTURE = 'dedicated-supabase-architecture.md'

async function readDocument(name: string) {
  return readFile(resolve(ROOT, DOCS_DIRECTORY, name), 'utf8')
}

async function readAllDocuments(): Promise<[string, string][]> {
  return Promise.all(DOCUMENTS.map(async (name) => [name, await readDocument(name)] as const)).then(
    (entries) => entries.map(([name, body]) => [name, body] as [string, string]),
  )
}

/** Every check ID the real evaluators can emit, for both a passing and a failing input. */
function everyProducibleCheckId(): Set<string> {
  const facts: RepositoryFacts = {
    checkoutPath: '/Users/example/Projects/Interventional-Pulm-Education-Project',
    isPrimaryCheckout: true,
    branch: 'main',
    headCommit: 'a'.repeat(40),
    originMainCommit: 'a'.repeat(40),
    workingTreeClean: true,
    ownerApprovedCommit: 'a'.repeat(40),
    migrationSha256: LITERATURE_FOUNDATION_MIGRATION.sha256,
    migrationByteLength: LITERATURE_FOUNDATION_MIGRATION.byteLength,
    selectedMigrationPaths: [LITERATURE_FOUNDATION_MIGRATION.path],
    applicationMechanism: LITERATURE_APPROVED_APPLICATION_MECHANISM,
  }

  const catalog = {
    ...(Object.fromEntries(LITERATURE_CATALOG_SECTIONS.map((section) => [section, []])) as Record<
      string,
      unknown[]
    >),
    roleAttributes: [
      { role: 'anon', superuser: false, bypassRls: false, canLogin: false, inherit: false },
      {
        role: 'authenticated',
        superuser: false,
        bypassRls: false,
        canLogin: false,
        inherit: false,
      },
      { role: 'service_role', superuser: false, bypassRls: true, canLogin: false, inherit: false },
    ],
  }
  const evidence = {
    schemaVersion: 'literature-dedicated-preflight-observation/3.0.0',
    queryPlanSha256: LITERATURE_PREFLIGHT_QUERY_PLAN_SHA256,
    migrationHistory: { tableExists: false, versions: null },
    catalog,
    prerequisites: {
      availableExtensions: ['pg_trgm'],
      roles: ['anon', 'authenticated', 'service_role'],
      schemas: ['extensions', 'public'],
    },
  } as unknown as LiteraturePreflightEvidenceDocument

  const collect = (checks: readonly PreflightCheck[]) => checks.map((entry) => entry.id)
  return new Set([
    ...collect(evaluateRepositoryPreflight(facts)),
    ...collect(evaluateEvidenceContentPreflight(evidence)),
    // The absent-evidence branch emits its own ID, and the preflight CLI emits a parse-failure one.
    ...collect(evaluateEvidenceContentPreflight(null)),
    'E00-evidence-parsed',
  ])
}

describe('the exact production URL is documented with its trailing slash', () => {
  it('matches the executable constant wherever the runbook gives a configuration value', async () => {
    const runbook = await readDocument(RUNBOOK)
    expect(runbook).toContain(
      `LITERATURE_SUPABASE_URL=${LITERATURE_CANONICAL_PRODUCTION_URL_EXACT}`,
    )
    // The slash-less form must never appear as an assignment.
    expect(runbook).not.toMatch(/LITERATURE_SUPABASE_URL=https:\/\/[a-z]+\.supabase\.co(?!\/)/u)
  })

  it('gives the exact byte sequence in the architecture note', async () => {
    expect(await readDocument(ARCHITECTURE)).toContain(LITERATURE_CANONICAL_PRODUCTION_URL_EXACT)
  })

  it('never writes the production URL without its trailing slash, anywhere', async () => {
    // Inline code, fenced blocks, and prose alike. The scheme-less `<ref>.supabase.co` form stays
    // allowed: that is a host/ref description, never a configuration value.
    const slashless = new RegExp(
      `${LITERATURE_CANONICAL_PRODUCTION_URL_EXACT.replace(/[.]/gu, '\\.').replace(/\/$/u, '')}(?!/)`,
      'gu',
    )
    for (const [name, body] of [
      ...(await readAllDocuments()),
      ['.env.example', await readFile(resolve(ROOT, '.env.example'), 'utf8')] as [string, string],
    ]) {
      const offenders = [...body.matchAll(slashless)].length
      expect(`${name}: ${offenders} slash-less occurrence(s)`).toBe(
        `${name}: 0 slash-less occurrence(s)`,
      )
    }
  })
})

describe('documented outcome names match the exported unions', () => {
  it('lists exactly the exported content assessments in the runbook table', async () => {
    const runbook = await readDocument(RUNBOOK)
    const tabled = [...runbook.matchAll(/^\|\s*`([a-z_]+_nonauthoritative)`\s*\|/gmu)].map(
      (match) => match[1],
    )
    expect(tabled.sort()).toEqual([...LITERATURE_CONTENT_ASSESSMENTS].sort())
  })

  it('carries no outcome name from a superseded iteration', async () => {
    // Each of these was a real name once. `ready_to_apply` / `applied_correct` / `proceed` are
    // deliberately absent from this list: the documents legitimately narrate their removal.
    const superseded = [
      '`partial_incident`',
      '`ambiguous`',
      '`applied_drifted`',
      '`applied_correct_nonauthoritative`',
    ]
    for (const [name, body] of await readAllDocuments()) {
      for (const token of superseded) {
        expect(`${name}: ${body.includes(token) ? token : ''}`).toBe(`${name}: `)
      }
    }
  })
})

describe('documented check IDs are produced by the real evaluators', () => {
  it('resolves every backticked P/E/Q identifier', async () => {
    const producible = everyProducibleCheckId()
    const producibleSuffixes = new Set(
      [...producible].flatMap((id) => {
        // `E08-Q01-pg-trgm-location` is referenced both whole and by its prerequisite half.
        const parts = id.split('-')
        return parts.length > 1 && /^Q\d\d$/u.test(parts[1]) ? [id, parts.slice(1).join('-')] : [id]
      }),
    )
    const known = new Set([...producible, ...producibleSuffixes])

    for (const [name, body] of await readAllDocuments()) {
      for (const match of body.matchAll(/`([PEQ]\d\d[A-Za-z0-9-]*)`/gu)) {
        const referenced = match[1]
        const resolved = [...known].some(
          (id) => id === referenced || id.startsWith(`${referenced}-`),
        )
        if (!resolved) {
          throw new Error(`${name} references check ${referenced}, which no evaluator produces`)
        }
      }
    }
  })

  it('references no threat-shaped check ID, which is what went stale before', async () => {
    for (const [name, body] of await readAllDocuments()) {
      const stale = [...body.matchAll(/`(T\d\d)`/gu)].map((match) => match[1])
      expect(`${name}: ${stale.join(', ')}`).toBe(`${name}: `)
    }
  })
})

describe('brittle numeric claims are absent rather than merely correct', () => {
  it('states no per-layer check count', async () => {
    for (const [name, body] of await readAllDocuments()) {
      expect(`${name}: ${/Layer \d[^.\n]{0,40}\(\d+ checks?\)/u.exec(body)?.[0] ?? ''}`).toBe(
        `${name}: `,
      )
    }
  })

  it('states no rehearsal scenario count', async () => {
    for (const [name, body] of await readAllDocuments()) {
      expect(`${name}: ${/\b\d+ scenarios\b/u.exec(body)?.[0] ?? ''}`).toBe(`${name}: `)
      expect(`${name}: ${/\b\d+\/\d+ each\b/u.exec(body)?.[0] ?? ''}`).toBe(`${name}: `)
    }
  })
})

describe('documented flags and commands exist', () => {
  it('names only flags the CLIs actually read', async () => {
    const [preflight, postflight] = await Promise.all([
      readFile(resolve(ROOT, 'scripts/literature-dedicated-supabase/preflight.ts'), 'utf8'),
      readFile(resolve(ROOT, 'scripts/literature-dedicated-supabase/postflight.ts'), 'utf8'),
    ])
    const sources = `${preflight}\n${postflight}`
    const documentedFlags = new Set<string>()
    for (const [, body] of await readAllDocuments()) {
      for (const match of body.matchAll(/(--[a-z][a-zA-Z-]+)/gu)) documentedFlags.add(match[1])
    }
    // Flags belonging to other tools the documents legitimately mention.
    const foreign = new Set([
      '--linked',
      '--emit-expectations',
      '--maxWorkers',
      '--check',
      '--runInBand',
      '--no-align',
      '--tuples-only',
      '--silent',
    ])
    for (const flag of documentedFlags) {
      if (foreign.has(flag)) continue
      expect(`${flag}: ${sources.includes(flag)}`).toBe(`${flag}: true`)
    }
  })
})

describe('the documents state that production variables do not activate the runtime', () => {
  it('says so in the runbook, the architecture note, the threat model, and .env.example', async () => {
    const runbook = await readDocument(RUNBOOK)
    expect(runbook).toContain('LITERATURE_PRODUCTION_RUNTIME_ACTIVATION')
    expect(runbook).toMatch(/reserved for this cutover/iu)

    expect(await readDocument(ARCHITECTURE)).toMatch(/validated, not activated/iu)
    expect(await readDocument('dedicated-supabase-threat-model.md')).toContain(
      'dedicated_runtime_not_activated',
    )

    const environmentExample = await readFile(resolve(ROOT, '.env.example'), 'utf8')
    expect(environmentExample).toContain('LITERATURE_PRODUCTION_RUNTIME_ACTIVATION')
    expect(environmentExample).toMatch(/RESERVED FOR THE LATER CUTOVER/u)
    // No new variable may exist that could activate the production client.
    expect(environmentExample).not.toMatch(/^[A-Z_]*ACTIVAT[A-Z_]*=/mu)
  })
})
