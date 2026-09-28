/**
 * Print the readable register pages from the registers the course reads.
 *
 *   npx tsx scripts/medical-thoracoscopy/render-registers.ts           write the pages
 *   npx tsx scripts/medical-thoracoscopy/render-registers.ts --check   fail if a page is stale
 *
 * The registers are JSON under `src/features/medical-thoracoscopy/content/data/`. They are
 * validated as they load, so a register that breaks its own rules stops this script before
 * anything is written. Run `npx prettier --write docs/medical-thoracoscopy/registers` afterwards.
 *
 * A `.ts` script on purpose: tsx runs it as CommonJS, which is what lets it load the module's
 * TypeScript and JSON.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import {
  normalisePage,
  REGISTER_PAGES,
} from '../../src/features/medical-thoracoscopy/test-support/renderRegisters'

function main(): number {
  const root = path.resolve(__dirname, '../..')
  const check = process.argv.includes('--check')
  let stale = 0

  for (const page of REGISTER_PAGES) {
    const file = path.join(root, page.path)
    const printed = page.render()

    if (check) {
      const current = existsSync(file) ? readFileSync(file, 'utf8') : ''
      if (normalisePage(current) === normalisePage(printed)) {
        console.log(`✓ ${page.path}`)
      } else {
        console.log(`✗ ${page.path} does not match its register`)
        stale += 1
      }
      continue
    }

    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, printed, 'utf8')
    console.log(`wrote ${page.path}`)
  }

  return stale === 0 ? 0 : 1
}

process.exit(main())
