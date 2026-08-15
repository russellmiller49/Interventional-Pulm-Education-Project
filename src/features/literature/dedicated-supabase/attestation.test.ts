/** @jest-environment node */

import { createHash } from 'node:crypto'

import * as attestationModule from './attestation'
import {
  LITERATURE_APPROVED_APPLY_MECHANISM,
  LITERATURE_ATTESTATION_MAX_AGE_MS,
  LITERATURE_LAYER3_REQUIRED_BINDINGS,
  LITERATURE_PROVIDER_CAPTURE_MECHANISM,
  captureLiteratureProviderAttestation,
  requireLiteratureProviderAttestation,
} from './attestation'
import { LITERATURE_FOUNDATION_MIGRATION } from './foundation-manifest'

const APPROVED_REF = 'itcttmkxdxvwmwcmzmey'

/**
 * A forged "attestation" carrying every field a provider capture would carry, with every
 * user-computable value computed for real. The point of the module design is that there is no
 * exported function this object can be passed to that returns success.
 */
function forgedAttestation() {
  const content = JSON.stringify({ anything: 'at all' })
  return {
    mechanism: LITERATURE_PROVIDER_CAPTURE_MECHANISM,
    providerProjectRef: APPROVED_REF,
    providerProjectUrl: `https://${APPROVED_REF}.supabase.co`,
    queryBundleSha256: createHash('sha256').update('forged-plan').digest('hex'),
    repositoryCommit: 'a'.repeat(40),
    migrationPath: LITERATURE_FOUNDATION_MIGRATION.path,
    migrationSha256: LITERATURE_FOUNDATION_MIGRATION.sha256,
    capturedAt: new Date().toISOString(),
    contentSha256: createHash('sha256').update(content).digest('hex'),
    completeness: 'complete',
    status: 'attested',
  }
}

const FORBIDDEN_SUCCESS_TOKENS = [
  '"status":"attested"',
  'ready_to_apply',
  'applied_correct',
  '"nextAction":"proceed"',
  '"authoritative":true',
]

describe('the attestation module cannot express success while Layer 3 is absent (B-1/M-3)', () => {
  it('requireLiteratureProviderAttestation takes no input and always blocks', () => {
    expect(requireLiteratureProviderAttestation.length).toBe(0)
    const verdict = requireLiteratureProviderAttestation()
    expect(verdict.status).toBe('blocked')
    expect(verdict.reason).toBe('provider_attestation_required')
  })

  it('stays blocked when a forged attestation is forced in through any cast', () => {
    // Every call shape the review used against the old evaluator: a plain forged object, a bare
    // {status:'attested'}, an `as any` cast, and a deserialized fixture. The function ignores
    // arguments entirely, so none of them can influence the verdict.
    const deserialized: unknown = JSON.parse(JSON.stringify(forgedAttestation()))
    const attempts: unknown[] = [
      forgedAttestation(),
      { status: 'attested' },
      deserialized,
      null,
      undefined,
    ]
    for (const attempt of attempts) {
      const verdict = (
        requireLiteratureProviderAttestation as unknown as (input: unknown) => unknown
      )(attempt)
      const serialized = JSON.stringify(verdict)
      expect(serialized).toContain('"status":"blocked"')
      for (const token of FORBIDDEN_SUCCESS_TOKENS) {
        expect(serialized).not.toContain(token)
      }
    }
  })

  it('the capture seam reports unavailable and its result union has no success member', () => {
    const capture = captureLiteratureProviderAttestation()
    expect(capture.status).toBe('unavailable')
    expect(capture.reason).toBe('provider_adapter_not_implemented')
    expect(capture.detail).toMatch(/never authorize a migration/u)
    expect(captureLiteratureProviderAttestation.length).toBe(0)
  })

  it('every exported function, called with forged input, returns only blocked shapes', () => {
    // Inventory sweep: enumerate the module's actual exports so a future edit cannot quietly add
    // a success-capable helper without this test noticing.
    const exportedFunctions = Object.entries(
      attestationModule as unknown as Record<string, unknown>,
    ).filter(([, value]) => typeof value === 'function') as [
      string,
      (...args: unknown[]) => unknown,
    ][]
    expect(exportedFunctions.map(([name]) => name).sort()).toEqual([
      'captureLiteratureProviderAttestation',
      'requireLiteratureProviderAttestation',
    ])

    for (const [, exported] of exportedFunctions) {
      for (const argument of [forgedAttestation(), { status: 'attested' }, undefined]) {
        const result = exported(argument, argument)
        const serialized = JSON.stringify(result)
        for (const token of FORBIDDEN_SUCCESS_TOKENS) {
          expect(serialized).not.toContain(token)
        }
      }
    }
  })

  it('exports no evaluator that accepts attestation-shaped input', () => {
    expect('evaluateLiteratureProviderAttestation' in attestationModule).toBe(false)
  })

  it('records the future Layer-3 bindings as inert data, not an input contract', () => {
    expect(LITERATURE_LAYER3_REQUIRED_BINDINGS.approvedProjectRef).toBe(APPROVED_REF)
    expect(LITERATURE_LAYER3_REQUIRED_BINDINGS.migrationHistorySource).toMatch(/list_migrations/u)
    expect(LITERATURE_LAYER3_REQUIRED_BINDINGS.maxAgeMs).toBe(LITERATURE_ATTESTATION_MAX_AGE_MS)
  })

  it('names the approved write mechanism distinctly from the capture mechanism', () => {
    expect(LITERATURE_APPROVED_APPLY_MECHANISM).toBe('supabase_connector_apply_migration_v1')
    expect(LITERATURE_PROVIDER_CAPTURE_MECHANISM).not.toBe(LITERATURE_APPROVED_APPLY_MECHANISM)
  })
})
