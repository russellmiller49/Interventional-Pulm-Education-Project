/**
 * The Phase D1 demo-only readiness projection.
 *
 * A pure, deterministic projection of one already-resolved card (the existing resolver's
 * output — this module never resolves anything itself) plus the coverage ladder and the
 * product-grade evidence, into the eight requirement-level states specified in
 * `docs/ip-device-intelligence/vertical-slice-spec.md` §4:
 *
 *   1 ready · 2 ready_with_limitations · 3 not_ready (primary states)
 *   4 missing_required_product_role · 5 missing_room_capability · 6 missing_rescue_pathway
 *   7 available_but_unverified · 8 inventory_formulary_mismatch (diagnostic states)
 *
 * Safety rules enforced here and pinned by tests:
 * - candidate- or unknown-grade evidence never produces plain `ready`;
 * - a demo stand-in mapping always forces a limitation — and for a REQUIRED role whose
 *   coverage rung is structurally uncovered (proposals-only or wholly unauthored), no
 *   stand-in or hospital-item mapping can lift the requirement above `not_ready`;
 * - proposals are not coverage and cannot influence any state;
 * - a missing attribute (compatibility `unknown`) is a limitation, never a silent pass;
 * - every diagnostic carries the identifier of the row or rule that produced it.
 *
 * Nothing is persisted. The projection runs per request over the fictional demo context and
 * is watermarked DEMO DATA — NOT AN ACTUAL INSTITUTION by the route that renders it.
 */

import type { RoleCoverageRow } from './coverage-ladder'

export type RequirementReadinessState = 'ready' | 'ready_with_limitations' | 'not_ready'

export type ReadinessDiagnosticCode =
  | 'missing_required_product_role'
  | 'missing_room_capability'
  | 'missing_rescue_pathway'
  | 'available_but_unverified'
  | 'inventory_formulary_mismatch'

export interface ReadinessDiagnostic {
  code: ReadinessDiagnosticCode
  /** What produced this diagnostic — always resolvable back to data. */
  sourceKind:
    | 'procedure_slot'
    | 'resolved_item'
    | 'capability'
    | 'rescue_module'
    | 'compatibility_rule'
    | 'formulary_row'
  sourceId: string
  /** The coverage-ladder rung, hospital item id, rule id, or capability behind the state. */
  detail: string
}

/** The subset of a resolved card item this projection reads. */
export interface ReadinessItemInput {
  id: string
  sourceSlotId: string | null
  roleCode: string
  label: string
  effectiveRequiredness: string
  includedBy: string | null
  selectedHospitalItemId: string | null
  selectedCatalogProductId: string | null
  verificationState: string | null
  compatibilityState: string | null
}

export interface ReadinessWarningInput {
  severity: string
  code: string
  message: string
  sourceId: string | null
}

/** A formulary assertion to check for state 8. Empty today; exercised by fixtures in tests. */
export interface FormularyAssertionInput {
  formularyId: string
  productId: string
  hospitalCarries: boolean
  preferred: boolean
  productVisibilityState: string | null
  /**
   * The role codes parsed from THIS formulary row. Eligibility is judged against the slots
   * these codes name, never against a procedure-wide product set: a product selectable for
   * an unrelated slot cannot satisfy a row that maps it to a different role.
   */
  roleCodes: string[]
}

export interface ReadinessProjectionInput {
  items: ReadinessItemInput[]
  warnings: ReadinessWarningInput[]
  /** Coverage ladder for the procedure's own requirement roles. */
  ladderByRole: ReadonlyMap<string, RoleCoverageRow>
  /** verification_grade by product id, for grade gating. */
  productGradeById: ReadonlyMap<string, string>
  /** `${slotId}|${productId}` pairs that are authored SELECTABLE options. */
  authoredSelectablePairs: ReadonlySet<string>
  /** Role codes covered only by demo stand-ins (seed/demo-stand-ins.json). */
  demoStandInRoleCodes: ReadonlySet<string>
  /**
   * Authored SELECTABLE option product ids per requirement role of THIS procedure — the
   * role-scoped eligibility surface the formulary check reads. Roles outside the procedure
   * are simply absent, so a row's stray role codes can never widen eligibility.
   */
  authoredSelectableProductIdsByRole: ReadonlyMap<string, ReadonlySet<string>>
  formularyAssertions: FormularyAssertionInput[]
}

