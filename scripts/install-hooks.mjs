#!/usr/bin/env node
// Installs git hooks via husky. Production installs (Railway/nixpacks) have no
// Git metadata, so hook installation is skipped there. A real husky failure in
// an actual Git checkout must still fail the install.
import { execSync } from 'node:child_process'

try {
  execSync('git rev-parse --git-dir', { stdio: 'ignore' })
} catch {
  process.exit(0) // no Git metadata (e.g. Railway build): nothing to install
}

const { default: husky } = await import('husky')
const output = husky()
if (output) {
  console.error(output)
  process.exit(1)
}
