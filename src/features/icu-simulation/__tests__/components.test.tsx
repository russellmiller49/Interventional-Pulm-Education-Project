import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { CRITICAL_CARE_PROGRESS_STORAGE_KEY } from '@/features/learning-module/activity'

const mockRouterPush = jest.fn()
const activityTitles = {
  learn: 'See how the systems connect',
  practice: 'Run the full ICU course',
  assess: 'Demonstrate safe clinical reasoning',
  sandbox: 'Explore support interactions',
} as const

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: mockRouterPush }),
}))

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: () =>
    function MockBedsideScene({ state }: { state: { devices: Record<string, unknown> } }) {
      return (
        <div data-testid="mock-bedside-scene">Focused bedside scene · {state ? 'ready' : ''}</div>
      )
    },
}))

import { IcuSimulatorHub } from '../components/IcuSimulatorHub'
import { IcuSimulatorLab } from '../components/IcuSimulatorLab'
import { getIcuScenario } from '../content'
import {
  applyIcuCommand,
  createDefaultIcuProgress,
  createIcuSimulation,
  createIcuWorkerRunner,
  ICU_SIMULATION_SESSION_STORAGE_KEY,
  icuScenarioFamilies,
  type IcuWorkerRequest,
  type IcuWorkerResponse,
  writeIcuProgress,
  writeIcuSyntheticSession,
} from '../engine'

