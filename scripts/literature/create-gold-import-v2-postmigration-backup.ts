import { createHash, randomBytes } from 'node:crypto'
import { execFile } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { lstat, readFile, readdir, realpath } from 'node:fs/promises'
import { basename, dirname, relative, resolve, sep } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

import { z } from 'zod'

import { canonicalJson } from '../../src/features/literature/gold-set/import-compensation'
import {
  GOLD_IMPORT_V2_CURRENT_BACKUP_SCHEMA_VERSION,
  GOLD_IMPORT_V2_CURRENT_LIFECYCLE_COMPATIBILITY,
} from './gold-import-v2-lifecycle-compatibility'
import { GOLD_IMPORT_V2_FINALIZED_RECEIPT_AUTHORITY_IDENTITY_SHA256 } from './gold-import-v2-package-readiness'
import {
  GOLD_IMPORT_V2_PREIMPORT_RUNTIME_REQUIRED_FILES,
  buildGoldImportV2PreimportRuntimeBundle,
  loadGoldImportV2PreimportRuntimeBundle,
  validateGoldImportV2PreimportRuntimeBundle,
  type GoldImportV2PreimportRuntimeBundle,
} from './gold-import-v2-preimport-capture'
import { GOLD_IMPORT_V2_FIXED_LOCAL_TARGET_OBSERVATION_SCHEMA_VERSION } from './gold-import-v2-fixed-local-target'
import {
  assertExclusiveOutputDirectoryIdentity,
  assertSafeOutputPathArgument,
  createStagedExclusiveOutputDirectory,
  discardStagedExclusiveOutputDirectory,
  publishStagedExclusiveOutputDirectory,
  writeExclusiveOutputFiles,
} from './lib/exclusive-output'

export const GOLD_IMPORT_V2_CURRENT_BACKUP_RECEIPT_SCHEMA_VERSION =
  'literature-gold-v2-postmigration-delivery-backup-receipt/1.0.0' as const
export const GOLD_IMPORT_V2_CURRENT_BACKUP_BRANCH =
  'codex/ip-literature-post-v2-preimport-capture-v1' as const
export const GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE =
  '0d8a687e5982a88063e72e2c7cb7bed530a1517f' as const
export const GOLD_IMPORT_V2_CURRENT_BACKUP_ROOT =
  '/Users/russellmiller/Documents/Interventional-Pulm-Education-Data-Backups' as const

export const GOLD_IMPORT_V2_CURRENT_BACKUP_EVIDENCE_NAMES = [
  'independent-review-finding-report',
  'before-after-reproductions',
  'observed-target-contract',
  'backup-authority-specification',
  'contract-version-compatibility-matrix',
  'publication-bracketing-specification',
  'race-test-evidence',
  'disposable-validation',
  'real-local-read-only-report',
  'critic-report',
  'full-test-build-report',
  'merge-readiness-report',
  'final-pr-body',
] as const

export type GoldImportV2CurrentBackupEvidenceName =
  (typeof GOLD_IMPORT_V2_CURRENT_BACKUP_EVIDENCE_NAMES)[number]

const execFileAsync = promisify(execFile)
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u)
const commitSchema = z.string().regex(/^[a-f0-9]{40}$/u)

const archivedFileSchema = z
  .object({
    archiveName: z.string().regex(/^[a-z0-9][a-z0-9._-]+$/u),
    bytes: z.number().int().nonnegative(),
    kind: z.enum(['changed_tracked_file', 'evidence', 'runtime_source']),
    name: z.string().min(1),
    sha256: sha256Schema,
    sourcePath: z.string().min(1),
  })
  .strict()

