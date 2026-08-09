import {
  buildDemoContext,
  defaultBuildInput,
  resolveDemoScenario,
} from '@/features/preference-cards/data/demo-context.server'
import { resolveCard } from '@/features/preference-cards/domain/resolve-card'
import {
  projectDemoReadiness,
  type ReadinessProjectionInput,
} from '@/features/device-intelligence/domain/readiness'
import {
  buildReadinessProjection,
  getProcedureReadinessView,
} from '@/features/device-intelligence/server/procedures.server'

/**
 * The eight deterministic readiness states of vertical-slice-spec §4. States that today's
 * data cannot produce (missing capability, missing rescue, formulary mismatch — the real
 * scaffold is empty and the demo location declares every needed capability) are exercised
 * with copied-context or input fixtures, exactly as the D0 specification records.
 */

function minimalInput(overrides: Partial<ReadinessProjectionInput> = {}): ReadinessProjectionInput {
  return {
    items: [],
    warnings: [],
    ladderByRole: new Map(),
    productGradeById: new Map(),
    authoredSelectablePairs: new Set(),
    demoStandInRoleCodes: new Set(),
    formularyAssertions: [],
    ...overrides,
  }
}

const baseItem = {
  id: 'SLOT-TEST',
  sourceSlotId: 'SLOT-TEST',
  roleCode: 'TEST_ROLE',
  label: 'Test requirement',
  effectiveRequiredness: 'required',
  includedBy: 'Recipe',
  selectedHospitalItemId: 'item-1',
  selectedCatalogProductId: 'PRD-TEST000001',
  verificationState: 'prototype_visible',
  compatibilityState: 'not_evaluated',
}

