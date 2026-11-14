import type { CtNoduleTarget, CtTrace } from '../content/ct-types'
import { targetById, traceForTarget } from '../content/targets'
import { cameraBasis } from '../geometry/reference-frames'
import { rollPose, stationCamera, type StationCamera } from '../geometry/route-stations'
import { angleGap, mapTurnToScope, mappedForks, ostiumFrame, type OstiumFrame } from './arc-map'
import { routeOption } from './nav-session'

/**
 * "The scope has rolled": a drill on the one thing the map cannot do for the learner.
 *
 * The map is drawn as the scope shows the segmental ostium. Past it the scope is rolled, by the
 * operator and by the airway, and the picture turns with it while the airway does not. The drill
 * drives a route the learner has already mapped; at each division past the ostium the scope
 * arrives rolled, with no directions on its rim. The learner turns the map until it sits as the
 * picture does, then takes the opening the map marks.
 *
 * A carina alone fixes the map only to a half turn: two openings on a line look the same either
 * way up. What settles it is how the picture turned on the drive in, which is why the drill shows
 * that drive with the roll applied, and lets it be watched again.
 *
 * Pure: the reducer reads only the route geometry.
 */
export const ROLL_DRILL_ID = 'the-scope-has-rolled'

export interface RollFork {
  targetId: string
  /** Which division of that lesion's map, 0 first. Never 0: the map is drawn at the ostium. */
  division: number
  /** How far the picture has turned on arrival, clockwise, on top of the scope's usual roll. */
  rollDeg: number
}
/**
 * Two routes from the lessons, so the maps are ones the learner has drawn. The rolls are fixed:
 * a quarter turn, a half turn, and turns between, each way round.
 */
export const ROLL_DRILL_FORKS: readonly RollFork[] = [
  { targetId: 'r-apical-anterior', division: 1, rollDeg: 90 },
  { targetId: 'r-apical-anterior', division: 2, rollDeg: 180 },
  { targetId: 'r-middle-medial-a', division: 1, rollDeg: -90 },
  { targetId: 'r-middle-medial-a', division: 2, rollDeg: 135 },
  { targetId: 'r-middle-medial-a', division: 3, rollDeg: -45 },
]

/** One press of a turn button, and how close the map has to sit to the picture. */
export const MAP_TURN_STEP = 45
export const MAP_TURN_TOLERANCE = 45

export interface RollForkGeometry {
  fork: RollFork
  trace: CtTrace
  target: CtNoduleTarget
  /** The checkpoint of this division, and of the division the scope drives in from. */
  checkpointIndex: number
  fromCheckpointIndex: number
  frame: OstiumFrame
  /** The scope at rest at this division, rolled. */
  camera: StationCamera
  /** The roll in force at the division the scope drives in from. */
  fromRollDeg: number
  /** How far the map must be turned, clockwise, to sit as the picture does. */
  mapTurn: number
  /** False where the map's directions lie along the line of sight and no turn is well defined. */
  reliable: boolean
  /** The opening the route takes. */
  routeOption: number
}

const normalise = (degrees: number) => ((degrees % 360) + 360) % 360

export function rollForkGeometry(index: number): RollForkGeometry {
  const fork = ROLL_DRILL_FORKS[index]
  if (!fork) throw new Error(`The roll drill has no fork ${index}`)
  const target = targetById(fork.targetId)
  if (!target) throw new Error(`The roll drill names an unknown lesion: ${fork.targetId}`)
  const trace = traceForTarget(fork.targetId)
  const forks = mappedForks(trace, target)
  const checkpointIndex = forks[fork.division]
  const fromCheckpointIndex = forks[fork.division - 1]
  const frame = ostiumFrame(trace, forks[0])
  const rest = stationCamera(trace, checkpointIndex)
  if (fork.division < 1 || checkpointIndex === undefined || !frame || !rest)
    throw new Error(`The roll drill's fork ${index} is not a division past the ostium`)
  const camera = rollPose(rest, fork.rollDeg)
  const turn = mapTurnToScope(frame, 0, cameraBasis(camera.direction, camera.up))
  const before = ROLL_DRILL_FORKS[index - 1]
  return {
    fork,
    trace,
    target,
    checkpointIndex,
    fromCheckpointIndex,
    frame,
    camera,
    // The first fork of a route is driven to from the ostium, where the scope is not rolled.
    fromRollDeg:
      before && before.targetId === fork.targetId && before.division === fork.division - 1
        ? before.rollDeg
        : 0,
    mapTurn: turn.angle,
    reliable: turn.reliable,
    routeOption: routeOption(trace, checkpointIndex),
  }
}

export type TurnVerdict = 'fits' | 'half' | 'quarter' | 'off'
/**
 * How the learner's turn of the map sits against the picture. A half turn out and a quarter turn
 * out are named, because they are the two that happen: the first when the carina is lined up but
 * not which opening is which, the second when the wrong pair of directions was matched.
 */
export function gradeMapTurn(turn: number, truth: number): { gap: number; verdict: TurnVerdict } {
  const gap = angleGap(turn, truth)
  const verdict: TurnVerdict =
    gap <= MAP_TURN_TOLERANCE
      ? 'fits'
      : gap >= 180 - MAP_TURN_TOLERANCE
        ? 'half'
        : Math.abs(gap - 90) <= 22.5
          ? 'quarter'
          : 'off'
  return { gap, verdict }
}
/** The turn the bench shows: the nearest step to the picture's own. */
export const shownTurn = (truth: number) =>
  normalise(Math.round(truth / MAP_TURN_STEP) * MAP_TURN_STEP)

