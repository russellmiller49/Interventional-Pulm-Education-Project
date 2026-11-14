import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

jest.mock('@/i18n/navigation', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').navigationModule(),
)
jest.mock('../components/McsAnatomy3D', () =>
  jest.requireActual('../test-support/mcsWorkbenchStubs').anatomyModule(),
)

import { McsEchoLongAxisFigure } from '../components/stage/McsEchoLongAxisFigure'
import {
  MCS_ECHO_CP_TARGET_DEPTH_CM,
  MCS_ECHO_CP_TOO_DEEP_BEYOND_CM,
  MCS_ECHO_FIGURE_STATES,
  MCS_ECHO_WORKED_INLET_DEPTH_CM,
} from '../content/impellaEchoPosition'
import { MCS_NUMBERS } from '../content/teachingNumbers'
import { mountSection, setupMcsStage, teardownMcsStage } from '../test-support/mcsStage'

/**
 * Two drawings added in November 2026, where the module taught a picture in words alone: the
 * Impella CP on a long-axis echo view (Section 5) and the LVAD controller's display (Section 7).
 */
afterEach(() => cleanup())

const row = (id: string) => MCS_NUMBERS.rows.find((entry) => entry.id === id)!

describe('the long-axis drawing of an Impella CP', () => {
  it('is ruled against the register: the target depth and the too-deep limit', () => {
    expect(row('impella-cp-inlet-depth').value).toContain(`${MCS_ECHO_CP_TARGET_DEPTH_CM} cm`)
    expect(row('impella-cp-inlet-too-deep').value).toContain(
      `more than ${MCS_ECHO_CP_TOO_DEEP_BEYOND_CM} cm`,
    )
    // The too-deep position it draws is the worked example's own, and is past the limit.
    expect(MCS_ECHO_WORKED_INLET_DEPTH_CM).toBeGreaterThan(MCS_ECHO_CP_TOO_DEEP_BEYOND_CM)
  })

  it('opens on the aligned position, with the depth ruled from the annulus', () => {
    const { container } = render(<McsEchoLongAxisFigure />)
    const figure = container.querySelector('[data-echo-figure]')!
    expect(figure).toHaveAttribute('data-echo-state', 'aligned')
    expect(screen.getByRole('button', { name: 'Aligned' })).toHaveAttribute('aria-pressed', 'true')
    expect(figure.querySelector('[data-echo-ruler]')).not.toBeNull()
    expect(figure.querySelector('[data-echo-depth]')).toHaveTextContent(
      `Inlet ${MCS_ECHO_CP_TARGET_DEPTH_CM} cm below the annulus`,
    )
    expect(figure.querySelector('[data-echo-reading]')).toHaveTextContent(
      MCS_ECHO_FIGURE_STATES[0].reading,
    )
    // The drawing's name carries the position and its reading, so it is never colour alone.
    expect(screen.getByRole('img')).toHaveAccessibleName(
      `Impella CP on a parasternal long-axis view: Aligned ${MCS_ECHO_FIGURE_STATES[0].reading}`,
    )
  })

  it('shows too deep past the limit, and marks the limit on the ruler', () => {
    const { container } = render(<McsEchoLongAxisFigure />)
    fireEvent.click(screen.getByRole('button', { name: 'Too deep' }))
    const figure = container.querySelector('[data-echo-figure]')!
    expect(figure).toHaveAttribute('data-echo-state', 'too-deep')
    expect(figure.querySelector('[data-echo-limit]')).not.toBeNull()
    expect(figure.querySelector('[data-echo-depth]')).toHaveTextContent(
      `Inlet ${MCS_ECHO_WORKED_INLET_DEPTH_CM} cm below the annulus · limit ${MCS_ECHO_CP_TOO_DEEP_BEYOND_CM} cm`,
    )
  })

  it('draws no depth ruler when the inlet is above the valve', () => {
    const { container } = render(<McsEchoLongAxisFigure />)
    fireEvent.click(screen.getByRole('button', { name: 'Inlet in the aorta' }))
    const figure = container.querySelector('[data-echo-figure]')!
    expect(figure.querySelector('[data-echo-ruler]')).toBeNull()
    expect(figure.querySelector('[data-echo-depth]')).toHaveTextContent('Inlet above the valve')
  })

  it('sits in the echo teaching of the inlet-and-outlet task', () => {
    setupMcsStage()
    mountSection('impella-unloading-placement')
    const teaching = document.querySelector('[data-echo-position]')!
    expect(teaching.querySelector('[data-echo-figure]')).not.toBeNull()
    teardownMcsStage()
  })
})

describe('the drawn LVAD controller', () => {
  beforeEach(() => setupMcsStage())
  afterEach(() => teardownMcsStage())

  it('puts the four displayed quantities on the controller face with their live values', () => {
    mountSection('lvad-parameters-assessment')
    const tour = document.querySelector<HTMLElement>('[data-controller-figure]')!
    const tiles = [...tour.querySelectorAll<HTMLButtonElement>('[data-controller-tile]')]
    expect(
      tiles.map((tile) => within(tile).getByText(/\D/, { selector: 'span' }).textContent),
    ).toEqual(['Speed', 'Estimated pump flow', 'Electrical pump power', 'Pulsatility index'])
    // Each tile is named by its label and described by its value.
    const speed = within(tour).getByRole('button', { name: 'Speed' })
    expect(speed).toHaveAccessibleDescription(/^\d+ rpm$/)
    expect(speed).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps the bedside and calculated quantities off the controller', () => {
    mountSection('lvad-parameters-assessment')
    const tour = document.querySelector<HTMLElement>('[data-controller-figure]')!
    for (const name of ['Patient assessment', 'Cardiac power output']) {
      const button = within(tour).getByRole('button', { name })
      expect(button.closest('[data-controller-tile]')).toBeNull()
    }
    expect(tour).toHaveTextContent('Not on the controller')
  })

  it('still drives the tour: choosing a tile shows that quantity', () => {
    mountSection('lvad-parameters-assessment')
    const tour = document.querySelector<HTMLElement>('[data-controller-figure]')!
    fireEvent.click(within(tour).getByRole('button', { name: 'Electrical pump power' }))
    expect(document.querySelector('[data-parameter]')).toHaveAttribute('data-parameter', '2')
    fireEvent.click(within(tour).getByRole('button', { name: 'Cardiac power output' }))
    expect(document.querySelector('[data-parameter]')).toHaveAttribute('data-parameter', '5')
  })
})
