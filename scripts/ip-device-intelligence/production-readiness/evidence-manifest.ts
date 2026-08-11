/**
 * Versioned, non-governed evidence-candidate contract for Device Intelligence research.
 *
 * This module validates research metadata only. It never reads or writes governed catalog data,
 * changes candidate disposition, or treats a physician review result as runtime adoption.
 */
import { readFile } from 'node:fs/promises'

import Ajv2020, { type ErrorObject } from 'ajv/dist/2020'

import evidenceManifestJsonSchema from './evidence-manifest.schema.v1.json'

export const EVIDENCE_MANIFEST_SCHEMA_VERSION =
  'ip-device-intelligence-evidence-manifest/1.0.0' as const

export const NON_GOVERNED_WARNINGS = [
  'NON-GOVERNED RESEARCH CANDIDATES',
  'NOT CONSUMED BY RUNTIME',
  'PHYSICIAN REVIEW REQUIRED BEFORE ADOPTION',
] as const

export const CLAIM_TYPES = [
  'INTENDED_USE',
  'DEVICE_ROLE',
  'DIMENSION',
  'WORKING_CHANNEL_REQUIREMENT',
  'ACCESSORY_COMPATIBILITY',
  'PLATFORM_COMPATIBILITY',
  'DEVICE_COMPATIBILITY',
  'REUSABLE_SINGLE_USE_STATUS',
  'REPROCESSING_BOUNDARY',
  'STERILE_STATUS',
  'PACKAGING',
  'WARNING',
  'CONTRAINDICATION',
  'IFU_VERIFICATION_REQUIREMENT',
  'SOURCE_FRESHNESS',
] as const

export type ClaimType = (typeof CLAIM_TYPES)[number]

export const SOURCE_TYPES = [
  'MANUFACTURER_IFU',
  'OPERATOR_MANUAL',
  'SERVICE_TECHNICAL_MANUAL',
  'OFFICIAL_LABELING',
  'OFFICIAL_TECHNICAL_SPECIFICATION',
  'OFFICIAL_COMPATIBILITY_GUIDE',
  'FDA_LABELING',
  'REGULATORY_LABELING',
  'REGULATORY_DATABASE',
  'MANUFACTURER_PRODUCT_PAGE',
  'MANUFACTURER_ORDERING_INFORMATION',
  'MANUFACTURER_TECHNICAL_BROCHURE',
  'PEER_REVIEWED_RESEARCH',
  'PROFESSIONAL_SOCIETY_GUIDANCE',
  'CONSENSUS_STATEMENT',
  'CLINICAL_GUIDELINE',
  'PRIMARY_SOURCE_SEARCH_RECORD',
] as const

export type SourceType = (typeof SOURCE_TYPES)[number]

export const PROHIBITED_CLAIM_TYPES = [
  'EQUIVALENCE',
  'INTERCHANGEABILITY',
  'SUBSTITUTION',
  'INSTITUTIONAL_AVAILABILITY',
  'HOSPITAL_FORMULARY_STATUS',
] as const

const PROHIBITED_CLAIM_TEXT_PATTERNS: ReadonlyArray<{
  label: string
  pattern: RegExp
}> = [
  { label: 'equivalence', pattern: /\bequivalen(?:ce|t)\b/i },
  { label: 'interchangeability', pattern: /\binterchangeab(?:ility|le)\b/i },
  { label: 'substitution', pattern: /\bsubstitut(?:e|ion|able)\b/i },
  { label: 'institutional availability', pattern: /\binstitutional(?:ly)? available\b/i },
  { label: 'hospital formulary status', pattern: /\bhospital formulary\b/i },
]

const COMPATIBILITY_CLAIM_TYPES = new Set<ClaimType>([
  'ACCESSORY_COMPATIBILITY',
  'PLATFORM_COMPATIBILITY',
  'DEVICE_COMPATIBILITY',
])

const EXPLICIT_PRIMARY_COMPATIBILITY_SOURCE_TYPES = new Set<SourceType>([
  'MANUFACTURER_IFU',
  'OPERATOR_MANUAL',
  'SERVICE_TECHNICAL_MANUAL',
  'OFFICIAL_LABELING',
  'OFFICIAL_TECHNICAL_SPECIFICATION',
  'OFFICIAL_COMPATIBILITY_GUIDE',
  'FDA_LABELING',
  'REGULATORY_LABELING',
])

type EvidenceTier = 'TIER_A' | 'TIER_B' | 'TIER_C' | 'TIER_D' | 'UNRESOLVED'
type EvidenceBasis =
  | 'PRIMARY_OFFICIAL'
  | 'REGULATORY_OFFICIAL'
  | 'MANUFACTURER_WEB'
  | 'CONTEXTUAL'
  | 'UNRESOLVED'

interface SourcePolicy {
  evidenceTier: EvidenceTier
  evidenceBasis: EvidenceBasis
}

