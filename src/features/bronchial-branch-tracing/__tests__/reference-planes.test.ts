import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import mpr from '../../../../public/branch-tracing/mpr-v1/manifest.json'
import targets from '../../../../public/branch-tracing/targets-v1/manifest.json'
import routes from '../geometry/paired-routes.json'
import { CT_TRACES, NATIVE_CT, lpsToVoxel, voxelToLps } from '../geometry/native-ct'
import {
  orientationLabels,
  planeLabels,
  turnCt,
  STANDARD_ORIENTATION,
} from '../geometry/orientation'
import {
  FIGURE_2_GROUPS,
  REFERENCE_VIEWS,
  TRANSFORM_HINT,
  referenceViewsFor,
  referenceViewsLine,
} from '../content/reference-views'

const ROOT = join(process.cwd(), 'public/branch-tracing')
const MPR = join(ROOT, 'mpr-v1')

/** 8-bit grey or RGBA PNG, any filter. */
function decode(bytes: Buffer) {
  const width = bytes.readUInt32BE(16),
    height = bytes.readUInt32BE(20)
  expect(bytes[24]).toBe(8)
  const channels = bytes[25] === 0 ? 1 : bytes[25] === 6 ? 4 : 0
  expect(channels).toBeGreaterThan(0)
  const chunks: Buffer[] = []
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
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? data[y * stride + x - channels] : 0
      const b = y ? data[(y - 1) * stride + x] : 0
      const c = x >= channels && y ? data[(y - 1) * stride + x - channels] : 0
      const p = a + b - c
      const paeth =
        Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c)
          ? a
          : Math.abs(p - b) <= Math.abs(p - c)
            ? b
            : c
      data[y * stride + x] =
        (raw[y * (stride + 1) + 1 + x] + [0, a, b, (a + b) >> 1, paeth][type]) & 255
    }
  }
  return { width, height, channels, data }
}
const read = (path: string) => decode(readFileSync(path))
const axial = (k: number) =>
  read(
    k >= 240 && k <= 475
      ? join(ROOT, 'native-v1/axial', `${String(k).padStart(3, '0')}.png`)
      : join(ROOT, 'targets-v1/axial', `${k}.png`),
  )
const pad = (n: number) => String(n).padStart(3, '0')
const [I0, I1] = mpr.crop.i
const [J0, J1] = mpr.crop.j
const [K0, K1] = mpr.crop.k

function walk(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(join(dir, entry.name), `${prefix}${entry.name}/`)
      : [`${prefix}${entry.name}`],
  )
}

