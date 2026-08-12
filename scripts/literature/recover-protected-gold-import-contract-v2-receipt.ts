import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

import { collectProtectedV2ReceiptRecoveryReadOnlyEvidence } from './protected-gold-import-contract-v2-receipt-recovery-read-only-adapter'
import { runProtectedV2ReceiptRecoveryCommand } from './protected-gold-import-contract-v2-receipt-recovery-runtime'

export async function runProtectedV2ReceiptRecoveryCli(arguments_: readonly string[]) {
  return runProtectedV2ReceiptRecoveryCommand(arguments_, {
    collectReadOnlyEvidence: collectProtectedV2ReceiptRecoveryReadOnlyEvidence,
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void runProtectedV2ReceiptRecoveryCli(process.argv.slice(2))
    .then((result) => {
      console.log(JSON.stringify(result, null, 2))
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
}