const SOURCE_POLICY: Readonly<Record<SourceType, SourcePolicy>> = {
  MANUFACTURER_IFU: { evidenceTier: 'TIER_A', evidenceBasis: 'PRIMARY_OFFICIAL' },
  OPERATOR_MANUAL: { evidenceTier: 'TIER_A', evidenceBasis: 'PRIMARY_OFFICIAL' },
  SERVICE_TECHNICAL_MANUAL: {
    evidenceTier: 'TIER_A',
    evidenceBasis: 'PRIMARY_OFFICIAL',
  },
  OFFICIAL_LABELING: { evidenceTier: 'TIER_A', evidenceBasis: 'PRIMARY_OFFICIAL' },
  OFFICIAL_TECHNICAL_SPECIFICATION: {
    evidenceTier: 'TIER_A',
    evidenceBasis: 'PRIMARY_OFFICIAL',
  },
  OFFICIAL_COMPATIBILITY_GUIDE: {
    evidenceTier: 'TIER_A',
    evidenceBasis: 'PRIMARY_OFFICIAL',
  },
  FDA_LABELING: { evidenceTier: 'TIER_B', evidenceBasis: 'REGULATORY_OFFICIAL' },
  REGULATORY_LABELING: { evidenceTier: 'TIER_B', evidenceBasis: 'REGULATORY_OFFICIAL' },
  REGULATORY_DATABASE: { evidenceTier: 'TIER_B', evidenceBasis: 'REGULATORY_OFFICIAL' },
  MANUFACTURER_PRODUCT_PAGE: {
    evidenceTier: 'TIER_C',
    evidenceBasis: 'MANUFACTURER_WEB',
  },
  MANUFACTURER_ORDERING_INFORMATION: {
    evidenceTier: 'TIER_C',
    evidenceBasis: 'MANUFACTURER_WEB',
  },
  MANUFACTURER_TECHNICAL_BROCHURE: {
    evidenceTier: 'TIER_C',
    evidenceBasis: 'MANUFACTURER_WEB',
  },
  PEER_REVIEWED_RESEARCH: { evidenceTier: 'TIER_D', evidenceBasis: 'CONTEXTUAL' },
  PROFESSIONAL_SOCIETY_GUIDANCE: {
    evidenceTier: 'TIER_D',
    evidenceBasis: 'CONTEXTUAL',
  },
  CONSENSUS_STATEMENT: { evidenceTier: 'TIER_D', evidenceBasis: 'CONTEXTUAL' },
  CLINICAL_GUIDELINE: { evidenceTier: 'TIER_D', evidenceBasis: 'CONTEXTUAL' },
  PRIMARY_SOURCE_SEARCH_RECORD: {
    evidenceTier: 'UNRESOLVED',
    evidenceBasis: 'UNRESOLVED',
  },
}

export interface ProductIdentity {
  repositoryProductId: string | null
  manufacturer: string
  model: string | null
  family: string | null
  configuration: string | null
  displayName: string
}

export interface RoleIdentity {
  roleCode: string
  displayName: string | null
}

export interface EvidenceSource {
  title: string
  url: string
  publisher: string
  sourceType: SourceType
  documentIdentifier: string | null
  documentRevision: string | null
  documentDate: string | null
  accessDate: string
  locator: string
  jurisdiction: string
  evidenceTier: EvidenceTier
  evidenceBasis: EvidenceBasis
  accessStatus: 'ACCESSIBLE' | 'PARTIALLY_ACCESSIBLE' | 'INACCESSIBLE'
  scopeLevel: 'MODEL' | 'CONFIGURATION' | 'FAMILY' | 'ROLE' | 'PROCEDURE' | 'GENERAL'
  exactModelOrOrderCodes: string[]
  explicitCompatibilitySupport: boolean
}

export interface PhysicianAdjudication {
  decisionId: string
  status: 'NOT_READY' | 'READY_FOR_REVIEW' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'DEFERRED'
  question: string
  currentRepositoryState: string
  proposedState: string
  evidenceSummary: string
  strongestPrimarySourceUrl: string | null
  conflictingEvidence: string
  researcherRecommendation: string
  uncertainty: string
  consequenceOfYes: string
  consequenceOfNo: string
  launchBlocking: boolean
  postLaunchAcceptable: boolean
  implementationClassification: 'A' | 'B' | 'C' | 'D' | 'E'
  reviewedBy: string | null
  decisionDate: string | null
}

export interface ReadinessDisposition {
  severity: 'BLOCKER' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
  rationale: string
  affectedRouteOrSurface: string
  frozenMainAffected: boolean
  activePrContext: 'NONE' | 'PR_91' | 'PR_92' | 'PR_91_AND_92'
  activePrResolution:
    | 'NOT_APPLICABLE'
    | 'NOT_REVIEWED'
    | 'NOT_ADDRESSED'
    | 'RESOLVED_VERIFY_AFTER_MERGE'
    | 'PARTIALLY_ADDRESSED_POST_MERGE_VERIFICATION_REQUIRED'
  ownerActionRequired: string
  implementationActionRequired: string
}

