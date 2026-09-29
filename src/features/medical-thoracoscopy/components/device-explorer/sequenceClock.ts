import { ASSEMBLY_SECONDS } from '../../engine/deviceExplorer/assembly'

/**
 * The assembly sequence's playhead, kept outside React so the scene can advance it every frame
 * and only the controls that show it re-render. `jumps` counts moves the scene should blend into
 * rather than show at once (a step button, Assemble); a drag of the slider is not one.
 */
export interface SequenceSnapshot {
  readonly seconds: number
  readonly playing: boolean
  readonly jumps: number
}

export interface SequenceClock {
  readonly get: () => SequenceSnapshot
  readonly subscribe: (listener: () => void) => () => void
  /** Move the playhead directly, as a drag of the slider does. */
  readonly scrub: (seconds: number) => void
  /** Move the playhead and let the scene blend into the new moment. */
  readonly jump: (seconds: number) => void
  readonly play: () => void
  readonly pause: () => void
  /** Advance while playing; stops at the end. Called by the scene each frame. */
  readonly advance: (deltaSeconds: number) => void
}

export const PLAYBACK_RATE = 1

export function createSequenceClock(initialSeconds = 0): SequenceClock {
  let snapshot: SequenceSnapshot = { seconds: initialSeconds, playing: false, jumps: 0 }
  const listeners = new Set<() => void>()
  const clamp = (seconds: number) => Math.min(ASSEMBLY_SECONDS, Math.max(0, seconds))
  const set = (next: SequenceSnapshot) => {
    if (
      next.seconds === snapshot.seconds &&
      next.playing === snapshot.playing &&
      next.jumps === snapshot.jumps
    )
      return
    snapshot = next
    for (const listener of listeners) listener()
  }
  return {
    get: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    scrub: (seconds) => set({ ...snapshot, seconds: clamp(seconds) }),
    jump: (seconds) => set({ ...snapshot, seconds: clamp(seconds), jumps: snapshot.jumps + 1 }),
    play: () => {
      if (snapshot.seconds >= ASSEMBLY_SECONDS) {
        set({ seconds: 0, playing: true, jumps: snapshot.jumps + 1 })
      } else {
        set({ ...snapshot, playing: true })
      }
    },
    pause: () => set({ ...snapshot, playing: false }),
    advance: (deltaSeconds) => {
      if (!snapshot.playing) return
      const seconds = clamp(snapshot.seconds + deltaSeconds * PLAYBACK_RATE)
      set({ ...snapshot, seconds, playing: seconds < ASSEMBLY_SECONDS })
    },
  }
}
