/** @jest-environment node */

import { createHash } from 'node:crypto'

import {
  TRUSTED_LOCAL_SUPABASE_ROLE_NAMES,
  buildExpectedContractRpcs,
  loadExpectedSchemaSecurityIdentity,
  trustedLocalDeploymentProfileEvidence,
} from './gold-import-compensation-contract-expectations'

describe('gold import-compensation contract expectations', () => {
  it('uses an ordinary SHA-256 digest for both normalized and raw RPC definitions', async () => {
    const identity = await loadExpectedSchemaSecurityIdentity(process.cwd())
    const rpcs = buildExpectedContractRpcs(identity)

    expect(rpcs.map(({ name }) => name)).toEqual([
      'apply_literature_gold_import_v1',
      'compensate_literature_gold_import_v1',
      'reconcile_literature_gold_review_operation_v1',
    ])
    for (const rpc of rpcs) {
      expect(rpc.definitionSha256).toBe(
        createHash('sha256').update(rpc.normalizedDefinition).digest('hex'),
      )
      expect(rpc.rawDefinitionSha256).toBe(
        createHash('sha256').update(rpc.rawDefinition).digest('hex'),
      )
    }
  })

  it('rejects any role set outside the exact checksum-pinned local inventory', () => {
    expect(TRUSTED_LOCAL_SUPABASE_ROLE_NAMES).toEqual([
      'anon',
      'authenticated',
      'postgres',
      'service_role',
      'supabase_admin',
    ])
    expect(() => trustedLocalDeploymentProfileEvidence([])).toThrow(
      /must contain exactly anon, authenticated, postgres, service_role, supabase_admin/iu,
    )
  })
})