export interface EvidenceCandidate {
  candidateId: string
  claimKey: string
  coverageTargetId: string
  requiredClaimTypes: ClaimType[]
  productIdentity: ProductIdentity | null
  roleIdentity: RoleIdentity | null
  procedureCodes: string[]
  researchTier: 'TIER_0' | 'TIER_1' | 'TIER_2' | 'TIER_3'
  ownerSuppliedProductId: string | null
  repositoryStatus:
    | 'EXACT_PRODUCT_PRESENT_ADEQUATELY_SOURCED'
    | 'EXACT_PRODUCT_PRESENT_INCOMPLETE'
    | 'UNREVIEWED_PROPOSAL_ONLY'
    | 'FAMILY_PRESENT_EXACT_PRODUCT_ABSENT'
    | 'LIKELY_DUPLICATE_OR_ALIAS'
    | 'WHOLLY_ABSENT_CANDIDATE'
    | 'INSUFFICIENT_EVIDENCE'
    | null
  claimType: ClaimType
  claimClassification:
    | 'PRODUCT_LABEL_FACT'
    | 'CLINICAL_PRACTICE_CONTEXT'
    | 'EDUCATIONAL_WORKFLOW_SUGGESTION'
    | 'RESEARCHER_INFERENCE'
    | 'PHYSICIAN_DECISION_REQUIRED'
  claimScope: 'MODEL' | 'CONFIGURATION' | 'FAMILY' | 'ROLE' | 'PROCEDURE' | 'GENERAL'
  claimOutcome: 'AFFIRMED' | 'REFUTED' | 'UNRESOLVED'
  proposedClaim: string
  source: EvidenceSource
  evidenceStatus:
    | 'SUPPORTED'
    | 'PARTIALLY_SUPPORTED'
    | 'CONFLICTING'
    | 'PRIMARY_SOURCE_NOT_LOCATED'
    | 'UNSUPPORTED'
    | 'INACCESSIBLE'
  conflictStatus: 'NONE' | 'POTENTIAL' | 'CONFIRMED' | 'UNRESOLVED'
  conflictingCandidateIds: string[]
  physicianAdjudication: PhysicianAdjudication
  candidateState:
    | 'DRAFT'
    | 'RESEARCH_COMPLETE'
    | 'READY_FOR_PHYSICIAN_REVIEW'
    | 'FINAL_ACCEPTED'
    | 'FINAL_REJECTED'
    | 'DEFERRED'
  readiness: ReadinessDisposition
  researcherNotes: string
}

export interface EvidenceManifest {
  schemaVersion: typeof EVIDENCE_MANIFEST_SCHEMA_VERSION
  artifactClass: 'NON_GOVERNED_RESEARCH_CANDIDATES'
  warnings: [
    (typeof NON_GOVERNED_WARNINGS)[0],
    (typeof NON_GOVERNED_WARNINGS)[1],
    (typeof NON_GOVERNED_WARNINGS)[2],
  ]
  researchCutoffDate: string
  candidates: EvidenceCandidate[]
}

export interface ValidationIssue {
  code: string
  path: string
  message: string
}

export type ValidationResult =
  | { ok: true; manifest: EvidenceManifest; issues: [] }
  | { ok: false; issues: ValidationIssue[] }

const ajv = new Ajv2020({ allErrors: true, strict: true })
const validateStructure = ajv.compile<EvidenceManifest>(evidenceManifestJsonSchema)

function structuralIssue(error: ErrorObject): ValidationIssue {
  const missingProperty =
    error.keyword === 'required' && typeof error.params.missingProperty === 'string'
      ? `/${error.params.missingProperty}`
      : ''
  return {
    code: `SCHEMA_${error.keyword.toUpperCase()}`,
    path: `${error.instancePath}${missingProperty}` || '/',
    message: error.message ?? 'Schema validation failed.',
  }
}

function addIssue(issues: ValidationIssue[], code: string, path: string, message: string): void {
  issues.push({ code, path, message })
}

export function isStrictIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && Boolean(parsed.hostname)
  } catch {
    return false
  }
}

function normalized(value: string): string {
  return value.trim().toLocaleUpperCase('en-US')
}

/** Locale-independent ordering for byte-deterministic validation and report output. */
export function compareCodePoints(left: string, right: string): number {
  const leftCodePoints = [...left]
  const rightCodePoints = [...right]
  const sharedLength = Math.min(leftCodePoints.length, rightCodePoints.length)
  for (let index = 0; index < sharedLength; index += 1) {
    const leftValue = leftCodePoints[index].codePointAt(0) as number
    const rightValue = rightCodePoints[index].codePointAt(0) as number
    if (leftValue !== rightValue) return leftValue < rightValue ? -1 : 1
  }
  if (leftCodePoints.length === rightCodePoints.length) return 0
  return leftCodePoints.length < rightCodePoints.length ? -1 : 1
}

