import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  BAXTER_CRRT_CANDIDATE_PATHS,
  BAXTER_CRRT_SOURCE_EXPECTATIONS,
  assertManifestOutputOutsideRepository,
  digestWorkingTreeCandidateFile,
} from './create-review-candidate-manifest'
import {
  assertSafeRepositoryRelativePath,
  buildBaxterCrrtReviewCandidateManifest,
  compareUtf8Bytes,
  createBaxterCrrtCandidateId,
  sha256Hex,
  stableJson,
  verifyBaxterCrrtReviewCandidateManifest,
  type BaxterCrrtCandidateFileDigest,
  type BaxterCrrtCandidateGitTreeIdentity,
  type BaxterCrrtCandidateVersions,
  type BaxterCrrtExternalSourceRecord,
  type BaxterCrrtReviewCandidateManifest,
} from './review-candidate-manifest'

const gitTree: BaxterCrrtCandidateGitTreeIdentity = {
  objectFormat: 'sha1',
  treeOid: 'b'.repeat(40),
}

const versions: BaxterCrrtCandidateVersions = {
  engine: 'engine-1',
  runtimeSchema: 'schema-1',
  protectedPilotContent: 'pilot-1',
  phase7ReviewerContent: 'phase7-1',
  phase8ReviewerContent: 'phase8-1',
  prismaxProfile: 'prismax-1',
  prismaflexProfile: 'prismaflex-1',
  protocolProfile: null,
}

const sourceArtifacts: readonly BaxterCrrtExternalSourceRecord[] = [
  {
    artifactId: 'SOURCE-1',
    fileName: 'source.pdf',
    expectedSha256: sha256Hex('source'),
    actualSha256: sha256Hex('source'),
    sizeBytes: 6,
    verifiedFromSuppliedFile: true,
  },
]

const files: readonly BaxterCrrtCandidateFileDigest[] = [
  { path: 'src/b.ts', mode: '100644', sha256: sha256Hex('b'), sizeBytes: 1 },
  { path: 'src/a.ts', mode: '100644', sha256: sha256Hex('a'), sizeBytes: 1 },
]

function manifest(
  options: {
    clean?: boolean
    files?: readonly BaxterCrrtCandidateFileDigest[]
    treeOid?: string
  } = {},
) {
  const clean = options.clean ?? true
  return buildBaxterCrrtReviewCandidateManifest({
    generatedAt: '2026-07-17T12:00:00.000Z',
    git: {
      branch: 'main',
      commit: 'a'.repeat(40),
      objectFormat: 'sha1',
      treeOid: options.treeOid ?? gitTree.treeOid,
      repositoryClean: clean,
      candidateScopeClean: clean,
      candidateScopeChanges: clean ? [] : ['src/a.ts'],
    },
    versions,
    sourceArtifacts,
    files: options.files ?? files,
  })
}

