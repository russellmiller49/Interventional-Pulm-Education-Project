/**
 * The owner's CRRT rulings of 2026-11-14, held in place: `crrt-357-case-stems` (eight cases and the
 * three P-proposals), `crrt-03-kdigo-unstable-sentence`, `crrt-conflict-liberation-urine`,
 * `crrt-conflict-calcium-ratio` and `crrt-ajkd-citrate-mapping-erratum`. Each test names its
 * ruling. Case ids, keys and safety flags are unchanged, and nothing here signs a row.
 */
import { crrtAdvancedTasks } from '../content/advancedLessons'
import { baxterCrrtCases } from '../content/completeCases'
import { crrtFoundationTasks } from '../content/foundationLessons'
import { resolveCrrtLearnerFacingSource } from '../content/learnerSourceMap'
import { crrtOperationalTasks } from '../content/operationalLessons'
import { CRRT_NUMBERS } from '../content/teachingNumbers'

const caseText = (id: string) =>
  JSON.stringify(baxterCrrtCases.find((definition) => definition.id === id)!)
const caseOf = (id: string) => baxterCrrtCases.find((definition) => definition.id === id)!
const lessons = JSON.stringify([crrtOperationalTasks, crrtAdvancedTasks])
const row = (id: string) => CRRT_NUMBERS.rows.find((entry) => entry.id === id)!

describe('crrt-03-kdigo-unstable-sentence and CRRT-03', () => {
  const text = caseText('CRRT-03')

  it('cites KDIGO 2012 recommendations 5.6.2 and 5.6.3 by number and grade', () => {
    expect(text).toMatch(
      /acute brain injury, raised intracranial pressure or generalized brain edema \(recommendation 5\.6\.3, grade 2B\)/,
    )
    expect(text).toMatch(/hemodynamically unstable patients \(recommendation 5\.6\.2, grade 2B\)/)
  })

  it('keeps them as suggestions and tells the two reasons apart', () => {
    expect(text).toMatch(/The circulation is a second, separate reason/)
    expect(text).toMatch(
      /Both KDIGO statements are suggestions, not a rule that intermittent dialysis is never used in an unstable patient/,
    )
  })

  it('leaves the keyed path and its unsafe action where they were', () => {
    const definition = caseOf('CRRT-03')
    expect(definition.criticalErrors[0]?.label).toBe(
      'Switch to intermittent hemodialysis to fix the numbers faster',
    )
    expect(definition.controlOptions[0]?.label).toMatch(/^12-lead ECG and monitor now/)
  })
})

