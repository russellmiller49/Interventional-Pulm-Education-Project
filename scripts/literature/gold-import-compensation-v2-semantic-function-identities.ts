export const V2_CANONICAL_SEMANTIC_FUNCTION_CONTRACTS = {
  apply_literature_gold_import_v2: {
    resultType: 'jsonb',
    searchPath: 'pg_catalog, public, extensions',
    securityDefiner: true,
    serviceRoleExecute: true,
    volatility: 'v',
  },
  compensate_literature_gold_import_v2: {
    resultType: 'jsonb',
    searchPath: 'pg_catalog, public, extensions',
    securityDefiner: true,
    serviceRoleExecute: true,
    volatility: 'v',
  },
  enforce_literature_gold_operation_contract_v2: {
    resultType: 'trigger',
    searchPath: 'pg_catalog, public',
    securityDefiner: false,
    serviceRoleExecute: false,
    volatility: 'v',
  },
  enforce_literature_gold_review_contract_v2: {
    resultType: 'trigger',
    searchPath: 'pg_catalog, public',
    securityDefiner: false,
    serviceRoleExecute: false,
    volatility: 'v',
  },
  literature_gold_effective_state_hash_v2: {
    resultType: 'text',
    searchPath: 'pg_catalog, public, extensions',
    securityDefiner: false,
    serviceRoleExecute: true,
    volatility: 's',
  },
  literature_gold_physical_state_hash_v2: {
    resultType: 'text',
    searchPath: 'pg_catalog, public, extensions',
    securityDefiner: false,
    serviceRoleExecute: true,
    volatility: 's',
  },
  literature_gold_review_clinical_projection_v2: {
    resultType: 'jsonb',
    searchPath: 'pg_catalog, public',
    securityDefiner: false,
    serviceRoleExecute: true,
    volatility: 's',
  },
  literature_gold_review_operation_receipt_v2: {
    resultType: 'jsonb',
    searchPath: 'pg_catalog, public, extensions',
    securityDefiner: false,
    serviceRoleExecute: true,
    volatility: 's',
  },
  literature_gold_review_operation_result_v2: {
    resultType: 'jsonb',
    searchPath: 'pg_catalog, public',
    securityDefiner: false,
    serviceRoleExecute: true,
    volatility: 's',
  },
  reconcile_literature_gold_review_operation_v2: {
    resultType: 'jsonb',
    searchPath: 'pg_catalog, public, extensions',
    securityDefiner: true,
    serviceRoleExecute: true,
    volatility: 's',
  },
  validate_literature_gold_import_review_payload_v2: {
    resultType: 'void',
    searchPath: 'pg_catalog, public',
    securityDefiner: false,
    serviceRoleExecute: true,
    volatility: 's',
  },
  validate_literature_gold_operation_authorization_v2: {
    resultType: 'void',
    searchPath: 'pg_catalog, public',
    securityDefiner: false,
    serviceRoleExecute: true,
    volatility: 's',
  },
  validate_literature_gold_operation_plan_v2: {
    resultType: 'void',
    searchPath: 'pg_catalog, public',
    securityDefiner: false,
    serviceRoleExecute: true,
    volatility: 's',
  },
} as const

export const V2_CANONICAL_SEMANTIC_FUNCTION_RAW_DEFINITION_SHA256 = {
  apply_literature_gold_import_v2:
    '6764e15d5da086c96538e3932e3e6120e8009ca4592e45c8e58f55593fe405f4',
  compensate_literature_gold_import_v2:
    '11472e21305ec393d3125dc421543558d0cd3a6eadbfc9508e3f9eea232f78b6',
  enforce_literature_gold_operation_contract_v2:
    '27bddc601764b399554ef009355150cee93ced571a8c88e3875982399541611d',
  enforce_literature_gold_review_contract_v2:
    'fddfc09ee4387d4231066f1d008bc82858927b5bec3f6f2552640bd6469aa50d',
  literature_gold_effective_state_hash_v2:
    '48c8f9575366e83f1e8a3c5f48ab39a596c5814de719aee364bdc6c41893200d',
  literature_gold_physical_state_hash_v2:
    'bd127eab048d92e3af9d194003da0bb2a093dcfbd11adfa361d10c6a3445c562',
  literature_gold_review_clinical_projection_v2:
    '5c51c2974b71cff7c33bc1f75d1ae5d36b2d8defbc7473da14256391c3be7040',
  literature_gold_review_operation_receipt_v2:
    '2ff61c33ca186183dc3e924f9c4108fbcb89aa7f5a393ca7bd805dd2f579145b',
  literature_gold_review_operation_result_v2:
    '626b999666945ea7fb892bc83cd08d48d3a30655535e03884279c3ca4bdde598',
  reconcile_literature_gold_review_operation_v2:
    'f5b7a30fd1db8ccf23e6f3a6b38ab723b6491d949c2f8d58c3e1003de054d101',
  validate_literature_gold_import_review_payload_v2:
    '1f8f0d7520107eeb34822291be6cfebcc3c5c48534e997f3f9a3ae4a90c839a7',
  validate_literature_gold_operation_authorization_v2:
    '3413b9c9ddbd3ff5eae74f5a3a24e0692f928693acf8423152d37a234be3eeb7',
  validate_literature_gold_operation_plan_v2:
    '1280125d16d699d439c87b65fceec63be567d1c5f5185a62066645287624bb93',
} as const
