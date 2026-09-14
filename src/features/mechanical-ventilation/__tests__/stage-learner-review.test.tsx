import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { VentilationStageHost } from '../components/stage/VentilationStageHost'
import { ventilatorDeviceProfiles } from '../content/deviceProfiles'
import { ventilationLearningUnits } from '../content/learningCurriculum'
import { ventilationStageLesson, ventilationStageLessonErrors } from '../content/stageLessons'
import { breathStopIds, breathStop } from '../content/breathSpine'
import { VENTILATION_LAB_STORAGE_KEY } from '../engine/learningLab'

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
  fireEvent.change(screen.getByRole('combobox', { name: 'Choose step' }), {
    target: { value: lesson.steps.findIndex((step) => step.interaction.kind === 'simulator-task') },
  })
}

describe('self-paced task presentation and preserved device/measurement behavior', () => {
  it.each(ventilationLearningUnits.map((unit) => unit.id))(
    '%s retains stable lesson identities and one working patient',
    (unitId) => {
      const lesson = mount(unitId)
      expect(ventilationStageLessonErrors(lesson)).toEqual([])
      expect(document.querySelectorAll('[data-current-step]')).toHaveLength(1)
      expect(document.querySelectorAll('[data-task-workbench]')).toHaveLength(1)
      expect(
        screen.getByRole('combobox', { name: 'Choose step' }).querySelectorAll('option'),
      ).toHaveLength(lesson.steps.length)
      expect(localStorage.getItem(VENTILATION_LAB_STORAGE_KEY)).toBeNull()
    },
  )

  it('keeps each waveform landmark on one synchronized worked reference without recording a run', () => {
    mount('waveform-anatomy')
    for (const stop of breathStopIds) {
      fireEvent.click(screen.getByRole('button', { name: breathStop(stop).title }))
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
    expect(screen.getByRole('button', { name: 'Capture observed response' })).toBeDisabled()
    fireEvent.change(screen.getByRole('slider', { name: /Patient resistance/ }), {
      target: { value: '2' },
    })
    expect(screen.getByRole('button', { name: 'Capture observed response' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Perform inspiratory hold/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    act(() => jest.advanceTimersByTime(30000))
    expect(screen.getByRole('button', { name: 'Capture observed response' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Capture observed response' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Show explanation' })[0])
    expect(screen.getByText('Captured baseline and observed response')).toBeInTheDocument()
    expect(document.querySelector('[data-no-observation]')).toBeNull()
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
    expect(screen.getByRole('button', { name: 'Capture observed response' })).toBeDisabled()
    expect(
      screen
        .getAllByRole('button', { name: 'Continue' })
        .every((button) => !(button as HTMLButtonElement).disabled),
    ).toBe(true)
  })

  it.each(ventilatorDeviceProfiles)(
    '$shortName preserves pending edits and device confirmation across native views without an answer',
    (profile) => {
      mount('controls-and-goals')
      fireEvent.click(screen.getByText('Console and experiment options'))
      fireEvent.change(screen.getByRole('combobox', { name: 'Console' }), {
        target: { value: profile.id },
      })
      openAction('controls-and-goals')
      const controlled = () => document.querySelector('[data-controlled-inputs]')!.textContent
      const before = controlled()
      fireEvent.change(document.getElementById('mv-quick-vtMl')!, { target: { value: '500' } })
      if (profile.commitBehavior === 'immediate') expect(controlled()).toContain('500')
      else expect(controlled()).toBe(before)
      fireEvent.click(screen.getByRole('button', { name: /View full .* console/ }))
      expect(document.querySelectorAll('[data-device]')).toHaveLength(1)
      fireEvent.click(screen.getByRole('button', { name: 'Return to task controls' }))
      expect(document.querySelectorAll('#mv-quick-vtMl')).toHaveLength(1)
      expect(document.getElementById('mv-quick-vtMl')).toHaveValue('500')
      if (profile.commitBehavior !== 'immediate')
        fireEvent.click(
          screen.getByRole('button', {
            name: profile.id === 'carefusion-avea' ? 'ACCEPT' : 'Press knob to confirm',
          }),
        )
      expect(controlled()).toContain('500')
      expect(screen.getByRole('combobox', { name: 'Console' })).toBeEnabled()
      expect(localStorage.getItem(VENTILATION_LAB_STORAGE_KEY)).toBeNull()
    },
  )
})
