import { createHash, randomBytes } from 'node:crypto'
import { execFile } from 'node:child_process'
import {
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
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
export const GOLD_IMPORT_V2_CURRENT_BACKUP_RELEASE_FREEZE_SCHEMA_VERSION =
  'literature-gold-v2-postmigration-delivery-release-freeze/1.0.0' as const
export const GOLD_IMPORT_V2_CURRENT_BACKUP_RELEASE_VERIFICATION_SCHEMA_VERSION =
  'literature-gold-v2-postmigration-delivery-release-verification/1.0.0' as const
export const GOLD_IMPORT_V2_CURRENT_BACKUP_BRANCH =
  'codex/ip-literature-post-v2-preimport-capture-v1' as const
export const GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE =
  '0d8a687e5982a88063e72e2c7cb7bed530a1517f' as const
export const GOLD_IMPORT_V2_CURRENT_BACKUP_REPOSITORY =
  'russellmiller49/Interventional-Pulm-Education-Project' as const
export const GOLD_IMPORT_V2_CURRENT_BACKUP_REPOSITORY_URL =
  'https://github.com/russellmiller49/Interventional-Pulm-Education-Project' as const
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
const isoTimestampSchema = z.string().datetime({ offset: true })
const repositoryRelativePathSchema = z
  .string()
  .min(1)
  .refine(
    (path) =>
      !path.startsWith('/') &&
      !path.includes('\\') &&
      !path.includes('\0') &&
      !path
        .split('/')
        .some((component) => component === '' || component === '.' || component === '..'),
    'Expected one canonical repository-relative path.',
  )

const releaseChangedPathSchema = z
  .object({
    path: repositoryRelativePathSchema,
    status: z.enum(['A', 'M']),
  })
  .strict()

const releaseFreezeBodySchema = z
  .object({
    branch: z.literal(GOLD_IMPORT_V2_CURRENT_BACKUP_BRANCH),
    changedPathCount: z.number().int().positive(),
    changedPathInventorySha256: sha256Schema,
    changedPaths: z.array(releaseChangedPathSchema).min(1),
    createdAt: isoTimestampSchema,
    frozenBase: z.literal(GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE),
    frozenHead: commitSchema,
    repository: z.literal(GOLD_IMPORT_V2_CURRENT_BACKUP_REPOSITORY),
    schemaVersion: z.literal(GOLD_IMPORT_V2_CURRENT_BACKUP_RELEASE_FREEZE_SCHEMA_VERSION),
    sourceGitCommands: z
      .object({
        branch: z.literal('git branch --show-current'),
        changedPathStatuses: z.string().min(1),
        changedPaths: z.string().min(1),
        head: z.literal('git rev-parse HEAD'),
        originUrl: z.literal('git remote get-url origin'),
        upstreamBranch: z.literal('git rev-parse --abbrev-ref --symbolic-full-name @{upstream}'),
        upstreamHead: z.literal('git rev-parse @{upstream}'),
      })
      .strict(),
  })
  .strict()

export const goldImportV2CurrentBackupReleaseFreezeSchema = releaseFreezeBodySchema
  .extend({ releaseFreezeIdentitySha256: sha256Schema })
  .strict()

const releaseVerificationBodySchema = z
  .object({
    backup: z
      .object({
        authorityIdentitySha256: sha256Schema,
        checksumManifestSha256: sha256Schema,
        directory: z.string().startsWith('/'),
        manifestSha256: sha256Schema,
        receiptIdentitySha256: sha256Schema,
      })
      .strict(),
    releaseFreeze: goldImportV2CurrentBackupReleaseFreezeSchema,
    schemaVersion: z.literal(GOLD_IMPORT_V2_CURRENT_BACKUP_RELEASE_VERIFICATION_SCHEMA_VERSION),
    verifiedAt: isoTimestampSchema,
  })
  .strict()

export const goldImportV2CurrentBackupReleaseVerificationSchema = releaseVerificationBodySchema
  .extend({ releaseVerificationIdentitySha256: sha256Schema })
  .strict()

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
export type GoldImportV2CurrentBackupReleaseFreeze = z.infer<
  typeof goldImportV2CurrentBackupReleaseFreezeSchema
>
export type GoldImportV2CurrentBackupReleaseVerification = z.infer<
  typeof goldImportV2CurrentBackupReleaseVerificationSchema
>

export interface GoldImportV2CurrentBackupReleaseExpectations {
  expectedAuthorityIdentitySha256: string
  expectedBase: string
  expectedBranch: string
  expectedChangedPaths: readonly string[]
  expectedHead: string
}

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

function isCanonicalOrder(values: readonly string[]): boolean {
  return values.every((value, index) => index === 0 || values[index - 1]! < value)
}

function validateCanonicalChangedPaths(paths: readonly string[], label: string): string[] {
  const validated = paths.map((path) => repositoryRelativePathSchema.parse(path))
  if (new Set(validated).size !== validated.length || !isCanonicalOrder(validated)) {
    throw new Error(`${label} must be exact, unique, and canonically ordered.`)
  }
  return validated
}

function parseReleaseExpectations(
  input: GoldImportV2CurrentBackupReleaseExpectations,
): GoldImportV2CurrentBackupReleaseExpectations {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Current PR #97 release expectations are required.')
  }
  const expectedAuthorityIdentitySha256 = sha256Schema.parse(input.expectedAuthorityIdentitySha256)
  const expectedBase = commitSchema.parse(input.expectedBase)
  const expectedBranch = z.string().min(1).parse(input.expectedBranch)
  const expectedChangedPaths = validateCanonicalChangedPaths(
    z.array(repositoryRelativePathSchema).min(1).parse(input.expectedChangedPaths),
    'Expected changed-file inventory',
  )
  const expectedHead = commitSchema.parse(input.expectedHead)
  return Object.freeze({
    expectedAuthorityIdentitySha256,
    expectedBase,
    expectedBranch,
    expectedChangedPaths,
    expectedHead,
  })
}

