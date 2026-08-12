/** Capability-free source identities shared by protected V2 readers and mutation-capable operators. */
export const PROTECTED_GOLD_IMPORT_CONTRACT_V2 = {
  filename: '20260809231651_add_literature_gold_import_compensation_contract_v2.sql',
  id: '20260809231651_add_literature_gold_import_compensation_contract_v2',
  migrationName: 'add_literature_gold_import_compensation_contract_v2',
  sha256: '3f34934391b3c1ca3ff2ab96c103fe64f05fc29e7b2e0d8375dd6742401995b1',
  version: '20260809231651',
} as const

export const PROTECTED_GOLD_IMPORT_CONTRACT_V1 = {
  filename: '20260808035633_add_literature_gold_import_compensation_contract.sql',
  migrationName: 'add_literature_gold_import_compensation_contract',
  sha256: 'e846ef70a7b484460682a7ff61d579d3d6fdae3400805fa5395adc0464244528',
  version: '20260808035633',
} as const

export const PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER = {
  filename: '20260809231651_verify_literature_gold_import_compensation_contract_v2.sql',
  sha256: '2570f0885ed646247df7dd3e375b835c7591f2750bc190d63845191cd0426eeb',
} as const

export interface ProtectedMigrationLedgerEntry {
  name: string
  version: string
}
