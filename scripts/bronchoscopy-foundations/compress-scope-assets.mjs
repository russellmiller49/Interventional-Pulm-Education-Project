/** Compress only generated assets. Source files and the teaching graph are read-only. */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pipeline from 'gltf-pipeline'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const files = {
  lumen: ['lumen.raw.glb', 'adult-teaching-combined-left-basal-v1/lumen.glb'],
  larynx: ['larynx.raw.glb', 'larynx/larynx-lumen.glb'],
  accessories: ['accessories.raw.glb', 'devices/accessories.glb'],
}
const requested = process.argv.slice(2)
if (!requested.length || requested.some((part) => !files[part]))
  throw new Error(
    'Usage: node scripts/bronchoscopy-foundations/compress-scope-assets.mjs lumen|larynx|accessories [...]',
  )
for (const part of requested) {
  const [source, destination] = files[part]
  const input = await readFile(path.join(root, 'artifacts/scope-assets', source))
  const { glb } = await pipeline.processGlb(input, {
    dracoOptions: { compressionLevel: 10, quantizePositionBits: 20, quantizeNormalBits: 12 },
    keepUnusedElements: true,
  })
  const output = path.join(root, 'public/bronchoscopy-foundations/anatomy', destination)
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, glb)
  console.log(`${destination}: ${input.length} -> ${glb.length} bytes`)
}
