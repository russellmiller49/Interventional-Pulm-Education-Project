import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDir, '..')
const sourceAppDir = resolve(projectRoot, 'navigation_module/web')

const sourceDistDir = resolve(sourceAppDir, 'dist')
const destinationDir = resolve(projectRoot, 'public/bronch-navigation-trainer/app')
const embeddedBasePath = '/bronch-navigation-trainer/app/'

console.log('Building Bronch Navigation Trainer app...')
console.log(
  `Embed build config: base ${embeddedBasePath}, authoring tools enabled on loopback hosts only`,
)

execFileSync('npm', ['run', 'build'], {
  cwd: sourceAppDir,
  env: {
    ...process.env,
    VITE_BASE_PATH: embeddedBasePath,
    VITE_ENABLE_SCOPE_DEBUG: 'false',
  },
  stdio: 'inherit',
})

console.log('Preparing embedded assets for the Next.js site...')
rmSync(destinationDir, { recursive: true, force: true })
mkdirSync(dirname(destinationDir), { recursive: true })
cpSync(sourceDistDir, destinationDir, {
  recursive: true,
  filter: (source) => basename(source) !== '.DS_Store',
})

for (const authoringAsset of [
  resolve(destinationDir, 'cases/default/book_candidates.json'),
  resolve(destinationDir, 'cases/default/manual_inferred_candidates.json'),
]) {
  rmSync(authoringAsset, { force: true })
}

console.log(`Bronch Navigation Trainer built at ${destinationDir}`)
