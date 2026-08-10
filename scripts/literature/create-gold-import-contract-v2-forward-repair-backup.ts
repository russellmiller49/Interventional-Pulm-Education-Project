import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  writeFile,
} from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const GOLD_IMPORT_CONTRACT_V2_BACKUP_SCHEMA_VERSION =
  'gold-import-contract-v2-forward-repair-backup/1.0.0' as const
export const GOLD_IMPORT_CONTRACT_V2_BACKUP_RECEIPT_SCHEMA_VERSION =
  'gold-import-contract-v2-forward-repair-backup-execution/1.0.0' as const
export const GOLD_IMPORT_CONTRACT_V2_BRANCH =
  'codex/ip-literature-import-contract-v2-forward-repair-v1' as const
export const GOLD_IMPORT_CONTRACT_V1_MIGRATION_PATH =
  'supabase/migrations/20260808035633_add_literature_gold_import_compensation_contract.sql' as const
export const GOLD_IMPORT_CONTRACT_V1_MIGRATION_SHA256 =
  'e846ef70a7b484460682a7ff61d579d3d6fdae3400805fa5395adc0464244528' as const

const COMMIT_PATTERN = /^[a-f0-9]{40}$/u
const EVIDENCE_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/u

export const REQUIRED_GOLD_IMPORT_CONTRACT_V2_BACKUP_EVIDENCE_NAMES = [
  'exact-package-report',
  'fresh-rehearsal-evidence',
  'historical-v1-identity',
  'merge-readiness-report',
  'note-disposition-audit',
  'real-local-preapplication-report',
  'schema-security-audit',
  'source-lineage-repair',
  'test-build-report',
  'upgrade-rehearsal-evidence',
] as const

interface EvidenceArgument {
  name: string
  source: string
}

interface ParsedArguments {
  evidence: EvidenceArgument[]
  output: string
  outputRoot: string
}

interface CopiedFile {
  bytes: number
  destination: string
  sha256: string
  source: string
}

function usage(): string {
  return `
Create a checksum-verified additive delivery backup for the gold import contract V2 repair.

Usage:
  npm run literature:backup-gold-import-contract-v2-forward-repair -- \\
    --output-root <EXISTING_BACKUP_ROOT> \\
    --output <NEW_GOLD_IMPORT_CONTRACT_V2_BACKUP_DIRECTORY> \\
    --evidence <NAME>=<FILE_OR_DIRECTORY> [--evidence ...]

The command is file-only. It requires the exact clean task branch, copies every
tracked path changed from origin/main, requires the complete named evidence
inventory, rejects symlinks and output collisions, and never contacts a database.

Required evidence names:
  ${REQUIRED_GOLD_IMPORT_CONTRACT_V2_BACKUP_EVIDENCE_NAMES.join(', ')}
`.trim()
}

function assertCompleteEvidenceInventory(evidence: readonly EvidenceArgument[]): void {
  const actual = evidence.map(({ name }) => name)
  if (new Set(actual).size !== actual.length) throw new Error('Evidence names must be unique.')
  const expected = [...REQUIRED_GOLD_IMPORT_CONTRACT_V2_BACKUP_EVIDENCE_NAMES]
  const missing = expected.filter((name) => !actual.includes(name))
  const unexpected = actual.filter(
    (name) =>
      !REQUIRED_GOLD_IMPORT_CONTRACT_V2_BACKUP_EVIDENCE_NAMES.includes(
        name as (typeof REQUIRED_GOLD_IMPORT_CONTRACT_V2_BACKUP_EVIDENCE_NAMES)[number],
      ),
  )
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `Backup evidence inventory is incomplete or unexpected; missing=${missing.join(',') || 'none'}; unexpected=${unexpected.join(',') || 'none'}.`,
    )
  }
}

