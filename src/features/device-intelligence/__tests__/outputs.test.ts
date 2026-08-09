import { getProcedureOutputPreviews } from '@/features/device-intelligence/server/outputs.server'
import { getProcedureWorkspace } from '@/features/device-intelligence/server/procedures.server'

describe('read-only output previews', () => {
  const workspace = () => getProcedureWorkspace('CHEST_TUBE')!
  const previews = () => {
    const ws = workspace()
    return getProcedureOutputPreviews(ws.procedureCode, ws.scenarioId, ws.formularySummary)!
  }

  it('projects all four previews from one underlying resolved item set', () => {
    const outputs = previews()
    const roomIds = outputs.roomSetup.flatMap((group) => group.lines.map((line) => line.itemId))
    const nursingIds = outputs.nursing.flatMap((group) =>
      group.phases.flatMap((phase) => phase.lines.map((line) => line.itemId)),
    )
    const trainingIds = outputs.training.flatMap((group) => group.lines.map((line) => line.itemId))
    expect([...roomIds].sort()).toEqual([...nursingIds].sort())
    expect([...roomIds].sort()).toEqual([...trainingIds].sort())
    // The gap preview runs over the same resolution result.
    expect(outputs.gaps.projection.requirements.map((r) => r.itemId).sort()).toEqual(
      [...roomIds].sort(),
    )
  })

  it('is content-identical across repeated requests (determinism, no persistence)', () => {
    expect(JSON.stringify(previews())).toEqual(JSON.stringify(previews()))
  })

  it('quotes only authored text in the training view', () => {
    const outputs = previews()
    for (const group of outputs.training) {
      for (const line of group.lines) {
        expect(typeof line.genericRequirement).toBe('string')
        expect(line.genericRequirement.length).toBeGreaterThan(0)
      }
    }
  })

  it('reports the structural gaps and the empty formulary honestly', () => {
    const outputs = previews()
    expect(outputs.gaps.proposalsOnlyRoles).toEqual(['GENERIC_SUCTION'])
    expect(outputs.gaps.unmappedRoles).toEqual(['DRESSING_SECUREMENT'])
    expect(outputs.gaps.formularySummary.carriedRows).toBe(0)
    expect(outputs.gaps.formularySummary.preferredRows).toBe(0)
    // Audit-pinned dimension gap count for CHEST_TUBE's authored-option products.
    expect(outputs.gaps.dimensionGapCount).toBe(89)
  })

  it('shows the BOM-suppressed requirement in the suppressed list, never silently dropped', () => {
    const outputs = previews()
    expect(outputs.suppressedItems).toEqual([
      expect.objectContaining({ roleCode: 'LOCAL_CHEST_TUBE_SECUREMENT' }),
    ])
  })

  it('rejects non-exemplar procedures', () => {
    const ws = workspace()
    expect(
      getProcedureOutputPreviews('BRONCH_ABLATION', ws.scenarioId, ws.formularySummary),
    ).toBeNull()
  })

  it('links the preference-card output to the existing builder scenario', () => {
    // Output 1 is a LINK to the preserved builder, never a re-implementation: the workspace
    // exposes the scenario id the builder consumes via /preference-cards/new?scenario=…
    const ws = workspace()
    expect(ws.scenarioId).toBe('chest-tube')
    expect(getProcedureWorkspace('EBUS_TBNA')!.scenarioId).toBe('ebus-rose-molecular')
    expect(getProcedureWorkspace('THERAPEUTIC_BRONCH')!.scenarioId).toBe(
      'central-airway-obstruction',
    )
  })
})
