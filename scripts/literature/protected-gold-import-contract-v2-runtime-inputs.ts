import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, join as joinPath, relative, resolve, sep } from 'node:path'

import ts from 'typescript'

import { canonicalJson } from './gold-import-compensation-migration-operations'
import {
  isSafeProtectedV2RepositoryPath,
  loadProtectedV2PackageInventory,
} from './protected-gold-import-contract-v2-module-resolution'

export const PROTECTED_V2_RUNTIME_INPUT_DECLARATION_SCHEMA_VERSION =
  'literature-gold-protected-v2-runtime-input-declaration/1.0.0' as const
export const PROTECTED_V2_RUNTIME_INPUT_AUDIT_SCHEMA_VERSION =
  'literature-gold-protected-v2-runtime-input-audit/1.0.0' as const

export const PROTECTED_V2_PROTECTED_DIRECTORIES = [
  'scripts/literature',
  'src/features/literature/gold-set',
] as const

export const PROTECTED_V2_ORDINARY_MIGRATION_INPUTS = [
  'supabase/migrations/20260727032621_add_literature_explorer.sql',
  'supabase/migrations/20260727164510_add_literature_gold_set.sql',
  'supabase/migrations/20260727190000_add_literature_gold_review_categories.sql',
  'supabase/migrations/20260727193432_add_literature_full_text_categorization_flag.sql',
  'supabase/migrations/20260728170939_add_interactive_clinical_case_publication_status.sql',
  'supabase/migrations/20260728171212_add_immune_inflammatory_disease_tag.sql',
  'supabase/migrations/20260728174726_add_safety_complication_prevention_clinical_purpose.sql',
  'supabase/migrations/20260730194025_add_literature_gold_test_unlock.sql',
  'supabase/migrations/20260808035633_add_literature_gold_import_compensation_contract.sql',
] as const

export const PROTECTED_V2_EXPLICIT_RUNTIME_ROOTS = [
  '.nvmrc',
  'package-lock.json',
  'package.json',
  'scripts/require-primary-checkout.mjs',
  'supabase/config.toml',
  ...PROTECTED_V2_ORDINARY_MIGRATION_INPUTS,
  'supabase/migrations/20260809231651_add_literature_gold_import_compensation_contract_v2.sql',
  'supabase/verification/20260808035633_verify_literature_gold_import_compensation_contract.sql',
  'supabase/verification/20260809231651_verify_literature_gold_import_compensation_contract_v2.sql',
  'tsconfig.json',
] as const

export interface ProtectedV2PackageScriptDeclaration {
  arguments: readonly string[]
  entryPoint: string
  name: string
  requiresPrimaryCheckout: boolean
}

export const PROTECTED_V2_PACKAGE_SCRIPT_DECLARATIONS = [
  {
    arguments: [],
    entryPoint: 'scripts/literature/capture-gold-import-v2-preimport-state.ts',
    name: 'literature:capture-gold-import-v2-preimport-state',
    requiresPrimaryCheckout: true,
  },
  {
    arguments: [],
    entryPoint: 'scripts/literature/generate-gold-import-compensation-package-v2.ts',
    name: 'literature:generate-gold-import-compensation-package-v2',
    requiresPrimaryCheckout: true,
  },
  {
    arguments: [],
    entryPoint: 'scripts/literature/rehearse-exact-gold-import-compensation-package-v2.ts',
    name: 'literature:rehearse-exact-gold-import-compensation-package-v2',
    requiresPrimaryCheckout: true,
  },
  {
    arguments: [],
    entryPoint: 'scripts/literature/apply-protected-gold-import-contract-v2.ts',
    name: 'literature:apply-protected-gold-import-contract-v2',
    requiresPrimaryCheckout: true,
  },
  {
    arguments: [],
    entryPoint: 'scripts/literature/recover-protected-gold-import-contract-v2-receipt.ts',
    name: 'literature:recover-protected-gold-import-contract-v2-receipt',
    requiresPrimaryCheckout: true,
  },
  {
    arguments: [],
    entryPoint: 'scripts/literature/audit-gold-import-compensation-v2.ts',
    name: 'literature:audit-gold-import-compensation-v2',
    requiresPrimaryCheckout: false,
  },
  {
    arguments: [],
    entryPoint: 'scripts/literature/create-gold-import-v2-postmigration-backup.ts',
    name: 'literature:backup-gold-import-v2-postmigration-delivery',
    requiresPrimaryCheckout: false,
  },
  ...(['prepare', 'start', 'status', 'reset', 'stop'] as const).map((command) => ({
    arguments: [command],
    entryPoint: 'scripts/literature/local-supabase.ts',
    name: `literature:local:${command}`,
    requiresPrimaryCheckout: command !== 'status',
  })),
] satisfies readonly ProtectedV2PackageScriptDeclaration[]

export const PROTECTED_V2_RUNTIME_ENTRY_POINTS = [
  'scripts/literature/apply-protected-gold-import-contract-v2.ts',
  'scripts/literature/audit-gold-import-compensation-v2.ts',
  'scripts/literature/capture-gold-import-v2-preimport-state.ts',
  'scripts/literature/create-gold-import-v2-postmigration-backup.ts',
  'scripts/literature/generate-gold-import-compensation-package-v2.ts',
  'scripts/literature/local-supabase.ts',
  'scripts/literature/recover-protected-gold-import-contract-v2-receipt.ts',
  'scripts/literature/rehearse-exact-gold-import-compensation-package-v2.ts',
  'scripts/require-primary-checkout.mjs',
] as const

export type ProtectedV2RuntimeCallSiteDisposition =
  | 'generated_local_state'
  | 'lock_bound_executable'
  | 'operator_evidence'
  | 'repository_entry_point'
  | 'repository_input'
  | 'repository_metadata'
  | 'system_executable'
  | 'tracked_repository_inventory'

const PROTECTED_V2_RUNTIME_CALL_SITE_DISPOSITIONS = new Set<ProtectedV2RuntimeCallSiteDisposition>([
  'generated_local_state',
  'lock_bound_executable',
  'operator_evidence',
  'repository_entry_point',
  'repository_input',
  'repository_metadata',
  'system_executable',
  'tracked_repository_inventory',
])

export interface ProtectedV2RuntimeCallSiteDeclaration {
  api: string
  disposition: ProtectedV2RuntimeCallSiteDisposition
  executables: readonly string[]
  fingerprint: string
  packages: readonly string[]
  repositoryInputs: readonly string[]
  sourcePath: string
}

function declareRuntimeCallSites(input: {
  api: string
  disposition: ProtectedV2RuntimeCallSiteDisposition
  executables?: readonly string[]
  fingerprints: readonly string[]
  packages?: readonly string[]
  repositoryInputs?: readonly string[]
  sourcePath: string
}): ProtectedV2RuntimeCallSiteDeclaration[] {
  return input.fingerprints.map((fingerprint) => ({
    api: input.api,
    disposition: input.disposition,
    executables: input.executables ?? [],
    fingerprint,
    packages: input.packages ?? [],
    repositoryInputs: input.repositoryInputs ?? [],
    sourcePath: input.sourcePath,
  }))
}

/**
 * Exact declarations for nonliteral runtime-input call sites. The fingerprints
 * bind the source path, API, and exact call expression. A new or changed call
 * site therefore fails until it receives a narrow, reviewed disposition.
 */
