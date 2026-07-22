#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(scriptDirectory, '..', '..')
const configPath = path.join(scriptDirectory, 'cardiac-ct-config.json')
const config = JSON.parse(await readFile(configPath, 'utf8'))
const extractionDirectory = path.join(root, config.sourceCenterlines)
const outputPath = path.join(root, 'src/features/cardiac-anatomy/content/cardiac-ct-rig.json')

const ROUNDING_DIGITS = 5
const RESAMPLE_SPACING_WEB_UNITS = 0.065

function round(value) {
  return Number(value.toFixed(ROUNDING_DIGITS))
}

function distance(left, right) {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2])
}

function interpolate(left, right, fraction) {
  return left.map((value, index) => value + (right[index] - value) * fraction)
}

function catmullRomCoordinate(p0, p1, p2, p3, dt0, dt1, dt2, weight) {
  let tangent1 = (p1 - p0) / dt0 - (p2 - p0) / (dt0 + dt1) + (p2 - p1) / dt1
  let tangent2 = (p2 - p1) / dt1 - (p3 - p1) / (dt1 + dt2) + (p3 - p2) / dt2
  tangent1 *= dt1
  tangent2 *= dt1
  return (
    p1 +
    tangent1 * weight +
    (-3 * p1 + 3 * p2 - 2 * tangent1 - tangent2) * weight ** 2 +
    (2 * p1 - 2 * p2 + tangent1 + tangent2) * weight ** 3
  )
}

function catmullRomPoint(points, parameter) {
  const count = points.length
  const scaled = Math.max(0, Math.min(1, parameter)) * (count - 1)
  let pointIndex = Math.floor(scaled)
  let weight = scaled - pointIndex
  if (weight === 0 && pointIndex === count - 1) {
    pointIndex = count - 2
    weight = 1
  }
  const p0 = points[pointIndex === 0 ? pointIndex : pointIndex - 1]
  const p1 = points[pointIndex]
  const p2 = points[pointIndex > count - 2 ? count - 1 : pointIndex + 1]
  const p3 = points[pointIndex > count - 3 ? count - 1 : pointIndex + 2]
  let dt0 = Math.sqrt(distance(p0, p1))
  let dt1 = Math.sqrt(distance(p1, p2))
  let dt2 = Math.sqrt(distance(p2, p3))
  if (dt1 < 1e-4) dt1 = 1
  if (dt0 < 1e-4) dt0 = dt1
  if (dt2 < 1e-4) dt2 = dt1
  return p0.map((_, axis) =>
    catmullRomCoordinate(p0[axis], p1[axis], p2[axis], p3[axis], dt0, dt1, dt2, weight),
  )
}

class RuntimeCatmullRomCurve {
  constructor(points) {
    this.points = points
    this.arcLengthDivisions = 200
    this.samples = Array.from({ length: this.arcLengthDivisions + 1 }, (_, index) =>
      catmullRomPoint(points, index / this.arcLengthDivisions),
    )
    this.arcLengths = [0]
    for (let index = 1; index < this.samples.length; index += 1) {
      this.arcLengths.push(
        this.arcLengths.at(-1) + distance(this.samples[index - 1], this.samples[index]),
      )
    }
  }

  parameterAt(progress) {
    const target = Math.max(0, Math.min(1, progress)) * this.arcLengths.at(-1)
    let low = 0
    let high = this.arcLengths.length - 1
    while (low < high) {
      const middle = Math.floor((low + high) / 2)
      if (this.arcLengths[middle] < target) low = middle + 1
      else high = middle
    }
    if (low === 0) return 0
    if (low >= this.arcLengths.length) return 1
    const previous = low - 1
    const segmentLength = this.arcLengths[low] - this.arcLengths[previous]
    const fraction = segmentLength === 0 ? 0 : (target - this.arcLengths[previous]) / segmentLength
    return (previous + fraction) / this.arcLengthDivisions
  }

  pointAt(progress) {
    return catmullRomPoint(this.points, this.parameterAt(progress))
  }
}

