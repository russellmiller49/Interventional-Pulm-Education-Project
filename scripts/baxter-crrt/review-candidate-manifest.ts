import { createHash } from 'node:crypto'
import { posix } from 'node:path'

import { BAXTER_CRRT_REVIEW_CANDIDATE_PREFIX } from '../../src/features/baxter-crrt/content/candidateIdentity'

export { BAXTER_CRRT_REVIEW_CANDIDATE_PREFIX }

export const BAXTER_CRRT_REVIEW_CANDIDATE_SCHEMA_VERSION = 2 as const

type JsonPrimitive = boolean | null | number | string
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue }

export type BaxterCrrtGitObjectFormat = 'sha1' | 'sha256'
export type BaxterCrrtCandidateFileMode = '100644' | '100755'

export interface BaxterCrrtCandidateVersions {
  readonly engine: string
  readonly runtimeSchema: string
  readonly protectedPilotContent: string
  readonly phase7ReviewerContent: string
  readonly phase8ReviewerContent: string
  readonly prismaxProfile: string
  readonly prismaflexProfile: string
  readonly protocolProfile: null | string
}

export interface BaxterCrrtCandidateFileDigest {
  readonly path: string
  readonly mode: BaxterCrrtCandidateFileMode
  readonly sha256: string
  readonly sizeBytes: number
}

export interface BaxterCrrtExternalSourceRecord {
  readonly artifactId: string
  readonly fileName: string
  readonly expectedSha256: string
  readonly actualSha256: null | string
  readonly sizeBytes: null | number
  readonly verifiedFromSuppliedFile: boolean
}

export interface BaxterCrrtCandidateGitTreeIdentity {
  readonly objectFormat: BaxterCrrtGitObjectFormat
  readonly treeOid: string
}

export interface BaxterCrrtCandidateGitContext extends BaxterCrrtCandidateGitTreeIdentity {
  readonly branch: string
  readonly commit: string
  readonly repositoryClean: boolean
  readonly candidateScopeClean: boolean
  readonly candidateScopeChanges: readonly string[]
}

export interface BaxterCrrtReviewCandidateManifest {
  readonly schemaVersion: typeof BAXTER_CRRT_REVIEW_CANDIDATE_SCHEMA_VERSION
  readonly candidateId: string
  readonly generatedAt: string
  readonly freezeEligibility: 'eligible-clean-commit' | 'provisional-dirty-working-tree'
  readonly git: BaxterCrrtCandidateGitContext
  readonly versions: BaxterCrrtCandidateVersions
  readonly sourceArtifacts: readonly BaxterCrrtExternalSourceRecord[]
  readonly files: readonly BaxterCrrtCandidateFileDigest[]
  readonly reviewBoundary: Readonly<{
    publicationStatus: 'draft'
    protectedLearnerCaseIds: readonly ['CRRT-04', 'CRRT-10', 'CRRT-13']
    phase7Status: 'reviewer-only-not-activated'
    phase8Status: 'reviewer-only-not-activated'
    protocolProfileStatus: 'absent-unless-separately-approved'
  }>
  readonly validationEvidencePath: 'docs/baxter-crrt/engine-validation.md'
}

