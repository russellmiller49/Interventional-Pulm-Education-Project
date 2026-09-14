import { CircuitSchematic } from '../components/CircuitAndMonitors'
import { createInitialSimulationState, ecmoSimulationReducer } from '../engine'
import { VvNormalStatePanel } from '../components/teaching/VvNormalStatePanel'
import { VaNormalStatePanel } from '../components/teaching/VaNormalStatePanel'
import { VvSeriesPhysiologyPanel } from '../components/teaching/VvSeriesPhysiologyPanel'
import { VaParallelPhysiologyPanel } from '../components/teaching/VaParallelPhysiologyPanel'
import { StageTeachingScope } from '../components/stage/StageTeachingScope'
import { STAGE_PHASES } from '../components/stage/stageModel'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { EcmoFoundationLessonActivity } from '../components/EcmoFoundationLessonActivity'
import { ecmoTaskPresentation } from '../components/stage/activityPresentation'
import { buildFoundationStageLesson } from '../components/stage/adapters/foundationStageAdapter'
import { buildDrillStageLesson } from '../components/stage/adapters/drillStageAdapter'
import { cardiohelpLearnLessons } from '../content/learnLessons'
import { ecmoInteractiveFoundationSectionIds } from '../content/foundationLessonRuntime'
import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import {
  advanceFoundationOnce,
  currentFoundationStep,
  reachFoundationStep,
} from '../test-support/foundationJourney'
import {
  baselineGroups,
  foundationPresentationSections,
} from '../components/stage/foundationPresentationSections'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string
    children: ReactNode
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/learn',
}))
jest.mock('../components/EcmoCircuit3D', () => ({ EcmoCircuit3D: () => <div /> }))
afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

it.each(['vv', 'va'] as const)(
  '%s maps every registered task explicitly without changing its semantic phase or identity',
  (track) => {
    const pathway = criticalCareLearningPathway('cardiohelp-ecmo', track)
    for (const section of pathway.sections) {
      const foundation = ecmoInteractiveFoundationSectionIds.find((id) => id === section.id)
      const lesson = foundation
        ? buildFoundationStageLesson(foundation, track)
        : buildDrillStageLesson(
            cardiohelpLearnLessons.find((lesson) => lesson.scenarioId === section.id)!,
            track,
          )
      const before = JSON.stringify(lesson)
      for (const step of lesson.steps) {
        const display = ecmoTaskPresentation(lesson, step)
        expect(display).toBeDefined()
        if (step.foundationTask?.actionId) expect(display?.kind).toBe('comparison-lab')
        if (step.interaction.kind === 'simulator-task' && step.focusTarget === 'console')
          expect(display?.console).toBe(true)
      }
      expect(JSON.stringify(lesson)).toBe(before)
    }
  },
)

it.each(['vv', 'va'] as const)(
  '%s completes all eight control tasks with exactly one live response form and Run before Continue',
  (track) => {
    render(<EcmoFoundationLessonActivity sectionId="blood-flow-versus-sweep" supportMode={track} />)
    const visited = new Set<string>()
    const compared = new Set<string>()
    for (let count = 0; count < 30; count += 1) {
      const step = currentFoundationStep()
      visited.add(step)
      expect(document.querySelectorAll('[data-now-card]')).toHaveLength(1)
      expect(document.querySelector('[data-now-card]')?.textContent).not.toMatch(
        /\b(?:Steps|Teaching|Simulator) panel\b/,
      )
      expect(document.querySelectorAll('[data-prediction-choices]').length).toBeLessThanOrEqual(1)
      expect(document.querySelector('[aria-label="Workspace panel views"]')).toBeNull()
      if (document.querySelector('[data-stage-completion]')) break
      const comparison = document.querySelector('[data-foundation-comparison]')
      if (comparison?.getAttribute('data-comparison-complete') === 'false') {
        expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull()
        expect(document.querySelector('#cardiohelp-console')).toBeNull()
      }
      if (comparison?.getAttribute('data-comparison-complete') === 'true') compared.add(step)
      if (step.endsWith('-predict') || step.endsWith('-transfer'))
        expect(document.querySelector('[data-simulator-surfaces]')).toBeNull()
      advanceFoundationOnce()
    }
    expect(visited.size).toBe(8)
    expect(compared.size).toBe(5)
    expect(document.querySelector('[data-stage-completion]')).not.toBeNull()
  },
)

