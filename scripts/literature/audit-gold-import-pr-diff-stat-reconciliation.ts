import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { canonicalJson } from '../../src/features/literature/gold-set/import-compensation'
import { assertKnownArguments, parseCliArguments, stringArgument } from './lib/cli'
import {
  assertExclusiveOutputDirectoryIdentity,
  assertSafeOutputPathArgument,
  createExclusiveOutputDirectory,
  writeExclusiveOutputFiles,
} from './lib/exclusive-output'
import {
  assertReadOnlyReconciliationRepositoryGuard,
  inspectReadOnlyReconciliationRepositoryState,
} from './gold-import-compensation-read-only-guard'
import {
  defaultCommandRunner,
  type CommandRunner,
} from './gold-import-compensation-migration-operations'

export const GOLD_IMPORT_DIFF_STAT_RECONCILIATION_SCHEMA_VERSION =
  'gold-import-pr-diff-stat-reconciliation/1.0.0' as const
export const GOLD_IMPORT_DIFF_STAT_EXECUTION_SCHEMA_VERSION =
  'gold-import-pr-diff-stat-reconciliation-execution/1.0.0' as const

const EXPECTED_BRANCH = 'codex/ip-literature-post-migration-contract-reconciliation-v1'
const EXPECTED_STARTING_HEAD = 'aab05aa2c3ef9aab88730e78b42e0b8725a80af6'
const COMMIT_SHA_PATTERN = /^[a-f0-9]{40}$/u

interface PullRequestStats {
  additions: number
  baseRefName: string
  changedFiles: number
  deletions: number
  headRefName: string
  headRefOid: string
  isDraft: boolean
  mergeable: string
  mergedAt: string | null
  number: number
  state: string
}

export interface GoldImportDiffStatReconciliationInput {
  branch: string
  generatedAt: string
  gitDiffNumstatStdout: string
  gitDiffStatStdout: string
  head: string
  originMain: string
  pullRequest: PullRequestStats
  worktreePorcelainStdout: string
}

function nonnegativeInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(`${label} must be a nonnegative integer.`)
  }
  return Number(value)
}

function parseNumstat(stdout: string) {
  if (!stdout.endsWith('\n') && stdout.length > 0) {
    throw new Error('git diff --numstat output must end with LF.')
  }
  const paths = new Set<string>()
  return stdout
    .trimEnd()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const match = /^(\d+)\t(\d+)\t(.+)$/u.exec(line)
      if (!match) throw new Error('git diff --numstat contained a binary or malformed entry.')
      const path = match[3]!
      if (paths.has(path)) throw new Error('git diff --numstat contained a duplicate path.')
      paths.add(path)
      return {
        additions: Number(match[1]),
        deletions: Number(match[2]),
        path,
      }
    })
}

export function buildGoldImportDiffStatReconciliation(
  input: GoldImportDiffStatReconciliationInput,
) {
  if (
    input.branch !== EXPECTED_BRANCH ||
    !COMMIT_SHA_PATTERN.test(input.head) ||
    !COMMIT_SHA_PATTERN.test(input.originMain)
  ) {
    throw new Error('Diff-stat reconciliation repository identity is invalid.')
  }
  if (input.worktreePorcelainStdout !== '') {
    throw new Error('Diff-stat reconciliation requires no tracked, untracked, or temporary files.')
  }
  const pullRequest = input.pullRequest
  if (
    pullRequest.number !== 89 ||
    pullRequest.state !== 'OPEN' ||
    !pullRequest.isDraft ||
    pullRequest.mergedAt !== null ||
    pullRequest.baseRefName !== 'main' ||
    pullRequest.headRefName !== EXPECTED_BRANCH ||
    pullRequest.headRefOid !== input.head
  ) {
    throw new Error('Draft PR #89 does not match the exact final branch and HEAD.')
  }
  const rows = parseNumstat(input.gitDiffNumstatStdout)
  const git = {
    changedFiles: rows.length,
    additions: rows.reduce((total, row) => total + row.additions, 0),
    deletions: rows.reduce((total, row) => total + row.deletions, 0),
  }
  const github = {
    changedFiles: nonnegativeInteger(pullRequest.changedFiles, 'GitHub changedFiles'),
    additions: nonnegativeInteger(pullRequest.additions, 'GitHub additions'),
    deletions: nonnegativeInteger(pullRequest.deletions, 'GitHub deletions'),
  }
  if (
    git.changedFiles !== github.changedFiles ||
    git.additions !== github.additions ||
    git.deletions !== github.deletions
  ) {
    throw new Error('Git three-dot statistics and GitHub PR statistics disagree.')
  }
  return {
    schemaVersion: GOLD_IMPORT_DIFF_STAT_RECONCILIATION_SCHEMA_VERSION,
    generatedAt: input.generatedAt,
    repository: {
      branch: input.branch,
      head: input.head,
      originMain: input.originMain,
      originMainIsAncestor: true,
      trackedUntrackedAndTemporaryStatusClean: true,
    },
    pullRequest: {
      number: pullRequest.number,
      state: pullRequest.state,
      isDraft: pullRequest.isDraft,
      mergedAt: pullRequest.mergedAt,
      mergeable: pullRequest.mergeable,
      baseRefName: pullRequest.baseRefName,
      headRefName: pullRequest.headRefName,
      headRefOid: pullRequest.headRefOid,
    },
    commands: {
      gitDiffStat: 'git diff --stat origin/main...HEAD',
      gitDiffNumstat: 'git diff --numstat origin/main...HEAD',
      githubPullRequest:
        'gh pr view 89 --json number,state,isDraft,mergedAt,mergeable,baseRefName,headRefName,headRefOid,changedFiles,additions,deletions',
    },
    startingHeadObservation: {
      head: EXPECTED_STARTING_HEAD,
      basis:
        'Git three-dot diff and GitHub PR #89 agreed after fetch at correction-pass preflight.',
      changedFiles: 30,
      additions: 14_413,
      deletions: 277,
    },
    priorApproximateReport: {
      changedFiles: 29,
      additions: 3_707,
      deletions: 229,
      exactSourceLocated: false,
      explainsAuthoritativeDifference: false,
    },
    explanation: {
      generatedUntrackedOrTemporaryFilesExplainDifference: false,
      reason:
        'The exact discrepancy is a basis mismatch: the prior approximate numbers have no recorded source command and are not reproducible from the fetched starting commit, commit history, or any authoritative full-branch three-dot comparison, whereas the complete Git three-dot range and GitHub PR counters agree. Generated, untracked, and temporary files did not contribute. The original unrecorded calculation cannot be reconstructed and is not evidence.',
    },
    authoritativeFinal: {
      basis: 'git_three_dot_and_github_pr_agree',
      ...git,
    },
    gitDiffStat: input.gitDiffStatStdout,
    gitDiffNumstat: rows,
  } as const
}

