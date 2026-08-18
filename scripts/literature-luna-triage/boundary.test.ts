/** @jest-environment node */
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { LUNA_REVIEW_APP_HOST } from './constants'
import { corpusReadSql } from './corpus'

/**
 * Source-boundary assertions for the whole lane: the SQL surface, the network surface, the
 * credential surface, and the membership-language surface are each pinned here so a future
 * edit that widens any of them fails this suite before it reaches review.
 */

const PACKAGE_DIR = resolve(process.cwd(), 'scripts', 'literature-luna-triage')
const CORE_DIR = resolve(process.cwd(), 'src', 'features', 'literature', 'classifier')

function sourceFiles(directory: string, includeTests: boolean): string[] {
  const entries = readdirSync(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...sourceFiles(path, includeTests))
      continue
    }
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.md')) continue
    if (!includeTests && entry.name.endsWith('.test.ts')) continue
    files.push(path)
  }
  return files.sort()
}

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

function stripSqlCommentsAndLiterals(sql: string): string {
  return sql
    .replace(/--[^\n]*/gu, ' ')
    .replace(/\/\*[\s\S]*?\*\//gu, ' ')
    .replace(/'(?:''|[^'])*'/gu, "''")
}

describe('the one SQL surface', () => {
  const sql = corpusReadSql()
  const stripped = stripSqlCommentsAndLiterals(sql)

  it('is bracketed read-only repeatable-read and ends in rollback', () => {
    expect(sql).toMatch(/^begin transaction isolation level repeatable read read only;/u)
    expect(sql).toMatch(/rollback;$/u)
    expect((stripped.match(/\brollback\b/giu) ?? []).length).toBe(1)
  })

  it('contains no mutation verbs and no psql meta-commands', () => {
    expect(stripped).not.toMatch(
      /\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|CREATE|DROP|GRANT|REVOKE|CALL|DO|COPY|COMMIT|VACUUM|REINDEX|CLUSTER|REFRESH|DISCARD|LOCK)\b/iu,
    )
    expect(stripped).not.toMatch(/^\s*\\/mu)
  })

  it('never touches review, gold, split, or membership surfaces', () => {
    for (const forbidden of [
      /dataset_split/iu,
      /held[-_ ]?out/iu,
      /gold_set/iu,
      /gold_review/iu,
      /relevance_state/iu,
      /reviewed_relevance/iu,
      /visibility_state/iu,
      /\bexcept\b/iu,
      /not\s+in\s*\(\s*select/iu,
    ]) {
      expect(stripped).not.toMatch(forbidden)
    }
  })

  it('reads only the two bibliographic tables', () => {
    const tables = [...stripped.matchAll(/\b(?:from|join)\s+([a-z_.]+)/giu)].map(
      (match) => match[1],
    )
    expect([...new Set(tables)].sort()).toEqual([
      'public.literature_articles',
      'public.literature_journals',
    ])
  })
})

describe('the one network surface', () => {
  const nonTestSources = sourceFiles(PACKAGE_DIR, false)

  it('confines fetch to openai.ts, except same-origin browser calls in the review page', () => {
    for (const path of nonTestSources) {
      if (path.endsWith('openai.ts')) continue
      const source = read(path)
      if (path.endsWith('review-page.ts')) {
        // The embedded client may call only relative same-origin /api paths.
        const targets = [...source.matchAll(/fetch\(\s*(['"`])([^'"`]+)\1/gu)].map(
          (match) => match[2],
        )
        expect(targets.length).toBeGreaterThan(0)
        for (const target of targets) {
          expect(target.startsWith('/api/')).toBe(true)
        }
        continue
      }
      expect({ path, hasFetch: source.includes('fetch(') }).toEqual({ path, hasFetch: false })
    }
  })

  it('confines process.env to openai.ts', () => {
    for (const path of nonTestSources) {
      if (path.endsWith('openai.ts')) continue
      expect(read(path).includes('process.env')).toBe(false)
    }
  })

  it('allows only the OpenAI base URL and loopback origins', () => {
    for (const path of nonTestSources) {
      const source = read(path)
      const urls = source.match(/https?:\/\/[^\s'"`)]+/gu) ?? []
      for (const url of urls) {
        const allowed =
          url.startsWith('https://api.openai.com') || url.startsWith('http://127.0.0.1')
        expect({ path, url, allowed }).toEqual({ path, url, allowed: true })
      }
    }
  })

  it('reaches no database client: no supabase, pg, or postgres imports anywhere', () => {
    // Needles are assembled at runtime so this test never matches its own source.
    const needles = ['@supa' + 'base', 'postgres' + '://', 'postgresql' + '://']
    for (const path of sourceFiles(PACKAGE_DIR, true)) {
      if (path.endsWith('boundary.test.ts')) continue
      const source = read(path)
      for (const needle of needles) {
        expect({ path, needle, found: source.includes(needle) }).toEqual({
          path,
          needle,
          found: false,
        })
      }
      expect(source).not.toMatch(/from\s+'pg'/u)
      expect(source).not.toMatch(/require\(\s*'pg'\s*\)/u)
    }
  })
})

describe('coordinator discipline in the lane sources', () => {
  it('keeps membership vocabulary out of the lane entirely', () => {
    for (const path of sourceFiles(PACKAGE_DIR, false)) {
      const source = read(path)
      expect(source.includes('dataset_split')).toBe(false)
      expect(source).not.toMatch(/held[-_]?out/iu)
    }
  })

  it('contains no machine-local absolute paths', () => {
    const needle = '/Use' + 'rs/'
    for (const path of [...sourceFiles(PACKAGE_DIR, true), ...sourceFiles(CORE_DIR, true)]) {
      if (path.endsWith('boundary.test.ts')) continue
      expect({ path, found: read(path).includes(needle) }).toEqual({ path, found: false })
    }
  })

  it('offers no per-record selector flags in the CLI', () => {
    const cli = read(join(PACKAGE_DIR, 'cli.ts'))
    expect(cli.includes("'pmid'")).toBe(false)
    expect(cli.includes('--pmid')).toBe(false)
  })

  it('binds the review app to loopback only', () => {
    expect(LUNA_REVIEW_APP_HOST).toBe('127.0.0.1')
    const reviewApp = read(join(PACKAGE_DIR, 'review-app.ts'))
    expect(reviewApp.includes('server.listen(options.port, LUNA_REVIEW_APP_HOST')).toBe(true)
    expect(reviewApp.includes("listen(options.port, '0.0.0.0'")).toBe(false)
  })

  it('reads the API key from the environment name only, never argv or files', () => {
    const openai = read(join(PACKAGE_DIR, 'openai.ts'))
    expect(openai.includes('LUNA_OPENAI_API_KEY_ENV_NAME')).toBe(true)
    const cli = read(join(PACKAGE_DIR, 'cli.ts'))
    expect(cli.includes('api-key')).toBe(false)
    expect(cli.includes('OPENAI_API_KEY')).toBe(false)
  })
})
