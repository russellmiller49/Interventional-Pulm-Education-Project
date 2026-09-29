/**
 * Package the thorax anatomy: compress the drawn surfaces, name every file by its content, and
 * write the manifest.
 *
 *   npx tsx scripts/medical-thoracoscopy/package-anatomy.ts [--install-dev]
 *
 * Reads what `build_thorax_surfaces.py` and `build_lung_states.py` wrote to the owner's local data,
 * after `validate_thorax_surfaces.py` and `validate_lung_states.py` have passed: each file must
 * still be the one its committed record describes. Writes, to the owner's local data:
 *
 *   raw-assets/medical-thoracoscopy/anatomy/packaged/<name>.<hash>.glb
 *   raw-assets/medical-thoracoscopy/anatomy/packaged/manifest.json
 *
 * and, to the repository, names and numbers only:
 *
 *   src/features/medical-thoracoscopy/content/data/generated/anatomy.ts   the manifest, for page code
 *   docs/medical-thoracoscopy/registers/asset-ledger.json                 the anatomy's rows
 *
 * `--install-dev` copies the packaged files and the manifest into
 * `public/models/medical-thoracoscopy/v1/anatomy/`, which Git ignores, so the dev server can serve
 * them at the manifest's URLs.
 *
 * The pleural space, the ribs and the context are Draco-compressed. The lung states are not: Draco
 * compresses only the base of a mesh with morph targets, so the file is kept as built, its positions
 * already quantised to 16 bits. The proxies are not compressed either, because the engine reads them
 * with its own reader (plan, section 4.5).
 *
 * Nothing is uploaded and no anatomy file is committed: the segmentation's terms are not settled
 * (rights register, R-ANATOMY-SEGMENTATION). A `.ts` script, run by tsx as CommonJS, like
 * `package-device-kit.ts`.
 */
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import prettier from 'prettier'

type ProcessGlb = (glb: Buffer, options: Record<string, unknown>) => Promise<{ glb: Buffer }>

const requireCommonJs = createRequire(__filename)
const { processGlb } = requireCommonJs('gltf-pipeline') as { processGlb: ProcessGlb }

const ROOT = path.resolve(__dirname, '../..')
const LOCAL_DATA =
  process.env.IP_LOCAL_DATA?.trim() ||
  '/Users/russellmiller/Projects/Interventional-Pulm-Local-Data'
const ANATOMY = path.join(LOCAL_DATA, 'raw-assets/medical-thoracoscopy/anatomy')
const RAW = path.join(ANATOMY, 'raw')
const PACKAGED = path.join(ANATOMY, 'packaged')
const DEV_INSTALL = path.join(ROOT, 'public/models/medical-thoracoscopy/v1/anatomy')
const URL_BASE = '/models/medical-thoracoscopy/v1/anatomy/'
const RECORDS = path.join(ROOT, 'src/features/medical-thoracoscopy/content/data/anatomy')
const GENERATED = path.join(
  ROOT,
  'src/features/medical-thoracoscopy/content/data/generated/anatomy.ts',
)
const LEDGER = path.join(ROOT, 'docs/medical-thoracoscopy/registers/asset-ledger.json')
const DRACO = { compressionLevel: 10, quantizePositionBits: 16, quantizeNormalBits: 12 }
const ANATOMY_BUDGET_BYTES = 3 * 1024 * 1024
const RIGHTS = ['R-ANATOMY-CT', 'R-ANATOMY-SEGMENTATION']

/** The files, in the order the manifest lists them. */
const FILES = [
  {
    id: 'pleural-space',
    kind: 'anatomy',
    record: 'surfaces.json',
    compress: true,
    claims: ['MT-C-0009', 'MT-C-0017', 'MT-C-0023'],
    builtBy: 'scripts/medical-thoracoscopy/build_thorax_surfaces.py',
  },
  {
    id: 'ribs',
    kind: 'anatomy',
    record: 'surfaces.json',
    compress: true,
    claims: ['MT-C-0017'],
    builtBy: 'scripts/medical-thoracoscopy/build_thorax_surfaces.py',
  },
  {
    id: 'context',
    kind: 'anatomy',
    record: 'surfaces.json',
    compress: true,
    claims: ['MT-C-0017'],
    builtBy: 'scripts/medical-thoracoscopy/build_thorax_surfaces.py',
  },
  {
    id: 'lung-states',
    kind: 'anatomy',
    record: 'lung-states.json',
    compress: false,
    claims: ['MT-C-0001', 'MT-C-0002'],
    builtBy: 'scripts/medical-thoracoscopy/build_lung_states.py',
  },
  {
    id: 'proxy-pleural-space',
    kind: 'proxy',
    record: 'lung-states.json',
    compress: false,
    claims: ['MT-C-0009', 'MT-C-0023'],
    builtBy: 'scripts/medical-thoracoscopy/build_lung_states.py',
  },
  {
    id: 'proxy-lung',
    kind: 'proxy',
    record: 'lung-states.json',
    compress: false,
    claims: ['MT-C-0001', 'MT-C-0002'],
    builtBy: 'scripts/medical-thoracoscopy/build_lung_states.py',
  },
] as const

