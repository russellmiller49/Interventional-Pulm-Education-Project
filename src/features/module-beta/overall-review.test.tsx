import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BetaTestingFrame } from './BetaTestingFrame'
import { betaModuleById } from './catalog'
import { feedbackMode } from './config'
import { ReviewStatus, ReviewStatusProvider } from './HubReviewStatus'
import { OverallReviewsPanel } from './OverallReviewsPanel'

jest.mock('next/link', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return React.forwardRef(function Link(
    props: React.AnchorHTMLAttributes<HTMLAnchorElement>,
    ref: React.Ref<HTMLAnchorElement>,
  ) {
    return React.createElement('a', { ...props, ref })
  })
})
jest.mock('./config', () => ({ feedbackMode: jest.fn() }))
jest.mock('./ScreenshotEditor', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return {
    createScreenshotDraft: () => ({ source: null, annotations: [] }),
    ScreenshotEditor: React.forwardRef(function Editor(
      _props: unknown,
      ref: React.Ref<{ exportImage: () => null }>,
    ) {
      React.useImperativeHandle(ref, () => ({ exportImage: () => null }))
      return null
    }),
  }
})
const mode = jest.mocked(feedbackMode)
const ebus = betaModuleById('ebus-guided')!
const note = {
  audience: 'Early pulmonary fellows.',
  prompts: ['Station landmarks', 'Bleeding first moves'],
}

const learnerAnswers = {
  coverage: 'most',
  experience: 'supervised',
  overall: '4',
  clarity: '4',
  easeOfUse: '3',
  interactive: '5',
  level: 'about-right',
  readiness: 'minor-fixes',
  workedBest: 'The drills',
  oneFix: '',
  confidenceBefore: '2',
  confidenceNow: '4',
  wouldUse: 'yes',
}
type Mine = {
  profile: { label: string; defaultTrack: 'learner' | 'educator' } | null
  reviewsOpen: boolean
  reviews: unknown[]
  reportCounts: Record<string, number>
}
let mine: Mine
let fetchMock: jest.Mock
const original = globalThis.fetch
const now = jest.spyOn(Date, 'now')

beforeEach(() => {
  mode.mockReturnValue('server')
  now.mockReturnValue(1_000_000)
  window.history.replaceState({}, '', '/en/development-beta/ebus-guided')
  mine = {
    profile: { label: 'PCCM Fellow · Fellow Year 2', defaultTrack: 'learner' },
    reviewsOpen: true,
    reviews: [],
    reportCounts: { 'ebus-guided': 2 },
  }
  fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/module-review/mine') return { ok: true, json: async () => mine }
    if (url === '/api/module-review') {
      const body = JSON.parse(String(init?.body))
      return {
        ok: true,
        json: async () => ({
          review: {
            id: 'r1',
            module_id: body.moduleId,
            track: body.track,
            answers: body.answers,
            updated_at: '2026-11-09T10:00:00Z',
          },
        }),
      }
    }
    return { ok: true, json: async () => ({ id: '6a1d1c5e-6c56-4a77-8a5b-111111111111' }) }
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch
})
afterEach(() => {
  globalThis.fetch = original
})

const reviewButton = () => screen.getByRole('button', { name: /overall review/i })
const dialog = () => screen.getByRole('dialog')
async function mount(props: Partial<Parameters<typeof BetaTestingFrame>[0]> = {}) {
  render(<BetaTestingFrame moduleEntry={ebus} locale="en" reviewNote={note} {...props} />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/module-review/mine'))
}
const question = (name: string) =>
  document.querySelector(`[data-review-question="${name}"]`) as HTMLElement
async function answerCommon(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(question('coverage')).getByLabelText('Most of it'))
  await user.click(within(question('experience')).getByLabelText('Do it with supervision'))
  await user.click(screen.getByLabelText('Overall quality: Very good'))
  await user.click(screen.getByLabelText('Clarity of the teaching: Very good'))
  await user.click(screen.getByLabelText('Ease of use: finding your way, the controls: Good'))
  await user.click(
    screen.getByLabelText('The interactive parts: simulator, cases, questions: Excellent'),
  )
  await user.click(within(question('level')).getByLabelText('About right'))
  await user.click(within(question('readiness')).getByLabelText('Ready after minor fixes'))
}

