/** @jest-environment node */

/**
 * Draft canary records must not be reachable by anyone who is not a site administrator.
 *
 * Every record this bring-up imports lands as `visibility_state = 'draft'`, and the conference MVP
 * runs against a real production project, so "unlisted" has to be a property of the code rather
 * than of nobody having guessed the URL yet. Three independent things have to hold, and each can
 * regress on its own:
 *
 *   1. **Authentication.** Every Literature page and API route applies the site-admin gate before
 *      it reaches a query. A new route added without the gate is the likely regression, so the
 *      assertion enumerates the route files from disk rather than naming them.
 *   2. **Indexing.** The routes declare `robots: index/follow = false`, and no Literature URL
 *      appears in the sitemap — a page can be unlisted and still be crawled if it is advertised.
 *   3. **Default visibility.** The search RPC's non-preview path is the one a future public surface
 *      would call, and the foundation migration filters it to published records.
 *
 * These are source and SQL assertions on purpose. The routes redirect through `next/navigation`
 * and read cookies, so rendering them here would prove only that the mocks behaved.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const LITERATURE_PAGE_ROOT = 'src/app/[locale]/literature'
const ADMIN_PAGE_ROOT = 'src/app/[locale]/admin/literature'
const PUBLIC_API_ROOT = 'src/app/api/literature'
const ADMIN_API_ROOT = 'src/app/api/admin/literature'
const FOUNDATION_MIGRATION = 'supabase/migrations/20260727032621_add_literature_explorer.sql'

function walk(directory: string): string[] {
  const absolute = join(ROOT, directory)
  const found: string[] = []
  for (const entry of readdirSync(absolute)) {
    const path = join(absolute, entry)
    if (statSync(path).isDirectory()) {
      found.push(...walk(relative(ROOT, path)))
    } else if (entry === 'page.tsx' || entry === 'route.ts' || entry === 'layout.tsx') {
      found.push(relative(ROOT, path))
    }
  }
  return found.sort()
}

const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/**
 * The layout gate covers the pages beneath it, so a page file is satisfied by its own gate or by
 * an ancestor layout's. Admin pages have no shared layout and must each carry one.
 */
function isGated(path: string, source: string): boolean {
  if (source.includes('requireLiteratureSiteAdmin')) return true
  if (!path.startsWith(LITERATURE_PAGE_ROOT)) return false
  return read(`${LITERATURE_PAGE_ROOT}/layout.tsx`).includes('requireLiteratureSiteAdminPage')
}

describe('every Literature surface is behind the site-admin gate', () => {
  const pages = [...walk(LITERATURE_PAGE_ROOT), ...walk(ADMIN_PAGE_ROOT)]
  const routes = [...walk(PUBLIC_API_ROOT), ...walk(ADMIN_API_ROOT)]

  it('found the surfaces it means to check', () => {
    // A refactor that moves these directories must not silently reduce this suite to zero cases.
    expect(pages.length).toBeGreaterThan(0)
    expect(routes.length).toBeGreaterThan(0)
  })

  it.each(pages)('%s requires a site administrator', (path) => {
    expect(`${path}: gated=${isGated(path, read(path))}`).toBe(`${path}: gated=true`)
  })

  it.each(routes)('%s rejects an unauthenticated caller before querying', (path) => {
    const source = read(path)
    expect(`${path}: ${source.includes('requireLiteratureSiteAdminApi')}`).toBe(`${path}: true`)

    // The gate must run before any query helper, not merely appear somewhere in the file.
    const gateAt = source.indexOf('await requireLiteratureSiteAdminApi()')
    expect(`${path}: gate present`).toBe(gateAt >= 0 ? `${path}: gate present` : `${path}: missing`)
    for (const query of [
      'searchLiterature(',
      'getLiteratureArticle(',
      'curateLiteratureArticle(',
    ]) {
      const queryAt = source.indexOf(query)
      if (queryAt < 0) continue
      expect(`${path} ${query} after gate: ${queryAt > gateAt}`).toBe(
        `${path} ${query} after gate: true`,
      )
    }
  })
})

describe('no Literature URL is advertised for indexing', () => {
  it('marks the reader and administration surfaces noindex', () => {
    expect(read(`${LITERATURE_PAGE_ROOT}/layout.tsx`)).toMatch(/robots:\s*\{[^}]*index:\s*false/su)
    expect(read(`${ADMIN_PAGE_ROOT}/page.tsx`)).toMatch(/robots:\s*\{\s*index:\s*false/su)
    expect(read(`${ADMIN_PAGE_ROOT}/gold-set/page.tsx`)).toMatch(/robots:\s*\{\s*index:\s*false/su)
  })

  it('lists no Literature route in the sitemap', () => {
    // Draft records are unlisted; publishing their container URL would undo that.
    expect(read('src/app/sitemap.ts')).not.toMatch(/literature/iu)
  })
})

describe('draft records are excluded from the default search path', () => {
  const migration = read(FOUNDATION_MIGRATION)

  it('filters the non-preview search to published records', () => {
    // `search_literature_v1` takes `p_admin_preview`; the non-preview branch is what any future
    // public surface would reach, and it must never see a draft.
    expect(migration).toMatch(/p_admin_preview/u)
    expect(migration).toMatch(/visibility_state\s*=\s*'published'/u)
  })

  it('defaults new rows to draft and unreviewed', () => {
    // The ingestion engine sets these explicitly too; the column defaults are the backstop for a
    // row inserted by any other path.
    expect(migration).toMatch(/visibility_state text not null default 'draft'/u)
    expect(migration).toMatch(/relevance_state text not null default 'unreviewed'/u)
  })

  it('enables row-level security on every Literature table', () => {
    const enabled = [
      ...migration.matchAll(/alter table public\.(literature_\w+) enable row level security/gu),
    ]
    expect(enabled.length).toBeGreaterThanOrEqual(8)
  })
})
