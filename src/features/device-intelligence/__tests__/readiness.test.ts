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
    authoredSelectableProductIdsByRole: new Map(),
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

  it('C-01: a demo stand-in selection cannot lift a required proposals-only role above not_ready', () => {
    // The Codex C-01 defect: `hasSelection` used to convert this exact shape into
    // ready_with_limitations. Every structural no-coverage rung must behave the same way.
    for (const coverage of [
      'proposals_only',
      'no_option_no_proposal_role_mapped',
      'no_option_no_proposal_unmapped',
    ] as const) {
      const projection = projectDemoReadiness(
        minimalInput({
          items: [baseItem],
          ladderByRole: new Map([
            [
              'TEST_ROLE',
              {
                roleCode: 'TEST_ROLE',
                slotCount: 1,
                coverage,
                demoStandIn: true,
                proposalCount: coverage === 'proposals_only' ? 1 : 0,
              },
            ],
          ]),
          demoStandInRoleCodes: new Set(['TEST_ROLE']),
        }),
      )
      const requirement = projection.requirements[0]
      expect({ coverage, state: requirement.state }).toEqual({ coverage, state: 'not_ready' })
      expect(projection.headline).toBe('not_ready')
      // The diagnostic stays visible…
      expect(
        requirement.diagnostics.some(
          (diagnostic) => diagnostic.code === 'missing_required_product_role',
        ),
      ).toBe(true)
      // …and the demo mapping is disclosed, never silently dropped.
      expect(requirement.evidence.selectedHospitalItemId).toBe('item-1')
      expect(requirement.evidence.demoStandIn).toBe(true)
    }
  })

  it('C-01: the same shape on a contingency requirement still degrades rather than blocks', () => {
    // The precise required-structural-gap rule: requiredness is part of the condition, so a
    // conditional requirement with a proposals-only rung keeps its limitation semantics.
    const projection = projectDemoReadiness(
      minimalInput({
        items: [{ ...baseItem, effectiveRequiredness: 'conditional' }],
        ladderByRole: new Map([
          [
            'TEST_ROLE',
            {
              roleCode: 'TEST_ROLE',
              slotCount: 1,
              coverage: 'proposals_only',
              demoStandIn: true,
              proposalCount: 1,
            },
          ],
        ]),
        demoStandInRoleCodes: new Set(['TEST_ROLE']),
      }),
    )
    expect(projection.requirements[0].state).toBe('ready_with_limitations')
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
            roleCodes: ['TEST_ROLE'],
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

  it('C-04: formulary eligibility is judged against the row’s own role, never procedure-wide', () => {
    // PRD-TEST000001 is an authored selectable option for ROLE_A only. A carried row that
    // maps it to ROLE_B (also a procedure role) must mismatch; the same row mapped to
    // ROLE_A must not. There is no procedure-wide boolean left to bypass this comparison —
    // the projection input carries only the per-role eligibility surface.
    const authoredSelectableProductIdsByRole = new Map([
      ['ROLE_A', new Set(['PRD-TEST000001'])],
      // ROLE_B exists in the procedure but authors no selectable option for this product.
      ['ROLE_B', new Set(['PRD-OTHER00001'])],
    ])
    const mismatched = projectDemoReadiness(
      minimalInput({
        authoredSelectableProductIdsByRole,
        formularyAssertions: [
          {
            formularyId: 'FORM-ROLE-B',
            productId: 'PRD-TEST000001',
            hospitalCarries: true,
            preferred: false,
            productVisibilityState: 'prototype_visible',
            roleCodes: ['ROLE_B'],
          },
        ],
      }),
    )
    expect(
      mismatched.cardDiagnostics.filter(
        (diagnostic) => diagnostic.code === 'inventory_formulary_mismatch',
      ),
    ).toHaveLength(1)
    expect(mismatched.cardDiagnostics[0].sourceId).toBe('FORM-ROLE-B')

    const matched = projectDemoReadiness(
      minimalInput({
        authoredSelectableProductIdsByRole,
        formularyAssertions: [
          {
            formularyId: 'FORM-ROLE-A',
            productId: 'PRD-TEST000001',
            hospitalCarries: true,
            preferred: false,
            productVisibilityState: 'prototype_visible',
            roleCodes: ['ROLE_A'],
          },
        ],
      }),
    )
    expect(
      matched.cardDiagnostics.some(
        (diagnostic) => diagnostic.code === 'inventory_formulary_mismatch',
      ),
    ).toBe(false)

    // A hidden product stays a mismatch even when its role mapping matches (fail closed).
    const hidden = projectDemoReadiness(
      minimalInput({
        authoredSelectableProductIdsByRole,
        formularyAssertions: [
          {
            formularyId: 'FORM-HIDDEN',
            productId: 'PRD-TEST000001',
            hospitalCarries: true,
            preferred: true,
            productVisibilityState: 'hidden',
            roleCodes: ['ROLE_A'],
          },
        ],
      }),
    )
    expect(
      hidden.cardDiagnostics.some(
        (diagnostic) => diagnostic.code === 'inventory_formulary_mismatch',
      ),
    ).toBe(true)
  })

  it('C-04b: a multi-role row must be eligible for EVERY relevant role — one match never suppresses another', () => {
    // PRD-TEST000001 is selectable for ROLE_A only; ROLE_B authors nothing for it.
    const authoredSelectableProductIdsByRole = new Map([
      ['ROLE_A', new Set(['PRD-TEST000001'])],
      ['ROLE_B', new Set(['PRD-OTHER00001'])],
    ])
    const assertionWith = (
      formularyId: string,
      roleCodes: string[],
      visibility: string = 'prototype_visible',
    ) => ({
      formularyId,
      productId: 'PRD-TEST000001',
      hospitalCarries: true,
      preferred: false,
      productVisibilityState: visibility,
      roleCodes,
    })
    const mismatchesOf = (projection: ReturnType<typeof projectDemoReadiness>) =>
      projection.cardDiagnostics.filter(
        (diagnostic) => diagnostic.code === 'inventory_formulary_mismatch',
      )

    // A+B partial match: the matching ROLE_A must not suppress ROLE_B's mismatch (the
    // pre-C-04b `.some(...)` did exactly that). The diagnostic names the mismatching role.
    const partial = mismatchesOf(
      projectDemoReadiness(
        minimalInput({
          authoredSelectableProductIdsByRole,
          formularyAssertions: [assertionWith('FORM-A-AND-B', ['ROLE_A', 'ROLE_B'])],
        }),
      ),
    )
    expect(partial).toHaveLength(1)
    expect(partial[0].sourceId).toBe('FORM-A-AND-B')
    expect(partial[0].detail).toContain('relevantRoles=ROLE_A/ROLE_B')
    expect(partial[0].detail).toContain('mismatchingRoles=ROLE_B')
    expect(partial[0].detail).toContain('eligibleForAllRelevantRoles=false')

    // A+B full match: the product independently selectable for both roles → no mismatch.
    const fullMatch = mismatchesOf(
      projectDemoReadiness(
        minimalInput({
          authoredSelectableProductIdsByRole: new Map([
            ['ROLE_A', new Set(['PRD-TEST000001'])],
            ['ROLE_B', new Set(['PRD-TEST000001', 'PRD-OTHER00001'])],
          ]),
          formularyAssertions: [assertionWith('FORM-A-AND-B-FULL', ['ROLE_A', 'ROLE_B'])],
        }),
      ),
    )
    expect(fullMatch).toHaveLength(0)

    // Empty relevant-role set: fails CLOSED — `every([])` vacuous truth must not pass it.
    const emptyRoles = mismatchesOf(
      projectDemoReadiness(
        minimalInput({
          authoredSelectableProductIdsByRole,
          formularyAssertions: [assertionWith('FORM-NO-RELEVANT-ROLES', [])],
        }),
      ),
    )
    expect(emptyRoles).toHaveLength(1)
    expect(emptyRoles[0].detail).toContain('relevantRoles=none')
    expect(emptyRoles[0].detail).toContain('eligibleForAllRelevantRoles=false')

    // Hidden stays a mismatch even when EVERY relevant role authorizes the product.
    const hiddenAllMatch = mismatchesOf(
      projectDemoReadiness(
        minimalInput({
          authoredSelectableProductIdsByRole: new Map([
            ['ROLE_A', new Set(['PRD-TEST000001'])],
            ['ROLE_B', new Set(['PRD-TEST000001'])],
          ]),
          formularyAssertions: [
            assertionWith('FORM-HIDDEN-ALL-MATCH', ['ROLE_A', 'ROLE_B'], 'hidden'),
          ],
        }),
      ),
    )
    expect(hiddenAllMatch).toHaveLength(1)
    expect(hiddenAllMatch[0].detail).toContain('eligibleForAllRelevantRoles=true')
    expect(hiddenAllMatch[0].detail).toContain('visibility=hidden')

    // Determinism: differently ordered, duplicated input codes normalize to the same
    // sorted, deduplicated diagnostic lists.
    const shuffled = mismatchesOf(
      projectDemoReadiness(
        minimalInput({
          authoredSelectableProductIdsByRole,
          formularyAssertions: [assertionWith('FORM-SHUFFLED', ['ROLE_B', 'ROLE_A', 'ROLE_B'])],
        }),
      ),
    )
    expect(shuffled).toHaveLength(1)
    expect(shuffled[0].detail).toContain('relevantRoles=ROLE_A/ROLE_B')
    expect(shuffled[0].detail).toContain('mismatchingRoles=ROLE_B')
    const ordered = mismatchesOf(
      projectDemoReadiness(
        minimalInput({
          authoredSelectableProductIdsByRole,
          formularyAssertions: [assertionWith('FORM-SHUFFLED', ['ROLE_A', 'ROLE_B'])],
        }),
      ),
    )
    expect(shuffled[0].detail).toBe(ordered[0].detail)
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

  it('EBUS and THERAPEUTIC are not_ready — the required GENERIC_SUCTION structural gap (C-01)', () => {
    // GENERIC_SUCTION is required in both procedures, its coverage rung is proposals_only,
    // and the demo context maps a stand-in to it. Before the C-01 correction that stand-in
    // selection read as ready_with_limitations; the headline was amber. Both are now red.
    for (const code of ['EBUS_TBNA', 'THERAPEUTIC_BRONCH']) {
      const view = getProcedureReadinessView(code)!
      expect({ code, headline: view.projection.headline }).toEqual({
        code,
        headline: 'not_ready',
      })
      const suction = view.projection.requirements.find(
        (requirement) => requirement.roleCode === 'GENERIC_SUCTION',
      )!
      expect(suction.state).toBe('not_ready')
      expect(suction.effectiveRequiredness).toBe('required')
      expect(suction.evidence.coverage).toBe('proposals_only')
      // The diagnostic stays visible…
      expect(
        suction.diagnostics.some(
          (diagnostic) => diagnostic.code === 'missing_required_product_role',
        ),
      ).toBe(true)
      // …and the demo stand-in mapping is disclosed rather than silently dropped.
      expect(suction.evidence.demoStandIn).toBe(true)
      expect(suction.evidence.selectedHospitalItemId).not.toBeNull()
      // Demo stand-ins elsewhere still never read as plain ready.
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
