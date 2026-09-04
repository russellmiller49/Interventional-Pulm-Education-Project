import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'

import {
  cardiohelpLearnLessonsBySupportMode,
  ECMO_TRANSFER_STEP_TITLE,
} from '../content/learnLessons'
import { ecmoLearnPredictionFor } from '../content/learnPredictionItems'
import {
  answerPredictionAndAdvance,
  awaitDoneAndAdvance,
  latestState,
  mountDrill,
  nowCard,
  nowPrimary,
  nowStatus,
  performAndAdvance,
  predictionChoice,
  rampToReferenceSpeedAndAdvance,
  readStep,
  resetStageHarness,
  openConsoleScreenAndAdvance,
  predictionRadios,
} from '../test-support/learnStageHarness'

/*
 * These walkthroughs drive a seventeen-step console tour through the real stage, the real session
 * core and the real console, with a `waitFor` at most steps. Isolated they run in a couple of
 * seconds; in a full-suite run on a machine that gives Jest a worker per core they can exceed the
 * five-second default. The budget has to match what a seventeen-step UI walkthrough costs under
 * contention.
 */
jest.setTimeout(30_000)

const mockRouterPush = jest.fn()

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: mockRouterPush, replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/learn',
}))

beforeEach(() => {
  resetStageHarness()
  mockRouterPush.mockReset()
  Object.defineProperty(global, 'fetch', {
    configurable: true,
    writable: true,
    value: jest.fn().mockResolvedValue({ ok: true }),
  })
})

