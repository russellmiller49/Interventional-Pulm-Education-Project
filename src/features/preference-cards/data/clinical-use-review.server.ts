import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import {
  catalogVerificationSignals,
  getCatalogVerificationRows,
  type CatalogVerificationQueueRow,
} from '@/features/preference-cards/data/catalog-verification.server'
import {
  clinicalUseProductRoleKey,
  clinicalUseSlotProductKey,
  type ClinicalUseCatalogProductWorkbookRow,
  type ClinicalUseCurrentSlotWorkbookRow,
  type ClinicalUseProductRoleWorkbookRow,
} from '@/features/preference-cards/excel/clinical-use-review-contract'
import { getCatalogStore } from '@/features/preference-cards/server/catalog'
import type {
  CatalogProduct,
  CatalogStore,
  ProcedureSlotRecord,
  ProductRoleRecord,
} from '@/features/preference-cards/server/catalog-store'

const CLINICAL_USE_ARTIFACT_FILES = [
  ['catalogProductsSha256', 'catalog-products.json'],
  ['productRolesSha256', 'product-roles.json'],
  ['rolesSha256', 'roles.json'],
  ['proceduresSha256', 'procedures.json'],
  ['procedureSlotsSha256', 'procedure-slots.json'],
  ['slotProductOptionsSha256', 'slot-product-options.json'],
] as const

export interface ClinicalUseReviewArtifactManifest {
  formatVersion: 1
  catalogProductsSha256: string
  productRolesSha256: string
  rolesSha256: string
  proceduresSha256: string
  procedureSlotsSha256: string
  slotProductOptionsSha256: string
  clinicalUseManifestSha256: string
}

export interface ClinicalUseReviewCounts {
  catalogProducts: number
  productRoles: number
  currentSlots: number
}

export interface ClinicalUseRoleOption {
  roleCode: string
  roleName: string
}

export interface ClinicalUseSlotOption {
  slotId: string
  slotLabel: string
  procedureCode: string
  procedureName: string
  roleCode: string
}

export interface ClinicalUseReviewData {
  catalogProducts: ClinicalUseCatalogProductWorkbookRow[]
  productRoles: ClinicalUseProductRoleWorkbookRow[]
  currentSlots: ClinicalUseCurrentSlotWorkbookRow[]
  counts: ClinicalUseReviewCounts
  roleOptions: ClinicalUseRoleOption[]
  slotOptions: ClinicalUseSlotOption[]
}

export interface ClinicalUseReviewDataOptions {
  applicationBaseUrl: string
  locale: string
  clinicalUseManifestHash: string
}

export interface ClinicalUseReviewBuildInput {
  store: CatalogStore
  verificationRows: CatalogVerificationQueueRow[]
}

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function normalizedBaseUrl(rawBaseUrl: string): string {
  const parsed = new URL(rawBaseUrl)
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('Application base URL must be an HTTP(S) origin without credentials.')
  }
  return parsed.origin
}

function safeLocale(locale: string): string {
  return /^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale) ? locale : 'en'
}

function evidenceSignals(row: CatalogVerificationQueueRow | undefined): string {
  if (!row) return 'catalog_context_unavailable'
  return catalogVerificationSignals
    .filter((signal) => {
      switch (signal) {
        case 'strong_match':
          return row.identityEvidence === 'strong_candidate'
        case 'weak_only':
          return row.identityEvidence === 'weak_candidate_only'
        case 'no_gudid_match':
          return row.identityEvidence === 'unmatched'
        case 'distribution_alert':
          return ['not_in_distribution', 'conflicting'].includes(row.distributionEvidence)
        case 'gtin_backfill':
          return row.hasGtinBackfillProposal
        case 'gtin_conflict':
          return row.hasGtinMismatchProposal || row.uniqueStrongGtinCount > 1
        case 'release_candidate':
          return row.hasReleaseCandidateProposal
        case 'backlog_drift':
          return (
            row.backlogDriftFields.length > 0 ||
            ['different_current_strong', 'no_current_strong'].includes(row.backlogGudidAlignment)
          )
        case 'not_in_backlog':
          return row.backlog === null
        case 'manufacturer_source_missing':
          return row.manufacturerEvidenceCount === 0
      }
    })
    .join('; ')
}

