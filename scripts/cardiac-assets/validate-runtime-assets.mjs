import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import * as THREE from 'three'

const root = process.cwd()
const assetDirectory = path.join(root, 'public', 'models', 'cardiac-devices')
const cardiacDirectory = path.join(root, 'public', 'models', 'cardiac')
const runtimeManifest = JSON.parse(
  await readFile(path.join(assetDirectory, 'asset-manifest.json'), 'utf8'),
)
const ctManifest = JSON.parse(
  await readFile(path.join(cardiacDirectory, 'ct-asset-manifest.json'), 'utf8'),
)
const ctRig = JSON.parse(
  await readFile(
    path.join(root, 'src', 'features', 'cardiac-anatomy', 'content', 'cardiac-ct-rig.json'),
    'utf8',
  ),
)
const rig = JSON.parse(
  await readFile(
    path.join(root, 'src', 'features', 'cardiac-anatomy', 'content', 'cardiac-rig.json'),
    'utf8',
  ),
)

const valveMorphologyBoundary =
  'Only the aortic cusps are complete segmented valve morphology; mitral, tricuspid, and pulmonic locations are route/orifice proxies only.'

const proceduralImpellaContracts = {
  'impella-cp-v1.glb': {
    compatibilityAlias: '/models/cardiac-devices/impella-cp.glb',
    root: 'Impella_CP_Root',
    assembly: 'Impella_CP',
    nominalInvasiveLengthMm: 151,
    anchors: {
      Anchor_Impella_CP_InletCenter: [0, 0, 0],
      Anchor_Impella_CP_AorticAnnulus: [0, -0.84, 0],
      Anchor_Impella_CP_OutletCenter: [0, -1.128, 0],
      Anchor_Impella_CP_DistalPigtailTip: [0.12, 0.72, 0],
      Anchor_Impella_CP_ProximalShaftExit: [0, -2.544, 0],
    },
    components: [
      'Impella_CP_DistalPigtail',
      'Impella_CP_InletCage',
      'Impella_CP_ReinforcedCannula',
      'Impella_CP_ReinforcementSpiral',
      'Impella_CP_AorticAnnulusMarker',
      'Impella_CP_OutletCage',
      'Impella_CP_MotorHousing',
      'Impella_CP_OpenPressureArea',
      'Impella_CP_ProximalShaft',
    ],
  },
  'impella-55-v1.glb': {
    compatibilityAlias: '/models/cardiac-devices/impella-55.glb',
    root: 'Impella_55_Root',
    assembly: 'Impella_55',
    nominalInvasiveLengthMm: 114,
    anchors: {
      Anchor_Impella_55_InletCenter: [0, 0, 0],
      Anchor_Impella_55_AorticAnnulus: [0, -1.2, 0],
      Anchor_Impella_55_OutletCenter: [0, -1.56, 0],
      Anchor_Impella_55_DistalTip: [0, 0.12, 0],
      Anchor_Impella_55_ProximalShaftExit: [0, -2.616, 0],
    },
    components: [
      'Impella_55_DistalTip',
      'Impella_55_InletCage',
      'Impella_55_ReinforcedCannula',
      'Impella_55_ReinforcementSpiral',
      'Impella_55_AorticAnnulusMarker',
      'Impella_55_FiberOpticSensor',
      'Impella_55_OutletCage',
      'Impella_55_MotorHousing',
      'Impella_55_ProximalShaft',
    ],
  },
  'impella-rp-v1.glb': {
    compatibilityAlias: '/models/cardiac-devices/impella-rp.glb',
    root: 'Impella_RP_Root',
    assembly: 'Impella_RP',
    nominalInvasiveLengthMm: 238,
    anchors: {
      Anchor_Impella_RP_OutletCenter: [0, 0, 0],
      Anchor_Impella_RP_InletCenter: [0, -4.92, 0],
      Anchor_Impella_RP_MotorCenter: [0, -5.112, 0],
      Anchor_Impella_RP_DistalPigtailTip: [0.08, 0.24, 0],
      Anchor_Impella_RP_ProximalShaftExit: [0, -5.312, 0],
    },
    components: [
      'Impella_RP_DistalPigtail',
      'Impella_RP_OutletCage',
      'Impella_RP_ReinforcedCannula',
      'Impella_RP_ReinforcementSpiral',
      'Impella_RP_DifferentialPressureSensor',
      'Impella_RP_InletCage',
      'Impella_RP_MotorHousing',
      'Impella_RP_ProximalShaft',
    ],
  },
}

