import { PLEURAL_ZONE_IDS, type PleuralZoneId } from '../content/pleuralZones'
import { ledgerWords } from '../components/space/spaceWords'
import {
  emptyLedger,
  type CrossSection,
  type PlanePoint,
  type SpaceCommand,
  type SpaceInputMode,
  type SpacePaneProps,
  type SpacePaneState,
  type SpaceReadiness,
  type ZoneLedgerEntry,
} from '../components/space/types'

/**
 * A stand-in for the space engine, for the pane's tests and, later, the lesson host's: commands in,
 * plain state out, no geometry and no WebGL. It keeps every promise the contract makes: the ledger
 * holds every zone once in the survey order, in the three states; a refused movement names the part
 * that stopped it; nothing moves while the anatomy is not ready, and trying again never marks a
 * region seen; under reduced motion the clock waits for Step. Its rules for what comes into view are
 * toys of its own and say nothing about the engine's.
 */

export const DOUBLE_SNAPSHOT = {
  anatomy: 'double-anatomy',
  device: 'double-device',
  optics: 'double-optics',
  port: 'double-port',
  scenario: 'double-scenario',
  lungAndFluid: 'double-lung',
  geometry: 'double-geometry',
  rules: 'double-rules',
} as const

const TILT_STEP_DEG = 5
const TILT_LIMIT_DEG = 30
const DEPTH_STEP_MM = 5
const DEPTH_RANGE_MM = [10, 120] as const
const ROLL_STEP_DEG = 15

export interface SpaceDouble {
  readonly state: SpacePaneState
  readonly history: readonly { readonly command: SpaceCommand; readonly input: SpaceInputMode }[]
  apply(command: SpaceCommand, input?: SpaceInputMode): SpacePaneState
  finishLoading(): SpacePaneState
  loseGeometry(canRetry: boolean): SpacePaneState
  holdClock(): SpacePaneState
}

/** The toy cut: a round wall with the zones in order around it, a lung, the port on the lateral wall. */
export function doubleCrossSection(tiltAcrossRibsDeg: number, depthMm: number): CrossSection {
  const arc = (from: number, to: number): PlanePoint[] =>
    Array.from({ length: 7 }, (_, index) => {
      const angle = ((from + ((to - from) * index) / 6) * Math.PI) / 180
      return [
        Math.round(80 * Math.cos(angle) * 100) / 100,
        Math.round(80 * Math.sin(angle) * 100) / 100,
      ]
    })
  const span = 360 / PLEURAL_ZONE_IDS.length
  const wall = PLEURAL_ZONE_IDS.map((zone, index) => ({
    zone,
    points: arc(index * span, (index + 1) * span),
  }))
  const direction = ((180 + tiltAcrossRibsDeg) * Math.PI) / 180
  const port: PlanePoint = [80, 0]
  const tip: PlanePoint = [80 + depthMm * Math.cos(direction), depthMm * Math.sin(direction)]
  const edge = (offsetDeg: number): PlanePoint => {
    const angle = direction + (offsetDeg * Math.PI) / 180
    return [tip[0] + 60 * Math.cos(angle), tip[1] + 60 * Math.sin(angle)]
  }
  return {
    wall,
    lung: [arc(0, 360).map(([x, y]) => [x * 0.35 - 20, y * 0.35] as PlanePoint)],
    port,
    tip,
    field: [edge(-30), edge(30)],
    seenFrom: 'Seen from the patient’s front.',
  }
}

/**
 * The toy rule for what is in view: which way the tip points, a positive tilt being toward the feet
 * across the ribs and toward the back along them. The lateral wall never comes into view.
 */
function zonesInView(tiltAcross: number, tiltAlong: number): PleuralZoneId[] {
  if (tiltAcross <= -15) return ['apex']
  if (tiltAcross >= 15) return ['diaphragm', 'costophrenic-recess']
  if (tiltAlong <= -15) return ['anterior-chest-wall']
  if (tiltAlong >= 15) return ['posterior-chest-wall']
  return ['mediastinum']
}