function identityKey(candidate: EvidenceCandidate): string {
  const product = candidate.productIdentity
    ? [
        candidate.productIdentity.repositoryProductId,
        candidate.productIdentity.manufacturer,
        candidate.productIdentity.model,
        candidate.productIdentity.family,
        candidate.productIdentity.configuration,
      ]
        .map((value) => normalized(value ?? ''))
        .join('|')
    : ''
  const role = candidate.roleIdentity ? normalized(candidate.roleIdentity.roleCode) : ''
  return `${product}::${role}`
}

function targetSignature(candidate: EvidenceCandidate): string {
  return JSON.stringify({
    identity: identityKey(candidate),
    ownerSuppliedProductId: candidate.ownerSuppliedProductId,
    procedureCodes: [...candidate.procedureCodes].sort(),
    requiredClaimTypes: [...candidate.requiredClaimTypes].sort(),
    researchTier: candidate.researchTier,
    repositoryStatus: candidate.repositoryStatus,
  })
}

function rawStringAt(value: unknown, keys: string[]): string | undefined {
  let cursor: unknown = value
  for (const key of keys) {
    if (typeof cursor !== 'object' || cursor === null || !(key in cursor)) return undefined
    cursor = (cursor as Record<string, unknown>)[key]
  }
  return typeof cursor === 'string' ? cursor : undefined
}

function preflightProhibitedValues(input: unknown): ValidationIssue[] {
  if (typeof input !== 'object' || input === null) return []
  const candidates = (input as Record<string, unknown>).candidates
  if (!Array.isArray(candidates)) return []

  const issues: ValidationIssue[] = []
  candidates.forEach((candidate, index) => {
    const claimType = rawStringAt(candidate, ['claimType'])
    if (
      claimType &&
      (PROHIBITED_CLAIM_TYPES as readonly string[]).includes(normalized(claimType))
    ) {
      addIssue(
        issues,
        'PROHIBITED_CLAIM_TYPE',
        `/candidates/${index}/claimType`,
        `${claimType} claims are prohibited in this research manifest.`,
      )
    }
    const candidateState = rawStringAt(candidate, ['candidateState'])
    if (candidateState && normalized(candidateState).includes('ADOPT')) {
      addIssue(
        issues,
        'ADOPTED_STATE_FORBIDDEN',
        `/candidates/${index}/candidateState`,
        'A research manifest may never mark a candidate adopted.',
      )
    }
  })
  return issues
}

