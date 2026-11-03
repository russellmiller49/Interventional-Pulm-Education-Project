/**
 * Renders the frame bank's simulator stills to `public/dolphin-bronchoscopy/frames/<id>.png`.
 *
 *   npx tsx scripts/dolphin-bronchoscopy/render-frames.mts [frame-id …]
 *
 * Bundles `frame-harness.tsx` with esbuild (no dev server, no sign-in), compiles the Tailwind
 * utilities the airway module uses, serves the bundle beside the dolphin case assets, and
 * screenshots the bronchoscope view of each pose in headless Chromium (SwiftShader WebGL). The
 * label overlays are off; the view's two corner captions are removed before the shot. Each PNG is
 * checked to sit on the centerline label its frame claims.
 */
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, readFile, writeFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { build } from 'esbuild'
import { chromium } from '@playwright/test'

import type { DolphinFrame } from '../../src/features/dolphin-bronchoscopy/content/frameBank'

const root = process.cwd()
// tsx loads the feature module as CommonJS; its exports may sit under `default`.
const frameBank = (await import(
  pathToFileURL(path.join(root, 'src/features/dolphin-bronchoscopy/content/frameBank.ts')).href
)) as {
  DOLPHIN_FRAMES?: readonly DolphinFrame[]
  default?: { DOLPHIN_FRAMES: readonly DolphinFrame[] }
}
const DOLPHIN_FRAMES = frameBank.DOLPHIN_FRAMES ?? frameBank.default!.DOLPHIN_FRAMES
const outDir = path.join(root, 'public/dolphin-bronchoscopy/frames')
const only = new Set(process.argv.slice(2).filter((arg) => !arg.startsWith('--probe=')))
/**
 * `--probe=name:edge:mm[:yaw:pitch]` renders an arbitrary pose to the scratch folder named by
 * DOLPHIN_PROBE_DIR instead of a bank frame, for choosing a pose before it is declared.
 */
const probes = process.argv
  .filter((arg) => arg.startsWith('--probe='))
  .map((arg) => {
    const [name, edge, mm, yaw = '0', pitch = '0'] = arg.slice('--probe='.length).split(':')
    return { id: name, query: `edge=${edge}&mm=${mm}&yaw=${yaw}&pitch=${pitch}`, location: '' }
  })
const frames = [
  ...DOLPHIN_FRAMES.filter(
    (frame) =>
      frame.rights.kind === 'simulator-render' &&
      probes.length === 0 &&
      (only.size === 0 || only.has(frame.id)),
  ).map((frame) => ({ id: frame.id, query: `frame=${frame.id}`, location: frame.location })),
  ...probes,
]
const probeDir = process.env.DOLPHIN_PROBE_DIR

const work = await mkdtemp(path.join(tmpdir(), 'dolphin-frames-'))
await build({
  entryPoints: [path.join(root, 'scripts/dolphin-bronchoscopy/frame-harness.tsx')],
  bundle: true,
  outfile: path.join(work, 'harness.js'),
  format: 'esm',
  jsx: 'automatic',
  loader: { '.json': 'json' },
  alias: { '@': path.join(root, 'src') },
  define: { 'process.env.NODE_ENV': '"production"' },
  banner: { js: 'var process = globalThis.process || { env: {} };' },
  logLevel: 'warning',
})
await writeFile(
  path.join(work, 'input.css'),
  '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n',
)
execFileSync(
  path.join(root, 'node_modules/.bin/tailwindcss'),
  [
    '-c',
    path.join(root, 'tailwind.config.ts'),
    '-i',
    path.join(work, 'input.css'),
    '-o',
    path.join(work, 'harness.css'),
    '--content',
    path.join(root, 'src/components/airway-anatomy/**/*.tsx'),
  ],
  { stdio: 'inherit' },
)
await writeFile(
  path.join(work, 'index.html'),
  '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/harness.css"></head><body style="margin:0;background:#000"><div id="root"></div><script type="module" src="/harness.js"></script></body></html>',
)

const types: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.raw': 'application/octet-stream',
}
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost')
  // DOLPHIN_CASE_DIR serves a case built elsewhere (a scratch build) in place of public/.
  const caseDir = process.env.DOLPHIN_CASE_DIR
  const file =
    caseDir && url.pathname.startsWith('/airway-anatomy/dolphin-001/')
      ? path.join(caseDir, url.pathname.slice('/airway-anatomy/dolphin-001/'.length))
      : url.pathname.startsWith('/airway-anatomy/')
        ? path.join(root, 'public', url.pathname)
        : path.join(work, url.pathname === '/' ? 'index.html' : url.pathname)
  try {
    await stat(file)
    response.writeHead(200, {
      'content-type': types[path.extname(file)] ?? 'application/octet-stream',
    })
    response.end(await readFile(file))
  } catch {
    response.writeHead(404)
    response.end()
  }
})
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
const address = server.address()
const port = typeof address === 'object' && address ? address.port : 0

await mkdir(outDir, { recursive: true })
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({
  viewport: { width: 1000, height: 1400 },
  deviceScaleFactor: 1,
})
const failures: string[] = []
page.on('pageerror', (error) => failures.push(error.message))
for (const frame of frames) {
  await page.goto(`http://127.0.0.1:${port}/?${frame.query}`)
  await page.waitForFunction(() => window.__frameReady === true, null, { timeout: 120000 })
  await page.waitForSelector('[data-airway-optical-view] canvas')
  await page.waitForTimeout(2500)
  const location = await page.evaluate(() => window.__frameLocation)
  if (frame.location && location !== frame.location)
    failures.push(`${frame.id}: the pose sits in ${location}, not ${frame.location}`)
  await page.evaluate(() => {
    for (const element of document.querySelectorAll('[data-airway-optical-view] div')) {
      const text = element.textContent?.trim()
      if (text === 'Virtual bronchoscopy' || text === 'drag to look') element.remove()
    }
    // The on-view steering and drive buttons are controls, not anatomy.
    for (const element of document.querySelectorAll('[data-scope-overlay]')) element.remove()
  })
  const view = page.locator('[data-airway-optical-view]')
  const box = await view.boundingBox()
  const target = frame.location ? outDir : (probeDir ?? work)
  await view.screenshot({ path: path.join(target, `${frame.id}.png`) })
  console.log(
    `${frame.id}: ${Math.round(box?.width ?? 0)}×${Math.round(box?.height ?? 0)} in ${location}`,
  )
}
await browser.close()
server.close()
if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}