export const PROTECTED_V2_RUNTIME_CALL_SITE_DECLARATIONS = [
  ...declareRuntimeCallSites({
    api: 'fs.lstat',
    disposition: 'operator_evidence',
    fingerprints: [
      'a49c591b0055b19681b8a78688a583c850707de5dee74960bdaabe0a3395a455',
      '2ebf746e677bdae357e13e349a7dea6601bbbf0592995f1468343cfa4cf2409f',
      'c5364bcf232ba86b88a1997daecbdac2385fca40a0f0290d85a100fd5a94285d',
      '1baedeb2118442d11ead1fe94ab8c2a4bc2596552de4c3da165219cdb849a641',
    ],
    sourcePath: 'scripts/literature/generate-gold-import-compensation-package-v1.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'operator_evidence',
    fingerprints: [
      '6684dfad2cc5785f82889884068d38149f0a9c48d6a087c2d2114d9b6baa8fcc',
      'c450d9a2b6fef1b39754e8955a099b0c524e6bf2749251dd241aa3bb416dfcb2',
      '0b1941970fba95ef5d0b19d5190845247f70a096da37a1264a5db2118357b435',
      '4be1b9a7bbaffec02c571f51df8ac50a775d8644d3f594a666baf28fbbbad2ac',
      '76bd41d13bbc1c66ff7e9df4afd6fa78eb93e893a3fd54e8ffdce60bd81fbe58',
      'a4550a4ed158785779a815fbe6a831ee255be99de196691c889fcb06e80ea6a7',
    ],
    sourcePath: 'scripts/literature/generate-gold-import-compensation-package-v1.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.realpath',
    disposition: 'operator_evidence',
    fingerprints: [
      '3f705e26f95ffd448a7fba0c0ee79140cc087656926a6a1dd95dc6fbb6adceff',
      '03f341317ecf5e2287a2a262495d80372d32ab901cf21dd19b9a257a3b19da64',
    ],
    sourcePath: 'scripts/literature/generate-gold-import-compensation-package-v1.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.lstat',
    disposition: 'operator_evidence',
    fingerprints: ['e78351621e9c6777efc214fd706aac093f50f8c110a28a77d746b2ae640d6d1c'],
    sourcePath: 'scripts/literature/rehearse-exact-gold-import-compensation-package-v1.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'repository_input',
    fingerprints: ['c372a705b4d4e18cc65ceb5031339dc219b62b18997b8150654e0439aeefb373'],
    repositoryInputs: [
      'supabase/migrations/20260808035633_add_literature_gold_import_compensation_contract.sql',
    ],
    sourcePath: 'scripts/literature/rehearse-exact-gold-import-compensation-package-v1.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'repository_input',
    fingerprints: ['54979735b46de37af29985a0b24ac2a0f47a61c3cb1b83be47d6fd3465532b32'],
    repositoryInputs: [
      'supabase/verification/20260808035633_verify_literature_gold_import_compensation_contract.sql',
    ],
    sourcePath: 'scripts/literature/rehearse-exact-gold-import-compensation-package-v1.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'repository_input',
    fingerprints: ['4fb105e5e21f2622cd7dc4a114410683b6ae9e57f8abc1cd0e7946ef89cd8b98'],
    repositoryInputs: [...PROTECTED_V2_ORDINARY_MIGRATION_INPUTS],
    sourcePath: 'scripts/literature/rehearse-exact-gold-import-compensation-package-v1.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'operator_evidence',
    fingerprints: [
      'be461ca242726c537e34873521adbc36d6b500028ed5e12df591340339eebfb0',
      '25b2eedabc0804b753e961cdb7b68aacf44eaf78cbef0ccde8f7c1650566aac0',
      'ac027c84b8a194649ed29afab627bb298ea9396f282132bc4348c040d270e86f',
      'ddf3c8f2c770fd023224fd29dc21fa111223521efe4767044e0a7b9cd6278031',
      '244a54f9150056810ddeb5ecb801ec7b8957c1ebe4f900327f3ae54fc44d4ad1',
    ],
    sourcePath: 'scripts/literature/rehearse-exact-gold-import-compensation-package-v1.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readdir',
    disposition: 'operator_evidence',
    fingerprints: ['df4b92076c700389cac7065ed7effcaba643d5c791c5c2fad70b23ef325adc80'],
    sourcePath: 'scripts/literature/rehearse-exact-gold-import-compensation-package-v1.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'repository_input',
    fingerprints: ['3ef0416165a2d26feb16d05a4df7b206864f5b09568640fcac7425d8f0ef2723'],
    repositoryInputs: [
      'supabase/verification/20260808035633_verify_literature_gold_import_compensation_contract.sql',
    ],
    sourcePath: 'scripts/literature/rehearse-gold-import-compensation-db-v2.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'repository_input',
    fingerprints: ['05c6364da63e1ad749067dce535d41fa8ca2df4e6fea4211d3dad6ccd02e770a'],
    repositoryInputs: [
      'supabase/verification/20260809231651_verify_literature_gold_import_compensation_contract_v2.sql',
    ],
    sourcePath: 'scripts/literature/rehearse-gold-import-compensation-db-v2.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'repository_input',
    fingerprints: ['e6d53987c5b21aa5df87e1e13d9cecf31fbb8018de3af94dbdc09b7999df18f6'],
    repositoryInputs: [
      ...PROTECTED_V2_ORDINARY_MIGRATION_INPUTS,
      'supabase/migrations/20260809231651_add_literature_gold_import_compensation_contract_v2.sql',
    ],
    sourcePath: 'scripts/literature/rehearse-gold-import-compensation-db-v2.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'repository_input',
    fingerprints: ['daf3752d0f925ee5069c8f76c74fd7b6eac16492560a033a10cb4c7f39641ca9'],
    repositoryInputs: [
      ...PROTECTED_V2_ORDINARY_MIGRATION_INPUTS,
      'supabase/verification/20260808035633_verify_literature_gold_import_compensation_contract.sql',
      'scripts/literature/rehearse-gold-import-compensation-db.ts',
      'scripts/literature/gold-import-compensation-rehearsal-evidence.ts',
    ],
    sourcePath: 'scripts/literature/rehearse-gold-import-compensation-db.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'repository_input',
    fingerprints: ['c1f48cf9166612d1d771a511f398f2dc6491a57be3230d1dbc4133802d64defa'],
    repositoryInputs: [
      'scripts/literature/fixtures/post-migration-schema-security-definition-identity.json',
    ],
    sourcePath: 'scripts/literature/gold-import-compensation-contract-expectations.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'child_process.spawn',
    disposition: 'system_executable',
    executables: ['docker'],
    fingerprints: ['7a93f99f2ed5fe8a6886d424d21c3128c22123c537448bdcf9d52ea24c026b6b'],
    sourcePath: 'scripts/literature/rehearse-exact-gold-import-compensation-package-v1.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'child_process.spawn',
    disposition: 'system_executable',
    executables: ['docker'],
    fingerprints: ['de82ff77bd0320455cbe1e23ffab54ee269630d4029e73dd9c7c526f02b6c370'],
    sourcePath: 'scripts/literature/rehearse-gold-import-compensation-db-v2.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'child_process.spawn',
    disposition: 'system_executable',
    executables: ['docker'],
    fingerprints: ['92c577d38f1d5b397fe8f9be33d4fc3315cc7ff1141ddeb22699ddf69bd041be'],
    sourcePath: 'scripts/literature/rehearse-gold-import-compensation-db.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.lstat',
    disposition: 'operator_evidence',
    fingerprints: [
      '3228011dff275435fd08e9f683e26f49662c18331f9b636e6604f713f283e4e5',
      'd82b372bf232f429a031e8c23ffdc73931ee13ead24b71c944c41e8d3fbe0b41',
    ],
    sourcePath: 'scripts/literature/rehearse-exact-gold-import-compensation-package-v2.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'operator_evidence',
    fingerprints: ['63d84e126c2ac7f50359eeeb49eb1186280b9ed8471dc4c97a6b9aa146ea2c40'],
    sourcePath: 'scripts/literature/rehearse-exact-gold-import-compensation-package-v2.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'generated_local_state',
    fingerprints: ['cdccc08819d09f43f89f1f095f6f931476fbf630bf27983f780c11b53c5c375d'],
    sourcePath: 'scripts/literature/capture-gold-import-v2-preimport-state.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.realpathSync',
    disposition: 'repository_metadata',
    fingerprints: [
      '5ac57ac36f938b109768cb6f2f850d44edc89637bc12a3bcf5f5993493816c05',
      'f45c513a8fd86198aaa01efcfa579387ac11ec282ac4d073cbb1b873abf2e51a',
      'b90941b18a8074e4989e811f6f10fcda637ba9dd2646ec1e539a6a0d2207ac61',
    ],
    sourcePath: 'scripts/literature/capture-gold-import-v2-preimport-state.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.realpathSync',
    disposition: 'repository_metadata',
    fingerprints: [
      'f014e75d2d2dc158d1b25b8d681640e3e4dda90f9651ebce765f53330edb945a',
      '1db9087402069e187f808ec40021153c318a614d6e546623fc744e8944eff5ea',
      'cfd3879cbdd42452fce4d9cf1997ce2dc969b1cdb4a9acb6b2f52ef279084d95',
    ],
    sourcePath: 'scripts/literature/generate-gold-import-compensation-package-v2.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.realpathSync',
    disposition: 'repository_metadata',
    fingerprints: [
      '7caaeecebb9ef98df079034cdfb9a58a8c2d2c0a2a36dd5c0c14f709ddd3eb8f',
      '1914a95bc82392e4c959726d2d9ec91ee3b2927354a8044329411b12065db6d7',
      '1ee7f2991678893c0745c5e374d41b652df4e2f535f629e61d1ce7368f33b961',
    ],
    sourcePath: 'scripts/literature/rehearse-exact-gold-import-compensation-package-v2.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.realpath',
    disposition: 'generated_local_state',
    fingerprints: [
      '85afd5fa274c9ffc4457ebba1c7b409c8a030794ff4af41fcbb753ba02d1e111',
      'f65e06bda441b23945b4331521b9cfef7d2668992cf104a4886be81106b87028',
    ],
    sourcePath: 'scripts/literature/capture-gold-import-v2-preimport-state.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.stat',
    disposition: 'generated_local_state',
    fingerprints: ['8c515fa12dd5ea7c4bd7dfd03324128b1493918e35b6425572210e614c4f0c52'],
    sourcePath: 'scripts/literature/capture-gold-import-v2-preimport-state.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'child_process.execFile',
    disposition: 'system_executable',
    executables: ['git'],
    fingerprints: ['1712cad04117facf592ed08d587cedd678799afb11defe9a2202a9bd6878568c'],
    sourcePath: 'scripts/literature/gold-import-v2-preimport-capture.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.lstat',
    disposition: 'operator_evidence',
    fingerprints: [
      '3d913d666fc3f16d272d00e16da49e17df4e25fcfd24eff4b125af216c907d25',
      '3f64fba876b47c75cd59850af25e6cf7f68b47433e8d804405563e19f7ec6a3c',
      'fcb6b36896a0cd97147b8dc8963d084bc858151161e40e5714a623e21ee4670f',
      '24e7d03b35f0ae03164c0773b3f40d92dfd58786195c839bde8879050a344583',
      '8633453965cc9cd2771f516797811d4f33de26bece641146eabc3d3a0bd86a9e',
    ],
    sourcePath: 'scripts/literature/gold-import-v2-preimport-capture.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.lstat',
    disposition: 'tracked_repository_inventory',
    fingerprints: [
      '9a6dca2bdadb7abb56809778c47892292bb7b6e1027cddc1188a52b750985ae7',
      '1f80e19b665db824edffb502b2becaefd46ceee2a1f951f19b3785e934c6d7d5',
    ],
    sourcePath: 'scripts/literature/gold-import-v2-preimport-capture.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'tracked_repository_inventory',
    fingerprints: [
      '1c870bf36e47ad2a4e35a3e30407857aa8bd33dfd9e9c1738674f2e7c080931d',
      'f4a81fb1a1c7449a1108d457c28ee012001d4c131ab7386d8d9aef80be5e6fc2',
    ],
    sourcePath: 'scripts/literature/gold-import-v2-preimport-capture.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'operator_evidence',
    fingerprints: [
      'aeb26183ef37db6c5fe1305c15117cc33b5d822c6153215abceff10d3bc6d424',
      'ab5dded7ae204d846ca7e42977df7c8915fb8988bc056ce85b654a6b2e638a6c',
      'dfb72322364896b2a5803a7c44eb7cb96ba9ce36b022acce9b27b4a67fb1fab1',
      '34c300c25cfd24f373060b7be7cd416278f299208a4194b8474ccf099dcf5732',
      '0e72b5b602435ecb4ea5e017d2a24c8842889d309cf53dcf6f27b5fc11fce56b',
    ],
    sourcePath: 'scripts/literature/gold-import-v2-preimport-capture.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readdir',
    disposition: 'operator_evidence',
    fingerprints: ['ac03e40f6bf78bd3a3ee431a24455e84c20d51d55a9ed930934a87dbc3590b31'],
    sourcePath: 'scripts/literature/gold-import-v2-preimport-capture.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.realpath',
    disposition: 'operator_evidence',
    fingerprints: [
      'b547d2e30aede78cc8b7258bfdf786bdef3e65e6e115abf48f70e1fb15fe8c8a',
      '99228d6a441cbbecd058ff5cd3b1ccda2978a5b2255a7cd8196d8a7a26f20582',
      '367cc437f2299e4b2bc5f0505a80505743a4bbabe86f2b118f2a4e0e87419d8f',
    ],
    sourcePath: 'scripts/literature/gold-import-v2-preimport-capture.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.realpath',
    disposition: 'repository_metadata',
    fingerprints: ['e127c360f74d785fbe728c65ea2849bd1da9ffaf488938b08aadfc51cdd62606'],
    sourcePath: 'scripts/literature/gold-import-v2-preimport-capture.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.realpath',
    disposition: 'tracked_repository_inventory',
    fingerprints: ['e7fee0efa61f7b1fd9d61e85d1fc8266482980771e13aac8fc0a6a9f68140d13'],
    sourcePath: 'scripts/literature/gold-import-v2-preimport-capture.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'child_process.execFile',
    disposition: 'system_executable',
    executables: ['git'],
    fingerprints: ['b5138bd864f6b599c8ed0c8e1029ac0a10e3781179eac323fc2ddb05cf76b10c'],
    sourcePath: 'scripts/literature/gold-import-v2-package-readiness.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.lstat',
    disposition: 'operator_evidence',
    fingerprints: [
      'ab56be613f132bbc4a61e2306c618e8777585d42381f980bd1496b9548c043ff',
      '2ca6af84836c931dda6af1a40bee47c4319941fddf8e4acdbd3b3fd14c5f0157',
      'b59373a1044248e4e9a811e5b57c2ac6e751738a8ce145c433d0d904a0b09a24',
    ],
    sourcePath: 'scripts/literature/gold-import-v2-package-readiness.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'repository_input',
    fingerprints: ['0a2185f18e94872846dbcd611da928e81a9b02e12aba4c1bab21eafc8bbd1611'],
    repositoryInputs: [
      'scripts/literature/contracts/protected-v2-receipt-recovery-amendment-v1.json',
    ],
    sourcePath: 'scripts/literature/gold-import-v2-package-readiness.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'repository_input',
    fingerprints: ['fd8e20892e675bf5ead3aa5a7889d209e86a41b15a4dc563123f4a8fe0cc036c'],
    repositoryInputs: [
      'scripts/literature/contracts/protected-v2-finalized-receipt-recovery-authority-v1.json',
    ],
    sourcePath: 'scripts/literature/gold-import-v2-package-readiness.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'repository_input',
    fingerprints: ['b00269f62957f4c5d824e2b954f7e4a1dddf94376cf9e0a400ffab826a718dd9'],
    repositoryInputs: [
      'scripts/literature/contracts/protected-v2-receipt-recovery-incident-authority-v1.json',
    ],
    sourcePath: 'scripts/literature/gold-import-v2-package-readiness.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'operator_evidence',
    fingerprints: [
      '5810f7611e1870d7880ce69aa99dff870c99423dd765021ad5afb87a4f95426d',
      'fdca2565aa2028315b7c3be5f8885f09c551263c0753d3fee7b494bf9afbfcf9',
      '6e323966de2bb396ae9525a3551cfeca6c3f03f697b51cde69f87c44a80da821',
      '53897e579bffdabbe065db8173ff27fd014fc688e20f843dda54d2f665f7a36c',
    ],
    sourcePath: 'scripts/literature/gold-import-v2-package-readiness.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readdir',
    disposition: 'operator_evidence',
    fingerprints: ['89722279d25a289ff2e24c3dc46a2b39b645ae22347efd1fc87cf69ab1f38940'],
    sourcePath: 'scripts/literature/gold-import-v2-package-readiness.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.realpath',
    disposition: 'operator_evidence',
    fingerprints: [
      'aaf79c16f15f20bd4528de1e9c0c8d05c570c768b9a4aff669001ed793ec0372',
      '14898c3ab1e736337eef08f99cbfc89e92f139305acf51ac357923973019f8c7',
      '0bf28096735368cd7e36e61436272f616198a9df9c3c6c49056550518d871968',
    ],
    sourcePath: 'scripts/literature/gold-import-v2-package-readiness.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.realpath',
    disposition: 'repository_metadata',
    fingerprints: [
      '9c22f4b9bd463cf2615c9f0b15a965a48350782fefdec9a646d98bec731edf02',
      'b1ce04bbd64768d369cdd7ac0730f590738bc727ea26fe055480f09873537bef',
    ],
    sourcePath: 'scripts/literature/gold-import-v2-package-readiness.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.lstat',
    disposition: 'operator_evidence',
    executables: [],
    fingerprints: [
      '2bcf1d3bca4aa176b72ac2cbfe5e388a92c85fbffe95298c06cf0a036eb0535a',
      '3d3fd331bcabbf4e4df9aef56df858b74551d87b692fed1f429ce14efa66f937',
      'b481924885854457f68ab7a85c4ad37a3f2ab92092ab8594a83408574c6fc4b8',
      'ac2eb284fae6fedfe113c51458c8e3e226fc0e23abaff4811fcf7fa0bccfc38c',
      '07ca384ddccb94fb0ccf2b80dc8203c962a7f6ddc3b6226f22b717283a29663a',
      '6dcf9a1ca979650ff343b02cefc907c0643b881d88bc1453dea7ecdd5ef89ac0',
    ],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/apply-protected-gold-import-contract-v2.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readdir',
    disposition: 'operator_evidence',
    executables: [],
    fingerprints: [
      'bc9f74fbcb05ffa2dce0e7ae00a6d4596fa632468afa9ea03d98069af741b797',
      'a1696b7e10769e9beecc4743dcaf694469d13a40e3d2eab81800be00c65ecbf6',
      '1aea7181d1123bfe081b9e2d78cfba4e6af4be0f216ae8d79891ea17bd9becdf',
    ],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/apply-protected-gold-import-contract-v2.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'operator_evidence',
    executables: [],
    fingerprints: [
      '73ecb80fa85feb623f0d18d6f50ca5018ee8701b55609f873f61690da0861f1c',
      '8505aae02a7a6a630f84a7736ebc005861654983089deffbe7e5417f4d512a65',
      '27a1e7cd96563e12fa5fa4b3ede4157067faefff1c3438bc62b0783af60cfc9b',
      '5236712b747668ea1e5bb3dcbdf753b89eae5124720bf9d4c727279827460c4b',
      'a75d3d49eec620c2580dc8238dcc43eab9f154394465c0f66166957c1d338529',
      '679ff0d9d43496bda0991528ecee0f611aa1b6df17f4483140d3e4f69720dbf2',
      '166ba0f04d3fdc744e59d7ef591ddd7bc210fbbdac1fcc51f1631ea5a77b9ff4',
      'befce686c57d7ee0e9af54511a3eb7ea11a36351e8afa79237f2fca4abff2805',
      '5a4b9c6b793a3700267f6e787ed3cbad5d4840a87b264fdd441fca9863f934ad',
      '0c995676602d26a4bfa4167b0e136513f7041f7bd47a19e214854b0644339d25',
      '08a21267aca7a922857bb326e8af05eca67b91a072374c9596e861521a8ab715',
    ],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/apply-protected-gold-import-contract-v2.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'repository_input',
    executables: [],
    fingerprints: ['8e6ee256c66d2a803de13c5e6094a986c4467d66663451b5d2bf1c48ad9a7caf'],
    packages: [],
    repositoryInputs: [
      'supabase/verification/20260809231651_verify_literature_gold_import_compensation_contract_v2.sql',
    ],
    sourcePath: 'scripts/literature/apply-protected-gold-import-contract-v2.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'repository_input',
    executables: [],
    fingerprints: ['caae03de50d0ac15ed64ffa72010c5115bd96c36790206803c4683161984b94c'],
    packages: [],
    repositoryInputs: [
      'supabase/migrations/20260808035633_add_literature_gold_import_compensation_contract.sql',
      'supabase/migrations/20260809231651_add_literature_gold_import_compensation_contract_v2.sql',
    ],
    sourcePath: 'scripts/literature/apply-protected-gold-import-contract-v2.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.realpath',
    disposition: 'operator_evidence',
    executables: [],
    fingerprints: [
      '8d3484313d91829d739d180e24779098a2d6165e62e0fbadde1126f2e567dd98',
      '64c455f3320d03276377b8afc61cd283eec4116f0f5e3f8b26252d5914115db8',
      'bd2b1121edd78f4fb9647be93df9936946788fa533b5d3587d7ed0162ed04fa4',
      '56b9d8ea5b432fce0f5785785ae265c18e0877edf45d4a3516f3fedb10e3f491',
      'c552b86789d0f00811aa27707e4dbd207f7d51c37b2cb27cc1b812a7194865c4',
    ],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/apply-protected-gold-import-contract-v2.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'operator_evidence',
    executables: [],
    fingerprints: ['1ad2414d06f2415561ad96104f9c71dae89added7f72c24592515a8ca1bd8a14'],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/audit-gold-import-compensation-v2.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'child_process.execFile',
    disposition: 'system_executable',
    executables: ['git'],
    fingerprints: [
      'df0e471a668e29785a6625df51cdc1bf992c38436ae77f37c05a26273bb488a6',
      'd369a94583ca236b62da4e16e03fbe3c675f1731703757069fb5c5b091de11d7',
    ],
    sourcePath: 'scripts/literature/create-gold-import-v2-postmigration-backup.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.fstatSync',
    disposition: 'generated_local_state',
    fingerprints: ['7bd82d90664766c7f954cce3d67805598eebdc0a12bc65957c2ef4f848a70aac'],
    sourcePath: 'scripts/literature/create-gold-import-v2-postmigration-backup.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.lstat',
    disposition: 'operator_evidence',
    fingerprints: [
      '3037831f0d0d1c22bab8689991bb994394b02c9abb84a589d16742cdb2cb4e39',
      'ab773e4503b53e1f701f5ab26fbcc0a094beb6e21e63b882f10fec82b2e085db',
    ],
    sourcePath: 'scripts/literature/create-gold-import-v2-postmigration-backup.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'operator_evidence',
    fingerprints: ['9f16daaae3502a48131eace86c7bb3d9109d619314d0671dce2161a4d887d066'],
    sourcePath: 'scripts/literature/create-gold-import-v2-postmigration-backup.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readdir',
    disposition: 'operator_evidence',
    fingerprints: [
      'c7b79b6137cd071126c297a9875cf3b446d9a2f7a52e157e2164bcf55cdaec10',
      '1afacdeea9d5c7568710ed4dcd26e8f6309731fd61f652fd2f4beb9b5cfc21d6',
    ],
    sourcePath: 'scripts/literature/create-gold-import-v2-postmigration-backup.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.realpath',
    disposition: 'operator_evidence',
    fingerprints: [
      '738e8a4f1fe28744dd53f222af5c3b0e6c61bf2eb6f306369d7f2e85e6ee287c',
      '8ef81688d72d9897c0ac5094e6ef28b31e7d1a353e1defe4c030de679f982e73',
      '4f2a6c54c33d8ca4724b5e8b4d4c21b6ebc8b9a7fab861425c870a6f577171b5',
      '665bd4e3ca49af68c6897cd38b9e031ef9e956ac1733563ba7a8ed03c0413036',
      '32d10f03e830cd38806be1c3a9c48bd682fd0426ddb115e850f74e1b3509d68e',
    ],
    sourcePath: 'scripts/literature/create-gold-import-v2-postmigration-backup.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.realpathSync',
    disposition: 'repository_metadata',
    fingerprints: [
      'fb7aa482d940a3aeebe8bf6dfab948f2b1572e66e8a9eb1b4726b984830ad2f0',
      '321a94827ea18c4493eec6db048905fa2ffa22ed1e08614b0f34c1c81ab4a8cb',
      'babff8aa9ccc6c58de9f32ff402739f90e5ea9c898a95b8e9a27021b23ddb684',
    ],
    sourcePath: 'scripts/literature/create-gold-import-v2-postmigration-backup.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.lstatSync',
    disposition: 'generated_local_state',
    fingerprints: ['93aabd16058c3a16ba4bcf87fd5c2052a009cba754ac9017ff028c63a0649e1b'],
    sourcePath: 'scripts/literature/create-gold-import-v2-postmigration-backup.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.openSync',
    disposition: 'generated_local_state',
    fingerprints: ['818fbe4b144bada0c84eef29fd5aee08265eddc1e27d82041064c1e2fdebfa41'],
    sourcePath: 'scripts/literature/create-gold-import-v2-postmigration-backup.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'process.chdir',
    disposition: 'generated_local_state',
    fingerprints: [
      '2e72262e4d22607a75e01ed4c7f1eff63a33fccb4da90e6adc05cec997306fc9',
      '5631206b033dcf51a921f87b6ecd21e9253338ca857832813a6617d3b383a078',
    ],
    sourcePath: 'scripts/literature/create-gold-import-v2-postmigration-backup.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.lstat',
    disposition: 'operator_evidence',
    executables: [],
    fingerprints: ['adebd41b2218dd68c7a11e7d72be73805b305c839c1902d83162cabf40a36f6b'],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/generate-gold-import-compensation-package-v2.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'operator_evidence',
    executables: [],
    fingerprints: ['67db3219501da47e1e7c76779376de5ecce17f105babcda4e49b998c4ccee15d'],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/generate-gold-import-compensation-package-v2.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'child_process.execFile',
    disposition: 'system_executable',
    executables: ['git'],
    fingerprints: ['3da21cbfb6e58d20df20b847599343f35fc6b7feed7548c290dceeda6b09fade'],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/diagnose-gold-import-compensation-v2-preapplication.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.lstat',
    disposition: 'operator_evidence',
    executables: [],
    fingerprints: ['554cd94a267e23139a2012227f278d5b672205e06335625a9e606ad90312eeab'],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/diagnose-gold-import-compensation-v2-preapplication.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'repository_input',
    executables: [],
    fingerprints: ['2dd8f0d13d3d1617e86d8d4ce8dfd354d34716c6d5c18bbaa1dd5bd91bdd7e1d'],
    packages: [],
    repositoryInputs: [
      'supabase/migrations/20260808035633_add_literature_gold_import_compensation_contract.sql',
    ],
    sourcePath: 'scripts/literature/diagnose-gold-import-compensation-v2-preapplication.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'repository_input',
    executables: [],
    fingerprints: ['b8ce312179ec9bc1b15b88b749782d2c1f149aeac34a45706a0ab0978508d598'],
    packages: [],
    repositoryInputs: [
      'supabase/migrations/20260809231651_add_literature_gold_import_compensation_contract_v2.sql',
    ],
    sourcePath: 'scripts/literature/diagnose-gold-import-compensation-v2-preapplication.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.realpath',
    disposition: 'operator_evidence',
    executables: [],
    fingerprints: [
      '8acbdd6e21a5ef885e963bee0d8f7db4212f79c85a20ce14126ca69f8d8fc697',
      'dbd12dccf0b784ef7c015fe31edd72c1a5d9b7ffbb05f0bf01560cc1de8d93c7',
    ],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/diagnose-gold-import-compensation-v2-preapplication.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'child_process.spawn',
    disposition: 'system_executable',
    executables: ['docker', 'git'],
    fingerprints: ['0b0c55ec4cddb42105f45aaf884e9d98469a6074d4bfe96a7279aac642c78593'],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/gold-import-compensation-migration-operations.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.lstat',
    disposition: 'operator_evidence',
    executables: [],
    fingerprints: [
      '331b2e35eab5f872a88b61a328ba4fc2936268e2836d46e9270ed79b613078ac',
      '91ed90d67afd31f5905b3d7046fc6b929ece5913097b8b1bcde2871659bf3b3c',
      '0e3c9a78e1a1063db8e65764172813241a94c296c71d31f6cd27a3f8bed87701',
      '9bc081f8e6c9e3044a739118085edd79437be491187a97b2a7f010bd306417d9',
      'f77b13d7e6b8fa629b4b19c1e3e7981a5628bc035a79e6e63cfae8bade873f1d',
    ],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/gold-import-compensation-migration-operations.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readdir',
    disposition: 'operator_evidence',
    executables: [],
    fingerprints: ['8aa768fb54e2a0fd76c3923f058b00440993df7d99876abd081d8f68f8c62873'],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/gold-import-compensation-migration-operations.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'operator_evidence',
    executables: [],
    fingerprints: ['6188789e677719595bbc6ddc6decbc3fda7c606e19eb6e5f2c66005b150847fc'],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/gold-import-compensation-migration-operations.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'repository_input',
    executables: [],
    fingerprints: ['deb3c499d2cc379fa76fdec573ef11f9ca792c6dcd85051ac4f3ec6c5ee1c189'],
    packages: [],
    repositoryInputs: [
      'supabase/migrations/20260808035633_add_literature_gold_import_compensation_contract.sql',
    ],
    sourcePath: 'scripts/literature/gold-import-compensation-migration-operations.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.realpath',
    disposition: 'operator_evidence',
    executables: [],
    fingerprints: [
      '7d46fb7b32468353ae10fdab935675a23ea6b79bcd4b16de6ea8ba26cfd61fa4',
      'c22dc95943c8c768457b2d75fc7d63e3387e344367901f2ae60016565f7acb91',
      '2a562d89c5a8fbe6505941943d723885e5b9468edc763352ca445498f0cd430d',
      '5e2fd846f7b6fd12e59d0888b7a62c213cce73c9818358868b2f74c7224bad8d',
    ],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/gold-import-compensation-migration-operations.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.fstatSync',
    disposition: 'generated_local_state',
    executables: [],
    fingerprints: ['59687f72aef5f4970a598c87c467ceae04f0c1a704667a64cc73e4c577543441'],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/lib/exclusive-output.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.lstat',
    disposition: 'generated_local_state',
    executables: [],
    fingerprints: [
      '7f15841070edd24a44b8fce864fb9512cea80f1cf0eada3969babc32366eb34f',
      '735b5aae0a7167c43c0797a72293a55680208b539253ce38f69020d5a49feca3',
      'a3c0c5db39a27283094f13ec0e4ffbb03cfa12618d8404e724a4aa5ffe8dfec3',
      '1c5f788d04ad27dd4439b5193bc420cd5edd3edef15a4cb7894c327ee97080f4',
      'ea0ea6ecbe70c0ba0c6bdb84fa629ad70a8861ea3c2090005881e3cf6231cb78',
    ],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/lib/exclusive-output.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.lstatSync',
    disposition: 'generated_local_state',
    executables: [],
    fingerprints: [
      '8b7a05306defeee6b7f1081d995c3b0ae2dcc5614b203623b02d65941caeef11',
      'dc146f61fefcec94df96a15207461cf6e16da2cd4d97cd42ec591cf356cfdfb0',
    ],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/lib/exclusive-output.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.openSync',
    disposition: 'generated_local_state',
    executables: [],
    fingerprints: ['3fc0d458d1e853ba508343b06f5e348aa95175912bd81be0f8a5c76d488a597b'],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/lib/exclusive-output.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.realpath',
    disposition: 'generated_local_state',
    executables: [],
    fingerprints: [
      'e920fdd506a24610c9863f628b8db0ee92ab5a0127748bcafdfb1a98eceb1f2f',
      '1c7cd5e5207b674b46c67c3ab0a2dd4f1102566e8abad0176eba4117e988f57e',
      '21e8befd809d10aebf91e619d757049be1fcf589d303497eb27782136abffefd',
      '2f66d26ba8c766b64d75b0bba0e16805ce7349b7f530aa0e87690692dd08a39d',
      '3d7085770b050c0c048dbbf7c8d9240bbba75e92b3ad36d621d2b8e1a71bd432',
    ],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/lib/exclusive-output.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.realpathSync',
    disposition: 'generated_local_state',
    executables: [],
    fingerprints: [
      '8507908ad9324fe5f42b7c08ee817342b74b80fcdd97cd51cd3b2e845646bc85',
      'd66a65336c5f67fbbf9d6224c9908a22866953512b397151e25518ee30afdd79',
      '689ae49d29db4e37ed79562dc67eea3bfb573d736c50e772408b22f63532a4d1',
    ],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/lib/exclusive-output.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.statSync',
    disposition: 'generated_local_state',
    executables: [],
    fingerprints: [
      '41ca97dd137153df9aeb39a6fde185b02dc034d57265efb243cd103f44267b37',
      'c5582221b59d40fa565e57189fec0b0fe985fcb18c5a9737a8433b2fad7a53c6',
    ],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/lib/exclusive-output.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'process.chdir',
    disposition: 'generated_local_state',
    executables: [],
    fingerprints: [
      '0ac43e596edfd6504a0f6fe1086d1529e0b0147ea04cc3daab2189fb60723594',
      'cd3c09eb274b89e9c362e505b48139e3f4172e057881f62e65accf52c63be524',
      '708be3248144670b32ec244cb5e2da0503260d57e6b66cdad4e86f5d0fd15639',
      'a884950a0d57604c9102897f18211fd0e29baba7e9885edc80c698721d5f643c',
    ],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/lib/exclusive-output.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'child_process.spawn',
    disposition: 'lock_bound_executable',
    executables: ['node_modules/.bin/supabase'],
    fingerprints: ['0b30fd96f68b893190cc7cfca15c6c02b0c1d7409eb58520d97e71045f085a16'],
    packages: ['supabase'],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/local-supabase.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.access',
    disposition: 'lock_bound_executable',
    executables: ['node_modules/.bin/supabase'],
    fingerprints: ['287b0cd850ddc465c483c510105d2b5423a802f36088d75e9e37ea438505c983'],
    packages: ['supabase'],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/local-supabase.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.copyFile',
    disposition: 'repository_input',
    executables: [],
    fingerprints: ['698772ca9769d6f7e5396bc66cdf2def2a96ae7f9f5e339483dc325621abecc6'],
    packages: [],
    repositoryInputs: [
      'supabase/migrations/20260809231651_add_literature_gold_import_compensation_contract_v2.sql',
    ],
    sourcePath: 'scripts/literature/local-supabase.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.copyFile',
    disposition: 'repository_input',
    executables: [],
    fingerprints: ['7ecbe0b1fe0c6be0b46751e766ed0a393ed1a91ba87848a8d221fccdc9fd8dad'],
    packages: [],
    repositoryInputs: [
      'supabase/migrations/20260727032621_add_literature_explorer.sql',
      'supabase/migrations/20260727164510_add_literature_gold_set.sql',
      'supabase/migrations/20260727190000_add_literature_gold_review_categories.sql',
      'supabase/migrations/20260727193432_add_literature_full_text_categorization_flag.sql',
      'supabase/migrations/20260728170939_add_interactive_clinical_case_publication_status.sql',
      'supabase/migrations/20260728171212_add_immune_inflammatory_disease_tag.sql',
      'supabase/migrations/20260728174726_add_safety_complication_prevention_clinical_purpose.sql',
      'supabase/migrations/20260730194025_add_literature_gold_test_unlock.sql',
      'supabase/migrations/20260808035633_add_literature_gold_import_compensation_contract.sql',
    ],
    sourcePath: 'scripts/literature/local-supabase.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.lstat',
    disposition: 'repository_input',
    executables: [],
    fingerprints: ['f5f4a3dfd477340330b75c891c6581e4011195f91892ab09f001c56b5684e2d5'],
    packages: [],
    repositoryInputs: [
      'supabase/migrations/20260808035633_add_literature_gold_import_compensation_contract.sql',
      'supabase/migrations/20260809231651_add_literature_gold_import_compensation_contract_v2.sql',
    ],
    sourcePath: 'scripts/literature/local-supabase.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readdir',
    disposition: 'generated_local_state',
    executables: [],
    fingerprints: ['66149e747506ec7aae2e51e3f83334a1843a0ee43d8e88373724856b013b11fd'],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/local-supabase.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'generated_local_state',
    executables: [],
    fingerprints: [
      '172ff919417a8dfd392c3d00a91d62654b6d49e45fbec13166a6f626a7640d23',
      '1a903b508a6ed935f7995d0bfb3a7dcbbf32abf30cba0481c4840f548ab7e205',
      '185528ce3e0183b28cf11520b682fc964be31d454c8e7356c48cce8494a8fd17',
    ],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/local-supabase.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'repository_input',
    executables: [],
    fingerprints: ['395e2338d151e24d075ddbaf2a44cc33cb1065670f48bb5030f7d45e56b57c87'],
    packages: [],
    repositoryInputs: [
      'supabase/migrations/20260808035633_add_literature_gold_import_compensation_contract.sql',
      'supabase/migrations/20260809231651_add_literature_gold_import_compensation_contract_v2.sql',
    ],
    sourcePath: 'scripts/literature/local-supabase.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'repository_input',
    executables: [],
    fingerprints: ['f72ca659c07b73b2c9dd3ac8e35295e803b0f6831744701b794443383299e7ff'],
    packages: [],
    repositoryInputs: ['supabase/config.toml'],
    sourcePath: 'scripts/literature/local-supabase.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.lstatSync',
    disposition: 'tracked_repository_inventory',
    executables: [],
    fingerprints: ['8e6d002586c803bd4b9512ad99d7fbb7be947bf11316a45db3bcf1e54cdd9fd4'],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/protected-gold-import-contract-v2-module-resolution.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFileSync',
    disposition: 'tracked_repository_inventory',
    executables: [],
    fingerprints: [
      'd5838c5930d9f5bc746b4b4886c140ad665ebb8933f19ab640f8c9eb70ba42fd',
      '359ca6890e6a42cdc32843d029de151d4e49f172e810fb1fb98f2eb3ce3cdb5e',
      'f9898a0214300432141c1b77b182ab361e7ffe6dc4a8e4eed97e43bf09391bc0',
    ],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/protected-gold-import-contract-v2-module-resolution.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.realpathSync',
    disposition: 'repository_metadata',
    executables: [],
    fingerprints: ['da1ee4edfd58995d5458c68f98f54cf6f8ca0f71643c3843661a7a9ea1bd5eee'],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/protected-gold-import-contract-v2-module-resolution.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.realpathSync',
    disposition: 'tracked_repository_inventory',
    executables: [],
    fingerprints: ['99c521cce1a04e0db88eb9f297624a9794d3e8db1698e8a4d021ba703f0789a0'],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/protected-gold-import-contract-v2-module-resolution.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'child_process.execFile',
    disposition: 'system_executable',
    executables: ['git'],
    fingerprints: ['f90fd997b8546d9782880e8630c9d1032ea17441146203538f542cd40f05ce26'],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/protected-gold-import-contract-v2-recovery-bundle.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.lstat',
    disposition: 'tracked_repository_inventory',
    executables: [],
    fingerprints: ['f415baf2d488379b8b3044547553acf5fd1a684e1f39e3f3c1a6cfda977ebaf5'],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/protected-gold-import-contract-v2-recovery-bundle.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'tracked_repository_inventory',
    executables: [],
    fingerprints: ['61998471f9f08d901a8d5ed529138fe495853ae4275f5fc05d1bb6d1becd958b'],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/protected-gold-import-contract-v2-recovery-bundle.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.realpath',
    disposition: 'repository_metadata',
    executables: [],
    fingerprints: [
      'fef95a08d70b4f0835a5ea88deeedadf7c944fd6cf98a476a8a289d1b21588d5',
      '69feb70e6353f8896485f1474f716ee5cbc5664b93076789784cefd58566941e',
    ],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/protected-gold-import-contract-v2-recovery-bundle.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.realpath',
    disposition: 'tracked_repository_inventory',
    executables: [],
    fingerprints: ['faec30b43bdc1a0195bf5b1371d6a3e7ef9722f8d96159ba49c4d1222b30d962'],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/protected-gold-import-contract-v2-recovery-bundle.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.lstatSync',
    disposition: 'tracked_repository_inventory',
    executables: [],
    fingerprints: ['38c3a5ff5a9115e3bbb3a599b562ad78b03dad3269ed47069da608ba4000ffe1'],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/protected-gold-import-contract-v2-runtime-inputs.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFileSync',
    disposition: 'tracked_repository_inventory',
    executables: [],
    fingerprints: ['9f0df9cda1121dc9e5eaa91272a854ed34b2d797684114b3af8fc70c1af05561'],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/protected-gold-import-contract-v2-runtime-inputs.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.realpathSync',
    disposition: 'repository_metadata',
    executables: [],
    fingerprints: [
      '5476708e503580f7b015dcea2e4a2faa986d6340e35ec19e77440d2810efdd37',
      '99caa4c6ae8d3152f47bc7ecea1209e7989a1eaa2cabed123eb37194d8d7037f',
    ],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/protected-gold-import-contract-v2-runtime-inputs.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.realpathSync',
    disposition: 'tracked_repository_inventory',
    executables: [],
    fingerprints: ['f468120194a1b359538f26676d12f0cb4d7dc20295dfae44fe21810728085ab8'],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/protected-gold-import-contract-v2-runtime-inputs.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'child_process.spawn',
    disposition: 'system_executable',
    executables: ['docker'],
    fingerprints: [
      'b8f9223a300365e8a75b1f8338610a6e78ba54b61159abe7fd7f8369e1e4d138',
      'cc53aa256956faf5623fe725490f6e4f0a9372356c6f0d40776b740538275425',
    ],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/literature/protected-gold-import-contract-v2-recovery-evidence-adapter.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.lstat',
    disposition: 'operator_evidence',
    fingerprints: [
      'c14b0a3aad0ff70077e4aafed0bc3509179298b48ded6495198fb3bfcee57f55',
      'b1d918fc78c4f820985492bf4a81150f82120c316a3d6c16d7cdf5679243adc9',
      '4fc70f26692e8dc0c3d2c99b91f7c5444fa0884f0dd9c9ad9737934cabde8a8a',
    ],
    sourcePath: 'scripts/literature/gold-import-compensation-v2-migration-receipt-gate.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'operator_evidence',
    fingerprints: [
      '58b3be36b71fe6242447adc7ba571c097b2d876b7fc9dad71d113463136ed2d3',
      '927051b379a5be4dd35da49e8aac73ecc80e5cb51eb57ef34fcacb3fedd55ca4',
      '50fa697aa522e1c24df3b5266b428fb4c0e0de201cb6e9e3cd37907042325634',
      '7b8b27ec4431d4ffe2a6e3a3e23c1a0748f82bed75c2b0c87dde2d95eadbebef',
      '1c4e6c4426e42f8d00b904e604c2026de0e697dbe4f95fc77b14156b3f1544ca',
      '02642c82bb800784e092e5534e4814ceef6256f214c68887cfa390f1b02b6824',
      'c9659458c4c35ce2ea76c20dc34911c612e89f5926b8a01b122b10b82bdbd23e',
    ],
    sourcePath: 'scripts/literature/gold-import-compensation-v2-migration-receipt-gate.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'repository_input',
    fingerprints: ['f08d3aa18ae0181412c1c4ac5f5c28c18ec55e1a7df57503ee791201ef9d7d6a'],
    repositoryInputs: [
      'scripts/literature/contracts/protected-v2-finalized-receipt-recovery-authority-v1.json',
    ],
    sourcePath: 'scripts/literature/gold-import-compensation-v2-migration-receipt-gate.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'repository_input',
    fingerprints: ['406f5d7a1cc14fb95c5ea56246717a41feb83d5fc899de53b01f2baab6adebff'],
    repositoryInputs: [
      'scripts/literature/contracts/protected-v2-receipt-recovery-amendment-v1.json',
    ],
    sourcePath: 'scripts/literature/gold-import-compensation-v2-migration-receipt-gate.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'repository_input',
    fingerprints: ['b11584c6044808eaaf4ae3d569a65d30d486dcdb119335df7d311896235843d6'],
    repositoryInputs: [
      'scripts/literature/contracts/protected-v2-receipt-recovery-incident-authority-v1.json',
    ],
    sourcePath: 'scripts/literature/gold-import-compensation-v2-migration-receipt-gate.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readdir',
    disposition: 'operator_evidence',
    fingerprints: [
      '2cad52b03f10f695a20092cb28e7a4967d15daad69ae90852b8b6c2c44f48945',
      '9aea1ca38bd0767200b5f45eaffad78f54e70185f59f6cb28064f38fd224759f',
    ],
    sourcePath: 'scripts/literature/gold-import-compensation-v2-migration-receipt-gate.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.realpath',
    disposition: 'operator_evidence',
    fingerprints: [
      '76f917d0f0b00d2b953f4165a405b9d5c9786c8833a8ff705ce5d6c9f85b577e',
      '1e78636fd147a883ecd7fea54e4809da8358e24aae3ecaa7d2d461f3d1e8ec75',
      '506471ffd208a341abc4607a0f895c5fcc71a912cb4530cac6b0785404d39409',
      '271b39b4e99ffeb67dacf3847f32558ba45c168d04f6c29e5767e74fb71b5237',
    ],
    sourcePath: 'scripts/literature/gold-import-compensation-v2-migration-receipt-gate.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.lstat',
    disposition: 'operator_evidence',
    fingerprints: [
      'f514a57764b62f637b0df86c592ee8909b6e1cf53447bae706226fb2edd9a145',
      'ea501c30ce2c4f9b83c979cb17cadead1cc20be861abacf3f4925ab32a96b7d9',
      '229f893ed6b7b227239d61310b490d429b7e366d6e7200afb91bf05fda17ae41',
      '26018b6ee69a129ace4f23c5d5385c143689c4068d00f5c66a3261c7ca204942',
    ],
    sourcePath: 'scripts/literature/protected-gold-import-contract-v2-receipt-recovery-core.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'operator_evidence',
    fingerprints: [
      'ce685e03f07518d42ee44b030020f495db3460fa4a519450229851c24bd0777d',
      '31bbc302f86bc900306885ad6ad5a1dcc78a6918c0d9b109047723059b8b3538',
      '48c85b85661176a929cc2e4a6ae93722cefe9993c0a288df1e8d6ef10d26af2a',
      'a5b955edd7cf29238de5b130336b6e05d5cf6229d4256088b1414d5c820e4d40',
      '74ddae26c1d147b7a38fee0a0cb41fb805b5df816ddbe2dcaf30673aed0f191e',
      'ba7adf2f7ddcdd29b274791de6339047d0a2ac92997411df051d1e3f04805652',
      '5edaef9b23d853bfe033e3732e06b88aa468b02bd7debde1845d8bfa3b0db9b5',
    ],
    sourcePath: 'scripts/literature/protected-gold-import-contract-v2-receipt-recovery-core.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readdir',
    disposition: 'operator_evidence',
    fingerprints: [
      '2b955e6fb56691a4f12f81e505b5d9be759b97f5ea54813ec8fd7ed8c13d681f',
      '4086147cb28b4915917e0eec076289f6332f2ac658e8dd18660df840b46ab608',
    ],
    sourcePath: 'scripts/literature/protected-gold-import-contract-v2-receipt-recovery-core.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.realpath',
    disposition: 'operator_evidence',
    fingerprints: ['2d4b3fe69bd7eec725147516f9bbc3ab0a499cd63767e6431b995b0edd80f021'],
    sourcePath: 'scripts/literature/protected-gold-import-contract-v2-receipt-recovery-core.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'child_process.execFile',
    disposition: 'system_executable',
    executables: ['git'],
    fingerprints: ['b56b8a4ec1c83484174829274bcf9af3979ed4fe7cbd672b538db2ab3055444f'],
    sourcePath: 'scripts/literature/protected-gold-import-contract-v2-receipt-recovery-runtime.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.lstat',
    disposition: 'operator_evidence',
    fingerprints: [
      'aedf649665f6e83f89391a4c19abd4dcdbe8c2909c5f6347dc99942c6f741118',
      '60874339f3ddb2bcfb911497032f93cca90caa358c47e3879899fdec5e976196',
      'dc3d9cf73f583df1aa4996e09eb039fc20a9282647d0555e114a79a4a0212154',
    ],
    sourcePath: 'scripts/literature/protected-gold-import-contract-v2-receipt-recovery-runtime.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'operator_evidence',
    fingerprints: ['ef820747259550b75a0b285971f88bc6e68b723d4bfed1f2ad19f2b88653b84c'],
    sourcePath: 'scripts/literature/protected-gold-import-contract-v2-receipt-recovery-runtime.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readdir',
    disposition: 'operator_evidence',
    fingerprints: ['64ba93dbb4a62c9b3e1d05ecd10fb832a954921d283a0000236d76587decd4fc'],
    sourcePath: 'scripts/literature/protected-gold-import-contract-v2-receipt-recovery-runtime.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.realpath',
    disposition: 'operator_evidence',
    fingerprints: [
      '539b50434a106fe8d96e414898c463b8fff6de4dadc53fec5c4a0fd87f0165d5',
      '5690400a65c75e57a69362de15feabe68560b987972af76ae9a0bd1378276bc9',
      'e28f16fa289222625d5511600d63730a99960761b7a08959af88b6884c1df480',
      '43ba4ddd04c5b21a48f2fcdfe786bacb87f8279a7f56343c0019d0806cb8596b',
      'b58c5e608fe3faf6e4131f00b49d6e426514ff9ad09348be844321b175c829b9',
    ],
    sourcePath: 'scripts/literature/protected-gold-import-contract-v2-receipt-recovery-runtime.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'child_process.execFile',
    disposition: 'system_executable',
    executables: ['git'],
    fingerprints: ['6d11a038532ab8a2ad9cad0a2b6fd964f3f9731c62fc77b82da5ea458239fefe'],
    sourcePath:
      'scripts/literature/protected-gold-import-contract-v2-receipt-recovery-tool-bundle.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.lstat',
    disposition: 'tracked_repository_inventory',
    fingerprints: ['addfd090de4557f3e600b49a7911d3b86caa60283a86413c30662868b071b183'],
    sourcePath:
      'scripts/literature/protected-gold-import-contract-v2-receipt-recovery-tool-bundle.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'tracked_repository_inventory',
    fingerprints: [
      '4971c6dd197ac03095d0ab4db40c99c442c76bcf5ce82d51f07254624a4ebe05',
      '663271a5e6aeb8daa05e87807e0d544cf5c46dc5b821f246e9cd670ae4080e8c',
    ],
    sourcePath:
      'scripts/literature/protected-gold-import-contract-v2-receipt-recovery-tool-bundle.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.readFile',
    disposition: 'repository_input',
    fingerprints: ['0716ab8c52c51278964ad50a844819ad836ed965c7af81a4ce50fed7606a1976'],
    repositoryInputs: ['package.json'],
    sourcePath:
      'scripts/literature/protected-gold-import-contract-v2-receipt-recovery-tool-bundle.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.realpath',
    disposition: 'tracked_repository_inventory',
    fingerprints: ['12bdd5280dbb321c501a63e262a733454ede1402804e8002ce2fcc2918beabb6'],
    sourcePath:
      'scripts/literature/protected-gold-import-contract-v2-receipt-recovery-tool-bundle.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'fs.realpath',
    disposition: 'repository_metadata',
    fingerprints: [
      '7d091827d3d0e0ade9045cbe5ad684e19ffeccf066e37196fe1d6c2fa539eb90',
      'd7607582bc075982607b97c0367d8dad20c4b24badc1ef9ebf0fd97d0b44a399',
    ],
    sourcePath:
      'scripts/literature/protected-gold-import-contract-v2-receipt-recovery-tool-bundle.ts',
  }),
  ...declareRuntimeCallSites({
    api: 'child_process.execSync',
    disposition: 'system_executable',
    executables: ['git'],
    fingerprints: [
      '8ff26ca86be0c1e721498454a68cd49fc9eaf1d122af8bd3be662f405e8f7905',
      '05823c9c5c05c874deb78bf4133e6f67f14850e7566380035192a4b809d0a1bc',
    ],
    packages: [],
    repositoryInputs: [],
    sourcePath: 'scripts/require-primary-checkout.mjs',
  }),
  ...declareRuntimeCallSites({
    api: 'child_process.spawnSync',
    disposition: 'repository_entry_point',
    executables: ['tsx'],
    fingerprints: ['3ccb2eaeb6c640b4c6c7d14762431f46f2c00c7e4e13d86c620ce8bf70f9ada4'],
    packages: ['tsx'],
    repositoryInputs: [
      'scripts/literature/apply-protected-gold-import-contract-v2.ts',
      'scripts/literature/local-supabase.ts',
      'scripts/literature/recover-protected-gold-import-contract-v2-receipt.ts',
    ],
    sourcePath: 'scripts/require-primary-checkout.mjs',
  }),
] as const satisfies readonly ProtectedV2RuntimeCallSiteDeclaration[]

