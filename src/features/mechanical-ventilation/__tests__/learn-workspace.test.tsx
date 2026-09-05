import { ventilationLearningUnits } from '../content/learningCurriculum'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'

import { MechanicalVentilationLessonActivity } from '../components/MechanicalVentilationLessonActivity'
import { criticalCareActivityPhases } from '@/features/learning-module/activity'
import { mechanicalVentilationLessons } from '../content'

const push = jest.fn()

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
  useRouter: () => ({ push }),
}))

function lessonById(id: string) {
  const lesson = mechanicalVentilationLessons.find((candidate) => candidate.id === id)
  if (!lesson) throw new Error(`Expected lesson ${id}`)
  return lesson
}

const phaseLabels: Readonly<Record<string, string>> = {
  recognize: 'Recognize',
  predict: 'Predict',
  act: 'Act',
  observe: 'Observe',
  explain: 'Explain',
  transfer: 'Transfer',
}

function openPhase(phase: string) {
  fireEvent.click(screen.getByRole('button', { name: `Open ${phaseLabels[phase]} phase` }))
}

/**
 * What the standard-laptop workspace has to keep true.
 *
 * jsdom does no layout, so nothing here asserts a pixel. These hold the structural facts the
 * browser measurements depend on: which surfaces coexist, which of them are chrome rather than
 * pane content, and which nodes survive a phase change (a pane that is never unmounted keeps its
 * own scroll offset, which is how the learner's position is preserved). The measured acceptance
 * lives in `scripts/critical-care/measure-mv-learn-layout.mjs`.
 */
