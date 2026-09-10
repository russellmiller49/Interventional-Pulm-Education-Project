import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

for (const app of ['bronch-navigation-trainer', 'socal-ebus-course']) {
  test(`${app} embeds a complete locally built entry point`, () => {
    const directory = resolve(root, 'public', app, 'app')
    const html = readFileSync(resolve(directory, 'index.html'), 'utf8')
    const assets = [...html.matchAll(/(?:src|href)="(\/[^"?#]+)(?:[?#][^"]*)?"/g)]
    assert.ok(assets.length > 0, 'The app must reference built assets')
    for (const [, url] of assets) {
      assert.ok(url.startsWith(`/${app}/app/`), `Wrong embedded asset base: ${url}`)
      assert.ok(existsSync(resolve(root, 'public', url.slice(1))), `Missing asset: ${url}`)
    }
  })
}

test('navigation build has case data and omits authoring candidate overlays', () => {
  const directory = resolve(root, 'public/bronch-navigation-trainer/app/cases/default')
  for (const name of [
    'case.json',
    'scope_calibration.json',
    'airway_surface.stl',
    'ct_uint8.raw',
  ]) {
    assert.ok(existsSync(resolve(directory, name)), `Missing navigation payload: ${name}`)
  }
  const files = readdirSync(directory)
  assert.ok(!files.includes('book_candidates.json'))
  assert.ok(!files.includes('manual_inferred_candidates.json'))
})

test('both controller adapters resolve to the same repository source', () => {
  for (const app of [
    'navigation_module/web/src/scope-input',
    'EBUS-course/apps/web/src/lib/scope-input',
  ]) {
    const directory = resolve(root, app)
    const source = readFileSync(resolve(directory, 'index.ts'), 'utf8')
    const [, target] = source.match(/export \* from '([^']+)'/)
    assert.equal(resolve(directory, target), resolve(root, 'src/lib/scope-input/core'))
    assert.deepEqual(readdirSync(directory), ['index.ts'])
  }
})
