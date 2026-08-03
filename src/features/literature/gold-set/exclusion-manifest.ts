import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'

const PMID_PATTERN = /^[0-9]{1,12}$/u

export interface LiteratureGoldPmidExclusionManifest {
  path: string
  sha256: string
  pmids: string[]
}

function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

export function parseLiteratureGoldPmidExclusionManifest(input: string, path: string) {
  let values: unknown
  if (extname(path).toLocaleLowerCase('en-US') === '.json') {
    try {
      values = JSON.parse(input) as unknown
    } catch {
      throw new Error(`Exclusion PMID manifest is not valid JSON: ${resolve(path)}`)
    }
  } else {
    values = input.split(/[\s,;]+/u).filter(Boolean)
  }

  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('The exclusion PMID manifest must contain at least one PMID string.')
  }

  const pmids: string[] = []
  const seen = new Set<string>()
  values.forEach((value, index) => {
    if (typeof value !== 'string' || !PMID_PATTERN.test(value)) {
      throw new Error(
        `Exclusion PMID manifest entry ${index + 1} must be a numeric PMID string containing 1-12 digits.`,
      )
    }
    if (seen.has(value)) {
      throw new Error(`Exclusion PMID manifest contains duplicate PMID ${value}.`)
    }
    seen.add(value)
    pmids.push(value)
  })

  return pmids
}

export async function loadLiteratureGoldPmidExclusionManifest(
  path: string,
): Promise<LiteratureGoldPmidExclusionManifest> {
  const absolutePath = resolve(path)
  const input = await readFile(absolutePath)
  return {
    path: absolutePath,
    sha256: sha256(input),
    pmids: parseLiteratureGoldPmidExclusionManifest(input.toString('utf8'), absolutePath),
  }
}

export async function assertLiteratureGoldPmidExclusionManifestUnchanged(
  manifest: LiteratureGoldPmidExclusionManifest,
) {
  const currentSha256 = sha256(await readFile(manifest.path))
  if (currentSha256 !== manifest.sha256) {
    throw new Error(
      `Exclusion PMID manifest checksum changed during sampling: expected ${manifest.sha256}, received ${currentSha256}.`,
    )
  }
}
