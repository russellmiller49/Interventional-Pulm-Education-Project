import { resolve } from 'node:path'

import { literatureQueryRegistry } from '@/features/literature/config'
import type { LiteratureManifestFile } from '@/features/literature/schemas/config'

import type { ParsedCliArguments } from './cli'
import { stringArgument } from './cli'
import { readLiteratureManifest } from './config'
import { listNbibFiles, portablePath } from './files'

function unmappedEntry(path: string): LiteratureManifestFile {
  return {
    path: portablePath(path),
    source_kind: 'unmapped',
    source_id: null,
    query_id: null,
    date_from: null,
    date_to: null,
    status: 'needs_mapping',
    notes: 'Generated without an explicit provenance mapping.',
  }
}

export interface LiteratureInputContext {
  entries: LiteratureManifestFile[]
  manifestVersion: string
  queryRegistryVersion: string
}

export async function resolveInputContext(
  arguments_: ParsedCliArguments,
): Promise<LiteratureInputContext> {
  const manifestPath = stringArgument(arguments_, 'manifest')
  const filePath = stringArgument(arguments_, 'file')
  const directoryPath = stringArgument(arguments_, 'directory')
  const explicitInputs = [manifestPath, filePath, directoryPath].filter(Boolean)

  if (explicitInputs.length > 1) {
    throw new Error('Use only one of --manifest, --file, or --directory.')
  }

  if (filePath) {
    return {
      entries: [unmappedEntry(resolve(filePath))],
      manifestVersion: 'ad-hoc-v1',
      queryRegistryVersion: literatureQueryRegistry.registry_version,
    }
  }

  if (directoryPath) {
    return {
      entries: (await listNbibFiles(directoryPath)).map(unmappedEntry),
      manifestVersion: 'ad-hoc-v1',
      queryRegistryVersion: literatureQueryRegistry.registry_version,
    }
  }

  const selectedManifest = manifestPath ?? 'local-data/literature/import-manifest.json'
  const manifest = await readLiteratureManifest(resolve(selectedManifest))
  return {
    entries: manifest.files,
    manifestVersion: manifest.manifest_version,
    queryRegistryVersion: manifest.query_registry_version,
  }
}

export async function resolveInputEntries(arguments_: ParsedCliArguments) {
  return (await resolveInputContext(arguments_)).entries
}
