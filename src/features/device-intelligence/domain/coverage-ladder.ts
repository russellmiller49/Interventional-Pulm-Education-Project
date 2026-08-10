/**
 * The Phase D0 role-coverage ladder, computed from data rather than copied from the audit.
 *
 * The semantics mirror `scripts/ip-device-intelligence/audit-data-readiness.ts` exactly —
 * `docs/ip-device-intelligence/data-readiness-audit.json` is the byte-stable reference and a
 * jest test asserts this module reproduces its per-role states for the three exemplar
 * procedures — but the UI derives the states from the same generated rows the audit reads,
 * so a future catalog import moves both together instead of leaving stale counts in a page.
 *
 * Proposals participate only as this ladder's `proposals_only` rung and as counts. They are
 * unreviewed, never selectable, and never satisfy coverage or readiness (decision D-08).
 */

export type RoleCoverageState =
  | 'selectable_authored'
  | 'non_selectable_authored_only'
  | 'proposals_only'
  | 'no_option_no_proposal_role_mapped'
  | 'no_option_no_proposal_unmapped'

export interface CoverageSlotRow {
  slot_id: string
  role_code: string
}

export interface CoverageOptionRow {
  slot_id: string
  selectable: boolean | null
}

export interface CoverageProposalRow {
  slot_id: string
}

export interface CoverageLadderInput {
  /** The procedure's own slots (its 13 / 15 / 29 requirement rows). */
  slots: CoverageSlotRow[]
  /** Authored `slot-product-options` rows, any procedure. */
  slotProductOptions: CoverageOptionRow[]
  /** Unreviewed `slot-product-option-proposals` rows, any procedure. */
  slotOptionProposals: CoverageProposalRow[]
  /** Every role code that has at least one Product_Roles mapping anywhere in the catalog. */
  mappedRoleCodes: ReadonlySet<string>
  /** Role codes carried by `seed/demo-stand-ins.json` — a cross-cutting overlay, not a rung. */
  demoStandInRoleCodes: ReadonlySet<string>
}

export interface RoleCoverageRow {
  roleCode: string
  slotCount: number
  coverage: RoleCoverageState
  demoStandIn: boolean
  /** Unreviewed proposal rows touching this role's slots. Display-only. */
  proposalCount: number
}

export interface CoverageLadderSummary {
  selectableAuthored: number
  nonSelectableAuthoredOnly: number
  proposalsOnly: number
  noOptionNoProposalRoleMapped: number
  noOptionNoProposalUnmapped: number
}

export interface CoverageLadderResult {
  roles: RoleCoverageRow[]
  byRoleCode: Map<string, RoleCoverageRow>
  summary: CoverageLadderSummary
}

/**
 * The single rung classifier, shared by the role-level ladder below and the per-slot status
 * on the clinical-role page — one definition of "selectable → authored-only → proposals-only
 * → nothing", so two surfaces can never disagree about the same rows.
 */
export function classifyAuthoredCoverage(params: {
  hasSelectableOption: boolean
  optionCount: number
  proposalCount: number
  roleMappedElsewhere: boolean
}): RoleCoverageState {
  if (params.hasSelectableOption) return 'selectable_authored'
  if (params.optionCount > 0) return 'non_selectable_authored_only'
  if (params.proposalCount > 0) return 'proposals_only'
  if (params.roleMappedElsewhere) return 'no_option_no_proposal_role_mapped'
  return 'no_option_no_proposal_unmapped'
}

export function computeCoverageLadder(input: CoverageLadderInput): CoverageLadderResult {
  const optionsBySlot = new Map<string, CoverageOptionRow[]>()
  for (const option of input.slotProductOptions) {
    const rows = optionsBySlot.get(option.slot_id)
    if (rows) rows.push(option)
    else optionsBySlot.set(option.slot_id, [option])
  }
  const proposalsBySlot = new Map<string, CoverageProposalRow[]>()
  for (const proposal of input.slotOptionProposals) {
    const rows = proposalsBySlot.get(proposal.slot_id)
    if (rows) rows.push(proposal)
    else proposalsBySlot.set(proposal.slot_id, [proposal])
  }

  const roleCodes = [...new Set(input.slots.map((slot) => slot.role_code))].sort()
  const roles: RoleCoverageRow[] = roleCodes.map((roleCode) => {
    const roleSlots = input.slots.filter((slot) => slot.role_code === roleCode)
    const options = roleSlots.flatMap((slot) => optionsBySlot.get(slot.slot_id) ?? [])
    const proposals = roleSlots.flatMap((slot) => proposalsBySlot.get(slot.slot_id) ?? [])
    const coverage = classifyAuthoredCoverage({
      hasSelectableOption: options.some((option) => option.selectable === true),
      optionCount: options.length,
      proposalCount: proposals.length,
      roleMappedElsewhere: input.mappedRoleCodes.has(roleCode),
    })
    return {
      roleCode,
      slotCount: roleSlots.length,
      coverage,
      demoStandIn: input.demoStandInRoleCodes.has(roleCode),
      proposalCount: proposals.length,
    }
  })

  const count = (state: RoleCoverageState) => roles.filter((row) => row.coverage === state).length

  return {
    roles,
    byRoleCode: new Map(roles.map((row) => [row.roleCode, row])),
    summary: {
      selectableAuthored: count('selectable_authored'),
      nonSelectableAuthoredOnly: count('non_selectable_authored_only'),
      proposalsOnly: count('proposals_only'),
      noOptionNoProposalRoleMapped: count('no_option_no_proposal_role_mapped'),
      noOptionNoProposalUnmapped: count('no_option_no_proposal_unmapped'),
    },
  }
}