export function parseGoldImportContractV2BackupArguments(argv: string[]): ParsedArguments {
  let outputRoot: string | undefined
  let output: string | undefined
  const evidence: EvidenceArgument[] = []
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--help') throw new Error(usage())
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}.`)
    if (argument === '--output-root') outputRoot = value
    else if (argument === '--output') output = value
    else if (argument === '--evidence') {
      const equals = value.indexOf('=')
      if (equals < 1 || equals === value.length - 1) {
        throw new Error('--evidence must use NAME=FILE_OR_DIRECTORY.')
      }
      const name = value.slice(0, equals)
      if (!EVIDENCE_NAME_PATTERN.test(name)) throw new Error(`Invalid evidence name: ${name}.`)
      evidence.push({ name, source: value.slice(equals + 1) })
    } else throw new Error(`Unknown argument: ${argument}.`)
    index += 1
  }
  if (!outputRoot || !output || evidence.length === 0) throw new Error(usage())
  assertCompleteEvidenceInventory(evidence)
  return { evidence, output, outputRoot }
}

function sha256(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function isWithin(parent: string, child: string): boolean {
  const path = relative(parent, child)
  return path !== '' && path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path)
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

async function assertOutputPath(outputRootArgument: string, outputArgument: string) {
  const outputRoot = resolve(outputRootArgument)
  const rootStat = await lstat(outputRoot)
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error('Backup root must be an existing real directory.')
  }
  const resolvedRoot = await realpath(outputRoot)
  const output = resolve(outputArgument)
  if (!isWithin(resolvedRoot, output)) throw new Error('Backup output must be inside its root.')
  if (await pathExists(output)) throw new Error('Backup output collision.')

  let ancestor = dirname(output)
  while (isWithin(resolvedRoot, ancestor)) {
    if (await pathExists(ancestor)) {
      const stat = await lstat(ancestor)
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new Error('Backup output path contains a non-directory or symlink ancestor.')
      }
      const resolvedAncestor = await realpath(ancestor)
      if (resolvedAncestor !== resolvedRoot && !isWithin(resolvedRoot, resolvedAncestor)) {
        throw new Error('Backup output ancestor escapes its approved root.')
      }
    }
    ancestor = dirname(ancestor)
  }
  return { output, outputRoot: resolvedRoot }
}

async function git(cwd: string, arguments_: string[]): Promise<string> {
  const result = await execFileAsync('git', arguments_, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  })
  return result.stdout.trim()
}

async function inspectRepository(cwd: string) {
  const [branch, head, originMain, status, mergeBase] = await Promise.all([
    git(cwd, ['branch', '--show-current']),
    git(cwd, ['rev-parse', 'HEAD']),
    git(cwd, ['rev-parse', 'origin/main']),
    git(cwd, ['status', '--porcelain=v1', '--untracked-files=all']),
    git(cwd, ['merge-base', 'origin/main', 'HEAD']),
  ])
  if (branch !== GOLD_IMPORT_CONTRACT_V2_BRANCH) throw new Error('Unexpected backup branch.')
  if (!COMMIT_PATTERN.test(head) || !COMMIT_PATTERN.test(originMain)) {
    throw new Error('Repository commit identity is malformed.')
  }
  if (status !== '') throw new Error('Backup requires a completely clean worktree.')
  if (mergeBase !== originMain) throw new Error('origin/main must be an ancestor of backup HEAD.')
  return { branch, head, originMain }
}

async function collectChangedTrackedPaths(cwd: string): Promise<string[]> {
  const output = await git(cwd, [
    'diff',
    '--name-only',
    '--diff-filter=ACMRT',
    'origin/main...HEAD',
    '--',
  ])
  const paths = output ? output.split('\n') : []
  if (paths.length === 0 || paths.some((path) => path === '' || path.startsWith('../'))) {
    throw new Error('Backup requires a nonempty, valid tracked change set.')
  }
  return [...paths].sort((left, right) => left.localeCompare(right, 'en'))
}

async function ensurePrivateDirectory(path: string): Promise<void> {
  await mkdir(path, { mode: 0o700, recursive: true })
  await chmod(path, 0o700)
}

async function copyRegularFile(source: string, destination: string): Promise<CopiedFile> {
  const stat = await lstat(source)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Refusing non-file input: ${source}`)
  await ensurePrivateDirectory(dirname(destination))
  await copyFile(source, destination)
  await chmod(destination, 0o600)
  const bytes = await readFile(destination)
  if (bytes.byteLength !== stat.size || sha256(bytes) !== sha256(await readFile(source))) {
    throw new Error(`Backup copy verification failed: ${source}`)
  }
  return { bytes: bytes.byteLength, destination, sha256: sha256(bytes), source }
}

