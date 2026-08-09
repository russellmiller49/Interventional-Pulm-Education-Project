/**
 * Phase D0 deterministic data-readiness audit for the Device and Procedure Intelligence
 * Platform discovery (docs/ip-device-intelligence/).
 *
 * Reads the committed generated catalog artifacts (READ-ONLY) and writes
 * docs/ip-device-intelligence/data-readiness-audit.json — a content-addressed report over the
 * three exemplar procedures (CHEST_TUBE, EBUS_TBNA, THERAPEUTIC_BRONCH) plus a global section.
 *
 * Determinism contract: no timestamps anywhere; every array is stable-sorted; every split
 * object has alphabetically sorted keys; provenance is the workbook sha256 from
 * import-report.json plus the catalogReleaseId from catalog-release.json. Running the script
 * twice over the same generated data produces byte-identical output (the jest suite enforces
 * this as a drift detector, mirroring validate-data's byte-for-byte approach).
 *
 * This tool audits data readiness only. It never claims products are clinically equivalent or
 * substitutable, and it does not modify any catalog data.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

// prettier's main entry (index.cjs) performs a top-level dynamic import that the jest VM
// rejects, so the drift-detecting test suite could never import it. The standalone build plus
// explicit plugins is dependency-identical and produces byte-identical JSON output (verified
// against scripts/ip-preference-cards/format-json.ts, which resolves the same .prettierrc).
import * as prettierPluginBabel from 'prettier/plugins/babel'
import * as prettierPluginEstree from 'prettier/plugins/estree'
import { format } from 'prettier/standalone'

const GENERATED_DIRECTORY = 'data/ip-preference-cards/generated'
const SEED_DIRECTORY = 'data/ip-preference-cards/seed'
const OUTPUT_PATH = 'docs/ip-device-intelligence/data-readiness-audit.json'

export const EXEMPLAR_PROCEDURE_CODES = ['CHEST_TUBE', 'EBUS_TBNA', 'THERAPEUTIC_BRONCH'] as const

/**
 * The only add_rescue_module modifier action in the resolver seed
 * (src/features/preference-cards/seed/operational.ts): HIGH_BLEED_RISK appends the
 * MAJOR_AIRWAY_BLEEDING equipment-readiness module. Generated release bundles pin one shared
 * rescue-module set (`definition-set-rescue-modules`) by hash rather than per procedure, so
 * reachability is derived from each procedure's allowed modifier codes.
 */
const RESCUE_MODULES_BY_MODIFIER: Readonly<Record<string, readonly string[]>> = {
  HIGH_BLEED_RISK: ['MAJOR_AIRWAY_BLEEDING'],
}

const DIMENSION_FIELDS = [
  'diameter_mm',
  'french_size',
  'gauge',
  'length_mm',
  'working_length_cm',
  'min_working_channel_mm',
  'delivery_system_od_mm',
  'size_display',
] as const

const FORMULARY_LOCAL_FIELDS = [
  'local_description',
  'local_item_number',
  'local_notes',
  'local_uom',
  'par_level',
  'storage_location',
] as const

interface ProcedureRow {
  procedure_code: string
  procedure_name: string
  template_version: string
  status: string
}

interface SlotRow {
  slot_id: string
  procedure_code: string
  section: string
  role_code: string
  requiredness: 'required' | 'conditional' | 'optional'
  allow_custom: boolean
  dependency_rule: string | null
}

interface OptionRow {
  slot_id: string
  product_id: string
  role_code: string
  selectable: boolean
  visible_by_default: boolean
}

interface ProposalRow {
  slot_id: string
  procedure_code: string
  role_code: string
  product_id: string
  proposal_status: string
}

interface ProductRoleRow {
  product_id: string
  role_code: string
}

interface CatalogProductRow {
  product_id: string
  verification_grade: string
  visibility_state: string
  diameter_mm: unknown
  french_size: unknown
  gauge: unknown
  length_mm: unknown
  working_length_cm: unknown
  min_working_channel_mm: unknown
  delivery_system_od_mm: unknown
  size_display: unknown
}

