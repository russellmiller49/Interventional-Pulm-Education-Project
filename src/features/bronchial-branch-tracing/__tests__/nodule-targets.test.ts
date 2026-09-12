import { readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import manifest from '../../../../public/branch-tracing/targets-v1/manifest.json'
import native from '../../../../public/branch-tracing/native-v1/manifest.json'
import donorCase from '../../../../navigation_module/web/public/cases/default/case.json'
import { residualHuAt, type CtResidualOverlay } from '@/lib/bronchoscopy-core/ct-overlay'
import type { Point3 } from '@/lib/bronchoscopy-core/frame'
import { CT_TRACES, NATIVE_CT, nativeImageUrl, targetForTrace } from '../geometry/native-ct'
import { SEGMENT_PRACTICE_TRACES } from '../content/practice'

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const gray = (hu: number) => Math.round(Math.max(0, Math.min(1, (hu + 1000) / 1400)) * 255)
function decode(path: string) {
  const b = readFileSync(path),
    width = b.readUInt32BE(16),
    height = b.readUInt32BE(20)
  expect(b[24]).toBe(8)
  const channels = b[25] === 6 ? 4 : 1
  expect([0, 6]).toContain(b[25])
  const chunks: Buffer[] = []
  for (let offset = 8; offset < b.length; ) {
    const size = b.readUInt32BE(offset)
    if (b.toString('ascii', offset + 4, offset + 8) === 'IDAT')
      chunks.push(b.subarray(offset + 8, offset + 8 + size))
    offset += size + 12
  }
  const raw = inflateSync(Buffer.concat(chunks)),
    stride = width * channels + 1
  expect(raw.length).toBe(stride * height)
  for (let y = 0; y < height; y++) expect(raw[y * stride]).toBe(0)
  return {
    width,
    height,
    channels,
    at: (x: number, y: number, c = 0) => raw[y * stride + 1 + x * channels + c],
  }
}

test('target derivatives are bounded, hash checked and leave every original native slice untouched', () => {
  expect(manifest.sourceSha256).toBe(native.sourceSha256)
  expect(manifest.sourceGraphSha256).toBe(native.sourceGraphSha256)
  expect(manifest.sourceLabeledGraphSha256).toBe(native.nomenclature.sourceLabeledGraphSha256)
  expect(manifest.targets).toHaveLength(13)
  expect(new Set(manifest.targets.map((t) => t.segment.code)).size).toBe(10)
  expect(manifest.assets.reduce((n, a) => n + a.bytes, 0)).toBeLessThan(1_200_000)
  const paths = readdirSync('public/branch-tracing/targets-v1', { recursive: true })
    .filter((p) => String(p).endsWith('.png'))
    .map(String)
    .sort()
  expect(paths).toEqual(manifest.assets.map((a) => a.path).sort())
  for (const a of manifest.assets) {
    const bytes = readFileSync(`public/branch-tracing/targets-v1/${a.path}`)
    expect(bytes.length).toBe(a.bytes)
    expect(sha(bytes)).toBe(a.sha256)
  }
  for (const a of native.assets)
    expect(sha(readFileSync(`public/branch-tracing/native-v1/${a.path}`))).toBe(a.sha256)
})

test('native target pixels use the trainer residual HU calculation before windowing, with a changing 3D footprint', () => {
  const donor = donorCase.noduleAsset
  const bytes = readFileSync(`navigation_module/web/public/cases/default/${donor.residualRaw}`)
  const alpha = readFileSync(`navigation_module/web/public/cases/default/${donor.alphaRaw}`)
  expect(sha(bytes)).toBe(manifest.donor.residualSha256)
  expect(sha(alpha)).toBe(manifest.donor.alphaSha256)
  expect(sha(readFileSync('src/lib/bronchoscopy-core/ct-overlay.ts'))).toBe(
    manifest.donor.compositorSha256,
  )
  const residual = new Int16Array(bytes.length / 2)
  for (let i = 0; i < residual.length; i++) residual[i] = bytes.readInt16LE(i * 2)
  const overlay: CtResidualOverlay = {
    geometry: {
      sizeXyz: donor.sizeXyz as Point3,
      spacingXyzMm: donor.spacingXyzMm.map((v) => v * manifest.donor.scale) as Point3,
      originLps: [0, 0, 0],
      directionLps: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    },
    residual,
    alpha: new Uint8Array(alpha),
  }
  for (const target of manifest.targets) {
    const origin = target.centerLps.map(
      (v, i) => v - donor.centroidIndexXyz[i] * overlay.geometry.spacingXyzMm[i],
    ) as Point3
    const [x, y] = target.pixel.map(Math.round)
    const lps = [x, y, target.slice].map(
      (v, i) => NATIVE_CT.origin[i] + v * NATIVE_CT.spacing[i],
    ) as Point3
    const base = decode(`public${nativeImageUrl(target.slice)}`)
    expect(base.at(x, y)).toBe(gray(target.centerSourceHu))
    expect(target.centerSourceHu).toBeLessThan(-700)
    const frame = target.patch.frames.find((f) => f.slice === target.slice)!
    const patch = decode(`public/branch-tracing/targets-v1/${frame.path}`)
    const px = x - target.patch.originPixel[0],
      py = y - target.patch.originPixel[1]
    expect(patch.at(px, py, 3)).toBe(255)
    expect(
      Math.abs(patch.at(px, py) - gray(target.centerSourceHu + residualHuAt(overlay, lps, origin))),
    ).toBeLessThanOrEqual(1)
    expect(patch.at(px, py) - base.at(x, y)).toBeGreaterThan(25)
    expect(target.patch.frames.length).toBeGreaterThan(10)
    expect(new Set(target.patch.frames.map((f) => f.changedPixels)).size).toBeGreaterThan(8)
    for (const frame of target.patch.frames) {
      const p = decode(`public/branch-tracing/targets-v1/${frame.path}`)
      expect([p.width, p.height]).toEqual(target.patch.size)
      let changed = 0
      for (let j = 0; j < p.height; j++)
        for (let i = 0; i < p.width; i++) {
          const a = p.at(i, j, 3)
          expect(a === 0 || a === 255).toBe(true)
          if (a) {
            changed++
            expect(p.at(i, j)).toBe(p.at(i, j, 1))
            expect(p.at(i, j)).toBe(p.at(i, j, 2))
          }
        }
      expect(changed).toBe(frame.changedPixels)
    }
    // The reference point stays in visible air before the nodule, rather than marking its centre.
    expect(target.approach.sourceHu).toBeLessThan(-850)
    expect(Math.abs(residualHuAt(overlay, target.approach.lps as Point3, origin))).toBeLessThan(1.1)
  }
})

test('complete routes preserve target placement, the c3 source fixtures and all browsing planes', () => {
  const graph: { edges: { id: number; startNodeId: number; endNodeId: number }[] } = JSON.parse(
    readFileSync('public/fluoroview/cases/patient-new/metadata/airway_graph.json', 'utf8'),
  )
  const labels = JSON.parse(
    readFileSync('public/airway-anatomy/case-001/metadata/centerline_labels.json', 'utf8'),
  ).edgeLabels
  for (const trace of CT_TRACES) {
    const target = targetForTrace(trace),
      original = native.traces.find((t) => t.id === trace.id)!
    for (let i = 0; i < 2; i++) {
      expect(manifest.traces.find((t) => t.id === trace.id)!.checkpoints[i].lps).toEqual(
        original.checkpoints[i].lps,
      )
      expect(manifest.traces.find((t) => t.id === trace.id)!.checkpoints[i].sourceEdgeId).toBe(
        original.checkpoints[i].sourceEdgeId,
      )
    }
    const terminal = trace.sourceEdgeIds.at(-1)!
    expect(labels[terminal].abbreviatedLabel).toBe(target.segment.bronchusCode)
    expect(trace.checkpoints.at(-1)!.airway.code).toBe(target.approachCode)
    expect(trace.sourceEdgeIds).toContain(trace.checkpoints.at(-1)!.sourceEdgeId)
    for (let i = 1; i < trace.sourceEdgeIds.length; i++)
      expect(graph.edges.find((e) => e.id === trace.sourceEdgeIds[i - 1])!.endNodeId).toBe(
        graph.edges.find((e) => e.id === trace.sourceEdgeIds[i])!.startNodeId,
      )
    expect(trace.range[0]).toBeLessThan(target.slice)
    expect(trace.range[1]).toBeGreaterThan(target.slice)
    for (let k = trace.range[0]; k <= trace.range[1]; k++)
      expect(readFileSync(`public${nativeImageUrl(k)}`).length).toBeGreaterThan(0)
  }
  expect(
    new Set(
      SEGMENT_PRACTICE_TRACES.map(
        (id) => targetForTrace(CT_TRACES.find((t) => t.id === id)!).segment.code,
      ),
    ).size,
  ).toBe(10)
})