function runtimeSegmentLength(curve, startProgress, endProgress, samples = 512) {
  let length = 0
  let previous = curve.pointAt(startProgress)
  for (let index = 1; index <= samples; index += 1) {
    const current = curve.pointAt(startProgress + ((endProgress - startProgress) * index) / samples)
    length += distance(previous, current)
    previous = current
  }
  return length
}

function progressAtRuntimeDistance(curve, startProgress, targetDistance) {
  let low = startProgress
  let high = 1
  if (runtimeSegmentLength(curve, startProgress, high) < targetDistance) {
    throw new Error(`Runtime curve is shorter than requested distance ${targetDistance}`)
  }
  for (let iteration = 0; iteration < 48; iteration += 1) {
    const middle = (low + high) / 2
    if (runtimeSegmentLength(curve, startProgress, middle) < targetDistance) low = middle
    else high = middle
  }
  return (low + high) / 2
}

function inverseTransformWeb(point) {
  const [centerX, centerY, centerZ] = config.centerLpsMm
  const scale = config.webUnitsPerMm
  return [point[0] / scale + centerX, centerY - point[2] / scale, point[1] / scale + centerZ]
}

function nearestPolylineProjection(point, points) {
  let cumulative = 0
  let best = null
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]
    const end = points[index]
    const vector = end.map((value, axis) => value - start[axis])
    const relative = point.map((value, axis) => value - start[axis])
    const squaredLength = vector.reduce((sum, value) => sum + value ** 2, 0)
    const fraction = Math.max(
      0,
      Math.min(
        1,
        squaredLength === 0
          ? 0
          : relative.reduce((sum, value, axis) => sum + value * vector[axis], 0) / squaredLength,
      ),
    )
    const projected = interpolate(start, end, fraction)
    const separation = distance(point, projected)
    if (best === null || separation < best.separationMm) {
      best = {
        point: projected,
        separationMm: separation,
        segmentStartIndex: index - 1,
        segmentEndIndex: index,
        fraction,
        arcDistanceMm: cumulative + fraction * Math.sqrt(squaredLength),
      }
    }
    cumulative += Math.sqrt(squaredLength)
  }
  return best
}

function pointAtPolylineDistance(points, targetDistance) {
  let cumulative = 0
  for (let index = 1; index < points.length; index += 1) {
    const segmentLength = distance(points[index - 1], points[index])
    if (cumulative + segmentLength >= targetDistance) {
      const fraction = segmentLength === 0 ? 0 : (targetDistance - cumulative) / segmentLength
      return {
        point: interpolate(points[index - 1], points[index], fraction),
        segmentStartIndex: index - 1,
        segmentEndIndex: index,
        fraction,
      }
    }
    cumulative += segmentLength
  }
  throw new Error(`Polyline is shorter than requested distance ${targetDistance}`)
}

function transformLps(point) {
  const [centerX, centerY, centerZ] = config.centerLpsMm
  const scale = config.webUnitsPerMm
  return [
    round((point[0] - centerX) * scale),
    round((point[2] - centerZ) * scale),
    round(-(point[1] - centerY) * scale),
  ]
}

async function readMarkupCurve(filename) {
  const document = JSON.parse(await readFile(path.join(extractionDirectory, filename), 'utf8'))
  const markup = document.markups?.[0]
  if (markup?.type !== 'Curve' || markup.coordinateSystem !== 'LPS') {
    throw new Error(`${filename} is not an LPS Slicer curve markup`)
  }
  const points = markup.controlPoints
    .filter((point) => point.positionStatus === 'defined')
    .map((point) => point.position.map(Number))
  if (points.length < 2) throw new Error(`${filename} has fewer than two defined points`)
  return points
}

function resampleByArcLength(points, spacing = RESAMPLE_SPACING_WEB_UNITS) {
  const cumulative = [0]
  for (let index = 1; index < points.length; index += 1) {
    cumulative.push(cumulative.at(-1) + distance(points[index - 1], points[index]))
  }
  const total = cumulative.at(-1)
  const sampleCount = Math.max(2, Math.ceil(total / spacing) + 1)
  const result = []
  let segment = 1
  for (let sample = 0; sample < sampleCount; sample += 1) {
    const target = (total * sample) / (sampleCount - 1)
    while (segment < cumulative.length - 1 && cumulative[segment] < target) segment += 1
    const startLength = cumulative[segment - 1]
    const endLength = cumulative[segment]
    const fraction =
      endLength === startLength ? 0 : (target - startLength) / (endLength - startLength)
    result.push(interpolate(points[segment - 1], points[segment], fraction).map(round))
  }
  return result
}