describe('the overall review in the testing page', () => {
  it('names the reviewer from their profile and starts them on their usual track', async () => {
    const user = userEvent.setup()
    await mount()
    await user.click(reviewButton())
    expect(within(dialog()).getByText('PCCM Fellow · Fellow Year 2')).toBeInTheDocument()
    expect(screen.getByLabelText('A learner')).toBeChecked()
    expect(screen.getByRole('heading', { name: 'As a learner' })).toBeInTheDocument()
    expect(screen.queryByText('Station landmarks')).not.toBeInTheDocument()
    expect(question('level')).toHaveTextContent('Early pulmonary fellows.')
    expect(dialog()).toHaveTextContent('You have sent 2 detailed reports on this module.')
  })

  it('asks educators the module’s own questions and sends only once every choice is made', async () => {
    const user = userEvent.setup()
    await mount()
    await user.click(reviewButton())
    await user.click(screen.getByLabelText('An educator or practicing clinician'))
    expect(
      screen.getByRole('heading', { name: 'As an educator or practicing clinician' }),
    ).toBeInTheDocument()
    const send = screen.getByRole('button', { name: 'Send review' })
    expect(send).toBeDisabled()
    await answerCommon(user)
    await user.click(within(question('accuracy')).getByLabelText('Can’t judge'))
    await user.click(within(question('consistent')).getByLabelText('Mostly'))
    await user.click(within(question('wouldAssign')).getByLabelText('Probably'))
    await user.click(screen.getByLabelText('Station landmarks: Looks right'))
    expect(screen.getByText('1 question left')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Bleeding first moves: Needs changes'))
    await user.click(send)
    expect(await screen.findByText(/your overall review is saved/i)).toBeInTheDocument()
    const call = fetchMock.mock.calls.find(([url]) => url === '/api/module-review')!
    const body = JSON.parse(call[1].body)
    expect(body).toMatchObject({ moduleId: 'ebus-guided', track: 'educator' })
    expect(body.answers.prompts).toEqual([
      { prompt: 'Station landmarks', verdict: 'looks-right' },
      { prompt: 'Bleeding first moves', verdict: 'needs-changes' },
    ])
    // The learner questions answered on the way are not sent with the educator form.
    expect(body.answers).not.toHaveProperty('confidenceNow')
    // The toolbar behind the open dialog now offers an edit.
    expect(document.querySelector('[data-overall-review-button]')).toHaveTextContent(
      'Edit overall review',
    )
  })

  it('opens an earlier review filled in, to be updated', async () => {
    mine.reviews = [
      {
        id: 'r1',
        module_id: 'ebus-guided',
        track: 'learner',
        answers: learnerAnswers,
        updated_at: '2026-11-08T10:00:00Z',
      },
    ]
    const user = userEvent.setup()
    await mount()
    await waitFor(() => expect(reviewButton()).toHaveTextContent('Edit overall review'))
    await user.click(reviewButton())
    expect(screen.getByLabelText('Now: Confident')).toBeChecked()
    expect(screen.getByLabelText('What worked best? (optional)')).toHaveValue('The drills')
    expect(screen.getByRole('button', { name: 'Update review' })).toBeEnabled()
  })

  it('opens the form straight away from the hub’s Edit link', async () => {
    window.history.replaceState({}, '', '/en/development-beta/ebus-guided?review=1')
    await mount()
    expect(await screen.findByRole('dialog')).toHaveTextContent('Overall review')
  })

  it('keeps unsent answers when closed, and guards them like an unsent report', async () => {
    const user = userEvent.setup()
    await mount()
    const reloadPrompts = () =>
      !window.dispatchEvent(new Event('beforeunload', { cancelable: true }))
    await user.click(reviewButton())
    // Switching "Answer as" alone is not unsent work.
    await user.click(screen.getByLabelText('An educator or practicing clinician'))
    expect(reloadPrompts()).toBe(false)
    await user.click(within(question('coverage')).getByLabelText('All of it'))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(reloadPrompts()).toBe(true)
    await user.click(reviewButton())
    expect(within(question('coverage')).getByLabelText('All of it')).toBeChecked()
  })

  it('is not offered in owner-local review', async () => {
    mode.mockReturnValue('owner-local')
    render(<BetaTestingFrame moduleEntry={ebus} locale="en" reviewNote={note} />)
    expect(screen.queryByRole('button', { name: /overall review/i })).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith('/api/module-review/mine')
  })
})

describe('the offer on leaving', () => {
  const allModules = () => screen.getByRole('link', { name: 'All beta modules' })
  function leave() {
    let allowed = false
    const record = (event: MouseEvent) => {
      allowed = !event.defaultPrevented
      event.preventDefault()
    }
    document.addEventListener('click', record)
    fireEvent.click(allModules())
    document.removeEventListener('click', record)
    return allowed
  }

  it('lets a short visit leave without asking', async () => {
    await mount()
    now.mockReturnValue(1_000_000 + 9 * 60 * 1000)
    expect(leave()).toBe(true)
    expect(screen.queryByText('Before you go')).not.toBeInTheDocument()
  })

  it('offers the review once after ten minutes, and Start opens it', async () => {
    const user = userEvent.setup()
    await mount()
    now.mockReturnValue(1_000_000 + 10 * 60 * 1000)
    expect(leave()).toBe(false)
    expect(await screen.findByText('Before you go')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Start overall review' }))
    expect(await screen.findByRole('heading', { name: 'Overall review' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // Once per visit.
    expect(leave()).toBe(true)
  })

  it('offers it after a detailed report was sent, with a way to leave without it', async () => {
    const user = userEvent.setup()
    await mount()
    await user.click(screen.getByRole('button', { name: 'Give feedback' }))
    await user.type(screen.getByLabelText('What should we know?'), 'Station 7 label is off')
    await user.click(screen.getByRole('button', { name: 'Send feedback' }))
    expect(await screen.findByText(/Feedback saved/)).toBeInTheDocument()
    expect(leave()).toBe(false)
    expect(await screen.findByRole('link', { name: 'Leave without it' })).toHaveAttribute(
      'href',
      '/en/development-beta',
    )
  })

  it('does not offer it when the module is already reviewed or reviews are not open', async () => {
    mine.reviews = [
      {
        id: 'r1',
        module_id: 'ebus-guided',
        track: 'learner',
        answers: learnerAnswers,
        updated_at: '',
      },
    ]
    const { unmount } = render(
      <BetaTestingFrame moduleEntry={ebus} locale="en" reviewNote={note} />,
    )
    await waitFor(() => expect(reviewButton()).toHaveTextContent('Edit overall review'))
    now.mockReturnValue(1_000_000 + 60 * 60 * 1000)
    expect(leave()).toBe(true)
    unmount()
    mine = { ...mine, reviews: [], reviewsOpen: false }
    await mount()
    expect(leave()).toBe(true)
  })

  it('asks about unsent answers first and never stacks the offer on that question', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    await mount()
    await user.click(reviewButton())
    await user.click(within(question('coverage')).getByLabelText('All of it'))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    now.mockReturnValue(1_000_000 + 60 * 60 * 1000)
    expect(leave()).toBe(false)
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Before you go')).not.toBeInTheDocument()
    confirm.mockRestore()
  })
})

describe('the hub card status', () => {
  it('says which modules have an overall review, with a link to edit it', async () => {
    mine.reviews = [{ module_id: 'ebus-guided', updated_at: '2026-11-09T10:00:00Z' }]
    render(
      <ReviewStatusProvider>
        <ReviewStatus moduleId="ebus-guided" locale="en" />
        <ReviewStatus moduleId="baxter-crrt" locale="en" />
      </ReviewStatusProvider>,
    )
    expect(await screen.findByText(/submitted Nov 9/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      '/en/development-beta/ebus-guided?review=1',
    )
    expect(screen.getByText('Overall review: not yet')).toBeInTheDocument()
  })

  it('shows nothing until reviews are open', async () => {
    mine.reviewsOpen = false
    render(
      <ReviewStatusProvider>
        <ReviewStatus moduleId="ebus-guided" locale="en" />
      </ReviewStatusProvider>,
    )
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(document.querySelector('[data-review-status]')).toBeNull()
  })
})

describe('the admin Overall reviews tab', () => {
  it('summarizes the reviews and links to a reviewer’s detailed reports', async () => {
    fetchMock.mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        reviews: [
          {
            id: 'r1',
            user_id: 'u1',
            tester_email: 'fellow@example.org',
            module_id: 'ebus-guided',
            track: 'learner',
            profile_snapshot: { professional_role: 'pccm_fellow', training_level: 'fellow_year_2' },
            answers: learnerAnswers,
            form_version: 1,
            created_at: '',
            updated_at: '2026-11-09T10:00:00Z',
          },
        ],
        reportCounts: { 'u1:ebus-guided': 2 },
      }),
    }))
    const onShowReports = jest.fn()
    const user = userEvent.setup()
    render(<OverallReviewsPanel onShowReports={onShowReports} />)
    const row = await screen.findByRole('row', { name: /EBUS: Guided Course/ })
    expect(row).toHaveTextContent('1 (1 / 0)')
    expect(row).toHaveTextContent('2.0 → 4.0')
    expect(row.querySelector('[data-summary-readiness]')).toHaveTextContent('0 / 1 / 0 / 0')
    expect(screen.getByText('PCCM Fellow · Fellow Year 2')).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Their 2 detailed reports on this module' }),
    )
    expect(onShowReports).toHaveBeenCalledWith(
      { id: 'u1', label: 'PCCM Fellow · Fellow Year 2' },
      'ebus-guided',
    )
  })
})