export interface BuildBaxterCrrtReviewCandidateManifestInput {
  readonly generatedAt: string
  readonly git: BaxterCrrtCandidateGitContext
  readonly versions: BaxterCrrtCandidateVersions
  readonly sourceArtifacts: readonly BaxterCrrtExternalSourceRecord[]
  readonly files: readonly BaxterCrrtCandidateFileDigest[]
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const PORTABLE_PATH_PATTERN = /^[A-Za-z0-9._/\[\]-]+$/u
const PORTABLE_FILE_NAME_PATTERN = /^[A-Za-z0-9._-]+$/u
const PORTABLE_ARTIFACT_ID_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/u
const FORBIDDEN_CANDIDATE_PATH_SEGMENTS = new Set([
  '.cache',
  '.next',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'playwright-report',
  'test-results',
])
const SECRET_OR_LOG_FILE_PATTERN = /(?:\.log|\.pem|\.p12|\.pfx|\.key)$/iu

export function sha256Hex(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex')
}

/** Compare strings by their unsigned UTF-8 bytes, independent of host locale. */
export function compareUtf8Bytes(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'))
}

function isJsonArray(value: JsonValue): value is readonly JsonValue[] {
  return Array.isArray(value)
}

function sortJson(value: JsonValue): JsonValue {
  if (isJsonArray(value)) return value.map(sortJson)
  if (value === null || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.keys(value)
      .sort(compareUtf8Bytes)
      .map((key) => [key, sortJson(value[key])]),
  )
}

function normalizeJsonValue(
  value: unknown,
  path = '$',
  ancestors: Set<object> = new Set(),
): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${path} must contain a finite JSON number.`)
    return value
  }
  if (typeof value !== 'object') {
    throw new TypeError(`${path} contains a value that cannot be represented in JSON.`)
  }
  if (ancestors.has(value)) throw new TypeError(`${path} contains a circular JSON reference.`)

  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      return value.map((entry, index) => normalizeJsonValue(entry, `${path}[${index}]`, ancestors))
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`${path} must contain only plain JSON objects.`)
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        normalizeJsonValue(entry, `${path}.${key}`, ancestors),
      ]),
    )
  } finally {
    ancestors.delete(value)
  }
}

/**
 * Canonical JSON for this manifest schema. Arrays retain their authored order;
 * callers canonicalize set-like arrays before passing them here.
 */
export function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(normalizeJsonValue(value)))
}

function assertSha256(value: string, label: string): void {
  if (!SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase 64-character SHA-256 digest.`)
  }
}

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} must not contain duplicates.`)
  }
}

function assertNonemptyVersion(value: string, label: string): void {
  if (!value.trim() || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error(`${label} must be nonempty and contain no control characters.`)
  }
}

export function assertSafeRepositoryRelativePath(path: string): void {
  const segments = path.split('/')
  if (
    !path ||
    path.startsWith('/') ||
    /^[A-Za-z]:/u.test(path) ||
    !PORTABLE_PATH_PATTERN.test(path) ||
    path !== posix.normalize(path) ||
    segments.some((segment) => segment === '' || segment === '.' || segment === '..') ||
    segments.includes('.git') ||
    segments.some(
      (segment) =>
        FORBIDDEN_CANDIDATE_PATH_SEGMENTS.has(segment) || segment.toLowerCase().startsWith('.env'),
    ) ||
    SECRET_OR_LOG_FILE_PATTERN.test(segments.at(-1) ?? '')
  ) {
    throw new Error(`Candidate file path must be a safe repository-relative path: ${path}`)
  }
}

function assertGitOid(value: string, objectFormat: BaxterCrrtGitObjectFormat, label: string): void {
  const expectedLength = objectFormat === 'sha1' ? 40 : 64
  const pattern = new RegExp(`^[a-f0-9]{${expectedLength}}$`, 'u')
  if (!pattern.test(value)) {
    throw new Error(`${label} must be a full ${objectFormat} Git object ID.`)
  }
}

function canonicalVersions(versions: BaxterCrrtCandidateVersions): BaxterCrrtCandidateVersions {
  for (const [key, value] of Object.entries(versions)) {
    if (value !== null) assertNonemptyVersion(value, `Candidate version ${key}`)
  }
  return Object.freeze({
    engine: versions.engine,
    runtimeSchema: versions.runtimeSchema,
    protectedPilotContent: versions.protectedPilotContent,
    phase7ReviewerContent: versions.phase7ReviewerContent,
    phase8ReviewerContent: versions.phase8ReviewerContent,
    prismaxProfile: versions.prismaxProfile,
    prismaflexProfile: versions.prismaflexProfile,
    protocolProfile: versions.protocolProfile,
  })
}

function canonicalFiles(
  files: readonly BaxterCrrtCandidateFileDigest[],
): readonly BaxterCrrtCandidateFileDigest[] {
  const sorted = [...files].sort((left, right) => compareUtf8Bytes(left.path, right.path))
  assertUnique(
    sorted.map((file) => file.path),
    'Candidate file paths',
  )

  for (const file of sorted) {
    assertSafeRepositoryRelativePath(file.path)
    if (file.mode !== '100644' && file.mode !== '100755') {
      throw new Error(`Candidate file mode must be 100644 or 100755: ${file.path}`)
    }
    if (!Number.isSafeInteger(file.sizeBytes) || file.sizeBytes < 0) {
      throw new Error(`Candidate file size must be a non-negative safe integer: ${file.path}`)
    }
    assertSha256(file.sha256, `Candidate file digest for ${file.path}`)
  }

  return Object.freeze(
    sorted.map((file) =>
      Object.freeze({
        path: file.path,
        mode: file.mode,
        sha256: file.sha256,
        sizeBytes: file.sizeBytes,
      }),
    ),
  )
}

function canonicalSources(
  sources: readonly BaxterCrrtExternalSourceRecord[],
): readonly BaxterCrrtExternalSourceRecord[] {
  const sorted = [...sources].sort((left, right) =>
    compareUtf8Bytes(left.artifactId, right.artifactId),
  )
  assertUnique(
    sorted.map((source) => source.artifactId),
    'External source artifact IDs',
  )
  assertUnique(
    sorted.map((source) => source.fileName),
    'External source filenames',
  )

  for (const source of sorted) {
    if (!PORTABLE_ARTIFACT_ID_PATTERN.test(source.artifactId)) {
      throw new Error(`External source artifact ID is not portable: ${source.artifactId}`)
    }
    if (!PORTABLE_FILE_NAME_PATTERN.test(source.fileName)) {
      throw new Error(`External source filename must be a safe basename: ${source.fileName}`)
    }
    assertSha256(source.expectedSha256, `Expected source digest for ${source.artifactId}`)
    if (source.actualSha256 !== null) {
      assertSha256(source.actualSha256, `Actual source digest for ${source.artifactId}`)
    }
    if (source.verifiedFromSuppliedFile) {
      if (
        source.actualSha256 !== source.expectedSha256 ||
        source.sizeBytes === null ||
        !Number.isSafeInteger(source.sizeBytes) ||
        source.sizeBytes < 0
      ) {
        throw new Error(
          `Verified source attestation is incomplete or mismatched: ${source.artifactId}`,
        )
      }
    } else if (source.actualSha256 !== null || source.sizeBytes !== null) {
      throw new Error(`Unverified source must not record observed bytes: ${source.artifactId}`)
    }
  }

  return Object.freeze(
    sorted.map((source) =>
      Object.freeze({
        artifactId: source.artifactId,
        fileName: source.fileName,
        expectedSha256: source.expectedSha256,
        actualSha256: source.actualSha256,
        sizeBytes: source.sizeBytes,
        verifiedFromSuppliedFile: source.verifiedFromSuppliedFile,
      }),
    ),
  )
}

function candidateIdentityPayload(
  git: BaxterCrrtCandidateGitTreeIdentity,
  versions: BaxterCrrtCandidateVersions,
  sourceArtifacts: readonly BaxterCrrtExternalSourceRecord[],
  files: readonly BaxterCrrtCandidateFileDigest[],
): JsonValue {
  return {
    schemaVersion: BAXTER_CRRT_REVIEW_CANDIDATE_SCHEMA_VERSION,
    gitTree: {
      objectFormat: git.objectFormat,
      treeOid: git.treeOid,
    },
    versions: {
      engine: versions.engine,
      runtimeSchema: versions.runtimeSchema,
      protectedPilotContent: versions.protectedPilotContent,
      phase7ReviewerContent: versions.phase7ReviewerContent,
      phase8ReviewerContent: versions.phase8ReviewerContent,
      prismaxProfile: versions.prismaxProfile,
      prismaflexProfile: versions.prismaflexProfile,
      protocolProfile: versions.protocolProfile,
    },
    sourceArtifacts: sourceArtifacts.map((source) => ({
      artifactId: source.artifactId,
      fileName: source.fileName,
      expectedSha256: source.expectedSha256,
    })),
    files: files.map((file) => ({
      path: file.path,
      mode: file.mode,
      sha256: file.sha256,
      sizeBytes: file.sizeBytes,
    })),
    reviewBoundary: {
      publicationStatus: 'draft',
      protectedLearnerCaseIds: ['CRRT-04', 'CRRT-10', 'CRRT-13'],
      phase7Status: 'reviewer-only-not-activated',
      phase8Status: 'reviewer-only-not-activated',
      protocolProfileStatus: 'absent-unless-separately-approved',
    },
  }
}

export function createBaxterCrrtCandidateId(
  git: BaxterCrrtCandidateGitTreeIdentity,
  versions: BaxterCrrtCandidateVersions,
  sourceArtifacts: readonly BaxterCrrtExternalSourceRecord[],
  files: readonly BaxterCrrtCandidateFileDigest[],
): string {
  if (git.objectFormat !== 'sha1' && git.objectFormat !== 'sha256') {
    throw new Error(`Unsupported Git object format: ${String(git.objectFormat)}`)
  }
  assertGitOid(git.treeOid, git.objectFormat, 'Candidate Git tree')
  const normalizedVersions = canonicalVersions(versions)
  const normalizedFiles = canonicalFiles(files)
  const normalizedSources = canonicalSources(sourceArtifacts)
  const digest = sha256Hex(
    stableJson(
      candidateIdentityPayload(git, normalizedVersions, normalizedSources, normalizedFiles),
    ),
  )
  return `${BAXTER_CRRT_REVIEW_CANDIDATE_PREFIX}${digest}`
}

export function buildBaxterCrrtReviewCandidateManifest(
  input: BuildBaxterCrrtReviewCandidateManifestInput,
): BaxterCrrtReviewCandidateManifest {
  if (!Number.isFinite(Date.parse(input.generatedAt))) {
    throw new Error('Candidate manifest generatedAt must be an ISO-compatible timestamp.')
  }
  if (!input.git.branch.trim()) {
    throw new Error('Candidate manifest requires a Git branch or detached-head label.')
  }
  if (input.git.objectFormat !== 'sha1' && input.git.objectFormat !== 'sha256') {
    throw new Error(`Unsupported Git object format: ${String(input.git.objectFormat)}`)
  }
  assertGitOid(input.git.commit, input.git.objectFormat, 'Candidate Git commit')
  assertGitOid(input.git.treeOid, input.git.objectFormat, 'Candidate Git tree')

  const candidateScopeChanges = [...input.git.candidateScopeChanges].sort(compareUtf8Bytes)
  assertUnique(candidateScopeChanges, 'Candidate scope changes')
  candidateScopeChanges.forEach(assertSafeRepositoryRelativePath)

  const versions = canonicalVersions(input.versions)
  const files = canonicalFiles(input.files)
  const sourceArtifacts = canonicalSources(input.sourceArtifacts)
  const candidateId = createBaxterCrrtCandidateId(input.git, versions, sourceArtifacts, files)
  const clean = input.git.repositoryClean && input.git.candidateScopeClean

  return Object.freeze({
    schemaVersion: BAXTER_CRRT_REVIEW_CANDIDATE_SCHEMA_VERSION,
    candidateId,
    generatedAt: new Date(input.generatedAt).toISOString(),
    freezeEligibility: clean ? 'eligible-clean-commit' : 'provisional-dirty-working-tree',
    git: Object.freeze({
      branch: input.git.branch,
      commit: input.git.commit,
      objectFormat: input.git.objectFormat,
      treeOid: input.git.treeOid,
      repositoryClean: input.git.repositoryClean,
      candidateScopeClean: input.git.candidateScopeClean,
      candidateScopeChanges: Object.freeze(candidateScopeChanges),
    }),
    versions,
    sourceArtifacts,
    files,
    reviewBoundary: Object.freeze({
      publicationStatus: 'draft',
      protectedLearnerCaseIds: Object.freeze(['CRRT-04', 'CRRT-10', 'CRRT-13'] as const),
      phase7Status: 'reviewer-only-not-activated',
      phase8Status: 'reviewer-only-not-activated',
      protocolProfileStatus: 'absent-unless-separately-approved',
    }),
    validationEvidencePath: 'docs/baxter-crrt/engine-validation.md',
  })
}

export function verifyBaxterCrrtReviewCandidateManifest(
  recorded: BaxterCrrtReviewCandidateManifest,
  current: BaxterCrrtReviewCandidateManifest,
): readonly string[] {
  const findings: string[] = []

  let normalizedRecorded: BaxterCrrtReviewCandidateManifest
  try {
    normalizedRecorded = buildBaxterCrrtReviewCandidateManifest({
      generatedAt: recorded.generatedAt,
      git: recorded.git,
      versions: recorded.versions,
      sourceArtifacts: recorded.sourceArtifacts,
      files: recorded.files,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return Object.freeze([`Recorded manifest is invalid: ${detail}`])
  }

  if (stableJson(recorded) !== stableJson(normalizedRecorded)) {
    findings.push(
      'Recorded manifest is not the canonical internally consistent manifest for its recorded inputs.',
    )
  }
  if (
    normalizedRecorded.freezeEligibility !== 'eligible-clean-commit' ||
    !normalizedRecorded.git.repositoryClean ||
    !normalizedRecorded.git.candidateScopeClean ||
    normalizedRecorded.git.candidateScopeChanges.length > 0
  ) {
    findings.push('Recorded manifest was not created from a fully clean committed repository.')
  }
  if (normalizedRecorded.sourceArtifacts.some((source) => !source.verifiedFromSuppliedFile)) {
    findings.push('Recorded manifest does not contain verified supplied-source attestations.')
  }
  if (recorded.schemaVersion !== current.schemaVersion) {
    findings.push('Manifest schema version changed.')
  }
  if (recorded.candidateId !== current.candidateId) {
    findings.push(
      'Candidate identity does not match the current Git tree, scoped files, versions, or sources.',
    )
  }
  if (recorded.git.objectFormat !== current.git.objectFormat) {
    findings.push('Git object format does not match the recorded candidate context.')
  }
  if (recorded.git.treeOid !== current.git.treeOid) {
    findings.push('Git tree does not match the recorded candidate context.')
  }
  if (recorded.git.commit !== current.git.commit) {
    findings.push('Git commit does not match the recorded candidate context.')
  }
  if (!current.git.repositoryClean || !current.git.candidateScopeClean) {
    findings.push(
      'The current working tree is not clean and cannot be treated as a frozen candidate.',
    )
  }
  if (current.sourceArtifacts.some((source) => !source.verifiedFromSuppliedFile)) {
    findings.push('One or more supplied external source artifacts were not verified in this run.')
  }

  return Object.freeze(findings)
}
