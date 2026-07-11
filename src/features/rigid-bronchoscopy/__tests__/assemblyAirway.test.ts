import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import {
  getVentilationScopeAngleDegrees,
  getVentilationScopePose,
  realisticAirwayGeometry,
  RIGID_BRONCHOSCOPY_AIRWAY_PUBLIC_PATH,
  transformVentilationScopePoint,
  VENTILATION_FENESTRATION_LOCAL_XS,
} from '../content/assemblyAirway'
import { bronchoscopeTubeOptions, type AssemblyVector3 } from '../content/assemblyParts'
import { getTubeDistalX } from '../content/assemblyPathways'

interface AirwayAssetProvenance {
  schema: string
  educationalUseOnly: boolean
  source: {
    glb: string
    glbSha256: string
    airwayGraph: string
    airwayGraphSha256: string
    coordinateSystem: string
    units: string
    meshName: string
  }
  teachingTransform: {
    worldUnitsPerMm: number
    carinaWorld: AssemblyVector3
  }
  output: {
    path: string
    vertexCount: number
    triangleCount: number
    boundsWorld: readonly [AssemblyVector3, AssemblyVector3]
  }
}

const anatomyDirectory = path.join(process.cwd(), 'public/models/rigid-bronchoscopy/anatomy')
const provenancePath = path.join(anatomyDirectory, 'central-airway.provenance.json')

function sha256(filePath: string) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function parseGlbJson(filePath: string) {
  const bytes = readFileSync(filePath)
  let offset = 12

  while (offset < bytes.length) {
    const chunkLength = bytes.readUInt32LE(offset)
    const chunkType = bytes.readUInt32LE(offset + 4)
    if (chunkType === 0x4e4f534a) {
      return JSON.parse(
        bytes
          .subarray(offset + 8, offset + 8 + chunkLength)
          .toString('utf8')
          .trim(),
      ) as {
        meshes: Array<{
          primitives: Array<{ attributes: Record<string, number> }>
        }>
      }
    }
    offset += 8 + chunkLength
  }

  throw new Error(`No JSON chunk found in ${filePath}`)
}

function tube(id: string) {
  const match = bronchoscopeTubeOptions.find((part) => part.id === id)
  if (!match) throw new Error(`Missing test tube ${id}`)
  return match
}

function subtract(a: AssemblyVector3, b: AssemblyVector3): AssemblyVector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function magnitude(vector: AssemblyVector3) {
  return Math.hypot(vector[0], vector[1], vector[2])
}

