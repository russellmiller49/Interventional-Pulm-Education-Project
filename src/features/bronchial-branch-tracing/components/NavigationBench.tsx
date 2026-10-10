'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from 'react'
import { ArrowRight, CircleHelp, RotateCcw } from 'lucide-react'
import {
  HelpDialog,
  LessonShell,
  NowCard,
  type NowCardModel,
} from '@/features/learning-module/stage'
import type { CtMark, CtTrace } from '../content/ct-types'
import {
  PRIMER,
  PRIMER_TITLE,
  alongSliceSentence,
  arrivalSentence,
  chooseDeclined,
  chooseTaken,
  forkPatternSentence,
  identifyInstruction,
  identifyVerdict,
  lesionSentence,
  lookCaption,
  matchNoteSentence,
  matchVerdict,
  openingInScope,
  openingLevelSentence,
  openingName,
  openingNumber,
  openingShort,
  packetProse,
} from '../content/bench-copy'
import { junctionFeedbackPacket } from '../content/junction-feedback'
import { displayName } from '../engine/display-text'
import { forkFacts, lesionFromFork, type OpeningFacts } from '../engine/fork-facts'
import { optionVerdict, responseLumen, responsePlane } from '../engine/junction-feedback'
import {
  onwardOption,
  type NavAction,
  type NavPhase,
  type NavPlan,
  type NavSession,
} from '../engine/nav-session'
import { readMatch, stationMatch } from '../engine/orientation-match'
import { NATIVE_CT, targetForTrace } from '../geometry/native-ct'
import { cameraBasis, lookingDirection } from '../geometry/reference-frames'
import {
  arcToSlice,
  arrivalPose,
  driveFrom,
  drivePose,
  lookKind,
  stationCamera,
  type ScopePose,
} from '../geometry/route-stations'
import { ScopeView, type ScopeOpeningLabel } from './ScopeView'
import {
  TracingCtViewer,
  type CtOverlayLocator,
  type CtOverlayMark,
  type CtSliderTick,
} from './TracingCtViewer'
import styles from './nav-bench.module.css'

/**
 * The navigation bench: the scope, the CT and the task, side by side on one screen.
 *
 * It renders one trip of one route. The session reducer (engine/nav-session.ts) holds where the
 * learner is; this component turns that into what each pane shows and animates the drive between
 * forks. It owns only view state: the slice on screen, where the CT is centred, the drive clock.
 */
const DRIVE_MM_PER_SECOND = 15
/** Set once the learner has closed the primer on this device. */
export const PRIMER_SEEN_KEY = 'branch-tracing.primer-seen-v1'
const FORK_FIELD_MIN = 96
const FORK_FIELD_MAX = 230
const LESION_FIELD = 190

const toPixel = (lps: readonly number[]): [number, number] => [
  (lps[0] - NATIVE_CT.origin[0]) / NATIVE_CT.spacing[0],
  (lps[1] - NATIVE_CT.origin[1]) / NATIVE_CT.spacing[1],
]

interface Crop {
  center: [number, number]
  size: number
}
/** A square field that holds the parent, the scope tip and every opening's lumen. */
function forkCrop(points: [number, number][]): Crop {
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1])
  const center: [number, number] = [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  ]
  const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
  return { center, size: Math.max(FORK_FIELD_MIN, Math.min(FORK_FIELD_MAX, extent * 1.5 + 56)) }
}

export interface BenchProps {
  section: 'learn' | 'practice' | 'assess'
  /** "Lesson 2 · Two openings, two slices" */
  title: string
  /** "Trip 1 of 2 · Right main bronchus to the middle lobe bronchus" */
  subtitle?: string
  trace: CtTrace
  plan: NavPlan
  /** Arrival text by station index. */
  teach?: (string | undefined)[]
  intro?: string
  /** Opening names stay hidden until the learner has chosen at each fork. */
  independent?: boolean
  /**
   * Hints are offered: which way to move a missed mark, how to turn a mismatched CT, the fork's
   * written explanation. Off for the closing set. "Show me" is always there; nothing blocks.
   */
  help: boolean
  session: NavSession
  dispatch: Dispatch<NavAction>
  /** The primary action once the trip is over, and what the closing card says. */
  closing: {
    heading: string
    body: string[]
    next?: { label: string; href?: string; onActivate?: () => void }
  }
  /** Lesson notes and reference, shown folded under the task. */
  notes?: ReactNode
  /** Links back to the hub, shown in the header. */
  exit: ReactNode
}

