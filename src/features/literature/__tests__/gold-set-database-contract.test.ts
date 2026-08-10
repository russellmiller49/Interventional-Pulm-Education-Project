import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20260727164510_add_literature_gold_set.sql',
)
const categoryMigrationPath = join(
  process.cwd(),
  'supabase/migrations/20260727190000_add_literature_gold_review_categories.sql',
)
const fullTextMigrationPath = join(
  process.cwd(),
  'supabase/migrations/20260727193432_add_literature_full_text_categorization_flag.sql',
)
const interactiveCaseMigrationPath = join(
  process.cwd(),
  'supabase/migrations/20260728170939_add_interactive_clinical_case_publication_status.sql',
)
const immuneInflammatoryMigrationPath = join(
  process.cwd(),
  'supabase/migrations/20260728171212_add_immune_inflammatory_disease_tag.sql',
)
const safetyPreventionMigrationPath = join(
  process.cwd(),
  'supabase/migrations/20260728174726_add_safety_complication_prevention_clinical_purpose.sql',
)
const testUnlockMigrationPath = join(
  process.cwd(),
  'supabase/migrations/20260730194025_add_literature_gold_test_unlock.sql',
)
const importCompensationMigrationPath = join(
  process.cwd(),
  'supabase/migrations/20260808035633_add_literature_gold_import_compensation_contract.sql',
)
const importCompensationV2MigrationPath = join(
  process.cwd(),
  'supabase/migrations/20260809231651_add_literature_gold_import_compensation_contract_v2.sql',
)
const localSupabaseScriptPath = join(process.cwd(), 'scripts/literature/local-supabase.ts')
const protectedMigrationScriptPath = join(
  process.cwd(),
  'scripts/literature/protected-gold-import-contract-v2.ts',
)
const legacyImportScriptPath = join(process.cwd(), 'scripts/literature/import-gold-reviews.ts')

