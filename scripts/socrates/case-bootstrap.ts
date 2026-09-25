#!/usr/bin/env -S npx tsx
import { readFileSync, mkdirSync, chmodSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { batchRecords, createBootstrapPlan, generateDraft } from './bootstrap-plan'
import { inspectWorkbook, privateDestination, privateOutput, readProvider } from './bootstrap-io'
import { INVENIO_DEMO_ORIGIN } from '../../src/features/socrates-builder/invenio-source'
import { digest, type Snapshot } from './import-plan'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
async function main() {
  const [command, ...args] = process.argv.slice(2)
  if (!['inspect', 'plan', 'package'].includes(command))
    throw new Error('Expected inspect, plan or package.')
  const options = new Map<string, string>()
  for (let i = 0; i < args.length; i += 2) {
    if (
      !['--workbook', '--output', '--snapshot', '--python'].includes(args[i]) ||
      !args[i + 1] ||
      args[i + 1].startsWith('--') ||
      options.has(args[i])
    )
      throw new Error('Invalid or duplicate option.')
    options.set(args[i], args[i + 1])
  }
  const workbook = options.get('--workbook'),
    output = options.get('--output')
  if (!workbook || !output) throw new Error('Required: --workbook and --output.')
  const inspection = inspectWorkbook(workbook, root, options.get('--python'))
  const snapshotBytes = options.has('--snapshot')
    ? readFileSync(options.get('--snapshot')!, 'utf8')
    : null
  const snapshot: Snapshot | undefined = snapshotBytes ? JSON.parse(snapshotBytes) : undefined
  const catalog = JSON.parse(await readProvider(`${INVENIO_DEMO_ORIGIN}/generated/catalog.json`))
  const plan = {
    ...(await createBootstrapPlan(inspection, catalog, readProvider, snapshot)),
    checkedAt: new Date().toISOString(),
    catalogDigest: digest(catalog),
    snapshotDigest: snapshot ? digest(snapshot) : null,
  }
  let packages = 0
  if (command === 'package') {
    // A new run gets a new directory. Never overwrite prior packages or an owner's edits.
    // Check the parent before creating anything, including when it is a symlink into a checkout.
    privateDestination(output)
    mkdirSync(output, { mode: 0o700 })
    chmodSync(output, 0o700)
    const records = batchRecords(inspection)
    const manifest = []
    for (const row of plan.rows) {
      if (row.classification !== 'new-candidate') continue
      const document = generateDraft(records[row.sourceOrder - 1], row)
      const filename = `${document.slug}_PRIVATE.json`
      privateOutput(path.join(output, filename), document)
      manifest.push({
        sourceKey: row.sourceKey,
        filename,
        digest: digest(document),
        creationHolds: row.creationHolds,
      })
      packages++
    }
    privateOutput(path.join(output, 'plan_PRIVATE.json'), plan)
    privateOutput(path.join(output, 'manifest_PRIVATE.json'), {
      format: 'socrates-bootstrap-packages-v1',
      canApply: false,
      warning:
        'Offline author-review candidates only. Reconcile a fresh authenticated snapshot before any separately authorized save. Case packages do not approve membership or clinical readiness.',
      packages: manifest,
    })
  } else privateOutput(output, plan)
  // Deliberately no learner text, author notes, source labels, UUIDs or barcodes in stdout/errors.
  console.log(
    JSON.stringify({
      command,
      sourceEntries: 59,
      moduleCounts: [20, 5, 8, 14, 6, 6],
      batchRows: plan.rows.length,
      counts: Object.fromEntries(
        ['existing-exact', 'new-candidate', 'ambiguous', 'missing-image', 'conflict'].map((c) => [
          c,
          plan.rows.filter((r) => r.classification === c).length,
        ]),
      ),
      snapshotProvided: plan.snapshotProvided,
      packages,
      canApply: false,
    }),
  )
}
main().catch(() => {
  console.error(
    'SOCRATES bootstrap failed. Check source hash/structure, options, private paths and provider access. No database changes were made. A partial package directory, if present, is not a completed run without its manifest.',
  )
  process.exitCode = 1
})