async function copyEvidenceTree(
  source: string,
  destination: string,
  files: CopiedFile[],
): Promise<void> {
  const stat = await lstat(source)
  if (stat.isSymbolicLink()) throw new Error(`Evidence symlinks are forbidden: ${source}`)
  if (stat.isFile()) {
    files.push(await copyRegularFile(source, destination))
    return
  }
  if (!stat.isDirectory()) throw new Error(`Unsupported evidence input: ${source}`)
  await ensurePrivateDirectory(destination)
  const entries = await readdir(source, { withFileTypes: true })
  entries.sort((left, right) => left.name.localeCompare(right.name, 'en'))
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new Error(`Evidence symlinks are forbidden: ${entry.name}`)
    await copyEvidenceTree(join(source, entry.name), join(destination, entry.name), files)
  }
}

async function writePrivate(path: string, value: string): Promise<void> {
  await ensurePrivateDirectory(dirname(path))
  await writeFile(path, value, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
  await chmod(path, 0o600)
}

async function listFiles(root: string, directory = root): Promise<string[]> {
  const result: string[] = []
  const entries = await readdir(directory, { withFileTypes: true })
  entries.sort((left, right) => left.name.localeCompare(right.name, 'en'))
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isSymbolicLink()) throw new Error('Created backup contains a symlink.')
    if (entry.isDirectory()) result.push(...(await listFiles(root, path)))
    else if (entry.isFile()) result.push(relative(root, path))
    else throw new Error('Created backup contains an unsupported filesystem entry.')
  }
  return result
}

