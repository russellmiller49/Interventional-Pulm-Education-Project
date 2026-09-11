/**
 * Check one or more authored Bronchoscopy Foundations sections against the authoring contract.
 *
 *   npx tsx scripts/bronchoscopy-foundations/check-section.ts shared-airway [five-controls …]
 *   npx tsx scripts/bronchoscopy-foundations/check-section.ts --all
 *
 * Loads `src/features/bronchoscopy-foundations/content/sections/<id>.ts` (which must export
 * `section`) and prints every validation error. Exit code 1 when any section has an error.
 * A `.ts` script on purpose: tsx runs it as CommonJS, which is what lets it load the project's
 * TypeScript modules and their `@/` imports.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'

import { BRONCH_SECTION_IDS } from '../../src/features/bronchoscopy-foundations/content/sectionIds'
import {
  bronchSectionErrors,
  validateAllSections,
} from '../../src/features/bronchoscopy-foundations/content/sectionValidation'
import type { BronchSectionDefinition } from '../../src/features/bronchoscopy-foundations/content/types'

async function main(): Promise<number> {
  const root = path.resolve(__dirname, '../..')
  const args = process.argv.slice(2)
  const ids = args.includes('--all') ? [...BRONCH_SECTION_IDS] : args
  if (ids.length === 0) {
    console.error('Name at least one section id, or pass --all.')
    return 2
  }
  let failed = false
  const loaded: BronchSectionDefinition[] = []
  for (const id of ids) {
    const file = path.join(
      root,
      'src/features/bronchoscopy-foundations/content/sections',
      `${id}.ts`,
    )
    if (!existsSync(file)) {
      console.log(`✗ ${id}: no file at ${path.relative(root, file)}`)
      failed = true
      continue
    }
    let loadedModule: { section?: BronchSectionDefinition }
    try {
      loadedModule = (await import(file)) as { section?: BronchSectionDefinition }
    } catch (error) {
      console.log(`✗ ${id}: the file does not load: ${(error as Error).message}`)
      failed = true
      continue
    }
    const section = loadedModule.section
    if (!section) {
      console.log(`✗ ${id}: the file does not export \`section\``)
      failed = true
      continue
    }
    loaded.push(section)
    const errors = bronchSectionErrors(section)
    if (errors.length === 0) console.log(`✓ ${id}`)
    else {
      failed = true
      console.log(`✗ ${id}: ${errors.length} problem${errors.length === 1 ? '' : 's'}`)
      for (const error of errors) console.log(`  - ${error}`)
    }
  }
  if (loaded.length > 1) {
    const setErrors = validateAllSections(loaded).filter(
      (error) => !loaded.some((section) => error.startsWith(`${section.id} `)),
    )
    for (const error of setErrors) console.log(`  set: ${error}`)
    if (setErrors.length > 0) failed = true
  }
  return failed ? 1 : 0
}

main().then((code) => process.exit(code))