function deviceIdentifiers(
  product: CatalogProduct,
  verification: CatalogVerificationQueueRow | undefined,
): string {
  const identifiers = [product.gtin, ...(verification?.candidatePrimaryDis ?? [])].filter(
    (value): value is string => Boolean(value),
  )
  return [...new Set(identifiers)].join(' | ')
}

function evidencePageUrl(baseUrl: string, locale: string, productId: string): string {
  return `${baseUrl}/${locale}/admin/preference-cards/catalog-qa/${encodeURIComponent(productId)}`
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right)
}

function requireProduct(store: CatalogStore, productId: string): CatalogProduct {
  const product = store.productById.get(productId)
  if (!product) {
    throw new Error(`Clinical-use review found an unknown product ${productId}.`)
  }
  return product
}

function requireSlot(store: CatalogStore, slotId: string): ProcedureSlotRecord {
  const slot = store.procedureSlots.find((candidate) => candidate.slot_id === slotId)
  if (!slot) {
    throw new Error(`Clinical-use review found an unknown procedure slot ${slotId}.`)
  }
  return slot
}

function requireProductRole(
  store: CatalogStore,
  productId: string,
  roleCode: string,
): ProductRoleRecord {
  const relationship = store.rolesByProduct
    .get(productId)
    ?.find((candidate) => candidate.role_code === roleCode)
  if (!relationship) {
    throw new Error(
      `Clinical-use review found no Product_Roles pair for ${productId} × ${roleCode}.`,
    )
  }
  return relationship
}

function productEvidenceFields(
  product: CatalogProduct,
  verification: CatalogVerificationQueueRow | undefined,
  baseUrl: string,
  locale: string,
) {
  return {
    manufacturer: product.manufacturerDisplay,
    productName: product.product_name,
    catalogNumber: product.catalog_number ?? '',
    deviceIdentifier: deviceIdentifiers(product, verification),
    verificationGrade: product.verification_grade ?? '',
    verificationStatus: product.verification_status ?? '',
    distributionStatus: verification?.distributionEvidence ?? 'unknown',
    visibilityState: product.visibility_state ?? '',
    evidenceSignal: evidenceSignals(verification),
    sourceId: product.primary_source_id ?? '',
    sourceLocation: product.primary_source_location ?? '',
    evidencePageUrl: evidencePageUrl(baseUrl, locale, product.product_id),
  }
}

function emptyReviewerFields() {
  return {
    decision: '',
    rationale: '',
    evidenceNeeded: '',
    reviewerName: '',
    reviewerConfidence: '',
    reviewDate: '',
    followUpNotes: '',
    readyForSecondReview: '',
    secondReviewer: '',
    secondReviewComments: '',
  }
}

