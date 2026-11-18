import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'

import { xrCtOverlayOpacity, xrCtOverlayStartsOn } from '@/lib/airway-anatomy/xr-ct-overlay'
import { SteeringRing } from './scope-primitives/SteeringRing'
import { XR_STEER_UNITS_PER_PRESS, XrDriveControls } from './xr-drive-controls'

/**
 * The in-scene buttons are three.js meshes that only render inside a WebGL canvas. Here each one is
 * a DOM button with the same label and trigger, so a test can press it; what is under test is
 * which handler each headset control calls, not how the mesh looks.
 */
jest.mock('./xr-widgets', () => ({
  XrButton: ({
    label,
    active,
    onTrigger,
  }: {
    label: string
    active?: boolean
    onTrigger: () => void
  }) => (
    <button type="button" aria-pressed={active ?? undefined} onClick={onTrigger}>
      {label}
    </button>
  ),
  XrText: () => null,
}))

const STEP_MM = 3

function renderVr(overrides: Partial<Parameters<typeof XrDriveControls>[0]> = {}) {
  const handlers = {
    onMove: jest.fn<void, [number]>(),
    onSteer: jest.fn<void, [number, number]>(),
    onRecenter: jest.fn<void, []>(),
    onToggleCtOverlay: jest.fn<void, []>(),
  }
  const view = render(<XrDriveControls stepMm={STEP_MM} ctOverlayOn {...handlers} {...overrides} />)
  return { ...handlers, ...view }
}

/** Presses one desktop steering-ring button and returns the steer it dispatched. */
function desktopSteer(angleDeg: number): [number, number] {
  const onSteer = jest.fn<void, [number, number]>()
  const { unmount } = render(<SteeringRing onSteer={onSteer} onRecenter={jest.fn()} />)
  const button = screen.getByRole('button', {
    name: `Steer ${angleDeg} degrees clockwise from up`,
  })
  fireEvent.pointerDown(button, { pointerId: 1 })
  fireEvent.pointerUp(button, { pointerId: 1 })
  unmount()
  expect(onSteer).toHaveBeenCalledTimes(1)
  return onSteer.mock.calls[0]
}

let restoreCapture: () => void = () => undefined
beforeAll(() => {
  // jsdom has no pointer capture; the desktop steering buttons ask for it on press.
  const prototype = Element.prototype as unknown as { setPointerCapture?: unknown }
  const had = 'setPointerCapture' in prototype
  if (!had) prototype.setPointerCapture = jest.fn()
  restoreCapture = () => {
    if (!had) delete prototype.setPointerCapture
  }
})
afterAll(() => restoreCapture())

describe('VR scope controls', () => {
  it('Advance and Withdraw call the drive handler the desktop buttons call, one step each way', () => {
    const { onMove, onSteer } = renderVr()
    fireEvent.click(screen.getByRole('button', { name: 'Advance' }))
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }))
    // Desktop: <HoldButton ariaLabel="Advance scope" onTrigger={() => onMove(stepMm)}> and
    // "Withdraw scope" with onMove(-stepMm), on the control panel and on the view.
    expect(onMove.mock.calls).toEqual([[STEP_MM], [-STEP_MM]])
    expect(onSteer).not.toHaveBeenCalled()
  })

  it.each([
    ['↑', 0],
    ['→', 90],
    ['↓', 180],
    ['←', 270],
  ])('the %s arrow steers the same way as the desktop ring button at %p°', (label, angle) => {
    const [desktopDx, desktopDy] = desktopSteer(angle)
    const { onSteer, onMove } = renderVr()
    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(onSteer).toHaveBeenCalledTimes(1)
    const [vrDx, vrDy] = onSteer.mock.calls[0]
    // Same axis and direction; a headset press is XR_STEER_UNITS_PER_PRESS desktop steps.
    expect(vrDx).toBeCloseTo(desktopDx * XR_STEER_UNITS_PER_PRESS, 9)
    expect(vrDy).toBeCloseTo(desktopDy * XR_STEER_UNITS_PER_PRESS, 9)
    expect(onMove).not.toHaveBeenCalled()
  })

  it('Recenter view calls the same recenter handler as the desktop ring', () => {
    const { onRecenter } = renderVr()
    fireEvent.click(screen.getByRole('button', { name: 'Recenter view' }))
    expect(onRecenter).toHaveBeenCalledTimes(1)
  })

  it('labels the CT overlay switch with its state', () => {
    const { rerender, onMove, onSteer, onRecenter, onToggleCtOverlay } = renderVr()
    const on = screen.getByRole('button', { name: 'CT overlay: on' })
    expect(on).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(on)
    expect(onToggleCtOverlay).toHaveBeenCalledTimes(1)
    // Switching the overlay never drives or steers the scope.
    expect(onMove).not.toHaveBeenCalled()
    expect(onSteer).not.toHaveBeenCalled()

    rerender(
      <XrDriveControls
        stepMm={STEP_MM}
        ctOverlayOn={false}
        onMove={onMove}
        onSteer={onSteer}
        onRecenter={onRecenter}
        onToggleCtOverlay={onToggleCtOverlay}
      />,
    )
    expect(screen.getByRole('button', { name: 'CT overlay: off' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})

/** The VR scene's switch state and the opacity it hands the CT plane, as AirwayXRScene holds them. */
function CtSwitchHarness({
  desktopOpacity,
  onMove,
}: {
  desktopOpacity: number
  onMove: (deltaMm: number) => void
}) {
  const [on, setOn] = useState(() => xrCtOverlayStartsOn(desktopOpacity))
  return (
    <>
      <output aria-label="CT plane opacity">{xrCtOverlayOpacity(on, desktopOpacity)}</output>
      <XrDriveControls
        stepMm={STEP_MM}
        onMove={onMove}
        onSteer={jest.fn()}
        onRecenter={jest.fn()}
        ctOverlayOn={on}
        onToggleCtOverlay={() => setOn((value) => !value)}
      />
    </>
  )
}

describe('VR CT overlay switch state', () => {
  it('hides and shows the CT plane and leaves Advance working either way', () => {
    const onMove = jest.fn<void, [number]>()
    render(<CtSwitchHarness desktopOpacity={0.28} onMove={onMove} />)
    const opacity = () => Number(screen.getByLabelText('CT plane opacity').textContent)

    expect(opacity()).toBe(0.28)
    fireEvent.click(screen.getByRole('button', { name: 'CT overlay: on' }))
    expect(opacity()).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Advance' }))
    fireEvent.click(screen.getByRole('button', { name: 'CT overlay: off' }))
    expect(opacity()).toBe(0.28)
    fireEvent.click(screen.getByRole('button', { name: 'Advance' }))

    expect(onMove.mock.calls).toEqual([[STEP_MM], [STEP_MM]])
  })

  it('starts off when the desktop slider is at zero, and on shows a visible plane', () => {
    render(<CtSwitchHarness desktopOpacity={0} onMove={jest.fn()} />)
    const opacity = () => Number(screen.getByLabelText('CT plane opacity').textContent)
    expect(opacity()).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'CT overlay: off' }))
    expect(opacity()).toBeGreaterThan(0.01)
  })
})
