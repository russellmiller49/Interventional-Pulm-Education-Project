/** Read-only CLI for the versioned non-governed evidence-manifest validator. */
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { loadAndValidateEvidenceManifest, NON_GOVERNED_WARNINGS } from './evidence-manifest'

async function main(): Promise<void> {
  const [manifestPath, ...extra] = process.argv.slice(2)
  if (!manifestPath || extra.length > 0) {
    throw new Error(
      'Usage: npx tsx scripts/ip-device-intelligence/production-readiness/validate-evidence-manifest.ts <manifest.json>',
    )
  }
  const manifest = await loadAndValidateEvidenceManifest(manifestPath)
  process.stdout.write(
    `${NON_GOVERNED_WARNINGS.join('\n')}\n\nVALID ${manifest.schemaVersion}: ${manifest.candidates.length} candidate record(s).\n`,
  )
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : ''
if (import.meta.url === invokedPath) {
  main().catch((error: unknown) => {
    process.stderr.write(`${(error as Error).message}\n`)
    process.exitCode = 1
  })
}
