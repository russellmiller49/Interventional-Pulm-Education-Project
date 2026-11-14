/**
 * Render the teaching stills: pictures drawn from the course's own 3D airway for teaching screens.
 *
 *   node scripts/bronchoscopy-foundations/render-teaching-stills.mjs [id ...]
 *
 * Builds `render-teaching-stills.browser.mts` into a temporary page, renders each still in headless
 * Chromium through the shipping Draco decoder, and writes JPEGs to
 * `public/bronchoscopy-foundations/renders/` with `renders.json` beside them (size and checksum of
 * each file). With ids, only those stills are rendered; the manifest is rewritten for all files.
 */
import { createServer } from 'node:http'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { build } from 'esbuild'
import { chromium } from '@playwright/test'
import prettier from 'prettier'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const cache = path.join(root, 'artifacts/teaching-stills')
const out = path.join(root, 'public/bronchoscopy-foundations/renders')
const only = process.argv.slice(2)
await mkdir(cache, { recursive: true })
await mkdir(out, { recursive: true })
await build({
  entryPoints: [
    path.join(root, 'scripts/bronchoscopy-foundations/render-teaching-stills.browser.mts'),
  ],
  bundle: true,
  format: 'esm',
  outfile: path.join(cache, 'stills.js'),
  logLevel: 'silent',
  define: { 'process.env.NODE_ENV': '"production"' },
})
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost').pathname
    if (url === '/') {
      res.setHeader('Content-Type', 'text/html')
      res.end(
        '<!doctype html><title>Teaching stills</title><script type="module" src="/build/stills.js"></script>',
      )
      return
    }
    const base = url.startsWith('/build/') ? cache : path.join(root, 'public')
    const filename = path.resolve(base, url.startsWith('/build/') ? url.slice(7) : url.slice(1))
    if (!filename.startsWith(base + path.sep)) {
      res.writeHead(403)
      res.end()
      return
    }
    res.setHeader(
      'Content-Type',
      {
        '.js': 'text/javascript',
        '.wasm': 'application/wasm',
        '.json': 'application/json',
        '.glb': 'model/gltf-binary',
      }[path.extname(filename)] ?? 'application/octet-stream',
    )
    res.end(await readFile(filename))
  } catch {
    res.writeHead(404)
    res.end()
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
let browser
try {
  browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })
  const page = await browser.newPage({
    viewport: { width: 1200, height: 900 },
    deviceScaleFactor: 1,
  })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`http://127.0.0.1:${server.address().port}/`)
  await page.waitForFunction(() => Boolean(globalThis.teachingStills), null, { timeout: 180000 })
  const { ids, size } = await page.evaluate(() => ({
    ids: globalThis.teachingStills.ids,
    size: globalThis.teachingStills.size,
  }))
  const unknown = only.filter((id) => !ids.includes(id))
  if (unknown.length) throw new Error(`No such still: ${unknown.join(', ')}`)
  for (const id of only.length ? only : ids) {
    await page.evaluate((id) => globalThis.teachingStills.render(id), id)
    await page
      .locator('canvas')
      .screenshot({ path: path.join(out, `${id}.jpg`), type: 'jpeg', quality: 88 })
    console.log(`rendered ${id}`)
  }
  if (errors.length) throw new Error(errors.join('\n'))
  const files = (await readdir(out)).filter((name) => name.endsWith('.jpg')).sort()
  const stray = files.filter((name) => !ids.includes(name.slice(0, -4)))
  if (stray.length) throw new Error(`Files with no still behind them: ${stray.join(', ')}`)
  const manifest = {
    schema: 'bronchoscopy_foundations_teaching_stills/v1',
    generatedBy: 'scripts/bronchoscopy-foundations/render-teaching-stills.mjs',
    origin:
      'Drawn from the teaching airway model. Blood, devices and the scope are authored shapes placed in it. Not photographs.',
    width: size[0],
    height: size[1],
    stills: await Promise.all(
      files.map(async (name) => {
        const bytes = await readFile(path.join(out, name))
        return {
          id: name.slice(0, -4),
          file: name,
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        }
      }),
    ),
  }
  const options = await prettier.resolveConfig(path.join(root, 'package.json'))
  await writeFile(
    path.join(out, 'renders.json'),
    await prettier.format(JSON.stringify(manifest), { ...options, parser: 'json' }),
  )
} finally {
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
}
