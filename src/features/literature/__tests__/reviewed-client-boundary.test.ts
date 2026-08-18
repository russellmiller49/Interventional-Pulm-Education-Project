/** @jest-environment node */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const CURATED_PAGE = 'src/app/[locale]/admin/literature/curated/page.tsx'
const CLIENT_FACING_SURFACES = [
  CURATED_PAGE,
  'src/features/literature/components/CuratedLiteratureResultCard.tsx',
  'src/features/literature/components/LiteratureAdminCollectionNav.tsx',
  'src/features/literature/components/LiteratureReviewedProvenance.tsx',
]

const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

describe('reviewed-overlay browser and release boundary', () => {
  it('keeps the Curated page dynamic, noindex, and gated before every database load', () => {
    const source = read(CURATED_PAGE)
    const gateAt = source.indexOf('await requireLiteratureSiteAdminPage(')
    const firstLoadAt = source.indexOf('loadLiteratureCuratedStats()')

    expect(source).toContain("export const dynamic = 'force-dynamic'")
    expect(source).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/u)
    expect(source).not.toContain('generateStaticParams')
    expect(gateAt).toBeGreaterThan(0)
    expect(firstLoadAt).toBeGreaterThan(gateAt)
  })

  it('ships no raw reviewed lineage, database secret name, or protected fixture import', () => {
    for (const path of CLIENT_FACING_SURFACES) {
      const source = read(path)
      expect({ path, clientDirective: source.includes("'use client'") }).toEqual({
        path,
        clientDirective: false,
      })
      expect(source).not.toMatch(
        /reviewed_(?:source_identity|operation_id)|LITERATURE_SUPABASE_(?:SECRET|SERVICE)|scripts\/literature-reviewed-overlay|local-data\/inputs|gold-set\/types/iu,
      )
    }
  })

  it('tracks no reviewed or gold fixture beneath public assets', () => {
    const publicFiles = execFileSync('git', ['ls-files', 'public'], {
      cwd: ROOT,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean)

    expect(
      publicFiles.filter((path) => /literature|reviewed[-_]?overlay|gold[-_]?set/iu.test(path)),
    ).toEqual([])
  })

  it('uses only the dedicated reviewed read operation and no gold workflow module', () => {
    const source = read('src/features/literature/server/queries.ts')
    const start = source.indexOf('export async function loadLiteratureCuratedStats')
    const end = source.indexOf('export async function loadLiteratureReviewQueue', start)
    const reviewedFunctions = source.slice(start, end)

    expect(reviewedFunctions).toContain("literatureClientForOperation('reviewed_overlay_read')")
    expect(reviewedFunctions).not.toMatch(
      /from ['"].*gold-set|from ['"].*reviewed-overlay\/constants/iu,
    )
    expect(reviewedFunctions).not.toMatch(/\.rpc\(/u)
  })
})
