'use client'

import { useCallback, useEffect, useMemo, useRef, type Dispatch, type ReactNode } from 'react'
import type { CtNoduleTarget, CtTrace } from '../content/ct-types'
import {
  RIMS,
  mappedForks,
  modelMapLevels,
  sectorAngle,
  turnedRim,
  withReferences,
  type Anatomical,
  type Rim,
} from '../engine/arc-map'
import type { NavAction, NavSession } from '../engine/nav-session'
import { recordOrientationProgress } from '../engine/nav-storage'
import { planFrame, type PlanAction, type PlanPart } from '../engine/plan-session'
import type { TripAction, TripPlan, TripSession } from '../engine/trip-session'
import { NavigationBench, type TripMap } from './NavigationBench'
import { PlanBench } from './PlanBench'

/**
 * One trip on screen: the planning bench while the learner plans and draws the map, then the
 * navigation bench, with the learner's map beside the scope. Lessons, Practice and the closing set
 * all come through here.
 */
export interface TripBenchProps {
  section: 'learn' | 'practice' | 'assess'
  title: string
  subtitle?: string
  trace: CtTrace
  target: CtNoduleTarget | null
  trip: TripPlan
  session: TripSession
  dispatch: Dispatch<TripAction>
  intro?: string
  /** Arrival text at each fork of the drive, by station index. */
  teach?: (string | undefined)[]
  planTeach?: Partial<Record<PlanPart, string>>
  divisionTeach?: (string | undefined)[]
  locators?: boolean
  independent?: boolean
  help: boolean
  closing: {
    heading: string
    body: string[]
    next?: { label: string; href?: string; onActivate?: () => void }
  }
  notes?: ReactNode
  exit: ReactNode
}

/**
 * Forks matched to the scope on the first check, without being shown, by station index. The fork
 * still waiting for its match is not one of them yet.
 */
const firstTryMatches = (nav: NavSession) =>
  nav.log.flatMap((entry, station) =>
    entry.matchAsked &&
    !entry.matchMisses &&
    !entry.matchShown &&
    (station < nav.station || nav.phase !== 'match')
      ? [station]
      : [],
  )

export function TripBench(props: TripBenchProps) {
  const { trace, target, trip, session, dispatch } = props
  const planDispatch = useCallback(
    (action: PlanAction) => dispatch({ type: 'plan', action }),
    [dispatch],
  )
  const navDispatch = useCallback(
    (action: NavAction) => dispatch({ type: 'nav', action }),
    [dispatch],
  )
  const restart = useCallback(() => dispatch({ type: 'restart' }), [dispatch])

  // Count the forks matched first time, once each, toward making the turn optional.
  const counted = useRef<Set<number> | null>(null)
  const nav = session.nav
  const matchedNow = nav ? firstTryMatches(nav) : []
  const matchedKey = matchedNow.join(',')
  useEffect(() => {
    if (!nav) return
    // What was already matched when the trip opened was counted when it happened.
    if (counted.current === null) {
      counted.current = new Set(matchedNow)
      return
    }
    const fresh = matchedNow.filter((station) => !counted.current!.has(station))
    if (!fresh.length) return
    fresh.forEach((station) => counted.current!.add(station))
    recordOrientationProgress({ firstTryMatches: fresh.length })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedKey])

  const map: TripMap | null = useMemo(() => {
    const plan = session.plan
    if (!plan || !target || !trip.plan?.parts.includes('arcs')) return null
    const frame = planFrame(trace, target)
    if (!frame) return null
    const turn = plan.frameTurn ?? 0
    const learnerFrame = trip.plan.parts.includes('frame') && plan.frameTurn !== null
    const model = turnedRim(frame.rim, turn)
    const rim = Object.fromEntries(
      RIMS.map((r) => [r, learnerFrame ? plan.frame[r] : model[r].word]),
    ) as Record<Rim, Anatomical | null>
    return {
      rim,
      levels: withReferences(
        plan.arcs.map((entry) => ({ angles: entry.placed.map(sectorAngle), route: entry.leadsOn })),
        modelMapLevels(trace, target, turn),
      ),
      forks: mappedForks(trace, target),
      frame,
      turn,
    }
  }, [session.plan, target, trip.plan, trace])

  if (session.plan && target && trip.plan && (session.stage === 'plan' || !trip.nav))
    return (
      <PlanBench
        section={props.section}
        title={props.title}
        subtitle={props.subtitle}
        trace={trace}
        target={target}
        spec={trip.plan}
        plan={session.plan}
        dispatch={planDispatch}
        intro={props.intro}
        teach={props.planTeach}
        divisionTeach={props.divisionTeach}
        locators={Boolean(props.locators)}
        help={props.help}
        drives={Boolean(trip.nav)}
        closing={props.closing}
        done={session.stage === 'done'}
        notes={props.notes}
        exit={props.exit}
        onRestart={restart}
      />
    )
  if (!session.nav || !trip.nav) throw new Error(`Trip on ${trace.id} has nothing to show`)
  return (
    <NavigationBench
      section={props.section}
      title={props.title}
      subtitle={props.subtitle}
      trace={trace}
      plan={trip.nav}
      teach={props.teach}
      intro={session.plan ? undefined : props.intro}
      independent={props.independent}
      help={props.help}
      session={session.nav}
      dispatch={navDispatch}
      closing={props.closing}
      notes={props.notes}
      exit={props.exit}
      map={map}
      onRestart={restart}
    />
  )
}

/** The trip is over: the scope has arrived or stopped, or a trip that only plans is done. */
export const tripOver = (session: TripSession) =>
  session.stage === 'done' ||
  (session.stage === 'navigate' &&
    (session.nav?.phase === 'arrived' || session.nav?.phase === 'done'))
