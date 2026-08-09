import { createHash } from 'node:crypto'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lstat, readFile, readdir, realpath } from 'node:fs/promises'
import { TextDecoder } from 'node:util'

import {
  assertExclusiveOutputPath,
  canonicalJson,
  defaultCommandRunner,
  sealCanonicalArtifacts,
  sha256,
  writeCanonicalPackage,
  type CommandRunner,
} from './gold-import-compensation-migration-operations'
import {
  POST_MIGRATION_RECONCILIATION_BRANCH,
  assertReadOnlyReconciliationRepositoryGuard,
  inspectReadOnlyReconciliationRepositoryState,
} from './gold-import-compensation-read-only-guard'
import { assertKnownArguments, hasFlag, parseCliArguments, stringArgument } from './lib/cli'

export const POST_MIGRATION_RECONCILIATION_BACKUP_SCHEMA_VERSION =
  'post-migration-contract-reconciliation-backup/1.0.0' as const
export const POST_MIGRATION_RECONCILIATION_BACKUP_EXECUTION_SCHEMA_VERSION =
  'post-migration-contract-reconciliation-backup-execution/1.0.0' as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const SAFE_COMPONENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u
const BACKUP_DIRECTORY_PREFIX = 'post-migration-contract-reconciliation-v1-' as const

const HELP = `
Create the checksum-verified additive delivery backup for the post-migration reconciliation PR.

Usage:
  npm run literature:backup-post-migration-contract-reconciliation -- \
    --contract-diagnostic <directory> \
    --contract-diagnostic-manifest-sha256 <sha256> \
    --compatibility-audit <directory> \
    --compatibility-audit-manifest-sha256 <sha256> \
    --test-build-report <json> --merge-readiness-report <json> \
    --backup-root <existing-backup-root> \
    --output <post-migration-contract-reconciliation-v1-CURRENT_HEAD>

The command is file-only, requires a clean reviewed feature worktree, preserves every source byte,
and creates a new private directory with a sorted checksum manifest. It never contacts a database.
`.trim()

export interface PostMigrationReconciliationBackupDependencies {
  cwd?: string
  now?: () => Date
  runCommand?: CommandRunner
}

interface PreservedFile {
  gitMode?: string
  originalName: string
  sha256: string
  storedName: string
  text: string
}

function requiredArgument(arguments_: ReturnType<typeof parseCliArguments>, name: string): string {
  const value = stringArgument(arguments_, name)
  if (!value) throw new Error(`--${name} is required.`)
  return value
}

function assertSha256(value: string, label: string): void {
  if (!SHA256_PATTERN.test(value)) throw new Error(`${label} must be a lowercase SHA-256 digest.`)
}

function utf8(bytes: Buffer, label: string): string {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error(`${label} must be valid UTF-8.`)
  }
  if (!text.endsWith('\n') || text.endsWith('\n\n')) {
    throw new Error(`${label} must have exactly one final newline.`)
  }
  return text
}