export function createSpaceDouble({
  readiness = { kind: 'ready' },
}: { readonly readiness?: SpaceReadiness } = {}): SpaceDouble {
  const history: { command: SpaceCommand; input: SpaceInputMode }[] = []
  const views = new Map<PleuralZoneId, number>()
  let state: SpacePaneState = {
    snapshot: DOUBLE_SNAPSHOT,
    readiness,
    pose: { tiltAcrossRibsDeg: 0, tiltAlongRibsDeg: 0, depthMm: 40, rollDeg: 0 },
    inView: [],
    ledger: emptyLedger(),
    refusal: null,
    crossSection: readiness.kind === 'ready' ? doubleCrossSection(0, 40) : null,
    clock: { held: false },
  }

  const look = (next: SpacePaneState): SpacePaneState => {
    const inView = zonesInView(next.pose.tiltAcrossRibsDeg, next.pose.tiltAlongRibsDeg)
    for (const zone of inView) views.set(zone, (views.get(zone) ?? 0) + 1)
    const ledger = PLEURAL_ZONE_IDS.map((zone): ZoneLedgerEntry => {
      if (zone === 'lateral-chest-wall') {
        return views.size > 0
          ? { zone, seen: 'partly-seen', reason: 'out-of-reach' }
          : { zone, seen: 'not-seen', reason: 'not-looked-at' }
      }
      const count = views.get(zone) ?? 0
      if (count === 0) return { zone, seen: 'not-seen', reason: 'not-looked-at' }
      if (count === 1) return { zone, seen: 'partly-seen', reason: 'hidden' }
      return { zone, seen: 'seen', reason: null }
    })
    return {
      ...next,
      inView,
      ledger,
      crossSection: doubleCrossSection(next.pose.tiltAcrossRibsDeg, next.pose.depthMm),
    }
  }

  const apply = (command: SpaceCommand, input: SpaceInputMode = 'scripted'): SpacePaneState => {
    history.push({ command, input })
    if (command.kind === 'retry-geometry') {
      if (state.readiness.kind === 'unavailable' && state.readiness.canRetry) {
        state = {
          ...state,
          readiness: { kind: 'loading', what: 'Loading the anatomy again.' },
          refusal: null,
        }
      }
      return state
    }
    if (command.kind === 'step-clock') {
      state = { ...state, clock: { held: false } }
      return state
    }
    if (state.readiness.kind !== 'ready') return state
    const pose = { ...state.pose }
    let refusal: SpacePaneState['refusal'] = null
    if (command.kind === 'pivot') {
      // The tip swings the other way to the hand: positive tilts point the tip to the feet and back.
      const across =
        command.hand === 'head' ? TILT_STEP_DEG : command.hand === 'feet' ? -TILT_STEP_DEG : 0
      const along =
        command.hand === 'front' ? TILT_STEP_DEG : command.hand === 'back' ? -TILT_STEP_DEG : 0
      const nextAcross = pose.tiltAcrossRibsDeg + across
      const nextAlong = pose.tiltAlongRibsDeg + along
      if (Math.abs(nextAcross) > TILT_LIMIT_DEG || Math.abs(nextAlong) > TILT_LIMIT_DEG) {
        refusal = {
          part: 'The sleeve',
          words: 'It rests against the ribs and tilts no further this way.',
        }
      } else {
        pose.tiltAcrossRibsDeg = nextAcross
        pose.tiltAlongRibsDeg = nextAlong
      }
    } else if (command.kind === 'depth') {
      const next = pose.depthMm + (command.direction === 'in' ? DEPTH_STEP_MM : -DEPTH_STEP_MM)
      if (next > DEPTH_RANGE_MM[1]) {
        refusal = {
          part: 'The telescope',
          words: 'The lung is in the way, so it goes no deeper here.',
        }
      } else if (next < DEPTH_RANGE_MM[0]) {
        refusal = {
          part: 'The telescope',
          words: 'It is back at the port and comes no further out.',
        }
      } else {
        pose.depthMm = next
      }
    } else {
      pose.rollDeg =
        (pose.rollDeg +
          (command.direction === 'clockwise' ? ROLL_STEP_DEG : -ROLL_STEP_DEG) +
          360) %
        360
    }
    state = refusal ? { ...state, refusal } : look({ ...state, pose, refusal: null })
    return state
  }

  return {
    get state() {
      return state
    },
    history,
    apply,
    finishLoading() {
      state = {
        ...state,
        readiness: { kind: 'ready' },
        crossSection: doubleCrossSection(state.pose.tiltAcrossRibsDeg, state.pose.depthMm),
      }
      return state
    },
    loseGeometry(canRetry: boolean) {
      state = {
        ...state,
        readiness: { kind: 'unavailable', why: 'The anatomy could not be loaded.', canRetry },
        crossSection: null,
      }
      return state
    },
    holdClock() {
      state = { ...state, clock: { held: true } }
      return state
    },
  }
}

/**
 * The pane as plain DOM, for lesson tests that need the contract without drawing anything: the state
 * as text and data attributes, and one button per command.
 */
export function SpacePaneDouble({ state, operable, onCommand }: SpacePaneProps) {
  const usable = state.readiness.kind === 'ready' && operable.includes('scope')
  const commands: readonly [string, SpaceCommand][] = [
    ['hand toward the head', { kind: 'pivot', hand: 'head' }],
    ['hand toward the feet', { kind: 'pivot', hand: 'feet' }],
    ['hand toward the front', { kind: 'pivot', hand: 'front' }],
    ['hand toward the back', { kind: 'pivot', hand: 'back' }],
    ['in', { kind: 'depth', direction: 'in' }],
    ['out', { kind: 'depth', direction: 'out' }],
    ['turn clockwise', { kind: 'roll', direction: 'clockwise' }],
    ['turn anticlockwise', { kind: 'roll', direction: 'anticlockwise' }],
  ]
  return (
    <div
      data-testid="space-pane-double"
      data-readiness={state.readiness.kind}
      data-in-view={state.inView.join(' ')}
    >
      <ul aria-label="Ledger">
        {state.ledger.map((entry) => (
          <li key={entry.zone} data-zone={entry.zone}>
            {ledgerWords(entry)}
          </li>
        ))}
      </ul>
      {commands.map(([label, command]) => (
        <button
          key={label}
          type="button"
          disabled={!usable}
          onClick={() => onCommand(command, 'scripted')}
        >
          {label}
        </button>
      ))}
      <button type="button" onClick={() => onCommand({ kind: 'step-clock' }, 'scripted')}>
        step
      </button>
      <button type="button" onClick={() => onCommand({ kind: 'retry-geometry' }, 'scripted')}>
        retry
      </button>
    </div>
  )
}
