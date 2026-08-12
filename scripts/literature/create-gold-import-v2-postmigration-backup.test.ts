/** @jest-environment node */

import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import { canonicalJson } from '../../src/features/literature/gold-set/import-compensation'
import {
  GOLD_IMPORT_V2_CURRENT_BACKUP_BRANCH,
  GOLD_IMPORT_V2_CURRENT_BACKUP_EVIDENCE_NAMES,
  GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE,
  GOLD_IMPORT_V2_CURRENT_BACKUP_RECEIPT_SCHEMA_VERSION,
  GOLD_IMPORT_V2_CURRENT_BACKUP_REPOSITORY,
  GOLD_IMPORT_V2_CURRENT_BACKUP_REPOSITORY_URL,
  buildGoldImportV2CurrentBackupCandidateAuthority,
  buildGoldImportV2CurrentBackupReleaseFreeze,
  buildGoldImportV2CurrentBackupReleaseVerificationCandidate,
  currentBackupAuthorityIdentitySha256,
  inspectGoldImportV2CurrentBackupRepository,
  parseGoldImportV2CurrentBackupArguments,
  releaseExpectationsFromVerification,
  validateGoldImportV2CurrentBackupAuthority,
  validateGoldImportV2CurrentBackupReleaseFreeze,
  validateGoldImportV2CurrentBackupReleaseVerification,
  verifyGoldImportV2CurrentBackupDirectory,
  type GoldImportV2CurrentBackupReleaseExpectations,
  type GoldImportV2CurrentBackupReleaseFreeze,
} from './create-gold-import-v2-postmigration-backup'
import {
  GOLD_IMPORT_V2_PREIMPORT_RUNTIME_REQUIRED_FILES,
  buildGoldImportV2PreimportRuntimeBundle,
} from './gold-import-v2-preimport-capture'

const HEAD = '1234567890abcdef1234567890abcdef12345678'
const LATER_HEAD = '2234567890abcdef1234567890abcdef12345678'
const EARLIER_HEAD = '0234567890abcdef1234567890abcdef12345678'
const WRONG_HEAD = '1'.repeat(40)
const CHANGED_PATHS = [
  'scripts/literature/rehearse-exact-gold-import-compensation-package-v2.ts',
  'scripts/literature/reviewed-change.ts',
] as const

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

