/** @jest-environment node */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { layoutsAbove, resolveRouteDirectories } from '../../../scripts/module-beta/hub-route-files'
import { betaModules, feedbackReviewModules } from './catalog'

const repoRoot = path.resolve(__dirname, '../../..')
const appRoot = path.join(repoRoot, 'src/app/[locale]')

/*
 * A layout that calls the draft guard answers 404 in production to everyone but a site admin, while
 * a development server always lets the page through — so the hub's browser suite cannot see it, and
 * two hub modules stayed unreachable for testers that way. These two layouts call the guard only
 * while their own release stage is not open by direct link; each has a layout test showing the
 * current stage does not reach it.
 */
const stageConditionalGuards = new Set([
  'src/app/[locale]/baxter-crrt/layout.tsx',
  'src/app/[locale]/mechanical-ventilation/layout.tsx',
])

describe('a tester can open every hub module', () => {
  it.each(betaModules)('$id has a page with no unconditional draft guard above it', (entry) => {
    const directories = resolveRouteDirectories(appRoot, entry.path)
    expect(directories).not.toBeNull()
    const guarded = layoutsAbove(directories ?? [])
      .filter((layout) => readFileSync(layout, 'utf8').includes('@/lib/draft-module-guard'))
      .map((layout) => path.relative(repoRoot, layout))
      .filter((layout) => !stageConditionalGuards.has(layout))
    expect(guarded).toEqual([])
  })

  it.each(betaModules)('$id may be framed by the testing page', (entry) => {
    const config = readFileSync(path.join(repoRoot, 'next.config.mjs'), 'utf8')
    expect(config).toContain(`'${entry.path}/:path*'`)
  })

  it('the newest feedback migration accepts every module a report can name', () => {
    const directory = path.join(repoRoot, 'supabase/migrations')
    const newest = readdirSync(directory)
      .sort()
      .map((name) => readFileSync(path.join(directory, name), 'utf8'))
      .filter((sql) => sql.includes('add constraint module_beta_feedback_module_id_check'))
      .at(-1)
    expect(newest).toBeDefined()
    for (const entry of feedbackReviewModules) expect(newest).toContain(`'${entry.id}'`)
  })
})
