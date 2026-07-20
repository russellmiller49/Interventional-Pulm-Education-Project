import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const assetDirectory = path.join(root, 'public', 'models', 'cardiac-devices')
const runtimeManifest = JSON.parse(
  await readFile(path.join(assetDirectory, 'asset-manifest.json'), 'utf8'),
)
const rig = JSON.parse(
  await readFile(
    path.join(root, 'src', 'features', 'cardiac-anatomy', 'content', 'cardiac-rig.json'),
    'utf8',
  ),
)

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
  'impella-cp.glb': ['Impella_CP', 'Anchor_Impella_CP_Distal', 'Anchor_Impella_CP_Proximal'],
  'impella-55.glb': ['Impella_55', 'Anchor_Impella_55_Distal', 'Anchor_Impella_55_Proximal'],
  'impella-rp.glb': ['Impella_RP', 'Anchor_Impella_RP_Distal', 'Anchor_Impella_RP_Proximal'],
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

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Validated ${Object.keys(runtimeManifest.assets).length} cardiac runtime assets.`)
}
