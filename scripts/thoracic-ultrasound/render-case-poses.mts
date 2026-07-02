/**
 * Offline B-mode preview for a thoracic ultrasound case package.
 *
 * Renders the case volume at the preset default pose plus a sweep of
 * variations (or poses you supply) and writes image files, so a new
 * segmentation can be inspected without running the (auth-gated) app.
 *
 * Usage:
 *   npx tsx scripts/thoracic-ultrasound/render-case-poses.mts \
 *     [caseDir=public/module-assets/v1/pleural-ultrasound-simulator/pleural-effusion-001] \
 *     [outDir=<caseDir basename>-preview under the system temp dir] \
 *     [--poses=poses.json]
 *
 * caseDir must contain case.json (manifest v1 or v2) and the labelmap it
 * references. --poses points at JSON of shape { "name": { ...partial probe
 * overrides } }; omitted fields fall back to the preset defaults. On macOS
 * BMPs are auto-converted to PNG via sips.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Minimal ImageData polyfill so the render pipeline runs under Node.
class NodeImageData {
  readonly width: number
  readonly height: number
  readonly data: Uint8ClampedArray
  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.data = new Uint8ClampedArray(width * height * 4)
  }
}
;(globalThis as Record<string, unknown>).ImageData ??= NodeImageData

const { simulateBMode } = await import(
  '../../src/features/thoracic-ultrasound-simulator/engine/simulateBMode'
)
const { normalizeThoracicManifest, buildThoracicVolume } = await import(
  '../../src/features/thoracic-ultrasound-simulator/loader/loadThoracicCase'
)

const args = process.argv.slice(2)
const flags = new Map<string, string>()
const positional: string[] = []
for (const arg of args) {
  const match = arg.match(/^--([a-z-]+)=(.*)$/)
  if (match) flags.set(match[1], match[2])
  else positional.push(arg)
}

const repoRoot = process.cwd()
const caseDir = path.resolve(
  positional[0] ??
    'public/module-assets/v1/pleural-ultrasound-simulator/pleural-effusion-001',
)
const outDir = path.resolve(
  positional[1] ?? path.join(os.tmpdir(), `${path.basename(caseDir)}-preview`),
)

const rawManifest = JSON.parse(fs.readFileSync(path.join(caseDir, 'case.json'), 'utf8'))
const manifest = normalizeThoracicManifest(rawManifest, {
  manifestUrl: `/${path.relative(path.join(repoRoot, 'public'), path.join(caseDir, 'case.json'))}`,
})

// The manifest references the labelmap by public URL; map it back to disk.
const labelmapUrl = manifest.primaryLabelVolume.url
const labelmapPath = labelmapUrl.startsWith('/')
  ? path.join(repoRoot, 'public', labelmapUrl)
  : path.join(caseDir, labelmapUrl)
const labelmapBytes = fs.readFileSync(labelmapPath)
const volume = buildThoracicVolume(
  new Uint8Array(labelmapBytes.buffer, labelmapBytes.byteOffset, labelmapBytes.byteLength),
  manifest.primaryLabelVolume,
)

const preset =
  manifest.probePresets.find((candidate) => candidate.id === manifest.defaultProbePresetId) ??
  manifest.probePresets[0]
const defaults = preset.defaults

let poses: Record<string, Record<string, number>>
const posesFlag = flags.get('poses')
if (posesFlag) {
  poses = JSON.parse(fs.readFileSync(path.resolve(posesFlag), 'utf8'))
} else {
  poses = {
    default: {},
    'lateral-minus': { lateralMm: defaults.lateralMm - 40 },
    'lateral-plus': { lateralMm: defaults.lateralMm + 40 },
    'cranial-40': { craniocaudalMm: defaults.craniocaudalMm + 40 },
    'caudal-40': { craniocaudalMm: defaults.craniocaudalMm - 40 },
    'rotated-45': { rotationDeg: 45 },
    'shallow-8cm': { depthCm: 8 },
  }
}

function writeBmp(
  filePath: string,
  image: { width: number; height: number; data: Uint8ClampedArray },
) {
  const { width, height, data } = image
  const rowSize = Math.ceil((width * 3) / 4) * 4
  const pixelBytes = rowSize * height
  const buffer = Buffer.alloc(54 + pixelBytes)
  buffer.write('BM', 0)
  buffer.writeUInt32LE(54 + pixelBytes, 2)
  buffer.writeUInt32LE(54, 10)
  buffer.writeUInt32LE(40, 14)
  buffer.writeInt32LE(width, 18)
  buffer.writeInt32LE(height, 22)
  buffer.writeUInt16LE(1, 26)
  buffer.writeUInt16LE(24, 28)
  buffer.writeUInt32LE(pixelBytes, 34)
  for (let y = 0; y < height; y += 1) {
    const srcRow = height - 1 - y
    for (let x = 0; x < width; x += 1) {
      const src = (x + srcRow * width) * 4
      const dst = 54 + y * rowSize + x * 3
      buffer[dst] = data[src + 2]
      buffer[dst + 1] = data[src + 1]
      buffer[dst + 2] = data[src]
    }
  }
  fs.writeFileSync(filePath, buffer)
}

fs.mkdirSync(outDir, { recursive: true })

for (const [name, overrides] of Object.entries(poses)) {
  const probe = { ...defaults, ...overrides }
  const started = Date.now()
  const { imageData, metrics } = simulateBMode({
    volume,
    probe,
    width: 520,
    height: 620,
    renderImage: true,
  })
  const bmpPath = path.join(outDir, `${name}.bmp`)
  writeBmp(bmpPath, imageData)
  if (process.platform === 'darwin') {
    spawnSync('sips', ['-s', 'format', 'png', bmpPath, '--out', bmpPath.replace(/\.bmp$/, '.png')], {
      stdio: 'ignore',
    })
    fs.rmSync(bmpPath)
  }
  console.log(
    `${name}: ${Date.now() - started}ms  fluid=${metrics.maxFluidPocketMm.toFixed(0)}mm ` +
      `fluidBeams=${(metrics.fluidBeamFraction * 100).toFixed(0)}% ` +
      `ribShadow=${(metrics.ribShadowBeamFraction * 100).toFixed(0)}% ` +
      `diaphragm=${metrics.diaphragmSeen} lung=${metrics.lungSeen} solidOrgan=${metrics.solidOrganSeen}`,
  )
}

console.log(`\nWrote previews to ${outDir}`)