export interface RequirementReadiness {
  itemId: string
  sourceSlotId: string | null
  roleCode: string
  label: string
  effectiveRequiredness: string
  state: RequirementReadinessState
  diagnostics: ReadinessDiagnostic[]
  /**
   * The resolver's own messages about this requirement's selected mapping (for example
   * "…is prototype-visible and requires current local verification"), quoted verbatim.
   * Never dropped: a `ready` state under spec rule 1 still shows these.
   */
  resolverAdvisories: ReadinessWarningInput[]
  /** Why the state is what it is, as data — the view renders it, tests pin it. */
  evidence: {
    selectedHospitalItemId: string | null
    selectedCatalogProductId: string | null
    verificationState: string | null
    productVerificationGrade: string | null
    authoredSelectableOption: boolean
    demoStandIn: boolean
    coverage: RoleCoverageRow['coverage'] | null
  }
}

export interface ReadinessProjection {
  headline: RequirementReadinessState
  requirements: RequirementReadiness[]
  /** Card-level diagnostics that are not tied to one requirement row. */
  cardDiagnostics: ReadinessDiagnostic[]
  /** Blocking rule messages carried through verbatim — a blocked card is never `ready`. */
  blockingWarnings: ReadinessWarningInput[]
  /**
   * Every resolver message that did not become a diagnostic, a blocking entry, or a
   * per-requirement advisory. Rendered as-is so no resolver output is silently dropped.
   */
  otherWarnings: ReadinessWarningInput[]
}

const NO_COVERAGE_RUNGS: ReadonlySet<RoleCoverageRow['coverage']> = new Set([
  'proposals_only',
  'no_option_no_proposal_role_mapped',
  'no_option_no_proposal_unmapped',
])

const UNVERIFIED_MAPPING_STATES: ReadonlySet<string> = new Set([
  'demo_only',
  'unverified',
  'hidden',
])

const UNVERIFIED_GRADES: ReadonlySet<string> = new Set(['candidate', 'unknown'])

function weakest(states: RequirementReadinessState[]): RequirementReadinessState {
  if (states.includes('not_ready')) return 'not_ready'
  if (states.includes('ready_with_limitations')) return 'ready_with_limitations'
  return 'ready'
}

