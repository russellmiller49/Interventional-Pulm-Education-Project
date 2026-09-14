/** Focused runtime check; the course journey separately verifies parent gating and persistence. */
import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { MODEL_PACKAGES } from '../../src/lib/ebus-model-contract'
import { performModel } from './browser-model-actions'
async function main() {
  const base = process.env.EBUS_MODEL_STATIC_URL ?? 'http://127.0.0.1:3147'
  const out = 'artifacts/ebus-guided/additional-models'
  await mkdir(out, { recursive: true })
  const b = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })
  const p = await b.newPage({ viewport: { width: 1100, height: 1050 } })
  const errors: string[] = []
  p.on('pageerror', (e) => errors.push(e.message))
  try {
    for (const pkg of MODEL_PACKAGES) {
      const config = {
        sessionId: 'runtime-' + pkg,
        kind: 'model',
        modelPackage: pkg,
        presetKey: pkg,
        controls: [],
        locked: false,
        reveal: false,
        view: 'sector',
        initialRoll: 0,
        initialDepth: 40,
        initialGain: 0,
      }
      await p.route('**/model-harness', (r) =>
        r.fulfill({
          contentType: 'text/html',
          body: `<body style="margin:0;background:#081523"><iframe title="model" style="width:650px;height:1040px;border:0" src="/socal-ebus-course/app/guided.html"></iframe><script>const config=${JSON.stringify(config)};addEventListener('message',e=>{if(e.data.type==='ready')e.source.postMessage({version:1,type:'configure',config},location.origin);if(e.data.type==='observation')window.lastObservation=e.data.observation})</script></body>`,
        }),
      )
      await p.goto(base + '/model-harness')
      const f = p.frameLocator('iframe')
      await performModel(f, pkg)
      await p.screenshot({ path: `${out}/${pkg}-runtime-complete.png` })
      if (pkg === 'measurement') {
        const d = p.waitForEvent('download')
        await f.getByRole('button', { name: 'Download phantom image', exact: true }).click()
        await (await d).saveAs(out + '/recorded-phantom.svg')
      }
      await f.getByRole('button', { name: 'Reset activity', exact: true }).click()
      await expect(
        f.getByText('Required model actions recorded. Continue in the Steps panel.'),
      ).toHaveCount(0)
      console.log('RUNTIME PASS', pkg)
      await p.unroute('**/model-harness')
    }
    expect(errors).toEqual([])
    await writeFile(out + '/runtime-result.json', JSON.stringify({ packages: 4, errors }, null, 2))
  } catch (e) {
    await p.screenshot({ path: out + '/runtime-failure.png' })
    throw e
  } finally {
    await b.close()
  }
}
main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
