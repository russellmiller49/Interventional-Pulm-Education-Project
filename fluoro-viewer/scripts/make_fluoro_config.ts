import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type Vec3 = [number, number, number]

interface BranchRaw {
  name: string
  color_rgb: [number, number, number]
  polylines: Vec3[][]
}

interface CenterlinesRaw {
  units: string
  coordinateSystem: string
  labels: BranchRaw[]
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const dataDir = path.join(projectRoot, 'data')
const publicDir = path.join(projectRoot, 'public')

const INPUT_JSON = path.join(dataDir, 'airway_centerlines_labeled.json')
const OUTPUT_CONFIG = path.join(publicDir, 'fluoro_config.json')

const FIXED_ISOCENTER: Vec3 = [-8.0, -134.8, -1153.2]

async function main() {
  const raw = await fs.readFile(INPUT_JSON, 'utf-8')
  const data: CenterlinesRaw = JSON.parse(raw)

  if (data.units !== 'mm') {
    throw new Error(`Expected units "mm", got "${data.units}"`)
  }
  if (data.coordinateSystem !== 'LPS') {
    throw new Error(`Expected coordinateSystem "LPS", got "${data.coordinateSystem}"`)
  }

  const stats = computeStats(data.labels)
  const msg = [
    '✅ airway_centerlines_labeled.json',
    `  units: ${data.units}, coordinateSystem: ${data.coordinateSystem}`,
    `  labels: ${stats.labelCount}`,
    `  polylines: ${stats.polylineCount}`,
    `  points: ${stats.pointCount}`,
    `  bounds (mm):`,
    `    x: [${stats.bounds.min[0].toFixed(2)}, ${stats.bounds.max[0].toFixed(
      2,
    )}]  span=${stats.span[0].toFixed(2)}`,
    `    y: [${stats.bounds.min[1].toFixed(2)}, ${stats.bounds.max[1].toFixed(
      2,
    )}]  span=${stats.span[1].toFixed(2)}`,
    `    z: [${stats.bounds.min[2].toFixed(2)}, ${stats.bounds.max[2].toFixed(
      2,
    )}]  span=${stats.span[2].toFixed(2)}`,
    `  centroid (mm): ${stats.centroid.map((v) => v.toFixed(2)).join(', ')}`,
  ].join('\n')
  console.log(msg)

  await fs.mkdir(publicDir, { recursive: true })
  const config = {
    units: 'mm',
    coordinateSystem: 'LPS',
    isocenter_mm: FIXED_ISOCENTER,
    source_to_isocenter_mm: 600,
    source_to_detector_mm: 1200,
    detector_pixels: [1024, 1024],
    pixel_pitch_mm: 0.3,
    default_view: {
      rao_lao_deg: 0,
      cranial_caudal_deg: 0,
    },
  }

  await fs.writeFile(OUTPUT_CONFIG, JSON.stringify(config, null, 2))
  console.log(`📝 wrote ${path.relative(projectRoot, OUTPUT_CONFIG)}`)
}

function computeStats(labels: BranchRaw[]) {
  const bounds = {
    min: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY] as Vec3,
    max: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY] as Vec3,
  }
  let pointCount = 0
  let polylineCount = 0
  const centroidAccum: Vec3 = [0, 0, 0]

  for (const label of labels) {
    for (const poly of label.polylines) {
      polylineCount += 1
      for (const [x, y, z] of poly) {
        pointCount += 1
        if (x < bounds.min[0]) bounds.min[0] = x
        if (y < bounds.min[1]) bounds.min[1] = y
        if (z < bounds.min[2]) bounds.min[2] = z
        if (x > bounds.max[0]) bounds.max[0] = x
        if (y > bounds.max[1]) bounds.max[1] = y
        if (z > bounds.max[2]) bounds.max[2] = z
        centroidAccum[0] += x
        centroidAccum[1] += y
        centroidAccum[2] += z
      }
    }
  }

  if (pointCount === 0) {
    throw new Error('No points found in centerline data.')
  }

  const centroid: Vec3 = [
    centroidAccum[0] / pointCount,
    centroidAccum[1] / pointCount,
    centroidAccum[2] / pointCount,
  ]

  const span: Vec3 = [
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
  ]

  return {
    labelCount: labels.length,
    polylineCount,
    pointCount,
    bounds,
    span,
    centroid,
  }
}

main().catch((err) => {
  console.error('make_fluoro_config failed:', err)
  process.exit(1)
})
