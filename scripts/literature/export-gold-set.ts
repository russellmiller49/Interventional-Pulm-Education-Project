import { access, mkdir, writeFile } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'

import { serializeLiteratureGoldSetCsv } from '@/features/literature/gold-set/export'
import { exportLiteratureGoldSet } from '@/features/literature/server/gold-set'

import { assertKnownArguments, hasFlag, parseCliArguments, stringArgument } from './lib/cli'
import { createLiteratureReadClient, executeDatabaseCall } from './lib/database'

const HELP = `
Export a gold-set batch for backup or offline review.

Usage:
  npm run literature:export-gold-set -- --batch pilot-v1 --format csv --split all

Options:
  --batch <id-or-name>  Required batch UUID or name.
  --format <value>      json (default) or csv.
  --split <value>       development (default), test, or all.
  --include-history     Include every immutable review revision in JSON output.
  --output <path>       Output path; an existing file is never overwritten.
  --target <value>      local (default) or remote.
  --help                Show this help.
`.trim()

async function pathExists(path: string) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function main() {
  const arguments_ = parseCliArguments(process.argv.slice(2))
  assertKnownArguments(arguments_, [
    'batch',
    'format',
    'split',
    'include-history',
    'output',
    'target',
    'help',
  ])
  if (hasFlag(arguments_, 'help')) {
    console.log(HELP)
    return
  }

  const batchReference = stringArgument(arguments_, 'batch')
  if (!batchReference) throw new Error('--batch is required.')
  const format = stringArgument(arguments_, 'format', 'json')
  if (format !== 'json' && format !== 'csv') {
    throw new Error('--format must be json or csv.')
  }
  const split = stringArgument(arguments_, 'split', 'development')
  if (split !== 'development' && split !== 'test' && split !== 'all') {
    throw new Error('--split must be development, test, or all.')
  }

  const client = createLiteratureReadClient(arguments_)
  let query = client.from('literature_gold_set_batches').select('id,name').limit(2)
  query = /^[0-9a-f-]{36}$/iu.test(batchReference)
    ? query.eq('id', batchReference)
    : query.eq('name', batchReference)
  const batches = await executeDatabaseCall<Array<{ id: string; name: string }>>(
    'Gold-set batch lookup',
    () => query,
  )
  if (!batches?.[0]) throw new Error(`Gold-set batch not found: ${batchReference}`)

  const result = await exportLiteratureGoldSet(
    batches[0].id,
    split,
    hasFlag(arguments_, 'include-history'),
    client,
  )
  if (result.error) throw new Error(result.error)
  if (!result.data) throw new Error('Gold-set export returned no data.')

  const output = resolve(
    stringArgument(
      arguments_,
      'output',
      `local-data/literature/gold-sets/${batches[0].name}-${split}.${format}`,
    ),
  )
  if (await pathExists(output)) {
    throw new Error(`Refusing to overwrite existing export: ${output}`)
  }
  if (extname(output).toLocaleLowerCase('en-US') !== `.${format}`) {
    throw new Error(`--output must use the .${format} extension.`)
  }
  await mkdir(dirname(output), { recursive: true })
  await writeFile(
    output,
    format === 'csv'
      ? serializeLiteratureGoldSetCsv(result.data)
      : `${JSON.stringify(result.data, null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx' },
  )
  console.log(`Exported ${result.data.records.length} records to ${output}`)
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
