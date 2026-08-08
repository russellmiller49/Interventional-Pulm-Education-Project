import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, open } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { posix } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const PATH_SCOPED_MERGE_EQUIVALENCE_INPUT_SCHEMA_VERSION =
  'literature-path-scoped-merge-equivalence-input/1.0.0' as const
export const PATH_SCOPED_MERGE_EQUIVALENCE_RECEIPT_SCHEMA_VERSION =
  'literature-path-scoped-merge-equivalence-receipt/1.0.0' as const

export const MERGE_EQUIVALENCE_JSON_FILENAME = 'merge-equivalence-receipt.json' as const
export const MERGE_EQUIVALENCE_MARKDOWN_FILENAME = 'merge-equivalence-receipt.md' as const
export const MERGE_EQUIVALENCE_MANIFEST_FILENAME = 'manifest.sha256' as const

const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/u
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u

export interface AcceptedUnrelatedMergeInput {
  identity: string
  mergeCommit: string
}

export interface PathScopedMergeEquivalenceInput {
  acceptedUnrelatedMerges: AcceptedUnrelatedMergeInput[]
  featureHead: string
  mergeCommit: string
  mergedMain: string
  protectedPaths: string[]
  schemaVersion: typeof PATH_SCOPED_MERGE_EQUIVALENCE_INPUT_SCHEMA_VERSION
}

export interface TreeIdentity {
  mode: string
  objectId: string
  type: string
}

export interface CommitIdentity {
  parents: string[]
  sha: string
  tree: string
}

export interface ProtectedPathIdentity {
  featureHead: TreeIdentity
  mergedMain: TreeIdentity
  path: string
  result: 'identical'
}

export interface AcceptedUnrelatedMergeProof {
  changedPathCount: number
  changedPathInventorySha256: string
  changedPaths: string[]
  firstParent: string
  identity: string
  mergeCommit: CommitIdentity
}

export interface AdditionalPathAttribution {
  acceptedMerge: {
    identity: string
    mergeCommit: string
    treeEntry: TreeIdentity | null
  }
  featureHead: TreeIdentity | null
  mergedMain: TreeIdentity | null
  path: string
  result: 'attributed_to_accepted_unrelated_merge'
}

export interface PathScopedMergeEquivalenceReceipt {
  acceptedUnrelatedMerges: AcceptedUnrelatedMergeProof[]
  additionalMergedMainPaths: AdditionalPathAttribution[]
  ancestry: {
    featureHeadDirectParentIndex: number | null
    featureHeadIsAncestorOfMergeCommit: true
    featureHeadIsDirectParentOfMergeCommit: boolean
    mergeCommitIsAncestorOfMergedMain: true
  }
  commits: {
    featureHead: CommitIdentity
    mergeCommit: CommitIdentity
    mergedMain: CommitIdentity
  }
  counts: {
    acceptedUnrelatedMergeCount: number
    additionalMergedMainPathCount: number
    identicalProtectedPathCount: number
    overlapPathCount: 0
    protectedPathCount: number
  }
  databaseAccessed: false
  inventories: {
    additionalMergedMainPathSha256: string
    protectedPathSha256: string
  }
  kind: 'path_scoped_merge_equivalence'
  overlapPaths: []
  protectedPaths: ProtectedPathIdentity[]
  result: 'accepted_exact_tree' | 'accepted_unrelated_mainline_delta'
  schemaVersion: typeof PATH_SCOPED_MERGE_EQUIVALENCE_RECEIPT_SCHEMA_VERSION
}

export type PathScopedMergeEquivalenceErrorCode =
  | 'ambiguous_additional_path_attribution'
  | 'invalid_input'
  | 'invalid_topology'
  | 'protected_path_failure'
  | 'protected_path_overlap'
  | 'unapproved_additional_path'

export class PathScopedMergeEquivalenceError extends Error {
  constructor(
    readonly code: PathScopedMergeEquivalenceErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'PathScopedMergeEquivalenceError'
  }
}

