/**
 * Read-only preflight for the dedicated Literature foundation rollout.
 *
 * Proves, before anything is applied, that the repository is at the reviewed commit, that exactly
 * one unaltered migration is selected, and that the target is the approved empty project. It holds
 * no credential and opens no connection: target facts come from a read-only observation the
 * operator captures separately, which this command can print the exact statements for.
 *
 *   npx tsx scripts/literature-dedicated-supabase/preflight.ts --print-observation-sql
 *   npx tsx scripts/literature-dedicated-supabase/preflight.ts \
 *     --approved-commit <sha> --observation <path.json>
 *
 * Exit code 0 means every check passed. Any missing input is a failure, never a pass.
 */

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { LITERATURE_FOUNDATION_MIGRATION } from '../../src/features/literature/dedicated-supabase/foundation-manifest'
import { runCommand } from './lib/disposable-target'
import {
  evaluateRepositoryPreflight,
  evaluateTargetPreflight,
  preflightApproved,
  type PreflightCheck,
  type RepositoryFacts,
} from './lib/preflight-rules'
import {
  LITERATURE_READ_ONLY_CATALOG_STATEMENT,
  LITERATURE_READ_ONLY_HISTORY_STATEMENT,
  LITERATURE_READ_ONLY_PREREQUISITE_STATEMENT,
  parseTargetObservation,
  type LiteratureTargetObservation,
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

async function gatherRepositoryFacts(approvedCommit?: string): Promise<RepositoryFacts> {
  const gitDirectory = (await git(['rev-parse', '--absolute-git-dir'])).text
  const commonDirectory = (await git(['rev-parse', '--git-common-dir'])).text
  const branch = (await git(['rev-parse', '--abbrev-ref', 'HEAD'])).text
  const headCommit = (await git(['rev-parse', 'HEAD'])).text
  const originMainCommit = (await git(['rev-parse', 'origin/main'], true)).text
  const status = (await git(['status', '--porcelain', '--untracked-files=no'])).text

  const migrationBytes = await readFile(resolve(ROOT, LITERATURE_FOUNDATION_MIGRATION.path))

  let headDescendsFromApprovedCommit: boolean | undefined
  if (approvedCommit) {
    if (approvedCommit === headCommit) {
      headDescendsFromApprovedCommit = true
    } else {
      const ancestry = await git(['merge-base', '--is-ancestor', approvedCommit, headCommit], true)
      headDescendsFromApprovedCommit = ancestry.code === 0
    }
  }

  return {
    checkoutPath: ROOT,
    isPrimaryCheckout: resolve(gitDirectory) === resolve(ROOT, commonDirectory),
    branch,
    headCommit,
    originMainCommit,
    workingTreeClean: status.length === 0,
    approvedCommit,
    headDescendsFromApprovedCommit,
    migrationSha256: createHash('sha256').update(migrationBytes).digest('hex'),
    migrationByteLength: migrationBytes.byteLength,
    selectedMigrationPaths: [LITERATURE_FOUNDATION_MIGRATION.path],
    deploymentMethod: flagValue('--deployment-method'),
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
  if (process.argv.includes('--print-observation-sql')) {
    process.stdout.write(
      [
        '-- Run each statement in a read-only session against the dedicated Literature project.',
        '-- Record the results in an observation JSON document. Never paste a credential here.',
        '',
        '-- 1) migrationVersions',
        LITERATURE_READ_ONLY_HISTORY_STATEMENT,
        '',
        '-- 2) catalog',
        LITERATURE_READ_ONLY_CATALOG_STATEMENT,
        '',
        '-- 3) prerequisites',
        LITERATURE_READ_ONLY_PREREQUISITE_STATEMENT,
        '',
      ].join('\n'),
    )
    return
  }

  const approvedCommit = flagValue('--approved-commit')
  const observationPath = flagValue('--observation')

  let observation: LiteratureTargetObservation | null = null
  if (observationPath) {
    observation = parseTargetObservation(await readFile(resolve(ROOT, observationPath), 'utf8'))
  }

  const repositoryChecks = evaluateRepositoryPreflight(await gatherRepositoryFacts(approvedCommit))
  const targetChecks = evaluateTargetPreflight(observation)

  process.stdout.write('Dedicated Literature foundation rollout — read-only preflight\n')
  report('Repository', repositoryChecks)
  report('Target', targetChecks)

  const all = [...repositoryChecks, ...targetChecks]
  const approved = preflightApproved(all)
  const failed = all.filter((entry) => !entry.passed)

  process.stdout.write(
    `\n${all.length - failed.length}/${all.length} checks passed. ` +
      `${approved ? 'PREFLIGHT APPROVED.' : 'PREFLIGHT BLOCKED.'}\n`,
  )
  if (!approved) {
    process.stdout.write(
      'No migration may be applied. This command never applies anything on its own.\n',
    )
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