export function NavigationBench({
  section,
  title,
  subtitle,
  trace,
  plan,
  teach,
  intro,
  independent = false,
  help,
  session,
  dispatch,
  closing,
  notes,
  exit,
}: BenchProps) {
  const target = targetForTrace(trace)
  const planned = plan.stations[session.station]
  const checkpointIndex = planned.checkpointIndex
  const checkpoint = trace.checkpoints[checkpointIndex]
  const facts = forkFacts(trace, checkpointIndex)!
  const match = stationMatch(trace, checkpointIndex)!
  const camera = stationCamera(trace, checkpointIndex)!
  const lesion = lesionFromFork(trace, checkpointIndex, target)!
  const packet = junctionFeedbackPacket(checkpoint.id)
  const phase = session.phase
  const over = phase === 'arrived' || phase === 'done'
  const worked = Boolean(planned.worked)
  const asksIdentify = planned.steps.includes('identify')
  const stationKey = `${trace.id}:${session.station}`
  // A trip that neither chooses toward the lesion nor reaches it has no use for the lesion.
  const showLesion =
    plan.arrive || plan.stations.some((station) => station.steps.includes('choose'))

  // ── View state: the slice on screen and where the CT is centred ───────────────────────────
  // A new fork opens on its own slice and arrival opens on the lesion's; nothing else resets
  // the learner's view.
  const viewKey = phase === 'arrived' ? `${stationKey}:arrived` : stationKey
  const fresh: { key: string; slice: number; focus: 'fork' | 'lesion' } =
    phase === 'arrived'
      ? { key: viewKey, slice: target.slice, focus: 'lesion' }
      : { key: viewKey, slice: facts.forkSlice, focus: 'fork' }
  const [view, setView] = useState(fresh)
  const current = view.key === viewKey ? view : fresh
  const freshFocus = fresh.focus
  const setSlice = useCallback(
    (slice: number) =>
      setView((previous) => ({
        key: viewKey,
        slice,
        focus: previous.key === viewKey ? previous.focus : freshFocus,
      })),
    [viewKey, freshFocus],
  )
  // The primer opens by itself the first time the bench is used on this device, and from the
  // header button afterwards. The bench mounts after hydration, so storage can be read here.
  const [helpOpen, setHelpOpen] = useState(() => {
    try {
      return window.localStorage.getItem(PRIMER_SEEN_KEY) === null
    } catch {
      return false
    }
  })
  const closeHelp = useCallback(() => {
    setHelpOpen(false)
    try {
      window.localStorage.setItem(PRIMER_SEEN_KEY, '1')
    } catch {
      /* The primer simply opens again next time. */
    }
  }, [])
  const helpButton = useRef<HTMLButtonElement>(null)
  const [wheelSlices, setWheelSlices] = useState(false)
  useEffect(() => {
    // In the fixed workspace the page does not scroll, so the wheel can step slices.
    const query = window.matchMedia('(min-width: 1024px) and (min-height: 700px)')
    const update = () => setWheelSlices(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  // ── The drive between forks ───────────────────────────────────────────────────────────────
  const drive = useMemo(() => driveFrom(trace, checkpointIndex), [trace, checkpointIndex])
  const { fromArc, toArc } = drive
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    if (phase !== 'drive') return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = reduced
      ? 0
      : Math.max(900, Math.min(3500, (Math.abs(toArc - fromArc) / DRIVE_MM_PER_SECOND) * 1000))
    let frame = 0,
      last = 0,
      done = false
    const started = performance.now()
    const finish = () => {
      if (done) return
      done = true
      setProgress(0)
      dispatch({ type: 'arrive' })
    }
    const tick = (now: number) => {
      // A frame's timestamp can be a little earlier than the clock read when the drive began.
      const elapsed = Math.max(0, now - started)
      if (elapsed >= duration) return finish()
      // Thirty updates a second is as smooth as the scope view needs.
      if (now - last >= 33) {
        last = now
        setProgress(elapsed / duration)
      }
      frame = requestAnimationFrame(tick)
    }
    // With no animation there is nothing to draw between the two forks: arrive on the next turn.
    if (duration > 0) frame = requestAnimationFrame(tick)
    // A hidden tab stops animation frames; the trip must not stall there.
    const fallback = window.setTimeout(finish, duration > 0 ? duration + 400 : 0)
    return () => {
      done = true
      cancelAnimationFrame(frame)
      window.clearTimeout(fallback)
    }
  }, [phase, fromArc, toArc, dispatch])

  const moving = phase === 'drive'
  const pose: ScopePose = useMemo(
    () =>
      moving
        ? drivePose(trace, drive, progress)
        : phase === 'arrived'
          ? arrivalPose(trace)
          : camera,
    [moving, phase, trace, drive, progress, camera],
  )
  const tipPixel = toPixel(pose.position)
  const tipSlice = arcToSlice(trace, pose.arc)
  const headingLength = Math.hypot(pose.direction[0], pose.direction[1])
  const tip = {
    slice: tipSlice,
    pixel: tipPixel,
    heading:
      headingLength > 0.25
        ? ([pose.direction[0] / headingLength, pose.direction[1] / headingLength] as [
            number,
            number,
          ])
        : ([0, 0] as [number, number]),
  }

  // ── What the CT shows ─────────────────────────────────────────────────────────────────────
  const planes = facts.openings.map(
    (opening) => responsePlane(trace, checkpointIndex, opening.index)!,
  )
  const here = useMemo(
    () =>
      forkCrop([
        toPixel(camera.position),
        toPixel(checkpoint.decision!.junctionLps),
        ...planes.map((p) => p.pixel),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stationKey],
  )
  const lesionCrop: Crop = { center: target.pixel, size: LESION_FIELD }
  const nextIndex = plan.stations[session.station + 1]?.checkpointIndex
  const ahead = useMemo<Crop>(() => {
    if (nextIndex === undefined) return lesionCrop
    const next = forkFacts(trace, nextIndex)!
    const nextCamera = stationCamera(trace, nextIndex)!
    return forkCrop([
      toPixel(nextCamera.position),
      toPixel(trace.checkpoints[nextIndex].decision!.junctionLps),
      ...next.openings.map((o) => responsePlane(trace, nextIndex, o.index)!.pixel),
    ])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trace, nextIndex])
  const travelled = Math.max(0, Math.min(1, progress))
  const eased = travelled * travelled * (3 - 2 * travelled)
  const crop: Crop = moving
    ? {
        center: [
          here.center[0] + (ahead.center[0] - here.center[0]) * eased,
          here.center[1] + (ahead.center[1] - here.center[1]) * eased,
        ],
        size: here.size + (ahead.size - here.size) * eased,
      }
    : phase === 'arrived' || current.focus === 'lesion'
      ? lesionCrop
      : here
  const slice = moving ? tipSlice : current.slice

  const chosen = session.choice !== null
  const named = (opening: OpeningFacts) =>
    independent
      ? chosen || over
      : !asksIdentify || Boolean(session.marks[opening.index]?.ok) || chosen
  const identifying = phase === 'identify' ? facts.openings[session.identifyOption] : null
  const marks: CtOverlayMark[] = session.marks.flatMap((entry, index) =>
    entry?.mark.pixel
      ? [
          {
            id: `${stationKey}:${index}`,
            slice: entry.mark.slice,
            pixel: entry.mark.pixel,
            label:
              named(facts.openings[index]) && entry.ok
                ? `${openingNumber(index)} · ${facts.openings[index].airway.code}`
                : openingNumber(index),
            tone: entry.ok
              ? entry.shown
                ? ('shown' as const)
                : ('ok' as const)
              : ('miss' as const),
          },
        ]
      : [],
  )
  // Where the bench letters the openings itself, their model centres are shown on the CT.
  const locators: CtOverlayLocator[] =
    !asksIdentify && !independent && !moving && !over
      ? facts.openings.map((opening) => ({
          id: `${stationKey}:locator:${opening.index}`,
          slice: planes[opening.index].slice,
          pixel: (responseLumen(trace, checkpointIndex, opening.index) ?? planes[opening.index])
            .pixel,
          label: openingNumber(opening.index),
        }))
      : []
  const ticks: CtSliderTick[] = [
    // One mark per slice: openings identified on the same slice share it ("1 2").
    ...[...new Set(planes.map((plane) => plane.slice))].flatMap((planeSlice) => {
      const shown = facts.openings.filter(
        (opening) =>
          planes[opening.index].slice === planeSlice &&
          !moving &&
          phase !== 'arrived' &&
          (!asksIdentify ||
            (phase === 'identify' ? opening.index <= session.identifyOption : phase !== 'match')),
      )
      return shown.length
        ? [
            {
              slice: planeSlice,
              label: shown.map((opening) => openingNumber(opening.index)).join(' '),
              tone: 'opening' as const,
            },
          ]
        : []
    }),
    ...(showLesion ? [{ slice: target.slice, label: 'Lesion', tone: 'lesion' as const }] : []),
  ]

  // ── What the scope shows ──────────────────────────────────────────────────────────────────
  const openings: ScopeOpeningLabel[] =
    phase === 'arrived'
      ? []
      : facts.openings.map((opening) => {
          const option = checkpoint.decision!.options[opening.index]
          const fork = checkpoint.decision!.junctionLps
          const delta = [option.lps[0] - fork[0], option.lps[1] - fork[1], option.lps[2] - fork[2]]
          const length = Math.hypot(delta[0], delta[1], delta[2]) || 1
          const at = (mm: number) =>
            [0, 1, 2].map((axis) => fork[axis] + (delta[axis] / length) * mm) as [
              number,
              number,
              number,
            ]
          return {
            id: `${stationKey}:${opening.index}`,
            // Deepest first: the number should sit in the opening, not on the spur in front of it.
            anchors: [at(12), at(9), at(6), at(Math.min(3, length)), at(1.5)],
            text: openingNumber(opening.index),
            caption: named(opening) && !opening.repeatedName ? opening.airway.code : undefined,
            tone: session.declined.includes(opening.index)
              ? 'declined'
              : session.choice === opening.index
                ? 'chosen'
                : identifying?.index === opening.index
                  ? 'active'
                  : session.marks[opening.index]?.ok
                    ? 'done'
                    : 'plain',
            ariaLabel: `Opening ${openingNumber(opening.index)}`,
          }
        })
  const basis = cameraBasis(pose.direction, pose.up)
  const topName = nearestAxisName(basis.up)
  const caption = moving
    ? 'Driving on. The CT follows the tip of the scope.'
    : phase === 'arrived'
      ? `At the end of ${target.approachCode}, beside the lesion.`
      : lookCaption(
          facts.parent.code,
          lookKind(pose.direction),
          lookingDirection(pose.direction),
          topName,
        )

  // ── Actions ───────────────────────────────────────────────────────────────────────────────
  const reading = readMatch(match, session.orientation)
  const mark = useCallback((value: CtMark) => dispatch({ type: 'mark', mark: value }), [dispatch])
  const showMark = () => {
    if (identifying) setSlice(planes[identifying.index].slice)
    dispatch({ type: 'show-mark' })
  }
  const route = facts.openings[onwardOption(trace, plan, session)]
  const lastMark = identifying ? session.marks[identifying.index] : null
  const lastVerdict =
    identifying && lastMark && !lastMark.ok
      ? optionVerdict(trace, checkpointIndex, identifying.index, lastMark.mark)
      : null
  const justIdentified =
    phase === 'identify' && session.identifyOption > 0
      ? facts.openings[session.identifyOption - 1]
      : phase !== 'identify' && phase !== 'match' && asksIdentify && !chosen
        ? facts.openings[facts.openings.length - 1]
        : null

  // The fork's own written advice for a mark that fell in, or nearer, another airway.
  const missAdvice = (() => {
    if (!packet || !help || independent || !identifying || !lastVerdict?.nearest) return null
    if (lastVerdict.verdict === 'intended-lumen') return null
    const advice = packet.whenNearer[identifying.index]
    if (!advice) return null
    const role = lastVerdict.nearest.role
    return advice.appliesTo === 'any' || advice.appliesTo.includes(role as never)
      ? packetProse(advice.text)
      : null
  })()
  // The airways driven so far, each named once: a route can pass several forks of one bronchus.
  const routeSoFar = trace.airwayPath
    .slice(0, Math.max(1, trace.airwayPath.findIndex((a) => a.code === facts.parent.code) + 1))
    .filter((airway, index, list) => index === 0 || airway.code !== list[index - 1].code)
  // Where the learner is in the four moves, so the next move is always in sight.
  const order: NavPhase[] = ['match', 'identify', 'choose', 'ready']
  const loopState = (id: LoopStepId): 'done' | 'now' | 'todo' | 'bench' => {
    const at = phase === 'drive' || over ? order.length : order.indexOf(phase)
    const index = id === 'drive' ? 3 : order.indexOf(id)
    if (phase === 'drive' && id === 'drive') return 'now'
    if (index === at) return 'now'
    if (id !== 'drive' && !planned.steps.includes(id)) return index < at ? 'bench' : 'todo'
    if (id === 'match' && session.matchNote !== 'asked' && index < at) return 'bench'
    return index < at ? 'done' : 'todo'
  }
  const forkCount = `Fork ${session.station + 1} of ${plan.stations.length}`
  let now: NowCardModel
  if (phase === 'match')
    now = {
      kicker: `${forkCount} · Match`,
      heading: 'Turn the CT until it matches the scope',
      body: 'Put R, L, A and P on the same sides of the CT as they are in the scope.',
      where: 'CT panel: Rotate left, Rotate right, Flip.',
      primary: worked
        ? { label: 'Show the match', onActivate: () => dispatch({ type: 'show-match' }) }
        : { label: 'Check the match', onActivate: () => dispatch({ type: 'check-match' }) },
      secondary: worked
        ? { label: 'Check my own', onActivate: () => dispatch({ type: 'check-match' }) }
        : { label: 'Show me', onActivate: () => dispatch({ type: 'show-match' }) },
    }
  else if (phase === 'identify' && identifying) {
    const onSlice = slice === identifying.slice
    now = {
      kicker: `${forkCount} · Identify`,
      heading: `Find opening ${openingNumber(identifying.index)} on the CT`,
      body: identifyInstruction(identifying, slice),
      where: onSlice ? 'CT panel: click inside the lumen.' : 'CT panel: the slice slider.',
      primary: worked
        ? { label: `Show opening ${openingNumber(identifying.index)}`, onActivate: showMark }
        : onSlice
          ? undefined
          : {
              label: `Go to slice ${identifying.slice}`,
              onActivate: () => setSlice(identifying.slice),
            },
      secondary: worked ? undefined : { label: 'Show me', onActivate: showMark },
    }
  } else if (phase === 'choose')
    now = {
      kicker: `${forkCount} · Choose`,
      heading: 'Which opening leads toward the lesion?',
      body: lesionSentence(target, lesion),
      where: 'CT panel: follow each lumen with the slider. Lesion slice shows the lesion.',
      primary: worked
        ? { label: 'Show the choice', onActivate: () => dispatch({ type: 'show-choice' }) }
        : undefined,
      secondary: worked
        ? undefined
        : { label: 'Show me', onActivate: () => dispatch({ type: 'show-choice' }) },
    }
  else if (phase === 'ready')
    now = {
      kicker: `${forkCount} · Drive`,
      heading: `Drive on into ${openingShort(route, true)}`,
      body:
        session.station < plan.stations.length - 1
          ? 'The scope advances to the next fork and the CT follows its tip.'
          : 'The scope advances to the end of this airway, beside the lesion.',
      primary: {
        label: 'Drive on',
        onActivate: () => dispatch({ type: 'drive' }),
        icon: <ArrowRight size={16} aria-hidden />,
      },
    }
  else if (phase === 'drive')
    now = {
      kicker: `${forkCount} · Drive`,
      heading: `Driving into ${openingShort(route, true)}`,
      status: `CT slice ${slice}`,
    }
  else
    now = {
      kicker: phase === 'arrived' ? 'Arrived' : 'End of this trip',
      heading: closing.heading,
      primary: closing.next
        ? {
            label: closing.next.label,
            href: closing.next.href,
            onActivate: closing.next.onActivate,
          }
        : undefined,
    }

  const gapMm = Math.hypot(
    target.centerLps[0] - pose.position[0],
    target.centerLps[1] - pose.position[1],
    target.centerLps[2] - pose.position[2],
  )
  const arrivedTeach = teach?.[session.station]
  const nearestName = (() => {
    const nearest = lastVerdict?.nearest
    if (!nearest || !identifying) return null
    if (nearest.role === 'parent') return `the parent, ${nearest.airway.code}`
    const sibling = facts.openings.find(
      (o) => o.airway.code === nearest.airway.code && nearest.role === 'daughter',
    )
    if (sibling)
      return named(sibling)
        ? openingShort(sibling, true)
        : `opening ${openingNumber(sibling.index)}`
    return independent ? 'another airway' : nearest.airway.code
  })()

  return (
    <LessonShell
      section={section}
      stage={`${session.station}:${phase}${phase === 'identify' ? `:${session.identifyOption}` : ''}`}
      label={title}
      module="bronchial-branch-tracing"
      header={
        <div className={styles.benchHeader}>
          <div className={styles.benchTitle}>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <ol className={styles.routeStrip} aria-label="Route so far" data-route-strip>
            {routeSoFar.map((airway, index, list) => (
              <li
                key={`${airway.code}-${index}`}
                data-route-chip={index === list.length - 1 && !over ? 'current' : 'done'}
              >
                {airway.code}
              </li>
            ))}
            {!over &&
              plan.stations.slice(session.station + 1).map((station) => (
                <li key={station.checkpointIndex} data-route-chip="ahead" aria-label="A fork ahead">
                  ?
                </li>
              ))}
            {over && phase === 'arrived' && <li data-route-chip="done">{target.approachCode}</li>}
            {showLesion && <li data-route-chip="lesion">Lesion · {target.segment.code}</li>}
          </ol>
          <div className={styles.benchActions}>
            <button ref={helpButton} onClick={() => setHelpOpen(true)} data-bench-help>
              <CircleHelp size={15} aria-hidden /> What are we doing?
            </button>
            <button onClick={() => dispatch({ type: 'restart' })} data-bench-restart>
              <RotateCcw size={15} aria-hidden /> Restart trip
            </button>
            {exit}
          </div>
        </div>
      }
    >
      <div className={styles.bench} data-bench data-bench-phase={phase}>
        <section className={styles.pane} style={{ gridArea: 'scope' }} aria-label="Bronchoscope">
          <header className={styles.paneHead}>
            <h2>Bronchoscope</h2>
            <span>{over && phase === 'arrived' ? target.approachCode : facts.parent.code}</span>
          </header>
          <div className={styles.squareSlot}>
            <ScopeView
              position={pose.position}
              direction={pose.direction}
              up={pose.up}
              openings={openings}
              moving={moving}
              caption={caption}
              phase={phase}
            />
          </div>
          <p className={styles.paneCaption} data-scope-caption>
            {caption}
          </p>
        </section>

        <section className={styles.pane} style={{ gridArea: 'ct' }} aria-label="CT">
          <header className={styles.paneHead}>
            <h2>CT</h2>
            <span data-ct-display>{orientationSummary(session)}</span>
            {showLesion && (
              <button
                className={styles.lesionToggle}
                aria-pressed={current.focus === 'lesion'}
                disabled={moving || over}
                onClick={() =>
                  setView(
                    current.focus === 'lesion'
                      ? { key: viewKey, slice: facts.forkSlice, focus: 'fork' }
                      : { key: viewKey, slice: target.slice, focus: 'lesion' },
                  )
                }
                data-ct-lesion-toggle
              >
                {current.focus === 'lesion' ? 'Back to the fork' : 'Lesion slice'}
              </button>
            )}
          </header>
          <TracingCtViewer
            slice={slice}
            range={trace.range}
            onSlice={setSlice}
            orientation={session.orientation}
            onTurn={moving ? undefined : (operation) => dispatch({ type: 'turn', operation })}
            center={crop.center}
            size={crop.size}
            target={target}
            showNodule={showLesion}
            markSlice={identifying ? identifying.slice : undefined}
            markLabel={identifying ? `opening ${openingNumber(identifying.index)}` : undefined}
            onMark={identifying ? mark : undefined}
            marks={marks}
            locators={locators}
            tip={over ? null : tip}
            ticks={ticks}
            wheelSlices={wheelSlices}
          />
        </section>

        <div className={styles.now} style={{ gridArea: 'now' }}>
          <ol className={styles.loop} aria-label="The four moves at this fork" data-loop-steps>
            {LOOP_STEPS.map((step) => {
              const state = loopState(step.id)
              return (
                <li key={step.id} data-loop-step={step.id} data-loop-state={state}>
                  <strong>{step.label}</strong>
                  <span>
                    {state === 'bench' ? 'done for you' : state === 'now' ? 'now' : step.what}
                  </span>
                </li>
              )
            })}
          </ol>
          <NowCard model={now}>
            {phase === 'choose' && (
              <div className={styles.choices} role="group" aria-label="Openings">
                {facts.openings.map((opening) => {
                  const declined = session.declined.includes(opening.index)
                  return (
                    <button
                      key={opening.index}
                      onClick={() => dispatch({ type: 'choose', option: opening.index })}
                      disabled={declined}
                      data-choice={openingNumber(opening.index)}
                      data-choice-declined={declined || undefined}
                    >
                      <strong>{openingName(opening, named(opening))}</strong>
                      <span>{openingInScope(opening)}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {over && (
              <div className={styles.closing} data-bench-closing>
                {phase === 'arrived' && <p>{arrivalSentence(target, gapMm)}</p>}
                {closing.body.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            )}
          </NowCard>
          {/* Feedback sits under the card, so the card's buttons never move when it appears. */}
          <div className={styles.feedback} aria-live="polite" data-bench-feedback>
            {phase === 'match' && session.matchChecked && (
              <Band
                {...matchVerdict(
                  readMatch(match, session.matchChecked),
                  session.matchChecked,
                  help,
                )}
              />
            )}
            {phase === 'identify' && lastVerdict && identifying && (
              <Band
                {...identifyVerdict(
                  identifying,
                  lastVerdict,
                  named(identifying),
                  nearestName,
                  help,
                )}
              />
            )}
            {phase === 'identify' && missAdvice && (
              <p className={styles.note} data-miss-advice>
                {missAdvice}
              </p>
            )}
            {phase === 'choose' &&
              session.declined.length > 0 &&
              (() => {
                const opening = facts.openings[session.declined[session.declined.length - 1]]
                const copy = chooseDeclined(opening, named(opening), lesion)
                return <Band tone="miss" {...copy} />
              })()}
            {phase === 'ready' && <Band tone="in" {...chooseTaken(route, lesion)} />}
          </div>
        </div>

        <div className={styles.detail} style={{ gridArea: 'detail' }} data-bench-detail>
          {!over && (
            <>
              {session.station === 0 && intro && phase !== 'drive' && (
                <p className={styles.intro} data-bench-intro>
                  {intro}
                </p>
              )}
              {phase !== 'match' && session.matchNote !== 'asked' && !moving && (
                <p className={styles.note} data-match-note={session.matchNote}>
                  {matchNoteSentence(
                    session.matchNote,
                    session.orientation,
                    session.station === 0,
                    match.oblique,
                  )}
                </p>
              )}
              {phase !== 'match' &&
                session.matchNote === 'asked' &&
                reading.kind === 'matches' &&
                !moving && <Band {...matchVerdict(reading, session.orientation, help)} />}
              {justIdentified && (
                <Band
                  {...identifyVerdict(
                    justIdentified,
                    {
                      verdict: 'intended-lumen',
                      markInAir: true,
                      reached: [],
                      nearest: null,
                      toIntended: { mm: 0, leftMm: 0, posteriorMm: 0 },
                    },
                    named(justIdentified),
                    null,
                    help,
                  )}
                />
              )}
              <section className={styles.forkCard} aria-label="This fork" data-fork-card>
                <h3>
                  This fork: {facts.parent.code}
                  {facts.parent.name !== facts.parent.code &&
                    ` · ${displayName(facts.parent.name)}`}
                </h3>
                {arrivedTeach && <p data-fork-teach>{arrivedTeach}</p>}
                {!arrivedTeach && lookKind(camera.direction) === 'level' && (
                  <p>{alongSliceSentence(match)}</p>
                )}
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Opening</th>
                      <th scope="col">In the scope</th>
                      <th scope="col">On the CT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facts.openings.map((opening) => (
                      <tr key={opening.index}>
                        <th scope="row">{openingName(opening, named(opening))}</th>
                        <td>{opening.side}</td>
                        <td>{openingLevelSentence(opening)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p>{forkPatternSentence(facts)}</p>
                {/* Said before the openings are identified: what the lumens look like on their
                    slices. It names the airways, so it is kept off the trips that withhold names. */}
                {packet?.entryLimitation &&
                  help &&
                  !independent &&
                  asksIdentify &&
                  phase === 'identify' && (
                    <p className={styles.note} data-fork-entry-note>
                      {packetProse(packet.entryLimitation)}
                    </p>
                  )}
                {/* The written explanation names each daughter and says where it is, so it opens
                    once the openings are named: after they are identified, or straight away at a
                    fork where the bench letters them itself. */}
                {packet && help && !independent && facts.openings.every(named) && (
                  <details data-fork-more>
                    <summary>More about this fork on the CT</summary>
                    <p>{packetProse(packet.divergence)}</p>
                    <p>{packetProse(packet.continuity)}</p>
                    <h4>Slices to step through</h4>
                    <ul>
                      {packet.revisit.map((interval) => (
                        <li key={`${interval.from}-${interval.to}`}>
                          {interval.from} to {interval.to}: {packetProse(interval.look)}.
                        </li>
                      ))}
                    </ul>
                    <h4>From the airway model</h4>
                    <ul>
                      {packet.known.map((line) => (
                        <li key={line}>{packetProse(line)}</li>
                      ))}
                    </ul>
                    <h4>The names</h4>
                    {packet.naming.demonstration.map((line) => (
                      <p key={line}>{packetProse(line)}</p>
                    ))}
                  </details>
                )}
              </section>
            </>
          )}
          {notes}
        </div>
      </div>
      <HelpDialog
        open={helpOpen}
        onClose={closeHelp}
        title={PRIMER_TITLE}
        returnFocusTo={helpButton}
      >
        {PRIMER.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </HelpDialog>
    </LessonShell>
  )
}

type LoopStepId = 'match' | 'identify' | 'choose' | 'drive'
const LOOP_STEPS: { id: LoopStepId; label: string; what: string }[] = [
  { id: 'match', label: 'Match', what: 'turn the CT' },
  { id: 'identify', label: 'Identify', what: 'find each opening' },
  { id: 'choose', label: 'Choose', what: 'toward the lesion' },
  { id: 'drive', label: 'Drive', what: 'to the next fork' },
]

function Band({
  tone,
  headline,
  detail,
}: {
  tone: 'in' | 'near' | 'miss'
  headline: string
  detail: string
}) {
  return (
    <p className={styles.band} data-verdict-tone={tone} role="status">
      <strong>{headline}</strong> {detail}
    </p>
  )
}

function orientationSummary(session: NavSession) {
  const o = session.orientation
  if (!o.turns && !o.reflected) return 'Standard axial'
  const turn = ['', 'turned 90° clockwise', 'turned 180°', 'turned 90° counterclockwise'][o.turns]
  return [o.reflected ? 'Flipped' : '', turn].filter(Boolean).join(', ').replace(/^t/, 'T')
}

/** The patient direction a screen-up vector is closest to, for the caption. */
function nearestAxisName(up: readonly number[]) {
  const axes: [string, readonly number[]][] = [
    ['the head', [0, 0, 1]],
    ['the feet', [0, 0, -1]],
    ['anterior', [0, -1, 0]],
    ['posterior', [0, 1, 0]],
    ['the patient’s left', [1, 0, 0]],
    ['the patient’s right', [-1, 0, 0]],
  ]
  return axes
    .map(([name, v]) => ({ name, dot: up[0] * v[0] + up[1] * v[1] + up[2] * v[2] }))
    .sort((a, b) => b.dot - a.dot)[0].name
}
