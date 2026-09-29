/**
 * The showcase models for the private manufacturer preview: verify them, record them, and (only
 * when asked) upload them to the private bucket.
 *
 *   npx tsx scripts/medical-thoracoscopy/wolf-preview-assets.ts                   verify and print
 *   npx tsx scripts/medical-thoracoscopy/wolf-preview-assets.ts --write-manifest  also write the
 *       server-only manifest src/features/medical-thoracoscopy/wolf-preview/server/assetManifest.ts
 *   npx tsx <path>/wolf-preview-assets.ts --upload   from the PRIMARY checkout (it reads that
 *       checkout's .env.local for the service key): create the private bucket if needed, upload,
 *       and check the bucket holds exactly the manifest and is not public
 *   npx tsx <path>/wolf-preview-assets.ts --remove   from the PRIMARY checkout: rollback, empty and
 *       delete the private bucket
 *
 * The files are the thirteen Draco models `stage-device-showcase.ts` staged in the owner's local
 * data. Every one must be named in the showcase register (read at the audited explorer commit)
 * and in the demonstration set's asset-status table, match the staging manifest's hash, be a
 * glTF binary with no image, texture or external reference, and carry no manufacturer mark.
 * Anything else in the staged folder stops the script. Nothing else is ever uploaded: no source
 * frames, comparison sheets, anatomy or other module assets.
 */
import { execFileSync, execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import prettier from 'prettier'

const ROOT = path.resolve(__dirname, '../..')
const EXPLORER_COMMIT = 'c6295d2aceafe59dd9bf088951cd13bad3daf45f'
const LOCAL_DATA =
  process.env.IP_LOCAL_DATA?.trim() ||
  '/Users/russellmiller/Projects/Interventional-Pulm-Local-Data'
const STAGED = path.join(LOCAL_DATA, 'raw-assets/medical-thoracoscopy/devices/showcase/staged')
const ASSET_STATUS = path.join(
  LOCAL_DATA,
  'medical_thoracoscopy/presentation/2026-09-29-device-showcase/asset-status.md',
)
const MANIFEST_OUT = path.join(
  ROOT,
  'src/features/medical-thoracoscopy/wolf-preview/server/assetManifest.ts',
)
export const BUCKET = 'mt-wolf-preview'
export const PREFIX = 'device-explorer/v1'
const MARKS = /wolf|eragon|endocam|endolight|panoview|richard/i

const args = process.argv.slice(2)

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

type Staged = {
  registerSha256: string
  models: { id: string; file: string; bytes: number; sha256: string; qualityClass: string }[]
}

function verify() {
  const staged = JSON.parse(readFileSync(path.join(STAGED, 'manifest.json'), 'utf8')) as Staged
  const registerText = execFileSync(
    'git',
    [
      'show',
      `${EXPLORER_COMMIT}:docs/medical-thoracoscopy/registers/device-showcase-register.json`,
    ],
    { cwd: ROOT },
  )
  const register = JSON.parse(registerText.toString('utf8')) as {
    models: { id: string; qualityClass: string }[]
  }
  const problems: string[] = []
  if (staged.registerSha256 !== sha256(registerText)) {
    problems.push('the staged models were built against another register')
  }
  const status = readFileSync(ASSET_STATUS, 'utf8')

  const expectedFiles = new Set(['manifest.json', ...staged.models.map((model) => model.file)])
  for (const name of readdirSync(STAGED)) {
    if (!expectedFiles.has(name)) problems.push(`unexpected file in the staged folder: ${name}`)
  }
  const registerIds = register.models.map((model) => model.id).sort()
  const stagedIds = staged.models.map((model) => model.id).sort()
  if (JSON.stringify(registerIds) !== JSON.stringify(stagedIds)) {
    problems.push(`staged models ${stagedIds.join(', ')} differ from the register's`)
  }

  const rows = staged.models.map((model) => {
    const bytes = readFileSync(path.join(STAGED, model.file))
    const hash = sha256(bytes)
    if (!/^[a-z]+(-[a-z]+)*\.[0-9a-f]{12}\.glb$/.test(model.file)) {
      problems.push(`${model.file}: not a staged model name`)
    }
    if (hash !== model.sha256 || bytes.length !== model.bytes) {
      problems.push(`${model.file}: differs from the staging manifest`)
    }
    if (bytes.subarray(0, 4).toString('latin1') !== 'glTF') {
      problems.push(`${model.file}: not a glTF binary`)
    }
    const json = bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8')
    const gltf = JSON.parse(json) as {
      images?: unknown[]
      textures?: unknown[]
      buffers?: { uri?: string }[]
    }
    if ((gltf.images?.length ?? 0) > 0 || (gltf.textures?.length ?? 0) > 0) {
      problems.push(`${model.file}: holds an image`)
    }
    if (gltf.buffers?.some((buffer) => buffer.uri !== undefined)) {
      problems.push(`${model.file}: refers to an external file`)
    }
    const entry = register.models.find((candidate) => candidate.id === model.id)
    if (!entry) problems.push(`${model.id}: not in the register`)
    const mark = json.match(MARKS)
    if (mark) problems.push(`${model.file}: carries a manufacturer mark (${mark[0]})`)
    // The asset-status table names each model as `| <id> (N triangles) | … | <class> |`.
    const statusRow = status
      .split('\n')
      .map((line) => line.split('|').map((cell) => cell.trim()))
      .find((cells) => cells[1]?.startsWith(`${model.id} (`))
    if (!statusRow) problems.push(`${model.id}: not in asset-status.md`)
    else if (entry && statusRow[3] !== entry.qualityClass) {
      problems.push(`${model.id}: asset-status class ${statusRow[3]} differs from the register's`)
    }
    return {
      id: model.id,
      object: model.file,
      bytes: bytes.length,
      sha256: hash,
      qualityClass: entry?.qualityClass ?? '?',
    }
  })
  return { rows, problems }
}

async function writeManifest(rows: ReturnType<typeof verify>['rows']) {
  const manifest = {
    bucket: BUCKET,
    prefix: PREFIX,
    models: Object.fromEntries(
      rows.map((row) => [row.id, { object: row.object, bytes: row.bytes, sha256: row.sha256 }]),
    ),
  }
  const options = await prettier.resolveConfig(path.join(ROOT, 'package.json'))
  const text = await prettier.format(
    [
      '// Generated by scripts/medical-thoracoscopy/wolf-preview-assets.ts --write-manifest. Do not edit.',
      '// Server only: the private bucket, the object for each model, and the hash every served file',
      '// must match. Pages never import this; they ask for a model by id.',
      '',
      `export const wolfPreviewAssets = ${JSON.stringify(manifest)} as const`,
      '',
    ].join('\n'),
    { ...options, parser: 'typescript' },
  )
  writeFileSync(MANIFEST_OUT, text)
  console.log(`wrote ${path.relative(ROOT, MANIFEST_OUT)}`)
}

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
  return createClient(url, key, { auth: { persistSession: false } })
}