export interface MergeEquivalenceGitReader {
  changedPaths(from: string, to: string): Promise<string[]>
  commitIdentity(sha: string): Promise<CommitIdentity>
  isAncestor(ancestor: string, descendant: string): Promise<boolean>
  resolveCommit(sha: string): Promise<string>
  treeEntry(commit: string, path: string): Promise<TreeIdentity | null>
}

interface GitExecutionError extends Error {
  code?: number | string
  stderr?: string
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function sorted(values: Iterable<string>): string[] {
  return [...values].sort(compareText)
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => compareText(left, right))
        .map(([key, child]) => [key, canonicalValue(child)]),
    )
  }
  return value
}

export function canonicalMergeEquivalenceJson(value: unknown): string {
  return `${JSON.stringify(canonicalValue(value), null, 2)}\n`
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

export function pathInventorySha256(paths: readonly string[]): string {
  return sha256(paths.length === 0 ? '' : `${paths.join('\n')}\n`)
}

function inputError(message: string): never {
  throw new PathScopedMergeEquivalenceError('invalid_input', message)
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return inputError(`${label} must be an object.`)
  }
  return value as Record<string, unknown>
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    return inputError(`${label} must be a non-empty string.`)
  }
  return value
}

function fullSha(value: unknown, label: string): string {
  const normalized = stringValue(value, label).toLowerCase()
  if (!FULL_SHA_PATTERN.test(normalized)) {
    return inputError(`${label} must be a full 40-character Git commit SHA.`)
  }
  return normalized
}

function protectedPath(value: unknown, label: string): string {
  const path = stringValue(value, label)
  if (
    path.startsWith('/') ||
    path.endsWith('/') ||
    path.startsWith(':') ||
    path.includes('\\') ||
    CONTROL_CHARACTER_PATTERN.test(path) ||
    posix.normalize(path) !== path ||
    path.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    return inputError(`${label} is not a normalized repository-relative Git path: ${path}`)
  }
  return path
}

export function parsePathScopedMergeEquivalenceInput(
  value: unknown,
): PathScopedMergeEquivalenceInput {
  const input = objectValue(value, 'Merge-equivalence input')
  if (input.schemaVersion !== PATH_SCOPED_MERGE_EQUIVALENCE_INPUT_SCHEMA_VERSION) {
    return inputError(
      `schemaVersion must equal ${PATH_SCOPED_MERGE_EQUIVALENCE_INPUT_SCHEMA_VERSION}.`,
    )
  }

  if (!Array.isArray(input.protectedPaths) || input.protectedPaths.length === 0) {
    return inputError('protectedPaths must be a non-empty array.')
  }
  const protectedPaths = input.protectedPaths.map((path, index) =>
    protectedPath(path, `protectedPaths[${index}]`),
  )
  if (new Set(protectedPaths).size !== protectedPaths.length) {
    return inputError('protectedPaths must not contain duplicates.')
  }

  if (!Array.isArray(input.acceptedUnrelatedMerges)) {
    return inputError('acceptedUnrelatedMerges must be an array.')
  }
  const acceptedUnrelatedMerges = input.acceptedUnrelatedMerges.map((raw, index) => {
    const merge = objectValue(raw, `acceptedUnrelatedMerges[${index}]`)
    return {
      identity: stringValue(merge.identity, `acceptedUnrelatedMerges[${index}].identity`).trim(),
      mergeCommit: fullSha(merge.mergeCommit, `acceptedUnrelatedMerges[${index}].mergeCommit`),
    }
  })
  if (
    new Set(acceptedUnrelatedMerges.map(({ identity }) => identity)).size !==
    acceptedUnrelatedMerges.length
  ) {
    return inputError('Accepted unrelated merge identities must be unique.')
  }
  if (
    new Set(acceptedUnrelatedMerges.map(({ mergeCommit }) => mergeCommit)).size !==
    acceptedUnrelatedMerges.length
  ) {
    return inputError('Accepted unrelated merge commit SHAs must be unique.')
  }

  return {
    schemaVersion: PATH_SCOPED_MERGE_EQUIVALENCE_INPUT_SCHEMA_VERSION,
    featureHead: fullSha(input.featureHead, 'featureHead'),
    mergeCommit: fullSha(input.mergeCommit, 'mergeCommit'),
    mergedMain: fullSha(input.mergedMain, 'mergedMain'),
    protectedPaths: sorted(protectedPaths),
    acceptedUnrelatedMerges: [...acceptedUnrelatedMerges].sort((left, right) =>
      compareText(
        `${left.identity}\u0000${left.mergeCommit}`,
        `${right.identity}\u0000${right.mergeCommit}`,
      ),
    ),
  }
}

