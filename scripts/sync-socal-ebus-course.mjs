import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDir, '..')
const sourceAppDir = resolve(projectRoot, '../EBUS-course/apps/web')
const sourceDistDir = resolve(sourceAppDir, 'dist')
const destinationDir = resolve(projectRoot, 'public/socal-ebus-course/app')

loadEnvConfig(projectRoot)

const embeddedEnv = {
  ...process.env,
  VITE_PUBLIC_SITE_URL:
    process.env.VITE_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? '',
  VITE_APP_CODE: process.env.VITE_APP_CODE ?? 'ebus_course',
  VITE_COURSE_CODE: process.env.VITE_COURSE_CODE ?? 'socal_ebus_prep',
  VITE_SUPABASE_URL:
    process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  VITE_SUPABASE_ANON_KEY:
    process.env.VITE_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
}

if (!existsSync(sourceAppDir)) {
  throw new Error(`Source app not found: ${sourceAppDir}`)
}

console.log('Building SoCal EBUS course app...')
console.log(
  `Embed build config: live sync ${
    embeddedEnv.VITE_SUPABASE_URL && embeddedEnv.VITE_SUPABASE_ANON_KEY ? 'enabled' : 'disabled'
  }`,
)
if (!embeddedEnv.VITE_SUPABASE_URL || !embeddedEnv.VITE_SUPABASE_ANON_KEY) {
  console.log(
    'Hint: put NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local or export VITE_SUPABASE_* before syncing.',
  )
}
execFileSync('npm', ['run', 'build:embed'], {
  cwd: sourceAppDir,
  env: embeddedEnv,
  stdio: 'inherit',
})

console.log('Syncing built assets into the Next.js site...')
rmSync(destinationDir, { recursive: true, force: true })
mkdirSync(dirname(destinationDir), { recursive: true })
cpSync(sourceDistDir, destinationDir, { recursive: true })

console.log(`SoCal EBUS course synced to ${destinationDir}`)
