import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'

const root = process.cwd()
const { loadEnvConfig } = nextEnv
loadEnvConfig(root)

const manifestPath = path.join(
  root,
  'src',
  'features',
  'pccm-intro-course',
  'content',
  'videoManifest.json',
)
const defaultSourceRoot = path.join(root, 'intro to bronch and pleural disease course ')
const bucket = process.env.PCCM_INTRO_COURSE_MEDIA_BUCKET || 'pccm-intro-course-media'
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const secretKey = process.env.SUPABASE_SECRET_KEY
const dryRun = process.argv.includes('--dry-run')
const skipOverLimit = process.argv.includes('--skip-over-limit')
const upsert = process.argv.includes('--upsert')
const sourceDirArg = process.argv.find((arg) => arg.startsWith('--source-dir='))
const sourceRoot = sourceDirArg
  ? resolvePath(sourceDirArg.replace(/^--source-dir=/, ''))
  : defaultSourceRoot
const minBucketFileSizeLimit = 1024 * 1024 * 1024
const bucketFileSizeLimitPadding = 64 * 1024 * 1024

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.resolve(root, value)
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
      'SUPABASE_SECRET_KEY is set, but this upload script needs the legacy JWT-style service_role key.',
      'Use Supabase Project Settings > API Keys > Legacy API Keys > service_role.',
    ].join(' ')
  }

  if (!serviceRoleKey) {
    return 'SUPABASE_SERVICE_ROLE_KEY is required for PCCM intro course media uploads.'
  }

  if (!serviceRoleKey.startsWith('eyJ') || serviceRoleKey.split('.').length !== 3) {
    return 'SUPABASE_SERVICE_ROLE_KEY must be the JWT-style service_role key.'
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

async function loadManifest() {
  const raw = await readFile(manifestPath, 'utf8')
  const videos = JSON.parse(raw)

  if (!Array.isArray(videos) || videos.length === 0) {
    throw new Error(`No videos found in ${manifestPath}`)
  }

  return videos
}

async function collectFiles() {
  const videos = await loadManifest()
  const files = []

  for (const video of videos) {
    const filePath = path.join(sourceRoot, video.sourcePath)
    const fileStat = await stat(filePath)

    if (!fileStat.isFile()) {
      throw new Error(`PCCM media source is not a file: ${filePath}`)
    }

    if (path.extname(filePath).toLowerCase() !== '.mp4') {
      throw new Error(`PCCM media source is not an MP4: ${filePath}`)
    }

    files.push({
      audience: video.audience,
      filePath,
      id: video.id,
      size: fileStat.size,
      storagePath: video.storagePath,
      title: video.title,
    })
  }

  files.sort((a, b) => a.storagePath.localeCompare(b.storagePath))
  return files
}

function resolveBucketFileSizeLimit(files) {
  const configured = Number(process.env.PCCM_INTRO_COURSE_BUCKET_FILE_SIZE_LIMIT_BYTES)
  if (Number.isFinite(configured) && configured > 0) {
    return Math.floor(configured)
  }

  const largestFile = Math.max(...files.map((file) => file.size))
  return Math.max(minBucketFileSizeLimit, largestFile + bucketFileSizeLimitPadding)
}

async function ensurePrivateBucket(client, fileSizeLimit) {
  const { data: buckets, error: listError } = await client.storage.listBuckets()
  if (listError) {
    throw listError
  }

  const existing = buckets?.find((item) => item.name === bucket)
  const bucketConfig = {
    allowedMimeTypes: ['video/mp4'],
    fileSizeLimit,
    public: false,
  }

  if (!existing) {
    const { error } = await client.storage.createBucket(bucket, bucketConfig)
    if (error) {
      throw error
    }
    return
  }

  const { error } = await client.storage.updateBucket(bucket, bucketConfig)
  if (error) {
    throw error
  }
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

const files = await collectFiles()
const fileSizeLimit = resolveBucketFileSizeLimit(files)
const overLimitFiles = files.filter((file) => file.size > fileSizeLimit)
const uploadFiles = skipOverLimit ? files.filter((file) => file.size <= fileSizeLimit) : files

if (!skipOverLimit && overLimitFiles.length > 0) {
  throw new Error(
    [
      `PCCM intro course media upload has ${overLimitFiles.length} file(s) above the configured bucket limit of ${formatBytes(fileSizeLimit)}.`,
      'Increase PCCM_INTRO_COURSE_BUCKET_FILE_SIZE_LIMIT_BYTES or pass --skip-over-limit to upload only files that fit.',
      ...overLimitFiles.map((file) => `- ${file.id}: ${formatBytes(file.size)} ${file.storagePath}`),
    ].join('\n'),
  )
}

console.log(`PCCM intro course media upload plan`)
console.log(`Bucket: ${bucket}`)
console.log(`Private bucket: yes`)
console.log(`Allowed MIME types: video/mp4`)
console.log(`File size limit: ${fileSizeLimit} bytes (${formatBytes(fileSizeLimit)})`)
console.log(`Source root: ${sourceRoot}`)
console.log(`Videos: ${files.length}`)
if (skipOverLimit) {
  console.log(`Uploadable with current limit: ${uploadFiles.length}`)
  console.log(`Skipped over limit: ${overLimitFiles.length}`)
}

for (const file of files) {
  const overLimit = file.size > fileSizeLimit
  console.log(
    [
      overLimit && skipOverLimit ? '[skip-over-limit]' : dryRun ? '[dry-run]' : '[upload]',
      file.id,
      file.audience,
      formatBytes(file.size),
      file.storagePath,
      `<- ${file.filePath}`,
    ].join(' '),
  )
}

const credentialError = getCredentialError()
if (dryRun) {
  console.log('Dry run complete. No bucket or object changes were made.')
  process.exit(0)
}

if (!supabaseUrl || credentialError) {
  throw new Error(
    [!supabaseUrl ? 'SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required.' : '', credentialError]
      .filter(Boolean)
      .join(' '),
  )
}

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

await ensurePrivateBucket(client, fileSizeLimit)

for (const file of uploadFiles) {
  const body = await readFile(file.filePath)
  const { error } = await client.storage.from(bucket).upload(file.storagePath, body, {
    cacheControl: '3600',
    contentType: 'video/mp4',
    upsert,
  })

  if (error) {
    throw new Error(`Failed to upload ${file.storagePath}: ${error.message}`)
  }

  console.log(`Uploaded ${file.storagePath}`)
}

console.log('PCCM intro course media upload complete.')
