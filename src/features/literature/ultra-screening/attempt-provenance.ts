import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { access, lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const GIT_COMMIT_PATTERN = /^[a-f0-9]{40,64}$/u
const SAFE_IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._-]{1,127}$/u
const TEMPLATE_TOKEN_PATTERN = /\{\{([A-Z0-9_]+)\}\}/gu

export const ULTRA_ATTEMPT_PROVENANCE_VERSION = '2.0.0' as const

export interface VersionedCheckedArtifact {
  version: string
  path: string
  sha256: string
}

export interface RepositoryAmendment {
  amendmentVersion: string
  repositoryCommit: string
  approvedAt: string
  approvedBy: string
  rationale: string
}

export interface ApprovedAttemptRunDefinition {
  repositoryCommit: string
  screeningPolicy: VersionedCheckedArtifact
  workerPromptTemplate: VersionedCheckedArtifact
  workerBootstrapPrompt?: VersionedCheckedArtifact | null
  repositoryAmendments?: readonly RepositoryAmendment[]
  packetInventory: ReadonlyArray<{
    chunkId: string
    phaseId: string
    packetPath: string
    packetSha256: string
    [key: string]: unknown
  }>
  workerOutputRoot: string
}

export interface RepositoryState {
  repositoryCommit: string
  workingTreeClean: boolean
  trackedStatus: string
}

export interface PrepareAttemptProvenanceOptions {
  repositoryRoot: string
  stateRoot: string
  runDefinition: ApprovedAttemptRunDefinition
  chunkId: string
  attemptNumber: number
  workerId: string
  workerSessionId: string
  assignmentId: string
  assignmentOrdinal: number
  actualModel: string
  reasoningLevel: string
  packetPath: string
  packetSha256: string
  outputPath: string
  reusableWorker?: boolean
  renderedPromptPath?: string
  timestamp?: string
}

export interface PreparedAttemptProvenance {
  provenanceVersion: typeof ULTRA_ATTEMPT_PROVENANCE_VERSION
  status: 'prepared'
  repositoryRoot: string
  repositoryCommit: string
  workingTreeClean: true
  repositoryAmendmentVersion: string | null
  screeningPolicyVersion: string
  screeningPolicyPath: string
  screeningPolicySha256: string
  workerPromptTemplateVersion: string
  workerPromptTemplatePath: string
  workerPromptTemplateSha256: string
  renderedPromptPath: string
  renderedPromptSha256: string
  workerBootstrapPromptPath: string | null
  workerBootstrapPromptSha256: string | null
  workerId: string
  workerSessionId: string
  assignmentId: string
  assignmentOrdinal: number
  chunkId: string
  attemptNumber: number
  actualModel: string
  reasoningLevel: string
  packetPath: string
  packetSha256: string
  outputPath: string
  outputSha256: null
  validationReportPath: null
  validationReportSha256: null
  preparedAt: string
  startedAt: null
  completedAt: null
}

export interface CompletedAttemptProvenance extends Omit<
  PreparedAttemptProvenance,
  | 'status'
  | 'outputSha256'
  | 'validationReportPath'
  | 'validationReportSha256'
  | 'startedAt'
  | 'completedAt'
> {
  status: 'completed' | 'invalid' | 'failed'
  outputSha256: string | null
  validationReportPath: string
  validationReportSha256: string
  startedAt: string
  completedAt: string
}

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex')
}

function assertSha256(value: string, label: string) {
  if (!SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest.`)
  }
}

function assertIdentifier(value: string, label: string) {
  if (!SAFE_IDENTIFIER_PATTERN.test(value)) {
    throw new Error(`${label} must be a safe lowercase identifier.`)
  }
}

function assertPositiveInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer.`)
  }
}

