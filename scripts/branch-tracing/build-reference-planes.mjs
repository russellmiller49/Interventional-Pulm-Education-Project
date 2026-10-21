// Coronal and sagittal reference planes for Branch Tracing.
//
// Regenerate (from the repository root; no source CT needed, it reads the shipped axial PNGs):
//
//   node scripts/branch-tracing/build-reference-planes.mjs            # writes public/branch-tracing/mpr-v1
//   node scripts/branch-tracing/build-reference-planes.mjs --report   # prints the byte totals, writes nothing
//
// The shipped axial PNGs are a per-voxel window of the native CT (round(clip((HU + 1000) / 1400) *
// 255)), so a coronal or sagittal plane rebuilt from them is the same window of the same voxels:
// nothing is resampled. Inputs are native-v1 axial 240–475 and the targets-v1 extra planes 239 and
// 476–478.
//
// Output, all under public/branch-tracing/mpr-v1:
//   coronal/<j>.png   one plane per row j (fixed j). Image rows are slices k with the most
//                     superior slice at the top; columns are i, so patient right is screen-left.
//   sagittal/<i>.png  one plane per column i (fixed i). Rows are k, superior at the top; columns
//                     are j, so anterior is screen-left.
//   patches/<lesion>/{coronal,sagittal}.png
//                     the targets-v1 axial lesion patches resliced the same way, one sprite per
//                     lesion and plane: every plane through the patch, stacked top to bottom in
//                     plane order.
//   manifest.json     the crop, plane ranges, spacing, display aspect, sprite layout, and every
//                     file's bytes and sha256.
//
// The crop is the bounding box of every centreline in geometry/paired-routes.json and every lesion
// centre in targets-v1, plus MARGIN_MM, clipped to the volume and to the shipped slices; every
// lesion patch lies inside it (the build stops otherwise). Pixels are
// one voxel each; a viewer stretches rows by spacing k / spacing i (DISPLAY_ASPECT) to show true
// proportions. Every PNG is written with zlib level 9 and the smallest of: one filter for every
// row (each of the five), or a per-row choice by least sum of absolute differences. The output is
// deterministic for a given zlib.
//
// Size gate: when the planes and patches together exceed GATE_BYTES the script stops before
// writing anything. `__tests__/reference-planes.test.ts` checks the manifest against the files and
// the planes against the axial PNGs.

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { crc32, deflateSync, inflateSync, constants } from 'node:zlib'
import { format } from 'prettier'

const MODULE = 'src/features/bronchial-branch-tracing'
const PUBLIC = 'public/branch-tracing'
const OUT = `${PUBLIC}/mpr-v1`
export const MARGIN_MM = 15
export const GATE_BYTES = 40 * 1024 * 1024

const native = JSON.parse(readFileSync(`${PUBLIC}/native-v1/manifest.json`))
const targets = JSON.parse(readFileSync(`${PUBLIC}/targets-v1/manifest.json`))
const routes = JSON.parse(readFileSync(`${MODULE}/geometry/paired-routes.json`))

const SIZE = native.sizeXyz
const SPACING = native.spacingXyzMm
const ORIGIN = native.ijkToLps.slice(0, 3).map((row) => row[3])
export const DISPLAY_ASPECT = SPACING[2] / SPACING[0]
const FIRST = Math.min(native.exportedSliceRange[0], ...targets.extraSlices)
const LAST = Math.max(native.exportedSliceRange[1], ...targets.extraSlices)

const axialPath = (k) =>
  k >= native.exportedSliceRange[0] && k <= native.exportedSliceRange[1]
    ? `${PUBLIC}/native-v1/axial/${String(k).padStart(3, '0')}.png`
    : `${PUBLIC}/targets-v1/axial/${k}.png`
const pad = (n) => String(n).padStart(3, '0')

// ── PNG ──────────────────────────────────────────────────────────────────────────────────────
const CHANNELS = { 0: 1, 6: 4 }

