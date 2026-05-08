import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDir, '..')
const sourceAppCandidates = [
  resolve(projectRoot, '../navigation_module/web'),
  resolve(projectRoot, '../Navigation_module/web'),
]
const sourceAppDir = sourceAppCandidates.find((candidate) => existsSync(candidate))

if (!sourceAppDir) {
  throw new Error(`Source app not found. Checked: ${sourceAppCandidates.join(', ')}`)
}

const sourceDistDir = resolve(sourceAppDir, 'dist')
const destinationDir = resolve(projectRoot, 'public/bronch-navigation-trainer/app')
const embeddedBasePath = '/bronch-navigation-trainer/app/'

console.log('Building Bronch Navigation Trainer app...')
console.log(`Embed build config: base ${embeddedBasePath}, scope debug disabled`)

execFileSync('npm', ['run', 'build'], {
  cwd: sourceAppDir,
  env: {
    ...process.env,
    VITE_BASE_PATH: embeddedBasePath,
    VITE_ENABLE_SCOPE_DEBUG: 'false',
  },
  stdio: 'inherit',
})

console.log('Syncing built assets into the Next.js site...')
rmSync(destinationDir, { recursive: true, force: true })
mkdirSync(dirname(destinationDir), { recursive: true })
cpSync(sourceDistDir, destinationDir, {
  recursive: true,
  filter: (source) => basename(source) !== '.DS_Store',
})

console.log(`Bronch Navigation Trainer synced to ${destinationDir}`)
