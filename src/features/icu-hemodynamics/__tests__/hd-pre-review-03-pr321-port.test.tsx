import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { BedsideMonitor } from '../components/BedsideMonitor'
import { HemodynamicCaseActivity } from '../components/HemodynamicCaseActivity'
import { HemodynamicNativeWorkspace } from '../components/HemodynamicNativeWorkspace'
import { icuHemodynamicsReducer } from '../engine'
import { cleanState, reduceAll } from '../engine/stageRuntime'

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
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))
jest.mock('../components/HemodynamicHeart3DDynamic', () => ({
  HemodynamicHeart3DDynamic: () => <div>Mock heart</div>,
}))

afterEach(cleanup)

/**
 * HD-PRE-REVIEW-03 — what PR #321 had that this branch did not.
 *
 * PR #321 (`codex/hd03-workbench-20261003`) is the other implementation of this batch. Eight of
 * its files are ones this branch never touched; each was read against this branch and the result is
 * recorded in the handoff. One behaviour was missing here and is ported: #321 keeps Practice's
 * measurement tools mounted and hides them where they are not offered, so a visit to an earlier
 * checkpoint does not empty them. The first test fails on the reviewed head.
 *
 * The other tests are the behaviours #321's own Jest files assert that this branch already had,
 * restated against this branch's DOM (its files assert #321's markup and cannot run here).
 */

const checkpoint = (name: RegExp) =>
  fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Case checkpoints' })).getByRole('button', {
      name,
    }),
  )

const tools = () => document.querySelector<HTMLElement>('[aria-label="Measurement tools"]')

function trials() {
  return [...tools()!.querySelectorAll('details')].find(
    (section) => section.querySelector('summary')?.textContent === 'Cardiac-output trials',
  )!
}

/** A draft that exists only in the tool: a technique choice for an injection not yet given. */
function draftAnInjection() {
  const section = trials()
  section.open = true
  const volume = within(section).getByLabelText(/^Volume/) as HTMLSelectElement
  fireEvent.change(volume, { target: { value: '15' } })
  expect(volume.value).toBe('15')
  return { section, volume, node: tools()! }
}

async function openCase() {
  render(<HemodynamicCaseActivity caseId="HD-01" mode="practice" />)
  await screen.findByRole('navigation', { name: 'Case checkpoints' })
}

describe('ported from PR #321 — the tools survive a visit to an earlier checkpoint', () => {
  it('keeps a draft and an opened tool while the patient or the findings are re-read', async () => {
    await openCase()
    checkpoint(/Choose an action/)
    const { section, volume, node } = draftAnInjection()

    for (const earlier of [/Read the patient/, /Interpret the findings/]) {
      checkpoint(earlier)
      // Not offered here: out of sight, out of the tab order and out of the accessibility tree …
      expect(tools()).toBe(node)
      expect(node).toHaveAttribute('hidden')
      expect(screen.queryByRole('button', { name: 'Open to air + zero' })).toBeNull()
      expect(within(node).queryAllByRole('button')).toHaveLength(0)
      checkpoint(/Choose an action/)
      // … and exactly as they were left on the way back.
      expect(tools()).toBe(node)
      expect(node).not.toHaveAttribute('hidden')
      expect(volume.isConnected).toBe(true)
      expect(volume.value).toBe('15')
      expect(section.open).toBe(true)
    }
  })

  it('keeps them through the observed response too, as before', async () => {
    await openCase()
    checkpoint(/Choose an action/)
    const { section, volume, node } = draftAnInjection()
    checkpoint(/Compare the response and reassess/)
    expect(tools()).toBe(node)
    expect(node).not.toHaveAttribute('hidden')
    fireEvent.click(screen.getByRole('button', { name: 'Back to actions and measurements' }))
    expect(tools()).toBe(node)
    expect(volume.value).toBe('15')
    expect(section.open).toBe(true)
  })

  it('still shows the tools wherever a balloon is up, and mounts none under the debrief', () => {
    const quiet = cleanState(510, 'pa')
    const { rerender } = render(
      <HemodynamicNativeWorkspace state={quiet} dispatch={jest.fn()} interactive={false} />,
    )
    expect(tools()).toHaveAttribute('hidden')
    const occluding = reduceAll(quiet, [{ type: 'START_WEDGE' }])
    expect(occluding.catheter.balloonInflated).toBe(true)
    rerender(
      <HemodynamicNativeWorkspace state={occluding} dispatch={jest.fn()} interactive={false} />,
    )
    // The way to deflate is never hidden behind a checkpoint.
    expect(tools()).not.toHaveAttribute('hidden')
    expect(within(tools()!).getAllByRole('button').length).toBeGreaterThan(0)
    cleanup()
    // The debrief's read-only view has no tools to keep, so it does not carry them.
    render(
      <HemodynamicNativeWorkspace
        state={quiet}
        dispatch={jest.fn()}
        interactive={false}
        revealModel
      />,
    )
    expect(tools()).toBeNull()
  })
})

describe('asserted by PR #321’s tests and already true here', () => {
  it('fits the axis to a raised right-atrial pressure rather than clipping it', () => {
    let state = icuHemodynamicsReducer(cleanState(), {
      type: 'SET_CATHETER_POSITION',
      position: 'ra',
    })
    state = {
      ...state,
      measurements: { ...state.measurements, rapMmHg: 45 },
      waveforms: state.waveforms.map((sample) => ({ ...sample, cvpMmHg: sample.cvpMmHg + 45 })),
    }
    render(<BedsideMonitor state={state} dispatch={jest.fn()} focus="pac" />)
    const strip = document.querySelector('[data-waveform-strip="cvpMmHg"]')!
    expect(
      [...strip.querySelectorAll('[data-strip-axis] span')].map((tick) => tick.textContent),
    ).toEqual(['80', '38', '-5'])
    expect(strip).not.toHaveAttribute('data-out-of-range')
    expect(document.querySelector('[data-waveform-range-note]')).toBeNull()
  })

  it('names the reason no mixed-venous sample is available, including during an occlusion', () => {
    const before = icuHemodynamicsReducer(cleanState(), {
      type: 'SET_CATHETER_POSITION',
      position: 'ra',
    })
    const { rerender } = render(<BedsideMonitor state={before} dispatch={jest.fn()} />)
    const cell = () => screen.getByRole('group', { name: 'Mixed venous oxygen saturation' })
    expect(cell()).toHaveTextContent(/SvO₂.*—.*not available before PA/)
    rerender(
      <BedsideMonitor
        state={reduceAll(cleanState(510, 'pa'), [{ type: 'START_WEDGE' }])}
        dispatch={jest.fn()}
      />,
    )
    expect(cell()).toHaveTextContent(/SvO₂.*—.*balloon/)
  })
})
