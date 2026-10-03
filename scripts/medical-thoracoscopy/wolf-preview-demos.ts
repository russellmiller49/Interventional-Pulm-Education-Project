/**
 * The two 2026-10-01 presentation demonstrations for the private manufacturer preview's hub:
 * stage them, verify them, record them, and (only when asked) upload them to their own private
 * bucket.
 *
 *   npx tsx scripts/medical-thoracoscopy/wolf-preview-demos.ts --stage   copy the allow-listed
 *       files of the two presentation folders into the staged set (one content-named object per
 *       distinct file), cut the hub's card images and the gallery previews (ffmpeg), then verify
 *   npx tsx scripts/medical-thoracoscopy/wolf-preview-demos.ts           verify the staged set
 *   npx tsx scripts/medical-thoracoscopy/wolf-preview-demos.ts --write-manifest   also write the
 *       server-only manifest src/features/medical-thoracoscopy/wolf-preview/server/demoManifest.ts
 *   npx tsx <path>/wolf-preview-demos.ts --upload   from the PRIMARY checkout (it reads that
 *       checkout's .env.local for the service key): create the private bucket if needed, upload,
 *       read every object back, and check the bucket holds exactly the manifest and is not public
 *   npx tsx <path>/wolf-preview-demos.ts --remove   from the PRIMARY checkout: rollback, empty and
 *       delete the private bucket
 *
 * What is distributed is named file by file below. Every other file in the two folders must be on
 * the withheld list (READMEs, build scripts, the local server launcher, the diagram sources and the
 * internal platform-comparison graphic), so a new render cannot slip in or be dropped unnoticed.
 * The device models in the viewers are the showcase builds, whose metadata holds the build's
 * internal record (product numbers, generator hashes, distribution notes, the register entry);
 * they are staged with that record reduced to the descriptive fields, which the viewers never read.
 *
 * The checks: models are glTF binaries with no image, texture or external reference, and none
 * carries a manufacturer mark, product number or internal note; the viewer pages fetch nothing
 * from the network and every file they ask for is in the same demonstration; the three.js files
 * are byte-identical to the repository's own three package; stills carry no EXIF, XMP or text
 * chunks; videos are MP4 with the index first.
 */
