import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { AirwayStentLearningLab } from '../components/learning-lab/AirwayStentLearningLab'
import { stentAssessmentItems } from '../content/learningLabCopy'
import {
  STENT_PROGRESS_STORAGE_KEY,
  createDefaultStentProgress,
  markLessonCompleted,
} from '../engine/learningLabProgress'

const push = jest.fn()
const replace = jest.fn()
const recordSiteModuleEvent = jest.fn()

jest.mock('next/navigation', () => ({
  usePathname: () => '/en/airway-stent-mechanics',
  useRouter: () => ({ push, replace }),
}))

jest.mock('@/lib/analytics', () => ({
  recordSiteModuleEvent: (...args: unknown[]) => recordSiteModuleEvent(...args),
}))

jest.mock('../components/learning-lab/StentArchitectureLabDynamic', () => ({
  StentArchitectureLabDynamic: ({
    experience,
    onExperienceProgress,
  }: {
    experience: string
    onExperienceProgress?: (progress: { completedIds: string[]; complete: boolean }) => void
  }) => (
    <section data-testid={`mock-lab-${experience}`}>
      <p>Mock visual lab: {experience}</p>
      {onExperienceProgress ? (
        <button
          type="button"
          onClick={() =>
            onExperienceProgress({
              completedIds: [`${experience}-one`, `${experience}-two`, `${experience}-three`],
              complete: true,
            })
          }
        >
          Complete {experience} experience
        </button>
      ) : null}
    </section>
  ),
}))

