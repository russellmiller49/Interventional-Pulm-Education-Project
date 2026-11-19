/**
 * The owner's clinical rulings of 2026-11-12 and 2026-11-14 on Mechanical Ventilation, held in place.
 * Each test names its ruling. Nothing here signs a teaching number.
 */
import { render } from '@testing-library/react'

import { VentilationLungFigure } from '../components/stage/VentilationLungFigure'
import { caseResponseModelNote } from '../content/caseModelNotes'
import { ventilationLearningUnits } from '../content/learningCurriculum'
import { ventilationLearningExperiments } from '../content/learningExperiments'
import type { LungFigureModel } from '../content/lungFigure'
import {
  ventilationFinalQuestions,
  ventilationPlacementQuestions,
  ventilationUnitQuestions,
} from '../content/learningQuestions'
import { mechanicalVentilationCases, ventilationStations } from '../content/runtimeCases'
import { VENTILATION_NUMBERS } from '../content/teachingNumbers'

const questions = [
  ...ventilationUnitQuestions,
  ...ventilationPlacementQuestions,
  ...ventilationFinalQuestions,
]
const everyQuestionWord = JSON.stringify(questions)
const everyLessonWord = JSON.stringify(ventilationLearningUnits)
const everyExperimentWord = JSON.stringify(ventilationLearningExperiments)
const everyCaseWord = JSON.stringify(mechanicalVentilationCases)
const row = (id: string) => VENTILATION_NUMBERS.rows.find((entry) => entry.id === id)!

