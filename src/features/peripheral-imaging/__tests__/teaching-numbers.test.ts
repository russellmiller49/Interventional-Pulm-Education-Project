/** @jest-environment node */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { teachingNumberErrors } from '../../learning-module/numbers/teachingNumbers'
import { FIXED_MOBILE_COMPARISON, TEAM_READINESS_ABSENT } from '../content/cbctReferences'
import { DOSE_NOTE_TEMPLATE_LINES, DOSE_QUANTITIES } from '../content/doseQuantities'
import { glossaryTerm } from '../content/glossary'
import { imagingMicroCaseById } from '../content/microCases'
import { PI_NUMBER_ONLY_SOURCES, PI_NUMBERS, piNumberCitation } from '../content/teachingNumbers'
import { LESSONS } from '../data/lessons'
import { QUESTIONS } from '../data/questions'
import { SOURCES } from '../data/sources'

/**
 * The module's numbers register, and the copy that reads from it.
 *
 * This replaces the tests that required hedge wording (docs/teaching-first-rules.md). A number may
 * be taught when it carries a class, a source that resolves, a locator and a check date; and the
 * copy that teaches it reads the value from the register rather than typing it.
 */

const FEATURE_ROOT = join(process.cwd(), 'src/features/peripheral-imaging')
const registerIds = new Set<string>(PI_NUMBERS.rows.map((row) => row.id))
const sourceIds = new Set<string>([
  ...SOURCES.map((source) => source.id),
  ...PI_NUMBER_ONLY_SOURCES.map((source) => source.id),
])

function sourceFiles(directory: string): string[] {
  return readdirSync(join(FEATURE_ROOT, directory), { withFileTypes: true }).flatMap((entry) => {
    const relative = `${directory}/${entry.name}`
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(relative)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [relative] : []
  })
}

const block = (sectionId: string, title: string) => {
  const found = LESSONS.find((lesson) => lesson.id === sectionId)?.blocks.find(
    (candidate) => candidate.title === title,
  )
  if (!found) throw new Error(`No block "${title}" in ${sectionId}`)
  return found
}

