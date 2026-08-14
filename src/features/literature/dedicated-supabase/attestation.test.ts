/** @jest-environment node */

import {
  LITERATURE_APPROVED_APPLY_MECHANISM,
  LITERATURE_ATTESTATION_MAX_AGE_MS,
  LITERATURE_PROVIDER_CAPTURE_MECHANISM,
  captureLiteratureProviderAttestation,
  evaluateLiteratureProviderAttestation,
  type LiteratureAttestationExpectation,
  type LiteratureProviderAttestation,
} from './attestation'
import { LITERATURE_FOUNDATION_MIGRATION } from './foundation-manifest'

const APPROVED_REF = 'itcttmkxdxvwmwcmzmey'
const MAIN_REF = 'tqnhxlwvkkswuckszlee'
const COMMIT = 'a'.repeat(40)
const BUNDLE = 'b'.repeat(64)
const CONTENT = 'c'.repeat(64)
const NOW = Date.parse('2026-08-14T12:00:00.000Z')

function expectation(
  overrides: Partial<LiteratureAttestationExpectation> = {},
): LiteratureAttestationExpectation {
  return {
    projectRef: APPROVED_REF,
    queryBundleSha256: BUNDLE,
    ownerApprovedCommit: COMMIT,
    migrationPath: LITERATURE_FOUNDATION_MIGRATION.path,
    migrationSha256: LITERATURE_FOUNDATION_MIGRATION.sha256,
    observedContentSha256: CONTENT,
    nowMs: NOW,
    ...overrides,
  }
}

function attestation(
  overrides: Partial<LiteratureProviderAttestation> = {},
): LiteratureProviderAttestation {
  return {
    mechanism: LITERATURE_PROVIDER_CAPTURE_MECHANISM,
    providerProjectRef: APPROVED_REF,
    providerProjectUrl: `https://${APPROVED_REF}.supabase.co`,
    queryBundleSha256: BUNDLE,
    repositoryCommit: COMMIT,
    migrationPath: LITERATURE_FOUNDATION_MIGRATION.path,
    migrationSha256: LITERATURE_FOUNDATION_MIGRATION.sha256,
    capturedAt: new Date(NOW - 30_000).toISOString(),
    contentSha256: CONTENT,
    completeness: 'complete',
    ...overrides,
  }
}