class RouteBuilder {
  constructor() {
    this.points = []
    this.landmarkLengths = {}
  }

  add(points) {
    for (const point of points) {
      const transformed = transformLps(point)
      if (this.points.length === 0 || distance(this.points.at(-1), transformed) > 0.0001) {
        this.points.push(transformed)
      }
    }
    return this
  }

  addWeb(points) {
    for (const point of points) {
      const rounded = point.map(round)
      if (this.points.length === 0 || distance(this.points.at(-1), rounded) > 0.0001) {
        this.points.push(rounded)
      }
    }
    return this
  }

  mark(name) {
    this.landmarkLengths[name] = this.currentLength()
    return this
  }

  currentLength() {
    let length = 0
    for (let index = 1; index < this.points.length; index += 1) {
      length += distance(this.points[index - 1], this.points[index])
    }
    return length
  }

  distanceSince(name) {
    const landmarkLength = this.landmarkLengths[name]
    if (!Number.isFinite(landmarkLength)) throw new Error(`Unknown route landmark: ${name}`)
    return this.currentLength() - landmarkLength
  }

  finish() {
    const route = resampleByArcLength(this.points)
    let totalLength = 0
    for (let index = 1; index < this.points.length; index += 1) {
      totalLength += distance(this.points[index - 1], this.points[index])
    }
    return {
      points: route,
      progress: Object.fromEntries(
        Object.entries(this.landmarkLengths).map(([name, length]) => [
          name,
          round(Math.max(0, Math.min(1, length / totalLength))),
        ]),
      ),
      lengthWebUnits: round(totalLength),
    }
  }
}

const [svc, ivc, rightAtriumToSvc, rightAtriumToIvc, rightVentricle, aorta] = await Promise.all([
  readMarkupCurve('Sperior Vena Cava (0).mrk.json'),
  readMarkupCurve('Inferior Vena Cava (0).mrk.json'),
  readMarkupCurve('Right Atrium (2).mrk.json'),
  readMarkupCurve('Right Atrium (1).mrk.json'),
  readMarkupCurve('Right Ventricle (0).mrk.json'),
  readMarkupCurve('Aorta curve (0).mrk.json'),
])

const pulmonarySegments = new Map(
  await Promise.all(
    [0, 1, 4, 5, 9].map(async (index) => [
      index,
      await readMarkupCurve(`Pulmonary Artery (${index}).mrk.json`),
    ]),
  ),
)

// These reviewed, authored LPS landmarks were placed against the supplied segmentation surfaces in
// Slicer to bridge independently extracted centerlines. The complete aortic-valve segmentation
// supplies true valve geometry; the other valve source segments are location proxies used only to
// establish route gates. They are intentionally explicit here rather than presented as extracted
// centerline samples.
const interfaces = {
  svcRa: [-34.027, -165.959, -172.227],
  ivcRa: [-30.326, -157.543, -218.727],
  raTricuspid: [-30.234, -191.953, -225.5],
  tricuspidProxy: [-25.547, -197.578, -228.5],
  tricuspidRv: [-19.26, -200.407, -227.198],
  rvPulmonic: [10.117, -203.881, -179.557],
  pulmonicPa: [15, -191.766, -174.05],
  aortaAorticValve: [-3.407, -175.301, -176.114],
  aorticValveLvot: [1.427, -176.975, -178.22],
  lvotLv: [2.128, -175.694, -184.32],
}

const svcInsertion = [...svc].reverse()
const raFromSvc = [...rightAtriumToSvc].reverse()
const rvFromTricuspid = [...rightVentricle].reverse()

