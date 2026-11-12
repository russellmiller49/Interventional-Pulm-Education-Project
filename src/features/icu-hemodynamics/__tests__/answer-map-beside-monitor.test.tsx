import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, render } from '@testing-library/react'

import type { CatheterMapAnswer } from '../components/catheter-map/CatheterMap'
import { HemodynamicsSimulatorPane } from '../components/stage/HemodynamicsSimulatorPane'
import { hemodynamicsStageLesson } from '../content/stageLessons'
import { hemodynamicsTaskPresentation } from '../content/taskPresentation'
import { freshTeachingState } from '../engine/stageRuntime'

jest.mock('@/features/critical-care/analytics', () => ({
  recordCriticalCareEvent: jest.fn(),
}))
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
jest.mock('../components/HemodynamicHeart3DDynamic', () => ({
  HemodynamicHeart3DDynamic: () => <div data-mock-heart>Mock heart</div>,
}))

afterEach(cleanup)

/**
 * "Where is the tip?": the map the learner confirms each place on.
 *
 * It closed the monitor's own column, under the tracing and the controls. Measured in November
 * 2026 on "Advance by the tracing", 30% of its drawing was in view at 1600 × 852 and none at
 * 1280 × 720; on "Repair, then move" none was at any size. Every stop meant pressing Advance,
 * scrolling down to answer and scrolling back, the pattern the owner reported in the waveform
 * section. It now leads the column beside the monitor, and the 3D heart follows it.
 */
describe('the answer map on a catheter-procedure task', () => {
  const lesson = hemodynamicsStageLesson('catheter-advancement')
  const handsOn = lesson.steps.filter((step) => step.interaction.kind === 'simulator-task')
  const answer: CatheterMapAnswer = {
    legend: 'Which place is the tip at now?',
    name: 'hd-locate-test',
    choices: [
      { id: 'ra', label: 'The right atrium' },
      { id: 'rv', label: 'The right ventricle' },
      { id: 'pa', label: 'The pulmonary artery' },
    ],
    targets: { ra: 'ra', rv: 'rv', pa: 'pa' } as CatheterMapAnswer['targets'],
    selectedChoiceId: null,
    onSelect: jest.fn(),
    disabled: false,
  }

  function mount(step: (typeof lesson.steps)[number], mapAnswer?: CatheterMapAnswer) {
    const state = freshTeachingState(700)
    const presentation = hemodynamicsTaskPresentation('catheter-advancement', step)
    render(
      <HemodynamicsSimulatorPane
        state={state}
        dispatch={jest.fn()}
        surface={step.surface}
        flushLine="pulmonary-artery"
        controlsEnabled
        chamberLabel="shown"
        stops={[]}
        tipVisible
        presentation={presentation}
        baseline={state}
        mapAnswer={mapAnswer}
      />,
    )
    return presentation
  }

  it('has two hands-on tasks, both with the monitor and the heart side by side', () => {
    expect(handsOn).toHaveLength(2)
    for (const step of handsOn) {
      const presentation = hemodynamicsTaskPresentation('catheter-advancement', step)
      expect(presentation.anatomy).toBe('paired')
      expect(presentation.controls).toBe(true)
    }
  })

  it.each([0, 1])('leads the column beside the monitor on hands-on task %i', (index) => {
    mount(handsOn[index], answer)
    const monitorColumn = document.querySelector('[data-monitor-column]')!
    const answerColumn = document.querySelector('[data-answer-map-column]')!
    const map = answerColumn.querySelector('[data-catheter-map]')!
    // Beside the monitor, not under it.
    expect(monitorColumn.querySelector('[data-catheter-map]')).toBeNull()
    expect(monitorColumn.nextElementSibling).toBe(answerColumn)
    // The tracing and the controls stay together in the monitor's column.
    expect(monitorColumn.querySelector('[data-waveform-strip]')).not.toBeNull()
    expect(monitorColumn.querySelector('[data-dock]')).not.toBeNull()
    // The map carries the question, and comes before the heart.
    expect(map.querySelector('[data-catheter-map-answer]')).not.toBeNull()
    expect(map.querySelectorAll('input[type="radio"]')).toHaveLength(3)
    const heart = answerColumn.querySelector('[data-surface="heart-3d"]')!
    expect(answerColumn.firstElementChild).toBe(map)
    expect(map.compareDocumentPosition(heart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('is the only map on the screen: the heart drops its folded copy', () => {
    mount(handsOn[0], answer)
    expect(document.querySelectorAll('[data-catheter-map]')).toHaveLength(1)
    expect(document.body.textContent).not.toContain('2D catheter map and keyboard position choices')
  })

  it('leaves a task with no map question as it was: the heart beside the monitor, its map folded', () => {
    mount(handsOn[0])
    expect(document.querySelector('[data-answer-map-column]')).toBeNull()
    const monitorColumn = document.querySelector('[data-monitor-column]')!
    expect(monitorColumn.nextElementSibling).toHaveAttribute('data-surface', 'heart-3d')
    const fold = monitorColumn.nextElementSibling!.querySelector('details')!
    expect(fold.querySelector('summary')).toHaveTextContent(
      '2D catheter map and keyboard position choices',
    )
    expect(fold.open).toBe(false)
  })
})