export function buildClinicalUseReviewData(
  input: ClinicalUseReviewBuildInput,
  options: ClinicalUseReviewDataOptions,
): ClinicalUseReviewData {
  if (!/^[a-f0-9]{64}$/i.test(options.clinicalUseManifestHash)) {
    throw new Error('Clinical-use manifest hash must be a SHA-256 value.')
  }
  const baseUrl = normalizedBaseUrl(options.applicationBaseUrl)
  const locale = safeLocale(options.locale)
  const verificationByProduct = new Map(input.verificationRows.map((row) => [row.productId, row]))
  const slotById = new Map(input.store.procedureSlots.map((slot) => [slot.slot_id, slot]))

  const catalogProducts = input.store.products
    .map((product): ClinicalUseCatalogProductWorkbookRow => {
      const verification = verificationByProduct.get(product.product_id)
      const roleLinks = [...(input.store.rolesByProduct.get(product.product_id) ?? [])].sort(
        (left, right) => compareText(left.role_code, right.role_code),
      )
      const roleNames = roleLinks.map(
        (link) => input.store.roleByCode.get(link.role_code)?.role_name ?? link.role_code,
      )
      const canonicalSlotCount =
        input.store.slotOptionsByProduct.get(product.product_id)?.length ?? 0
      return {
        productId: product.product_id,
        manufacturerId: product.manufacturer_id ?? '',
        ...productEvidenceFields(product, verification, baseUrl, locale),
        brandFamily: product.brand_family ?? '',
        primaryCategory: product.primary_category ?? '',
        subcategory: product.subcategory ?? '',
        productKind: product.product_kind ?? '',
        sizeDisplay: product.size_display ?? '',
        description: product.description ?? '',
        currentRoleCodes: roleLinks.map((link) => link.role_code).join('; '),
        currentRoleNames: roleNames.join('; '),
        currentRoleCount: roleLinks.length,
        canonicalSlotCount,
      }
    })
    .sort(
      (left, right) =>
        compareText(left.manufacturer, right.manufacturer) ||
        compareText(left.productName, right.productName) ||
        compareText(left.productId, right.productId),
    )

  const productRoles = [...input.store.rolesByProduct]
    .flatMap(([productId, roleLinks]) => {
      const product = requireProduct(input.store, productId)
      const verification = verificationByProduct.get(productId)
      return roleLinks.map((relationship): ClinicalUseProductRoleWorkbookRow => {
        const role = input.store.roleByCode.get(relationship.role_code)
        if (!role) {
          throw new Error(
            `Clinical-use review found an unknown role ${relationship.role_code} for ${productId}.`,
          )
        }
        const canonicalOptions = (input.store.slotOptionsByProduct.get(productId) ?? []).filter(
          (option) => slotById.get(option.slot_id)?.role_code === relationship.role_code,
        )
        const procedureCodes = [
          ...new Set(
            canonicalOptions.map(
              (option) => requireSlot(input.store, option.slot_id).procedure_code,
            ),
          ),
        ].sort(compareText)
        const procedureNames = procedureCodes.map(
          (procedureCode) =>
            input.store.procedureByCode.get(procedureCode)?.procedure_name ?? procedureCode,
        )
        return {
          reviewKey: clinicalUseProductRoleKey(productId, relationship.role_code),
          productId,
          ...productEvidenceFields(product, verification, baseUrl, locale),
          primaryCategory: product.primary_category ?? '',
          subcategory: product.subcategory ?? '',
          roleCode: relationship.role_code,
          roleName: role.role_name,
          roleCategory: role.category ?? '',
          roleDescription: role.description ?? '',
          roleSelectionGuidance: role.selection_guidance ?? '',
          roleFit: relationship.role_fit ?? '',
          roleNotes: relationship.notes ?? '',
          canonicalSlotCount: canonicalOptions.length,
          procedureCodes: procedureCodes.join('; '),
          procedureNames: procedureNames.join('; '),
          clinicalUseManifestHash: options.clinicalUseManifestHash,
          suggestedRoleCode: '',
          ...emptyReviewerFields(),
        }
      })
    })
    .sort(
      (left, right) =>
        compareText(left.roleName, right.roleName) ||
        compareText(left.manufacturer, right.manufacturer) ||
        compareText(left.productName, right.productName) ||
        compareText(left.reviewKey, right.reviewKey),
    )

  const currentSlots = [...input.store.slotOptionsByProduct]
    .flatMap(([productId, optionsForProduct]) => {
      const product = requireProduct(input.store, productId)
      const verification = verificationByProduct.get(productId)
      return optionsForProduct.map((option): ClinicalUseCurrentSlotWorkbookRow => {
        const slot = requireSlot(input.store, option.slot_id)
        if (option.role_code !== slot.role_code) {
          throw new Error(
            `Clinical-use review found slot-role disagreement for ${option.slot_id} × ${productId}.`,
          )
        }
        const relationship = requireProductRole(input.store, productId, slot.role_code)
        const role = input.store.roleByCode.get(slot.role_code)
        if (!role) {
          throw new Error(`Clinical-use review found an unknown role ${slot.role_code}.`)
        }
        return {
          reviewKey: clinicalUseSlotProductKey(slot.slot_id, productId),
          slotId: slot.slot_id,
          procedureCode: slot.procedure_code,
          procedureName:
            input.store.procedureByCode.get(slot.procedure_code)?.procedure_name ??
            slot.procedure_code,
          slotLabel: slot.slot_label,
          requiredness: slot.requiredness,
          section: slot.section ?? '',
          genericRequirement: slot.generic_requirement ?? '',
          roleCode: slot.role_code,
          roleName: role.role_name,
          productId,
          ...productEvidenceFields(product, verification, baseUrl, locale),
          roleFit: relationship.role_fit ?? '',
          eligibilityStatus: option.eligibility_status ?? '',
          optionReason: option.reason ?? '',
          visibleByDefault: option.visible_by_default === true ? 'Yes' : 'No',
          selectable: option.selectable === true ? 'Yes' : 'No',
          clinicalUseManifestHash: options.clinicalUseManifestHash,
          suggestedSlotId: '',
          ...emptyReviewerFields(),
        }
      })
    })
    .sort(
      (left, right) =>
        compareText(left.procedureName, right.procedureName) ||
        compareText(left.slotLabel, right.slotLabel) ||
        compareText(left.manufacturer, right.manufacturer) ||
        compareText(left.productName, right.productName) ||
        compareText(left.reviewKey, right.reviewKey),
    )

  const roleOptions = input.store.roles
    .map((role) => ({ roleCode: role.role_code, roleName: role.role_name }))
    .sort(
      (left, right) =>
        compareText(left.roleName, right.roleName) || compareText(left.roleCode, right.roleCode),
    )
  const slotOptions = input.store.procedureSlots
    .map((slot) => ({
      option: {
        slotId: slot.slot_id,
        slotLabel: slot.slot_label,
        procedureCode: slot.procedure_code,
        procedureName:
          input.store.procedureByCode.get(slot.procedure_code)?.procedure_name ??
          slot.procedure_code,
        roleCode: slot.role_code,
      },
      displayOrder: slot.display_order,
    }))
    .sort(
      (left, right) =>
        compareText(left.option.procedureName, right.option.procedureName) ||
        left.displayOrder - right.displayOrder ||
        compareText(left.option.slotId, right.option.slotId),
    )
    .map((entry) => entry.option)

  return {
    catalogProducts,
    productRoles,
    currentSlots,
    counts: {
      catalogProducts: catalogProducts.length,
      productRoles: productRoles.length,
      currentSlots: currentSlots.length,
    },
    roleOptions,
    slotOptions,
  }
}

