import type { GudidIndexEntry } from './build-gudid-index'

/**
 * The canonical addition-row factories.
 *
 * Extracted from `build-catalog-additions.ts` so a second generator can reuse them: that file
 * calls `main()` at module load and can never be a source of shared helpers. Behaviour is
 * unchanged — `buildProductRecord` is byte-for-byte the same function it has always been.
 */

export const GUDID_SOURCE_ID = 'SRC046'
export const GUDID_RELEASE_DATE = '2026-07-23'
const DEFAULT_MANUFACTURER_NAME = 'Atrium Medical (Getinge)'

export interface AdditionRecord {
  [key: string]: unknown
}

export function buildProductRecord(options: {
  productId: string
  manufacturerId: string
  manufacturerName?: string
  /** Overrides the GUDID brand name, for lines the brand alone does not distinguish. */
  brandFamily?: string | null
  /**
   * Overrides the ordering number. GUDID sometimes records a configuration-specific model
   * ("SU-1 FV652A") where the commercial catalog number is the shorter family name; the
   * GUDID value stays on `global_part_number` so nothing is lost.
   */
  catalogNumber?: string
  alternateIds?: string | null
  minWorkingChannelMm?: number | null
  workingLengthCm?: number | null
  diameterMm?: number | null
  lengthMm?: number | null
  extraSpec?: Record<string, unknown>
  productName: string
  gudid: GudidIndexEntry
  primaryCategory: string
  subcategory: string
  productKind: string
  frenchSize: number | null
  placementMethod: string | null
  material: string | null
  sizeDisplay: string | null
  adultPeds: string
  description: string
  notes: string | null
  sourceLocation: string
}): AdditionRecord {
  const { gudid } = options
  return {
    product_id: options.productId,
    manufacturer_id: options.manufacturerId,
    manufacturer: options.manufacturerName ?? DEFAULT_MANUFACTURER_NAME,
    distributor: null,
    brand_family: options.brandFamily ?? (gudid.brandName || null),
    product_name: options.productName,
    catalog_number:
      options.catalogNumber ?? (gudid.catalogNumber || gudid.versionModelNumber || null),
    alternate_ids: options.alternateIds ?? null,
    gtin: gudid.gtins[0] ?? null,
    primary_category: options.primaryCategory,
    subcategory: options.subcategory,
    product_kind: options.productKind,
    reuse_status: gudid.singleUse ? 'Single use' : null,
    sterile_status: gudid.sterile ? 'Sterile' : null,
    implantable: false,
    material: options.material,
    coverage: null,
    placement_method: options.placementMethod,
    size_display: options.sizeDisplay,
    diameter_mm: options.diameterMm ?? null,
    length_mm: options.lengthMm ?? null,
    french_size: options.frenchSize,
    gauge: null,
    working_length_cm: options.workingLengthCm ?? null,
    min_working_channel_mm: options.minWorkingChannelMm ?? null,
    delivery_system_od_mm: null,
    package_uom: 'Each',
    adult_peds: options.adultPeds,
    description: options.description,
    compatibility_text: null,
    verification_status: `Verified - FDA GUDID device record (DI ${gudid.primaryDi}) and manufacturer product page; GUDID reports "${gudid.distributionStatus}" as of ${GUDID_RELEASE_DATE}.`,
    // Discontinued models stay selectable — a card records what is in the room — but the
    // status must not claim they are still being distributed.
    live_dropdown_status: /^In Commercial Distribution$/i.test(gudid.distributionStatus)
      ? 'Visible - GUDID in commercial distribution and manufacturer-listed'
      : 'Visible - GUDID reports no longer in commercial distribution; confirm before ordering',
    primary_source_id: GUDID_SOURCE_ID,
    primary_source_location: `device.txt, PrimaryDI ${gudid.primaryDi}`,
    source_as_of: GUDID_RELEASE_DATE,
    availability_note:
      'GUDID distribution status is not by itself proof of local orderability; confirm with your supply chain.',
    notes: options.notes,
    spec_json: {
      gudid_primary_di: gudid.primaryDi,
      gudid_distribution_status: gudid.distributionStatus,
      ...(gudid.versionModelNumber ? { manufacturer_model_number: gudid.versionModelNumber } : {}),
      ...(options.extraSpec ?? {}),
    },
    global_part_number: gudid.versionModelNumber || null,
    reference_part_number: null,
    gtin_raw: gudid.gtins[0] ?? null,
    spec_json_raw: null,
    visibility_state: 'prototype_visible',
    verification_grade: 'verified_source',
  }
}