const proceduralImpellaMaterials = [
  'Impella blue polyurethane',
  'Impella red inlet outlet',
  'Impella silver motor',
  'Impella radiopaque marker',
  'Impella dark proximal shaft',
]

const requiredNodes = {
  'heart-great-vessels.glb': [
    'Heart_Aorta_OpenLumen',
    'Heart_PulmonaryArtery_2',
    'Landmark_AorticValve',
    'Landmark_RightPAWedge',
  ],
  'iabp-aorta-cutaway.glb': [
    'IABP_Aorta_OpenLumen',
    'IABP_RenalArtery_1',
    'IABP_IliacArtery_2',
    'Landmark_LeftSubclavian',
    'Landmark_RenalArteries',
  ],
  'iabp-balloon.glb': [
    'IABP_Balloon',
    'IABP_CentralCatheter',
    'Anchor_IABP_CranialTip',
    'Anchor_IABP_CaudalEnd',
  ],
  ...Object.fromEntries(
    Object.entries(proceduralImpellaContracts).map(([filename, contract]) => [
      filename,
      [contract.root, contract.assembly, ...Object.keys(contract.anchors), ...contract.components],
    ]),
  ),
  'lvad.glb': [
    'LVAD_InflowCannula',
    'LVAD_PumpAndHousing',
    'Anchor_LVAD_Inflow',
    'Anchor_LVAD_Outflow',
  ],
}

function readGlb(buffer, filename) {
  if (buffer.toString('ascii', 0, 4) !== 'glTF') throw new Error(`${filename} is not a GLB`)
  let offset = 12
  let document
  let binaryChunk
  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset)
    const chunkType = buffer.readUInt32LE(offset + 4)
    if (chunkType === 0x4e4f534a) {
      document = JSON.parse(buffer.subarray(offset + 8, offset + 8 + chunkLength).toString('utf8'))
    } else if (chunkType === 0x004e4942) {
      binaryChunk = buffer.subarray(offset + 8, offset + 8 + chunkLength)
    }
    offset += 8 + chunkLength
  }
  if (!document) throw new Error(`${filename} has no JSON chunk`)
  return { document, binaryChunk }
}

function imageDimensions(buffer, mimeType) {
  if (mimeType === 'image/png' && buffer.length >= 24) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
  }
  if (mimeType === 'image/jpeg' && buffer[0] === 0xff && buffer[1] === 0xd8) {
    const startOfFrameMarkers = new Set([
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
    ])
    let offset = 2
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1
        continue
      }
      const marker = buffer[offset + 1]
      if (startOfFrameMarkers.has(marker)) {
        return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) }
      }
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2
        continue
      }
      const segmentLength = buffer.readUInt16BE(offset + 2)
      if (segmentLength < 2) break
      offset += 2 + segmentLength
    }
  }
  return null
}

function triangleCount(document) {
  return (document.meshes ?? []).reduce(
    (total, mesh) =>
      total +
      mesh.primitives.reduce((meshTotal, primitive) => {
        if ((primitive.mode ?? 4) !== 4 || primitive.indices === undefined) return meshTotal
        return meshTotal + document.accessors[primitive.indices].count / 3
      }, 0),
    0,
  )
}

function anchorMapsMatch(actual, expected, tolerance = 1e-8) {
  if (!actual || Object.keys(actual).length !== Object.keys(expected).length) return false
  return Object.entries(expected).every(([name, expectedPoint]) => {
    const actualPoint = actual[name]
    return (
      Array.isArray(actualPoint) &&
      actualPoint.length === 3 &&
      expectedPoint.every(
        (expectedCoordinate, index) =>
          Math.abs(expectedCoordinate - actualPoint[index]) <= tolerance,
      )
    )
  })
}