it.each(['vv', 'va'] as const)(
  '%s makes every blood-path stop part of the one task progression',
  (track) => {
    render(<EcmoFoundationLessonActivity sectionId="circuit-flow-path" supportMode={track} />)
    for (const stop of ['walk-drainage', 'walk-pump', 'walk-membrane', 'walk-return']) {
      expect(document.querySelector('[data-circuit-walk]')).toHaveAttribute('data-walk-stop', stop)
      expect(document.querySelector('[data-walk-next]')).toBeNull()
      expect(currentFoundationStep()).toBe('circuit-flow-path-recognize')
      advanceFoundationOnce()
    }
    expect(currentFoundationStep()).toBe('circuit-flow-path-gas-path')
    reachFoundationStep('circuit-flow-path', 'predict')
    expect(document.querySelector('[data-location-disclosure="withheld"]')).not.toBeNull()
    expect(document.querySelector('[data-other-answers-panel]')).toBeNull()
    expect(document.querySelectorAll('[data-map-question-actions] button')).toHaveLength(1)
  },
)

it.each(['vv', 'va'] as const)(
  '%s reads one baseline group at a time, then the combined view; Back preserves the group',
  (track) => {
    const section = track === 'vv' ? 'vv-normal-state' : 'va-normal-state'
    render(<EcmoFoundationLessonActivity sectionId={section} supportMode={track} />)
    const groups = baselineGroups[track]
    for (const group of groups) {
      const rendered = Array.from(document.querySelectorAll('[data-baseline-group]')).map((el) =>
        el.getAttribute('data-baseline-group'),
      )
      expect(rendered).toEqual(group === 'all' ? groups.filter((id) => id !== 'all') : [group])
      expect(currentFoundationStep()).toBe(`${section}-recognize`)
      if (group !== 'all') advanceFoundationOnce()
    }
    expect(document.querySelectorAll('#cardiohelp-console')).toHaveLength(1)
    fireEvent.click(document.querySelector('[data-now-back]')!)
    expect(document.querySelectorAll('[data-baseline-group]')).toHaveLength(1)
    expect(document.querySelector('#cardiohelp-console')).toBeNull()
    advanceFoundationOnce()
    advanceFoundationOnce()
    expect(currentFoundationStep()).toBe(`${section}-predict`)
    expect(document.querySelector('[data-baseline-table]')).toBeNull()
  },
)

it('keeps the single safety-gated clamp group outside optional 3D and its launch gate', () => {
  const state = createInitialSimulationState('arterial-bubble-stop')
  const dispatch = jest.fn()
  const { rerender } = render(
    <CircuitSchematic state={state} dispatch={dispatch} controlsEnabled />,
  )
  expect(document.getElementById('cardiohelp-clamp-return')).toBeNull()
  expect(document.querySelector('[data-circuit-controls-locked]')).not.toBeNull()
  const committed = ecmoSimulationReducer(state, {
    type: 'COMMIT_PREDICTION',
    goalId: 'prevent-air-return',
    control: 'correct-cause',
    direction: 'inspect',
  })
  rerender(<CircuitSchematic state={committed} dispatch={dispatch} controlsEnabled />)
  const clamp = document.getElementById('cardiohelp-clamp-return')!
  expect(clamp.closest('[role="tabpanel"]')).toBeNull()
  expect(clamp.closest('[data-gate-reason]')).toBeNull()
  expect(document.querySelectorAll('#cardiohelp-clamp-return')).toHaveLength(1)
  fireEvent.click(document.getElementById('cardiohelp-clamp-return')!)
  expect(dispatch).toHaveBeenCalledTimes(1)
  expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return' })
})

it.each([
  ['vv-normal-state', VvNormalStatePanel],
  ['va-normal-state', VaNormalStatePanel],
  ['vv-series-physiology', VvSeriesPhysiologyPanel],
  ['va-parallel-physiology', VaParallelPhysiologyPanel],
] as const)('%s assigns every original teaching section to a visible phase', (id, Panel) => {
  const state = createInitialSimulationState(
    id.startsWith('va-') ? 'va-startup-sensor-orientation' : 'startup-sensor-orientation',
  )
  const { container, rerender } = render(<Panel state={state} />)
  const keys = () =>
    Array.from(container.querySelector('[data-teaching-panel]')!.children)
      .map(
        (el) => el.getAttribute('aria-labelledby') ?? el.getAttribute('data-presentation-section'),
      )
      .filter(Boolean)
  const original = keys()
  const phases = foundationPresentationSections[id]
  expect(new Set(Object.values(phases).flat())).toEqual(new Set(original))
  for (const phase of STAGE_PHASES) {
    rerender(
      <StageTeachingScope
        value={{
          phase,
          stepId: `${id}-${phase}`,
          predictionCommitted: phase !== 'recognize' && phase !== 'predict',
          teachingSections: phases[phase],
        }}
      >
        <Panel state={state} />
      </StageTeachingScope>,
    )
    expect(new Set(keys())).toEqual(new Set(phases[phase]))
  }
})