describe('mpr-v1 assets', () => {
  test('every file matches its manifest bytes and hash, and nothing else ships', () => {
    const listed = mpr.files.map((f) => f.path).sort()
    expect(
      walk(MPR)
        .filter((p) => p !== 'manifest.json')
        .sort(),
    ).toEqual(listed)
    for (const file of mpr.files) {
      const bytes = readFileSync(join(MPR, file.path))
      expect([file.path, bytes.length]).toEqual([file.path, file.bytes])
      expect([file.path, createHash('sha256').update(bytes).digest('hex')]).toEqual([
        file.path,
        file.sha256,
      ])
    }
    const sum = (prefix: string) =>
      mpr.files.filter((f) => f.path.startsWith(prefix)).reduce((s, f) => s + f.bytes, 0)
    expect(mpr.totals).toEqual({
      coronalBytes: sum('coronal/'),
      sagittalBytes: sum('sagittal/'),
      patchBytes: sum('patches/'),
      totalBytes: sum(''),
    })
    // The size gate the build enforces.
    expect(mpr.totals.totalBytes).toBeLessThanOrEqual(40 * 1024 * 1024)
  })

  test('the geometry is the native CT', () => {
    expect(mpr.sizeXyz).toEqual([512, 512, 636])
    expect(mpr.spacingXyzMm).toEqual([...NATIVE_CT.spacing])
    mpr.originLps.forEach((value, axis) => expect(value).toBeCloseTo(NATIVE_CT.origin[axis], 9))
    expect(mpr.displayAspect).toBe(0.7252)
    expect(mpr.displayAspect).toBeCloseTo(NATIVE_CT.spacing[2] / NATIVE_CT.spacing[0], 4)
    expect(mpr.coronal.planes).toEqual([J0, J1])
    expect(mpr.sagittal.planes).toEqual([I0, I1])
    expect(mpr.coronal.size).toEqual([I1 - I0 + 1, K1 - K0 + 1])
    expect(mpr.sagittal.size).toEqual([J1 - J0 + 1, K1 - K0 + 1])
    expect(mpr.files.filter((f) => f.path.startsWith('coronal/'))).toHaveLength(J1 - J0 + 1)
    expect(mpr.files.filter((f) => f.path.startsWith('sagittal/'))).toHaveLength(I1 - I0 + 1)
  })

  test('the crop spans every shipped slice and holds every centreline and lesion with the margin', () => {
    // Every axial slice that ships: native 240–475 plus the target extras 239 and 476–478.
    expect([K0, K1]).toEqual([
      Math.min(240, ...targets.extraSlices),
      Math.max(475, ...targets.extraSlices),
    ])
    const margin = [0, 1].map((axis) => Math.ceil(mpr.marginMm / NATIVE_CT.spacing[axis]))
    const inside = (v: readonly number[], m = [0, 0]) =>
      v[0] - m[0] >= I0 && v[0] + m[0] <= I1 && v[1] - m[1] >= J0 && v[1] + m[1] <= J1
    const outside: string[] = []
    let inSlices = 0
    for (const edge of routes.edges)
      for (const point of edge.points) {
        const v = lpsToVoxel(point)
        if (!inside(v, margin)) outside.push(`edge ${edge.id} ${v.map(Math.round)}`)
        if (v[2] >= K0 && v[2] <= K1) inSlices++
      }
    expect(outside).toEqual([])
    // Only the top of the trachea (above slice 478) and a few points just below slice 239 fall
    // outside the shipped slices.
    expect(inSlices).toBeGreaterThan(1400)
    for (const target of targets.targets) {
      const centre = lpsToVoxel(target.centerLps)
      expect([target.id, inside(centre, margin)]).toEqual([target.id, true])
      expect(centre[2]).toBeGreaterThanOrEqual(K0)
      expect(centre[2]).toBeLessThanOrEqual(K1)
      const [x, y] = target.patch.originPixel,
        [w, h] = target.patch.size
      expect([target.id, inside([x, y]) && inside([x + w - 1, y + h - 1])]).toEqual([
        target.id,
        true,
      ])
    }
  })

  test('a coronal row is the axial row and a sagittal column is the axial column', () => {
    const slices = [K0, 240, 301, 372, 444, 475, 476, K1]
    const planes = new Map(slices.map((k) => [k, axial(k)]))
    for (const j of [J0, 187, 282, 350, J1]) {
      const plane = read(join(MPR, 'coronal', `${pad(j)}.png`))
      expect([plane.width, plane.height, plane.channels]).toEqual([I1 - I0 + 1, K1 - K0 + 1, 1])
      for (const k of slices) {
        const row = K1 - k
        const got = plane.data.subarray(row * plane.width, (row + 1) * plane.width)
        const want = planes.get(k)!.data.subarray(j * 512 + I0, j * 512 + I1 + 1)
        expect([j, k, Buffer.from(got).equals(Buffer.from(want))]).toEqual([j, k, true])
      }
    }
    for (const i of [I0, 120, 192, 365, I1]) {
      const plane = read(join(MPR, 'sagittal', `${pad(i)}.png`))
      expect([plane.width, plane.height, plane.channels]).toEqual([J1 - J0 + 1, K1 - K0 + 1, 1])
      for (const k of slices) {
        const row = K1 - k
        const source = planes.get(k)!.data
        const mismatches = []
        for (let j = J0; j <= J1; j++)
          if (plane.data[row * plane.width + (j - J0)] !== source[j * 512 + i]) mismatches.push(j)
        expect([i, k, mismatches]).toEqual([i, k, []])
      }
    }
  })

  test('each lesion patch is resliced voxel for voxel', () => {
    expect(mpr.patches.map((p) => p.id)).toEqual(targets.targets.map((t) => t.id))
    for (const target of targets.targets.filter((t) =>
      ['r-apical-anterior', 'l-superior', 'l-lateral-basal'].includes(t.id),
    )) {
      const entry = mpr.patches.find((p) => p.id === target.id)!
      const [ox, oy] = target.patch.originPixel,
        [w, h] = target.patch.size
      const slices = target.patch.frames.map((f) => f.slice)
      const top = Math.max(...slices),
        rows = top - Math.min(...slices) + 1
      expect(entry).toMatchObject({
        origin: [ox, oy],
        size: [w, h],
        slices: [Math.min(...slices), top],
        coronal: { planes: [oy, oy + h - 1], frame: [w, rows] },
        sagittal: { planes: [ox, ox + w - 1], frame: [h, rows] },
      })
      const frames = new Map(
        target.patch.frames.map((f) => [f.slice, read(join(ROOT, 'targets-v1', f.path))]),
      )
      const coronal = read(join(MPR, entry.coronal.path))
      const sagittal = read(join(MPR, entry.sagittal.path))
      expect([coronal.width, coronal.height]).toEqual([w, rows * h])
      expect([sagittal.width, sagittal.height]).toEqual([h, rows * w])
      const mismatches: string[] = []
      for (const [k, frame] of frames)
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++)
            for (let c = 0; c < 4; c++) {
              const want = frame.data[(y * w + x) * 4 + c]
              const r = top - k
              if (coronal.data[((y * rows + r) * w + x) * 4 + c] !== want)
                mismatches.push(`coronal ${k} ${x},${y}`)
              if (sagittal.data[((x * rows + r) * h + y) * 4 + c] !== want)
                mismatches.push(`sagittal ${k} ${x},${y}`)
            }
      expect([target.id, mismatches.slice(0, 5)]).toEqual([target.id, []])
    }
  })
})

