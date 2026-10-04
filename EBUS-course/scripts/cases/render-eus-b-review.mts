/**
 * Offline review of the EUS-B case: renders the simulated sector at every calibrated landmark and
 * writes one PNG per landmark, plain and structure-tinted contact sheets, and a JSON summary of
 * what each frame contains.
 *
 * Bundle first; tsx cannot load the shared renderer's named exports from an .mts entry:
 *
 *   npx esbuild EBUS-course/scripts/cases/render-eus-b-review.mts --bundle --platform=node \
 *     --format=esm --external:sharp --outfile=artifacts/eus-b-review/review.mjs
 *   node artifacts/eus-b-review/review.mjs
 *
 * Output goes to artifacts/eus-b-review (ignored by Git) unless EUS_B_REVIEW_OUTPUT is set.
 * Rerun it after rebuilding the case or tuning eusAcoustic.ts, and read the learner-facing
 * landmark notes in content.ts against the sheets: each note describes one of these frames.
 */
import fs from 'node:fs'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import sharp from 'sharp'
import { DEFAULT_EUS_CONTROLS, renderEusFrame } from '../../apps/web/src/features/eus-b-simulator/eusAcoustic'
import { computeEusPose, describeFacing } from '../../apps/web/src/features/eus-b-simulator/eusPose'
import type {
  EusAcousticVolume,
  EusCaseManifest,
  EusScopePath,
} from '../../apps/web/src/features/eus-b-simulator/types'

const root = path.resolve(
  process.env.EUS_B_REVIEW_CASE_DIR ?? 'EBUS-course/apps/web/public/simulator/eus-b-case-001',
)
const output = path.resolve(process.env.EUS_B_REVIEW_OUTPUT ?? 'artifacts/eus-b-review')
fs.mkdirSync(output, { recursive: true })
const json = <T,>(name: string): T => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'))
const manifest = json<EusCaseManifest>('case_manifest.json')
const scopePath = json<EusScopePath>(manifest.assets.path)
const volume: EusAcousticVolume = {
  metadata: json(manifest.assets.acoustic.metadata),
  data: new Uint8Array(gunzipSync(fs.readFileSync(path.join(root, manifest.assets.acoustic.data)))),
}
const size = 512
const tiles: Array<{ input: Buffer; left: number; top: number }> = []
const labeledTiles: typeof tiles = []
const colors = new Map(
  manifest.structures.map((s) => [
    s.key,
    [1, 3, 5].map((at) => parseInt(s.color.slice(at, at + 2), 16)),
  ]),
)
const results = []
const columns = 4
for (const [index, landmark] of manifest.landmarks.entries()) {
  const pose = computeEusPose(scopePath, landmark)
  const depthMm = Number(process.env.EUS_B_REVIEW_DEPTH ?? manifest.probe.defaultDepthMm)
  const frame = renderEusFrame(
    volume,
    { originLps: pose.originLps, depthAxisLps: pose.depthAxisLps, lateralAxisLps: pose.lateralAxisLps },
    { ...DEFAULT_EUS_CONTROLS, depthMm, sectorAngleDeg: manifest.probe.sectorAngleDeg },
    size,
    size,
  )
  const visible = frame.structures
    .map((s) => ({ key: volume.metadata.labels[s.id].key, pixels: s.count }))
    .sort((a, b) => b.pixels - a.pixels)
  const caption = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><text x="8" y="18" font-family="Helvetica" font-size="14" fill="#ffe27a">${landmark.key} · s ${landmark.sMm} · roll ${landmark.rollDeg}</text></svg>`,
  )
  const png = await sharp(Buffer.from(frame.rgba), { raw: { width: size, height: size, channels: 4 } })
    .composite([{ input: caption }])
    .png()
    .toBuffer()
  fs.writeFileSync(path.join(output, `${landmark.key}.png`), png)
  tiles.push({ input: png, left: (index % columns) * size, top: Math.floor(index / columns) * size })
  // Same frame with each segmented structure tinted, to check the image against the anatomy.
  const tinted = Buffer.from(frame.rgba)
  for (let i = 0; i < frame.labelImage.length; i++) {
    const color = colors.get(volume.metadata.labels[frame.labelImage[i]]?.key ?? '')
    if (!color) continue
    for (let c = 0; c < 3; c++) tinted[i * 4 + c] = Math.round(tinted[i * 4 + c] * 0.5 + color[c] * 0.5)
  }
  labeledTiles.push({
    input: await sharp(tinted, { raw: { width: size, height: size, channels: 4 } })
      .composite([{ input: caption }])
      .png()
      .toBuffer(),
    left: (index % columns) * size,
    top: Math.floor(index / columns) * size,
  })
  results.push({
    landmark: landmark.key,
    sMm: landmark.sMm,
    rollDeg: landmark.rollDeg,
    region: pose.region,
    facing: describeFacing(pose.depthAxisLps),
    contactMm: Number(pose.contactMm.toFixed(1)),
    targetVisible: visible.some((s) => s.key === landmark.key),
    visible,
  })
}
await sharp({
  create: {
    width: columns * size,
    height: Math.ceil(manifest.landmarks.length / columns) * size,
    channels: 3,
    background: '#000',
  },
})
  .composite(tiles)
  .png()
  .toFile(path.join(output, 'contact-sheet.png'))
await sharp({
  create: {
    width: columns * size,
    height: Math.ceil(manifest.landmarks.length / columns) * size,
    channels: 3,
    background: '#000',
  },
})
  .composite(labeledTiles)
  .png()
  .toFile(path.join(output, 'contact-sheet-labeled.png'))
fs.writeFileSync(
  path.join(output, 'landmark-review.json'),
  JSON.stringify({ assetVersion: manifest.assetVersion, results }, null, 2) + '\n',
)
console.log(
  results
    .map(
      (r) =>
        `${r.landmark.padEnd(22)} ${r.region.padEnd(9)} ${String(r.targetVisible).padEnd(5)} ${r.facing.padEnd(28)} ${r.visible
          .slice(0, 5)
          .map((s) => s.key)
          .join(', ')}`,
    )
    .join('\n'),
)
