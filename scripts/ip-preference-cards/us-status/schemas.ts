import { z } from 'zod'

import {
  ARTIFACT_FRESHNESS_VALUES,
  COHORT_PARTITIONS,
  GUDID_DISTRIBUTION_EVIDENCE_VALUES,
  GUDID_IDENTITY_EVIDENCE_VALUES,
  IDENTIFIER_COMPLETENESS_VALUES,
} from './types'

const nullableString = z.string().nullable()
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)

export const cohortCatalogProductSchema = z
  .object({
    product_id: z.string().min(1),
    manufacturer_id: z.string().min(1),
    manufacturer: nullableString,
    product_name: z.string().min(1),
    catalog_number: nullableString,
    alternate_ids: nullableString,
    gtin: nullableString,
    global_part_number: nullableString,
    reference_part_number: nullableString,
    spec_json: z.record(z.string(), z.unknown()).nullable().optional(),
    verification_grade: z.enum(['verified_source', 'candidate', 'unknown']),
    visibility_state: z.enum(['prototype_visible', 'hidden']),
  })
  .passthrough()

export const cohortProductRoleSchema = z
  .object({
    product_id: z.string().min(1),
    role_code: z.string().min(1),
    role_fit: nullableString,
  })
  .passthrough()

export const cohortProcedureSlotSchema = z
  .object({
    slot_id: z.string().min(1),
    procedure_code: z.string().min(1),
    role_code: z.string().min(1),
  })
  .passthrough()

export const cohortSlotProductOptionSchema = z
  .object({
    slot_id: z.string().min(1),
    product_id: z.string().min(1),
    role_code: z.string().min(1),
    selectable: z.boolean(),
  })
  .passthrough()

export const cohortProductSourceSchema = z
  .object({
    product_id: z.string().min(1),
    source_id: z.string().min(1),
  })
  .passthrough()

export const cohortGudidConfirmationSchema = z
  .object({
    product_id: z.string().min(1),
    match_strength: z.enum(['manufacturer_and_catalog_number', 'catalog_number_only']),
    gudid_primary_di: z.string().min(1),
    gudid_distribution_status: z.string(),
  })
  .passthrough()

export const cohortGudidReportSchema = z
  .object({
    catalog_products: z.number().int().nonnegative(),
    confirmations: z.array(cohortGudidConfirmationSchema),
  })
  .passthrough()

const openFdaClassificationSchema = z.enum([
  'high_confidence_candidate',
  'review_required',
  'unmatched',
  'insufficient_identifiers',
  'query_error',
])

export const cohortOpenFdaProposalSchema = z
  .object({
    product_id: z.string().min(1),
    classification: openFdaClassificationSchema,
    reason_codes: z.array(z.string()),
    selected_candidate: z
      .object({
        primary_di: nullableString,
        catalog_number: nullableString,
        version_or_model_number: nullableString,
        commercial_distribution_status: nullableString,
      })
      .passthrough()
      .nullable(),
    backlog_comparison: z.string(),
  })
  .passthrough()

export const cohortOpenFdaRunSummarySchema = z
  .object({
    catalog_input_sha256: sha256Schema,
    catalog_product_count: z.number().int().nonnegative(),
    products_processed: z.number().int().nonnegative(),
  })
  .passthrough()

export const cohortInputHashesSchema = z
  .object({
    catalog_products_sha256: sha256Schema,
    product_roles_sha256: sha256Schema,
    procedure_slots_sha256: sha256Schema,
    slot_product_options_sha256: sha256Schema,
    product_sources_sha256: sha256Schema,
    gudid_confirmations_sha256: sha256Schema,
    openfda_proposals_sha256: sha256Schema,
    openfda_run_summary_sha256: sha256Schema,
  })
  .strict()

const mappedRoleSchema = z
  .object({
    role_code: z.string().min(1),
    role_fit: nullableString,
  })
  .strict()

const artifactFreshnessSchema = z.enum(ARTIFACT_FRESHNESS_VALUES)

const gudidContextSchema = z
  .object({
    artifact_freshness: artifactFreshnessSchema,
    confirmation_count: z.number().int().nonnegative(),
    strong_match_count: z.number().int().nonnegative(),
    weak_match_count: z.number().int().nonnegative(),
    identity_evidence: z.enum(GUDID_IDENTITY_EVIDENCE_VALUES),
    distribution_evidence: z.enum(GUDID_DISTRIBUTION_EVIDENCE_VALUES),
    primary_dis: z.array(z.string()),
    distribution_statuses: z.array(z.string()),
  })
  .strict()

