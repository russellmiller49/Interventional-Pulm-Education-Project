import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CLAIM_TYPES,
  compareCodePoints,
  EVIDENCE_MANIFEST_SCHEMA_VERSION,
  NON_GOVERNED_WARNINGS,
  SOURCE_TYPES,
  type ClaimType,
  type EvidenceManifest,
  type SourceType,
  validateEvidenceManifest,
} from '../evidence-manifest'
import evidenceManifestJsonSchema from '../evidence-manifest.schema.v1.json'
import { GENERATED_REPORT_FILENAMES, generateReports } from '../generate-reports'

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_PATH = path.resolve(TEST_DIRECTORY, '../fixtures/minimal-valid-manifest.json')
const PRODUCTION_MANIFEST_PATH = path.resolve(
  TEST_DIRECTORY,
  '../../../../docs/ip-device-intelligence/production-readiness/device-use-evidence-manifest.json',
)

const EXPECTED_TIER_0_IDENTITIES = [
  '101/540/070',
  '101/540/080',
  '101/540/090',
  '101/541/070',
  '101/541/080',
  '101/541/090',
  '101/543/070',
  '101/543/080',
  '101/543/090',
  '101/561/070',
  '101/561/080',
  '101/561/090',
  '101/562/000',
  '101/563/070',
  '101/563/080',
  '101/563/090',
  '101/573/000',
  '101/595/070',
  '101/595/080',
  '101/595/090',
  '101/596/070',
  '101/596/080',
  '101/596/090',
  '101/891/070',
  '101/891/080',
  '101/891/090',
  '101/892/070',
  '101/892/080',
  '101/892/090',
  '101/893/070',
  '101/893/080',
  '101/893/090',
  '1884033HRE',
  '1884035HRE',
  '1899200',
] as const

let fixture: EvidenceManifest
let productionManifest: EvidenceManifest