describe('the Peripheral Imaging numbers register', () => {
  it('traces every row to a registered source, a locator and a check date', () => {
    expect(teachingNumberErrors(PI_NUMBERS, sourceIds)).toEqual([])
    expect(PI_NUMBERS.rows.length).toBeGreaterThan(0)
  })

  it('gives every row a class, at least one source and an ISO check date', () => {
    for (const row of PI_NUMBERS.rows) {
      expect({
        id: row.id,
        hasClass: typeof row.class === 'string' && row.class.length > 0,
        sourced: row.sources.length > 0,
        located: row.sources.every((source) => source.locator.trim().length > 0),
        checkedOn: /^\d{4}-\d{2}-\d{2}$/.test(row.checkedOn),
        realDate: !Number.isNaN(Date.parse(row.checkedOn)),
        checkedBy: row.checkedBy.trim().length > 0,
      }).toEqual({
        id: row.id,
        hasClass: true,
        sourced: true,
        located: true,
        checkedOn: true,
        realDate: true,
        checkedBy: true,
      })
    }
  })

  it('keeps the number-only sources out of the main registry, so neither list shadows the other', () => {
    const registered = new Set<string>(SOURCES.map((source) => source.id))
    for (const source of PI_NUMBER_ONLY_SOURCES) {
      expect({ id: source.id, alsoRegistered: registered.has(source.id) }).toEqual({
        id: source.id,
        alsoRegistered: false,
      })
      expect(source.title.trim().length).toBeGreaterThan(0)
      expect(source.shortName.trim().length).toBeGreaterThan(0)
    }
    const ids = PI_NUMBER_ONLY_SOURCES.map((source) => source.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('resolves every reference-box id and every register lookup used in the module', () => {
    const used: { file: string; id: string }[] = []
    for (const file of [
      ...sourceFiles('components'),
      ...sourceFiles('content'),
      ...sourceFiles('data'),
    ]) {
      if (file === 'content/teachingNumbers.ts') continue
      const source = readFileSync(join(FEATURE_ROOT, file), 'utf8')
      for (const box of source.matchAll(/<ImagingReferenceValues\b[^>]*?\bids=\{\[([^\]]*)\]\}/g)) {
        for (const id of box[1].matchAll(/'([^']+)'/g)) used.push({ file, id: id[1] })
      }
      for (const call of source.matchAll(
        /(?:PI_NUMBERS\.(?:value|get)|piNumberCitation)\(\s*'([^']+)'/g,
      )) {
        used.push({ file, id: call[1] })
      }
      // `const n = PI_NUMBERS.value` is the content files' shorthand.
      if (/\bconst n = PI_NUMBERS\.value\b/.test(source)) {
        for (const call of source.matchAll(/\$\{n\('([^']+)'\)\}/g))
          used.push({ file, id: call[1] })
      }
    }
    // Not vacuous: the content and the components both read from the register.
    expect(used.filter((entry) => /^(content|data)\//.test(entry.file)).length).toBeGreaterThan(10)
    expect(used.filter((entry) => entry.file.startsWith('components/')).length).toBeGreaterThan(5)
    expect(used.filter((entry) => !registerIds.has(entry.id))).toEqual([])
  })

  it('says so in checkedBy when a row was read from an abstract only', () => {
    for (const id of [
      'confirm-dap',
      'vespa-atelectasis',
      'vespa-peep',
      'rebus-yield-by-position',
    ] as const) {
      const row = PI_NUMBERS.get(id)
      expect({ id, checkedBy: row.checkedBy }).toEqual({
        id,
        checkedBy: expect.stringMatching(/abstract only; the full text was not read/),
      })
      for (const source of row.sources) expect(source.locator).toMatch(/^Abstract/)
    }
  })

  it('attributes no kerma–area-product level to AAPM MPPG 12.a', () => {
    const aapm = PI_NUMBERS.rows.filter((row) =>
      row.sources.some((source) => source.sourceId === 'aapm12'),
    )
    expect(aapm.map((row) => row.id).sort()).toEqual([
      'aapm-first-notification',
      'aapm-substantial-dose',
    ])
    for (const row of aapm) {
      expect(`${row.label} ${row.value} ${row.appliesTo ?? ''}`).not.toMatch(
        /Gy·cm²|kerma–area|dose–area|\bKAP\b|\bDAP\b/i,
      )
    }
    // And every Gy·cm² value in the register comes from a study, not a guideline.
    for (const row of PI_NUMBERS.rows.filter((candidate) => /Gy·cm²/.test(candidate.value))) {
      expect({ id: row.id, class: row.class }).toEqual({ id: row.id, class: 'expert-reference' })
    }
    // The copy says the same thing where the KAP is taught.
    expect(DOSE_QUANTITIES.find((row) => row.id === 'kap')?.doesNot).toMatch(
      /AAPM MPPG 12\.a sets no action level in it/,
    )
    expect(
      block('dose-reporting', 'Respond to notifications through the dose-management program').body,
    ).toMatch(/The guideline gives no kerma–area-product level\./)
  })
})

describe('taught numbers render from the register', () => {
  it('puts the AAPM notification and substantial-dose levels in the dose copy', () => {
    const notification = PI_NUMBERS.value('aapm-first-notification')
    const substantial = PI_NUMBERS.value('aapm-substantial-dose')
    expect(notification).toMatch(/3 Gy.*1 Gy/)
    expect(substantial).toMatch(/5 Gy.*3 Gy/)
    expect(piNumberCitation('aapm-first-notification')).toBe('AAPM MPPG 12.a 2022, §5.3')
    expect(piNumberCitation('aapm-substantial-dose')).toBe('AAPM MPPG 12.a 2022, §5.4')

    const lesson = block(
      'dose-reporting',
      'Respond to notifications through the dose-management program',
    ).body
    expect(lesson).toContain(`Notifications during the procedure come ${notification}.`)
    expect(lesson).toContain(`The substantial radiation dose level is ${substantial}.`)

    const kerma = DOSE_QUANTITIES.find((row) => row.id === 'reference-air-kerma')!.tells
    expect(kerma).toContain(notification)
    expect(kerma).toContain(substantial)
    expect(DOSE_NOTE_TEMPLATE_LINES.join('\n')).toContain(`Dose notifications (${notification})`)
  })

  it('puts the published dose–area products in the dose section and the fixed/mobile comparison', () => {
    const published = block('dose-reporting', 'What published procedures have delivered').body
    const dose = FIXED_MOBILE_COMPARISON.find((row) => row.id === 'dose')!
    for (const id of [
      'mobile-cbct-total-dap',
      'mobile-cbct-spin-dap',
      'confirm-dap',
      'verhoeven-fluoroscopy-dap',
      'verhoeven-total-dap',
    ] as const) {
      const value = PI_NUMBERS.value(id)
      expect(value).toMatch(/\d.*Gy·cm²/)
      expect(published).toContain(value)
      expect(`${dose.fixed} ${dose.mobile}`).toContain(value)
    }
  })

  it('puts the VESPA protocol and effect in the CBCT-readiness copy, the lesson and the glossary', () => {
    const effect = PI_NUMBERS.value('vespa-atelectasis')
    const peep = PI_NUMBERS.value('vespa-peep')
    expect(effect).toMatch(/84\.2%.*28\.9%/)
    expect(peep).toMatch(/\d\s*cm H₂O/)
    expect(TEAM_READINESS_ABSENT).toContain(`PEEP of ${peep}`)
    expect(TEAM_READINESS_ABSENT).toContain(`any atelectasis was present in ${effect}`)
    expect(
      block('changing-anatomy', 'Treat atelectasis as anatomy, not an image-quality problem').body,
    ).toContain(`any atelectasis was present in ${effect}`)
    const definition = glossaryTerm('vespa').definition
    expect(definition).toContain(`PEEP of ${peep}`)
    expect(definition).toContain(effect)
  })

  it('puts the occupational limits in the staff-protection lesson', () => {
    const limits = block('staff-protection', 'Occupational dose limits').body
    expect(limits).toContain(PI_NUMBERS.value('icrp-effective-limit'))
    expect(limits).toContain(PI_NUMBERS.value('icrp-skin-extremity-limit'))
    // The lesson says the lens limit "is the same figure"; the register has to agree.
    expect(PI_NUMBERS.value('icrp-lens-limit')).toBe(PI_NUMBERS.value('icrp-effective-limit'))
    expect(limits).toMatch(/The limit for the lens of the eye is the same figure/)
  })
})

describe('the eccentric radial EBUS item teaches the next move with the hands', () => {
  const id = 'two-dimensional-practice-1'
  const question = QUESTIONS.find((candidate) => candidate.id === id)!
  const item = imagingMicroCaseById.get(id)!.item

  it('keeps its id and key letter, and the keyed option redirects the catheter', () => {
    expect(question.correct).toBe('b')
    const keyed = question.choices.find((choice) => choice.id === question.correct)!
    expect(keyed.text).toMatch(/redirect/i)
    expect(keyed.rationale).toMatch(/re-imaging until the tissue surrounds the probe/)
    expect(question.takeaway).toMatch(/Redirect the catheter/)
    // The item the learner meets is built from the same record.
    const best = item.choices.filter((choice) => choice.plausibility === 'best')
    expect(best.map((choice) => choice.label)).toEqual([keyed.text])
    expect(item.explanation).toBe(question.takeaway)
  })

  it('teaches the yield by probe position with the register’s figures', () => {
    const [within, adjacent] = PI_NUMBERS.value('rebus-yield-by-position').match(/\d+%/g) ?? []
    expect([within, adjacent]).toEqual(['84%', '48%'])
    const rationales = question.choices.map((choice) => choice.rationale).join(' ')
    expect(rationales).toContain(`${adjacent} with the probe adjacent to the lesion`)
    expect(rationales).toContain(`${within} with the probe within it`)
  })

  it('says nothing that gives the answer away: no "correct", "incorrect" or "wrong"', () => {
    const texts = [
      question.stem,
      question.takeaway,
      ...question.choices.flatMap((choice) => [choice.text, choice.rationale]),
      item.stem,
      item.explanation,
      ...item.choices.flatMap((choice) => [choice.label, choice.rationale]),
    ]
    for (const text of texts) expect(text).not.toMatch(/\b(correct|incorrect|wrong)\b/i)
  })
})
