export const ENGINE_VERSION = 'literature-production-ingest/1.0.0' as const
export const MAPPING_VERSION = 'literature-bibliographic-transfer/1.0.0' as const
/**
 * Bumped to 1.1.0 when the finalization envelope became part of the durable record.
 *
 * A resumed finalization must reuse the exact request body it already persisted, so the body and
 * its checksum now live in the checkpoint. A 1.0.0 checkpoint has no envelope and cannot prove what
 * it sent, so it is refused rather than resumed under a regenerated timestamp.
 */
export const CHECKPOINT_SCHEMA_VERSION = 'literature-production-ingest-checkpoint/1.1.0' as const
/**
 * Bumped to 1.1.0 when the receipt began carrying its full binding identity.
 *
 * A 1.0.0 receipt named neither the canonical target URL, the writer identity, the source
 * authority, nor an error count, so a verifier holding one could not tell an operation against the
 * approved project from an identically-shaped operation against another. Those four values are now
 * part of the body, and therefore part of the receipt checksum.
 */
export const RECEIPT_SCHEMA_VERSION = 'literature-production-ingest-receipt/1.1.0' as const
export const RECONCILIATION_SCHEMA_VERSION =
  'literature-production-ingest-reconciliation/1.0.0' as const
export const CANARY_MANIFEST_SCHEMA_VERSION =
  'literature-production-ingest-canary-manifest/1.0.0' as const
export const CANARY_SELECTOR_VERSION = 'bibliographic-diversity-sha256/1.0.0' as const

export const APPROVED_PROJECT_NAME = 'IP_Literature' as const
export const APPROVED_PROJECT_REF = 'itcttmkxdxvwmwcmzmey' as const
export const APPROVED_PROJECT_URL = `https://${APPROVED_PROJECT_REF}.supabase.co/` as const
export const PROHIBITED_ENDOREELS_REF = 'tqnhxlwvkkswuckszlee' as const

/**
 * The exact `created_by` this engine writes, and the only writer a bound receipt may name.
 *
 * Previously a bare literal repeated in `engine.ts`, `reconcile.ts`, and a test fixture. A receipt
 * check that accepts "some nonempty string" accepts a row written by anything at all, so the value
 * is pinned once and compared by identity everywhere.
 */
export const INGEST_WRITER_IDENTITY = 'literature-production-ingest' as const

/**
 * The only cohort a canary manifest may claim as its authority.
 *
 * Stated in `CanaryManifestBody.sourceAuthority` and now carried on the receipt, so a receipt
 * describing a selection drawn from anything else disagrees with the contract rather than being
 * read as an unlabelled 25 records.
 */
export const CANARY_SOURCE_AUTHORITY = 'owner-authorized-development-cohort-630' as const

export const DESTINATION_ENV_NAMES = {
  url: 'LITERATURE_SUPABASE_URL',
  projectRef: 'LITERATURE_SUPABASE_EXPECTED_PROJECT_REF',
  secret: 'LITERATURE_SUPABASE_SECRET_KEY',
} as const
export const CANARY_MANIFEST_CHECKSUM_ENV_NAME = 'LITERATURE_CANARY_MANIFEST_SHA256' as const
export const FULL_EXPECTED_RECORD_COUNT_ENV_NAME = 'LITERATURE_FULL_EXPECTED_RECORD_COUNT' as const
export const FULL_EXPECTED_SOURCE_SHA256_ENV_NAME =
  'LITERATURE_FULL_EXPECTED_SOURCE_SHA256' as const

export const SOURCE_CONTAINER = 'supabase_db_ip-literature-local' as const
export const SOURCE_CONTAINER_ID =
  '906d62f9e2b5ac7c58742090566e87f8d2a36199ee897b09bb5c1b7727e286a8' as const
export const SOURCE_IMAGE_ID =
  'sha256:5deba92e50cd17bfacf8603834d317cdf3bfc1c016ec8293991997fa3b55fa3d' as const
export const SOURCE_DOCKER_ENDPOINT = 'unix:///var/run/docker.sock' as const
export const SOURCE_DATABASE = 'postgres' as const
export const SOURCE_DATABASE_USER = 'postgres' as const
export const SOURCE_INTERNAL_PORT = '5432' as const
export const SOURCE_PUBLISHED_PORT = '55322' as const
export const SOURCE_SUPABASE_PROJECT = 'ip-literature-local' as const

export const DEFAULT_CANARY_SIZE = 25
export const EXPECTED_DEVELOPMENT_CANDIDATE_COUNT = 630
export const DEFAULT_RECORD_BATCH_LIMIT = 250
export const DEFAULT_BYTE_BATCH_LIMIT = 4 * 1024 * 1024
export const DEFAULT_CONCURRENCY = 1
export const MAX_CONCURRENCY = 8
export const MAX_BATCH_COUNT = 2_048
export const MIN_PRODUCTION_BYTE_BATCH_LIMIT = 16 * 1024

export const ARTICLE_SELECT_COLUMNS = [
  'pmid',
  'doi',
  'pmcid',
  'title',
  'abstract',
  'abstract_display_policy',
  'journal_id',
  'journal_title',
  'journal_abbreviation',
  'nlm_journal_id',
  'issn_values',
  'publication_date_raw',
  'publication_year',
  'publication_month',
  'publication_day',
  'publication_date_precision',
  'publication_types',
  'mesh_terms',
  'author_keywords',
  'languages',
  'authors',
  'collective_authors',
  'affiliations',
  'volume',
  'issue',
  'pages',
  'article_number',
  'place_of_publication',
  'citation_source',
  'conflict_of_interest',
  'pubmed_status',
  'pubmed_last_revised_at',
  'pubmed_created_at',
  'raw_nbib_tags',
  'metadata_hash',
  'normalized_title',
  'normalized_title_hash',
  'is_retracted',
  'is_correction',
  'is_conference_abstract',
] as const