function dot(a: AssemblyVector3, b: AssemblyVector3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function expectVectorClose(actual: AssemblyVector3, expected: AssemblyVector3, digits = 8) {
  for (let index = 0; index < 3; index += 1) {
    expect(actual[index]).toBeCloseTo(expected[index], digits)
  }
}

describe('rigid bronchoscopy realistic airway and scope pose', () => {
  it('orients the root, carina, and two main bronchi in the teaching frame', () => {
    const { carina, glottis, instrumentedMainstem, oppositeMainstem, trachea } =
      realisticAirwayGeometry

    expectVectorClose(carina, [1.22, -0.3, 0])
    expectVectorClose(trachea[trachea.length - 1], carina)
    expectVectorClose(instrumentedMainstem[0], carina)
    expectVectorClose(oppositeMainstem[0], carina)

    expect(glottis[0]).toBeLessThan(carina[0])
    expect(glottis[1]).toBeCloseTo(carina[1], 8)
    expect(glottis[2]).toBeCloseTo(carina[2], 8)

    const enteredBranch = instrumentedMainstem[1]
    const oppositeBranch = oppositeMainstem[1]
    expect(enteredBranch[0]).toBeGreaterThan(carina[0])
    expect(oppositeBranch[0]).toBeGreaterThan(carina[0])
    expect(enteredBranch[1]).toBeLessThan(carina[1])
    expect(oppositeBranch[1]).toBeGreaterThan(carina[1])
    expect((enteredBranch[1] - carina[1]) * (oppositeBranch[1] - carina[1])).toBeLessThan(0)
  })

  it('uses a nonzero rigid angle after the tip passes the carina', () => {
    const bronchoscope = tube('tube-bt2103-3')
    const pastCarinaPose = getVentilationScopePose(getTubeDistalX(bronchoscope), 'past-carina')
    const atCarinaPose = getVentilationScopePose(getTubeDistalX(bronchoscope), 'at-carina')
    const pastCarinaAngles = getVentilationScopeAngleDegrees(pastCarinaPose)
    const atCarinaAngles = getVentilationScopeAngleDegrees(atCarinaPose)

    expect(Math.abs(pastCarinaAngles.yaw)).toBeGreaterThan(1)
    expect(Math.abs(pastCarinaAngles.pitch)).toBeGreaterThan(0.1)
    expect(atCarinaAngles.yaw).toBeCloseTo(0, 8)
    expect(atCarinaAngles.pitch).toBeCloseTo(0, 8)
    expect(Math.hypot(...pastCarinaPose.quaternion)).toBeCloseTo(1, 10)
  })

  it('keeps the angled shaft inside the central carinal opening', () => {
    const bronchoscope = tube('tube-bt2103-3')
    const pose = getVentilationScopePose(getTubeDistalX(bronchoscope), 'past-carina')
    const carina = realisticAirwayGeometry.carina
    const fractionAtCarina =
      (carina[0] - pose.steeringAnchor[0]) / (pose.worldTip[0] - pose.steeringAnchor[0])
    const shaftAtCarina: AssemblyVector3 = [
      carina[0],
      pose.steeringAnchor[1] + (pose.worldTip[1] - pose.steeringAnchor[1]) * fractionAtCarina,
      pose.steeringAnchor[2] + (pose.worldTip[2] - pose.steeringAnchor[2]) * fractionAtCarina,
    ]

    expect(pose.worldTip[1]).toBeLessThan(carina[1])
    expect(Math.hypot(shaftAtCarina[1] - carina[1], shaftAtCarina[2] - carina[2])).toBeLessThan(
      0.08,
    )
  })

  it.each([
    ['long bronchial tube', 'tube-bt2103-3'],
    ['short tracheal tube', 'tube-bt2203-3'],
  ])('maps the %s local distal tip exactly to the selected world target', (_, tubeId) => {
    const selectedTube = tube(tubeId)
    const pose = getVentilationScopePose(getTubeDistalX(selectedTube), 'past-carina')

    expectVectorClose(transformVentilationScopePoint(pose.localTip, pose), pose.worldTip, 10)
  })

  it('gives long and short tubes the same world target without conflating their local lengths', () => {
    const longTube = tube('tube-bt2103-3')
    const shortTube = tube('tube-bt2203-3')
    const longPose = getVentilationScopePose(getTubeDistalX(longTube), 'past-carina')
    const shortPose = getVentilationScopePose(getTubeDistalX(shortTube), 'past-carina')

    expect(longPose.localTip[0]).not.toBeCloseTo(shortPose.localTip[0], 6)
    expectVectorClose(longPose.worldTip, shortPose.worldTip, 10)
  })

  it('applies one rigid pose to fenestration markers and device-axis points', () => {
    const bronchoscope = tube('tube-bt2103-3')
    const pose = getVentilationScopePose(getTubeDistalX(bronchoscope), 'past-carina')
    const proximalFenestrationX = VENTILATION_FENESTRATION_LOCAL_XS.at(-2)
    const distalFenestrationX = VENTILATION_FENESTRATION_LOCAL_XS.at(-1)
    if (proximalFenestrationX === undefined || distalFenestrationX === undefined) {
      throw new Error('Expected at least two fenestration marker positions')
    }
    const proximalDevicePoint: AssemblyVector3 = [
      proximalFenestrationX,
      realisticAirwayGeometry.airwayY,
      0,
    ]
    const distalDevicePoint: AssemblyVector3 = [
      distalFenestrationX,
      realisticAirwayGeometry.airwayY,
      0,
    ]
    const distalMarker: AssemblyVector3 = [
      distalFenestrationX,
      realisticAirwayGeometry.airwayY,
      0.052,
    ]

    const proximalWorld = transformVentilationScopePoint(proximalDevicePoint, pose)
    const distalWorld = transformVentilationScopePoint(distalDevicePoint, pose)
    const markerWorld = transformVentilationScopePoint(distalMarker, pose)
    const transformedAxis = subtract(
      transformVentilationScopePoint(
        [pose.localTip[0] + 1, pose.localTip[1], pose.localTip[2]],
        pose,
      ),
      pose.worldTip,
    )
    const transformedDeviceSpan = subtract(distalWorld, proximalWorld)

    expect(magnitude(subtract(markerWorld, distalWorld))).toBeCloseTo(0.052, 10)
    const expectedFenestrationSpacing = distalFenestrationX - proximalFenestrationX
    expect(magnitude(transformedDeviceSpan)).toBeCloseTo(expectedFenestrationSpacing, 10)
    expect(dot(transformedDeviceSpan, transformedAxis)).toBeCloseTo(expectedFenestrationSpacing, 10)
  })

  it('packages the generated airway with verifiable source provenance', () => {
    const assetPath = path.join(
      process.cwd(),
      'public',
      RIGID_BRONCHOSCOPY_AIRWAY_PUBLIC_PATH.replace(/^\//, ''),
    )

    expect(existsSync(assetPath)).toBe(true)
    expect(existsSync(provenancePath)).toBe(true)
    expect(statSync(assetPath).size).toBeGreaterThan(1_000_000)
    expect(readFileSync(assetPath).toString('utf8', 0, 4)).toBe('glTF')
    const gltf = parseGlbJson(assetPath)
    expect(
      gltf.meshes.every((mesh) =>
        mesh.primitives.every((primitive) => primitive.attributes.NORMAL !== undefined),
      ),
    ).toBe(true)

    const provenance = JSON.parse(readFileSync(provenancePath, 'utf8')) as AirwayAssetProvenance
    expect(provenance.schema).toBe('rigid_bronchoscopy_airway_asset/v1')
    expect(provenance.educationalUseOnly).toBe(true)
    expect(provenance.source).toMatchObject({
      glb: 'new_anatomy_module/Airway.glb',
      airwayGraph: 'public/airway-anatomy/case-001/metadata/airway_graph.json',
      coordinateSystem: 'LPS',
      units: 'mm',
      meshName: 'Final_airway_target',
    })
    expect(provenance.source.glbSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(provenance.source.airwayGraphSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(sha256(path.join(process.cwd(), provenance.source.glb))).toBe(
      provenance.source.glbSha256,
    )
    expect(sha256(path.join(process.cwd(), provenance.source.airwayGraph))).toBe(
      provenance.source.airwayGraphSha256,
    )
    expect(provenance.output.path).toBe(`public${RIGID_BRONCHOSCOPY_AIRWAY_PUBLIC_PATH}`)
    expect(provenance.output.vertexCount).toBe(33_664)
    expect(provenance.output.triangleCount).toBe(67_320)
    expect(provenance.teachingTransform.worldUnitsPerMm).toBe(0.009)
    expectVectorClose(provenance.teachingTransform.carinaWorld, realisticAirwayGeometry.carina)
    expectVectorClose(provenance.output.boundsWorld[0], realisticAirwayGeometry.boundsMin, 5)
    expectVectorClose(provenance.output.boundsWorld[1], realisticAirwayGeometry.boundsMax, 5)
  })
})