describe('demo readiness projection — the eight states', () => {
  it('state 1: plain ready only on a verified, authored-selectable, non-stand-in mapping', () => {
    const projection = projectDemoReadiness(
      minimalInput({
        items: [baseItem],
        productGradeById: new Map([['PRD-TEST000001', 'verified_source']]),
        authoredSelectablePairs: new Set(['SLOT-TEST|PRD-TEST000001']),
      }),
    )
    expect(projection.requirements[0].state).toBe('ready')
    expect(projection.headline).toBe('ready')
  })

  it('state 2: a demo stand-in always forces ready_with_limitations, never plain ready', () => {
    const projection = projectDemoReadiness(
      minimalInput({
        items: [baseItem],
        productGradeById: new Map([['PRD-TEST000001', 'verified_source']]),
        authoredSelectablePairs: new Set(['SLOT-TEST|PRD-TEST000001']),
        demoStandInRoleCodes: new Set(['TEST_ROLE']),
      }),
    )
    expect(projection.requirements[0].state).toBe('ready_with_limitations')
    expect(projection.requirements[0].evidence.demoStandIn).toBe(true)
  })

  it('candidate or unknown product grade can never produce plain ready', () => {
    for (const grade of ['candidate', 'unknown']) {
      const projection = projectDemoReadiness(
        minimalInput({
          items: [baseItem],
          productGradeById: new Map([['PRD-TEST000001', grade]]),
          authoredSelectablePairs: new Set(['SLOT-TEST|PRD-TEST000001']),
        }),
      )
      expect(projection.requirements[0].state).toBe('ready_with_limitations')
      expect(
        projection.requirements[0].diagnostics.some(
          (diagnostic) => diagnostic.code === 'available_but_unverified',
        ),
      ).toBe(true)
    }
  })

  it('state 3: a required requirement with no mapping is not_ready and pulls the headline down', () => {
    const projection = projectDemoReadiness(
      minimalInput({
        items: [
          { ...baseItem, selectedHospitalItemId: null, selectedCatalogProductId: null },
          {
            ...baseItem,
            id: 'SLOT-OPTIONAL',
            sourceSlotId: 'SLOT-OPTIONAL',
            effectiveRequiredness: 'optional',
            selectedHospitalItemId: null,
            selectedCatalogProductId: null,
          },
        ],
      }),
    )
    expect(projection.requirements[0].state).toBe('not_ready')
    // An unresolved contingency/optional requirement degrades rather than blocks.
    expect(projection.requirements[1].state).toBe('ready_with_limitations')
    expect(projection.headline).toBe('not_ready')
  })

  it('state 4: proposals never count as coverage — a proposals-only required role is diagnosed', () => {
    const projection = projectDemoReadiness(
      minimalInput({
        items: [{ ...baseItem, selectedHospitalItemId: null, selectedCatalogProductId: null }],
        ladderByRole: new Map([
          [
            'TEST_ROLE',
            {
              roleCode: 'TEST_ROLE',
              slotCount: 1,
              coverage: 'proposals_only',
              demoStandIn: false,
              proposalCount: 40,
            },
          ],
        ]),
      }),
    )
    const requirement = projection.requirements[0]
    expect(requirement.state).toBe('not_ready')
    const diagnostic = requirement.diagnostics.find(
      (candidate) => candidate.code === 'missing_required_product_role',
    )
    expect(diagnostic).toBeDefined()
    expect(diagnostic!.sourceKind).toBe('procedure_slot')
    expect(diagnostic!.sourceId).toBe('SLOT-TEST')
    // 40 unreviewed proposals changed nothing: coverage is still missing.
  })

  it('state 5: a missing room capability is diagnosed from the domain message with its capability id', () => {
    // Copied demo context with the capability removed — the documented fixture pattern; the
    // real demo location declares rigid_bronchoscopy/jet_ventilation/fluoroscopy, so the
    // live view cannot produce this state.
    const scenarioId = 'central-airway-obstruction'
    const context = buildDemoContext(scenarioId)
    const reducedContext = { ...context, locationCapabilities: ['fluoroscopy'] }
    const resolved = resolveCard(
      defaultBuildInput(scenarioId, { modifierCodes: ['RIGID_AIRWAY', 'FLUOROSCOPY'] }),
      reducedContext,
    )
    const projection = buildReadinessProjection('THERAPEUTIC_BRONCH', resolved)
    const diagnostic = projection.cardDiagnostics.find(
      (candidate) => candidate.code === 'missing_room_capability',
    )
    expect(diagnostic).toBeDefined()
    expect(diagnostic!.sourceId).toBe('rigid_bronchoscopy')
    expect(projection.headline).toBe('not_ready')
  })

  it('state 6: a reachable rescue module that fails to resolve is missing_rescue_pathway', () => {
    const scenarioId = 'ebus-rose-molecular'
    const context = buildDemoContext(scenarioId)
    const contextWithoutRescue = { ...context, rescueModules: [] }
    const resolved = resolveCard(
      defaultBuildInput(scenarioId, {
        modifierCodes: ['ROSE', 'SPEC_MOLECULAR', 'HIGH_BLEED_RISK'],
      }),
      contextWithoutRescue,
    )
    const projection = buildReadinessProjection('EBUS_TBNA', resolved)
    const diagnostic = projection.cardDiagnostics.find(
      (candidate) => candidate.code === 'missing_rescue_pathway',
    )
    expect(diagnostic).toBeDefined()
    expect(diagnostic!.sourceId).toBe('MAJOR_AIRWAY_BLEEDING')
    expect(projection.headline).toBe('not_ready')
  })

  it('state 7: coverage through demo-only or unverified mappings is available_but_unverified', () => {
    const projection = projectDemoReadiness(
      minimalInput({
        items: [{ ...baseItem, verificationState: 'demo_only', selectedCatalogProductId: null }],
      }),
    )
    const requirement = projection.requirements[0]
    expect(requirement.state).toBe('ready_with_limitations')
    const diagnostic = requirement.diagnostics.find(
      (candidate) => candidate.code === 'available_but_unverified',
    )
    expect(diagnostic).toBeDefined()
    expect(diagnostic!.sourceId).toBe('item-1')
  })

  it('state 8: a carried product that is not an authored selectable option is a mismatch (fixture)', () => {
    const projection = projectDemoReadiness(
      minimalInput({
        formularyAssertions: [
          {
            formularyId: 'FORM-FIXTURE01',
            productId: 'PRD-TEST000001',
            hospitalCarries: true,
            preferred: false,
            productVisibilityState: 'prototype_visible',
            authoredSelectableForProcedure: false,
          },
        ],
      }),
    )
    const diagnostic = projection.cardDiagnostics.find(
      (candidate) => candidate.code === 'inventory_formulary_mismatch',
    )
    expect(diagnostic).toBeDefined()
    expect(diagnostic!.sourceKind).toBe('formulary_row')
    expect(diagnostic!.sourceId).toBe('FORM-FIXTURE01')
    expect(projection.headline).toBe('not_ready')
  })

  it('a compatibility rule that evaluates unknown is a limitation, never a silent pass', () => {
    const projection = projectDemoReadiness(
      minimalInput({
        items: [baseItem],
        productGradeById: new Map([['PRD-TEST000001', 'verified_source']]),
        authoredSelectablePairs: new Set(['SLOT-TEST|PRD-TEST000001']),
        warnings: [
          {
            severity: 'warning',
            code: 'compatibility_unknown',
            message: 'Missing attribute.',
            sourceId: 'RULE-BALLOON-WORKING-CHANNEL',
          },
        ],
      }),
    )
    expect(projection.headline).toBe('ready_with_limitations')
    expect(
      projection.cardDiagnostics.some(
        (diagnostic) =>
          diagnostic.sourceKind === 'compatibility_rule' &&
          diagnostic.sourceId === 'RULE-BALLOON-WORKING-CHANNEL',
      ),
    ).toBe(true)
  })
})

