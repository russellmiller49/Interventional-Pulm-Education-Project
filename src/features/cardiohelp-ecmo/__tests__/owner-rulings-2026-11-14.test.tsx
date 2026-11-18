/**
 * The owner's four ECMO rulings of 2026-11-14, held in place: `ecmo-365-assembled-and-unsourced-lines`,
 * `ecmo-lv-unloading-sizes`, `ecmo-differential-hypoxemia-86` and `ecmo-limb-ischemia-placement`.
 * Each test names its ruling and point. No value is changed and nothing here signs a row.
 */
import { render } from '@testing-library/react'

import { EcmoAirFirstMoves } from '../components/teaching/EcmoReferenceValues'
import { clinicalPracticeScenarios } from '../content/clinicalCases'
import { cardiohelpCurriculum, curriculumUnitById } from '../content/curriculum'
import { ecmoDrillSpecs } from '../content/drillSpecs'
import { cardiohelpLearnLessons } from '../content/learnLessons'
import { clinicalPracticeSupportByScenarioId } from '../content/practiceSupport'
import { cardiohelpScenarios } from '../content/scenarios'
import {
  ECMO_AIR_FIRST_MOVES,
  ECMO_AIR_RESUME,
  ECMO_AIR_RESUME_SENTENCE,
  ECMO_DIFFERENTIAL_HYPOXEMIA_LESSON_RECORD,
  ECMO_DIFFERENTIAL_HYPOXEMIA_MOVES,
  ECMO_LV_DISTENSION_MOVES,
  ECMO_NUMBERS,
} from '../content/teachingNumbers'

const lessons = JSON.stringify(cardiohelpLearnLessons)
const cases = JSON.stringify(clinicalPracticeScenarios)
const scenarios = JSON.stringify(cardiohelpScenarios)
const support = JSON.stringify(clinicalPracticeSupportByScenarioId)
const drills = JSON.stringify(ecmoDrillSpecs)
const everything = [lessons, cases, scenarios, support, drills].join(' ')
const row = (id: string) => ECMO_NUMBERS.rows.find((entry) => entry.id === id)!

describe('ecmo-365, point 1: resuming after a bubble stop', () => {
  const steps = ECMO_AIR_RESUME.conditions

  it('makes each action explicit, with the return clamp closed until the circuit is safe', () => {
    expect(steps[0]).toMatch(
      /source of the air is found and corrected, and the whole circuit has been inspected and is free of bubbles/,
    )
    expect(steps[1]).toBe('The return clamp stays closed until then.')
    expect(steps.join(' ')).toMatch(/Open the drainage clamp\./)
    expect(steps.join(' ')).toMatch(
      /Bubbles, then Reset, then Confirm\. The pump restarts on Confirm/,
    )
    expect(steps.at(-1)).toMatch(/then open the return clamp last/)
    expect(steps.at(-1)).toContain(ECMO_NUMBERS.value('clamp-release-pressure'))
  })

  it('accounts for the pump returning to the speed last set (IFU pp. 20 and 134)', () => {
    const speed = steps.findIndex((step) => /turn the set speed down/.test(step))
    const reset = steps.findIndex((step) => /Reset, then Confirm/.test(step))
    expect(speed).toBeGreaterThan(0)
    expect(speed).toBeLessThan(reset)
    expect(steps[speed]).toMatch(/the pump returns to the speed last set/)
    expect(ECMO_AIR_RESUME_SENTENCE).toMatch(/turn the set speed down/)
  })

  it('says what is the manufacturer’s and what is not, and that one button is an abstraction', () => {
    expect(ECMO_AIR_RESUME.manufacturerNote).toMatch(/From the CARDIOHELP instructions/)
    expect(ECMO_AIR_RESUME.manufacturerNote).toMatch(
      /They print no clamp order for resuming: this one is assembled from those rules/,
    )
    expect(ECMO_AIR_RESUME.manufacturerNote).toMatch(/clamp, de-air or replace the system/)
    expect(ECMO_AIR_RESUME.manufacturerNote).toMatch(/Follow your unit’s protocol/)
    expect(ECMO_AIR_RESUME.simulatorNote).toMatch(
      /one button\. That is an abstraction, not training in the device sequence/,
    )
    // Both notes are on the screen, under the steps.
    const view = render(<EcmoAirFirstMoves supportMode="va" />)
    expect(view.container.querySelector('[data-air-resume-manufacturer-note]')?.textContent).toBe(
      ECMO_AIR_RESUME.manufacturerNote,
    )
    expect(view.container.querySelector('[data-air-resume-simulator-note]')?.textContent).toBe(
      ECMO_AIR_RESUME.simulatorNote,
    )
  })

  it('does not call the return clamp the only or the last barrier', () => {
    expect(everything).not.toMatch(/last barrier/i)
    expect(lessons).toMatch(
      /the return clamp is one of them, not the only one, and it stays closed until the conditions for reopening are met/,
    )
  })
})