describe('crrt-357-case-stems', () => {
  it('CRRT-08: says what the machine checks and leaves the solution to a person', () => {
    const text = caseText('CRRT-08')
    expect(text).toMatch(
      /describes the barcode reader for the filter set, not for the solution bags/,
    )
    expect(text).toMatch(
      /cannot detect every bag attached to the wrong line or hung on the wrong scale/,
    )
    expect(text).toMatch(
      /a person reading the label against the order, by your unit’s double-check procedure/,
    )
  })

  it('CRRT-09: tells a contraindication from a higher risk, and gives heparin and no anticoagulant their place', () => {
    const text = caseText('CRRT-09')
    expect(text).toMatch(/Citrate is not all or none/)
    expect(text).toMatch(
      /severely impaired liver function and shock with muscle hypoperfusion as its major contraindications/,
    )
    expect(text).toContain(CRRT_NUMBERS.value('citrate-lactate-risk'))
    expect(text).toMatch(
      /regional citrate, rather than no anticoagulant, when citrate is not contraindicated \(recommendation 5\.3\.3\.1, grade 2C\)/,
    )
    expect(text).toMatch(
      /where the bleeding risk is not raised and citrate is contraindicated, KDIGO suggests it \(5\.3\.2\.3, grade 2C\)/,
    )
    // 5.3.2.2 is for patients without an increased bleeding risk; this patient has one.
    expect(caseOf('CRRT-09').criticalErrors[0]?.explanation).not.toMatch(/5\.3\.2\.2/)
    expect(text).not.toMatch(/Name the two contraindications/)
  })

  it('CRRT-12: makes no universal drug-dosing statement', () => {
    const text = caseText('CRRT-12')
    expect(text).not.toMatch(/is too low once CRRT is clearing the drug/)
    expect(text).not.toMatch(/re-dose/)
    expect(text).toMatch(/may be too low now that CRRT is clearing the drug/)
    expect(text).toMatch(/no single rule fits every drug/)
  })

  it('CRRT-14: never teaches a forced flush', () => {
    const text = caseText('CRRT-14')
    expect(text).not.toMatch(/flush or reposition the return lumen/i)
    expect(text).not.toMatch(/Flush the return lumen/)
    expect(text).toMatch(
      /Never force a flush against resistance or a suspected clot: it can dislodge the clot or injure the vessel/,
    )
    expect(text).toMatch(/check the catheter by your unit’s procedure/)
    // The manufacturer's own corrective action is quoted as it is printed.
    expect(text).toMatch(/“flush or reposition the catheter according to hospital protocol”/)
  })

  it('CRRT-16: the filtration fraction still follows the approved expression', () => {
    // fluid across the membrane ÷ (plasma flow + pre-filter fluid), plasma flow = Qb × (1 − Hct)
    const plasma = 130 * 60 * (1 - 0.36)
    const fraction = (400 + 400 + 50) / (plasma + 400)
    expect(Math.round(fraction * 100)).toBe(16)
    expect(caseText('CRRT-16')).toMatch(/about 16%/)
  })

  it('CRRT-17: a pattern that strongly suggests accumulation, not a liver that cannot metabolize citrate', () => {
    const text = caseText('CRRT-17')
    expect(text).toMatch(/2\.75 ÷ 0\.88 is 3\.1/)
    expect(text).toMatch(
      /A raised ratio, a calcium requirement that keeps climbing and an anion-gap metabolic acidosis together strongly suggest citrate accumulation/,
    )
    expect(text).toMatch(/lactic acidosis is contributing/)
    expect(text).toMatch(/it does not mean citrate cannot be metabolized at all/)
    expect(text).toMatch(/keep replacing calcium/)
    expect(text).not.toMatch(/cannot convert citrate|cannot metabolize it|stops citrate metabolism/)
  })

  it('CRRT-17 and CRRT-18: do not report a laboratory response the case does not model', () => {
    expect(caseText('CRRT-17')).toMatch(
      /the acidosis improves as far as citrate was its cause; repeat bloods confirm it/,
    )
    expect(caseText('CRRT-17')).toMatch(
      /its laboratory values are the case-start set and do not change/,
    )
    expect(caseText('CRRT-18')).toMatch(
      /That is the expected course after stopping, not something this case simulates/,
    )
    expect(caseText('CRRT-18')).toMatch(/If the trial succeeds, urine output holds/)
  })

  it('CRRT-18: urine output predicts, and a creatinine plateau alone is not recovery', () => {
    const text = caseText('CRRT-18')
    expect(text).toMatch(/620 mL/)
    expect(text).toMatch(
      /urine volume alone does not show the kidneys can clear potassium and acid/,
    )
    expect(text).toMatch(/a plateau in creatinine alone does not establish it/)
    expect(text).not.toMatch(/A creatinine that rises and then levels off is recovery/)
    expect(text).toMatch(
      /off vasopressors, 1\.5 L negative over two days, and a potassium and pH that are normal/,
    )
  })

  it('keeps every case id, and the unsafe actions that were flagged', () => {
    for (const id of [
      'CRRT-03',
      'CRRT-08',
      'CRRT-09',
      'CRRT-12',
      'CRRT-14',
      'CRRT-16',
      'CRRT-17',
      'CRRT-18',
    ]) {
      expect(caseOf(id).criticalErrors.length).toBeGreaterThan(0)
      expect(caseOf(id).unsafeActions.length).toBeGreaterThan(0)
    }
  })
})