const errors = []
for (const [filename, entry] of Object.entries(runtimeManifest.assets)) {
  const pathname = path.join(assetDirectory, filename)
  const buffer = await readFile(pathname)
  const { document, binaryChunk } = readGlb(buffer, filename)
  const names = new Set((document.nodes ?? []).map((node) => node.name).filter(Boolean))
  const triangles = triangleCount(document)
  const fileStats = await stat(pathname)

  if (entry.url !== `/models/cardiac-devices/${filename}`) {
    errors.push(`${filename}: invalid production URL ${entry.url}`)
  }
  if (!document.extensionsUsed?.includes('KHR_draco_mesh_compression')) {
    errors.push(`${filename}: missing local Draco compression`)
  }
  if (triangles > entry.limits.triangles) {
    errors.push(`${filename}: ${triangles} triangles exceeds ${entry.limits.triangles}`)
  }
  if (fileStats.size > entry.limits.bytes) {
    errors.push(`${filename}: ${fileStats.size} bytes exceeds ${entry.limits.bytes}`)
  }
  if (entry.triangles !== triangles) {
    errors.push(`${filename}: manifest records ${entry.triangles} triangles, actual ${triangles}`)
  }
  if (entry.bytes !== fileStats.size) {
    errors.push(`${filename}: manifest records ${entry.bytes} bytes, actual ${fileStats.size}`)
  }
  for (const nodeName of requiredNodes[filename] ?? []) {
    if (!names.has(nodeName)) errors.push(`${filename}: missing node ${nodeName}`)
  }
  for (const image of document.images ?? []) {
    const view = document.bufferViews?.[image.bufferView]
    if (!view || !binaryChunk) {
      errors.push(`${filename}: texture ${image.name ?? image.uri ?? 'unnamed'} is not embedded`)
      continue
    }
    const start = view.byteOffset ?? 0
    const encodedImage = binaryChunk.subarray(start, start + view.byteLength)
    const dimensions = imageDimensions(encodedImage, image.mimeType)
    if (!dimensions) {
      errors.push(`${filename}: could not inspect texture ${image.name ?? 'unnamed'}`)
    } else if (dimensions.width > 1024 || dimensions.height > 1024) {
      errors.push(
        `${filename}: texture ${image.name ?? 'unnamed'} is ${dimensions.width}x${dimensions.height}; maximum is 1024x1024`,
      )
    }
  }
  if (filename === 'iabp-balloon.glb') {
    const inflatedMorph = document.meshes?.find(
      (mesh) =>
        mesh.extras?.targetNames?.includes('Inflated') &&
        mesh.primitives.some((primitive) => (primitive.targets?.length ?? 0) > 0),
    )
    if (!inflatedMorph) errors.push(`${filename}: missing named Inflated morph target`)
    if (inflatedMorph?.weights?.[0] !== 0) {
      errors.push(`${filename}: Inflated morph must default to the collapsed value 0`)
    }
  }
  const impellaContract = proceduralImpellaContracts[filename]
  if (impellaContract) {
    if (
      entry.compatibilityAliases?.length !== 1 ||
      entry.compatibilityAliases[0] !== impellaContract.compatibilityAlias
    ) {
      errors.push(`${filename}: manifest compatibility alias is missing or inconsistent`)
    } else {
      const compatibilityBuffer = await readFile(
        path.join(assetDirectory, path.basename(impellaContract.compatibilityAlias)),
      )
      if (!buffer.equals(compatibilityBuffer)) {
        errors.push(`${filename}: compatibility alias bytes differ from the versioned asset`)
      }
    }
    if ((document.images ?? []).length > 0) {
      errors.push(`${filename}: procedural teaching asset must not contain a texture atlas`)
    }
    const materialNames = new Set((document.materials ?? []).map((material) => material.name))
    for (const materialName of proceduralImpellaMaterials) {
      if (!materialNames.has(materialName)) {
        errors.push(`${filename}: missing flat PBR material ${materialName}`)
      }
    }
    for (const [nodeName, expected] of Object.entries(impellaContract.anchors)) {
      const node = document.nodes?.find((candidate) => candidate.name === nodeName)
      const translation = node?.translation ?? [0, 0, 0]
      if (expected.some((coordinate, index) => Math.abs(coordinate - translation[index]) > 1e-5)) {
        errors.push(`${filename}: ${nodeName} is not exported at ${expected.join(', ')}`)
      }
    }
    const rootNode = document.nodes?.find((node) => node.name === impellaContract.root)
    if (rootNode?.translation || rootNode?.rotation || rootNode?.scale) {
      errors.push(`${filename}: ${impellaContract.root} must have an identity transform`)
    }
    if (
      rootNode?.extras?.local_forward_axis !== '+Y' ||
      rootNode?.extras?.educational_facsimile !== true ||
      rootNode?.extras?.nominal_invasive_length_mm !== impellaContract.nominalInvasiveLengthMm
    ) {
      errors.push(`${filename}: root physical-scale metadata is incomplete or inconsistent`)
    }
    if (rootNode?.extras?.valve_morphology_boundary !== valveMorphologyBoundary) {
      errors.push(`${filename}: root is missing the aortic-only valve morphology boundary`)
    }
    if (
      entry.physicalScale?.webUnitsPerMm !== 0.024 ||
      entry.physicalScale?.nominalInvasiveLengthMm !== impellaContract.nominalInvasiveLengthMm
    ) {
      errors.push(`${filename}: manifest physical scale is incomplete or inconsistent`)
    }
    if (
      entry.anchorConvention?.localForwardAxis !== '+Y' ||
      !anchorMapsMatch(entry.anchorConvention?.anchors, impellaContract.anchors)
    ) {
      errors.push(`${filename}: manifest anchor contract does not match the shipped nodes`)
    }
    if (entry.valveMorphologyBoundary !== valveMorphologyBoundary) {
      errors.push(`${filename}: manifest is missing the aortic-only morphology boundary`)
    }
  }
}