function assertIsoTimestamp(value: string, label: string) {
  if (!value.includes('T') || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} must be an ISO-8601 timestamp.`)
  }
}

function assertWithinRoot(root: string, candidate: string, label: string) {
  const pathFromRoot = relative(resolve(root), resolve(candidate))
  if (
    pathFromRoot === '' ||
    pathFromRoot === '..' ||
    pathFromRoot.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
  ) {
    throw new Error(`${label} must be inside its authorized root.`)
  }
}

export async function assertNoSymlinkPathEscape(root: string, candidate: string, label: string) {
  const resolvedRoot = resolve(root)
  const resolvedCandidate = resolve(candidate)
  assertWithinRoot(resolvedRoot, resolvedCandidate, label)

  let inspectionRoot = resolvedRoot
  while (true) {
    try {
      await lstat(inspectionRoot)
      break
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
        throw error
      }
      const parent = dirname(inspectionRoot)
      if (parent === inspectionRoot) {
        throw new Error(`${label} has no resolvable authorization ancestor: ${resolvedRoot}`)
      }
      inspectionRoot = parent
    }
  }
  await realpath(inspectionRoot)
  if ((await lstat(inspectionRoot)).isSymbolicLink()) {
    throw new Error(`${label} authorization path must not be a symbolic link: ${inspectionRoot}`)
  }

  const components = relative(inspectionRoot, resolvedCandidate).split(/[\\/]/u)
  let current = inspectionRoot
  for (const component of components) {
    current = resolve(current, component)
    try {
      const metadata = await lstat(current)
      if (metadata.isSymbolicLink()) {
        throw new Error(`${label} must not traverse a symbolic link: ${current}`)
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') break
      throw error
    }
  }
}

function resolvedDefinedPath(repositoryRoot: string, path: string) {
  return isAbsolute(path) ? resolve(path) : resolve(repositoryRoot, path)
}

async function sha256File(path: string) {
  return sha256(await readFile(path))
}

async function assertCheckedArtifact(
  artifact: VersionedCheckedArtifact,
  label: string,
  repositoryRoot: string,
) {
  if (!artifact.version.trim()) throw new Error(`${label} version must not be empty.`)
  assertSha256(artifact.sha256, `${label} sha256`)
  const path = resolve(repositoryRoot, artifact.path)
  await assertNoSymlinkPathEscape(repositoryRoot, path, `${label} path`)
  const actualSha256 = await sha256File(path)
  if (actualSha256 !== artifact.sha256) {
    throw new Error(
      `${label} checksum mismatch: expected ${artifact.sha256}, received ${actualSha256}.`,
    )
  }
  return { path, text: await readFile(path, 'utf8'), sha256: actualSha256 }
}

async function writeImmutableText(path: string, content: string) {
  await mkdir(dirname(path), { recursive: true })
  try {
    await writeFile(path, content, { encoding: 'utf8', flag: 'wx' })
    return 'created' as const
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')) {
      throw error
    }
    const existing = await readFile(path, 'utf8')
    if (existing !== content) {
      throw new Error(`Refusing to overwrite nonmatching rendered prompt: ${path}`)
    }
    return 'verified' as const
  }
}

function renderTemplate(template: string, substitutions: Readonly<Record<string, string>>) {
  const rendered = template.replace(TEMPLATE_TOKEN_PATTERN, (_match, token: string) => {
    const replacement = substitutions[token]
    if (replacement === undefined) {
      throw new Error(`Worker prompt template contains unknown token {{${token}}}.`)
    }
    return replacement
  })
  const unresolved = [...rendered.matchAll(TEMPLATE_TOKEN_PATTERN)].map((match) => match[0])
  if (unresolved.length > 0) {
    throw new Error(`Rendered prompt contains unresolved tokens: ${unresolved.join(', ')}`)
  }
  return rendered.endsWith('\n') ? rendered : `${rendered}\n`
}

export async function readTrackedRepositoryState(repositoryRoot: string): Promise<RepositoryState> {
  const root = resolve(repositoryRoot)
  const [{ stdout: commitOutput }, { stdout: statusOutput }] = await Promise.all([
    execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }),
    execFileAsync(
      'git',
      ['status', '--porcelain=v1', '--untracked-files=no', '--ignore-submodules=none'],
      { cwd: root, encoding: 'utf8' },
    ),
  ])
  const repositoryCommit = commitOutput.trim()
  const trackedStatus = statusOutput.trimEnd()
  if (!GIT_COMMIT_PATTERN.test(repositoryCommit)) {
    throw new Error('Git returned an invalid repository commit.')
  }
  return {
    repositoryCommit,
    workingTreeClean: trackedStatus.length === 0,
    trackedStatus,
  }
}

function approvedCommit(state: RepositoryState, runDefinition: ApprovedAttemptRunDefinition) {
  if (!GIT_COMMIT_PATTERN.test(runDefinition.repositoryCommit)) {
    throw new Error('The approved run definition has an invalid repository commit.')
  }
  if (state.repositoryCommit === runDefinition.repositoryCommit) return null
  const amendment = runDefinition.repositoryAmendments?.find(
    (candidate) => candidate.repositoryCommit === state.repositoryCommit,
  )
  if (!amendment) {
    throw new Error(
      `Repository commit ${state.repositoryCommit} differs from approved run commit ${runDefinition.repositoryCommit}; an explicit versioned amendment is required.`,
    )
  }
  if (
    !amendment.amendmentVersion.trim() ||
    !amendment.approvedBy.trim() ||
    !amendment.rationale.trim()
  ) {
    throw new Error('Repository amendment metadata is incomplete.')
  }
  assertIsoTimestamp(amendment.approvedAt, 'repository amendment approvedAt')
  return amendment.amendmentVersion
}

export async function prepareAttemptProvenance(
  options: PrepareAttemptProvenanceOptions,
): Promise<{ provenance: PreparedAttemptProvenance; renderedPrompt: string }> {
  assertIdentifier(options.chunkId, 'chunkId')
  assertIdentifier(options.workerId, 'workerId')
  assertIdentifier(options.workerSessionId, 'workerSessionId')
  assertIdentifier(options.assignmentId, 'assignmentId')
  assertPositiveInteger(options.attemptNumber, 'attemptNumber')
  assertPositiveInteger(options.assignmentOrdinal, 'assignmentOrdinal')
  assertSha256(options.packetSha256, 'packetSha256')
  if (!options.actualModel.trim()) throw new Error('actualModel must not be empty.')
  if (!options.reasoningLevel.trim()) throw new Error('reasoningLevel must not be empty.')

  const repositoryRoot = resolve(options.repositoryRoot)
  const stateRoot = resolve(options.stateRoot)
  const repositoryState = await readTrackedRepositoryState(repositoryRoot)
  if (!repositoryState.workingTreeClean) {
    throw new Error(
      `Refusing to prepare a nonlegacy attempt from a dirty tracked worktree:\n${repositoryState.trackedStatus}`,
    )
  }
  const amendmentVersion = approvedCommit(repositoryState, options.runDefinition)

  const policy = await assertCheckedArtifact(
    options.runDefinition.screeningPolicy,
    'Screening policy',
    repositoryRoot,
  )
  const promptTemplate = await assertCheckedArtifact(
    options.runDefinition.workerPromptTemplate,
    'Worker prompt template',
    repositoryRoot,
  )
  const bootstrapDefinition = options.runDefinition.workerBootstrapPrompt ?? null
  if (options.reusableWorker && !bootstrapDefinition) {
    throw new Error('Reusable workers require an approved bootstrap prompt.')
  }
  const bootstrap = bootstrapDefinition
    ? await assertCheckedArtifact(bootstrapDefinition, 'Worker bootstrap prompt', repositoryRoot)
    : null

  const packetDefinition = options.runDefinition.packetInventory.find(
    (candidate) => candidate.chunkId === options.chunkId,
  )
  if (!packetDefinition) {
    throw new Error(`Chunk ${options.chunkId} is absent from the immutable packet inventory.`)
  }
  assertSha256(packetDefinition.packetSha256, 'packet inventory sha256')
  const packetPath = resolve(options.packetPath)
  const definedPacketPath = resolvedDefinedPath(repositoryRoot, packetDefinition.packetPath)
  if (packetPath !== definedPacketPath || options.packetSha256 !== packetDefinition.packetSha256) {
    throw new Error(
      `Packet assignment mismatch for ${options.chunkId}; path and checksum must match the immutable packet inventory.`,
    )
  }
  await assertNoSymlinkPathEscape(resolve(stateRoot, '..'), packetPath, 'packetPath')
  const actualPacketSha256 = await sha256File(packetPath)
  if (actualPacketSha256 !== options.packetSha256) {
    throw new Error(
      `Packet checksum mismatch: expected ${options.packetSha256}, received ${actualPacketSha256}.`,
    )
  }

  const outputPath = resolve(options.outputPath)
  const workerOutputRoot = resolvedDefinedPath(
    repositoryRoot,
    options.runDefinition.workerOutputRoot,
  )
  assertWithinRoot(workerOutputRoot, outputPath, 'outputPath')
  await assertNoSymlinkPathEscape(workerOutputRoot, outputPath, 'outputPath')
  try {
    await access(outputPath)
    throw new Error(`Future attempt output already exists: ${outputPath}`)
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
      throw error
    }
  }

  const renderedPromptPath = resolve(
    options.renderedPromptPath ??
      resolve(
        stateRoot,
        'rendered-prompts',
        options.assignmentId,
        `${options.chunkId}.attempt-${options.attemptNumber}.md`,
      ),
  )
  assertWithinRoot(stateRoot, renderedPromptPath, 'renderedPromptPath')
  await assertNoSymlinkPathEscape(stateRoot, renderedPromptPath, 'renderedPromptPath')
  const renderedPrompt = renderTemplate(promptTemplate.text, {
    ASSIGNMENT_ID: options.assignmentId,
    ASSIGNMENT_ORDINAL: String(options.assignmentOrdinal),
    ATTEMPT_NUMBER: String(options.attemptNumber),
    CHUNK_ID: options.chunkId,
    OUTPUT_PATH: outputPath,
    PACKET_PATH: packetPath,
    PACKET_SHA256: actualPacketSha256,
    SCREENING_POLICY_SHA256: policy.sha256,
    SCREENING_POLICY_TEXT: policy.text.trimEnd(),
    SCREENING_POLICY_VERSION: options.runDefinition.screeningPolicy.version,
  })
  await writeImmutableText(renderedPromptPath, renderedPrompt)
  const renderedPromptSha256 = await sha256File(renderedPromptPath)
  if (renderedPromptSha256 !== sha256(renderedPrompt)) {
    throw new Error('Rendered prompt checksum changed during publication.')
  }

  const preparedAt = options.timestamp ?? new Date().toISOString()
  assertIsoTimestamp(preparedAt, 'preparedAt')
  const provenance: PreparedAttemptProvenance = {
    provenanceVersion: ULTRA_ATTEMPT_PROVENANCE_VERSION,
    status: 'prepared',
    repositoryRoot,
    repositoryCommit: repositoryState.repositoryCommit,
    workingTreeClean: true,
    repositoryAmendmentVersion: amendmentVersion,
    screeningPolicyVersion: options.runDefinition.screeningPolicy.version,
    screeningPolicyPath: policy.path,
    screeningPolicySha256: policy.sha256,
    workerPromptTemplateVersion: options.runDefinition.workerPromptTemplate.version,
    workerPromptTemplatePath: promptTemplate.path,
    workerPromptTemplateSha256: promptTemplate.sha256,
    renderedPromptPath,
    renderedPromptSha256,
    workerBootstrapPromptPath: options.reusableWorker ? (bootstrap?.path ?? null) : null,
    workerBootstrapPromptSha256: options.reusableWorker ? (bootstrap?.sha256 ?? null) : null,
    workerId: options.workerId,
    workerSessionId: options.workerSessionId,
    assignmentId: options.assignmentId,
    assignmentOrdinal: options.assignmentOrdinal,
    chunkId: options.chunkId,
    attemptNumber: options.attemptNumber,
    actualModel: options.actualModel,
    reasoningLevel: options.reasoningLevel,
    packetPath,
    packetSha256: actualPacketSha256,
    outputPath,
    outputSha256: null,
    validationReportPath: null,
    validationReportSha256: null,
    preparedAt,
    startedAt: null,
    completedAt: null,
  }
  return { provenance, renderedPrompt }
}

export async function assertPreparedAttemptIntegrity(
  provenance: PreparedAttemptProvenance,
  options: { verifyRepositoryState?: boolean } = {},
) {
  const checks: Array<readonly [string, string, string]> = [
    ['screening policy', provenance.screeningPolicyPath, provenance.screeningPolicySha256],
    [
      'worker prompt template',
      provenance.workerPromptTemplatePath,
      provenance.workerPromptTemplateSha256,
    ],
    ['rendered prompt', provenance.renderedPromptPath, provenance.renderedPromptSha256],
    ['packet', provenance.packetPath, provenance.packetSha256],
  ]
  if (provenance.workerBootstrapPromptPath && provenance.workerBootstrapPromptSha256) {
    checks.push([
      'worker bootstrap prompt',
      provenance.workerBootstrapPromptPath,
      provenance.workerBootstrapPromptSha256,
    ])
  }
  for (const [label, path, expected] of checks) {
    const actual = await sha256File(path)
    if (actual !== expected) {
      throw new Error(
        `${label} checksum mismatch before dispatch: expected ${expected}, got ${actual}.`,
      )
    }
  }
  if (options.verifyRepositoryState !== false) {
    const repositoryState = await readTrackedRepositoryState(provenance.repositoryRoot)
    if (
      !repositoryState.workingTreeClean ||
      repositoryState.repositoryCommit !== provenance.repositoryCommit
    ) {
      throw new Error(
        `Repository state changed before dispatch; expected clean commit ${provenance.repositoryCommit}, received ${repositoryState.repositoryCommit} with status ${repositoryState.trackedStatus || 'clean'}.`,
      )
    }
  }
}

export async function completeAttemptProvenance(options: {
  prepared: PreparedAttemptProvenance
  status: CompletedAttemptProvenance['status']
  startedAt: string
  completedAt: string
  validationReportPath: string
  outputMayBeMissing?: boolean
}): Promise<CompletedAttemptProvenance> {
  assertIsoTimestamp(options.startedAt, 'startedAt')
  assertIsoTimestamp(options.completedAt, 'completedAt')
  if (Date.parse(options.startedAt) < Date.parse(options.prepared.preparedAt)) {
    throw new Error('startedAt must not precede preparedAt.')
  }
  if (Date.parse(options.completedAt) < Date.parse(options.startedAt)) {
    throw new Error('completedAt must not precede startedAt.')
  }
  const validationReportPath = resolve(options.validationReportPath)
  const validationReportSha256 = await sha256File(validationReportPath)
  let outputSha256: string | null
  try {
    outputSha256 = await sha256File(options.prepared.outputPath)
  } catch (error) {
    if (
      options.status === 'failed' &&
      options.outputMayBeMissing &&
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      outputSha256 = null
    } else {
      throw error
    }
  }
  return {
    ...options.prepared,
    status: options.status,
    outputSha256,
    validationReportPath,
    validationReportSha256,
    startedAt: options.startedAt,
    completedAt: options.completedAt,
  }
}
