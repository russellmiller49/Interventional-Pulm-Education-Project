import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { act, cleanup, fireEvent, render } from '@testing-library/react'

import { VentilationStageHost } from '../components/stage/VentilationStageHost'
import { ventilationLearningUnits } from '../content/learningCurriculum'
import { ventilationStageLesson } from '../content/stageLessons'
import { ventilationLeakMatches, ventilationPrecommitDenyPatterns } from '../test-support/stageLeak'

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

/**
 * The whole document, hidden nodes included, with the one excused surface removed: the prediction
 * fieldset, where the answer is being asked. Closed `<details>` count — a folded block is one click
 * from view.
 */
function scannableText(): string {
  const clone = document.body.cloneNode(true) as HTMLElement
  for (const node of clone.querySelectorAll('[data-prediction-choices], [data-breath-map-answer]'))
    node.remove()
  for (const node of clone.querySelectorAll('script, style')) node.remove()
  return clone.textContent ?? ''
}

function attributesText(): string {
  return [...document.body.querySelectorAll('*')]
    .flatMap((node) =>
      [...node.attributes]
        .filter((a) => /^(aria-|title|alt|data-verdict|data-plausibility)/.test(a.name))
        .map((a) => a.value),
    )
    .join(' ')
}

describe('nothing answers a section before its prediction is committed (rendered)', () => {
  const findings: string[] = []

  it.each(ventilationLearningUnits.map((unit) => unit.id))('%s', (unitId) => {
    const lesson = ventilationStageLesson(unitId)
    const deny = ventilationPrecommitDenyPatterns(unitId)
    render(<VentilationStageHost unitId={unitId} />)
    act(() => {
      jest.advanceTimersByTime(10)
    })
    const atFirstStep = `${scannableText()} ${attributesText()}`
    for (const match of ventilationLeakMatches(atFirstStep, deny))
      findings.push(`${unitId} · first step: /${match}/`)

    // Reach the prediction the way a learner does: through the first step's own Continue.
    const first = lesson.steps[0]
    if (first.interaction.kind === 'read') {
      fireEvent.click(document.querySelector('[data-now-primary]')!)
    } else if (first.interaction.kind === 'walk') {
      for (let stop = 0; stop < 4; stop += 1)
        fireEvent.click(document.querySelector('[data-now-primary]')!)
      fireEvent.click(document.querySelector('[data-now-primary]')!)
    } else {
      // A location question is itself a commitment; the scan stops at its prediction step.
      const radio = document.querySelector<HTMLInputElement>('[data-breath-map-answer] input')!
      fireEvent.click(radio)
      fireEvent.click(document.querySelector('[data-now-primary]')!)
      fireEvent.click(document.querySelector('[data-now-primary]')!)
    }
    expect(document.querySelector('[data-stage]')?.getAttribute('data-stage')).toBe(
      lesson.steps[lesson.predictionStepIndex].id,
    )
    const atPrediction = `${scannableText()} ${attributesText()}`
    // The location verdict (now committed) may name its own stop; only the round's deny set applies.
    const roundDeny = deny.filter((pattern) => !/stop/.test(pattern.source))
    for (const match of ventilationLeakMatches(atPrediction, roundDeny))
      findings.push(`${unitId} · prediction step: /${match}/`)
    expect(document.querySelector('[data-answer-verdict][data-verdict-outcome]')).toBeNull()
    expect(
      document.querySelector('[data-stage-sources]')?.getAttribute('data-stage-sources-claims'),
    ).toBe('false')
  })

  it('found nothing', () => {
    expect(findings).toEqual([])
  })
})
