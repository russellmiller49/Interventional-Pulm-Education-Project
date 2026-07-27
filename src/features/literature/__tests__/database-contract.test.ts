import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { literatureQueryRegistry } from '@/features/literature/config'
import { normalizeNbibRecord } from '@/features/literature/domain/normalize'
import { parseNbibText } from '@/features/literature/domain/nbib-parser'
import { literatureArticleDatabaseRow } from '@/features/literature/server/database-mappers'

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20260727032621_add_literature_explorer.sql',
)

describe('literature database contract', () => {
  it('creates the required schema with deny-by-default RLS and no vector extension', () => {
    const sql = readFileSync(migrationPath, 'utf8')
    const tables = [
      'literature_journals',
      'literature_articles',
      'literature_import_batches',
      'literature_article_sources',
      'literature_topics',
      'literature_article_topics',
      'literature_curation_events',
      'literature_import_errors',
    ]

    for (const table of tables) {
      expect(sql).toContain(`create table public.${table}`)
      expect(sql).toContain(`alter table public.${table} enable row level security`)
      expect(sql).toContain(`revoke all on table public.${table} from public, anon, authenticated`)
      expect(sql).toContain(`grant all on table public.${table} to service_role`)
    }

    expect(sql).toContain('create or replace function public.search_literature_v1')
    expect(sql).toContain("article.relevance_state = 'included'")
    expect(sql).toContain("article.visibility_state = 'published'")
    expect(sql).toContain('p_page_size > 50')
    expect(sql).toContain('coalesce(record_limit, -1)')
    expect(sql).toContain('security invoker')
    expect(sql).not.toMatch(/create\s+extension\s+if\s+not\s+exists\s+vector/iu)
  })

  it('maps bibliographic metadata without curation fields', async () => {
    const [parsed] = await parseNbibText(
      ['PMID- 123', 'TI  - Fixture title', 'TA  - Chest', 'JID - 0231335'].join('\n'),
    )
    const normalized = normalizeNbibRecord(parsed.record, literatureQueryRegistry, parsed.issues)
    if (!normalized.article) {
      throw new Error('Expected normalized fixture article.')
    }

    const row = literatureArticleDatabaseRow(normalized.article)
    expect(row).not.toHaveProperty('relevance_state')
    expect(row).not.toHaveProperty('visibility_state')
    expect(row).not.toHaveProperty('is_landmark')
    expect(row).not.toHaveProperty('manual_override')
    expect(row).toMatchObject({
      pmid: '123',
      journal_id: 'chest',
      abstract_display_policy: 'snippet_only',
    })
  })
})