/** 8-bit grey or RGBA, any filter. Returns { width, height, channels, data }. */
export function decodePng(bytes) {
  const width = bytes.readUInt32BE(16),
    height = bytes.readUInt32BE(20)
  if (bytes[24] !== 8 || !(bytes[25] in CHANNELS) || bytes[28] !== 0)
    throw new Error('Only 8-bit, non-interlaced grey or RGBA PNGs are read')
  const channels = CHANNELS[bytes[25]]
  const chunks = []
  for (let offset = 8; offset < bytes.length; ) {
    const size = bytes.readUInt32BE(offset)
    if (bytes.toString('ascii', offset + 4, offset + 8) === 'IDAT')
      chunks.push(bytes.subarray(offset + 8, offset + 8 + size))
    offset += size + 12
  }
  const raw = inflateSync(Buffer.concat(chunks))
  const stride = width * channels
  const data = new Uint8Array(stride * height)
  for (let y = 0; y < height; y++) {
    const type = raw[y * (stride + 1)]
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    const out = data.subarray(y * stride, (y + 1) * stride)
    const up = y ? data.subarray((y - 1) * stride, y * stride) : new Uint8Array(stride)
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[x - channels] : 0,
        b = up[x],
        c = x >= channels ? up[x - channels] : 0
      out[x] = (row[x] + [0, a, b, (a + b) >> 1, paeth(a, b, c)][type]) & 255
    }
  }
  return { width, height, channels, data }
}
function paeth(a, b, c) {
  const p = a + b - c,
    pa = Math.abs(p - a),
    pb = Math.abs(p - b),
    pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

function filterRow(type, row, up, channels) {
  const out = new Uint8Array(row.length + 1)
  out[0] = type
  for (let x = 0; x < row.length; x++) {
    const a = x >= channels ? row[x - channels] : 0,
      b = up[x],
      c = x >= channels ? up[x - channels] : 0
    out[x + 1] = (row[x] - [0, a, b, (a + b) >> 1, paeth(a, b, c)][type]) & 255
  }
  return out
}
const cost = (filtered) => {
  let sum = 0
  for (let x = 1; x < filtered.length; x++)
    sum += filtered[x] < 128 ? filtered[x] : 256 - filtered[x]
  return sum
}
function chunk(type, body) {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(body.length, 0)
  head.write(type, 4, 'ascii')
  const tail = Buffer.alloc(4)
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])) >>> 0, 0)
  return Buffer.concat([head, body, tail])
}

