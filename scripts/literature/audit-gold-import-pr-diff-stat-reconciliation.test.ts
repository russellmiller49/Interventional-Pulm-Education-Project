import { buildGoldImportDiffStatReconciliation } from './audit-gold-import-pr-diff-stat-reconciliation'

const HEAD = '1'.repeat(40)

function fixture() {
  return {
    branch: 'codex/ip-literature-post-migration-contract-reconciliation-v1',
    generatedAt: '2026-08-09T12:00:00.000Z',
    gitDiffNumstatStdout: '2\t1\ta.ts\n1\t0\tb.md\n',
    gitDiffStatStdout:
      ' a.ts | 3 ++-\n b.md | 1 +\n 2 files changed, 3 insertions(+), 1 deletion(-)\n',
    head: HEAD,
    originMain: '2'.repeat(40),
    pullRequest: {
      additions: 3,
      baseRefName: 'main',
      changedFiles: 2,
      deletions: 1,
      headRefName: 'codex/ip-literature-post-migration-contract-reconciliation-v1',
      headRefOid: HEAD,
      isDraft: true,
      mergeable: 'MERGEABLE',
      mergedAt: null,
      number: 89,
      state: 'OPEN',
    },
    worktreePorcelainStdout: '',
  }
}

describe('gold import PR diff-stat reconciliation', () => {
  it('requires Git three-dot and GitHub statistics to agree exactly', () => {
    const report = buildGoldImportDiffStatReconciliation(fixture())

    expect(report.authoritativeFinal).toEqual({
      additions: 3,
      basis: 'git_three_dot_and_github_pr_agree',
      changedFiles: 2,
      deletions: 1,
    })
    expect(report.startingHeadObservation).toMatchObject({
      additions: 14_413,
      changedFiles: 30,
      deletions: 277,
      head: 'aab05aa2c3ef9aab88730e78b42e0b8725a80af6',
    })
    expect(report.explanation.generatedUntrackedOrTemporaryFilesExplainDifference).toBe(false)
    expect(report.explanation.reason).toContain('exact discrepancy is a basis mismatch')
    expect(report.explanation.reason).toContain(
      'original unrecorded calculation cannot be reconstructed',
    )
  })

  it('rejects a GitHub count substitution', () => {
    const input = fixture()
    expect(() =>
      buildGoldImportDiffStatReconciliation({
        ...input,
        pullRequest: { ...input.pullRequest, additions: 4 },
      }),
    ).toThrow('Git three-dot statistics and GitHub PR statistics disagree')
  })

  it('rejects untracked or temporary files and stale PR heads', () => {
    expect(() =>
      buildGoldImportDiffStatReconciliation({
        ...fixture(),
        worktreePorcelainStdout: '?? temporary.json\n',
      }),
    ).toThrow('no tracked, untracked, or temporary files')

    const input = fixture()
    expect(() =>
      buildGoldImportDiffStatReconciliation({
        ...input,
        pullRequest: { ...input.pullRequest, headRefOid: '3'.repeat(40) },
      }),
    ).toThrow('does not match the exact final branch and HEAD')
  })
})