export const PROTECTED_V2_RUNTIME_INPUT_DECLARATION = {
  callSites: PROTECTED_V2_RUNTIME_CALL_SITE_DECLARATIONS,
  explicitRoots: PROTECTED_V2_EXPLICIT_RUNTIME_ROOTS,
  packageScripts: PROTECTED_V2_PACKAGE_SCRIPT_DECLARATIONS,
  protectedDirectories: PROTECTED_V2_PROTECTED_DIRECTORIES,
  runtimeEntryPoints: PROTECTED_V2_RUNTIME_ENTRY_POINTS,
  schemaVersion: PROTECTED_V2_RUNTIME_INPUT_DECLARATION_SCHEMA_VERSION,
} as const

export const PROTECTED_V2_RUNTIME_INPUT_DECLARATION_SHA256 = sha256(
  canonicalJson(PROTECTED_V2_RUNTIME_INPUT_DECLARATION),
)

export interface ProtectedV2RuntimeInputCallSiteRecord {
  api: string
  disposition: ProtectedV2RuntimeCallSiteDisposition
  executables: string[]
  fingerprint: string
  packages: string[]
  repositoryInputs: string[]
  sourcePath: string
}

export interface ProtectedV2PackageScriptAuditRecord {
  arguments: string[]
  commandSha256: string
  entryPoint: string
  name: string
  requiresPrimaryCheckout: boolean
}

