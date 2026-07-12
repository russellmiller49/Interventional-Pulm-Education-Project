import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { AirwayStentLearningLab } from '../components/learning-lab/AirwayStentLearningLab'
import {
  clinicalAssessmentItems,
  clinicalAssessmentMasteryThreshold,
} from '../content/clinicalModuleCopy'
import {
  STENT_PROGRESS_STORAGE_KEY,
  createDefaultStentProgress,
  markCaseCompleted,
  markCaseInteractionCompleted,
  markCaseSurveillanceCommitted,
  markLessonCompleted,
  setLastCase,
  setLastLesson,
} from '../engine/learningLabProgress'
import { STENT_LESSON_IDS } from '../engine/learningLabTypes'

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

jest.mock('../components/learning-lab/StentArchitectureViewport', () => ({
  StentArchitectureViewport: () => <div data-testid="mock-stent-viewport" />,
}))

async function waitForHydration() {
  await waitFor(() => {
    expect(screen.queryByText('Restoring saved clinical progress…')).not.toBeInTheDocument()
  })
}

async function chooseAndCommit(user: ReturnType<typeof userEvent.setup>, label: string) {
  const radio = screen.getByRole('radio', { name: label })
  await user.click(radio)
  const decision = radio.closest('section')
  expect(decision).not.toBeNull()
  await user.click(within(decision as HTMLElement).getByRole('button', { name: /commit/i }))
}

async function selectMixedIndicationCase(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole('button', { name: /Mixed obstruction with a residual external load/i }),
  )
  expect(screen.getByTestId('clinical-case-mixed-residual-extrinsic-compression')).toBeVisible()
}

async function completeIndicationBenefitChecklist(user: ReturnType<typeof userEvent.setup>) {
  const heading = screen.getByRole('heading', {
    name: 'Inspect whether a device can deliver a meaningful clinical benefit',
  })
  const section = heading.closest('section')
  expect(section).not.toBeNull()
  for (const label of [
    'Attributable symptoms and response',
    'Morphology after treatable obstruction',
    'Distal-airway patency',
    'Potentially functional distal lung',
    'Treatment trajectory and time horizon',
    'Patient goals and intended benefit',
  ]) {
    await user.click(
      within(section as HTMLElement).getByRole('checkbox', { name: new RegExp(label, 'i') }),
    )
  }
  await user.click(
    within(section as HTMLElement).getByRole('button', { name: 'Record benefit assessment' }),
  )
}

async function commitSurveillancePlan(user: ReturnType<typeof userEvent.setup>) {
  const heading = screen.getByRole('heading', {
    name: /Prescribe (?:follow-up with the stent plan|reassessment and the conditions)/i,
  })
  const section = heading.closest('section')
  expect(section).not.toBeNull()
  for (const checkbox of within(section as HTMLElement).getAllByRole('checkbox')) {
    await user.click(checkbox)
  }
  await user.click(
    within(section as HTMLElement).getByRole('button', { name: 'Commit surveillance plan' }),
  )
}

