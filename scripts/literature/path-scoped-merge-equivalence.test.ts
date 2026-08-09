/** @jest-environment node */

import { link, lstat, mkdir, mkdtemp, readFile, rename, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  HISTORICAL_PR84_PR85_RECEIPT_SHA256,
  LocalGitReader,
  MAINLINE_COMPATIBILITY_JSON_FILENAME,
  MAINLINE_COMPATIBILITY_MANIFEST_FILENAME,
  MAINLINE_COMPATIBILITY_MARKDOWN_FILENAME,
  MERGE_EQUIVALENCE_JSON_FILENAME,
  MERGE_EQUIVALENCE_MANIFEST_FILENAME,
  MERGE_EQUIVALENCE_MARKDOWN_FILENAME,
  PR_86_MERGE_COMMIT,
  canonicalMergeEquivalenceJson,
  parseSubsequentMainlineCompatibilityInput,
  parsePathScopedMergeEquivalenceInput,
  pathInventorySha256,
  publishPathScopedMergeEquivalenceReceipt,
  publishSubsequentMainlineCompatibilityReceipt,
  sha256,
  verifyPathScopedMergeEquivalence,
  verifySubsequentMainlineCompatibility,
  type CommitIdentity,
  type MergeEquivalenceGitReader,
  type PathScopedMergeEquivalenceError,
  type SubsequentMainlineCompatibilityInput,
  type TreeIdentity,
} from './path-scoped-merge-equivalence'
import { runPathScopedMergeEquivalenceCli } from './verify-gold-import-compensation-merge'

jest.setTimeout(30_000)

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/pr-84-pr-85-path-scoped-merge-equivalence.json',
)
const SUBSEQUENT_FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/pr-86-subsequent-mainline-compatibility.json',
)
const HISTORICAL_MAIN = '858018c247c5fef177bd57b7bef686db2918333e'
const CANDIDATE_HEAD = '772625364abb6f0119cf7a2bb4888ab4da806396'
const PR_85_PATHS = [
  'docs/auth-password-recovery.md',
  'src/app/auth/callback/route.test.ts',
  'src/app/auth/callback/route.ts',
  'src/components/auth/ForgotPasswordForm.test.tsx',
] as const

interface RegressionExpectation {
  additionalPathCount: number
  additionalPathInventorySha256: string
  additionalPaths: string[]
  overlapPathCount: number
  protectedPathCount: number
  protectedPathInventorySha256: string
  result: 'accepted_unrelated_mainline_delta'
}

async function regressionFixture() {
  const raw = JSON.parse(await readFile(FIXTURE_PATH, 'utf8')) as Record<string, unknown>
  return {
    input: parsePathScopedMergeEquivalenceInput(raw),
    expected: raw.expected as RegressionExpectation,
  }
}

async function subsequentFixture(): Promise<SubsequentMainlineCompatibilityInput> {
  return parseSubsequentMainlineCompatibilityInput(
    JSON.parse(await readFile(SUBSEQUENT_FIXTURE_PATH, 'utf8')) as unknown,
  )
}

function gitValueKey(commit: string, path: string): string {
  return `${commit}\u0000${path}`
}

class OverridingGitReader implements MergeEquivalenceGitReader {
  constructor(
    private readonly delegate: MergeEquivalenceGitReader,
    private readonly blobOverrides = new Map<string, string>(),
    private readonly treeOverrides = new Map<string, TreeIdentity | null>(),
  ) {}

  blobText(commit: string, path: string): Promise<string> {
    const override = this.blobOverrides.get(gitValueKey(commit, path))
    return override === undefined ? this.delegate.blobText(commit, path) : Promise.resolve(override)
  }

  changedPaths(from: string, to: string): Promise<string[]> {
    return this.delegate.changedPaths(from, to)
  }

  commitIdentity(sha: string): Promise<CommitIdentity> {
    return this.delegate.commitIdentity(sha)
  }

  isAncestor(ancestor: string, descendant: string): Promise<boolean> {
    return this.delegate.isAncestor(ancestor, descendant)
  }

  resolveCommit(sha: string): Promise<string> {
    return this.delegate.resolveCommit(sha)
  }

