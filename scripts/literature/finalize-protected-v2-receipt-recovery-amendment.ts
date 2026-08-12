import { lstat, readFile, realpath, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_POLICY_IDENTITY_SHA256 } from './literature-gold-v2-schema-only-transition'
import {
  PROTECTED_V2_RECEIPT_RECOVERY_COMMITTED_AMENDMENT_PATH,
  PROTECTED_V2_RECEIPT_RECOVERY_INCIDENT_AUTHORITY_PATH,
  buildProtectedV2ReceiptRecoveryAmendmentFromAuthority,
} from './protected-gold-import-contract-v2-receipt-recovery-authority'
import { canonicalProtectedV2ReceiptRecoveryJson } from './protected-gold-import-contract-v2-receipt-recovery-amendment'
import { buildCurrentProtectedV2ReceiptRecoveryToolBundle } from './protected-gold-import-contract-v2-receipt-recovery-tool-bundle'

const SHA256_PATTERN = /^[a-f0-9]{64}$/u

export const PROTECTED_V2_RECEIPT_RECOVERY_AMENDMENT_FINALIZER_USAGE = `Usage:
  tsx scripts/literature/finalize-protected-v2-receipt-recovery-amendment.ts --print-candidate
  tsx scripts/literature/finalize-protected-v2-receipt-recovery-amendment.ts \\
    --write --expected-amendment-sha256 <exact-candidate-sha256>

Run --print-candidate after all recovery-tool and package-script integration is final. Review the
complete bundle and amendment, then use its exact amendmentIdentitySha256 for the create-only
--write operation. This command never accesses a database or application output.
` as const

export type ProtectedV2ReceiptRecoveryAmendmentFinalizerArguments =
  | { mode: 'print' }
  | { expectedAmendmentIdentitySha256: string; mode: 'write' }
  | { mode: 'help' }

export function parseProtectedV2ReceiptRecoveryAmendmentFinalizerArguments(
  arguments_: readonly string[],
): ProtectedV2ReceiptRecoveryAmendmentFinalizerArguments {
  if (arguments_.length === 1 && arguments_[0] === '--help') return { mode: 'help' }
  if (arguments_.length === 1 && arguments_[0] === '--print-candidate') return { mode: 'print' }
  if (
    arguments_.length === 3 &&
    arguments_[0] === '--write' &&
    arguments_[1] === '--expected-amendment-sha256' &&
    SHA256_PATTERN.test(arguments_[2] ?? '')
  ) {
    return { expectedAmendmentIdentitySha256: arguments_[2]!, mode: 'write' }
  }
  throw new Error('Amendment finalizer arguments are invalid; use --help.')
}

export async function runProtectedV2ReceiptRecoveryAmendmentFinalizer(
  arguments_: readonly string[],
  options: { cwd?: string } = {},
): Promise<
  | { help: typeof PROTECTED_V2_RECEIPT_RECOVERY_AMENDMENT_FINALIZER_USAGE }
  | {
      amendmentIdentitySha256: string
      bytes: string
      currentRecoveryToolBundleSha256: string
      outputPath: string
      wrote: boolean
    }
> {
  const parsed = parseProtectedV2ReceiptRecoveryAmendmentFinalizerArguments(arguments_)
  if (parsed.mode === 'help') {
    return { help: PROTECTED_V2_RECEIPT_RECOVERY_AMENDMENT_FINALIZER_USAGE }
  }
  const cwd = await realpath(resolve(options.cwd ?? process.cwd()))
  const authorityPath = resolve(cwd, PROTECTED_V2_RECEIPT_RECOVERY_INCIDENT_AUTHORITY_PATH)
  if ((await realpath(authorityPath)) !== authorityPath) {
    throw new Error('Incident authority path is not canonical.')
  }
  const authorityBytes = await readFile(authorityPath, 'utf8')
  const bundle = await buildCurrentProtectedV2ReceiptRecoveryToolBundle({ cwd })
  const { amendment } = buildProtectedV2ReceiptRecoveryAmendmentFromAuthority({
    authorityBytes,
    correctedRecoveryToolBundle: bundle,
    correctedTransitionPolicyIdentitySha256:
      LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_POLICY_IDENTITY_SHA256,
  })
  const bytes = canonicalProtectedV2ReceiptRecoveryJson(amendment)
  const outputPath = resolve(cwd, PROTECTED_V2_RECEIPT_RECOVERY_COMMITTED_AMENDMENT_PATH)
  if (parsed.mode === 'print') {
    return {
      amendmentIdentitySha256: amendment.amendmentIdentitySha256,
      bytes,
      currentRecoveryToolBundleSha256: bundle.aggregateSha256,
      outputPath,
      wrote: false,
    }
  }
  if (parsed.expectedAmendmentIdentitySha256 !== amendment.amendmentIdentitySha256) {
    throw new Error('Externally reviewed amendment identity does not match the final candidate.')
  }
  try {
    await lstat(outputPath)
    throw new Error('Committed amendment already exists; create-only finalization refused.')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  await writeFile(outputPath, bytes, { flag: 'wx', mode: 0o600 })
  return {
    amendmentIdentitySha256: amendment.amendmentIdentitySha256,
    bytes,
    currentRecoveryToolBundleSha256: bundle.aggregateSha256,
    outputPath,
    wrote: true,
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void runProtectedV2ReceiptRecoveryAmendmentFinalizer(process.argv.slice(2))
    .then((result) => {
      console.log(JSON.stringify(result, null, 2))
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
}