function validateDiscoveredPath(path: string): string {
  return protectedPath(path, 'Git-discovered path')
}

function sameTreeIdentity(left: TreeIdentity | null, right: TreeIdentity | null): boolean {
  if (left === null || right === null) return left === right
  return left.mode === right.mode && left.type === right.type && left.objectId === right.objectId
}

export class LocalGitReader implements MergeEquivalenceGitReader {
  private readonly treeEntryCache = new Map<string, Promise<TreeIdentity | null>>()

  constructor(private readonly repositoryRoot: string) {}

  private async git(arguments_: string[]): Promise<string> {
    const { stdout } = await execFileAsync('git', arguments_, {
      cwd: this.repositoryRoot,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    })
    return stdout
  }

  async resolveCommit(sha: string): Promise<string> {
    if (!FULL_SHA_PATTERN.test(sha)) {
      throw new PathScopedMergeEquivalenceError(
        'invalid_input',
        `Git identity must be a full 40-character SHA: ${sha}`,
      )
    }
    let resolved: string
    try {
      resolved = (await this.git(['rev-parse', '--verify', `${sha}^{commit}`])).trim().toLowerCase()
    } catch {
      throw new PathScopedMergeEquivalenceError(
        'invalid_topology',
        `Git commit does not exist in the repository: ${sha}`,
      )
    }
    if (resolved !== sha) {
      throw new PathScopedMergeEquivalenceError(
        'invalid_topology',
        `Git commit identity did not resolve exactly: expected ${sha}; received ${resolved}.`,
      )
    }
    return resolved
  }

  async commitIdentity(sha: string): Promise<CommitIdentity> {
    const [parentsText, tree] = await Promise.all([
      this.git(['show', '--no-patch', '--format=%P', sha]),
      this.git(['rev-parse', '--verify', `${sha}^{tree}`]),
    ])
    const parents = parentsText.trim() === '' ? [] : parentsText.trim().split(/\s+/u)
    if (parents.some((parent) => !FULL_SHA_PATTERN.test(parent))) {
      throw new PathScopedMergeEquivalenceError(
        'invalid_topology',
        `Git returned invalid parent identities for ${sha}.`,
      )
    }
    const treeSha = tree.trim()
    if (!FULL_SHA_PATTERN.test(treeSha)) {
      throw new PathScopedMergeEquivalenceError(
        'invalid_topology',
        `Git returned an invalid tree identity for ${sha}.`,
      )
    }
    return { sha, tree: treeSha, parents }
  }

  async isAncestor(ancestor: string, descendant: string): Promise<boolean> {
    try {
      await this.git(['merge-base', '--is-ancestor', ancestor, descendant])
      return true
    } catch (error: unknown) {
      const gitError = error as GitExecutionError
      if (gitError.code === 1) return false
      throw new PathScopedMergeEquivalenceError(
        'invalid_topology',
        `Unable to verify Git ancestry for ${ancestor} and ${descendant}: ${gitError.stderr?.trim() || gitError.message}`,
      )
    }
  }

  async changedPaths(from: string, to: string): Promise<string[]> {
    const output = await this.git([
      '--literal-pathspecs',
      'diff',
      '--name-only',
      '--no-renames',
      '-z',
      from,
      to,
      '--',
    ])
    const paths = output
      .split('\u0000')
      .filter((path) => path !== '')
      .map(validateDiscoveredPath)
    return sorted(new Set(paths))
  }

  treeEntry(commit: string, path: string): Promise<TreeIdentity | null> {
    const cacheKey = `${commit}\u0000${path}`
    const cached = this.treeEntryCache.get(cacheKey)
    if (cached) return cached
    const pending = this.readTreeEntry(commit, path)
    this.treeEntryCache.set(cacheKey, pending)
    return pending
  }

