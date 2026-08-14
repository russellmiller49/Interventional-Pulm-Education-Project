/**
 * Read-only preflight for the dedicated Literature foundation rollout.
 *
 * Three layers, with different authority:
 *
 *   Layer 1 (authoritative)     — repository: branch, HEAD == origin/main == owner-approved commit,
 *                                 migration identity, exactly one selection, exact mechanism.
 *   Layer 2 (NON-authoritative) — evidence content: shape and internal consistency only.
 *   Layer 3 (authoritative)     — provider-bound target attestation, which this repository cannot
 *                                 currently produce.
 *
 * Because Layer 3 is unimplemented, the best reachable verdict today is
 * `provider_attestation_required`. That is deliberate: a hand-assembled JSON document proves what
 * it says, not which database said it, so it must never authorize a migration.
 *
 *   npx tsx scripts/literature-dedicated-supabase/preflight.ts --print-query-bundle
 *   npx tsx scripts/literature-dedicated-supabase/preflight.ts \
 *     --owner-approved-commit <sha> \
 *     --application-mechanism supabase_connector_apply_migration_v1 \
 *     --evidence <path.json>
 *
 * Exit code 0 requires `ready_to_apply`. Any missing input is a failure, never a pass.
 */

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  captureLiteratureProviderAttestation,
  evaluateLiteratureProviderAttestation,
} from '../../src/features/literature/dedicated-supabase/attestation'
import {
  LITERATURE_DEDICATED_TARGET,
  LITERATURE_FOUNDATION_MIGRATION,
} from '../../src/features/literature/dedicated-supabase/foundation-manifest'
import { runCommand } from './lib/disposable-target'
import { LiteratureEvidenceError, parseLiteratureEvidence } from './lib/evidence-schema'
import type { LiteratureEvidenceDocument } from './lib/evidence-schema'
import { canonicalJson, sha256 } from './lib/foundation-catalog'
import {
  evaluateEvidenceContentPreflight,
  evaluateRepositoryPreflight,
  resolvePreflightOutcome,
  type PreflightCheck,
  type RepositoryFacts,
} from './lib/preflight-rules'
import {
  LITERATURE_QUERY_BUNDLE_SHA256,
  renderLiteratureQueryBundle,
} from './lib/target-observation'

const ROOT = process.cwd()

function flagValue(name: string) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function git(arguments_: readonly string[], allowFailure = false) {
  const result = await runCommand('git', arguments_, { cwd: ROOT, allowFailure })
  return { text: result.stdout.trim(), code: result.code }
}

async function gatherRepositoryFacts(): Promise<RepositoryFacts> {
  const gitDirectory = (await git(['rev-parse', '--absolute-git-dir'])).text
  const commonDirectory = (await git(['rev-parse', '--git-common-dir'])).text
  const migrationBytes = await readFile(resolve(ROOT, LITERATURE_FOUNDATION_MIGRATION.path))

  return {
    checkoutPath: ROOT,
    isPrimaryCheckout: resolve(gitDirectory) === resolve(ROOT, commonDirectory),
    branch: (await git(['rev-parse', '--abbrev-ref', 'HEAD'])).text,
    headCommit: (await git(['rev-parse', 'HEAD'])).text,
    originMainCommit: (await git(['rev-parse', 'origin/main'], true)).text,
    workingTreeClean: (await git(['status', '--porcelain', '--untracked-files=no'])).text === '',
    ownerApprovedCommit: flagValue('--owner-approved-commit'),
    migrationSha256: createHash('sha256').update(migrationBytes).digest('hex'),
    migrationByteLength: migrationBytes.byteLength,
    selectedMigrationPaths: [LITERATURE_FOUNDATION_MIGRATION.path],
    applicationMechanism: flagValue('--application-mechanism'),
  }
}

function report(title: string, checks: readonly PreflightCheck[]) {
  process.stdout.write(`\n${title}\n`)
  for (const entry of checks) {
    process.stdout.write(
      `  [${entry.passed ? 'PASS' : 'FAIL'}] ${entry.id} — ${entry.description}\n`,
    )
    if (!entry.passed) process.stdout.write(`         ${entry.detail}\n`)
  }
}

async function main() {
  if (process.argv.includes('--print-query-bundle')) {
    process.stdout.write(renderLiteratureQueryBundle())
    return
  }

  const evidencePath = flagValue('--evidence')
  let evidence: LiteratureEvidenceDocument | null = null
  let evidenceError: string | null = null
  if (evidencePath) {
    try {
      evidence = parseLiteratureEvidence(await readFile(resolve(ROOT, evidencePath), 'utf8'))
    } catch (error) {
      evidenceError =
        error instanceof LiteratureEvidenceError
          ? `${error.code}: ${error.message}`
          : `unreadable evidence document: ${String(error)}`
    }
  }

  const repositoryChecks = evaluateRepositoryPreflight(await gatherRepositoryFacts())
  const evidenceChecks = evaluateEvidenceContentPreflight(evidence)

  process.stdout.write('Dedicated Literature foundation rollout — read-only preflight\n')
  report('Layer 1 — repository (authoritative)', repositoryChecks)
  if (evidenceError) {
    process.stdout.write(
      `\nLayer 2 — evidence content (NON-authoritative)\n  [FAIL] ${evidenceError}\n`,
    )
  } else {
    report('Layer 2 — evidence content (NON-authoritative)', evidenceChecks)
  }

  // Layer 3. The only place target identity can come from. There is deliberately no flag, file, or
  // environment variable that can substitute for it.
  const capture = captureLiteratureProviderAttestation()
  const attestationVerdict = evaluateLiteratureProviderAttestation(
    capture.status === 'captured' ? capture.attestation : null,
    {
      projectRef: LITERATURE_DEDICATED_TARGET.projectRef,
      queryBundleSha256: LITERATURE_QUERY_BUNDLE_SHA256,
      ownerApprovedCommit: flagValue('--owner-approved-commit') ?? '',
      migrationPath: LITERATURE_FOUNDATION_MIGRATION.path,
      migrationSha256: LITERATURE_FOUNDATION_MIGRATION.sha256,
      observedContentSha256: evidence ? sha256(canonicalJson(evidence)) : '',
      nowMs: Date.now(),
    },
  )

  process.stdout.write('\nLayer 3 — provider-bound target attestation (authoritative)\n')
  if (attestationVerdict.status === 'attested') {
    process.stdout.write('  [PASS] target identity proven by the project-scoped connector\n')
  } else {
    process.stdout.write(`  [FAIL] ${attestationVerdict.reason}\n`)
    process.stdout.write(
      `         ${capture.status === 'unavailable' ? capture.detail : attestationVerdict.detail}\n`,
    )
  }

  const outcome = resolvePreflightOutcome({
    repositoryChecks,
    evidenceChecks: evidenceError
      ? [{ id: 'E00', description: 'evidence parsed', passed: false, detail: evidenceError }]
      : evidenceChecks,
    attestationStatus: attestationVerdict.status === 'attested' ? 'attested' : 'rejected',
    attestationDetail:
      capture.status === 'unavailable'
        ? capture.detail
        : attestationVerdict.status === 'rejected'
          ? attestationVerdict.detail
          : '',
  })

  process.stdout.write(`\nVERDICT: ${outcome.verdict}\n`)
  process.stdout.write(`authoritative: ${outcome.authoritative}\n`)
  process.stdout.write(`${outcome.summary}\n`)

  if (outcome.verdict !== 'ready_to_apply') {
    process.stdout.write(
      '\nNo migration may be applied. This command never applies anything on its own.\n',
    )
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