describe('the three P-proposals', () => {
  it('P-03: turning net removal down is tied to this patient, not to every fall in pressure', () => {
    expect(lessons).toMatch(
      /This patient is hypotensive on a rising vasopressor dose and already past the day’s fluid goal, so turn it down/,
    )
    expect(lessons).toMatch(
      /A falling pressure on CRRT is not always the fluid removal: look for the other causes as well/,
    )
  })

  it('P-05: the stem states the period the effluent total covers', () => {
    expect(lessons).toMatch(/the total effluent volume for the last 12 hours/)
    expect(lessons).not.toMatch(/without saying what period the total covers/)
    expect(lessons).toMatch(/report the dose and leave the balance blank/)
  })

  it('P-08: resuming follows a fixed cause and the machine’s own condition, not an acknowledgement', () => {
    expect(lessons).toMatch(/Resume because the cause is fixed, not because the alarm was silenced/)
    expect(lessons).toMatch(
      /For Access Extremely Negative the manual makes Continue available when access pressure is within normal limits\. That is not proof of the fix/,
    )
    expect(lessons).toMatch(
      /calls for a new set once the pump has been stopped for more than 10 minutes/,
    )
    expect(lessons).not.toMatch(/'Resume, then recheck/)
  })
})

describe('crrt-conflict-prescribed-dose: both views', () => {
  const foundation = JSON.stringify(crrtFoundationTasks)

  it('teaches the 25–30 prescription and the AJKD view beside it, without a new number', () => {
    expect(foundation).toMatch(
      /KDIGO and the textbooks support 25–30 mL\/kg\/h, to cover the hours the circuit is down/,
    )
    expect(foundation).toMatch(
      /a prescription above the top of the delivered range may be unnecessary/,
    )
    expect(foundation).toMatch(/the dose that counts is the one delivered/)
    // The signed row is untouched.
    expect(row('dose-prescribed').value).toBe('25–30 mL/kg/h')
    expect(row('dose-prescribed').signedOn).toBe('2026-11-13')
  })
})

describe('crrt-conflict-liberation-urine: both thresholds', () => {
  it('carries both in the one row, each with its source, and stays unsigned', () => {
    const entry = row('liberation-urine-output')
    expect(entry.value).toMatch(
      /400–450 mL\/day without diuretics or 2,300 mL\/day with them \(BEST Kidney cohort\)/,
    )
    expect(entry.value).toMatch(/500 mL\/day without diuretics or 2 L\/day with them \(AJKD 2025\)/)
    expect(entry.sources.map(({ sourceId }) => sourceId)).toEqual([
      'TEXT-ACUTE-NEPHROLOGY-2015',
      'REVIEW-CKRT-CORE-2025',
    ])
    expect(entry.signedBy).toBeNull()
  })

  it('teaches neither as sufficient alone', () => {
    expect(lessons).toMatch(
      /Either tells you when a trial is worth considering, not that it will succeed/,
    )
    expect(lessons).toMatch(/Neither decides the question alone/)
  })
})

describe('crrt-conflict-calcium-ratio', () => {
  it('reads 2.5 or more wherever the ratio is taught', () => {
    expect(row('calcium-ratio').value).toBe('2.5 or more')
    expect(lessons).toMatch(/a ratio of 2\.5 or more/)
    expect(caseText('CRRT-17')).toMatch(/is 3\.1, and 2\.5 or more raises concern/)
    expect(lessons).toMatch(/ratio is below 2\.5\. Which explanation fits/)
  })
})

describe('crrt-ajkd-citrate-mapping-erratum', () => {
  const record = resolveCrrtLearnerFacingSource('REVIEW-CKRT-CORE-2025')

  it('records the erratum on the source as a linked correction', () => {
    expect(record.documentVersion).toMatch(
      /corrected by a published erratum: Am J Kidney Dis\. 2025;86\(3\):422 · PMID 40846440/,
    )
    expect(record.pageOrSection).toMatch(/erratum DOI 10\.1053\/j\.ajkd\.2025\.06\.004/)
    // Shown to learners under the source: facts only, no instruction to an author.
    expect(record.pageOrSection).not.toMatch(/use the corrected table/)
  })

  it('names the citrate passages in the record’s own claim', () => {
    expect(record.claim).toMatch(/On regional citrate \(pp\. 781–784\)/)
  })

  it('uses no per-minute dose unit and no per-minute dialysate rate, the erratum’s two corrections', () => {
    const everything = JSON.stringify([
      baxterCrrtCases,
      crrtOperationalTasks,
      crrtAdvancedTasks,
      CRRT_NUMBERS.rows,
    ])
    expect(everything).not.toMatch(/mL\/kg\/min/)
    // A dialysate rate per minute, the Case 3 misprint. (The body's own lactate clearance, a
    // different quantity on p. 778, is rightly per minute.)
    expect(everything).not.toMatch(/dialysate[^.]{0,60}mL\/min/i)
  })
})