describe('gold-set database contract', () => {
  const sql = readFileSync(migrationPath, 'utf8')
  const categorySql = readFileSync(categoryMigrationPath, 'utf8')
  const fullTextSql = readFileSync(fullTextMigrationPath, 'utf8')
  const interactiveCaseSql = readFileSync(interactiveCaseMigrationPath, 'utf8')
  const immuneInflammatorySql = readFileSync(immuneInflammatoryMigrationPath, 'utf8')
  const safetyPreventionSql = readFileSync(safetyPreventionMigrationPath, 'utf8')
  const testUnlockSql = readFileSync(testUnlockMigrationPath, 'utf8')
  const importCompensationSql = readFileSync(importCompensationMigrationPath, 'utf8')
  const importCompensationV2Sql = readFileSync(importCompensationV2MigrationPath, 'utf8')
  const localSupabaseScript = readFileSync(localSupabaseScriptPath, 'utf8')
  const protectedMigrationScript = readFileSync(protectedMigrationScriptPath, 'utf8')
  const legacyImportScript = readFileSync(legacyImportScriptPath, 'utf8')
  const tables = [
    'literature_gold_set_batches',
    'literature_gold_set_items',
    'literature_gold_set_review_drafts',
    'literature_gold_set_reviews',
    'literature_gold_set_events',
  ]

  it('creates service-only, RLS-protected tables', () => {
    for (const table of tables) {
      expect(sql).toContain(`create table public.${table}`)
      expect(sql).toContain(`alter table public.${table} enable row level security`)
      expect(sql).toContain(`revoke all on table public.${table} from public, anon, authenticated`)
      expect(sql).toContain(`on table public.${table} to service_role`)
    }
  })

  it('implements the single-reviewer workflow without adjudication entities', () => {
    expect(sql).not.toContain('second_reviewer')
    expect(sql).not.toContain('adjudication')
    expect(sql).toContain('unique (item_id, revision)')
    expect(sql).toContain('supersedes_review_id')
    expect(sql).toContain('is_blinded')
  })

  it('protects first-pass blinding, immutable history, and frozen batches', () => {
    expect(sql).toContain('automated signals may only be revealed after the first completed review')
    expect(sql).toContain('the first completed review must remain blinded')
    expect(sql).toContain('is append-only')
    expect(sql).toContain('frozen gold-set batches are immutable')
    expect(sql).toContain(
      'a batch can only be frozen after every item is completed and drafts are cleared',
    )
  })

  it('uses keyset candidate pagination and database-side response blinding', () => {
    expect(sql).toContain('p_after_pmid')
    expect(sql).toContain('article.pmid::numeric > p_after_pmid::numeric')
    expect(sql).toContain('get_literature_gold_review_item_v1')
    expect(sql).toContain('when selected_item.supplemental_metadata_revealed_at is null then null')
    expect(sql).toContain('and selected_item.automated_signals_revealed_at is not null')
  })

  it('allows the expanded review categories in the server-side validator', () => {
    expect(categorySql).toContain("'multiple-general-overview'")
    expect(categorySql.match(/'not-assessable-from-available-metadata'/gu)).toHaveLength(3)
    expect(categorySql).toContain("'review-article'")
    expect(categorySql).toContain('pg_get_functiondef')
  })

  it('persists and returns the full-text categorization audit flag', () => {
    expect(fullTextSql.match(/add column categorization_from_full_text/gu)).toHaveLength(2)
    expect(fullTextSql).toContain("'categorizationFromFullText'")
    expect(fullTextSql).toContain('literature_gold_set_reviews_full_text_categorization_check')
    expect(fullTextSql).toContain('get_literature_gold_review_item_v1')
  })

  it('allows interactive clinical cases as a publication status', () => {
    expect(interactiveCaseSql).toContain("'interactive-clinical-case'")
    expect(interactiveCaseSql).toContain('publication-status allowlist')
  })

  it('allows immune/inflammatory disease as a disease tag', () => {
    expect(immuneInflammatorySql).toContain("'immune-inflammatory-disease'")
    expect(immuneInflammatorySql).toContain('disease-tag allowlist')
  })

  it('allows safety/complication prevention as a clinical purpose', () => {
    expect(safetyPreventionSql).toContain("'safety-complication-prevention'")
    expect(safetyPreventionSql).toContain('clinical-purpose allowlist')
  })

  it('keeps the held-out split inaccessible until an audited unlock', () => {
    expect(testUnlockSql).toContain('test_unlocked_at timestamptz')
    expect(testUnlockSql).toContain('test_split_unlocked')
    expect(testUnlockSql).toContain(
      'complete the development split and clear its drafts before unlocking test',
    )
    expect(testUnlockSql).toContain(
      'the locked test split cannot be changed before its audited unlock',
    )
    expect(testUnlockSql).toContain('gold-set composition is immutable after batch creation')
    expect(testUnlockSql).toContain('new gold-set batches must begin with the test lock intact')
    expect(testUnlockSql).toContain('a locked gold-standard batch cannot change kind')
    expect(testUnlockSql).toContain('gold-set batch definitions are immutable after creation')
    expect(testUnlockSql).toContain('literature_gold_set_events_one_test_unlock_idx')
    expect(testUnlockSql).toContain('test unlock events must match the audited batch transition')
    expect(testUnlockSql).toContain('the gold-standard batch composition must be sealed')
    expect(testUnlockSql).toContain('selected_batch.requested_size::numeric')
    expect(testUnlockSql).toContain('if prior_locked or next_locked then')
    expect(testUnlockSql).toContain('the audited gold-set test unlock is immutable')
    expect(testUnlockSql).toContain('Legacy batch predated technical test locking.')
    expect(testUnlockSql).toContain('get_literature_gold_review_item_v2')
    expect(testUnlockSql).toContain('security definer')
    expect(testUnlockSql).toContain(
      'revoke all on function public.get_literature_gold_review_item_v1',
    )
    expect(testUnlockSql).toContain('to service_role')
    expect(testUnlockSql).toContain("notify pgrst, 'reload schema'")
  })

  it('installs the test-lock contract in the isolated literature stack', () => {
    expect(localSupabaseScript).toContain("'20260730194025_add_literature_gold_test_unlock.sql'")
  })

  it('adds lifecycle-aware, append-only import and compensation revisions', () => {
    expect(importCompensationSql).toContain("revision_kind text not null default 'standard'")
    expect(importCompensationSql).toContain("lifecycle_state text not null default 'effective'")
    expect(importCompensationSql).toContain('compensates_review_id uuid')
    expect(importCompensationSql).toContain('effective_source_review_id uuid')
    expect(importCompensationSql).toContain('literature_gold_set_reviews_one_child_idx')
    expect(importCompensationSql).toContain('current_review_id')
    expect(importCompensationSql).toContain('chainHeadReviewId')
    expect(importCompensationSql).not.toMatch(/update\s+public\.literature_gold_set_reviews\b/iu)
    expect(importCompensationSql).not.toMatch(
      /delete\s+from\s+public\.literature_gold_set_reviews\b/iu,
    )
  })

  it('keeps the historical V1 migration byte-identical', () => {
    expect(createHash('sha256').update(importCompensationSql).digest('hex')).toBe(
      'e846ef70a7b484460682a7ff61d579d3d6fdae3400805fa5395adc0464244528',
    )
  })

  it('defines atomic operations, separate hashes, and explicit event types', () => {
    expect(importCompensationSql).toContain('create table public.literature_gold_review_operations')
    expect(importCompensationSql).toContain(
      'create table public.literature_gold_review_operation_actions',
    )
    expect(importCompensationSql).toContain('apply_literature_gold_import_v1')
    expect(importCompensationSql).toContain('compensate_literature_gold_import_v1')
    expect(importCompensationSql).toContain('literature_gold_physical_state_hash_v1')
    expect(importCompensationSql).toContain('literature_gold_effective_state_hash_v1')
    expect(importCompensationSql).toContain('literature_gold_development_membership_hash_v1')
    for (const eventType of [
      'import_started',
      'review_imported',
      'import_completed',
      'import_failed',
      'import_compensation_started',
      'review_compensated',
      'review_voided',
      'import_compensation_completed',
      'import_compensation_failed',
    ]) {
      expect(importCompensationSql).toContain(`'${eventType}'`)
    }
    expect(importCompensationSql).toMatch(/exception\s+when\s+others\s+then/iu)
    expect(importCompensationSql).toContain('get stacked diagnostics')
    expect(importCompensationSql).toContain('caught_sqlstate = returned_sqlstate')
    expect(importCompensationSql).toContain('failed import changed effective state after rollback')
    expect(importCompensationSql).toContain(
      'failed compensation changed effective state after rollback',
    )
  })

  it('keeps operation state service-only and installs the contract in the isolated stack', () => {
    const normalizedSql = importCompensationSql.replace(/\s+/gu, ' ')
    for (const table of [
      'literature_gold_review_operations',
      'literature_gold_review_operation_actions',
    ]) {
      expect(importCompensationSql).toContain(
        `alter table public.${table} enable row level security`,
      )
      expect(normalizedSql).toContain(
        `revoke all on table public.${table} from public, anon, authenticated`,
      )
    }
    expect(importCompensationSql).toContain('from public, anon, authenticated')
    expect(importCompensationSql).toContain('to service_role')
    expect(localSupabaseScript).toContain('PROTECTED_GOLD_IMPORT_CONTRACT_V1.filename')
    expect(localSupabaseScript).toContain('PROTECTED_FORWARD_LITERATURE_MIGRATIONS')
    expect(localSupabaseScript).toContain('includeAppliedProtectedV2: false')
    expect(protectedMigrationScript).toContain(
      "filename: '20260809231651_add_literature_gold_import_compensation_contract_v2.sql'",
    )
    expect(protectedMigrationScript).toContain(
      "sha256: '3f34934391b3c1ca3ff2ab96c103fe64f05fc29e7b2e0d8375dd6742401995b1'",
    )
  })

  it('installs V2 as an explicit forward-only contract boundary', () => {
    expect(importCompensationV2Sql).toContain('apply_literature_gold_import_v2')
    expect(importCompensationV2Sql).toContain('compensate_literature_gold_import_v2')
    expect(importCompensationV2Sql).toContain('reconcile_literature_gold_review_operation_v2')
    expect(importCompensationV2Sql).toContain('literature_gold_effective_state_hash_v2')
    expect(importCompensationV2Sql).toContain('literature_gold_physical_state_hash_v2')
    expect(importCompensationV2Sql).toContain('full_text_used')
    expect(importCompensationV2Sql).toContain('gold-review-import-compensation/2.0.0')
    expect(importCompensationV2Sql).not.toMatch(
      /(?:alter|update|delete)[\s\S]{0,80}20260808035633_add_literature_gold_import_compensation_contract/iu,
    )
  })

  it('hardens privileged execution, lock scope, and canonical digest parity', () => {
    const normalizedSql = importCompensationSql.replace(/\s+/gu, ' ')
    expect(importCompensationSql).toContain('order by member.key collate "C"')
    expect(importCompensationSql).toContain('literature_gold_review_clinical_projection_v1')
    expect(importCompensationSql).toContain("'candidateReview', 'candidateReviewSha256'")
    expect(importCompensationSql).toContain('pg_advisory_xact_lock')
    expect(importCompensationSql).toContain('order by item.display_order, item.id')
    expect(importCompensationSql).toContain('test_unlocked_at is not null')
    expect(importCompensationSql).toContain(
      'the batch has a started operation that requires explicit recovery',
    )
    expect(importCompensationSql.match(/security definer/gu)?.length).toBeGreaterThanOrEqual(3)
    for (const table of [
      'literature_gold_review_operations',
      'literature_gold_review_operation_actions',
    ]) {
      expect(normalizedSql).toContain(`grant select on table public.${table} to service_role`)
      expect(normalizedSql).not.toContain(
        `grant insert, update, delete on table public.${table} to service_role`,
      )
    }
    expect(normalizedSql).toContain(
      'revoke truncate, references, trigger on table public.literature_gold_set_reviews, public.literature_gold_set_events from service_role',
    )
  })

  it('retires the non-atomic multi-request legacy commit path', () => {
    expect(legacyImportScript).toContain('legacy multi-request import commit path is retired')
    expect(legacyImportScript).not.toContain('Promise.all')
    expect(legacyImportScript).not.toContain("client.rpc('save_literature_gold_review_v1'")
  })
})