if (runtimeManifest.schemaVersion !== 2) {
  errors.push(`asset-manifest.json: expected schemaVersion 2`)
}
if (runtimeManifest.valveMorphologyBoundary !== valveMorphologyBoundary) {
  errors.push(`asset-manifest.json: missing the aortic-only valve morphology boundary`)
}

for (const [assetId, url] of Object.entries(rig.assets)) {
  if (!url.startsWith('/models/cardiac-devices/')) continue
  const filename = path.basename(url)
  const entry = runtimeManifest.assets[filename]
  if (!entry) {
    errors.push(`cardiac-rig.json: ${assetId} points to unmanifested asset ${filename}`)
  } else if (entry.url !== url) {
    errors.push(`cardiac-rig.json: ${assetId} URL does not match the runtime manifest`)
  }
}

const ctFilename = path.basename(ctManifest.asset.url)
const ctPath = path.join(cardiacDirectory, ctFilename)
const ctBuffer = await readFile(ctPath)
const { document: ctDocument } = readGlb(ctBuffer, ctFilename)
const ctNames = new Set((ctDocument.nodes ?? []).map((node) => node.name).filter(Boolean))
const ctTriangles = triangleCount(ctDocument)
const ctFileStats = await stat(ctPath)
const expectedCtUrl = '/models/cardiac/heart-ct-animated-v1.glb'
const expectedCtCompatibilityAlias = '/models/cardiac/heart-ct-animated.glb'
if (ctManifest.asset.url !== expectedCtUrl) {
  errors.push(`ct-asset-manifest.json: expected versioned CT heart URL ${expectedCtUrl}`)
}
if (
  ctManifest.asset.compatibilityAliases?.length !== 1 ||
  ctManifest.asset.compatibilityAliases[0] !== expectedCtCompatibilityAlias
) {
  errors.push(`ct-asset-manifest.json: CT heart compatibility alias is missing or inconsistent`)
} else {
  const ctCompatibilityBuffer = await readFile(
    path.join(cardiacDirectory, path.basename(expectedCtCompatibilityAlias)),
  )
  if (!ctBuffer.equals(ctCompatibilityBuffer)) {
    errors.push(`${ctFilename}: compatibility alias bytes differ from the versioned asset`)
  }
}
const requiredCtNodes = [
  'CT_Heart_Root',
  'CT_LV_Myocardium',
  'CT_LV_Cavity',
  'CT_RV_Cavity',
  'CT_RA_Cavity',
  'CT_LA_Cavity',
  'CT_Aorta',
  'CT_PulmonaryArteries',
  'CT_SVC',
  'CT_IVC',
  'CT_Valve_Aortic_RCC',
  'CT_Valve_Aortic_NCC',
  'CT_Valve_Aortic_LCC',
  'Anchor_AorticValve',
  'Anchor_TricuspidOrifice',
  'Anchor_PulmonicOrifice',
  'Anchor_ImpellaInlet35mm',
]
for (const name of requiredCtNodes) {
  if (!ctNames.has(name)) errors.push(`${ctFilename}: missing node ${name}`)
}
for (const cuspName of ['CT_Valve_Aortic_RCC', 'CT_Valve_Aortic_NCC', 'CT_Valve_Aortic_LCC']) {
  const cuspNode = ctDocument.nodes?.find((node) => node.name === cuspName)
  const cuspMesh = cuspNode?.mesh === undefined ? undefined : ctDocument.meshes?.[cuspNode.mesh]
  if (
    !cuspMesh?.extras?.targetNames?.includes('ValveOpen') ||
    !cuspMesh.primitives.some((primitive) => (primitive.targets?.length ?? 0) > 0)
  ) {
    errors.push(`${ctFilename}: ${cuspName} is missing its ValveOpen morph target`)
  }
}
for (const proxyName of [
  'CT_Valve_Aortic',
  'CT_Landmark_MitralOrifice',
  'CT_Landmark_TricuspidOrifice',
  'CT_Landmark_PulmonicOrifice',
]) {
  if (ctNames.has(proxyName)) {
    errors.push(
      `${ctFilename}: location-proxy surface must not ship as valve morphology: ${proxyName}`,
    )
  }
}
if (!ctDocument.animations?.some((animation) => animation.name === 'CardiacCycle')) {
  errors.push(`${ctFilename}: missing named CardiacCycle animation`)
}
if (!ctDocument.extensionsUsed?.includes('KHR_draco_mesh_compression')) {
  errors.push(`${ctFilename}: missing Draco compression`)
}
if (ctTriangles > ctManifest.asset.limits.triangles) {
  errors.push(
    `${ctFilename}: ${ctTriangles} triangles exceeds ${ctManifest.asset.limits.triangles}`,
  )
}
if (ctFileStats.size > ctManifest.asset.limits.bytes) {
  errors.push(`${ctFilename}: ${ctFileStats.size} bytes exceeds ${ctManifest.asset.limits.bytes}`)
}
if (ctManifest.asset.triangles !== ctTriangles) {
  errors.push(
    `${ctFilename}: manifest records ${ctManifest.asset.triangles} triangles, actual ${ctTriangles}`,
  )
}
if (ctManifest.asset.bytes !== ctFileStats.size) {
  errors.push(
    `${ctFilename}: manifest records ${ctManifest.asset.bytes} bytes, actual ${ctFileStats.size}`,
  )
}
if (ctDocument.buffers?.some((buffer) => typeof buffer.uri === 'string')) {
  errors.push(`${ctFilename}: GLB contains an external or data-URI buffer`)
}
const animatedCtMeshes = (ctDocument.meshes ?? []).filter((mesh) =>
  mesh.primitives.some((primitive) => (primitive.targets?.length ?? 0) > 0),
)
if (animatedCtMeshes.length < 6) {
  errors.push(`${ctFilename}: expected structure-aware morphs on at least six cardiac meshes`)
}
if (rig.assets.heart !== ctManifest.asset.url) {
  errors.push(`cardiac-rig.json: heart URL does not match CT asset manifest`)
}
const expectedRegisteredAssets = {
  impella: rig.assets.impellaCp,
  impella55: rig.assets.impella55,
  impellaRp: rig.assets.impellaRp,
}
for (const [routeName, expectedUrl] of Object.entries(expectedRegisteredAssets)) {
  if (ctRig[routeName]?.deviceRegistration?.modelUrl !== expectedUrl) {
    errors.push(`${routeName}: CT registration and runtime asset URLs disagree`)
  }
}