export function currentBackupReleaseFreezeIdentitySha256(
  body: z.infer<typeof releaseFreezeBodySchema>,
): string {
  return sha256(canonicalJson(releaseFreezeBodySchema.parse(body)))
}

export function currentBackupReleaseVerificationIdentitySha256(
  body: z.infer<typeof releaseVerificationBodySchema>,
): string {
  return sha256(canonicalJson(releaseVerificationBodySchema.parse(body)))
}

export function validateGoldImportV2CurrentBackupReleaseFreeze(
  input: unknown,
): GoldImportV2CurrentBackupReleaseFreeze {
  const freeze = goldImportV2CurrentBackupReleaseFreezeSchema.parse(input)
  const { releaseFreezeIdentitySha256, ...body } = freeze
  if (currentBackupReleaseFreezeIdentitySha256(body) !== releaseFreezeIdentitySha256) {
    throw new Error('Current PR #97 release-freeze identity is invalid.')
  }
  const changedPaths = validateCanonicalChangedPaths(
    freeze.changedPaths.map(({ path }) => path),
    'Release-freeze changed-file inventory',
  )
  if (
    changedPaths.some((path, index) => path !== freeze.changedPaths[index]?.path) ||
    new Set(freeze.changedPaths.map(({ path }) => path)).size !== freeze.changedPaths.length ||
    freeze.changedPathCount !== freeze.changedPaths.length ||
    freeze.changedPathInventorySha256 !== sha256(canonicalJson(freeze.changedPaths))
  ) {
    throw new Error('Release-freeze changed-file inventory is not canonical.')
  }
  if (
    freeze.sourceGitCommands.changedPathStatuses !==
      `git diff --name-status -z --find-renames ${freeze.frozenBase}...${freeze.frozenHead}` ||
    freeze.sourceGitCommands.changedPaths !==
      `git diff --name-only -z ${freeze.frozenBase}...${freeze.frozenHead}`
  ) {
    throw new Error('Release-freeze Git command evidence is invalid.')
  }
  return Object.freeze(freeze)
}

/** Validates only the external artifact envelope; it does not verify backup bytes. */
export function validateGoldImportV2CurrentBackupReleaseVerification(
  input: unknown,
): GoldImportV2CurrentBackupReleaseVerification {
  const verification = goldImportV2CurrentBackupReleaseVerificationSchema.parse(input)
  const { releaseVerificationIdentitySha256, ...body } = verification
  if (currentBackupReleaseVerificationIdentitySha256(body) !== releaseVerificationIdentitySha256) {
    throw new Error('Current PR #97 release-verification identity is invalid.')
  }
  validateGoldImportV2CurrentBackupReleaseFreeze(verification.releaseFreeze)
  const expectedDirectory = resolve(
    GOLD_IMPORT_V2_CURRENT_BACKUP_ROOT,
    `post-v2-preimport-capture-v1-${verification.releaseFreeze.frozenHead}`,
  )
  if (resolve(verification.backup.directory) !== expectedDirectory) {
    throw new Error('Release verification names the wrong successor backup path.')
  }
  return Object.freeze(verification)
}

