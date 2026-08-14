/**
 * Read-only preflight for the dedicated Literature foundation rollout.
 *
 * Three layers, with different authority:
 *
 *   Layer 1 — repository: branch, HEAD == origin/main == owner-approved commit, migration
 *             identity, exactly one selection, exact mechanism. Can block; cannot authorize.
 *   Layer 2 (NON-authoritative) — evidence content: shape and internal consistency only.
 *   Layer 3 — provider-bound target attestation. **Not implemented in this repository.**
 *
 * Because Layer 3 is unimplemented, this command has exactly two possible verdicts — `blocked`
 * and `provider_attestation_required` — and always exits nonzero. There is no input (flag, file,
 * environment variable, or forged object) that produces a success verdict, because the verdict
 * type itself has no success member. The future provider-adapter PR, separately reviewed, will be
 * the first change that can introduce one.
 *
 *   npx tsx scripts/literature-dedicated-supabase/preflight.ts --print-query-plans
 *   npx tsx scripts/literature-dedicated-supabase/preflight.ts \
 *     --owner-approved-commit <sha> \
 *     --application-mechanism supabase_connector_apply_migration_v1 \
 *     --evidence <path.json>
 */

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { requireLiteratureProviderAttestation } from '../../src/features/literature/dedicated-supabase/attestation'
import { LITERATURE_FOUNDATION_MIGRATION } from '../../src/features/literature/dedicated-supabase/foundation-manifest'
import { runCommand } from './lib/disposable-target'
import { LiteratureEvidenceError, parseLiteraturePreflightEvidence } from './lib/evidence-schema'
import type { LiteraturePreflightEvidenceDocument } from './lib/evidence-schema'
import {
  evaluateEvidenceContentPreflight,
  evaluateRepositoryPreflight,
  resolvePreflightOutcome,
  type PreflightCheck,
  type RepositoryFacts,
} from './lib/preflight-rules'
import { renderLiteratureQueryPlans } from './lib/target-observation'

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
  if (process.argv.includes('--print-query-plans')) {
    process.stdout.write(renderLiteratureQueryPlans())
    return
  }

  const evidencePath = flagValue('--evidence')
  let evidence: LiteraturePreflightEvidenceDocument | null = null
  let evidenceError: string | null = null
  if (evidencePath) {
    try {
      evidence = parseLiteraturePreflightEvidence(
        await readFile(resolve(ROOT, evidencePath), 'utf8'),
      )
    } catch (error) {
      evidenceError =
        error instanceof LiteratureEvidenceError
          ? `${error.code}: ${error.message}`
          : `unreadable evidence document: ${String(error)}`
    }
  }

  const repositoryChecks = evaluateRepositoryPreflight(await gatherRepositoryFacts())
  const evidenceChecks = evidenceError
    ? [
        {
          id: 'E00-evidence-parsed',
          description: 'the evidence document parsed under the strict preflight schema',
          passed: false,
          detail: evidenceError,
        },
      ]
    : evaluateEvidenceContentPreflight(evidence)

  process.stdout.write('Dedicated Literature foundation rollout — read-only preflight\n')
  report('Layer 1 — repository (blocking, non-authorizing)', repositoryChecks)
  report('Layer 2 — evidence content (NON-authoritative)', evidenceChecks)

  // Layer 3. The only place target identity could ever come from — and it is not implemented.
  // There is deliberately no flag, file, or environment variable that can substitute for it.
  const attestation = requireLiteratureProviderAttestation()
  process.stdout.write('\nLayer 3 — provider-bound target attestation\n')
  process.stdout.write(`  [FAIL] ${attestation.reason}\n`)
  process.stdout.write(`         ${attestation.detail}\n`)

  const outcome = resolvePreflightOutcome({ repositoryChecks, evidenceChecks })

  process.stdout.write(`\nVERDICT: ${outcome.verdict}\n`)
  process.stdout.write(`layers: ${outcome.layerSummaries.join(', ')}\n`)
  process.stdout.write(`${outcome.summary}\n`)
  process.stdout.write(
    '\nNo migration may be applied. This command never applies anything, and while the ' +
      'provider-bound adapter is unimplemented it cannot report readiness for anyone else to.\n',
  )
  // Both reachable verdicts block; the exit status is unconditionally nonzero while Layer 3 is
  // absent so no automation can chain a success path off this command.
  process.exitCode = 1
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
