import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { analyzeLegacyGoldImportCompensation } from '@/features/literature/gold-set/legacy-import-analysis'

import { assertKnownArguments, parseCliArguments, stringArgument } from './lib/cli'

const HELP = `
Read-only analysis of a checksum-bound legacy V2 gold-review import package.
It maps every planned insert to forward compensation, rejects pointer rewind, and never accesses a database.

Usage:
  npm run literature:analyze-pending-gold-import-compensation -- \\
    --row-plan <path> --row-plan-sha256 <sha256> \\
    --rollback-plan <path> --rollback-plan-sha256 <sha256> \\
    --validation <path> --validation-sha256 <sha256>
`.trim()

async function verifiedJsonText(path: string, expectedSha256: string) {
  if (!/^[0-9a-f]{64}$/u.test(expectedSha256)) throw new Error('Expected SHA-256 is invalid.')
  const bytes = await readFile(resolve(path))
  const actualSha256 = createHash('sha256').update(bytes).digest('hex')
  if (actualSha256 !== expectedSha256) {
    throw new Error(
      `Checksum mismatch for ${path}: expected ${expectedSha256}, received ${actualSha256}.`,
    )
  }
  return bytes.toString('utf8')
}

async function main() {
  const arguments_ = parseCliArguments(process.argv.slice(2))
  assertKnownArguments(arguments_, [
    'row-plan',
    'row-plan-sha256',
    'rollback-plan',
    'rollback-plan-sha256',
    'validation',
    'validation-sha256',
    'help',
  ])
  if (arguments_.flags.has('help')) {
    console.log(HELP)
    return
  }
  const required = (name: string) => {
    const value = stringArgument(arguments_, name)
    if (!value) throw new Error(`--${name} is required.`)
    return value
  }
  const rowPlanPath = required('row-plan')
  const rollbackPath = required('rollback-plan')
  const validationPath = required('validation')
  const rowPlanSha256 = required('row-plan-sha256')
  const rollbackPlanSha256 = required('rollback-plan-sha256')
  const validationSha256 = required('validation-sha256')

  const [planJson, rollbackJson, validationJson] = await Promise.all([
    verifiedJsonText(rowPlanPath, rowPlanSha256),
    verifiedJsonText(rollbackPath, rollbackPlanSha256),
    verifiedJsonText(validationPath, validationSha256),
  ])
  const report = analyzeLegacyGoldImportCompensation({
    planJson,
    rollbackJson,
    validationJson,
    rowPlanSha256,
    rollbackPlanSha256,
    validationSha256,
  })
  console.log(`${JSON.stringify(report, null, 2)}\n`)
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
