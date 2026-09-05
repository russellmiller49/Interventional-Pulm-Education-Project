import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MechanicalVentilationLearningActivity } from '../components/MechanicalVentilationLearningActivity'
import { MechanicalVentilationCourseHome } from '../components/MechanicalVentilationCourseHome'
import { MechanicalVentilationCourseCheck } from '../components/MechanicalVentilationCourseCheck'
import { ventilationLearningUnits } from '../content/learningCurriculum'
import { ventilationExperimentByUnit } from '../content/learningExperiments'
import { unitQuestion, ventilationPlacementQuestions } from '../content/learningQuestions'
import {
  emptyVentilationLearningProgress,
  emptyVentilationUnitProgress,
  VENTILATION_LEARNING_STORAGE_KEY,
} from '../engine/learningProgress'
import { labCheckpoint, parseLabProgress, VENTILATION_LAB_STORAGE_KEY } from '../engine/learningLab'
import { completeLabUnit } from '../test-support/live-learning'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
beforeEach(() => {
  localStorage.clear()
  jest.useFakeTimers()
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})
afterEach(() => {
  jest.useRealTimers()
})
function boot() {
  act(() => {
    jest.advanceTimersByTime(10)
  })
}
function load(id: string) {
  const unit = ventilationLearningUnits.find((u) => u.id === id)!
  const result = render(
    <MechanicalVentilationLearningActivity unit={JSON.parse(JSON.stringify(unit))} />,
  )
  boot()
  return result
}
function predict(id: string, choice = 0) {
  fireEvent.click(screen.getByRole('button', { name: 'Try the experiment' }))
  fireEvent.click(
    screen.getByRole('radio', {
      name: ventilationExperimentByUnit.get(id)!.rounds[0].choices[choice],
    }),
  )
  fireEvent.click(screen.getByRole('button', { name: /Commit prediction/ }))
}

