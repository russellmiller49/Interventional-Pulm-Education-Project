import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface StaticExposureSentinel {
  label: string
  value: string
}

export interface StaticExposureMatch {
  file: string
  sentinel: string
}

export interface StaticExposureScan {
  filesScanned: number
  matches: StaticExposureMatch[]
}

/**
 * These values identify the private intake payload rather than ordinary catalog fields. Product
 * names, catalog numbers, and governed source citations may be rendered by the public Atlas and
 * therefore are deliberately not treated as leaks.
 */
export const BROCHURE_INTAKE_STATIC_SENTINELS: StaticExposureSentinel[] = [
  { label: 'local absolute-path prefix', value: '/Users/' },
  { label: 'external research-root basename', value: 'product-brochure-intake-20260819' },
  {
    label: 'raw CSV header',
    value: 'Product ID,Product Name,Manufacturer,Source File',
  },
  {
    label: 'raw first product row',
    value:
      'Not stated in source,Micro-Tech Tracheal Stent System (Y-Shaped),Micro-Tech USA / Micro-Tech Endoscopy,1-0023806-0-Tracheal-Stent-System-Y-shaped-IFU.pdf',
  },
  {
    label: 'raw brochure prose',
    value: 'Instrument Set for Neonates for Endoscopic Treatment of Tracheo-Esophageal Fistulae',
  },
  {
    label: 'reviewed intake dataset filename',
    value: 'brochure-intake-additions-2026-08-19.json',
  },
  { label: 'row-level review artifact filename', value: 'row-reconciliation.csv' },
]

function listFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(root, entry.name)
    return entry.isDirectory() ? listFiles(filename) : [filename]
  })
}

function encodedForms(value: string): string[] {
  return [...new Set([value, JSON.stringify(value).slice(1, -1), encodeURIComponent(value)])]
}

export function scanStaticOutput(
  staticRoot: string,
  sentinels: StaticExposureSentinel[] = BROCHURE_INTAKE_STATIC_SENTINELS,
): StaticExposureScan {
  if (!existsSync(staticRoot) || !statSync(staticRoot).isDirectory()) {
    throw new Error(`Static output directory does not exist: ${staticRoot}`)
  }

  const files = listFiles(staticRoot)
  const matches: StaticExposureMatch[] = []
  for (const filename of files) {
    const contents = readFileSync(filename).toString('utf8')
    for (const sentinel of sentinels) {
      if (encodedForms(sentinel.value).some((candidate) => contents.includes(candidate))) {
        matches.push({
          file: path.relative(staticRoot, filename),
          sentinel: sentinel.label,
        })
      }
    }
  }

  return { filesScanned: files.length, matches }
}

function main(): void {
  const staticRoot = path.resolve(process.argv[2] ?? '.next/static')
  const result = scanStaticOutput(staticRoot)
  if (result.matches.length > 0) {
    const detail = result.matches.map((match) => `${match.file}: ${match.sentinel}`).join('\n')
    throw new Error(
      `Brochure intake data appeared in client static output (${result.matches.length} match(es)):\n${detail}`,
    )
  }
  console.log(
    `Brochure static-output exposure scan: 0 matches across ${result.filesScanned} client file(s).`,
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
