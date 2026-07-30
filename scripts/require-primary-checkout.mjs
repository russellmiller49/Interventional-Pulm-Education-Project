#!/usr/bin/env node
// Guard for commands that mutate shared local state (the single local Supabase
// instance, asset uploads). They must run from the primary checkout, never from
// an agent worktree. In the primary checkout, git-dir === git-common-dir.
import { execSync, spawnSync } from 'node:child_process'

const gitDir = execSync('git rev-parse --absolute-git-dir', { encoding: 'utf8' }).trim()
const commonDir = execSync('git rev-parse --path-format=absolute --git-common-dir', {
  encoding: 'utf8',
}).trim()
if (gitDir !== commonDir) {
  console.error(
    'Blocked: this command mutates shared local state (Supabase/uploads).\n' +
      'Run it from the primary checkout (Interventional-Pulm-Education-Project), not an agent worktree.',
  )
  process.exit(1)
}

const separator = process.argv.indexOf('--')
const [command, ...args] = process.argv.slice(separator + 1)
const result = spawnSync(command, args, { stdio: 'inherit' })
process.exit(result.status ?? 1)