function validateRoute(route, label) {
  if (!Array.isArray(route?.points) || route.points.length < 2) {
    errors.push(`${label}: route requires at least two points`)
    return
  }
  for (const [index, point] of route.points.entries()) {
    if (
      !Array.isArray(point) ||
      point.length !== 3 ||
      point.some((coordinate) => !Number.isFinite(coordinate))
    ) {
      errors.push(`${label}: invalid point ${index}`)
      break
    }
    if (index > 0) {
      const previous = route.points[index - 1]
      const spacing = Math.hypot(
        point[0] - previous[0],
        point[1] - previous[1],
        point[2] - previous[2],
      )
      if (spacing <= 0 || spacing > 0.09) {
        errors.push(`${label}: non-uniform or duplicate sample at ${index} (${spacing})`)
        break
      }
    }
  }
  for (const [name, progress] of Object.entries(route.progress ?? {})) {
    if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
      errors.push(`${label}: invalid ${name} progress ${progress}`)
    }
  }
}

function runtimeCurveLengthMm(route, startProgress, endProgress, webUnitsPerMm) {
  const curve = new THREE.CatmullRomCurve3(
    route.points.map((point) => new THREE.Vector3(...point)),
    false,
    'centripetal',
  )
  const samples = 512
  let previous = curve.getPointAt(startProgress)
  let lengthWebUnits = 0
  for (let index = 1; index <= samples; index += 1) {
    const progress = startProgress + ((endProgress - startProgress) * index) / samples
    const current = curve.getPointAt(progress)
    lengthWebUnits += previous.distanceTo(current)
    previous = current
  }
  return lengthWebUnits / webUnitsPerMm
}