  treeEntry(commit: string, path: string): Promise<TreeIdentity | null> {
    const key = gitValueKey(commit, path)
    return this.treeOverrides.has(key)
      ? Promise.resolve(this.treeOverrides.get(key) ?? null)
      : this.delegate.treeEntry(commit, path)
  }
}

async function packageJsonObjects() {
  const git = new LocalGitReader(REPOSITORY_ROOT)
  const [historical, current, candidate] = await Promise.all([
    git.blobText(HISTORICAL_MAIN, 'package.json'),
    git.blobText(PR_86_MERGE_COMMIT, 'package.json'),
    git.blobText(CANDIDATE_HEAD, 'package.json'),
  ])
  return {
    git,
    historical: JSON.parse(historical) as Record<string, unknown>,
    current: JSON.parse(current) as Record<string, unknown>,
    candidate: JSON.parse(candidate) as Record<string, unknown>,
  }
}

function serializedPackage(value: Record<string, unknown>, indentation = 2): string {
  return `${JSON.stringify(value, null, indentation)}\n`
}

describe('path-scoped merge equivalence', () => {
  it('accepts the actual PR #84/PR #85 34/4/0 topology with exact PR #85 attribution', async () => {
    const { input, expected } = await regressionFixture()
    const receipt = await verifyPathScopedMergeEquivalence(input, {
      repositoryRoot: REPOSITORY_ROOT,
    })
    expect(sha256(canonicalMergeEquivalenceJson(receipt))).toBe(HISTORICAL_PR84_PR85_RECEIPT_SHA256)

    expect(receipt.result).toBe(expected.result)
    expect(receipt.commits.featureHead.sha).toBe('21fc97ce66b724040d261f7404bec5658b8caaa2')
    expect(receipt.commits.mergeCommit.sha).toBe('858018c247c5fef177bd57b7bef686db2918333e')
    expect(receipt.ancestry).toEqual({
      featureHeadIsAncestorOfMergeCommit: true,
      featureHeadIsDirectParentOfMergeCommit: true,
      featureHeadDirectParentIndex: 2,
      mergeCommitIsAncestorOfMergedMain: true,
    })
    expect(receipt.counts.protectedPathCount).toBe(expected.protectedPathCount)
    expect(receipt.counts.identicalProtectedPathCount).toBe(expected.protectedPathCount)
    expect(receipt.counts.additionalMergedMainPathCount).toBe(expected.additionalPathCount)
    expect(receipt.counts.overlapPathCount).toBe(expected.overlapPathCount)
    expect(receipt.inventories.additionalMergedMainPathSha256).toBe(
      expected.additionalPathInventorySha256,
    )
    expect(receipt.inventories.protectedPathSha256).toBe(expected.protectedPathInventorySha256)
    expect(receipt.protectedPaths).toHaveLength(34)
    expect(
      receipt.protectedPaths.every(
        ({ featureHead, mergedMain }) =>
          featureHead.mode === mergedMain.mode &&
          featureHead.type === 'blob' &&
          mergedMain.type === 'blob' &&
          featureHead.objectId === mergedMain.objectId,
      ),
    ).toBe(true)
    expect(receipt.acceptedUnrelatedMerges).toHaveLength(1)
    expect(receipt.acceptedUnrelatedMerges[0]).toMatchObject({
      identity: 'PR #85',
      firstParent: '561460a19e4e57b822b9995fc84a05bd910b5562',
      changedPathCount: 4,
      changedPathInventorySha256: expected.additionalPathInventorySha256,
      changedPaths: PR_85_PATHS,
      mergeCommit: { sha: '7f8bc8c8d00f238c0fa42aadcf7768aba27b688f' },
    })
    expect(receipt.additionalMergedMainPaths.map(({ path }) => path)).toEqual(
      expected.additionalPaths,
    )
    expect(
      receipt.additionalMergedMainPaths.every(
        ({ acceptedMerge, result, mergedMain }) =>
          acceptedMerge.identity === 'PR #85' &&
          acceptedMerge.mergeCommit === '7f8bc8c8d00f238c0fa42aadcf7768aba27b688f' &&
          result === 'attributed_to_accepted_unrelated_merge' &&
          acceptedMerge.treeEntry?.objectId === mergedMain?.objectId,
      ),
    ).toBe(true)
    expect(receipt.overlapPaths).toEqual([])
    expect(receipt.databaseAccessed).toBe(false)
  })

  it('publishes byte-deterministic canonical JSON and Markdown receipts with a valid manifest', async () => {
    const { input } = await regressionFixture()
    const receipt = await verifyPathScopedMergeEquivalence(input, {
      repositoryRoot: REPOSITORY_ROOT,
    })
    const root = await mkdtemp(join(tmpdir(), 'merge-equivalence-'))
    const first = await publishPathScopedMergeEquivalenceReceipt(receipt, join(root, 'first'), root)
    const second = await publishPathScopedMergeEquivalenceReceipt(
      receipt,
      join(root, 'second'),
      root,
    )

    const filenames = [
      MERGE_EQUIVALENCE_JSON_FILENAME,
      MERGE_EQUIVALENCE_MARKDOWN_FILENAME,
      MERGE_EQUIVALENCE_MANIFEST_FILENAME,
    ]
    for (const filename of filenames) {
      await expect(readFile(join(first.outputDirectory, filename))).resolves.toEqual(
        await readFile(join(second.outputDirectory, filename)),
      )
    }

    const json = await readFile(
      join(first.outputDirectory, MERGE_EQUIVALENCE_JSON_FILENAME),
      'utf8',
    )
    const markdown = await readFile(
      join(first.outputDirectory, MERGE_EQUIVALENCE_MARKDOWN_FILENAME),
      'utf8',
    )
    const manifest = await readFile(
      join(first.outputDirectory, MERGE_EQUIVALENCE_MANIFEST_FILENAME),
      'utf8',
    )
    expect(json).toBe(canonicalMergeEquivalenceJson(receipt))
    expect(sha256(json)).toBe(HISTORICAL_PR84_PR85_RECEIPT_SHA256)
    expect(json).not.toMatch(/createdAt|generatedAt|outputDirectory/u)
    expect(sha256(markdown)).toBe(
      'b8052c49e6aa6cda7b54561e73cbbfba61f274109ff7d374e0108bd9b102c78e',
    )
    expect(markdown).toContain(`Canonical JSON SHA-256: \`${sha256(json)}\``)
    expect(manifest).toBe(
      `${sha256(json)}  ${MERGE_EQUIVALENCE_JSON_FILENAME}\n` +
        `${sha256(markdown)}  ${MERGE_EQUIVALENCE_MARKDOWN_FILENAME}\n`,
    )
    expect(pathInventorySha256(PR_85_PATHS)).toBe(
      'b153f26b576306a6b02eb81233193a4fe3a622c9737dba592f33eccaac3ff488',
    )
  })

  it('rejects an accepted unrelated merge that overlaps a protected path', async () => {
    const { input } = await regressionFixture()
    const promise = verifyPathScopedMergeEquivalence(
      { ...input, protectedPaths: [...input.protectedPaths, PR_85_PATHS[0]] },
      { repositoryRoot: REPOSITORY_ROOT },
    )

    await expect(promise).rejects.toMatchObject({
      code: 'protected_path_overlap',
    } satisfies Partial<PathScopedMergeEquivalenceError>)
    await expect(promise).rejects.toThrow(PR_85_PATHS[0])
  })

  it('rejects every extra merged-main path when its merge identity is not explicitly accepted', async () => {
    const { input } = await regressionFixture()
    const promise = verifyPathScopedMergeEquivalence(
      { ...input, acceptedUnrelatedMerges: [] },
      { repositoryRoot: REPOSITORY_ROOT },
    )

    await expect(promise).rejects.toMatchObject({
      code: 'unapproved_additional_path',
    } satisfies Partial<PathScopedMergeEquivalenceError>)
    await expect(promise).rejects.toThrow(PR_85_PATHS.join(', '))
  })

  it('rejects an accepted merge already contained in validated feature-head ancestry', async () => {
    const { input } = await regressionFixture()
    const promise = verifyPathScopedMergeEquivalence(
      {
        ...input,
        acceptedUnrelatedMerges: [
          {
            identity: 'feature-ancestor merge',
            mergeCommit: '561460a19e4e57b822b9995fc84a05bd910b5562',
          },
        ],
      },
      { repositoryRoot: REPOSITORY_ROOT },
    )

    await expect(promise).rejects.toMatchObject({
      code: 'invalid_topology',
    } satisfies Partial<PathScopedMergeEquivalenceError>)
    await expect(promise).rejects.toThrow(/already in validated feature-head ancestry/u)
  })
})