describe('CARDIOHELP ECMO Learn walkthrough', () => {
  it('directs learners to the real console and automatically accepts the completed task', async () => {
    const { lesson } = await mountDrill('startup-sensor-orientation')

    expect(screen.getByRole('heading', { name: lesson.steps[0].title })).toBeInTheDocument()
    // A read step's one action is the Now card's primary; there is no separate Next.
    expect(nowPrimary()).toHaveTextContent(/identify all four sources/i)
    expect(screen.queryByRole('button', { name: /^Next step$/i })).not.toBeInTheDocument()
    // The whole pathway is one disclosure away, not a standing rail.
    const drawer = document.querySelector('[data-sections-drawer]')
    expect(drawer).not.toBeNull()
    const rail = screen.getByRole('navigation', { name: /VV learning pathway sections/i })
    expect(within(rail).getAllByRole('button')).toHaveLength(
      criticalCareLearningPathway('cardiohelp-ecmo', 'vv').sections.length,
    )

    readStep(/identify all four sources/i)

    expect(
      screen.getByRole('heading', { name: /which channels still mean anything/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Open Parameter list$/i })).not.toBeInTheDocument()
    expect(screen.getByText(/Do this on the simulator/i)).toBeInTheDocument()
    expect(nowStatus()).toMatch(/is done once the simulator reaches the state you were asked for/i)
    expect(document.getElementById('cardiohelp-console')).toHaveAttribute(
      'data-guided-focus',
      'true',
    )

    fireEvent.click(screen.getByRole('button', { name: /Show me where/i }))
    const parameterButton = screen.getByRole('button', { name: 'Parameter list' })
    await waitFor(() => {
      expect(parameterButton).toHaveFocus()
      expect(parameterButton).toHaveAttribute('data-guided-help', 'true')
    })

    fireEvent.click(parameterButton)
    await waitFor(() => expect(nowStatus()).toMatch(/^Done\./))
    expect(latestState().device.screen).toBe('parameters')
    expect(screen.getByRole('button', { name: /^Next step$/i })).toBeEnabled()
  })

  it('uses the real RPM rotary for the demonstrated safe action without showing a score', async () => {
    await mountDrill('preload-drainage-collapse')

    readStep(/Inspect the starting pattern/i)
    answerPredictionAndAdvance('preload-drainage-collapse')
    expect(
      screen.queryByRole('button', { name: /Reduce RPM from 3600 to 3300/i }),
    ).not.toBeInTheDocument()
    const decreaseSetpoint = screen.getByRole('button', { name: /Decrease setpoint/i })
    for (let index = 0; index < 6; index += 1) fireEvent.click(decreaseSetpoint)

    expect(latestState().device.rpmSetpoint).toBe(3300)
    expect(screen.queryByText(/Round score/i)).not.toBeInTheDocument()
    await awaitDoneAndAdvance()
    fireEvent.click(screen.getByRole('button', { name: /Correct the identified drainage cause/i }))
    expect(latestState().scenario.activeFaults).not.toContain('preload-limited')
  })

  it('provides progressive help for the Menu to Alarm list path', async () => {
    await mountDrill('startup-sensor-orientation')

    readStep(/identify all four sources/i)
    await openConsoleScreenAndAdvance('Parameter list')
    // A3.3: the stopped-pump recognition is followed by a ramp, so the rest of the tour is read on
    // a running circuit rather than a dead one.
    await rampToReferenceSpeedAndAdvance()
    // The reference circuit only responds once the model is advanced; the tour is read on that.
    performAndAdvance('Let the circuit respond')
    await openConsoleScreenAndAdvance('Parameter list')
    await openConsoleScreenAndAdvance('Blood parameters')
    await openConsoleScreenAndAdvance('Transport')
    await openConsoleScreenAndAdvance('Interventions')
    await openConsoleScreenAndAdvance('Timers')

    expect(
      screen.getByRole('heading', { name: /Use alarm history as context/i }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Show me where/i }))

    const menuButton = screen.getByRole('button', { name: 'Menu' })
    await waitFor(() => {
      expect(menuButton).toHaveFocus()
      expect(menuButton).toHaveAttribute('data-guided-help', 'true')
    })
    fireEvent.click(menuButton)

    await waitFor(() => {
      const alarmList = screen.getByRole('button', { name: /Alarm list/i })
      expect(alarmList).toHaveAttribute('data-guided-help', 'true')
      expect(alarmList).toHaveFocus()
    })
    fireEvent.click(screen.getByRole('button', { name: /Alarm list/i }))

    await waitFor(() => expect(nowStatus()).toMatch(/^Done\./))
    expect(latestState().device.screen).toBe('alarm-history')

    fireEvent.click(screen.getByRole('button', { name: /^Next step$/i }))
    fireEvent.click(screen.getByRole('button', { name: /Show me where/i }))
    const homeButton = screen.getByRole('button', { name: 'Home' })
    await waitFor(() => {
      expect(homeButton).toHaveFocus()
      expect(homeButton).toHaveAttribute('data-guided-help', 'true')
    })
    fireEvent.click(homeButton)
    await waitFor(() => expect(nowStatus()).toMatch(/^Done\./))
    expect(latestState().device.screen).toBe('startup')
  })

  it('advances timed teaching events deterministically while the walkthrough is paused', async () => {
    await mountDrill('gas-source-interruption')

    fireEvent.click(
      screen.getByRole('button', { name: /Advance 5 simulated seconds to the event/i }),
    )
    expect(latestState().simulationTime).toBe(5)
    expect(latestState().gas.sourceConnected).toBe(false)
    // The gas surface is what this step is read on, and it is open on entry.
    expect(document.querySelector('[data-surface="gas"]')).toHaveAttribute('data-open', 'true')
  })

  it('guides a sweep change on the external gas control and accepts the new setting', async () => {
    await mountDrill('acute-hypercapnia')

    readStep(/Inspect the starting pattern/i)
    answerPredictionAndAdvance('acute-hypercapnia')

    fireEvent.click(screen.getByRole('button', { name: /Show me where/i }))
    const sweepControl = screen.getByRole('slider', { name: 'Sweep flow control' })
    await waitFor(() => {
      expect(sweepControl).toHaveFocus()
      expect(sweepControl).toHaveAttribute('data-guided-help', 'true')
    })

    fireEvent.change(sweepControl, { target: { value: '3' } })
    await waitFor(() => expect(nowStatus()).toMatch(/^Done\./))
    expect(screen.queryByRole('button', { name: /Increase sweep to 3.0/i })).not.toBeInTheDocument()
  })

  it('bridges a finished lesson to its paired clinical case in Practice', async () => {
    await mountDrill('acute-hypercapnia')

    readStep(/Inspect the starting pattern/i)
    answerPredictionAndAdvance('acute-hypercapnia')
    fireEvent.change(screen.getByRole('slider', { name: 'Sweep flow control' }), {
      target: { value: '3' },
    })
    await awaitDoneAndAdvance()
    performAndAdvance(/Advance 1 second and inspect the response/i)
    // The data-driven Explain step sits between the response and the transfer.
    readStep(/I have read what explains it/i)
    // The transfer step carries the constant title: the step changes, its name does not, and it
    // never announces the next drill's diagnosis.
    expect(screen.getByRole('heading', { name: ECMO_TRANSFER_STEP_TITLE })).toBeInTheDocument()
    const progressBefore = window.localStorage.getItem('cardiohelp-ecmo-progress-v1')
    expect(progressBefore ?? '').not.toContain('"acute-hypercapnia"')

    fireEvent.click(screen.getByRole('button', { name: 'Blood parameters' }))

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('cardiohelp-ecmo-progress-v1') ?? '{}')
      expect(stored.data?.completedLearnLessonIds ?? stored.completedLearnLessonIds).toContain(
        'acute-hypercapnia',
      )
    })
    // I3f: acute-hypercapnia teaches sweep against a CO₂ load, and its unit's one case is the
    // gas-path disconnection — a different mechanism. The mechanism map therefore offers that case
    // as the unit's next case, not as an application of this lesson; "Apply this in Practice" is
    // reserved for a case that applies the mechanism just taught.
    fireEvent.click(screen.getByRole('button', { name: /Next case in this unit/i }))
    expect(mockRouterPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: expect.stringContaining('/practice'),
        query: expect.objectContaining({ case: 'clinical-vv-gas-disconnection' }),
      }),
    )
  })

  it('guides restoration through the real gas-source control', async () => {
    await mountDrill('gas-source-interruption')

    performAndAdvance(/Advance 5 simulated seconds to the event/i)
    answerPredictionAndAdvance('gas-source-interruption')

    fireEvent.click(screen.getByRole('button', { name: /Show me where/i }))
    const restoreGas = screen.getByRole('button', { name: /Restore verified gas source/i })
    await waitFor(() => {
      expect(restoreGas).toHaveFocus()
      expect(restoreGas).toHaveAttribute('data-guided-help', 'true')
    })
    fireEvent.click(restoreGas)

    await waitFor(() => expect(nowStatus()).toMatch(/^Done\./))
    expect(latestState().gas.sourceConnected).toBe(true)
  })

  it('highlights and accepts the AC restore control on the Transport screen', async () => {
    await mountDrill('transport-power-loss')

    performAndAdvance(/Advance .* simulated seconds to the event/i)
    answerPredictionAndAdvance('transport-power-loss')

    fireEvent.click(screen.getByRole('button', { name: /Show me where/i }))
    const restorePower = await screen.findByRole('button', {
      name: /Reconnect verified AC source/i,
    })
    await waitFor(() => {
      expect(restorePower).toHaveFocus()
      expect(restorePower).toHaveAttribute('data-guided-help', 'true')
    })
    fireEvent.click(restorePower)

    await waitFor(() => expect(nowStatus()).toMatch(/^Done\./))
  })

  it('progressively guides isolation, source correction, and bounded resumption through the real controls', async () => {
    await mountDrill('arterial-bubble-stop')

    performAndAdvance(/Advance 4 simulated seconds to the event/i)
    answerPredictionAndAdvance('arterial-bubble-stop')

    // Isolate: the clamp steps auto-complete when the real clamp buttons reach the requested
    // state, and guided help highlights the matching button.
    fireEvent.click(screen.getByRole('button', { name: /Show me where/i }))
    const returnClamp = await screen.findByRole('button', { name: /Return clamp/i })
    await waitFor(() => {
      expect(returnClamp).toHaveAttribute('data-guided-help', 'true')
    })
    fireEvent.click(returnClamp)
    await awaitDoneAndAdvance()

    fireEvent.click(screen.getByRole('button', { name: /Drainage clamp/i }))
    await awaitDoneAndAdvance()

    performAndAdvance(/Correct the source and clear the circuit/i)

    /*
     * Coming back is one act, on its own control.
     *
     * The lesson used to walk the learner out through open-drainage, open-return, reset — which put
     * the patient back on both limbs of a stopped centrifugal circuit before anything was turning.
     * There is no clamp step here to find any more, and the control the guided help points at is
     * neither a clamp nor the console reset.
     */
    fireEvent.click(screen.getByRole('button', { name: /Show me where/i }))
    const resume = document.getElementById('cardiohelp-resume-support')
    if (!resume) throw new Error('The bedside circuit did not render the resume control')
    await waitFor(() => {
      expect(resume).toHaveFocus()
      expect(resume).toHaveAttribute('data-guided-help', 'true')
    })
    fireEvent.click(resume)

    await waitFor(() => expect(nowStatus()).toMatch(/^Done\./))
    // One transition: both limbs open and the pump running, with no frame in between.
    expect(latestState().circuit.drainageClampClosed).toBe(false)
    expect(latestState().circuit.returnClampClosed).toBe(false)
    expect(latestState().device.pumpRunning).toBe(true)
  })

  it('resets to the first step and clean simulation state when the section changes', async () => {
    await mountDrill('startup-sensor-orientation')

    readStep(/identify all four sources/i)
    fireEvent.click(screen.getByRole('button', { name: 'Parameter list' }))
    await waitFor(() => expect(nowStatus()).toMatch(/^Done\./))
    expect(latestState().device.screen).toBe('parameters')

    const target = criticalCareLearningPathway('cardiohelp-ecmo', 'vv').sections.find(
      (section) => section.id === 'acute-hypercapnia',
    )
    if (!target) throw new Error('acute-hypercapnia is not on the VV pathway')
    const rail = screen.getByRole('navigation', { name: /VV learning pathway sections/i })
    fireEvent.click(within(rail).getByRole('button', { name: new RegExp(target.title) }))

    const selectedLesson = cardiohelpLearnLessonsBySupportMode.vv.find(
      (lesson) => lesson.scenarioId === 'acute-hypercapnia',
    )
    await screen.findByRole('heading', { name: selectedLesson?.steps[0].title })
    await waitFor(() => expect(latestState().scenario.scenarioId).toBe('acute-hypercapnia'))
    expect(latestState().device.screen).toBe('startup')
    expect(nowPrimary()).toHaveTextContent(selectedLesson?.steps[0].actionLabel ?? '')
  })
})