import { execFileSync, execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import prettier from 'prettier'

const ROOT = path.resolve(__dirname, '../..')
const LOCAL_DATA =
  process.env.IP_LOCAL_DATA?.trim() ||
  '/Users/russellmiller/Projects/Interventional-Pulm-Local-Data'
const PRESENTATION = path.join(LOCAL_DATA, 'medical_thoracoscopy/presentation')
const STAGED = path.join(LOCAL_DATA, 'raw-assets/medical-thoracoscopy/wolf-preview-demos/v1')
const OBJECTS = path.join(STAGED, 'objects')
const MANIFEST_OUT = path.join(
  ROOT,
  'src/features/medical-thoracoscopy/wolf-preview/server/demoManifest.ts',
)
export const BUCKET = 'mt-wolf-preview-demos'
export const PREFIX = 'v1'
const MIME_TYPES: Record<string, string> = {
  html: 'text/html',
  js: 'text/javascript',
  json: 'application/json',
  glb: 'model/gltf-binary',
  mp4: 'video/mp4',
  jpg: 'image/jpeg',
  png: 'image/png',
}
const MARKS = /wolf|eragon|endocam|endolight|panoview|richard/i
const PRODUCT_NUMBER = /\b89\d{2}\.\d{3}\b|\b83\d{5,6}\b/
const INTERNAL =
  /R-DEVICE|Local-Data|\/Users\/|not for learners|not uploaded|openQuestions|productNumbers|"register"|sell sheet|Sha256/i
// The register's status word, in capitals; "not reviewed by the manufacturer" is a disclosure.
const STATUS = /NOT REVIEWED/

/** What a device model's root keeps of its build record: the descriptive fields only. */
const DEVICE_FIELDS = new Set([
  'deviceId',
  'name',
  'label',
  'units',
  'frame',
  'tier',
  'kitModel',
  'qualityClass',
  'fieldOfViewDeg',
  'fieldOfViewCategory',
  'directionOfViewDeg',
  'eyepieceLeavesBodyAtMm',
  'jawOpeningDeg',
])

const PLEURAL = '2026-10-01-pleural-model-progress'
const TRAINER = '2026-10-01-portable-trainer-concept'
const SHOWCASE = '2026-09-29-device-showcase'

const VENDOR = [
  'vendor/three.module.js',
  'vendor/three.core.js',
  'vendor/jsm/loaders/GLTFLoader.js',
  'vendor/jsm/environments/RoomEnvironment.js',
  'vendor/jsm/controls/OrbitControls.js',
  'vendor/jsm/utils/BufferGeometryUtils.js',
]

/** The viewers' three.js files and where the same release sits in the repository's three package. */
const THREE_PACKAGE: Record<string, string> = {
  'vendor/three.module.js': 'build/three.module.js',
  'vendor/three.core.js': 'build/three.core.js',
  'vendor/jsm/loaders/GLTFLoader.js': 'examples/jsm/loaders/GLTFLoader.js',
  'vendor/jsm/environments/RoomEnvironment.js': 'examples/jsm/environments/RoomEnvironment.js',
  'vendor/jsm/controls/OrbitControls.js': 'examples/jsm/controls/OrbitControls.js',
  'vendor/jsm/utils/BufferGeometryUtils.js': 'examples/jsm/utils/BufferGeometryUtils.js',
  'vendor/jsm/RoundedBoxGeometry.js': 'examples/jsm/geometries/RoundedBoxGeometry.js',
}

/** Device models whose build record is reduced before staging. */
const DEVICE_MODELS = new Set([
  'models/operative-telescope.glb',
  'models/trocar-sleeve-flexible.glb',
  'models/double-spoon-forceps.glb',
])

/** The effusion's statement says it was not uploaded; the staged copy says what is now true. */
const EFFUSION = {
  published: 'models/effusion.glb',
  was: 'Built for the local progress demo only; not uploaded.',
  now: 'Built for the progress demonstration; not part of the module.',
}

/** A viewer file keeps its path inside `viewer/`; media and stills get their own folders. */
function viewerFiles(names: string[]): [string, string][] {
  return names.map((name) => [name, `viewer/${name}`])
}

type Crop = { width: number; height: number; x: number; y: number }
type Derived = { from: string; crop?: Crop; width: number }

interface Group {
  /** Presentation folder the files come from (null for the hub's own images). */
  readonly folder: string | null
  /** Published path inside the group → path inside the folder. */
  readonly files: [string, string][]
  /** Published path → an image cut from a presentation file. */
  readonly derived: [string, Derived][]
  /** Files in the folder deliberately not distributed (a trailing slash withholds a directory). */
  readonly withheld: string[]
}

// Card images are cut at 19:10 to the drawing itself, without the stills' titles and footers.
const stillPreviews = (folder: string, stills: [string, string][]): [string, Derived][] =>
  stills.map(([published, source]) => [
    published.replace(/^stills\//, 'stills/preview/').replace(/\.(png|jpg)$/, '.jpg'),
    { from: `${folder}/${source}`, width: 1600 },
  ])

const PLEURAL_STILLS: [string, string][] = [
  '01-ribs.jpg',
  '02-pleural-cavity.jpg',
  '03-lung-in-cavity.jpg',
  '03b-pleural-effusion.jpg',
  '04-port.jpg',
  '05-scope-chest-relationship.jpg',
  '06-combined.jpg',
].map((name) => [`stills/${name}`, `stills/${name}`])

const TRAINER_STILLS: [string, string][] = [
  '01-hero.png',
  '02-exploded-system.png',
  '03-system-architecture.png',
  '04-sensorized-port.png',
  '05-port-cartridges.png',
  '06-future-tool-tracking.png',
].map((name) => [`stills/${name}`, name])

export const GROUPS: Record<string, Group> = {
  hub: {
    folder: null,
    files: [],
    derived: [
      [
        'cards/device-explorer.jpg',
        {
          from: `${SHOWCASE}/01-hero-thoracoscope.jpg`,
          crop: { width: 3200, height: 1684, x: 0, y: 294 },
          width: 1280,
        },
      ],
      [
        'cards/pleural-model-progress.jpg',
        {
          from: `${PLEURAL}/stills/06-combined.jpg`,
          crop: { width: 3116, height: 1640, x: 362, y: 100 },
          width: 1280,
        },
      ],
      [
        'cards/portable-trainer-concept.jpg',
        {
          from: `${TRAINER}/01-hero.png`,
          crop: { width: 3140, height: 1652, x: 120, y: 370 },
          width: 1280,
        },
      ],
    ],
    withheld: [],
  },
  'pleural-model-progress': {
    folder: PLEURAL,
    files: [
      ...viewerFiles([
        'index.html',
        'scene.json',
        'models/ribs.glb',
        'models/pleural-space.glb',
        'models/lung-states.glb',
        'models/effusion.glb',
        'models/operative-telescope.glb',
        'models/trocar-sleeve-flexible.glb',
        ...VENDOR,
      ]),
      ['media/pleural-model-progress-demo.mp4', 'pleural-model-progress-demo.mp4'],
      ...PLEURAL_STILLS,
    ],
    derived: stillPreviews(PLEURAL, PLEURAL_STILLS),
    withheld: ['README.md', 'build/', 'viewer/SERVE.command', 'viewer/vendor/LICENSE'],
  },
  'portable-trainer-concept': {
    folder: TRAINER,
    files: [
      ...viewerFiles([
        'index.html',
        'scene.json',
        'poses.json',
        'trainer-frame.json',
        'models/trainer.glb',
        'models/ribs.glb',
        'models/pleural-space.glb',
        'models/lung-states.glb',
        'models/operative-telescope.glb',
        'models/double-spoon-forceps.glb',
        ...VENDOR,
        'vendor/jsm/RoundedBoxGeometry.js',
      ]),
      ['media/portable-thoracoscopy-concept.mp4', 'portable-thoracoscopy-concept.mp4'],
      ...TRAINER_STILLS,
    ],
    derived: stillPreviews(TRAINER, TRAINER_STILLS),
    withheld: [
      'README.md',
      'build/',
      'viewer/SERVE.command',
      'viewer/vendor/LICENSE',
      // Sources of stills 03 and 07; the page never loads them.
      'viewer/diagrams/',
      // Labelled "Internal presentation graphic"; the owner kept it out of the preview.
      '07-scope-tracker-platform-comparison.png',
    ],
  },
}

const args = process.argv.slice(2)

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function extension(file: string): string {
  return path.extname(file).slice(1).toLowerCase()
}

function objectName(published: string, hash: string): string {
  const base = path.basename(published, path.extname(published))
  return `${base}.${hash.slice(0, 12)}.${extension(published)}`
}

function listFiles(dir: string, prefix = ''): string[] {
  return readdirSync(path.join(dir, prefix), { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.name === '.DS_Store') return []
    return entry.isDirectory() ? listFiles(dir, relative) : [relative]
  })
}

interface StagedEntry {
  object: string
  bytes: number
  sha256: string
  source: string
}
interface StagedManifest {
  record: 'mt-wolf-preview-demos-staged'
  stagedOn: string
  bucket: string
  prefix: string
  groups: Record<string, Record<string, StagedEntry>>
}

// ——— Stage ———

/** A GLB with a new JSON chunk; the binary chunk is unchanged. */
function withJson(bytes: Buffer, gltf: unknown): Buffer {
  const jsonLength = bytes.readUInt32LE(12)
  let json = Buffer.from(JSON.stringify(gltf), 'utf8')
  const padding = (4 - (json.length % 4)) % 4
  json = Buffer.concat([json, Buffer.alloc(padding, 0x20)])
  const rest = bytes.subarray(20 + jsonLength)
  const header = Buffer.alloc(20)
  header.write('glTF', 0, 'latin1')
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(20 + json.length + rest.length, 8)
  header.writeUInt32LE(json.length, 12)
  header.write('JSON', 16, 'latin1')
  return Buffer.concat([header, json, rest])
}

type GltfNodes = { nodes?: { extras?: Record<string, unknown> }[] }

/** A device model whose root keeps only DEVICE_FIELDS of its extras. */
function reduceDeviceRecord(bytes: Buffer): Buffer {
  const gltf = JSON.parse(glbJson(bytes)) as GltfNodes
  let roots = 0
  for (const node of gltf.nodes ?? []) {
    if (!node.extras || typeof node.extras.deviceId !== 'string') continue
    roots += 1
    node.extras = Object.fromEntries(
      Object.entries(node.extras).filter(([key]) => DEVICE_FIELDS.has(key)),
    )
  }
  if (roots !== 1) throw new Error(`expected one device root, found ${roots}`)
  return withJson(bytes, gltf)
}

/** The effusion with its statement brought up to date. */
function updateEffusionStatement(bytes: Buffer): Buffer {
  const gltf = JSON.parse(glbJson(bytes)) as GltfNodes
  const holders = (gltf.nodes ?? []).filter(
    (node) =>
      typeof node.extras?.statement === 'string' && node.extras.statement.endsWith(EFFUSION.was),
  )
  if (holders.length !== 1) throw new Error('the effusion statement has changed; review it first')
  const extras = holders[0].extras!
  extras.statement = (extras.statement as string).replace(EFFUSION.was, EFFUSION.now)
  return withJson(bytes, gltf)
}

function cut(source: string, target: string, derived: Derived) {
  const filters = [
    ...(derived.crop
      ? [`crop=${derived.crop.width}:${derived.crop.height}:${derived.crop.x}:${derived.crop.y}`]
      : []),
    `scale=${derived.width}:-2:flags=lanczos`,
  ]
  execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-y',
      '-i',
      source,
      '-vf',
      filters.join(','),
      '-q:v',
      '3',
      '-map_metadata',
      '-1',
      '-frames:v',
      '1',
      target,
    ],
    { stdio: 'inherit' },
  )
}