  private async readTreeEntry(commit: string, path: string): Promise<TreeIdentity | null> {
    const output = await this.git(['--literal-pathspecs', 'ls-tree', '-z', commit, '--', path])
    if (output === '') return null
    const records = output.split('\u0000').filter((record) => record !== '')
    if (records.length !== 1) {
      throw new PathScopedMergeEquivalenceError(
        'invalid_topology',
        `Expected one tree entry for ${path} at ${commit}; received ${records.length}.`,
      )
    }
    const match = /^([0-7]{6}) ([a-z]+) ([0-9a-f]{40})\t(.+)$/u.exec(records[0])
    if (!match || match[4] !== path) {
      throw new PathScopedMergeEquivalenceError(
        'invalid_topology',
        `Unable to parse the exact tree identity for ${path} at ${commit}.`,
      )
    }
    return { mode: match[1], type: match[2], objectId: match[3] }
  }
}

interface AcceptedMergeRuntime extends AcceptedUnrelatedMergeProof {
  changedPathSet: Set<string>
}

function topologyError(message: string): never {
  throw new PathScopedMergeEquivalenceError('invalid_topology', message)
}

async function acceptedMergeProofs(
  input: PathScopedMergeEquivalenceInput,
  git: MergeEquivalenceGitReader,
): Promise<AcceptedMergeRuntime[]> {
  return Promise.all(
    input.acceptedUnrelatedMerges.map(async ({ identity, mergeCommit }) => {
      if (mergeCommit === input.mergeCommit) {
        return topologyError(
          `Accepted unrelated merge ${identity} cannot be the actual merge commit under verification.`,
        )
      }
      const commit = await git.commitIdentity(mergeCommit)
      if (commit.parents.length < 2) {
        return topologyError(
          `Accepted unrelated merge ${identity} (${mergeCommit}) is not a merge commit.`,
        )
      }
      if (!(await git.isAncestor(mergeCommit, input.mergedMain))) {
        return topologyError(
          `Accepted unrelated merge ${identity} (${mergeCommit}) is not an ancestor of merged main ${input.mergedMain}.`,
        )
      }
      if (await git.isAncestor(mergeCommit, input.featureHead)) {
        return topologyError(
          `Accepted unrelated merge ${identity} (${mergeCommit}) is already in validated feature-head ancestry and cannot authorize a merged-main-only delta.`,
        )
      }
      const changedPaths = await git.changedPaths(commit.parents[0], mergeCommit)
      return {
        identity,
        mergeCommit: commit,
        firstParent: commit.parents[0],
        changedPaths,
        changedPathCount: changedPaths.length,
        changedPathInventorySha256: pathInventorySha256(changedPaths),
        changedPathSet: new Set(changedPaths),
      }
    }),
  )
}

