import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDir, '..')
const sourceAppDir = resolve(projectRoot, '../EBUS-course/apps/web')
const sourceDistDir = resolve(sourceAppDir, 'dist')
const destinationDir = resolve(projectRoot, 'public/socal-ebus-course/app')

if (!existsSync(sourceAppDir)) {
  throw new Error(`Source app not found: ${sourceAppDir}`)
}

console.log('Building SoCal EBUS course app...')
execFileSync('npm', ['run', 'build', '--', '--base', '/socal-ebus-course/app/'], {
  cwd: sourceAppDir,
  stdio: 'inherit',
})

console.log('Syncing built assets into the Next.js site...')
rmSync(destinationDir, { recursive: true, force: true })
mkdirSync(dirname(destinationDir), { recursive: true })
cpSync(sourceDistDir, destinationDir, { recursive: true })

console.log(`SoCal EBUS course synced to ${destinationDir}`)