export interface ProtectedV2RuntimeInputAudit {
  callSites: ProtectedV2RuntimeInputCallSiteRecord[]
  declarationSha256: string
  packageScripts: ProtectedV2PackageScriptAuditRecord[]
  repositoryInputs: string[]
  schemaVersion: typeof PROTECTED_V2_RUNTIME_INPUT_AUDIT_SCHEMA_VERSION
  sha256: string
}

export interface DiscoverProtectedV2RuntimeCallSitesInput {
  cwd: string
  sourcePaths: readonly string[]
  trackedPaths: ReadonlySet<string>
}

export interface DiscoveredProtectedV2RuntimeCallSite {
  api: string
  callText: string
  expressionSha256: string
  fingerprint: string
  nonliteral: boolean
  sourcePath: string
  staticDisposition: ProtectedV2RuntimeCallSiteDisposition | null
  staticExecutables: string[]
  staticPackages: string[]
  staticRepositoryInputs: string[]
}

export interface BuildProtectedV2RuntimeInputAuditInput {
  callSiteDeclarations?: readonly ProtectedV2RuntimeCallSiteDeclaration[]
  cwd: string
  packageJsonPath: string
  packageLockPath: string
  packageScripts?: readonly ProtectedV2PackageScriptDeclaration[]
  sealedPaths: ReadonlySet<string>
  sourcePaths: readonly string[]
  trackedPaths: ReadonlySet<string>
}

