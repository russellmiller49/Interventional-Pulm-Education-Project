// One bounded local rehearsal; every child/container belongs to this invocation.
// Never starts or resets the shared Supabase stack. Requires Docker and Chromium.
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
const children = []
const completed = new Map()
let stopping = false
function start(args, readyText) {
  const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  children.push(child)
  let ready
  let fail
  const readiness = new Promise((resolve, reject) => {
    ready = resolve
    fail = reject
  })
  const timer = readyText
    ? setTimeout(() => fail(new Error(`Startup timeout: ${args[0]}`)), 180000)
    : null
  for (const stream of [child.stdout, child.stderr])
    stream.on('data', (bytes) => {
      process.stdout.write(bytes)
      if (readyText && bytes.toString().includes(readyText)) {
        clearTimeout(timer)
        ready()
      }
    })
  completed.set(
    child,
    new Promise((resolve) =>
      child.on('exit', (code) => {
        clearTimeout(timer)
        fail(new Error(`Exited during startup: ${args[0]} (${code})`))
        resolve(code ?? 1)
      }),
    ),
  )
  child.on('error', fail)
  if (!readyText) ready()
  return { child, readiness }
}
async function stop() {
  if (stopping) return
  stopping = true
  for (const child of [...children].reverse()) {
    const active = () => child.exitCode === null && child.signalCode === null
    if (active()) child.kill('SIGTERM')
    let deadline
    await Promise.race([
      completed.get(child),
      new Promise((resolve) => {
        deadline = setTimeout(resolve, 5000)
      }),
    ])
    clearTimeout(deadline)
    // Only terminate a still-live child handle created by this invocation.
    // Failed browser shutdown must not leave the disposable database running.
    if (active()) child.kill('SIGKILL')
    await completed.get(child)
  }
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => void stop())
async function portFree(port) {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
  await new Promise((resolve) => server.close(resolve))
}
try {
  await portFree(54339)
  await portFree(3119)
  await start(['scripts/socrates/rehearsal.mjs', '--serve'], 'Synthetic browser fixture listening')
    .readiness
  if (process.argv.includes('--production') && !process.argv.includes('--skip-build')) {
    const build = start(['scripts/socrates/start-browser-app.mjs', '--build'])
    await build.readiness
    if (await completed.get(build.child)) throw new Error('Production build failed')
  }
  await start(
    [
      'scripts/socrates/start-browser-app.mjs',
      ...(process.argv.includes('--production') ? ['--production'] : []),
    ],
    'Ready in',
  ).readiness
  const test = start([
    'node_modules/@playwright/test/cli.js',
    'test',
    '--config',
    'playwright.socrates.config.ts',
  ])
  await test.readiness
  process.exitCode = await completed.get(test.child)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await stop()
}
