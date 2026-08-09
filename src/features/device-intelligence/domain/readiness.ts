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
 * - a demo stand-in mapping always forces a limitation;
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
  /** Whether this product is an authored SELECTABLE option on any slot of this procedure. */
  authoredSelectableForProcedure: boolean
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

    // State 4 — a required requirement whose role has no authored selectable option anywhere
    // (proposals-only and wholly unmapped rungs). Structural, independent of any institution.
    if (
      item.effectiveRequiredness === 'required' &&
      coverage &&
      NO_COVERAGE_RUNGS.has(coverage.coverage)
    ) {
      diagnostics.push({
        code: 'missing_required_product_role',
        sourceKind: 'procedure_slot',
        sourceId: item.sourceSlotId ?? item.id,
        detail: `role ${item.roleCode} coverage=${coverage.coverage}`,
      })
    }

    const hasSelection = item.selectedHospitalItemId !== null

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
    if (!hasSelection) {
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
  for (const assertion of input.formularyAssertions) {
    if (!assertion.hospitalCarries && !assertion.preferred) continue
    if (
      !assertion.authoredSelectableForProcedure ||
      assertion.productVisibilityState === 'hidden'
    ) {
      cardDiagnostics.push({
        code: 'inventory_formulary_mismatch',
        sourceKind: 'formulary_row',
        sourceId: assertion.formularyId,
        detail: `product ${assertion.productId} carried=${assertion.hospitalCarries} preferred=${assertion.preferred} authoredSelectable=${assertion.authoredSelectableForProcedure} visibility=${assertion.productVisibilityState ?? 'unknown'}`,
      })
    }
  }

  const blockingWarnings = input.warnings.filter((warning) => warning.severity === 'blocking')

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
    ...blockingWarnings.map(() => 'not_ready' as const),
  ]

  return {
    headline: weakest(headlineInputs),
    requirements,
    cardDiagnostics,
    blockingWarnings,
  }
}