describe('subsequent-mainline compatibility', () => {
  it('selects subsequent mode from the strict config and requires an explicit output root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mainline-cli-'))
    await expect(
      runPathScopedMergeEquivalenceCli(
        ['--config', SUBSEQUENT_FIXTURE_PATH, '--output', join(root, 'missing-root')],
        REPOSITORY_ROOT,
        jest.fn(),
      ),
    ).rejects.toThrow(/--output-root is required/u)

    const result = await runPathScopedMergeEquivalenceCli(
      [
        '--config',
        SUBSEQUENT_FIXTURE_PATH,
        '--output-root',
        root,
        '--output',
        join(root, 'receipt'),
      ],
      REPOSITORY_ROOT,
      jest.fn(),
    )
    expect(result).toMatchObject({ result: 'accepted_structured_unrelated_mainline_delta' })
    const receipt = JSON.parse(
      await readFile(join(root, 'receipt', MAINLINE_COMPATIBILITY_JSON_FILENAME), 'utf8'),
    ) as { commits: { candidateHead: { sha: string } } }
    expect(receipt.commits.candidateHead.sha).toBe(CANDIDATE_HEAD)
  })

  it('accepts exactly the PR #86 package addition and preserves the PR #87 candidate scripts', async () => {
    const input = await subsequentFixture()
    const receipt = await verifySubsequentMainlineCompatibility(input, {
      repositoryRoot: REPOSITORY_ROOT,
    })

    expect(receipt.result).toBe('accepted_structured_unrelated_mainline_delta')
    expect(receipt.historicalMergeReceipt.canonicalJsonSha256).toBe(
      HISTORICAL_PR84_PR85_RECEIPT_SHA256,
    )
    expect(receipt.commits.historicalMergedMain.sha).toBe(HISTORICAL_MAIN)
    expect(receipt.commits.currentMain.sha).toBe(PR_86_MERGE_COMMIT)
    expect(receipt.commits.candidateHead.sha).toBe(CANDIDATE_HEAD)
    expect(receipt.inputIdentitySha256).toBe(sha256(canonicalMergeEquivalenceJson(input)))
    expect(receipt.counts).toMatchObject({
      protectedPathCount: 34,
      byteIdenticalProtectedPathCount: 33,
      structuredProtectedPathCount: 1,
      acceptedLaterMergeCount: 1,
      currentMainAdditionalPathCount: 11,
    })
    expect(receipt.overlapPaths).toEqual(['package.json'])
    expect(receipt.acceptedLaterMerges[0]).toMatchObject({
      identity: 'PR #86',
      firstParent: HISTORICAL_MAIN,
      changedPathCount: 12,
      mergeCommit: { sha: PR_86_MERGE_COMMIT },
    })
    const structured = receipt.protectedPaths.structured[0]
    expect(structured.authorizedAdditions).toEqual([
      {
        pointer: '/scripts/ip-intel:audit',
        value: 'tsx scripts/ip-device-intelligence/audit-data-readiness.ts',
      },
    ])
    expect(structured.acceptedMergeSemanticDiff).toHaveLength(1)
    expect(structured.currentMainSemanticDiff).toHaveLength(1)
    expect(structured.candidateSemanticDiff).toHaveLength(5)
    expect(
      structured.preservedJsonPointers.filter(
        ({ provenance }) => provenance === 'historical_import_compensation_script',
      ),
    ).toHaveLength(6)
    expect(structured.preservedJsonPointers).toHaveLength(12)
    expect(receipt.databaseAccessed).toBe(false)
  })

  it('publishes a separate deterministic current-main receipt and private files', async () => {
    const receipt = await verifySubsequentMainlineCompatibility(await subsequentFixture(), {
      repositoryRoot: REPOSITORY_ROOT,
    })
    const root = await mkdtemp(join(tmpdir(), 'mainline-compatibility-'))
    const first = await publishSubsequentMainlineCompatibilityReceipt(
      receipt,
      join(root, 'first'),
      root,
    )
    const second = await publishSubsequentMainlineCompatibilityReceipt(
      receipt,
      join(root, 'second'),
      root,
    )
    for (const filename of [
      MAINLINE_COMPATIBILITY_JSON_FILENAME,
      MAINLINE_COMPATIBILITY_MARKDOWN_FILENAME,
      MAINLINE_COMPATIBILITY_MANIFEST_FILENAME,
    ]) {
      await expect(readFile(join(first.outputDirectory, filename))).resolves.toEqual(
        await readFile(join(second.outputDirectory, filename)),
      )
      expect((await lstat(join(first.outputDirectory, filename))).mode & 0o777).toBe(0o600)
    }
    expect((await lstat(first.outputDirectory)).mode & 0o777).toBe(0o700)
    const json = await readFile(
      join(first.outputDirectory, MAINLINE_COMPATIBILITY_JSON_FILENAME),
      'utf8',
    )
    expect(json).toBe(canonicalMergeEquivalenceJson(receipt))
    expect(json).not.toMatch(/createdAt|generatedAt|outputDirectory/u)
  })

  it.each([
    {
      name: 'changes the accepted pointer value',
      mutate(scripts: Record<string, unknown>) {
        scripts['ip-intel:audit'] = 'tsx scripts/ip-device-intelligence/unapproved.ts'
      },
    },
    {
      name: 'changes a preexisting compensation script',
      mutate(scripts: Record<string, unknown>) {
        scripts['literature:gold-import-compensation'] = 'tsx unapproved.ts'
      },
    },
    {
      name: 'removes a protected compensation script',
      mutate(scripts: Record<string, unknown>) {
        delete scripts['literature:gold-import-compensation:validate-import']
      },
    },
    {
      name: 'adds an undeclared second key',
      mutate(scripts: Record<string, unknown>) {
        scripts['unapproved:script'] = 'tsx unapproved.ts'
      },
    },
  ])('rejects PR #86 package.json when it $name', async ({ mutate }) => {
    const { current, git } = await packageJsonObjects()
    mutate(current.scripts as Record<string, unknown>)
    const reader = new OverridingGitReader(
      git,
      new Map([[gitValueKey(PR_86_MERGE_COMMIT, 'package.json'), serializedPackage(current)]]),
    )

    await expect(
      verifySubsequentMainlineCompatibility(await subsequentFixture(), { git: reader }),
    ).rejects.toMatchObject({
      code: 'unauthorized_structured_change',
    } satisfies Partial<PathScopedMergeEquivalenceError>)
  })

  it('rejects replacement at the authorized pointer when the PR #86 base already contains it', async () => {
    const { git, historical } = await packageJsonObjects()
    ;(historical.scripts as Record<string, unknown>)['ip-intel:audit'] =
      'tsx scripts/ip-device-intelligence/preexisting.ts'
    const reader = new OverridingGitReader(
      git,
      new Map([[gitValueKey(HISTORICAL_MAIN, 'package.json'), serializedPackage(historical)]]),
    )
    await expect(
      verifySubsequentMainlineCompatibility(await subsequentFixture(), { git: reader }),
    ).rejects.toMatchObject({
      code: 'unauthorized_structured_change',
    } satisfies Partial<PathScopedMergeEquivalenceError>)
  })

  it('rejects a candidate that omits a required PR #87 script', async () => {
    const { candidate, git } = await packageJsonObjects()
    delete (candidate.scripts as Record<string, unknown>)[
      'literature:generate-gold-import-compensation-package'
    ]
    const reader = new OverridingGitReader(
      git,
      new Map([[gitValueKey(CANDIDATE_HEAD, 'package.json'), serializedPackage(candidate)]]),
    )
    await expect(
      verifySubsequentMainlineCompatibility(await subsequentFixture(), { git: reader }),
    ).rejects.toMatchObject({
      code: 'unauthorized_structured_change',
    } satisfies Partial<PathScopedMergeEquivalenceError>)
  })

  it.each([
    ['malformed', '{"scripts":'],
    ['duplicate-key', '{"scripts":{"same":"first","same":"second"}}'],
  ])('rejects %s package.json bytes', async (_name, bytes) => {
    const { git } = await packageJsonObjects()
    const reader = new OverridingGitReader(
      git,
      new Map([[gitValueKey(PR_86_MERGE_COMMIT, 'package.json'), bytes]]),
    )
    await expect(
      verifySubsequentMainlineCompatibility(await subsequentFixture(), { git: reader }),
    ).rejects.toMatchObject({
      code: 'structured_comparison_failure',
    } satisfies Partial<PathScopedMergeEquivalenceError>)
  })

  it('allows harmless formatting changes only inside the declared structured comparator', async () => {
    const { candidate, current, git, historical } = await packageJsonObjects()
    const reader = new OverridingGitReader(
      git,
      new Map([
        [gitValueKey(HISTORICAL_MAIN, 'package.json'), serializedPackage(historical, 0)],
        [gitValueKey(PR_86_MERGE_COMMIT, 'package.json'), serializedPackage(current, 4)],
        [gitValueKey(CANDIDATE_HEAD, 'package.json'), serializedPackage(candidate, 1)],
      ]),
    )
    await expect(
      verifySubsequentMainlineCompatibility(await subsequentFixture(), { git: reader }),
    ).resolves.toMatchObject({ result: 'accepted_structured_unrelated_mainline_delta' })
  })

  it('rejects a changed nonstructured protected path', async () => {
    const input = await subsequentFixture()
    const git = new LocalGitReader(REPOSITORY_ROOT)
    const path = 'docs/ip-literature/gold-import-compensation-contract.md'
    const original = await git.treeEntry(PR_86_MERGE_COMMIT, path)
    expect(original).not.toBeNull()
    const reader = new OverridingGitReader(
      git,
      new Map(),
      new Map([
        [
          gitValueKey(PR_86_MERGE_COMMIT, path),
          { ...original!, objectId: '0000000000000000000000000000000000000000' },
        ],
      ]),
    )
    await expect(
      verifySubsequentMainlineCompatibility(input, { git: reader }),
    ).rejects.toMatchObject({
      code: 'protected_path_failure',
    } satisfies Partial<PathScopedMergeEquivalenceError>)
  })

  it('rejects package.json overlap when no structured authorization is declared', async () => {
    const { input } = await regressionFixture()
    await expect(
      verifyPathScopedMergeEquivalence(
        {
          ...input,
          mergedMain: PR_86_MERGE_COMMIT,
          acceptedUnrelatedMerges: [{ identity: 'PR #86', mergeCommit: PR_86_MERGE_COMMIT }],
        },
        { repositoryRoot: REPOSITORY_ROOT },
      ),
    ).rejects.toMatchObject({
      code: 'protected_path_overlap',
    } satisfies Partial<PathScopedMergeEquivalenceError>)
  })

  it('rejects removal of the code-pinned structured authorization', async () => {
    const raw = JSON.parse(await readFile(SUBSEQUENT_FIXTURE_PATH, 'utf8')) as Record<
      string,
      unknown
    >
    raw.structuredProtectedPaths = []
    expect(() => parseSubsequentMainlineCompatibilityInput(raw)).toThrow(
      /must contain exactly package\.json/u,
    )
  })
})