interface CompatibilityRuleRow {
  rule_id: string
  source_product_or_role: string | null
  target_product_or_role: string | null
  resolved_source_id: string | null
  resolved_target_id: string | null
  verification_grade: string
}

interface FormularyRow {
  product_id: string
  role_codes: string | null
  hospital_carries: boolean
  preferred: boolean
  local_description: unknown
  local_item_number: unknown
  local_notes: unknown
  local_uom: unknown
  par_level: unknown
  storage_location: unknown
}

interface ProductSourceRow {
  product_id: string
}

interface GudidConfirmationRow {
  product_id: string
}

interface CompositionRow {
  procedureCode: string
  allowedModifierCodes: string[]
}

interface FamilyVersionRow {
  productFamilyVersionId: string
  governanceState: string
  memberProductIds: string[]
}

interface ModifierDefinitionRow {
  code: string
  groupCode: string
}

interface DemoStandInRow {
  role_code: string
}

interface RoleRow {
  role_code: string
}

export interface DataReadinessInputs {
  procedures: ProcedureRow[]
  procedureSlots: SlotRow[]
  slotProductOptions: OptionRow[]
  slotOptionProposals: ProposalRow[]
  productRoles: ProductRoleRow[]
  catalogProducts: CatalogProductRow[]
  compatibilityRules: CompatibilityRuleRow[]
  formularyRows: FormularyRow[]
  productSources: ProductSourceRow[]
  gudidConfirmations: GudidConfirmationRow[]
  procedureCompositions: CompositionRow[]
  productFamilyVersions: FamilyVersionRow[]
  modifierDefinitions: ModifierDefinitionRow[]
  demoStandIns: DemoStandInRow[]
  roles: RoleRow[]
  workbookSha256: string
  catalogReleaseId: string
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
}

function sortedCount(values: string[]): Record<string, number> {
  const counts = new Map<string, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  const sorted: Record<string, number> = {}
  for (const key of [...counts.keys()].sort()) {
    sorted[key] = counts.get(key) as number
  }
  return sorted
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort()
}

type RoleCoverageState =
  | 'selectable_authored'
  | 'non_selectable_authored_only'
  | 'proposals_only'
  | 'no_option_no_proposal_role_mapped'
  | 'no_option_no_proposal_unmapped'