const backupAuthorityBodySchema = z
  .object({
    changedTrackedFiles: z.array(archivedFileSchema).min(1),
    evidence: z
      .array(archivedFileSchema)
      .length(GOLD_IMPORT_V2_CURRENT_BACKUP_EVIDENCE_NAMES.length),
    finalizedReceiptAuthorityIdentitySha256: z.literal(
      GOLD_IMPORT_V2_FINALIZED_RECEIPT_AUTHORITY_IDENTITY_SHA256,
    ),
    lifecycleCompatibility: z
      .object({
        backup: z.literal(GOLD_IMPORT_V2_CURRENT_LIFECYCLE_COMPATIBILITY.backup),
        capture: z.literal(GOLD_IMPORT_V2_CURRENT_LIFECYCLE_COMPATIBILITY.capture),
        capturePair: z.literal(GOLD_IMPORT_V2_CURRENT_LIFECYCLE_COMPATIBILITY.capturePair),
        finalizedReceipt: z.literal(
          GOLD_IMPORT_V2_CURRENT_LIFECYCLE_COMPATIBILITY.finalizedReceipt,
        ),
        generatedPackage: z.literal(
          GOLD_IMPORT_V2_CURRENT_LIFECYCLE_COMPATIBILITY.generatedPackage,
        ),
        package: z.literal(GOLD_IMPORT_V2_CURRENT_LIFECYCLE_COMPATIBILITY.package),
        packageGenerationReadiness: z.literal(
          GOLD_IMPORT_V2_CURRENT_LIFECYCLE_COMPATIBILITY.packageGenerationReadiness,
        ),
        packageReadiness: z.literal(
          GOLD_IMPORT_V2_CURRENT_LIFECYCLE_COMPATIBILITY.packageReadiness,
        ),
        rehearsal: z.literal(GOLD_IMPORT_V2_CURRENT_LIFECYCLE_COMPATIBILITY.rehearsal),
      })
      .strict(),
    repository: z
      .object({
        branch: z.literal(GOLD_IMPORT_V2_CURRENT_BACKUP_BRANCH),
        frozenBase: z.literal(GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE),
        head: commitSchema,
        originMain: z.literal(GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE),
        upstreamHead: commitSchema,
      })
      .strict(),
    runtimeBundle: z.unknown(),
    runtimeSources: z.array(archivedFileSchema).min(1),
    safety: z
      .object({
        compensationAuthorized: z.literal(false),
        databaseAccess: z.literal('none_file_only'),
        heldOutIdentitiesAccessed: z.literal(false),
        historicalPr95AuthorityAccepted: z.literal(false),
        importAuthorized: z.literal(false),
        remoteDatabaseAccessed: z.literal(false),
      })
      .strict(),
    schemaVersion: z.literal(GOLD_IMPORT_V2_CURRENT_BACKUP_SCHEMA_VERSION),
    targetObservationContract: z.literal(
      GOLD_IMPORT_V2_FIXED_LOCAL_TARGET_OBSERVATION_SCHEMA_VERSION,
    ),
  })
  .strict()

const backupManifestSchema = z
  .object({
    authorityIdentitySha256: sha256Schema,
    files: z.array(
      z
        .object({
          bytes: z.number().int().nonnegative(),
          name: z.string().min(1),
          sha256: sha256Schema,
        })
        .strict(),
    ),
    schemaVersion: z.literal('literature-gold-v2-postmigration-delivery-backup-manifest/1.0.0'),
  })
  .strict()

const backupReceiptBodySchema = z
  .object({
    authorityIdentitySha256: sha256Schema,
    checksumManifestSha256: sha256Schema,
    compensationAuthorized: z.literal(false),
    fileCount: z.number().int().positive(),
    head: commitSchema,
    importAuthorized: z.literal(false),
    schemaVersion: z.literal(GOLD_IMPORT_V2_CURRENT_BACKUP_RECEIPT_SCHEMA_VERSION),
  })
  .strict()

const backupReceiptSchema = backupReceiptBodySchema
  .extend({ receiptIdentitySha256: sha256Schema })
  .strict()

export const goldImportV2CurrentBackupAuthoritySchema = backupAuthorityBodySchema
  .extend({ authorityIdentitySha256: sha256Schema })
  .strict()

export type GoldImportV2CurrentBackupAuthority = z.infer<
  typeof goldImportV2CurrentBackupAuthoritySchema
>

interface InputFile {
  bytes: Buffer
  name: string
  sourcePath: string
}

interface BackupRepositoryIdentity {
  branch: string
  frozenBase: string
  head: string
  originMain: string
  upstreamHead: string
}

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