describe('merge-receipt output confinement', () => {
  async function historicalReceipt() {
    const { input } = await regressionFixture()
    return verifyPathScopedMergeEquivalence(input, { repositoryRoot: REPOSITORY_ROOT })
  }

  it('rejects a symlink output root and a symlink ancestor below the root', async () => {
    const receipt = await historicalReceipt()
    const parent = await mkdtemp(join(tmpdir(), 'merge-output-symlink-'))
    const realRoot = join(parent, 'real-root')
    const linkedRoot = join(parent, 'linked-root')
    await mkdir(realRoot)
    await symlink(realRoot, linkedRoot, 'dir')
    await expect(
      publishPathScopedMergeEquivalenceReceipt(receipt, join(linkedRoot, 'receipt'), linkedRoot),
    ).rejects.toThrow(/non-symlink|root/u)

    const confinedRoot = join(parent, 'confined-root')
    const realAncestor = join(confinedRoot, 'real-ancestor')
    const linkedAncestor = join(confinedRoot, 'linked-ancestor')
    await mkdir(confinedRoot)
    await mkdir(realAncestor)
    await symlink(realAncestor, linkedAncestor, 'dir')
    await expect(
      publishPathScopedMergeEquivalenceReceipt(
        receipt,
        join(linkedAncestor, 'receipt'),
        confinedRoot,
      ),
    ).rejects.toThrow(/symlink/iu)
  })

  it('rejects output escape, traversal, collisions, hardlinks, and non-directory ancestors', async () => {
    const receipt = await historicalReceipt()
    const parent = await mkdtemp(join(tmpdir(), 'merge-output-attacks-'))
    const root = join(parent, 'root')
    await mkdir(root)
    await expect(
      publishPathScopedMergeEquivalenceReceipt(
        receipt,
        join(parent, 'absent-root', 'receipt'),
        join(parent, 'absent-root'),
      ),
    ).rejects.toThrow()
    const fileRoot = join(parent, 'file-root')
    await writeFile(fileRoot, 'not a root', { mode: 0o600 })
    await expect(
      publishPathScopedMergeEquivalenceReceipt(receipt, join(fileRoot, 'receipt'), fileRoot),
    ).rejects.toThrow(/directory|root/u)
    await expect(
      publishPathScopedMergeEquivalenceReceipt(receipt, join(parent, 'outside'), root),
    ).rejects.toThrow(/outside|approved output root/u)
    await expect(
      publishPathScopedMergeEquivalenceReceipt(
        receipt,
        `${root}${sep}nested${sep}..${sep}traversal`,
        root,
      ),
    ).rejects.toThrow(/traversal|normalized/u)

    const collision = join(root, 'collision')
    await mkdir(collision)
    await expect(
      publishPathScopedMergeEquivalenceReceipt(receipt, collision, root),
    ).rejects.toThrow(/collision|exist/u)

    const source = join(root, 'source-file')
    const hardlink = join(root, 'hardlink-output')
    await writeFile(source, 'do not overwrite', { mode: 0o600 })
    await link(source, hardlink)
    await expect(publishPathScopedMergeEquivalenceReceipt(receipt, hardlink, root)).rejects.toThrow(
      /collision|exist/u,
    )

    const fileAncestor = join(root, 'file-ancestor')
    await writeFile(fileAncestor, 'not a directory', { mode: 0o600 })
    await expect(
      publishPathScopedMergeEquivalenceReceipt(receipt, join(fileAncestor, 'receipt'), root),
    ).rejects.toThrow()
  })

  it('rejects a raced output-directory symlink before writing outside the approved root', async () => {
    const receipt = await historicalReceipt()
    const parent = await mkdtemp(join(tmpdir(), 'merge-output-race-'))
    const root = join(parent, 'root')
    const outside = join(parent, 'outside')
    const output = join(root, 'receipt')
    const displaced = join(outside, 'displaced-receipt')
    const workingDirectoryBeforePublication = process.cwd()
    await mkdir(root)
    await mkdir(outside)

    await expect(
      publishPathScopedMergeEquivalenceReceipt(receipt, output, root, {
        beforeAnchoredWrite: async (createdOutput) => {
          expect(createdOutput).toBe(output)
          await rename(createdOutput, displaced)
          await symlink(displaced, createdOutput, 'dir')
        },
      }),
    ).rejects.toThrow(/identity changed/u)
    expect(process.cwd()).toBe(workingDirectoryBeforePublication)

    for (const filename of [
      MERGE_EQUIVALENCE_JSON_FILENAME,
      MERGE_EQUIVALENCE_MARKDOWN_FILENAME,
      MERGE_EQUIVALENCE_MANIFEST_FILENAME,
    ]) {
      await expect(readFile(join(outside, filename))).rejects.toMatchObject({ code: 'ENOENT' })
      await expect(readFile(join(displaced, filename))).rejects.toMatchObject({ code: 'ENOENT' })
    }
  })
})
