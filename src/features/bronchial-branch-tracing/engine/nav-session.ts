import type { CtMark, CtTrace } from '../content/ct-types'
import {
  STANDARD_ORIENTATION,
  sameOrientation,
  turnCt,
  type CtOrientation,
  type OrientationOperation,
} from '../geometry/orientation'
import { optionVerdict, responseLumen, responsePlane, type MarkVerdict } from './junction-feedback'
import {
  isAccepted,
  operationsToMatch,
  stationMatch,
  type OrientationMatch,
} from './orientation-match'

/**
 * One trip of the scope along part of a route: the state behind the navigation bench.
 *
 * At each fork (a *station*) the learner works up to three steps, in this order:
 *   match     turn the CT until it faces the way the scope does;
 *   identify  click each opening's lumen on the CT;
 *   choose    pick the opening that leads toward the lesion.
 * Then the scope drives on to the next fork, or to the end of the route beside the lesion.
 *
 * A plan says which forks a trip visits and which steps each one asks for. A step a plan leaves
 * out is done by the bench: the CT is turned for the learner, the openings are named, the scope
 * takes the route's own branch. Every step can also be shown on request, so nothing here blocks.
 *
 * Pure: the reducer reads only the route geometry and returns the same object when nothing changed.
 */
export type NavStep = 'match' | 'identify' | 'choose'
export type NavPhase = NavStep | 'ready' | 'drive' | 'arrived' | 'done'

export interface NavStation {
  /** Index into `trace.checkpoints`; always a checkpoint with a division. */
  checkpointIndex: number
  steps: readonly NavStep[]
  /** The bench demonstrates this fork: "Show me" is the main action for each step. */
  worked?: boolean
}
export interface NavPlan {
  traceId: string
  /** Consecutive forks of the route, proximal first. */
  stations: readonly NavStation[]
  /** After the last fork, drive on to the end of the route beside the lesion. */
  arrive: boolean
}

export interface IdentifiedMark {
  mark: CtMark
  verdict: MarkVerdict | null
  /** True once the mark is in the opening's own lumen. */
  ok: boolean
  /** Placed by the bench on request. */
  shown: boolean
}
/** What happened at one fork, for the closing summary. Counts of tries that did not land. */
export interface StationLog {
  matchAsked: boolean
  matchMisses: number
  matchShown: boolean
  identifyAsked: boolean
  identifyMisses: number
  identifyShown: boolean
  chooseAsked: boolean
  chooseMisses: number
  chooseShown: boolean
}
/** How the CT came to face the scope here: asked of the learner, already so, or turned by the bench. */
export type MatchNote = 'asked' | 'kept' | 'set'

export interface NavSession {
  version: 1
  traceId: string
  /** Index into `plan.stations`. */
  station: number
  phase: NavPhase
  orientation: CtOrientation
  matchNote: MatchNote
  /** The display last checked that did not match; cleared by the next turn. */
  matchChecked: CtOrientation | null
  /** The opening being identified. */
  identifyOption: number
  /** By opening, in the division's own order. */
  marks: (IdentifiedMark | null)[]
  /** Openings chosen at this fork that lead away from the lesion. */
  declined: number[]
  choice: number | null
  log: StationLog[]
}

export type NavAction =
  | { type: 'turn'; operation: OrientationOperation }
  | { type: 'check-match' }
  | { type: 'show-match' }
  | { type: 'mark'; mark: CtMark }
  | { type: 'show-mark' }
  | { type: 'choose'; option: number }
  | { type: 'show-choice' }
  | { type: 'drive' }
  | { type: 'arrive' }
  | { type: 'restart' }

const emptyLog = (): StationLog => ({
  matchAsked: false,
  matchMisses: 0,
  matchShown: false,
  identifyAsked: false,
  identifyMisses: 0,
  identifyShown: false,
  chooseAsked: false,
  chooseMisses: 0,
  chooseShown: false,
})

export const stationCheckpoint = (trace: CtTrace, plan: NavPlan, station: number) =>
  trace.checkpoints[plan.stations[station].checkpointIndex]

/** The opening the route itself takes at a fork. */
export function routeOption(trace: CtTrace, checkpointIndex: number): number {
  const checkpoint = trace.checkpoints[checkpointIndex]
  const index =
    checkpoint.decision?.options.findIndex((o) => o.sourceEdgeId === checkpoint.sourceEdgeId) ?? -1
  return index < 0 ? 0 : index
}

/**
 * A fork where turning the CT can be asked for: the scope shows at least one of the CT's two axes
 * plainly, so one display matches, or two that differ only along the scope's line of sight. An
 * oblique look, which lays both CT axes along one edge of the scope's view, has no display that
 * puts every letter where the scope has it, so the bench sets the closest one there.
 */
