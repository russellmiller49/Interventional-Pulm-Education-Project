import { depthMmToAxis } from './decode'
import { GamepadScopeSource } from './gamepad-source'
import type {
  GamepadLike,
  ScopeButtonName,
  ScopeInputFrame,
  ScopeInputSource,
  ScopeStatusFlags,
  ScopeTrackerProfile,
} from './types'

export const VIRTUAL_SCOPE_TRACKER_ID = 'Virtual ScopeTracker (emulator)'

export interface VirtualScopeState {
  flexion: number
  depthMm: number
  /** Continuous roll in radians; encoded to sin/cos so wrapping is exercised for real. */
  rollRad: number
  buttons: Record<ScopeButtonName, boolean>
  status: ScopeStatusFlags
}

/**
 * Emulated scope tracker for development/testing without hardware. It synthesizes a
 * GamepadLike and runs it through the real decode/shaping pipeline, so everything
 * downstream behaves exactly as with a physical device.
 */
export class VirtualScopeSource implements ScopeInputSource {
  private readonly inner: GamepadScopeSource
  private readonly pulses = new Set<ScopeButtonName>()
  private state: VirtualScopeState = {
    flexion: 0,
    depthMm: 0,
    rollRad: 0,
    buttons: { a: false, b: false, c: false, d: false, calibrate: false },
    status: { photogate: true, lowQuality: false, fault: false },
  }

  constructor(options: { profile?: ScopeTrackerProfile } = {}) {
    this.inner = new GamepadScopeSource({
      profile: options.profile,
      getGamepads: () => [this.toGamepadLike()],
    })
  }

  get connected(): boolean {
    return this.inner.connected
  }

  get deviceId(): string | null {
    return this.inner.deviceId
  }

  setProfile(profile: ScopeTrackerProfile): void {
    this.inner.setProfile(profile)
  }

  reset(): void {
    this.inner.reset()
    this.pulses.clear()
  }

  set(partial: Partial<Pick<VirtualScopeState, 'flexion' | 'depthMm' | 'rollRad'>>): void {
    this.state = { ...this.state, ...partial }
  }

  setButton(name: ScopeButtonName, down: boolean): void {
    this.state = { ...this.state, buttons: { ...this.state.buttons, [name]: down } }
  }

  /** Hold the button down for exactly the next sample() (one pressed edge). */
  pulseButton(name: ScopeButtonName): void {
    this.pulses.add(name)
  }

  setStatus(partial: Partial<ScopeStatusFlags>): void {
    this.state = { ...this.state, status: { ...this.state.status, ...partial } }
  }

  getState(): VirtualScopeState {
    return {
      ...this.state,
      buttons: { ...this.state.buttons },
      status: { ...this.state.status },
    }
  }

  sample(timestampMs?: number): ScopeInputFrame | null {
    const frame = this.inner.sample(timestampMs)
    this.pulses.clear()
    return frame
  }

  private toGamepadLike(): GamepadLike {
    const { buttons, status } = this.state
    const down = (name: ScopeButtonName) => buttons[name] || this.pulses.has(name)
    return {
      id: VIRTUAL_SCOPE_TRACKER_ID,
      index: 0,
      connected: true,
      axes: [
        this.state.flexion,
        depthMmToAxis(this.state.depthMm),
        Math.sin(this.state.rollRad),
        Math.cos(this.state.rollRad),
      ],
      buttons: [
        { pressed: down('a') },
        { pressed: down('b') },
        { pressed: down('c') },
        { pressed: down('d') },
        { pressed: down('calibrate') },
        { pressed: status.photogate },
        { pressed: status.lowQuality },
        { pressed: status.fault },
      ],
    }
  }
}
