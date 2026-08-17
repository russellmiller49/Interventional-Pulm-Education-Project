/** @jest-environment node */

/**
 * The textual forbidden-construct matrix.
 *
 * These assertions run over every source file in this package (and the staged schema
 * proposal), so a future edit that introduces a complement construct, a held-out reference, an
 * AI-suggestion write, or a widened mutation surface fails here even if every behavioral test
 * still passes.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const PACKAGE_ROOT = join(process.cwd(), 'scripts/literature-reviewed-overlay')

function packageFiles(includeTests: boolean): Array<{ path: string; content: string }> {
  const entries: Array<{ path: string; content: string }> = []
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        walk(path)
        continue
      }
      if (!/\.(?:ts|sql|md)$/u.test(entry.name)) continue
      if (!includeTests && /\.test\.ts$/u.test(entry.name)) continue
      entries.push({ path, content: readFileSync(path, 'utf8') })
    }
  }
  walk(PACKAGE_ROOT)
  return entries
}

describe('forbidden constructs', () => {
  const sources = packageFiles(false)

  it('scans a meaningful surface', () => {
    expect(sources.length).toBeGreaterThanOrEqual(12)
  })

  it('contains no complement construct against the cohort split', () => {
    for (const file of sources) {
      expect(file.content).not.toMatch(/dataset_split\s*(?:!=|<>)/iu)
      expect(file.content).not.toMatch(/dataset_split\s+not\s+in/iu)
      expect(file.content).not.toMatch(/not\s+in\s*\(\s*select[^)]*dataset_split/iu)
    }
  })

  it('never names the held-out split value beside the split column', () => {
    for (const file of sources) {
      const positions = [...file.content.matchAll(/dataset_split/giu)].map(
        (match) => match.index ?? 0,
      )
      for (const position of positions) {
        const neighborhood = file.content.slice(Math.max(0, position - 120), position + 160)
        expect(neighborhood).not.toMatch(/['"]test['"]/iu)
        expect(neighborhood).not.toMatch(/held[-_ ]?out/iu)
      }
    }
  })

  it('confines the sampling-arithmetic identifiers to the forbidden-column declaration', () => {
    // `projection.ts` must name them — inside OVERLAY_FORBIDDEN_PROJECTION_COLUMNS, so a
    // projection that reaches for them fails validation. Nothing else may mention them, and
    // `projection.test.ts` separately proves the generated SQL never contains them.
    for (const file of sources) {
      if (file.path.endsWith('projection.ts')) continue
      expect(file.content).not.toMatch(/requested_size/u)
      expect(file.content).not.toMatch(/test_percent/u)
    }
  })

  it('uses no set-complement SQL anywhere', () => {
    for (const file of sources.filter((entry) => entry.path.endsWith('.sql'))) {
      // `raise exception` and value-list vocabulary checks (`x not in ('a','b')`) are fine;
      // a subquery complement never is.
      expect(file.content).not.toMatch(/\bexcept\b(?!ion)/iu)
      expect(file.content).not.toMatch(/not\s+in\s*\(\s*select/iu)
    }
    for (const file of sources.filter((entry) => entry.path.endsWith('.ts'))) {
      expect(file.content).not.toMatch(/not\s+in\s*\(\s*select/iu)
    }
  })
})

describe('mutation surface', () => {
  const proposal = readFileSync(join(PACKAGE_ROOT, 'schema/reviewed-overlay-proposal.sql'), 'utf8')
  /** The proposal with its `--` comments stripped: what the database actually executes. */
  const proposalSql = proposal
    .split('\n')
    .map((line) => line.replace(/--.*$/u, ''))
    .join('\n')
  const nonTestSources = packageFiles(false)

  it('never touches an AI-suggestion surface', () => {
    const topicsTable = ['literature_article', '_topics'].join('')
    for (const file of nonTestSources) {
      expect(file.content).not.toContain(topicsTable)
    }
    // The proposal may *require* classifier fields to be null, but may never assign them.
    expect(proposalSql).not.toMatch(/set[^;]*classifier_version\s*=/iu)
    expect(proposalSql).not.toMatch(/set[^;]*classifier_payload\s*=/iu)
  })

  it('mutates only the three approved relations in the proposal', () => {
    const mutationTargets = [
      ...proposalSql.matchAll(/(?:insert\s+into|update|delete\s+from)\s+(?:public\.)?([a-z_]+)/giu),
    ].map((match) => match[1])
    expect(new Set(mutationTargets)).toEqual(
      new Set([
        'literature_reviewed_overlay_operations',
        'literature_articles',
        'literature_curation_events',
      ]),
    )
    expect(proposalSql).not.toMatch(/\bdelete\s+from\b/iu)
    expect(proposalSql).not.toMatch(/\btruncate\b/iu)
    expect(proposalSql).not.toMatch(/\bdrop\b/iu)
  })

  it('leaves the ingest surfaces outside the executed proposal', () => {
    for (const table of [
      'literature_import_batches',
      'literature_article_sources',
      'literature_journals',
      'literature_import_errors',
    ]) {
      expect(proposalSql).not.toContain(table)
    }
  })

  it('never updates or deletes curation events', () => {
    expect(proposal).not.toMatch(/update\s+(?:public\.)?literature_curation_events/iu)
    expect(proposal).not.toMatch(/delete\s+from\s+(?:public\.)?literature_curation_events/iu)
  })

  it('grants the RPC to service_role only and keeps invoker security', () => {
    expect(proposal).toMatch(
      /revoke all on function public\.apply_literature_reviewed_overlay_batch_v1[\s\S]*?from public, anon, authenticated/u,
    )
    expect(proposal).toMatch(
      /grant execute on function public\.apply_literature_reviewed_overlay_batch_v1[\s\S]*?to service_role/u,
    )
    expect(proposal).toContain('security invoker')
    expect(proposal).not.toContain('security definer')
  })

  it('keeps the additive columns nullable and paired', () => {
    expect(proposal).toContain('literature_articles_reviewed_pairing_check')
    expect(proposal).not.toMatch(/add column reviewed_[a-z_]+ [a-z]+ not null/iu)
  })
})

describe('terminal-output discipline', () => {
  it('the CLI never prints record payloads', () => {
    const cli = readFileSync(join(PACKAGE_ROOT, 'cli.ts'), 'utf8')
    // The single stdout writer prints the command result object; record arrays never reach it.
    expect(cli.match(/process\.stdout\.write/gu)?.length).toBe(2)
    expect(cli).not.toMatch(/records/u)
  })
})