const FILESYSTEM_INPUT_APIS = new Set([
  'access',
  'accessSync',
  'cp',
  'cpSync',
  'copyFile',
  'copyFileSync',
  'createReadStream',
  'existsSync',
  'fstat',
  'fstatSync',
  'glob',
  'globSync',
  'lstat',
  'lstatSync',
  'open',
  'openAsBlob',
  'openSync',
  'opendir',
  'opendirSync',
  'readFile',
  'readFileSync',
  'readlink',
  'readlinkSync',
  'readdir',
  'readdirSync',
  'realpath',
  'realpathSync',
  'stat',
  'statSync',
  'watch',
  'watchFile',
])
const FILESYSTEM_OUTPUT_APIS = new Set([
  'appendFile',
  'appendFileSync',
  'chmod',
  'chmodSync',
  'chown',
  'chownSync',
  'close',
  'closeSync',
  'createWriteStream',
  'fdatasync',
  'fdatasyncSync',
  'fchmod',
  'fchmodSync',
  'fchown',
  'fchownSync',
  'fsync',
  'fsyncSync',
  'ftruncate',
  'ftruncateSync',
  'futimes',
  'futimesSync',
  'lchmod',
  'lchown',
  'link',
  'linkSync',
  'lutimes',
  'mkdir',
  'mkdirSync',
  'mkdtemp',
  'mkdtempSync',
  'rename',
  'renameSync',
  'rm',
  'rmSync',
  'rmdir',
  'rmdirSync',
  'symlink',
  'symlinkSync',
  'truncate',
  'truncateSync',
  'unlink',
  'unlinkSync',
  'unwatchFile',
  'utimes',
  'utimesSync',
  'write',
  'writeFile',
  'writeFileSync',
  'writeSync',
  'writev',
  'writevSync',
])
const PROCESS_APIS = new Set([
  'exec',
  'execFile',
  'execFileSync',
  'execSync',
  'fork',
  'spawn',
  'spawnSync',
])
const SYSTEM_EXECUTABLES = new Set(['docker', 'git', 'node', 'npm', 'npx', 'psql'])

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function isWithin(root: string, candidate: string): boolean {
  const path = relative(root, candidate)
  return path === '' || (path !== '..' && !path.startsWith(`..${sep}`))
}