function stage() {
  const problems: string[] = []
  for (const [group, spec] of Object.entries(GROUPS)) {
    if (!spec.folder) continue
    const folder = path.join(PRESENTATION, spec.folder)
    const sources = new Set(spec.files.map(([, source]) => source))
    for (const file of listFiles(folder)) {
      const withheld = spec.withheld.some((entry) =>
        entry.endsWith('/') ? file.startsWith(entry) : file === entry,
      )
      if (!sources.has(file) && !withheld) {
        problems.push(`${group}: ${file} is neither distributed nor withheld; classify it first`)
      }
    }
    for (const source of sources) {
      if (!existsSync(path.join(folder, source))) problems.push(`${group}: missing ${source}`)
    }
  }
  if (problems.length > 0) {
    console.error(`STOP:\n  ${problems.join('\n  ')}`)
    process.exit(1)
  }

  mkdirSync(OBJECTS, { recursive: true })
  const scratch = path.join(STAGED, '.cut')
  mkdirSync(scratch, { recursive: true })
  const manifest: StagedManifest = {
    record: 'mt-wolf-preview-demos-staged',
    stagedOn: new Date().toISOString().slice(0, 10),
    bucket: BUCKET,
    prefix: PREFIX,
    groups: {},
  }
  const place = (file: string, published: string, source: string): StagedEntry => {
    const bytes = readFileSync(file)
    const hash = sha256(bytes)
    const object = objectName(published, hash)
    const target = path.join(OBJECTS, object)
    if (!existsSync(target)) copyFileSync(file, target)
    else if (sha256(readFileSync(target)) !== hash) throw new Error(`${object} differs on disk`)
    return { object, bytes: bytes.length, sha256: hash, source }
  }
  for (const [group, spec] of Object.entries(GROUPS)) {
    const entries: Record<string, StagedEntry> = {}
    for (const [published, source] of spec.files) {
      const file = path.join(PRESENTATION, spec.folder!, source)
      if (DEVICE_MODELS.has(published) || published === EFFUSION.published) {
        const device = DEVICE_MODELS.has(published)
        const target = path.join(scratch, `${group}-${path.basename(published)}`)
        const bytes = readFileSync(file)
        writeFileSync(target, device ? reduceDeviceRecord(bytes) : updateEffusionStatement(bytes))
        const how = device ? 'device record reduced' : 'statement updated'
        entries[published] = place(target, published, `${spec.folder}/${source} (${how})`)
        continue
      }
      entries[published] = place(file, published, `${spec.folder}/${source}`)
    }
    for (const [published, derived] of spec.derived) {
      const target = path.join(scratch, `${group}-${published.replace(/\//g, '-')}`)
      cut(path.join(PRESENTATION, derived.from), target, derived)
      const how = derived.crop
        ? `crop ${derived.crop.width}x${derived.crop.height}+${derived.crop.x}+${derived.crop.y}, `
        : ''
      entries[published] = place(target, published, `${derived.from} (${how}${derived.width} px)`)
    }
    manifest.groups[group] = entries
  }
  writeFileSync(path.join(STAGED, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  for (const file of readdirSync(scratch)) {
    // Only this script's own intermediate cuts live here.
    execFileSync('rm', [path.join(scratch, file)])
  }
  execFileSync('rmdir', [scratch])
  console.log(`staged ${path.relative(LOCAL_DATA, STAGED)}`)
}

// ——— Verify ———

function readStaged(): StagedManifest {
  return JSON.parse(readFileSync(path.join(STAGED, 'manifest.json'), 'utf8')) as StagedManifest
}

function glbJson(bytes: Buffer): string {
  return bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8')
}

/**
 * Relative references a page or module asks for, resolved against its own published folder: in a
 * page, any quoted relative path outside comments (import map, imports, fetches); in a module, its
 * import specifiers.
 */
function references(published: string, text: string): string[] {
  const dir = path.posix.dirname(published)
  const found = new Set<string>()
  const body = text.replace(/<!--[\s\S]*?-->/g, '')
  const quoted = published.endsWith('.html')
    ? /['"`](\.{1,2}\/[^'"`\s$]+)['"`]/g
    : /(?:\bfrom\s*|\bimport\s*\(?\s*)['"](\.{1,2}\/[^'"]+)['"]/g
  for (const match of body.matchAll(quoted)) {
    found.add(path.posix.normalize(path.posix.join(dir, match[1])))
  }
  // The viewers load models as load('<file>.glb') from ./models/.
  for (const match of body.matchAll(/\bload\(\s*'([^']+\.glb)'\s*\)/g)) {
    found.add(path.posix.normalize(path.posix.join(dir, 'models', match[1])))
  }
  return [...found]
}

function verify(manifest: StagedManifest) {
  const problems: string[] = []
  const objects = new Map<string, StagedEntry>()
  for (const [group, entries] of Object.entries(manifest.groups)) {
    if (!(group in GROUPS)) problems.push(`unknown group ${group}`)
    const expected = [
      ...GROUPS[group].files.map(([published]) => published),
      ...GROUPS[group].derived.map(([published]) => published),
    ].sort()
    if (JSON.stringify(Object.keys(entries).sort()) !== JSON.stringify(expected)) {
      problems.push(`${group}: staged files differ from the allow-list; run --stage`)
    }
    for (const [published, entry] of Object.entries(entries)) {
      const where = `${group}/${published}`
      const type = extension(published)
      if (!MIME_TYPES[type]) problems.push(`${where}: no content type for .${type}`)
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/.test(published)) {
        problems.push(`${where}: not a plain published path`)
      }
      if (extension(entry.object) !== type) problems.push(`${where}: object type differs`)
      const file = path.join(OBJECTS, entry.object)
      if (!existsSync(file)) {
        problems.push(`${where}: ${entry.object} is not staged`)
        continue
      }
      const bytes = readFileSync(file)
      if (bytes.length !== entry.bytes || sha256(bytes) !== entry.sha256) {
        problems.push(`${where}: differs from the staged manifest`)
      }
      objects.set(entry.object, entry)
      if (type === 'glb') {
        if (bytes.subarray(0, 4).toString('latin1') !== 'glTF') problems.push(`${where}: not glTF`)
        const json = glbJson(bytes)
        const gltf = JSON.parse(json) as {
          images?: unknown[]
          textures?: unknown[]
          buffers?: { uri?: string }[]
        }
        if ((gltf.images?.length ?? 0) > 0 || (gltf.textures?.length ?? 0) > 0) {
          problems.push(`${where}: holds an image`)
        }
        if (gltf.buffers?.some((buffer) => buffer.uri !== undefined)) {
          problems.push(`${where}: refers to an external file`)
        }
        const mark = json.match(MARKS) ?? json.match(PRODUCT_NUMBER)
        if (mark) problems.push(`${where}: carries a manufacturer mark (${mark[0]})`)
        const note = json.match(INTERNAL) ?? json.match(STATUS)
        if (note) problems.push(`${where}: carries an internal note (${note[0]})`)
      }
      if (published in THREE_PACKAGE) {
        const release = readFileSync(
          path.join(ROOT, 'node_modules/three', THREE_PACKAGE[published]),
        )
        if (!release.equals(bytes)) problems.push(`${where}: differs from the three package`)
      } else if (type === 'html' || type === 'js' || type === 'json') {
        const text = bytes.toString('utf8')
        const mark = text.match(MARKS) ?? text.match(PRODUCT_NUMBER)
        if (mark) problems.push(`${where}: carries a manufacturer mark (${mark[0]})`)
        const note = text.match(INTERNAL) ?? text.match(STATUS)
        if (note) problems.push(`${where}: carries an internal note (${note[0]})`)
      }
      if (type === 'html') {
        const text = bytes.toString('utf8').replace(/<!--[\s\S]*?-->/g, '')
        if (/https?:\/\//.test(text)) problems.push(`${where}: refers to the network`)
      }
      if (type === 'html' || type === 'js') {
        for (const reference of references(published, bytes.toString('utf8'))) {
          if (!(reference in entries)) problems.push(`${where}: asks for ${reference}, not staged`)
        }
      }
      if (type === 'jpg' || type === 'png') {
        const head = bytes.subarray(0, 4).toString('hex')
        if (type === 'jpg' ? !head.startsWith('ffd8ff') : head !== '89504e47') {
          problems.push(`${where}: not a ${type}`)
        }
        const start = bytes.subarray(0, 65536).toString('latin1')
        if (/Exif\0|http:\/\/ns\.adobe\.com\/xap|tEXt|iTXt|zTXt|eXIf/.test(start)) {
          problems.push(`${where}: carries image metadata`)
        }
      }
      if (type === 'mp4') {
        if (bytes.subarray(4, 8).toString('latin1') !== 'ftyp') problems.push(`${where}: not MP4`)
        const moov = bytes.indexOf('moov')
        const mdat = bytes.indexOf('mdat')
        if (moov < 0 || mdat < 0 || moov > mdat) problems.push(`${where}: index is not first`)
      }
    }
  }
  const staged = new Set(readdirSync(OBJECTS).filter((name) => name !== '.DS_Store'))
  for (const name of staged) {
    if (!objects.has(name)) problems.push(`unexpected object in the staged folder: ${name}`)
  }
  for (const name of readdirSync(STAGED)) {
    if (!['manifest.json', 'objects', '.DS_Store'].includes(name)) {
      problems.push(`unexpected file in the staged set: ${name}`)
    }
  }
  return { objects: [...objects.values()], problems }
}

// ——— Manifest ———

async function writeManifest(manifest: StagedManifest) {
  const groups = Object.fromEntries(
    Object.entries(manifest.groups).map(([group, entries]) => [
      group,
      Object.fromEntries(
        Object.entries(entries)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([published, entry]) => [
            published,
            { object: entry.object, bytes: entry.bytes, sha256: entry.sha256 },
          ]),
      ),
    ]),
  )
  const options = await prettier.resolveConfig(path.join(ROOT, 'package.json'))
  const text = await prettier.format(
    [
      '// Generated by scripts/medical-thoracoscopy/wolf-preview-demos.ts --write-manifest. Do not edit.',
      '// Server only: the private bucket, the object behind each published file of the hub and its',
      '// two demonstrations, and the hash every served file must match. Pages never import this;',
      '// they ask for a file by its published path.',
      '',
      `export const wolfPreviewDemoAssets = ${JSON.stringify({ bucket: BUCKET, prefix: PREFIX, groups })} as const`,
      '',
    ].join('\n'),
    { ...options, parser: 'typescript' },
  )
  writeFileSync(MANIFEST_OUT, text)
  console.log(`wrote ${path.relative(ROOT, MANIFEST_OUT)}`)
}

// ——— Storage ———

function primaryClient() {
  const gitDir = execSync('git rev-parse --absolute-git-dir', { encoding: 'utf8' }).trim()
  const commonDir = execSync('git rev-parse --path-format=absolute --git-common-dir', {
    encoding: 'utf8',
  }).trim()
  if (gitDir !== commonDir) {
    throw new Error(
      'Storage changes run only from the primary checkout (cd there, then run this file).',
    )
  }
  loadEnvConfig(process.cwd())
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('The primary checkout has no Supabase URL or service key')
  return { url, supabase: createClient(url, key, { auth: { persistSession: false } }) }
}

/** Rollback: empty and delete the private bucket. The hub then shows its demos as unavailable. */
async function remove() {
  const { supabase } = primaryClient()
  const { error: emptyError } = await supabase.storage.emptyBucket(BUCKET)
  if (emptyError) throw emptyError
  const { error } = await supabase.storage.deleteBucket(BUCKET)
  if (error) throw error
  console.log(`emptied and deleted ${BUCKET}`)
}

async function upload(objects: StagedEntry[]) {
  const { url, supabase } = primaryClient()
  const { data: buckets, error: listError } = await supabase.storage.listBuckets()
  if (listError) throw listError
  const bucket = buckets.find((candidate) => candidate.id === BUCKET)
  if (bucket && bucket.public) throw new Error(`${BUCKET} exists and is PUBLIC: stopping`)
  if (!bucket) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: false,
      allowedMimeTypes: [...new Set(Object.values(MIME_TYPES))],
      fileSizeLimit: '50MB',
    })
    if (error) throw error
    console.log(`created private bucket ${BUCKET}`)
  }

  for (const entry of objects) {
    const objectPath = `${PREFIX}/${entry.object}`
    const bytes = readFileSync(path.join(OBJECTS, entry.object))
    const { error } = await supabase.storage.from(BUCKET).upload(objectPath, bytes, {
      contentType: MIME_TYPES[extension(entry.object)],
      upsert: false,
    })
    if (error && !/exists/i.test(error.message)) throw error
    const { data: back, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(objectPath)
    if (downloadError) throw downloadError
    const hash = sha256(Buffer.from(await back.arrayBuffer()))
    if (hash !== entry.sha256) throw new Error(`${objectPath}: stored bytes differ`)
    console.log(`${error ? 'present ' : 'uploaded'}  ${objectPath}  ${hash}`)
  }

  const { data: listed, error: listObjectsError } = await supabase.storage
    .from(BUCKET)
    .list(PREFIX, { limit: 1000 })
  if (listObjectsError) throw listObjectsError
  const names = listed.map((entry) => entry.name).sort()
  const expected = objects.map((entry) => entry.object).sort()
  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    throw new Error(`the bucket holds ${names.join(', ')}; expected exactly the manifest`)
  }
  const { data: root } = await supabase.storage.from(BUCKET).list('', { limit: 100 })
  const others = (root ?? []).map((entry) => entry.name).filter((name) => name !== PREFIX)
  if (others.length > 0)
    throw new Error(`unexpected objects at the bucket root: ${others.join(', ')}`)

  const probe = `${url}/storage/v1/object/public/${BUCKET}/${PREFIX}/${objects[0].object}`
  const status = (await fetch(probe)).status
  if (status >= 200 && status < 300) throw new Error(`${probe} is readable without a key`)
  console.log(`public URL answers ${status}: not readable without a key`)
  console.log(`bucket ${BUCKET} holds exactly ${objects.length} objects under ${PREFIX}/`)
}

async function main() {
  if (args.includes('--remove')) return remove()
  if (args.includes('--stage')) stage()
  if (!existsSync(path.join(STAGED, 'manifest.json'))) {
    throw new Error(`no staged set at ${STAGED}; run with --stage first`)
  }
  const manifest = readStaged()
  const { objects, problems } = verify(manifest)
  console.log(`Staged set (private bucket ${BUCKET}/${PREFIX}):`)
  for (const [group, entries] of Object.entries(manifest.groups)) {
    console.log(`  ${group}`)
    for (const [published, entry] of Object.entries(entries)) {
      console.log(`    ${published.padEnd(46)} ${String(entry.bytes).padStart(9)}  ${entry.object}`)
    }
  }
  const total = objects.reduce((sum, entry) => sum + entry.bytes, 0)
  console.log(`  ${objects.length} distinct objects, ${total} bytes; nothing else`)
  if (problems.length > 0) {
    console.error(`STOP:\n  ${problems.join('\n  ')}`)
    process.exit(1)
  }
  console.log(
    'Verified: allow-list, hashes, glTF only, no images in models, no marks or internal notes, three.js unmodified, no network, references, no image metadata, MP4 index first.',
  )
  if (args.includes('--write-manifest')) await writeManifest(manifest)
  if (args.includes('--upload')) await upload(objects)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