/**
 * `start`: the scope waits at the route's segmental ostium, not rolled, where the map and the
 * picture agree. Then for each division: the drive in, the turn of the map, the choice.
 */
export type RollPhase = 'start' | 'drive' | 'turn' | 'choose' | 'ready' | 'done'
export interface RollForkLog {
  turnMisses: number
  turnShown: boolean
  chooseMisses: number
  chooseShown: boolean
  /** Times the drive in was watched again. */
  replays: number
}
export interface RollSession {
  version: 1
  /** Index into `ROLL_DRILL_FORKS`. */
  fork: number
  phase: RollPhase
  /** The map as the learner has turned it, degrees clockwise, 0 to 359. */
  mapTurn: number
  /** The last check of the turn that did not fit; cleared by the next turn. */
  checked: Exclude<TurnVerdict, 'fits'> | null
  /** Openings chosen at this fork that lead away. */
  declined: number[]
  log: RollForkLog[]
}
export type RollAction =
  /** The scope reaches the division it was driving to. */
  | { type: 'arrive' }
  | { type: 'turn'; degrees: number }
  | { type: 'check' }
  | { type: 'show-turn' }
  /** Watch the drive in to this division again. */
  | { type: 'replay' }
  | { type: 'choose'; option: number }
  | { type: 'show-choice' }
  | { type: 'drive' }
  | { type: 'restart' }

const emptyLog = (): RollForkLog => ({
  turnMisses: 0,
  turnShown: false,
  chooseMisses: 0,
  chooseShown: false,
  replays: 0,
})

export function startRollDrill(): RollSession {
  return {
    version: 1,
    fork: 0,
    phase: 'start',
    mapTurn: 0,
    checked: null,
    declined: [],
    log: [emptyLog()],
  }
}

export function rollReducer(state: RollSession, action: RollAction): RollSession {
  if (action.type === 'restart') return startRollDrill()
  const geometry = rollForkGeometry(state.fork)
  const log = (change: Partial<RollForkLog>) =>
    state.log.map((entry, i) => (i === state.fork ? { ...entry, ...change } : entry))
  const here = state.log[state.fork] ?? emptyLog()
  switch (action.type) {
    case 'arrive':
      return state.phase === 'drive' ? { ...state, phase: 'turn' } : state
    case 'turn':
      return state.phase === 'turn' && action.degrees % 360 !== 0
        ? { ...state, mapTurn: normalise(state.mapTurn + action.degrees), checked: null }
        : state
    case 'check': {
      if (state.phase !== 'turn') return state
      const { verdict } = gradeMapTurn(state.mapTurn, geometry.mapTurn)
      if (verdict === 'fits') return { ...state, phase: 'choose', checked: null }
      // The same turn checked twice is one miss, not two.
      if (state.checked === verdict) return state
      return { ...state, checked: verdict, log: log({ turnMisses: here.turnMisses + 1 }) }
    }
    case 'show-turn':
      return state.phase === 'turn'
        ? {
            ...state,
            phase: 'choose',
            mapTurn: shownTurn(geometry.mapTurn),
            checked: null,
            log: log({ turnShown: true }),
          }
        : state
    case 'replay':
      return state.phase === 'turn'
        ? { ...state, phase: 'drive', log: log({ replays: here.replays + 1 }) }
        : state
    case 'choose': {
      if (state.phase !== 'choose') return state
      if (action.option === geometry.routeOption) return { ...state, phase: 'ready' }
      const options = geometry.trace.checkpoints[geometry.checkpointIndex].decision!.options.length
      if (action.option < 0 || action.option >= options || state.declined.includes(action.option))
        return state
      return {
        ...state,
        declined: [...state.declined, action.option],
        log: log({ chooseMisses: here.chooseMisses + 1 }),
      }
    }
    case 'show-choice':
      return state.phase === 'choose'
        ? { ...state, phase: 'ready', log: log({ chooseShown: true }) }
        : state
    case 'drive': {
      if (state.phase === 'start') return { ...state, phase: 'drive' }
      if (state.phase !== 'ready') return state
      const next = state.fork + 1
      if (next >= ROLL_DRILL_FORKS.length) return { ...state, phase: 'done' }
      // A new route starts with the map as it was drawn; on the same route the map stays as held.
      const sameRoute = ROLL_DRILL_FORKS[next].targetId === geometry.fork.targetId
      return {
        ...state,
        fork: next,
        phase: sameRoute ? 'drive' : 'start',
        mapTurn: sameRoute ? state.mapTurn : 0,
        checked: null,
        declined: [],
        log: [...state.log, emptyLog()],
      }
    }
  }
}

export interface RollSummary {
  forks: number
  turn: { asked: number; firstTry: number }
  choose: { asked: number; firstTry: number }
}
/** What landed at its first check, over the divisions the learner has finished. */
export function summarizeRoll(session: RollSession): RollSummary {
  const finished = session.log.filter(
    (_, i) => i < session.fork || session.phase === 'ready' || session.phase === 'done',
  )
  return {
    forks: ROLL_DRILL_FORKS.length,
    turn: {
      asked: finished.length,
      firstTry: finished.filter((l) => !l.turnMisses && !l.turnShown).length,
    },
    choose: {
      asked: finished.length,
      firstTry: finished.filter((l) => !l.chooseMisses && !l.chooseShown).length,
    },
  }
}