describe('the mechanical ventilation Learn workspace', () => {
  beforeEach(() => {
    window.localStorage.clear()
    push.mockClear()
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn().mockReturnValue({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }),
    })
  })

  async function renderLesson(id = 'waveform-anatomy') {
    render(<MechanicalVentilationLessonActivity lesson={lessonById(id)} />)
    await screen.findByRole('heading', { name: lessonById(id).title })
  }

  it('keeps the live ventilator surface and the current task in the same layout', async () => {
    await renderLesson()

    const ventilatorPane = screen.getByRole('region', { name: 'Ventilator panel' })
    expect(within(ventilatorPane).getByRole('img', { name: /Paw waveform/ })).toBeInTheDocument()

    const taskPane = screen.getByRole('region', { name: 'Your turn panel' })
    const task = within(taskPane).getByRole('region', { name: 'Your turn' })
    expect(task).toBeInTheDocument()

    // Neither is inside the other, and neither is inside the collapsed task drawer.
    expect(ventilatorPane.contains(task)).toBe(false)
    expect(taskPane.contains(ventilatorPane)).toBe(false)
  })

  it('preserves the live, teaching, action pane order', async () => {
    await renderLesson()

    const [first, second, third] = ['Ventilator panel', 'Teaching panel', 'Your turn panel'].map(
      (name) => screen.getByRole('region', { name }),
    )
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(second.compareDocumentPosition(third) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps the live measurements with the surface that produces them', async () => {
    await renderLesson()

    const ventilatorPane = screen.getByRole('region', { name: 'Ventilator panel' })
    const measurements = within(ventilatorPane).getByLabelText('Current lesson measurements')
    // Every reading the lesson used to print in a full-width row below the workspace is still here.
    for (const label of ['Ppeak', 'Pplat', 'VTE', 'Intrinsic PEEP', 'SpO₂', 'PaCO₂', 'MAP']) {
      expect(within(measurements).getByText(label)).toBeInTheDocument()
    }
  })

  it('keeps pause and resume out of the panes, in every phase', async () => {
    await renderLesson()

    for (const phase of criticalCareActivityPhases) {
      if (phase !== 'recognize') openPhase(phase)
      const clock = screen.getByRole('region', { name: 'Lesson simulation clock' })
      const toggle = within(clock).getByRole('button', { name: /^(Pause|Start ventilation)$/ })
      expect(toggle).toBeInTheDocument()
      for (const pane of ['Ventilator panel', 'Teaching panel', 'Your turn panel']) {
        expect(screen.getByRole('region', { name: pane }).contains(clock)).toBe(false)
      }
    }
  })

  it('keeps one pause control with one state', async () => {
    await renderLesson()

    expect(screen.getAllByRole('region', { name: 'Lesson simulation clock' })).toHaveLength(1)
    const toggle = screen.getByRole('button', { name: 'Pause' })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(toggle)
    const resumed = screen.getByRole('button', { name: 'Start ventilation' })
    expect(resumed).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getAllByRole('button', { name: /^(Pause|Start ventilation)$/ })).toHaveLength(1)
  })

  it('answers Help where the learner is working, in every phase', async () => {
    await renderLesson()

    for (const phase of criticalCareActivityPhases) {
      if (phase !== 'recognize') openPhase(phase)
      const help = screen.getByRole('button', { name: 'Help' })
      expect(help).toBeInTheDocument()
      fireEvent.click(help)

      const taskPane = screen.getByRole('region', { name: 'Your turn panel' })
      const hint = taskPane.querySelector('[data-mv-learn-hint]')
      expect(hint).not.toBeNull()
      expect(hint).toHaveTextContent(lessonById('waveform-anatomy').phases[phase].teachingPoint)
    }
  })

  it('does not hide pause behind the Help answer', async () => {
    await renderLesson()

    fireEvent.click(screen.getByRole('button', { name: 'Help' }))
    const clock = screen.getByRole('region', { name: 'Lesson simulation clock' })
    const hint = screen
      .getByRole('region', { name: 'Your turn panel' })
      .querySelector('[data-mv-learn-hint]')
    expect(hint).not.toBeNull()
    expect(clock.contains(hint)).toBe(false)
    expect(within(clock).getByRole('button', { name: /^(Pause|Start ventilation)$/ })).toBeVisible()
  })

  it('leaves the live evidence in place when the verdict appears', async () => {
    await renderLesson('mechanics-load-and-pressure')

    openPhase('predict')
    const ventilatorPane = screen.getByRole('region', { name: 'Ventilator panel' })
    const waveformBefore = within(ventilatorPane).getByRole('img', { name: /Paw waveform/ })

    const taskPane = screen.getByRole('region', { name: 'Your turn panel' })
    fireEvent.click(within(taskPane).getAllByRole('radio')[0])
    fireEvent.click(within(taskPane).getByRole('button', { name: 'Commit prediction' }))

    expect(document.querySelector('[data-plausibility]')).not.toBeNull()
    // Same pane, same node: the verdict is rendered inside the task pane and cannot displace the
    // trace the learner answered from.
    expect(screen.getByRole('region', { name: 'Ventilator panel' })).toBe(ventilatorPane)
    expect(within(ventilatorPane).getByRole('img', { name: /Paw waveform/ })).toBe(waveformBefore)
    expect(ventilatorPane.querySelector('[data-plausibility]')).toBeNull()
  })

  it('puts the causal debrief in the teaching pane rather than below the workspace', async () => {
    await renderLesson()

    openPhase('explain')
    const teachingPane = screen.getByRole('region', { name: 'Teaching panel' })
    expect(
      within(teachingPane).getByRole('heading', { name: 'Causal debrief' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Ventilator panel' })).toBeInTheDocument()
  })

  it('never unmounts a pane across a phase change, so its scroll position survives', async () => {
    await renderLesson()

    const paneNames = ['Ventilator panel', 'Teaching panel', 'Your turn panel'] as const
    const before = paneNames.map((name) => screen.getByRole('region', { name }))

    for (const phase of ['predict', 'act', 'observe', 'explain', 'transfer']) {
      openPhase(phase)
      paneNames.forEach((name, index) => {
        expect(screen.getByRole('region', { name })).toBe(before[index])
      })
    }
  })

  it('keeps the section rail and the run control in one persistent strip', async () => {
    await renderLesson()

    const rail = screen.getByRole('navigation', { name: /Ventilation learning pathway/ })
    const clock = screen.getByRole('region', { name: 'Lesson simulation clock' })
    const strip = rail.parentElement
    expect(strip).not.toBeNull()
    expect(strip?.contains(clock)).toBe(true)
  })

  it('does not change lesson, section, or activity identifiers', async () => {
    await renderLesson()

    // The rail still offers every authored section, by its authored id.
    for (const lesson of ventilationLearningUnits) {
      expect(
        screen.getByRole('button', {
          name: `${ventilationLearningUnits.indexOf(lesson) + 1}. ${lesson.title}${lesson.stage === 'integration' ? ', integration capstone' : ''}`,
        }),
      ).toBeInTheDocument()
    }
    expect(screen.getByText(/Checkpoint: lesson-recognize · MV-01/)).toBeInTheDocument()
  })
})