export const matchable = (match: OrientationMatch | null) =>
  Boolean(match && match.accepted.length <= 2 && !match.oblique)

/** The display the bench turns the CT to when it does the matching itself. */
export function benchOrientation(match: OrientationMatch, current: CtOrientation): CtOrientation {
  if (isAccepted(match, current)) return current
  if (match.bookAccepted) return match.book
  // The match that takes the fewest operations from where the CT already is.
  return [...match.accepted].sort(
    (a, b) =>
      operationsToMatch({ ...match, accepted: [a] }, current).length -
      operationsToMatch({ ...match, accepted: [b] }, current).length,
  )[0]
}

function withLog(log: StationLog[], station: number, change: Partial<StationLog>): StationLog[] {
  const next = log.slice()
  while (next.length <= station) next.push(emptyLog())
  next[station] = { ...next[station], ...change }
  return next
}

/** Where a fork's remaining steps begin, once the CT faces the scope. */
function afterMatch(plan: NavPlan, station: number): NavPhase {
  const steps = plan.stations[station].steps
  if (steps.includes('identify')) return 'identify'
  if (steps.includes('choose')) return 'choose'
  return hasOnward(plan, station) ? 'ready' : 'done'
}
const hasOnward = (plan: NavPlan, station: number) =>
  station < plan.stations.length - 1 || plan.arrive

function enterStation(
  trace: CtTrace,
  plan: NavPlan,
  station: number,
  orientation: CtOrientation,
  log: StationLog[],
): NavSession {
  const planned = plan.stations[station]
  const checkpoint = trace.checkpoints[planned.checkpointIndex]
  const match = stationMatch(trace, planned.checkpointIndex)
  const options = checkpoint.decision?.options.length ?? 0
  const base = {
    version: 1 as const,
    traceId: trace.id,
    station,
    matchChecked: null,
    identifyOption: 0,
    marks: Array.from({ length: options }, () => null),
    declined: [],
    choice: null,
  }
  const asks = planned.steps
  const startLog = withLog(log, station, {
    identifyAsked: asks.includes('identify'),
    chooseAsked: asks.includes('choose'),
  })
  if (match && asks.includes('match') && matchable(match) && !isAccepted(match, orientation))
    return {
      ...base,
      phase: 'match',
      orientation,
      matchNote: 'asked',
      log: withLog(startLog, station, { matchAsked: true }),
    }
  const kept = !match || isAccepted(match, orientation)
  return {
    ...base,
    phase: afterMatch(plan, station),
    orientation: match ? benchOrientation(match, orientation) : orientation,
    matchNote: kept ? 'kept' : 'set',
    log: startLog,
  }
}

export function startSession(trace: CtTrace, plan: NavPlan): NavSession {
  return enterStation(trace, plan, 0, { ...STANDARD_ORIENTATION }, [])
}

/** After the last opening is identified. */
function afterIdentify(plan: NavPlan, station: number): NavPhase {
  if (plan.stations[station].steps.includes('choose')) return 'choose'
  return hasOnward(plan, station) ? 'ready' : 'done'
}