/**
 * B1/B2 — the Learn prediction is answered, and the answer is the learner's.
 *
 * Three separate leaks used to make this step unanswerable: the instruction named the goal, the
 * control and the direction; the rationale printed the scenario's whole causal chain above the
 * button; and the single button dispatched the scenario's own expectation whatever the learner
 * believed. Each block below fails if any one of them is restored.
 */
describe('CARDIOHELP ECMO Learn prediction', () => {
  async function openPredictionStep(scenarioId: string, firstAction: RegExp) {
    await mountDrill(scenarioId)
    readStep(firstAction)
  }

  it('offers the authored options and commits nothing until one is chosen', async () => {
    await openPredictionStep('preload-drainage-collapse', /Inspect the starting pattern/i)

    const prediction = ecmoLearnPredictionFor('preload-drainage-collapse')
    if (!prediction) throw new Error('missing prediction')
    const radios = predictionRadios()
    expect(radios).toHaveLength(prediction.item.choices.length)
    expect(radios.length).toBeGreaterThan(1)
    for (const choice of prediction.item.choices) {
      expect(screen.getByRole('radio', { name: choice.label })).toBeInTheDocument()
    }

    // Nothing has reached the engine, and the commit control refuses to run without an answer.
    expect(latestState().scenario.prediction.committed).toBe(false)
    expect(screen.getByRole('button', { name: /Commit this prediction/i })).toBeDisabled()
    expect(document.querySelector('[data-answer-verdict]')).toBeNull()
  })

  it('says nothing about the expected answer before the learner has committed', async () => {
    await openPredictionStep('preload-drainage-collapse', /Inspect the starting pattern/i)

    // Everything on the Now card that is not an answer option. A choice label naming an action is
    // the point of the exercise; the surrounding copy must not settle it.
    const card = nowCard().cloneNode(true) as HTMLElement
    card.querySelector('[data-prediction-choices]')?.remove()
    const visible = (card.textContent ?? '').toLowerCase()

    expect(visible).not.toContain('restore-drainage')
    expect(visible).not.toMatch(/\bthe safe goal is\b/)
    expect(visible).not.toMatch(/\bpredict decrease\b/)
    // The causal chain is the debrief's job, not the question's.
    expect(visible).not.toContain('available venous return becomes insufficient')
    // No rationale is on screen yet — every one of them belongs to the verdict.
    for (const choice of ecmoLearnPredictionFor('preload-drainage-collapse')?.item.choices ?? []) {
      expect(screen.queryByText(choice.rationale)).toBeNull()
    }
  })

  it('sends the learner’s own triple to the engine, including when it is the wrong one', async () => {
    await openPredictionStep('preload-drainage-collapse', /Inspect the starting pattern/i)

    const unsafe = predictionChoice('preload-drainage-collapse', 'unsafe')
    fireEvent.click(screen.getByRole('radio', { name: unsafe.label }))
    fireEvent.click(screen.getByRole('button', { name: /Commit this prediction/i }))

    expect(latestState().scenario.prediction).toMatchObject({
      committed: true,
      goalId: unsafe.commitment.goalId,
      control: unsafe.commitment.control,
      direction: unsafe.commitment.direction,
    })
    // The engine recorded what was actually decided; it is not the scenario's expectation.
    expect(latestState().scenario.credit).toMatchObject({
      goal: false,
      control: true,
      direction: false,
    })
  })

  it('credits the expectation only when the learner selects the choice that carries it', async () => {
    await openPredictionStep('preload-drainage-collapse', /Inspect the starting pattern/i)

    const best = predictionChoice('preload-drainage-collapse', 'best')
    fireEvent.click(screen.getByRole('radio', { name: best.label }))
    fireEvent.click(screen.getByRole('button', { name: /Commit this prediction/i }))

    expect(latestState().scenario.prediction).toMatchObject({
      committed: true,
      goalId: best.commitment.goalId,
      control: best.commitment.control,
      direction: best.commitment.direction,
    })
    expect(latestState().scenario.credit).toMatchObject({
      goal: true,
      control: true,
      direction: true,
    })
  })

  it('shows the verdict on commitment, stays on the step, and advances only on Continue', async () => {
    const { lesson } = await mountDrill('preload-drainage-collapse')
    readStep(/Inspect the starting pattern/i)
    const predictionIndex = lesson.steps.findIndex((step) => step.predictionScenarioId)
    const nextTitle = lesson.steps[predictionIndex + 1].title

    const best = predictionChoice('preload-drainage-collapse', 'best')
    fireEvent.click(screen.getByRole('radio', { name: best.label }))
    fireEvent.click(screen.getByRole('button', { name: /Commit this prediction/i }))

    const verdict = document.querySelector('[data-answer-verdict]')
    expect(verdict).not.toBeNull()
    expect(verdict).toHaveAttribute('data-plausibility', 'best')
    expect(verdict?.textContent).toContain(best.rationale)
    expect(verdict?.textContent).toContain(best.label)
    expect(screen.getByText(/why the other answers do not fit/i)).toBeInTheDocument()
    /*
     * The item's sources used to sit under the verdict. An owner review in September 2026 moved
     * every stage list into one folded block below the module, and the commitment that produced
     * this verdict is what unfolds the claims, so that is what this checks: the block is there,
     * it carries this item's sources, and it is now allowed to say what each is cited for.
     */
    expect(document.querySelector('[data-verdict-evidence]')).toBeNull()
    const sources = document.querySelector('[data-stage-sources]')
    expect(sources).toHaveAttribute('data-stage-sources-claims', 'true')
    for (const id of ecmoLearnPredictionFor('preload-drainage-collapse')?.item.evidenceIds ?? []) {
      expect(sources?.querySelector(`[data-evidence-id="${id}"]`)).not.toBeNull()
    }

    // Committing did not move the learner on.
    expect(
      screen.getByRole('heading', { name: /Commit to a prediction before you act/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: nextTitle })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByRole('heading', { name: nextTitle })).toBeInTheDocument()
  })

  it('announces an unsafe commitment assertively', async () => {
    await openPredictionStep('preload-drainage-collapse', /Inspect the starting pattern/i)

    const unsafe = predictionChoice('preload-drainage-collapse', 'unsafe')
    fireEvent.click(screen.getByRole('radio', { name: unsafe.label }))
    fireEvent.click(screen.getByRole('button', { name: /Commit this prediction/i }))

    const verdict = document.querySelector('[data-answer-verdict]')
    expect(verdict).toHaveAttribute('data-plausibility', 'unsafe')
    expect(verdict).toHaveAttribute('role', 'alert')
    expect(verdict).toHaveAttribute('aria-live', 'assertive')
  })

  it('reaches an answerable prediction at the end of the console tour', async () => {
    // The orientation lessons had the leak in its quietest form: the prompt did not name the
    // answer, but there was still nothing to choose between and the payload was already filled in.
    await mountDrill('startup-sensor-orientation')

    readStep(/identify all four sources/i)
    await openConsoleScreenAndAdvance('Parameter list')
    await rampToReferenceSpeedAndAdvance()
    performAndAdvance('Let the circuit respond')
    await openConsoleScreenAndAdvance('Parameter list')
    await openConsoleScreenAndAdvance('Blood parameters')
    await openConsoleScreenAndAdvance('Transport')
    await openConsoleScreenAndAdvance('Interventions')
    await openConsoleScreenAndAdvance('Timers')
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    await openConsoleScreenAndAdvance('Alarm list')
    await openConsoleScreenAndAdvance('Home')
    readStep(/I can distinguish the two gas controls/i)
    // The demonstration ends and the circuit goes back to the state a startup actually begins from.
    performAndAdvance(/Return the circuit to its pre-use state/i)

    const prediction = ecmoLearnPredictionFor('startup-sensor-orientation')
    if (!prediction) throw new Error('missing orientation prediction')
    expect(predictionRadios()).toHaveLength(prediction.item.choices.length)
    expect(latestState().scenario.prediction.committed).toBe(false)

    const unsafe = predictionChoice('startup-sensor-orientation', 'unsafe')
    fireEvent.click(screen.getByRole('radio', { name: unsafe.label }))
    fireEvent.click(screen.getByRole('button', { name: /Commit this prediction/i }))
    expect(latestState().scenario.prediction).toMatchObject({
      committed: true,
      goalId: unsafe.commitment.goalId,
      control: unsafe.commitment.control,
      direction: unsafe.commitment.direction,
    })
    expect(document.querySelector('[data-answer-verdict]')).toHaveAttribute('role', 'alert')
  })

  it('gives the VA orientation lesson its own question rather than the venovenous one', () => {
    const vaBest = predictionChoice('va-startup-sensor-orientation', 'best')
    const vvBest = predictionChoice('startup-sensor-orientation', 'best')

    // Both scenarios carry the same expectation, so inheriting the venovenous question would look
    // correct and teach nothing about a femoral arterial return.
    expect(vaBest.commitment).toEqual(vvBest.commitment)
    expect(vaBest.label).not.toEqual(vvBest.label)
    const vaLesson = cardiohelpLearnLessonsBySupportMode.va.find(
      (lesson) => lesson.scenarioId === 'va-startup-sensor-orientation',
    )
    const predictionSteps = (vaLesson?.steps ?? []).filter((step) => step.predictionScenarioId)
    expect(predictionSteps).toHaveLength(1)
    expect(predictionSteps[0].predictionScenarioId).toBe('va-startup-sensor-orientation')
  })
})

