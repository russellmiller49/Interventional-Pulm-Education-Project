import type {
  ProtectedV2ReceiptRecoveryCollectedEvidence,
  ProtectedV2ReceiptRecoveryReadOnlyEvidenceRequest,
} from './protected-gold-import-contract-v2-receipt-recovery-runtime'

/**
 * Serialized integration point for the capability-free evidence collector.
 * The hotfix integration commit must replace this fail-closed body with one
 * static import/call to the reviewed collector; no migration-capable module may
 * be imported here.
 */
export async function collectProtectedV2ReceiptRecoveryReadOnlyEvidence(
  _request: ProtectedV2ReceiptRecoveryReadOnlyEvidenceRequest,
): Promise<ProtectedV2ReceiptRecoveryCollectedEvidence> {
  void _request
  throw new Error(
    'Protected V2 receipt recovery evidence adapter is not integrated; recovery is blocked.',
  )
}
