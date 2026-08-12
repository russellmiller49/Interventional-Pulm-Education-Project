/** @jest-environment node */

import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import { canonicalJson } from '../../src/features/literature/gold-set/import-compensation'
import {
  GOLD_IMPORT_V2_CURRENT_BACKUP_BRANCH,
  GOLD_IMPORT_V2_CURRENT_BACKUP_EVIDENCE_NAMES,
  GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE,
  GOLD_IMPORT_V2_CURRENT_BACKUP_RECEIPT_SCHEMA_VERSION,
  buildGoldImportV2CurrentBackupAuthority,
  parseGoldImportV2CurrentBackupArguments,
  validateGoldImportV2CurrentBackupAuthority,
  verifyGoldImportV2CurrentBackupDirectory,
} from './create-gold-import-v2-postmigration-backup'
import {
  GOLD_IMPORT_V2_PREIMPORT_RUNTIME_REQUIRED_FILES,
  buildGoldImportV2PreimportRuntimeBundle,
} from './gold-import-v2-preimport-capture'

const HEAD = '1234567890abcdef1234567890abcdef12345678'
const CHANGED_PATHS = ['scripts/literature/reviewed-change.ts'] as const

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

function buildFixture(paths?: readonly string[]) {
  const runtime = runtimeInputs(paths)
  const runtimeBundle = buildGoldImportV2PreimportRuntimeBundle(runtime)
  const built = buildGoldImportV2CurrentBackupAuthority({
    changedTrackedFiles: CHANGED_PATHS.map((path) => ({
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
  return { ...built, runtimeBundle }
}

function validateFixture(fixture = buildFixture()) {
  return validateGoldImportV2CurrentBackupAuthority({
    authority: fixture.authority,
    expectedChangedPaths: CHANGED_PATHS,
    expectedCurrentRuntimeBundle: fixture.runtimeBundle,
    payloadFiles: fixture.payloadFiles,
  })
}

async function writeBackupFixture(directory: string, fixture = buildFixture()): Promise<void> {
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
  files.set('backup-manifest.json', canonicalPretty(manifest))
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
  files.set(
    'backup-receipt.json',
    canonicalPretty({
      ...receiptBody,
      receiptIdentitySha256: sha256(canonicalJson(receiptBody)),
    }),
  )
  await Promise.all(
    [...files].map(([name, bytes]) => writeFile(resolve(directory, name), bytes, { mode: 0o600 })),
  )
}

describe('current PR #97 postmigration delivery backup', () => {
  const cleanup: string[] = []

  afterEach(async () => {
    await Promise.all(cleanup.splice(0).map((directory) => rm(directory, { recursive: true })))
  })

  it('accepts the exact current authority, runtime closure, receipt authority, and evidence set', () => {
    const result = validateFixture()
    expect(result.repository).toMatchObject({
      branch: GOLD_IMPORT_V2_CURRENT_BACKUP_BRANCH,
      head: HEAD,
      upstreamHead: HEAD,
    })
    expect(result.evidence.map(({ name }) => name).sort()).toEqual(
      [...GOLD_IMPORT_V2_CURRENT_BACKUP_EVIDENCE_NAMES].sort(),
    )
  })

  it('parses only one complete exact evidence inventory', () => {
    const evidenceArguments = GOLD_IMPORT_V2_CURRENT_BACKUP_EVIDENCE_NAMES.flatMap((name) => [
      '--evidence',
      `${name}=/evidence/${name}.md`,
    ])
    expect(
      parseGoldImportV2CurrentBackupArguments([
        '--output-root',
        '/backup',
        '--output',
        `/backup/post-v2-preimport-capture-v1-${HEAD}`,
        ...evidenceArguments,
      ]).evidence,
    ).toHaveLength(GOLD_IMPORT_V2_CURRENT_BACKUP_EVIDENCE_NAMES.length)
    expect(() =>
      parseGoldImportV2CurrentBackupArguments([
        '--output-root',
        '/backup',
        '--output',
        '/backup/incomplete',
      ]),
    ).toThrow('incomplete')
  })

  it('rejects PR #95 backup and runtime authority in the current path', () => {
    const fixture = buildFixture()
    expect(() =>
      validateGoldImportV2CurrentBackupAuthority({
        ...{
          authority: {
            ...fixture.authority,
            schemaVersion: 'gold-import-contract-v2-forward-repair-backup/2.0.0',
          },
          expectedCurrentRuntimeBundle: fixture.runtimeBundle,
          payloadFiles: fixture.payloadFiles,
        },
      }),
    ).toThrow()

    const historicalRuntime = runtimeInputs(
      GOLD_IMPORT_V2_PREIMPORT_RUNTIME_REQUIRED_FILES.filter(
        (path) => path !== 'scripts/literature/create-gold-import-v2-postmigration-backup.ts',
      ).concat('scripts/literature/create-gold-import-contract-v2-forward-repair-backup.ts'),
    )
    expect(() =>
      validateGoldImportV2CurrentBackupAuthority({
        authority: fixture.authority,
        expectedCurrentRuntimeBundle: buildGoldImportV2PreimportRuntimeBundle(historicalRuntime),
        payloadFiles: fixture.payloadFiles,
      }),
    ).toThrow('exact current PR #97 runtime closure')
  })

  it('rejects stale finalized-receipt authority and an unpushed authority', () => {
    const fixture = buildFixture()
    expect(() =>
      validateGoldImportV2CurrentBackupAuthority({
        authority: {
          ...fixture.authority,
          finalizedReceiptAuthorityIdentitySha256: '0'.repeat(64),
        },
        expectedCurrentRuntimeBundle: fixture.runtimeBundle,
        payloadFiles: fixture.payloadFiles,
      }),
    ).toThrow()
    expect(() =>
      validateGoldImportV2CurrentBackupAuthority({
        authority: {
          ...fixture.authority,
          repository: { ...fixture.authority.repository, upstreamHead: 'f'.repeat(40) },
        },
        expectedCurrentRuntimeBundle: fixture.runtimeBundle,
        payloadFiles: fixture.payloadFiles,
      }),
    ).toThrow()
  })

  it('rejects a missing new readiness source and unexpected or modified protected bytes', () => {
    const missing = buildFixture(
      GOLD_IMPORT_V2_PREIMPORT_RUNTIME_REQUIRED_FILES.filter(
        (path) => path !== 'scripts/literature/gold-import-v2-fixed-local-target.ts',
      ),
    )
    expect(() => validateFixture(missing)).toThrow('omits a current capture/readiness source')

    const fixture = buildFixture()
    const unexpected = new Map(fixture.payloadFiles)
    unexpected.set('unexpected-protected-source.ts', Buffer.from('unexpected'))
    expect(() =>
      validateGoldImportV2CurrentBackupAuthority({
        authority: fixture.authority,
        expectedCurrentRuntimeBundle: fixture.runtimeBundle,
        payloadFiles: unexpected,
      }),
    ).toThrow('missing or unexpected protected source')

    const modified = new Map(fixture.payloadFiles)
    modified.set(fixture.authority.runtimeSources[0]!.archiveName, Buffer.from('modified'))
    expect(() =>
      validateGoldImportV2CurrentBackupAuthority({
        authority: fixture.authority,
        expectedCurrentRuntimeBundle: fixture.runtimeBundle,
        payloadFiles: modified,
      }),
    ).toThrow('changed')
  })

  it('verifies the complete canonical backup and rejects a partial or unexpected directory', async () => {
    const temporaryRoot = await mkdtemp(resolve(await realpath(tmpdir()), 'pr97-backup-'))
    cleanup.push(temporaryRoot)
    const validDirectory = resolve(temporaryRoot, 'valid')
    const fixture = buildFixture()
    await writeBackupFixture(validDirectory, fixture)
    await expect(
      verifyGoldImportV2CurrentBackupDirectory({
        directory: validDirectory,
        expectedChangedPaths: CHANGED_PATHS,
        expectedCurrentRuntimeBundle: fixture.runtimeBundle,
      }),
    ).resolves.toMatchObject({ authority: { repository: { head: HEAD } } })
    await writeFile(resolve(validDirectory, 'unexpected.txt'), 'unexpected', 'utf8')
    await expect(
      verifyGoldImportV2CurrentBackupDirectory({
        directory: validDirectory,
        expectedCurrentRuntimeBundle: fixture.runtimeBundle,
      }),
    ).rejects.toThrow('missing or unexpected file')
  })
})
