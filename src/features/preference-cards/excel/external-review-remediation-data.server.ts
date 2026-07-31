import { createHash } from 'node:crypto'

import catalogProductsJson from '../../../../data/ip-preference-cards/generated/catalog-products.json'
import gudidConfirmationsJson from '../../../../data/ip-preference-cards/generated/gudid-confirmations.json'
import procedureSlotsJson from '../../../../data/ip-preference-cards/generated/procedure-slots.json'
import slotProductOptionProposalsJson from '../../../../data/ip-preference-cards/generated/slot-product-option-proposals.json'
import slotProductOptionsJson from '../../../../data/ip-preference-cards/generated/slot-product-options.json'
import externalReviewCompletedImplementationJson from '../../../../data/ip-preference-cards/reviewed/external-review-completed-implementation.json'
import externalReviewCorrectionsJson from '../../../../data/ip-preference-cards/reviewed/external-review-corrections.json'

import {
  DRESSING_SECUREMENT_SLOT_IDS,
  EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS,
  FOCUSED_DRAINAGE_UNIT_PRODUCT_IDS,
  FOCUSED_DRAINAGE_UNIT_SLOT_IDS,
  OLYMPUS_180_PRODUCT_IDS,
  VIZISHOT_PRODUCT_ID,
  VIZISHOT_SLOT_IDS,
  type ExternalReviewRemediationProductRow,
  type ExternalReviewRemediationSlotRow,
} from '@/features/preference-cards/excel/external-review-remediation-contract'

interface CatalogProductRecord {
  product_id: string
  manufacturer: string | null
  product_name: string
  catalog_number: string | null
  verification_status: string | null
  visibility_state: string | null
  verification_grade: string | null
  primary_source_id: string | null
  primary_source_location: string | null
  catalog_lifecycle_context?: string | null
  lifecycle_context?: string | null
  slotting_scope?: string | null
}

interface ProcedureSlotRecord {
  slot_id: string
  procedure_code: string
  role_code: string
  slot_label: string
  requiredness: string
  allow_custom: boolean
}

interface SlotProductOptionRecord {
  slot_id: string
  product_id: string
  role_code: string
  eligibility_status: string
  visible_by_default: boolean
  reason: string
  product_visibility: string
  selectable: boolean
  review_status?: string
  slotting_scope?: string
}

interface GudidConfirmationRecord {
  product_id: string
  gudid_distribution_status: string
}

interface SlotProductOptionProposalRecord {
  slot_id: string
  procedure_code: string
  slot_label: string
  requiredness: string
  role_code: string
  product_id: string
  proposal_origin: string
  proposal_status: string
  selectable: boolean
  visible_by_default: boolean
  reason: string
}

interface SlotProductOptionProposalArtifact {
  proposals: SlotProductOptionProposalRecord[]
}

interface RoleSplitGroup {
  setRoleCode: string
  productIds: string[]
}

interface ProductRoleSplit {
  expectRoleCode: string
  groups: RoleSplitGroup[]
}

interface ProductRoleReclassification {
  productId: string
  expectRoleCode: string
  setRoleCode: string
}

interface SlotRoleTransition {
  slotId: string
  expectRoleCode: string
  setRoleCode: string
}

interface ProductGovernance {
  productId: string
  catalogLifecycleContext: string
  slottingScope: string
  preferredNewPurchase: boolean
  installedBaseExactSlotIds: string[]
  lifecycleNote: string
}

interface SlotOptionUpsert {
  expectAbsent: boolean
  value: SlotProductOptionRecord
}

interface ExternalReviewCorrections {
  reviewId: string
  productRoleSplits: ProductRoleSplit[]
  productRoleReclassifications: ProductRoleReclassification[]
  slotRoleTransitions: SlotRoleTransition[]
  slotOptionUpserts: SlotOptionUpsert[]
  productGovernance: ProductGovernance[]
}

interface ExternalReviewCompletedImplementation {
  slotOptionUpserts: {
    reviewKey: string
    expectAbsent: boolean
    value: SlotProductOptionRecord
  }[]
}

interface GudidConfirmationReport {
  confirmations: GudidConfirmationRecord[]
}

export interface ExternalReviewRemediationReviewData {
  reviewId: string
  normalizedCorrectionsSha256: string
  productRows: ExternalReviewRemediationProductRow[]
  slotRows: ExternalReviewRemediationSlotRow[]
}

