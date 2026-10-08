/**
 * Check authored Bronchoscopy Foundations sections against the authoring contract, and measure
 * them against the rewrite rules.
 *
 *   npx tsx scripts/bronchoscopy-foundations/check-section.ts right-side [bleeding-priorities …]
 *   npx tsx scripts/bronchoscopy-foundations/check-section.ts --all
 *   npx tsx scripts/bronchoscopy-foundations/check-section.ts --all --report
 *
 * Loads `src/features/bronchoscopy-foundations/content/sections/<id>.ts` (which must export
 * `section`) and prints every validation error. Exit code 1 when any section has an error.
 *
 * The rewrite rules (`content/authoringRules.ts`) are strict for a section marked
 * `authoringContract: 2`: breaking one is an error here. Every other section is measured by the
 * same rules and, with `--report`, its numbers are printed without failing the run, so the distance
 * left to cover is always visible.
 *
 * A `.ts` script on purpose: tsx runs it as CommonJS, which is what lets it load the project's
 * TypeScript modules and their `@/` imports.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'

import {
  imageItemCounts,
  measureSection,
  REWRITE_CAPS,
  rewriteRuleErrors,
  testWiseScore,
  type SectionMeasure,
} from '../../src/features/bronchoscopy-foundations/content/authoringRules'
import { COURSE_FLOWS } from '../../src/features/bronchoscopy-foundations/content/courseFlow'
import {
  NUMBER_REGISTER,
  unsignedNumberIds,
} from '../../src/features/bronchoscopy-foundations/content/numbers'
import { BRONCH_SECTION_IDS } from '../../src/features/bronchoscopy-foundations/content/sectionIds'
import { sectionNumberIds } from '../../src/features/bronchoscopy-foundations/content/sectionNumbers'
import {
  bronchSectionErrors,
  sectionItems,
  validateAllSections,
} from '../../src/features/bronchoscopy-foundations/content/sectionValidation'
import type { BronchSectionDefinition } from '../../src/features/bronchoscopy-foundations/content/types'

function measureLine(measure: SectionMeasure, rewritten: boolean): string {
  const longest = Math.max(0, ...measure.screens.map((screen) => screen.words))
  return [
    rewritten ? 'rewritten' : 'first contract',
    `${measure.teachingWords} teaching words (cap ${REWRITE_CAPS.sectionWords})`,
    `longest screen ${longest} (cap ${REWRITE_CAPS.screenWords})`,
    `${measure.sentenceAverage.toFixed(1)} words a sentence, longest ${measure.longestSentence}`,
    `${measure.statedMinutes} min stated, ${measure.computedMinutes.toFixed(1)} computed`,
    `attending/supervisor/faculty ×${measure.deferralMentions}`,
    measure.bannedTerms.length > 0 ? `says: ${measure.bannedTerms.join(', ')}` : 'no course-talk',
  ].join(' · ')
}

async function main(): Promise<number> {
  const root = path.resolve(__dirname, '../..')
  const args = process.argv.slice(2)
  const report = args.includes('--report')
  const named = args.filter((arg) => !arg.startsWith('--'))
  const ids = args.includes('--all') ? [...BRONCH_SECTION_IDS] : named
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
    const rewritten = section.authoringContract === 2
    const flow = COURSE_FLOWS[section.id] ?? []
    if (rewritten || report)
      console.log(`  ${measureLine(measureSection(section, flow), rewritten)}`)
    if (rewritten) {
      const used = sectionNumberIds(section)
      const unsigned = unsignedNumberIds(used)
      if (used.length > 0)
        console.log(
          `  numbers: ${used.map((numberId) => `${numberId} (row ${NUMBER_REGISTER[numberId].row})`).join(', ')}`,
        )
      if (unsigned.length > 0)
        console.log(`  waiting for the faculty signature: ${unsigned.join(', ')}`)
    } else if (report) {
      const gaps = rewriteRuleErrors(section, flow).length
      console.log(
        `  ${gaps} rewrite rule${gaps === 1 ? '' : 's'} not yet met (reported, not failed)`,
      )
    }
  }
  if (loaded.length > 1) {
    const setErrors = validateAllSections(loaded).filter(
      (error) => !loaded.some((section) => error.startsWith(`${section.id} `)),
    )
    for (const error of setErrors) console.log(`  set: ${error}`)
    if (setErrors.length > 0) failed = true
  }
  if (report && loaded.length > 1) {
    const measures = loaded.map((section) =>
      measureSection(section, COURSE_FLOWS[section.id] ?? []),
    )
    const total = (pick: (measure: SectionMeasure) => number) =>
      measures.reduce((sum, measure) => sum + pick(measure), 0)
    const counts = loaded.map(imageItemCounts)
    const image = counts.reduce((sum, count) => sum + count.image, 0)
    const questions = counts.reduce((sum, count) => sum + count.total, 0)
    const bank = loaded.flatMap((section) => [
      ...sectionItems(section),
      ...(section.act.kind === 'scenario' ? section.act.scenario.frames : []),
    ])
    console.log('')
    console.log(
      `${loaded.length} sections · ${loaded.filter((section) => section.authoringContract === 2).length} rewritten`,
    )
    console.log(
      `Learn words ${total((measure) => measure.learnWords)} · practice-case words ${total((measure) => measure.practiceWords)} · teaching words ${total((measure) => measure.teachingWords)}`,
    )
    console.log(
      `Minutes stated ${total((measure) => measure.statedMinutes)} · computed ${total((measure) => measure.computedMinutes).toFixed(0)} (activities timed only in rewritten sections)`,
    )
    console.log(
      `Questions that show an image: ${image} of ${questions} (target at least ${Math.round(REWRITE_CAPS.imageItemShare * 100)} in 100)`,
    )
    console.log(
      `Test-wise score: ${(testWiseScore(bank) * 100).toFixed(0)} in 100 over ${bank.length} questions (target at most ${REWRITE_CAPS.testWiseScore * 100})`,
    )
  }
  return failed ? 1 : 0
}

main().then((code) => process.exit(code))
