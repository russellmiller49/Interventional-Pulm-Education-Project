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

describe('gold-set database contract', () => {
  const sql = readFileSync(migrationPath, 'utf8')
  const categorySql = readFileSync(categoryMigrationPath, 'utf8')
  const fullTextSql = readFileSync(fullTextMigrationPath, 'utf8')
  const interactiveCaseSql = readFileSync(interactiveCaseMigrationPath, 'utf8')
  const immuneInflammatorySql = readFileSync(immuneInflammatoryMigrationPath, 'utf8')
  const safetyPreventionSql = readFileSync(safetyPreventionMigrationPath, 'utf8')
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
})