function canonicalRepositoryPath(input: {
  absolutePath: string
  cwd: string
  label: string
  trackedPaths: ReadonlySet<string>
}): string {
  const absolutePath = resolve(input.absolutePath)
  if (!isWithin(input.cwd, absolutePath)) {
    throw new Error(`${input.label} resolves outside the protected repository: ${absolutePath}`)
  }
  const path = relative(input.cwd, absolutePath).split(sep).join('/')
  if (!isSafeProtectedV2RepositoryPath(path) || !input.trackedPaths.has(path)) {
    throw new Error(`${input.label} is not an exact Git-tracked repository input: ${path}`)
  }
  const stat = lstatSync(absolutePath)
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${input.label} is not a regular non-symlink file: ${path}`)
  }
  const canonical = realpathSync(absolutePath)
  if (canonical !== absolutePath) {
    throw new Error(`${input.label} resolves through a symlinked repository path: ${path}`)
  }
  return path
}

function scriptKind(path: string): ts.ScriptKind {
  if (path.endsWith('.tsx')) return ts.ScriptKind.TSX
  if (path.endsWith('.jsx')) return ts.ScriptKind.JSX
  if (path.endsWith('.js') || path.endsWith('.mjs') || path.endsWith('.cjs')) {
    return ts.ScriptKind.JS
  }
  return ts.ScriptKind.TS
}

function isImportMetaUrl(node: ts.Expression): boolean {
  return (
    ts.isPropertyAccessExpression(node) &&
    node.name.text === 'url' &&
    ts.isMetaProperty(node.expression) &&
    node.expression.keywordToken === ts.SyntaxKind.ImportKeyword &&
    node.expression.name.text === 'meta'
  )
}

interface SourceBindings {
  apiByIdentifier: Map<string, string>
  childProcessNamespace: Set<string>
  fileUrlToPath: Set<string>
  filesystemNamespace: Set<string>
  pathFunctions: Map<string, string>
  pathNamespaces: Set<string>
  promisify: Set<string>
}

function runtimeModuleName(moduleName: string): string {
  return moduleName.replace(/^node:/u, '')
}

const REVIEWED_PROCESS_PROPERTIES = new Set([
  'argv',
  'chdir',
  'cwd',
  'env',
  'exit',
  'exitCode',
  'kill',
  'off',
  'on',
  'pid',
  'platform',
  'stderr',
  'stdout',
])

function staticMemberName(expression: ts.Expression): string | null {
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text
  if (
    ts.isElementAccessExpression(expression) &&
    ts.isStringLiteralLike(expression.argumentExpression)
  ) {
    return expression.argumentExpression.text
  }
  return null
}

function memberOwner(expression: ts.Expression): ts.Expression | null {
  return ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)
    ? expression.expression
    : null
}

function isTransparentRuntimeExpressionWrapper(
  node: ts.Node,
): node is
  | ts.ParenthesizedExpression
  | ts.AsExpression
  | ts.TypeAssertion
  | ts.NonNullExpression
  | ts.SatisfiesExpression {
  return (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isSatisfiesExpression(node)
  )
}

function unwrapRuntimeExpression(expression: ts.Expression): ts.Expression {
  let current = expression
  while (isTransparentRuntimeExpressionWrapper(current)) current = current.expression
  return current
}

function outerRuntimeExpression(expression: ts.Expression): ts.Expression {
  let current = expression
  while (
    isTransparentRuntimeExpressionWrapper(current.parent) &&
    current.parent.expression === current
  ) {
    current = current.parent
  }
  return current
}

function namespaceMember(
  expression: ts.Expression,
  namespaces: ReadonlySet<string>,
): string | null {
  const method = staticMemberName(expression)
  const rawOwner = memberOwner(expression)
  if (!method || !rawOwner) return null
  const owner = unwrapRuntimeExpression(rawOwner)
  if (ts.isIdentifier(owner) && namespaces.has(owner.text)) return method
  const ownerName = staticMemberName(owner)
  const rawOwnerBase = memberOwner(owner)
  const ownerBase = rawOwnerBase ? unwrapRuntimeExpression(rawOwnerBase) : null
  if (
    ownerName === 'promises' &&
    ownerBase &&
    ts.isIdentifier(ownerBase) &&
    namespaces.has(ownerBase.text)
  ) {
    return method
  }
  return null
}

function filesystemApi(method: string): string {
  if (FILESYSTEM_INPUT_APIS.has(method)) return `fs.${method}`
  if (FILESYSTEM_OUTPUT_APIS.has(method) || ['constants', 'promises'].includes(method)) {
    return `ignored.fs.${method}`
  }
  return `unsupported.fs.${method}`
}

function collectSourceBindings(sourceFile: ts.SourceFile): SourceBindings {
  const bindings: SourceBindings = {
    apiByIdentifier: new Map(),
    childProcessNamespace: new Set(),
    fileUrlToPath: new Set(),
    filesystemNamespace: new Set(),
    pathFunctions: new Map(),
    pathNamespaces: new Set(),
    promisify: new Set(),
  }
  const createRequireFactories = new Set<string>()
  const createdRequireFunctions = new Set<string>()
  const bindNamespace = (moduleName: string, local: string): void => {
    const normalized = runtimeModuleName(moduleName)
    if (normalized === 'fs' || normalized === 'fs/promises') {
      bindings.filesystemNamespace.add(local)
    } else if (normalized === 'child_process') {
      bindings.childProcessNamespace.add(local)
    } else if (normalized === 'path') {
      bindings.pathNamespaces.add(local)
    }
  }
  const bindNamed = (moduleName: string, imported: string, local: string): void => {
    const normalized = runtimeModuleName(moduleName)
    if (normalized === 'fs' || normalized === 'fs/promises') {
      if (imported === 'promises') {
        bindings.filesystemNamespace.add(local)
      } else {
        const api = filesystemApi(imported)
        if (api.startsWith('unsupported.')) {
          throw new Error(`Unsupported filesystem binding in ${sourceFile.fileName}: ${imported}`)
        }
        bindings.apiByIdentifier.set(local, api)
      }
    } else if (normalized === 'child_process') {
      if (!PROCESS_APIS.has(imported)) {
        throw new Error(`Unsupported child-process binding in ${sourceFile.fileName}: ${imported}`)
      }
      bindings.apiByIdentifier.set(local, `child_process.${imported}`)
    } else if (normalized === 'path' && ['dirname', 'join', 'resolve'].includes(imported)) {
      bindings.pathFunctions.set(local, imported)
    } else if (normalized === 'url' && imported === 'fileURLToPath') {
      bindings.fileUrlToPath.add(local)
    } else if (normalized === 'util' && imported === 'promisify') {
      bindings.promisify.add(local)
    }
  }
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const moduleName = statement.moduleSpecifier.text
      const importClause = statement.importClause
      if (
        runtimeModuleName(moduleName) === 'process' &&
        importClause &&
        !importClause.isTypeOnly &&
        (importClause.name ||
          (importClause.namedBindings &&
            (ts.isNamespaceImport(importClause.namedBindings) ||
              importClause.namedBindings.elements.some((element) => !element.isTypeOnly))))
      ) {
        throw new Error(`Unsupported node:process binding in ${sourceFile.fileName}.`)
      }
      if (!importClause || importClause.isTypeOnly) continue
      if (importClause.name) bindNamespace(moduleName, importClause.name.text)
      const namedBindings = importClause.namedBindings
      if (namedBindings && ts.isNamespaceImport(namedBindings)) {
        bindNamespace(moduleName, namedBindings.name.text)
      } else if (namedBindings && ts.isNamedImports(namedBindings)) {
        for (const element of namedBindings.elements) {
          if (!element.isTypeOnly) {
            const imported = (element.propertyName ?? element.name).text
            if (runtimeModuleName(moduleName) === 'module' && imported === 'createRequire') {
              createRequireFactories.add(element.name.text)
            }
            bindNamed(moduleName, imported, element.name.text)
          }
        }
      }
    } else if (
      ts.isImportEqualsDeclaration(statement) &&
      ts.isExternalModuleReference(statement.moduleReference) &&
      statement.moduleReference.expression &&
      ts.isStringLiteralLike(statement.moduleReference.expression)
    ) {
      if (runtimeModuleName(statement.moduleReference.expression.text) === 'process') {
        throw new Error(`Unsupported node:process binding in ${sourceFile.fileName}.`)
      }
      bindNamespace(statement.moduleReference.expression.text, statement.name.text)
    } else if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteralLike(statement.moduleSpecifier)
    ) {
      const normalized = runtimeModuleName(statement.moduleSpecifier.text)
      const hasRuntimeExport =
        !statement.isTypeOnly &&
        (!statement.exportClause ||
          ts.isNamespaceExport(statement.exportClause) ||
          statement.exportClause.elements.some((element) => !element.isTypeOnly))
      if (
        hasRuntimeExport &&
        (normalized === 'fs' ||
          normalized === 'fs/promises' ||
          normalized === 'child_process' ||
          normalized === 'process')
      ) {
        throw new Error(`Unsupported runtime namespace export in ${sourceFile.fileName}.`)
      }
    }
  }

  const collectCreatedRequireFunctions = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const initializer = unwrapRuntimeExpression(node.initializer)
      if (
        ts.isCallExpression(initializer) &&
        ts.isIdentifier(initializer.expression) &&
        createRequireFactories.has(initializer.expression.text) &&
        initializer.arguments.length === 1 &&
        isImportMetaUrl(initializer.arguments[0]!)
      ) {
        createdRequireFunctions.add(node.name.text)
      }
    }
    ts.forEachChild(node, collectCreatedRequireFunctions)
  }
  if (createRequireFactories.size > 0) collectCreatedRequireFunctions(sourceFile)

  const requireModule = (expression: ts.Expression): string | null => {
    const unwrapped = unwrapRuntimeExpression(expression)
    if (
      ts.isCallExpression(unwrapped) &&
      ts.isIdentifier(unwrapped.expression) &&
      (unwrapped.expression.text === 'require' ||
        createdRequireFunctions.has(unwrapped.expression.text)) &&
      unwrapped.arguments.length === 1 &&
      ts.isStringLiteralLike(unwrapped.arguments[0]!)
    ) {
      return unwrapped.arguments[0]!.text
    }
    return null
  }
  const bindCommonJs = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const initializer = unwrapRuntimeExpression(node.initializer)
      const directModule = requireModule(initializer)
      if (directModule) {
        if (ts.isIdentifier(node.name)) bindNamespace(directModule, node.name.text)
        if (ts.isObjectBindingPattern(node.name)) {
          for (const element of node.name.elements) {
            if (!ts.isIdentifier(element.name)) {
              throw new Error(`Unsupported CommonJS runtime binding in ${sourceFile.fileName}.`)
            }
            bindNamed(
              directModule,
              element.propertyName && ts.isIdentifier(element.propertyName)
                ? element.propertyName.text
                : element.name.text,
              element.name.text,
            )
          }
        }
      } else if (ts.isIdentifier(node.name)) {
        const owner = memberOwner(initializer)
        const member = staticMemberName(initializer)
        const ownerModule = owner ? requireModule(owner) : null
        if (ownerModule && member) {
          if (runtimeModuleName(ownerModule) === 'fs' && member === 'promises') {
            bindNamespace('fs/promises', node.name.text)
          } else {
            bindNamed(ownerModule, member, node.name.text)
          }
        }
      }
    }
    validateRuntimeNamespaceAcquisition(node)
    ts.forEachChild(node, bindCommonJs)
  }
  bindCommonJs(sourceFile)

  function validateRuntimeNamespaceAcquisition(node: ts.Node): void {
    if (ts.isIdentifier(node)) {
      const isValueReference =
        !isTypeOnlyRuntimeReference(node) &&
        !isRuntimeBindingDeclarationName(node) &&
        !isNonValuePropertyName(node)
      if (isValueReference && (node.text === 'globalThis' || node.text === 'global')) {
        throw new Error(`Unsupported global runtime-loader root in ${sourceFile.fileName}.`)
      }
      if (isValueReference && node.text === 'process') {
        const parent = node.parent
        const isReviewedProcessProperty =
          ts.isPropertyAccessExpression(parent) &&
          parent.expression === node &&
          REVIEWED_PROCESS_PROPERTIES.has(parent.name.text)
        if (!isReviewedProcessProperty) {
          throw new Error(`Unsupported process runtime-loader root in ${sourceFile.fileName}.`)
        }
      }
    }
    if (ts.isCallExpression(node)) {
      if (
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1 &&
        ts.isStringLiteralLike(node.arguments[0]!)
      ) {
        const normalized = runtimeModuleName(node.arguments[0]!.text)
        if (
          normalized === 'fs' ||
          normalized === 'fs/promises' ||
          normalized === 'child_process' ||
          normalized === 'process'
        ) {
          throw new Error(`Unsupported dynamic runtime namespace import in ${sourceFile.fileName}.`)
        }
      }
      const moduleName = requireModule(node)
      const normalized = moduleName ? runtimeModuleName(moduleName) : null
      const invocation = unwrapRuntimeExpression(node)
      if (
        normalized === 'module' &&
        ts.isCallExpression(invocation) &&
        ts.isIdentifier(invocation.expression) &&
        createdRequireFunctions.has(invocation.expression.text)
      ) {
        throw new Error(
          `Unsupported created-require runtime module namespace in ${sourceFile.fileName}.`,
        )
      }
      if (normalized === 'process') {
        throw new Error(
          `Unsupported runtime process namespace acquisition in ${sourceFile.fileName}.`,
        )
      }
      if (normalized === 'fs' || normalized === 'fs/promises' || normalized === 'child_process') {
        const expression = outerRuntimeExpression(node)
        const parent = expression.parent
        const isDirectBinding =
          ts.isVariableDeclaration(parent) &&
          parent.initializer === expression &&
          (ts.isIdentifier(parent.name) || ts.isObjectBindingPattern(parent.name))
        const member =
          (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
          parent.expression === expression &&
          staticMemberName(parent) !== null
            ? outerRuntimeExpression(parent)
            : null
        const isDirectApiAlias =
          member !== null &&
          ts.isVariableDeclaration(member.parent) &&
          member.parent.initializer === member &&
          ts.isIdentifier(member.parent.name)
        if (!isDirectBinding && !isDirectApiAlias) {
          throw new Error(`Unsupported runtime namespace acquisition in ${sourceFile.fileName}.`)
        }
      }
    }
  }

  let changed = true
  while (changed) {
    changed = false
    const setApi = (local: string, api: string): void => {
      if (api.startsWith('unsupported.')) {
        throw new Error(`Unsupported runtime API alias in ${sourceFile.fileName}: ${api}`)
      }
      if (!bindings.apiByIdentifier.has(local)) {
        bindings.apiByIdentifier.set(local, api)
        changed = true
      }
    }
    const visit = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        const initializer = unwrapRuntimeExpression(node.initializer)
        if (ts.isIdentifier(initializer)) {
          const api = bindings.apiByIdentifier.get(initializer.text)
          if (api) setApi(node.name.text, api)
          for (const namespace of [
            bindings.filesystemNamespace,
            bindings.childProcessNamespace,
            bindings.pathNamespaces,
          ]) {
            if (namespace.has(initializer.text) && !namespace.has(node.name.text)) {
              namespace.add(node.name.text)
              changed = true
            }
          }
        } else {
          const directApi = apiForCall(initializer, bindings)
          if (directApi) setApi(node.name.text, directApi)
          const owner = memberOwner(initializer)
          const member = staticMemberName(initializer)
          if (
            member === 'promises' &&
            owner &&
            ts.isIdentifier(owner) &&
            bindings.filesystemNamespace.has(owner.text) &&
            !bindings.filesystemNamespace.has(node.name.text)
          ) {
            bindings.filesystemNamespace.add(node.name.text)
            changed = true
          }
          if (
            ts.isCallExpression(initializer) &&
            ts.isIdentifier(initializer.expression) &&
            bindings.promisify.has(initializer.expression.text) &&
            initializer.arguments.length === 1
          ) {
            const promisedApi = apiForCall(
              unwrapRuntimeExpression(initializer.arguments[0]!),
              bindings,
            )
            if (promisedApi?.startsWith('child_process.')) setApi(node.name.text, promisedApi)
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
  }
  validateRuntimeBindingUses(sourceFile, bindings)
  return bindings
}

function apiForCall(expression: ts.Expression, bindings: SourceBindings): string | null {
  const unwrapped = unwrapRuntimeExpression(expression)
  if (
    ts.isPropertyAccessExpression(unwrapped) &&
    ts.isIdentifier(unwrapped.expression) &&
    unwrapped.expression.text === 'process' &&
    unwrapped.name.text === 'chdir'
  ) {
    return 'process.chdir'
  }
  if (ts.isIdentifier(unwrapped)) return bindings.apiByIdentifier.get(unwrapped.text) ?? null
  const filesystemMethod = namespaceMember(unwrapped, bindings.filesystemNamespace)
  if (filesystemMethod) return filesystemApi(filesystemMethod)
  const childProcessMethod = namespaceMember(unwrapped, bindings.childProcessNamespace)
  if (childProcessMethod) {
    return PROCESS_APIS.has(childProcessMethod)
      ? `child_process.${childProcessMethod}`
      : `unsupported.child_process.${childProcessMethod}`
  }
  return null
}

function expressionContainsRuntimeNamespace(
  expression: ts.Expression,
  bindings: SourceBindings,
): boolean {
  let found = false
  const visit = (node: ts.Node): void => {
    if (
      ts.isIdentifier(node) &&
      (bindings.filesystemNamespace.has(node.text) || bindings.childProcessNamespace.has(node.text))
    ) {
      found = true
      return
    }
    if (!found) ts.forEachChild(node, visit)
  }
  visit(expression)
  return found
}

function isTypeOnlyRuntimeReference(node: ts.Identifier): boolean {
  let current: ts.Node | undefined = node.parent
  while (current && !ts.isStatement(current) && !ts.isSourceFile(current)) {
    if (ts.isTypeNode(current)) return true
    current = current.parent
  }
  return false
}

function isRuntimeBindingDeclarationName(node: ts.Identifier): boolean {
  const parent = node.parent
  return (
    (ts.isImportClause(parent) && parent.name === node) ||
    (ts.isNamespaceImport(parent) && parent.name === node) ||
    (ts.isImportSpecifier(parent) && parent.name === node) ||
    (ts.isImportEqualsDeclaration(parent) && parent.name === node) ||
    (ts.isVariableDeclaration(parent) && parent.name === node) ||
    (ts.isBindingElement(parent) && parent.name === node) ||
    (ts.isParameter(parent) && parent.name === node) ||
    ((ts.isFunctionDeclaration(parent) ||
      ts.isFunctionExpression(parent) ||
      ts.isClassDeclaration(parent) ||
      ts.isClassExpression(parent)) &&
      parent.name === node)
  )
}

function isNonValuePropertyName(node: ts.Identifier): boolean {
  const parent = node.parent
  return (
    (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
    (ts.isPropertyAssignment(parent) && parent.name === node) ||
    (ts.isBindingElement(parent) && parent.propertyName === node) ||
    (ts.isPropertyDeclaration(parent) && parent.name === node) ||
    (ts.isMethodDeclaration(parent) && parent.name === node)
  )
}

function isExactPromisifiedChildProcessAlias(
  expression: ts.Expression,
  bindings: SourceBindings,
): boolean {
  const argument = outerRuntimeExpression(expression)
  const call = argument.parent
  if (
    !ts.isCallExpression(call) ||
    call.arguments.length !== 1 ||
    call.arguments[0] !== argument ||
    !ts.isIdentifier(call.expression) ||
    !bindings.promisify.has(call.expression.text)
  ) {
    return false
  }
  const initializer = outerRuntimeExpression(call)
  const declaration = initializer.parent
  if (
    !ts.isVariableDeclaration(declaration) ||
    declaration.initializer !== initializer ||
    !ts.isIdentifier(declaration.name)
  ) {
    return false
  }
  const api = apiForCall(unwrapRuntimeExpression(argument), bindings)
  return (
    api?.startsWith('child_process.') === true &&
    bindings.apiByIdentifier.get(declaration.name.text) === api
  )
}

function isExplicitBoundApiUse(node: ts.Identifier, bindings: SourceBindings): boolean {
  const parent = node.parent
  if (
    bindings.apiByIdentifier.get(node.text) === 'ignored.fs.constants' &&
    (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
    parent.expression === node &&
    staticMemberName(parent) !== null
  ) {
    return true
  }
  const expression = outerRuntimeExpression(node)
  if (ts.isCallExpression(expression.parent) && expression.parent.expression === expression) {
    return true
  }
  if (
    ts.isVariableDeclaration(expression.parent) &&
    expression.parent.initializer === expression &&
    ts.isIdentifier(expression.parent.name) &&
    bindings.apiByIdentifier.has(expression.parent.name.text)
  ) {
    return true
  }
  return isExactPromisifiedChildProcessAlias(node, bindings)
}

function isExplicitNamespaceUse(node: ts.Identifier, bindings: SourceBindings): boolean {
  const directExpression = outerRuntimeExpression(node)
  const directParent = directExpression.parent
  if (
    ts.isVariableDeclaration(directParent) &&
    directParent.initializer === directExpression &&
    ts.isIdentifier(directParent.name) &&
    (bindings.filesystemNamespace.has(directParent.name.text) ||
      bindings.childProcessNamespace.has(directParent.name.text))
  ) {
    return true
  }
  let current: ts.Expression = directExpression
  while (true) {
    current = outerRuntimeExpression(current)
    const member = current.parent
    if (
      (!ts.isPropertyAccessExpression(member) && !ts.isElementAccessExpression(member)) ||
      member.expression !== current
    ) {
      break
    }
    current = member
    const api = apiForCall(current, bindings)
    if (!api || api === 'ignored.fs.promises') continue
    if (api.startsWith('unsupported.')) {
      const expression = outerRuntimeExpression(current)
      return ts.isCallExpression(expression.parent) && expression.parent.expression === expression
    }
    if (
      api.startsWith('child_process.') &&
      isExactPromisifiedChildProcessAlias(current, bindings)
    ) {
      return true
    }
    if (api === 'ignored.fs.constants') {
      const constantExpression = outerRuntimeExpression(current)
      const constantMember = constantExpression.parent
      return (
        (ts.isPropertyAccessExpression(constantMember) ||
          ts.isElementAccessExpression(constantMember)) &&
        constantMember.expression === constantExpression &&
        staticMemberName(constantMember) !== null
      )
    }
    const expression = outerRuntimeExpression(current)
    const parent = expression.parent
    if (ts.isCallExpression(parent) && parent.expression === expression) return true
    if (
      ts.isVariableDeclaration(parent) &&
      parent.initializer === expression &&
      ts.isIdentifier(parent.name) &&
      bindings.apiByIdentifier.has(parent.name.text)
    ) {
      return true
    }
    return false
  }
  current = outerRuntimeExpression(current)
  return (
    apiForCall(current, bindings) === 'ignored.fs.promises' &&
    ts.isVariableDeclaration(current.parent) &&
    current.parent.initializer === current &&
    ts.isIdentifier(current.parent.name) &&
    bindings.filesystemNamespace.has(current.parent.name.text)
  )
}

function validateRuntimeBindingUses(sourceFile: ts.SourceFile, bindings: SourceBindings): void {
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) {
      const isNamespace =
        bindings.filesystemNamespace.has(node.text) || bindings.childProcessNamespace.has(node.text)
      const isApi = bindings.apiByIdentifier.has(node.text)
      if (
        (isNamespace || isApi) &&
        !isTypeOnlyRuntimeReference(node) &&
        !isRuntimeBindingDeclarationName(node) &&
        !isNonValuePropertyName(node) &&
        !(isNamespace
          ? isExplicitNamespaceUse(node, bindings)
          : isExplicitBoundApiUse(node, bindings))
      ) {
        throw new Error(
          `Unsupported protected runtime binding escape in ${sourceFile.fileName}: ${node.text}`,
        )
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
}

function isProcessCwd(node: ts.Expression): boolean {
  return (
    ts.isCallExpression(node) &&
    node.arguments.length === 0 &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === 'process' &&
    node.expression.name.text === 'cwd'
  )
}

function staticPathExpression(input: {
  bindings: SourceBindings
  cwd: string
  expression: ts.Expression
  importerAbsolute: string
}): string | null {
  const { expression } = input
  if (ts.isStringLiteralLike(expression)) {
    return expression.text
  }
  if (isProcessCwd(expression)) return input.cwd
  if (
    ts.isNewExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === 'URL' &&
    expression.arguments?.length === 2 &&
    ts.isStringLiteralLike(expression.arguments[0]!) &&
    isImportMetaUrl(expression.arguments[1]!)
  ) {
    return resolve(dirname(input.importerAbsolute), expression.arguments[0]!.text)
  }
  if (ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)) {
    if (
      input.bindings.fileUrlToPath.has(expression.expression.text) &&
      expression.arguments.length === 1
    ) {
      return staticPathExpression({ ...input, expression: expression.arguments[0]! })
    }
    const pathFunction = input.bindings.pathFunctions.get(expression.expression.text)
    if (pathFunction) {
      const values = expression.arguments.map((argument) =>
        staticPathExpression({ ...input, expression: argument }),
      )
      if (values.some((value) => value === null)) return null
      const resolvedValues = values as string[]
      if (pathFunction === 'dirname' && resolvedValues.length === 1) {
        return dirname(resolvedValues[0]!)
      }
      if (pathFunction === 'join') return joinPath(...resolvedValues)
      if (pathFunction === 'resolve') return resolve(input.cwd, ...resolvedValues)
    }
  }
  if (
    ts.isCallExpression(expression) &&
    ts.isPropertyAccessExpression(expression.expression) &&
    ts.isIdentifier(expression.expression.expression) &&
    input.bindings.pathNamespaces.has(expression.expression.expression.text)
  ) {
    const method = expression.expression.name.text
    if (!['dirname', 'join', 'resolve'].includes(method)) return null
    const values = expression.arguments.map((argument) =>
      staticPathExpression({ ...input, expression: argument }),
    )
    if (values.some((value) => value === null)) return null
    const resolvedValues = values as string[]
    if (method === 'dirname' && resolvedValues.length === 1) return dirname(resolvedValues[0]!)
    if (method === 'join') return joinPath(...resolvedValues)
    return resolve(input.cwd, ...resolvedValues)
  }
  return null
}

function staticPathValue(input: {
  bindings: SourceBindings
  cwd: string
  expression: ts.Expression
  importerAbsolute: string
}): string | null {
  const value = staticPathExpression(input)
  return value === null ? null : resolve(input.cwd, value)
}

function staticStringArray(node: ts.Expression | undefined): string[] | null {
  if (!node || !ts.isArrayLiteralExpression(node)) return null
  const values: string[] = []
  for (const element of node.elements) {
    if (!ts.isStringLiteralLike(element)) return null
    values.push(element.text)
  }
  return values
}

function callSiteFingerprint(input: {
  api: string
  callText: string
  duplicateOrdinal: number
  sourcePath: string
}): { expressionSha256: string; fingerprint: string } {
  const expressionSha256 = sha256(input.callText)
  return {
    expressionSha256,
    fingerprint: sha256(
      canonicalJson({
        api: input.api,
        duplicateOrdinal: input.duplicateOrdinal,
        expressionSha256,
        sourcePath: input.sourcePath,
      }),
    ),
  }
}

function staticProcessDisposition(input: {
  api: string
  arguments_: readonly string[]
  command: string
  cwd: string
  trackedPaths: ReadonlySet<string>
}): Pick<
  DiscoveredProtectedV2RuntimeCallSite,
  'staticDisposition' | 'staticExecutables' | 'staticPackages' | 'staticRepositoryInputs'
> {
  const executable = input.command.replaceAll('\\', '/')
  const repositoryInputs: string[] = []
  const packages: string[] = []
  if (input.api === 'child_process.fork') {
    if (!/\.[cm]?[jt]sx?$/u.test(input.command)) {
      throw new Error(`Protected child-process fork target is unsupported: ${input.command}`)
    }
    repositoryInputs.push(
      canonicalRepositoryPath({
        absolutePath: resolve(input.cwd, input.command),
        cwd: input.cwd,
        label: 'Protected forked repository entry point',
        trackedPaths: input.trackedPaths,
      }),
    )
    return {
      staticDisposition: 'repository_entry_point',
      staticExecutables: ['node'],
      staticPackages: [],
      staticRepositoryInputs: repositoryInputs,
    }
  }
  if (executable === 'node' || executable === 'tsx') {
    const entry = input.arguments_.find((argument) => /\.(?:[cm]?[jt]sx?)$/u.test(argument))
    if (entry) {
      repositoryInputs.push(
        canonicalRepositoryPath({
          absolutePath: resolve(input.cwd, entry),
          cwd: input.cwd,
          label: 'Protected spawned repository entry point',
          trackedPaths: input.trackedPaths,
        }),
      )
    }
    if (executable === 'tsx') packages.push('tsx')
    return {
      staticDisposition:
        repositoryInputs.length > 0 ? 'repository_entry_point' : 'system_executable',
      staticExecutables: [executable],
      staticPackages: packages,
      staticRepositoryInputs: repositoryInputs,
    }
  }
  const nodeModulesMatch = executable.match(/(?:^|\/)node_modules\/\.bin\/([^/]+)$/u)
  if (nodeModulesMatch) {
    return {
      staticDisposition: 'lock_bound_executable',
      staticExecutables: [executable],
      staticPackages: [nodeModulesMatch[1]!],
      staticRepositoryInputs: [],
    }
  }
  if (!SYSTEM_EXECUTABLES.has(executable)) {
    throw new Error(`Unsupported protected child-process executable: ${input.command}`)
  }
  return {
    staticDisposition: 'system_executable',
    staticExecutables: [executable],
    staticPackages: [],
    staticRepositoryInputs: [],
  }
}

export function discoverProtectedV2RuntimeCallSites(
  input: DiscoverProtectedV2RuntimeCallSitesInput,
): DiscoveredProtectedV2RuntimeCallSite[] {
  const cwd = realpathSync(resolve(input.cwd))
  const discovered: DiscoveredProtectedV2RuntimeCallSite[] = []
  for (const sourcePath of [...new Set(input.sourcePaths)].sort(compareCodeUnits)) {
    if (!isSafeProtectedV2RepositoryPath(sourcePath)) {
      throw new Error(`Protected runtime source path is unsafe: ${sourcePath}`)
    }
    const importerAbsolute = resolve(cwd, sourcePath)
    canonicalRepositoryPath({
      absolutePath: importerAbsolute,
      cwd,
      label: 'Protected runtime source',
      trackedPaths: input.trackedPaths,
    })
    if (!/\.[cm]?[jt]sx?$/u.test(sourcePath)) continue
    const sourceText = readFileSync(importerAbsolute, 'utf8')
    const sourceFile = ts.createSourceFile(
      importerAbsolute,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      scriptKind(sourcePath),
    )
    const parseDiagnostics = (
      sourceFile as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }
    ).parseDiagnostics
    if (parseDiagnostics && parseDiagnostics.length > 0) {
      throw new Error(`Protected runtime source cannot be statically inspected: ${sourcePath}`)
    }
    const bindings = collectSourceBindings(sourceFile)
    const duplicateOrdinals = new Map<string, number>()
    const record = (
      api: string,
      node: ts.CallExpression | ts.NewExpression,
      staticResult: Omit<
        DiscoveredProtectedV2RuntimeCallSite,
        'api' | 'callText' | 'expressionSha256' | 'fingerprint' | 'sourcePath'
      >,
    ): void => {
      const callText = node.getText(sourceFile)
      const duplicateKey = canonicalJson({ api, callText })
      const duplicateOrdinal = duplicateOrdinals.get(duplicateKey) ?? 0
      duplicateOrdinals.set(duplicateKey, duplicateOrdinal + 1)
      const identities = callSiteFingerprint({ api, callText, duplicateOrdinal, sourcePath })
      discovered.push({ api, callText, sourcePath, ...identities, ...staticResult })
    }
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const api = apiForCall(node.expression, bindings)
        if (api?.startsWith('unsupported.')) {
          throw new Error(`Unsupported protected runtime input API: ${api}`)
        }
        if (!api && expressionContainsRuntimeNamespace(node.expression, bindings)) {
          throw new Error(
            `Unsupported aliased or computed filesystem/child-process call in ${sourcePath}.`,
          )
        }
        if (api?.startsWith('fs.') || api === 'process.chdir') {
          const pathExpression = node.arguments[0]
          const path = pathExpression
            ? staticPathValue({
                bindings,
                cwd,
                expression: pathExpression,
                importerAbsolute,
              })
            : null
          if (path && isWithin(cwd, path)) {
            const candidate = relative(cwd, path).split(sep).join('/')
            if (isSafeProtectedV2RepositoryPath(candidate) && input.trackedPaths.has(candidate)) {
              const repositoryInput = canonicalRepositoryPath({
                absolutePath: path,
                cwd,
                label: `${api} static repository input`,
                trackedPaths: input.trackedPaths,
              })
              record(api, node, {
                nonliteral: false,
                staticDisposition: 'repository_input',
                staticExecutables: [],
                staticPackages: [],
                staticRepositoryInputs: [repositoryInput],
              })
            } else if (candidate !== '') {
              throw new Error(
                `${api} statically resolved repository path is not an exact Git-tracked file: ${candidate}`,
              )
            } else {
              record(api, node, {
                nonliteral: true,
                staticDisposition: null,
                staticExecutables: [],
                staticPackages: [],
                staticRepositoryInputs: [],
              })
            }
          } else if (path) {
            record(api, node, {
              nonliteral: false,
              staticDisposition: 'operator_evidence',
              staticExecutables: [],
              staticPackages: [],
              staticRepositoryInputs: [],
            })
          } else {
            record(api, node, {
              nonliteral: true,
              staticDisposition: null,
              staticExecutables: [],
              staticPackages: [],
              staticRepositoryInputs: [],
            })
          }
        } else if (api?.startsWith('child_process.')) {
          const command = node.arguments[0]
          const arguments_ = node.arguments.length < 2 ? [] : staticStringArray(node.arguments[1])
          if (command && ts.isStringLiteralLike(command) && arguments_) {
            record(api, node, {
              nonliteral: false,
              ...staticProcessDisposition({
                api,
                arguments_,
                command: command.text,
                cwd,
                trackedPaths: input.trackedPaths,
              }),
            })
          } else {
            record(api, node, {
              nonliteral: true,
              staticDisposition: null,
              staticExecutables: [],
              staticPackages: [],
              staticRepositoryInputs: [],
            })
          }
        }
      } else if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'URL' &&
        node.arguments?.length === 2 &&
        isImportMetaUrl(node.arguments[1]!)
      ) {
        const path = staticPathValue({ bindings, cwd, expression: node, importerAbsolute })
        if (!path) {
          record('url.import_meta', node, {
            nonliteral: true,
            staticDisposition: null,
            staticExecutables: [],
            staticPackages: [],
            staticRepositoryInputs: [],
          })
        } else {
          const repositoryInput = canonicalRepositoryPath({
            absolutePath: path,
            cwd,
            label: 'new URL(..., import.meta.url) repository input',
            trackedPaths: input.trackedPaths,
          })
          record('url.import_meta', node, {
            nonliteral: false,
            staticDisposition: 'repository_input',
            staticExecutables: [],
            staticPackages: [],
            staticRepositoryInputs: [repositoryInput],
          })
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
  }
  return discovered.sort((left, right) =>
    compareCodeUnits(canonicalJson(left), canonicalJson(right)),
  )
}

function packageInventory(input: {
  cwd: string
  packageJsonPath: string
  packageLockPath: string
  trackedPaths: ReadonlySet<string>
}): {
  boundPackages: Set<string>
  packageJson: Record<string, unknown>
} {
  return loadProtectedV2PackageInventory(input)
}

function tokenizePackageScript(command: string): string[] {
  if (/[$`;&|<>\n\r]/u.test(command)) {
    throw new Error(`Protected package script uses unsupported shell syntax: ${command}`)
  }
  const tokens = command.match(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\S+/gu) ?? []
  return tokens.map((token) => {
    if (
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'"))
    ) {
      return token.slice(1, -1)
    }
    return token
  })
}