function exactRecordKeys(
  value: unknown,
  expected: readonly string[],
  label: string,
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`)
  }
  const record = value as Record<string, unknown>
  const actual = Object.keys(record).sort()
  const wanted = [...expected].sort()
  if (canonicalJson(actual) !== canonicalJson(wanted)) {
    throw new Error(`${label} does not contain the exact allowed fields.`)
  }
  return record
}

async function readRegularFile(path: string, label: string): Promise<Buffer> {
  const absolutePath = resolve(path)
  const [stat, resolvedPath] = await Promise.all([lstat(absolutePath), realpath(absolutePath)])
  if (!stat.isFile() || stat.isSymbolicLink() || resolvedPath !== absolutePath) {
    throw new Error(`${label} must be a regular non-symlink file.`)
  }
  return readFile(absolutePath)
}

function parseCanonicalManifest(text: string): ReadonlyMap<string, string> {
  const entries = new Map<string, string>()
  let previousName = ''
  for (const line of text.trimEnd().split('\n')) {
    const match = /^([a-f0-9]{64})  ([A-Za-z0-9][A-Za-z0-9._-]*)$/u.exec(line)
    if (!match) throw new Error('Source checksum manifest contains a malformed entry.')
    const [, checksum, name] = match
    if (!checksum || !name || entries.has(name) || name <= previousName) {
      throw new Error('Source checksum manifest contains a missing, duplicate, or unsorted entry.')
    }
    entries.set(name, checksum)
    previousName = name
  }
  if (entries.size === 0) throw new Error('Source checksum manifest is empty.')
  return entries
}

export async function preserveAuditDirectory(input: {
  directory: string
  expectedManifestSha256: string
  expectedPostMigrationAuditManifestSha256?: string
  expectedRepositoryCommitSha: string
  prefix: 'compatibility-audit' | 'contract-diagnostic'
}): Promise<PreservedFile[]> {
  assertSha256(input.expectedManifestSha256, `${input.prefix} manifest SHA-256`)
  if (!/^[a-f0-9]{40}$/u.test(input.expectedRepositoryCommitSha)) {
    throw new Error(`${input.prefix} expected repository commit must be a 40-character SHA.`)
  }
  const directory = resolve(input.directory)
  const [stat, resolvedDirectory] = await Promise.all([lstat(directory), realpath(directory)])
  if (!stat.isDirectory() || stat.isSymbolicLink() || resolvedDirectory !== directory) {
    throw new Error(`${input.prefix} source must be a real non-symlink directory.`)
  }
  const names = (await readdir(directory)).sort((left, right) => left.localeCompare(right, 'en'))
  if (names.some((name) => !SAFE_COMPONENT_PATTERN.test(name))) {
    throw new Error(`${input.prefix} contains an unsafe filename.`)
  }
  const sourceFiles = await Promise.all(
    names.map(async (name) => {
      const bytes = await readRegularFile(resolve(directory, name), `${input.prefix}/${name}`)
      return { bytes, name, text: utf8(bytes, `${input.prefix}/${name}`) }
    }),
  )
  const manifestFile = sourceFiles.find(({ name }) => name === 'checksum-manifest.sha256')
  if (!manifestFile || sha256(manifestFile.bytes) !== input.expectedManifestSha256) {
    throw new Error(`${input.prefix} does not match its reviewed canonical manifest SHA-256.`)
  }
  const manifestEntries = parseCanonicalManifest(manifestFile.text)
  for (const [name, checksum] of manifestEntries) {
    const source = sourceFiles.find((file) => file.name === name)
    if (!source || sha256(source.bytes) !== checksum) {
      throw new Error(`${input.prefix} checksum mismatch for ${name}.`)
    }
  }
  const expectedNames = new Set([
    ...manifestEntries.keys(),
    'checksum-manifest.sha256',
    'execution-receipt.json',
  ])
  if (
    expectedNames.size !== sourceFiles.length ||
    sourceFiles.some(({ name }) => !expectedNames.has(name))
  ) {
    throw new Error(
      `${input.prefix} contains an unmanifested, missing, or unexpected source artifact.`,
    )
  }
  const receiptFile = sourceFiles.find(({ name }) => name === 'execution-receipt.json')
  let receipt: unknown
  try {
    receipt = JSON.parse(receiptFile?.text ?? '') as unknown
  } catch {
    throw new Error(`${input.prefix} execution receipt must be valid JSON.`)
  }
  if (
    !receipt ||
    typeof receipt !== 'object' ||
    Array.isArray(receipt) ||
    (receipt as Record<string, unknown>).canonicalManifestSha256 !== input.expectedManifestSha256 ||
    (receipt as Record<string, unknown>).repositoryCommitSha !==
      input.expectedRepositoryCommitSha ||
    canonicalJson(receipt) !== receiptFile?.text
  ) {
    throw new Error(
      `${input.prefix} execution receipt is not canonical or does not bind the reviewed manifest and repository commit.`,
    )
  }
  const receiptRecord = receipt as Record<string, unknown>
  if (input.prefix === 'contract-diagnostic') {
    exactRecordKeys(
      receiptRecord,
      [
        'canonicalManifestSha256',
        'compensationExecuted',
        'databaseContainer',
        'databaseMutationCount',
        'executedAt',
        'heldOutIdentitiesAccessed',
        'importExecuted',
        'mode',
        'outputDirectory',
        'preMigrationBackupDirectory',
        'preMigrationBackupManifestSha256',
        'remoteDatabaseAccessed',
        'repositoryCommitSha',
        'repositoryRoot',
        'requestedNameDiscrepancies',
        'schemaVersion',
      ],
      'contract-diagnostic execution receipt',
    )
    const auditFile = sourceFiles.find(({ name }) => name === 'migration-audit.json')
    let audit: unknown
    try {
      audit = JSON.parse(auditFile?.text ?? '') as unknown
    } catch {
      throw new Error('contract-diagnostic migration audit must be valid JSON.')
    }
    const auditDatabase =
      audit && typeof audit === 'object' && !Array.isArray(audit)
        ? (audit as Record<string, unknown>).database
        : null
    if (
      !auditFile ||
      canonicalJson(audit) !== auditFile.text ||
      !auditDatabase ||
      typeof auditDatabase !== 'object' ||
      Array.isArray(auditDatabase) ||
      (auditDatabase as Record<string, unknown>).repositoryCommitSha !==
        input.expectedRepositoryCommitSha ||
      receiptRecord.mode !== 'read_only_diagnostic' ||
      receiptRecord.databaseMutationCount !== 0 ||
      receiptRecord.heldOutIdentitiesAccessed !== false ||
      receiptRecord.importExecuted !== false ||
      receiptRecord.compensationExecuted !== false ||
      receiptRecord.remoteDatabaseAccessed !== false
    ) {
      throw new Error(
        'contract-diagnostic canonical audit/receipt does not bind the exact commit and zero-mutation safety contract.',
      )
    }
  } else {
    exactRecordKeys(
      receiptRecord,
      [
        'canonicalArtifactCount',
        'canonicalManifestSha256',
        'executedAt',
        'kind',
        'mode',
        'outputDirectory',
        'packageReady',
        'repositoryCommitSha',
        'safety',
        'schemaVersion',
        'sources',
        'terminalState',
      ],
      'compatibility-audit execution receipt',
    )
    const upstreamManifest = input.expectedPostMigrationAuditManifestSha256
    if (!upstreamManifest) {
      throw new Error('compatibility-audit requires its source diagnostic manifest binding.')
    }
    assertSha256(upstreamManifest, 'compatibility-audit source diagnostic manifest SHA-256')
    const compatibilityFile = sourceFiles.find(
      ({ name }) => name === 'existing-head-compatibility-audit.json',
    )
    let compatibility: unknown
    try {
      compatibility = JSON.parse(compatibilityFile?.text ?? '') as unknown
    } catch {
      throw new Error('compatibility-audit canonical report must be valid JSON.')
    }
    const compatibilityRecord =
      compatibility && typeof compatibility === 'object' && !Array.isArray(compatibility)
        ? (compatibility as Record<string, unknown>)
        : null
    const sourceBindings = compatibilityRecord?.sourceBindings
    const canonicalSafety = compatibilityRecord?.safety
    const receiptSources = receiptRecord.sources
    const receiptSafety = receiptRecord.safety
    exactRecordKeys(
      receiptSources,
      [
        'artifactPath',
        'auditPath',
        'compatibilitySupplementContentSha256',
        'compatibilitySupplementFileSha256',
        'finalV3ArtifactSha256',
        'postMigrationAuditManifestSha256',
      ],
      'compatibility-audit receipt sources',
    )
    exactRecordKeys(
      receiptSafety,
      [
        'compensationExecuted',
        'databaseMutationCount',
        'databaseQueriesExecuted',
        'heldOutIdentitiesAccessed',
        'importExecuted',
        'remoteDatabaseAccessed',
        'sourceArtifactBytesPreserved',
        'sourceArtifactWritten',
      ],
      'compatibility-audit receipt safety',
    )
    if (
      !compatibilityFile ||
      canonicalJson(compatibility) !== compatibilityFile.text ||
      compatibilityRecord?.contractAuditReady !== true ||
      !sourceBindings ||
      typeof sourceBindings !== 'object' ||
      Array.isArray(sourceBindings) ||
      (sourceBindings as Record<string, unknown>).postMigrationAuditManifestSha256 !==
        upstreamManifest ||
      !canonicalSafety ||
      typeof canonicalSafety !== 'object' ||
      Array.isArray(canonicalSafety) ||
      (canonicalSafety as Record<string, unknown>).databaseMutationCount !== 0 ||
      (canonicalSafety as Record<string, unknown>).databaseQueriesExecuted !== 0 ||
      (canonicalSafety as Record<string, unknown>).heldOutIdentitiesAccessed !== false ||
      (canonicalSafety as Record<string, unknown>).importExecuted !== false ||
      (canonicalSafety as Record<string, unknown>).compensationExecuted !== false ||
      (canonicalSafety as Record<string, unknown>).remoteDatabaseAccessed !== false ||
      receiptRecord.mode !== 'file_only_read_only' ||
      !receiptSources ||
      typeof receiptSources !== 'object' ||
      Array.isArray(receiptSources) ||
      (receiptSources as Record<string, unknown>).postMigrationAuditManifestSha256 !==
        upstreamManifest ||
      !receiptSafety ||
      typeof receiptSafety !== 'object' ||
      Array.isArray(receiptSafety) ||
      (receiptSafety as Record<string, unknown>).databaseMutationCount !== 0 ||
      (receiptSafety as Record<string, unknown>).databaseQueriesExecuted !== 0 ||
      (receiptSafety as Record<string, unknown>).heldOutIdentitiesAccessed !== false ||
      (receiptSafety as Record<string, unknown>).importExecuted !== false ||
      (receiptSafety as Record<string, unknown>).compensationExecuted !== false ||
      (receiptSafety as Record<string, unknown>).remoteDatabaseAccessed !== false
    ) {
      throw new Error(
        'compatibility-audit does not bind the exact diagnostic manifest or zero-mutation safety contract.',
      )
    }
  }
  return sourceFiles.map(({ bytes, name, text }) => ({
    originalName: name,
    sha256: sha256(bytes),
    storedName: `${input.prefix}--${name}`,
    text,
  }))
}

export async function canonicalReport(
  path: string,
  label: string,
): Promise<{
  sha256: string
  text: string
}> {
  const bytes = await readRegularFile(path, label)
  let parsed: unknown
  try {
    parsed = JSON.parse(utf8(bytes, label)) as unknown
  } catch (error) {
    throw new Error(
      `${label} must be JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  const canonical = canonicalJson(parsed)
  if (canonical !== bytes.toString('utf8')) {
    throw new Error(`${label} must already use the canonical JSON byte representation.`)
  }
  return { sha256: sha256(bytes), text: canonical }
}

