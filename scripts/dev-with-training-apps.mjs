import { spawn } from 'node:child_process'
import { watch } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const children = new Set()
const watchers = []
const timers = new Map()
const pending = new Set()
let rebuilding = false
let stopping = false

function run(command, args) {
  if (stopping) return Promise.resolve()
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
  })
  children.add(child)
  return new Promise((resolve, reject) => {
    child.on('error', (error) => {
      children.delete(child)
      reject(error)
    })
    child.on('exit', (code, signal) => {
      children.delete(child)
      if (code === 0 || stopping) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code ?? signal}`))
    })
  })
}

function stop(code) {
  if (stopping) return
  stopping = true
  for (const watcher of watchers) watcher.close()
  for (const timer of timers.values()) clearTimeout(timer)
  for (const child of children) {
    try {
      if (process.platform === 'win32') child.kill('SIGTERM')
      else process.kill(-child.pid, 'SIGTERM')
    } catch (error) {
      if (error.code !== 'ESRCH') throw error
    }
  }
  process.exitCode = code
}

async function rebuild() {
  if (rebuilding || stopping) return
  rebuilding = true
  try {
    while (pending.size && !stopping) {
      const [app] = pending
      pending.delete(app)
      try {
        await run(process.execPath, [`scripts/build-${app}.mjs`])
        console.log(`${app} rebuilt. Reload its iframe to see the update.`)
      } catch (error) {
        console.error(error.message)
      }
    }
  } finally {
    rebuilding = false
  }
}

function schedule(app) {
  clearTimeout(timers.get(app))
  timers.set(
    app,
    setTimeout(() => {
      timers.delete(app)
      pending.add(app)
      void rebuild()
    }, 300),
  )
}

const apps = ['bronch-navigation-trainer', 'socal-ebus-course']
const ignored = new Set([
  'node_modules',
  'dist',
  '.git',
  '.venv',
  '__pycache__',
  '.pytest_cache',
  'outputs',
  'tmp',
  'annotations',
  'external_repos',
  '.DS_Store',
])

process.on('SIGINT', () => stop(130))
process.on('SIGTERM', () => stop(143))

try {
  // The main dev server always starts with current embedded bundles.
  for (const app of apps) await run(process.execPath, [`scripts/build-${app}.mjs`])
  for (const [directory, targets] of [
    ['navigation_module/web', [apps[0]]],
    ['EBUS-course', [apps[1]]],
    ['src/lib/scope-input/core', apps],
  ]) {
    if (stopping) break
    watchers.push(
      watch(resolve(root, directory), { recursive: true }, (_, filename) => {
        if (!filename || filename.split(/[/\\]/).some((part) => ignored.has(part))) return
        if (filename.endsWith('.tsbuildinfo')) return
        for (const app of targets) schedule(app)
      }),
    )
  }
  await run(process.execPath, [
    'node_modules/next/dist/bin/next',
    'dev',
    '--webpack',
    ...process.argv.slice(2),
  ])
  stop(0)
} catch (error) {
  console.error(error.message)
  stop(1)
}
