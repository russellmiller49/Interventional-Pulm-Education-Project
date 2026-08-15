import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import {
  buildCalibrationReview,
  calibrationReviewCsv,
  parseCalibrationReviewArgs,
  validateCalibrationOutputDirectory,
  writeCalibrationReviewArtifacts,
  type CalibrationReviewInputReference,
} from '../build-calibration-review'

const temporaryRoots: string[] = []

function cohortProduct(
  productId: string,
  productName: string,
  catalogNumber: string,
  challengeCategories: string[],
) {
  return {
    product_id: productId,
    manufacturer: 'Example Medical',
    product_name: productName,
    catalog_number: catalogNumber,
    challenge_categories: challengeCategories,
    canonical_change_applied: false,
  }
}

function configuration(
  status: 'in_distribution' | 'not_in_distribution' | 'unknown',
  endDate: string | null = null,
) {
  return {
    exact_identity: true,
    commercial_distribution_status: status,
    commercial_distribution_end_date: endDate,
    package_discontinue_date: endDate,
  }
}

interface ProposalOptions {
  productId: string
  productName: string
  catalogNumber: string
  state:
    | 'current_us_distribution_supported'
    | 'not_currently_distributed_supported'
    | 'current_status_conflicted'
    | 'identity_unresolved'
    | 'insufficient_evidence'
  identityMethod:
    | 'exact_primary_di_or_gtin'
    | 'exact_manufacturer_catalog_number'
    | 'exact_manufacturer_model_number'
    | 'family_or_name_only'
    | 'none'
  udiAssessment: string
  configurations?: ReturnType<typeof configuration>[]
  manufacturerSearch?: boolean
  manufacturerFinding?: string
  exactManufacturerSource?: boolean
  currentUsSource?: boolean
  conflicts?: Partial<Record<'identity' | 'package_configuration' | 'distribution', boolean>>
  queryErrors?: unknown[]
  invariantFailure?: string | null
}

function proposalProduct({
  productId,
  productName,
  catalogNumber,
  state,
  identityMethod,
  udiAssessment,
  configurations = [],
  manufacturerSearch = true,
  manufacturerFinding = 'no_result',
  exactManufacturerSource = false,
  currentUsSource = false,
  conflicts = {},
  queryErrors = [],
  invariantFailure = null,
}: ProposalOptions) {
  return {
    canonical_identity: {
      product_id: productId,
      manufacturer: 'Example Medical',
      product_name: productName,
      catalog_number: catalogNumber,
      model_number: null,
    },
    research_state: state,
    confidence: state === 'current_status_conflicted' ? 'moderate' : 'high',
    identity_match_method: identityMethod,
    layer_results: {
      udi_distribution: {
        search_completed: true,
        snapshot_current: true,
        all_exact_configurations_retrieved: true,
        assessment: udiAssessment,
        configurations,
      },
      manufacturer: {
        search_completed: manufacturerSearch,
        finding: manufacturerFinding,
        exact_product_source_confirmed: exactManufacturerSource,
        current_us_source_confirmed: currentUsSource,
      },
      safety_action: {
        search_status: 'searched',
        action_state: 'no_exact_action_found',
        action_scope: 'unknown',
        excluded_from_distribution_assessment: true,
        records: [] as Array<{ match_scope: string }>,
      },
    },
    proposed_human_review_disposition: 'keep_hidden_insufficient_evidence',
    visibility_review_eligibility: 'not_applicable',
    safety_review_gate: { performed: false, eligibility: 'not_applicable', failures: [] },
    sources: [],
    conflicts: {
      identity: conflicts.identity ?? false,
      model: false,
      manufacturer: false,
      package_configuration: conflicts.package_configuration ?? false,
      distribution: conflicts.distribution ?? false,
      discontinuation: false,
      details: [],
    },
    invariant_audit: invariantFailure
      ? {
          performed: true,
          provisional_state: 'not_currently_distributed_supported',
          passed: false,
          failures: [invariantFailure],
        }
      : {
          performed: false,
          provisional_state: null,
          passed: null,
          failures: [],
        },
    query_error: {
      present: queryErrors.length > 0,
      errors: queryErrors,
    },
    canonical_change_applied: false,
  }
}