export async function preserveChangedTrackedFiles(input: {
  cwd: string
  head: string
  originMain: string
  runCommand: CommandRunner
}): Promise<PreservedFile[]> {
  const changed = await input.runCommand(
    'git',
    ['diff', '--name-only', '--diff-filter=AM', `${input.originMain}...${input.head}`, '--'],
    { cwd: input.cwd },
  )
  const removed = await input.runCommand(
    'git',
    ['diff', '--name-only', '--diff-filter=DR', `${input.originMain}...${input.head}`, '--'],
    { cwd: input.cwd },
  )
  if (removed.stdout.trim()) {
    throw new Error('Backup requires explicit handling for deleted or renamed tracked files.')
  }
  const paths = changed.stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, 'en'))
  if (paths.length === 0 || new Set(paths).size !== paths.length) {
    throw new Error('No unique changed tracked files were found for the reconciliation commit.')
  }
  const preserved = await Promise.all(
    paths.map(async (path) => {
      if (path.startsWith('/') || path.split('/').some((component) => component === '..')) {
        throw new Error(`Changed tracked path is unsafe: ${path}.`)
      }
      const bytes = await readRegularFile(resolve(input.cwd, path), `changed tracked file ${path}`)
      const modeResult = await input.runCommand('git', ['ls-tree', input.head, '--', path], {
        cwd: input.cwd,
      })
      const gitObject = /^(100644|100755) blob ([a-f0-9]{40})\t/u.exec(modeResult.stdout)
      const mode = gitObject?.[1]
      const blobOid = gitObject?.[2]
      if (!mode || !blobOid) {
        throw new Error(`Changed tracked file has an unsupported Git object: ${path}.`)
      }
      const workingTreeBlobOid = createHash('sha1')
        .update(`blob ${bytes.length}\0`)
        .update(bytes)
        .digest('hex')
      if (workingTreeBlobOid !== blobOid) {
        throw new Error(`Changed tracked file does not match exact commit ${input.head}: ${path}.`)
      }
      const storedName = `tracked--${sha256(path).slice(0, 16)}--${basename(path)}`
      if (!SAFE_COMPONENT_PATTERN.test(storedName)) {
        throw new Error(`Changed tracked backup name is unsafe: ${storedName}.`)
      }
      return {
        gitMode: mode,
        originalName: path,
        sha256: sha256(bytes),
        storedName,
        text: utf8(bytes, `changed tracked file ${path}`),
      }
    }),
  )
  if (new Set(preserved.map(({ storedName }) => storedName)).size !== preserved.length) {
    throw new Error('Changed tracked backup filenames collided.')
  }
  return preserved
}

