import { z } from 'zod'

import { BACKLOG_COMPARISONS, OPENFDA_CLASSIFICATIONS, OPENFDA_QUERY_KINDS } from './types'

const nullableOptionalString = z.string().nullable().optional()

const optionalBooleanish = z.preprocess((value) => {
  if (value === 'true') return true
  if (value === 'false') return false
  return value
}, z.boolean().nullable().optional())

const optionalIntegerish = z.preprocess((value) => {
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
  return value
}, z.number().int().nonnegative().nullable().optional())

export const openFdaIdentifierSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().optional(),
    issuing_agency: z.string().optional(),
    unit_of_use_id: z.string().optional(),
    quantity_per_package: z.string().optional(),
    package_status: z.string().optional(),
    package_type: z.string().optional(),
  })
  .passthrough()

export const openFdaRecordSchema = z
  .object({
    record_key: nullableOptionalString,
    public_device_record_key: nullableOptionalString,
    brand_name: nullableOptionalString,
    company_name: nullableOptionalString,
    catalog_number: nullableOptionalString,
    version_or_model_number: nullableOptionalString,
    device_description: nullableOptionalString,
    device_count_in_base_package: optionalIntegerish,
    device_sizes: z.array(z.unknown()).optional(),
    identifiers: z.array(openFdaIdentifierSchema).optional(),
    commercial_distribution_status: nullableOptionalString,
    commercial_distribution_end_date: nullableOptionalString,
    is_kit: optionalBooleanish,
    is_single_use: optionalBooleanish,
    sterilization: z.unknown().nullable().optional(),
    storage: z.array(z.unknown()).optional(),
    has_expiration_date: optionalBooleanish,
    has_lot_or_batch_number: optionalBooleanish,
    has_manufacturing_date: optionalBooleanish,
    has_serial_number: optionalBooleanish,
    mri_safety: nullableOptionalString,
    product_codes: z.array(z.unknown()).optional(),
    premarket_submissions: z.array(z.unknown()).optional(),
    gmdn_terms: z.array(z.unknown()).optional(),
    publish_date: nullableOptionalString,
    public_version_date: nullableOptionalString,
    public_version_number: nullableOptionalString,
    public_version_status: nullableOptionalString,
    record_status: nullableOptionalString,
  })
  .passthrough()

export const openFdaResponseSchema = z
  .object({
    meta: z.record(z.string(), z.unknown()).optional(),
    results: z.array(openFdaRecordSchema),
  })
  .passthrough()

export const openFdaManifestPartitionSchema = z
  .object({
    display_name: z.string().min(1),
    file: z.string().url(),
    size_mb: z.union([z.string(), z.number()]).optional(),
    records: z.number().int().nonnegative().optional(),
  })
  .passthrough()

export const openFdaManifestDatasetSchema = z
  .object({
    export_date: z.string().min(1),
    partitions: z.array(openFdaManifestPartitionSchema),
    total_records: z.number().int().nonnegative().optional(),
  })
  .passthrough()