describe('ecmo-365, points 2 to 4: vasopressors, the ventilator and support', () => {
  it('does not make norepinephrine the first vasopressor everywhere (point 2)', () => {
    expect(everything).not.toMatch(/norepinephrine first/i)
    expect(cases).toMatch(/a vasopressor chosen for this patient’s physiology/)
  })

  it('gives no blanket instruction to raise FiO₂ and PEEP or to recruit (point 3)', () => {
    expect(everything).not.toMatch(/FiO₂, PEEP and recruitment/)
    expect(everything).not.toMatch(/raise ventilator FiO₂ and PEEP/i)
    expect(lessons).toMatch(
      /Too much PEEP or a recruitment maneuver can cost blood pressure or overdistend the lung/,
    )
  })

  it('does not require inotropes and vasopressors before the pump stops (point 4)', () => {
    expect(everything).not.toMatch(/before the pump stops/i)
    expect(everything).not.toMatch(/raise inotropes/i)
    expect(scenarios).toMatch(/use them as the patient needs while the circuit is restored/)
  })
})

describe('ecmo-365, point 5: massive air', () => {
  it('on VV isolates the patient before the source is looked for', () => {
    const moves = ECMO_AIR_FIRST_MOVES.massiveVv
    expect(moves[0]).toMatch(
      /clamp the return limb at once\. Protecting the patient comes before finding the source/,
    )
    expect(moves.findIndex((move) => /Find and correct the source/.test(move))).toBeGreaterThan(0)
  })

  it('on VA clamps and stops, calls at once, and supports the patient as the patient needs', () => {
    const moves = ECMO_AIR_FIRST_MOVES.massiveVa
    expect(moves[0]).toMatch(
      /Clamp the arterial return limb and stop the pump, then clamp the drainage limb/,
    )
    expect(moves[1]).toMatch(/Call for help at once: the ECMO team and the backup circuit/)
    expect(moves.join(' ')).toMatch(/inotropes or vasopressors as this patient needs/)
    expect(moves.at(-1)).toMatch(/Exchange the circuit if the air cannot be cleared quickly/)
  })

  it('says on screen that the list is adapted from its source', () => {
    for (const mode of ['va', 'vv'] as const) {
      const view = render(<EcmoAirFirstMoves supportMode={mode} />)
      expect(view.container.querySelector('[data-air-first-moves-note]')?.textContent).toBe(
        ECMO_AIR_FIRST_MOVES.note,
      )
      view.unmount()
    }
  })
})