function cloneFixture(): EvidenceManifest {
  return cloneJson(fixture)
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function issueCodes(input: unknown): string[] {
  const result = validateEvidenceManifest(input)
  return result.ok ? [] : result.issues.map((issue) => issue.code)
}

beforeAll(async () => {
  fixture = JSON.parse(await readFile(FIXTURE_PATH, 'utf8')) as EvidenceManifest
  productionManifest = JSON.parse(
    await readFile(PRODUCTION_MANIFEST_PATH, 'utf8'),
  ) as EvidenceManifest
})

describe('versioned non-governed evidence manifest', () => {
  it('validates the self-contained fixture and pins the warning/version contract', () => {
    const result = validateEvidenceManifest(cloneFixture())
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Fixture unexpectedly failed validation.')
    expect(result.manifest.schemaVersion).toBe(EVIDENCE_MANIFEST_SCHEMA_VERSION)
    expect(result.manifest.warnings).toEqual(NON_GOVERNED_WARNINGS)
  })

  it('validates the production manifest and pins the exact 35-target Tier 0 identity set', () => {
    const validation = validateEvidenceManifest(productionManifest)
    expect(validation.ok).toBe(true)
    if (!validation.ok) throw new Error('Production manifest unexpectedly failed validation.')

    const identitiesByTarget = new Map<string, Set<string>>()
    for (const candidate of validation.manifest.candidates) {
      if (candidate.researchTier !== 'TIER_0') continue
      const identity = candidate.productIdentity?.model
      expect(identity).toBeTruthy()
      const targetIdentities =
        identitiesByTarget.get(candidate.coverageTargetId) ?? new Set<string>()
      targetIdentities.add(identity as string)
      identitiesByTarget.set(candidate.coverageTargetId, targetIdentities)
    }

    expect(identitiesByTarget.size).toBe(35)
    expect([...identitiesByTarget.values()].every((identities) => identities.size === 1)).toBe(true)
    const exactIdentities = [...identitiesByTarget.values()]
      .map((identities) => [...identities][0])
      .sort(compareCodePoints)
    expect(exactIdentities).toEqual([...EXPECTED_TIER_0_IDENTITIES].sort(compareCodePoints))
  })

  it('keeps the JSON Schema claim/source enums aligned with the executable validator', () => {
    expect(evidenceManifestJsonSchema.$defs.claimType.enum).toEqual(CLAIM_TYPES)
    expect(evidenceManifestJsonSchema.$defs.source.properties.sourceType.enum).toEqual(SOURCE_TYPES)
  })

  it('rejects unsupported and prohibited evidence/claim types', () => {
    const unsupportedSource = cloneFixture()
    unsupportedSource.candidates[0].source.sourceType = 'RESELLER' as SourceType
    expect(issueCodes(unsupportedSource)).toContain('SCHEMA_ENUM')

    for (const prohibited of ['EQUIVALENCE', 'SUBSTITUTION', 'INSTITUTIONAL_AVAILABILITY']) {
      const manifest = cloneFixture()
      manifest.candidates[0].claimType = prohibited as ClaimType
      expect(issueCodes(manifest)).toContain('PROHIBITED_CLAIM_TYPE')
    }

    const disguisedEquivalence = cloneFixture()
    disguisedEquivalence.candidates[0].claimType = 'DIMENSION'
    disguisedEquivalence.candidates[0].proposedClaim =
      'This model is equivalent to another catalog model.'
    expect(issueCodes(disguisedEquivalence)).toContain('PROHIBITED_CLAIM_ASSERTION')
  })

  it('scans every researcher-authored semantic field for prohibited assertions', () => {
    const semanticFieldMutators: Array<(manifest: EvidenceManifest) => void> = [
      (manifest) => {
        manifest.candidates[0].proposedClaim = 'This asserts hospital formulary status.'
      },
      (manifest) => {
        manifest.candidates[0].physicianAdjudication.question =
          'This asserts hospital formulary status.'
      },
      (manifest) => {
        manifest.candidates[0].physicianAdjudication.currentRepositoryState =
          'This asserts hospital formulary status.'
      },
      (manifest) => {
        manifest.candidates[0].physicianAdjudication.proposedState =
          'This asserts hospital formulary status.'
      },
      (manifest) => {
        manifest.candidates[0].physicianAdjudication.evidenceSummary =
          'This asserts hospital formulary status.'
      },
      (manifest) => {
        manifest.candidates[0].physicianAdjudication.conflictingEvidence =
          'This asserts hospital formulary status.'
      },
      (manifest) => {
        manifest.candidates[0].physicianAdjudication.researcherRecommendation =
          'This asserts hospital formulary status.'
      },
      (manifest) => {
        manifest.candidates[0].physicianAdjudication.uncertainty =
          'This asserts hospital formulary status.'
      },
      (manifest) => {
        manifest.candidates[0].physicianAdjudication.consequenceOfYes =
          'This asserts hospital formulary status.'
      },
      (manifest) => {
        manifest.candidates[0].physicianAdjudication.consequenceOfNo =
          'This asserts hospital formulary status.'
      },
      (manifest) => {
        manifest.candidates[0].readiness.rationale = 'This asserts hospital formulary status.'
      },
      (manifest) => {
        manifest.candidates[0].readiness.affectedRouteOrSurface =
          'This asserts hospital formulary status.'
      },
      (manifest) => {
        manifest.candidates[0].readiness.ownerActionRequired =
          'This asserts hospital formulary status.'
      },
      (manifest) => {
        manifest.candidates[0].readiness.implementationActionRequired =
          'This asserts hospital formulary status.'
      },
      (manifest) => {
        manifest.candidates[0].researcherNotes = 'This asserts hospital formulary status.'
      },
    ]

    for (const mutate of semanticFieldMutators) {
      const manifest = cloneFixture()
      mutate(manifest)
      expect(issueCodes(manifest)).toContain('PROHIBITED_CLAIM_ASSERTION')
    }
  })

  it('rejects a missing locator and omitted nullable revision/date fields', () => {
    const missingLocator = cloneFixture()
    Reflect.deleteProperty(missingLocator.candidates[0].source, 'locator')
    expect(issueCodes(missingLocator)).toContain('SCHEMA_REQUIRED')

    const missingDocumentDate = cloneFixture()
    Reflect.deleteProperty(missingDocumentDate.candidates[0].source, 'documentDate')
    expect(issueCodes(missingDocumentDate)).toContain('SCHEMA_REQUIRED')
  })

  it('rejects malformed URLs and impossible calendar dates', () => {
    const malformedUrl = cloneFixture()
    malformedUrl.candidates[0].source.url = 'not a URL'
    expect(issueCodes(malformedUrl)).toContain('MALFORMED_URL')

    const malformedDate = cloneFixture()
    malformedDate.candidates[0].source.accessDate = '2026-02-31'
    expect(issueCodes(malformedDate)).toContain('MALFORMED_DATE')
  })

  it('rejects duplicate candidate ids', () => {
    const manifest = cloneFixture()
    const duplicate = cloneJson(manifest.candidates[0])
    duplicate.physicianAdjudication.decisionId = 'DEC-DUPLICATE-CANDIDATE-002'
    manifest.candidates.push(duplicate)
    expect(issueCodes(manifest)).toContain('DUPLICATE_CANDIDATE_ID')
  })

  it('rejects model claims backed by unqualified family sources', () => {
    const manifest = cloneFixture()
    manifest.candidates[0].source.scopeLevel = 'FAMILY'
    manifest.candidates[0].source.exactModelOrOrderCodes = []
    expect(issueCodes(manifest)).toContain('UNQUALIFIED_FAMILY_SOURCE_FOR_MODEL_CLAIM')
  })

  it('requires exact identity qualification for supported model claims at every source scope', () => {
    const manifest = cloneFixture()
    manifest.candidates[0].source.scopeLevel = 'MODEL'
    manifest.candidates[0].source.exactModelOrOrderCodes = []
    expect(issueCodes(manifest)).toContain('UNQUALIFIED_SOURCE_FOR_EXACT_IDENTITY_CLAIM')
  })

  it('requires each candidate claim type to be declared by its coverage target', () => {
    const manifest = cloneFixture()
    manifest.candidates = [manifest.candidates[0]]
    manifest.candidates[0].requiredClaimTypes = ['PLATFORM_COMPATIBILITY']
    expect(issueCodes(manifest)).toContain('CLAIM_TYPE_NOT_REQUIRED_FOR_TARGET')
  })

  it('rejects compatibility assertions without accessible explicit Tier A/B evidence', () => {
    const manifest = cloneFixture()
    const candidate = manifest.candidates[1]
    candidate.claimOutcome = 'AFFIRMED'
    candidate.evidenceStatus = 'SUPPORTED'
    candidate.source.sourceType = 'MANUFACTURER_PRODUCT_PAGE'
    candidate.source.evidenceTier = 'TIER_C'
    candidate.source.evidenceBasis = 'MANUFACTURER_WEB'
    candidate.source.scopeLevel = 'MODEL'
    candidate.source.exactModelOrOrderCodes = ['1899200']
    candidate.source.explicitCompatibilitySupport = false
    expect(issueCodes(manifest)).toContain('COMPATIBILITY_WITHOUT_EXPLICIT_PRIMARY_EVIDENCE')
  })

  it('permits an explicitly unresolved compatibility gap without turning it into a claim', () => {
    const result = validateEvidenceManifest(cloneFixture())
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Fixture unexpectedly failed validation.')
    const compatibilityGap = result.manifest.candidates[1]
    expect(compatibilityGap.claimOutcome).toBe('UNRESOLVED')
    expect(compatibilityGap.evidenceStatus).toBe('PRIMARY_SOURCE_NOT_LOCATED')
    expect(compatibilityGap.source.explicitCompatibilitySupport).toBe(false)
  })

  it('rejects final/adopted states without physician review', () => {
    const finalWithoutReview = cloneFixture()
    finalWithoutReview.candidates[0].candidateState = 'FINAL_ACCEPTED'
    expect(issueCodes(finalWithoutReview)).toContain('FINAL_STATE_WITHOUT_PHYSICIAN_APPROVAL')

    const adopted = cloneFixture()
    adopted.candidates[0].candidateState =
      'ADOPTED' as EvidenceManifest['candidates'][number]['candidateState']
    expect(issueCodes(adopted)).toContain('ADOPTED_STATE_FORBIDDEN')
  })

  it('rejects contradictory final physician dispositions for the same claim key', () => {
    const manifest = cloneFixture()
    const accepted = manifest.candidates[0]
    accepted.candidateState = 'FINAL_ACCEPTED'
    accepted.physicianAdjudication.status = 'APPROVED'
    accepted.physicianAdjudication.reviewedBy = 'Fixture physician A'
    accepted.physicianAdjudication.decisionDate = '2026-08-10'

    const rejected = cloneJson(accepted)
    rejected.candidateId = 'EVID-M5-INTENDED-USE-REJECTED-002'
    rejected.candidateState = 'FINAL_REJECTED'
    rejected.physicianAdjudication.decisionId = 'DEC-M5-ROLE-REJECTED-002'
    rejected.physicianAdjudication.status = 'REJECTED'
    rejected.physicianAdjudication.reviewedBy = 'Fixture physician B'
    manifest.candidates.push(rejected)

    expect(issueCodes(manifest)).toContain('CONTRADICTORY_FINAL_STATES')
  })

  it('requires nonfinal divergent evidence to declare reciprocal conflicts', () => {
    const manifest = cloneFixture()
    manifest.candidates = [manifest.candidates[0]]
    const left = manifest.candidates[0]
    const right = cloneJson(left)
    right.candidateId = 'EVID-M5-INTENDED-USE-DIVERGENT-002'
    right.physicianAdjudication.decisionId = 'DEC-M5-ROLE-DIVERGENT-002'
    right.proposedClaim = 'The official page describes a different bounded use statement.'
    manifest.candidates.push(right)

    expect(issueCodes(manifest)).toEqual(
      expect.arrayContaining(['UNDECLARED_DIVERGENT_EVIDENCE', 'NONRECIPROCAL_DIVERGENT_CONFLICT']),
    )

    left.conflictStatus = 'POTENTIAL'
    left.conflictingCandidateIds = [right.candidateId]
    right.conflictStatus = 'POTENTIAL'
    right.conflictingCandidateIds = [left.candidateId]
    expect(validateEvidenceManifest(manifest).ok).toBe(true)
  })

  it('uses locale-independent Unicode code-point ordering', () => {
    expect(['ä', 'z', 'a', '😀', '𐀀'].sort(compareCodePoints)).toEqual(['a', 'z', 'ä', '𐀀', '😀'])
  })
})

describe('deterministic production-readiness reports', () => {
  const options = { asOfDate: '2026-08-10', staleAfterDays: 365 }

  it('generates every required report with prominent non-governed warnings', () => {
    const reports = generateReports(cloneFixture(), options)
    expect([...reports.keys()].sort()).toEqual([...GENERATED_REPORT_FILENAMES].sort())
    for (const content of reports.values()) {
      for (const warning of NON_GOVERNED_WARNINGS) {
        expect(content).toContain(`> **${warning}**`)
      }
    }
  })

  it('reports coverage dimensions, evidence gaps, source risks, blockers, owners, and queue', () => {
    const reports = generateReports(cloneFixture(), options)
    const coverage = reports.get('source-coverage-report.md') ?? ''
    expect(coverage).toContain('## Coverage by exemplar procedure')
    expect(coverage).toContain('## Coverage by role')
    expect(coverage).toContain('## Coverage by product')
    expect(coverage).toContain('## Coverage by research tier')
    expect(coverage).toContain('## Coverage by evidence tier')
    expect(coverage).toContain('## Missing intended-use evidence')
    expect(coverage).toContain('## Missing compatibility evidence')
    expect(coverage).toContain('EVID-M5-COMPAT-GAP-001: PRIMARY_SOURCE_NOT_LOCATED')
    expect(coverage).toContain('## Stale sources')
    expect(coverage).toContain('## Undated sources')
    expect(coverage).toContain('## Inaccessible or partially accessible sources')

    expect(reports.get('evidence-conflicts.md')).toContain('## Family-versus-model risks')
    expect(reports.get('physician-adjudication-queue.md')).toContain('DEC-M5-ROLE-001')
    expect(reports.get('launch-blocker-matrix.md')).toContain('HIGH')
    expect(reports.get('owner-supplied-missing-products.md')).toContain('MEDTRONIC-1899200')
  })

  it('reports partial researcher component-group crosswalks as exact-suffix risks', () => {
    const manifest = cloneFixture()
    manifest.candidates = [manifest.candidates[0]]
    const candidate = manifest.candidates[0]
    candidate.requiredClaimTypes = ['PACKAGING']
    candidate.claimType = 'PACKAGING'
    candidate.claimClassification = 'RESEARCHER_INFERENCE'
    candidate.claimScope = 'FAMILY'
    candidate.evidenceStatus = 'PARTIALLY_SUPPORTED'
    candidate.source.scopeLevel = 'FAMILY'
    candidate.source.exactModelOrOrderCodes = ['1899']

    const reports = generateReports(manifest, options)
    const expectedRisk = 'PARTIAL FAMILY-GROUP CROSSWALK — exact-suffix BOM unresolved'
    expect(reports.get('evidence-conflicts.md')).toContain(expectedRisk)
    expect(reports.get('owner-supplied-missing-products.md')).toContain(expectedRisk)
    expect(reports.get('owner-supplied-missing-products.md')).toContain(
      'NO — CLOSE LISTED GAPS FIRST',
    )
  })

  it('counts distinct source URLs and source documents separately from candidate records', () => {
    const manifest = cloneFixture()
    manifest.candidates = [manifest.candidates[0]]
    const first = manifest.candidates[0]
    first.source.documentIdentifier = 'DOC-ONE'
    const second = cloneJson(first)
    second.candidateId = 'EVID-M5-INTENDED-USE-SAME-SOURCE-002'
    second.physicianAdjudication.decisionId = 'DEC-M5-ROLE-SAME-SOURCE-002'
    const third = cloneJson(first)
    third.candidateId = 'EVID-M5-INTENDED-USE-OTHER-SOURCE-003'
    third.physicianAdjudication.decisionId = 'DEC-M5-ROLE-OTHER-SOURCE-003'
    third.source.url = 'https://www.medtronic.com/source-two'
    third.source.documentIdentifier = 'DOC-TWO'
    manifest.candidates.push(second, third)

    const coverage = generateReports(manifest, options).get('source-coverage-report.md') ?? ''
    expect(coverage).toContain('Distinct source URLs')
    expect(coverage).toContain('Distinct source documents')
    expect(coverage).toMatch(/\| TIER_0\s+\| 1\s+\| 3\s+\| 2\s+\| 2\s+\| 3\s+\| 0\s+\| 3\s+\|/)
  })

  it('uses a claim/tier matrix so contextual or weak safety sources cannot close requirements', () => {
    const tierDIntendedUse = cloneFixture()
    tierDIntendedUse.candidates = [tierDIntendedUse.candidates[0]]
    const contextualCandidate = tierDIntendedUse.candidates[0]
    contextualCandidate.requiredClaimTypes = ['INTENDED_USE']
    contextualCandidate.source.sourceType = 'PEER_REVIEWED_RESEARCH'
    contextualCandidate.source.evidenceTier = 'TIER_D'
    contextualCandidate.source.evidenceBasis = 'CONTEXTUAL'
    expect(
      generateReports(tierDIntendedUse, options).get('owner-supplied-missing-products.md'),
    ).toContain('MISSING: INTENDED_USE')

    const primaryRequiredTypes = [
      'WORKING_CHANNEL_REQUIREMENT',
      'REUSABLE_SINGLE_USE_STATUS',
      'REPROCESSING_BOUNDARY',
      'STERILE_STATUS',
      'WARNING',
      'CONTRAINDICATION',
    ] as const satisfies readonly ClaimType[]
    for (const claimType of primaryRequiredTypes) {
      const manifest = cloneFixture()
      manifest.candidates = [manifest.candidates[0]]
      const candidate = manifest.candidates[0]
      candidate.claimType = claimType
      candidate.requiredClaimTypes = [claimType]
      expect(
        generateReports(manifest, options).get('owner-supplied-missing-products.md'),
      ).toContain(`MISSING: ${claimType}`)
    }
  })

  it('allows “safe to propose” only for primary evidence in an unblocked review-ready state', () => {
    const reviewReady = cloneFixture()
    reviewReady.candidates = [reviewReady.candidates[0]]
    const candidate = reviewReady.candidates[0]
    candidate.requiredClaimTypes = ['INTENDED_USE']
    candidate.source.sourceType = 'MANUFACTURER_IFU'
    candidate.source.evidenceTier = 'TIER_A'
    candidate.source.evidenceBasis = 'PRIMARY_OFFICIAL'
    candidate.physicianAdjudication.strongestPrimarySourceUrl = candidate.source.url
    const reportFor = (manifest: EvidenceManifest): string =>
      generateReports(manifest, options).get('owner-supplied-missing-products.md') ?? ''

    expect(reportFor(reviewReady)).toContain('YES — PHYSICIAN REVIEW STILL REQUIRED')

    const highSeverity = cloneJson(reviewReady)
    highSeverity.candidates[0].readiness.severity = 'HIGH'
    expect(reportFor(highSeverity)).toContain('NO — CLOSE LISTED GAPS FIRST')

    const notReady = cloneJson(reviewReady)
    notReady.candidates[0].candidateState = 'DRAFT'
    notReady.candidates[0].physicianAdjudication.status = 'NOT_READY'
    expect(reportFor(notReady)).toContain('NO — CLOSE LISTED GAPS FIRST')

    const launchBlocking = cloneJson(reviewReady)
    launchBlocking.candidates[0].physicianAdjudication.launchBlocking = true
    expect(reportFor(launchBlocking)).toContain('NO — CLOSE LISTED GAPS FIRST')

    const contextualSupplement = cloneJson(reviewReady)
    const supplementalCandidate = cloneJson(contextualSupplement.candidates[0])
    supplementalCandidate.candidateId = 'EVID-M5-INTENDED-USE-CONTEXT-002'
    supplementalCandidate.physicianAdjudication.decisionId = 'DEC-M5-ROLE-CONTEXT-002'
    supplementalCandidate.source.sourceType = 'PEER_REVIEWED_RESEARCH'
    supplementalCandidate.source.evidenceTier = 'TIER_D'
    supplementalCandidate.source.evidenceBasis = 'CONTEXTUAL'
    contextualSupplement.candidates.push(supplementalCandidate)
    expect(reportFor(contextualSupplement)).toContain('NO — CLOSE LISTED GAPS FIRST')
  })

  it('is byte-deterministic and independent of input candidate order', () => {
    const first = generateReports(cloneFixture(), options)
    const reversed = cloneFixture()
    reversed.candidates.reverse()
    const second = generateReports(reversed, options)
    expect([...second.entries()]).toEqual([...first.entries()])
    expect([...generateReports(cloneFixture(), options).entries()]).toEqual([...first.entries()])
  })

  it('validates and reports at least the 35 exact Tier 0 configurations in sprint scope', () => {
    const manifest = cloneFixture()
    manifest.candidates = Array.from({ length: 35 }, (_, index) => {
      const candidate = cloneJson(fixture.candidates[0])
      const ordinal = String(index + 1).padStart(3, '0')
      const model = `TIER0-FIXTURE-${ordinal}`
      candidate.candidateId = `EVID-TIER0-SCALE-${ordinal}`
      candidate.claimKey = `TIER0-SCALE-INTENDED-${ordinal}`
      candidate.coverageTargetId = `OWNER-TIER0-SCALE-${ordinal}`
      candidate.requiredClaimTypes = ['INTENDED_USE']
      candidate.ownerSuppliedProductId = `OWNER-PRODUCT-${ordinal}`
      if (!candidate.productIdentity) throw new Error('Fixture product identity is required.')
      candidate.productIdentity.model = model
      candidate.productIdentity.configuration = model
      candidate.productIdentity.displayName = `Tier 0 fixture configuration ${ordinal}`
      candidate.source.exactModelOrOrderCodes = [model]
      candidate.physicianAdjudication.decisionId = `DEC-TIER0-SCALE-${ordinal}`
      return candidate
    })

    const validation = validateEvidenceManifest(manifest)
    expect(validation.ok).toBe(true)
    if (!validation.ok) throw new Error('Scale fixture unexpectedly failed validation.')
    const coverage = generateReports(validation.manifest, options).get('source-coverage-report.md')
    expect(coverage).toMatch(/\| TIER_0\s+\| 35\s+\| 35\s+\| 1\s+\| 1\s+\| 35\s+\| 0\s+\| 35\s+\|/)
  })

  it('validates manifest semantics inside programmatic report generation', () => {
    const invalid = cloneFixture()
    invalid.candidates[1].candidateId = invalid.candidates[0].candidateId
    expect(() => generateReports(invalid, options)).toThrow(
      /Evidence manifest validation failed:\n- DUPLICATE_CANDIDATE_ID/,
    )
  })

  it('requires an explicit valid report date at or after the research cutoff', () => {
    expect(() =>
      generateReports(cloneFixture(), { asOfDate: '2026-02-31', staleAfterDays: 365 }),
    ).toThrow('--as-of-date must be a real YYYY-MM-DD date')
    expect(() =>
      generateReports(cloneFixture(), { asOfDate: '2026-08-09', staleAfterDays: 365 }),
    ).toThrow('--as-of-date cannot be before')
  })
})