export async function runCreatePostMigrationContractReconciliationBackup(
  argv: readonly string[],
  dependencies: PostMigrationReconciliationBackupDependencies = {},
) {
  const arguments_ = parseCliArguments([...argv])
  assertKnownArguments(arguments_, [
    'backup-root',
    'commit',
    'compatibility-audit',
    'compatibility-audit-manifest-sha256',
    'contract-diagnostic',
    'contract-diagnostic-manifest-sha256',
    'help',
    'merge-readiness-report',
    'output',
    'test-build-report',
  ])
  if (hasFlag(arguments_, 'help')) return { help: HELP }
  if (hasFlag(arguments_, 'commit') || arguments_.values.has('commit')) {
    throw new Error('The additive backup command has no commit or database-write mode.')
  }

  const cwd = resolve(dependencies.cwd ?? process.cwd())
  const runCommand = dependencies.runCommand ?? defaultCommandRunner
  const repository = await inspectReadOnlyReconciliationRepositoryState(cwd, runCommand)
  assertReadOnlyReconciliationRepositoryGuard(repository)
  if (repository.branch !== POST_MIGRATION_RECONCILIATION_BRANCH) {
    throw new Error('Backup branch does not match the reconciliation branch.')
  }
  const rawBackupRoot = requiredArgument(arguments_, 'backup-root')
  const rawOutput = requiredArgument(arguments_, 'output')
  const outputDirectory = await assertExclusiveOutputPath({
    backupRoot: rawBackupRoot,
    cwd,
    output: rawOutput,
  })
  if (basename(outputDirectory) !== `${BACKUP_DIRECTORY_PREFIX}${repository.head}`) {
    throw new Error('Backup output directory must end with the exact current 40-character HEAD.')
  }

  const [diagnosticFiles, compatibilityFiles, trackedFiles, validation, mergeReadiness] =
    await Promise.all([
      preserveAuditDirectory({
        directory: requiredArgument(arguments_, 'contract-diagnostic'),
        expectedManifestSha256: requiredArgument(arguments_, 'contract-diagnostic-manifest-sha256'),
        expectedRepositoryCommitSha: repository.head,
        prefix: 'contract-diagnostic',
      }),
      preserveAuditDirectory({
        directory: requiredArgument(arguments_, 'compatibility-audit'),
        expectedManifestSha256: requiredArgument(arguments_, 'compatibility-audit-manifest-sha256'),
        expectedPostMigrationAuditManifestSha256: requiredArgument(
          arguments_,
          'contract-diagnostic-manifest-sha256',
        ),
        expectedRepositoryCommitSha: repository.head,
        prefix: 'compatibility-audit',
      }),
      preserveChangedTrackedFiles({
        cwd,
        head: repository.head,
        originMain: repository.originMain,
        runCommand,
      }),
      canonicalReport(requiredArgument(arguments_, 'test-build-report'), 'test/build report'),
      canonicalReport(
        requiredArgument(arguments_, 'merge-readiness-report'),
        'merge-readiness report',
      ),
    ])
  const repositoryAfterRead = await inspectReadOnlyReconciliationRepositoryState(cwd, runCommand)
  assertReadOnlyReconciliationRepositoryGuard(repositoryAfterRead)
  if (
    repositoryAfterRead.head !== repository.head ||
    repositoryAfterRead.originMain !== repository.originMain
  ) {
    throw new Error('Repository identity changed while the additive backup inputs were read.')
  }
  const allPreserved = [...trackedFiles, ...diagnosticFiles, ...compatibilityFiles]
  if (new Set(allPreserved.map(({ storedName }) => storedName)).size !== allPreserved.length) {
    throw new Error('Backup artifact names collided.')
  }
  const index = {
    schemaVersion: POST_MIGRATION_RECONCILIATION_BACKUP_SCHEMA_VERSION,
    repository: {
      branch: repository.branch,
      commitSha: repository.head,
      originMainSha: repository.originMain,
    },
    sources: {
      changedTrackedFiles: trackedFiles.map(({ gitMode, originalName, sha256, storedName }) => ({
        gitMode,
        originalName,
        sha256,
        storedName,
      })),
      compatibilityAudit: compatibilityFiles.map(({ originalName, sha256, storedName }) => ({
        originalName,
        sha256,
        storedName,
      })),
      contractDiagnostic: diagnosticFiles.map(({ originalName, sha256, storedName }) => ({
        originalName,
        sha256,
        storedName,
      })),
      mergeReadinessSourceSha256: mergeReadiness.sha256,
      testBuildSourceSha256: validation.sha256,
    },
    safety: {
      additiveBackup: true,
      databaseAccessed: false,
      databaseMutationCount: 0,
      heldOutIdentitiesAccessed: false,
      importExecuted: false,
      compensationExecuted: false,
      remoteDatabaseAccessed: false,
    },
  }
  const files = new Map<string, string>(
    allPreserved.map(({ storedName, text }) => [storedName, text]),
  )
  files.set('backup-index.json', canonicalJson(index))
  files.set('merge-readiness-report.json', mergeReadiness.text)
  files.set('test-build-report.json', validation.text)
  const artifacts = sealCanonicalArtifacts(files)
  await writeCanonicalPackage({
    artifacts,
    outputDirectory,
    outputRoot: resolve(cwd, rawBackupRoot),
    executionReceipt: {
      schemaVersion: POST_MIGRATION_RECONCILIATION_BACKUP_EXECUTION_SCHEMA_VERSION,
      executedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
      repositoryRoot: cwd,
      repositoryCommitSha: repository.head,
      outputDirectory,
      canonicalManifestSha256: artifacts.manifestSha256,
      preservedFileCount: files.size,
      mode: 'file_only_additive_backup',
      databaseAccessed: false,
      databaseMutationCount: 0,
      heldOutIdentitiesAccessed: false,
      importExecuted: false,
      compensationExecuted: false,
      remoteDatabaseAccessed: false,
    },
  })
  return {
    outputDirectory,
    manifestSha256: artifacts.manifestSha256,
    repositoryCommitSha: repository.head,
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  void runCreatePostMigrationContractReconciliationBackup(process.argv.slice(2))
    .then((result) => {
      if ('help' in result) {
        console.log(result.help)
        return
      }
      console.log(`${JSON.stringify(result, null, 2)}\n`)
      console.log('Database access: 0; mutations: 0; held-out identities: 0; remote access: 0')
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
}
