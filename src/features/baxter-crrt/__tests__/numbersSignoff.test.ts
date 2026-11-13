import { CRRT_CITRATE_SCOPE_NOTICE } from '../content/citrateDifferential'
import { crrtPressureSignalDetails } from '../content/circuitModel'
import { baxterCrrtCases } from '../content/completeCases'
import { crrtFoundationTasks } from '../content/foundationLessons'
import { crrtGlossary } from '../content/glossary'
import { baxterCrrtLearnLessons } from '../content/learnLessons'
import { crrtOperationalTasks } from '../content/operationalLessons'
import { baxterCrrtRapidDrills } from '../content/rapidDrills'
import { CRRT_NUMBERS } from '../content/teachingNumbers'
import { crrtWorkedCaseExamples } from '../content/workedCaseExamples'

/**
 * The owner's register review of 2026-11-13.
 *
 * Russell Miller approved CRRT rows by name in writing: a list to sign after checking each against
 * its source, a list to correct and then sign, and a list to sign only if the source settled a named
 * question. Rows outside those lists were not reviewed and stay unsigned. These tests hold the set of
 * signed rows to exactly what was approved, and hold the learner copy to the corrected meaning of the
 * six rows whose wording changed.
 */

const SIGNED_ON_2026_11_13 = [
  // Approved subject to source and version checks.
  'dose-delivered',
  'tmp-alarm',
  'clotting-advisory',
  'access-low-limit',
  'return-high-limit',
  'filter-high-limit',
  'set-life',
  'gain-loss-window',
  'hyperkalemia-severe',
  'calcium-dose',
  'calcium-without-ecg',
  'insulin-glucose',
  'insulin-low-dose',
  'insulin-peak',
  'post-insulin-glucose-trigger',
  'post-insulin-glucose',
  'salbutamol-dose',
  'glucose-checks',
  'potassium-recheck',
  'alf-sodium-recommendation',
  'alf-sodium-icp',
  'blood-leak-normalization-floor',
  // Corrected, then signed.
  'dose-prescribed',
  'calcium-ratio',
  'return-disconnect-limit',
  'rebound-window',
  'insulin-repeat',
  'alf-sodium-rate',
  // Signed only because the source settled the question the owner named.
  'postfilter-ica',
  'postfilter-ica-ceiling',
] as const

/** Named by the owner for verification; the source did not settle the question. */
const HELD = [
  'systemic-ica',
  'citrate-monitoring',
  'blood-flow-range',
  'liberation-urine-output',
] as const

const row = (id: string) => CRRT_NUMBERS.rows.find((candidate) => candidate.id === id)!

describe('the 2026-11-13 signatures', () => {
  it('sign exactly the rows the owner approved, and no other', () => {
    const signed = CRRT_NUMBERS.rows.filter(({ signedBy }) => signedBy !== null).map(({ id }) => id)
    // The two filtration fraction ceilings are signed in their own pull request (#536).
    expect(signed.filter((id) => !id.startsWith('filtration-fraction-ceiling')).sort()).toEqual(
      [...SIGNED_ON_2026_11_13].sort(),
    )
  })

  it('say who signed and how, on the date it happened', () => {
    for (const id of SIGNED_ON_2026_11_13) {
      expect({ id, signedOn: row(id).signedOn }).toEqual({ id, signedOn: '2026-11-13' })
      // A written decision, with the sources checked by Claude: not a claim he re-read them.
      expect(row(id).signedBy).toBe(
        'Russell Miller, written decision of 2026-11-13 (sources checked by Claude)',
      )
      expect(row(id).checkedOn).toBe('2026-11-13')
    }
  })

  it('leave every signed row with a source, a year and a locator', () => {
    for (const id of SIGNED_ON_2026_11_13) {
      expect(row(id).sources.length).toBeGreaterThan(0)
      for (const citation of row(id).sources) {
        expect(citation.year).toBeGreaterThanOrEqual(2009)
        expect(citation.locator.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('hold the four rows whose question the source did not settle, and say so', () => {
    for (const id of HELD) {
      expect({ id, signedBy: row(id).signedBy }).toEqual({ id, signedBy: null })
      expect(row(id).note).toMatch(/Held for the owner/)
    }
  })

  it('cite the July 2026 UKKA update, with 16.2a at 2C and 16.2b at 1C', () => {
    const grades = Object.fromEntries(
      row('calcium-dose').sources.map(({ locator, grade, year }) => [
        locator.split(',')[0],
        { grade, year },
      ]),
    )
    expect(grades['Guideline 16.2a']).toEqual({ grade: '2C', year: 2026 })
    expect(grades['Guideline 16.2b']).toEqual({ grade: '1C', year: 2026 })
  })
})

/** Every string a content module exports, as one text. Functions are left out. */
function textOf(value: unknown): string {
  return JSON.stringify(value) ?? ''
}

const copy = [
  textOf(baxterCrrtCases),
  textOf(baxterCrrtLearnLessons),
  textOf(crrtGlossary),
  textOf(crrtFoundationTasks),
  textOf(crrtOperationalTasks),
  textOf(crrtWorkedCaseExamples),
  textOf(crrtPressureSignalDetails),
  textOf(baxterCrrtRapidDrills),
  CRRT_CITRATE_SCOPE_NOTICE,
].join('\n')

describe('learner copy after the corrections', () => {
  it('does not say a prescription delivers the dose', () => {
    expect(copy).not.toMatch(/prescribe 25–30 mL\/kg\/h to (reach|deliver) it/)
    expect(copy).not.toMatch(/which means prescribing 25–30/)
    expect(copy).toContain('25–30 mL/kg/h is commonly prescribed')
  })

  it('makes a calcium ratio above 2.5 a concern, not a diagnosis on its own', () => {
    expect(copy).not.toMatch(/2\.5[^.]{0,40}(signals accumulation|makes the diagnosis)/)
    expect(copy).toContain('above 2.5 raises concern for accumulation')
    expect(copy).toContain('Calculate the total-to-ionized calcium ratio in the same units')
  })

  it('calls +10 mmHg the initial return disconnection limit', () => {
    expect(copy).toContain('Return Disconnection, initially below +10 mmHg')
    expect(copy).toContain('the initial limit, which can move with the return pressure’s operating')
  })

  it('says potassium can rebound, and a further insulin dose is considered', () => {
    expect(copy).toContain('potassium can rebound around 2–3 hours if it has not been removed')
    expect(copy).toContain(
      'UKKA says to consider a further insulin-glucose infusion after reassessing',
    )
    expect(copy).toContain('repeated doses raise the risk of hypoglycemia')
  })

  it('gives the EASL sodium rate as a limit, not a target', () => {
    expect(copy).toContain('no more than 10 mmol/L per 24 hours, a limit rather than a target')
    expect(copy).not.toMatch(/no faster than 10 mmol\/L/)
  })

  it('says the gain/loss limit ends the current treatment', () => {
    expect(copy).not.toMatch(/suspends treatment permanently|stop for good/)
    expect(copy).toContain('Reaching the gain/loss limit ends the current treatment')
  })
})
