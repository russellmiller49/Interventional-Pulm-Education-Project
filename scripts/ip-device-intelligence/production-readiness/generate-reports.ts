/**
 * Deterministic reports over a validated, non-governed evidence manifest.
 *
 * The caller must provide --as-of-date. No clock, random value, locale-dependent date rendering,
 * or runtime catalog input participates in report generation.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  compareCodePoints,
  isCompatibilityClaimType,
  isStrictIsoDate,
  loadAndValidateEvidenceManifest,
  NON_GOVERNED_WARNINGS,
  type ClaimType,
  type EvidenceCandidate,
  type EvidenceManifest,
  validateEvidenceManifest,
} from './evidence-manifest'

export const GENERATED_REPORT_FILENAMES = [
  'evidence-conflicts.md',
  'launch-blocker-matrix.md',
  'owner-supplied-missing-products.md',
  'physician-adjudication-queue.md',
  'source-coverage-report.md',
] as const

export interface ReportOptions {
  asOfDate: string
  staleAfterDays: number
}

interface CoverageTarget {
  id: string
  candidates: EvidenceCandidate[]
  requiredClaimTypes: ClaimType[]
}

function warningBlock(): string {
  return NON_GOVERNED_WARNINGS.map((warning) => `> **${warning}**`).join('\n')
}

function reportHeader(title: string, options: ReportOptions): string {
  return `# ${title}\n\n${warningBlock()}\n\nReport as-of date: \`${options.asOfDate}\`.\n`
}

function markdownCell(value: unknown): string {
  const rendered = Array.isArray(value) ? value.join(', ') : String(value)
  return rendered.replaceAll('|', '\\|').replaceAll('\r', ' ').replaceAll('\n', '<br>')
}

function markdownTable(headers: string[], rows: unknown[][]): string {
  const renderedHeaders = headers.map(markdownCell)
  const renderedRows = (
    rows.length === 0 ? [headers.map((_, index) => (index === 0 ? '_None_' : '—'))] : rows
  ).map((row) => row.map(markdownCell))
  const widths = renderedHeaders.map((header, index) =>
    Math.max(header.length, ...renderedRows.map((row) => row[index].length)),
  )
  const renderRow = (row: string[]): string =>
    `| ${row.map((cell, index) => cell.padEnd(widths[index])).join(' | ')} |`
  const separator = `| ${widths.map((width) => '-'.repeat(Math.max(3, width))).join(' | ')} |`
  return [renderRow(renderedHeaders), separator, ...renderedRows.map(renderRow)].join('\n')
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort(compareCodePoints)
}

type SourceEvidenceTier = EvidenceCandidate['source']['evidenceTier']

const CLAIM_CLOSURE_TIERS: Readonly<Record<ClaimType, readonly SourceEvidenceTier[]>> = {
  INTENDED_USE: ['TIER_A', 'TIER_B', 'TIER_C'],
  DEVICE_ROLE: ['TIER_A', 'TIER_B', 'TIER_C'],
  DIMENSION: ['TIER_A', 'TIER_B', 'TIER_C'],
  WORKING_CHANNEL_REQUIREMENT: ['TIER_A', 'TIER_B'],
  ACCESSORY_COMPATIBILITY: ['TIER_A', 'TIER_B'],
  PLATFORM_COMPATIBILITY: ['TIER_A', 'TIER_B'],
  DEVICE_COMPATIBILITY: ['TIER_A', 'TIER_B'],
  REUSABLE_SINGLE_USE_STATUS: ['TIER_A', 'TIER_B'],
  REPROCESSING_BOUNDARY: ['TIER_A', 'TIER_B'],
  STERILE_STATUS: ['TIER_A', 'TIER_B'],
  PACKAGING: ['TIER_A', 'TIER_B', 'TIER_C'],
  WARNING: ['TIER_A', 'TIER_B'],
  CONTRAINDICATION: ['TIER_A', 'TIER_B'],
  IFU_VERIFICATION_REQUIREMENT: ['TIER_A', 'TIER_B', 'TIER_C'],
  SOURCE_FRESHNESS: ['TIER_A', 'TIER_B', 'TIER_C'],
}

function isEvidenceUsable(candidate: EvidenceCandidate): boolean {
  return (
    candidate.evidenceStatus === 'SUPPORTED' &&
    candidate.claimOutcome !== 'UNRESOLVED' &&
    candidate.source.accessStatus === 'ACCESSIBLE' &&
    CLAIM_CLOSURE_TIERS[candidate.claimType].includes(candidate.source.evidenceTier)
  )
}

function isPrimaryOrRegulatoryEvidence(candidate: EvidenceCandidate): boolean {
  return candidate.source.evidenceTier === 'TIER_A' || candidate.source.evidenceTier === 'TIER_B'
}

function isReadyForGovernedProposal(candidate: EvidenceCandidate): boolean {
  return (
    isEvidenceUsable(candidate) &&
    isPrimaryOrRegulatoryEvidence(candidate) &&
    candidate.candidateState === 'READY_FOR_PHYSICIAN_REVIEW' &&
    ['READY_FOR_REVIEW', 'PENDING'].includes(candidate.physicianAdjudication.status) &&
    !candidate.physicianAdjudication.launchBlocking &&
    !['BLOCKER', 'HIGH'].includes(candidate.readiness.severity)
  )
}

function isPhysicianOpen(candidate: EvidenceCandidate): boolean {
  return !['APPROVED', 'REJECTED'].includes(candidate.physicianAdjudication.status)
}

function productKey(candidate: EvidenceCandidate): string {
  const product = candidate.productIdentity
  if (!product) return 'UNASSIGNED'
  return (
    product.repositoryProductId ??
    product.model ??
    product.configuration ??
    product.family ??
    product.displayName
  )
}

function productLabel(candidate: EvidenceCandidate): string {
  const product = candidate.productIdentity
  if (!product) return 'UNASSIGNED'
  const identifier =
    product.repositoryProductId ?? product.model ?? product.configuration ?? product.family
  return identifier ? `${product.displayName} (${identifier})` : product.displayName
}

function subjectLabel(candidate: EvidenceCandidate): string {
  const labels: string[] = []
  if (candidate.productIdentity) labels.push(productLabel(candidate))
  if (candidate.roleIdentity) labels.push(`role ${candidate.roleIdentity.roleCode}`)
  return labels.join(' / ') || 'UNASSIGNED'
}

function targetGroups(manifest: EvidenceManifest): CoverageTarget[] {
  const grouped = new Map<string, EvidenceCandidate[]>()
  for (const candidate of manifest.candidates) {
    const existing = grouped.get(candidate.coverageTargetId)
    if (existing) existing.push(candidate)
    else grouped.set(candidate.coverageTargetId, [candidate])
  }
  return [...grouped.entries()]
    .map(([id, candidates]) => ({
      id,
      candidates: [...candidates].sort((a, b) => compareCodePoints(a.candidateId, b.candidateId)),
      requiredClaimTypes: [...candidates[0].requiredClaimTypes].sort(compareCodePoints),
    }))
    .sort((a, b) => compareCodePoints(a.id, b.id))
}

function sourceDocumentKey(candidate: EvidenceCandidate): string {
  const source = candidate.source
  if (!source.documentIdentifier) return `URL:${source.url}`
  return [source.publisher, source.documentIdentifier, source.documentRevision ?? ''].join('|')
}

function coverageRows(
  manifest: EvidenceManifest,
  keysFor: (candidate: EvidenceCandidate) => string[],
): unknown[][] {
  const rows = new Map<string, EvidenceCandidate[]>()
  for (const candidate of manifest.candidates) {
    const keys = sortedUnique(keysFor(candidate))
    for (const key of keys.length > 0 ? keys : ['UNASSIGNED']) {
      const existing = rows.get(key)
      if (existing) existing.push(candidate)
      else rows.set(key, [candidate])
    }
  }
  return [...rows.entries()]
    .sort(([a], [b]) => compareCodePoints(a, b))
    .map(([key, candidates]) => [
      key,
      new Set(candidates.map((candidate) => candidate.coverageTargetId)).size,
      candidates.length,
      new Set(candidates.map((candidate) => candidate.source.url)).size,
      new Set(candidates.map(sourceDocumentKey)).size,
      candidates.filter(isEvidenceUsable).length,
      candidates.filter(isPrimaryOrRegulatoryEvidence).length,
      candidates.filter(isPhysicianOpen).length,
    ])
}

function requiredEvidenceMissing(target: CoverageTarget, requiredTypes: ClaimType[]): ClaimType[] {
  return requiredTypes.filter(
    (claimType) =>
      !target.candidates.some(
        (candidate) => candidate.claimType === claimType && isEvidenceUsable(candidate),
      ),
  )
}

function ageInDays(asOfDate: string, documentDate: string): number {
  const dayMilliseconds = 24 * 60 * 60 * 1000
  return Math.floor(
    (Date.parse(`${asOfDate}T00:00:00.000Z`) - Date.parse(`${documentDate}T00:00:00.000Z`)) /
      dayMilliseconds,
  )
}

function sourceCoverageReport(manifest: EvidenceManifest, options: ReportOptions): string {
  const coverageHeaders = [
    'Dimension',
    'Coverage targets',
    'Candidate records',
    'Distinct source URLs',
    'Distinct source documents',
    'Usable supported records',
    'Tier A/B records',
    'Physician-open records',
  ]
  const targets = targetGroups(manifest)
  const intendedUseMissing = targets
    .map((target) => ({
      target,
      missing: requiredEvidenceMissing(target, ['INTENDED_USE']),
    }))
    .filter(
      ({ target, missing }) =>
        target.requiredClaimTypes.includes('INTENDED_USE') && missing.length > 0,
    )
  const compatibilityTypes = [
    'ACCESSORY_COMPATIBILITY',
    'PLATFORM_COMPATIBILITY',
    'DEVICE_COMPATIBILITY',
  ] as const satisfies readonly ClaimType[]
  const compatibilityMissing = targets
    .map((target) => {
      const required = target.requiredClaimTypes.filter((claimType) =>
        compatibilityTypes.includes(claimType as (typeof compatibilityTypes)[number]),
      )
      return { target, missing: requiredEvidenceMissing(target, required) }
    })
    .filter(({ missing }) => missing.length > 0)

  const stale = manifest.candidates
    .filter(
      (candidate) =>
        candidate.source.documentDate &&
        ageInDays(options.asOfDate, candidate.source.documentDate) > options.staleAfterDays,
    )
    .sort((a, b) => compareCodePoints(a.candidateId, b.candidateId))
  const undated = manifest.candidates
    .filter((candidate) => candidate.source.documentDate === null)
    .sort((a, b) => compareCodePoints(a.candidateId, b.candidateId))
  const accessRisks = manifest.candidates
    .filter((candidate) => candidate.source.accessStatus !== 'ACCESSIBLE')
    .sort((a, b) => compareCodePoints(a.candidateId, b.candidateId))

  return `${reportHeader('Source coverage report', options)}
Staleness threshold: more than ${options.staleAfterDays} days from the explicit report date. A
missing document date is reported as undated, never silently aged from the runtime clock.

## Coverage by exemplar procedure

${markdownTable(
  coverageHeaders,
  coverageRows(manifest, (candidate) => candidate.procedureCodes),
)}

## Coverage by role

${markdownTable(
  coverageHeaders,
  coverageRows(manifest, (candidate) =>
    candidate.roleIdentity ? [candidate.roleIdentity.roleCode] : [],
  ),
)}

## Coverage by product

${markdownTable(
  coverageHeaders,
  coverageRows(manifest, (candidate) => [productKey(candidate)]),
)}

## Coverage by research tier

${markdownTable(
  coverageHeaders,
  coverageRows(manifest, (candidate) => [candidate.researchTier]),
)}

## Coverage by evidence tier

${markdownTable(
  coverageHeaders,
  coverageRows(manifest, (candidate) => [candidate.source.evidenceTier]),
)}

## Missing intended-use evidence

${markdownTable(
  ['Coverage target', 'Product/role', 'Procedures', 'Required type', 'Observed records'],
  intendedUseMissing.map(({ target, missing }) => [
    target.id,
    subjectLabel(target.candidates[0]),
    sortedUnique(target.candidates.flatMap((candidate) => candidate.procedureCodes)).join(', ') ||
      'UNASSIGNED',
    missing.join(', '),
    target.candidates
      .filter((candidate) => candidate.claimType === 'INTENDED_USE')
      .map((candidate) => `${candidate.candidateId}: ${candidate.evidenceStatus}`)
      .join('; ') || 'NO CANDIDATE RECORD',
  ]),
)}

## Missing compatibility evidence

${markdownTable(
  [
    'Coverage target',
    'Product/role',
    'Procedures',
    'Missing compatibility type',
    'Observed records',
  ],
  compatibilityMissing.map(({ target, missing }) => [
    target.id,
    subjectLabel(target.candidates[0]),
    sortedUnique(target.candidates.flatMap((candidate) => candidate.procedureCodes)).join(', ') ||
      'UNASSIGNED',
    missing.join(', '),
    target.candidates
      .filter((candidate) => isCompatibilityClaimType(candidate.claimType))
      .map((candidate) => `${candidate.candidateId}: ${candidate.evidenceStatus}`)
      .join('; ') || 'NO CANDIDATE RECORD',
  ]),
)}

## Stale sources

${markdownTable(
  ['Candidate', 'Source', 'Document date', 'Age (days)', 'Evidence tier'],
  stale.map((candidate) => [
    candidate.candidateId,
    candidate.source.title,
    candidate.source.documentDate,
    ageInDays(options.asOfDate, candidate.source.documentDate as string),
    candidate.source.evidenceTier,
  ]),
)}

## Undated sources

${markdownTable(
  ['Candidate', 'Source', 'Revision', 'Locator', 'Access date'],
  undated.map((candidate) => [
    candidate.candidateId,
    candidate.source.title,
    candidate.source.documentRevision ?? 'NOT RECORDED',
    candidate.source.locator,
    candidate.source.accessDate,
  ]),
)}

## Inaccessible or partially accessible sources

${markdownTable(
  ['Candidate', 'Source URL', 'Access status', 'Evidence status', 'Locator'],
  accessRisks.map((candidate) => [
    candidate.candidateId,
    candidate.source.url,
    candidate.source.accessStatus,
    candidate.evidenceStatus,
    candidate.source.locator,
  ]),
)}
`
}

function familySourceRisk(candidate: EvidenceCandidate): string | null {
  if (
    candidate.claimType === 'PACKAGING' &&
    candidate.claimClassification === 'RESEARCHER_INFERENCE' &&
    candidate.evidenceStatus === 'PARTIALLY_SUPPORTED' &&
    candidate.productIdentity?.model
  ) {
    return 'PARTIAL FAMILY-GROUP CROSSWALK — exact-suffix BOM unresolved'
  }

  if (
    !['MODEL', 'CONFIGURATION'].includes(candidate.claimScope) ||
    candidate.source.scopeLevel !== 'FAMILY'
  ) {
    return null
  }
  const expectedCodes = [
    candidate.productIdentity?.repositoryProductId,
    candidate.productIdentity?.model,
    candidate.productIdentity?.configuration,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLocaleUpperCase('en-US'))
  const namedCodes = new Set(
    candidate.source.exactModelOrOrderCodes.map((value) => value.toLocaleUpperCase('en-US')),
  )
  return expectedCodes.some((code) => namedCodes.has(code))
    ? 'QUALIFIED FAMILY SOURCE — exact model/order code listed'
    : 'UNQUALIFIED FAMILY SOURCE — model claim blocked/unresolved'
}

function evidenceConflictsReport(manifest: EvidenceManifest, options: ReportOptions): string {
  const conflicts = manifest.candidates
    .filter((candidate) => candidate.conflictStatus !== 'NONE')
    .sort((a, b) => compareCodePoints(a.candidateId, b.candidateId))
  const familyRisks = manifest.candidates
    .map((candidate) => ({ candidate, risk: familySourceRisk(candidate) }))
    .filter((row): row is { candidate: EvidenceCandidate; risk: string } => row.risk !== null)
    .sort((a, b) => compareCodePoints(a.candidate.candidateId, b.candidate.candidateId))

  return `${reportHeader('Evidence conflicts and model-scope risks', options)}
## Conflicting claims

${markdownTable(
  [
    'Candidate',
    'Claim key',
    'Conflict status',
    'Conflicting candidates',
    'Evidence status',
    'Physician status',
  ],
  conflicts.map((candidate) => [
    candidate.candidateId,
    candidate.claimKey,
    candidate.conflictStatus,
    candidate.conflictingCandidateIds.join(', '),
    candidate.evidenceStatus,
    candidate.physicianAdjudication.status,
  ]),
)}

## Family-versus-model risks

${markdownTable(
  ['Candidate', 'Product', 'Claim scope', 'Source scope', 'Qualification', 'Evidence status'],
  familyRisks.map(({ candidate, risk }) => [
    candidate.candidateId,
    productLabel(candidate),
    candidate.claimScope,
    candidate.source.scopeLevel,
    risk,
    candidate.evidenceStatus,
  ]),
)}
`
}

function physicianQueueReport(manifest: EvidenceManifest, options: ReportOptions): string {
  const queue = manifest.candidates
    .filter(isPhysicianOpen)
    .sort(
      (a, b) =>
        compareCodePoints(a.physicianAdjudication.decisionId, b.physicianAdjudication.decisionId) ||
        compareCodePoints(a.candidateId, b.candidateId),
    )
  return `${reportHeader('Physician-adjudication queue', options)}
AI-authored recommendations below remain researcher recommendations. They are not physician-owner
decisions and cannot adopt a candidate into governed data.

${markdownTable(
  [
    'Decision',
    'Affected product/role/procedure',
    'Question',
    'Current state',
    'Proposed state',
    'Evidence summary / strongest source',
    'Conflict / uncertainty / researcher recommendation',
    'YES consequence',
    'NO consequence',
    'Launch blocking',
    'Post-launch acceptable',
    'Class',
    'Status',
  ],
  queue.map((candidate) => {
    const review = candidate.physicianAdjudication
    const affected = `${subjectLabel(candidate)}; ${candidate.procedureCodes.join(', ') || 'no procedure assigned'}`
    return [
      review.decisionId,
      affected,
      review.question,
      review.currentRepositoryState,
      review.proposedState,
      `${review.evidenceSummary}; strongest primary source: ${review.strongestPrimarySourceUrl ?? 'NOT LOCATED'}`,
      `Conflict: ${review.conflictingEvidence}; uncertainty: ${review.uncertainty}; researcher recommendation: ${review.researcherRecommendation}`,
      review.consequenceOfYes,
      review.consequenceOfNo,
      review.launchBlocking ? 'YES' : 'NO',
      review.postLaunchAcceptable ? 'YES' : 'NO',
      review.implementationClassification,
      review.status,
    ]
  }),
)}
`
}

const SEVERITY_ORDER: Readonly<Record<EvidenceCandidate['readiness']['severity'], number>> = {
  BLOCKER: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  NONE: 4,
}

function activePrResolutionLabel(
  resolution: EvidenceCandidate['readiness']['activePrResolution'],
): string {
  if (resolution === 'RESOLVED_VERIFY_AFTER_MERGE') {
    return 'RESOLVED IN ACTIVE PR — VERIFY AFTER MERGE'
  }
  if (resolution === 'PARTIALLY_ADDRESSED_POST_MERGE_VERIFICATION_REQUIRED') {
    return 'PARTIALLY ADDRESSED IN ACTIVE PR — POST-MERGE VERIFICATION REQUIRED'
  }
  return resolution
}

function launchBlockerReport(manifest: EvidenceManifest, options: ReportOptions): string {
  const blockers = manifest.candidates
    .filter((candidate) => candidate.readiness.severity !== 'NONE')
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.readiness.severity] - SEVERITY_ORDER[b.readiness.severity] ||
        compareCodePoints(a.candidateId, b.candidateId),
    )
  return `${reportHeader('Launch-blocker matrix', options)}
${markdownTable(
  [
    'Severity',
    'Candidate / evidence',
    'Affected route/product/role',
    'Rationale',
    'Frozen main affected',
    'Active PR context',
    'Active PR resolution',
    'Owner action',
    'Implementation action',
  ],
  blockers.map((candidate) => [
    candidate.readiness.severity,
    `${candidate.candidateId}; ${candidate.evidenceStatus}; ${candidate.source.url} — ${candidate.source.locator}`,
    `${candidate.readiness.affectedRouteOrSurface}; ${subjectLabel(candidate)}`,
    candidate.readiness.rationale,
    candidate.readiness.frozenMainAffected ? 'YES' : 'NO',
    candidate.readiness.activePrContext,
    activePrResolutionLabel(candidate.readiness.activePrResolution),
    candidate.readiness.ownerActionRequired,
    candidate.readiness.implementationActionRequired,
  ]),
)}
`
}

function ownerProductReport(manifest: EvidenceManifest, options: ReportOptions): string {
  const ownerGroups = new Map<string, EvidenceCandidate[]>()
  for (const candidate of manifest.candidates) {
    if (!candidate.ownerSuppliedProductId) continue
    const existing = ownerGroups.get(candidate.ownerSuppliedProductId)
    if (existing) existing.push(candidate)
    else ownerGroups.set(candidate.ownerSuppliedProductId, [candidate])
  }
  const rows = [...ownerGroups.entries()]
    .sort(([a], [b]) => compareCodePoints(a, b))
    .map(([ownerProductId, candidates]) => {
      const sorted = [...candidates].sort((a, b) => compareCodePoints(a.candidateId, b.candidateId))
      const requirements = sortedUnique(
        sorted.flatMap((candidate) => candidate.requiredClaimTypes),
      ) as ClaimType[]
      const missing = requirements.filter(
        (claimType) =>
          !sorted.some(
            (candidate) => candidate.claimType === claimType && isEvidenceUsable(candidate),
          ),
      )
      const compatibilityRequired = requirements.some(isCompatibilityClaimType)
      const compatibilityMissing = missing.some(isCompatibilityClaimType)
      const familyRisks = sorted
        .map(familySourceRisk)
        .filter((risk): risk is string => risk !== null)
      const conflicts = sorted.some((candidate) => candidate.conflictStatus !== 'NONE')
      const accessRisk = sorted.some((candidate) => candidate.source.accessStatus !== 'ACCESSIBLE')
      const nonPrimaryEvidence = sorted.some(
        (candidate) => !isPrimaryOrRegulatoryEvidence(candidate),
      )
      const blockedReviewState = sorted.some(
        (candidate) =>
          candidate.physicianAdjudication.launchBlocking ||
          ['BLOCKER', 'HIGH'].includes(candidate.readiness.severity) ||
          candidate.candidateState !== 'READY_FOR_PHYSICIAN_REVIEW' ||
          !['READY_FOR_REVIEW', 'PENDING'].includes(candidate.physicianAdjudication.status),
      )
      const safeToPropose =
        missing.length === 0 &&
        requirements.every((claimType) =>
          sorted.some(
            (candidate) =>
              candidate.claimType === claimType && isReadyForGovernedProposal(candidate),
          ),
        ) &&
        !conflicts &&
        !accessRisk &&
        !nonPrimaryEvidence &&
        !blockedReviewState &&
        !familyRisks.some((risk) => risk.startsWith('UNQUALIFIED') || risk.startsWith('PARTIAL')) &&
        !sorted.some((candidate) => candidate.candidateState === 'FINAL_REJECTED')
      return [
        `${productLabel(sorted[0])}; owner id ${ownerProductId}`,
        sortedUnique(
          sorted.map((candidate) => candidate.repositoryStatus ?? 'NOT_CLASSIFIED'),
        ).join(', '),
        missing.length === 0
          ? 'COMPLETE FOR DECLARED REQUIREMENTS'
          : `MISSING: ${missing.join(', ')}`,
        sortedUnique(
          sorted.map(
            (candidate) => candidate.roleIdentity?.roleCode ?? 'PHYSICIAN DECISION REQUIRED',
          ),
        ).join(', '),
        sortedUnique(sorted.flatMap((candidate) => candidate.procedureCodes)).join(', ') ||
          'PHYSICIAN DECISION REQUIRED',
        compatibilityRequired
          ? compatibilityMissing
            ? 'INCOMPLETE — explicit compatibility evidence missing'
            : 'DECLARED REQUIREMENTS SUPPORTED'
          : 'NO COMPATIBILITY REQUIREMENT DECLARED',
        sortedUnique(sorted.map((candidate) => candidate.source.evidenceTier)).join(', '),
        familyRisks.join('; ') || 'NONE IDENTIFIED',
        sortedUnique(sorted.map((candidate) => candidate.physicianAdjudication.status)).join(', '),
        safeToPropose ? 'YES — PHYSICIAN REVIEW STILL REQUIRED' : 'NO — CLOSE LISTED GAPS FIRST',
      ]
    })

  const detailRows = [...ownerGroups.entries()]
    .sort(([a], [b]) => compareCodePoints(a, b))
    .map(([ownerProductId, candidates]) => {
      const sorted = [...candidates].sort((a, b) => compareCodePoints(a.candidateId, b.candidateId))
      const requirements = sortedUnique(
        sorted.flatMap((candidate) => candidate.requiredClaimTypes),
      ) as ClaimType[]
      const missing = requirements.filter(
        (claimType) =>
          !sorted.some(
            (candidate) => candidate.claimType === claimType && isEvidenceUsable(candidate),
          ),
      )
      const identity = sorted[0].productIdentity
      return [
        `${identity?.manufacturer ?? 'UNASSIGNED'}; ${productLabel(sorted[0])}; owner id ${ownerProductId}`,
        sortedUnique(
          sorted.map(
            (candidate) =>
              `${candidate.candidateId}: ${candidate.source.title} — ${candidate.source.url} — ${candidate.source.locator}`,
          ),
        ).join('; '),
        missing.length > 0 ? missing.join(', ') : 'NONE FOR DECLARED REQUIREMENTS',
        sortedUnique(
          sorted.map(
            (candidate) =>
              `${candidate.productIdentity?.configuration ?? 'NO CONFIGURATION RECORDED'}; ${candidate.researcherNotes}`,
          ),
        ).join('; '),
        sortedUnique(
          sorted.map(
            (candidate) => `${candidate.readiness.severity}: ${candidate.readiness.rationale}`,
          ),
        ).join('; '),
        sortedUnique(
          sorted.map(
            (candidate) =>
              `${candidate.physicianAdjudication.decisionId}: ${candidate.physicianAdjudication.question}`,
          ),
        ).join('; '),
        sortedUnique(
          sorted.flatMap((candidate) => [
            candidate.readiness.ownerActionRequired,
            candidate.readiness.implementationActionRequired,
          ]),
        ).join('; '),
      ]
    })

  return `${reportHeader('Owner-supplied product report', options)}
“Safe to propose” means only that the manifest’s declared evidence requirements are traceable. It
does not mean approved, adopted, equivalent, substitutable, compatible beyond explicit evidence,
commercially available, or institutionally available.

${markdownTable(
  [
    'Product/configuration',
    'Repository status',
    'Evidence completeness',
    'Role decision',
    'Procedure decision',
    'Compatibility-chain status',
    'Source quality',
    'Model/family risk',
    'Physician status',
    'Safe to propose for governed ingestion?',
  ],
  rows,
)}

## Exact evidence and action register

This register makes the evidence, missing requirements, kit or system implications, priority,
decision, and safe next action explicit for every commercially distinct Tier 0 configuration.

${markdownTable(
  [
    'Exact product/configuration',
    'Explicit official evidence',
    'Missing evidence',
    'Kit/BOM, system, and duplicate-risk notes',
    'Candidate launch priority',
    'Physician decision required',
    'Safe next action',
  ],
  detailRows,
)}
`
}

function validateReportOptions(manifest: EvidenceManifest, options: ReportOptions): void {
  if (!isStrictIsoDate(options.asOfDate)) {
    throw new Error(`--as-of-date must be a real YYYY-MM-DD date; received ${options.asOfDate}.`)
  }
  if (options.asOfDate < manifest.researchCutoffDate) {
    throw new Error('--as-of-date cannot be before the manifest researchCutoffDate.')
  }
  if (!Number.isSafeInteger(options.staleAfterDays) || options.staleAfterDays < 1) {
    throw new Error('--stale-after-days must be a positive integer.')
  }
}

export function generateReports(
  input: unknown,
  options: ReportOptions,
): ReadonlyMap<(typeof GENERATED_REPORT_FILENAMES)[number], string> {
  const validation = validateEvidenceManifest(input)
  if (!validation.ok) {
    const details = validation.issues
      .map((issue) => `- ${issue.code} ${issue.path}: ${issue.message}`)
      .join('\n')
    throw new Error(`Evidence manifest validation failed:\n${details}`)
  }
  const manifest = validation.manifest
  validateReportOptions(manifest, options)
  const reportEntries = [
    ['evidence-conflicts.md', evidenceConflictsReport(manifest, options)],
    ['launch-blocker-matrix.md', launchBlockerReport(manifest, options)],
    ['owner-supplied-missing-products.md', ownerProductReport(manifest, options)],
    ['physician-adjudication-queue.md', physicianQueueReport(manifest, options)],
    ['source-coverage-report.md', sourceCoverageReport(manifest, options)],
  ] as const
  return new Map(reportEntries.map(([filename, content]) => [filename, `${content.trimEnd()}\n`]))
}

export async function writeReports(
  outputDirectory: string,
  reports: ReadonlyMap<string, string>,
): Promise<void> {
  await mkdir(outputDirectory, { recursive: true })
  for (const [filename, content] of [...reports.entries()].sort(([a], [b]) =>
    compareCodePoints(a, b),
  )) {
    await writeFile(path.join(outputDirectory, filename), content, 'utf8')
  }
}

interface CliArguments {
  manifestPath: string
  outputDirectory: string
  options: ReportOptions
}

function parseCliArguments(argv: string[]): CliArguments {
  const values = new Map<string, string>()
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (!flag?.startsWith('--') || !value || value.startsWith('--')) {
      throw new Error(
        'Usage: npx tsx generate-reports.ts --manifest <file> --output-dir <dir> --as-of-date YYYY-MM-DD [--stale-after-days 365]',
      )
    }
    if (values.has(flag)) throw new Error(`Duplicate argument: ${flag}`)
    values.set(flag, value)
  }
  const allowed = new Set(['--manifest', '--output-dir', '--as-of-date', '--stale-after-days'])
  for (const flag of values.keys()) {
    if (!allowed.has(flag)) throw new Error(`Unknown argument: ${flag}`)
  }
  const manifestPath = values.get('--manifest')
  const outputDirectory = values.get('--output-dir')
  const asOfDate = values.get('--as-of-date')
  if (!manifestPath || !outputDirectory || !asOfDate) {
    throw new Error('--manifest, --output-dir, and --as-of-date are required.')
  }
  const staleAfterDaysText = values.get('--stale-after-days') ?? '365'
  if (!/^[0-9]+$/.test(staleAfterDaysText)) {
    throw new Error('--stale-after-days must be a positive integer.')
  }
  return {
    manifestPath,
    outputDirectory,
    options: { asOfDate, staleAfterDays: Number(staleAfterDaysText) },
  }
}

async function main(): Promise<void> {
  const args = parseCliArguments(process.argv.slice(2))
  const manifest = await loadAndValidateEvidenceManifest(args.manifestPath)
  const reports = generateReports(manifest, args.options)
  await writeReports(args.outputDirectory, reports)
  process.stdout.write(
    `${warningBlock()}\n\nWrote ${reports.size} deterministic reports to ${args.outputDirectory}.\n`,
  )
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : ''
if (import.meta.url === invokedPath) {
  main().catch((error: unknown) => {
    process.stderr.write(`${(error as Error).message}\n`)
    process.exitCode = 1
  })
}
