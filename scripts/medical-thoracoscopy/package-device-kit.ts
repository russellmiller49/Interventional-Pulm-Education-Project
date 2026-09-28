/**
 * Package the device kit: compress each model, name it by its content, and write the manifest.
 *
 *   npx tsx scripts/medical-thoracoscopy/package-device-kit.ts
 *
 * Reads the uncompressed models that `build_device_kit.py` wrote to the owner's local data, after
 * `validate_device_kit.py` has passed. Writes:
 *
 *   public/models/medical-thoracoscopy/v1/devices/<model>.<hash>.glb   Draco-compressed
 *   public/models/medical-thoracoscopy/v1/devices/manifest.json
 *   src/features/medical-thoracoscopy/content/data/generated/deviceKit.ts   the same manifest,
 *       for page code: the production image does not carry public/models
 *   docs/medical-thoracoscopy/registers/asset-ledger.json               the kit's rows
 *
 * A model file is served as immutable for a year, so its name carries its content hash and only the
 * manifest is ever replaced. Files of an earlier build are removed. Nothing is uploaded: the rights
 * register blocks upload of the device models until the owner decides (R-DEVICE-MODELS).
 *
 * A `.ts` script on purpose: tsx runs it as CommonJS, which lets it load the module's TypeScript.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import prettier from 'prettier'

import { deviceDefinitions } from '../../src/features/medical-thoracoscopy/content/deviceDefinitions'
import { deviceGeometryDigest } from '../../src/features/medical-thoracoscopy/content/deviceKitDigest'

type ProcessGlb = (glb: Buffer, options: Record<string, unknown>) => Promise<{ glb: Buffer }>

const requireCommonJs = createRequire(__filename)
const { processGlb } = requireCommonJs('gltf-pipeline') as { processGlb: ProcessGlb }

const ROOT = path.resolve(__dirname, '../..')
const LOCAL_DATA =
  process.env.IP_LOCAL_DATA?.trim() ||
  '/Users/russellmiller/Projects/Interventional-Pulm-Local-Data'
const RAW = path.join(LOCAL_DATA, 'raw-assets/medical-thoracoscopy/devices/raw')
const OUT = path.join(ROOT, 'public/models/medical-thoracoscopy/v1/devices')
const URL_BASE = '/models/medical-thoracoscopy/v1/devices/'
const GENERATED = path.join(
  ROOT,
  'src/features/medical-thoracoscopy/content/data/generated/deviceKit.ts',
)
const LEDGER = path.join(ROOT, 'docs/medical-thoracoscopy/registers/asset-ledger.json')
const DEFINITIONS = path.join(
  ROOT,
  'src/features/medical-thoracoscopy/content/data/device-definitions.json',
)
const MEASUREMENTS = path.join(
  ROOT,
  'src/features/medical-thoracoscopy/content/data/reference-measurements.json',
)
const GENERATOR = path.join(ROOT, 'scripts/medical-thoracoscopy/build_device_kit.py')

/** The models, in the order the manifest lists them: the three prototype parts first. */
const MODELS = [
  'operative-telescope',
  'trocar-sleeve-flexible',
  'double-spoon-forceps',
  'operative-telescope-cutaway',
  'trocar-for-flexible-sleeve',
  'trocar-sleeve-with-valves',
  'trocar-for-sleeve-with-valves',
  'dissection-forceps',
  'hook-electrode',
  'button-electrode',
  'probe',
  'suction-tube',
] as const

const DRACO = { compressionLevel: 10, quantizePositionBits: 16, quantizeNormalBits: 12 }