const products = catalogProductsJson as CatalogProductRecord[]
const procedureSlots = procedureSlotsJson as ProcedureSlotRecord[]
const slotProductOptions = slotProductOptionsJson as SlotProductOptionRecord[]
const slotProductOptionProposals = (
  slotProductOptionProposalsJson as SlotProductOptionProposalArtifact
).proposals
const gudidConfirmations = (gudidConfirmationsJson as GudidConfirmationReport).confirmations
const corrections = externalReviewCorrectionsJson as ExternalReviewCorrections
const completedImplementation =
  externalReviewCompletedImplementationJson as ExternalReviewCompletedImplementation

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`External-review remediation export invariant failed: ${message}`)
}

function verifyCount(values: readonly unknown[], expected: number, message: string) {
  if (values.length !== expected) {
    throw new Error(`External-review remediation export invariant failed: ${message}`)
  }
}

function normalizedBaseUrl(rawBaseUrl: string): string {
  const parsed = new URL(rawBaseUrl)
  invariant(
    ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password,
    'application base URL must be an HTTP(S) origin without credentials',
  )
  return parsed.origin
}

function safeLocale(locale: string): string {
  return /^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale) ? locale : 'en'
}

function normalizedContentHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function mapBy<T>(values: T[], key: (value: T) => string): Map<string, T> {
  return new Map(values.map((value) => [key(value), value]))
}

function distributionEvidence(productId: string): string {
  const statuses = new Set(
    gudidConfirmations
      .filter((confirmation) => confirmation.product_id === productId)
      .map((confirmation) => {
        if (/^In Commercial Distribution$/i.test(confirmation.gudid_distribution_status)) {
          return 'in_distribution'
        }
        if (/^Not in Commercial Distribution$/i.test(confirmation.gudid_distribution_status)) {
          return 'not_in_distribution'
        }
        return 'unknown'
      }),
  )
  statuses.delete('unknown')
  if (statuses.size > 1) return 'conflicting'
  return statuses.values().next().value ?? 'unknown'
}

function proposedOptionState(option: SlotProductOptionRecord): string {
  return [
    `eligibility=${option.eligibility_status}`,
    `visible_by_default=${option.visible_by_default ? 'Yes' : 'No'}`,
    `selectable=${option.selectable ? 'Yes' : 'No'}`,
    `product_visibility=${option.product_visibility}`,
    option.review_status ? `review_status=${option.review_status}` : '',
    option.slotting_scope ? `slotting_scope=${option.slotting_scope}` : '',
  ]
    .filter(Boolean)
    .join('; ')
}

function recommendedSlottingScope(roleCode: string): string {
  if (
    ['ROBOTIC_BRONCH_PLATFORM', 'NAV_PLATFORM_ACCESSORY', 'NAV_BRONCHOSCOPE_ADAPTER'].includes(
      roleCode,
    )
  ) {
    return 'catalog_only'
  }
  return 'standard'
}

function productEvidenceUrl(baseUrl: string, locale: string, productId: string): string {
  return `${baseUrl}/${locale}/admin/preference-cards/catalog-qa/${encodeURIComponent(productId)}`
}

function slotEvidenceUrl(baseUrl: string, locale: string, slotId: string): string {
  return `${baseUrl}/${locale}/admin/preference-cards/catalog-qa/slot-options?q=${encodeURIComponent(
    slotId,
  )}`
}

function productCurrentState(
  product: CatalogProductRecord,
  currentRoles: string,
  distribution: string,
): string {
  return [
    `role=${currentRoles}`,
    `distribution=${distribution}`,
    `visibility=${product.visibility_state ?? 'unknown'}`,
    `verification_grade=${product.verification_grade ?? 'unknown'}`,
    product.verification_status ? `verification=${product.verification_status}` : '',
  ]
    .filter(Boolean)
    .join('; ')
}