export function computeDataReadiness(inputs: DataReadinessInputs) {
  const optionsBySlot = new Map<string, OptionRow[]>()
  for (const option of inputs.slotProductOptions) {
    const rows = optionsBySlot.get(option.slot_id)
    if (rows) {
      rows.push(option)
    } else {
      optionsBySlot.set(option.slot_id, [option])
    }
  }

  const proposalsBySlot = new Map<string, ProposalRow[]>()
  for (const proposal of inputs.slotOptionProposals) {
    const rows = proposalsBySlot.get(proposal.slot_id)
    if (rows) {
      rows.push(proposal)
    } else {
      proposalsBySlot.set(proposal.slot_id, [proposal])
    }
  }

  const productsByRole = new Map<string, Set<string>>()
  const mappedRoleCodes = new Set<string>()
  for (const link of inputs.productRoles) {
    mappedRoleCodes.add(link.role_code)
    const set = productsByRole.get(link.role_code)
    if (set) {
      set.add(link.product_id)
    } else {
      productsByRole.set(link.role_code, new Set([link.product_id]))
    }
  }

  const productById = new Map(
    inputs.catalogProducts.map((product) => [product.product_id, product]),
  )
  const productsWithSource = new Set(inputs.productSources.map((row) => row.product_id))
  const productsWithGudidConfirmation = new Set(
    inputs.gudidConfirmations.map((row) => row.product_id),
  )
  const demoStandInRoles = new Set(inputs.demoStandIns.map((row) => row.role_code))
  const locationModifierGroups = new Set(
    inputs.modifierDefinitions
      .filter((definition) => definition.groupCode === 'location')
      .map((definition) => definition.code),
  )
  const compositionsByProcedure = new Map(
    inputs.procedureCompositions.map((composition) => [composition.procedureCode, composition]),
  )
  const proceduresByCode = new Map(
    inputs.procedures.map((procedure) => [procedure.procedure_code, procedure]),
  )

  const procedures = [...EXEMPLAR_PROCEDURE_CODES].sort().map((procedureCode) => {
    const procedure = proceduresByCode.get(procedureCode)
    if (!procedure) {
      throw new Error(`Exemplar procedure ${procedureCode} is missing from procedures.json`)
    }

    const slots = inputs.procedureSlots
      .filter((slot) => slot.procedure_code === procedureCode)
      .sort((a, b) => a.slot_id.localeCompare(b.slot_id))
    const slotIds = new Set(slots.map((slot) => slot.slot_id))
    const roleCodes = uniqueSorted(slots.map((slot) => slot.role_code))
    const roleSet = new Set(roleCodes)

    const roleMappedProducts = new Set<string>()
    for (const roleCode of roleCodes) {
      for (const productId of productsByRole.get(roleCode) ?? []) {
        roleMappedProducts.add(productId)
      }
    }

    // Requirement counts.
    const requiredness = sortedCount(slots.map((slot) => slot.requiredness))
    const requirednessBreakdown = {
      required: requiredness['required'] ?? 0,
      contingency: requiredness['conditional'] ?? 0,
      optional: requiredness['optional'] ?? 0,
    }

    // Slot-level coverage rollup (mutually exclusive; sums to total slots).
    let slotsWithSelectable = 0
    let slotsWithOnlyNonSelectable = 0
    let slotsWithOnlyProposals = 0
    let slotsWithNothing = 0
    for (const slot of slots) {
      const options = optionsBySlot.get(slot.slot_id) ?? []
      const proposals = proposalsBySlot.get(slot.slot_id) ?? []
      if (options.some((option) => option.selectable)) {
        slotsWithSelectable += 1
      } else if (options.length > 0) {
        slotsWithOnlyNonSelectable += 1
      } else if (proposals.length > 0) {
        slotsWithOnlyProposals += 1
      } else {
        slotsWithNothing += 1
      }
    }

    // Role-level coverage ladder (mutually exclusive per role; sums to distinct roles).
    const roleRows = roleCodes.map((roleCode) => {
      const roleSlots = slots.filter((slot) => slot.role_code === roleCode)
      const options = roleSlots.flatMap((slot) => optionsBySlot.get(slot.slot_id) ?? [])
      const proposals = roleSlots.flatMap((slot) => proposalsBySlot.get(slot.slot_id) ?? [])
      let coverage: RoleCoverageState
      if (options.some((option) => option.selectable)) {
        coverage = 'selectable_authored'
      } else if (options.length > 0) {
        coverage = 'non_selectable_authored_only'
      } else if (proposals.length > 0) {
        coverage = 'proposals_only'
      } else if (mappedRoleCodes.has(roleCode)) {
        coverage = 'no_option_no_proposal_role_mapped'
      } else {
        coverage = 'no_option_no_proposal_unmapped'
      }
      return {
        roleCode,
        slotCount: roleSlots.length,
        coverage,
        demoStandIn: demoStandInRoles.has(roleCode),
      }
    })
    const ladderCount = (state: RoleCoverageState) =>
      roleRows.filter((row) => row.coverage === state).length

    // Room/capability dependencies.
    const dependencyRules = slots
      .filter((slot) => !isBlank(slot.dependency_rule))
      .map((slot) => ({
        slotId: slot.slot_id,
        roleCode: slot.role_code,
        dependencyRule: String(slot.dependency_rule),
      }))
      .sort((a, b) => a.slotId.localeCompare(b.slotId))

    const composition = compositionsByProcedure.get(procedureCode)
    const allowedModifierCodes = [...(composition?.allowedModifierCodes ?? [])].sort()
    const allowedModifiers = allowedModifierCodes.map((code) => ({
      code,
      environmentOrLocation: code.startsWith('ENV_') || locationModifierGroups.has(code),
    }))
    const rescueModulesReachable = uniqueSorted(
      allowedModifierCodes.flatMap((code) => [...(RESCUE_MODULES_BY_MODIFIER[code] ?? [])]),
    )
    const rescueSectionSlots = slots
      .filter((slot) => slot.section === 'Rescue')
      .map((slot) => slot.slot_id)

    // Compatibility rules touching this procedure.
    const touchesResolved = (rule: CompatibilityRuleRow) => {
      const ids = [rule.resolved_source_id, rule.resolved_target_id]
      return ids.some((id) => id !== null && (roleSet.has(id) || roleMappedProducts.has(id)))
    }
    const touchesUnresolvedTextually = (rule: CompatibilityRuleRow) =>
      rule.resolved_source_id === null &&
      rule.resolved_target_id === null &&
      roleCodes.some(
        (roleCode) =>
          (rule.source_product_or_role ?? '').includes(roleCode) ||
          (rule.target_product_or_role ?? '').includes(roleCode),
      )
    const resolvedMatches = inputs.compatibilityRules.filter(touchesResolved)
    const unresolvedMatches = inputs.compatibilityRules.filter(touchesUnresolvedTextually)
    const candidateGradeRuleIds = uniqueSorted(
      [...resolvedMatches, ...unresolvedMatches]
        .filter((rule) => rule.verification_grade === 'candidate')
        .map((rule) => rule.rule_id),
    )

    // Local availability (formulary staging).
    const formularyMatches = inputs.formularyRows.filter((row) =>
      (row.role_codes ?? '')
        .split(';')
        .map((code) => code.trim())
        .some((code) => code !== '' && roleSet.has(code)),
    )
    const formularyWithLocalField = formularyMatches.filter((row) =>
      FORMULARY_LOCAL_FIELDS.some((field) => !isBlank(row[field])),
    )

    // Source verification over distinct authored-option products.
    const authoredOptionProductIds = uniqueSorted(
      slots.flatMap((slot) =>
        (optionsBySlot.get(slot.slot_id) ?? []).map((option) => option.product_id),
      ),
    )
    const authoredOptionProducts = authoredOptionProductIds.map((productId) => {
      const product = productById.get(productId)
      if (!product) {
        throw new Error(`Authored option references unknown product ${productId}`)
      }
      return product
    })
    const dimensionGapProductIds = authoredOptionProducts
      .filter((product) => DIMENSION_FIELDS.every((field) => isBlank(product[field])))
      .map((product) => product.product_id)
      .sort()

    // Needs review before public exposure.
    const procedureProposals = inputs.slotOptionProposals.filter(
      (proposal) => proposal.procedure_code === procedureCode,
    )
    const draftFamilyVersionIds = inputs.productFamilyVersions
      .filter(
        (version) =>
          version.governanceState === 'draft' &&
          version.memberProductIds.some((productId) => roleMappedProducts.has(productId)),
      )
      .map((version) => version.productFamilyVersionId)
      .sort()

    return {
      code: procedure.procedure_code,
      name: procedure.procedure_name,
      status: procedure.status,
      templateVersion: procedure.template_version,
      slots: {
        total: slots.length,
        requiredness: requirednessBreakdown,
        withAllowCustom: slots.filter((slot) => slot.allow_custom).length,
        rescueSectionSlotCount: rescueSectionSlots.length,
        rescueSectionSlotIds: rescueSectionSlots.sort(),
        rescueModulesReachable,
      },
      roleCoverage: {
        distinctRoles: roleCodes.length,
        ladder: {
          rolesWithSelectableAuthoredOption: ladderCount('selectable_authored'),
          rolesWithOnlyNonSelectableAuthoredOptions: ladderCount('non_selectable_authored_only'),
          rolesWithOnlyProposals: ladderCount('proposals_only'),
          rolesWithNoOptionNoProposal: {
            total:
              ladderCount('no_option_no_proposal_role_mapped') +
              ladderCount('no_option_no_proposal_unmapped'),
            withProductRoleMappingElsewhere: ladderCount('no_option_no_proposal_role_mapped'),
            withNoMappedProduct: ladderCount('no_option_no_proposal_unmapped'),
          },
        },
        rolesCoveredByDemoStandIns: roleRows.filter((row) => row.demoStandIn).length,
        slotRollup: {
          slotsWithSelectableAuthoredOption: slotsWithSelectable,
          slotsWithOnlyNonSelectableAuthoredOptions: slotsWithOnlyNonSelectable,
          slotsWithOnlyProposals,
          slotsWithNoOptionNoProposal: slotsWithNothing,
        },
        roles: roleRows,
      },
      dependencies: {
        slotsWithDependencyRule: dependencyRules.length,
        rules: dependencyRules,
        allowedModifiers,
        environmentOrLocationModifierCodes: allowedModifiers
          .filter((modifier) => modifier.environmentOrLocation)
          .map((modifier) => modifier.code),
      },
      compatibility: {
        resolvedRulesTouchingProcedure: {
          total: resolvedMatches.length,
          byVerificationGrade: sortedCount(resolvedMatches.map((rule) => rule.verification_grade)),
          ruleIds: uniqueSorted(resolvedMatches.map((rule) => rule.rule_id)),
        },
        unresolvedTextualRoleMatches: {
          total: unresolvedMatches.length,
          byVerificationGrade: sortedCount(
            unresolvedMatches.map((rule) => rule.verification_grade),
          ),
          ruleIds: uniqueSorted(unresolvedMatches.map((rule) => rule.rule_id)),
        },
      },
      equipmentSets: {
        serverSideCount: 0,
        note: 'equipment sets are browser-localStorage only; no server-side entity exists',
      },
      localAvailability: {
        formularyRowsIntersectingRoles: formularyMatches.length,
        hospitalCarries: formularyMatches.filter((row) => row.hospital_carries === true).length,
        preferred: formularyMatches.filter((row) => row.preferred === true).length,
        withAnyLocalFieldPopulated: formularyWithLocalField.length,
      },
      sourceVerification: {
        distinctAuthoredOptionProducts: authoredOptionProductIds.length,
        byVerificationGrade: sortedCount(
          authoredOptionProducts.map((product) => product.verification_grade),
        ),
        byVisibilityState: sortedCount(
          authoredOptionProducts.map((product) => product.visibility_state),
        ),
        withProductSourceRow: authoredOptionProductIds.filter((productId) =>
          productsWithSource.has(productId),
        ).length,
        withGudidConfirmation: authoredOptionProductIds.filter((productId) =>
          productsWithGudidConfirmation.has(productId),
        ).length,
      },
      dimensionGaps: {
        count: dimensionGapProductIds.length,
        productIds: dimensionGapProductIds,
      },
      needsReviewBeforePublic: {
        proposalCount: procedureProposals.length,
        candidateGradeCompatibilityRules: {
          count: candidateGradeRuleIds.length,
          ruleIds: candidateGradeRuleIds,
        },
        draftFamilyVersionsWithMemberProductInRoles: {
          count: draftFamilyVersionIds.length,
          productFamilyVersionIds: draftFamilyVersionIds,
        },
        procedureStatus: procedure.status,
      },
    }
  })

  return {
    formatVersion: 'ip-device-intel-audit/1',
    provenance: {
      workbookSha256: inputs.workbookSha256,
      catalogReleaseId: inputs.catalogReleaseId,
      generatedDataDirectory: GENERATED_DIRECTORY,
      seedDataDirectory: SEED_DIRECTORY,
    },
    semantics: {
      determinism:
        'No timestamps; provenance is content-addressed (workbook sha256 + catalog release id); every array stable-sorted; split-object keys sorted alphabetically.',
      'slots.requiredness':
        "Count of procedure-slots rows by requiredness; 'conditional' is reported as 'contingency'.",
      'slots.withAllowCustom': 'Slots with allow_custom === true.',
      'slots.rescueSectionSlotCount': "Slots whose section string equals 'Rescue'.",
      'slots.rescueModulesReachable':
        "Rescue modules appended by the procedure's allowed modifier codes; the only such action in the resolver seed (src/features/preference-cards/seed/operational.ts) is HIGH_BLEED_RISK -> MAJOR_AIRWAY_BLEEDING. Release bundles pin one shared rescue-module set (definition-set-rescue-modules) for all procedures.",
      'roleCoverage.ladder':
        'Per distinct role over the procedure slots, first matching state wins: >=1 authored slot-product-options row with selectable true; else >=1 authored row (all non-selectable); else >=1 proposal row for the role slots; else no option and no proposal (split by whether any product-roles row maps a product to the role anywhere in the catalog).',
      'roleCoverage.rolesCoveredByDemoStandIns':
        'Roles whose role_code appears in seed/demo-stand-ins.json (a cross-cutting overlay count, independent of the ladder state).',
      'roleCoverage.slotRollup': 'The same ladder applied per slot instead of per role.',
      'dependencies.slotsWithDependencyRule':
        'Slots whose dependency_rule is non-null and non-empty after trimming.',
      'dependencies.allowedModifiers':
        "allowedModifierCodes from generated/procedure-compositions.json; environmentOrLocation is true when the code starts with 'ENV_' or the generated modifier-definitions.json entry has groupCode 'location'.",
      'compatibility.resolvedRulesTouchingProcedure':
        "compatibility-raw.json rules where resolved_source_id or resolved_target_id is in the procedure's role-code set or in the set of product_ids mapped to those roles via product-roles.json.",
      'compatibility.unresolvedTextualRoleMatches':
        'Rules with both resolved ids null where any procedure role_code appears as a case-sensitive substring of source_product_or_role or target_product_or_role.',
      equipmentSets:
        'Constant 0 server-side; equipment sets exist only in browser localStorage (ip-preference-cards:equipment-sets:v1).',
      localAvailability:
        "hospital-formulary-staging.json rows whose semicolon-delimited role_codes intersect the procedure's roles; local fields checked: " +
        FORMULARY_LOCAL_FIELDS.join(', ') +
        '.',
      sourceVerification:
        'Computed over the distinct product_ids appearing in the procedure authored slot-product-options rows (selectable or not); GUDID confirmation = product_id present in gudid-confirmations.json confirmations.',
      dimensionGaps:
        'Distinct authored-option products where ALL of ' +
        DIMENSION_FIELDS.join(', ') +
        ' are null or empty strings.',
      needsReviewBeforePublic:
        'Proposal rows for the procedure_code; candidate-grade rules from the union of resolved and unresolved-textual compatibility matches; draft-governance product-family versions with >=1 member product mapped (via product-roles.json) to the procedure roles; plus the procedure draft status itself.',
      global: 'Whole-catalog counts; they must equal the published ip-cards:validate-data numbers.',
      noEquivalenceClaims:
        'This audit reports data readiness only; it never claims products are clinically equivalent or substitutable.',
    },
    global: {
      products: inputs.catalogProducts.length,
      roles: inputs.roles.length,
      procedures: inputs.procedures.length,
      procedureSlots: inputs.procedureSlots.length,
      authoredSlotOptions: inputs.slotProductOptions.length,
      slotOptionProposals: inputs.slotOptionProposals.length,
      proposalStatusSplit: sortedCount(
        inputs.slotOptionProposals.map((proposal) => proposal.proposal_status),
      ),
      productRoleLinks: inputs.productRoles.length,
      selectableAndVisibleSlotOptions: inputs.slotProductOptions.filter(
        (option) => option.selectable === true && option.visible_by_default === true,
      ).length,
      productVerificationGradeSplit: sortedCount(
        inputs.catalogProducts.map((product) => product.verification_grade),
      ),
      productVisibilityStateSplit: sortedCount(
        inputs.catalogProducts.map((product) => product.visibility_state),
      ),
    },
    procedures,
  }
}