const pac = new RouteBuilder()
pac.add(svcInsertion.slice(0, 12)).mark('introducer')
pac.add(svcInsertion.slice(12))
pac.add([interfaces.svcRa])
pac.add(raFromSvc).mark('ra')
pac.add([interfaces.raTricuspid, interfaces.tricuspidProxy, interfaces.tricuspidRv])
const rvStageIndex = Math.round(rvFromTricuspid.length * 0.52)
pac.add(rvFromTricuspid.slice(0, rvStageIndex)).mark('rv')
pac.add(rvFromTricuspid.slice(rvStageIndex))
pac.add([interfaces.rvPulmonic, interfaces.pulmonicPa])
pac.add(pulmonarySegments.get(0))
pac.add(pulmonarySegments.get(1)).mark('pa').mark('wedge')
pac.add(pulmonarySegments.get(4))
pac.add(pulmonarySegments.get(5))
pac.add(pulmonarySegments.get(9)).mark('distalBranch')
const pacRoute = pac.finish()

// The source extraction has an aortic centerline but no LV-cavity centerline. Reviewed authored LPS
// landmarks placed within the supplied aortic-valve, LVOT, and LV segmentation surfaces supply the
// short valve-to-LV bridge explicitly.
const impella = new RouteBuilder()
impella.add([...aorta].reverse()).mark('aorticRoot')
impella.add([interfaces.aortaAorticValve]).mark('aorticValve')
impella
  .add([interfaces.aorticValveLvot, interfaces.lvotLv, [5.859, -176.953, -190.5]])
  .mark('tooShallow')
impella.add([[14.297, -178.828, -205.5]]).mark('correct')
impella.add([[19.922, -186.328, -219.5]]).mark('deep')
const impellaRoute = {
  ...impella.finish(),
  deviceRegistration: {
    modelUrl: '/models/cardiac-devices/impella-cp-v1.glb',
    localForwardAxis: '+Y',
    inletLocal: [0, 0, 0],
    outletLocal: [0, -1.128, 0],
    modelScale: 1,
    correctInletDistanceBelowAnnulusMm: 35,
  },
}

// The supplied CT extraction does not include axillary/subclavian centerlines.  The short
// extrathoracic segment below is therefore an explicit authored access boundary.  From its
// junction with the imaged arch onward, the 5.5 route follows the supplied aortic centerline and
// the same segmented-aortic-valve/LV bridge used by the CP route.  Keeping this as a separate
// route prevents a femoral CP approach from being presented as an axillary 5.5 approach.
const axillaryAccessBoundary = [-68, -146, -102]
const axillaryGraftToArch = [-36, -139, -108]
const axillaryAorticJunctionIndex = 126
const impella55 = new RouteBuilder()
impella55
  .add([axillaryAccessBoundary, axillaryGraftToArch])
  .mark('access')
  .add([...aorta.slice(0, axillaryAorticJunctionIndex + 1)].reverse())
  .mark('aorticRoot')
  .add([interfaces.aortaAorticValve])
  .mark('aorticValve')
impella55
  .add([interfaces.aorticValveLvot, interfaces.lvotLv, [5.859, -176.953, -190.5]])
  .mark('tooShallow')
impella55.add([[14.297, -178.828, -205.5]]).mark('shallow')
impella55.add([[19.922, -186.328, -219.5]]).mark('correct')
impella55.add([[25.2, -192.4, -233.2]]).mark('deep')
const impella55Finished = impella55.finish()
const impella55Route = {
  ...impella55Finished,
  progress: {
    ...impella55Finished.progress,
    // First sampled intersection with the supplied CT aortic surface.  The runtime renders
    // the preceding non-imaged axillary/subclavian portion inside an explicitly synthetic
    // surgical-access conduit instead of presenting a catheter floating in free space.
    surgicalAccessEnd: 0.26895,
  },
  deviceRegistration: {
    modelUrl: '/models/cardiac-devices/impella-55-v1.glb',
    localForwardAxis: '+Y',
    // Replaced from generated named anchors during runtime-asset validation when the facsimile
    // geometry changes.  The inlet is intentionally the registration origin.
    inletLocal: [0, 0, 0],
    outletLocal: [0, -1.56, 0],
    modelScale: 1,
    correctInletDistanceBelowAnnulusMm: 50,
  },
}

