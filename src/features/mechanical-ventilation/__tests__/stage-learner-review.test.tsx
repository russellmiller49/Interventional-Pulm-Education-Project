import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { STAGE_PANE_NAMES } from '@/features/learning-module/stage/stageModel'

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { VentilationStageHost } from '../components/stage/VentilationStageHost'
import { BREATH_STOP_CHECKLIST_LABEL, breathStopIds } from '../content/breathSpine'
import { ventilationLearningUnits } from '../content/learningCurriculum'
import { ventilationExperimentByUnit } from '../content/learningExperiments'
import { ventilationStageLesson, ventilationStageLessonErrors } from '../content/stageLessons'

/**
 * What the September 2026 learner-review round changed on this module's stage, pinned.
 *
 * The findings came from a walk of the ECMO Learn pathway by someone who had not built it, and the
 * ones that transfer are properties of the shape this module shares: panes with names only in
 * `aria-label`, steps that name no pane, a surface a step points at that carries no printed name.
 * The record beside this module's docs says what each became; this suite says it stays. It also
 * re-pins the pane order D2 recorded, whose previous guard was retired with the flow rebuild.
 */

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
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
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
  Element.prototype.scrollIntoView = jest.fn()
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

const boot = () => act(() => jest.advanceTimersByTime(10))
const simulate = (seconds: number) => act(() => jest.advanceTimersByTime(seconds * 1000))
const nowCard = () => document.querySelector('[data-now-card]') as HTMLElement
const primary = () => document.querySelector('[data-now-primary]') as HTMLButtonElement | null
const stageId = () => document.querySelector('[data-stage]')?.getAttribute('data-stage')
const whereLine = () => document.querySelector('[data-now-card] [data-now-where]')?.textContent

function paneOrder(): readonly string[] {
  return [...document.querySelectorAll('[data-pane]')].map(
    (pane) => pane.getAttribute('data-pane') ?? '',
  )
}

function captions(): readonly string[] {
  return [...document.querySelectorAll('[data-pane-label]')].map((label) => label.textContent ?? '')
}

function mount(unitId: string) {
  render(<VentilationStageHost unitId={unitId} />)
  boot()
  return ventilationStageLesson(unitId)
}

describe('the panes say what they are', () => {
  it('leads with the steps and prints a name on each, as the other three adopters do', () => {
    mount('mechanics-load-and-pressure')
    /*
     * MVLR-OD-1, which amends D2 §2's "live ventilator → teaching → learner action". That order
     * had had no guard since PR #127 deleted the test §7 named for it; this is the guard, and it
     * holds the order the owner settled across all four adopters of the shared stage.
     */
    expect(paneOrder()).toEqual(['task', 'teaching', 'simulator'])
    expect(captions()).toEqual([
      'Steps panel · what to do',
      'Teaching panel · what to read',
      'Simulator panel · the live ventilator, the quick controls and the breath map',
    ])
    for (const name of Object.values(STAGE_PANE_NAMES)) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument()
    }
  })

  it('passes the fractions and floors that keep the ventilator the widest pane', () => {
    // Byte-identical to hemodynamics and mechanical circulatory support: the simulator is the
    // widest pane at every validated width whatever end of the row it sits at. The measured table
    // is in the module's learner-review record.
    const host = readFileSync(
      join(
        process.cwd(),
        'src/features/mechanical-ventilation/components/stage/VentilationStageHost.tsx',
      ),
      'utf8',
    )
    expect(host).toContain("const PANE_ORDER = ['steps', 'teaching', 'simulator'] as const")
    expect(host).toContain(
      'const PANE_WIDTH_FRACTIONS = { primary: 0.26, secondary: 0.29 } as const',
    )
    expect(host).toContain(
      'const PANE_MINIMUMS = { primary: 300, secondary: 280, tertiary: 340 } as const',
    )
  })
})