const RECORD_FILES = [
  'source-audit.json',
  'surfaces.json',
  'ribs.json',
  'port-record.json',
  'lung-states.json',
  'proxies.json',
  'zone-samples.json',
  'fluid-table.json',
] as const

type GltfNode = {
  name?: string
  mesh?: number
  children?: number[]
  extras?: Record<string, unknown>
}
type GltfPrimitive = {
  attributes: Record<string, number>
  indices?: number
  mode?: number
  targets?: Record<string, number>[]
}
type Gltf = {
  scene?: number
  scenes: { nodes: number[] }[]
  nodes: GltfNode[]
  meshes: { name: string; primitives: GltfPrimitive[]; extras?: Record<string, unknown> }[]
  accessors: { count: number }[]
}

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function readGltfJson(glb: Buffer): Gltf {
  const length = glb.readUInt32LE(12)
  return JSON.parse(glb.subarray(20, 20 + length).toString('utf8')) as Gltf
}

/**
 * Triangles, and what the geometry costs once decoded to 32-bit floats: positions and normals,
 * each morph target's positions, and the indices. Primitives that share an accessor count it once.
 */
function geometryCost(gltf: Gltf): { triangles: number; decodedBytes: number } {
  let triangles = 0
  let decodedBytes = 0
  const counted = new Set<number>()
  const once = (accessor: number | undefined, bytesPerItem: number) => {
    if (accessor === undefined || counted.has(accessor)) return
    counted.add(accessor)
    decodedBytes += gltf.accessors[accessor].count * bytesPerItem
  }
  for (const mesh of gltf.meshes) {
    for (const primitive of mesh.primitives) {
      const vertices = gltf.accessors[primitive.attributes.POSITION].count
      once(primitive.attributes.POSITION, 12)
      once(primitive.attributes.NORMAL, 12)
      for (const target of primitive.targets ?? []) once(target.POSITION, 12)
      if (primitive.indices !== undefined) {
        triangles += gltf.accessors[primitive.indices].count / 3
        once(primitive.indices, vertices < 65536 ? 2 : 4)
      }
    }
  }
  return { triangles, decodedBytes }
}

function describe(gltf: Gltf) {
  const root = gltf.nodes[gltf.scenes[gltf.scene ?? 0].nodes[0]]
  const nodes = (root.children ?? []).map((index) => gltf.nodes[index].name as string)
  const targets = new Set<string>()
  for (const mesh of gltf.meshes) {
    for (const name of (mesh.extras?.targetNames as string[] | undefined) ?? []) targets.add(name)
  }
  return { root, nodes, morphTargets: [...targets] }
}