if (ctRig.schemaVersion !== 3) errors.push(`cardiac-ct-rig.json: expected schemaVersion 3`)
if (ctRig.provenance?.sourceCoordinateSystem !== 'LPS') {
  errors.push(`cardiac-ct-rig.json: source coordinate system must be LPS`)
}
if (!ctRig.provenance?.authoredBridge?.includes('no LV centerline')) {
  errors.push(`cardiac-ct-rig.json: missing explicit non-centerline LV bridge provenance`)
}
if (!ctRig.provenance?.authoredInterfaceLandmarks?.includes('reviewed authored LPS landmarks')) {
  errors.push(`cardiac-ct-rig.json: missing authored interface-landmark provenance`)
}
if (!ctRig.provenance?.authoredImpella55Access?.includes('axillary-graft access boundary')) {
  errors.push(`cardiac-ct-rig.json: missing authored Impella 5.5 access provenance`)
}
if (!ctRig.provenance?.impellaRpValveGates?.includes('route/orifice gates only')) {
  errors.push(`cardiac-ct-rig.json: missing Impella RP proxy-valve gate provenance`)
}
const impellaRpOutletRegistration = ctRig.provenance?.impellaRpOutletRegistration
if (
  impellaRpOutletRegistration?.inletSource !== 'endpoint of Inferior Vena Cava (0).mrk.json' ||
  impellaRpOutletRegistration?.inletSourceControlPointIndex !== 0 ||
  impellaRpOutletRegistration?.inletProgress !== ctRig.impellaRp.progress.ivcInlet ||
  impellaRpOutletRegistration?.correctInletToOutletArcMm !== 205 ||
  impellaRpOutletRegistration?.tooProximalInletToOutletArcMm !== 190 ||
  JSON.stringify(impellaRpOutletRegistration?.correctOutletControlPointBracket) !==
    JSON.stringify([26, 27]) ||
  JSON.stringify(impellaRpOutletRegistration?.rawSource205MmReference?.controlPointBracket) !==
    JSON.stringify([16, 17]) ||
  Math.abs(impellaRpOutletRegistration?.correctRuntimeSplineArcMm - 205) > 0.1 ||
  Math.abs(impellaRpOutletRegistration?.tooProximalRuntimeSplineArcMm - 190) > 0.1
) {
  errors.push(`cardiac-ct-rig.json: missing validated Impella RP PA0 outlet registration`)
}
if (!ctRig.provenance?.valveMorphology?.includes('cusp segmentations')) {
  errors.push(`cardiac-ct-rig.json: missing valve-morphology boundary`)
}
if (!ctRig.provenance?.authoredPeripheralExtension?.includes('no iliac or femoral')) {
  errors.push(`cardiac-ct-rig.json: missing peripheral-extension provenance`)
}
if (!ctRig.provenance?.authoredRightAtrialReturnEndpoint?.includes('authored')) {
  errors.push(`cardiac-ct-rig.json: missing VV return-endpoint provenance`)
}
validateRoute(ctRig.pac, 'cardiac-ct-rig.pac')
validateRoute(ctRig.impella, 'cardiac-ct-rig.impella')
validateRoute(ctRig.impella55, 'cardiac-ct-rig.impella55')
validateRoute(ctRig.impellaRp, 'cardiac-ct-rig.impellaRp')
validateRoute(ctRig.ecmo.vv.femoralVenousDrainage, 'cardiac-ct-rig.ecmo.vv.drainage')
validateRoute(ctRig.ecmo.vv.jugularVenousReturn, 'cardiac-ct-rig.ecmo.vv.return')
validateRoute(ctRig.ecmo.va.femoralVenousDrainage, 'cardiac-ct-rig.ecmo.va.drainage')
validateRoute(ctRig.ecmo.va.femoralArterialReturn, 'cardiac-ct-rig.ecmo.va.return')
validateRoute(ctRig.ecmo.va.retrogradeAorticFlow, 'cardiac-ct-rig.ecmo.va.flow')