export async function verifyPathScopedMergeEquivalence(
  rawInput: PathScopedMergeEquivalenceInput | unknown,
  options: { git?: MergeEquivalenceGitReader; repositoryRoot?: string } = {},
): Promise<PathScopedMergeEquivalenceReceipt> {
  const input = parsePathScopedMergeEquivalenceInput(rawInput)
  const git = options.git ?? new LocalGitReader(resolve(options.repositoryRoot ?? process.cwd()))

  await Promise.all([
    git.resolveCommit(input.featureHead),
    git.resolveCommit(input.mergeCommit),
    git.resolveCommit(input.mergedMain),
    ...input.acceptedUnrelatedMerges.map(({ mergeCommit }) => git.resolveCommit(mergeCommit)),
  ])

  const [featureHead, mergeCommit, mergedMain] = await Promise.all([
    git.commitIdentity(input.featureHead),
    git.commitIdentity(input.mergeCommit),
    git.commitIdentity(input.mergedMain),
  ])
  if (mergeCommit.parents.length < 2) {
    return topologyError(`Actual merge commit ${input.mergeCommit} is not a merge commit.`)
  }
  if (!(await git.isAncestor(input.featureHead, input.mergeCommit))) {
    return topologyError(
      `Validated feature head ${input.featureHead} is not an ancestor of actual merge commit ${input.mergeCommit}.`,
    )
  }
  if (!(await git.isAncestor(input.mergeCommit, input.mergedMain))) {
    return topologyError(
      `Actual merge commit ${input.mergeCommit} is not an ancestor of merged main ${input.mergedMain}.`,
    )
  }

  const accepted = await acceptedMergeProofs(input, git)
  const protectedSet = new Set(input.protectedPaths)
  const overlapPaths = sorted(
    new Set(
      accepted.flatMap(({ changedPaths }) => changedPaths.filter((path) => protectedSet.has(path))),
    ),
  )
  if (overlapPaths.length > 0) {
    throw new PathScopedMergeEquivalenceError(
      'protected_path_overlap',
      `Accepted unrelated merge changes overlap protected paths: ${overlapPaths.join(', ')}`,
    )
  }

  const protectedFailures: string[] = []
  const protectedPathIdentities = await Promise.all(
    input.protectedPaths.map(async (path): Promise<ProtectedPathIdentity | null> => {
      const [featureEntry, mainEntry] = await Promise.all([
        git.treeEntry(input.featureHead, path),
        git.treeEntry(input.mergedMain, path),
      ])
      if (!featureEntry) {
        protectedFailures.push(`${path}: missing from validated feature head`)
        return null
      }
      if (!mainEntry) {
        protectedFailures.push(`${path}: missing from merged main`)
        return null
      }
      if (featureEntry.type !== 'blob' || mainEntry.type !== 'blob') {
        protectedFailures.push(
          `${path}: expected blob entries; received ${featureEntry.type}/${mainEntry.type}`,
        )
        return null
      }
      if (!sameTreeIdentity(featureEntry, mainEntry)) {
        const changedFields = (
          [
            ['mode', featureEntry.mode, mainEntry.mode],
            ['type', featureEntry.type, mainEntry.type],
            ['blob', featureEntry.objectId, mainEntry.objectId],
          ] as const
        )
          .filter(([, featureValue, mainValue]) => featureValue !== mainValue)
          .map(([field]) => field)
        protectedFailures.push(`${path}: ${changedFields.join('/')} identity differs`)
        return null
      }
      return { path, featureHead: featureEntry, mergedMain: mainEntry, result: 'identical' }
    }),
  )
  if (protectedFailures.length > 0) {
    throw new PathScopedMergeEquivalenceError(
      'protected_path_failure',
      `Protected path verification failed: ${sorted(protectedFailures).join('; ')}`,
    )
  }

  const allTreeDifferences = await git.changedPaths(input.featureHead, input.mergedMain)
  const additionalPaths = allTreeDifferences.filter((path) => !protectedSet.has(path))
  const additionalAttributions: AdditionalPathAttribution[] = []
  const unapprovedPaths: string[] = []
  const ambiguousPaths: string[] = []

  for (const path of additionalPaths) {
    const [featureEntry, mainEntry] = await Promise.all([
      git.treeEntry(input.featureHead, path),
      git.treeEntry(input.mergedMain, path),
    ])
    const candidates: Array<{
      identity: string
      mergeCommit: string
      treeEntry: TreeIdentity | null
    }> = []
    for (const acceptedMerge of accepted) {
      if (!acceptedMerge.changedPathSet.has(path)) continue
      const acceptedEntry = await git.treeEntry(acceptedMerge.mergeCommit.sha, path)
      if (sameTreeIdentity(acceptedEntry, mainEntry)) {
        candidates.push({
          identity: acceptedMerge.identity,
          mergeCommit: acceptedMerge.mergeCommit.sha,
          treeEntry: acceptedEntry,
        })
      }
    }
    if (candidates.length === 0) {
      unapprovedPaths.push(path)
      continue
    }
    if (candidates.length > 1) {
      ambiguousPaths.push(
        `${path} (${candidates
          .map(({ identity }) => identity)
          .sort(compareText)
          .join(', ')})`,
      )
      continue
    }
    additionalAttributions.push({
      path,
      featureHead: featureEntry,
      mergedMain: mainEntry,
      acceptedMerge: candidates[0],
      result: 'attributed_to_accepted_unrelated_merge',
    })
  }
  if (unapprovedPaths.length > 0) {
    throw new PathScopedMergeEquivalenceError(
      'unapproved_additional_path',
      `Merged main contains additional paths not attributable to an accepted unrelated merge: ${unapprovedPaths.join(', ')}`,
    )
  }
  if (ambiguousPaths.length > 0) {
    throw new PathScopedMergeEquivalenceError(
      'ambiguous_additional_path_attribution',
      `Additional paths have ambiguous accepted-merge attribution: ${ambiguousPaths.join('; ')}`,
    )
  }

  const featureHeadDirectParentIndex = mergeCommit.parents.indexOf(input.featureHead)
  return {
    schemaVersion: PATH_SCOPED_MERGE_EQUIVALENCE_RECEIPT_SCHEMA_VERSION,
    kind: 'path_scoped_merge_equivalence',
    result:
      additionalPaths.length === 0 ? 'accepted_exact_tree' : 'accepted_unrelated_mainline_delta',
    commits: { featureHead, mergeCommit, mergedMain },
    ancestry: {
      featureHeadIsAncestorOfMergeCommit: true,
      featureHeadIsDirectParentOfMergeCommit: featureHeadDirectParentIndex >= 0,
      featureHeadDirectParentIndex:
        featureHeadDirectParentIndex >= 0 ? featureHeadDirectParentIndex + 1 : null,
      mergeCommitIsAncestorOfMergedMain: true,
    },
    counts: {
      protectedPathCount: input.protectedPaths.length,
      identicalProtectedPathCount: input.protectedPaths.length,
      acceptedUnrelatedMergeCount: accepted.length,
      additionalMergedMainPathCount: additionalPaths.length,
      overlapPathCount: 0,
    },
    inventories: {
      protectedPathSha256: pathInventorySha256(input.protectedPaths),
      additionalMergedMainPathSha256: pathInventorySha256(additionalPaths),
    },
    protectedPaths: protectedPathIdentities.filter(
      (entry): entry is ProtectedPathIdentity => entry !== null,
    ),
    acceptedUnrelatedMerges: accepted.map((proof) => ({
      identity: proof.identity,
      mergeCommit: proof.mergeCommit,
      firstParent: proof.firstParent,
      changedPaths: proof.changedPaths,
      changedPathCount: proof.changedPathCount,
      changedPathInventorySha256: proof.changedPathInventorySha256,
    })),
    additionalMergedMainPaths: additionalAttributions,
    overlapPaths: [],
    databaseAccessed: false,
  }
}