describe('ICU Simulator learner interface', () => {
  beforeEach(() => {
    mockRouterPush.mockReset()
    window.localStorage.clear()
    Object.defineProperty(globalThis, 'Worker', {
      configurable: true,
      writable: true,
      value: undefined,
    })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn().mockReturnValue({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }),
    })
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: jest.fn().mockResolvedValue({ ok: true }),
    })
  })

  it('uses the canonical module navigation on Overview and active activities', async () => {
    const hub = render(<IcuSimulatorHub />)
    const hubNavigation = screen.getByRole('navigation', {
      name: 'ICU Simulator module sections',
    })
    expect(
      within(hubNavigation)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Overview', 'Learn', 'Practice', 'Assess', 'Sandbox'])
    expect(within(hubNavigation).getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    hub.unmount()

    const { container } = render(<IcuSimulatorLab mode="practice" embedded />)
    await screen.findByRole('heading', { name: 'Choose a shock course' })
    expect(container.querySelector('[data-critical-care-activity-shell]')).toBeInTheDocument()
    const activityNavigation = screen.getByRole('navigation', {
      name: 'ICU Simulator module sections',
    })
    expect(within(activityNavigation).getByRole('link', { name: 'Practice' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it.each(['learn', 'practice', 'assess', 'sandbox'] as const)(
    'orients the %s workspace with the shared semantic shell',
    async (mode) => {
      const { container } = render(<IcuSimulatorLab mode={mode} embedded />)
      await screen.findByRole('heading', { name: 'Choose a shock course' })

      const shell = container.querySelector('[data-critical-care-activity-shell]')
      expect(shell).toBeInTheDocument()
      expect(
        within(shell as HTMLElement).getByRole('heading', { name: activityTitles[mode] }),
      ).toBeInTheDocument()
      const phases = screen.getByRole('group', {
        name: 'Integrated ICU shared activity phases',
      })
      for (const label of ['Recognize', 'Predict', 'Act', 'Observe', 'Explain', 'Transfer']) {
        expect(within(phases).getByText(label)).toBeInTheDocument()
      }
      expect(
        screen.getByRole('heading', { name: 'Persistent patient context' }),
      ).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Current task' })).toBeInTheDocument()
    },
  )

  it('bounds the active route and capstone preparation without desktop document scrolling', () => {
    const css = readFileSync(
      join(process.cwd(), 'src/features/icu-simulation/components/icu-simulation.module.css'),
      'utf8',
    )

    expect(css).toMatch(/\.activityViewport\s*{[\s\S]*?overflow: auto/)
    expect(css).toMatch(
      /\.icuActivityRoute,\s*\.capstoneActivityRoute\s*{[\s\S]*?position: fixed[\s\S]*?inset: 5rem 0 0[\s\S]*?overflow: hidden/,
    )
    expect(css).toMatch(
      /\.capstoneActivityRoute\s*{[\s\S]*?grid-template-rows: minmax\(5\.5rem, 18dvh\) minmax\(0, 1fr\)/,
    )
    expect(css).toMatch(
      /\.capstonePreparation,[\s\S]*?height: 100%[\s\S]*?overflow: auto[\s\S]*?scrollbar-gutter: stable/,
    )
  })

  it('keeps the mobile launch gate and routes its text alternative to the ICU Overview', async () => {
    const originalWidth = window.innerWidth
    const originalHeight = window.innerHeight
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 390 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 844 })

    const rendered = render(<IcuSimulatorLab mode="learn" />)
    try {
      expect(
        await screen.findByRole('heading', { name: 'A larger screen is recommended' }),
      ).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Open lightweight alternative' })).toHaveAttribute(
        'href',
        '/icu-simulation',
      )
      expect(screen.queryByText('Choose a shock course')).not.toBeInTheDocument()
    } finally {
      rendered.unmount()
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: originalWidth,
      })
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        writable: true,
        value: originalHeight,
      })
    }
  })

  it('conceals the assessment identity and capability answer key until debrief', async () => {
    render(<IcuSimulatorLab mode="assess" initialScenarioId="tamponade" />)

    await screen.findByRole('heading', { name: 'Choose a shock course' })
    expect(screen.getByRole('heading', { name: 'Unclassified shock course' })).toBeInTheDocument()
    expect(
      screen.getByText('Synthetic patient assessment variant', { exact: false }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Cardiac tamponade/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/icu-tamponade-01/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Source notes' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Support catalog locked' })).toBeInTheDocument()
    expect(screen.getByText('Treatment formulary locked')).toBeInTheDocument()

    for (const capabilityLabel of [
      'Mechanical ventilation',
      'ECMO',
      'Mechanical circulatory support',
      'Continuous renal replacement',
      'Drain tamponade',
      'Complete reperfusion',
      'Blood products',
    ]) {
      expect(screen.queryByText(capabilityLabel, { exact: false })).not.toBeInTheDocument()
    }

    fireEvent.change(screen.getByLabelText('Classification'), {
      target: { value: 'distributive' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Commit working diagnosis' }))

    expect(
      await screen.findByRole('heading', { name: 'Mechanical ventilation' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Drain tamponade/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Source notes' })).not.toBeInTheDocument()
  })

  it('keeps anonymous assessment case numbers stable after selection', async () => {
    render(<IcuSimulatorLab mode="assess" />)
    await screen.findByRole('heading', { name: 'Choose a shock course' })

    fireEvent.click(screen.getByRole('button', { name: /Assessment case 02/i }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Assessment case 02/i })).toHaveAttribute(
        'aria-current',
        'true',
      ),
    )
  })

  it('keeps masked context safe and makes Help, Reset, and Save & exit functional', async () => {
    const { container } = render(
      <IcuSimulatorLab mode="assess" initialScenarioId="tamponade" embedded />,
    )
    await screen.findByRole('heading', { name: 'Choose a shock course' })

    const shell = container.querySelector('[data-critical-care-activity-shell]') as HTMLElement
    expect(shell).toHaveAttribute('data-masked-assessment', 'true')
    const context = screen.getByRole('complementary', { name: 'Patient context' })
    expect(within(context).getByText('Masked assessment')).toBeInTheDocument()
    expect(within(context).queryByText(/tamponade/i)).not.toBeInTheDocument()

    fireEvent.click(within(shell).getByRole('button', { name: 'Reference' }))
    expect(await screen.findByText('Assessment reference boundary')).toBeInTheDocument()
    expect(screen.queryByText(/Cardiac tamponade/i)).not.toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })

    fireEvent.click(within(shell).getByRole('button', { name: 'Help' }))
    expect(
      screen.getByText(
        /Assessment help does not reveal the diagnosis or scenario-specific targets/i,
      ),
    ).toHaveAttribute('role', 'status')

    fireEvent.click(screen.getByRole('button', { name: 'Commit working diagnosis' }))
    expect(screen.getByRole('button', { name: 'Commit reclassification' })).toBeInTheDocument()
    fireEvent.click(within(shell).getAllByRole('button', { name: 'Reset' })[0])
    expect(
      await screen.findByRole('button', { name: 'Commit working diagnosis' }),
    ).toBeInTheDocument()

    fireEvent.click(within(shell).getByRole('button', { name: 'Save & exit' }))
    expect(window.localStorage.getItem(ICU_SIMULATION_SESSION_STORAGE_KEY)).not.toBeNull()
    expect(mockRouterPush).toHaveBeenCalledWith('/icu-simulation')
  })

  it('scores the first Assess diagnosis after a recommit and reveals evidence only in debrief', async () => {
    render(<IcuSimulatorLab mode="assess" initialScenarioId="tamponade" />)
    await screen.findByRole('heading', { name: 'Choose a shock course' })

    fireEvent.change(screen.getByLabelText('Classification'), {
      target: { value: 'distributive' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Commit working diagnosis' }))
    fireEvent.change(screen.getByLabelText('Classification'), {
      target: { value: 'tamponade-obstructive' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Commit reclassification' }))
    expect(
      screen.queryByRole('heading', { name: 'Physiologic response gate' }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Complete course and open debrief' }))

    const prioritization = await screen.findByText('Prioritization')
    expect(prioritization.closest('div')).toHaveTextContent('0/15')
    expect(
      screen.getByText(/Consider: Commit the correct working shock classification/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Source notes' })).toBeInTheDocument()
    expect(screen.getByText(/Scenario evidence record/i)).toBeInTheDocument()
    expect(screen.getByText(/Serial commitments/i).closest('div')).toHaveTextContent('2')
    expect(screen.getByRole('heading', { name: 'Physiologic response gate' })).toBeInTheDocument()
    expect(screen.getByText('Response not demonstrated')).toBeInTheDocument()
    expect(
      screen.getByText(/pending-review educational simulator calibration/i),
    ).toBeInTheDocument()
  })

  it('offers explicit resume and start-new choices and labels the safe fallback', async () => {
    const scenario = getIcuScenario('lv-cardiogenic')
    const initial = createIcuSimulation(scenario, { mode: 'practice', seed: 92 })
    const saved = applyIcuCommand(initial, scenario, {
      type: 'diagnosis.commit',
      classification: 'lv-cardiogenic',
    })
    expect(writeIcuSyntheticSession(window.localStorage, saved)).toBe(true)

    const { unmount } = render(<IcuSimulatorLab mode="practice" />)
    expect(await screen.findByRole('heading', { name: 'LV cardiogenic shock' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Choose a shock course' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Resume saved session/i }))

    expect(
      await screen.findByRole('heading', { name: 'Choose a shock course' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Commit reclassification' })).toBeInTheDocument()
    expect(screen.getByText('Main-thread fallback active')).toBeInTheDocument()
    unmount()

    window.localStorage.clear()
    expect(writeIcuSyntheticSession(window.localStorage, saved)).toBe(true)
    render(<IcuSimulatorLab mode="assess" initialScenarioId="tamponade" />)
    expect(await screen.findByRole('button', { name: 'Start new session' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open practice to resume/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Start new session' }))
    expect(
      await screen.findByRole('heading', { name: 'Choose a shock course' }),
    ).toBeInTheDocument()
    expect(window.localStorage.getItem(ICU_SIMULATION_SESSION_STORAGE_KEY)).toBeNull()
  })

  it('discards an Assess replay that is outside the current preparation allowlist', async () => {
    const scenario = getIcuScenario('lv-cardiogenic')
    const saved = applyIcuCommand(
      createIcuSimulation(scenario, { mode: 'assess', seed: 93 }),
      scenario,
      { type: 'diagnosis.commit', classification: 'lv-cardiogenic' },
    )
    expect(writeIcuSyntheticSession(window.localStorage, saved)).toBe(true)

    render(
      <IcuSimulatorLab
        mode="assess"
        initialScenarioId="tamponade"
        availableScenarioIds={['tamponade']}
      />,
    )

    await screen.findByRole('heading', { name: 'Choose a shock course' })
    expect(screen.queryByRole('button', { name: /Resume saved session/i })).not.toBeInTheDocument()
    expect(
      screen.getByText(/no longer met the current preparation requirements/i),
    ).toBeInTheDocument()
    expect(window.localStorage.getItem(ICU_SIMULATION_SESSION_STORAGE_KEY)).toBeNull()
  })

  it('clears a completed session instead of persisting or offering it as a new attempt', async () => {
    const scenario = getIcuScenario('septic-ards-aki')
    const completed = applyIcuCommand(
      createIcuSimulation(scenario, { mode: 'practice', seed: 94 }),
      scenario,
      { type: 'session.complete' },
    )
    expect(writeIcuSyntheticSession(window.localStorage, completed)).toBe(true)

    const first = render(<IcuSimulatorLab mode="practice" initialScenarioId="septic-ards-aki" />)
    await screen.findByRole('heading', { name: 'Choose a shock course' })
    expect(screen.queryByRole('button', { name: /Resume saved session/i })).not.toBeInTheDocument()
    expect(screen.getByText(/prior synthetic course was already complete/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Complete course and open debrief' }))
    await waitFor(() =>
      expect(window.localStorage.getItem(ICU_SIMULATION_SESSION_STORAGE_KEY)).toBeNull(),
    )
    await waitFor(() =>
      expect(window.localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)).not.toBeNull(),
    )
    const normalized = window.localStorage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)
    expect(normalized).toContain('icu:practice:septic-ards-aki')
    expect(normalized).not.toMatch(/commands|waveform|patient|replay|deviceState/i)
    first.unmount()

    render(<IcuSimulatorLab mode="practice" initialScenarioId="septic-ards-aki" />)
    await screen.findByRole('heading', { name: 'Choose a shock course' })
    expect(screen.queryByRole('button', { name: /Resume saved session/i })).not.toBeInTheDocument()
  })

  it('does not re-emit module completion when already-mastered progress is loaded', async () => {
    const progress = {
      ...createDefaultIcuProgress(),
      lastMode: 'assess' as const,
      completedScenarioIds: [...icuScenarioFamilies],
      masteredScenarioIds: [...icuScenarioFamilies],
    }
    expect(writeIcuProgress(window.localStorage, progress)).toBe(true)

    render(<IcuSimulatorLab mode="assess" />)
    await screen.findByRole('heading', { name: 'Choose a shock course' })
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 20)))

    const interactions = jest.mocked(globalThis.fetch).mock.calls.map((call) => {
      const request = call[1] as RequestInit
      const payload = JSON.parse(String(request.body)) as {
        eventPayload?: { interaction?: string }
      }
      return payload.eventPayload?.interaction
    })
    expect(interactions).not.toContain('module_completed')
  })

  it('restores a saved replay through the worker protocol when a worker is available', async () => {
    const scenario = getIcuScenario('lv-cardiogenic')
    const initial = createIcuSimulation(scenario, { mode: 'practice', seed: 123 })
    const saved = applyIcuCommand(initial, scenario, {
      type: 'diagnosis.commit',
      classification: 'lv-cardiogenic',
    })
    expect(writeIcuSyntheticSession(window.localStorage, saved)).toBe(true)

    const posted: IcuWorkerRequest[] = []
    class FakeWorker {
      private readonly runner = createIcuWorkerRunner(getIcuScenario)
      private readonly listeners = new Set<(event: { data: IcuWorkerResponse }) => void>()

      postMessage(message: IcuWorkerRequest) {
        posted.push(message)
        window.setTimeout(() => {
          const event = { data: this.runner.handle(message) }
          this.listeners.forEach((listener) => listener(event))
        }, 0)
      }

      addEventListener(_type: 'message', listener: (event: { data: IcuWorkerResponse }) => void) {
        this.listeners.add(listener)
      }

      removeEventListener(
        _type: 'message',
        listener: (event: { data: IcuWorkerResponse }) => void,
      ) {
        this.listeners.delete(listener)
      }

      terminate() {
        this.listeners.clear()
      }
    }
    Object.defineProperty(globalThis, 'Worker', {
      configurable: true,
      writable: true,
      value: FakeWorker,
    })

    render(<IcuSimulatorLab mode="practice" />)
    fireEvent.click(await screen.findByRole('button', { name: /Resume saved session/i }))

    await waitFor(() => expect(posted.some((request) => request.type === 'restore')).toBe(true))
    expect(
      await screen.findByRole('heading', { name: 'Choose a shock course' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Commit reclassification' })).toBeInTheDocument()
    expect(screen.getByText('Background worker active')).toBeInTheDocument()
  })

  it('emits only bounded ICU analytics fields', async () => {
    render(<IcuSimulatorHub />)
    await act(async () => Promise.resolve())

    const fetchMock = jest.mocked(globalThis.fetch)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    for (const call of fetchMock.mock.calls) {
      const request = call[1] as RequestInit
      const payload = JSON.parse(String(request.body)) as Record<string, unknown>
      expect(payload.moduleId).toBe('icu-simulation')
      expect(payload).not.toHaveProperty('section')
      expect(payload).not.toHaveProperty('duration')
      expect(payload).not.toHaveProperty('percent')
      expect(payload).not.toHaveProperty('session')
      expect(payload.eventPayload).toEqual(
        expect.objectContaining({ interaction: 'section_opened', section: 'overview' }),
      )
      expect(JSON.stringify(payload)).not.toMatch(
        /mapMmHg|fio2|waveform|patientTruth|freeText|syntheticPatientId|actionHistory/i,
      )
    }
  })

  it('marks a completed care action using the semantic care action ID', async () => {
    render(<IcuSimulatorLab mode="practice" initialScenarioId="septic-ards-aki" />)
    await screen.findByRole('heading', { name: 'Choose a shock course' })
    fireEvent.click(screen.getByRole('button', { name: 'Commit working diagnosis' }))
    const carePanel = screen
      .getByRole('heading', { name: 'Immediate and definitive care' })
      .closest('section')
    expect(carePanel).not.toBeNull()
    const fluid = within(carePanel as HTMLElement).getByRole('button', { name: /Fluid challenge/i })
    fireEvent.click(fluid)
    expect(fluid).toHaveAttribute('data-complete', 'true')
  })

  it('emits the bounded unified lifecycle contract when a diagnosis is committed', async () => {
    render(<IcuSimulatorLab mode="practice" initialScenarioId="septic-ards-aki" />)
    await screen.findByRole('heading', { name: 'Choose a shock course' })

    fireEvent.click(screen.getByRole('button', { name: 'Commit working diagnosis' }))

    const fetchMock = jest.mocked(globalThis.fetch)
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([, request]) => {
          const payload = JSON.parse(String((request as RequestInit).body)) as {
            moduleId?: string
            eventPayload?: { interaction?: string }
          }
          return (
            payload.moduleId === 'critical-care' &&
            payload.eventPayload?.interaction === 'critical_care_prediction_submitted'
          )
        }),
      ).toBe(true),
    )

    const lifecyclePayloads = fetchMock.mock.calls
      .map(
        ([, request]) =>
          JSON.parse(String((request as RequestInit).body)) as Record<string, unknown>,
      )
      .filter((payload) => payload.moduleId === 'critical-care')
    expect(lifecyclePayloads).not.toHaveLength(0)
    for (const payload of lifecyclePayloads) {
      expect(JSON.stringify(payload)).not.toMatch(
        /mapMmHg|fio2|waveform|patientTruth|freeText|actionHistory|command/i,
      )
    }
  })

  it('dispatches bounded Sandbox driver changes through the visible control', async () => {
    render(<IcuSimulatorLab mode="sandbox" initialScenarioId="septic-ards-aki" />)
    await screen.findByRole('heading', { name: 'Choose a shock course' })

    const vasoplegia = screen.getByRole('slider', { name: 'Vasoplegia, 0.7 severity' })
    fireEvent.change(vasoplegia, { target: { value: '0.5' } })

    expect(await screen.findByText('0.50 severity')).toBeInTheDocument()
  })

  it('does not award unified lifecycle credit for the unscored Sandbox', async () => {
    render(<IcuSimulatorLab mode="sandbox" initialScenarioId="septic-ards-aki" embedded />)
    await screen.findByRole('heading', { name: 'Choose a shock course' })
    fireEvent.click(screen.getByRole('button', { name: 'Complete course and open debrief' }))
    await screen.findByText('Unscored')

    const unifiedPayloads = jest
      .mocked(globalThis.fetch)
      .mock.calls.map(
        ([, request]) =>
          JSON.parse(String((request as RequestInit).body)) as {
            moduleId?: string
            eventPayload?: { activityId?: string }
          },
      )
      .filter(
        (payload) =>
          payload.moduleId === 'critical-care' &&
          payload.eventPayload?.activityId?.startsWith('icu:sandbox:'),
      )
    expect(unifiedPayloads).toHaveLength(0)
  })
})
