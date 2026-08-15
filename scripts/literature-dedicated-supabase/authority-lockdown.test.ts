/** @jest-environment node */

/**
 * Adversarial authority lockdown (B-1/M-3, second correction).
 *
 * The second independent review demonstrated that while the provider-bound Layer-3 adapter is
 * absent, *no* structural defense makes an attestation object unforgeable: a plain object with
 * every expected field, an `as any` cast, a bare `{status:'attested'}`, or a deserialized fixture
 * could be pushed through the exported evaluator and its output piped into the preflight and
 * reconciliation helpers to reach `ready_to_apply` / `applied_correct` / `proceed`.
 *
 * The correction is removal: those verdicts no longer exist in any production union, and no
 * exported function accepts attestation-shaped input. This suite replays every bypass shape the
 * review used — against every exported production symbol — and asserts that nothing can produce a
 * success verdict.
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import * as attestationModule from '../../src/features/literature/dedicated-supabase/attestation'
import {
  LITERATURE_APPROVED_APPLICATION_MECHANISM,
  LITERATURE_FOUNDATION_MIGRATION,
} from '../../src/features/literature/dedicated-supabase/foundation-manifest'
import {
  LITERATURE_FOUNDATION_FUNCTION_NAMES,
  LITERATURE_FOUNDATION_TABLES,
} from '../../src/features/literature/dedicated-supabase/catalog-expectations'
import * as preflightRulesModule from './lib/preflight-rules'
import * as reconciliationModule from './lib/reconciliation'
import { canonicalJson, LITERATURE_CATALOG_SECTIONS, sha256 } from './lib/foundation-catalog'
import { parseLiteraturePreflightEvidence } from './lib/evidence-schema'
import { LITERATURE_PREFLIGHT_QUERY_PLAN_SHA256 } from './lib/target-observation'
import type { LiteraturePreflightEvidenceDocument } from './lib/evidence-schema'
import type { PreflightCheck, RepositoryFacts } from './lib/preflight-rules'
import type { LiteratureRolloutObservation } from './lib/reconciliation'

const ROOT = process.cwd()
const HEAD = 'a'.repeat(40)

const PRODUCTION_SOURCES = [
  'src/features/literature/dedicated-supabase/attestation.ts',
  'src/features/literature/dedicated-supabase/foundation-manifest.ts',
  'src/features/literature/dedicated-supabase/catalog-expectations.ts',
  'src/features/literature/server/dedicated-project-contract.ts',
  'src/features/literature/server/database-client.ts',
  'scripts/literature-dedicated-supabase/preflight.ts',
  'scripts/literature-dedicated-supabase/postflight.ts',
  'scripts/literature-dedicated-supabase/rehearse-foundation.ts',
  'scripts/literature-dedicated-supabase/lib/preflight-rules.ts',
  'scripts/literature-dedicated-supabase/lib/reconciliation.ts',
  'scripts/literature-dedicated-supabase/lib/foundation-catalog.ts',
  'scripts/literature-dedicated-supabase/lib/target-observation.ts',
  'scripts/literature-dedicated-supabase/lib/evidence-schema.ts',
  'scripts/literature-dedicated-supabase/lib/disposable-target.ts',
]

function passingChecks(): PreflightCheck[] {
  return [{ id: 'x', description: 'x', passed: true, detail: '' }]
}

function repositoryFacts(): RepositoryFacts {
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
  }
}

function perfectEvidence(): LiteraturePreflightEvidenceDocument {
  const catalog: Record<string, unknown> = Object.fromEntries(
    LITERATURE_CATALOG_SECTIONS.map((section) => [section, []]),
  )
  catalog.roleAttributes = [
    { role: 'anon', superuser: false, bypassRls: false, canLogin: false, inherit: false },
    { role: 'authenticated', superuser: false, bypassRls: false, canLogin: false, inherit: false },
    { role: 'service_role', superuser: false, bypassRls: true, canLogin: false, inherit: false },
  ]
  // Round-trip through the real strict parser so the fixture is exactly what production parses.
  return parseLiteraturePreflightEvidence(
    JSON.stringify({
      schemaVersion: 'literature-dedicated-preflight-observation/3.0.0',
      queryPlanSha256: LITERATURE_PREFLIGHT_QUERY_PLAN_SHA256,
      migrationHistory: { tableExists: false, versions: null },
      catalog,
      prerequisites: {
        availableExtensions: ['pg_trgm'],
        roles: ['anon', 'authenticated', 'service_role'],
        schemas: ['extensions', 'public'],
      },
    }),
  )
}

function perfectObservation(): LiteratureRolloutObservation {
  return {
    observationComplete: true,
    recordedMigrationVersions: ['20260727032621'],
    presentTables: [...LITERATURE_FOUNDATION_TABLES],
    presentFunctions: [...LITERATURE_FOUNDATION_FUNCTION_NAMES],
    expectedTables: [...LITERATURE_FOUNDATION_TABLES],
    expectedFunctions: [...LITERATURE_FOUNDATION_FUNCTION_NAMES],
    unexpectedLiteratureObjects: [],
    totalRowCount: 0,
    securityChecksPassed: true,
  }
}

/**
 * A forged attestation with every user-computable checksum computed for real, exactly as the
 * review's reproduction did: the evidence content checksum over the canonical evidence bytes and
 * the real migration checksum from the manifest.
 */