function markdownCell(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('|', '\\|')
}

function treeIdentityText(entry: TreeIdentity | null): string {
  return entry ? `${entry.mode} ${entry.type} ${entry.objectId}` : '(missing)'
}

export function serializePathScopedMergeEquivalenceMarkdown(
  receipt: PathScopedMergeEquivalenceReceipt,
  canonicalJsonSha256 = sha256(canonicalMergeEquivalenceJson(receipt)),
): string {
  const protectedRows = receipt.protectedPaths
    .map(
      ({ path, mergedMain }) =>
        `| ${markdownCell(path)} | ${mergedMain.mode} | ${mergedMain.type} | \`${mergedMain.objectId}\` | identical |`,
    )
    .join('\n')
  const acceptedSections = receipt.acceptedUnrelatedMerges
    .map(
      (merge) =>
        `### ${markdownCell(merge.identity)}\n\n- Merge commit: \`${merge.mergeCommit.sha}\`\n- First parent: \`${merge.firstParent}\`\n- Changed paths: ${merge.changedPathCount}\n- Path inventory SHA-256: \`${merge.changedPathInventorySha256}\`\n\n${merge.changedPaths.map((path) => `- \`${path}\``).join('\n')}`,
    )
    .join('\n\n')
  const additionalRows = receipt.additionalMergedMainPaths
    .map(
      ({ path, featureHead, mergedMain, acceptedMerge }) =>
        `| ${markdownCell(path)} | ${markdownCell(acceptedMerge.identity)} | \`${acceptedMerge.mergeCommit}\` | \`${treeIdentityText(featureHead)}\` | \`${treeIdentityText(mergedMain)}\` |`,
    )
    .join('\n')

  return `# Path-scoped merge-equivalence receipt

- Result: **${receipt.result}**
- Canonical JSON SHA-256: \`${canonicalJsonSha256}\`
- Protected paths: ${receipt.counts.identicalProtectedPathCount}/${receipt.counts.protectedPathCount} identical
- Additional merged-main paths: ${receipt.counts.additionalMergedMainPathCount}
- Protected-path overlap: ${receipt.counts.overlapPathCount}
- Database accessed: no

## Commit identities

- Validated feature head: \`${receipt.commits.featureHead.sha}\`
- Actual merge commit: \`${receipt.commits.mergeCommit.sha}\`
- Merged main: \`${receipt.commits.mergedMain.sha}\`
- Feature head is an ancestor of the merge commit: yes
- Feature head is a direct parent: ${receipt.ancestry.featureHeadIsDirectParentOfMergeCommit ? `yes (parent ${receipt.ancestry.featureHeadDirectParentIndex})` : 'no'}
- Merge commit is an ancestor of merged main: yes

## Protected paths

| Path | Mode | Type | Blob ID | Result |
| --- | --- | --- | --- | --- |
${protectedRows}

## Accepted unrelated merges

${acceptedSections || '_None._'}

## Additional merged-main paths and exact attribution

| Path | Accepted identity | Merge commit | Feature-head tree entry | Merged-main tree entry |
| --- | --- | --- | --- | --- |
${additionalRows || '| _None_ | — | — | — | — |'}

## Conclusion

All protected paths have identical mode, type, and blob identities. Every additional merged-main path is attributed to exactly one explicitly accepted, nonoverlapping merge. This receipt was produced without database access.
`
}