describe('the live demo readiness views', () => {
  it('CHEST_TUBE is not_ready via DRESSING_SECUREMENT — a structural required-role gap', () => {
    const view = getProcedureReadinessView('CHEST_TUBE')!
    expect(view.projection.headline).toBe('not_ready')
    const dressing = view.projection.requirements.find(
      (requirement) => requirement.roleCode === 'DRESSING_SECUREMENT',
    )
    expect(dressing).toBeDefined()
    expect(dressing!.state).toBe('not_ready')
    expect(
      dressing!.diagnostics.some(
        (diagnostic) => diagnostic.code === 'missing_required_product_role',
      ),
    ).toBe(true)
  })

  it('EBUS and THERAPEUTIC resolve with limitations — demo stand-ins never read as plain ready', () => {
    for (const code of ['EBUS_TBNA', 'THERAPEUTIC_BRONCH']) {
      const view = getProcedureReadinessView(code)!
      expect(view.projection.headline).toBe('ready_with_limitations')
      for (const requirement of view.projection.requirements) {
        if (requirement.evidence.demoStandIn && requirement.evidence.selectedHospitalItemId) {
          expect(requirement.state).not.toBe('ready')
        }
      }
    }
  })

  it('reports the real formulary as empty — never as institutional data', () => {
    for (const code of ['EBUS_TBNA', 'THERAPEUTIC_BRONCH', 'CHEST_TUBE'] as const) {
      const view = getProcedureReadinessView(code)!
      expect(view.formularySummary.carriedRows).toBe(0)
      expect(view.formularySummary.preferredRows).toBe(0)
      expect(view.formularySummary.rowsIntersectingProcedureRoles).toBeGreaterThan(0)
      // And with zero carried rows, no mismatch diagnostic can fire from real data.
      expect(
        view.projection.cardDiagnostics.some(
          (diagnostic) => diagnostic.code === 'inventory_formulary_mismatch',
        ),
      ).toBe(false)
    }
  })

  it('links every diagnostic to a source identifier', () => {
    for (const code of ['EBUS_TBNA', 'THERAPEUTIC_BRONCH', 'CHEST_TUBE'] as const) {
      const view = getProcedureReadinessView(code)!
      for (const requirement of view.projection.requirements) {
        for (const diagnostic of requirement.diagnostics) {
          expect(diagnostic.sourceId.length).toBeGreaterThan(0)
          expect(diagnostic.sourceKind.length).toBeGreaterThan(0)
        }
      }
      for (const diagnostic of view.projection.cardDiagnostics) {
        expect(diagnostic.sourceId.length).toBeGreaterThan(0)
      }
    }
  })

  it('is deterministic across repeated computation', () => {
    const first = getProcedureReadinessView('CHEST_TUBE')!
    const second = getProcedureReadinessView('CHEST_TUBE')!
    expect(JSON.stringify(first)).toEqual(JSON.stringify(second))
  })

  it('never drops a resolver message: every warning is an advisory, diagnostic, blocking entry, or listed verbatim', () => {
    // Adversarial-review blocker: a `ready` row backed by a prototype-visible mapping must
    // still show the resolver's own "requires current local verification" advisory.
    const view = getProcedureReadinessView('EBUS_TBNA')!
    const ebusScope = view.projection.requirements.find(
      (requirement) => requirement.roleCode === 'EBUS_SCOPE',
    )!
    expect(ebusScope.state).toBe('ready')
    expect(
      ebusScope.resolverAdvisories.some((advisory) =>
        advisory.message.includes('requires current local verification'),
      ),
    ).toBe(true)

    // Full accounting against the resolver's actual output: every warning the resolved card
    // carries must surface somewhere in the projection — as a per-requirement advisory, a
    // card diagnostic (matched by rule/capability sourceId), a blocking entry, or verbatim
    // in otherWarnings. Nothing may vanish.
    for (const code of ['EBUS_TBNA', 'THERAPEUTIC_BRONCH', 'CHEST_TUBE'] as const) {
      const projection = getProcedureReadinessView(code)!.projection
      const surfacedMessages = new Set(
        [
          ...projection.requirements.flatMap((requirement) => requirement.resolverAdvisories),
          ...projection.blockingWarnings,
          ...projection.otherWarnings,
        ].map((warning) => `${warning.code}|${warning.message}`),
      )
      const diagnosedSourceIds = new Set(
        projection.cardDiagnostics.map((diagnostic) => diagnostic.sourceId),
      )
      const resolved = resolveDemoScenario(getProcedureReadinessView(code)!.scenarioId)
      for (const warning of resolved.warnings) {
        const accounted =
          surfacedMessages.has(`${warning.code}|${warning.message}`) ||
          (warning.sourceId !== null && diagnosedSourceIds.has(warning.sourceId))
        expect({ code, warning: warning.code, message: warning.message, accounted }).toEqual({
          code,
          warning: warning.code,
          message: warning.message,
          accounted: true,
        })
      }
    }
  })

  it('diagnoses a rescue requirement stripped of its demo coverage — the live per-item path', () => {
    // Pins the includedBy contract the per-item state-6 branch matches on: if the
    // rescue-module provenance wording ever changes, this fails loudly instead of the
    // branch silently disabling.
    const scenarioId = 'ebus-rose-molecular'
    const context = buildDemoContext(scenarioId)
    const strippedContext = {
      ...context,
      hospitalItems: context.hospitalItems.filter(
        (item) => item.roleCode !== 'AIRWAY_TAMPONADE_BALLOON_CAPABILITY',
      ),
      hospitalRoleOptions: context.hospitalRoleOptions.filter(
        (option) => !option.id.includes('demo-role-option'),
      ),
    }
    // Keep the role options consistent with the filtered items.
    strippedContext.hospitalRoleOptions = context.hospitalRoleOptions.filter((option) =>
      strippedContext.hospitalItems.some((item) => item.id === option.hospitalItemId),
    )
    const resolved = resolveCard(
      defaultBuildInput(scenarioId, {
        modifierCodes: ['ROSE', 'SPEC_MOLECULAR', 'HIGH_BLEED_RISK'],
      }),
      strippedContext,
    )
    const projection = buildReadinessProjection('EBUS_TBNA', resolved)
    const rescueRequirement = projection.requirements.find(
      (requirement) => requirement.roleCode === 'AIRWAY_TAMPONADE_BALLOON_CAPABILITY',
    )!
    expect(rescueRequirement.evidence.selectedHospitalItemId).toBeNull()
    expect(
      rescueRequirement.diagnostics.some(
        (diagnostic) => diagnostic.code === 'missing_rescue_pathway',
      ),
    ).toBe(true)
    // And as a modifier-added required-path guard (adversarial finding 3): a rescue/modifier
    // requirement outside the template ladder that resolves nothing is also diagnosed as a
    // missing required product role rather than failing without explanation.
    expect(
      rescueRequirement.diagnostics.some(
        (diagnostic) => diagnostic.code === 'missing_required_product_role',
      ),
    ).toBe(rescueRequirement.effectiveRequiredness === 'required')
  })
})