describe('tension pneumothorax (mv-354-clinical-checks 1, bf-decompression-site)', () => {
  it('names the fifth space in the mid-axillary line first', () => {
    expect(everyCaseWord).toMatch(
      /by needle or finger: the fifth intercostal space in the mid-axillary line, or the second in the midclavicular line/,
    )
    // The action menu is read before the priority is committed, so it does not give the answer away.
    expect(everyCaseWord).not.toMatch(/Decompress the affected side at once[^"]*film/)
    expect(everyCaseWord).toMatch(
      /Site and technique depend on the patient, the equipment, who is at the bedside and the local protocol/,
    )
  })

  it('does not make a tube-depth check a step that comes before decompression', () => {
    expect(everyQuestionWord).not.toMatch(/Check the tube depth, then decompress/)
    expect(everyQuestionWord).toMatch(/"Decompress the silent side now"/)
    expect(everyQuestionWord).toMatch(/do not let tube or equipment checks delay the decompression/)
    expect(everyQuestionWord).toMatch(
      /With new hypotension, suspect tension: the depth check takes seconds and must not delay the decompression/,
    )
    expect(everyLessonWord).toMatch(/without waiting for a film or for more equipment checks/)
    expect(everyLessonWord).not.toMatch(/Check the tube depth:/)
  })

  it('tells emergency decompression from definitive drainage', () => {
    expect(everyCaseWord).toMatch(/Decompression is a rescue, and a needle is temporary/)
    expect(everyCaseWord).toMatch(/a chest drain is the definitive treatment/)
    expect(everyQuestionWord).toMatch(/It is a rescue; a chest drain follows/)
  })
})

describe('recovery sizes are the model’s (mv-354-clinical-checks 2 and 4)', () => {
  it('says so beside the expected response of both cases', () => {
    expect(caseResponseModelNote('MV-14')).toMatch(
      /Those sizes and times are set by the model, not measured in patients/,
    )
    expect(caseResponseModelNote('MV-14')).toMatch(
      /the relief from a needle can be lost until a drain is in/,
    )
    expect(caseResponseModelNote('MV-13')).toMatch(/lowers the peak pressure at once/)
    expect(caseResponseModelNote('MV-13')).toMatch(/by an amount the model sets/)
    expect(caseResponseModelNote('MV-13')).toMatch(/how much, and how fast, varies/)
  })

  it('labels the action’s own feedback as the simulation’s', () => {
    expect(everyCaseWord).toMatch(
      /In this simulation the pressures fall first, then the blood pressure, then the saturation; at the bedside how much and how fast varies/,
    )
  })

  it('prints no shunt fraction to a learner as a clinical figure', () => {
    for (const text of [everyQuestionWord, everyLessonWord, everyExperimentWord])
      expect(text).not.toMatch(/shunt (fraction )?(of |falls to |to )?0\.\d/)
  })
})

describe('the asthma chapter is not a strategy for every obstruction (mv-354-clinical-checks 3)', () => {
  it('labels the figures as written for severe asthma', () => {
    for (const id of ['obstruction-vt', 'obstruction-rate', 'obstruction-flow', 'obstruction-ph'])
      expect(row(id).label).toMatch(/in severe asthma$/)
    for (const id of [
      'obstruction-vt',
      'obstruction-rate',
      'obstruction-flow',
      'obstruction-pplat',
      'obstruction-ph',
    ]) {
      expect(row(id).note).toMatch(/Written for status asthmaticus/)
      expect(row(id).note).toMatch(/does not transfer to mucus plugging, an obstructed tube/)
    }
  })

  it('keeps the general reasoning and scopes the pH figure in the lesson', () => {
    expect(everyLessonWord).toMatch(
      /In severe asthma with gas trapping, one expert approach accepts pH/,
    )
    expect(everyLessonWord).toMatch(
      /That threshold comes from severe asthma: clear a plugged or kinked tube, and treat other obstruction by its cause/,
    )
    expect(everyLessonWord).not.toMatch(/in severe obstruction accept pH/)
  })

  it('changes no value', () => {
    expect(row('obstruction-ph').value).toBe('≥7.20')
    expect(row('obstruction-rate').value).toBe('10–14 breaths/min')
  })
})

describe('smaller rulings', () => {
  it('gives the alarm-limit choice its safety note (mv-safety-alarm-limit-choice)', () => {
    const choice = questions
      .flatMap((question) => question.choices)
      .find((entry) => entry.label === 'Raise the alarm limit to match the current display')!
    expect(choice.unsafe).toBe(true)
    expect(choice.safety).toMatch(
      /A limit moved to fit an abnormal reading no longer warns of the problem it was set to catch/,
    )
    expect(choice.safety).toMatch(
      /On many ventilators the high-pressure limit also ends the breath/,
    )
    expect(choice.safety).toMatch(/set limits for the patient, not for the display/)
  })

  it('states no equilibration time for FiO₂, and calls the simulation’s seconds its own (mv-l1)', () => {
    expect(everyExperimentWord).toMatch(
      /Reassess after allowing time for a response: an immediate SpO₂ is not the whole effect/,
    )
    expect(everyExperimentWord).toMatch(
      /The 30 simulated seconds here are model time, not a clinical equilibration time/,
    )
    const oxygen = ventilationLearningExperiments
      .flatMap((experiment) => experiment.rounds)
      .find((round) => /FiO₂ setting changes/.test(round.title))!
    expect(oxygen.explanation).not.toMatch(
      /(within|after|takes|over) (about )?\d+ (seconds|minutes)/,
    )
  })

  it('scopes the pain rule to this patient (mv-l4)', () => {
    expect(everyExperimentWord).toMatch(
      /In this patient, treat the pain first, then read the ventilator again before you change it/,
    )
    expect(everyExperimentWord).not.toMatch(/Pain drives rate and effort\. Treat it before/)
  })

  it('names the intrinsic PEEP reading as a check on the trace (mv-merge-523)', () => {
    expect(everyExperimentWord).toMatch(
      /The intrinsic PEEP reading is the model’s estimate of the pressure the unexhaled gas leaves behind: use it as a check on the trace, not in place of it/,
    )
  })

  it('reads the plateau limit from the register, and uses no Hamilton name in case labels', () => {
    expect(everyQuestionWord).toMatch(/The plateau limit in adult ARDS is ≤30 cmH₂O/)
    expect(everyQuestionWord).not.toMatch(/plateau below 30/)
    expect(JSON.stringify(ventilationStations)).not.toMatch(/P-ramp/)
    expect(everyCaseWord).not.toMatch(/P-ramp/)
  })
})

describe('the lung drawing’s notes (mv-lung-figure-physician-check)', () => {
  const base: LungFigureModel = {
    inflation: 0.5,
    flow: 'in',
    effort: null,
    airway: null,
    stiffness: null,
    trapped: null,
    lines: ['Gas flowing in'],
  }
  const notes = (model: LungFigureModel) => {
    const view = render(<VentilationLungFigure model={model} when="at the cursor" />)
    const found = (name: string) => view.container.querySelector(`[data-${name}-note]`)?.textContent
    const all = {
      diaphragm: found('diaphragm'),
      effort: found('effort'),
      stiffness: found('stiffness'),
      airway: found('airway'),
      trapped: found('trapped'),
    }
    view.unmount()
    return all
  }

  it('always says that diaphragm descent alone is not patient effort (point 1)', () => {
    expect(notes(base).diaphragm).toMatch(
      /moves down as the lungs are inflated; that alone does not show patient\s+effort/,
    )
  })

  it('shows each other note only when the drawing shows that feature (points 2 to 5)', () => {
    const bare = notes(base)
    expect(bare.effort).toBeUndefined()
    expect(bare.stiffness).toBeUndefined()
    expect(bare.airway).toBeUndefined()
    expect(bare.trapped).toBeUndefined()
    const full = notes({ ...base, effort: 0.5, stiffness: 0.5, airway: 0.8, trapped: 0.3 })
    expect(full.effort).toMatch(/turns amber, while the patient is making an inspiratory effort/)
    expect(full.stiffness).toMatch(/reduced respiratory-system compliance/)
    expect(full.stiffness).toMatch(/does not\s+show a change in the lung tissue/)
    expect(full.airway).toMatch(/not necessarily a fixed\s+narrowing/)
    expect(full.airway).toMatch(/bronchospasm, secretions or the tube/)
    expect(full.trapped).toMatch(/schematic of the model’s estimate of that gas/)
    expect(full.trapped).toMatch(/does not show where in the lung that gas sits/)
    // Section 7 bars /trap/ before commitment (mv-l6), and this note can show there.
    expect(full.trapped).not.toMatch(/trap/i)
  })
})