export function getExternalReviewRemediationReviewData(
  applicationBaseUrl: string,
  locale: string,
): ExternalReviewRemediationReviewData {
  const baseUrl = normalizedBaseUrl(applicationBaseUrl)
  const activeLocale = safeLocale(locale)
  const productById = mapBy(products, (product) => product.product_id)
  const slotById = mapBy(procedureSlots, (slot) => slot.slot_id)
  const optionByKey = mapBy(
    slotProductOptions,
    (option) => `${option.slot_id}:${option.product_id}`,
  )
  const proposedOptionByKey = mapBy(
    corrections.slotOptionUpserts.map((entry) => entry.value),
    (option) => `${option.slot_id}:${option.product_id}`,
  )
  const governanceByProduct = mapBy(corrections.productGovernance, (entry) => entry.productId)
  const proposalByKey = mapBy(
    slotProductOptionProposals,
    (proposal) => `${proposal.slot_id}:${proposal.product_id}`,
  )
  const completedReviewedDrainageOptions = completedImplementation.slotOptionUpserts.filter(
    (entry) =>
      entry.value.role_code === 'GENERIC_DRAINAGE_UNIT' &&
      FOCUSED_DRAINAGE_UNIT_SLOT_IDS.includes(
        entry.value.slot_id as (typeof FOCUSED_DRAINAGE_UNIT_SLOT_IDS)[number],
      ) &&
      FOCUSED_DRAINAGE_UNIT_PRODUCT_IDS.includes(
        entry.value.product_id as (typeof FOCUSED_DRAINAGE_UNIT_PRODUCT_IDS)[number],
      ),
  )
  for (const entry of completedReviewedDrainageOptions) {
    const value = entry.value
    const key = `${value.slot_id}:${value.product_id}`
    if (proposalByKey.has(key)) continue
    const slot = slotById.get(value.slot_id)
    invariant(slot, `completed drainage review references missing slot ${value.slot_id}`)
    invariant(
      productById.has(value.product_id),
      `completed drainage review references missing product ${value.product_id}`,
    )
    proposalByKey.set(key, {
      slot_id: value.slot_id,
      procedure_code: slot.procedure_code,
      slot_label: slot.slot_label,
      requiredness: slot.requiredness,
      role_code: value.role_code,
      product_id: value.product_id,
      proposal_origin: 'product_role_join',
      proposal_status: 'unreviewed',
      selectable: false,
      visible_by_default: false,
      reason: `Product_Roles maps this product to GENERIC_DRAINAGE_UNIT, but no authored Slot_Product_Options row exists for "${slot.slot_label}". Review exact-slot eligibility; this proposal does not assert compatibility, local approval, or clinical suitability.`,
    })
  }

  const productRows: ExternalReviewRemediationProductRow[] = []
  const addProductRow = (
    productId: string,
    reviewCohort: string,
    expectedRoleCode: string,
    proposedRoleCode: string,
    proposedState: string,
    reason: string,
    lifecycleContext: string,
    slottingScope: string,
    roleDecision: string,
    exactSlotDecision: string,
  ) => {
    const product = productById.get(productId)
    invariant(product, `catalog product ${productId} is missing`)
    // Generated JSON already contains the governed overlay. The review workbook must show the
    // overlay's exact pre-remediation role guard, not the post-remediation mapping read back from
    // the generated catalog.
    const currentRoleCodes = expectedRoleCode
    const distribution = distributionEvidence(productId)
    productRows.push({
      reviewKey: `PRODUCT:${productId}`,
      reviewCohort,
      productId,
      manufacturer: product.manufacturer ?? '',
      productName: product.product_name,
      catalogNumber: product.catalog_number ?? '',
      currentRoleCode: currentRoleCodes,
      proposedRoleCode,
      currentState: productCurrentState(product, currentRoleCodes, distribution),
      proposedState,
      reason,
      lifecycleContext:
        product.catalog_lifecycle_context ?? product.lifecycle_context ?? lifecycleContext,
      slottingScope: product.slotting_scope ?? slottingScope,
      roleDecision,
      exactSlotDecision,
      distributionEvidence: distribution,
      visibilityState: product.visibility_state ?? '',
      verificationGrade: product.verification_grade ?? '',
      sourceId: product.primary_source_id ?? '',
      sourceLocation: product.primary_source_location ?? '',
      evidencePageUrl: productEvidenceUrl(baseUrl, activeLocale, productId),
      reviewerDecision: '',
      rationale: '',
    })
  }

  // `productGovernance` holds two kinds of reviewed record. The installed-base cohort is the
  // one this export is about, and it is identified the same way the applicator identifies it:
  // an installed-base entry names the exact slots it unlocks, and a regulatory record names
  // none. Counting the whole table here would break the moment a regulatory record is added.
  invariant(
    corrections.productGovernance.filter((entry) => entry.installedBaseExactSlotIds.length > 0)
      .length === EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.olympus180Products,
    'the governed Olympus 180 cohort must contain exactly six products',
  )
  for (const productId of OLYMPUS_180_PRODUCT_IDS) {
    const governance = governanceByProduct.get(productId)
    invariant(governance, `Olympus 180 governance row for ${productId} is missing`)
    const currentRole = corrections.slotOptionUpserts.find(
      (entry) => entry.value.product_id === productId,
    )?.value.role_code
    invariant(currentRole, `Olympus 180 product ${productId} has no role mapping`)
    addProductRow(
      productId,
      'Olympus 180 installed-base lifecycle',
      currentRole,
      currentRole,
      `Retain as ${governance.catalogLifecycleContext}; searchable under the existing role; not a preferred new purchase.`,
      governance.lifecycleNote,
      governance.catalogLifecycleContext,
      governance.slottingScope,
      `Retain the clinically appropriate scope role (${currentRole}).`,
      'Review the bounded installed-base alternatives on the Exact Slot Review sheet.',
    )
  }

  const tbnaSplit = corrections.productRoleSplits.find(
    (split) => split.expectRoleCode === 'TBNA_NEEDLE',
  )
  invariant(tbnaSplit, 'TBNA_NEEDLE split is missing from the governed corrections artifact')
  const tbnaProducts = tbnaSplit.groups.flatMap((group) => group.productIds)
  invariant(
    tbnaProducts.length === EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.originalTbnaProducts &&
      new Set(tbnaProducts).size ===
        EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.originalTbnaProducts,
    'the original TBNA cohort must contain 21 unique products',
  )
  for (const group of tbnaSplit.groups) {
    for (const productId of group.productIds) {
      addProductRow(
        productId,
        'Original TBNA_NEEDLE cohort',
        tbnaSplit.expectRoleCode,
        group.setRoleCode,
        `Classify under ${group.setRoleCode}; remove the deprecated broad ${tbnaSplit.expectRoleCode} assignment.`,
        'Separate conventional, navigation/EWC, and robotic-platform needles so semantic regeneration cannot repopulate incompatible exact slots.',
        'unknown',
        recommendedSlottingScope(group.setRoleCode),
        `Replace ${tbnaSplit.expectRoleCode} with ${group.setRoleCode}.`,
        'Do not grant canonical exact-slot status solely from role equality.',
      )
    }
  }

  const guidingSplit = corrections.productRoleSplits.find(
    (split) => split.expectRoleCode === 'GUIDING_DEVICE',
  )
  invariant(guidingSplit, 'GUIDING_DEVICE split is missing from the governed corrections artifact')
  const guidingProducts = guidingSplit.groups.flatMap((group) => group.productIds)
  invariant(
    guidingProducts.length ===
      EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.originalGuidingDeviceProducts &&
      new Set(guidingProducts).size ===
        EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.originalGuidingDeviceProducts,
    'the original GUIDING_DEVICE cohort must contain 34 unique products',
  )
  for (const group of guidingSplit.groups) {
    for (const productId of group.productIds) {
      addProductRow(
        productId,
        'Original GUIDING_DEVICE cohort',
        guidingSplit.expectRoleCode,
        group.setRoleCode,
        `Classify under ${group.setRoleCode}; remove the deprecated broad ${guidingSplit.expectRoleCode} assignment.`,
        'Separate platforms, bronchoscopes, catheters, sensors, kits, adapters, and accessories so capital equipment cannot satisfy a disposable per-case slot.',
        'unknown',
        recommendedSlottingScope(group.setRoleCode),
        `Replace ${guidingSplit.expectRoleCode} with ${group.setRoleCode}.`,
        'Do not grant canonical exact-slot status solely from role equality.',
      )
    }
  }

  const targetedCorrections = [
    {
      productId: 'PRD-FDAC925AF1',
      reviewCohort: 'Targeted role correction — Scivita Bracket',
      reason:
        'A platform bracket is a mount/accessory, not a generic airway adapter or disposable guiding catheter.',
      slottingScope: 'catalog_only',
      exactSlotDecision:
        'Remove legacy generic-airway-adapter exact-slot options; require platform-specific review.',
    },
    {
      productId: 'PRD-58DE7D49C4',
      reviewCohort: 'Targeted role correction — Hot Biopsy Forceps',
      reason:
        'Energy-enabled forceps are not interchangeable with ordinary cold biopsy forceps and require reviewable electrosurgical-platform compatibility.',
      slottingScope: 'standard',
      exactSlotDecision:
        'Remove ordinary biopsy-forceps exact-slot options; require compatible energy-platform evidence.',
    },
  ] as const
  for (const target of targetedCorrections) {
    const correction = corrections.productRoleReclassifications.find(
      (entry) => entry.productId === target.productId,
    )
    invariant(correction, `targeted role correction for ${target.productId} is missing`)
    addProductRow(
      target.productId,
      target.reviewCohort,
      correction.expectRoleCode,
      correction.setRoleCode,
      `Classify under ${correction.setRoleCode}; remove ${correction.expectRoleCode}.`,
      target.reason,
      'unknown',
      target.slottingScope,
      `Replace ${correction.expectRoleCode} with ${correction.setRoleCode}.`,
      target.exactSlotDecision,
    )
  }

  invariant(
    productRows.length === EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.productReviewRows &&
      new Set(productRows.map((row) => row.productId)).size ===
        EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.productReviewRows,
    'focused product review must contain 63 unique products',
  )

  const slotRows: ExternalReviewRemediationSlotRow[] = []
  const addSlotRow = (
    reviewCohort: string,
    slotId: string,
    productId: string,
    currentRoleCode: string,
    proposedRoleCode: string,
    currentState: string,
    proposedState: string,
    reason: string,
    lifecycleContext: string,
    slottingScope: string,
    roleDecision: string,
    exactSlotDecision: string,
  ) => {
    const slot = slotById.get(slotId)
    invariant(slot, `procedure slot ${slotId} is missing`)
    const product = productId ? productById.get(productId) : undefined
    invariant(!productId || product, `catalog product ${productId} is missing`)
    slotRows.push({
      reviewKey: `SLOT:${slotId}:${productId || 'POLICY'}`,
      reviewCohort,
      procedureCode: slot.procedure_code,
      slotId,
      slotLabel: slot.slot_label,
      requiredness: slot.requiredness,
      productId,
      manufacturer: product?.manufacturer ?? '',
      productName: product?.product_name ?? '',
      catalogNumber: product?.catalog_number ?? '',
      currentRoleCode,
      proposedRoleCode,
      currentState,
      proposedState,
      reason,
      lifecycleContext,
      slottingScope,
      roleDecision,
      exactSlotDecision,
      evidencePageUrl: productId
        ? productEvidenceUrl(baseUrl, activeLocale, productId)
        : slotEvidenceUrl(baseUrl, activeLocale, slotId),
      reviewerDecision: '',
      rationale: '',
    })
  }

  for (const productId of OLYMPUS_180_PRODUCT_IDS) {
    const governance = governanceByProduct.get(productId)
    invariant(governance, `Olympus 180 governance row for ${productId} is missing`)
    for (const slotId of governance.installedBaseExactSlotIds) {
      const key = `${slotId}:${productId}`
      const proposedOption = proposedOptionByKey.get(key)
      invariant(proposedOption, `installed-base exact-slot recommendation ${key} is missing`)
      const proposedUpsert = corrections.slotOptionUpserts.find(
        (entry) => entry.value.slot_id === slotId && entry.value.product_id === productId,
      )
      invariant(
        proposedUpsert?.expectAbsent,
        `installed-base exact-slot recommendation ${key} must declare an absent pre-remediation state`,
      )
      const slot = slotById.get(slotId)
      invariant(slot, `installed-base procedure slot ${slotId} is missing`)
      addSlotRow(
        'Olympus 180 installed-base exact-slot policy',
        slotId,
        productId,
        slot.role_code,
        proposedOption.role_code,
        'No authored exact-slot option (pre-remediation external-review state).',
        proposedOptionState(proposedOption),
        proposedOption.reason || governance.lifecycleNote,
        governance.catalogLifecycleContext,
        governance.slottingScope,
        `Retain the clinically appropriate slot role (${slot.role_code}).`,
        'Add or retain a reviewed installed-base alternative: selectable Yes, visible by default No, and not a preferred new-purchase recommendation.',
      )
    }
  }

  verifyCount(
    slotRows,
    EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.scopeSlotPolicyRows,
    'the scope-slot policy cohort must contain exactly 10 rows',
  )

  for (const slotId of DRESSING_SECUREMENT_SLOT_IDS) {
    const transition = corrections.slotRoleTransitions.find((entry) => entry.slotId === slotId)
    invariant(transition, `dressing/securement slot transition ${slotId} is missing`)
    const slot = slotById.get(slotId)
    invariant(slot, `dressing/securement slot ${slotId} is missing`)
    addSlotRow(
      'Dressing and securement slot semantics',
      slotId,
      '',
      transition.expectRoleCode,
      transition.setRoleCode,
      `role=${transition.expectRoleCode}; allow_custom=${slot.allow_custom ? 'Yes' : 'No'}; state=pre-remediation`,
      `role=${transition.setRoleCode}; allow_custom=Yes; resolution=hospital_local`,
      'Dressings, sutures, securement devices, labels, and bedside signage must not use specimen-container semantics.',
      'not_applicable',
      'hospital_local',
      `Replace ${transition.expectRoleCode} with ${transition.setRoleCode}.`,
      'Preserve hospital-local/custom resolution; do not create fictitious commercial specimen products.',
    )
  }

  for (const slotId of VIZISHOT_SLOT_IDS) {
    const key = `${slotId}:${VIZISHOT_PRODUCT_ID}`
    const option = optionByKey.get(key)
    invariant(option, `ViziShot exact-slot row ${key} is missing`)
    const product = productById.get(VIZISHOT_PRODUCT_ID)
    invariant(product, `ViziShot catalog product ${VIZISHOT_PRODUCT_ID} is missing`)
    addSlotRow(
      'ViziShot hidden/default invariant',
      slotId,
      VIZISHOT_PRODUCT_ID,
      option.role_code,
      option.role_code,
      'eligibility=Prototype candidate; visible_by_default=Yes; selectable=No; product_visibility=hidden; state=external-review-observed pre-remediation',
      'visible_by_default=No; selectable=No; product_visibility=hidden; retain in product-verification queue',
      'A hidden product cannot be a visible-by-default option. Insufficient verification evidence does not support automatic promotion to selectable.',
      'historical_reference',
      'catalog_only',
      `Retain ${option.role_code}; resolve promotion only through the separate product-verification workflow.`,
      'Set visible by default to No, keep selectable No, and do not apply the external reviewer’s proposed Yes/Yes state.',
    )
  }

  const drainageProposals = [...proposalByKey.values()].filter(
    (proposal) => proposal.role_code === 'GENERIC_DRAINAGE_UNIT',
  )
  invariant(
    drainageProposals.length ===
      EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.allDrainageUnitProposalRows,
    'the complete GENERIC_DRAINAGE_UNIT proposal cohort must contain 63 rows',
  )
  invariant(
    new Set(drainageProposals.map((proposal) => proposal.product_id)).size ===
      EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.allDrainageUnitProposalProducts,
    'the complete GENERIC_DRAINAGE_UNIT proposal cohort must contain 21 products',
  )
  invariant(
    drainageProposals.every(
      (proposal) =>
        proposal.proposal_status === 'unreviewed' &&
        !proposal.selectable &&
        !proposal.visible_by_default,
    ),
    'all GENERIC_DRAINAGE_UNIT proposals must remain unreviewed, nonselectable, and not visible by default',
  )
  for (const slotId of FOCUSED_DRAINAGE_UNIT_SLOT_IDS) {
    for (const productId of FOCUSED_DRAINAGE_UNIT_PRODUCT_IDS) {
      const proposal = proposalByKey.get(`${slotId}:${productId}`)
      invariant(
        proposal?.role_code === 'GENERIC_DRAINAGE_UNIT',
        `focused drainage-unit proposal ${slotId}:${productId} is missing`,
      )
      addSlotRow(
        'Focused GENERIC_DRAINAGE_UNIT proposal subset',
        slotId,
        productId,
        proposal.role_code,
        proposal.role_code,
        [
          `proposal_status=${proposal.proposal_status}`,
          `selectable=${proposal.selectable ? 'Yes' : 'No'}`,
          `visible_by_default=${proposal.visible_by_default ? 'Yes' : 'No'}`,
          `proposal_origin=${proposal.proposal_origin}`,
        ].join('; '),
        'proposal_status=unreviewed; selectable=No; visible_by_default=No; recommendation_only=Yes',
        proposal.reason,
        'unknown',
        'standard',
        'Retain GENERIC_DRAINAGE_UNIT pending exact-slot clinician review.',
        'Do not promote. Keep this row in the proposal queue as unreviewed and nonselectable until an explicit clinician decision is returned.',
      )
    }
  }

  invariant(
    slotRows.length === EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.exactSlotReviewRows &&
      new Set(slotRows.map((row) => row.reviewKey)).size ===
        EXTERNAL_REVIEW_REMEDIATION_EXPECTED_COUNTS.exactSlotReviewRows,
    'focused exact-slot review must contain 34 unique rows',
  )

  return {
    reviewId: corrections.reviewId,
    normalizedCorrectionsSha256: normalizedContentHash(corrections),
    productRows,
    slotRows,
  }
}
