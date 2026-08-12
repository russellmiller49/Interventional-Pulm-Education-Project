import {
  buildDemoContext,
  defaultBuildInput,
} from '@/features/preference-cards/data/demo-context.server'
import { resolveCard } from '@/features/preference-cards/domain/resolve-card'

import {
  buildReadinessProjection,
  getProcedureReadinessView,
  getProcedureWorkspace,
} from '../server/procedures.server'

/**
 * Owner-review finding F-09 on the D1 surfaces: the workspace's APC modifier card and the
 * readiness projection no longer present the rigid APC applicator as universally required.
 * Both assertions are data-driven — the display reads the corrected modifier definition and
 * the projection reads the resolved card; nothing here special-cases the slot or the copy.
 */

describe('F-09 on the THERAPEUTIC_BRONCH workspace', () => {
  it('lists the rigid applicator among APC additions as conditional, not required', () => {
    const workspace = getProcedureWorkspace('THERAPEUTIC_BRONCH')!
    const apc = workspace.modifiers.find((modifier) => modifier.code === 'APC')!
    expect(apc).toBeDefined()
    const added = apc.effects.addedRequirements
    const rigidApplicator = added.find((requirement) => requirement.id === 'OPS-APC-RIGID')!
    expect(rigidApplicator).toBeDefined()
    expect(rigidApplicator.roleCode).toBe('APC_APPLICATOR_RIGID')
    expect(rigidApplicator.requiredness).toBe('conditional')
    expect(rigidApplicator.dependencyRule).toBe('Rigid system in use')
    // Any other conditional addition would carry its own rule the same way — the field is
    // generic view-model data, not APC-specific copy.
    // The other APC additions keep their authored requiredness — the correction moved one
    // slot, and the card shows exactly that.
    for (const requirement of added.filter((candidate) => candidate.id !== 'OPS-APC-RIGID')) {
      expect(requirement.requiredness).toBe('required')
    }
  })
})

describe('F-09 on the readiness projection', () => {
  it('does not report a missing rigid applicator on a flexible-only APC card', () => {
    // A flexible-only fixture through the live readiness assembly: APC selected, RIGID_AIRWAY
    // not, and the rigid applicator deliberately unselected so only its requiredness decides
    // whether a diagnostic fires.
    const scenarioId = 'central-airway-obstruction'
    const resolved = resolveCard(
      defaultBuildInput(scenarioId, {
        modifierCodes: ['APC'],
        selectedHospitalItemIds: { 'OPS-APC-RIGID': null },
      }),
      buildDemoContext(scenarioId),
    )
    const item = resolved.items.find((candidate) => candidate.id === 'OPS-APC-RIGID')!
    expect(item.effectiveRequiredness).toBe('conditional')
    expect(item.selectedHospitalItemId).toBeNull()

    const projection = buildReadinessProjection('THERAPEUTIC_BRONCH', resolved)
    const rigidApplicatorDiagnostics = projection.requirements
      .filter((requirement) => requirement.roleCode === 'APC_APPLICATOR_RIGID')
      .flatMap((requirement) => requirement.diagnostics)
      .concat(projection.cardDiagnostics)
      .filter(
        (diagnostic) =>
          diagnostic.code === 'missing_required_product_role' &&
          diagnostic.sourceId?.includes('APC-RIGID'),
      )
    expect(rigidApplicatorDiagnostics).toEqual([])
    expect(
      projection.requirements
        .filter((requirement) => requirement.roleCode === 'APC_APPLICATOR_RIGID')
        .map((requirement) => requirement.state),
    ).not.toContain('not_ready')
  })

  it('keeps the demo readiness view resolvable with its documented headline', () => {
    const view = getProcedureReadinessView('THERAPEUTIC_BRONCH')!
    expect(view).toBeDefined()
    expect(view.projection.headline).toBeDefined()
    // The demo scenario co-selects RIGID_AIRWAY, so the view exists and never exhibited the
    // false missing-role diagnostic; the flexible-only case above is where F-09 shows.
    expect(
      view.projection.cardDiagnostics.filter(
        (diagnostic) =>
          diagnostic.code === 'missing_required_product_role' &&
          diagnostic.sourceId?.includes('APC-RIGID'),
      ),
    ).toEqual([])
  })
})
