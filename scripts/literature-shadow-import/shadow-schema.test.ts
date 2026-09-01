import fs from 'node:fs'
import path from 'node:path'

const sql = fs.readFileSync(
  path.join(process.cwd(), 'scripts/literature-shadow-import/schema/shadow-proposal.sql'),
  'utf8',
)

describe('Literature shadow schema proposal', () => {
  test('remains a proposal outside migrations and never alters canonical literature truth', () => {
    expect(sql).toContain('STATUS: PROPOSAL / DISPOSABLE REHEARSAL ONLY')
    expect(sql).not.toMatch(/alter\s+table\s+public\.literature_articles/i)
    expect(sql).not.toMatch(/create\s+or\s+replace/i)
    expect(sql).not.toMatch(/security\s+definer/i)
  })

  test.each([
    'literature_shadow_runs',
    'literature_shadow_classifications',
    'literature_shadow_enhancements',
    'literature_shadow_terms',
  ])('%s is RLS protected and service-role read-only', (table) => {
    expect(sql).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
    expect(sql).toMatch(
      new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`, 'i'),
    )
    expect(sql).toMatch(new RegExp(`grant select on table public\\.${table} to service_role`, 'i'))
    expect(sql).not.toMatch(
      new RegExp(
        `grant (insert|update|delete|all) on table public\\.${table} to service_role`,
        'i',
      ),
    )
  })
})
