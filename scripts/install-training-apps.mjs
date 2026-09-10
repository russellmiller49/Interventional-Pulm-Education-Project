import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Keep each app's tested dependency versions and lockfile independent of Next.js.
for (const app of ['navigation_module/web', 'EBUS-course', 'EBUS-course/apps/web']) {
  console.log(`Installing ${app}...`)
  execFileSync('npm', ['ci', '--include=dev', '--no-audit', '--no-fund'], {
    cwd: resolve(root, app),
    stdio: 'inherit',
  })
}