function syntheticInputs() {
  const cohortProducts = [
    cohortProduct('PRD-001', 'Positive, Device', 'CAT-1', ['exact_identity', 'zeta']),
    cohortProduct('PRD-002', 'Ended Device', 'CAT-2', [
      'multiple_package_configurations',
      'conflicting_distribution_states',
    ]),
    cohortProduct('PRD-003', 'Mixed Device', 'CAT-3', [
      'conflicting_distribution_states',
      'multiple_package_configurations',
    ]),
    cohortProduct('PRD-004', 'Unresolved Device', 'CAT-4', ['no_udi_candidate']),
    cohortProduct('PRD-005', 'Family Device', 'CAT-5', ['adjacent_sku_trap']),
    cohortProduct('PRD-006', 'Invariant Device', 'CAT-6', ['exact_identity']),
  ]
  const proposalProducts = [
    proposalProduct({
      productId: 'PRD-001',
      productName: 'Positive, Device',
      catalogNumber: 'CAT-1',
      state: 'current_us_distribution_supported',
      identityMethod: 'exact_manufacturer_catalog_number',
      udiAssessment: 'all_exact_configurations_active',
      configurations: [configuration('in_distribution')],
      manufacturerFinding: 'current_exact_official_us_product',
      exactManufacturerSource: true,
      currentUsSource: true,
    }),
    proposalProduct({
      productId: 'PRD-002',
      productName: 'Ended Device',
      catalogNumber: 'CAT-2',
      state: 'not_currently_distributed_supported',
      identityMethod: 'exact_manufacturer_model_number',
      udiAssessment: 'all_exact_configurations_ended',
      configurations: [
        configuration('not_in_distribution', '2025-10-01'),
        configuration('not_in_distribution', '2025-12-31'),
      ],
    }),
    proposalProduct({
      productId: 'PRD-003',
      productName: 'Mixed Device',
      catalogNumber: 'CAT-3',
      state: 'current_status_conflicted',
      identityMethod: 'exact_primary_di_or_gtin',
      udiAssessment: 'conflicting_exact_configuration_statuses',
      configurations: [
        configuration('in_distribution'),
        configuration('not_in_distribution', '2025-01-01'),
      ],
      manufacturerSearch: false,
      manufacturerFinding: 'not_searched',
      conflicts: { package_configuration: true, distribution: true },
    }),
    proposalProduct({
      productId: 'PRD-004',
      productName: 'Unresolved Device',
      catalogNumber: 'CAT-4',
      state: 'identity_unresolved',
      identityMethod: 'none',
      udiAssessment: 'no_exact_result',
      conflicts: { identity: true },
      queryErrors: [{ layer: 'udi_distribution' }],
    }),
    proposalProduct({
      productId: 'PRD-005',
      productName: 'Family Device',
      catalogNumber: 'CAT-5',
      state: 'insufficient_evidence',
      identityMethod: 'family_or_name_only',
      udiAssessment: 'no_exact_result',
      manufacturerFinding: 'family_only_current',
    }),
    proposalProduct({
      productId: 'PRD-006',
      productName: 'Invariant Device',
      catalogNumber: 'CAT-6',
      state: 'current_status_conflicted',
      identityMethod: 'exact_manufacturer_model_number',
      udiAssessment: 'all_exact_configurations_ended',
      configurations: [configuration('not_in_distribution', '2024-07-09')],
      manufacturerFinding: 'current_exact_official_us_product',
      exactManufacturerSource: true,
      currentUsSource: true,
      invariantFailure: 'active_distribution_evidence_present_for_negative',
    }),
  ]
  return {
    cohort: {
      format_version: 1,
      product_count: cohortProducts.length,
      products: cohortProducts,
      canonical_change_applied: false,
    },
    proposals: {
      format_version: 1,
      method_version: 'synthetic-v1',
      research_as_of_date: '2026-08-13',
      counts: { product_count: proposalProducts.length },
      products: proposalProducts,
      canonical_change_applied: false,
    },
  }
}

function fixedInputReferences(): CalibrationReviewInputReference[] {
  return [
    { input_id: 'calibration_cohort', path: 'synthetic/cohort.json', sha256: 'a'.repeat(64) },
    { input_id: 'status_proposals', path: 'synthetic/proposals.json', sha256: 'b'.repeat(64) },
  ]
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  )
})