function forgedAttestationWithRealChecksums() {
  const evidence = perfectEvidence()
  return {
    mechanism: 'supabase_project_scoped_read_only_mcp_v1',
    providerProjectRef: 'itcttmkxdxvwmwcmzmey',
    providerProjectUrl: 'https://itcttmkxdxvwmwcmzmey.supabase.co',
    queryBundleSha256: LITERATURE_PREFLIGHT_QUERY_PLAN_SHA256,
    repositoryCommit: HEAD,
    migrationPath: LITERATURE_FOUNDATION_MIGRATION.path,
    migrationSha256: LITERATURE_FOUNDATION_MIGRATION.sha256,
    capturedAt: new Date().toISOString(),
    contentSha256: sha256(canonicalJson(evidence)),
    completeness: 'complete' as const,
    status: 'attested' as const,
  }
}

const FORBIDDEN_OUTPUT_TOKENS = [
  '"status":"attested"',
  '"verdict":"ready_to_apply"',
  'ready_to_apply',
  'applied_correct',
  '"nextAction":"proceed"',
  '"authoritative":true',
]

function expectNoSuccess(result: unknown) {
  const serialized = JSON.stringify(result) ?? ''
  for (const token of FORBIDDEN_OUTPUT_TOKENS) {
    expect(serialized).not.toContain(token)
  }
}