export function navReducer(trace: CtTrace, plan: NavPlan) {
  return function reduce(state: NavSession, action: NavAction): NavSession {
    const planned = plan.stations[state.station]
    const checkpointIndex = planned.checkpointIndex
    const decision = trace.checkpoints[checkpointIndex].decision
    if (action.type === 'restart') return startSession(trace, plan)
    if (!decision) return state
    const log = (change: Partial<StationLog>) => withLog(state.log, state.station, change)
    const here = state.log[state.station] ?? emptyLog()

    switch (action.type) {
      case 'turn': {
        // The CT can be turned at any time except while the scope is moving.
        if (state.phase === 'drive') return state
        const orientation = turnCt(state.orientation, action.operation)
        if (sameOrientation(orientation, state.orientation) && !state.matchChecked) return state
        return { ...state, orientation, matchChecked: null }
      }
      case 'check-match': {
        if (state.phase !== 'match') return state
        const match = stationMatch(trace, checkpointIndex)
        if (!match) return state
        if (isAccepted(match, state.orientation))
          return { ...state, phase: afterMatch(plan, state.station), matchChecked: null }
        if (state.matchChecked && sameOrientation(state.matchChecked, state.orientation))
          return state
        return {
          ...state,
          matchChecked: state.orientation,
          log: log({ matchMisses: here.matchMisses + 1 }),
        }
      }
      case 'show-match': {
        if (state.phase !== 'match') return state
        const match = stationMatch(trace, checkpointIndex)
        if (!match) return state
        return {
          ...state,
          phase: afterMatch(plan, state.station),
          orientation: benchOrientation(match, state.orientation),
          matchChecked: null,
          log: log({ matchShown: true }),
        }
      }
      case 'mark': {
        if (state.phase !== 'identify') return state
        const option = state.identifyOption
        const plane = responsePlane(trace, checkpointIndex, option)
        // A mark counts only on the plane this opening is identified on.
        if (!plane || !action.mark.pixel || action.mark.slice !== plane.slice) return state
        const result = optionVerdict(trace, checkpointIndex, option, action.mark)
        const ok = result?.verdict === 'intended-lumen'
        const marks = state.marks.slice()
        marks[option] = { mark: action.mark, verdict: result?.verdict ?? null, ok, shown: false }
        if (!ok) return { ...state, marks, log: log({ identifyMisses: here.identifyMisses + 1 }) }
        const next = option + 1
        return next < decision.options.length
          ? { ...state, marks, identifyOption: next }
          : { ...state, marks, phase: afterIdentify(plan, state.station) }
      }
      case 'show-mark': {
        if (state.phase !== 'identify') return state
        const option = state.identifyOption
        const lumen = responseLumen(trace, checkpointIndex, option)
        if (!lumen) return state
        const mark: CtMark = { slice: lumen.slice, pixel: lumen.pixel }
        const marks = state.marks.slice()
        // The bench's own mark stands as the opening's lumen; its verdict is still read off the CT.
        marks[option] = {
          mark,
          verdict: optionVerdict(trace, checkpointIndex, option, mark)?.verdict ?? null,
          ok: true,
          shown: true,
        }
        const next = option + 1
        const shown = log({ identifyShown: true })
        return next < decision.options.length
          ? { ...state, marks, identifyOption: next, log: shown }
          : { ...state, marks, phase: afterIdentify(plan, state.station), log: shown }
      }
      case 'choose': {
        if (state.phase !== 'choose') return state
        if (action.option < 0 || action.option >= decision.options.length) return state
        if (action.option === routeOption(trace, checkpointIndex))
          return {
            ...state,
            choice: action.option,
            phase: hasOnward(plan, state.station) ? 'ready' : 'done',
          }
        if (state.declined.includes(action.option)) return state
        return {
          ...state,
          declined: [...state.declined, action.option],
          log: log({ chooseMisses: here.chooseMisses + 1 }),
        }
      }
      case 'show-choice': {
        if (state.phase !== 'choose') return state
        return {
          ...state,
          choice: routeOption(trace, checkpointIndex),
          phase: hasOnward(plan, state.station) ? 'ready' : 'done',
          log: log({ chooseShown: true }),
        }
      }
      case 'drive':
        return state.phase === 'ready' ? { ...state, phase: 'drive' } : state
      case 'arrive': {
        if (state.phase !== 'drive') return state
        if (state.station < plan.stations.length - 1)
          return enterStation(trace, plan, state.station + 1, state.orientation, state.log)
        return { ...state, phase: 'arrived' }
      }
    }
  }
}

/** The opening the scope takes when it drives on from the current fork. */
export function onwardOption(trace: CtTrace, plan: NavPlan, state: NavSession): number {
  return state.choice ?? routeOption(trace, plan.stations[state.station].checkpointIndex)
}

export interface NavSummary {
  forks: number
  match: { asked: number; firstTry: number }
  identify: { asked: number; firstTry: number }
  choose: { asked: number; firstTry: number }
  /** The fork that took the most tries, when any took more than one. */
  slowest: { station: number; tries: number } | null
}
/** Counts for the closing screen: what was asked, and how much of it landed on the first try. */
export function summarize(session: NavSession): NavSummary {
  const tally = (asked: (l: StationLog) => boolean, clean: (l: StationLog) => boolean) => ({
    asked: session.log.filter(asked).length,
    firstTry: session.log.filter((l) => asked(l) && clean(l)).length,
  })
  let slowest: NavSummary['slowest'] = null
  session.log.forEach((entry, station) => {
    const tries = 1 + entry.matchMisses + entry.identifyMisses + entry.chooseMisses
    if (tries > 1 && (!slowest || tries > slowest.tries)) slowest = { station, tries }
  })
  return {
    forks: session.log.length,
    match: tally(
      (l) => l.matchAsked,
      (l) => !l.matchMisses && !l.matchShown,
    ),
    identify: tally(
      (l) => l.identifyAsked,
      (l) => !l.identifyMisses && !l.identifyShown,
    ),
    choose: tally(
      (l) => l.chooseAsked,
      (l) => !l.chooseMisses && !l.chooseShown,
    ),
    slowest,
  }
}