function inspectPackageScript(input: {
  boundPackages: ReadonlySet<string>
  command: string
  declaration: ProtectedV2PackageScriptDeclaration
  sealedPaths: ReadonlySet<string>
}): void {
  const tokens = tokenizePackageScript(input.command)
  let offset = 0
  let primaryGuard = false
  if (tokens[0] === 'node' && tokens[1] === 'scripts/require-primary-checkout.mjs') {
    if (tokens[2] !== '--') {
      throw new Error(
        `Protected package script ${input.declaration.name} has a malformed primary guard.`,
      )
    }
    primaryGuard = true
    offset = 3
  }
  if (primaryGuard !== input.declaration.requiresPrimaryCheckout) {
    throw new Error(
      `Protected package script primary-checkout guard drifted: ${input.declaration.name}`,
    )
  }
  const runner = tokens[offset]
  const entryPoint = tokens[offset + 1]
  if (runner !== 'tsx' || entryPoint !== input.declaration.entryPoint) {
    throw new Error(`Protected package script entry point drifted: ${input.declaration.name}`)
  }
  if (canonicalJson(tokens.slice(offset + 2)) !== canonicalJson(input.declaration.arguments)) {
    throw new Error(`Protected package script arguments drifted: ${input.declaration.name}`)
  }
  if (!input.boundPackages.has('tsx')) {
    throw new Error('Protected package script runner tsx is not package-lock bound.')
  }
  for (const path of [
    ...(primaryGuard ? ['scripts/require-primary-checkout.mjs'] : []),
    input.declaration.entryPoint,
  ]) {
    if (!input.sealedPaths.has(path)) {
      throw new Error(`Protected package script repository entry point is not sealed: ${path}`)
    }
  }
}