describe('learning on the running ventilator', () => {
  it('opens the actual running supported breath directly and keeps every unit reachable', () => {
    render(<MechanicalVentilationCourseHome />)
    boot()
    boot()
    expect(screen.getByTestId('live-learning-console')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pause simulation' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: ventilationLearningUnits[0].title }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Learning map/ }))
    const map = screen.getByRole('dialog', { name: 'Learning map' })
    for (const unit of ventilationLearningUnits)
      expect(
        within(map).getByRole('link', {
          name: new RegExp(unit.shortTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        }),
      ).toHaveAttribute('href', `/mechanical-ventilation/learn?activity=${unit.id}`)
  })
  it('keeps the live console mounted during prediction while withholding explanation and treatment changes', () => {
    const id = 'mechanics-load-and-pressure'
    load(id)
    const console = screen.getByTestId('live-learning-console')
    fireEvent.click(screen.getByRole('button', { name: 'Try the experiment' }))
    expect(screen.getByTestId('live-learning-console')).toBe(console)
    expect(screen.getByRole('slider', { name: /Patient resistance/ })).toBeDisabled()
    expect(screen.queryByText('Explain the physiology on this ventilator')).not.toBeInTheDocument()
    for (const rationale of ventilationExperimentByUnit.get(id)!.rounds[0].rationales)
      expect(screen.queryByText(rationale)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Commit prediction/ })).toBeDisabled()
    fireEvent.click(screen.getAllByRole('radio')[0])
    fireEvent.click(screen.getByRole('button', { name: /Commit prediction/ }))
    expect(screen.getByTestId('live-learning-console')).toBe(console)
    expect(screen.getByRole('slider', { name: /Patient resistance/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Compare the response' })).toBeDisabled()
  })
  it('changes real pressure and saves a before/after comparison only after actions and observation', () => {
    const id = 'mechanics-load-and-pressure'
    load(id)
    predict(id)
    const before = Number(
      document.querySelector('[data-metric="peak"] dd')!.textContent!.split('cm')[0],
    )
    fireEvent.change(screen.getByRole('slider', { name: /Patient resistance/ }), {
      target: { value: '2' },
    })
    expect(screen.getByRole('button', { name: 'Compare the response' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Perform inspiratory hold' }))
    expect(screen.getByRole('button', { name: 'Compare the response' })).toBeDisabled()
    act(() => jest.advanceTimersByTime(14000))
    const after = Number(
      document.querySelector('[data-metric="peak"] dd')!.textContent!.split('cm')[0],
    )
    expect(after).toBeGreaterThan(before + 4)
    fireEvent.click(screen.getByRole('button', { name: 'Compare the response' }))
    expect(
      screen.getByRole('table', { name: 'Recorded response from your experiment' }),
    ).toBeInTheDocument()
    const next = screen.getByRole('button', { name: 'Test the relationship in the next setup' })
    expect(next).toBeDisabled()
    fireEvent.change(
      screen.getByRole('textbox', { name: 'What changed, and what does it tell you?' }),
      { target: { value: 'Peak pressure rose, with a similar plateau during the hold.' } },
    )
    fireEvent.click(next)
    expect(
      screen.getByRole('heading', { name: 'Separate stiffness from resistance' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pause simulation' })).toBeInTheDocument()
    expect(
      parseLabProgress(localStorage.getItem(VENTILATION_LAB_STORAGE_KEY)).units[id].round,
    ).toBe(1)
  })
  it('restores a changed experiment in place, paused, with its original prediction', () => {
    const id = 'waveform-anatomy'
    const mounted = load(id)
    predict(id, 2)
    fireEvent.change(screen.getByRole('slider', { name: /Peak inspiratory flow/ }), {
      target: { value: '60' },
    })
    act(() => jest.advanceTimersByTime(6000))
    mounted.unmount()
    load(id)
    expect(screen.getByRole('button', { name: 'Run simulation' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /Peak inspiratory flow/ })).toHaveValue('60')
    expect(
      parseLabProgress(localStorage.getItem(VENTILATION_LAB_STORAGE_KEY)).units[id].evidence[0]
        .prediction,
    ).toBe(2)
  })
  it('uses prior experience for scaffolding while old reading completion cannot unlock the final check', () => {
    const old = { ...emptyVentilationLearningProgress() }
    for (const unit of ventilationLearningUnits) {
      old.units = {
        ...old.units,
        [unit.id]: {
          ...emptyVentilationUnitProgress(),
          step: 'recap',
          completedAt: '2026-09-05T01:00:00.000Z',
          answers: Object.fromEntries(
            ['check', 'transfer'].map((kind) => {
              const q = unitQuestion(unit.id, kind as 'check' | 'transfer')
              return [
                q.id,
                {
                  choiceId: q.correctId,
                  confidence: 'sure',
                  reviewed: true,
                  answeredAt: '2026-09-05T01:00:00.000Z',
                },
              ]
            }),
          ),
        },
      }
    }
    old.placement = Object.fromEntries(
      ventilationPlacementQuestions.map((q) => [
        q.id,
        {
          choiceId: q.correctId,
          confidence: 'sure',
          reviewed: true,
          answeredAt: '2026-09-05T01:00:00.000Z',
        },
      ]),
    )
    localStorage.setItem(VENTILATION_LEARNING_STORAGE_KEY, JSON.stringify(old))
    const mounted = load('waveform-anatomy')
    expect(screen.getByRole('button', { name: 'I have experience' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.queryByText('Watch one breath', { exact: true })).not.toBeInTheDocument()
    mounted.unmount()
    render(<MechanicalVentilationCourseCheck kind="final" />)
    boot()
    expect(
      screen.getByRole('heading', { name: 'Finish the learning path first.' }),
    ).toBeInTheDocument()
  })
  it('unlocks the final knowledge check from completed live evidence for all units', () => {
    const units = Object.fromEntries(
      ventilationLearningUnits.map((unit) => [unit.id, labCheckpoint(completeLabUnit(unit.id))]),
    )
    localStorage.setItem(VENTILATION_LAB_STORAGE_KEY, JSON.stringify({ version: 1, units }))
    render(<MechanicalVentilationCourseCheck kind="final" />)
    boot()
    expect(
      screen.queryByRole('heading', { name: 'Finish the learning path first.' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start final check' })).toBeInTheDocument()
  })
})