const openFdaContextSchema = z
  .object({
    artifact_freshness: artifactFreshnessSchema,
    proposal_present: z.boolean(),
    classification: openFdaClassificationSchema.nullable(),
    reason_codes: z.array(z.string()),
    candidate_primary_di: nullableString,
    candidate_catalog_number: nullableString,
    candidate_model_number: nullableString,
    commercial_distribution_status: nullableString,
    backlog_comparison: nullableString,
  })
  .strict()

const identifierCountsSchema = z
  .object({
    exact_di: z.number().int().nonnegative(),
    catalog_number: z.number().int().nonnegative(),
    model_only: z.number().int().nonnegative(),
    insufficient: z.number().int().nonnegative(),
  })
  .strict()

export const hiddenProductCohortRowSchema = z
  .object({
    product_id: z.string().min(1),
    manufacturer_id: z.string().min(1),
    manufacturer: nullableString,
    product_name: z.string().min(1),
    catalog_number: nullableString,
    model_number: nullableString,
    model_number_source: z.literal('spec_json.manufacturer_model_number').nullable(),
    gtin_di: nullableString,
    global_part_number: nullableString,
    reference_part_number: nullableString,
    alternate_ids: z.array(z.string()),
    verification_grade: z.enum(['verified_source', 'candidate', 'unknown']),
    visibility_state: z.literal('hidden'),
    cohort_partition: z.enum(COHORT_PARTITIONS),
    identifier_completeness: z.enum(IDENTIFIER_COMPLETENESS_VALUES),
    mapped_roles: z.array(mappedRoleSchema),
    authored_slot_use_count: z.number().int().nonnegative(),
    selectable_slot_use_count: z.number().int().nonnegative(),
    authored_slot_ids: z.array(z.string()),
    authored_procedure_codes: z.array(z.string()),
    role_mapped_procedure_codes: z.array(z.string()),
    device_intelligence_exemplar_flags: z
      .object({
        CHEST_TUBE: z.boolean(),
        EBUS_TBNA: z.boolean(),
        THERAPEUTIC_BRONCH: z.boolean(),
      })
      .strict(),
    source_ids: z.array(z.string()),
    source_count: z.number().int().nonnegative(),
    existing_gudid: gudidContextSchema,
    existing_openfda: openFdaContextSchema,
    canonical_change_applied: z.literal(false),
  })
  .strict()

export const hiddenProductCohortManifestSchema = z
  .object({
    format_version: z.literal(1),
    generated_by: z.literal('scripts/ip-preference-cards/us-status/build-cohort-manifest.ts'),
    git_sha: z.string().regex(/^[a-f0-9]{40,64}$/),
    canonical_change_applied: z.literal(false),
    cohort_definition: z
      .object({
        included_visibility_state: z.literal('hidden'),
        us_status_pending_predicate: z.literal(
          'visibility_state === "hidden" && verification_grade === "verified_source"',
        ),
      })
      .strict(),
    input_hashes: cohortInputHashesSchema,
    evidence_artifacts: z
      .object({
        gudid: z
          .object({
            artifact_freshness: artifactFreshnessSchema,
            artifact_catalog_product_count: z.number().int().nonnegative(),
            current_catalog_product_count: z.number().int().nonnegative(),
          })
          .strict(),
        openfda: z
          .object({
            artifact_freshness: artifactFreshnessSchema,
            artifact_catalog_product_count: z.number().int().nonnegative(),
            artifact_catalog_input_sha256: sha256Schema,
            current_catalog_product_count: z.number().int().nonnegative(),
            current_catalog_input_sha256: sha256Schema,
            products_processed: z.number().int().nonnegative(),
          })
          .strict(),
      })
      .strict(),
    counts: z
      .object({
        catalog_products_total: z.number().int().nonnegative(),
        prototype_visible_products: z.number().int().nonnegative(),
        hidden_products: z.number().int().nonnegative(),
        hidden_verified_source: z.number().int().nonnegative(),
        hidden_candidate: z.number().int().nonnegative(),
        hidden_unknown: z.number().int().nonnegative(),
        identifier_completeness: identifierCountsSchema,
        mapped_role_rows: z.number().int().nonnegative(),
        authored_slot_uses: z.number().int().nonnegative(),
        selectable_slot_uses: z.number().int().nonnegative(),
        products_with_authored_slot_use: z.number().int().nonnegative(),
        products_with_selectable_slot_use: z.number().int().nonnegative(),
      })
      .strict(),
    products: z.array(hiddenProductCohortRowSchema),
  })
  .strict()

export type HiddenProductCohortManifestSchema = z.infer<typeof hiddenProductCohortManifestSchema>
