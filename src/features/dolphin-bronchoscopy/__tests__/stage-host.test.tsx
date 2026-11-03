import { act, fireEvent, render, screen, within } from '@testing-library/react'

import { DolphinStageHost } from '../components/stage/DolphinStageHost'
import { DOLPHIN_PROGRESS_STORAGE_KEY } from '../engine/selfPacedProgress'

jest.mock(
  '@/components/airway-anatomy/AirwayAnatomyModuleDynamic',
  () =>
    jest.requireActual<typeof import('../test-support/ScopeTestDouble')>(
      '../test-support/ScopeTestDouble',
    ).scopeDoubleModule,
)
jest.mock(
  '@/i18n/navigation',
  () =>
    jest.requireActual<typeof import('../test-support/navigationDouble')>(
      '../test-support/navigationDouble',
    ).navigationDouble,
)

function nowCard() {
  return document.querySelector('[data-now-card]') as HTMLElement
}
function primary() {
  return within(nowCard())
    .getAllByRole('button')
    .find((b) => b.hasAttribute('data-now-primary'))!
}
function heading() {
  return within(nowCard()).getByRole('heading', { level: 2 }).textContent
}
async function mount(sectionId: Parameters<typeof DolphinStageHost>[0]['sectionId']) {
  render(<DolphinStageHost sectionId={sectionId} locale="en" />)
  // The launch gate checks the display on a timer before mounting the scope.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5))
  })
}

beforeEach(() => window.localStorage.clear())

describe('the dolphin stage host', () => {
  it('walks Recognize → Predict and keeps the answering teaching closed until then', async () => {
    await mount('from-blowhole-to-spout')
    expect(heading()).toBe('Read the question')
    expect(document.querySelector('[data-anchor]')).toBeNull()
    expect(screen.queryByText(/On each side of the spout is a nasopharyngeal fornix/)).toBeNull()
    fireEvent.click(primary())
    expect(heading()).toBe('Commit to a prediction')
  })

  it('shows the explanation before an answer without counting it as one', async () => {
    await mount('from-blowhole-to-spout')
    fireEvent.click(primary())
    fireEvent.click(screen.getByRole('button', { name: /Show the explanation without answering/ }))
    expect(document.querySelector('[data-explanation-peek]')).not.toBeNull()
    expect(primary()).toBeDisabled()
    expect(within(nowCard()).getByRole('button', { name: 'Skip this step' })).toBeInTheDocument()
  })

  it('never performs a skipped step', async () => {
    await mount('from-blowhole-to-spout')
    fireEvent.click(primary())
    fireEvent.click(within(nowCard()).getByRole('button', { name: 'Skip this step' }))
    expect(heading()).toBe('Drive the scope')
    const predictRow = document.querySelector('[data-step-id="from-blowhole-to-spout:predict"]')!
    expect(predictRow.getAttribute('data-step-state')).not.toBe('done')
  })

  it('completes the scope lab only after the goal, with the fornix hint on the way', async () => {
    await mount('from-blowhole-to-spout')
    fireEvent.click(primary())
    fireEvent.click(within(nowCard()).getByRole('button', { name: 'Skip this step' }))
    expect(primary()).toBeDisabled()
    const drive = (abbr: string) =>
      fireEvent.click(screen.getByRole('button', { name: `Drive to ${abbr}` }))
    drive('LNP')
    drive('NPX')
    drive('NPF')
    expect(document.querySelector('[data-scope-hint]')?.textContent).toMatch(/fornix/)
    expect(primary()).toBeDisabled()
    drive('NPX')
    drive('LS')
    expect(document.querySelector('[data-scope-done]')).not.toBeNull()
    expect(primary()).not.toBeDisabled()
    fireEvent.click(primary())
    expect(heading()).toBe('Read the explanation')
    expect(document.querySelector('[data-anchor]')).not.toBeNull()
  })

  it('starts the scope where the section says, with its label rule', async () => {
    await mount('from-blowhole-to-spout')
    const double = document.querySelector('[data-scope-double]')!
    expect(double.getAttribute('data-start-edge')).toBe('0')
    expect(double.getAttribute('data-branch-labels')).toBe('shown')
    expect(double.getAttribute('data-ct')).toBe('false')
  })

  it('stores places, never answers, and marks the section reviewed only at the end', async () => {
    await mount('why-scope-a-dolphin')
    fireEvent.click(primary())
    const choices = within(nowCard()).getAllByRole('radio')
    fireEvent.click(choices[0])
    fireEvent.click(within(nowCard()).getByRole('button', { name: 'Check my answer' }))
    for (let i = 0; i < 6; i += 1) {
      const skip = within(nowCard()).queryByRole('button', { name: 'Skip this step' })
      const button = primary()
      if (button && !button.hasAttribute('disabled')) fireEvent.click(button)
      else if (skip) fireEvent.click(skip)
    }
    expect(document.querySelector('[data-section-complete]')).not.toBeNull()
    const stored = window.localStorage.getItem(DOLPHIN_PROGRESS_STORAGE_KEY) ?? ''
    expect(stored).toContain('why-scope-a-dolphin')
    expect(stored).not.toMatch(/choice|correct|attempt|answer|arrived/i)
    expect(JSON.parse(stored).reviewedSectionIds).toEqual(['why-scope-a-dolphin'])
  })
})
