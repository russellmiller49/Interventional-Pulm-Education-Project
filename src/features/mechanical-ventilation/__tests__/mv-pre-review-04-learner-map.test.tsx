/**
 * MV-PRE-REVIEW-04 — self-paced teaching, wayfinding and sources.
 *
 * One learner map across Overview, Learn, Practice and Applications; the parts of a section named
 * as parts; the steps a learner is shown; feedback that says something definite; sources credited
 * to where they came from. Ids, keys, stored formats, physiology and holds are asserted unchanged.
 */
import { readdirSync, readFileSync } from 'fs'
import path from 'path'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import MechanicalVentilationCaseActivityV2 from '../components/MechanicalVentilationCaseActivityV2'
import { MechanicalVentilationCourseCheck } from '../components/MechanicalVentilationCourseCheck'
import { MechanicalVentilationHub } from '../components/MechanicalVentilationHub'
import { MechanicalVentilationPracticePicker } from '../components/MechanicalVentilationPracticePicker'
import { VentilationReinforcement, choiceVerdict } from '../components/VentilationReinforcement'
import { VentilationPeepComparison } from '../components/stage/VentilationPeepComparison'
import { VentilationSourceList } from '../components/stage/VentilationSourceList'
import { VentilationStageHost } from '../components/stage/VentilationStageHost'
import {
  ventilationCaseExplanation,
  ventilationCaseMechanismHint,
  ventilationCaseTeaching,
} from '../content/caseTeaching'
import { VENTILATION_CONTROL_PANEL } from '../content/controlPanel'
import { ventilationEvidenceById } from '../content/evidence'
import {
  isVentilationCaseLive,
  ventilationApplicationConceptUnit,
  ventilationApplicationCoverage,
  ventilationApplicationCoverageNote,
  ventilationCaseCountPhrase,
  ventilationCaseCounts,
  ventilationHeldLiveCaseIds,
  ventilationPartSetupLine,
  ventilationRoundRelationLine,
  ventilationSectionLabel,
  ventilationSectionNumber,
  ventilationSectionTimeLine,
  VENTILATION_HELD_CASE_TAG,
} from '../content/learnerMap'
import {
  ventilationLearningUnits,
  ventilationPracticeOrder,
  ventilationUnitById,
} from '../content/learningCurriculum'
import { ventilationLearningExperiments } from '../content/learningExperiments'
import { ventilationFinalQuestions } from '../content/learningQuestions'
import { ventilationCompositionLine, ventilationPathwayGroups } from '../content/pathwayResolver'
import { mechanicalVentilationCaseById, mechanicalVentilationCases } from '../content/runtimeCases'
import { ventilationSectionSpec } from '../content/sectionSpecs'
import { ventilationSettingSort } from '../content/stageItems'
import {
  isPresentedVentilationStep,
  resolvePresentedStepIndex,
  roundQuestionKind,
  ventilationPresentedStepIndexes,
  ventilationStageLesson,
} from '../content/stageLessons'
import { VENTILATION_SELF_PACED_KEY } from '../engine/selfPacedProgress'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a
      href={
        typeof href === 'string'
          ? href
          : `${href.pathname}${href.query ? `?${new URLSearchParams(href.query).toString()}` : ''}`
      }
      {...props}
    >
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/mechanical-ventilation',
}))
jest.mock('../components/MechanicalVentilatorConsole', () => ({
  MechanicalVentilatorConsole: () => <p>Console observed by test</p>,
}))