export function getClinicalUseReviewCounts(): ClinicalUseReviewCounts {
  const store = getCatalogStore()
  return {
    catalogProducts: store.products.length,
    productRoles: [...store.rolesByProduct.values()].reduce(
      (total, relationships) => total + relationships.length,
      0,
    ),
    currentSlots: [...store.slotOptionsByProduct.values()].reduce(
      (total, options) => total + options.length,
      0,
    ),
  }
}

export function getClinicalUseReviewData(
  options: ClinicalUseReviewDataOptions,
): ClinicalUseReviewData {
  return buildClinicalUseReviewData(
    {
      store: getCatalogStore(),
      verificationRows: getCatalogVerificationRows(),
    },
    options,
  )
}

export async function getClinicalUseReviewArtifactManifest(): Promise<ClinicalUseReviewArtifactManifest> {
  const entries = await Promise.all(
    CLINICAL_USE_ARTIFACT_FILES.map(async ([key, filename]) => {
      const bytes = await readFile(
        path.join(process.cwd(), 'data', 'ip-preference-cards', 'generated', filename),
      )
      return [key, filename, sha256(bytes)] as const
    }),
  )
  const hashes = Object.fromEntries(entries.map(([key, , hash]) => [key, hash])) as Omit<
    ClinicalUseReviewArtifactManifest,
    'formatVersion' | 'clinicalUseManifestSha256'
  >
  const manifestPayload = JSON.stringify({
    format_version: 1,
    artifacts: entries.map(([, filename, hash]) => ({ filename, sha256: hash })),
  })
  return {
    formatVersion: 1,
    ...hashes,
    clinicalUseManifestSha256: sha256(manifestPayload),
  }
}
