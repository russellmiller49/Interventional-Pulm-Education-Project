import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { fireEvent, render, screen, within } from '@testing-library/react'

import { CardiohelpConsole } from '../components/CardiohelpConsole'
import { createReferenceSimulationState } from '../engine'

/**
 * A console the learner cannot operate is a picture of one (November 2026).
 *
 * The foundation sections show the console beside the lesson with its pump, sweep and alarm
 * controls off, and hand the learner their changes as named lesson actions. The physical controls
 * were still drawn as buttons, two of them pressable, and a tester reported "the button on the
 * right doesn't work" (2026-10-23, Section 4). The choice here is to draw the picture as a picture
 * rather than to make it operable: these sections teach from fixed, restorable states, and a
 * console that could be driven would change the state their comparisons are read against.
 */

const css = readFileSync(
  join(process.cwd(), 'src/features/cardiohelp-ecmo/components/cardiohelp-ecmo.module.css'),
  'utf8',
)

function ruleBody(selector: string): string {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`${selector} is not declared`)
  return css.slice(start, css.indexOf('}', start))
}

function consoleView(controlsEnabled: boolean) {
  const dispatch = jest.fn()
  const view = render(
    <CardiohelpConsole
      state={createReferenceSimulationState('vv-reference')}
      dispatch={dispatch}
      controlsEnabled={controlsEnabled}
    />,
  )
  const panel = view.container.querySelector<HTMLElement>(
    '[aria-label="Physical console controls"]',
  )!
  return { ...view, dispatch, panel }
}

describe('the reading-only console', () => {
  it('marks its physical controls as a picture and says so on them', () => {
    const { container, panel } = consoleView(false)
    expect(panel).toHaveAttribute('data-console-picture', 'true')
    const label = within(panel).getByText('Picture · not live here')
    expect(label).toHaveAttribute('id', 'cardiohelp-console-picture-label')
    expect(panel).toHaveAttribute('aria-describedby', 'cardiohelp-console-picture-label')
    // The sentence that says what is off, and what still works, stays above the device.
    expect(container.querySelector('[data-console-reading-only]')).toHaveTextContent(
      'Reading only in this section.',
    )
    expect(container.querySelector('[data-console-reading-only]')).toHaveTextContent(
      'You can still move between the screens.',
    )
  })

  it('leaves no pressable control in the picture, the lock and alarm audio included', () => {
    const { panel, dispatch } = consoleView(false)
    const buttons = within(panel).getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(8)
    for (const button of buttons) expect(button).toBeDisabled()
    // The dial is not a tab stop.
    expect(within(panel).getByRole('slider')).toHaveAttribute('tabindex', '-1')
    for (const name of [/Lock controls/i, /Optional alarm audio/i, /Hold Safety/i]) {
      fireEvent.click(within(panel).getByRole('button', { name }))
    }
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('still shows every control the lesson names, so the text can point at them', () => {
    const { panel } = consoleView(false)
    for (const name of [
      /Hold Safety/i,
      /^Zero flow$/i,
      /Lock controls/i,
      /Power on/i,
      /^RPM$/,
      /^LPM$/,
      /Decrease setpoint/i,
      /Increase setpoint/i,
      /Optional alarm audio/i,
    ]) {
      expect(within(panel).getByRole('button', { name })).toBeInTheDocument()
    }
    expect(panel.querySelector('#cardiohelp-rpm-control')).not.toBeNull()
  })

  it('keeps the screen tabs, Home and Menu live', () => {
    const { dispatch } = consoleView(false)
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_SCREEN', screen: 'menu' })
    expect(screen.getByRole('button', { name: 'Home' })).toBeEnabled()
  })

  it('draws the picture flat, at full strength, with no pointer', () => {
    const picture = ruleBody(".physicalPanel[data-console-picture='true']")
    expect(picture).toContain('border: 1px dashed')
    expect(picture).toContain('repeating-linear-gradient')
    const controls = ruleBody(
      ".deviceShell[data-console-picture='true'] .physicalPanel :is(button, [role='slider']),\n.deviceShell[data-console-picture='true'] .screenToolbar button:disabled",
    )
    expect(controls).toContain('background: transparent')
    // Not the half-strength of a disabled button: the labels stay readable.
    expect(controls).toContain('opacity: 1')
    expect(controls).toContain('cursor: default')
    expect(
      ruleBody(
        ".deviceShell[data-console-picture='true'] .physicalPanel :is(button, [role='slider'])",
      ),
    ).toBeDefined()
    expect(css).toMatch(
      /\.deviceShell\[data-console-picture='true'\] \.physicalPanel :is\(button, \[role='slider'\]\) \{\s*pointer-events: none;/,
    )
  })
})

describe('a console the learner operates', () => {
  it('is not marked as a picture and keeps its controls live', () => {
    const { container, panel, dispatch } = consoleView(true)
    expect(panel).not.toHaveAttribute('data-console-picture')
    expect(container.querySelector('[data-console-picture]')).toBeNull()
    expect(container.querySelector('[data-console-picture-label]')).toBeNull()
    expect(container.querySelector('[data-console-reading-only]')).toBeNull()
    const audio = within(panel).getByRole('button', { name: /Optional alarm audio/i })
    expect(audio).toBeEnabled()
    fireEvent.click(audio)
    expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_ALARM_AUDIO' })
    expect(
      within(panel).getByRole('button', { name: /Lock controls|Hold to unlock/i }),
    ).toBeEnabled()
  })
})
