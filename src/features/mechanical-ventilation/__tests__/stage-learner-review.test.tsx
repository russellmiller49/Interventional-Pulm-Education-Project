import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { VentilationStageHost } from '../components/stage/VentilationStageHost'
import { ventilatorDeviceProfiles } from '../content/deviceProfiles'
import { ventilationLearningUnits } from '../content/learningCurriculum'
import {
  ventilationPresentedStepIndexes,
  ventilationStageLesson,
  ventilationStageLessonErrors,
} from '../content/stageLessons'
import { breathStopIds, breathStop } from '../content/breathSpine'
import { VENTILATION_LAB_STORAGE_KEY } from '../engine/learningLab'
import {
  chooseStep,
  nowPrimary,
  nowPrimaryLabel,
  openConsoleScreen,
  pressClock,
  setConsoleControl,
} from '../test-support/stageHost'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn() }),
}))
beforeEach(() => {
  localStorage.clear()
  jest.useFakeTimers()
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})
const boot = () => act(() => jest.advanceTimersByTime(10))
function mount(unitId: string) {
  render(<VentilationStageHost unitId={unitId} />)
  boot()
  return ventilationStageLesson(unitId)
}
function openAction(unitId: string) {
  const lesson = ventilationStageLesson(unitId)
  chooseStep(lesson.steps.findIndex((step) => step.interaction.kind === 'simulator-task'))
}

describe('self-paced task presentation and preserved device/measurement behavior', () => {
  it.each(ventilationLearningUnits.map((unit) => unit.id))(
    '%s retains stable lesson identities and one working patient',
    (unitId) => {
      const lesson = mount(unitId)
      expect(ventilationStageLessonErrors(lesson)).toEqual([])
      expect(document.querySelectorAll('[data-current-step]')).toHaveLength(1)
      // One console at most: the PEEP section opens on its worked comparison instead.
      expect(document.querySelectorAll('[data-ventilation-console]').length).toBeLessThanOrEqual(1)
      expect(document.querySelectorAll('[data-device]').length).toBeLessThanOrEqual(1)
      expect(document.querySelectorAll('[data-step-list] li')).toHaveLength(
        ventilationPresentedStepIndexes(lesson).length,
      )
      expect(localStorage.getItem(VENTILATION_LAB_STORAGE_KEY)).toBeNull()
    },
  )

  it('keeps each waveform landmark on one synchronized worked reference without recording a run', () => {
    mount('waveform-anatomy')
    for (const stop of breathStopIds) {
      // The walk's stops are the breath map's own pins.
      fireEvent.click(screen.getByRole('button', { name: breathStop(stop).title }))
      expect(
        screen.getByRole('button', { name: breathStop(stop).title }).getAttribute('aria-pressed'),
      ).toBe('true')
      const reference = document.querySelector('[data-guided-stop="' + stop + '"]')!
      expect(reference).not.toBeNull()
      const cursors = Array.from(reference.querySelectorAll('[data-time-cursor]')).map((node) =>
        node.getAttribute('data-time-cursor'),
      )
      expect(cursors).toHaveLength(3)
      expect(new Set(cursors).size).toBe(1)
    }
    expect(localStorage.getItem(VENTILATION_LAB_STORAGE_KEY)).toBeNull()
  })

  it('requires an actual measurement and response interval, while reading can continue', () => {
    const unitId = 'mechanics-load-and-pressure'
    mount(unitId)
    openAction(unitId)
    // Nothing to run or capture until every requested change is in place.
    expect(nowPrimary()).toBeNull()
    fireEvent.change(screen.getByRole('slider', { name: /Patient resistance/ }), {
      target: { value: '2' },
    })
    expect(nowPrimary()).toBeNull()
    openConsoleScreen('tools')
    fireEvent.click(document.getElementById('mv-hold-inspiratory')!)
    pressClock('run')
    act(() => jest.advanceTimersByTime(30000))
    // A live run that reaches the capture gate captures by itself.
    expect(document.querySelector('[data-captured-result-near-task]')).not.toBeNull()
    expect(screen.getByText('Captured baseline and observed response')).toBeInTheDocument()
    expect(nowPrimaryLabel()).toBe('Continue')
    expect(localStorage.getItem(VENTILATION_LAB_STORAGE_KEY)).toBeNull()
  })

  it('bedside review does not stand in for an acquired plateau in the integration case', () => {
    mount('high-peak-pressure-integration')
    openAction('high-peak-pressure-integration')
    expect(document.querySelector('[data-metric="plateau"] dd')).toHaveTextContent(
      'Acquire a current inspiratory hold',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Assess the patient' }))
    expect(document.querySelector('[data-metric="plateau"] dd')).toHaveTextContent(
      'Acquire a current inspiratory hold',
    )
    // The hold is still owed: the card offers where to find it, and nothing to run or capture.
    expect(nowPrimary()).toBeNull()
    expect(screen.getByRole('button', { name: /Show me where/ })).toBeEnabled()
  })

  it.each(ventilatorDeviceProfiles)(
    '$shortName holds a pending edit until the console confirms it, without an answer',
    (profile) => {
      mount('controls-and-goals')
      fireEvent.click(screen.getByText('Console options'))
      fireEvent.change(screen.getByRole('combobox', { name: 'Console' }), {
        target: { value: profile.id },
      })
      openAction('controls-and-goals')
      setConsoleControl('vtMl', 500, { confirm: false })
      expect(document.querySelectorAll('[data-device]')).toHaveLength(1)
      if (profile.commitBehavior === 'immediate') {
        expect(document.getElementById('mv-pending-confirm')).toBeNull()
        expect(nowPrimaryLabel()).toMatch(/^Run \d+ s and capture$/)
      } else {
        // The requested change is not in place until the console accepts it.
        expect(nowPrimary()).toBeNull()
        expect(document.querySelector('[data-guided-instruction]')?.textContent).toMatch(
          profile.id === 'carefusion-avea' ? /press ACCEPT/ : /press the knob/,
        )
        fireEvent.click(document.getElementById('mv-pending-confirm')!)
        expect(nowPrimaryLabel()).toMatch(/^Run \d+ s and capture$/)
      }
      expect(screen.getByRole('combobox', { name: 'Console' })).toBeEnabled()
      expect(localStorage.getItem(VENTILATION_LAB_STORAGE_KEY)).toBeNull()
    },
  )
})
