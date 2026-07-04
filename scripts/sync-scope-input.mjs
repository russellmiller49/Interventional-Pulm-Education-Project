import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDir, '..')
const sourceDir = resolve(projectRoot, 'src/lib/scope-input/core')

const targets = [
  {
    name: 'Bronch Navigation Trainer',
    appDirCandidates: [
      resolve(projectRoot, '../navigation_module/web'),
      resolve(projectRoot, '../Navigation_module/web'),
    ],
    subPath: 'src/scope-input',
  },
  {
    name: 'SoCal EBUS course',
    appDirCandidates: [
      resolve(projectRoot, '../EBUS_course/apps/web'),
      resolve(projectRoot, '../EBUS-course/apps/web'),
    ],
    subPath: 'src/lib/scope-input',
  },
]

const banner = (fileName) =>
  [
    '// GENERATED FILE — do not edit.',
    `// Canonical source: Interventional-Pulm-Education-Project/src/lib/scope-input/core/${fileName}`,
    '// Regenerate with `npm run sync:scope-input` in the main site repo.',
    '',
    '',
  ].join('\n')

export function syncScopeInput() {
  const files = readdirSync(sourceDir).filter(
    (file) => file.endsWith('.ts') && !file.endsWith('.test.ts'),
  )
  if (files.length === 0) {
    throw new Error(`No scope-input core files found in ${sourceDir}`)
  }

  for (const target of targets) {
    const appDir = target.appDirCandidates.find((candidate) => existsSync(candidate))
    if (!appDir) {
      console.warn(`skip ${target.name}: app not found (checked ${target.appDirCandidates.join(', ')})`)
      continue
    }
    const destination = resolve(appDir, target.subPath)
    rmSync(destination, { recursive: true, force: true })
    mkdirSync(destination, { recursive: true })
    for (const file of files) {
      const contents = readFileSync(resolve(sourceDir, file), 'utf8')
      writeFileSync(resolve(destination, file), banner(file) + contents)
    }
    console.log(`scope-input core (${files.length} files) -> ${destination}`)
  }
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  syncScopeInput()
}