function normalizeCallSiteDeclaration(
  declaration: ProtectedV2RuntimeCallSiteDeclaration,
): ProtectedV2RuntimeInputCallSiteRecord {
  const values = {
    api: declaration.api,
    disposition: declaration.disposition,
    executables: [...declaration.executables].sort(compareCodeUnits),
    fingerprint: declaration.fingerprint,
    packages: [...declaration.packages].sort(compareCodeUnits),
    repositoryInputs: [...declaration.repositoryInputs].sort(compareCodeUnits),
    sourcePath: declaration.sourcePath,
  }
  if (
    !isSafeProtectedV2RepositoryPath(values.sourcePath) ||
    !PROTECTED_V2_RUNTIME_CALL_SITE_DISPOSITIONS.has(values.disposition) ||
    !/^[a-f0-9]{64}$/u.test(values.fingerprint) ||
    values.api.length === 0 ||
    values.executables.some(
      (executable) => typeof executable !== 'string' || !/^[A-Za-z0-9@._/+\\-]+$/u.test(executable),
    ) ||
    values.packages.some(
      (packageName) =>
        typeof packageName !== 'string' || !/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/u.test(packageName),
    ) ||
    new Set(values.executables).size !== values.executables.length ||
    new Set(values.packages).size !== values.packages.length ||
    new Set(values.repositoryInputs).size !== values.repositoryInputs.length ||
    values.repositoryInputs.some((path) => !isSafeProtectedV2RepositoryPath(path))
  ) {
    throw new Error('Protected runtime-input call-site declaration is malformed.')
  }
  const noExecutables = values.executables.length === 0
  const noPackages = values.packages.length === 0
  const noRepositoryInputs = values.repositoryInputs.length === 0
  if (
    (values.disposition === 'repository_input' &&
      (noRepositoryInputs || !noExecutables || !noPackages)) ||
    (values.disposition === 'repository_entry_point' && (noRepositoryInputs || noExecutables)) ||
    (values.disposition === 'lock_bound_executable' &&
      (noExecutables || noPackages || !noRepositoryInputs)) ||
    (values.disposition === 'system_executable' &&
      (noExecutables ||
        !noPackages ||
        !noRepositoryInputs ||
        values.executables.some((executable) => !SYSTEM_EXECUTABLES.has(executable)))) ||
    ([
      'generated_local_state',
      'operator_evidence',
      'repository_metadata',
      'tracked_repository_inventory',
    ].includes(values.disposition) &&
      (!noExecutables || !noPackages || !noRepositoryInputs))
  ) {
    throw new Error('Protected runtime-input call-site disposition is not narrowly declared.')
  }
  return values
}

export function validateProtectedV2RuntimeInputAudit(input: unknown): ProtectedV2RuntimeInputAudit {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Protected runtime-input audit must be an object.')
  }
  const audit = input as Partial<ProtectedV2RuntimeInputAudit>
  if (
    audit.schemaVersion !== PROTECTED_V2_RUNTIME_INPUT_AUDIT_SCHEMA_VERSION ||
    !Array.isArray(audit.callSites) ||
    !Array.isArray(audit.packageScripts) ||
    !Array.isArray(audit.repositoryInputs) ||
    typeof audit.declarationSha256 !== 'string' ||
    typeof audit.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(audit.declarationSha256) ||
    !/^[a-f0-9]{64}$/u.test(audit.sha256)
  ) {
    throw new Error('Protected runtime-input audit shape or identity drifted.')
  }
  if (
    audit.repositoryInputs.some(
      (path) => typeof path !== 'string' || !isSafeProtectedV2RepositoryPath(path),
    ) ||
    new Set(audit.repositoryInputs).size !== audit.repositoryInputs.length ||
    canonicalJson(audit.repositoryInputs) !==
      canonicalJson([...audit.repositoryInputs].sort(compareCodeUnits))
  ) {
    throw new Error('Protected runtime-input repository inventory is unsafe or unordered.')
  }
  const callSites = audit.callSites.map(normalizeCallSiteDeclaration)
  const packageScripts = audit.packageScripts.map((record) => {
    if (
      !record ||
      typeof record !== 'object' ||
      !Array.isArray(record.arguments) ||
      record.arguments.some((argument) => typeof argument !== 'string') ||
      typeof record.commandSha256 !== 'string' ||
      !/^[a-f0-9]{64}$/u.test(record.commandSha256) ||
      typeof record.entryPoint !== 'string' ||
      !isSafeProtectedV2RepositoryPath(record.entryPoint) ||
      typeof record.name !== 'string' ||
      record.name.length === 0 ||
      typeof record.requiresPrimaryCheckout !== 'boolean'
    ) {
      throw new Error('Protected runtime-input package-script audit record is malformed.')
    }
    return {
      arguments: [...record.arguments],
      commandSha256: record.commandSha256,
      entryPoint: record.entryPoint,
      name: record.name,
      requiresPrimaryCheckout: record.requiresPrimaryCheckout,
    }
  })
  if (
    canonicalJson(callSites) !==
      canonicalJson(
        [...callSites].sort((left, right) =>
          compareCodeUnits(canonicalJson(left), canonicalJson(right)),
        ),
      ) ||
    canonicalJson(packageScripts) !==
      canonicalJson(
        [...packageScripts].sort((left, right) =>
          compareCodeUnits(canonicalJson(left), canonicalJson(right)),
        ),
      )
  ) {
    throw new Error('Protected runtime-input audit records are not canonically ordered.')
  }
  if (
    new Set(callSites.map(({ fingerprint }) => fingerprint)).size !== callSites.length ||
    new Set(packageScripts.map(({ name }) => name)).size !== packageScripts.length
  ) {
    throw new Error('Protected runtime-input audit declarations drifted or are duplicated.')
  }
  const callSiteRepositoryInputs = [
    ...new Set(callSites.flatMap(({ repositoryInputs }) => repositoryInputs)),
  ].sort(compareCodeUnits)
  if (canonicalJson(callSiteRepositoryInputs) !== canonicalJson(audit.repositoryInputs)) {
    throw new Error('Protected runtime-input repository inventory does not match its call sites.')
  }
  const content = {
    callSites,
    declarationSha256: audit.declarationSha256,
    packageScripts,
    repositoryInputs: audit.repositoryInputs as string[],
    schemaVersion: PROTECTED_V2_RUNTIME_INPUT_AUDIT_SCHEMA_VERSION,
  }
  if (sha256(canonicalJson(content)) !== audit.sha256) {
    throw new Error('Protected runtime-input audit identity is invalid.')
  }
  return { ...content, sha256: audit.sha256 }
}

export function buildProtectedV2RuntimeInputAudit(
  input: BuildProtectedV2RuntimeInputAuditInput,
): ProtectedV2RuntimeInputAudit {
  const cwd = realpathSync(resolve(input.cwd))
  const packageScripts = input.packageScripts ?? PROTECTED_V2_PACKAGE_SCRIPT_DECLARATIONS
  const callSiteDeclarations =
    input.callSiteDeclarations ?? PROTECTED_V2_RUNTIME_CALL_SITE_DECLARATIONS
  const inventory = packageInventory({
    cwd,
    packageJsonPath: input.packageJsonPath,
    packageLockPath: input.packageLockPath,
    trackedPaths: input.trackedPaths,
  })
  const scripts = inventory.packageJson.scripts
  if (!scripts || typeof scripts !== 'object' || Array.isArray(scripts)) {
    throw new Error('Protected package manifest has no scripts object.')
  }
  const packageScriptRecords = packageScripts.map((declaration) => {
    const command = (scripts as Record<string, unknown>)[declaration.name]
    if (typeof command !== 'string') {
      throw new Error(`Protected package script is absent: ${declaration.name}`)
    }
    inspectPackageScript({
      boundPackages: inventory.boundPackages,
      command,
      declaration,
      sealedPaths: input.sealedPaths,
    })
    return {
      arguments: [...declaration.arguments],
      commandSha256: sha256(command),
      entryPoint: declaration.entryPoint,
      name: declaration.name,
      requiresPrimaryCheckout: declaration.requiresPrimaryCheckout,
    }
  })
  packageScriptRecords.sort((left, right) =>
    compareCodeUnits(canonicalJson(left), canonicalJson(right)),
  )

  const discovered = discoverProtectedV2RuntimeCallSites({
    cwd,
    sourcePaths: input.sourcePaths,
    trackedPaths: input.trackedPaths,
  })
  const declarations = new Map<string, ProtectedV2RuntimeInputCallSiteRecord>()
  for (const raw of callSiteDeclarations) {
    const declaration = normalizeCallSiteDeclaration(raw)
    if (declarations.has(declaration.fingerprint)) {
      throw new Error(`Duplicate protected runtime-input declaration: ${declaration.fingerprint}`)
    }
    declarations.set(declaration.fingerprint, declaration)
  }
  const repositoryInputs = new Set<string>()
  const callSites = discovered.map((callSite): ProtectedV2RuntimeInputCallSiteRecord => {
    if (!callSite.nonliteral) {
      for (const path of callSite.staticRepositoryInputs) {
        if (!input.sealedPaths.has(path)) {
          throw new Error(`Statically resolved protected repository input is not sealed: ${path}`)
        }
        repositoryInputs.add(path)
      }
      for (const packageName of callSite.staticPackages) {
        if (!inventory.boundPackages.has(packageName)) {
          throw new Error(`Protected executable package is not lock-bound: ${packageName}`)
        }
      }
      return {
        api: callSite.api,
        disposition: callSite.staticDisposition!,
        executables: callSite.staticExecutables,
        fingerprint: callSite.fingerprint,
        packages: callSite.staticPackages,
        repositoryInputs: callSite.staticRepositoryInputs,
        sourcePath: callSite.sourcePath,
      }
    }
    const declaration = declarations.get(callSite.fingerprint)
    if (
      !declaration ||
      declaration.api !== callSite.api ||
      declaration.sourcePath !== callSite.sourcePath
    ) {
      throw new Error(
        `Protected nonliteral runtime input has no exact declaration: ${callSite.sourcePath} ${callSite.api} ${callSite.fingerprint}`,
      )
    }
    declarations.delete(callSite.fingerprint)
    for (const path of declaration.repositoryInputs) {
      if (!input.trackedPaths.has(path) || !input.sealedPaths.has(path)) {
        throw new Error(`Declared protected repository input is not tracked and sealed: ${path}`)
      }
      repositoryInputs.add(path)
    }
    for (const packageName of declaration.packages) {
      if (!inventory.boundPackages.has(packageName)) {
        throw new Error(`Declared protected executable package is not lock-bound: ${packageName}`)
      }
    }
    if (
      declaration.disposition === 'repository_input' &&
      declaration.repositoryInputs.length === 0
    ) {
      throw new Error('Repository-input disposition requires at least one exact repository path.')
    }
    if (
      declaration.disposition === 'repository_entry_point' &&
      declaration.repositoryInputs.length === 0
    ) {
      throw new Error(
        'Repository-entry-point disposition requires at least one exact repository path.',
      )
    }
    if (declaration.disposition === 'lock_bound_executable' && declaration.packages.length === 0) {
      throw new Error('Lock-bound executable disposition requires at least one exact package.')
    }
    if (declaration.disposition === 'system_executable' && declaration.executables.length === 0) {
      throw new Error('System-executable disposition requires at least one exact executable.')
    }
    return declaration
  })
  if (declarations.size > 0) {
    throw new Error(
      `Protected runtime-input declaration contains stale call sites: ${[...declarations.keys()].sort(compareCodeUnits).join(', ')}`,
    )
  }
  callSites.sort((left, right) => compareCodeUnits(canonicalJson(left), canonicalJson(right)))

  const declarationSha256 = sha256(
    canonicalJson({
      callSites: callSiteDeclarations,
      explicitRoots: PROTECTED_V2_EXPLICIT_RUNTIME_ROOTS,
      packageScripts,
      protectedDirectories: PROTECTED_V2_PROTECTED_DIRECTORIES,
      runtimeEntryPoints: PROTECTED_V2_RUNTIME_ENTRY_POINTS,
      schemaVersion: PROTECTED_V2_RUNTIME_INPUT_DECLARATION_SCHEMA_VERSION,
    }),
  )
  const content = {
    callSites,
    declarationSha256,
    packageScripts: packageScriptRecords,
    repositoryInputs: [...repositoryInputs].sort(compareCodeUnits),
    schemaVersion: PROTECTED_V2_RUNTIME_INPUT_AUDIT_SCHEMA_VERSION,
  }
  return validateProtectedV2RuntimeInputAudit({
    ...content,
    sha256: sha256(canonicalJson(content)),
  })
}
