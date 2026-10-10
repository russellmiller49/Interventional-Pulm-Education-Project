// Air masks for the Branch Tracing answer planes.
//
// Regenerate (from the repository root; no source CT needed, it reads the shipped PNGs):
//
//   node scripts/branch-tracing/build-answer-plane-air.mjs            # writes the JSON
//   node scripts/branch-tracing/build-answer-plane-air.mjs --report   # prints the reliability table
//
// Output: src/features/bronchial-branch-tracing/geometry/answer-plane-air.json
//
// For every plane a daughter is identified on (every division of every route in
// geometry/branch-decisions.json), it crops the shipped axial PNG around that division's model
// locators and stores which pixels are air (HU at or below AIR_HU). The result band
// (engine/junction-feedback.ts, `optionVerdict`) flood-fills that mask from the learner's mark to
// say which lumen the mark is in.
//
// Each plane is { x0, y0, w, h, runs }. `runs` is a row-major run-length string: alternating
// counts of not-air and air pixels, starting with not-air, separated by spaces. The output is
// deterministic: same PNGs and geometry in, same bytes out.
//
// A new route or division in branch-decisions.json is picked up on the next run. To identify a
// division on a different plane from its export, add it to RESPONSE_PLANE_OVERRIDES here and in
// engine/response-planes.ts and regenerate. `__tests__/answer-plane-air.test.ts` fails when a
// response plane has no mask.

import { readFileSync, writeFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { format } from 'prettier'

const MODULE = 'src/features/bronchial-branch-tracing'
const OUT = `${MODULE}/geometry/answer-plane-air.json`
const SIZE = 512
const SPACING = [0.689453125, 0.689453125, 0.5]
const ORIGIN = [-182.1552734375, -374.1552734375, -368.5]
const HU_FLOOR = -1000
const HU_SPAN = 1400

/** A pixel is air when its PNG value is at or below this: 9 → −950.6 HU, 10 → −945.1 HU. */
export const AIR_BYTE = 9
export const AIR_HU = HU_FLOOR + (AIR_BYTE * HU_SPAN) / 255
/** The flood fill stops this far from the mark; the crop is padded to hold it. */
export const CAP_MM = 12
const PAD_MM = CAP_MM + 4

/**
 * Planes that differ from the route export, by checkpoint id. The same table as
 * src/features/bronchial-branch-tracing/engine/response-planes.ts (a test holds them together):
 * the tracheal bifurcation is identified on slice 372, where the carina shows.
 */
export const RESPONSE_PLANE_OVERRIDES = { 'junction-1': 372 }

const decisions = JSON.parse(readFileSync(`${MODULE}/geometry/branch-decisions.json`))
const routes = JSON.parse(readFileSync(`${MODULE}/geometry/paired-routes.json`))

export function slicePixels(slice) {
  const bytes = readFileSync(
    `public/branch-tracing/native-v1/axial/${String(slice).padStart(3, '0')}.png`,
  )
  const chunks = []
  for (let offset = 8; offset < bytes.length; ) {
    const size = bytes.readUInt32BE(offset)
    if (bytes.toString('ascii', offset + 4, offset + 8) === 'IDAT')
      chunks.push(bytes.subarray(offset + 8, offset + 8 + size))
    offset += size + 12
  }
  const raw = inflateSync(Buffer.concat(chunks))
  const pixels = new Uint8Array(SIZE * SIZE)
  for (let y = 0; y < SIZE; y++) {
    if (raw[y * (SIZE + 1)] !== 0) throw new Error(`Slice ${slice}: filtered PNG row ${y}`)
    pixels.set(raw.subarray(y * (SIZE + 1) + 1, (y + 1) * (SIZE + 1)), y * SIZE)
  }
  return pixels
}

const sliceZ = (slice) => ORIGIN[2] + slice * SPACING[2]
export function edgeCrossings(edgeId, slice) {
  const edge = routes.edges.find((e) => e.id === edgeId)
  if (!edge) return []
  const z = sliceZ(slice)
  const crossings = []
  for (let i = 1; i < edge.points.length; i++) {
    const a = edge.points[i - 1],
      b = edge.points[i]
    if ((z - a[2]) * (z - b[2]) > 0 || a[2] === b[2]) continue
    const f = (z - a[2]) / (b[2] - a[2])
    const pixel = [0, 1].map(
      (axis) => (a[axis] + f * (b[axis] - a[axis]) - ORIGIN[axis]) / SPACING[axis],
    )
    if (!crossings.some((c) => Math.hypot(c[0] - pixel[0], c[1] - pixel[1]) < 1))
      crossings.push(pixel)
  }
  return crossings
}

/** Every division once, by graph node: [{ id, decision }]. */
export function divisions() {
  const seen = new Map()
  for (const trace of decisions.traces)
    for (const point of trace.checkpoints)
      if (point.decision && !seen.has(point.id)) seen.set(point.id, point.decision)
  return [...seen].map(([id, decision]) => ({ id, decision }))
}

/** Where each daughter of a division is identified: the export's plane, or its override. */
export function responsePoints(id, decision) {
  const override = RESPONSE_PLANE_OVERRIDES[id]
  return decision.options.map((option) => {
    if (override === undefined || override === option.slice)
      return { option, slice: option.slice, pixel: option.pixel }
    const pixel = edgeCrossings(option.sourceEdgeId, override)[0]
    return pixel
      ? { option, slice: override, pixel }
      : { option, slice: option.slice, pixel: option.pixel }
  })
}

/** slice → the model points the crop must hold. */
export function planeRequests() {
  const planes = new Map()
  const need = (slice, pixel) => {
    if (!planes.has(slice)) planes.set(slice, [])
    planes.get(slice).push(pixel)
  }
  for (const { id, decision } of divisions()) {
    const points = responsePoints(id, decision)
    for (const point of points) {
      need(point.slice, point.pixel)
      for (const other of points)
        if (other !== point)
          for (const pixel of other.slice === point.slice
            ? [other.pixel]
            : edgeCrossings(other.option.sourceEdgeId, point.slice))
            need(point.slice, pixel)
      for (const pixel of edgeCrossings(decision.parent.sourceEdgeId, point.slice))
        need(point.slice, pixel)
    }
  }
  return planes
}

export function buildPlanes() {
  const pad = Math.ceil(PAD_MM / SPACING[0])
  const out = {}
  for (const [slice, points] of [...planeRequests()].sort((a, b) => a[0] - b[0])) {
    const pixels = slicePixels(slice)
    const x0 = Math.max(0, Math.floor(Math.min(...points.map((p) => p[0]))) - pad)
    const y0 = Math.max(0, Math.floor(Math.min(...points.map((p) => p[1]))) - pad)
    const x1 = Math.min(SIZE - 1, Math.ceil(Math.max(...points.map((p) => p[0]))) + pad)
    const y1 = Math.min(SIZE - 1, Math.ceil(Math.max(...points.map((p) => p[1]))) + pad)
    const runs = []
    let air = false,
      count = 0
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const isAir = pixels[y * SIZE + x] <= AIR_BYTE
        if (isAir === air) count++
        else {
          runs.push(count)
          air = isAir
          count = 1
        }
      }
    runs.push(count)
    out[slice] = { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1, runs: runs.join(' ') }
  }
  return out
}