type GltfNode = {
  name?: string
  mesh?: number
  extras?: Record<string, unknown>
  children?: number[]
}
type Gltf = {
  nodes: GltfNode[]
  meshes: { name: string; primitives: { attributes: Record<string, number>; indices?: number }[] }[]
  accessors: { count: number }[]
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function readGltfJson(glb: Buffer): Gltf {
  const length = glb.readUInt32LE(12)
  return JSON.parse(glb.subarray(20, 20 + length).toString('utf8')) as Gltf
}

/** Triangles, and the bytes the geometry takes once decoded: positions, normals and indices. */
function geometryCost(gltf: Gltf): { triangles: number; decodedBytes: number } {
  let triangles = 0
  let decodedBytes = 0
  for (const mesh of gltf.meshes) {
    for (const primitive of mesh.primitives) {
      const vertices = gltf.accessors[primitive.attributes.POSITION].count
      const indices =
        primitive.indices === undefined ? vertices : gltf.accessors[primitive.indices].count
      triangles += indices / 3
      decodedBytes += vertices * 24 + indices * (vertices < 65536 ? 2 : 4)
    }
  }
  return { triangles, decodedBytes }
}

function anchorsOf(gltf: Gltf) {
  const anchors: Record<string, { position: number[]; direction: number[]; description: string }> =
    {}
  for (const node of gltf.nodes) {
    if (!node.name?.startsWith('anchor:') || !node.extras) continue
    anchors[node.name.slice('anchor:'.length)] = {
      position: node.extras.position as number[],
      direction: node.extras.direction as number[],
      description: node.extras.description as string,
    }
  }
  return anchors
}

function movableOf(gltf: Gltf) {
  return gltf.nodes
    .filter((node) => node.mesh !== undefined && node.extras && 'pivot' in node.extras)
    .map((node) => ({
      node: node.name as string,
      pivot: node.extras?.pivot as string,
      ...(typeof node.extras?.openDeg === 'number' ? { openDeg: node.extras.openDeg } : {}),
      ...(typeof node.extras?.travelDeg === 'number' ? { travelDeg: node.extras.travelDeg } : {}),
    }))
}

async function main(): Promise<void> {
  const options = await prettier.resolveConfig(path.join(ROOT, 'package.json'))
  const format = (text: string, parser: 'json' | 'typescript') =>
    prettier.format(text, { ...options, parser })

  mkdirSync(OUT, { recursive: true })
  const definitionsSha256 = sha256(readFileSync(DEFINITIONS))
  const models = []
  const keep = new Set<string>(['manifest.json'])

  for (const id of MODELS) {
    const rawPath = path.join(RAW, `${id}.glb`)
    if (!existsSync(rawPath)) throw new Error(`Missing ${rawPath}: run build_device_kit.py first`)
    const raw = readFileSync(rawPath)
    const gltf = readGltfJson(raw)
    const top = gltf.nodes.find((node) => node.name === `device:${id}`)
    if (!top?.extras) throw new Error(`${id}: no root node`)
    if (top.extras.definitionsSha256 !== definitionsSha256) {
      throw new Error(`${id} was built from other definitions: build it again`)
    }
    const { glb } = await processGlb(raw, { dracoOptions: DRACO, keepUnusedElements: true })
    const hash = sha256(glb)
    const file = `${id}.${hash.slice(0, 12)}.glb`
    writeFileSync(path.join(OUT, file), glb)
    keep.add(file)
    const definitionId = top.extras.definitionId as string
    const device = deviceDefinitions.devices.find((entry) => entry.id === definitionId)
    if (!device) throw new Error(`${id}: unknown definition ${definitionId}`)
    const extras = Object.fromEntries(
      Object.entries(top.extras).filter(([key]) =>
        ['fieldOfViewDeg', 'fieldOfViewCategory', 'directionOfViewDeg', 'jawOpeningDeg'].includes(
          key,
        ),
      ),
    )
    models.push({
      id,
      definitionId,
      name: top.extras.name as string,
      standard: device.standard,
      inPrototype: device.inPrototype && id === definitionId,
      url: `${URL_BASE}${file}`,
      file,
      bytes: glb.length,
      sha256: hash,
      rawSha256: sha256(raw),
      ...geometryCost(gltf),
      anchors: anchorsOf(gltf),
      movable: movableOf(gltf),
      extras,
    })
    console.log(`${file}: ${raw.length} -> ${glb.length} bytes`)
  }

  for (const entry of readdirSync(OUT)) {
    if (!keep.has(entry)) {
      rmSync(path.join(OUT, entry))
      console.log(`removed ${entry}, from an earlier build`)
    }
  }

  const manifest = {
    manifest: 'medical-thoracoscopy-device-kit',
    version: 1,
    label: deviceDefinitions.labelUntilCad,
    units: 'mm',
    frame:
      'Origin at the centre of the distal face (for a tool, of the distal end of its sheath, shaft or insulation); -Z distal along the shaft; +Y from the channel toward the optic; +X image right. The files hold this frame as it is: a scene that treats glTF as Y-up metres scales by 0.001 and needs no rotation.',
    statement:
      'Models built from the device definitions: published dimensions, values measured from the manufacturer’s reference frames, and values chosen by the author, each labelled there. None is manufacturer CAD and none has been fact-checked by the manufacturer. Not to be uploaded while the rights register blocks it (R-DEVICE-MODELS).',
    definitionsSha256,
    geometryDigest: deviceGeometryDigest(deviceDefinitions),
    measurementsSha256: sha256(readFileSync(MEASUREMENTS)),
    generator: 'scripts/medical-thoracoscopy/build_device_kit.py',
    generatorSha256: sha256(readFileSync(GENERATOR)),
    compression: { method: 'Draco', ...DRACO },
    models,
  }
  const manifestText = await format(JSON.stringify(manifest), 'json')
  writeFileSync(path.join(OUT, 'manifest.json'), manifestText)

  mkdirSync(path.dirname(GENERATED), { recursive: true })
  const generated = [
    '// Generated by scripts/medical-thoracoscopy/package-device-kit.ts. Do not edit.',
    '// A copy of public/models/medical-thoracoscopy/v1/devices/manifest.json for page code: the',
    '// production image does not carry public/models, so pages must not import from there.',
    '',
    `export const deviceKitManifest = ${JSON.stringify(manifest)} as const`,
    '',
    'export type DeviceKitManifest = typeof deviceKitManifest',
    "export type DeviceKitModel = DeviceKitManifest['models'][number]",
    '',
  ].join('\n')
  writeFileSync(GENERATED, await format(generated, 'typescript'))

  const ledger = JSON.parse(readFileSync(LEDGER, 'utf8')) as {
    assets: Record<string, unknown>[]
    [key: string]: unknown
  }
  const others = ledger.assets.filter(
    (asset) => !String(asset.path).startsWith('public/models/medical-thoracoscopy/v1/devices/'),
  )
  const rows = [
    ...models.map((model) => ({
      id: model.id,
      kind: 'device',
      path: `public/models/medical-thoracoscopy/v1/devices/${model.file}`,
      sha256: model.sha256,
      bytes: model.bytes,
      triangles: model.triangles,
      decodedBytes: model.decodedBytes,
      label: manifest.label,
      rights: ['R-DEVICE-MODELS'],
      claims: [],
      definitionSha256: definitionsSha256,
      builtBy: 'scripts/medical-thoracoscopy/build_device_kit.py',
      uploaded: false,
    })),
    {
      id: 'device-kit-manifest',
      kind: 'manifest',
      path: 'public/models/medical-thoracoscopy/v1/devices/manifest.json',
      sha256: sha256(Buffer.from(manifestText)),
      bytes: Buffer.byteLength(manifestText),
      triangles: null,
      decodedBytes: null,
      label: manifest.label,
      rights: ['R-DEVICE-MODELS'],
      claims: [],
      definitionSha256: definitionsSha256,
      builtBy: 'scripts/medical-thoracoscopy/package-device-kit.ts',
      uploaded: false,
    },
  ]
  ledger.assets = [...others, ...rows]
  writeFileSync(LEDGER, await format(JSON.stringify(ledger), 'json'))
  console.log(
    `manifest: ${models.length} models, ${models.reduce((sum, model) => sum + model.bytes, 0)} bytes`,
  )
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