function validateCandidate(
  manifest: EvidenceManifest,
  candidate: EvidenceCandidate,
  index: number,
  issues: ValidationIssue[],
): void {
  const base = `/candidates/${index}`
  if (!candidate.productIdentity && !candidate.roleIdentity) {
    addIssue(
      issues,
      'MISSING_PRODUCT_OR_ROLE_IDENTITY',
      base,
      'At least one productIdentity or roleIdentity is required.',
    )
  }

  const researcherAuthoredSemanticFields: ReadonlyArray<[path: string, value: string]> = [
    [`${base}/proposedClaim`, candidate.proposedClaim],
    [`${base}/physicianAdjudication/question`, candidate.physicianAdjudication.question],
    [
      `${base}/physicianAdjudication/currentRepositoryState`,
      candidate.physicianAdjudication.currentRepositoryState,
    ],
    [`${base}/physicianAdjudication/proposedState`, candidate.physicianAdjudication.proposedState],
    [
      `${base}/physicianAdjudication/evidenceSummary`,
      candidate.physicianAdjudication.evidenceSummary,
    ],
    [
      `${base}/physicianAdjudication/conflictingEvidence`,
      candidate.physicianAdjudication.conflictingEvidence,
    ],
    [
      `${base}/physicianAdjudication/researcherRecommendation`,
      candidate.physicianAdjudication.researcherRecommendation,
    ],
    [`${base}/physicianAdjudication/uncertainty`, candidate.physicianAdjudication.uncertainty],
    [
      `${base}/physicianAdjudication/consequenceOfYes`,
      candidate.physicianAdjudication.consequenceOfYes,
    ],
    [
      `${base}/physicianAdjudication/consequenceOfNo`,
      candidate.physicianAdjudication.consequenceOfNo,
    ],
    [`${base}/readiness/rationale`, candidate.readiness.rationale],
    [`${base}/readiness/affectedRouteOrSurface`, candidate.readiness.affectedRouteOrSurface],
    [`${base}/readiness/ownerActionRequired`, candidate.readiness.ownerActionRequired],
    [
      `${base}/readiness/implementationActionRequired`,
      candidate.readiness.implementationActionRequired,
    ],
    [`${base}/researcherNotes`, candidate.researcherNotes],
  ]
  for (const [path, value] of researcherAuthoredSemanticFields) {
    for (const prohibited of PROHIBITED_CLAIM_TEXT_PATTERNS) {
      if (prohibited.pattern.test(value)) {
        addIssue(
          issues,
          'PROHIBITED_CLAIM_ASSERTION',
          path,
          `Research manifests cannot assert ${prohibited.label}. Record the evidence gap or governance question instead.`,
        )
      }
    }
  }

  if (!candidate.requiredClaimTypes.includes(candidate.claimType)) {
    addIssue(
      issues,
      'CLAIM_TYPE_NOT_REQUIRED_FOR_TARGET',
      `${base}/claimType`,
      'Each candidate claimType must be declared in requiredClaimTypes for its coverage target.',
    )
  }

  if (
    candidate.productIdentity &&
    !candidate.productIdentity.repositoryProductId &&
    !candidate.productIdentity.model &&
    !candidate.productIdentity.family &&
    !candidate.productIdentity.configuration
  ) {
    addIssue(
      issues,
      'INCOMPLETE_PRODUCT_IDENTITY',
      `${base}/productIdentity`,
      'A product requires a repository id, model, family, or configuration.',
    )
  }

  const dateFields: Array<[string, string | null]> = [
    [`${base}/source/accessDate`, candidate.source.accessDate],
    [`${base}/source/documentDate`, candidate.source.documentDate],
    [`${base}/physicianAdjudication/decisionDate`, candidate.physicianAdjudication.decisionDate],
  ]
  for (const [path, value] of dateFields) {
    if (value !== null && !isStrictIsoDate(value)) {
      addIssue(issues, 'MALFORMED_DATE', path, `${value} is not a real YYYY-MM-DD date.`)
    }
  }

  if (isStrictIsoDate(candidate.source.accessDate)) {
    if (candidate.source.accessDate > manifest.researchCutoffDate) {
      addIssue(
        issues,
        'ACCESS_AFTER_RESEARCH_CUTOFF',
        `${base}/source/accessDate`,
        'Source accessDate cannot be after researchCutoffDate.',
      )
    }
    if (
      candidate.source.documentDate &&
      isStrictIsoDate(candidate.source.documentDate) &&
      candidate.source.documentDate > candidate.source.accessDate
    ) {
      addIssue(
        issues,
        'DOCUMENT_DATE_AFTER_ACCESS',
        `${base}/source/documentDate`,
        'A source documentDate cannot be after its accessDate.',
      )
    }
  }

  if (!isHttpUrl(candidate.source.url)) {
    addIssue(
      issues,
      'MALFORMED_URL',
      `${base}/source/url`,
      'Source URL must be an absolute HTTP(S) URL with a host.',
    )
  }
  const strongestPrimarySourceUrl = candidate.physicianAdjudication.strongestPrimarySourceUrl
  if (strongestPrimarySourceUrl && !isHttpUrl(strongestPrimarySourceUrl)) {
    addIssue(
      issues,
      'MALFORMED_URL',
      `${base}/physicianAdjudication/strongestPrimarySourceUrl`,
      'Strongest primary source URL must be an absolute HTTP(S) URL with a host.',
    )
  }

  const policy = SOURCE_POLICY[candidate.source.sourceType]
  if (
    candidate.source.evidenceTier !== policy.evidenceTier ||
    candidate.source.evidenceBasis !== policy.evidenceBasis
  ) {
    addIssue(
      issues,
      'SOURCE_POLICY_MISMATCH',
      `${base}/source`,
      `${candidate.source.sourceType} must use ${policy.evidenceTier}/${policy.evidenceBasis}.`,
    )
  }

  if (
    candidate.claimOutcome === 'UNRESOLVED' &&
    ['SUPPORTED', 'PARTIALLY_SUPPORTED'].includes(candidate.evidenceStatus)
  ) {
    addIssue(
      issues,
      'UNRESOLVED_CLAIM_MARKED_SUPPORTED',
      `${base}/evidenceStatus`,
      'An unresolved claim cannot be supported or partially supported.',
    )
  }

  if (candidate.source.sourceType === 'PRIMARY_SOURCE_SEARCH_RECORD') {
    if (
      candidate.claimOutcome !== 'UNRESOLVED' ||
      !['PRIMARY_SOURCE_NOT_LOCATED', 'UNSUPPORTED', 'INACCESSIBLE'].includes(
        candidate.evidenceStatus,
      ) ||
      candidate.source.explicitCompatibilitySupport
    ) {
      addIssue(
        issues,
        'SEARCH_RECORD_USED_AS_EVIDENCE',
        `${base}/source`,
        'A primary-source search record may document only an unresolved evidence gap.',
      )
    }
  } else if (candidate.evidenceStatus === 'PRIMARY_SOURCE_NOT_LOCATED') {
    addIssue(
      issues,
      'MISSING_PRIMARY_SOURCE_SEARCH_RECORD',
      `${base}/source/sourceType`,
      'PRIMARY_SOURCE_NOT_LOCATED requires a PRIMARY_SOURCE_SEARCH_RECORD.',
    )
  }

  if (
    (candidate.claimScope === 'MODEL' || candidate.claimScope === 'CONFIGURATION') &&
    candidate.claimOutcome !== 'UNRESOLVED' &&
    ['SUPPORTED', 'PARTIALLY_SUPPORTED'].includes(candidate.evidenceStatus)
  ) {
    const identityCodes = [
      candidate.productIdentity?.repositoryProductId,
      candidate.productIdentity?.model,
      candidate.productIdentity?.configuration,
    ]
      .filter((value): value is string => Boolean(value))
      .map(normalized)
    const qualifiedCodes = new Set(candidate.source.exactModelOrOrderCodes.map(normalized))
    if (!identityCodes.some((code) => qualifiedCodes.has(code))) {
      const familySource = candidate.source.scopeLevel === 'FAMILY'
      addIssue(
        issues,
        familySource
          ? 'UNQUALIFIED_FAMILY_SOURCE_FOR_MODEL_CLAIM'
          : 'UNQUALIFIED_SOURCE_FOR_EXACT_IDENTITY_CLAIM',
        `${base}/source/exactModelOrOrderCodes`,
        'A supported model/configuration claim must explicitly name an exact repository, model, or configuration code.',
      )
    }
  }

  if (
    COMPATIBILITY_CLAIM_TYPES.has(candidate.claimType) &&
    candidate.claimOutcome !== 'UNRESOLVED'
  ) {
    const validCompatibilityEvidence =
      EXPLICIT_PRIMARY_COMPATIBILITY_SOURCE_TYPES.has(candidate.source.sourceType) &&
      (candidate.source.evidenceTier === 'TIER_A' || candidate.source.evidenceTier === 'TIER_B') &&
      (candidate.source.evidenceBasis === 'PRIMARY_OFFICIAL' ||
        candidate.source.evidenceBasis === 'REGULATORY_OFFICIAL') &&
      candidate.source.accessStatus === 'ACCESSIBLE' &&
      candidate.source.explicitCompatibilitySupport &&
      strongestPrimarySourceUrl === candidate.source.url
    if (!validCompatibilityEvidence) {
      addIssue(
        issues,
        'COMPATIBILITY_WITHOUT_EXPLICIT_PRIMARY_EVIDENCE',
        `${base}/source`,
        'An affirmed/refuted compatibility claim requires accessible, explicit Tier A/B primary evidence and a matching strongest source URL.',
      )
    }
  }

  if (candidate.conflictStatus === 'NONE' && candidate.conflictingCandidateIds.length > 0) {
    addIssue(
      issues,
      'CONFLICT_STATUS_MISMATCH',
      `${base}/conflictingCandidateIds`,
      'conflictingCandidateIds must be empty when conflictStatus is NONE.',
    )
  }
  if (candidate.conflictStatus !== 'NONE' && candidate.conflictingCandidateIds.length === 0) {
    addIssue(
      issues,
      'CONFLICT_STATUS_MISMATCH',
      `${base}/conflictingCandidateIds`,
      'At least one conflicting candidate id is required when conflictStatus is not NONE.',
    )
  }
  if (candidate.evidenceStatus === 'CONFLICTING' && candidate.conflictStatus === 'NONE') {
    addIssue(
      issues,
      'CONFLICT_STATUS_MISMATCH',
      `${base}/conflictStatus`,
      'CONFLICTING evidence requires an explicit non-NONE conflictStatus.',
    )
  }

  const review = candidate.physicianAdjudication
  const isReviewed = review.status === 'APPROVED' || review.status === 'REJECTED'
  if (isReviewed && (!review.reviewedBy || !review.decisionDate)) {
    addIssue(
      issues,
      'INCOMPLETE_PHYSICIAN_REVIEW',
      `${base}/physicianAdjudication`,
      'Approved/rejected physician review requires reviewedBy and decisionDate.',
    )
  }
  if (!isReviewed && (review.reviewedBy || review.decisionDate)) {
    addIssue(
      issues,
      'CONTRADICTORY_PHYSICIAN_REVIEW',
      `${base}/physicianAdjudication`,
      'Unreviewed/deferred status cannot carry physician reviewer or decision-date fields.',
    )
  }
  if (candidate.candidateState === 'FINAL_ACCEPTED') {
    if (
      review.status !== 'APPROVED' ||
      candidate.evidenceStatus !== 'SUPPORTED' ||
      candidate.claimOutcome === 'UNRESOLVED' ||
      candidate.conflictStatus !== 'NONE' ||
      candidate.source.accessStatus !== 'ACCESSIBLE'
    ) {
      addIssue(
        issues,
        'FINAL_STATE_WITHOUT_PHYSICIAN_APPROVAL',
        `${base}/candidateState`,
        'FINAL_ACCEPTED requires physician approval and accessible, supported, resolved, non-conflicting evidence.',
      )
    }
  }
  if (candidate.candidateState === 'FINAL_REJECTED' && review.status !== 'REJECTED') {
    addIssue(
      issues,
      'FINAL_STATE_WITHOUT_PHYSICIAN_REVIEW',
      `${base}/candidateState`,
      'FINAL_REJECTED requires an explicit physician rejection.',
    )
  }
  if (candidate.candidateState !== 'FINAL_ACCEPTED' && review.status === 'APPROVED') {
    addIssue(
      issues,
      'CONTRADICTORY_FINAL_STATE',
      `${base}/candidateState`,
      'Physician-approved evidence must use FINAL_ACCEPTED research disposition.',
    )
  }
  if (candidate.candidateState !== 'FINAL_REJECTED' && review.status === 'REJECTED') {
    addIssue(
      issues,
      'CONTRADICTORY_FINAL_STATE',
      `${base}/candidateState`,
      'Physician-rejected evidence must use FINAL_REJECTED research disposition.',
    )
  }
  if (
    candidate.candidateState === 'READY_FOR_PHYSICIAN_REVIEW' &&
    !['READY_FOR_REVIEW', 'PENDING'].includes(review.status)
  ) {
    addIssue(
      issues,
      'CONTRADICTORY_PHYSICIAN_REVIEW',
      `${base}/candidateState`,
      'READY_FOR_PHYSICIAN_REVIEW requires READY_FOR_REVIEW or PENDING physician status.',
    )
  }
  if ((candidate.candidateState === 'DEFERRED') !== (review.status === 'DEFERRED')) {
    addIssue(
      issues,
      'CONTRADICTORY_PHYSICIAN_REVIEW',
      `${base}/candidateState`,
      'Candidate and physician dispositions must agree when either is DEFERRED.',
    )
  }

  if (
    review.implementationClassification === 'A' &&
    (!isResolvedSupportedCandidate(candidate) || candidate.conflictStatus !== 'NONE')
  ) {
    addIssue(
      issues,
      'IMPLEMENTATION_CLASSIFICATION_A_NOT_READY',
      `${base}/physicianAdjudication/implementationClassification`,
      'Class A requires accessible, supported, resolved, non-conflicting evidence before physician approval.',
    )
  }

  if (candidate.researchTier === 'TIER_0') {
    if (!candidate.ownerSuppliedProductId || candidate.repositoryStatus === null) {
      addIssue(
        issues,
        'INCOMPLETE_OWNER_PRODUCT_METADATA',
        base,
        'Tier 0 records require ownerSuppliedProductId and repositoryStatus.',
      )
    }
  }

  const readiness = candidate.readiness
  if (readiness.activePrContext === 'NONE' && readiness.activePrResolution !== 'NOT_APPLICABLE') {
    addIssue(
      issues,
      'ACTIVE_PR_CONTEXT_MISMATCH',
      `${base}/readiness/activePrResolution`,
      'activePrResolution must be NOT_APPLICABLE when no active PR context is cited.',
    )
  }
  if (readiness.activePrContext !== 'NONE' && readiness.activePrResolution === 'NOT_APPLICABLE') {
    addIssue(
      issues,
      'ACTIVE_PR_CONTEXT_MISMATCH',
      `${base}/readiness/activePrResolution`,
      'An active PR citation requires an explicit reviewed resolution state.',
    )
  }
}