// ── Report: how far the chosen threshold sits from a leak, for every marked lumen ─────────────
function fill(pixels, seed, byte, capMm, centre = seed) {
  const cap = capMm / SPACING[0]
  const seen = new Set()
  const start = seed[1] * SIZE + seed[0]
  if (pixels[start] > byte) return seen
  const stack = [start]
  seen.add(start)
  while (stack.length) {
    const at = stack.pop()
    const x = at % SIZE,
      y = (at - x) / SIZE
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy
      if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue
      if (Math.hypot(nx - centre[0], ny - centre[1]) > cap) continue
      const next = ny * SIZE + nx
      if (seen.has(next) || pixels[next] > byte) continue
      seen.add(next)
      stack.push(next)
    }
  }
  return seen
}
function seedNear(pixels, pixel, byte, snapMm = 1.5) {
  const r = Math.ceil(snapMm / SPACING[0])
  let best = null
  for (let y = Math.round(pixel[1]) - r; y <= Math.round(pixel[1]) + r; y++)
    for (let x = Math.round(pixel[0]) - r; x <= Math.round(pixel[0]) + r; x++) {
      const d = Math.hypot(x - pixel[0], y - pixel[1]) * SPACING[0]
      if (d > snapMm || pixels[y * SIZE + x] > byte) continue
      if (!best || d < best.d) best = { d, seed: [x, y] }
    }
  return best?.seed ?? null
}
const hu = (byte) => Math.round(HU_FLOOR + (byte * HU_SPAN) / 255)

function report() {
  const rows = []
  const targets = divisions().flatMap(({ id, decision }) =>
    responsePoints(id, decision).map((point, slot) => ({
      id,
      slot,
      code: point.option.airway.code,
      slice: point.slice,
      pixel: point.pixel,
    })),
  )
  for (const t of targets) {
    const pixels = slicePixels(t.slice)
    const seed = seedNear(pixels, t.pixel, AIR_BYTE)
    const at = pixels[Math.round(t.pixel[1]) * SIZE + Math.round(t.pixel[0])]
    if (!seed) {
      rows.push(`${t.id} slot ${t.slot} ${t.code} @${t.slice}: locator ${hu(at)} HU, NO AIR SEED`)
      continue
    }
    const base = fill(pixels, seed, AIR_BYTE, CAP_MM).size
    // The lowest threshold at which the lumen's region at least doubles: the first leak.
    let leak = null
    for (let byte = AIR_BYTE + 1; byte <= 60 && leak === null; byte++)
      if (fill(pixels, seed, byte, CAP_MM).size > Math.max(2 * base, base + 40)) leak = byte
    // The lowest threshold at which the locator has an air seed at all.
    let first = AIR_BYTE
    while (first > 0 && seedNear(pixels, t.pixel, first - 1)) first--
    rows.push(
      `${t.id} slot ${t.slot} ${t.code} @${t.slice}: locator ${hu(at)} HU; seed from ${hu(first)} HU; ` +
        `lumen ${(base * SPACING[0] * SPACING[1]).toFixed(1)} mm² at ${hu(AIR_BYTE)}; ` +
        `first leak at ${leak === null ? '> −670' : hu(leak)} HU (margin ${leak === null ? '> 280' : hu(leak) - hu(AIR_BYTE)} HU)`,
    )
  }
  console.log(rows.join('\n'))
}

if (process.argv[1]?.endsWith('build-answer-plane-air.mjs')) {
  if (process.argv.includes('--report')) report()
  else {
    const planes = buildPlanes()
    const body = {
      note: 'Generated by scripts/branch-tracing/build-answer-plane-air.mjs from the shipped native-v1 axial PNGs. Do not edit by hand.',
      airHu: Number(AIR_HU.toFixed(1)),
      airByte: AIR_BYTE,
      capMm: CAP_MM,
      planes,
    }
    writeFileSync(OUT, await format(JSON.stringify(body), { parser: 'json' }))
    console.log(`Wrote ${Object.keys(planes).length} answer planes to ${OUT}`)
  }
}