async function main(): Promise<void> {
  const installDev = process.argv.includes('--install-dev')
  const options = await prettier.resolveConfig(path.join(ROOT, 'package.json'))
  const format = (text: string, parser: 'json' | 'typescript') =>
    prettier.format(text, { ...options, parser })

  const records = Object.fromEntries(
    RECORD_FILES.map((name) => [name, JSON.parse(readFileSync(path.join(RECORDS, name), 'utf8'))]),
  ) as Record<string, { files?: Record<string, { sha256: string }> }>

  mkdirSync(PACKAGED, { recursive: true })
  const keep = new Set<string>(['manifest.json'])
  const files = []
  let label = ''
  let attribution: unknown = null
  let presentationFromLps: unknown = null
  let gravityLps: unknown = null

  for (const entry of FILES) {
    const rawPath = path.join(RAW, `${entry.id}.glb`)
    if (!existsSync(rawPath)) throw new Error(`Missing ${rawPath}: build it first`)
    const raw = readFileSync(rawPath)
    const recorded = records[entry.record].files?.[entry.id]?.sha256
    if (recorded !== sha256(raw)) {
      throw new Error(
        `${entry.id} is not the file ${entry.record} describes: build and validate again`,
      )
    }
    const gltf = readGltfJson(raw)
    const { root, nodes, morphTargets } = describe(gltf)
    label = root.extras?.label as string
    attribution = root.extras?.attribution
    presentationFromLps = root.extras?.presentationFromLps
    gravityLps = root.extras?.gravityLps
    const glb = entry.compress
      ? (await processGlb(raw, { dracoOptions: DRACO, keepUnusedElements: true })).glb
      : raw
    const hash = sha256(glb)
    const file = `${entry.id}.${hash.slice(0, 12)}.glb`
    writeFileSync(path.join(PACKAGED, file), glb)
    keep.add(file)
    files.push({
      id: entry.id,
      kind: entry.kind,
      url: `${URL_BASE}${file}`,
      file,
      bytes: glb.length,
      sha256: hash,
      rawSha256: sha256(raw),
      compression: entry.compress ? 'Draco' : 'none',
      ...geometryCost(gltf),
      nodes,
      morphTargets,
      label: root.extras?.label as string,
      statesLabel: (root.extras?.statesLabel as string | undefined) ?? null,
      claims: [...entry.claims],
      builtBy: entry.builtBy,
    })
    console.log(`${file}: ${raw.length} -> ${glb.length} bytes`)
  }

  for (const name of readdirSync(PACKAGED)) {
    if (!keep.has(name)) {
      rmSync(path.join(PACKAGED, name))
      console.log(`removed ${name}, from an earlier build`)
    }
  }

  const anatomyBytes = files.reduce((sum, file) => sum + file.bytes, 0)
  if (anatomyBytes > ANATOMY_BUDGET_BYTES) {
    throw new Error(
      `The anatomy is ${anatomyBytes} bytes, over its budget of ${ANATOMY_BUDGET_BYTES}`,
    )
  }
  const manifest = {
    manifest: 'medical-thoracoscopy-anatomy',
    version: 1,
    label,
    attribution,
    frame: 'LPS millimetres',
    presentationFromLps,
    gravityLps,
    statement:
      'Surfaces built from one CT scan’s segmentation, and lung states authored from them. Held in the owner’s local data and in the dev server’s ignored folder; not in the repository and not to be uploaded while the rights register blocks it (R-ANATOMY-SEGMENTATION).',
    records: Object.fromEntries(
      RECORD_FILES.map((name) => [name, sha256(readFileSync(path.join(RECORDS, name)))]),
    ),
    compression: {
      method: 'Draco',
      ...DRACO,
      appliedTo: FILES.filter((f) => f.compress).map((f) => f.id),
    },
    budget: { anatomyBytes, limitBytes: ANATOMY_BUDGET_BYTES },
    files,
  }
  const manifestText = await format(JSON.stringify(manifest), 'json')
  writeFileSync(path.join(PACKAGED, 'manifest.json'), manifestText)

  if (installDev) {
    mkdirSync(DEV_INSTALL, { recursive: true })
    for (const name of readdirSync(DEV_INSTALL)) {
      if (!keep.has(name)) rmSync(path.join(DEV_INSTALL, name))
    }
    for (const name of keep) copyFileSync(path.join(PACKAGED, name), path.join(DEV_INSTALL, name))
    console.log(`installed for the dev server in ${DEV_INSTALL} (ignored by Git)`)
  }

  mkdirSync(path.dirname(GENERATED), { recursive: true })
  const generated = [
    '// Generated by scripts/medical-thoracoscopy/package-anatomy.ts. Do not edit.',
    '// Names and numbers only: the anatomy files themselves are held in the owner’s local data and',
    '// served in development from public/models/medical-thoracoscopy/v1/anatomy/, which Git ignores.',
    '',
    `export const anatomyManifest = ${JSON.stringify(manifest)} as const`,
    '',
    'export type AnatomyManifest = typeof anatomyManifest',
    "export type AnatomyFile = AnatomyManifest['files'][number]",
    '',
  ].join('\n')
  writeFileSync(GENERATED, await format(generated, 'typescript'))

  const ledger = JSON.parse(readFileSync(LEDGER, 'utf8')) as {
    assets: Record<string, unknown>[]
    [key: string]: unknown
  }
  const others = ledger.assets.filter(
    (asset) => !String(asset.path).startsWith('public/models/medical-thoracoscopy/v1/anatomy/'),
  )
  const rows = [
    ...files.map((file) => ({
      id: file.id,
      kind: file.kind,
      path: `public/models/medical-thoracoscopy/v1/anatomy/${file.file}`,
      sha256: file.sha256,
      bytes: file.bytes,
      triangles: file.triangles,
      decodedBytes: file.decodedBytes,
      label: file.statesLabel
        ? `${file.label}; states ${file.statesLabel.toLowerCase()}`
        : file.label,
      rights: RIGHTS,
      claims: file.claims,
      definitionSha256: null,
      builtBy: file.builtBy,
      inRepository: false,
      uploaded: false,
    })),
    {
      id: 'anatomy-manifest',
      kind: 'manifest',
      path: 'public/models/medical-thoracoscopy/v1/anatomy/manifest.json',
      sha256: sha256(manifestText),
      bytes: Buffer.byteLength(manifestText),
      triangles: null,
      decodedBytes: null,
      label,
      rights: RIGHTS,
      claims: [],
      definitionSha256: null,
      builtBy: 'scripts/medical-thoracoscopy/package-anatomy.ts',
      inRepository: false,
      uploaded: false,
    },
  ]
  ledger.assets = [...others, ...rows]
  writeFileSync(LEDGER, await format(JSON.stringify(ledger), 'json'))
  console.log(`manifest: ${files.length} files, ${anatomyBytes} bytes of ${ANATOMY_BUDGET_BYTES}`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