describe('AirwayStentLearningLab clinical-first shell', () => {
  beforeEach(() => {
    window.localStorage.clear()
    push.mockClear()
    replace.mockClear()
    recordSiteModuleEvent.mockClear()
  })

  it('starts a fresh learner with a clinical case and no required mechanics lab', async () => {
    render(<AirwayStentLearningLab />)

    await waitForHydration()

    expect(screen.getByRole('button', { name: 'Start a clinical case' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Should this airway be stented?' })).toBeVisible()
    expect(screen.queryByTestId(/mock-lab-/)).not.toBeInTheDocument()
    expect(screen.queryByTestId('mock-stent-viewport')).not.toBeInTheDocument()
  })

  it('offers a no-stent decision in the opening case', async () => {
    render(<AirwayStentLearningLab requestedLessonId="indication" />)

    await waitForHydration()

    expect(screen.getByRole('radio', { name: 'No stent now' })).toBeVisible()
  })

  it('resumes the saved active case within the last lesson', async () => {
    const saved = setLastCase(
      setLastLesson(createDefaultStentProgress(), 'indication'),
      'mixed-residual-extrinsic-compression',
    )
    window.localStorage.setItem(STENT_PROGRESS_STORAGE_KEY, JSON.stringify(saved))

    render(<AirwayStentLearningLab />)

    await waitForHydration()
    expect(screen.getByTestId('clinical-case-mixed-residual-extrinsic-compression')).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Mixed obstruction with a residual external load/i }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('rehydrates a completed case with defensible choices and its debrief visible', async () => {
    let saved = setLastCase(
      setLastLesson(createDefaultStentProgress(), 'indication'),
      'post-debulking-no-stent',
    )
    saved = markCaseInteractionCompleted(saved, 'post-debulking-no-stent', 'indication-benefit')
    saved = markCaseSurveillanceCommitted(saved, 'post-debulking-no-stent')
    saved = markCaseCompleted(saved, 'post-debulking-no-stent')
    window.localStorage.setItem(STENT_PROGRESS_STORAGE_KEY, JSON.stringify(saved))

    render(<AirwayStentLearningLab />)

    await waitForHydration()
    expect(
      await screen.findByText('Patent lumen with no demonstrated residual structural instability'),
    ).toBeVisible()
    expect(screen.getAllByText('Defensible choice')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Case completed' })).toBeDisabled()
    expect(
      screen.getByText(/A prior obstruction does not create a standing indication/i),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Surveillance plan committed' })).toBeDisabled()
  })

  it('requires both indication cases while keeping the optional physics lens non-gating', async () => {
    const user = userEvent.setup()
    render(<AirwayStentLearningLab requestedLessonId="indication" />)

    await waitForHydration()
    await selectMixedIndicationCase(user)
    await chooseAndCommit(
      user,
      'Stenting is reasonable if the residual job and clinical benefit are explicit',
    )

    expect(screen.getByTestId('physics-lens-drawer')).toBeVisible()
    expect(screen.queryByTestId('physics-lens-residual-extrinsic-load')).not.toBeInTheDocument()

    await chooseAndCommit(
      user,
      'Maintain left-mainstem patency while preserving both lobar pathways',
    )
    await chooseAndCommit(
      user,
      'Reassess patency, fit, symptoms, and ongoing indication as treatment changes anatomy',
    )
    await completeIndicationBenefitChecklist(user)
    await commitSurveillancePlan(user)
    await user.click(screen.getByRole('button', { name: 'Complete clinical case' }))

    expect(screen.queryByText('Lesson completed')).not.toBeInTheDocument()
    expect(screen.queryByTestId('mock-stent-viewport')).not.toBeInTheDocument()

    let saved = JSON.parse(window.localStorage.getItem(STENT_PROGRESS_STORAGE_KEY) ?? '{}') as {
      completedLessonIds?: string[]
    }
    expect(saved.completedLessonIds).not.toContain('indication')
    expect(recordSiteModuleEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'section_completed', section: 'indication' }),
    )

    await user.click(
      screen.getByRole('button', {
        name: /Stable airway after treatment of intrinsic obstruction/i,
      }),
    )
    await chooseAndCommit(user, 'No stent now')
    await chooseAndCommit(user, 'Document the achieved benefit and reassess if obstruction recurs')
    await completeIndicationBenefitChecklist(user)
    await commitSurveillancePlan(user)
    await user.click(screen.getByRole('button', { name: 'Complete clinical case' }))

    expect(screen.getByText('Lesson completed')).toBeVisible()
    saved = JSON.parse(window.localStorage.getItem(STENT_PROGRESS_STORAGE_KEY) ?? '{}') as {
      completedLessonIds?: string[]
    }
    expect(saved.completedLessonIds).toContain('indication')
    expect(recordSiteModuleEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'section_completed',
        moduleId: 'airway-stent-mechanics',
        section: 'indication',
        eventPayload: {
          caseId: 'post-debulking-no-stent',
          interaction: 'required_cases_completed',
          completionId: 'indication-required-cases-complete',
          requiredCaseIds: ['post-debulking-no-stent', 'mixed-residual-extrinsic-compression'],
        },
      }),
    )
  })

  it('does not complete a lesson merely because the physics lens was opened', async () => {
    const user = userEvent.setup()
    render(<AirwayStentLearningLab requestedLessonId="indication" />)

    await waitForHydration()
    await selectMixedIndicationCase(user)
    await chooseAndCommit(
      user,
      'Stenting is reasonable if the residual job and clinical benefit are explicit',
    )
    await user.click(
      within(screen.getByTestId('physics-lens-drawer')).getByRole('button', {
        name: /Optional physics lens/i,
      }),
    )

    expect(screen.getByTestId('physics-lens-residual-extrinsic-load')).toBeVisible()
    expect(await screen.findByTestId('mock-stent-viewport')).toBeVisible()
    expect(screen.queryByText('Lesson completed')).not.toBeInTheDocument()

    const saved = JSON.parse(window.localStorage.getItem(STENT_PROGRESS_STORAGE_KEY) ?? '{}') as {
      completedLessonIds?: string[]
    }
    expect(saved.completedLessonIds).not.toContain('indication')
    expect(recordSiteModuleEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventPayload: expect.objectContaining({ interaction: 'physics_lens_opened' }),
      }),
    )
    expect(recordSiteModuleEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'section_completed', section: 'indication' }),
    )
  })

  it('lets a learner revise the opening choice after inspecting the physics lens', async () => {
    const user = userEvent.setup()
    render(<AirwayStentLearningLab requestedLessonId="indication" />)

    await waitForHydration()
    await selectMixedIndicationCase(user)
    await chooseAndCommit(user, 'Do not consider a stent because debulking was completed')
    await user.click(
      within(screen.getByTestId('physics-lens-drawer')).getByRole('button', {
        name: /Optional physics lens/i,
      }),
    )
    expect(await screen.findByTestId('mock-stent-viewport')).toBeVisible()

    await user.click(
      screen.getByRole('radio', {
        name: 'Stenting is reasonable if the residual job and clinical benefit are explicit',
      }),
    )
    expect(screen.getByText(/A revised choice is selected/i)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Revise and recommit' }))

    expect(screen.getByText('Defensible choice')).toBeVisible()
    expect(recordSiteModuleEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventPayload: expect.objectContaining({
          interaction: 'decision_revised',
          caseId: 'mixed-residual-extrinsic-compression',
          choiceId: 'reasonable-with-defined-benefit',
        }),
      }),
    )
  })

  it('maps the legacy force-lab deep link to architecture choice and opens engineering', async () => {
    render(<AirwayStentLearningLab requestedLessonId="force-lab" />)

    await waitForHydration()

    expect(
      screen.getByRole('heading', { name: 'Choose an architecture, not merely a material' }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', {
        name: /Optional · does not affect module completion.*Advanced mechanics/i,
      }),
    ).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('mock-lab-architecture-explorer')).toBeVisible()
  })

  it('lets an explicit canonical deep link override saved v2 progress', async () => {
    const saved = markLessonCompleted(createDefaultStentProgress(), 'complications-surveillance')
    window.localStorage.setItem(STENT_PROGRESS_STORAGE_KEY, JSON.stringify(saved))

    render(<AirwayStentLearningLab requestedLessonId="architecture-choice" />)

    await waitForHydration()

    expect(
      screen.getByRole('heading', { name: 'Choose an architecture, not merely a material' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'When the airway worsens, identify what failed' }),
    ).not.toBeInTheDocument()

    const persisted = JSON.parse(
      window.localStorage.getItem(STENT_PROGRESS_STORAGE_KEY) ?? '{}',
    ) as { lastLessonId?: string }
    expect(persisted.lastLessonId).toBe('architecture-choice')
  })

  it('records dynamic assessment analytics and full module completion', async () => {
    let saved = createDefaultStentProgress()
    for (const lessonId of STENT_LESSON_IDS.filter((lessonId) => lessonId !== 'assessment')) {
      saved = markLessonCompleted(saved, lessonId)
    }
    window.localStorage.setItem(STENT_PROGRESS_STORAGE_KEY, JSON.stringify(saved))
    const user = userEvent.setup()

    render(<AirwayStentLearningLab requestedLessonId="assessment" />)

    await waitForHydration()
    expect(
      screen.getByRole('heading', {
        name: `Commit to all ${clinicalAssessmentItems.length} decisions`,
      }),
    ).toBeVisible()
    expect(
      screen.getByText(
        `Mastery: ${clinicalAssessmentMasteryThreshold}/${clinicalAssessmentItems.length}`,
      ),
    ).toBeVisible()

    for (const item of clinicalAssessmentItems) {
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
      eventPayload: {
        interaction: 'assessment_submitted',
        assessmentId: 'integrated-airway-stent-assessment',
        attemptId: 'assessment-attempt-1',
        completionId: 'mastery-achieved',
      },
    })
    expect(recordSiteModuleEvent).toHaveBeenCalledWith({
      eventType: 'module_completed',
      moduleId: 'airway-stent-mechanics',
      eventPayload: {
        interaction: 'module_completed',
        completionId: 'module-mastery-complete',
      },
    })
  })
})