beforeEach(() => {
  localStorage.clear()
  jest.useFakeTimers()
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

const boot = () => act(() => jest.advanceTimersByTime(20))
const SECTION_IDS = ventilationLearningUnits.map((unit) => unit.id)
const featureRoot = path.join(process.cwd(), 'src/features/mechanical-ventilation')

/* ------------------------------------------------------------------------------------------------
 * The map: sections, cases, counts
 * ---------------------------------------------------------------------------------------------- */

describe('one learner map', () => {
  it('keeps the fourteen sections, their ids and their order', () => {
    expect(SECTION_IDS).toEqual([
      'breathing-with-support',
      'waveform-anatomy',
      'controls-and-goals',
      'mechanics-load-and-pressure',
      'modes-and-breath-delivery',
      'lung-protection',
      'expiration-and-air-trapping',
      'triggering-and-cycling',
      'oxygenation-response',
      'ventilation-and-co2',
      'waveform-reading-sequence',
      'dyssynchrony-mechanisms',
      'safety-reassessment-and-human-factors',
      'high-peak-pressure-integration',
    ])
    SECTION_IDS.forEach((id, index) => {
      expect(ventilationSectionNumber(id)).toBe(index + 1)
      expect(ventilationSectionLabel(id)).toBe(
        `Section ${index + 1} · ${ventilationUnitById.get(id)!.title}`,
      )
    })
  })

  it('counts live and held case entries from the registry: 15 entries are not 15 live cases', () => {
    expect(mechanicalVentilationCases.map((item) => item.id)).toEqual(
      Array.from({ length: 15 }, (_, index) => `MV-${String(index + 1).padStart(2, '0')}`),
    )
    expect(ventilationHeldLiveCaseIds).toEqual(['MV-03'])
    expect(ventilationCaseCounts()).toEqual({ entries: 15, live: 14, held: 1 })
    expect(ventilationCaseCountPhrase()).toBe('14 live cases and 1 worked explanation')
    expect(isVentilationCaseLive('MV-03')).toBe(false)
    expect([...ventilationPracticeOrder].sort()).toEqual(
      mechanicalVentilationCases.map((item) => item.id).sort(),
    )
  })

  it('pairs a stage with a case only where a section of that stage teaches its mechanism (N1)', () => {
    const groups = ventilationPathwayGroups()
    const byStage = Object.fromEntries(
      groups.map((group) => [group.stage, group.cases.map((entry) => entry.caseId)]),
    )
    expect(byStage.orientation).toEqual([])
    expect(byStage.foundation).toEqual([])
    for (const group of groups)
      for (const entry of group.cases) {
        expect(entry.kind).toBe('mechanism-match')
        expect(ventilationSectionSpec(entry.unitId).practicePairing?.caseId).toBe(entry.caseId)
      }
    // A case paired a second time is labelled a revisit, never listed as a new case.
    const flat = groups.flatMap((group) => group.cases)
    flat.forEach((entry, index) => {
      const earlier = flat.slice(0, index).some((other) => other.caseId === entry.caseId)
      expect(entry.revisit).toBe(earlier)
    })
    expect(flat.filter((entry) => entry.revisit).map((entry) => entry.caseId)).toEqual([
      'MV-01',
      'MV-05',
      'MV-13',
    ])
    // The stage of Sections 11–13 keeps its id and is not called "applications".
    expect(ventilationCompositionLine()).not.toMatch(/application/i)
    expect(ventilationCompositionLine()).toMatch(/3 integration sections · 1 capstone/)
  })

  it('shows the same names and counts on the Overview and on Practice (N1, N3)', () => {
    render(<MechanicalVentilationHub />)
    boot()
    const hub = document.body.textContent ?? ''
    expect(hub).toContain('14 live cases and 1 worked explanation')
    expect(hub).not.toMatch(/15 clinical cases/)
    expect(hub).toContain(VENTILATION_CONTROL_PANEL.shapingSentence)
    cleanup()

    render(<MechanicalVentilationPracticePicker />)
    boot()
    const all = document.querySelector('[aria-labelledby="mv-practice-all"]') as HTMLElement
    const links = within(all).getAllByRole('link')
    expect(links).toHaveLength(15)
    for (const link of links) {
      const match = link.textContent!.match(/builds on (Section \d+ · .+)$/)
      if (match) expect(SECTION_IDS.map(ventilationSectionLabel)).toContain(match[1])
    }
    const held = links.filter((link) => link.textContent!.includes(VENTILATION_HELD_CASE_TAG))
    expect(held).toHaveLength(1)
    expect(held[0].getAttribute('href')).toContain('case=MV-03')
    // The second set of section names is gone from the page.
    const practice = document.body.textContent ?? ''
    for (const unit of ventilationLearningUnits)
      if (unit.shortTitle !== unit.title)
        expect(practice).not.toContain(`builds on ${unit.shortTitle}`)
    // Every deep link keeps its shape.
    for (const link of links)
      expect(link.getAttribute('href')).toMatch(
        /^\/mechanical-ventilation\/practice\?case=MV-\d\d&device=[a-z0-9-]+&mode=(guided|practice)$/,
      )
  })
})

/* ------------------------------------------------------------------------------------------------
 * Applications: items mapped to the section they draw on
 * ---------------------------------------------------------------------------------------------- */

describe('Applications mapping (A1, A2, A3)', () => {
  it('keeps every item id, stem, key and option and moves only the label and review link', () => {
    expect(ventilationFinalQuestions.map((item) => item.id)).toEqual([
      'modes-and-breath-delivery:final',
      'oxygenation-response:final',
      'triggering-and-cycling:final',
      'lung-protection:final',
      'safety-reassessment-and-human-factors:final',
      'mechanics-load-and-pressure:final',
      'ventilation-and-co2:final',
      'waveform-reading-sequence:final',
      'controls-and-goals:final',
      'high-peak-pressure-integration:final',
    ])
    expect(ventilationFinalQuestions.map((item) => item.correctId)).toEqual([
      '1',
      '0',
      '2',
      '1',
      '0',
      '2',
      '1',
      '0',
      '2',
      '1',
    ])
    const first = ventilationFinalQuestions[0]
    expect(first.unitId).toBe('modes-and-breath-delivery')
    expect(first.prompt).toMatch(/Resistance increases/)
    expect(ventilationApplicationConceptUnit(first).id).toBe('mechanics-load-and-pressure')
    for (const item of ventilationFinalQuestions.slice(1))
      expect(ventilationApplicationConceptUnit(item).id).toBe(item.unitId)
  })

  it('labels the chooser by section, links review to that section and says what is not covered', () => {
    render(<MechanicalVentilationCourseCheck kind="final" />)
    const picker = screen.getByRole('combobox', { name: 'Choose a worked application' })
    const labels = [...picker.querySelectorAll('option')].map((option) => option.textContent)
    expect(labels[0]).toBe(
      `${ventilationSectionLabel('mechanics-load-and-pressure')} — item 1 of 2`,
    )
    expect(labels[5]).toBe(
      `${ventilationSectionLabel('mechanics-load-and-pressure')} — item 2 of 2`,
    )
    expect(labels[1]).toBe(ventilationSectionLabel('oxygenation-response'))
    expect(new Set(labels).size).toBe(labels.length)
    expect(
      screen.getByRole('link', {
        name: `Review ${ventilationSectionLabel('mechanics-load-and-pressure')}`,
      }),
    ).toHaveAttribute('href', '/mechanical-ventilation/learn?activity=mechanics-load-and-pressure')
    const coverage = ventilationApplicationCoverage()
    expect(coverage.items).toBe(10)
    expect(coverage.uncovered.map((unit) => ventilationSectionNumber(unit.id))).toEqual([
      1, 2, 5, 7, 12,
    ])
    expect(document.querySelector('[data-application-coverage]')?.textContent).toBe(
      ventilationApplicationCoverageNote(),
    )
    expect(ventilationApplicationCoverageNote()).toMatch(
      /Sections 1, 2, 5, 7 and 12 have no item here/,
    )
  })

  it('says PEEP where the section is about PEEP (A3)', () => {
    const outcome = ventilationUnitById.get('oxygenation-response')!.outcome
    expect(outcome).toMatch(/PEEP/)
    expect(outcome).not.toMatch(/pressure support/i)
  })
})

/* ------------------------------------------------------------------------------------------------
 * Parts, revisits and the steps a learner is shown
 * ---------------------------------------------------------------------------------------------- */

describe('parts of a section (N2, S6-3, S5-1, S7-1, S11-1, S12-1)', () => {
  it('calls the in-section parts Part 1 and Part 2, never an application', () => {
    render(<VentilationStageHost unitId="mechanics-load-and-pressure" />)
    boot()
    const card = document.querySelector('[data-current-step]') as HTMLElement
    expect(card.textContent).toMatch(/Step 1 of 7 · Part 1 of 2/)
    expect(document.querySelector('[data-stage-frame]')!.textContent).not.toMatch(/Application \d/)
    expect(document.querySelector('[data-part-setup]')?.textContent).toBe(
      ventilationPartSetupLine('mechanics-load-and-pressure', 0),
    )
  })

  it('says whether Part 2 is the same simulated patient and what it starts with, from the round', () => {
    for (const experiment of ventilationLearningExperiments) {
      const [first, second] = experiment.rounds
      const line = ventilationPartSetupLine(experiment.unitId, 1)
      if (first.caseId === second.caseId)
        expect(line).toMatch(/the same simulated patient as Part 1/)
      else expect(line).toMatch(/a different simulated patient from Part 1/)
      if (second.caseId !== 'MV-LAB') expect(line).toContain(`case ${second.caseId}`)
      expect(line).toMatch(/fresh, paused patient/)
      for (const round of experiment.rounds)
        expect(`${round.introduction} ${round.task}`).not.toMatch(/\boriginal (patient|case)\b/i)
    }
    expect(ventilationPartSetupLine('lung-protection', 1)).toContain(
      'a different simulated patient from Part 1: the simulated patient of case MV-01',
    )
    expect(ventilationPartSetupLine('expiration-and-air-trapping', 0)).toContain(
      'simulated airway resistance ×4 and rate 12/min',
    )
  })

  it('warns before Continue opens the other part, without blocking it', () => {
    const lesson = ventilationStageLesson('waveform-anatomy')
    render(<VentilationStageHost unitId="waveform-anatomy" />)
    boot()
    const lastOfPartOne = lesson.steps.findIndex(
      (step) => step.interaction.kind === 'explain' && step.interaction.round === 0,
    )
    fireEvent.change(screen.getByRole('combobox', { name: 'Choose step' }), {
      target: { value: String(lastOfPartOne) },
    })
    expect(document.querySelector('[data-part-change-notice]')?.textContent).toMatch(
      /Continue opens Part 2 on a fresh, paused\s+patient/,
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'Continue' })[0])
    expect(document.querySelector('[data-current-step]')!.textContent).toMatch(/Part 2 of 2/)
    expect(document.querySelector('[data-part-change-notice]')).toBeNull()
  })

  it('labels a repeated part as a revisit and an early one as a preview, and the repeat is exact', () => {
    const round = (unitId: string, index: 0 | 1) =>
      ventilationLearningExperiments.find((item) => item.unitId === unitId)!.rounds[index]
    const related = ventilationLearningExperiments.flatMap((experiment) =>
      experiment.rounds.flatMap((item, index) =>
        item.relation ? [{ unitId: experiment.unitId, index, relation: item.relation }] : [],
      ),
    )
    expect(
      related.map((entry) => `${entry.unitId}:${entry.index + 1}:${entry.relation.kind}`),
    ).toEqual([
      'modes-and-breath-delivery:1:revisit',
      'expiration-and-air-trapping:2:preview',
      'waveform-reading-sequence:2:revisit',
      'dyssynchrony-mechanisms:2:revisit',
    ])
    for (const entry of related) {
      expect(ventilationUnitById.has(entry.relation.unitId)).toBe(true)
      const here = round(entry.unitId, entry.index as 0 | 1)
      if (entry.relation.kind === 'revisit') {
        const there = round(entry.relation.unitId, (entry.relation.part! - 1) as 0 | 1)
        expect(here.prompt).toBe(there.prompt)
        expect(here.choices).toEqual(there.choices)
        expect(here.correct).toBe(there.correct)
        expect(ventilationSectionNumber(entry.relation.unitId)).toBeLessThan(
          ventilationSectionNumber(entry.unitId),
        )
      } else {
        // A preview points forward, to the section that teaches the idea in full.
        expect(ventilationSectionNumber(entry.relation.unitId)).toBeGreaterThan(
          ventilationSectionNumber(entry.unitId),
        )
      }
      expect(ventilationRoundRelationLine(here)).toContain(
        ventilationSectionLabel(entry.relation.unitId),
      )
    }
    // Section 7 uses cycle-off before Section 8 teaches it: the terms are expanded where used.
    const early = round('expiration-and-air-trapping', 1)
    expect(early.introduction).toMatch(/pressure support/)
    expect(early.introduction).toMatch(
      /cycle-off threshold \(expiratory trigger sensitivity, ETS\)/,
    )
    // Both uses of the cycling setup keep the same patient and goal; nothing was relocated.
    expect(round('dyssynchrony-mechanisms', 1).caseId).toBe('MV-10')
    expect(early.caseId).toBe('MV-10')
    expect(early.goals).toEqual(round('dyssynchrony-mechanisms', 1).goals)
  })
})

