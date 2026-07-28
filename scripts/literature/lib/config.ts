import { readFile } from 'node:fs/promises'

import {
  literatureImportManifestSchema,
  type LiteratureImportManifest,
} from '@/features/literature/schemas/config'
import { literatureQueryRegistry } from '@/features/literature/config'

export async function readJsonFile(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown
}

export async function readLiteratureManifest(filePath: string): Promise<LiteratureImportManifest> {
  const manifest = literatureImportManifestSchema.parse(await readJsonFile(filePath))
  assertCurrentQueryRegistry(manifest)
  return manifest
}

export function assertCurrentQueryRegistry(manifest: LiteratureImportManifest) {
  if (manifest.query_registry_version !== literatureQueryRegistry.registry_version) {
    throw new Error(
      `Manifest query registry ${manifest.query_registry_version} does not match loaded registry ${literatureQueryRegistry.registry_version}.`,
    )
  }
}