// Femoral venous RP advancement: CT-derived IVC, RA, RV, and PA centerlines joined by reviewed
// interface landmarks.  The tricuspid and pulmonic points are route/orifice gates only; the source
// segmentation does not contain diagnostic leaflet morphology for either valve.
const rp = new RouteBuilder()
const ivcInsertion = [...ivc].reverse()
const RP_TOO_PROXIMAL_INLET_TO_OUTLET_MM = 190
const RP_CORRECT_INLET_TO_OUTLET_MM = 205
rp.add(ivcInsertion.slice(0, 4)).mark('access')
rp.add(ivcInsertion.slice(4)).mark('ivcInlet')
rp.add([interfaces.ivcRa])
rp.add([...rightAtriumToIvc].reverse())
rp.add([interfaces.raTricuspid, interfaces.tricuspidProxy]).mark('tricuspidGate')
rp.add([interfaces.tricuspidRv])
rp.add(rvFromTricuspid.slice(0, rvStageIndex)).mark('rv')
rp.add(rvFromTricuspid.slice(rvStageIndex))
rp.add([interfaces.rvPulmonic]).mark('pulmonicGate')
rp.add([interfaces.pulmonicPa])
const rpDistanceBeforePa0Mm = rp.distanceSince('ivcInlet') / config.webUnitsPerMm
rp.add(pulmonarySegments.get(0))
rp.add(pulmonarySegments.get(1))
rp.add(pulmonarySegments.get(4)).mark('tooDistal')
const impellaRpBaseRoute = rp.finish()
const rpRuntimeCurve = new RuntimeCatmullRomCurve(impellaRpBaseRoute.points)
const rpInletProgress = impellaRpBaseRoute.progress.ivcInlet
const rpInletSourceLps = ivc[0]
const rpInletSourceWeb = transformLps(rpInletSourceLps)
const rpInletRuntimeWeb = rpRuntimeCurve.pointAt(rpInletProgress)
const rpInletRuntimeLps = inverseTransformWeb(rpInletRuntimeWeb)
const rpTooProximalProgress = round(
  progressAtRuntimeDistance(
    rpRuntimeCurve,
    rpInletProgress,
    RP_TOO_PROXIMAL_INLET_TO_OUTLET_MM * config.webUnitsPerMm,
  ),
)
const rpCorrectProgress = round(
  progressAtRuntimeDistance(
    rpRuntimeCurve,
    rpInletProgress,
    RP_CORRECT_INLET_TO_OUTLET_MM * config.webUnitsPerMm,
  ),
)
const rpPa0SourcePath = [interfaces.pulmonicPa, ...pulmonarySegments.get(0)]
const rpTooProximalRuntimeLps = inverseTransformWeb(rpRuntimeCurve.pointAt(rpTooProximalProgress))
const rpCorrectRuntimeLps = inverseTransformWeb(rpRuntimeCurve.pointAt(rpCorrectProgress))
const rpTooProximalProjection = nearestPolylineProjection(rpTooProximalRuntimeLps, rpPa0SourcePath)
const rpCorrectProjection = nearestPolylineProjection(rpCorrectRuntimeLps, rpPa0SourcePath)
const rpRawSource205Point = pointAtPolylineDistance(
  rpPa0SourcePath,
  RP_CORRECT_INLET_TO_OUTLET_MM - rpDistanceBeforePa0Mm,
)
const impellaRpRoute = {
  ...impellaRpBaseRoute,
  progress: {
    ...impellaRpBaseRoute.progress,
    tooProximal: rpTooProximalProgress,
    paOutlet: rpCorrectProgress,
    correct: rpCorrectProgress,
  },
  deviceRegistration: {
    modelUrl: '/models/cardiac-devices/impella-rp-v1.glb',
    localForwardAxis: '+Y',
    // The generated facsimile is rooted at its PA outlet center; its IVC inlet is proximal.
    inletLocal: [0, -4.92, 0],
    outletLocal: [0, 0, 0],
    modelScale: 1,
  },
}