/**
 * Going back to a step already worked, on a drill.
 *
 * The foundation side of this is pinned in `foundation-phase-restoration.test.tsx`. A drill differs
 * in one way worth its own assertion: it runs a single engine forward, so coming back does not
 * rewind the circuit, and the card has to say that rather than implying the simulator came back too.
 */
describe('the way back on a drill', () => {
  function backControl(): HTMLElement | null {
    return document.querySelector<HTMLElement>('[data-now-back]')
  }

  it('offers no way back from the first step', async () => {
    await mountDrill('preload-drainage-collapse')
    expect(backControl()).toBeNull()
  })

  it('returns to the step before, keeps the commitment, and says the circuit did not rewind', async () => {
    await mountDrill('preload-drainage-collapse')
    readStep(/Inspect the starting pattern/i)
    answerPredictionAndAdvance('preload-drainage-collapse')

    // On the Act step now, with the commitment recorded in the engine.
    const committedBefore = latestState().scenario.prediction
    expect(committedBefore.committed).toBe(true)
    const rpmBefore = latestState().device.rpmSetpoint

    expect(backControl()?.textContent).toContain('Back to Predict')
    fireEvent.click(backControl()!)

    // The verdict is on screen again, the commitment is untouched, and the engine has not moved.
    expect(document.querySelector('[data-answer-verdict]')).not.toBeNull()
    expect(latestState().scenario.prediction).toEqual(committedBefore)
    expect(latestState().device.rpmSetpoint).toBe(rpmBefore)

    // And the card is honest about what came back and what did not.
    expect(nowStatus()).toMatch(/looking back at an earlier step/i)
    expect(nowStatus()).toMatch(/simulator is where you left it/i)
    expect(nowStatus()).toMatch(/nothing you have worked through is lost/i)
  })

  it('goes forward again from a step it came back to', async () => {
    const { lesson } = await mountDrill('preload-drainage-collapse')
    readStep(/Inspect the starting pattern/i)
    answerPredictionAndAdvance('preload-drainage-collapse')
    const actTitle = lesson.steps[2].title

    fireEvent.click(backControl()!)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByRole('heading', { name: actTitle })).toBeInTheDocument()
  })
})
