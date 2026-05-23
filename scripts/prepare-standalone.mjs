import { cp, rm, stat } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const nextDir = path.join(root, '.next')
const standaloneDir = path.join(nextDir, 'standalone')
const publicDir = path.join(root, 'public')

const copiedPublicDir = path.join(standaloneDir, 'public')
const copiedStaticDir = path.join(standaloneDir, '.next', 'static')

const remoteAssetPrefixes = [
  'bronch-navigation-trainer/app/cases',
  'fluoroview/cases',
  'models',
  'socal-ebus-course/app/media',
  'socal-ebus-course/app/pipelines',
  'socal-ebus-course/app/simulator',
]

const remoteAssetFiles = new Set([
  'fluoroview/airway_full.glb',
  'fluoroview/airway_segments.glb',
  'fluoroview/airway_segments_new.glb',
  'fluoroview/bronch_animation.glb',
])

const embeddedShellAssetExtensions = new Set(['.css', '.html', '.js'])

async function exists(pathname) {
  try {
    await stat(pathname)
    return true
  } catch {
    return false
  }
}

function toPublicRelativePath(source) {
  return path.relative(publicDir, source).split(path.sep).join('/')
}

function shouldCopyPublicAsset(source) {
  const relativePath = toPublicRelativePath(source)

  if (!relativePath || relativePath.startsWith('..')) {
    return true
  }

  if (relativePath.endsWith('.DS_Store')) {
    return false
  }

  if (remoteAssetFiles.has(relativePath)) {
    return false
  }

  if (
    remoteAssetPrefixes.some(
      (prefix) => relativePath === prefix || relativePath.startsWith(`${prefix}/`),
    )
  ) {
    return false
  }

  if (
    relativePath.startsWith('socal-ebus-course/app/assets/') ||
    relativePath.startsWith('bronch-navigation-trainer/app/assets/')
  ) {
    return embeddedShellAssetExtensions.has(path.extname(relativePath))
  }

  return true
}

async function main() {
  if (!(await exists(standaloneDir))) {
    console.log('No .next/standalone directory found; skipping standalone asset preparation.')
    return
  }

  await rm(copiedStaticDir, { force: true, recursive: true })
  await cp(path.join(nextDir, 'static'), copiedStaticDir, { recursive: true })

  await rm(copiedPublicDir, { force: true, recursive: true })
  await cp(publicDir, copiedPublicDir, {
    recursive: true,
    filter: shouldCopyPublicAsset,
  })

  console.log('Prepared standalone output with static files and trimmed public assets.')
}

await main()