describe('the steps a learner is shown (N6)', () => {
  it('leaves every lesson step, id and ordinal in place', () => {
    const counts = Object.fromEntries(
      SECTION_IDS.map((id) => [id, ventilationStageLesson(id).steps.length]),
    )
    expect(counts).toEqual({
      'breathing-with-support': 10,
      'waveform-anatomy': 10,
      'controls-and-goals': 11,
      'mechanics-load-and-pressure': 10,
      'modes-and-breath-delivery': 10,
      'lung-protection': 8,
      'expiration-and-air-trapping': 8,
      'triggering-and-cycling': 8,
      'oxygenation-response': 4,
      'ventilation-and-co2': 8,
      'waveform-reading-sequence': 8,
      'dyssynchrony-mechanisms': 8,
      'safety-reassessment-and-human-factors': 8,
      'high-peak-pressure-integration': 8,
    })
    for (const id of SECTION_IDS)
      ventilationStageLesson(id).steps.forEach((step, index) => {
        expect(step.ordinal).toBe(index + 1)
        expect(step.id).toBe(`${id}:${index + 1}-${step.phase}`)
      })
  })

  it('shows each screen once: the two kinds that repeated a neighbour are not separate stops', () => {
    for (const id of SECTION_IDS) {
      const lesson = ventilationStageLesson(id)
      const shown = ventilationPresentedStepIndexes(lesson)
      const hidden = lesson.steps.filter((step) => !isPresentedVentilationStep(step))
      for (const step of hidden) expect(['observe', 'interpret']).toContain(step.interaction.kind)
      // Nothing that asks, acts, measures or explains is dropped.
      for (const kind of ['prediction', 'simulator-task', 'explain', 'sort', 'locate', 'walk'])
        expect(shown.filter((index) => lesson.steps[index].interaction.kind === kind)).toHaveLength(
          lesson.steps.filter((step) => step.interaction.kind === kind).length,
        )
      expect(shown.length).toBe(lesson.steps.length - hidden.length)
      expect(shown[0]).toBe(0)
      expect(shown.at(-1)).toBe(lesson.steps.length - 1)
    }
    expect(
      ventilationPresentedStepIndexes(ventilationStageLesson('breathing-with-support')),
    ).toEqual([0, 1, 2, 5, 6, 7, 9])
    expect(ventilationPresentedStepIndexes(ventilationStageLesson('lung-protection'))).toEqual([
      0, 1, 2, 4, 5, 6, 7,
    ])
    expect(ventilationPresentedStepIndexes(ventilationStageLesson('oxygenation-response'))).toEqual(
      [0, 1, 2, 3],
    )
  })

  it('opens a saved position on a merged step at the step that carries its content', () => {
    for (const id of SECTION_IDS) {
      const lesson = ventilationStageLesson(id)
      lesson.steps.forEach((step, index) => {
        const target = resolvePresentedStepIndex(lesson, index)
        const opened = lesson.steps[target]
        expect(isPresentedVentilationStep(opened)).toBe(true)
        if (isPresentedVentilationStep(step)) expect(target).toBe(index)
        else {
          const round = (item: typeof step) =>
            'round' in item.interaction ? item.interaction.round : 0
          expect(round(opened)).toBe(round(step))
          expect(opened.interaction.kind).toBe(
            step.interaction.kind === 'observe' ? 'simulator-task' : 'explain',
          )
        }
      })
      expect(resolvePresentedStepIndex(lesson, 39)).toBe(lesson.steps.length - 1)
      expect(resolvePresentedStepIndex(lesson, -3)).toBe(0)
    }
  })

  it('reads and writes the reading location in the existing format, with no answer in it', () => {
    const stored = {
      version: 1,
      visited: ['breathing-with-support'],
      location: { section: 'learn', id: 'breathing-with-support', step: 4 },
    }
    localStorage.setItem(VENTILATION_SELF_PACED_KEY, JSON.stringify(stored))
    const before = Object.keys(localStorage).sort()
    render(<VentilationStageHost unitId="breathing-with-support" />)
    boot()
    // Position 4 was "Interpret your recorded result"; it opens that part's explanation.
    expect(document.querySelector('[data-current-step]')!.getAttribute('data-current-step')).toBe(
      ventilationStageLesson('breathing-with-support').steps[5].id,
    )
    expect(document.querySelector('[data-current-step]')!.textContent).toMatch(/Step 4 of 7/)
    // Answer the optional question on its own step, then read what was stored.
    fireEvent.change(screen.getByRole('combobox', { name: 'Choose step' }), {
      target: { value: '1' },
    })
    fireEvent.click(screen.getByLabelText('Expiration'))
    fireEvent.click(screen.getByRole('button', { name: 'Compare my choice' }))
    expect(document.querySelector('[data-choice-verdict]')).not.toBeNull()
    boot()
    const after = JSON.parse(localStorage.getItem(VENTILATION_SELF_PACED_KEY)!)
    expect(Object.keys(after).sort()).toEqual(['location', 'version', 'visited'])
    expect(after.version).toBe(1)
    expect(Object.keys(after.location).sort()).toEqual(['id', 'section', 'step'])
    expect(after.location).toEqual({ section: 'learn', id: 'breathing-with-support', step: 1 })
    expect(JSON.stringify(after)).not.toMatch(/Expiration|choice|answer/i)
    expect(Object.keys(localStorage).sort()).toEqual(before)
  })

  it('states the reading time and derives the experiment time from the rounds', () => {
    expect(ventilationSectionTimeLine('ventilation-and-co2')).toBe(
      'About 7 minutes to read. The optional experiments add about 180 seconds of simulated time at 1×, less on a faster clock.',
    )
    expect(ventilationSectionTimeLine('breathing-with-support')).toMatch(/have no timed run/)
    render(<VentilationStageHost unitId="ventilation-and-co2" />)
    boot()
    expect(document.querySelector('[data-section-time]')?.textContent).toBe(
      ventilationSectionTimeLine('ventilation-and-co2'),
    )
  })
})