function canonicalPretty(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(JSON.parse(canonicalJson(value)), null, 2)}\n`, 'utf8')
}

function safeArchiveBasename(path: string): string {
  const name = basename(path)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, '-')
  if (!name || name === '.' || name === '..') throw new Error('Backup source basename is unsafe.')
  return name
}

function archiveFiles(
  kind: 'changed_tracked_file' | 'evidence' | 'runtime_source',
  files: readonly InputFile[],
): { files: Map<string, Buffer>; records: z.infer<typeof archivedFileSchema>[] } {
  const sorted = [...files].sort((left, right) => left.name.localeCompare(right.name, 'en'))
  const prefix =
    kind === 'changed_tracked_file' ? 'changed' : kind === 'runtime_source' ? 'runtime' : 'evidence'
  const archived = new Map<string, Buffer>()
  const records = sorted.map((file, index) => {
    const archiveName = `${prefix}-${String(index + 1).padStart(3, '0')}-${safeArchiveBasename(file.name)}`
    if (archived.has(archiveName)) throw new Error('Backup archive filename collision.')
    const bytes = Buffer.from(file.bytes)
    archived.set(archiveName, bytes)
    return archivedFileSchema.parse({
      archiveName,
      bytes: bytes.byteLength,
      kind,
      name: file.name,
      sha256: sha256(bytes),
      sourcePath: file.sourcePath,
    })
  })
  return { files: archived, records }
}

export function currentBackupAuthorityIdentitySha256(
  body: z.infer<typeof backupAuthorityBodySchema>,
): string {
  return sha256(canonicalJson(backupAuthorityBodySchema.parse(body)))
}

export function buildGoldImportV2CurrentBackupAuthority(input: {
  changedTrackedFiles: readonly InputFile[]
  evidence: readonly InputFile[]
  repository: BackupRepositoryIdentity
  runtimeBundle: GoldImportV2PreimportRuntimeBundle
  runtimeSources: readonly InputFile[]
}): { authority: GoldImportV2CurrentBackupAuthority; payloadFiles: Map<string, Buffer> } {
  const runtimeBundle = validateGoldImportV2PreimportRuntimeBundle(input.runtimeBundle)
  const changed = archiveFiles('changed_tracked_file', input.changedTrackedFiles)
  const evidence = archiveFiles('evidence', input.evidence)
  const runtime = archiveFiles('runtime_source', input.runtimeSources)
  const body = backupAuthorityBodySchema.parse({
    changedTrackedFiles: changed.records,
    evidence: evidence.records,
    finalizedReceiptAuthorityIdentitySha256:
      GOLD_IMPORT_V2_FINALIZED_RECEIPT_AUTHORITY_IDENTITY_SHA256,
    lifecycleCompatibility: GOLD_IMPORT_V2_CURRENT_LIFECYCLE_COMPATIBILITY,
    repository: input.repository,
    runtimeBundle,
    runtimeSources: runtime.records,
    safety: {
      compensationAuthorized: false,
      databaseAccess: 'none_file_only',
      heldOutIdentitiesAccessed: false,
      historicalPr95AuthorityAccepted: false,
      importAuthorized: false,
      remoteDatabaseAccessed: false,
    },
    schemaVersion: GOLD_IMPORT_V2_CURRENT_BACKUP_SCHEMA_VERSION,
    targetObservationContract: GOLD_IMPORT_V2_FIXED_LOCAL_TARGET_OBSERVATION_SCHEMA_VERSION,
  })
  return {
    authority: goldImportV2CurrentBackupAuthoritySchema.parse({
      ...body,
      authorityIdentitySha256: currentBackupAuthorityIdentitySha256(body),
    }),
    payloadFiles: new Map([...changed.files, ...evidence.files, ...runtime.files]),
  }
}

function exactNames(left: readonly string[], right: readonly string[]): boolean {
  return canonicalJson([...left].sort()) === canonicalJson([...right].sort())
}

export function validateGoldImportV2CurrentBackupAuthority(input: {
  authority: unknown
  expectedChangedPaths?: readonly string[]
  expectedCurrentRuntimeBundle: GoldImportV2PreimportRuntimeBundle
  payloadFiles: ReadonlyMap<string, Buffer>
}): GoldImportV2CurrentBackupAuthority {
  const authority = goldImportV2CurrentBackupAuthoritySchema.parse(input.authority)
  const { authorityIdentitySha256, ...body } = authority
  if (currentBackupAuthorityIdentitySha256(body) !== authorityIdentitySha256) {
    throw new Error('Current PR #97 backup authority identity is invalid.')
  }
  if (authority.repository.upstreamHead !== authority.repository.head) {
    throw new Error('Current PR #97 backup does not bind the exact pushed branch HEAD.')
  }
  const runtimeBundle = validateGoldImportV2PreimportRuntimeBundle(authority.runtimeBundle)
  const currentRuntimeBundle = validateGoldImportV2PreimportRuntimeBundle(
    input.expectedCurrentRuntimeBundle,
  )
  if (canonicalJson(runtimeBundle) !== canonicalJson(currentRuntimeBundle)) {
    throw new Error('Backup runtime bundle is not the exact current PR #97 runtime closure.')
  }
  const requiredRuntimePaths = [
    ...GOLD_IMPORT_V2_PREIMPORT_RUNTIME_REQUIRED_FILES,
    'scripts/literature/gold-import-v2-fixed-local-target.ts',
    'scripts/literature/gold-import-v2-database-publication.ts',
    'scripts/literature/gold-import-v2-lifecycle-compatibility.ts',
    'scripts/literature/create-gold-import-v2-postmigration-backup.ts',
  ]
  if (
    !requiredRuntimePaths.every((path) => runtimeBundle.files.some((file) => file.path === path))
  ) {
    throw new Error('Backup runtime bundle omits a current capture/readiness source.')
  }
  const records = [
    ...authority.changedTrackedFiles,
    ...authority.evidence,
    ...authority.runtimeSources,
  ]
  if (
    new Set(records.map(({ archiveName }) => archiveName)).size !== records.length ||
    !exactNames(
      [...input.payloadFiles.keys()],
      records.map(({ archiveName }) => archiveName),
    )
  ) {
    throw new Error('Current backup payload has a missing or unexpected protected source file.')
  }
  for (const record of records) {
    const bytes = input.payloadFiles.get(record.archiveName)
    if (!bytes || bytes.byteLength !== record.bytes || sha256(bytes) !== record.sha256) {
      throw new Error(`Current backup protected source file changed: ${record.name}.`)
    }
  }
  if (
    !exactNames(
      authority.evidence.map(({ name }) => name),
      GOLD_IMPORT_V2_CURRENT_BACKUP_EVIDENCE_NAMES,
    )
  ) {
    throw new Error('Current backup evidence inventory is incomplete or unexpected.')
  }
  if (
    input.expectedChangedPaths &&
    !exactNames(
      authority.changedTrackedFiles.map(({ name }) => name),
      input.expectedChangedPaths,
    )
  ) {
    throw new Error('Current backup changed-file inventory differs from the reviewed PR diff.')
  }
  const runtimeInputs = authority.runtimeSources.map((record) => ({
    bytes: input.payloadFiles.get(record.archiveName)!,
    path: record.name,
  }))
  const rebuiltRuntimeBundle = buildGoldImportV2PreimportRuntimeBundle(runtimeInputs)
  if (canonicalJson(rebuiltRuntimeBundle) !== canonicalJson(runtimeBundle)) {
    throw new Error('Current backup runtime source bytes do not rebuild its runtime identity.')
  }
  return Object.freeze(authority)
}

interface ParsedArguments {
  evidence: Array<{ name: GoldImportV2CurrentBackupEvidenceName; source: string }>
  output: string
  outputRoot: string
}

export function parseGoldImportV2CurrentBackupArguments(argv: readonly string[]): ParsedArguments {
  const evidence: ParsedArguments['evidence'] = []
  let output = ''
  let outputRoot = ''
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    const value = argv[index + 1]
    if (!argument || !['--evidence', '--output', '--output-root'].includes(argument) || !value) {
      throw new Error(`Unknown or valueless backup option: ${argument ?? '<missing>'}.`)
    }
    index += 1
    if (argument === '--output') output = value
    else if (argument === '--output-root') outputRoot = value
    else {
      const separator = value.indexOf('=')
      const name = value.slice(0, separator) as GoldImportV2CurrentBackupEvidenceName
      const source = value.slice(separator + 1)
      if (
        separator < 1 ||
        !GOLD_IMPORT_V2_CURRENT_BACKUP_EVIDENCE_NAMES.includes(name) ||
        !source
      ) {
        throw new Error('Backup evidence must use one exact reviewed name=path.')
      }
      evidence.push({ name, source })
    }
  }
  if (
    !output ||
    !outputRoot ||
    !exactNames(
      evidence.map(({ name }) => name),
      GOLD_IMPORT_V2_CURRENT_BACKUP_EVIDENCE_NAMES,
    ) ||
    new Set(evidence.map(({ name }) => name)).size !== evidence.length
  ) {
    throw new Error('Current PR #97 backup arguments are incomplete or duplicated.')
  }
  return { evidence, output, outputRoot }
}

function isWithin(root: string, candidate: string): boolean {
  const path = relative(root, candidate)
  return path === '' || (path !== '..' && !path.startsWith(`..${sep}`))
}

async function readCanonicalRegularFile(path: string, label: string): Promise<Buffer> {
  const absolute = resolve(path)
  const stat = await lstat(absolute)
  if (!stat.isFile() || stat.isSymbolicLink() || (await realpath(absolute)) !== absolute) {
    throw new Error(`${label} must be a canonical regular non-symlink file.`)
  }
  return readFile(absolute)
}

async function git(cwd: string, arguments_: readonly string[]): Promise<string> {
  const result = await execFileAsync('git', [...arguments_], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
  return result.stdout.trim()
}

async function inspectRepository(cwd: string): Promise<BackupRepositoryIdentity> {
  const [branch, head, originMain, upstreamHead, status, ancestor] = await Promise.all([
    git(cwd, ['branch', '--show-current']),
    git(cwd, ['rev-parse', 'HEAD']),
    git(cwd, ['rev-parse', 'origin/main']),
    git(cwd, ['rev-parse', '@{upstream}']),
    git(cwd, ['status', '--porcelain=v1', '--untracked-files=all']),
    git(cwd, [
      'merge-base',
      '--is-ancestor',
      GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE,
      'HEAD',
    ]).then(() => 'yes'),
  ])
  if (
    branch !== GOLD_IMPORT_V2_CURRENT_BACKUP_BRANCH ||
    originMain !== GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE ||
    upstreamHead !== head ||
    status !== '' ||
    ancestor !== 'yes'
  ) {
    throw new Error('Current PR #97 backup requires its clean pushed branch and frozen base.')
  }
  return {
    branch,
    frozenBase: GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE,
    head,
    originMain,
    upstreamHead,
  }
}

function backupManifest(files: ReadonlyMap<string, Buffer>, authorityIdentitySha256: string) {
  return backupManifestSchema.parse({
    authorityIdentitySha256,
    files: [...files]
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([name, bytes]) => ({ bytes: bytes.byteLength, name, sha256: sha256(bytes) })),
    schemaVersion: 'literature-gold-v2-postmigration-delivery-backup-manifest/1.0.0',
  })
}

function checksumManifest(files: ReadonlyMap<string, Buffer>): Buffer {
  return Buffer.from(
    `${[...files]
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([name, bytes]) => `${sha256(bytes)}  ${name}`)
      .join('\n')}\n`,
    'utf8',
  )
}

export async function verifyGoldImportV2CurrentBackupDirectory(input: {
  directory: string
  expectedChangedPaths?: readonly string[]
  expectedCurrentRuntimeBundle: GoldImportV2PreimportRuntimeBundle
}): Promise<{
  authority: GoldImportV2CurrentBackupAuthority
  manifestSha256: string
  receiptIdentitySha256: string
}> {
  const directory = resolve(input.directory)
  const directoryStat = await lstat(directory)
  if (
    !directoryStat.isDirectory() ||
    directoryStat.isSymbolicLink() ||
    (await realpath(directory)) !== directory
  ) {
    throw new Error('Current PR #97 backup must be one canonical non-symlink directory.')
  }
  const names = (await readdir(directory)).sort((left, right) => left.localeCompare(right, 'en'))
  const bytesByName = new Map<string, Buffer>()
  for (const name of names) {
    if (basename(name) !== name) throw new Error('Current backup contains an unsafe filename.')
    bytesByName.set(
      name,
      await readCanonicalRegularFile(resolve(directory, name), `Backup file ${name}`),
    )
  }
  const authorityBytes = bytesByName.get('backup-authority.json')
  const manifestBytes = bytesByName.get('backup-manifest.json')
  const checksumBytes = bytesByName.get('checksum-manifest.sha256')
  const receiptBytes = bytesByName.get('backup-receipt.json')
  if (!authorityBytes || !manifestBytes || !checksumBytes || !receiptBytes) {
    throw new Error('Current backup metadata inventory is incomplete.')
  }
  const authority = goldImportV2CurrentBackupAuthoritySchema.parse(
    JSON.parse(authorityBytes.toString('utf8')) as unknown,
  )
  if (!authorityBytes.equals(canonicalPretty(authority))) {
    throw new Error('Current backup authority is not canonical.')
  }
  const records = [
    ...authority.changedTrackedFiles,
    ...authority.evidence,
    ...authority.runtimeSources,
  ]
  const payloadFiles = new Map<string, Buffer>()
  for (const record of records) {
    const bytes = bytesByName.get(record.archiveName)
    if (bytes) payloadFiles.set(record.archiveName, bytes)
  }
  const validatedAuthority = validateGoldImportV2CurrentBackupAuthority({
    authority,
    expectedChangedPaths: input.expectedChangedPaths,
    expectedCurrentRuntimeBundle: input.expectedCurrentRuntimeBundle,
    payloadFiles,
  })
  const coveredFiles = new Map(payloadFiles)
  coveredFiles.set('backup-authority.json', authorityBytes)
  const manifest = backupManifestSchema.parse(JSON.parse(manifestBytes.toString('utf8')) as unknown)
  const expectedManifest = backupManifest(coveredFiles, validatedAuthority.authorityIdentitySha256)
  if (
    !manifestBytes.equals(canonicalPretty(manifest)) ||
    canonicalJson(manifest) !== canonicalJson(expectedManifest)
  ) {
    throw new Error(
      'Current backup manifest is noncanonical or does not cover exact payload bytes.',
    )
  }
  coveredFiles.set('backup-manifest.json', manifestBytes)
  const expectedChecksums = checksumManifest(coveredFiles)
  if (!checksumBytes.equals(expectedChecksums)) {
    throw new Error('Current backup checksum manifest is invalid.')
  }
  const receipt = backupReceiptSchema.parse(JSON.parse(receiptBytes.toString('utf8')) as unknown)
  const { receiptIdentitySha256, ...receiptBody } = receipt
  if (
    !receiptBytes.equals(canonicalPretty(receipt)) ||
    sha256(canonicalJson(backupReceiptBodySchema.parse(receiptBody))) !== receiptIdentitySha256 ||
    receipt.authorityIdentitySha256 !== validatedAuthority.authorityIdentitySha256 ||
    receipt.checksumManifestSha256 !== sha256(checksumBytes) ||
    receipt.fileCount !== coveredFiles.size ||
    receipt.head !== validatedAuthority.repository.head
  ) {
    throw new Error('Current backup receipt is invalid or not bound to exact current authority.')
  }
  const expectedNames = [
    ...records.map(({ archiveName }) => archiveName),
    'backup-authority.json',
    'backup-manifest.json',
    'backup-receipt.json',
    'checksum-manifest.sha256',
  ]
  if (!exactNames(names, expectedNames)) {
    throw new Error('Current backup directory contains a missing or unexpected file.')
  }
  return Object.freeze({
    authority: validatedAuthority,
    manifestSha256: sha256(manifestBytes),
    receiptIdentitySha256,
  })
}

export async function runGoldImportV2CurrentBackup(argv: readonly string[]) {
  const parsed = parseGoldImportV2CurrentBackupArguments(argv)
  assertSafeOutputPathArgument(parsed.outputRoot, 'Backup output root')
  assertSafeOutputPathArgument(parsed.output, 'Backup output')
  const modulePath = fileURLToPath(import.meta.url)
  const repositoryRoot = realpathSync(resolve(dirname(modulePath), '../..'))
  const repository = await inspectRepository(repositoryRoot)
  const outputRoot = await realpath(resolve(parsed.outputRoot))
  const output = resolve(parsed.output)
  const expectedOutput = resolve(
    GOLD_IMPORT_V2_CURRENT_BACKUP_ROOT,
    `post-v2-preimport-capture-v1-${repository.head}`,
  )
  if (
    outputRoot !== GOLD_IMPORT_V2_CURRENT_BACKUP_ROOT ||
    output !== expectedOutput ||
    !isWithin(outputRoot, output)
  ) {
    throw new Error('Current PR #97 backup output path is not its exact additive HEAD path.')
  }
  const runtimeBundle = await loadGoldImportV2PreimportRuntimeBundle(repositoryRoot)
  const runtimeSources = await Promise.all(
    runtimeBundle.files.map(async ({ path }) => ({
      bytes: await readCanonicalRegularFile(
        resolve(repositoryRoot, path),
        `Runtime source ${path}`,
      ),
      name: path,
      sourcePath: resolve(repositoryRoot, path),
    })),
  )
  const changedPaths = (
    await git(repositoryRoot, [
      'diff',
      '--name-only',
      '--diff-filter=ACMRT',
      `${GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE}..HEAD`,
    ])
  )
    .split('\n')
    .filter(Boolean)
  const changedTrackedFiles = await Promise.all(
    changedPaths.map(async (path) => ({
      bytes: await readCanonicalRegularFile(resolve(repositoryRoot, path), `Changed file ${path}`),
      name: path,
      sourcePath: resolve(repositoryRoot, path),
    })),
  )
  const evidence = await Promise.all(
    parsed.evidence.map(async ({ name, source }) => ({
      bytes: await readCanonicalRegularFile(source, `Evidence ${name}`),
      name,
      sourcePath: resolve(source),
    })),
  )
  const built = buildGoldImportV2CurrentBackupAuthority({
    changedTrackedFiles,
    evidence,
    repository,
    runtimeBundle,
    runtimeSources,
  })
  validateGoldImportV2CurrentBackupAuthority({
    authority: built.authority,
    expectedChangedPaths: changedPaths,
    expectedCurrentRuntimeBundle: runtimeBundle,
    payloadFiles: built.payloadFiles,
  })
  const files = new Map(built.payloadFiles)
  files.set('backup-authority.json', canonicalPretty(built.authority))
  const manifest = backupManifest(files, built.authority.authorityIdentitySha256)
  files.set('backup-manifest.json', canonicalPretty(manifest))
  const checksums = checksumManifest(files)
  const receiptBody = backupReceiptBodySchema.parse({
    authorityIdentitySha256: built.authority.authorityIdentitySha256,
    checksumManifestSha256: sha256(checksums),
    compensationAuthorized: false,
    fileCount: files.size,
    head: repository.head,
    importAuthorized: false,
    schemaVersion: GOLD_IMPORT_V2_CURRENT_BACKUP_RECEIPT_SCHEMA_VERSION,
  })
  const receipt = backupReceiptSchema.parse({
    ...receiptBody,
    receiptIdentitySha256: sha256(canonicalJson(receiptBody)),
  })
  const staged = await createStagedExclusiveOutputDirectory({
    outputDirectory: output,
    outputRoot,
    stagingNonce: randomBytes(32).toString('hex'),
  })
  try {
    writeExclusiveOutputFiles(staged.identity, [
      ...[...files].map(([name, bytes]) => ({ bytes, name })),
      { bytes: checksums, name: 'checksum-manifest.sha256' },
      { bytes: canonicalPretty(receipt), name: 'backup-receipt.json' },
    ])
    await assertExclusiveOutputDirectoryIdentity(staged.identity)
    await publishStagedExclusiveOutputDirectory(staged)
  } catch (error) {
    await discardStagedExclusiveOutputDirectory(staged)
    throw error
  }
  const verified = await verifyGoldImportV2CurrentBackupDirectory({
    directory: output,
    expectedChangedPaths: changedPaths,
    expectedCurrentRuntimeBundle: runtimeBundle,
  })
  const names = await readdir(output)
  return {
    authorityIdentitySha256: built.authority.authorityIdentitySha256,
    backupDirectory: output,
    checksumManifestSha256: sha256(checksums),
    fileCount: names.length,
    head: repository.head,
    manifestSha256: verified.manifestSha256,
    receiptIdentitySha256: verified.receiptIdentitySha256,
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  void runGoldImportV2CurrentBackup(process.argv.slice(2))
    .then((result) => console.log(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
}