function isResolvedSupportedCandidate(candidate: EvidenceCandidate): boolean {
  return (
    candidate.evidenceStatus === 'SUPPORTED' &&
    candidate.claimOutcome !== 'UNRESOLVED' &&
    candidate.source.accessStatus === 'ACCESSIBLE'
  )
}

function semanticIssues(manifest: EvidenceManifest): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (!isStrictIsoDate(manifest.researchCutoffDate)) {
    addIssue(
      issues,
      'MALFORMED_DATE',
      '/researchCutoffDate',
      `${manifest.researchCutoffDate} is not a real YYYY-MM-DD date.`,
    )
  }

  const byCandidateId = new Map<string, number>()
  const byDecisionId = new Map<string, number>()
  const byTargetId = new Map<string, { index: number; signature: string }>()
  const byClaimKey = new Map<string, Array<{ candidate: EvidenceCandidate; index: number }>>()

  manifest.candidates.forEach((candidate, index) => {
    validateCandidate(manifest, candidate, index, issues)

    const previousCandidateIndex = byCandidateId.get(candidate.candidateId)
    if (previousCandidateIndex !== undefined) {
      addIssue(
        issues,
        'DUPLICATE_CANDIDATE_ID',
        `/candidates/${index}/candidateId`,
        `candidateId duplicates candidates[${previousCandidateIndex}].`,
      )
    } else {
      byCandidateId.set(candidate.candidateId, index)
    }

    const decisionId = candidate.physicianAdjudication.decisionId
    const previousDecisionIndex = byDecisionId.get(decisionId)
    if (previousDecisionIndex !== undefined) {
      addIssue(
        issues,
        'DUPLICATE_DECISION_ID',
        `/candidates/${index}/physicianAdjudication/decisionId`,
        `decisionId duplicates candidates[${previousDecisionIndex}].`,
      )
    } else {
      byDecisionId.set(decisionId, index)
    }

    const signature = targetSignature(candidate)
    const previousTarget = byTargetId.get(candidate.coverageTargetId)
    if (previousTarget && previousTarget.signature !== signature) {
      addIssue(
        issues,
        'INCONSISTENT_COVERAGE_TARGET',
        `/candidates/${index}/coverageTargetId`,
        `coverageTargetId metadata differs from candidates[${previousTarget.index}].`,
      )
    } else if (!previousTarget) {
      byTargetId.set(candidate.coverageTargetId, { index, signature })
    }

    const claimRows = byClaimKey.get(candidate.claimKey)
    if (claimRows) claimRows.push({ candidate, index })
    else byClaimKey.set(candidate.claimKey, [{ candidate, index }])
  })

  manifest.candidates.forEach((candidate, index) => {
    for (const conflictingId of candidate.conflictingCandidateIds) {
      if (conflictingId === candidate.candidateId) {
        addIssue(
          issues,
          'SELF_REFERENTIAL_CONFLICT',
          `/candidates/${index}/conflictingCandidateIds`,
          'A candidate cannot conflict with itself.',
        )
      } else if (!byCandidateId.has(conflictingId)) {
        addIssue(
          issues,
          'UNKNOWN_CONFLICTING_CANDIDATE',
          `/candidates/${index}/conflictingCandidateIds`,
          `No candidate exists with id ${conflictingId}.`,
        )
      }
    }
  })

  for (const rows of byClaimKey.values()) {
    const accepted = rows.filter(({ candidate }) => candidate.candidateState === 'FINAL_ACCEPTED')
    const rejected = rows.filter(({ candidate }) => candidate.candidateState === 'FINAL_REJECTED')
    if (accepted.length > 0 && rejected.length > 0) {
      for (const { index } of [...accepted, ...rejected]) {
        addIssue(
          issues,
          'CONTRADICTORY_FINAL_STATES',
          `/candidates/${index}/candidateState`,
          'The same claimKey cannot have both FINAL_ACCEPTED and FINAL_REJECTED records.',
        )
      }
    }
    const acceptedClaims = new Set(
      accepted.map(({ candidate }) => normalized(candidate.proposedClaim)),
    )
    if (acceptedClaims.size > 1) {
      for (const { index } of accepted) {
        addIssue(
          issues,
          'CONTRADICTORY_FINAL_STATES',
          `/candidates/${index}/proposedClaim`,
          'The same claimKey cannot finalize multiple different claims.',
        )
      }
    }

    for (let leftIndex = 0; leftIndex < rows.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < rows.length; rightIndex += 1) {
        const left = rows[leftIndex]
        const right = rows[rightIndex]
        const divergent =
          left.candidate.claimOutcome !== right.candidate.claimOutcome ||
          normalized(left.candidate.proposedClaim) !== normalized(right.candidate.proposedClaim)
        if (!divergent) continue

        for (const [row, other] of [
          [left, right],
          [right, left],
        ] as const) {
          if (row.candidate.conflictStatus === 'NONE') {
            addIssue(
              issues,
              'UNDECLARED_DIVERGENT_EVIDENCE',
              `/candidates/${row.index}/conflictStatus`,
              `Divergent evidence for claimKey ${row.candidate.claimKey} requires a non-NONE conflictStatus.`,
            )
          }
          if (!row.candidate.conflictingCandidateIds.includes(other.candidate.candidateId)) {
            addIssue(
              issues,
              'NONRECIPROCAL_DIVERGENT_CONFLICT',
              `/candidates/${row.index}/conflictingCandidateIds`,
              `Divergent evidence must reciprocally reference ${other.candidate.candidateId}.`,
            )
          }
        }
      }
    }
  }

  return issues
}