const pacProgress = ctRig.pac.progress
if (
  !(
    pacProgress.introducer < pacProgress.ra &&
    pacProgress.ra < pacProgress.rv &&
    pacProgress.rv < pacProgress.pa &&
    pacProgress.pa === pacProgress.wedge &&
    pacProgress.wedge < pacProgress.distalBranch
  )
) {
  errors.push(`cardiac-ct-rig.pac: milestones are not anatomically monotonic`)
}
const impellaProgress = ctRig.impella.progress
if (
  !(
    impellaProgress.aorticValve < impellaProgress.tooShallow &&
    impellaProgress.tooShallow < impellaProgress.correct &&
    impellaProgress.correct < impellaProgress.deep
  )
) {
  errors.push(`cardiac-ct-rig.impella: placement states are not anatomically monotonic`)
}
const impellaCorrectDepthMm =
  ((impellaProgress.correct - impellaProgress.aorticValve) * ctRig.impella.lengthWebUnits) /
  ctRig.provenance.webUnitsPerMm
if (Math.abs(impellaCorrectDepthMm - 35) > 3) {
  errors.push(
    `cardiac-ct-rig.impella: correct inlet is ${impellaCorrectDepthMm.toFixed(1)} mm below the annulus, expected 35±3 mm`,
  )
}
if (
  ctRig.impella.deviceRegistration?.localForwardAxis !== '+Y' ||
  JSON.stringify(ctRig.impella.deviceRegistration?.inletLocal) !== JSON.stringify([0, 0, 0]) ||
  JSON.stringify(ctRig.impella.deviceRegistration?.outletLocal) !== JSON.stringify([0, -1.128, 0])
) {
  errors.push(`cardiac-ct-rig.impella: missing validated CP inlet/outlet registration`)
}

