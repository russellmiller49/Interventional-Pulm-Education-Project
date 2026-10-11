/**
 * The owner's sign-off list: every teaching number no one has signed yet.
 *
 *   npm run numbers:signoff            every module
 *   npm run numbers:signoff -- <id>    one module, by its register's moduleId
 *
 * A row on this list is already teaching. Signing it is a one-line edit to the row's `signedBy`
 * and `signedOn`; rejecting it is a correction or a deletion. See `docs/teaching-first-rules.md`.
 */
import { readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  unsignedTeachingNumbers,
  type TeachingNumberRegister,
} from '../src/features/learning-module/numbers/teachingNumbers'

type Register = Pick<TeachingNumberRegister, 'moduleId' | 'rows'>

const featuresDir = path.join(process.cwd(), 'src/features')
const only = process.argv[2]

function isRegister(value: unknown): value is Register {
  return (
    typeof value === 'object' &&
    value !== null &&
    'moduleId' in value &&
    'rows' in value &&
    Array.isArray((value as { rows: unknown }).rows)
  )
}

async function main(): Promise<void> {
  let total = 0
  let unsigned = 0
  for (const feature of readdirSync(featuresDir).sort()) {
    const file = path.join(featuresDir, feature, 'content/teachingNumbers.ts')
    if (!existsSync(file)) continue
    const exports: Record<string, unknown> = await import(pathToFileURL(file).href)
    for (const register of Object.values(exports).filter(isRegister)) {
      if (only && register.moduleId !== only) continue
      const waiting = unsignedTeachingNumbers(register)
      total += register.rows.length
      unsigned += waiting.length
      console.log(`\n${register.moduleId}: ${waiting.length} of ${register.rows.length} unsigned`)
      for (const row of waiting) {
        const sources = row.sources
          .map((s) => `${s.sourceId} ${s.year}${s.grade ? ` [${s.grade}]` : ''} ${s.locator}`)
          .join('; ')
        console.log(`  ${row.id}\n    ${row.label}: ${row.value}`)
        console.log(`    ${row.class} · ${sources || 'no source (teaching convention)'}`)
        console.log(`    checked ${row.checkedOn} by ${row.checkedBy}`)
        if (row.note) console.log(`    note: ${row.note}`)
      }
    }
  }
  console.log(`\n${unsigned} of ${total} teaching numbers await the owner's signature.`)
}

void main()