function canonicalPretty(value: unknown): Buffer {
  const normalized = JSON.parse(canonicalJson(value)) as unknown
  return Buffer.from(`${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
}

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function requiredArgument(arguments_: ReturnType<typeof parseCliArguments>, name: string): string {
  const value = stringArgument(arguments_, name)
  if (!value) throw new Error(`--${name} is required.`)
  return value
}

const HELP = `
Reconcile the final draft PR #89 diff statistics from Git and GitHub without changing the repository.

Usage:
  tsx scripts/literature/audit-gold-import-pr-diff-stat-reconciliation.ts \\
    --output-root <approved-local-output-root> --output <new-output-directory>
`.trim()

export async function runGoldImportDiffStatReconciliation(
  argv: readonly string[],
  dependencies: {
    cwd?: string
    now?: () => Date
    runCommand?: CommandRunner
  } = {},
) {
  const arguments_ = parseCliArguments([...argv])
  assertKnownArguments(arguments_, ['help', 'output', 'output-root'])
  if (arguments_.flags.has('help')) return { help: HELP }
  const outputRootArgument = requiredArgument(arguments_, 'output-root')
  const outputArgument = requiredArgument(arguments_, 'output')
  assertSafeOutputPathArgument(outputRootArgument, '--output-root')
  assertSafeOutputPathArgument(outputArgument, '--output')
  const cwd = resolve(dependencies.cwd ?? process.cwd())
  const runCommand = dependencies.runCommand ?? defaultCommandRunner
  const repository = await inspectReadOnlyReconciliationRepositoryState(cwd, runCommand)
  assertReadOnlyReconciliationRepositoryGuard(repository)
  const [stat, numstat, status, pullRequestResult] = await Promise.all([
    runCommand('git', ['diff', '--stat', 'origin/main...HEAD'], { cwd }),
    runCommand('git', ['diff', '--numstat', 'origin/main...HEAD'], { cwd }),
    runCommand('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd }),
    runCommand(
      'gh',
      [
        'pr',
        'view',
        '89',
        '--json',
        'number,state,isDraft,mergedAt,mergeable,baseRefName,headRefName,headRefOid,changedFiles,additions,deletions',
      ],
      { cwd },
    ),
  ])
  let pullRequest: PullRequestStats
  try {
    pullRequest = JSON.parse(pullRequestResult.stdout) as PullRequestStats
  } catch {
    throw new Error('gh pr view returned invalid JSON.')
  }
  const report = buildGoldImportDiffStatReconciliation({
    branch: repository.branch,
    generatedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
    gitDiffNumstatStdout: numstat.stdout,
    gitDiffStatStdout: stat.stdout,
    head: repository.head,
    originMain: repository.originMain,
    pullRequest,
    worktreePorcelainStdout: status.stdout,
  })
  const reportBytes = canonicalPretty(report)
  const manifestBytes = Buffer.from(
    `${sha256(reportBytes)}  diff-stat-reconciliation.json\n`,
    'utf8',
  )
  const outputRoot = resolve(outputRootArgument)
  const outputDirectory = resolve(outputArgument)
  const identity = await createExclusiveOutputDirectory({ outputDirectory, outputRoot })
  const receipt = {
    schemaVersion: GOLD_IMPORT_DIFF_STAT_EXECUTION_SCHEMA_VERSION,
    kind: 'read_only_git_and_github_diff_stat_reconciliation',
    repositoryCommitSha: repository.head,
    canonicalManifestSha256: sha256(manifestBytes),
    repositoryMutationCount: 0,
  }
  writeExclusiveOutputFiles(identity, [
    { name: 'diff-stat-reconciliation.json', bytes: reportBytes },
    { name: 'checksum-manifest.sha256', bytes: manifestBytes },
    { name: 'execution-receipt.json', bytes: canonicalPretty(receipt) },
  ])
  await assertExclusiveOutputDirectoryIdentity(identity)
  return {
    manifestSha256: sha256(manifestBytes),
    outputDirectory,
    reportSha256: sha256(reportBytes),
    stats: report.authoritativeFinal,
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  void runGoldImportDiffStatReconciliation(process.argv.slice(2))
    .then((result) => console.log(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
}