describe('AirwayStentLearningLab shell', () => {
  beforeEach(() => {
    window.localStorage.clear()
    push.mockClear()
    replace.mockClear()
    recordSiteModuleEvent.mockClear()
  })

  it('makes the guided Force Lab prominent on a fresh page and scrolls its CTA to the lab', async () => {
    const user = userEvent.setup()
    render(<AirwayStentLearningLab />)

    await waitFor(() => {
      expect(screen.queryByText('Restoring saved lesson progress…')).not.toBeInTheDocument()
    })

    expect(screen.getByRole('heading', { name: 'Start in the Force Lab' })).toBeVisible()
    expect(screen.getByText('Guided first · case practice later')).toBeVisible()
    expect(screen.getByText(/Amplitude represents displacement, not force/i)).toBeVisible()
    expect(screen.getByTestId('mock-lab-guided-force')).toBeVisible()

    const guidedAnchor = screen.getByTestId('mock-lab-guided-force').parentElement
    expect(guidedAnchor).toHaveAttribute('id', 'airway-stent-guided-force-lab')
    const scrollIntoView = jest.fn()
    Object.defineProperty(guidedAnchor, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })

    await user.click(screen.getByRole('button', { name: 'Start guided Force Lab' }))

    expect(push).toHaveBeenCalledWith('/en/airway-stent-mechanics?lesson=orient', {
      scroll: false,
    })
    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
    })
  })

  it('requires all guided scenes plus prediction and checkpoint before completing orient', async () => {
    const user = userEvent.setup()
    render(<AirwayStentLearningLab requestedLessonId="orient" />)

    await waitFor(() => {
      expect(screen.queryByText('Restoring saved lesson progress…')).not.toBeInTheDocument()
    })
    expect(screen.getByTestId('mock-lab-guided-force')).toBeVisible()
    expect(screen.queryByText('Name the obstruction morphology')).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'The residual mechanical job, if any' }))
    await user.click(screen.getByRole('button', { name: 'Commit and reveal' }))

    expect(screen.getByText('Name the obstruction morphology')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Lesson checkpoint' })).not.toBeInTheDocument()
    expect(screen.getByText(/Complete 3 remaining guided scenes/i)).toBeVisible()
    expect(screen.queryByText('Lesson completed')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Complete guided-force experience' }))

    expect(screen.getByRole('heading', { name: 'Lesson checkpoint' })).toBeVisible()

    await user.click(
      screen.getByRole('radio', {
        name: 'What architecture can support the residual wall while fitting its landing zones?',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Commit and reveal' }))

    expect(screen.getByText('Lesson completed')).toBeVisible()
    const saved = JSON.parse(window.localStorage.getItem(STENT_PROGRESS_STORAGE_KEY) ?? '{}') as {
      completedLessonIds?: string[]
    }
    expect(saved.completedLessonIds).toContain('orient')
    expect(recordSiteModuleEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'section_completed',
        moduleId: 'airway-stent-mechanics',
        section: 'orient',
        eventPayload: {
          experience: 'guided-force',
          completedSceneCount: 3,
        },
      }),
    )
  })

  it('uses the architecture explorer in lesson 2 after its opening prediction', async () => {
    const user = userEvent.setup()
    render(<AirwayStentLearningLab requestedLessonId="architectures" />)

    await waitFor(() => {
      expect(screen.queryByText('Restoring saved lesson progress…')).not.toBeInTheDocument()
    })
    expect(screen.queryByTestId('mock-lab-architecture-explorer')).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('radio', { name: 'No—trace crossings, rings, and connectors first' }),
    )
    await user.click(screen.getByRole('button', { name: 'Commit and reveal' }))

    expect(screen.getByTestId('mock-lab-architecture-explorer')).toBeVisible()
  })

  it('keeps Force Lab practice and its debrief gated in the force-lab deep link', async () => {
    const user = userEvent.setup()
    render(<AirwayStentLearningLab requestedLessonId="force-lab" />)

    await waitFor(() => {
      expect(screen.queryByText('Restoring saved lesson progress…')).not.toBeInTheDocument()
    })
    expect(
      screen.getByRole('heading', { name: 'Choose the constraint, then defend the claim' }),
    ).toBeVisible()
    expect(screen.queryByTestId('mock-lab-force-practice')).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('radio', { name: 'A difference in displayed geometric response' }),
    )
    await user.click(screen.getByRole('button', { name: 'Commit and reveal' }))

    expect(screen.getByTestId('mock-lab-force-practice')).toBeVisible()
    expect(screen.queryByText('Use the metric and method together')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Lesson checkpoint' })).not.toBeInTheDocument()
    expect(screen.getByText(/Complete 3 remaining practice missions/i)).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Complete force-practice experience' }))

    expect(screen.getByText('Use the metric and method together')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Lesson checkpoint' })).toBeVisible()

    await user.click(
      screen.getByRole('radio', {
        name: /RRF is read during compression; COF is read on expansion\/unloading/i,
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Commit and reveal' }))

    expect(screen.getByText('Lesson completed')).toBeVisible()
    expect(recordSiteModuleEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'section_completed',
        moduleId: 'airway-stent-mechanics',
        section: 'force-lab',
        eventPayload: {
          experience: 'force-practice',
          completedMissionCount: 3,
        },
      }),
    )
  })

  it('lets an explicit deep link override saved progress and keeps lesson navigation open', async () => {
    const saved = markLessonCompleted(createDefaultStentProgress(), 'tissue-time')
    window.localStorage.setItem(STENT_PROGRESS_STORAGE_KEY, JSON.stringify(saved))
    const user = userEvent.setup()

    render(<AirwayStentLearningLab requestedLessonId="force-lab" />)

    await waitFor(() => {
      expect(screen.queryByText('Restoring saved lesson progress…')).not.toBeInTheDocument()
    })
    expect(
      screen.getByRole('heading', { name: 'Choose the constraint, then defend the claim' }),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: /Assessment Open lesson/i }))

    expect(
      screen.getByRole('heading', { name: 'Commit across mechanics, tissue, and time' }),
    ).toBeVisible()
    expect(push).toHaveBeenCalledWith('/en/airway-stent-mechanics?lesson=assessment', {
      scroll: false,
    })
  })

  it('submits assessment analytics and records module completion after a full attempt', async () => {
    let saved = createDefaultStentProgress()
    for (const lessonId of [
      'orient',
      'architectures',
      'force-lab',
      'tissue-time',
      'evidence-decisions',
    ] as const) {
      saved = markLessonCompleted(saved, lessonId)
    }
    window.localStorage.setItem(STENT_PROGRESS_STORAGE_KEY, JSON.stringify(saved))
    const user = userEvent.setup()

    render(<AirwayStentLearningLab requestedLessonId="assessment" />)

    await waitFor(() => {
      expect(screen.queryByText('Restoring saved lesson progress…')).not.toBeInTheDocument()
    })

    for (const item of stentAssessmentItems) {
      const correct = item.choices.find((choice) => choice.id === item.correctChoiceId)
      expect(correct).toBeDefined()
      const radio = screen.getByRole('radio', { name: correct?.label })
      await user.click(radio)
      const caseCard = radio.closest('section')
      expect(caseCard).not.toBeNull()
      await user.click(
        within(caseCard as HTMLElement).getByRole('button', { name: 'Commit and reveal' }),
      )
    }

    await user.click(screen.getByRole('button', { name: 'Submit assessment' }))

    expect(recordSiteModuleEvent).toHaveBeenCalledWith({
      eventType: 'quiz_submitted',
      moduleId: 'airway-stent-mechanics',
      percentComplete: 100,
      eventPayload: {
        score: 6,
        total: 6,
        attempt: 1,
        mastery: true,
      },
    })
    expect(recordSiteModuleEvent).toHaveBeenCalledWith({
      eventType: 'module_completed',
      moduleId: 'airway-stent-mechanics',
      percentComplete: 100,
      eventPayload: {
        mastery: true,
        bestScore: 6,
        attempts: 1,
      },
    })
  })
})
