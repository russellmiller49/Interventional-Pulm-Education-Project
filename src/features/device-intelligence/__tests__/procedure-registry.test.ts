import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  D1_EXEMPLAR_PROCEDURE_CODES,
  isExemplarProcedureCode,
} from '@/features/device-intelligence/domain/exemplars'
import {
  getCoverageLadderForProcedure,
  getExemplarProcedureIndex,
  getProcedureReadinessView,
  getProcedureWorkspace,
} from '@/features/device-intelligence/server/procedures.server'

const audit = JSON.parse(
  readFileSync(
    join(__dirname, '../../../../docs/ip-device-intelligence/data-readiness-audit.json'),
    'utf8',
  ),
) as {
  procedures: {
    code: string
    status: string
    slots: {
      total: number
      requiredness: { required: number; contingency: number; optional: number }
      rescueSectionSlotCount: number
      rescueModulesReachable: string[]
    }
    roleCoverage: {
      roles: { roleCode: string; slotCount: number; coverage: string; demoStandIn: boolean }[]
    }
    compatibility: {
      resolvedRulesTouchingProcedure: { total: number; ruleIds: string[] }
    }
  }[]
}

describe('D1 procedure registry', () => {
  it('serves exactly the three exemplar codes', () => {
    expect([...D1_EXEMPLAR_PROCEDURE_CODES].sort()).toEqual([
      'CHEST_TUBE',
      'EBUS_TBNA',
      'THERAPEUTIC_BRONCH',
    ])
    const index = getExemplarProcedureIndex()
    expect(index.map((entry) => entry.procedureCode).sort()).toEqual([
      'CHEST_TUBE',
      'EBUS_TBNA',
      'THERAPEUTIC_BRONCH',
    ])
  })

  it('rejects every other procedure code on workspace and readiness', () => {
    for (const code of [
      'BRONCH_ABLATION',
      'BRONCH_DIAGNOSTIC',
      'THORACENTESIS',
      'IPC_PLACEMENT',
      'nonsense',
      'ebus_tbna',
      '',
    ]) {
      expect(isExemplarProcedureCode(code)).toBe(false)
      expect(getProcedureWorkspace(code)).toBeNull()
      expect(getProcedureReadinessView(code)).toBeNull()
    }
  })

  it('derives slot counts and requiredness that match the deterministic audit', () => {
    const index = getExemplarProcedureIndex()
    for (const procedure of audit.procedures) {
      const entry = index.find((candidate) => candidate.procedureCode === procedure.code)
      expect(entry).toBeDefined()
      expect(entry!.slotCount).toBe(procedure.slots.total)
      expect(entry!.requiredness).toEqual(procedure.slots.requiredness)
      expect(entry!.status).toBe(procedure.status)
    }
  })

  it('derives the coverage ladder that matches the audit per role', () => {
    for (const procedure of audit.procedures) {
      const ladder = getCoverageLadderForProcedure(
        procedure.code as (typeof D1_EXEMPLAR_PROCEDURE_CODES)[number],
      )
      expect(
        ladder.roles.map((role) => ({
          roleCode: role.roleCode,
          slotCount: role.slotCount,
          coverage: role.coverage,
          demoStandIn: role.demoStandIn,
        })),
      ).toEqual(procedure.roleCoverage.roles)
    }
  })

  it('renders workspaces from derived data with the audit slot totals', () => {
    for (const procedure of audit.procedures) {
      const workspace = getProcedureWorkspace(procedure.code)
      expect(workspace).not.toBeNull()
      expect(workspace!.requirements.length).toBe(procedure.slots.total)
      expect(workspace!.rescueSectionSlotCount).toBe(procedure.slots.rescueSectionSlotCount)
      expect(workspace!.rescueModules.map((rescueModule) => rescueModule.code).sort()).toEqual(
        [...procedure.slots.rescueModulesReachable].sort(),
      )
      // The verbatim status string reaches the page unchanged.
      expect(workspace!.status).toBe(procedure.status)
      // Release identity comes from the pointer, never sorted or guessed.
      expect(workspace!.releaseBundleId).toMatch(/^release-/)
      expect(workspace!.clinicalOwner).toBeNull()
    }
  })

  it('surfaces exactly the audit-matched raw compatibility statements per procedure', () => {
    for (const procedure of audit.procedures) {
      const workspace = getProcedureWorkspace(procedure.code)!
      expect(
        workspace.rawCompatibilityStatements.map((statement) => statement.ruleId).sort(),
      ).toEqual([...procedure.compatibility.resolvedRulesTouchingProcedure.ruleIds].sort())
    }
  })
})
