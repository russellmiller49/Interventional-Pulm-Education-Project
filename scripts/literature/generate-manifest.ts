import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, resolve } from 'node:path'

import { literatureQueryRegistry } from '@/features/literature/config'
import {
  literatureImportManifestSchema,
  type LiteratureManifestFile,
} from '@/features/literature/schemas/config'

import { assertKnownArguments, hasFlag, parseCliArguments, stringArgument } from './lib/cli'
import { listNbibFiles, portablePath } from './lib/files'

const HELP = `
Generate a conservative NBIB provenance manifest.

Usage:
  npm run literature:manifest -- --directory <path> [--output <path>]

Options:
  --directory  Directory scanned recursively for .nbib files.
  --output     Proposed manifest path (default local-data/literature/import-manifest.json).
  --help       Show this help.

Only exact, unambiguous source/query IDs in filenames are mapped. Existing manifests are never
overwritten; a sibling ".proposed.json" file is written when the requested output already exists.
`.trim()

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

function exactIdentifierMatches(filename: string, identifiers: string[]) {
  const stem = basename(filename, extname(filename)).toLocaleLowerCase('en-US')
  return identifiers.filter((identifier) => {
    const normalized = identifier.toLocaleLowerCase('en-US')
    return new RegExp(`(?:^|[^a-z0-9])${escapeRegex(normalized)}(?:$|[^a-z0-9])`, 'u').test(stem)
  })
}

function inferEntry(filePath: string): LiteratureManifestFile {
  const journals = [
    ...literatureQueryRegistry.core_journals.map((journal) => ({
      ...journal,
      sourceKind: 'core_journal' as const,
    })),
    ...literatureQueryRegistry.optional_continuity_journals.map((journal) => ({
      ...journal,
      sourceKind: 'core_journal' as const,
    })),
    ...literatureQueryRegistry.expanded_journals.map((journal) => ({
      ...journal,
      sourceKind: 'expanded_journal' as const,
    })),
  ]
  const journalMatches = exactIdentifierMatches(
    filePath,
    journals.map((journal) => journal.id),
  )
  const queryMatches = exactIdentifierMatches(filePath, [
    ...Object.keys(literatureQueryRegistry.queries),
    ...literatureQueryRegistry.discovery_queries.map((query) => query.id),
  ])

  if (journalMatches.length === 1 && queryMatches.length === 0) {
    const journal = journals.find((candidate) => candidate.id === journalMatches[0])
    if (journal) {
      return {
        path: portablePath(filePath),
        source_kind: journal.sourceKind,
        source_id: journal.id,
        query_id: null,
        date_from: null,
        date_to: null,
        status: 'mapped',
        notes: 'Mapped from an exact, unambiguous journal source ID in the filename.',
      }
    }
  }

  if (queryMatches.length === 1 && journalMatches.length === 0) {
    return {
      path: portablePath(filePath),
      source_kind: 'all_pubmed_discovery',
      source_id: 'all_pubmed',
      query_id: queryMatches[0],
      date_from: null,
      date_to: null,
      status: 'mapped',
      notes: 'Mapped from an exact, unambiguous query ID in the filename.',
    }
  }

  return {
    path: portablePath(filePath),
    source_kind: 'unmapped',
    source_id: null,
    query_id: null,
    date_from: null,
    date_to: null,
    status: 'needs_mapping',
    notes:
      journalMatches.length + queryMatches.length > 1
        ? `Ambiguous exact IDs: ${[...journalMatches, ...queryMatches].join(', ')}`
        : 'Filename contains no exact known source/query ID. Do not infer from article content.',
  }
}

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
  assertKnownArguments(arguments_, ['directory', 'output', 'help'])
  if (hasFlag(arguments_, 'help')) {
    console.log(HELP)
    return
  }

  const directory = stringArgument(arguments_, 'directory', 'local-data/literature/nbib')
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
    files: files.map(inferEntry),
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