describe('ecmo-lv-unloading-sizes', () => {
  it('keeps the illustrative values and labels them as this simulated patient’s (point 1)', () => {
    expect(row('lv-unloading-flow').value).toBe('about 3.0 L/min')
    expect(row('lv-unloading-response').value).toBe(
      'pulse pressure 8 mmHg with one move and 12 mmHg with both; native output 1.2 and 1.6 L/min',
    )
    expect(lessons).toMatch(/in this simulated patient; that figure is not a goal/)
    expect(scenarios).toMatch(/Those sizes are the model’s, not the response to expect/)
  })

  it('does not teach that both moves are always needed, or that an inotrope is free (points 2 and 6)', () => {
    expect(lessons).toMatch(
      /A real patient may respond to one move, to both, or to neither and need a mechanical vent/,
    )
    expect(lessons).toMatch(/It has a cost: more myocardial oxygen demand, and arrhythmia/)
    expect(everything).not.toMatch(/so the valve opens|so the ventricle ejects/)
    expect(ECMO_LV_DISTENSION_MOVES.moves.join(' ')).toMatch(/to help the ventricle eject/)
  })

  it('does not equate a pulse pressure over the line with the valve opening (point 3)', () => {
    expect(lessons).toMatch(
      /a pulse pressure above the line does not prove that the valve opens or that the ventricle is unloaded/,
    )
    expect(lessons).toMatch(/Whether the valve opens is seen on echo/)
    expect(row('lv-ejection-pulsatility').label).not.toMatch(/taken as adequate/)
  })

  it('puts echo and perfusion in the reassessment (points 4 and 5)', () => {
    expect(lessons).toMatch(
      /Recheck on echo that the aortic valve opens, that the ventricle is not distended and that blood is not stagnating in the heart/,
    )
    expect(lessons).toMatch(/How far flow can come down is set by systemic perfusion/)
  })
})

describe('ecmo-differential-hypoxemia-86', () => {
  it('keeps 86% and calls it the model’s illustration (point 1)', () => {
    expect(row('differential-ventilator-right-arm').value).toBe('86%')
    expect(row('differential-ventilator-right-arm').label).toMatch(/^Illustrative/)
    expect(ECMO_DIFFERENTIAL_HYPOXEMIA_LESSON_RECORD).toMatch(
      /That figure is the model’s illustration, not a target or the response to expect/,
    )
  })

  it('scopes the PEEP figure to its source and individualizes the ventilator (point 3)', () => {
    expect(row('va-peep-pulmonary-edema').value).toBe('at least 10 cmH₂O')
    expect(row('va-peep-pulmonary-edema').appliesTo).toMatch(
      /not a recommendation for differential hypoxemia/,
    )
    expect(lessons).toMatch(/it is not a rule for differential hypoxemia/)
    expect(lessons).toMatch(/at the bedside FiO₂ and PEEP are set for this patient/)
  })

  it('weighs what a low right arm means before escalating, and starts with the lung (points 4 and 5)', () => {
    expect(lessons).toMatch(/one SpO₂ value is not an automatic trigger/)
    expect(lessons).toMatch(/oxygen delivery to this patient’s brain and heart/)
    expect(lessons).toMatch(/the native lungs are where treatment starts: find the cause/)
  })

  it('treats V-AV and VV as individual decisions that are only recorded here (point 6)', () => {
    expect(ECMO_DIFFERENTIAL_HYPOXEMIA_MOVES.moves.join(' ')).toMatch(
      /Both are decisions for the ECMO team and this patient/,
    )
    expect(ECMO_DIFFERENTIAL_HYPOXEMIA_LESSON_RECORD).toMatch(/are only a recorded plan here/)
  })
})

describe('ecmo-limb-ischemia-placement', () => {
  const unit = curriculumUnitById.get('va-6-complications')!

  it('renames the section and keeps its id, its lessons and its cases', () => {
    expect(unit.title).toBe('VA ECMO: circuit emergencies and cannulation complications')
    expect(unit.lessonScenarioIds).toEqual(['va-arterial-bubble-stop', 'va-transport-power-loss'])
    expect(unit.caseScenarioIds).toEqual([
      'va-clinical-limb-ischemia',
      'va-clinical-circuit-air-embolism',
    ])
    expect(cardiohelpCurriculum.va.map((entry) => entry.id)).toContain('va-6-complications')
  })

  it('tells the two kinds of trouble apart in the summary', () => {
    expect(unit.summary).toMatch(/Circuit emergencies:/)
    expect(unit.summary).toMatch(/Cannulation complications:/)
    expect(unit.summary).toMatch(/while flow and the console look satisfactory/)
  })

  it('says a satisfactory console does not show the leg is perfused, and how to look', () => {
    expect(cases).toMatch(
      /Normal ECMO flow, MAP and console readings do not show that the cannulated leg is perfused/,
    )
    expect(cases).toMatch(
      /distal Doppler signals, tissue oxygenation \(NIRS\) where it is available, and the patency of the distal-perfusion catheter/,
    )
  })
})