/* ------------------------------------------------------------------------------------------------
 * Feedback: a verdict, a hint that is a cue, a lead-in that matches
 * ---------------------------------------------------------------------------------------------- */

describe('optional questions (Q1, Q2, Q3, N5, S7-4)', () => {
  const choices = [
    { id: 'a', label: 'First', rationale: 'Why first.' },
    { id: 'b', label: 'Second', rationale: 'Why second.' },
  ]

  it('opens the explanation without a choice and gives no verdict until one is compared', () => {
    render(
      <VentilationReinforcement
        id="q"
        purpose="p"
        prompt="Which?"
        choices={choices}
        explanation="The explanation."
        hint="A cue."
        bestChoiceId="b"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Show explanation' }))
    expect(screen.getByText('The explanation.')).toBeInTheDocument()
    expect(document.querySelector('[data-choice-verdict]')).toBeNull()
    expect(
      screen.getAllByRole('radio').every((radio) => !(radio as HTMLInputElement).checked),
    ).toBe(true)
  })

  it('leads with the verdict in words, names the best-supported answer, and keeps retry', () => {
    render(
      <VentilationReinforcement
        id="q"
        purpose="p"
        prompt="Which?"
        choices={choices}
        explanation="The explanation."
        hint="A cue."
        bestChoiceId="b"
        caseFit={false}
      />,
    )
    fireEvent.click(screen.getByLabelText('First'))
    fireEvent.click(screen.getByRole('button', { name: 'Compare my choice' }))
    const verdict = document.querySelector('[data-choice-verdict]')!
    expect(verdict.getAttribute('data-choice-verdict')).toBe('other')
    expect(verdict.textContent).toBe('Not the best-supported answer. Best supported: Second.')
    expect(document.querySelector('[data-compared-choice]')!.textContent).toBe(
      'Your choice: First. Why first.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(document.querySelector('[data-choice-verdict]')).toBeNull()
    fireEvent.click(screen.getByLabelText('Second'))
    fireEvent.click(screen.getByRole('button', { name: 'Compare my choice' }))
    expect(document.querySelector('[data-choice-verdict]')!.textContent).toBe(
      'Best-supported answer.',
    )
    expect(choiceVerdict('a', 'b', choices)).not.toMatch(/score|correct|wrong|grade/i)
    expect(document.body.textContent).not.toMatch(/\d+\s*(of|\/)\s*\d+ (correct|answered)/i)
  })

  it('gives every Learn item a verdict against its unchanged key', () => {
    const lesson = ventilationStageLesson('waveform-anatomy')
    render(<VentilationStageHost unitId="waveform-anatomy" />)
    boot()
    fireEvent.change(screen.getByRole('combobox', { name: 'Choose step' }), {
      target: { value: String(lesson.predictionStepIndex) },
    })
    const round = ventilationLearningExperiments.find((item) => item.unitId === 'waveform-anatomy')!
      .rounds[0]
    expect(round.correct).toBe(0)
    fireEvent.click(screen.getByLabelText(round.choices[1]))
    fireEvent.click(screen.getByRole('button', { name: 'Compare my choice' }))
    expect(document.querySelector('[data-choice-verdict]')!.textContent).toBe(
      `Not the best-supported answer. Best supported: ${round.choices[0]}.`,
    )
    // A Learn item is not a short case, so it is not said to "fit the case".
    expect(document.querySelector('[data-compared-choice]')!.textContent).not.toMatch(
      /fit the case/,
    )
  })

  it('offers a hint that is a cue, not the look line again and not an answer', () => {
    for (const experiment of ventilationLearningExperiments)
      for (const round of experiment.rounds) {
        expect(round.hint.length).toBeGreaterThan(20)
        expect(round.hint).not.toBe(round.look)
        for (const choice of round.choices)
          expect(round.hint.toLowerCase()).not.toContain(choice.toLowerCase())
        for (const rationale of round.rationales) expect(round.hint).not.toBe(rationale)
        // A hint adds no number the round did not already carry.
        const authored = `${round.introduction} ${round.look} ${round.prompt} ${round.task} ${round.explanation} ${round.rationales.join(' ')}`
        for (const number of round.hint.match(/\d+(\.\d+)?/g) ?? [])
          expect(number === '60' || authored.includes(number)).toBe(true)
      }
    render(<VentilationStageHost unitId="waveform-anatomy" />)
    boot()
    fireEvent.change(screen.getByRole('combobox', { name: 'Choose step' }), {
      target: { value: '1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Hint' }))
    const round = ventilationLearningExperiments.find((item) => item.unitId === 'waveform-anatomy')!
      .rounds[0]
    expect(screen.getByRole('status')).toHaveTextContent(round.hint)
  })

  it('matches the lead-in to what the item asks (Q2)', () => {
    const kind = (unitId: string, index: 0 | 1) =>
      roundQuestionKind(
        ventilationLearningExperiments.find((item) => item.unitId === unitId)!.rounds[index],
      )
    expect(kind('controls-and-goals', 0)).toBe('identify')
    expect(kind('controls-and-goals', 1)).toBe('identify')
    expect(kind('safety-reassessment-and-human-factors', 0)).toBe('reflect')
    expect(kind('safety-reassessment-and-human-factors', 1)).toBe('interpret')
    expect(kind('mechanics-load-and-pressure', 0)).toBe('predict')
    expect(kind('high-peak-pressure-integration', 0)).toBe('interpret')
    render(<VentilationStageHost unitId="controls-and-goals" />)
    boot()
    fireEvent.change(screen.getByRole('combobox', { name: 'Choose step' }), {
      target: { value: '1' },
    })
    const question = document.querySelector('[data-reinforcement]')!
    expect(question.textContent).toContain('Identify the reading or control that answers this')
    expect(question.textContent).not.toContain('Predict the observable response to one change')
  })

  it('keeps step names, controls and the control strip open before any answer (N5, S7-4)', () => {
    render(<VentilationStageHost unitId="expiration-and-air-trapping" />)
    boot()
    const outline = screen.getByRole('combobox', { name: 'Choose step' })
    expect(outline).toHaveTextContent('Give expiration time back')
    expect(document.body.textContent).toContain('This is a guided walk-through')
    const strip = document.querySelector('[data-teaching-block="knob-strip"]')!
    expect(strip.textContent).toContain('nothing here is held back')
    expect(strip.textContent).toContain('In Part 2 the cycle-off ends a supported breath sooner')
    expect(
      screen.queryAllByRole('radio').some((radio) => (radio as HTMLInputElement).checked),
    ).toBe(false)
  })
})

/* ------------------------------------------------------------------------------------------------
 * Cases: explanation to the learner, hint that matches, honest empty comparison, neutral label
 * ---------------------------------------------------------------------------------------------- */

describe('case teaching (Q4, Q6, C8, C10, C11, C12)', () => {
  it('addresses every case explanation to the learner and adds no number to the casebook text', () => {
    expect(Object.keys(ventilationCaseTeaching).sort()).toEqual(
      mechanicalVentilationCases.map((item) => item.id).sort(),
    )
    for (const definition of mechanicalVentilationCases) {
      const text = ventilationCaseExplanation(definition.id)
      expect(text).not.toMatch(/\bthe learner\b|\blearners\b/i)
      expect(text).not.toMatch(/simulator should|case should|This case reinforces|rewards?\b/i)
      expect(text).not.toMatch(/\byou (did|performed|measured|chose|selected)\b/i)
      const source = `${definition.debrief} ${definition.hintLadder.join(' ')} ${definition.title}`
      for (const number of text.match(/\d+(\.\d+)?/g) ?? []) expect(source).toContain(number)
      // The casebook text itself is untouched.
      expect(definition.debrief.length).toBeGreaterThan(40)
    }
    expect(mechanicalVentilationCaseById.get('MV-01')!.debrief).toMatch(/The learner should not/)
  })

  it('offers a hint from the casebook that is about the question asked (C11)', () => {
    for (const definition of mechanicalVentilationCases)
      expect(definition.hintLadder).toContain(ventilationCaseMechanismHint(definition.id))
    expect(ventilationCaseMechanismHint('MV-01')).toBe(
      'Compare the change in Pplat and compliance after each PEEP step.',
    )
    expect(ventilationCaseMechanismHint('MV-01')).not.toMatch(/Which settings/)
  })

  it('gives the case question a verdict and no empty comparison panel (C12)', () => {
    for (const definition of mechanicalVentilationCases)
      for (const option of definition.mechanismOptions)
        expect('rationale' in option ? option.rationale : undefined).toBeUndefined()
    render(
      <MechanicalVentilationCaseActivityV2
        caseId="MV-13"
        deviceId="hamilton-c6"
        mode="practice"
        section="practice"
      />,
    )
    boot()
    const definition = mechanicalVentilationCaseById.get('MV-13')!
    const question = document.querySelector('[data-reinforcement="MV-13-mechanism"]') as HTMLElement
    expect(question.textContent).toContain('A guided comparison, not a test')
    const other = definition.mechanismOptions.find(
      (option) => option.id !== definition.correctMechanismId,
    )!
    const best = definition.mechanismOptions.find(
      (option) => option.id === definition.correctMechanismId,
    )!
    fireEvent.click(within(question).getByLabelText(other.label))
    fireEvent.click(within(question).getByRole('button', { name: 'Compare my choice' }))
    expect(question.querySelector('[data-choice-verdict]')!.textContent).toBe(
      `Not the best-supported answer. Best supported: ${best.label}.`,
    )
    expect(within(question).queryByText('Compare the possibilities')).toBeNull()
    expect(question.querySelector('[data-no-option-rationales]')!.textContent).toMatch(
      /gives no written reason for each alternative, so none is shown/,
    )
    expect(question.textContent).toContain(ventilationCaseExplanation('MV-13'))
  })

  it('keeps a comparison panel wherever reasons exist', () => {
    render(<MechanicalVentilationCourseCheck kind="final" />)
    fireEvent.click(screen.getByRole('button', { name: 'Show explanation' }))
    expect(screen.getByText('Compare the possibilities')).toBeInTheDocument()
    expect(document.querySelector('[data-no-option-rationales]')).toBeNull()
  })

  it('shows the learner explanation, not the casebook wording (Q6)', () => {
    render(
      <MechanicalVentilationCaseActivityV2
        caseId="MV-01"
        deviceId="hamilton-c6"
        mode="practice"
        section="practice"
      />,
    )
    boot()
    fireEvent.click(screen.getAllByRole('button', { name: 'Show explanation' })[0])
    const explanation = document.querySelector('[data-case-explanation]') as HTMLElement
    expect(explanation.querySelector('[data-case-learner-explanation]')!.textContent).toBe(
      ventilationCaseExplanation('MV-01'),
    )
  })

  it('names the sedation action neutrally and keeps its safety teaching and behaviour (C8)', () => {
    for (const caseId of ['MV-04', 'MV-15']) {
      const action = mechanicalVentilationCaseById
        .get(caseId)!
        .interventions.find((item) => item.id === 'deepen-sedation')!
      expect(action.label).toBe('Deepen sedation')
      expect(action.unsafe).toBe(true)
      expect(action.effectId).toBe('deepen-sedation')
      expect(action.latencySeconds).toBe(45)
      expect(action.description).toMatch(/does not address timing, load, pain, or delirium/)
    }
    render(
      <MechanicalVentilationCaseActivityV2
        caseId="MV-15"
        deviceId="hamilton-c6"
        mode="practice"
        section="practice"
      />,
    )
    boot()
    const button = screen.getByRole('button', { name: 'Deepen sedation' })
    expect(button.parentElement!.querySelector('[data-action-description]')!.textContent).toMatch(
      /does not address timing, load, pain, or delirium/,
    )
    const definition = mechanicalVentilationCaseById.get('MV-15')!
    expect(document.querySelectorAll('[data-action-description]')).toHaveLength(
      definition.interventions.length,
    )
  })

  it.each(['practice', 'assess'] as const)(
    'keeps MV-03 a worked explanation with no live patient on the %s path (C10)',
    (section) => {
      render(
        <MechanicalVentilationCaseActivityV2
          caseId="MV-03"
          deviceId="hamilton-c6"
          mode="practice"
          section={section}
          seedToken="any-seed"
        />,
      )
      boot()
      const page = document.querySelector('[data-mv03-model-hold]') as HTMLElement
      expect(page).not.toBeNull()
      expect(screen.queryByText('Console observed by test')).toBeNull()
      expect(document.querySelector('[data-case-flow]')).toBeNull()
      expect(screen.queryByRole('button', { name: /Run physiology|Restart patient/ })).toBeNull()
      const main = page.querySelector('[data-case-learner-explanation]')!.textContent!
      expect(main).toBe(ventilationCaseExplanation('MV-03'))
      expect(main).not.toMatch(/simulator should/i)
      expect(page.textContent).not.toMatch(/review complete|approved/i)
    },
  )
})

/* ------------------------------------------------------------------------------------------------
 * Terminology, units and sources
 * ---------------------------------------------------------------------------------------------- */

describe('terminology and sources (T2, T3, V5, S3-1, S4-2, S6-1)', () => {
  it('uses one control taxonomy and does not claim it is the whole console', () => {
    expect(VENTILATION_CONTROL_PANEL.knobs.map((knob) => knob.id)).toEqual([
      'mode',
      'breath-size',
      'rate',
      'peep',
      'oxygen',
    ])
    expect(VENTILATION_CONTROL_PANEL.sentence).toMatch(/^Five settings do most of the work/)
    expect(VENTILATION_CONTROL_PANEL.shapingSentence).toMatch(
      /Other modes add settings of their own/,
    )
    expect(VENTILATION_CONTROL_PANEL.notSettingsSentence).toMatch(
      /Pause and Run are playback, a hold is a measurement/,
    )
    const section3 = ventilationUnitById.get('controls-and-goals')!
    for (const name of ['mode', 'size of the breath', 'rate', 'PEEP', 'oxygen'])
      expect(section3.explanation).toContain(name)
    const round = ventilationLearningExperiments.find(
      (item) => item.unitId === 'controls-and-goals',
    )!.rounds[0]
    expect(round.introduction).toMatch(/mode, breath size, rate, PEEP and oxygen/)
    expect(round.introduction).not.toMatch(/volume, rate, flow, oxygen, and PEEP/)
  })

  it('states the total-rate rule for when the patient triggers faster than the set rate (S3-1)', () => {
    const row = ventilationSettingSort.rows.find((item) => item.id === 'total-rate')!
    expect(row.rationale).toMatch(/only when the patient triggers breaths faster than the set rate/)
    expect(row.rationale).not.toMatch(/whenever the patient triggers/)
  })

  it('says previous value, not baseline, in the Section 4 worked example (S4-2)', () => {
    const situation = ventilationUnitById.get('mechanics-load-and-pressure')!.example.situation
    expect(situation).toMatch(/stays near its previous value/)
    expect(situation).not.toMatch(/near baseline/)
  })

  it('credits the ARDS limits to the 2017 guideline and their retention to the 2024 update (S6-1)', () => {
    const origin = ventilationEvidenceById.get('ats-esicm-sccm-ards-2017')!
    const update = ventilationEvidenceById.get('ats-ards-2024')!
    expect(origin.citation).toMatch(/2017;195:1253–1263/)
    expect(origin.citation).toMatch(/10\.1164\/rccm\.201703-0548ST/)
    expect(origin.supports.join(' ')).toMatch(/Origin of the adult ARDS limits/)
    expect(origin.limitations).toMatch(/not .*a rule for every ventilated patient/)
    expect(update.supports.join(' ')).toMatch(/Retains the 2017 recommendation/)
    expect(update.supports.join(' ')).toMatch(/did not originate/)
    // The update's own recommendations are still credited to it.
    expect(update.supports.join(' ')).toMatch(/higher PEEP without prolonged lung recruitment/)
    const unit = ventilationUnitById.get('lung-protection')!
    expect(unit.evidenceIds).toEqual([
      'ardsnet-arma-2000',
      'ats-esicm-sccm-ards-2017',
      'ats-ards-2024',
      'amato-driving-pressure-2015',
      'aarc-assessment-2024',
    ])
  })

  it('lists each source with what it supports and no file hash (T3)', () => {
    const records = [
      'hamilton-c6-manual-1.2.x',
      'tobin-3e-monitoring',
      'bounded-ventilation-model',
    ].map((id) => ventilationEvidenceById.get(id)!)
    const { container } = render(<VentilationSourceList records={records} claimsVisible />)
    const list = container.querySelector('[data-source-list]')!
    // The citation a learner reads carries no file hash; what it supports is still beside it.
    expect(list.textContent).not.toMatch(/SHA-256/)
    expect(list.querySelectorAll('[data-source-claims]')).toHaveLength(records.length)
  })

  it('uses one unit style in teaching text; device labels and the casebook keep their own (V5)', () => {
    const exempt = new Set([
      // Native console labels and ranges, as the registered manuals print them.
      'content/deviceProfiles.ts',
      'components/MechanicalVentilatorConsole.tsx',
      // A code comment quoting the casebook.
      'components/BedsidePanel.tsx',
    ])
    const files = (directory: string): string[] =>
      readdirSync(path.join(featureRoot, directory), { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? files(path.join(directory, entry.name))
          : /\.tsx?$/.test(entry.name)
            ? [path.join(directory, entry.name)]
            : [],
      )
    const offenders = [...files('components'), ...files('content')]
      .filter((file) => !exempt.has(file))
      .filter((file) =>
        /cm H₂O|cm H2O|mm Hg/.test(readFileSync(path.join(featureRoot, file), 'utf8')),
      )
    expect(offenders).toEqual([])
  })
})

/* ------------------------------------------------------------------------------------------------
 * The learner-copy guard's two findings
 * ---------------------------------------------------------------------------------------------- */

describe('the matched PEEP comparison names no software internals', () => {
  it('captions its values as model-generated, in both layouts', () => {
    const { container } = render(<VentilationPeepComparison explanationOpen={false} />)
    expect(container.querySelector('caption')!.textContent).toBe(
      'Model-generated example values · no hold acquired',
    )
    expect(container.querySelector('[data-peep-readings-compact] p')!.textContent).toBe(
      'Model-generated example values · no hold acquired',
    )
    expect(container.textContent).not.toMatch(/(^|[^A-Za-z0-9])engine(?=$|[^A-Za-z0-9])/i)
    const source = readFileSync(
      path.join(featureRoot, 'components/stage/VentilationPeepComparison.tsx'),
      'utf8',
    )
    expect(source).not.toMatch(/Engine-generated/)
  })
})
