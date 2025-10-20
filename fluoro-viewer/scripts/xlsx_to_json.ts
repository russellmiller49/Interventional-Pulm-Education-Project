import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import xlsx from 'xlsx'

interface RadiusMap {
  [label: string]: {
    medianRadiusMm: number
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const dataDir = path.join(projectRoot, 'data')
const publicDir = path.join(projectRoot, 'public')

const INPUT_XLSX = path.join(dataDir, 'Labeled_centerline_table.xlsx')
const OUTPUT_JSON = path.join(publicDir, 'label_radius_map.json')

function median(values: number[]): number | undefined {
  if (!values.length) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

async function main() {
  const workbook = xlsx.readFile(INPUT_XLSX)
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  })

  const radiusByLabel = new Map<string, number[]>()

  for (const row of rows) {
    const label = row['AssignedLabel']
    const radius = row['Radius']
    if (typeof label !== 'string') continue
    const r = typeof radius === 'number' ? radius : Number(radius)
    if (Number.isFinite(r)) {
      if (!radiusByLabel.has(label)) {
        radiusByLabel.set(label, [])
      }
      radiusByLabel.get(label)!.push(r)
    }
  }

  const output: RadiusMap = {}
  for (const [label, values] of radiusByLabel) {
    const m = median(values)
    if (m !== undefined) {
      output[label] = { medianRadiusMm: Number(m.toFixed(4)) }
    }
  }

  await fs.mkdir(publicDir, { recursive: true })
  await fs.writeFile(OUTPUT_JSON, JSON.stringify(output, null, 2))

  const summary = [
    '✅ Labeled_centerline_table.xlsx',
    `  labels with radius: ${Object.keys(output).length}`,
    `  sample entry:`,
    ...Object.entries(output)
      .slice(0, 5)
      .map(([label, { medianRadiusMm }]) => `    ${label}: ${medianRadiusMm.toFixed(3)} mm`),
  ].join('\n')
  console.log(summary)
  console.log(`📝 wrote ${path.relative(projectRoot, OUTPUT_JSON)}`)
}

main().catch((err) => {
  console.error('xlsx_to_json failed:', err)
  process.exit(1)
})
