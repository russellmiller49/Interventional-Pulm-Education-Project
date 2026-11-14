import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'

import { AirwayDrillActivity } from '../components/AirwayDrillActivity'
import { PeripheralImagingPracticeLanding } from '../components/PeripheralImagingPracticeLanding'
import type { ImagingSuitePaneProps } from '../components/suite/types'
import { drillDebrief } from '../content/airwayDrill'
import { IMAGING_PROGRESS_STORAGE_KEY } from '../engine/selfPacedProgress'
import { AIRWAY_DRILL_CASES } from '../lib/airwayDrill'

// The suite is replaced at its boundary by a stand-in that prints what it was asked to show.
jest.mock('../components/suite/ImagingSuitePane', () => ({
  ImagingSuitePane: (props: ImagingSuitePaneProps) => (
    <div
      data-pane
      data-pane-independent={String(props.independent === true)}
      data-pane-airways={String(props.lab.values.airways)}
      data-pane-drill={String(props.lab.values.drillCase)}
      data-pane-orbit={String(props.lab.values.drillOrbit)}
      data-pane-controls={(props.view.controls ?? []).join(',')}
      data-pane-readouts={(props.view.readouts ?? []).join(',')}
    >
      <button type="button" onClick={() => props.onLabChange({ drillOrbit: -30 })}>
        turn to LAO 30
      </button>
      <button type="button" onClick={() => props.onLabChange({ orbit: 60, airways: 'lesion' })}>
        other keys
      </button>
    </div>
  ),
}))
jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => {
    const resolved =
      typeof href === 'string'
        ? href
        : `${href.pathname}${
            href.query && Object.keys(href.query).length > 0
              ? `?${new URLSearchParams(href.query).toString()}`
              : ''
          }`
    return (
      <a href={resolved} {...props}>
        {children}
      </a>
    )
  },
  useRouter: () => ({ push: jest.fn() }),
}))

beforeEach(() => localStorage.clear())
afterEach(cleanup)

const pane = () => document.querySelector<HTMLElement>('[data-pane]')!
const article = () => document.querySelector<HTMLElement>('[data-airway-drill]')!
const choose = (answer: string) => {
  fireEvent.click(document.querySelector(`[data-prediction-choices] input[value="${answer}"]`)!)
  fireEvent.click(document.querySelector('[data-now-primary]')!)
}

describe('one position of the drill', () => {
  const entry = AIRWAY_DRILL_CASES[0]

  it('shows the image alone until an answer is checked: no bronchus, no depth, no name', () => {
    render(<AirwayDrillActivity caseId={entry.id} />)
    expect(pane().dataset.paneIndependent).toBe('true')
    expect(pane().dataset.paneAirways).toBe('off')
    expect(pane().dataset.paneDrill).toBe(entry.id)
    expect(pane().dataset.paneControls).toBe('drillOrbit')
    expect(pane().dataset.paneReadouts).toBe('')
    expect(document.querySelector('[data-drill-feedback]')).toBeNull()
    expect(document.querySelector('[data-drill-axial]')).toBeNull()
    // Nothing on the screen names a bronchus or gives a distance before the answer.
    expect(article().textContent).not.toMatch(/[LR]B\d/)
    expect(article().textContent).not.toMatch(/\d+ mm/)
    expect(document.querySelector<HTMLButtonElement>('[data-now-primary]')?.disabled).toBe(true)
    expect(document.querySelectorAll('[data-prediction-choices] input')).toHaveLength(4)
    expect(document.querySelector('[data-drill-pairing] a')).toHaveAttribute(
      'href',
      '/peripheral-imaging/learn?section=projection',
    )
  })

  it('turns the C-arm from its own control and from nothing else', () => {
    render(<AirwayDrillActivity caseId={entry.id} />)
    fireEvent.click(document.querySelectorAll('[data-pane] button')[1])
    expect(pane().dataset.paneOrbit).toBe('0')
    expect(pane().dataset.paneAirways).toBe('off')
    fireEvent.click(document.querySelectorAll('[data-pane] button')[0])
    expect(pane().dataset.paneOrbit).toBe('-30')
  })

  it('opens the 3D view, the bronchi, the CT and the reasoning with the answer, and closes them on Try again', () => {
    render(<AirwayDrillActivity caseId={entry.id} />)
    choose('posterior-medial')
    expect(article().dataset.drillRevealed).toBe('true')
    expect(pane().dataset.paneIndependent).toBe('false')
    expect(pane().dataset.paneAirways).toBe('lesion')
    const debrief = drillDebrief(entry)
    expect(document.querySelector('[data-drill-verdict]')?.textContent).toBe(
      'Neither the depth nor the side: the nodule lies anterior and lateral to the tip.',
    )
    expect(document.querySelector('[data-drill-position]')?.textContent).toBe(debrief.position)
    expect(document.querySelector('[data-drill-side]')?.textContent).toBe(debrief.side)
    expect(document.querySelector('[data-drill-depth]')?.textContent).toBe(debrief.depth)
    expect(document.querySelector('[data-drill-next]')?.textContent).toBe(debrief.next)
    expect(document.querySelector('[data-drill-axial]')).not.toBeNull()
    expect(document.querySelector('[data-prediction-choices]')).toBeNull()

    fireEvent.click(document.querySelector('[data-answer-again]')!)
    expect(article().dataset.drillRevealed).toBe('false')
    expect(pane().dataset.paneIndependent).toBe('true')
    expect(pane().dataset.paneAirways).toBe('off')
    expect(pane().dataset.paneOrbit).toBe('0')
    expect(article().textContent).not.toMatch(/[LR]B\d/)
    expect(document.querySelector('[data-drill-axial]')).toBeNull()
  })

  it('saves nothing: no answer and no record of the position', () => {
    render(<AirwayDrillActivity caseId={entry.id} />)
    choose(entry.answer)
    expect(document.querySelector('[data-drill-verdict]')?.textContent).toMatch(/^Yes: /)
    expect(localStorage.getItem(IMAGING_PROGRESS_STORAGE_KEY)).toBeNull()
    expect(localStorage.length).toBe(0)
  })

  it('links the positions in order and back to Practice', () => {
    render(<AirwayDrillActivity caseId={AIRWAY_DRILL_CASES[0].id} />)
    expect(document.querySelector('[data-next-drill]')).toHaveAttribute(
      'href',
      '/peripheral-imaging/practice?drill=position-2',
    )
    cleanup()
    render(<AirwayDrillActivity caseId={AIRWAY_DRILL_CASES[7].id} />)
    expect(document.querySelector('[data-next-drill]')).toBeNull()
    expect(document.querySelector('[data-back-to-list]')).toHaveAttribute(
      'href',
      '/peripheral-imaging/practice',
    )
    cleanup()
    render(<AirwayDrillActivity caseId="position-99" />)
    expect(document.querySelector('[data-unknown-drill]')).not.toBeNull()
  })
})

describe('the Practice page', () => {
  it('lists the drill above the cases, without saying where any catheter is', () => {
    render(<PeripheralImagingPracticeLanding />)
    const link = document.querySelector('[data-practice-drill-link]')!
    expect(link).toHaveAttribute('href', '/peripheral-imaging/practice?drill=position-1')
    expect(link.textContent).toContain('Where is the nodule from the catheter tip?')
    expect(link.textContent).toContain('8 catheter positions')
    expect(link.textContent).not.toMatch(/[LR]B\d/)
  })
})