/** The smallest PNG of six filter strategies, zlib level 9. */
export function encodePng(width, height, channels, data) {
  const stride = width * channels
  const zero = new Uint8Array(stride)
  const rows = []
  for (let y = 0; y < height; y++) {
    const row = data.subarray(y * stride, (y + 1) * stride)
    const up = y ? data.subarray((y - 1) * stride, y * stride) : zero
    rows.push([0, 1, 2, 3, 4].map((type) => filterRow(type, row, up, channels)))
  }
  const strategies = [0, 1, 2, 3, 4].map((type) => rows.map((options) => options[type]))
  strategies.push(
    rows.map((options) => options.reduce((best, next) => (cost(next) < cost(best) ? next : best))),
  )
  let best = null
  for (const strategy of strategies) {
    const idat = deflateSync(Buffer.concat(strategy), {
      level: 9,
      memLevel: 9,
      strategy: constants.Z_DEFAULT_STRATEGY,
    })
    if (!best || idat.length < best.length) best = idat
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = channels === 1 ? 0 : 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', best),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Geometry ─────────────────────────────────────────────────────────────────────────────────
export const lpsToVoxel = (p) => p.map((value, axis) => (value - ORIGIN[axis]) / SPACING[axis])

/**
 * Inclusive voxel box: every centreline point and every lesion centre, plus the margin. Each
 * lesion patch reaches less than MARGIN_MM from its centre, so the box holds every patch whole;
 * the build stops if one ever does not fit.
 */
export function cropBox() {
  const lo = [Infinity, Infinity, Infinity],
    hi = [-Infinity, -Infinity, -Infinity]
  const take = (v) =>
    v.forEach((value, axis) => {
      lo[axis] = Math.min(lo[axis], value)
      hi[axis] = Math.max(hi[axis], value)
    })
  for (const edge of routes.edges) for (const point of edge.points) take(lpsToVoxel(point))
  for (const target of targets.targets) take(lpsToVoxel(target.centerLps))
  const margin = SPACING.map((s) => Math.ceil(MARGIN_MM / s))
  // Slices outside the shipped axial PNGs cannot be rebuilt: the trachea above slice 478 is
  // central and already inside the i/j box, so k is clipped to what ships.
  const limits = [
    [0, SIZE[0] - 1],
    [0, SIZE[1] - 1],
    [FIRST, LAST],
  ]
  const box = [0, 1, 2].map((axis) => [
    Math.max(limits[axis][0], Math.floor(lo[axis]) - margin[axis]),
    Math.min(limits[axis][1], Math.ceil(hi[axis]) + margin[axis]),
  ])
  for (const target of targets.targets) {
    const [x, y] = target.patch.originPixel,
      [w, h] = target.patch.size
    const slices = target.patch.frames.map((f) => f.slice)
    const corners = [
      [x, y, Math.min(...slices)],
      [x + w - 1, y + h - 1, Math.max(...slices)],
    ]
    for (const corner of corners)
      if (corner.some((value, axis) => value < box[axis][0] || value > box[axis][1]))
        throw new Error(`${target.id}: the lesion patch reaches outside the crop`)
  }
  return box
}

// ── Build ────────────────────────────────────────────────────────────────────────────────────
function loadVolume(box) {
  const [[i0, i1], [j0, j1], [k0, k1]] = box
  const w = i1 - i0 + 1,
    h = j1 - j0 + 1
  const volume = new Uint8Array(w * h * (k1 - k0 + 1))
  for (let k = k0; k <= k1; k++) {
    const png = decodePng(readFileSync(axialPath(k)))
    if (png.width !== SIZE[0] || png.height !== SIZE[1] || png.channels !== 1)
      throw new Error(`Axial ${k} is not a 512 × 512 grey plane`)
    for (let j = j0; j <= j1; j++)
      volume.set(
        png.data.subarray(j * SIZE[0] + i0, j * SIZE[0] + i1 + 1),
        ((k - k0) * h + (j - j0)) * w,
      )
  }
  return { volume, w, h }
}

/** Coronal plane j: rows k1..k0, columns i0..i1. */
function coronal(box, { volume, w, h }, j) {
  const [, [j0], [k0, k1]] = box
  const rows = k1 - k0 + 1
  const out = new Uint8Array(w * rows)
  for (let r = 0; r < rows; r++) {
    const k = k1 - r
    out.set(
      volume.subarray(((k - k0) * h + (j - j0)) * w, ((k - k0) * h + (j - j0) + 1) * w),
      r * w,
    )
  }
  return out
}
/** Sagittal plane i: rows k1..k0, columns j0..j1. */
function sagittal(box, { volume, w, h }, i) {
  const [[i0], , [k0, k1]] = box
  const rows = k1 - k0 + 1
  const out = new Uint8Array(h * rows)
  for (let r = 0; r < rows; r++) {
    const k = k1 - r
    for (let c = 0; c < h; c++) out[r * h + c] = volume[((k - k0) * h + c) * w + (i - i0)]
  }
  return out
}

/** One lesion's axial patch frames resliced into a coronal and a sagittal sprite. */
function patchSprites(target) {
  const [ox, oy] = target.patch.originPixel,
    [pw, ph] = target.patch.size
  const frames = new Map(
    target.patch.frames.map((f) => [
      f.slice,
      decodePng(readFileSync(`${PUBLIC}/targets-v1/${f.path}`)),
    ]),
  )
  for (const png of frames.values())
    if (png.width !== pw || png.height !== ph || png.channels !== 4)
      throw new Error(`${target.id}: patch frame is not ${pw} × ${ph} RGBA`)
  const slices = [...frames.keys()]
  const top = Math.max(...slices),
    bottom = Math.min(...slices)
  const rows = top - bottom + 1
  const at = (k, x, y, channel) => frames.get(k)?.data[(y * pw + x) * 4 + channel] ?? 0
  // Coronal: one frame per j (oy..oy+ph-1), each pw wide and `rows` tall, superior first.
  const cor = new Uint8Array(pw * rows * ph * 4)
  for (let y = 0; y < ph; y++)
    for (let r = 0; r < rows; r++)
      for (let x = 0; x < pw; x++)
        for (let c = 0; c < 4; c++) cor[((y * rows + r) * pw + x) * 4 + c] = at(top - r, x, y, c)
  // Sagittal: one frame per i (ox..ox+pw-1), each ph wide and `rows` tall.
  const sag = new Uint8Array(ph * rows * pw * 4)
  for (let x = 0; x < pw; x++)
    for (let r = 0; r < rows; r++)
      for (let y = 0; y < ph; y++)
        for (let c = 0; c < 4; c++) sag[((x * rows + r) * ph + y) * 4 + c] = at(top - r, x, y, c)
  return {
    entry: {
      id: target.id,
      origin: [ox, oy],
      size: [pw, ph],
      slices: [bottom, top],
      coronal: {
        path: `patches/${target.id}/coronal.png`,
        planes: [oy, oy + ph - 1],
        frame: [pw, rows],
      },
      sagittal: {
        path: `patches/${target.id}/sagittal.png`,
        planes: [ox, ox + pw - 1],
        frame: [ph, rows],
      },
    },
    images: [
      [`patches/${target.id}/coronal.png`, encodePng(pw, rows * ph, 4, cor)],
      [`patches/${target.id}/sagittal.png`, encodePng(ph, rows * pw, 4, sag)],
    ],
  }
}

function build() {
  const box = cropBox()
  const [[i0, i1], [j0, j1], [k0, k1]] = box
  const loaded = loadVolume(box)
  const rows = k1 - k0 + 1
  const files = []
  for (let j = j0; j <= j1; j++)
    files.push([`coronal/${pad(j)}.png`, encodePng(loaded.w, rows, 1, coronal(box, loaded, j))])
  for (let i = i0; i <= i1; i++)
    files.push([`sagittal/${pad(i)}.png`, encodePng(loaded.h, rows, 1, sagittal(box, loaded, i))])
  const patches = targets.targets.map(patchSprites)
  for (const patch of patches) files.push(...patch.images)
  const bytesOf = (prefix) =>
    files
      .filter(([path]) => path.startsWith(prefix))
      .reduce((sum, [, bytes]) => sum + bytes.length, 0)
  const totals = {
    coronalBytes: bytesOf('coronal/'),
    sagittalBytes: bytesOf('sagittal/'),
    patchBytes: bytesOf('patches/'),
  }
  totals.totalBytes = totals.coronalBytes + totals.sagittalBytes + totals.patchBytes
  const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
  const manifest = {
    schema: 'branch-tracing-mpr/v1',
    note: 'Generated by scripts/branch-tracing/build-reference-planes.mjs from the shipped native-v1 and targets-v1 axial PNGs. Do not edit by hand.',
    sourceSha256: native.sourceSha256,
    sizeXyz: SIZE,
    spacingXyzMm: SPACING,
    originLps: ORIGIN,
    windowHu: native.windowHu,
    displayAspect: Number(DISPLAY_ASPECT.toFixed(4)),
    marginMm: MARGIN_MM,
    crop: { i: [i0, i1], j: [j0, j1], k: [k0, k1] },
    coronal: {
      path: 'coronal/{n}.png',
      planes: [j0, j1],
      size: [loaded.w, rows],
      columns: 'i ascending: patient right at screen-left',
      rows: 'k descending: superior at the top',
    },
    sagittal: {
      path: 'sagittal/{n}.png',
      planes: [i0, i1],
      size: [loaded.h, rows],
      columns: 'j ascending: anterior at screen-left',
      rows: 'k descending: superior at the top',
    },
    patches: patches.map((p) => p.entry),
    totals,
    files: files.map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha(bytes) })),
  }
  return { box, files, manifest, totals }
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`

if (process.argv[1]?.endsWith('build-reference-planes.mjs')) {
  const report = process.argv.includes('--report')
  const { box, files, manifest, totals } = build()
  const [[i0, i1], [j0, j1], [k0, k1]] = box
  console.log(
    `Crop i ${i0}–${i1}, j ${j0}–${j1}, k ${k0}–${k1} (margin ${MARGIN_MM} mm); display aspect ${DISPLAY_ASPECT.toFixed(4)}`,
  )
  console.log(`Coronal  ${j1 - j0 + 1} planes  ${mb(totals.coronalBytes)}`)
  console.log(`Sagittal ${i1 - i0 + 1} planes  ${mb(totals.sagittalBytes)}`)
  console.log(`Patches  ${manifest.patches.length * 2} sprites  ${mb(totals.patchBytes)}`)
  console.log(`Total    ${files.length} files  ${mb(totals.totalBytes)} (gate ${mb(GATE_BYTES)})`)
  if (report) process.exit(0)
  if (totals.totalBytes > GATE_BYTES) {
    console.error('Over the size gate: nothing written. The owner chooses a fallback.')
    process.exit(1)
  }
  rmSync(OUT, { recursive: true, force: true })
  for (const [path, bytes] of files) {
    mkdirSync(`${OUT}/${path.slice(0, path.lastIndexOf('/'))}`, { recursive: true })
    writeFileSync(`${OUT}/${path}`, bytes)
  }
  writeFileSync(`${OUT}/manifest.json`, await format(JSON.stringify(manifest), { parser: 'json' }))
  console.log(`Wrote ${files.length} files and manifest.json to ${OUT}`)
}
