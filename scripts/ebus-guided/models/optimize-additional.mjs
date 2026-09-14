/** Lossless packaging only: never simplify geometry or flatten semantic/device pivots. */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { localDataPath } from '../../local-data-root.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const directory = resolve(root, 'EBUS-course/apps/web/public/simulator/case-001/models/guided-v2')
const scratch = localDataPath('raw-assets', 'ebus-guided-models', 'additional', 'optimized')
mkdirSync(scratch, { recursive: true })
const path = resolve(directory, 'asset-manifest.json')
const manifest = JSON.parse(readFileSync(path, 'utf8'))
for (const asset of manifest.assets) {
  const input = resolve(directory, asset.path),
    output = resolve(scratch, asset.path)
  const result = spawnSync(
    'npm',
    [
      'exec',
      '--yes',
      '--package=@gltf-transform/cli@4.5.0',
      '--',
      'gltf-transform',
      'dedup',
      input,
      output,
      '--meshes',
      'false',
      '--skins',
      'false',
    ],
    { stdio: 'inherit', cwd: root },
  )
  if (result.status !== 0) throw new Error('glTF optimization failed: ' + asset.path)
  const data = readFileSync(output),
    gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString())
  const names = new Set(gltf.nodes.map((node) => node.name))
  for (const object of asset.objects) {
    if (!names.has(object.id))
      throw new Error('Optimizer removed semantic node or pivot ' + object.id)
  }
  writeFileSync(input, data)
  asset.bytes = data.length
  asset.sha256 = createHash('sha256').update(data).digest('hex')
  asset.materials = gltf.materials?.length ?? 0
  asset.optimization =
    'glTF Transform 4.5.0: accessor/material/texture deduplication; no quantization, simplification, hierarchy flattening or decoder'
}
writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n')
console.log(
  'Optimized bytes:',
  manifest.assets.reduce((total, asset) => total + asset.bytes, 0),
)
