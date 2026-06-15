import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'

const root = process.cwd()
const { loadEnvConfig } = nextEnv
loadEnvConfig(root)

const publicDir = path.join(root, 'public')
const bucket = process.env.MODULE_ASSET_BUCKET || 'module-assets'
const prefix = (process.env.MODULE_ASSET_PREFIX || 'v1').replace(/^\/+|\/+$/g, '')
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const secretKey = process.env.SUPABASE_SECRET_KEY
const dryRun = process.argv.includes('--dry-run')
const upsert = process.argv.includes('--upsert')

// `--only=airway-anatomy` (repeatable, or comma-separated) restricts the upload to one or more
// public-relative path prefixes so you can push a single module without re-uploading everything.
const onlyFilters = process.argv
  .filter((arg) => arg.startsWith('--only='))
  .flatMap((arg) => arg.slice('--only='.length).split(','))
  .map((value) => value.trim().replace(/^\/+|\/+$/g, ''))
  .filter(Boolean)

function matchesOnlyFilter(relativePath) {
  if (onlyFilters.length === 0) {
    return true
  }
  return onlyFilters.some((only) => relativePath === only || relativePath.startsWith(`${only}/`))
}

const uploadPrefixes = [
  'airway-anatomy',
  'bronch-navigation-trainer/app/cases',
  'draco',
  'fluoroview',
  'models',
  'socal-ebus-course/app/media',
  'socal-ebus-course/app/pipelines',
  'socal-ebus-course/app/simulator',
]

const embeddedAssetExtensions = new Set([
  '.glb',
  '.jpg',
  '.jpeg',
  '.nrrd',
  '.png',
  '.wasm',
  '.webp',
  '.zst',
])

const contentTypes = new Map([
  ['.bin', 'application/octet-stream'],
  ['.br', 'application/octet-stream'],
  ['.css', 'text/css; charset=utf-8'],
  ['.glb', 'model/gltf-binary'],
  ['.gltf', 'model/gltf+json; charset=utf-8'],
  ['.gz', 'application/gzip'],
  ['.html', 'text/html; charset=utf-8'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mp4', 'video/mp4'],
  ['.nrrd', 'application/octet-stream'],
  ['.png', 'image/png'],
  ['.raw', 'application/octet-stream'],
  ['.stl', 'model/stl'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.wasm', 'application/wasm'],
  ['.webp', 'image/webp'],
  ['.zst', 'application/zstd'],
])

function toPublicRelativePath(source) {
  return path.relative(publicDir, source).split(path.sep).join('/')
}

function shouldUpload(source) {
  const relativePath = toPublicRelativePath(source)

  if (!relativePath || relativePath.startsWith('..') || relativePath.endsWith('.DS_Store')) {
    return false
  }

  if (!matchesOnlyFilter(relativePath)) {
    return false
  }

  if (uploadPrefixes.some((uploadPrefix) => relativePath.startsWith(`${uploadPrefix}/`))) {
    return true
  }

  if (
    relativePath.startsWith('socal-ebus-course/app/assets/') ||
    relativePath.startsWith('bronch-navigation-trainer/app/assets/')
  ) {
    return embeddedAssetExtensions.has(path.extname(relativePath).toLowerCase())
  }

  return false
}

async function* walk(dir) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return
    }
    throw error
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(fullPath)
    } else if (entry.isFile() && shouldUpload(fullPath)) {
      yield fullPath
    }
  }
}

function getContentType(filePath) {
  return contentTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream'
}

async function collectFiles() {
  const files = []
  for await (const filePath of walk(publicDir)) {
    const fileStat = await stat(filePath)
    files.push({ filePath, size: fileStat.size })
  }
  return files
}

async function ensureBucket(client) {
  const { data: buckets, error: listError } = await client.storage.listBuckets()
  if (listError) {
    throw listError
  }

  if (buckets?.some((item) => item.name === bucket)) {
    return
  }

  const { error } = await client.storage.createBucket(bucket, { public: true })
  if (error) {
    throw error
  }
}

function decodeJwtPayload(token) {
  try {
    const [, payload] = token.split('.')
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

function getCredentialError() {
  if (!serviceRoleKey && secretKey?.startsWith('sb_secret_')) {
    return [
      'SUPABASE_SECRET_KEY is set, but this Storage upload script needs the legacy JWT-style service_role key.',
      'In Supabase, open Project Settings > API Keys > Legacy API Keys and copy the service_role key into SUPABASE_SERVICE_ROLE_KEY.',
    ].join(' ')
  }

  if (!serviceRoleKey) {
    return 'SUPABASE_SERVICE_ROLE_KEY is required for Storage uploads.'
  }

  if (!serviceRoleKey.startsWith('eyJ') || serviceRoleKey.split('.').length !== 3) {
    return 'SUPABASE_SERVICE_ROLE_KEY must be the JWT-style service_role key, not an sb_secret/sb_publishable key or project URL.'
  }

  const payload = decodeJwtPayload(serviceRoleKey)
  if (!payload) {
    return 'SUPABASE_SERVICE_ROLE_KEY could not be decoded as a JWT.'
  }

  if (payload.role !== 'service_role') {
    return `SUPABASE_SERVICE_ROLE_KEY decoded with role "${payload.role ?? 'unknown'}"; expected "service_role".`
  }

  return null
}

const credentialError = getCredentialError()
if (!dryRun && (!supabaseUrl || credentialError)) {
  throw new Error(
    [
      !supabaseUrl ? 'SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required.' : null,
      credentialError,
    ]
      .filter(Boolean)
      .join(' '),
  )
}

const files = await collectFiles()
const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
console.log(
  `${dryRun ? 'Would upload' : 'Uploading'} ${files.length} files (${(
    totalBytes /
    1024 /
    1024
  ).toFixed(1)} MB) to ${bucket}/${prefix}`,
)

if (dryRun) {
  for (const file of files.slice(0, 100)) {
    console.log(`- ${prefix}/${toPublicRelativePath(file.filePath)}`)
  }
  if (files.length > 100) {
    console.log(`...and ${files.length - 100} more files`)
  }
  process.exit(0)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

await ensureBucket(supabase)

let uploaded = 0
for (const file of files) {
  const relativePath = toPublicRelativePath(file.filePath)
  const storagePath = `${prefix}/${relativePath}`
  const body = await readFile(file.filePath)
  const { error } = await supabase.storage.from(bucket).upload(storagePath, body, {
    cacheControl: '31536000',
    contentType: getContentType(file.filePath),
    upsert,
  })

  if (error) {
    throw new Error(`Failed to upload ${relativePath}: ${error.message}`)
  }

  uploaded += 1
  if (uploaded % 25 === 0 || uploaded === files.length) {
    console.log(`Uploaded ${uploaded}/${files.length}`)
  }
}
