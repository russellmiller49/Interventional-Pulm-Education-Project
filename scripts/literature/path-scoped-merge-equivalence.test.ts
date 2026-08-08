/** @jest-environment node */

import { readFile } from 'node:fs/promises'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  MERGE_EQUIVALENCE_JSON_FILENAME,
  MERGE_EQUIVALENCE_MANIFEST_FILENAME,
  MERGE_EQUIVALENCE_MARKDOWN_FILENAME,
  canonicalMergeEquivalenceJson,
  parsePathScopedMergeEquivalenceInput,
  pathInventorySha256,
  publishPathScopedMergeEquivalenceReceipt,
  sha256,
  verifyPathScopedMergeEquivalence,
  type PathScopedMergeEquivalenceError,
} from './path-scoped-merge-equivalence'

jest.setTimeout(30_000)

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/pr-84-pr-85-path-scoped-merge-equivalence.json',
)
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

describe('path-scoped merge equivalence', () => {
  it('accepts the actual PR #84/PR #85 34/4/0 topology with exact PR #85 attribution', async () => {
    const { input, expected } = await regressionFixture()
    const receipt = await verifyPathScopedMergeEquivalence(input, {
      repositoryRoot: REPOSITORY_ROOT,
    })

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
    const first = await publishPathScopedMergeEquivalenceReceipt(receipt, join(root, 'first'))
    const second = await publishPathScopedMergeEquivalenceReceipt(receipt, join(root, 'second'))

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
    expect(json).not.toMatch(/createdAt|generatedAt|outputDirectory/u)
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