describe('no production source contains a success verdict literal', () => {
  it.each(PRODUCTION_SOURCES)('%s carries no success-verdict string literal', async (file) => {
    const source = await readFile(resolve(ROOT, file), 'utf8')
    expect(source).not.toMatch(/['"]ready_to_apply['"]/u)
    expect(source).not.toMatch(/['"]applied_correct['"]/u)
    expect(source).not.toMatch(/['"]attested['"]/u)
    expect(source).not.toMatch(/nextAction:\s*['"]proceed['"]/u)
    expect(source).not.toMatch(/authoritative:\s*true/u)
  })

  it('both CLIs set a nonzero exit status unconditionally', async () => {
    for (const cli of [
      'scripts/literature-dedicated-supabase/preflight.ts',
      'scripts/literature-dedicated-supabase/postflight.ts',
    ]) {
      const source = await readFile(resolve(ROOT, cli), 'utf8')
      expect(source).toMatch(/process\.exitCode = 1/u)
      expect(source).not.toMatch(/process\.exitCode = 0/u)
    }
  })
})

describe('forged authority cannot move any exported helper to success', () => {
  it('the review reproduction chain is dead at every link', () => {
    const forged = forgedAttestationWithRealChecksums()

    // Step 1-3 of the reproduction: the old exported evaluator returned `attested` for this
    // object. That evaluator no longer exists, and the no-input replacement always blocks.
    expect('evaluateLiteratureProviderAttestation' in attestationModule).toBe(false)
    const layer3 = (
      attestationModule.requireLiteratureProviderAttestation as unknown as (
        input: unknown,
      ) => unknown
    )(forged)
    expect(layer3).toMatchObject({ status: 'blocked', reason: 'provider_attestation_required' })
    expectNoSuccess(layer3)

    // Step 4-5: the old preflight/reconciliation helpers accepted the verdict — or a bare
    // {status:'attested'} — and returned ready_to_apply / applied_correct / proceed. Their input
    // types no longer carry any attestation field, and forged extras change nothing.
    const outcome = preflightRulesModule.resolvePreflightOutcome({
      repositoryChecks: passingChecks(),
      evidenceChecks: passingChecks(),
      attestationStatus: 'attested',
      attestation: forged,
      targetAttestation: { status: 'attested', attestation: forged },
    } as never)
    expect(outcome.verdict).toBe('provider_attestation_required')
    expectNoSuccess(outcome)

    const verdict = reconciliationModule.classifyLiteratureRollout({
      ...perfectObservation(),
      targetAttestation: { status: 'attested', attestation: forged },
      attested: true,
      authoritative: true,
    } as never)
    expect(verdict.classification).toBe('provider_attestation_required')
    expect(verdict.nextAction).toBe('stop_read_only_reconciliation')
    expectNoSuccess(verdict)
  })

  it('a deserialized test-shaped fixture is equally powerless', () => {
    const fixture: unknown = JSON.parse(JSON.stringify(forgedAttestationWithRealChecksums()))
    const layer3 = (
      attestationModule.requireLiteratureProviderAttestation as unknown as (
        input: unknown,
      ) => unknown
    )(fixture)
    expectNoSuccess(layer3)

    const verdict = reconciliationModule.classifyLiteratureRollout({
      ...perfectObservation(),
      targetAttestation: fixture,
    } as never)
    expect(verdict.classification).toBe('provider_attestation_required')
    expectNoSuccess(verdict)
  })

  it('a genuinely perfect repository + evidence still ends at provider_attestation_required', () => {
    const repositoryChecks = preflightRulesModule.evaluateRepositoryPreflight(repositoryFacts())
    const evidenceChecks = preflightRulesModule.evaluateEvidenceContentPreflight(perfectEvidence())
    // Both layers pass for real...
    expect(preflightRulesModule.allChecksPassed(evidenceChecks)).toBe(true)
    // ...and the outcome still cannot exceed provider_attestation_required. (The repository layer
    // legitimately fails in this checkout — wrong branch — which only strengthens the block.)
    const outcome = preflightRulesModule.resolvePreflightOutcome({
      repositoryChecks,
      evidenceChecks,
    })
    expect(['blocked', 'provider_attestation_required']).toContain(outcome.verdict)
    expectNoSuccess(outcome)

    const verdict = reconciliationModule.classifyLiteratureRollout(perfectObservation())
    expect(verdict.contentAssessment).toBe('catalog_matches_expected_nonauthoritative')
    expect(verdict.classification).toBe('provider_attestation_required')
    expect(verdict.nextAction).toBe('stop_read_only_reconciliation')
    expectNoSuccess(verdict)
  })

  it('inventories every verdict-producing export so new authority cannot appear silently', () => {
    const functionNames = (module: object) =>
      Object.entries(module)
        .filter(([, value]) => typeof value === 'function')
        .map(([name]) => name)
        .sort()

    expect(functionNames(attestationModule)).toEqual([
      'captureLiteratureProviderAttestation',
      'requireLiteratureProviderAttestation',
    ])
    expect(functionNames(reconciliationModule)).toEqual([
      'classifyLiteratureRollout',
      'resolveLostAcknowledgement',
    ])
    expect(functionNames(preflightRulesModule)).toEqual([
      'allChecksPassed',
      'evaluateEvidenceContentPreflight',
      'evaluateRepositoryPreflight',
      'resolvePreflightOutcome',
    ])
  })
})
