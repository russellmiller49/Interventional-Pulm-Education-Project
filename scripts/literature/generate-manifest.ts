import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { literatureQueryRegistry } from '@/features/literature/config'
import { literatureImportManifestSchema } from '@/features/literature/schemas/config'

import { assertKnownArguments, hasFlag, parseCliArguments, stringArgument } from './lib/cli'
import { listNbibFiles } from './lib/files'
import { inferLiteratureManifestEntry } from './lib/manifest'

const HELP = `
Generate a conservative NBIB provenance manifest.

Usage:
  npm run literature:manifest -- --directory <path> [--output <path>]
  npm run literature:manifest -- --corpus-root <path> [--output <path>]

Options:
  --directory  Directory scanned recursively for .nbib files.
  --corpus-root
               Corpus root containing the supplied Full Journals, Expanded-journal,
               and All-PubMed discovery folders. Those folder names provide explicit
               source-tier provenance.
  --output     Proposed manifest path (default local-data/literature/import-manifest.json).
  --help       Show this help.

Only exact, unambiguous source/query IDs in filenames are mapped. Existing manifests are never
overwritten; a sibling ".proposed.json" file is written when the requested output already exists.
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
  assertKnownArguments(arguments_, ['directory', 'corpus-root', 'output', 'help'])
  if (hasFlag(arguments_, 'help')) {
    console.log(HELP)
    return
  }

  const explicitDirectory = stringArgument(arguments_, 'directory')
  const explicitCorpusRoot = stringArgument(arguments_, 'corpus-root')
  if (explicitDirectory && explicitCorpusRoot) {
    throw new Error('Choose either --directory or --corpus-root, not both.')
  }
  const directory = resolve(explicitCorpusRoot ?? explicitDirectory ?? 'local-data/literature/nbib')
  const requestedOutput = resolve(
    stringArgument(arguments_, 'output', 'local-data/literature/import-manifest.json'),
  )
  const files = await listNbibFiles(directory)
  if (files.length === 0) {
    throw new Error(`No .nbib files found under ${resolve(directory)}.`)
  }

  const manifest = literatureImportManifestSchema.parse({
    manifest_version: '1.0.0',
    query_registry_version: literatureQueryRegistry.registry_version,
    notes:
      'Generated conservatively. Review every needs_mapping entry before treating provenance as known.',
    files: files.map((file) =>
      inferLiteratureManifestEntry(file, explicitCorpusRoot ? directory : undefined),
    ),
  })

  let output = requestedOutput
  if (await pathExists(requestedOutput)) {
    const existing = JSON.parse(await readFile(requestedOutput, 'utf8')) as unknown
    literatureImportManifestSchema.parse(existing)
    output = requestedOutput.replace(/\.json$/u, '.proposed.json')
    if (await pathExists(output)) {
      throw new Error(
        `Both ${requestedOutput} and ${output} already exist; no file was overwritten.`,
      )
    }
  }

  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  })

  const mapped = manifest.files.filter((entry) => entry.status === 'mapped').length
  console.log(`Manifest: ${output}`)
  console.log(`Files: ${manifest.files.length}`)
  console.log(`Mapped exactly: ${mapped}`)
  console.log(`Needs mapping: ${manifest.files.length - mapped}`)
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