describe('every step says where it is worked', () => {
  it('authors a location on every step of every section, and the builder would refuse one without', () => {
    for (const unit of ventilationLearningUnits) {
      const lesson = ventilationStageLesson(unit.id)
      expect(ventilationStageLessonErrors(lesson)).toEqual([])
      for (const step of lesson.steps) {
        expect(`${unit.id} ${step.id}: ${step.lookIn.pane}`).toMatch(
          /: (steps|teaching|simulator)$/,
        )
        expect(step.lookIn.landmark.trim().length).toBeGreaterThan(0)
      }
    }
    const lesson = ventilationStageLesson('waveform-anatomy')
    const broken = {
      ...lesson,
      steps: lesson.steps.map((step, index) =>
        index === 0 ? { ...step, lookIn: { pane: 'teaching', landmark: 'Teaching panel' } } : step,
      ),
    } as typeof lesson
    expect(ventilationStageLessonErrors(broken)).toEqual([
      'waveform-anatomy step 1 uses a pane name as a landmark inside that pane.',
    ])
  })

  it('prints the location under the instruction, naming a pane whose caption says the same word', () => {
    const lesson = mount('breathing-with-support')
    expect(whereLine()).toBe(
      'Where to look: Teaching panel — Why a ventilator exists, and Simulator panel — the live console.',
    )
    // The heading it names is on the teaching pane at this step, open.
    expect(
      within(
        document.querySelector('[data-teaching-block="orientation"]') as HTMLElement,
      ).getByRole('heading', { name: 'Why a ventilator exists' }),
    ).toBeInTheDocument()
    const printed = captions()
    for (const named of nowCard().querySelectorAll('[data-now-where] strong')) {
      expect(printed.some((caption) => caption.startsWith(named.textContent ?? '∅'))).toBe(true)
    }
    fireEvent.click(primary()!)
    expect(stageId()).toBe(lesson.steps[1].id)
    expect(whereLine()).toBe(
      'Where to look: Steps panel — the answer choices below, and Simulator panel — the live console.',
    )
  })

  it('repeats the location in the help dialog', () => {
    mount('breathing-with-support')
    fireEvent.click(document.querySelector('[data-stage-help]')!)
    expect(document.querySelector('[data-stage-help-dialog]')?.textContent).toMatch(
      /Where to look: Teaching panel — Why a ventilator exists/,
    )
  })

  it('points a location question at the map, the walk at the stop card, and the reveal at the picture and the checklist', () => {
    const locate = ventilationStageLesson('triggering-and-cycling').steps[0]
    expect(locate.lookIn).toEqual({
      pane: 'simulator',
      landmark: 'the numbered stops on the breath map',
      alsoPane: 'steps',
      alsoLandmark: 'Commit my answer, on this card',
    })
    const walk = ventilationStageLesson('waveform-anatomy').steps[0]
    expect(walk.lookIn.pane).toBe('steps')
    expect(walk.lookIn.alsoPane).toBe('simulator')
    const explain = ventilationStageLesson('mechanics-load-and-pressure').steps[4]
    expect(explain.phase).toBe('explain')
    expect(explain.lookIn).toEqual({
      pane: 'steps',
      landmark: 'the verdict and what changed, below',
      alsoPane: 'teaching',
      alsoLandmark: 'The picture and the checklist',
    })
    const bedside = ventilationStageLesson('safety-reassessment-and-human-factors').steps[0]
    expect(bedside.lookIn.landmark).toBe('Patient and circuit findings, below the breath map')
  })

  it('names the surfaces the act and observe steps are worked on, in the words they carry', () => {
    const unitId = 'mechanics-load-and-pressure'
    const lesson = mount(unitId)
    const first = ventilationExperimentByUnit.get(unitId)!.rounds[0]
    fireEvent.click(primary()!)
    fireEvent.click(within(nowCard()).getByRole('radio', { name: first.choices[first.correct] }))
    fireEvent.click(primary()!)
    fireEvent.click(primary()!)
    expect(stageId()).toBe(lesson.steps[2].id)
    expect(whereLine()).toBe(
      'Where to look: Simulator panel — Quick controls for this step, under the console.',
    )
    expect(screen.getByRole('region', { name: 'Quick controls for this step' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('slider', { name: /Patient resistance/ }), {
      target: { value: '2' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Perform inspiratory hold/ }))
    simulate(6)
    fireEvent.click(primary()!)
    expect(stageId()).toBe(lesson.steps[3].id)
    expect(whereLine()).toBe(
      'Where to look: Simulator panel — Readings to watch, under the console.',
    )
    // The label the step names is printed on the readings, not only in an accessible name.
    const readings = document.querySelector('[data-live-readings]') as HTMLElement
    expect(within(readings).getByText('Readings to watch')).toBeInTheDocument()
    expect(readings.getAttribute('aria-labelledby')).toBeTruthy()
    simulate(first.seconds + 1)
    fireEvent.click(primary()!)
    expect(stageId()).toBe(lesson.steps[4].id)
    expect(whereLine()).toBe(
      'Where to look: Steps panel — the verdict and what changed, below, and Teaching panel — The picture and the checklist.',
    )
    expect(
      within(document.querySelector('[data-teaching-block="method"]') as HTMLElement).getByRole(
        'heading',
        { name: 'The picture and the checklist' },
      ),
    ).toBeInTheDocument()
  })
})

describe('the simulator says when it cannot be operated', () => {
  it('names the lock while the learner decides, and the pause while they look back', () => {
    const unitId = 'mechanics-load-and-pressure'
    const lesson = mount(unitId)
    const first = ventilationExperimentByUnit.get(unitId)!.rounds[0]
    fireEvent.click(primary()!)
    expect(stageId()).toBe(lesson.steps[1].id)
    expect(document.querySelector('[data-controls-locked-note]')?.textContent).toMatch(
      /locked while you decide/,
    )
    expect(document.querySelector('[data-controls-paused-note]')).toBeNull()
    fireEvent.click(within(nowCard()).getByRole('radio', { name: first.choices[first.correct] }))
    fireEvent.click(primary()!)
    expect(document.querySelector('[data-controls-locked-note]')).toBeNull()
    fireEvent.click(primary()!)
    expect(stageId()).toBe(lesson.steps[2].id)
    expect(document.querySelector('[data-quick-controls-note]')?.textContent).toBe(
      'The same settings as on the console.',
    )

    // Meet the goals, move on to Observe, then look back at Act — where the quick controls are.
    fireEvent.change(screen.getByRole('slider', { name: /Patient resistance/ }), {
      target: { value: '2' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Perform inspiratory hold/ }))
    simulate(6)
    fireEvent.click(primary()!)
    expect(stageId()).toBe(lesson.steps[3].id)
    fireEvent.click(document.querySelector('[data-now-back]')!)
    expect(stageId()).toBe(lesson.steps[2].id)
    expect(document.querySelector('[data-now-status]')?.textContent).toMatch(/looking back/)
    expect(
      document.querySelector('[data-ventilation-console]')?.getAttribute('data-controls-locked'),
    ).toBe('true')
    expect(document.querySelector('[data-controls-locked-note]')).toBeNull()
    expect(document.querySelector('[data-controls-paused-note]')?.textContent).toMatch(
      /paused while you look back/,
    )
    expect(document.querySelector('[data-quick-controls-note]')?.textContent).toBe(
      'Paused while you look back.',
    )
    // The transport stays live in both states, and neither note claims otherwise.
    expect(screen.getByRole('button', { name: /Advance one breath/ })).toBeEnabled()
  })
})

describe('Reset patient says what it does', () => {
  it('waits while the learner decides, is paused on a look-back, and says what it clears once there is something to clear', () => {
    const unitId = 'mechanics-load-and-pressure'
    const lesson = mount(unitId)
    const first = ventilationExperimentByUnit.get(unitId)!.rounds[0]
    const reset = () => screen.getByRole('button', { name: /Reset patient/ })
    expect(reset()).toBeEnabled()
    expect(reset().getAttribute('title')).toMatch(/Your prediction is kept/)
    expect(document.querySelector('[data-reset-note]')).toBeNull()

    // Deciding: a reset would only send the learner back a step, so it waits and says so.
    fireEvent.click(primary()!)
    expect(stageId()).toBe(lesson.steps[1].id)
    expect(reset()).toBeDisabled()
    expect(reset().getAttribute('title')).toMatch(/while you decide/)

    fireEvent.click(within(nowCard()).getByRole('radio', { name: first.choices[first.correct] }))
    fireEvent.click(primary()!)
    fireEvent.click(primary()!)
    expect(stageId()).toBe(lesson.steps[2].id)
    expect(reset()).toBeEnabled()
    expect(document.querySelector('[data-reset-note]')).toBeNull()

    // A change has been made: the surface says what a reset would undo.
    fireEvent.change(screen.getByRole('slider', { name: /Patient resistance/ }), {
      target: { value: '2' },
    })
    expect(document.querySelector('[data-reset-note]')?.textContent).toMatch(
      /clears the change, hold or observation you have made\. Your prediction is kept\./,
    )
    expect(reset().getAttribute('aria-describedby')).toBe(
      document.querySelector('[data-reset-note]')?.getAttribute('id'),
    )

    // Looking back: paused with the other controls.
    fireEvent.click(document.querySelector('[data-now-back]')!)
    expect(reset()).toBeDisabled()
    expect(reset().getAttribute('title')).toMatch(/Return to the live step/)
    expect(document.querySelector('[data-reset-note]')).toBeNull()
  })
})

describe('the short list says what kind of list it is', () => {
  const stageStyles = readFileSync(
    join(
      process.cwd(),
      'src/features/mechanical-ventilation/components/stage/ventilation-stage.module.css',
    ),
    'utf8',
  )

  it('labels the walk card checklist and the teaching stop checklist with one label, and marks them', () => {
    mount('waveform-anatomy')
    for (const stopId of breathStopIds) {
      const card = document.querySelector(`[data-walk-stop="${stopId}"]`) as HTMLElement
      const label = card.querySelector('[data-walk-checklist-label]')
      expect(label?.textContent).toBe(BREATH_STOP_CHECKLIST_LABEL)
      const list = card.querySelector('[data-walk-checklist]')
      expect(list?.getAttribute('aria-labelledby')).toBe(label?.getAttribute('id'))
      expect(list?.querySelectorAll('li').length).toBeGreaterThan(0)
      const teaching = document.querySelector(
        `[data-teaching-block="stop"][data-stop="${stopId}"]`,
      ) as HTMLElement
      const teachingList = teaching.querySelector('[data-stop-checklist]')
      expect(
        document.getElementById(teachingList?.getAttribute('aria-labelledby') ?? '')?.textContent,
      ).toBe(BREATH_STOP_CHECKLIST_LABEL)
      fireEvent.click(primary()!)
    }
    // The base stylesheet resets every list's marker; these two put it back.
    expect(stageStyles).toMatch(/\.walk ul {[^}]*list-style: disc;/)
    expect(stageStyles).toMatch(/\.block ul {[^}]*list-style: disc;/)
    expect(stageStyles).toMatch(/\.block ol {[^}]*list-style: decimal;/)
  })

  it('reads the muted colour from the shell token, never from the Tailwind triple', () => {
    // Inside the shared workspace `--muted` is an HSL triple, invalid as a colour, so every read
    // of it silently inherited the ink. Only the comment that says so may mention it.
    const reads = stageStyles.match(/var\(--muted[,)]/g) ?? []
    expect(reads).toEqual([])
    expect(stageStyles).toMatch(/var\(--stage-muted, #9fb4b7\)/)
  })
})

describe('the card keeps the promise the step makes', () => {
  const unitId = 'mechanics-load-and-pressure'

  it('renders the verdict in full on the Explain step, the explanation and the other answers included', () => {
    const lesson = mount(unitId)
    const first = ventilationExperimentByUnit.get(unitId)!.rounds[0]
    fireEvent.click(primary()!)
    fireEvent.click(within(nowCard()).getByRole('radio', { name: first.choices[first.correct] }))
    fireEvent.click(primary()!)
    fireEvent.click(primary()!)
    fireEvent.change(screen.getByRole('slider', { name: /Patient resistance/ }), {
      target: { value: '2' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Perform inspiratory hold/ }))
    simulate(6)
    fireEvent.click(primary()!)
    simulate(first.seconds + 1)
    fireEvent.click(primary()!)
    expect(stageId()).toBe(lesson.steps[4].id)
    expect(lesson.steps[4].instruction).toMatch(/^Read the verdict on your prediction/)
    const recap = document.querySelector('[data-explain-recap]')
    expect(recap?.textContent).toMatch(/^Correct\. That prediction holds/)
    expect(recap?.querySelector('[data-answer-verdict]')).not.toBeNull()
    expect(recap?.querySelector('[data-how-to-distinguish] strong')?.textContent).toBe(
      'The explanation',
    )
    expect(recap?.querySelector('[data-how-to-distinguish]')?.textContent).toContain(
      first.explanation,
    )
    expect(recap?.querySelectorAll('[data-other-answers] li')).toHaveLength(2)
    // Once on the card, not twice.
    expect(screen.getAllByText(first.explanation)).toHaveLength(1)
    expect(document.querySelector('[data-before-after]')).not.toBeNull()
  })

  it('shows the verdict again when the learner looks back at the prediction', () => {
    const lesson = mount(unitId)
    const first = ventilationExperimentByUnit.get(unitId)!.rounds[0]
    fireEvent.click(primary()!)
    fireEvent.click(within(nowCard()).getByRole('radio', { name: first.choices[0] }))
    fireEvent.click(primary()!)
    fireEvent.click(primary()!)
    expect(stageId()).toBe(lesson.steps[2].id)
    fireEvent.click(document.querySelector('[data-now-back]')!)
    expect(stageId()).toBe(lesson.steps[1].id)
    const verdict = nowCard().querySelector('[data-answer-verdict]')
    expect(verdict?.getAttribute('data-verdict-outcome')).toBe('correct')
    expect(verdict?.querySelector('[data-other-answers]')).not.toBeNull()
  })

  it('frames a prediction as a prediction, and a location read as a read', () => {
    const lesson = mount(unitId)
    const first = ventilationExperimentByUnit.get(unitId)!.rounds[0]
    fireEvent.click(primary()!)
    const wrong = first.choices.find((_, index) => index !== first.correct)!
    fireEvent.click(within(nowCard()).getByRole('radio', { name: wrong }))
    fireEvent.click(primary()!)
    expect(stageId()).toBe(lesson.steps[1].id)
    expect(nowCard().querySelector('[data-answer-verdict] p')?.textContent).toBe(
      'Not correct. That mechanism predicts a different response',
    )
    cleanup()

    mount('triggering-and-cycling')
    const answer = document.querySelector('[data-breath-map-answer]') as HTMLElement
    fireEvent.click(within(answer).getAllByRole('radio')[0])
    fireEvent.click(primary()!)
    expect(nowCard().querySelector('[data-answer-verdict] p')?.textContent).toMatch(
      /^(Correct\. That read holds|Not correct\. That mechanism predicts a different pattern)$/,
    )
    expect(nowCard().querySelector('[data-how-to-distinguish] strong')?.textContent).toBe(
      'How to distinguish it',
    )
  })
})
