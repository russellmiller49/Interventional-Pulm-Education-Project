/** Immutable V2 contract identities safe for read-only audit and recovery import closures. */
export const GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2 =
  'gold-review-import-compensation/2.0.0' as const
export const GOLD_REVIEW_IMPORT_COMPENSATION_MIGRATION_ID_V2 =
  '20260809231651_add_literature_gold_import_compensation_contract_v2' as const

export const GOLD_REVIEW_IMPORT_V2_RPC_NAMES = Object.freeze({
  compensation: 'compensate_literature_gold_import_v2',
  effectiveStateHash: 'literature_gold_effective_state_hash_v2',
  import: 'apply_literature_gold_import_v2',
  physicalStateHash: 'literature_gold_physical_state_hash_v2',
  reconciliation: 'reconcile_literature_gold_review_operation_v2',
} as const)

/** Exact PostgreSQL-normalized identities from the reviewed V2 migration. */
export const GOLD_REVIEW_IMPORT_COMPENSATION_V2_FUNCTION_IDENTITIES = Object.freeze({
  apply_literature_gold_import_v2: {
    definitionSha256: 'ee8afd7fec37316f54a5e17b9171fd3d7c325660da8f0b612acabef9ec36e1ef',
    identityArguments:
      'p_operation_id uuid, p_idempotency_key text, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_plan jsonb, p_authorization_sha256 text, p_authorization jsonb, p_actor_user_id uuid, p_actor_email text',
  },
  compensate_literature_gold_import_v2: {
    definitionSha256: 'db994a5f4fcce482cdbe9d0679c634d64ffb21664db924cecb9e542a358872b1',
    identityArguments:
      'p_operation_id uuid, p_target_import_operation_id uuid, p_idempotency_key text, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_plan jsonb, p_authorization_sha256 text, p_authorization jsonb, p_actor_user_id uuid, p_actor_email text',
  },
  enforce_literature_gold_operation_contract_v2: {
    definitionSha256: '062cdf66860e7ef9515de2d3272d3ce49b6e3499f56a1adec5762b91b0134b3a',
    identityArguments: '',
  },
  enforce_literature_gold_review_contract_v2: {
    definitionSha256: '88749aaef0e20e410d72d8ce6df7e2476167487bee2639194514381c5716a6ff',
    identityArguments: '',
  },
  literature_gold_effective_state_hash_v2: {
    definitionSha256: '7d7103a49cbae8d513090fb6d978bc3757b836ceeaaac47e48f21bd1b0d5c32f',
    identityArguments: 'p_batch_id uuid, p_split text',
  },
  literature_gold_physical_state_hash_v2: {
    definitionSha256: '661d73189a08c73805a8eec514de6470fec35b6eb887950e7c3f10b4c1169ffa',
    identityArguments: 'p_batch_id uuid, p_split text',
  },
  literature_gold_review_clinical_projection_v2: {
    definitionSha256: '270e95e3a33dfd30056f2854a624241e71f986d02aa3e97c561b0c26b9e43f45',
    identityArguments: 'p_review_id uuid',
  },
  literature_gold_review_operation_receipt_v2: {
    definitionSha256: 'b5907694c13e698ea6feb590c39d25ceea17928d44e8255b0b484c4d6d06809b',
    identityArguments: 'p_operation_id uuid, p_idempotent boolean',
  },
  literature_gold_review_operation_result_v2: {
    definitionSha256: '07807f64c506319191f2a9232d46eb1e9726db3b6da414580d3222189e3d618c',
    identityArguments: 'p_operation_id uuid, p_idempotent boolean',
  },
  reconcile_literature_gold_review_operation_v2: {
    definitionSha256: '86a1776e9863b84c96150f2a62b3977550224838128eeec491a0deb48304d59a',
    identityArguments:
      'p_operation_id uuid, p_recovery_authorization_sha256 text, p_recovery_authorization jsonb',
  },
  validate_literature_gold_import_review_payload_v2: {
    definitionSha256: '8b5aa41b957f03c08307d7b44bd11266e9815c9c789f7238ab49684b7e65fedb',
    identityArguments: 'p_item_id uuid, p_review jsonb, p_expected_first_effective boolean',
  },
  validate_literature_gold_operation_authorization_v2: {
    definitionSha256: '82e776c72274f6052db118c89b5aa163dcd59140279188826285b3d045e12aa1',
    identityArguments:
      'p_authorization jsonb, p_authorization_sha256 text, p_kind text, p_operation_id uuid, p_target_import_operation_id uuid, p_batch_id uuid, p_plan_sha256 text, p_idempotency_key text, p_artifact_sha256 text, p_plan jsonb',
  },
  validate_literature_gold_operation_plan_v2: {
    definitionSha256: '0450c5071d31728d3b53f8e8e2741e63b64ddea55a1677aec877ae7f03288104',
    identityArguments:
      'p_plan jsonb, p_kind text, p_operation_id uuid, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_idempotency_key text',
  },
} as const)
