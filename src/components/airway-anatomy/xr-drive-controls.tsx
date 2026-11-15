'use client'

import { XrButton } from './xr-widgets'

/**
 * Steering units per headset arrow press. The module turns one unit into one desktop steering step
 * (3°), so a VR press steers 9°. The headset arrows already steered at this rate and work on the
 * Quest, so the rate is kept.
 */
export const XR_STEER_UNITS_PER_PRESS = 3

/** How far the controls reach above and below their origin, in metres (for the panel backing). */
export const XR_DRIVE_CONTROLS_EXTENT = { top: 0.085, bottom: 0.16 } as const

export interface XrDriveControlsProps {
  stepMm: number
  /** The module's Advance/Withdraw handler: the same one the desktop buttons call. */
  onMove: (deltaMm: number) => void
  /** The module's steering handler: the same one the desktop arrows call. */
  onSteer: (dxUnit: number, dyUpUnit: number) => void
  onRecenter: () => void
  ctOverlayOn: boolean
  onToggleCtOverlay: () => void
}

/**
 * The scope controls under the live bronchoscopy feed in the headset, laid out like the desktop
 * view: a steering pad on the left, Advance above Withdraw on the right, then Recenter and the CT
 * overlay switch. Every control is an in-scene mesh button, because the headset has no DOM.
 */
export function XrDriveControls({
  stepMm,
  onMove,
  onSteer,
  onRecenter,
  ctOverlayOn,
  onToggleCtOverlay,
}: XrDriveControlsProps) {
  const steer = XR_STEER_UNITS_PER_PRESS
  return (
    <>
      <XrButton
        label="↑"
        position={[-0.14, 0.06, 0]}
        size={[0.06, 0.05]}
        repeat
        onTrigger={() => onSteer(0, steer)}
      />
      <XrButton
        label="←"
        position={[-0.21, 0, 0]}
        size={[0.06, 0.05]}
        repeat
        onTrigger={() => onSteer(-steer, 0)}
      />
      <XrButton
        label="→"
        position={[-0.07, 0, 0]}
        size={[0.06, 0.05]}
        repeat
        onTrigger={() => onSteer(steer, 0)}
      />
      <XrButton
        label="↓"
        position={[-0.14, -0.06, 0]}
        size={[0.06, 0.05]}
        repeat
        onTrigger={() => onSteer(0, -steer)}
      />

      <XrButton
        label="Advance"
        position={[0.14, 0.035, 0]}
        size={[0.17, 0.06]}
        primary
        repeat
        onTrigger={() => onMove(stepMm)}
      />
      <XrButton
        label="Withdraw"
        position={[0.14, -0.04, 0]}
        size={[0.17, 0.06]}
        repeat
        onTrigger={() => onMove(-stepMm)}
      />

      <XrButton
        label="Recenter view"
        position={[-0.12, -0.135, 0]}
        size={[0.2, 0.05]}
        onTrigger={onRecenter}
      />
      <XrButton
        label={ctOverlayOn ? 'CT overlay: on' : 'CT overlay: off'}
        position={[0.12, -0.135, 0]}
        size={[0.2, 0.05]}
        active={ctOverlayOn}
        onTrigger={onToggleCtOverlay}
      />
    </>
  )
}
