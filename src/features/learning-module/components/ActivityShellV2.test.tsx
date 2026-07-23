import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ActivityShell } from './ActivityShell'
import { ActivityStepper } from './ActivityStepper'
import { PatientContextBar } from './PatientContextBar'
import { ReferenceDrawer } from './ReferenceDrawer'
import { ResumeBanner } from './ResumeBanner'
import { isLowBandwidthConnection, SimulationLaunchGate } from './SimulationLaunchGate'
import { TaskPanel } from './TaskPanel'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('ActivityShell V2', () => {
  it('keeps orientation, patient context, viewport, current task, and utilities discoverable', async () => {
    const user = userEvent.setup()
    const onHelp = jest.fn()
    const onReset = jest.fn()
    const onSaveAndExit = jest.fn()

    render(
      <ActivityShell
        breadcrumb="Critical care / Hemodynamics"
        activityTitle="PAC signal validation"
        phase="act"
        mode="guided"
        progressLabel="Phase 3 of 6"
        onHelp={onHelp}
        onReset={onReset}
        onSaveAndExit={onSaveAndExit}
        patientContext={
          <PatientContextBar
            items={[{ label: 'Support', value: 'PAC' }]}
            immediateGoal="Validate the signal"
          />
        }
        viewport={<div>Monitor text equivalent</div>}
        currentTask={
          <TaskPanel
            mode="guided"
            objective="Correct the measurement chain"
            requiredAction="Level and zero"
          />
        }
      />,
    )

    expect(
      screen.getByRole('region', { name: 'PAC signal validation simulation workspace' }),
    ).toHaveAttribute('data-mode', 'guided')
    expect(screen.getByRole('heading', { name: 'PAC signal validation' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Patient context' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Simulation viewport' })).toHaveTextContent(
      'Monitor text equivalent',
    )
    expect(screen.getByRole('heading', { name: 'Current task' })).toBeInTheDocument()
    const helpButton = screen.getByRole('button', { name: 'Help' })
    expect(helpButton).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save & exit' })).toBeInTheDocument()
    expect(screen.getByText('Act').closest('li')).toHaveAttribute('aria-current', 'step')

    await user.tab()
    expect(helpButton).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onHelp).toHaveBeenCalledTimes(1)
  })

  it('communicates completed phases and the current phase without color', () => {
    render(<ActivityStepper currentPhase="observe" />)
    const recognizeStep = screen.getByText('Recognize').closest('li')
    expect(recognizeStep).toHaveAttribute('data-complete', 'true')
    expect(within(recognizeStep as HTMLElement).getByText(/completed/)).toHaveClass('sr-only')
    expect(screen.getByText('Observe').closest('li')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('Transfer').closest('li')).not.toHaveAttribute('data-complete')
    expect(screen.getByRole('group', { name: 'Activity phases' })).toBeInTheDocument()
  })

  it('withholds challenge hints while keeping guided hints keyboard operable', () => {
    const onHintRequested = jest.fn()
    const { rerender } = render(
      <TaskPanel
        mode="guided"
        objective="Inspect"
        requiredAction="Commit"
        hint="Check the leveling reference."
        onHintRequested={onHintRequested}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Show hint' }))
    expect(onHintRequested).toHaveBeenCalledTimes(1)

    rerender(
      <TaskPanel
        mode="challenge"
        objective="Inspect"
        requiredAction="Commit"
        hint="This must stay hidden."
      />,
    )
    expect(screen.queryByRole('button', { name: 'Show hint' })).not.toBeInTheDocument()
    expect(screen.queryByText('This must stay hidden.')).not.toBeInTheDocument()
  })

  it('gates a constrained device and permits an explicit safe continue', () => {
    const save = jest.fn()
    render(
      <SimulationLaunchGate
        activityTitle="Device console"
        minimumViewport="desktop"
        bandwidthClass="heavy"
        estimatedSizeLabel="24 MB"
        onSaveForLater={save}
        forceGate
      >
        <div>Full simulation</div>
      </SimulationLaunchGate>,
    )

    expect(screen.getByRole('heading', { name: 'A larger screen is recommended' })).toBeVisible()
    expect(screen.getByRole('heading').closest('section')).toHaveAttribute(
      'data-gate-reason',
      'viewport',
    )
    expect(screen.getByText('24 MB')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save for later' }))
    expect(save).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Continue on this device' }))
    expect(screen.getByText('Full simulation')).toBeInTheDocument()
  })

  it('offers a lightweight alternative on a constrained connection without hiding safe continue', () => {
    render(
      <SimulationLaunchGate
        activityTitle="3D device lab"
        minimumViewport="desktop"
        bandwidthClass="heavy"
        estimatedSizeLabel="42 MB"
        lightweightAlternativeHref="/critical-care/reference?item=device-text-alternative"
        forceLowBandwidth
      >
        <div>Heavy simulation</div>
      </SimulationLaunchGate>,
    )

    const heading = screen.getByRole('heading', {
      name: 'A lightweight version is recommended',
    })
    expect(heading.closest('section')).toHaveAttribute('data-gate-reason', 'bandwidth')
    expect(screen.getByRole('link', { name: 'Open lightweight alternative' })).toHaveAttribute(
      'href',
      '/critical-care/reference?item=device-text-alternative',
    )
    expect(screen.getByRole('button', { name: 'Continue on this device' })).toBeInTheDocument()
  })

  it('honors bandwidth and viewport overrides independently', () => {
    const { rerender } = render(
      <SimulationLaunchGate
        key="bandwidth"
        activityTitle="3D device lab"
        minimumViewport="desktop"
        bandwidthClass="heavy"
        estimatedSizeLabel="42 MB"
        forceGate={false}
        forceLowBandwidth
      >
        <div>Heavy simulation</div>
      </SimulationLaunchGate>,
    )

    expect(
      screen.getByRole('heading', { name: 'A lightweight version is recommended' }),
    ).toBeInTheDocument()

    rerender(
      <SimulationLaunchGate
        key="viewport"
        activityTitle="3D device lab"
        minimumViewport="desktop"
        bandwidthClass="heavy"
        estimatedSizeLabel="42 MB"
        forceGate
        forceLowBandwidth={false}
      >
        <div>Heavy simulation</div>
      </SimulationLaunchGate>,
    )

    expect(screen.getByRole('heading', { name: 'A larger screen is recommended' })).toBeVisible()
  })

  it('classifies only explicit data-saving or constrained network states as low bandwidth', () => {
    expect(isLowBandwidthConnection({ saveData: true, effectiveType: '4g' })).toBe(true)
    expect(isLowBandwidthConnection({ effectiveType: 'slow-2g' })).toBe(true)
    expect(isLowBandwidthConnection({ effectiveType: '2g' })).toBe(true)
    expect(isLowBandwidthConnection({ effectiveType: '3g' })).toBe(false)
    expect(isLowBandwidthConnection(undefined)).toBe(false)
  })

  it('shows the launch gate at a 390 by 844 mobile viewport', async () => {
    const originalWidth = window.innerWidth
    const originalHeight = window.innerHeight
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390, writable: true })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844, writable: true })

    render(
      <SimulationLaunchGate
        activityTitle="Fixed simulation workspace"
        minimumViewport="desktop"
        bandwidthClass="standard"
        estimatedSizeLabel="4 MB"
        lightweightAlternativeHref="/critical-care/reference"
      >
        <div>Desktop workspace</div>
      </SimulationLaunchGate>,
    )

    expect(
      await screen.findByRole('heading', { name: 'A larger screen is recommended' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Desktop workspace')).not.toBeInTheDocument()

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalWidth,
      writable: true,
    })
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalHeight,
      writable: true,
    })
  })

  it.each([
    ['ready', 'Resume activity'],
    ['incompatible', 'Start from safe checkpoint'],
    ['error', 'Start activity again'],
  ] as const)('renders the %s resume action', (state, action) => {
    render(
      <ResumeBanner
        state={state}
        title="Resume state"
        description="Status details"
        onResume={state === 'ready' ? jest.fn() : undefined}
        onStartSafe={state === 'ready' ? undefined : jest.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: action })).toBeInTheDocument()
  })

  it('does not mount an activity before the viewport suitability check completes', async () => {
    render(
      <SimulationLaunchGate
        activityTitle="Device console"
        minimumViewport="desktop"
        bandwidthClass="heavy"
        estimatedSizeLabel="24 MB"
      >
        <div>Deferred simulation</div>
      </SimulationLaunchGate>,
    )

    expect(screen.getByRole('heading', { name: 'Checking this display' })).toBeInTheDocument()
    expect(screen.queryByText('Deferred simulation')).not.toBeInTheDocument()
    expect(await screen.findByText('Deferred simulation')).toBeInTheDocument()
  })

  it('does not interrupt an activity that already launched when the viewport shrinks', async () => {
    const originalWidth = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200, writable: true })

    render(
      <SimulationLaunchGate
        activityTitle="Device console"
        minimumViewport="desktop"
        bandwidthClass="heavy"
        estimatedSizeLabel="24 MB"
      >
        <div>Active simulation</div>
      </SimulationLaunchGate>,
    )

    expect(await screen.findByText('Active simulation')).toBeInTheDocument()
    window.innerWidth = 600
    fireEvent.resize(window)
    expect(screen.getByText('Active simulation')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'A larger screen is recommended' }),
    ).not.toBeInTheDocument()

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalWidth,
      writable: true,
    })
  })

  it('opens and closes a reference drawer from the keyboard and restores trigger focus', async () => {
    const user = userEvent.setup()
    render(
      <ReferenceDrawer
        entries={[
          {
            id: 'signal-check',
            title: 'Signal check',
            summary: 'Validate the measurement chain before interpretation.',
          },
        ]}
        trigger={<button type="button">Reference</button>}
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Reference' })
    trigger.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('dialog', { name: 'Reference' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Reference' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
