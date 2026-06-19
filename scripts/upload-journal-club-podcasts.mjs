import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'

const root = process.cwd()
const { loadEnvConfig } = nextEnv
loadEnvConfig(root)

const sourceDirs = [
  path.join(root, 'podcasts', 'Completed_podcasts'),
  path.join(root, 'podcasts', 'arabic_mp3_files'),
  path.join(root, 'podcasts', 'korean_mp3_files'),
]
const bucket = process.env.JOURNAL_CLUB_PODCAST_BUCKET || 'journal-club-podcasts'
const prefix = (process.env.JOURNAL_CLUB_PODCAST_PREFIX || 'v1').replace(/^\/+|\/+$/g, '')
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const secretKey = process.env.SUPABASE_SECRET_KEY
const dryRun = process.argv.includes('--dry-run')
const upsert = process.argv.includes('--upsert')
const languagesArg = process.argv.find((arg) => arg.startsWith('--languages='))
const minBucketFileSizeLimit = 16 * 1024 * 1024
const bucketFileSizeLimitPadding = 2 * 1024 * 1024

const languageSuffixes = new Map([
  ['English', 'english'],
  ['Spanish', 'spanish'],
  ['Mandarin', 'mandarin'],
  ['Arabic', 'arabic'],
  ['Korean', 'korean'],
])
const languageSuffixPattern = Array.from(languageSuffixes.keys()).join('|')
const selectedLanguages = resolveSelectedLanguages()

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function* walk(dir) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`Podcast source directory does not exist: ${dir}`)
    }
    throw error
  }

  for (const entry of entries) {
    if (entry.name === '.DS_Store') {
      continue
    }

    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(fullPath)
    } else if (entry.isFile() && entry.name.endsWith('.mp3')) {
      yield fullPath
    }
  }
}

function resolveUploadTarget(filePath) {
  const fileName = path.basename(filePath)
  const match = fileName.match(new RegExp(`^(.+)_(${languageSuffixPattern})\\.mp3$`))
  if (!match) {
    throw new Error(`Podcast MP3 does not use the expected language suffix: ${fileName}`)
  }

  const [, baseName, languageLabel] = match
  const language = languageSuffixes.get(languageLabel)
  if (!language) {
    throw new Error(`Unsupported podcast language suffix: ${languageLabel}`)
  }

  return {
    episodeId: slugify(baseName),
    language,
    storagePath: `${prefix}/${slugify(baseName)}/${language}.mp3`,
  }
}

function resolveSelectedLanguages() {
  const supportedLanguages = new Set(languageSuffixes.values())

  if (!languagesArg) {
    return supportedLanguages
  }

  const requestedLanguages = languagesArg
    .replace(/^--languages=/, '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  if (!requestedLanguages.length) {
    throw new Error('--languages requires at least one language, for example --languages=arabic,korean')
  }

  for (const language of requestedLanguages) {
    if (!supportedLanguages.has(language)) {
      throw new Error(
        `Unsupported language "${language}". Supported languages: ${Array.from(supportedLanguages).join(', ')}`,
      )
    }
  }

  return new Set(requestedLanguages)
}

async function collectFiles() {
  const files = []
  for (const sourceDir of sourceDirs) {
    for await (const filePath of walk(sourceDir)) {
      const fileStat = await stat(filePath)
      const uploadTarget = resolveUploadTarget(filePath)
      if (!selectedLanguages.has(uploadTarget.language)) {
        continue
      }

      files.push({
        filePath,
        size: fileStat.size,
        ...uploadTarget,
      })
    }
  }

  files.sort((a, b) => a.storagePath.localeCompare(b.storagePath))
  return files
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
    return 'SUPABASE_SERVICE_ROLE_KEY is required for podcast uploads.'
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

async function ensurePrivateBucket(client, fileSizeLimit) {
  const { data: buckets, error: listError } = await client.storage.listBuckets()
  if (listError) {
    throw listError
  }

  const existing = buckets?.find((item) => item.name === bucket)
  if (!existing) {
    const { error } = await client.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit,
      allowedMimeTypes: ['audio/mpeg'],
    })
    if (error) {
      throw error
    }
    return
  }

  const { error } = await client.storage.updateBucket(bucket, {
    public: false,
    fileSizeLimit,
    allowedMimeTypes: ['audio/mpeg'],
  })
  if (error) {
    throw error
  }
}

function validateLanguageSets(files) {
  const grouped = files.reduce((acc, file) => {
    const languages = acc.get(file.episodeId) ?? new Set()
    languages.add(file.language)
    acc.set(file.episodeId, languages)
    return acc
  }, new Map())

  const missing = []
  for (const [episodeId, languages] of grouped) {
    for (const language of selectedLanguages) {
      if (!languages.has(language)) {
        missing.push(`${episodeId}:${language}`)
      }
    }
  }

  if (missing.length) {
    throw new Error(`Podcast upload set is missing language tracks: ${missing.join(', ')}`)
  }
}

function resolveBucketFileSizeLimit(files) {
  const configured = Number(process.env.JOURNAL_CLUB_PODCAST_BUCKET_FILE_SIZE_LIMIT_BYTES)
  if (Number.isFinite(configured) && configured > 0) {
    return Math.floor(configured)
  }

  const largestFile = Math.max(...files.map((file) => file.size))
  return Math.max(minBucketFileSizeLimit, largestFile + bucketFileSizeLimitPadding)
}

const credentialError = getCredentialError()
if (!dryRun && (!supabaseUrl || credentialError)) {
  throw new Error(
    [!supabaseUrl ? 'SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required.' : null, credentialError]
      .filter(Boolean)
      .join(' '),
  )
}

const files = await collectFiles()
validateLanguageSets(files)

const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
const bucketFileSizeLimit = resolveBucketFileSizeLimit(files)
console.log(
  `${dryRun ? 'Would upload' : 'Uploading'} ${files.length} MP3 files (${(
    totalBytes /
    1024 /
    1024
  ).toFixed(1)} MB) to private bucket ${bucket}/${prefix}`,
)
console.log(`Bucket file size limit: ${(bucketFileSizeLimit / 1024 / 1024).toFixed(1)} MB`)

if (dryRun) {
  for (const file of files.slice(0, 100)) {
    console.log(`- ${file.storagePath}`)
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

await ensurePrivateBucket(supabase, bucketFileSizeLimit)

let uploaded = 0
for (const file of files) {
  const body = await readFile(file.filePath)
  const { error } = await supabase.storage.from(bucket).upload(file.storagePath, body, {
    cacheControl: '3600',
    contentType: 'audio/mpeg',
    upsert,
  })

  if (error) {
    throw new Error(`Failed to upload ${file.storagePath}: ${error.message}`)
  }

  uploaded += 1
  if (uploaded % 10 === 0 || uploaded === files.length) {
    console.log(`Uploaded ${uploaded}/${files.length}`)
  }
}