describe('native voxel helpers', () => {
  test('lpsToVoxel and voxelToLps are inverses on the native grid', () => {
    expect(lpsToVoxel(NATIVE_CT.origin)).toEqual([0, 0, 0])
    expect(voxelToLps([0, 0, 0])).toEqual([...NATIVE_CT.origin])
    const v = [192.25, 282.5, 444]
    lpsToVoxel(voxelToLps(v)).forEach((value, axis) => expect(value).toBeCloseTo(v[axis], 9))
  })

  test('every route checkpoint lands on its own slice and pixel', () => {
    for (const trace of CT_TRACES)
      for (const checkpoint of trace.checkpoints) {
        const [i, j, k] = lpsToVoxel(checkpoint.lps)
        expect(Math.round(k)).toBe(checkpoint.slice)
        expect(i).toBeCloseTo(checkpoint.pixel[0], 2)
        expect(j).toBeCloseTo(checkpoint.pixel[1], 2)
      }
  })
})

describe('plane labels', () => {
  test('axial labels are the existing axial labels for every turn and flip', () => {
    let o = STANDARD_ORIENTATION
    for (const op of ['left', 'left', 'flip', 'right', 'left', 'flip', 'right', 'right'] as const) {
      expect(planeLabels('axial', o)).toEqual(orientationLabels(o))
      o = turnCt(o, op)
    }
  })

  test('coronal reads S/L/I/R and sagittal S/P/I/A', () => {
    expect(planeLabels('coronal')).toEqual({ top: 'S', right: 'L', bottom: 'I', left: 'R' })
    expect(planeLabels('sagittal')).toEqual({ top: 'S', right: 'P', bottom: 'I', left: 'A' })
    // A vertical flip (flip, then half a turn) swaps superior and inferior only.
    const vertical = turnCt(turnCt(turnCt(STANDARD_ORIENTATION, 'flip'), 'left'), 'left')
    expect(planeLabels('coronal', vertical)).toEqual({
      top: 'I',
      right: 'L',
      bottom: 'S',
      left: 'R',
    })
  })
})

describe('reference views (Mortimer & Saghaie, Figure 2)', () => {
  test('every lesion segment in targets-v1 has a suggestion', () => {
    const codes = [...new Set(targets.targets.map((t) => t.segment.bronchusCode))]
    expect(codes.filter((code) => !referenceViewsFor(code))).toEqual([])
  })

  test('the table is the figure: each segment once, in its group', () => {
    const all = Object.values(FIGURE_2_GROUPS).flat()
    expect(new Set(all).size).toBe(all.length)
    expect(Object.keys(REFERENCE_VIEWS).sort()).toEqual([...all].sort())
    expect(FIGURE_2_GROUPS['axial + coronal']).toEqual(['RB3', 'RB5', 'RB6', 'LB3', 'LB6'])
    expect(FIGURE_2_GROUPS['axial + sagittal']).toEqual(['RB2', 'RB4', 'LB4', 'LB5'])
    expect(FIGURE_2_GROUPS['axial alone']).toEqual([
      'RB1',
      'RB7',
      'RB8',
      'RB9',
      'RB10',
      'LB1+2',
      'LB8',
      'LB9',
      'LB10',
    ])
    expect(referenceViewsFor('RB3')?.views).toEqual(['axial', 'coronal'])
    expect(referenceViewsFor('LB5')?.views).toEqual(['axial', 'sagittal'])
    expect(referenceViewsFor('LB9')?.views).toEqual(['axial'])
    expect(referenceViewsLine('RB3')).toBe('RB3: axial plus coronal.')
    expect(referenceViewsLine('LB1+2')).toBe('LB1+2: axial alone.')
    expect(referenceViewsFor('RB99')).toBeUndefined()
  })

  test('the transform hint: flip, then counterclockwise on the right and clockwise on the left', () => {
    const right = referenceViewsFor('RB3')!,
      left = referenceViewsFor('LB6')!
    expect(right.turn).toEqual(['flip', 'left'])
    expect(right.turned).toEqual({ turns: 3, reflected: true })
    expect(right.turnHint).toBe(TRANSFORM_HINT.right)
    expect(left.turn).toEqual(['flip', 'right'])
    expect(left.turned).toEqual({ turns: 1, reflected: true })
    expect(left.turnHint).toBe(TRANSFORM_HINT.left)
    for (const code of ['RB1', 'LB1+2']) {
      expect(referenceViewsFor(code)?.verticalFlipMayHelp).toBe(true)
      expect(referenceViewsFor(code)?.turnHint).toContain(TRANSFORM_HINT.apical)
    }
    expect(
      Object.values(REFERENCE_VIEWS)
        .filter((v) => v.verticalFlipMayHelp)
        .map((v) => v.code),
    ).toEqual(['RB1', 'LB1+2'])
  })

  test('no learner sentence uses a gated word', () => {
    const gated =
      /\b(score|scored|points|grade|graded|pass|passed|mastery|correct|incorrect|wrong|synthetic|authored|pending|faculty)\b/i
    const text = [
      ...Object.values(TRANSFORM_HINT),
      ...Object.values(REFERENCE_VIEWS).flatMap((v) => [v.reason, v.turnHint]),
    ]
    expect(text.filter((line) => gated.test(line))).toEqual([])
  })
})