const vvVenousDrainage = new RouteBuilder()
vvVenousDrainage.add([...ivc].reverse())
vvVenousDrainage.add([interfaces.ivcRa]).mark('tip')
const vvVenousDrainageRoute = vvVenousDrainage.finish()

const jugularReturn = new RouteBuilder()
jugularReturn.add([...svc].reverse())
jugularReturn.add([interfaces.svcRa])
jugularReturn.add([...rightAtriumToSvc].reverse())
jugularReturn.add([[-29.7, -183, -214]]).mark('tip')
const jugularReturnRoute = jugularReturn.finish()

const vaVenousDrainage = new RouteBuilder()
vaVenousDrainage.add([...ivc].reverse())
vaVenousDrainage.add([interfaces.ivcRa])
vaVenousDrainage.add([...rightAtriumToIvc].reverse())
vaVenousDrainage.add(rightAtriumToSvc).mark('tip')
const vaVenousDrainageRoute = vaVenousDrainage.finish()

const arterialReturn = new RouteBuilder()
const reversedAorta = [...aorta].reverse()
// No iliac/femoral centerline is present. This explicitly schematic inferior extension reaches
// only the first imaged distal-aortic point; the arterial cannula is not advanced up the aorta.
arterialReturn.add([[-12, -112, -325], [-4, -112, -296], reversedAorta[0]]).mark('tip')
const arterialReturnRoute = arterialReturn.finish()

const retrogradeAorticFlow = new RouteBuilder()
retrogradeAorticFlow.add(reversedAorta).mark('proximalAorta')
const retrogradeAorticFlowRoute = retrogradeAorticFlow.finish()