export async function createGoldImportContractV2ForwardRepairBackup(input: {
  cwd: string
  evidence: EvidenceArgument[]
  now?: () => Date
  output: string
  outputRoot: string
}) {
  assertCompleteEvidenceInventory(input.evidence)
  const repository = await inspectRepository(input.cwd)
  const expectedName = `gold-import-contract-v2-forward-repair-v1-${repository.head}`
  if (basename(resolve(input.output)) !== expectedName) {
    throw new Error(`Backup output basename must be ${expectedName}.`)
  }
  const paths = await assertOutputPath(input.outputRoot, input.output)
  const v1Bytes = await readFile(join(input.cwd, GOLD_IMPORT_CONTRACT_V1_MIGRATION_PATH))
  if (sha256(v1Bytes) !== GOLD_IMPORT_CONTRACT_V1_MIGRATION_SHA256) {
    throw new Error('Historical V1 migration byte identity changed.')
  }
  const changedPaths = await collectChangedTrackedPaths(input.cwd)

  await ensurePrivateDirectory(paths.output)
  const trackedFiles: CopiedFile[] = []
  for (const path of changedPaths) {
    trackedFiles.push(
      await copyRegularFile(join(input.cwd, path), join(paths.output, 'tracked', path)),
    )
  }
  const evidenceFiles: CopiedFile[] = []
  for (const evidence of [...input.evidence].sort((left, right) =>
    left.name.localeCompare(right.name, 'en'),
  )) {
    const source = resolve(evidence.source)
    const beforeFileCount = evidenceFiles.length
    await copyEvidenceTree(source, join(paths.output, 'evidence', evidence.name), evidenceFiles)
    if (evidenceFiles.length === beforeFileCount) {
      throw new Error(`Required evidence input is empty: ${evidence.name}.`)
    }
  }

  const portable = (file: CopiedFile) => ({
    bytes: file.bytes,
    destination: relative(paths.output, file.destination),
    sha256: file.sha256,
    source: file.source,
  })
  const manifest = {
    schemaVersion: GOLD_IMPORT_CONTRACT_V2_BACKUP_SCHEMA_VERSION,
    repository,
    historicalV1Migration: {
      path: GOLD_IMPORT_CONTRACT_V1_MIGRATION_PATH,
      sha256: GOLD_IMPORT_CONTRACT_V1_MIGRATION_SHA256,
      byteIdentical: true,
    },
    requiredEvidenceNames: REQUIRED_GOLD_IMPORT_CONTRACT_V2_BACKUP_EVIDENCE_NAMES,
    trackedFiles: trackedFiles.map(portable),
    evidenceFiles: evidenceFiles.map(portable),
    safety: {
      databaseAccessed: false,
      databaseMutationCount: 0,
      heldOutIdentitiesAccessed: false,
      remoteDatabaseAccessed: false,
      sourceArtifactsModified: false,
      signedAuthorizationsModified: false,
    },
  }
  const manifestPath = join(paths.output, 'backup-manifest.json')
  await writePrivate(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  const canonicalFiles = (await listFiles(paths.output)).filter(
    (path) => path !== 'checksum-manifest.sha256' && path !== 'backup-receipt.json',
  )
  const checksumLines: string[] = []
  for (const path of canonicalFiles) {
    checksumLines.push(`${sha256(await readFile(join(paths.output, path)))}  ${path}`)
  }
  const checksumManifest = `${checksumLines.join('\n')}\n`
  const checksumManifestPath = join(paths.output, 'checksum-manifest.sha256')
  await writePrivate(checksumManifestPath, checksumManifest)

  for (const line of checksumLines) {
    const match = /^([a-f0-9]{64})  (.+)$/u.exec(line)
    if (!match || sha256(await readFile(join(paths.output, match[2]!))) !== match[1]) {
      throw new Error('Backup checksum verification failed.')
    }
  }
  const receipt = {
    schemaVersion: GOLD_IMPORT_CONTRACT_V2_BACKUP_RECEIPT_SCHEMA_VERSION,
    executedAt: (input.now ?? (() => new Date()))().toISOString(),
    outputDirectory: paths.output,
    repositoryCommitSha: repository.head,
    canonicalFileCount: canonicalFiles.length,
    backupManifestSha256: sha256(await readFile(manifestPath)),
    checksumManifestSha256: sha256(await readFile(checksumManifestPath)),
    verificationPassed: true,
    databaseAccessed: false,
    databaseMutationCount: 0,
    heldOutIdentitiesAccessed: false,
    remoteDatabaseAccessed: false,
  }
  await writePrivate(
    join(paths.output, 'backup-receipt.json'),
    `${JSON.stringify(receipt, null, 2)}\n`,
  )
  return { manifest, receipt }
}

async function main(): Promise<void> {
  const arguments_ = parseGoldImportContractV2BackupArguments(process.argv.slice(2))
  const result = await createGoldImportContractV2ForwardRepairBackup({
    cwd: process.cwd(),
    ...arguments_,
  })
  process.stdout.write(
    `${JSON.stringify(
      {
        outputDirectory: result.receipt.outputDirectory,
        backupManifestSha256: result.receipt.backupManifestSha256,
        checksumManifestSha256: result.receipt.checksumManifestSha256,
        verificationPassed: true,
      },
      null,
      2,
    )}\n`,
  )
}

if (process.argv[1]?.endsWith('create-gold-import-contract-v2-forward-repair-backup.ts')) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
