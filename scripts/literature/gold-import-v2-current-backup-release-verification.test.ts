/** @jest-environment node */

import { resolve } from 'node:path'

import {
  GOLD_IMPORT_V2_CURRENT_BACKUP_BRANCH,
  GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE,
  GOLD_IMPORT_V2_CURRENT_BACKUP_REPOSITORY,
  GOLD_IMPORT_V2_CURRENT_BACKUP_ROOT,
  buildGoldImportV2CurrentBackupReleaseFreeze,
  buildGoldImportV2CurrentBackupReleaseVerificationCandidate,
  parseGoldImportV2CurrentBackupArguments,
  releaseExpectationsFromVerification,
  validateGoldImportV2CurrentBackupReleaseVerification,
} from './create-gold-import-v2-postmigration-backup'

const FROZEN_HEAD = '1234567890abcdef1234567890abcdef12345678'
const AUTHORITY_IDENTITY = 'a'.repeat(64)
const CHECKSUM_IDENTITY = 'b'.repeat(64)
const MANIFEST_IDENTITY = 'c'.repeat(64)
const RECEIPT_IDENTITY = 'd'.repeat(64)
const CHANGED_PATHS = [
  { path: 'docs/ip-literature/release-boundary.md', status: 'M' as const },
  { path: 'scripts/literature/release-boundary.test.ts', status: 'A' as const },
]

function releaseFreeze() {
  return buildGoldImportV2CurrentBackupReleaseFreeze({
    branch: GOLD_IMPORT_V2_CURRENT_BACKUP_BRANCH,
    changedPaths: CHANGED_PATHS,
    createdAt: '2026-08-12T20:00:00.000Z',
    frozenBase: GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE,
    frozenHead: FROZEN_HEAD,
    repository: GOLD_IMPORT_V2_CURRENT_BACKUP_REPOSITORY,
  })
}

function releaseVerification() {
  return buildGoldImportV2CurrentBackupReleaseVerificationCandidate({
    authorityIdentitySha256: AUTHORITY_IDENTITY,
    backupDirectory: resolve(
      GOLD_IMPORT_V2_CURRENT_BACKUP_ROOT,
      `post-v2-preimport-capture-v1-${FROZEN_HEAD}`,
    ),
    checksumManifestSha256: CHECKSUM_IDENTITY,
    manifestSha256: MANIFEST_IDENTITY,
    receiptIdentitySha256: RECEIPT_IDENTITY,
    releaseFreeze: releaseFreeze(),
    verifiedAt: '2026-08-12T20:01:00.000Z',
  })
}

describe('current PR #97 external release verification', () => {
  it('carries all five external authority expectations outside canonical backup content', () => {
    const verification = releaseVerification()
    expect(validateGoldImportV2CurrentBackupReleaseVerification(verification)).toEqual(verification)
    expect(releaseExpectationsFromVerification(verification)).toEqual({
      expectedAuthorityIdentitySha256: AUTHORITY_IDENTITY,
      expectedBase: GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE,
      expectedBranch: GOLD_IMPORT_V2_CURRENT_BACKUP_BRANCH,
      expectedChangedPaths: CHANGED_PATHS.map(({ path }) => path),
      expectedHead: FROZEN_HEAD,
    })
  })

  it('rejects a changed verification self-identity and a non-successor backup path', () => {
    const verification = releaseVerification()
    expect(() =>
      validateGoldImportV2CurrentBackupReleaseVerification({
        ...verification,
        releaseVerificationIdentitySha256: 'f'.repeat(64),
      }),
    ).toThrow('release-verification identity')
    expect(() =>
      buildGoldImportV2CurrentBackupReleaseVerificationCandidate({
        authorityIdentitySha256: AUTHORITY_IDENTITY,
        backupDirectory: resolve(GOLD_IMPORT_V2_CURRENT_BACKUP_ROOT, 'wrong-backup'),
        checksumManifestSha256: CHECKSUM_IDENTITY,
        manifestSha256: MANIFEST_IDENTITY,
        receiptIdentitySha256: RECEIPT_IDENTITY,
        releaseFreeze: releaseFreeze(),
        verifiedAt: '2026-08-12T20:01:00.000Z',
      }),
    ).toThrow('wrong successor backup path')
  })

  it('requires every independently supplied backup identity at the CLI boundary', () => {
    const fullArguments = [
      'create-release-verification',
      '--expected-authority-identity-sha256',
      AUTHORITY_IDENTITY,
      '--expected-checksum-manifest-sha256',
      CHECKSUM_IDENTITY,
      '--expected-manifest-sha256',
      MANIFEST_IDENTITY,
      '--expected-receipt-identity-sha256',
      RECEIPT_IDENTITY,
      '--output-root',
      GOLD_IMPORT_V2_CURRENT_BACKUP_ROOT,
      '--output',
      resolve(
        GOLD_IMPORT_V2_CURRENT_BACKUP_ROOT,
        `post-v2-preimport-capture-v1-${FROZEN_HEAD}-release-verification.json`,
      ),
      '--release-freeze',
      resolve(
        GOLD_IMPORT_V2_CURRENT_BACKUP_ROOT,
        `post-v2-preimport-capture-v1-${FROZEN_HEAD}-release-freeze.json`,
      ),
    ]
    expect(parseGoldImportV2CurrentBackupArguments(fullArguments)).toMatchObject({
      command: 'create-release-verification',
      expectedAuthorityIdentitySha256: AUTHORITY_IDENTITY,
    })
    for (const option of [
      '--expected-authority-identity-sha256',
      '--expected-checksum-manifest-sha256',
      '--expected-manifest-sha256',
      '--expected-receipt-identity-sha256',
    ]) {
      const index = fullArguments.indexOf(option)
      const incomplete = [...fullArguments.slice(0, index), ...fullArguments.slice(index + 2)]
      expect(() => parseGoldImportV2CurrentBackupArguments(incomplete)).toThrow('incomplete')
    }
  })

  it('keeps the verification identity external instead of adding final-head source constants', () => {
    const verification = releaseVerification()
    expect(verification.releaseVerificationIdentitySha256).toMatch(/^[a-f0-9]{64}$/u)
    expect(verification.backup.authorityIdentitySha256).toBe(AUTHORITY_IDENTITY)
    expect(JSON.stringify(verification.releaseFreeze)).not.toContain(AUTHORITY_IDENTITY)
  })
})
