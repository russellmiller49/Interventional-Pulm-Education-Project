/** Check `content/capstone.ts` against the authoring contract: `npx tsx scripts/bronchoscopy-foundations/check-capstone.ts`. */
import { existsSync } from 'node:fs'
import path from 'node:path'

import { capstoneErrors } from '../../src/features/bronchoscopy-foundations/content/sectionValidation'
import type { AuthoredCapstoneCase } from '../../src/features/bronchoscopy-foundations/content/types'

async function main(): Promise<number> {
  const file = path.resolve(
    __dirname,
    '../../src/features/bronchoscopy-foundations/content/capstone.ts',
  )
  if (!existsSync(file)) {
    console.log('✗ capstone: no file at src/features/bronchoscopy-foundations/content/capstone.ts')
    return 1
  }
  const loaded = (await import(file)) as { CAPSTONE_CASES?: readonly AuthoredCapstoneCase[] }
  if (!loaded.CAPSTONE_CASES) {
    console.log('✗ capstone: the file does not export CAPSTONE_CASES')
    return 1
  }
  const errors = capstoneErrors(loaded.CAPSTONE_CASES)
  if (errors.length === 0) {
    console.log('✓ capstone')
    return 0
  }
  console.log(`✗ capstone: ${errors.length} problem${errors.length === 1 ? '' : 's'}`)
  for (const error of errors) console.log(`  - ${error}`)
  return 1
}

main().then((code) => process.exit(code))