export type DataReadinessReport = ReturnType<typeof computeDataReadiness>

export async function serializeReport(report: DataReadinessReport): Promise<string> {
  // Options mirror the repository .prettierrc values that affect JSON output (printWidth 100,
  // tabWidth 2, endOfLine lf); the remaining .prettierrc options do not apply to the json parser.
  return format(JSON.stringify(report, null, 2), {
    parser: 'json',
    printWidth: 100,
    tabWidth: 2,
    bracketSpacing: true,
    endOfLine: 'lf',
    plugins: [prettierPluginBabel, prettierPluginEstree],
  })
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T
}

export async function loadInputs(repositoryRoot = process.cwd()): Promise<DataReadinessInputs> {
  const generated = (name: string) => path.join(repositoryRoot, GENERATED_DIRECTORY, name)
  const seed = (name: string) => path.join(repositoryRoot, SEED_DIRECTORY, name)

  const [
    procedures,
    procedureSlots,
    slotProductOptions,
    proposalArtifact,
    productRoles,
    catalogProducts,
    compatibilityRules,
    formularyRows,
    productSources,
    gudidArtifact,
    procedureCompositions,
    familyArtifact,
    modifierDefinitions,
    demoStandIns,
    roles,
    importReport,
    catalogRelease,
  ] = await Promise.all([
    readJson<ProcedureRow[]>(generated('procedures.json')),
    readJson<SlotRow[]>(generated('procedure-slots.json')),
    readJson<OptionRow[]>(generated('slot-product-options.json')),
    readJson<{ proposals: ProposalRow[] }>(generated('slot-product-option-proposals.json')),
    readJson<ProductRoleRow[]>(generated('product-roles.json')),
    readJson<CatalogProductRow[]>(generated('catalog-products.json')),
    readJson<CompatibilityRuleRow[]>(generated('compatibility-raw.json')),
    readJson<FormularyRow[]>(generated('hospital-formulary-staging.json')),
    readJson<ProductSourceRow[]>(generated('product-sources.json')),
    readJson<{ confirmations: GudidConfirmationRow[] }>(generated('gudid-confirmations.json')),
    readJson<CompositionRow[]>(generated('procedure-compositions.json')),
    readJson<{ versions: FamilyVersionRow[] }>(generated('product-family-versions.json')),
    readJson<ModifierDefinitionRow[]>(generated('modifier-definitions.json')),
    readJson<DemoStandInRow[]>(seed('demo-stand-ins.json')),
    readJson<RoleRow[]>(generated('roles.json')),
    readJson<{ workbook_sha256: string }>(generated('import-report.json')),
    readJson<{ catalogReleaseId: string }>(generated('catalog-release.json')),
  ])

  if (!importReport.workbook_sha256 || typeof importReport.workbook_sha256 !== 'string') {
    throw new Error('import-report.json is missing workbook_sha256')
  }
  if (!catalogRelease.catalogReleaseId || typeof catalogRelease.catalogReleaseId !== 'string') {
    throw new Error('catalog-release.json is missing catalogReleaseId')
  }

  return {
    procedures,
    procedureSlots,
    slotProductOptions,
    slotOptionProposals: proposalArtifact.proposals,
    productRoles,
    catalogProducts,
    compatibilityRules,
    formularyRows,
    productSources,
    gudidConfirmations: gudidArtifact.confirmations,
    procedureCompositions,
    productFamilyVersions: familyArtifact.versions,
    modifierDefinitions,
    demoStandIns,
    roles,
    workbookSha256: importReport.workbook_sha256,
    catalogReleaseId: catalogRelease.catalogReleaseId,
  }
}

export async function main(repositoryRoot = process.cwd()): Promise<DataReadinessReport> {
  const inputs = await loadInputs(repositoryRoot)
  const report = computeDataReadiness(inputs)
  const serialized = await serializeReport(report)
  const outputPath = path.join(repositoryRoot, OUTPUT_PATH)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, serialized, 'utf8')
  return report
}

if (process.argv[1] && /audit-data-readiness\.(?:ts|js)$/.test(process.argv[1])) {
  main()
    .then((report) => {
      console.log(`Wrote ${OUTPUT_PATH}`)
      for (const procedure of report.procedures) {
        console.log(
          `${procedure.code}: ${procedure.slots.total} slots, ` +
            `${procedure.roleCoverage.distinctRoles} roles, ` +
            `${procedure.needsReviewBeforePublic.proposalCount} proposals`,
        )
      }
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    })
}
