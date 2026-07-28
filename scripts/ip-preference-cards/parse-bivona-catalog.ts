import { execFileSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Parses the ICU Medical Bivona tracheostomy tube catalog into a reviewable seed file.
 *
 * The catalog publishes clean ordering tables — product code, tube size, I.D., O.D.,
 * length, angle, cuff resting diameter — under section headings that state whether the
 * family is cuffed, cuffless, or fenestrated. Tube dimensions are clinically consequential,
 * so they are transcribed here rather than inferred, and the output is committed so the
 * values can be diffed and reviewed.
 *
 *   npx tsx scripts/ip-preference-cards/parse-bivona-catalog.ts <catalog.pdf>
 */

const SEED_DIRECTORY = 'data/ip-preference-cards/seed'

export interface BivonaTube {
  productCode: string
  family: string
  population: 'Adult' | 'Pediatric' | 'Neonatal'
  cuffType: 'cuffed' | 'cuffless'
  /** Tight-to-shaft cuff, which sits flush with the shaft when deflated. */
  tts: boolean
  fenestrated: boolean
  tubeSizeMm: number
  innerDiameterMm: number
  outerDiameterMm: number
  tubeLengthMm: number
  tubeAngleDegrees: number | null
  cuffRestingDiameterMm: number | null
}

/** "Bivona TTS Adult Tracheostomy Tubes (Cuffed)" → structured family attributes. */
function classifySection(heading: string) {
  const text = heading.replace(/\s+/g, ' ').trim()
  const population: BivonaTube['population'] = /neonatal/i.test(text)
    ? 'Neonatal'
    : /p(a)?ediatric/i.test(text)
      ? 'Pediatric'
      : 'Adult'
  // Family names carry the cuff, not just the word "cuffed": Fome-Cuf is a foam cuff and
  // Aire-Cuf an air cuff, so matching only /cuffed/ would mislabel them as cuffless.
  const explicitlyCuffless = /cuffless|uncuffed/i.test(text)
  const cuffed = !explicitlyCuffless && /cuffed|[-\s]cuf\b|\bTTS\b/i.test(text)
  return {
    family: text,
    population,
    cuffType: (cuffed ? 'cuffed' : 'cuffless') as BivonaTube['cuffType'],
    tts: /\bTTS\b/i.test(text),
    fenestrated: /fenestrat/i.test(text),
  }
}

const SECTION_HEADING = /^\s*Bivona[^|]*Tracheostomy Tubes?.*$/i
// Cuffed families use six-digit codes (670150); cuffless families use alphanumerics
// (60A150). Angle and cuff resting diameter are "N/A" on cuffless tubes.
const TABLE_ROW =
  /^\s*([0-9][0-9A-Z]{5})\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s+(?:(\d+)°|N\/A))?(?:\s+(?:([\d.]+)|N\/A))?/

export function parseBivonaCatalog(text: string): BivonaTube[] {
  const tubes = new Map<string, BivonaTube>()
  let section = classifySection('Bivona Adult Tracheostomy Tubes')

  for (const line of text.split('\n')) {
    if (SECTION_HEADING.test(line)) {
      section = classifySection(line)
      continue
    }
    const match = TABLE_ROW.exec(line)
    if (!match) continue
    const [, productCode, size, innerDiameter, outerDiameter, length, angle, cuffDiameter] = match
    // The same code can repeat across page furniture; first occurrence wins.
    if (tubes.has(productCode)) continue
    tubes.set(productCode, {
      productCode,
      family: section.family,
      population: section.population,
      cuffType: section.cuffType,
      tts: section.tts,
      fenestrated: section.fenestrated,
      tubeSizeMm: Number(size),
      innerDiameterMm: Number(innerDiameter),
      outerDiameterMm: Number(outerDiameter),
      tubeLengthMm: Number(length),
      tubeAngleDegrees: angle ? Number(angle) : null,
      cuffRestingDiameterMm: cuffDiameter ? Number(cuffDiameter) : null,
    })
  }

  return [...tubes.values()].sort((left, right) =>
    left.productCode.localeCompare(right.productCode),
  )
}

async function main() {
  const pdfPath = process.argv[2]
  if (!pdfPath) throw new Error('Pass the Bivona catalog PDF path as the first argument.')
  const text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })

  const tubes = parseBivonaCatalog(text)
  await writeFile(
    path.join(SEED_DIRECTORY, 'bivona-catalog.json'),
    `${JSON.stringify({ format_version: '1.0', source_pdf: path.basename(pdfPath), tubes }, null, 2)}\n`,
    'utf8',
  )

  const byFamily = new Map<string, number>()
  for (const tube of tubes) byFamily.set(tube.family, (byFamily.get(tube.family) ?? 0) + 1)
  console.log(`Parsed ${tubes.length} Bivona tracheostomy tubes.`)
  for (const [family, count] of [...byFamily.entries()].sort()) {
    console.log(`  ${String(count).padStart(3)}  ${family}`)
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