export function projectDemoReadiness(input: ReadinessProjectionInput): ReadinessProjection {
  const consumedWarnings = new Set<ReadinessWarningInput>()
  const requirements: RequirementReadiness[] = input.items.map((item) => {
    const diagnostics: ReadinessDiagnostic[] = []
    const coverage = input.ladderByRole.get(item.roleCode) ?? null
    const grade = item.selectedCatalogProductId
      ? (input.productGradeById.get(item.selectedCatalogProductId) ?? null)
      : null
    const demoStandIn = input.demoStandInRoleCodes.has(item.roleCode)
    const authoredSelectableOption = Boolean(
      item.sourceSlotId &&
      item.selectedCatalogProductId &&
      input.authoredSelectablePairs.has(`${item.sourceSlotId}|${item.selectedCatalogProductId}`),
    )

    // The resolver's own messages about this requirement's selected mapping — matched by the
    // hospital-item id the resolver stamps as sourceId (e.g. "…is prototype-visible and
    // requires current local verification"). Quoted verbatim beside the state, never dropped.
    const resolverAdvisories = input.warnings.filter(
      (warning) =>
        item.selectedHospitalItemId !== null && warning.sourceId === item.selectedHospitalItemId,
    )
    for (const advisory of resolverAdvisories) consumedWarnings.add(advisory)

    const hasSelection = item.selectedHospitalItemId !== null

    // A required role whose ladder rung is structurally uncovered: proposals-only, or the
    // two wholly unauthored rungs. Proposals are not coverage (decision D-08), and a demo
    // stand-in or hospital-item mapping is an institutional overlay, not authored coverage —
    // so this gap forces `not_ready` below regardless of any selection (Codex C-01).
    const requiredStructuralGap =
      item.effectiveRequiredness === 'required' &&
      coverage !== null &&
      NO_COVERAGE_RUNGS.has(coverage.coverage)

    // State 4 — a required requirement whose role has no authored selectable option anywhere
    // (proposals-only and wholly unmapped rungs). Structural, independent of any institution.
    // A required requirement OUTSIDE the template ladder (added by a modifier or a rescue
    // module) that resolves nothing is diagnosed the same way rather than failing silently:
    // no coverage rung exists for it and no authored option can.
    if (
      requiredStructuralGap ||
      (item.effectiveRequiredness === 'required' &&
        coverage === null &&
        item.selectedHospitalItemId === null)
    ) {
      diagnostics.push({
        code: 'missing_required_product_role',
        sourceKind: 'procedure_slot',
        sourceId: item.sourceSlotId ?? item.id,
        detail: coverage
          ? `role ${item.roleCode} coverage=${coverage.coverage}`
          : `role ${item.roleCode} is a modifier- or rescue-added requirement outside the template ladder, and nothing resolved for it`,
      })
    }

    // State 7 — coverage exists but only via unverified evidence: a demo-only/unverified
    // mapping, or a candidate/unknown-grade product. Never a silent pass.
    if (
      hasSelection &&
      ((item.verificationState !== null && UNVERIFIED_MAPPING_STATES.has(item.verificationState)) ||
        (grade !== null && UNVERIFIED_GRADES.has(grade)))
    ) {
      diagnostics.push({
        code: 'available_but_unverified',
        sourceKind: 'resolved_item',
        sourceId: item.selectedHospitalItemId ?? item.id,
        detail: `verificationState=${item.verificationState ?? 'null'} grade=${grade ?? 'none'}`,
      })
    }

    // State 6 (per-requirement half) — a rescue-module requirement with no coverage at all.
    const fromRescueModule = (item.includedBy ?? '').includes('rescue module')
    if (fromRescueModule && !hasSelection) {
      diagnostics.push({
        code: 'missing_rescue_pathway',
        sourceKind: 'rescue_module',
        sourceId: item.id,
        detail: `rescue requirement ${item.roleCode} has no mapped coverage`,
      })
    }

    let state: RequirementReadinessState
    if (requiredStructuralGap) {
      // Codex C-01: a required requirement with structural no-coverage is `not_ready` even
      // when a demo stand-in or hospital-item mapping selected something — the mapping stays
      // disclosed in `evidence` and its resolver advisories keep rendering, but it cannot
      // convert an unauthored role into any form of readiness.
      state = 'not_ready'
    } else if (!hasSelection) {
      // No institutional mapping at all. For a required requirement that is state 3; for
      // contingency/optional it degrades the card per spec §4 rule 2's final clause.
      state = item.effectiveRequiredness === 'required' ? 'not_ready' : 'ready_with_limitations'
    } else {
      const plainReady =
        diagnostics.length === 0 &&
        !demoStandIn &&
        authoredSelectableOption &&
        grade === 'verified_source' &&
        item.compatibilityState !== 'unknown' &&
        item.compatibilityState !== 'fail'
      state = plainReady ? 'ready' : 'ready_with_limitations'
    }

    return {
      itemId: item.id,
      sourceSlotId: item.sourceSlotId,
      roleCode: item.roleCode,
      label: item.label,
      effectiveRequiredness: item.effectiveRequiredness,
      state,
      diagnostics,
      resolverAdvisories,
      evidence: {
        selectedHospitalItemId: item.selectedHospitalItemId,
        selectedCatalogProductId: item.selectedCatalogProductId,
        verificationState: item.verificationState,
        productVerificationGrade: grade,
        authoredSelectableOption,
        demoStandIn,
        coverage: coverage?.coverage ?? null,
      },
    }
  })

  const cardDiagnostics: ReadinessDiagnostic[] = []
  for (const warning of input.warnings) {
    // State 5 — the domain's own room-capability check, carried through with its capability id.
    if (warning.code === 'room_capability_missing') {
      cardDiagnostics.push({
        code: 'missing_room_capability',
        sourceKind: 'capability',
        sourceId: warning.sourceId ?? 'unknown_capability',
        detail: warning.message,
      })
    }
    // State 6 (card-level half) — a reachable rescue module that failed to resolve.
    if (warning.code === 'rescue_module_missing') {
      cardDiagnostics.push({
        code: 'missing_rescue_pathway',
        sourceKind: 'rescue_module',
        sourceId: warning.sourceId ?? 'unknown_rescue_module',
        detail: warning.message,
      })
    }
    // A compatibility rule that evaluated `unknown` is a limitation, never a pass.
    if (warning.code === 'compatibility_unknown' || warning.code === 'compatibility_failed') {
      cardDiagnostics.push({
        code: 'available_but_unverified',
        sourceKind: 'compatibility_rule',
        sourceId: warning.sourceId ?? 'unknown_rule',
        detail: warning.message,
      })
    }
  }

  // State 8 — an institutional assertion that disagrees with authored eligibility. The real
  // formulary carries zero assertions today, so in production data this never fires; the
  // rule is exercised by fixtures in tests, exactly as the D0 specification records.
  // Eligibility is role/slot-scoped (Codex C-04): a carried or preferred row is eligible only
  // when its product is an authored SELECTABLE option for a slot of a role the row itself
  // names. A product selectable for an unrelated slot never satisfies a different role's row,
  // and hidden-product rows stay mismatches regardless of eligibility (fail closed).
  for (const assertion of input.formularyAssertions) {
    if (!assertion.hospitalCarries && !assertion.preferred) continue
    const eligibleForNamedRole = assertion.roleCodes.some((roleCode) =>
      input.authoredSelectableProductIdsByRole.get(roleCode)?.has(assertion.productId),
    )
    if (!eligibleForNamedRole || assertion.productVisibilityState === 'hidden') {
      cardDiagnostics.push({
        code: 'inventory_formulary_mismatch',
        sourceKind: 'formulary_row',
        sourceId: assertion.formularyId,
        detail: `product ${assertion.productId} carried=${assertion.hospitalCarries} preferred=${assertion.preferred} roleCodes=${assertion.roleCodes.join('/') || 'none'} eligibleForNamedRole=${eligibleForNamedRole} visibility=${assertion.productVisibilityState ?? 'unknown'}`,
      })
    }
  }

  const diagnosedCodes = new Set([
    'room_capability_missing',
    'rescue_module_missing',
    'compatibility_unknown',
    'compatibility_failed',
  ])
  // Blocking messages already represented as card diagnostics (capability/rescue) are not
  // listed twice; everything else blocking (mutual exclusion, blocking compatibility) is.
  const blockingWarnings = input.warnings.filter(
    (warning) =>
      warning.severity === 'blocking' &&
      warning.code !== 'room_capability_missing' &&
      warning.code !== 'rescue_module_missing',
  )
  for (const warning of blockingWarnings) consumedWarnings.add(warning)
  // Nothing the resolver said is dropped: whatever became neither a diagnostic, nor a
  // blocking entry, nor a per-requirement advisory is carried through verbatim.
  const otherWarnings = input.warnings.filter(
    (warning) => !consumedWarnings.has(warning) && !diagnosedCodes.has(warning.code),
  )

  const headlineInputs: RequirementReadinessState[] = [
    ...requirements.map((requirement) => requirement.state),
    // Card-level capability, rescue, and mismatch failures pull the headline down.
    ...cardDiagnostics
      .filter(
        (diagnostic) =>
          diagnostic.code === 'missing_room_capability' ||
          diagnostic.code === 'missing_rescue_pathway' ||
          diagnostic.code === 'inventory_formulary_mismatch',
      )
      .map(() => 'not_ready' as const),
    ...cardDiagnostics
      .filter((diagnostic) => diagnostic.sourceKind === 'compatibility_rule')
      .map(() => 'ready_with_limitations' as const),
    // A blocking resolver message (mutual exclusion, blocking compatibility) blocks readiness.
    ...input.warnings
      .filter((warning) => warning.severity === 'blocking')
      .map(() => 'not_ready' as const),
  ]

  return {
    headline: weakest(headlineInputs),
    requirements,
    cardDiagnostics,
    blockingWarnings,
    otherWarnings,
  }
}