export function releaseExpectationsFromVerification(
  input: GoldImportV2CurrentBackupReleaseVerification,
): GoldImportV2CurrentBackupReleaseExpectations {
  const verification = validateGoldImportV2CurrentBackupReleaseVerification(input)
  return Object.freeze({
    expectedAuthorityIdentitySha256: verification.backup.authorityIdentitySha256,
    expectedBase: verification.releaseFreeze.frozenBase,
    expectedBranch: verification.releaseFreeze.branch,
    expectedChangedPaths: verification.releaseFreeze.changedPaths.map(({ path }) => path),
    expectedHead: verification.releaseFreeze.frozenHead,
  })
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

/** Builds a self-consistent candidate; it does not return a release-verified authority. */
export function buildGoldImportV2CurrentBackupCandidateAuthority(input: {
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
  expectedCurrentRuntimeBundle: GoldImportV2PreimportRuntimeBundle
  payloadFiles: ReadonlyMap<string, Buffer>
  releaseExpectations: GoldImportV2CurrentBackupReleaseExpectations
}): GoldImportV2CurrentBackupAuthority {
  const expectations = parseReleaseExpectations(input.releaseExpectations)
  const authority = validateGoldImportV2CurrentBackupCandidateAuthority(input)
  if (authority.authorityIdentitySha256 !== expectations.expectedAuthorityIdentitySha256) {
    throw new Error('Current PR #97 backup differs from the externally frozen authority identity.')
  }
  if (
    authority.repository.branch !== expectations.expectedBranch ||
    authority.repository.frozenBase !== expectations.expectedBase ||
    authority.repository.originMain !== expectations.expectedBase ||
    authority.repository.head !== expectations.expectedHead ||
    authority.repository.upstreamHead !== expectations.expectedHead
  ) {
    throw new Error('Current PR #97 backup differs from the externally frozen release repository.')
  }
  const authorityChangedPaths = authority.changedTrackedFiles.map(({ name }) => name)
  if (canonicalJson(authorityChangedPaths) !== canonicalJson(expectations.expectedChangedPaths)) {
    throw new Error('Current backup changed-file inventory differs from the reviewed PR diff.')
  }
  return authority
}

function validateGoldImportV2CurrentBackupCandidateAuthority(input: {
  authority: unknown
  expectedCurrentRuntimeBundle: GoldImportV2PreimportRuntimeBundle
  payloadFiles: ReadonlyMap<string, Buffer>
}): GoldImportV2CurrentBackupAuthority {
  const authority = goldImportV2CurrentBackupAuthoritySchema.parse(input.authority)
  const { authorityIdentitySha256, ...body } = authority
  const recomputedAuthorityIdentitySha256 = currentBackupAuthorityIdentitySha256(body)
  if (recomputedAuthorityIdentitySha256 !== authorityIdentitySha256) {
    throw new Error('Current PR #97 backup authority identity is invalid.')
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
  const authorityChangedPaths = authority.changedTrackedFiles.map(({ name }) => name)
  validateCanonicalChangedPaths(authorityChangedPaths, 'Backup changed-file inventory')
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

type ParsedArguments =
  | {
      command: 'create-release-freeze'
      output: string
      outputRoot: string
    }
  | {
      command: 'create-release-verification'
      expectedAuthorityIdentitySha256: string
      expectedChecksumManifestSha256: string
      expectedManifestSha256: string
      expectedReceiptIdentitySha256: string
      output: string
      outputRoot: string
      releaseFreeze: string
    }
  | {
      command: 'create-backup'
      evidence: Array<{ name: GoldImportV2CurrentBackupEvidenceName; source: string }>
      output: string
      outputRoot: string
      releaseFreeze: string
    }

interface CreateBackupParsedArguments {
  evidence: Array<{ name: GoldImportV2CurrentBackupEvidenceName; source: string }>
  output: string
  outputRoot: string
  releaseFreeze: string
}

export function parseGoldImportV2CurrentBackupArguments(argv: readonly string[]): ParsedArguments {
  if (argv[0] === 'create-release-freeze') {
    let output = ''
    let outputRoot = ''
    for (let index = 1; index < argv.length; index += 1) {
      const argument = argv[index]
      const value = argv[index + 1]
      if (!argument || !['--output', '--output-root'].includes(argument) || !value) {
        throw new Error(`Unknown or valueless release-freeze option: ${argument ?? '<missing>'}.`)
      }
      index += 1
      if (argument === '--output') output = value
      else outputRoot = value
    }
    if (!output || !outputRoot) throw new Error('Release-freeze arguments are incomplete.')
    return { command: 'create-release-freeze', output, outputRoot }
  }
  if (argv[0] === 'create-release-verification') {
    const values = new Map<string, string>()
    const options = [
      '--expected-authority-identity-sha256',
      '--expected-checksum-manifest-sha256',
      '--expected-manifest-sha256',
      '--expected-receipt-identity-sha256',
      '--output',
      '--output-root',
      '--release-freeze',
    ] as const
    for (let index = 1; index < argv.length; index += 1) {
      const argument = argv[index]
      const value = argv[index + 1]
      if (!argument || !options.includes(argument as (typeof options)[number]) || !value) {
        throw new Error(
          `Unknown or valueless release-verification option: ${argument ?? '<missing>'}.`,
        )
      }
      if (values.has(argument))
        throw new Error(`Duplicate release-verification option: ${argument}.`)
      values.set(argument, value)
      index += 1
    }
    if (options.some((option) => !values.has(option))) {
      throw new Error('Release-verification arguments are incomplete.')
    }
    return {
      command: 'create-release-verification',
      expectedAuthorityIdentitySha256: values.get(options[0])!,
      expectedChecksumManifestSha256: values.get(options[1])!,
      expectedManifestSha256: values.get(options[2])!,
      expectedReceiptIdentitySha256: values.get(options[3])!,
      output: values.get('--output')!,
      outputRoot: values.get('--output-root')!,
      releaseFreeze: values.get('--release-freeze')!,
    }
  }
  const backupArguments = argv[0] === 'create-backup' ? argv.slice(1) : argv
  const evidence: CreateBackupParsedArguments['evidence'] = []
  let output = ''
  let outputRoot = ''
  let releaseFreeze = ''
  for (let index = 0; index < backupArguments.length; index += 1) {
    const argument = backupArguments[index]
    const value = backupArguments[index + 1]
    if (
      !argument ||
      !['--evidence', '--output', '--output-root', '--release-freeze'].includes(argument) ||
      !value
    ) {
      throw new Error(`Unknown or valueless backup option: ${argument ?? '<missing>'}.`)
    }
    index += 1
    if (argument === '--output') output = value
    else if (argument === '--output-root') outputRoot = value
    else if (argument === '--release-freeze') releaseFreeze = value
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
    !releaseFreeze ||
    !exactNames(
      evidence.map(({ name }) => name),
      GOLD_IMPORT_V2_CURRENT_BACKUP_EVIDENCE_NAMES,
    ) ||
    new Set(evidence.map(({ name }) => name)).size !== evidence.length
  ) {
    throw new Error('Current PR #97 backup arguments are incomplete or duplicated.')
  }
  return {
    command: 'create-backup',
    evidence,
    output,
    outputRoot,
    releaseFreeze,
  }
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

async function readFrozenTrackedFile(input: {
  cwd: string
  head: string
  label: string
  path: string
}): Promise<Buffer> {
  repositoryRelativePathSchema.parse(input.path)
  const result = await execFileAsync('git', ['show', `${input.head}:${input.path}`], {
    cwd: input.cwd,
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (!Buffer.isBuffer(result.stdout)) {
    throw new Error(`${input.label} did not resolve to frozen Git blob bytes.`)
  }
  return result.stdout
}

function writeExternalArtifact(input: {
  bytes: Buffer
  label: string
  output: string
  outputRoot: string
}): void {
  const outputName = basename(input.output)
  const rootStat = realpathSync(input.outputRoot)
  if (rootStat !== input.outputRoot || dirname(input.output) !== input.outputRoot) {
    throw new Error(`${input.label} output ancestry is not canonical.`)
  }
  const previousWorkingDirectory = process.cwd()
  let publicationError: unknown
  try {
    process.chdir(input.outputRoot)
    if (realpathSync('.') !== rootStat) {
      throw new Error(`${input.label} output root identity changed before publication.`)
    }
    const descriptor = openSync(
      outputName,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o600,
    )
    let descriptorError: unknown
    try {
      writeFileSync(descriptor, input.bytes)
      fchmodSync(descriptor, 0o600)
      fsyncSync(descriptor)
      const handleStat = fstatSync(descriptor, { bigint: true })
      const pathStat = lstatSync(outputName, { bigint: true })
      if (
        !handleStat.isFile() ||
        handleStat.nlink !== 1n ||
        (handleStat.mode & 0o777n) !== 0o600n ||
        !pathStat.isFile() ||
        pathStat.isSymbolicLink() ||
        pathStat.nlink !== 1n ||
        pathStat.dev !== handleStat.dev ||
        pathStat.ino !== handleStat.ino
      ) {
        throw new Error(`${input.label} publication produced an unsafe file identity.`)
      }
    } catch (error) {
      descriptorError = error
    }
    try {
      closeSync(descriptor)
    } catch (closeError) {
      if (descriptorError !== undefined) {
        throw new AggregateError(
          [descriptorError, closeError],
          `${input.label} publication and descriptor cleanup both failed.`,
        )
      }
      throw closeError
    }
    if (descriptorError !== undefined) throw descriptorError
  } catch (error) {
    publicationError = error
  }
  let restorationError: unknown
  try {
    process.chdir(previousWorkingDirectory)
  } catch (error) {
    restorationError = error
  }
  if (publicationError !== undefined && restorationError !== undefined) {
    throw new AggregateError(
      [publicationError, restorationError],
      `${input.label} publication and working-directory restoration both failed.`,
    )
  }
  if (restorationError !== undefined) throw restorationError
  if (publicationError !== undefined) throw publicationError
}

export type GoldImportV2CurrentBackupGitCommandRunner = (
  arguments_: readonly string[],
  cwd: string,
) => Promise<string>

const defaultGoldImportV2CurrentBackupGitCommandRunner: GoldImportV2CurrentBackupGitCommandRunner =
  async (arguments_, cwd) => git(cwd, arguments_)

function parseNameStatusZ(stdout: string): Array<z.infer<typeof releaseChangedPathSchema>> {
  if (!stdout.endsWith('\0')) {
    throw new Error(
      'Frozen changed-path command did not return a complete NUL-delimited inventory.',
    )
  }
  const fields = stdout.split('\0')
  fields.pop()
  const changedPaths: Array<z.infer<typeof releaseChangedPathSchema>> = []
  for (let index = 0; index < fields.length; index += 2) {
    const status = fields[index]
    const path = fields[index + 1]
    if (!status || !path || !['A', 'M'].includes(status)) {
      throw new Error(
        'Frozen release range contains a deletion, rename, copy, or unsupported changed-path record.',
      )
    }
    changedPaths.push(releaseChangedPathSchema.parse({ path, status }))
  }
  validateCanonicalChangedPaths(
    changedPaths.map(({ path }) => path),
    'Observed Git changed-file inventory',
  )
  return changedPaths
}

function parseNameOnlyZ(stdout: string): string[] {
  if (!stdout.endsWith('\0')) {
    throw new Error(
      'Frozen changed-path name command did not return a complete NUL-delimited inventory.',
    )
  }
  const fields = stdout.split('\0')
  fields.pop()
  return validateCanonicalChangedPaths(fields, 'Observed Git changed-file name inventory')
}

export async function inspectGoldImportV2CurrentBackupRepository(input: {
  cwd: string
  gitCommandRunner?: GoldImportV2CurrentBackupGitCommandRunner
  releaseFreeze: GoldImportV2CurrentBackupReleaseFreeze
}): Promise<{ changedPaths: string[]; repository: BackupRepositoryIdentity }> {
  const freeze = validateGoldImportV2CurrentBackupReleaseFreeze(input.releaseFreeze)
  const runGit = input.gitCommandRunner ?? defaultGoldImportV2CurrentBackupGitCommandRunner
  const changedPathCommand = [
    'diff',
    '--name-status',
    '-z',
    '--find-renames',
    `${freeze.frozenBase}...${freeze.frozenHead}`,
  ] as const
  const [
    branch,
    head,
    originMain,
    originUrl,
    upstreamBranch,
    upstreamHead,
    status,
    ancestor,
    changedPathNameOutput,
    changedPathOutput,
  ] = await Promise.all([
    runGit(['branch', '--show-current'], input.cwd),
    runGit(['rev-parse', 'HEAD'], input.cwd),
    runGit(['rev-parse', 'origin/main'], input.cwd),
    runGit(['remote', 'get-url', 'origin'], input.cwd),
    runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], input.cwd),
    runGit(['rev-parse', '@{upstream}'], input.cwd),
    runGit(['status', '--porcelain=v1', '--untracked-files=all'], input.cwd),
    runGit(['merge-base', '--is-ancestor', freeze.frozenBase, freeze.frozenHead], input.cwd).then(
      () => 'yes',
    ),
    runGit(['diff', '--name-only', '-z', `${freeze.frozenBase}...${freeze.frozenHead}`], input.cwd),
    runGit(changedPathCommand, input.cwd),
  ])
  const changedPathRecords = parseNameStatusZ(changedPathOutput)
  const changedPathNames = parseNameOnlyZ(changedPathNameOutput)
  if (
    branch !== freeze.branch ||
    originMain !== freeze.frozenBase ||
    originUrl !== GOLD_IMPORT_V2_CURRENT_BACKUP_REPOSITORY_URL ||
    upstreamBranch !== `origin/${freeze.branch}` ||
    head !== freeze.frozenHead ||
    upstreamHead !== freeze.frozenHead ||
    status !== '' ||
    ancestor !== 'yes' ||
    canonicalJson(changedPathNames) !== canonicalJson(changedPathRecords.map(({ path }) => path)) ||
    canonicalJson(changedPathRecords) !== canonicalJson(freeze.changedPaths)
  ) {
    throw new Error(
      'Current PR #97 backup requires the exact clean externally frozen branch, base, head, upstream, and changed paths.',
    )
  }
  return Object.freeze({
    changedPaths: changedPathRecords.map(({ path }) => path),
    repository: Object.freeze({
      branch,
      frozenBase: freeze.frozenBase,
      head,
      originMain,
      upstreamHead,
    }),
  })
}

export async function createGoldImportV2CurrentBackupReleaseFreeze(input: {
  createdAt?: string
  cwd: string
  output: string
  outputRoot: string
}): Promise<GoldImportV2CurrentBackupReleaseFreeze> {
  assertSafeOutputPathArgument(input.outputRoot, 'Release-freeze output root')
  assertSafeOutputPathArgument(input.output, 'Release-freeze output')
  const outputRoot = await realpath(resolve(input.outputRoot))
  const output = resolve(input.output)
  const branch = await git(input.cwd, ['branch', '--show-current'])
  const head = await git(input.cwd, ['rev-parse', 'HEAD'])
  const originUrl = await git(input.cwd, ['remote', 'get-url', 'origin'])
  const upstreamBranch = await git(input.cwd, [
    'rev-parse',
    '--abbrev-ref',
    '--symbolic-full-name',
    '@{upstream}',
  ])
  const upstreamHead = await git(input.cwd, ['rev-parse', '@{upstream}'])
  const originMain = await git(input.cwd, ['rev-parse', 'origin/main'])
  const status = await git(input.cwd, ['status', '--porcelain=v1', '--untracked-files=all'])
  await git(input.cwd, [
    'merge-base',
    '--is-ancestor',
    GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE,
    head,
  ])
  const changedPathCommand = [
    'diff',
    '--name-status',
    '-z',
    '--find-renames',
    `${GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE}...${head}`,
  ] as const
  const changedPaths = parseNameStatusZ(await git(input.cwd, changedPathCommand))
  const changedPathNames = parseNameOnlyZ(
    await git(input.cwd, [
      'diff',
      '--name-only',
      '-z',
      `${GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE}...${head}`,
    ]),
  )
  if (
    branch !== GOLD_IMPORT_V2_CURRENT_BACKUP_BRANCH ||
    originMain !== GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE ||
    originUrl !== GOLD_IMPORT_V2_CURRENT_BACKUP_REPOSITORY_URL ||
    upstreamBranch !== `origin/${GOLD_IMPORT_V2_CURRENT_BACKUP_BRANCH}` ||
    head !== upstreamHead ||
    status !== '' ||
    canonicalJson(changedPathNames) !== canonicalJson(changedPaths.map(({ path }) => path)) ||
    outputRoot !== GOLD_IMPORT_V2_CURRENT_BACKUP_ROOT ||
    dirname(output) !== outputRoot ||
    basename(output) !== `post-v2-preimport-capture-v1-${head}-release-freeze.json`
  ) {
    throw new Error(
      'Release freeze requires the exact clean pushed PR #97 branch, frozen base, and external sibling output.',
    )
  }
  const freeze = buildGoldImportV2CurrentBackupReleaseFreeze({
    branch,
    changedPaths,
    createdAt: input.createdAt ?? new Date().toISOString(),
    frozenBase: GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE,
    frozenHead: head,
    repository: GOLD_IMPORT_V2_CURRENT_BACKUP_REPOSITORY,
  })
  await inspectGoldImportV2CurrentBackupRepository({
    cwd: input.cwd,
    releaseFreeze: freeze,
  })
  writeExternalArtifact({
    bytes: canonicalPretty(freeze),
    label: 'External release freeze',
    output,
    outputRoot,
  })
  const writtenFreeze = await readCanonicalRegularFile(output, 'Written external release freeze')
  if (!writtenFreeze.equals(canonicalPretty(freeze))) {
    throw new Error('Written external release freeze differs from the reviewed canonical bytes.')
  }
  return freeze
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
  expectedCurrentRuntimeBundle: GoldImportV2PreimportRuntimeBundle
  releaseExpectations: GoldImportV2CurrentBackupReleaseExpectations
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
    expectedCurrentRuntimeBundle: input.expectedCurrentRuntimeBundle,
    payloadFiles,
    releaseExpectations: input.releaseExpectations,
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

export async function verifyGoldImportV2CurrentBackupRelease(input: {
  expectedCurrentRuntimeBundle: GoldImportV2PreimportRuntimeBundle
  releaseVerification: unknown
}): Promise<{
  authority: GoldImportV2CurrentBackupAuthority
  manifestSha256: string
  receiptIdentitySha256: string
}> {
  const releaseVerification = validateGoldImportV2CurrentBackupReleaseVerification(
    input.releaseVerification,
  )
  const verifiedDirectory = await verifyGoldImportV2CurrentBackupDirectory({
    directory: releaseVerification.backup.directory,
    expectedCurrentRuntimeBundle: input.expectedCurrentRuntimeBundle,
    releaseExpectations: releaseExpectationsFromVerification(releaseVerification),
  })
  if (
    verifiedDirectory.manifestSha256 !== releaseVerification.backup.manifestSha256 ||
    verifiedDirectory.receiptIdentitySha256 !== releaseVerification.backup.receiptIdentitySha256
  ) {
    throw new Error('Current backup differs from the external release-verification identities.')
  }
  const checksumBytes = await readCanonicalRegularFile(
    resolve(releaseVerification.backup.directory, 'checksum-manifest.sha256'),
    'Backup checksum manifest',
  )
  if (sha256(checksumBytes) !== releaseVerification.backup.checksumManifestSha256) {
    throw new Error('Current backup checksum manifest differs from release verification.')
  }
  return verifiedDirectory
}

export function buildGoldImportV2CurrentBackupReleaseFreeze(input: {
  branch: string
  changedPaths: ReadonlyArray<{ path: string; status: 'A' | 'M' }>
  createdAt: string
  frozenBase: string
  frozenHead: string
  repository: string
}): GoldImportV2CurrentBackupReleaseFreeze {
  const body = releaseFreezeBodySchema.parse({
    ...input,
    changedPathCount: input.changedPaths.length,
    changedPathInventorySha256: sha256(canonicalJson(input.changedPaths)),
    schemaVersion: GOLD_IMPORT_V2_CURRENT_BACKUP_RELEASE_FREEZE_SCHEMA_VERSION,
    sourceGitCommands: {
      branch: 'git branch --show-current',
      changedPathStatuses: `git diff --name-status -z --find-renames ${input.frozenBase}...${input.frozenHead}`,
      changedPaths: `git diff --name-only -z ${input.frozenBase}...${input.frozenHead}`,
      head: 'git rev-parse HEAD',
      originUrl: 'git remote get-url origin',
      upstreamBranch: 'git rev-parse --abbrev-ref --symbolic-full-name @{upstream}',
      upstreamHead: 'git rev-parse @{upstream}',
    },
  })
  validateCanonicalChangedPaths(
    body.changedPaths.map(({ path }) => path),
    'Release-freeze changed-file inventory',
  )
  return validateGoldImportV2CurrentBackupReleaseFreeze({
    ...body,
    releaseFreezeIdentitySha256: currentBackupReleaseFreezeIdentitySha256(body),
  })
}

/**
 * Builds a self-consistent release-verification candidate. This helper does not
 * verify a backup; only createGoldImportV2CurrentBackupReleaseVerification does.
 */
export function buildGoldImportV2CurrentBackupReleaseVerificationCandidate(input: {
  authorityIdentitySha256: string
  backupDirectory: string
  checksumManifestSha256: string
  manifestSha256: string
  receiptIdentitySha256: string
  releaseFreeze: GoldImportV2CurrentBackupReleaseFreeze
  verifiedAt: string
}): GoldImportV2CurrentBackupReleaseVerification {
  const body = releaseVerificationBodySchema.parse({
    backup: {
      authorityIdentitySha256: input.authorityIdentitySha256,
      checksumManifestSha256: input.checksumManifestSha256,
      directory: input.backupDirectory,
      manifestSha256: input.manifestSha256,
      receiptIdentitySha256: input.receiptIdentitySha256,
    },
    releaseFreeze: validateGoldImportV2CurrentBackupReleaseFreeze(input.releaseFreeze),
    schemaVersion: GOLD_IMPORT_V2_CURRENT_BACKUP_RELEASE_VERIFICATION_SCHEMA_VERSION,
    verifiedAt: input.verifiedAt,
  })
  return validateGoldImportV2CurrentBackupReleaseVerification({
    ...body,
    releaseVerificationIdentitySha256: currentBackupReleaseVerificationIdentitySha256(body),
  })
}

export async function createGoldImportV2CurrentBackupReleaseVerification(input: {
  expectedAuthorityIdentitySha256: string
  expectedChecksumManifestSha256: string
  expectedCurrentRuntimeBundle: GoldImportV2PreimportRuntimeBundle
  expectedManifestSha256: string
  expectedReceiptIdentitySha256: string
  output: string
  outputRoot: string
  releaseFreeze: GoldImportV2CurrentBackupReleaseFreeze
  verifiedAt?: string
}): Promise<GoldImportV2CurrentBackupReleaseVerification> {
  const freeze = validateGoldImportV2CurrentBackupReleaseFreeze(input.releaseFreeze)
  const expectedAuthorityIdentitySha256 = sha256Schema.parse(input.expectedAuthorityIdentitySha256)
  const expectedChecksumManifestSha256 = sha256Schema.parse(input.expectedChecksumManifestSha256)
  const expectedManifestSha256 = sha256Schema.parse(input.expectedManifestSha256)
  const expectedReceiptIdentitySha256 = sha256Schema.parse(input.expectedReceiptIdentitySha256)
  assertSafeOutputPathArgument(input.outputRoot, 'Release-verification output root')
  assertSafeOutputPathArgument(input.output, 'Release-verification output')
  const outputRoot = await realpath(resolve(input.outputRoot))
  const output = resolve(input.output)
  const backupDirectory = resolve(outputRoot, `post-v2-preimport-capture-v1-${freeze.frozenHead}`)
  if (
    outputRoot !== GOLD_IMPORT_V2_CURRENT_BACKUP_ROOT ||
    dirname(output) !== outputRoot ||
    basename(output) !==
      `post-v2-preimport-capture-v1-${freeze.frozenHead}-release-verification.json`
  ) {
    throw new Error('Release-verification output is not the exact external sibling path.')
  }
  await verifyGoldImportV2CurrentBackupDirectory({
    directory: backupDirectory,
    expectedCurrentRuntimeBundle: input.expectedCurrentRuntimeBundle,
    releaseExpectations: {
      expectedAuthorityIdentitySha256,
      expectedBase: freeze.frozenBase,
      expectedBranch: freeze.branch,
      expectedChangedPaths: freeze.changedPaths.map(({ path }) => path),
      expectedHead: freeze.frozenHead,
    },
  })
  const [manifestBytes, checksumBytes, receiptBytes] = await Promise.all([
    readCanonicalRegularFile(resolve(backupDirectory, 'backup-manifest.json'), 'Backup manifest'),
    readCanonicalRegularFile(
      resolve(backupDirectory, 'checksum-manifest.sha256'),
      'Backup checksum manifest',
    ),
    readCanonicalRegularFile(resolve(backupDirectory, 'backup-receipt.json'), 'Backup receipt'),
  ])
  const receipt = backupReceiptSchema.parse(JSON.parse(receiptBytes.toString('utf8')) as unknown)
  if (
    sha256(manifestBytes) !== expectedManifestSha256 ||
    sha256(checksumBytes) !== expectedChecksumManifestSha256 ||
    receipt.receiptIdentitySha256 !== expectedReceiptIdentitySha256
  ) {
    throw new Error('Backup identities differ from independently supplied release expectations.')
  }
  const verification = buildGoldImportV2CurrentBackupReleaseVerificationCandidate({
    authorityIdentitySha256: expectedAuthorityIdentitySha256,
    backupDirectory,
    checksumManifestSha256: expectedChecksumManifestSha256,
    manifestSha256: expectedManifestSha256,
    receiptIdentitySha256: expectedReceiptIdentitySha256,
    releaseFreeze: freeze,
    verifiedAt: input.verifiedAt ?? new Date().toISOString(),
  })
  writeExternalArtifact({
    bytes: canonicalPretty(verification),
    label: 'External release verification',
    output,
    outputRoot,
  })
  const writtenVerification = await readCanonicalRegularFile(
    output,
    'Written external release verification',
  )
  if (!writtenVerification.equals(canonicalPretty(verification))) {
    throw new Error(
      'Written external release verification differs from the reviewed canonical bytes.',
    )
  }
  await verifyGoldImportV2CurrentBackupRelease({
    expectedCurrentRuntimeBundle: input.expectedCurrentRuntimeBundle,
    releaseVerification: verification,
  })
  return verification
}

export async function runGoldImportV2CurrentBackup(argv: readonly string[]) {
  const parsed = parseGoldImportV2CurrentBackupArguments(argv)
  const modulePath = fileURLToPath(import.meta.url)
  const repositoryRoot = realpathSync(resolve(dirname(modulePath), '../..'))
  if (parsed.command === 'create-release-freeze') {
    const releaseFreeze = await createGoldImportV2CurrentBackupReleaseFreeze({
      cwd: repositoryRoot,
      output: parsed.output,
      outputRoot: parsed.outputRoot,
    })
    return {
      changedPathCount: releaseFreeze.changedPathCount,
      changedPathInventorySha256: releaseFreeze.changedPathInventorySha256,
      head: releaseFreeze.frozenHead,
      releaseFreezeIdentitySha256: releaseFreeze.releaseFreezeIdentitySha256,
      releaseFreezePath: resolve(parsed.output),
    }
  }
  if (parsed.command === 'create-release-verification') {
    assertSafeOutputPathArgument(parsed.releaseFreeze, 'Release-freeze path')
    const releaseFreezeBytes = await readCanonicalRegularFile(
      resolve(parsed.releaseFreeze),
      'External release-freeze artifact',
    )
    const releaseFreeze = validateGoldImportV2CurrentBackupReleaseFreeze(
      JSON.parse(releaseFreezeBytes.toString('utf8')) as unknown,
    )
    if (!releaseFreezeBytes.equals(canonicalPretty(releaseFreeze))) {
      throw new Error('External release-freeze artifact is not canonical.')
    }
    const runtimeBundle = await loadGoldImportV2PreimportRuntimeBundle(repositoryRoot)
    const releaseVerification = await createGoldImportV2CurrentBackupReleaseVerification({
      expectedAuthorityIdentitySha256: parsed.expectedAuthorityIdentitySha256,
      expectedChecksumManifestSha256: parsed.expectedChecksumManifestSha256,
      expectedCurrentRuntimeBundle: runtimeBundle,
      expectedManifestSha256: parsed.expectedManifestSha256,
      expectedReceiptIdentitySha256: parsed.expectedReceiptIdentitySha256,
      output: parsed.output,
      outputRoot: parsed.outputRoot,
      releaseFreeze,
    })
    return {
      authorityIdentitySha256: releaseVerification.backup.authorityIdentitySha256,
      head: releaseVerification.releaseFreeze.frozenHead,
      releaseFreezeIdentitySha256: releaseFreeze.releaseFreezeIdentitySha256,
      releaseVerificationIdentitySha256: releaseVerification.releaseVerificationIdentitySha256,
      releaseVerificationPath: resolve(parsed.output),
    }
  }
  assertSafeOutputPathArgument(parsed.outputRoot, 'Backup output root')
  assertSafeOutputPathArgument(parsed.output, 'Backup output')
  assertSafeOutputPathArgument(parsed.releaseFreeze, 'Release-freeze path')
  const releaseFreezePath = resolve(parsed.releaseFreeze)
  const releaseFreezeBytes = await readCanonicalRegularFile(
    releaseFreezePath,
    'External release-freeze artifact',
  )
  const releaseFreeze = validateGoldImportV2CurrentBackupReleaseFreeze(
    JSON.parse(releaseFreezeBytes.toString('utf8')) as unknown,
  )
  if (!releaseFreezeBytes.equals(canonicalPretty(releaseFreeze))) {
    throw new Error('External release-freeze artifact is not canonical.')
  }
  const inspected = await inspectGoldImportV2CurrentBackupRepository({
    cwd: repositoryRoot,
    releaseFreeze,
  })
  const repository = inspected.repository
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
      bytes: await readFrozenTrackedFile({
        cwd: repositoryRoot,
        head: releaseFreeze.frozenHead,
        label: `Runtime source ${path}`,
        path,
      }),
      name: path,
      sourcePath: resolve(repositoryRoot, path),
    })),
  )
  const frozenRuntimeBundle = buildGoldImportV2PreimportRuntimeBundle(
    runtimeSources.map(({ bytes, name }) => ({ bytes, path: name })),
  )
  if (canonicalJson(frozenRuntimeBundle) !== canonicalJson(runtimeBundle)) {
    throw new Error('Working-tree runtime bytes differ from the exact frozen release head.')
  }
  const changedPaths = inspected.changedPaths
  const changedTrackedFiles = await Promise.all(
    changedPaths.map(async (path) => ({
      bytes: await readFrozenTrackedFile({
        cwd: repositoryRoot,
        head: releaseFreeze.frozenHead,
        label: `Changed file ${path}`,
        path,
      }),
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
  const built = buildGoldImportV2CurrentBackupCandidateAuthority({
    changedTrackedFiles,
    evidence,
    repository,
    runtimeBundle: frozenRuntimeBundle,
    runtimeSources,
  })
  validateGoldImportV2CurrentBackupCandidateAuthority({
    authority: built.authority,
    expectedCurrentRuntimeBundle: frozenRuntimeBundle,
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
  const names = await readdir(output)
  return {
    authorityIdentitySha256: built.authority.authorityIdentitySha256,
    backupDirectory: output,
    checksumManifestSha256: sha256(checksums),
    fileCount: names.length,
    head: repository.head,
    manifestSha256: sha256(canonicalPretty(manifest)),
    releaseFreezeIdentitySha256: releaseFreeze.releaseFreezeIdentitySha256,
    receiptIdentitySha256: receipt.receiptIdentitySha256,
    status: 'candidate_backup_requires_external_release_verification',
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