describe('provider attestation is the only source of target identity (B-1)', () => {
  it('accepts a fully bound, fresh attestation', () => {
    expect(evaluateLiteratureProviderAttestation(attestation(), expectation())).toMatchObject({
      status: 'attested',
    })
  })

  it('rejects a missing attestation', () => {
    expect(evaluateLiteratureProviderAttestation(null, expectation())).toMatchObject({
      status: 'rejected',
      reason: 'provider_attestation_required',
    })
    expect(evaluateLiteratureProviderAttestation(undefined, expectation())).toMatchObject({
      status: 'rejected',
      reason: 'provider_attestation_required',
    })
  })

  it('rejects evidence from another database relabelled with the approved ref', () => {
    // The exact blocking finding: a capture from target A cannot be relabelled, because the ref
    // comes from the adapter context and is compared against the expectation.
    expect(
      evaluateLiteratureProviderAttestation(
        attestation({ providerProjectRef: 'zzzzzzzzzzzzzzzzzzzz' }),
        expectation(),
      ),
    ).toMatchObject({ status: 'rejected', reason: 'wrong_project_ref' })
  })

  it('rejects main-project evidence relabelled as approved', () => {
    expect(
      evaluateLiteratureProviderAttestation(
        attestation({
          providerProjectRef: MAIN_REF,
          providerProjectUrl: `https://${MAIN_REF}.supabase.co`,
        }),
        expectation(),
      ),
    ).toMatchObject({ status: 'rejected', reason: 'wrong_project_ref' })
  })

  it('rejects an arbitrary provider URL', () => {
    expect(
      evaluateLiteratureProviderAttestation(
        attestation({ providerProjectUrl: 'https://evil.example.com' }),
        expectation(),
      ),
    ).toMatchObject({ status: 'rejected', reason: 'wrong_project_url' })
  })

  it('rejects a replay after the repository commit changed', () => {
    expect(
      evaluateLiteratureProviderAttestation(
        attestation(),
        expectation({ ownerApprovedCommit: 'd'.repeat(40) }),
      ),
    ).toMatchObject({ status: 'rejected', reason: 'wrong_repository_commit' })
  })

  it('rejects a replay after the migration checksum changed', () => {
    expect(
      evaluateLiteratureProviderAttestation(
        attestation({ migrationSha256: 'e'.repeat(64) }),
        expectation(),
      ),
    ).toMatchObject({ status: 'rejected', reason: 'wrong_migration_checksum' })
  })

  it('rejects a wrong migration path', () => {
    expect(
      evaluateLiteratureProviderAttestation(
        attestation({ migrationPath: 'supabase/migrations/other.sql' }),
        expectation(),
      ),
    ).toMatchObject({ status: 'rejected', reason: 'wrong_migration_path' })
  })

  it('rejects a wrong query-bundle identity', () => {
    expect(
      evaluateLiteratureProviderAttestation(
        attestation({ queryBundleSha256: 'f'.repeat(64) }),
        expectation(),
      ),
    ).toMatchObject({ status: 'rejected', reason: 'wrong_query_bundle' })
  })

  it('rejects a wrong capture mechanism', () => {
    expect(
      evaluateLiteratureProviderAttestation(
        attestation({
          mechanism: 'manual_paste' as typeof LITERATURE_PROVIDER_CAPTURE_MECHANISM,
        }),
        expectation(),
      ),
    ).toMatchObject({ status: 'rejected', reason: 'wrong_capture_mechanism' })
  })

  it('rejects a stale attestation', () => {
    expect(
      evaluateLiteratureProviderAttestation(
        attestation({
          capturedAt: new Date(NOW - LITERATURE_ATTESTATION_MAX_AGE_MS - 1000).toISOString(),
        }),
        expectation(),
      ),
    ).toMatchObject({ status: 'rejected', reason: 'stale_attestation' })
  })

  it('rejects a future-dated attestation', () => {
    expect(
      evaluateLiteratureProviderAttestation(
        attestation({ capturedAt: new Date(NOW + 60_000).toISOString() }),
        expectation(),
      ),
    ).toMatchObject({ status: 'rejected', reason: 'stale_attestation' })
  })

  it('rejects an invalid capture timestamp', () => {
    expect(
      evaluateLiteratureProviderAttestation(
        attestation({ capturedAt: 'yesterday' }),
        expectation(),
      ),
    ).toMatchObject({ status: 'rejected', reason: 'invalid_capture_timestamp' })
  })

  it('rejects an incomplete capture', () => {
    expect(
      evaluateLiteratureProviderAttestation(
        attestation({ completeness: 'partial' }),
        expectation(),
      ),
    ).toMatchObject({ status: 'rejected', reason: 'incomplete_capture' })
  })

  it('rejects an altered receipt whose content checksum no longer matches', () => {
    expect(
      evaluateLiteratureProviderAttestation(
        attestation(),
        expectation({ observedContentSha256: '9'.repeat(64) }),
      ),
    ).toMatchObject({ status: 'rejected', reason: 'content_checksum_mismatch' })
  })
})

describe('the provider adapter is honestly unimplemented', () => {
  it('reports unavailable rather than simulating provenance', () => {
    const capture = captureLiteratureProviderAttestation()
    expect(capture.status).toBe('unavailable')
    if (capture.status !== 'unavailable') throw new Error('expected unavailable')
    expect(capture.reason).toBe('provider_adapter_not_implemented')
    expect(capture.detail).toMatch(/never authorize a migration/u)
  })

  it('takes no argument, so no file or flag can feed it an attestation', () => {
    expect(captureLiteratureProviderAttestation).toHaveLength(0)
  })

  it('names the approved write mechanism distinctly from the capture mechanism', () => {
    expect(LITERATURE_APPROVED_APPLY_MECHANISM).toBe('supabase_connector_apply_migration_v1')
    expect(LITERATURE_PROVIDER_CAPTURE_MECHANISM).toBe('supabase_project_scoped_read_only_mcp_v1')
    expect(LITERATURE_APPROVED_APPLY_MECHANISM).not.toBe(LITERATURE_PROVIDER_CAPTURE_MECHANISM)
  })
})
