import { readFile } from 'node:fs/promises'
import path from 'node:path'

import {
  computeDataReadiness,
  loadInputs,
  serializeReport,
  type DataReadinessInputs,
} from '../audit-data-readiness'

const OUTPUT_PATH = path.resolve('docs/ip-device-intelligence/data-readiness-audit.json')

let inputs: DataReadinessInputs

beforeAll(async () => {
  inputs = await loadInputs()
})

describe('ip-device-intelligence data-readiness audit', () => {
  it('pins the exemplar slot totals and requiredness breakdowns', () => {
    const report = computeDataReadiness(inputs)
    const byCode = new Map(report.procedures.map((procedure) => [procedure.code, procedure]))

    const ebus = byCode.get('EBUS_TBNA')
    expect(ebus?.slots.total).toBe(15)
    expect(ebus?.slots.requiredness).toEqual({ required: 7, contingency: 4, optional: 4 })

    const therapeutic = byCode.get('THERAPEUTIC_BRONCH')
    expect(therapeutic?.slots.total).toBe(29)
    expect(therapeutic?.slots.requiredness).toEqual({ required: 3, contingency: 21, optional: 5 })

    const chestTube = byCode.get('CHEST_TUBE')
    expect(chestTube?.slots.total).toBe(13)
    expect(chestTube?.slots.requiredness).toEqual({ required: 3, contingency: 7, optional: 3 })
  })

  it('keeps requiredness breakdowns summing to slot totals for every procedure', () => {
    const report = computeDataReadiness(inputs)
    expect(report.procedures).toHaveLength(3)
    for (const procedure of report.procedures) {
      const { required, contingency, optional } = procedure.slots.requiredness
      expect(required + contingency + optional).toBe(procedure.slots.total)
    }
  })

  it('keeps the role-coverage ladder and slot rollup partitioning their totals', () => {
    const report = computeDataReadiness(inputs)
    for (const procedure of report.procedures) {
      const ladder = procedure.roleCoverage.ladder
      expect(
        ladder.rolesWithSelectableAuthoredOption +
          ladder.rolesWithOnlyNonSelectableAuthoredOptions +
          ladder.rolesWithOnlyProposals +
          ladder.rolesWithNoOptionNoProposal.total,
      ).toBe(procedure.roleCoverage.distinctRoles)
      expect(ladder.rolesWithNoOptionNoProposal.total).toBe(
        ladder.rolesWithNoOptionNoProposal.withProductRoleMappingElsewhere +
          ladder.rolesWithNoOptionNoProposal.withNoMappedProduct,
      )

      const rollup = procedure.roleCoverage.slotRollup
      expect(
        rollup.slotsWithSelectableAuthoredOption +
          rollup.slotsWithOnlyNonSelectableAuthoredOptions +
          rollup.slotsWithOnlyProposals +
          rollup.slotsWithNoOptionNoProposal,
      ).toBe(procedure.slots.total)
    }
  })

  it('matches the published ip-cards:validate-data global counts', () => {
    const report = computeDataReadiness(inputs)
    expect(report.global.products).toBe(1532)
    expect(report.global.roles).toBe(135)
    expect(report.global.procedures).toBe(15)
    expect(report.global.procedureSlots).toBe(233)
    expect(report.global.authoredSlotOptions).toBe(2073)
    expect(report.global.slotOptionProposals).toBe(813)
  })

  it('is deterministic: computing twice yields deep-equal reports and identical bytes', async () => {
    const first = computeDataReadiness(inputs)
    const second = computeDataReadiness(inputs)
    expect(second).toEqual(first)
    await expect(serializeReport(second)).resolves.toBe(await serializeReport(first))
  })

  it('detects drift: the committed artifact byte-matches a fresh recomputation', async () => {
    const committed = await readFile(OUTPUT_PATH, 'utf8')
    const fresh = await serializeReport(computeDataReadiness(inputs))
    expect(committed).toBe(fresh)
  })
})
