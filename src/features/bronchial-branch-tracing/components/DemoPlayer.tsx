'use client'

import { ArrowLeft, ArrowRight, Pause, Play, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { Link } from '@/i18n/navigation'
import { TEACHING_SIMULATOR_STATEMENT } from '../content/bench-copy'
import { BASE_PATH, lessonHref } from '../content/module'
import { NAV_LESSONS, lessonLabel } from '../content/nav-lessons'
import { targetById, traceForTarget } from '../content/targets'
import { DEMO_TARGET_ID, demoSteps, demoTimeline, demoTrip } from '../engine/demo-script'
import { moving } from '../engine/nav-session'
import { tripReducer, type TripAction, type TripSession } from '../engine/trip-session'
import { TripBench } from './TripBench'
import styles from './nav-bench.module.css'

/** How long a step is held once it has come to rest, when the demonstration plays by itself. */
const holdMs = (caption: string) => Math.max(4500, caption.length * 55)

interface PlayerState {
  index: number
  session: TripSession
  playing: boolean
}
type PlayerAction =
  | { type: 'go'; index: number }
  | { type: 'play'; on: boolean }
  /** The bench's own: the scope reaching the fork it was driving to. */
  | { type: 'bench'; action: TripAction }

/**
 * The method played once on the real bench: the planning bench and then the scope, moved by the
 * same actions "Show me" sends, with a caption for each step in place of the task column. The
 * pictures cannot be worked and nothing is saved to the device: it is watched, then the learner
 * goes on to lesson 1 and does it.
 */
export function DemoPlayer() {
  const target = targetById(DEMO_TARGET_ID)!
  const trace = useMemo(() => traceForTarget(DEMO_TARGET_ID), [])
  const trip = useMemo(() => demoTrip(trace), [trace])
  const steps = useMemo(() => demoSteps(trace, target, trip), [trace, target, trip])
  const timeline = useMemo(
    () => demoTimeline(trace, target, trip, steps),
    [trace, target, trip, steps],
  )
  const reduce = useMemo(() => tripReducer(trace, target, trip), [trace, target, trip])
  const last = steps.length - 1

  const [state, send] = useReducer(
    (current: PlayerState, action: PlayerAction): PlayerState => {
      switch (action.type) {
        case 'play':
          return { ...current, playing: action.on }
        case 'bench': {
          const session = reduce(current.session, action.action)
          return session === current.session ? current : { ...current, session }
        }
        case 'go': {
          const index = Math.max(0, Math.min(last, action.index))
          if (index === current.index) return current
          // One step on is played: its actions begin and the scope is seen driving. Any other
          // move, back or a jump, lands on the step at rest.
          const session =
            index === current.index + 1 ? timeline.begins[index] : timeline.rests[index]
          return { index, session, playing: current.playing && index < last }
        }
      }
    },
    null,
    (): PlayerState => ({
      index: 0,
      session: timeline.rests[0],
      // With reduced motion asked for, nothing moves until the learner steps.
      playing:
        Boolean(window.matchMedia) &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    }),
  )
  const { index, session, playing } = state
  const step = steps[index]
  const busy = Boolean(session.nav && session.stage === 'navigate' && moving(session.nav.phase))
  const benchDispatch = useCallback((action: TripAction) => send({ type: 'bench', action }), [send])

  // Playing: each step is held for a while once it has come to rest, then the next begins.
  useEffect(() => {
    if (!playing || busy || index >= last) return
    const timer = window.setTimeout(
      () => send({ type: 'go', index: index + 1 }),
      holdMs(step.caption),
    )
    return () => window.clearTimeout(timer)
  }, [playing, busy, index, last, step.caption])

  const first = NAV_LESSONS[0]
  const narration = (
    <section
      className={styles.demoCard}
      aria-label="The method, demonstrated"
      data-demo
      data-demo-step={step.id}
      data-demo-busy={busy || undefined}
    >
      <p className={styles.demoKicker}>
        Watch the method · {step.part} · step {index + 1} of {steps.length}
      </p>
      <p className={styles.demoCaption} aria-live="polite" data-demo-caption>
        {step.caption}
      </p>
      <ol className={styles.demoDots} aria-hidden="true">
        {steps.map((entry, i) => (
          <li key={entry.id} data-demo-dot={i < index ? 'done' : i === index ? 'now' : 'ahead'} />
        ))}
      </ol>
      <div className={styles.demoControls}>
        <button
          onClick={() => send({ type: 'go', index: index - 1 })}
          disabled={index === 0}
          data-demo-back
        >
          <ArrowLeft size={15} aria-hidden /> Back
        </button>
        {index < last ? (
          <button
            onClick={() => send({ type: 'play', on: !playing })}
            aria-pressed={playing}
            data-demo-play
          >
            {playing ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}
            {playing ? 'Pause' : 'Play'}
          </button>
        ) : (
          <button onClick={() => send({ type: 'go', index: 0 })} data-demo-again>
            <RotateCcw size={15} aria-hidden /> Watch again
          </button>
        )}
        <button
          onClick={() => send({ type: 'go', index: index + 1 })}
          disabled={index === last || busy}
          data-demo-next
        >
          Next <ArrowRight size={15} aria-hidden />
        </button>
      </div>
      <p className={styles.demoNote}>
        This is the bench you will use, shown working one lesion from the lesion to the lesion.
        Nothing here is asked of you, nothing is saved, and the controls on the pictures are off
        while you watch.
      </p>
      <div className={styles.demoOnward}>
        <Link className={styles.demoPrimary} href={lessonHref(first.id)} data-demo-start>
          {index === last
            ? `Now do it: ${lessonLabel(first, ': ')}`
            : `Skip to ${lessonLabel(first, ': ')}`}
        </Link>
      </div>
      <p className={styles.boundary}>{TEACHING_SIMULATOR_STATEMENT}</p>
    </section>
  )

  return (
    <TripBench
      section="learn"
      title="Watch the method"
      subtitle="One lesion, from the lesion back and then from the trachea to it"
      trace={trace}
      target={target}
      trip={trip}
      help
      session={session}
      dispatch={benchDispatch}
      closing={{ heading: 'End of the demonstration', body: [] }}
      exit={<Link href={BASE_PATH}>Course overview</Link>}
      narration={narration}
    />
  )
}