const result = {
  schemaVersion: 3,
  provenance: {
    sourceModel: config.sourceModel,
    sourceCoordinateSystem: config.sourceCoordinateSystem,
    sourceUnits: config.sourceUnits,
    centerLpsMm: config.centerLpsMm,
    webUnitsPerMm: config.webUnitsPerMm,
    transform: '[x, y, z]web = [(L-cx)*s, (S-cz)*s, -(P-cy)*s]',
    sourceCurves: [
      'Sperior Vena Cava (0).mrk.json',
      'Inferior Vena Cava (0).mrk.json',
      'Right Atrium (1).mrk.json',
      'Right Atrium (2).mrk.json',
      'Right Ventricle (0).mrk.json',
      'Pulmonary Artery (0, 1, 4, 5, 9).mrk.json',
      'Aorta curve (0).mrk.json',
    ],
    authoredBridge:
      'Impella aortic-valve-to-LV segment uses reviewed authored LPS landmarks placed against the supplied aortic-valve, LVOT, and LV segmentation surfaces because no LV centerline was supplied.',
    authoredImpella55Access:
      'The Impella 5.5 route begins at an explicit axillary-graft access boundary joined to the supplied aortic centerline because no axillary, subclavian, or graft centerline was supplied. Runtime progress 0 through surgicalAccessEnd is enclosed by a visibly synthetic 10 mm surgical-access conduit and is not claimed as patient-specific CT anatomy.',
    impellaRpValveGates:
      'The Impella RP route follows supplied IVC, RA, RV, and PA curves; the tricuspid and pulmonic points are reviewed route/orifice gates only and do not represent segmented leaflet morphology.',
    impellaRpOutletRegistration: {
      inletSource: 'endpoint of Inferior Vena Cava (0).mrk.json',
      inletSourceControlPointIndex: 0,
      inletSourceLpsMm: rpInletSourceLps.map(round),
      inletSourceWeb: rpInletSourceWeb.map(round),
      inletProgress: rpInletProgress,
      inletRuntimeWeb: rpInletRuntimeWeb.map(round),
      inletRuntimeLpsMm: rpInletRuntimeLps.map(round),
      tooProximalInletToOutletArcMm: RP_TOO_PROXIMAL_INLET_TO_OUTLET_MM,
      correctInletToOutletArcMm: RP_CORRECT_INLET_TO_OUTLET_MM,
      curveContract:
        'Open centripetal CatmullRomCurve3 with the Three.js default 200-division arc-length lookup.',
      correctOutletSource: 'Pulmonary Artery (0).mrk.json',
      correctOutletProgress: rpCorrectProgress,
      correctOutletWeb: rpRuntimeCurve.pointAt(rpCorrectProgress).map(round),
      correctOutletLpsMm: rpCorrectRuntimeLps.map(round),
      correctOutletProjectedSourceLpsMm: rpCorrectProjection.point.map(round),
      correctOutletControlPointBracket: [
        rpCorrectProjection.segmentStartIndex - 1,
        rpCorrectProjection.segmentEndIndex - 1,
      ],
      correctOutletInterpolationFraction: round(rpCorrectProjection.fraction),
      correctOutletDistanceFromSourceCenterlineMm: round(rpCorrectProjection.separationMm),
      correctRuntimeSplineArcMm: round(
        runtimeSegmentLength(rpRuntimeCurve, rpInletProgress, rpCorrectProgress) /
          config.webUnitsPerMm,
      ),
      correctSourcePolylineEquivalentArcMm: round(
        rpDistanceBeforePa0Mm + rpCorrectProjection.arcDistanceMm,
      ),
      tooProximalProgress: rpTooProximalProgress,
      tooProximalLpsMm: rpTooProximalRuntimeLps.map(round),
      tooProximalControlPointBracket: [
        rpTooProximalProjection.segmentStartIndex - 1,
        rpTooProximalProjection.segmentEndIndex - 1,
      ],
      tooProximalRuntimeSplineArcMm: round(
        runtimeSegmentLength(rpRuntimeCurve, rpInletProgress, rpTooProximalProgress) /
          config.webUnitsPerMm,
      ),
      rawSource205MmReference: {
        lpsMm: rpRawSource205Point.point.map(round),
        controlPointBracket: [
          rpRawSource205Point.segmentStartIndex - 1,
          rpRawSource205Point.segmentEndIndex - 1,
        ],
        interpolationFraction: round(rpRawSource205Point.fraction),
        note: 'This unsmoothed source-polyline point is retained for provenance; the rendered Catmull-Rom outlet is calibrated distally so its visible arc is 205 mm.',
      },
      distalContinuation:
        'The too-distal stage continues through the remaining PA0 points and supplied PA1 and PA4 centerlines.',
    },
    authoredInterfaceLandmarks:
      'Centerline-to-chamber and chamber-to-valve joins use reviewed authored LPS landmarks stored in build-ct-centerlines.mjs; they were placed against the supplied Slicer segmentation and are not automatically extracted mask interfaces.',
    authoredPeripheralExtension:
      'The peripheral VA arterial route uses a schematic inferior boundary extension to the first imaged distal-aortic point because no iliac or femoral arterial centerline was supplied; retrograde aortic flow is stored separately.',
    authoredRightAtrialReturnEndpoint:
      'The dual-site VV jugular return endpoint is an authored right-atrial target connected to the CT-derived SVC and RA curves.',
    valveMorphology:
      'Separate right-coronary, non-coronary, and left-coronary cusp segmentations provide the complete aortic-valve morphology. Mitral, tricuspid, and pulmonic source segments are location proxies and are used only as route gates.',
  },
  pac: pacRoute,
  impella: impellaRoute,
  impella55: impella55Route,
  impellaRp: impellaRpRoute,
  ecmo: {
    vv: {
      femoralVenousDrainage: vvVenousDrainageRoute,
      jugularVenousReturn: jugularReturnRoute,
    },
    va: {
      femoralVenousDrainage: vaVenousDrainageRoute,
      femoralArterialReturn: arterialReturnRoute,
      retrogradeAorticFlow: retrogradeAorticFlowRoute,
    },
  },
}

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`)
console.log(
  `Built CT cardiac routes: PAC ${result.pac.points.length} points, Impella CP/5.5/RP ${result.impella.points.length}/${result.impella55.points.length}/${result.impellaRp.points.length} points, VV/VA ECMO ${result.ecmo.vv.femoralVenousDrainage.points.length}/${result.ecmo.vv.jugularVenousReturn.points.length}/${result.ecmo.va.femoralArterialReturn.points.length} points.`,
)