export const openFdaDownloadManifestSchema = z
  .object({
    meta: z.record(z.string(), z.unknown()).optional(),
    results: z
      .object({
        device: z
          .object({
            udi: openFdaManifestDatasetSchema,
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough()

export const openFdaCacheEntrySchema = z
  .object({
    format_version: z.literal(1),
    api_schema_version: z.string().min(1),
    retrieved_at: z.string().datetime(),
    request_search: z.string(),
    limit: z.number().int().min(1).max(100),
    http_status: z.number().int(),
    attempt_count: z.number().int().min(1),
    response_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    response: openFdaResponseSchema,
  })
  .strict()

export const openFdaQueryAttemptSummarySchema = z
  .object({
    kind: z.enum(OPENFDA_QUERY_KINDS),
    search: z.string(),
    limit: z.number().int().min(1).max(100),
    result_count: z.number().int().nonnegative(),
    raw_result_count: z.number().int().nonnegative().optional(),
    cache_hit: z.boolean(),
    http_status: z.number().int().nullable(),
    attempt_count: z.number().int().nonnegative(),
    error: z.string().nullable(),
  })
  .strict()

export const openFdaIdentifierProposalSchema = z
  .object({
    id: z.string(),
    type: z.string().nullable(),
    issuing_agency: z.string().nullable(),
    unit_of_use_id: z.string().nullable(),
    package_status: z.string().nullable(),
    package_type: z.string().nullable(),
  })
  .strict()

export const openFdaCandidateSummarySchema = z
  .object({
    record_key: z.string().nullable(),
    public_device_record_key: z.string().nullable(),
    primary_di: z.string().nullable(),
    brand_name: z.string().nullable(),
    company_name: z.string().nullable(),
    catalog_number: z.string().nullable(),
    version_or_model_number: z.string().nullable(),
    commercial_distribution_status: z.string().nullable(),
    public_version_date: z.string().nullable(),
    record_status: z.string().nullable(),
    query_kinds: z.array(z.enum(OPENFDA_QUERY_KINDS)),
  })
  .strict()

export const openFdaProposedFieldsSchema = z
  .object({
    primary_di: z.string().nullable(),
    additional_identifiers: z.array(openFdaIdentifierProposalSchema),
    brand_name: z.string().nullable(),
    company_name: z.string().nullable(),
    version_or_model_number: z.string().nullable(),
    device_description: z.string().nullable(),
    device_count_in_base_package: z.number().int().nonnegative().nullable(),
    device_sizes: z.array(z.unknown()),
    commercial_distribution_status: z.string().nullable(),
    commercial_distribution_end_date: z.string().nullable(),
    is_kit: z.boolean().nullable(),
    is_single_use: z.boolean().nullable(),
    sterilization: z.union([
      z.null(),
      z.boolean(),
      z.number(),
      z.string(),
      z.array(z.unknown()),
      z.record(z.string(), z.unknown()),
    ]),
    storage: z.array(z.unknown()),
    product_codes: z.array(z.unknown()),
    premarket_submissions: z.array(z.unknown()),
    public_version_date: z.string().nullable(),
    record_status: z.string().nullable(),
  })
  .strict()

export const openFdaEnrichmentProposalSchema = z
  .object({
    format_version: z.literal(1),
    product_id: z.string().min(1),
    manufacturer: z.string().nullable(),
    product_name: z.string().min(1),
    catalog_number: z.string().nullable(),
    classification: z.enum(OPENFDA_CLASSIFICATIONS),
    reason_codes: z.array(z.string()),
    query_attempts: z.array(openFdaQueryAttemptSummarySchema),
    candidate_count: z.number().int().nonnegative(),
    selected_candidate: openFdaCandidateSummarySchema.nullable(),
    proposed_fields: openFdaProposedFieldsSchema,
    backlog_comparison: z.enum(BACKLOG_COMPARISONS),
    retrieved_at: z.string().datetime().nullable(),
    raw_cache_reference: z.string().nullable(),
    decision: z.literal('pending_review'),
  })
  .strict()

export const openFdaEnrichmentProposalsSchema = z.array(openFdaEnrichmentProposalSchema)

export const openFdaRunSummarySchema = z
  .object({
    format_version: z.literal(1),
    catalog_input_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    catalog_product_count: z.number().int().nonnegative(),
    products_requested: z.number().int().nonnegative(),
    products_processed: z.number().int().nonnegative(),
    products_served_from_cache: z.number().int().nonnegative(),
    api_requests_made: z.number().int().nonnegative(),
    retry_count: z.number().int().nonnegative(),
    high_confidence_count: z.number().int().nonnegative(),
    review_required_count: z.number().int().nonnegative(),
    unmatched_count: z.number().int().nonnegative(),
    insufficient_identifier_count: z.number().int().nonnegative(),
    query_error_count: z.number().int().nonnegative(),
    existing_backlog_conflicts: z.number().int().nonnegative(),
    started_at: z.string().datetime(),
    completed_at: z.string().datetime(),
    openfda_endpoint: z.string().url(),
    api_key_used: z.boolean(),
  })
  .strict()

export const openFdaManifestSnapshotSchema = z
  .object({
    format_version: z.literal(1),
    retrieved_at: z.string().datetime(),
    export_date: z.string().min(1),
    total_records: z.number().int().nonnegative().nullable(),
    partition_count: z.number().int().nonnegative(),
    total_size_mb: z.number().nonnegative().nullable(),
    partitions: z.array(
      z
        .object({
          index: z.number().int().positive(),
          display_name: z.string().min(1),
          file: z.string().url(),
          size_mb: z.number().nonnegative().nullable(),
          records: z.number().int().nonnegative().nullable(),
        })
        .strict(),
    ),
  })
  .strict()