describe('Baxter CRRT review candidate manifest', () => {
  it('canonicalizes object keys and set-like records by unsigned UTF-8 byte order', () => {
    expect(compareUtf8Bytes('Z', 'a')).toBeLessThan(0)
    expect(compareUtf8Bytes('z', 'é')).toBeLessThan(0)
    expect(stableJson({ é: 1, a: { z: 2, Z: 3 } })).toBe('{"a":{"Z":3,"z":2},"é":1}')

    const reversedId = createBaxterCrrtCandidateId(
      gitTree,
      versions,
      [...sourceArtifacts].reverse(),
      [...files].reverse(),
    )
    expect(createBaxterCrrtCandidateId(gitTree, versions, sourceArtifacts, files)).toBe(reversedId)
    expect(manifest().files.map((file) => file.path)).toEqual(['src/a.ts', 'src/b.ts'])
  })

  it('rejects values that cannot be represented in canonical JSON', () => {
    expect(() => stableJson({ value: undefined })).toThrow(/cannot be represented in JSON/u)
    expect(() => stableJson({ value: Number.NaN })).toThrow(/finite JSON number/u)
    expect(() => stableJson(new Date('2026-07-17T12:00:00.000Z'))).toThrow(
      /only plain JSON objects/u,
    )

    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(() => stableJson(circular)).toThrow(/circular JSON reference/u)
  })

  it('changes identity when scoped bytes, file mode, or committed Git tree changes', () => {
    const baseline = createBaxterCrrtCandidateId(gitTree, versions, sourceArtifacts, files)
    const changedBytes = files.map((file) =>
      file.path === 'src/a.ts' ? { ...file, sha256: sha256Hex('changed') } : file,
    )
    const changedMode = files.map((file) =>
      file.path === 'src/a.ts' ? { ...file, mode: '100755' as const } : file,
    )

    expect(createBaxterCrrtCandidateId(gitTree, versions, sourceArtifacts, changedBytes)).not.toBe(
      baseline,
    )
    expect(createBaxterCrrtCandidateId(gitTree, versions, sourceArtifacts, changedMode)).not.toBe(
      baseline,
    )
    expect(
      createBaxterCrrtCandidateId(
        { ...gitTree, treeOid: 'c'.repeat(40) },
        versions,
        sourceArtifacts,
        files,
      ),
    ).not.toBe(baseline)
  })

  it('marks a dirty worktree provisional and rejects it during verification', () => {
    const recorded = manifest()
    const current = manifest({ clean: false })

    expect(recorded.freezeEligibility).toBe('eligible-clean-commit')
    expect(current.freezeEligibility).toBe('provisional-dirty-working-tree')
    expect(verifyBaxterCrrtReviewCandidateManifest(recorded, current)).toContain(
      'The current working tree is not clean and cannot be treated as a frozen candidate.',
    )
  })

  it('detects exact-candidate content and Git-tree mismatches', () => {
    const recorded = manifest()
    const changedFiles = manifest({
      files: files.map((file) =>
        file.path === 'src/b.ts' ? { ...file, sha256: sha256Hex('new b') } : file,
      ),
    })
    const changedTree = manifest({ treeOid: 'd'.repeat(40) })

    expect(verifyBaxterCrrtReviewCandidateManifest(recorded, changedFiles)).toContain(
      'Candidate identity does not match the current Git tree, scoped files, versions, or sources.',
    )
    expect(verifyBaxterCrrtReviewCandidateManifest(recorded, changedTree)).toContain(
      'Git tree does not match the recorded candidate context.',
    )
  })

  it('rejects an internally tampered, provisional, or source-unverified recorded manifest', () => {
    const clean = manifest()
    const tamperedFiles = {
      ...clean,
      files: [],
    } as unknown as BaxterCrrtReviewCandidateManifest
    expect(verifyBaxterCrrtReviewCandidateManifest(tamperedFiles, clean)).toContain(
      'Recorded manifest is not the canonical internally consistent manifest for its recorded inputs.',
    )

    const provisional = manifest({ clean: false })
    expect(verifyBaxterCrrtReviewCandidateManifest(provisional, clean)).toContain(
      'Recorded manifest was not created from a fully clean committed repository.',
    )

    const sourceUnverified = buildBaxterCrrtReviewCandidateManifest({
      generatedAt: clean.generatedAt,
      git: clean.git,
      versions: clean.versions,
      sourceArtifacts: sourceArtifacts.map((source) => ({
        ...source,
        actualSha256: null,
        sizeBytes: null,
        verifiedFromSuppliedFile: false,
      })),
      files: clean.files,
    })
    expect(verifyBaxterCrrtReviewCandidateManifest(sourceUnverified, clean)).toContain(
      'Recorded manifest does not contain verified supplied-source attestations.',
    )
  })

  it('rejects unsafe paths, duplicates, symlink modes, and malformed Git object IDs', () => {
    expect(() =>
      createBaxterCrrtCandidateId(gitTree, versions, sourceArtifacts, [...files, files[0]]),
    ).toThrow(/must not contain duplicates/u)

    for (const unsafePath of [
      '',
      '/src/a.ts',
      '../src/a.ts',
      'src/../a.ts',
      'src//a.ts',
      'src\\a.ts',
      'C:/src/a.ts',
      '.git/config',
      'src/a file.ts',
      'src/a\nfile.ts',
      'docs/baxter-crrt/.env.local',
      'docs/baxter-crrt/trace.log',
      'src/features/baxter-crrt/.next/output.js',
      'src/features/baxter-crrt/test-results/result.json',
    ]) {
      expect(() => assertSafeRepositoryRelativePath(unsafePath)).toThrow(
        /safe repository-relative/u,
      )
    }

    const symlinkMode = [
      { ...files[0], mode: '120000' },
    ] as unknown as readonly BaxterCrrtCandidateFileDigest[]
    expect(() =>
      createBaxterCrrtCandidateId(gitTree, versions, sourceArtifacts, symlinkMode),
    ).toThrow(/mode must be 100644 or 100755/u)
    expect(() =>
      createBaxterCrrtCandidateId(
        { objectFormat: 'sha1', treeOid: 'a'.repeat(64) },
        versions,
        sourceArtifacts,
        files,
      ),
    ).toThrow(/full sha1 Git object ID/u)
  })

  it('requires source attestations to be internally complete and consistent', () => {
    expect(() =>
      createBaxterCrrtCandidateId(
        gitTree,
        versions,
        [{ ...sourceArtifacts[0], actualSha256: sha256Hex('other') }],
        files,
      ),
    ).toThrow(/incomplete or mismatched/u)
    expect(() =>
      createBaxterCrrtCandidateId(
        gitTree,
        versions,
        [{ ...sourceArtifacts[0], verifiedFromSuppliedFile: false }],
        files,
      ),
    ).toThrow(/must not record observed bytes/u)
  })

  it('reads only regular in-root worktree files and records executable mode', () => {
    const root = mkdtempSync(join(tmpdir(), 'baxter-crrt-candidate-'))
    try {
      mkdirSync(join(root, 'src'))
      writeFileSync(join(root, 'src', 'regular.ts'), 'regular', 'utf8')
      writeFileSync(join(root, 'src', 'executable.ts'), 'executable', 'utf8')
      chmodSync(join(root, 'src', 'executable.ts'), 0o755)
      mkdirSync(join(root, 'src', 'directory'))
      symlinkSync(join(root, 'src', 'regular.ts'), join(root, 'src', 'linked.ts'))

      expect(digestWorkingTreeCandidateFile(root, 'src/regular.ts')).toMatchObject({
        mode: '100644',
        sizeBytes: 7,
      })
      expect(digestWorkingTreeCandidateFile(root, 'src/executable.ts')).toMatchObject({
        mode: '100755',
        sizeBytes: 10,
      })
      expect(() => digestWorkingTreeCandidateFile(root, 'src/linked.ts')).toThrow(/symbolic link/u)
      expect(() => digestWorkingTreeCandidateFile(root, 'src/directory')).toThrow(/regular file/u)
      expect(() => digestWorkingTreeCandidateFile(root, '../outside.ts')).toThrow(
        /safe repository-relative/u,
      )
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })

  it('requires manifest output to stay outside the repository, including through parent symlinks', () => {
    const sandbox = mkdtempSync(join(tmpdir(), 'baxter-crrt-output-'))
    const repository = join(sandbox, 'repository')
    const external = join(sandbox, 'external')
    try {
      mkdirSync(repository)
      mkdirSync(external)
      expect(() =>
        assertManifestOutputOutsideRepository(repository, join(repository, 'candidate.json')),
      ).toThrow(/outside the repository/u)

      const externalOutput = join(external, 'candidate.json')
      expect(assertManifestOutputOutsideRepository(repository, externalOutput)).toBe(externalOutput)

      const linkedParent = join(external, 'linked-repository')
      symlinkSync(repository, linkedParent)
      const linkedChild = join(linkedParent, 'must-not-be-created')
      expect(() =>
        assertManifestOutputOutsideRepository(repository, join(linkedChild, 'candidate.json')),
      ).toThrow(/parent must resolve outside/u)
      expect(existsSync(linkedChild)).toBe(false)
    } finally {
      rmSync(sandbox, { force: true, recursive: true })
    }
  })

  it('covers the CRRT integration and reproducible build envelope without secret/output paths', () => {
    expect(BAXTER_CRRT_CANDIDATE_PATHS).toEqual(
      expect.arrayContaining([
        'src/app/sitemap.ts',
        'src/app/sitemap.baxter-crrt.test.ts',
        'src/lib/analytics.ts',
        'src/lib/site-search.ts',
        'src/i18n/handoff.tsx',
        'src/i18n/handoff-core.ts',
        'src/i18n/handoff-message-ids.ts',
        'messages/en.json',
        'messages/es.json',
        'messages/zh-CN.json',
        'src/proxy.ts',
        'contentlayer.config.ts',
        'postcss.config.js',
        'tailwind.config.ts',
        'scripts/prepare-standalone.mjs',
        'server.js',
      ]),
    )
    for (const path of BAXTER_CRRT_CANDIDATE_PATHS) {
      expect(() => assertSafeRepositoryRelativePath(path)).not.toThrow()
      expect(path).not.toMatch(
        /(?:^|\/)(?:\.env|\.next|node_modules|coverage|test-results)(?:\/|$)/u,
      )
    }
    expect(BAXTER_CRRT_SOURCE_EXPECTATIONS).toHaveLength(4)
  })
})