function canonicalPretty(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(JSON.parse(canonicalJson(value)), null, 2)}\n`, 'utf8')
}

function runtimeInputs(paths: readonly string[] = GOLD_IMPORT_V2_PREIMPORT_RUNTIME_REQUIRED_FILES) {
  return [...new Set(paths)].sort().map((path) => ({
    bytes: Buffer.from(`reviewed runtime bytes: ${path}\n`, 'utf8'),
    name: path,
    path,
    sourcePath: `/repository/${path}`,
  }))
}

function buildFixture(input?: {
  changedPaths?: readonly string[]
  runtimePaths?: readonly string[]
}) {
  const changedPaths = input?.changedPaths ?? CHANGED_PATHS
  const runtime = runtimeInputs(input?.runtimePaths)
  const runtimeBundle = buildGoldImportV2PreimportRuntimeBundle(runtime)
  const built = buildGoldImportV2CurrentBackupCandidateAuthority({
    changedTrackedFiles: changedPaths.map((path) => ({
      bytes: Buffer.from(`changed bytes: ${path}\n`, 'utf8'),
      name: path,
      sourcePath: `/repository/${path}`,
    })),
    evidence: GOLD_IMPORT_V2_CURRENT_BACKUP_EVIDENCE_NAMES.map((name) => ({
      bytes: Buffer.from(`evidence: ${name}\n`, 'utf8'),
      name,
      sourcePath: `/evidence/${name}.md`,
    })),
    repository: {
      branch: GOLD_IMPORT_V2_CURRENT_BACKUP_BRANCH,
      frozenBase: GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE,
      head: HEAD,
      originMain: GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE,
      upstreamHead: HEAD,
    },
    runtimeBundle,
    runtimeSources: runtime,
  })
  return { ...built, changedPaths, runtimeBundle }
}

function expectationsFor(
  fixture = buildFixture(),
  overrides: Partial<GoldImportV2CurrentBackupReleaseExpectations> = {},
): GoldImportV2CurrentBackupReleaseExpectations {
  return {
    expectedAuthorityIdentitySha256: fixture.authority.authorityIdentitySha256,
    expectedBase: GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE,
    expectedBranch: GOLD_IMPORT_V2_CURRENT_BACKUP_BRANCH,
    expectedChangedPaths: fixture.changedPaths,
    expectedHead: HEAD,
    ...overrides,
  }
}

function validateFixture(fixture = buildFixture()) {
  return validateGoldImportV2CurrentBackupAuthority({
    authority: fixture.authority,
    expectedCurrentRuntimeBundle: fixture.runtimeBundle,
    payloadFiles: fixture.payloadFiles,
    releaseExpectations: expectationsFor(fixture),
  })
}

function rehashAuthority(authority: ReturnType<typeof buildFixture>['authority']) {
  const body = { ...authority }
  delete (body as Partial<typeof authority>).authorityIdentitySha256
  return { ...body, authorityIdentitySha256: currentBackupAuthorityIdentitySha256(body) }
}

function buildReleaseFreeze(): GoldImportV2CurrentBackupReleaseFreeze {
  return buildGoldImportV2CurrentBackupReleaseFreeze({
    branch: GOLD_IMPORT_V2_CURRENT_BACKUP_BRANCH,
    changedPaths: CHANGED_PATHS.map((path) => ({ path, status: 'M' })),
    createdAt: '2026-08-12T20:00:00.000Z',
    frozenBase: GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE,
    frozenHead: HEAD,
    repository: GOLD_IMPORT_V2_CURRENT_BACKUP_REPOSITORY,
  })
}

async function writeBackupFixture(directory: string, fixture = buildFixture()) {
  await mkdir(directory, { mode: 0o700 })
  const files = new Map(fixture.payloadFiles)
  const authorityBytes = canonicalPretty(fixture.authority)
  files.set('backup-authority.json', authorityBytes)
  const manifest = {
    authorityIdentitySha256: fixture.authority.authorityIdentitySha256,
    files: [...files]
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([name, bytes]) => ({ bytes: bytes.byteLength, name, sha256: sha256(bytes) })),
    schemaVersion: 'literature-gold-v2-postmigration-delivery-backup-manifest/1.0.0',
  }
  const manifestBytes = canonicalPretty(manifest)
  files.set('backup-manifest.json', manifestBytes)
  const checksums = Buffer.from(
    `${[...files]
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([name, bytes]) => `${sha256(bytes)}  ${name}`)
      .join('\n')}\n`,
    'utf8',
  )
  const receiptBody = {
    authorityIdentitySha256: fixture.authority.authorityIdentitySha256,
    checksumManifestSha256: sha256(checksums),
    compensationAuthorized: false,
    fileCount: files.size,
    head: HEAD,
    importAuthorized: false,
    schemaVersion: GOLD_IMPORT_V2_CURRENT_BACKUP_RECEIPT_SCHEMA_VERSION,
  }
  files.set('checksum-manifest.sha256', checksums)
  const receiptIdentitySha256 = sha256(canonicalJson(receiptBody))
  files.set('backup-receipt.json', canonicalPretty({ ...receiptBody, receiptIdentitySha256 }))
  await Promise.all(
    [...files].map(([name, bytes]) => writeFile(resolve(directory, name), bytes, { mode: 0o600 })),
  )
  return {
    checksumManifestSha256: sha256(checksums),
    manifestSha256: sha256(manifestBytes),
    receiptIdentitySha256,
  }
}

function repositoryGitRunner(input?: {
  changedPathOutput?: string
  head?: string
  upstreamHead?: string
}) {
  return async (arguments_: readonly string[]) => {
    const command = arguments_.join(' ')
    if (command === 'branch --show-current') return GOLD_IMPORT_V2_CURRENT_BACKUP_BRANCH
    if (command === 'rev-parse HEAD') return input?.head ?? HEAD
    if (command === 'rev-parse origin/main') return GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE
    if (command === 'remote get-url origin') return GOLD_IMPORT_V2_CURRENT_BACKUP_REPOSITORY_URL
    if (command === 'rev-parse --abbrev-ref --symbolic-full-name @{upstream}') {
      return `origin/${GOLD_IMPORT_V2_CURRENT_BACKUP_BRANCH}`
    }
    if (command === 'rev-parse @{upstream}') return input?.upstreamHead ?? HEAD
    if (command === 'status --porcelain=v1 --untracked-files=all') return ''
    if (command.startsWith('merge-base --is-ancestor ')) return ''
    if (command.startsWith('diff --name-only -z ')) return `${CHANGED_PATHS.join('\0')}\0`
    if (command.startsWith('diff --name-status -z --find-renames ')) {
      return input?.changedPathOutput ?? CHANGED_PATHS.map((path) => `M\0${path}\0`).join('')
    }
    throw new Error(`Unexpected Git command: ${command}`)
  }
}

describe('current PR #97 externally frozen postmigration delivery backup', () => {
  const cleanup: string[] = []

  afterEach(async () => {
    await Promise.all(cleanup.splice(0).map((directory) => rm(directory, { recursive: true })))
  })

  it('accepts only the exact external branch/base/head/paths/authority and current runtime', () => {
    const result = validateFixture()
    expect(result.repository).toMatchObject({
      branch: GOLD_IMPORT_V2_CURRENT_BACKUP_BRANCH,
      frozenBase: GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE,
      head: HEAD,
      upstreamHead: HEAD,
    })
    expect(result.changedTrackedFiles.map(({ name }) => name)).toEqual(CHANGED_PATHS)
  })

  it('rejects the independently reproduced self-consistent all-1 wrong head', () => {
    const fixture = buildFixture()
    const authority = rehashAuthority({
      ...fixture.authority,
      repository: { ...fixture.authority.repository, head: WRONG_HEAD, upstreamHead: WRONG_HEAD },
    })
    expect(() =>
      validateGoldImportV2CurrentBackupAuthority({
        authority,
        expectedCurrentRuntimeBundle: fixture.runtimeBundle,
        payloadFiles: fixture.payloadFiles,
        releaseExpectations: expectationsFor(fixture),
      }),
    ).toThrow('externally frozen authority identity')
    expect(() =>
      validateGoldImportV2CurrentBackupAuthority({
        authority,
        expectedCurrentRuntimeBundle: fixture.runtimeBundle,
        payloadFiles: fixture.payloadFiles,
        releaseExpectations: expectationsFor(fixture, {
          expectedAuthorityIdentitySha256: authority.authorityIdentitySha256,
        }),
      }),
    ).toThrow('externally frozen release repository')
  })

  it('rejects the independently reproduced omitted protected changed file', () => {
    const omitted = 'scripts/literature/rehearse-exact-gold-import-compensation-package-v2.ts'
    const fixture = buildFixture({ changedPaths: CHANGED_PATHS.filter((path) => path !== omitted) })
    expect(() =>
      validateGoldImportV2CurrentBackupAuthority({
        authority: fixture.authority,
        expectedCurrentRuntimeBundle: fixture.runtimeBundle,
        payloadFiles: fixture.payloadFiles,
        releaseExpectations: expectationsFor(fixture, {
          expectedAuthorityIdentitySha256: fixture.authority.authorityIdentitySha256,
          expectedChangedPaths: CHANGED_PATHS,
        }),
      }),
    ).toThrow('changed-file inventory')
  })

  it('rejects wrong or omitted external expectation fields at runtime', () => {
    const fixture = buildFixture()
    expect(() =>
      validateGoldImportV2CurrentBackupAuthority({
        authority: fixture.authority,
        expectedCurrentRuntimeBundle: fixture.runtimeBundle,
        payloadFiles: fixture.payloadFiles,
        releaseExpectations: expectationsFor(fixture, {
          expectedAuthorityIdentitySha256: 'f'.repeat(64),
        }),
      }),
    ).toThrow('externally frozen authority identity')
    for (const field of [
      'expectedHead',
      'expectedChangedPaths',
      'expectedAuthorityIdentitySha256',
    ] as const) {
      const incomplete = { ...expectationsFor(fixture) } as Record<string, unknown>
      delete incomplete[field]
      expect(() =>
        validateGoldImportV2CurrentBackupAuthority({
          authority: fixture.authority,
          expectedCurrentRuntimeBundle: fixture.runtimeBundle,
          payloadFiles: fixture.payloadFiles,
          releaseExpectations: incomplete as never,
        }),
      ).toThrow()
    }
  })

  it('rejects wrong base, wrong branch, added paths, duplicates, and noncanonical order', () => {
    const fixture = buildFixture()
    for (const releaseExpectations of [
      expectationsFor(fixture, { expectedBase: 'f'.repeat(40) }),
      expectationsFor(fixture, { expectedBranch: 'codex/not-pr-97' }),
      expectationsFor(fixture, {
        expectedChangedPaths: [...CHANGED_PATHS, 'scripts/literature/unexpected.ts'],
      }),
      expectationsFor(fixture, { expectedChangedPaths: [...CHANGED_PATHS, CHANGED_PATHS[1]] }),
      expectationsFor(fixture, { expectedChangedPaths: [...CHANGED_PATHS].reverse() }),
    ]) {
      expect(() =>
        validateGoldImportV2CurrentBackupAuthority({
          authority: fixture.authority,
          expectedCurrentRuntimeBundle: fixture.runtimeBundle,
          payloadFiles: fixture.payloadFiles,
          releaseExpectations,
        }),
      ).toThrow()
    }
  })

  it('rejects runtime-closure and evidence mutations even with recomputed authority identities', () => {
    const fixture = buildFixture()
    const changedRuntime = buildGoldImportV2PreimportRuntimeBundle(
      runtimeInputs().map((file, index) =>
        index === 0 ? { ...file, bytes: Buffer.from('mutated runtime bytes\n') } : file,
      ),
    )
    const runtimeAuthority = rehashAuthority({
      ...fixture.authority,
      runtimeBundle: changedRuntime,
    })
    expect(() =>
      validateGoldImportV2CurrentBackupAuthority({
        authority: runtimeAuthority,
        expectedCurrentRuntimeBundle: fixture.runtimeBundle,
        payloadFiles: fixture.payloadFiles,
        releaseExpectations: expectationsFor(fixture, {
          expectedAuthorityIdentitySha256: runtimeAuthority.authorityIdentitySha256,
        }),
      }),
    ).toThrow('exact current PR #97 runtime closure')

    const evidence = fixture.authority.evidence.map((record, index) =>
      index === 0 ? { ...record, sha256: 'e'.repeat(64) } : record,
    )
    const evidenceAuthority = rehashAuthority({ ...fixture.authority, evidence })
    expect(() =>
      validateGoldImportV2CurrentBackupAuthority({
        authority: evidenceAuthority,
        expectedCurrentRuntimeBundle: fixture.runtimeBundle,
        payloadFiles: fixture.payloadFiles,
        releaseExpectations: expectationsFor(fixture, {
          expectedAuthorityIdentitySha256: evidenceAuthority.authorityIdentitySha256,
        }),
      }),
    ).toThrow('protected source file changed')
  })

  it('requires an exact canonical release freeze and release-verification self-identities', () => {
    const freeze = buildReleaseFreeze()
    expect(validateGoldImportV2CurrentBackupReleaseFreeze(freeze)).toEqual(freeze)
    expect(() =>
      validateGoldImportV2CurrentBackupReleaseFreeze({
        ...freeze,
        releaseFreezeIdentitySha256: 'f'.repeat(64),
      }),
    ).toThrow('release-freeze identity')
    expect(() =>
      buildGoldImportV2CurrentBackupReleaseFreeze({
        branch: GOLD_IMPORT_V2_CURRENT_BACKUP_BRANCH,
        changedPaths: [
          { path: CHANGED_PATHS[1], status: 'M' },
          { path: CHANGED_PATHS[0], status: 'M' },
        ],
        createdAt: '2026-08-12T20:00:00.000Z',
        frozenBase: GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE,
        frozenHead: HEAD,
        repository: GOLD_IMPORT_V2_CURRENT_BACKUP_REPOSITORY,
      }),
    ).toThrow('canonically ordered')
  })

  it('rejects local/upstream head drift, later and earlier commits, and rename mismatches', async () => {
    const freeze = buildReleaseFreeze()
    await expect(
      inspectGoldImportV2CurrentBackupRepository({
        cwd: '/repository',
        gitCommandRunner: repositoryGitRunner({ upstreamHead: LATER_HEAD }),
        releaseFreeze: freeze,
      }),
    ).rejects.toThrow('exact clean externally frozen')
    for (const head of [LATER_HEAD, EARLIER_HEAD]) {
      await expect(
        inspectGoldImportV2CurrentBackupRepository({
          cwd: '/repository',
          gitCommandRunner: repositoryGitRunner({ head, upstreamHead: head }),
          releaseFreeze: freeze,
        }),
      ).rejects.toThrow('exact clean externally frozen')
    }
    await expect(
      inspectGoldImportV2CurrentBackupRepository({
        cwd: '/repository',
        gitCommandRunner: repositoryGitRunner({
          changedPathOutput: `R100\0${CHANGED_PATHS[0]}\0scripts/literature/renamed.ts\0M\0${CHANGED_PATHS[1]}\0`,
        }),
        releaseFreeze: freeze,
      }),
    ).rejects.toThrow('deletion, rename, copy, or unsupported')
  })

  it('parses generation only with an external freeze and external verification path', () => {
    const evidenceArguments = GOLD_IMPORT_V2_CURRENT_BACKUP_EVIDENCE_NAMES.flatMap((name) => [
      '--evidence',
      `${name}=/evidence/${name}.md`,
    ])
    const parsed = parseGoldImportV2CurrentBackupArguments([
      '--output-root',
      '/backup',
      '--output',
      `/backup/post-v2-preimport-capture-v1-${HEAD}`,
      '--release-freeze',
      `/backup/post-v2-preimport-capture-v1-${HEAD}-release-freeze.json`,
      ...evidenceArguments,
    ])
    expect(parsed).toMatchObject({
      command: 'create-backup',
      releaseFreeze: expect.stringContaining('release-freeze'),
    })
    expect(
      parseGoldImportV2CurrentBackupArguments([
        'create-release-freeze',
        '--output-root',
        '/backup',
        '--output',
        `/backup/post-v2-preimport-capture-v1-${HEAD}-release-freeze.json`,
      ]),
    ).toMatchObject({ command: 'create-release-freeze' })
    expect(
      parseGoldImportV2CurrentBackupArguments([
        'create-release-verification',
        '--expected-authority-identity-sha256',
        'a'.repeat(64),
        '--expected-checksum-manifest-sha256',
        'b'.repeat(64),
        '--expected-manifest-sha256',
        'c'.repeat(64),
        '--expected-receipt-identity-sha256',
        'd'.repeat(64),
        '--output-root',
        '/backup',
        '--output',
        `/backup/post-v2-preimport-capture-v1-${HEAD}-release-verification.json`,
        '--release-freeze',
        `/backup/post-v2-preimport-capture-v1-${HEAD}-release-freeze.json`,
      ]),
    ).toMatchObject({ command: 'create-release-verification' })
    expect(() =>
      parseGoldImportV2CurrentBackupArguments([
        '--output-root',
        '/backup',
        '--output',
        '/backup/incomplete',
        ...evidenceArguments,
      ]),
    ).toThrow('incomplete')
  })

  it('verifies an exact directory only with the complete external expectation object', async () => {
    const temporaryRoot = await mkdtemp(resolve(await realpath(tmpdir()), 'pr97-backup-'))
    cleanup.push(temporaryRoot)
    const validDirectory = resolve(temporaryRoot, 'valid')
    const fixture = buildFixture()
    const identities = await writeBackupFixture(validDirectory, fixture)
    await expect(
      verifyGoldImportV2CurrentBackupDirectory({
        directory: validDirectory,
        expectedCurrentRuntimeBundle: fixture.runtimeBundle,
        releaseExpectations: expectationsFor(fixture),
      }),
    ).resolves.toMatchObject({ authority: { repository: { head: HEAD } } })
    await expect(
      verifyGoldImportV2CurrentBackupDirectory({
        directory: validDirectory,
        expectedCurrentRuntimeBundle: fixture.runtimeBundle,
        releaseExpectations: {} as never,
      }),
    ).rejects.toThrow()
    const verification = buildGoldImportV2CurrentBackupReleaseVerificationCandidate({
      authorityIdentitySha256: fixture.authority.authorityIdentitySha256,
      backupDirectory: resolve(
        '/Users/russellmiller/Documents/Interventional-Pulm-Education-Data-Backups',
        `post-v2-preimport-capture-v1-${HEAD}`,
      ),
      ...identities,
      releaseFreeze: buildReleaseFreeze(),
      verifiedAt: '2026-08-12T20:01:00.000Z',
    })
    expect(validateGoldImportV2CurrentBackupReleaseVerification(verification)).toEqual(verification)
    expect(releaseExpectationsFromVerification(verification)).toEqual(expectationsFor(fixture))
    expect(await readFile(resolve(validDirectory, 'backup-authority.json'), 'utf8')).toContain(HEAD)
  })

  it('rejects a protected backup payload replaced by a filesystem symlink', async () => {
    const temporaryRoot = await mkdtemp(resolve(await realpath(tmpdir()), 'pr97-symlink-'))
    cleanup.push(temporaryRoot)
    const directory = resolve(temporaryRoot, 'backup')
    const fixture = buildFixture()
    await writeBackupFixture(directory, fixture)
    const archiveName = fixture.authority.changedTrackedFiles[0]!.archiveName
    const target = resolve(temporaryRoot, 'replacement-bytes')
    await writeFile(target, 'replacement\n', { mode: 0o600 })
    await rm(resolve(directory, archiveName))
    await symlink(target, resolve(directory, archiveName))
    await expect(
      verifyGoldImportV2CurrentBackupDirectory({
        directory,
        expectedCurrentRuntimeBundle: fixture.runtimeBundle,
        releaseExpectations: expectationsFor(fixture),
      }),
    ).rejects.toThrow('canonical regular non-symlink file')
  })

  it('keeps historical PR #95 verification outside the current release verifier', async () => {
    const source = await readFile(
      resolve(
        process.cwd(),
        'scripts/literature/create-gold-import-contract-v2-forward-repair-backup.ts',
      ),
      'utf8',
    )
    expect(source).toContain('historical_pr95_only')
    expect(source).not.toContain('validateGoldImportV2CurrentBackupAuthority')
  })
})