/** Rollback: empty and delete the private bucket. The preview then serves no model at all. */
async function remove() {
  const supabase = primaryClient()
  const { error: emptyError } = await supabase.storage.emptyBucket(BUCKET)
  if (emptyError) throw emptyError
  const { error } = await supabase.storage.deleteBucket(BUCKET)
  if (error) throw error
  console.log(`emptied and deleted ${BUCKET}`)
}

async function upload(rows: ReturnType<typeof verify>['rows']) {
  const gitDir = execSync('git rev-parse --absolute-git-dir', { encoding: 'utf8' }).trim()
  const commonDir = execSync('git rev-parse --path-format=absolute --git-common-dir', {
    encoding: 'utf8',
  }).trim()
  if (gitDir !== commonDir) {
    throw new Error('Uploads run only from the primary checkout (cd there, then run this file).')
  }
  loadEnvConfig(process.cwd())
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('The primary checkout has no Supabase URL or service key')
  const supabase = createClient(url, key, { auth: { persistSession: false } })

  const { data: buckets, error: listError } = await supabase.storage.listBuckets()
  if (listError) throw listError
  const bucket = buckets.find((candidate) => candidate.id === BUCKET)
  if (bucket && bucket.public) throw new Error(`${BUCKET} exists and is PUBLIC: stopping`)
  if (!bucket) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: false,
      allowedMimeTypes: ['model/gltf-binary'],
      fileSizeLimit: '5MB',
    })
    if (error) throw error
    console.log(`created private bucket ${BUCKET}`)
  }

  for (const row of rows) {
    const objectPath = `${PREFIX}/${row.object}`
    const bytes = readFileSync(path.join(STAGED, row.object))
    const { error } = await supabase.storage.from(BUCKET).upload(objectPath, bytes, {
      contentType: 'model/gltf-binary',
      upsert: false,
    })
    if (error && !/exists/i.test(error.message)) throw error
    const { data: back, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(objectPath)
    if (downloadError) throw downloadError
    const hash = sha256(Buffer.from(await back.arrayBuffer()))
    if (hash !== row.sha256) throw new Error(`${objectPath}: stored bytes differ`)
    console.log(`${error ? 'present' : 'uploaded'}  ${objectPath}  ${hash}`)
  }

  const { data: listed, error: listObjectsError } = await supabase.storage
    .from(BUCKET)
    .list(PREFIX, { limit: 100 })
  if (listObjectsError) throw listObjectsError
  const names = listed.map((entry) => entry.name).sort()
  const expected = rows.map((row) => row.object).sort()
  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    throw new Error(`the bucket holds ${names.join(', ')}; expected exactly the manifest`)
  }
  const { data: root } = await supabase.storage.from(BUCKET).list('', { limit: 100 })
  const others = (root ?? [])
    .map((entry) => entry.name)
    .filter((name) => name !== 'device-explorer')
  if (others.length > 0)
    throw new Error(`unexpected objects at the bucket root: ${others.join(', ')}`)

  const probe = `${url}/storage/v1/object/public/${BUCKET}/${PREFIX}/${rows[0].object}`
  const status = (await fetch(probe)).status
  if (status >= 200 && status < 300) throw new Error(`${probe} is readable without a key`)
  console.log(`public URL answers ${status}: not readable without a key`)
  console.log(`bucket ${BUCKET} holds exactly ${rows.length} models under ${PREFIX}/`)
}

async function main() {
  if (args.includes('--remove')) return remove()
  const { rows, problems } = verify()
  console.log('Upload manifest (private bucket', `${BUCKET}/${PREFIX}):`)
  for (const row of rows) {
    console.log(
      `  ${row.qualityClass}  ${row.object.padEnd(58)} ${String(row.bytes).padStart(8)}  ${row.sha256}`,
    )
  }
  console.log(
    `  ${rows.length} files, ${rows.reduce((sum, row) => sum + row.bytes, 0)} bytes; nothing else`,
  )
  if (problems.length > 0) {
    console.error(`STOP:\n  ${problems.join('\n  ')}`)
    process.exit(1)
  }
  console.log('Verified: register, asset-status, hashes, glTF only, no images, no marks.')
  if (args.includes('--write-manifest')) await writeManifest(rows)
  if (args.includes('--upload')) await upload(rows)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
