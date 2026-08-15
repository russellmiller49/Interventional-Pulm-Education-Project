import {
  SAFETY_ACTION_SCOPES,
  SAFETY_ACTION_STATES,
  SAFETY_SEARCH_STATUSES,
  US_STATUS_CONFIDENCE_VALUES,
  US_STATUS_RESEARCH_STATES,
  US_STATUS_REVIEW_DISPOSITIONS,
  VISIBILITY_REVIEW_ELIGIBILITIES,
  classifyUsStatusProposal,
  type HighConfidenceInvariantFailure,
  type IndependentInvariantEvidence,
  type UsStatusClassificationInput,
  type UsStatusResearchState,
} from '../classification'

function configuration(
  id: string,
  distributionStatus: 'in_distribution' | 'not_in_distribution' | 'unknown',
  identifierType: 'primary' | 'package' = 'primary',
) {
  return {
    configuration_id: id,
    identifier_type: identifierType,
    exact_identity: true,
    distribution_status: distributionStatus,
  } as const
}

function baseInput(): UsStatusClassificationInput {
  return {
    identity: {
      match_method: 'exact_primary_di_or_gtin',
      conflict: false,
    },
    udi_distribution: {
      search_completed: true,
      snapshot_current: true,
      all_exact_configurations_retrieved: true,
      configurations: [configuration('DI-1', 'in_distribution')],
    },
    registration_listing: {
      search_completed: true,
      snapshot_current: true,
      match_scope: 'none',
      listing_status: 'unknown',
      establishment_registration_current: null,
      conflict: false,
    },
    authorization: {
      search_completed: true,
      finding: 'not_found',
    },
    manufacturer: {
      search_completed: true,
      finding: 'current_exact_official_us_product',
    },
    safety_action: {
      search_status: 'searched',
      action_state: 'no_exact_action_found',
      action_scope: 'unknown',
      exact_action_sources_traceable: true,
    },
    conflicts: {
      model: false,
      manufacturer: false,
      distribution: false,
      discontinuation: false,
    },
    independent_invariants: {
      adjacent_sku_excluded: true,
      exact_configuration_inventory_complete: true,
      package_levels_distinguished: true,
      evidence_packet_complete: true,
      all_sources_traceable: true,
      registration_authorization_separated: true,
      recall_excluded_from_distribution: true,
    },
    explicitly_noncommercial_or_local: false,
  }
}

function makeNoCurrentStatusEvidence(input: UsStatusClassificationInput): void {
  input.udi_distribution.configurations = []
  input.registration_listing.match_scope = 'none'
  input.registration_listing.listing_status = 'unknown'
  input.registration_listing.establishment_registration_current = null
  input.manufacturer.finding = 'no_result'
}