describe('calibration review artifact', () => {
  it('marks every row inspected and computes classification, identity, and evidence metrics', () => {
    const inputs = syntheticInputs()
    const artifact = buildCalibrationReview(inputs.cohort, inputs.proposals, {
      input_references: fixedInputReferences(),
    })

    expect(artifact.products.map((row) => row.product_id)).toEqual([
      'PRD-001',
      'PRD-002',
      'PRD-003',
      'PRD-004',
      'PRD-005',
      'PRD-006',
    ])
    expect(
      artifact.products.every(
        (row) =>
          row.manual_review_status === 'manually_inspected' &&
          row.false_positive === false &&
          row.false_negative === false &&
          row.canonical_change_applied === false,
      ),
    ).toBe(true)
    expect(artifact.summary).toMatchObject({
      product_count: 6,
      manually_inspected_count: 6,
      supported_as_classified_count: 5,
      invariant_or_schema_error_count: 1,
      exact_identity_review: { reviewed: 4, correct: 4, accuracy: 1 },
      positive_classification_review: { denominator: 1, correct: 1, precision: 1 },
      negative_classification_review: { denominator: 1, correct: 1, precision: 1 },
      conflict_challenge_review: {
        status_conflict_state_count: 2,
        products_with_any_conflict_flag: 2,
        backlog_challenge_product_count: 2,
        live_detected: 1,
        stale_rechecked: 1,
        unresolved: 0,
      },
      identity_resolution: {
        none_count: 1,
        none_rate: 0.166667,
        family_or_name_only_count: 1,
        family_or_name_only_rate: 0.166667,
        identity_unresolved_count: 1,
        identity_unresolved_rate: 0.166667,
      },
      query_errors: { product_count: 1, error_count: 1, product_rate: 0.166667 },
      manufacturer_research: {
        search_completed_count: 5,
        search_completion_rate: 0.833333,
        successful_source_research_count: 3,
        success_rate_of_completed_searches: 0.6,
        exact_product_source_confirmed_count: 2,
        current_us_source_confirmed_count: 2,
      },
      invariant_failures: { product_count: 1, failure_count: 1 },
      false_positive_examples: [],
      false_negative_examples: [],
    })
    expect(artifact.summary.research_state_counts).toMatchObject({
      current_us_distribution_supported: 1,
      not_currently_distributed_supported: 1,
      current_status_conflicted: 2,
      identity_unresolved: 1,
      insufficient_evidence: 1,
      not_applicable_noncommercial_or_local: 0,
    })
    expect(artifact.summary.challenge_tag_counts.conflicting_distribution_states).toBe(2)
    expect(artifact.canonical_change_applied).toBe(false)
  })

  it('distinguishes a live conflict challenge from a stale all-ended backlog conflict', () => {
    const inputs = syntheticInputs()
    const artifact = buildCalibrationReview(inputs.cohort, inputs.proposals)
    const stale = artifact.products.find((row) => row.product_id === 'PRD-002')!
    const live = artifact.products.find((row) => row.product_id === 'PRD-003')!

    expect(stale.stale_conflict_challenge_rechecked).toBe(true)
    expect(stale.conflict_challenge_live_detected).toBe(false)
    expect(stale.inspection_note).toContain('2 exact configurations: 0 active, 2 ended')
    expect(stale.inspection_note).toContain('stale backlog distribution conflict rechecked')
    expect(live.stale_conflict_challenge_rechecked).toBe(false)
    expect(live.conflict_challenge_live_detected).toBe(true)
    expect(live.active_conflict_flags).toEqual(['package_configuration', 'distribution'])
  })

  it('uses null precision when a reviewed classification has no positive denominator', () => {
    const inputs = syntheticInputs()
    const negativeCohort = {
      ...inputs.cohort,
      product_count: 1,
      products: [inputs.cohort.products[1]],
    }
    const negativeProposals = {
      ...inputs.proposals,
      counts: { product_count: 1 },
      products: [inputs.proposals.products[1]],
    }
    const artifact = buildCalibrationReview(negativeCohort, negativeProposals)

    expect(artifact.summary.positive_classification_review).toEqual({
      denominator: 0,
      correct: 0,
      precision: null,
    })
    expect(artifact.summary.negative_classification_review).toEqual({
      denominator: 1,
      correct: 1,
      precision: 1,
    })
  })

  it('marks explicit invariant or cross-input schema errors without rejecting other rows', () => {
    const inputs = syntheticInputs()
    inputs.cohort.products[0] = {
      ...inputs.cohort.products[0],
      catalog_number: 'DIFFERENT-CATALOG',
    }
    const artifact = buildCalibrationReview(inputs.cohort, inputs.proposals)
    const schemaError = artifact.products.find((row) => row.product_id === 'PRD-001')!
    const invariantError = artifact.products.find((row) => row.product_id === 'PRD-006')!

    expect(schemaError.adjudication).toBe('invariant_or_schema_error')
    expect(schemaError.schema_errors).toContain('cohort_catalog_number_mismatch')
    expect(schemaError.exact_identity_correct).toBe(false)
    expect(invariantError.adjudication).toBe('invariant_or_schema_error')
    expect(invariantError.invariant_failures).toEqual([
      'active_distribution_evidence_present_for_negative',
    ])
    expect(artifact.summary.schema_errors).toMatchObject({ product_count: 1, error_count: 1 })
  })

  it('independently rejects an ordinary review disposition that skipped the safety gate', () => {
    const inputs = syntheticInputs()
    const target = inputs.proposals.products[0]
    target.proposed_human_review_disposition = 'review_for_prototype_visibility'
    target.layer_results.safety_action = {
      ...target.layer_results.safety_action,
      search_status: 'not_searched',
      action_state: 'unknown',
    }

    const artifact = buildCalibrationReview(inputs.cohort, inputs.proposals)
    const row = artifact.products.find(
      (entry) => entry.product_id === target.canonical_identity.product_id,
    )!

    expect(row.adjudication).toBe('invariant_or_schema_error')
    expect(row.schema_errors).toContain('ordinary_review_without_completed_safety_search')
    expect(row.schema_errors).toContain('ordinary_review_without_passing_safety_gate')
  })

  it('independently rejects an ordinary review disposition under an active exact safety action', () => {
    const inputs = syntheticInputs()
    const target = inputs.proposals.products[0]
    target.proposed_human_review_disposition = 'review_for_prototype_visibility'
    target.layer_results.safety_action = {
      ...target.layer_results.safety_action,
      action_state: 'active_exact_product_action',
      action_scope: 'lot_specific',
      records: [{ match_scope: 'exact_product' }],
    }

    const artifact = buildCalibrationReview(inputs.cohort, inputs.proposals)
    const row = artifact.products.find(
      (entry) => entry.product_id === target.canonical_identity.product_id,
    )!

    expect(row.schema_errors).toContain('ordinary_review_under_active_exact_safety_action')
  })

  it('is stable across input order and emits a quoted, stable CSV', () => {
    const inputs = syntheticInputs()
    const references = fixedInputReferences()
    const forward = buildCalibrationReview(inputs.cohort, inputs.proposals, {
      input_references: references,
    })
    const reversed = buildCalibrationReview(
      { ...inputs.cohort, products: [...inputs.cohort.products].reverse() },
      { ...inputs.proposals, products: [...inputs.proposals.products].reverse() },
      { input_references: [...references].reverse() },
    )

    expect(reversed).toEqual(forward)
    expect(calibrationReviewCsv(reversed)).toBe(calibrationReviewCsv(forward))
    expect(calibrationReviewCsv(forward)).toContain('PRD-001,Example Medical,"Positive, Device"')
    expect(calibrationReviewCsv(forward).split('\n')).toHaveLength(8)
  })

  it('requires complete, one-to-one cohort and proposal product sets', () => {
    const inputs = syntheticInputs()
    const incomplete = {
      ...inputs.proposals,
      counts: { product_count: inputs.proposals.products.length - 1 },
      products: inputs.proposals.products.slice(1),
    }

    expect(() => buildCalibrationReview(inputs.cohort, incomplete)).toThrow(
      'Calibration/proposal product sets differ',
    )
  })

  it('requires explicit CLI inputs and an explicit calibration output directory', () => {
    expect(() => parseCalibrationReviewArgs([])).toThrow('--cohort is required')
    expect(() =>
      parseCalibrationReviewArgs(['--cohort', 'cohort.json', '--proposals', 'proposals.json']),
    ).toThrow('--output-dir is required')
    expect(() => validateCalibrationOutputDirectory('/tmp/general-output')).toThrow(
      'noncanonical calibration directory',
    )
    expect(
      parseCalibrationReviewArgs([
        '--cohort',
        'cohort.json',
        '--proposals',
        'proposals.json',
        '--output-dir',
        '/tmp/calibration/status-50',
      ]),
    ).toMatchObject({ outputDirectory: '/tmp/calibration/status-50' })
  })

  it('writes only byte-stable JSON and CSV review artifacts from synthetic local inputs', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'calibration-review-'))
    temporaryRoots.push(root)
    const cohortPath = path.join(root, 'cohort.json')
    const proposalsPath = path.join(root, 'proposals.json')
    const outputDirectory = path.join(root, 'calibration', 'status-50')
    const inputs = syntheticInputs()
    await Promise.all([
      writeFile(cohortPath, `${JSON.stringify(inputs.cohort, null, 2)}\n`, 'utf8'),
      writeFile(proposalsPath, `${JSON.stringify(inputs.proposals, null, 2)}\n`, 'utf8'),
    ])

    await writeCalibrationReviewArtifacts({ cohortPath, proposalsPath, outputDirectory })
    const firstJson = await readFile(path.join(outputDirectory, 'calibration-review.json'))
    const firstCsv = await readFile(path.join(outputDirectory, 'calibration-review.csv'))
    await writeCalibrationReviewArtifacts({ cohortPath, proposalsPath, outputDirectory })

    expect(
      (await readFile(path.join(outputDirectory, 'calibration-review.json'))).equals(firstJson),
    ).toBe(true)
    expect(
      (await readFile(path.join(outputDirectory, 'calibration-review.csv'))).equals(firstCsv),
    ).toBe(true)
    expect(await readdir(outputDirectory)).toEqual([
      'calibration-review.csv',
      'calibration-review.json',
    ])
    const parsed = JSON.parse(firstJson.toString('utf8')) as { canonical_change_applied: boolean }
    expect(parsed.canonical_change_applied).toBe(false)
  })
})