export function validateEvidenceManifest(input: unknown): ValidationResult {
  const preflightIssues = preflightProhibitedValues(input)
  if (!validateStructure(input)) {
    return {
      ok: false,
      issues: [...preflightIssues, ...(validateStructure.errors ?? []).map(structuralIssue)].sort(
        compareIssues,
      ),
    }
  }
  const issues = [...preflightIssues, ...semanticIssues(input)].sort(compareIssues)
  return issues.length === 0 ? { ok: true, manifest: input, issues: [] } : { ok: false, issues }
}

function compareIssues(a: ValidationIssue, b: ValidationIssue): number {
  return (
    compareCodePoints(a.path, b.path) ||
    compareCodePoints(a.code, b.code) ||
    compareCodePoints(a.message, b.message)
  )
}

export async function loadAndValidateEvidenceManifest(filePath: string): Promise<EvidenceManifest> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(filePath, 'utf8'))
  } catch (error) {
    throw new Error(`Unable to read evidence manifest ${filePath}: ${(error as Error).message}`)
  }
  const result = validateEvidenceManifest(parsed)
  if (!result.ok) {
    const details = result.issues
      .map((issue) => `- ${issue.code} ${issue.path}: ${issue.message}`)
      .join('\n')
    throw new Error(`Evidence manifest validation failed:\n${details}`)
  }
  return result.manifest
}

export function isCompatibilityClaimType(claimType: ClaimType): boolean {
  return COMPATIBILITY_CLAIM_TYPES.has(claimType)
}

export function sourcePolicyFor(sourceType: SourceType): SourcePolicy {
  return SOURCE_POLICY[sourceType]
}