describe('current U.S. status proposal classification', () => {
  it('exposes exactly the governed states, confidences, and review dispositions', () => {
    expect(US_STATUS_RESEARCH_STATES).toEqual([
      'current_us_distribution_supported',
      'not_currently_distributed_supported',
      'historically_authorized_current_status_unresolved',
      'current_status_conflicted',
      'identity_unresolved',
      'insufficient_evidence',
      'not_applicable_noncommercial_or_local',
    ])
    expect(US_STATUS_CONFIDENCE_VALUES).toEqual(['high', 'moderate', 'low'])
    expect(US_STATUS_REVIEW_DISPOSITIONS).toEqual([
      'review_for_prototype_visibility',
      'keep_hidden_conflicting',
      'keep_hidden_identity_unresolved',
      'keep_hidden_insufficient_evidence',
      'keep_hidden_pending_active_safety_action_review',
      'keep_hidden_pending_safety_review',
      'review_as_not_currently_distributed',
      'review_as_noncommercial_or_local',
    ])
    expect(SAFETY_SEARCH_STATUSES).toEqual(['searched', 'not_searched', 'query_error'])
    expect(SAFETY_ACTION_STATES).toEqual([
      'active_exact_product_action',
      'historical_exact_product_action',
      'family_or_ambiguous_action',
      'no_exact_action_found',
      'unknown',
    ])
    expect(SAFETY_ACTION_SCOPES).toEqual([
      'lot_specific',
      'product_wide',
      'family_level',
      'unknown',
    ])
    expect(VISIBILITY_REVIEW_ELIGIBILITIES).toEqual([
      'eligible_for_owner_review',
      'hold_active_safety_action',
      'hold_safety_search_incomplete',
      'hold_safety_identity_ambiguous',
      'not_applicable',
    ])
  })

  it('supports current distribution only with exact identity, complete FDA evidence, and a current exact official U.S. manufacturer source', () => {
    const result = classifyUsStatusProposal(baseInput())

    expect(result).toMatchObject({
      research_state: 'current_us_distribution_supported',
      confidence: 'high',
      proposed_human_review_disposition: 'review_for_prototype_visibility',
      canonical_change_applied: false,
      invariant_audit: {
        performed: true,
        provisional_state: 'current_us_distribution_supported',
        passed: true,
        failures: [],
      },
    })
  })

  it('can use an exact current listing as distribution evidence without treating listing as approval', () => {
    const input = baseInput()
    input.udi_distribution.configurations = []
    input.registration_listing = {
      search_completed: true,
      snapshot_current: true,
      match_scope: 'exact_product',
      listing_status: 'current',
      establishment_registration_current: true,
      conflict: false,
    }

    const result = classifyUsStatusProposal(input)
    expect(result.research_state).toBe('current_us_distribution_supported')
    expect(result.layer_assessments.registration_listing).toBe('exact_current_listing')
    expect(result.layer_assessments.authorization).toBe('not_found')
  })

  it('does not let a family-level listing independently establish current distribution', () => {
    const input = baseInput()
    input.udi_distribution.configurations = []
    input.registration_listing.match_scope = 'family_or_proprietary_name'
    input.registration_listing.listing_status = 'current'
    input.registration_listing.establishment_registration_current = true

    const result = classifyUsStatusProposal(input)
    expect(result.research_state).toBe('insufficient_evidence')
    expect(result.layer_assessments.registration_listing).toBe('family_current_listing')
  })

  it('does not support a positive when the manufacturer corroboration is absent', () => {
    const input = baseInput()
    input.manufacturer.finding = 'no_result'

    expect(classifyUsStatusProposal(input).research_state).toBe('insufficient_evidence')
  })

  it('does not support a positive from incomplete FDA-layer searches', () => {
    const input = baseInput()
    input.registration_listing.search_completed = false

    const result = classifyUsStatusProposal(input)
    expect(result.research_state).toBe('insufficient_evidence')
    expect(result.layer_assessments.registration_listing).toBe('search_incomplete')
  })

  it('supports a negative when every exact UDI configuration ended and manufacturer research completed', () => {
    const input = baseInput()
    input.udi_distribution.configurations = [
      configuration('DI-1', 'not_in_distribution'),
      configuration('PKG-1', 'not_in_distribution', 'package'),
    ]
    input.manufacturer.finding = 'no_result'

    const result = classifyUsStatusProposal(input)
    expect(result).toMatchObject({
      research_state: 'not_currently_distributed_supported',
      confidence: 'high',
      proposed_human_review_disposition: 'review_as_not_currently_distributed',
      invariant_audit: {
        performed: true,
        provisional_state: 'not_currently_distributed_supported',
        passed: true,
        failures: [],
      },
      canonical_change_applied: false,
    })
  })

  it('supports a negative from an exact official discontinuation after completed manufacturer research', () => {
    const input = baseInput()
    input.udi_distribution.configurations = []
    input.manufacturer.finding = 'exact_official_discontinuation'

    const result = classifyUsStatusProposal(input)
    expect(result.research_state).toBe('not_currently_distributed_supported')
    expect(result.reason_codes).toContain('exact_official_manufacturer_discontinuation')
  })

  it('does not support a negative when manufacturer research is incomplete', () => {
    const input = baseInput()
    input.udi_distribution.configurations = [configuration('DI-1', 'not_in_distribution')]
    input.manufacturer.search_completed = false
    input.manufacturer.finding = 'exact_official_discontinuation'

    expect(classifyUsStatusProposal(input).research_state).toBe('insufficient_evidence')
  })

  it('does not support a high-confidence negative when the listing search is incomplete', () => {
    const input = baseInput()
    input.udi_distribution.configurations = [configuration('DI-1', 'not_in_distribution')]
    input.registration_listing.search_completed = false
    input.manufacturer.finding = 'no_result'
    input.independent_invariants.evidence_packet_complete = false

    const result = classifyUsStatusProposal(input)
    expect(result.research_state).toBe('insufficient_evidence')
    expect(result.confidence).toBe('low')
    expect(result.layer_assessments.registration_listing).toBe('search_incomplete')
    expect(result.invariant_audit.performed).toBe(false)
  })

  it('treats exact current non-U.S. manufacturer evidence as an unresolved conflict against ended UDI evidence', () => {
    const input = baseInput()
    input.udi_distribution.configurations = [configuration('DI-1', 'not_in_distribution')]
    input.manufacturer.finding = 'current_non_us'

    const result = classifyUsStatusProposal(input)
    expect(result).toMatchObject({
      research_state: 'current_status_conflicted',
      confidence: 'moderate',
      proposed_human_review_disposition: 'keep_hidden_conflicting',
      layer_assessments: {
        udi_distribution: 'all_exact_configurations_ended',
        manufacturer: 'current_non_us',
      },
      invariant_audit: {
        performed: true,
        provisional_state: 'not_currently_distributed_supported',
        passed: false,
      },
    })
    expect(result.invariant_audit.failures).toContain(
      'current_non_us_manufacturer_applicability_unresolved',
    )
    expect(result.reason_codes).toContain('high_confidence_invariant_failed')
  })

  it('reports active FDA evidence against a discontinuation claim as a conflict', () => {
    const input = baseInput()
    input.manufacturer.finding = 'exact_official_discontinuation'

    const result = classifyUsStatusProposal(input)
    expect(result.research_state).toBe('current_status_conflicted')
    expect(result.invariant_audit.failures).toContain(
      'active_distribution_evidence_present_for_negative',
    )
  })

  it('keeps historical authorization separate when current distribution is unresolved', () => {
    const input = baseInput()
    makeNoCurrentStatusEvidence(input)
    input.authorization.finding = 'exact_510k_clearance'

    const result = classifyUsStatusProposal(input)
    expect(result).toMatchObject({
      research_state: 'historically_authorized_current_status_unresolved',
      confidence: 'moderate',
      proposed_human_review_disposition: 'keep_hidden_insufficient_evidence',
    })
    expect(result.research_state).not.toBe('current_us_distribution_supported')
  })

  it('preserves premarket-exempt semantics without treating no premarket record as negative', () => {
    const input = baseInput()
    makeNoCurrentStatusEvidence(input)
    input.authorization.finding = 'premarket_exempt'

    const result = classifyUsStatusProposal(input)
    expect(result.research_state).toBe('insufficient_evidence')
    expect(result.layer_assessments.authorization).toBe('premarket_exempt')
    expect(result.reason_codes).toContain('premarket_exempt_pathway_is_not_a_negative_finding')
  })

  it('reports mixed base-device and package statuses as a conflict', () => {
    const input = baseInput()
    input.udi_distribution.configurations = [
      configuration('DI-1', 'in_distribution'),
      configuration('PKG-1', 'not_in_distribution', 'package'),
    ]

    const result = classifyUsStatusProposal(input)
    expect(result.research_state).toBe('current_status_conflicted')
    expect(result.layer_assessments.udi_distribution).toBe(
      'conflicting_exact_configuration_statuses',
    )
  })

  it('also treats a recognized package status mixed with unknown as a conflict', () => {
    const input = baseInput()
    input.udi_distribution.configurations = [
      configuration('DI-1', 'in_distribution'),
      configuration('PKG-1', 'unknown', 'package'),
    ]

    expect(classifyUsStatusProposal(input).research_state).toBe('current_status_conflicted')
  })

  it('uses identity_unresolved for family/name evidence and never treats it as exact', () => {
    const input = baseInput()
    makeNoCurrentStatusEvidence(input)
    input.identity.match_method = 'family_or_name_only'

    const result = classifyUsStatusProposal(input)
    expect(result.research_state).toBe('identity_unresolved')
    expect(result.layer_assessments.identity).toBe('family_or_name_only')
    expect(result.confidence).toBe('low')
  })

  it('uses insufficient_evidence for completed searches with no result, never discontinued', () => {
    const input = baseInput()
    makeNoCurrentStatusEvidence(input)

    const result = classifyUsStatusProposal(input)
    expect(result.research_state).toBe('insufficient_evidence')
    expect(result.research_state).not.toBe('not_currently_distributed_supported')
    expect(result.reason_codes).toContain('no_result_is_not_discontinuation_evidence')
  })

  it('keeps safety-action evidence as safety context and never uses it as distribution evidence', () => {
    const input = baseInput()
    makeNoCurrentStatusEvidence(input)
    input.safety_action.action_state = 'active_exact_product_action'
    input.safety_action.action_scope = 'lot_specific'

    const result = classifyUsStatusProposal(input)
    expect(result.research_state).toBe('insufficient_evidence')
    expect(result.layer_assessments.safety_action).toBe('active_exact_product_action')
    expect(result.reason_codes).toContain(
      'active_exact_safety_action_recorded_as_separate_safety_context',
    )
  })

  describe('mandatory safety gate', () => {
    it('keeps distribution supported but holds visibility review for an active lot-specific action', () => {
      const input = baseInput()
      input.safety_action = {
        search_status: 'searched',
        action_state: 'active_exact_product_action',
        action_scope: 'lot_specific',
        exact_action_sources_traceable: true,
      }

      const result = classifyUsStatusProposal(input)

      // Axis 1 — distribution is untouched by the safety action.
      expect(result.research_state).toBe('current_us_distribution_supported')
      expect(result.confidence).toBe('high')
      expect(result.invariant_audit).toMatchObject({ passed: true, failures: [] })
      // Axis 2 — ordinary visibility review is held.
      expect(result.visibility_review_eligibility).toBe('hold_active_safety_action')
      expect(result.proposed_human_review_disposition).toBe(
        'keep_hidden_pending_active_safety_action_review',
      )
      expect(result.proposed_human_review_disposition).not.toBe('review_for_prototype_visibility')
      expect(result.proposed_human_review_disposition).not.toBe('keep_hidden_conflicting')
      expect(result.safety_review_gate.failures).toContain('active_exact_safety_action_present')
      expect(result.canonical_change_applied).toBe(false)
    })

    it('retains a completed exact action as historical safety context without blocking review', () => {
      const input = baseInput()
      input.safety_action.action_state = 'historical_exact_product_action'
      input.safety_action.action_scope = 'lot_specific'

      const result = classifyUsStatusProposal(input)

      expect(result.research_state).toBe('current_us_distribution_supported')
      expect(result.layer_assessments.safety_action).toBe('historical_exact_product_action')
      expect(result.reason_codes).toContain(
        'historical_exact_safety_action_recorded_as_separate_safety_context',
      )
      expect(result.visibility_review_eligibility).toBe('eligible_for_owner_review')
      expect(result.proposed_human_review_disposition).toBe('review_for_prototype_visibility')
    })

    it('allows ordinary review when a completed search found no exact action', () => {
      const result = classifyUsStatusProposal(baseInput())

      expect(result.layer_assessments.safety_action).toBe('no_exact_action_found')
      expect(result.visibility_review_eligibility).toBe('eligible_for_owner_review')
      expect(result.proposed_human_review_disposition).toBe('review_for_prototype_visibility')
      expect(result.safety_review_gate.failures).toEqual([])
    })

    it('withholds an ordinary disposition when the safety search was never performed', () => {
      const input = baseInput()
      input.safety_action = {
        search_status: 'not_searched',
        action_state: 'unknown',
        action_scope: 'unknown',
        exact_action_sources_traceable: true,
      }

      const result = classifyUsStatusProposal(input)

      expect(result.research_state).toBe('current_us_distribution_supported')
      expect(result.visibility_review_eligibility).toBe('hold_safety_search_incomplete')
      expect(result.proposed_human_review_disposition).toBe('keep_hidden_pending_safety_review')
      expect(result.safety_review_gate.failures).toContain('safety_search_not_performed')
      // An absent search is never reported as a searched absence.
      expect(result.layer_assessments.safety_action).not.toBe('no_exact_action_found')
    })

    it('holds review when the safety search returned a query error', () => {
      const input = baseInput()
      input.safety_action = {
        search_status: 'query_error',
        action_state: 'unknown',
        action_scope: 'unknown',
        exact_action_sources_traceable: true,
      }

      const result = classifyUsStatusProposal(input)

      expect(result.research_state).toBe('current_us_distribution_supported')
      expect(result.visibility_review_eligibility).toBe('hold_safety_search_incomplete')
      expect(result.proposed_human_review_disposition).toBe('keep_hidden_pending_safety_review')
      expect(result.safety_review_gate.failures).toContain('safety_search_query_error')
      expect(result.safety_review_gate.failures).not.toContain('safety_search_not_performed')
    })

    it('records family-only safety evidence as ambiguous rather than an exact action', () => {
      const input = baseInput()
      input.safety_action.action_state = 'family_or_ambiguous_action'
      input.safety_action.action_scope = 'family_level'

      const result = classifyUsStatusProposal(input)

      expect(result.research_state).toBe('current_us_distribution_supported')
      expect(result.layer_assessments.safety_action).toBe('family_or_ambiguous_action')
      expect(result.layer_assessments.safety_action).not.toBe('active_exact_product_action')
      expect(result.reason_codes).toContain(
        'family_or_ambiguous_safety_action_is_not_an_exact_product_action',
      )
      expect(result.visibility_review_eligibility).toBe('hold_safety_identity_ambiguous')
      expect(result.proposed_human_review_disposition).toBe('keep_hidden_pending_safety_review')
    })

    it('holds review when an exact safety action is not fully source-traceable', () => {
      const input = baseInput()
      input.safety_action.exact_action_sources_traceable = false

      const result = classifyUsStatusProposal(input)

      expect(result.visibility_review_eligibility).toBe('hold_safety_search_incomplete')
      expect(result.safety_review_gate.failures).toContain(
        'safety_action_source_traceability_incomplete',
      )
    })

    it('never lets a safety action create the negative distribution state', () => {
      const input = baseInput()
      makeNoCurrentStatusEvidence(input)
      input.safety_action.action_state = 'active_exact_product_action'
      input.safety_action.action_scope = 'product_wide'

      const result = classifyUsStatusProposal(input)

      expect(result.research_state).toBe('insufficient_evidence')
      expect(result.research_state).not.toBe('not_currently_distributed_supported')
      expect(result.research_state).not.toBe('current_status_conflicted')
    })

    it('requires a completed safety search before a negative distribution review', () => {
      const negative = (): UsStatusClassificationInput => {
        const input = baseInput()
        input.udi_distribution.configurations = [configuration('DI-1', 'not_in_distribution')]
        input.manufacturer.finding = 'no_result'
        return input
      }

      const searched = classifyUsStatusProposal(negative())
      expect(searched.research_state).toBe('not_currently_distributed_supported')
      expect(searched.proposed_human_review_disposition).toBe('review_as_not_currently_distributed')

      const unsearched = negative()
      unsearched.safety_action = {
        search_status: 'not_searched',
        action_state: 'unknown',
        action_scope: 'unknown',
        exact_action_sources_traceable: true,
      }
      const held = classifyUsStatusProposal(unsearched)
      expect(held.research_state).toBe('not_currently_distributed_supported')
      expect(held.proposed_human_review_disposition).toBe('keep_hidden_pending_safety_review')
      expect(held.proposed_human_review_disposition).not.toBe('review_as_not_currently_distributed')
    })

    it('leaves the safety gate not applicable for non-review states', () => {
      const input = baseInput()
      makeNoCurrentStatusEvidence(input)

      const result = classifyUsStatusProposal(input)

      expect(result.safety_review_gate).toEqual({
        performed: false,
        eligibility: 'not_applicable',
        failures: [],
      })
      expect(result.visibility_review_eligibility).toBe('not_applicable')
    })

    it('cannot reach an ordinary review disposition without an exact identity', () => {
      const input = baseInput()
      input.identity.match_method = 'family_or_name_only'

      const result = classifyUsStatusProposal(input)

      expect(result.proposed_human_review_disposition).toBe('keep_hidden_identity_unresolved')
      expect(result.visibility_review_eligibility).toBe('not_applicable')
    })
  })

  it('uses the noncommercial/local state only when explicitly identified', () => {
    const input = baseInput()
    makeNoCurrentStatusEvidence(input)
    expect(classifyUsStatusProposal(input).research_state).toBe('insufficient_evidence')

    input.explicitly_noncommercial_or_local = true
    const result = classifyUsStatusProposal(input)
    expect(result).toMatchObject({
      research_state: 'not_applicable_noncommercial_or_local',
      proposed_human_review_disposition: 'review_as_noncommercial_or_local',
      canonical_change_applied: false,
    })
  })

  const independentInvariantCases: Array<
    [keyof IndependentInvariantEvidence, HighConfidenceInvariantFailure, UsStatusResearchState]
  > = [
    ['adjacent_sku_excluded', 'adjacent_sku_risk_not_excluded', 'identity_unresolved'],
    [
      'exact_configuration_inventory_complete',
      'exact_configuration_inventory_incomplete',
      'current_status_conflicted',
    ],
    [
      'package_levels_distinguished',
      'package_levels_not_distinguished',
      'current_status_conflicted',
    ],
    ['evidence_packet_complete', 'evidence_packet_incomplete', 'current_status_conflicted'],
    ['all_sources_traceable', 'source_traceability_incomplete', 'current_status_conflicted'],
    [
      'registration_authorization_separated',
      'registration_authorization_not_separated',
      'current_status_conflicted',
    ],
    [
      'recall_excluded_from_distribution',
      'recall_not_separated_from_distribution',
      'current_status_conflicted',
    ],
  ]

  it.each(independentInvariantCases)(
    'fails and downgrades a provisional positive when %s is false',
    (field, expectedFailure, expectedState) => {
      const input = baseInput()
      input.independent_invariants[field] = false

      const result = classifyUsStatusProposal(input)
      expect(result.research_state).toBe(expectedState)
      expect(result.confidence).not.toBe('high')
      expect(result.invariant_audit).toMatchObject({
        performed: true,
        provisional_state: 'current_us_distribution_supported',
        passed: false,
      })
      expect(result.invariant_audit.failures).toContain(expectedFailure)
      expect(result.reason_codes).toContain('high_confidence_invariant_failed')
    },
  )

  it.each([
    ['identity', 'identity_conflict_present', 'identity_unresolved'],
    ['model', 'model_conflict_present', 'identity_unresolved'],
    ['manufacturer', 'manufacturer_conflict_present', 'identity_unresolved'],
    ['distribution', 'distribution_conflict_present', 'current_status_conflicted'],
    ['discontinuation', 'discontinuation_conflict_present', 'current_status_conflicted'],
  ] as const)(
    'returns granular invariant failure for %s conflict',
    (conflict, expectedFailure, expectedState) => {
      const input = baseInput()
      if (conflict === 'identity') input.identity.conflict = true
      else input.conflicts[conflict] = true

      const result = classifyUsStatusProposal(input)
      expect(result.research_state).toBe(expectedState)
      expect(result.invariant_audit.failures).toContain(expectedFailure)
    },
  )

  it('independently audits and downgrades a provisional negative', () => {
    const input = baseInput()
    input.udi_distribution.configurations = [configuration('DI-1', 'not_in_distribution')]
    input.manufacturer.finding = 'no_result'
    input.independent_invariants.all_sources_traceable = false

    const result = classifyUsStatusProposal(input)
    expect(result.research_state).toBe('current_status_conflicted')
    expect(result.invariant_audit).toMatchObject({
      performed: true,
      provisional_state: 'not_currently_distributed_supported',
      passed: false,
    })
    expect(result.invariant_audit.failures).toContain('source_traceability_incomplete')
  })

  it('always returns canonical_change_applied false for every reachable research state', () => {
    const inputs: UsStatusClassificationInput[] = []

    inputs.push(baseInput())

    const negative = baseInput()
    negative.udi_distribution.configurations = [configuration('DI-1', 'not_in_distribution')]
    negative.manufacturer.finding = 'no_result'
    inputs.push(negative)

    const historical = baseInput()
    makeNoCurrentStatusEvidence(historical)
    historical.authorization.finding = 'exact_pma_approval'
    inputs.push(historical)

    const conflicted = baseInput()
    conflicted.udi_distribution.configurations = [
      configuration('DI-1', 'in_distribution'),
      configuration('PKG-1', 'not_in_distribution', 'package'),
    ]
    inputs.push(conflicted)

    const identity = baseInput()
    makeNoCurrentStatusEvidence(identity)
    identity.identity.match_method = 'family_or_name_only'
    inputs.push(identity)

    const insufficient = baseInput()
    makeNoCurrentStatusEvidence(insufficient)
    inputs.push(insufficient)

    const noncommercial = baseInput()
    noncommercial.explicitly_noncommercial_or_local = true
    inputs.push(noncommercial)

    const results = inputs.map(classifyUsStatusProposal)
    expect(new Set(results.map((entry) => entry.research_state))).toEqual(
      new Set(US_STATUS_RESEARCH_STATES),
    )
    expect(results.every((entry) => entry.canonical_change_applied === false)).toBe(true)
  })
})