const impella55Progress = ctRig.impella55.progress
if (
  !(
    impella55Progress.access < impella55Progress.aorticRoot &&
    impella55Progress.aorticRoot < impella55Progress.aorticValve &&
    impella55Progress.aorticValve < impella55Progress.tooShallow &&
    impella55Progress.tooShallow < impella55Progress.shallow &&
    impella55Progress.shallow < impella55Progress.correct &&
    impella55Progress.correct < impella55Progress.deep
  )
) {
  errors.push(`cardiac-ct-rig.impella55: placement states are not anatomically monotonic`)
}
const impella55CorrectDepthMm =
  ((impella55Progress.correct - impella55Progress.aorticValve) * ctRig.impella55.lengthWebUnits) /
  ctRig.provenance.webUnitsPerMm
if (Math.abs(impella55CorrectDepthMm - 50) > 4) {
  errors.push(
    `cardiac-ct-rig.impella55: correct inlet is ${impella55CorrectDepthMm.toFixed(1)} mm below the annulus, expected 50±4 mm`,
  )
}
if (
  ctRig.impella55.deviceRegistration?.localForwardAxis !== '+Y' ||
  JSON.stringify(ctRig.impella55.deviceRegistration?.inletLocal) !== JSON.stringify([0, 0, 0]) ||
  JSON.stringify(ctRig.impella55.deviceRegistration?.outletLocal) !== JSON.stringify([0, -1.56, 0])
) {
  errors.push(`cardiac-ct-rig.impella55: missing validated 5.5 inlet/outlet registration`)
}

const impellaRpProgress = ctRig.impellaRp.progress
if (
  !(
    impellaRpProgress.access < impellaRpProgress.ivcInlet &&
    impellaRpProgress.ivcInlet < impellaRpProgress.tricuspidGate &&
    impellaRpProgress.tricuspidGate < impellaRpProgress.rv &&
    impellaRpProgress.rv < impellaRpProgress.pulmonicGate &&
    impellaRpProgress.pulmonicGate < impellaRpProgress.tooProximal &&
    impellaRpProgress.tooProximal < impellaRpProgress.paOutlet &&
    impellaRpProgress.paOutlet === impellaRpProgress.correct &&
    impellaRpProgress.correct < impellaRpProgress.tooDistal
  )
) {
  errors.push(`cardiac-ct-rig.impellaRp: placement states are not anatomically monotonic`)
}
if (
  ctRig.impellaRp.deviceRegistration?.localForwardAxis !== '+Y' ||
  JSON.stringify(ctRig.impellaRp.deviceRegistration?.inletLocal) !==
    JSON.stringify([0, -4.92, 0]) ||
  JSON.stringify(ctRig.impellaRp.deviceRegistration?.outletLocal) !== JSON.stringify([0, 0, 0])
) {
  errors.push(`cardiac-ct-rig.impellaRp: missing validated RP inlet/outlet registration`)
}
const impellaRpInletToOutletMm = runtimeCurveLengthMm(
  ctRig.impellaRp,
  impellaRpProgress.ivcInlet,
  impellaRpProgress.correct,
  ctRig.provenance.webUnitsPerMm,
)
const impellaRpTooProximalMm = runtimeCurveLengthMm(
  ctRig.impellaRp,
  impellaRpProgress.ivcInlet,
  impellaRpProgress.tooProximal,
  ctRig.provenance.webUnitsPerMm,
)
if (Math.abs(impellaRpInletToOutletMm - 205) > 0.1) {
  errors.push(
    `cardiac-ct-rig.impellaRp: rendered inlet-to-outlet arc is ${impellaRpInletToOutletMm.toFixed(3)} mm, expected 205±0.1 mm`,
  )
}
if (Math.abs(impellaRpTooProximalMm - 190) > 0.1) {
  errors.push(
    `cardiac-ct-rig.impellaRp: rendered too-proximal span is ${impellaRpTooProximalMm.toFixed(3)} mm, expected 190±0.1 mm`,
  )
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else {
  console.log(
    `Validated ${Object.keys(runtimeManifest.assets).length} cardiac-device assets, the CT heart, and nine CT-aligned, provenance-tagged routes.`,
  )
}
