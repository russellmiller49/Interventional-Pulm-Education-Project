import { readFileSync } from 'node:fs'

import {
  CALIBRATION_CHALLENGES,
  buildCalibrationCohort,
  calibrationCohortSchema,
  selectCalibrationProducts,
} from '../build-calibration-cohort'
import { hiddenProductCohortManifestSchema } from '../schemas'

const MANIFEST_PATH = 'data/ip-preference-cards/research/us-status/2026-08-13/cohort-manifest.json'
const CALIBRATION_ARTIFACT_PATH =
  'data/ip-preference-cards/research/us-status/2026-08-13/calibration-cohort.json'
const CATALOG_PATH = 'data/ip-preference-cards/generated/catalog-products.json'
const BACKLOG_PATH = 'data/ip-preference-cards/generated/verification-backlog.json'

type SelectorArguments = Parameters<typeof selectCalibrationProducts>
type Selection = ReturnType<typeof selectCalibrationProducts>
type Challenge = (typeof CALIBRATION_CHALLENGES)[number]

const REQUIRED_CHALLENGE_COUNTS = {
  exact_di_candidate: 5,
  exact_manufacturer_catalog_candidate: 5,
  manufacturer_model_candidate: 3,
  reviewed_manufacturer_alias: 4,
  multiple_package_configurations: 4,
  conflicting_distribution_states: 4,
  legacy_product: 4,
  capital_equipment: 4,
  disposable_device: 4,
  premarket_exempt_candidate: 4,
  discontinued_candidate: 4,
  no_udi_candidate: 4,
  candidate_or_unknown_verification_grade: 6,
  adjacent_sku_trap: 4,
  broad_line_manufacturer: 4,
  device_intelligence_exemplar: 8,
  noncommercial_or_local_candidate: 1,
} satisfies Record<Challenge, number>

function readJson(filename: string): unknown {
  return JSON.parse(readFileSync(filename, 'utf8')) as unknown
}

function challengeCounts(selection: Selection): Record<Challenge, number> {
  return Object.fromEntries(
    CALIBRATION_CHALLENGES.map((challenge) => [
      challenge,
      selection.filter(({ tags }) => tags.includes(challenge)).length,
    ]),
  ) as Record<Challenge, number>
}

function selectionSignature(selection: Selection) {
  return selection.map(({ product, rank, tags }) => ({
    product_id: product.product_id,
    rank,
    tags,
  }))
}

describe('current-U.S.-status calibration cohort', () => {
  const manifest = hiddenProductCohortManifestSchema.parse(readJson(MANIFEST_PATH))
  const catalogRows = readJson(CATALOG_PATH) as SelectorArguments[1]
  const backlogRows = readJson(BACKLOG_PATH) as SelectorArguments[2]
  const artifact = calibrationCohortSchema.parse(readJson(CALIBRATION_ARTIFACT_PATH))
  const selected = selectCalibrationProducts(manifest, catalogRows, backlogRows)

  it('selects at least 50 products deterministically and returns stable product order', () => {
    const reversed = selectCalibrationProducts(
      { ...manifest, products: [...manifest.products].reverse() },
      [...catalogRows].reverse(),
      [...backlogRows].reverse(),
    )
    const productIds = selected.map(({ product }) => product.product_id)

    expect(selected.length).toBeGreaterThanOrEqual(50)
    expect(selectionSignature(reversed)).toEqual(selectionSignature(selected))
    expect(productIds).toEqual([...productIds].sort((left, right) => left.localeCompare(right)))
  })

  it('meets every required challenge quota', () => {
    const counts = challengeCounts(selected)

    for (const challenge of CALIBRATION_CHALLENGES) {
      expect(counts[challenge]).toBeGreaterThanOrEqual(REQUIRED_CHALLENGE_COUNTS[challenge])
    }
    expect(artifact.challenge_counts).toEqual(counts)
  })

  it('keeps the selection hidden-only and the strict artifact noncanonical', () => {
    expect(selected.every(({ product }) => product.visibility_state === 'hidden')).toBe(true)
    expect(selected.every(({ product }) => product.canonical_change_applied === false)).toBe(true)
    expect(artifact.canonical_change_applied).toBe(false)
    expect(artifact.products.every((product) => product.canonical_change_applied === false)).toBe(
      true,
    )
    expect(artifact.product_count).toBe(selected.length)
    expect(artifact.products).toEqual(
      selected.map(({ product, tags }) => ({
        product_id: product.product_id,
        manufacturer: product.manufacturer,
        product_name: product.product_name,
        catalog_number: product.catalog_number,
        verification_grade: product.verification_grade,
        authored_slot_use_count: product.authored_slot_use_count,
        challenge_categories: tags,
        manual_review_status: 'pending',
        manual_review_notes: '',
        canonical_change_applied: false,
      })),
    )
  })

  it('fails usefully when the input cannot satisfy the challenge quotas', () => {
    expect(() =>
      selectCalibrationProducts({ ...manifest, products: [] }, catalogRows, backlogRows),
    ).toThrow('Calibration challenge exact_di_candidate has 0 products; expected at least 5.')
  })

  it('rejects an output path outside the noncanonical research directory before file reads', async () => {
    await expect(
      buildCalibrationCohort(
        'intentionally-missing-calibration-manifest.json',
        'data/ip-preference-cards/generated/us-status/calibration-cohort.json',
      ),
    ).rejects.toThrow(
      'Calibration output must be JSON under data/ip-preference-cards/research/us-status/.',
    )
  })
})
