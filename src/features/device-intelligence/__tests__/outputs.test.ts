import { getProcedureOutputPreviews } from '@/features/device-intelligence/server/outputs.server'
import {
  CANONICAL_PROCEDURAL_PHASE_ORDER,
  getProcedureWorkspace,
} from '@/features/device-intelligence/server/procedures.server'

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
    // Re-pinned 89 → 70 for F-06 (2026-08-09): the four IPC requirements left the template,
    // so the IPC-only authored-option products no longer count toward this procedure's
    // dimension-gap denominator.
    expect(outputs.gaps.dimensionGapCount).toBe(70)
  })

  it('shows the BOM-suppressed requirement in the suppressed list, never silently dropped', () => {
    const outputs = previews()
    expect(outputs.suppressedItems).toEqual([
      expect.objectContaining({
        roleCode: 'LOCAL_CHEST_TUBE_SECUREMENT',
        // Owner-review F-02: the rendered suppression reason quotes the resolver's own
        // trace, which names the satisfying kit.
        reason: expect.stringContaining('includes this component'),
      }),
    ])
    expect(outputs.suppressedItems[0].reason).toMatch(/^Suppressed because /)
  })

  it('orders training and nursing phase groups by the canonical clinical sequence (F-03)', () => {
    const therapeutic = getProcedureWorkspace('THERAPEUTIC_BRONCH')!
    const outputs = getProcedureOutputPreviews(
      therapeutic.procedureCode,
      therapeutic.scenarioId,
      therapeutic.formularySummary,
    )!
    const rank = (phase: string) => CANONICAL_PROCEDURAL_PHASE_ORDER.indexOf(phase)
    const trainingRanks = outputs.training.map((group) => rank(group.key))
    expect(trainingRanks).not.toContain(-1)
    expect(trainingRanks).toEqual([...trainingRanks].sort((left, right) => left - right))
    // The teaching view can no longer teach an inverted procedure: airway access precedes
    // the therapeutic phase whenever both appear.
    const keys = outputs.training.map((group) => group.key)
    if (keys.includes('airway_access') && keys.includes('therapeutic')) {
      expect(keys.indexOf('airway_access')).toBeLessThan(keys.indexOf('therapeutic'))
    }
    for (const group of outputs.nursing) {
      const ranks = group.phases.map((phase) => rank(phase.key))
      expect(ranks).toEqual([...ranks].sort((left, right) => left - right))
    }
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