export interface PublishedMergeEquivalenceReceipt {
  json: { filename: typeof MERGE_EQUIVALENCE_JSON_FILENAME; sha256: string }
  manifest: { filename: typeof MERGE_EQUIVALENCE_MANIFEST_FILENAME; sha256: string }
  markdown: { filename: typeof MERGE_EQUIVALENCE_MARKDOWN_FILENAME; sha256: string }
  outputDirectory: string
}

async function exclusiveWrite(path: string, value: string): Promise<void> {
  const handle = await open(path, 'wx', 0o600)
  try {
    await handle.writeFile(value, 'utf8')
  } finally {
    await handle.close()
  }
}

export async function publishPathScopedMergeEquivalenceReceipt(
  receipt: PathScopedMergeEquivalenceReceipt,
  outputDirectory: string,
): Promise<PublishedMergeEquivalenceReceipt> {
  const target = resolve(outputDirectory)
  const json = canonicalMergeEquivalenceJson(receipt)
  const jsonSha256 = sha256(json)
  const markdown = serializePathScopedMergeEquivalenceMarkdown(receipt, jsonSha256)
  const markdownSha256 = sha256(markdown)
  const manifest =
    [
      `${jsonSha256}  ${MERGE_EQUIVALENCE_JSON_FILENAME}`,
      `${markdownSha256}  ${MERGE_EQUIVALENCE_MARKDOWN_FILENAME}`,
    ].join('\n') + '\n'

  await mkdir(dirname(target), { recursive: true })
  await mkdir(target, { mode: 0o700 })
  await exclusiveWrite(resolve(target, MERGE_EQUIVALENCE_JSON_FILENAME), json)
  await exclusiveWrite(resolve(target, MERGE_EQUIVALENCE_MARKDOWN_FILENAME), markdown)
  await exclusiveWrite(resolve(target, MERGE_EQUIVALENCE_MANIFEST_FILENAME), manifest)

  return {
    outputDirectory: target,
    json: { filename: MERGE_EQUIVALENCE_JSON_FILENAME, sha256: jsonSha256 },
    markdown: { filename: MERGE_EQUIVALENCE_MARKDOWN_FILENAME, sha256: markdownSha256 },
    manifest: { filename: MERGE_EQUIVALENCE_MANIFEST_FILENAME, sha256: sha256(manifest) },
  }
}
