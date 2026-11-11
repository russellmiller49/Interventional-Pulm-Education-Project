'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, CircleHelp, RotateCcw } from 'lucide-react'
import {
  HelpDialog,
  LessonShell,
  NowCard,
  type NowCardModel,
} from '@/features/learning-module/stage'
import type { CtMark, CtNoduleTarget, CtTrace } from '../content/ct-types'
import { PRIMER, PRIMER_TITLE, openingNumber, packetProse } from '../content/bench-copy'
import { junctionFeedbackPacket } from '../content/junction-feedback'
import {
  ANATOMICAL_LABEL,
  PLAN_PART_TITLES,
  STAGE_STEPS,
  arcsFound,
  arcsInstruction,
  arcsMiss,
  frameFound,
  frameInstruction,
  frameMiss,
  viewsInstruction,
  lesionFound,
  lesionInstruction,
  lesionMiss,
  prefilledReview,
  reviewSentence,
  sectorPhrase,
  segmentFound,
  segmentInstruction,
  segmentLabel,
  segmentMiss,
} from '../content/plan-copy'
import {
  ANATOMICAL,
  RIMS,
  gradeArcs,
  gradeFrame,
  withGhost,
  mappedForks,
  modelMapLevels,
  sectorAngle,
  turnedRim,
  type Anatomical,
  type MapLevel,
  type Rim,
} from '../engine/arc-map'
import { responseLumen, responsePlane } from '../engine/junction-feedback'
import {
  divisionBearings,
  lesionVerdict,
  planFrame,
  planPrefilled,
  segmentChoices,
  type PlanAction,
  type PlanPart,
  type PlanSession,
  type PlanSpec,
} from '../engine/plan-session'
import { lobeOf } from '../content/targets'
import { lpsToVoxel } from '../geometry/native-ct'
import { STANDARD_ORIENTATION, turnCt, type CtOrientation } from '../geometry/orientation'
import { falloffMmFor, routeRadiusMm } from '../geometry/airway-radius'
import { stationCamera } from '../geometry/route-stations'
import { ArcMap } from './ArcMap'
import { usePrimer } from './NavigationBench'
import { ReferenceCtView, referenceIndexFor, type ReferencePlane } from './ReferenceCtView'
import { ScopeView } from './ScopeView'
import {
  TracingCtViewer,
  type CtOverlayLocator,
  type CtOverlayMark,
  type CtSliderTick,
  type CtTrailPin,
} from './TracingCtViewer'
import { Band } from './Band'
import { useFillViewport } from './useFillViewport'
import { useStageFocus } from './useStageFocus'
import styles from './nav-bench.module.css'

/**
 * The planning bench: the map (or the view from the ostium), the CT and the task, on one screen.
 *
 * It renders the planning half of a trip (engine/plan-session.ts): the airway into the lesion, its
 * segment, the learner's views, the ostium circle, each division drawn as arcs, and the finished
 * map beside the model's. It owns only view state: the slice on screen, the crop, how the CT is
 * turned (turning is the learner's own business here) and which tab the side pane shows.
 */
const LESION_FIELD = 190
const FORK_FIELD_MIN = 96
const FORK_FIELD_MAX = 230

const toPixel = (lps: readonly number[]): [number, number] => {
  const [i, j] = lpsToVoxel(lps)
  return [i, j]
}
const sliceOf = (z: number) => Math.round(lpsToVoxel([0, 0, z])[2])
interface Crop {
  center: [number, number]
  size: number
}
function cropAround(points: [number, number][]): Crop {
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1])
  const center: [number, number] = [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  ]
  const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
  return { center, size: Math.max(FORK_FIELD_MIN, Math.min(FORK_FIELD_MAX, extent * 1.5 + 56)) }
}

export interface PlanBenchProps {
  section: 'learn' | 'practice' | 'assess'
  title: string
  subtitle?: string
  trace: CtTrace
  target: CtNoduleTarget
  spec: PlanSpec
  plan: PlanSession
  dispatch: (action: PlanAction) => void
  /** Said at the start of the trip. */
  intro?: string
  /** Said at the start of each part. */
  teach?: Partial<Record<PlanPart, string>>
  /** Said at each mapped division, by division index. */
  divisionTeach?: (string | undefined)[]
  /** Number each division's branches on the CT. */
  locators: boolean
  /** Hints and the fork explanations; off for the closing set. */
  help: boolean
  /** The trip drives on once the map is done; otherwise it closes here. */
  drives: boolean
  /** The trip is over (a trip that only plans). */
  closing: {
    heading: string
    body: string[]
    next?: { label: string; href?: string; onActivate?: () => void }
  }
  done: boolean
  notes?: ReactNode
  exit: ReactNode
  onRestart: () => void
}

type SideTab = 'map' | 'scope' | ReferencePlane

export function PlanBench({
  section,
  title,
  subtitle,
  trace,
  target,
  spec,
  plan,
  dispatch,
  intro,
  teach,
  divisionTeach,
  locators: showLocators,
  help,
  drives,
  closing,
  done,
  notes,
  exit,
  onRestart,
}: PlanBenchProps) {
  const forks = useMemo(() => mappedForks(trace, target), [trace, target])
  const frame = planFrame(trace, target)!
  const stage = plan.stage
  const worked = Boolean(spec.worked)
  const arcsAsked = spec.parts.includes('arcs')
  // The map on the bench is the bench's own: there is nothing of the learner's to set beside it.
  const prefilled = planPrefilled(spec, plan)
  const frameAsked = spec.parts.includes('frame')
  const division = Math.min(plan.division, forks.length - 1)
  const divisionIndex = forks[division]
  const divisionCheckpoint = trace.checkpoints[divisionIndex]
  const optionCount = divisionCheckpoint.decision!.options.length
  const range: [number, number] = useMemo(() => {
    const frames = target.patch.frames.map((f) => f.slice)
    return [
      Math.max(239, Math.min(trace.range[0], ...frames)),
      Math.min(478, Math.max(trace.range[1], ...frames)),
    ]
  }, [trace, target])

  // The words round the learner's circle: their own once accepted, and what they have chosen so
  // far while they label it. A trip that does not ask for the circle draws none (see the map
  // pane), so the model's words are never on screen ahead of the lesson that asks for them.
  const rim: Record<Rim, Anatomical | null> = useMemo(() => {
    if (stage === 'frame' || (frameAsked && plan.frameTurn !== null)) return plan.frame
    const model = turnedRim(frame.rim, plan.frameTurn ?? 0)
    return Object.fromEntries(RIMS.map((r) => [r, model[r].word])) as Record<Rim, Anatomical>
  }, [stage, frameAsked, plan.frame, plan.frameTurn, frame])
  const turn = plan.frameTurn ?? 0
  // The segment is the answer to a planning step: nothing names it, or draws its circle, before.
  const segmentKnown =
    !spec.parts.includes('segment') || plan.segmentChoice === target.segment.bronchusCode
  const mapReady = stage === 'frame' || stage === 'arcs' || stage === 'review' || stage === 'done'

  // ── View state ─────────────────────────────────────────────────────────────────────────────
  const segmentStart = forks[0]
  const segmentFork = trace.checkpoints[segmentStart].decision!.junctionLps
  const viewKey = `${stage}:${stage === 'arcs' ? division : ''}`
  const fresh = (): { key: string; slice: number; crop: Crop } => {
    if (stage === 'lesion' || stage === 'segment' || stage === 'views')
      return stage === 'lesion'
        ? { key: viewKey, slice: target.slice, crop: { center: target.pixel, size: LESION_FIELD } }
        : {
            key: viewKey,
            slice: plan.lesionMark?.slice ?? target.slice,
            crop: cropAround([target.pixel, toPixel(segmentFork)]),
          }
    const ci = stage === 'arcs' ? divisionIndex : segmentStart
    const decision = trace.checkpoints[ci].decision!
    const planes = decision.options.map((_, i) => responsePlane(trace, ci, i)!)
    return {
      key: viewKey,
      slice: sliceOf(decision.junctionLps[2]),
      crop: cropAround([toPixel(decision.junctionLps), ...planes.map((p) => p.pixel)]),
    }
  }
  const [view, setView] = useState(fresh)
  const current = view.key === viewKey ? view : fresh()
  const setSlice = useCallback(
    (slice: number) =>
      setView((previous) => ({ ...(previous.key === viewKey ? previous : fresh()), slice })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewKey],
  )
  const [orientation, setOrientation] = useState<CtOrientation>({ ...STANDARD_ORIENTATION })
  const [tab, setTab] = useState<SideTab>('map')
  const [refPlanes, setRefPlanes] = useState<Record<ReferencePlane, number>>(() => ({
    coronal: referenceIndexFor('coronal', target.pixel),
    sagittal: referenceIndexFor('sagittal', target.pixel),
  }))
  const reconstruction = tab === 'coronal' || tab === 'sagittal' ? tab : null
  const openReconstruction = (plane: ReferencePlane) => {
    setTab(plane)
    if (stage !== 'done') dispatch({ type: 'set-view', view: plane, on: true })
  }
  // No map on the bench yet, and nothing opened beside the CT: the CT has both picture columns.
  const wide =
    !(mapReady && frameAsked) && !reconstruction && !(tab === 'scope' && section === 'learn')
  // The learner's own pins on the CT, dropped while following an airway. Checked by nothing, kept
  // only while this trip is on screen.
  const [trail, setTrail] = useState<CtTrailPin[]>([])
  const dropPin = useCallback((pin: CtTrailPin) => setTrail((all) => [...all.slice(-59), pin]), [])
  const canPin = !done && stage !== 'lesion' && stage !== 'review' && stage !== 'done'
  const [revealed, setRevealed] = useState(false)
  useEffect(() => setRevealed(false), [viewKey])

  const [helpOpen, setHelpOpen, closeHelp] = usePrimer()
  const helpButton = useRef<HTMLButtonElement>(null)
  const [benchRef, benchMinHeight] = useFillViewport<HTMLDivElement>()
  useStageFocus(
    benchRef,
    `${stage}${stage === 'arcs' ? `:${plan.division}` : ''}${done ? ':closed' : ''}`,
  )
  const [wheelSlices, setWheelSlices] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px) and (min-height: 700px)')
    const update = () => setWheelSlices(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  // ── The CT ─────────────────────────────────────────────────────────────────────────────────
  const marks: CtOverlayMark[] = plan.lesionMark
    ? [
        {
          id: 'lesion-airway',
          slice: plan.lesionMark.slice,
          pixel: plan.lesionMark.pixel,
          label: plan.lesionMark.ok ? 'Into the lesion' : '?',
          tone: plan.lesionMark.ok ? (plan.lesionMark.shown ? 'shown' : 'ok') : 'miss',
        },
      ]
    : []
  const divisionPlanes = divisionCheckpoint.decision!.options.map(
    (_, i) => responseLumen(trace, divisionIndex, i) ?? responsePlane(trace, divisionIndex, i)!,
  )
  const locators: CtOverlayLocator[] =
    stage === 'arcs' && (showLocators || revealed)
      ? divisionPlanes.map((point, i) => ({
          id: `division-${division}-${i}`,
          slice: point.slice,
          pixel: point.pixel,
          label: openingNumber(i),
        }))
      : []
  const divisionSlice = sliceOf(divisionCheckpoint.decision!.junctionLps[2])
  // The reconstruction follows the lesion while planning, then the division being worked.
  const followed =
    stage === 'frame' || stage === 'arcs'
      ? (() => {
          const fork =
            trace.checkpoints[stage === 'arcs' ? divisionIndex : segmentStart].decision!.junctionLps
          return { slice: sliceOf(fork[2]), pixel: toPixel(fork) }
        })()
      : { slice: target.slice, pixel: target.pixel }
  const ticks: CtSliderTick[] = [
    { slice: target.slice, label: 'Lesion', tone: 'lesion' },
    ...(stage === 'arcs'
      ? [{ slice: divisionSlice, label: `Division ${division + 1}`, tone: 'scope' as const }]
      : []),
    // Where each branch is found, once the branches are numbered on the CT.
    ...[...new Set(locators.map((locator) => locator.slice))].map((slice) => ({
      slice,
      label: locators
        .filter((locator) => locator.slice === slice)
        .map((locator) => locator.label)
        .join(' '),
      tone: 'opening' as const,
    })),
  ]

  // ── The map ────────────────────────────────────────────────────────────────────────────────
  const drawnLevels: MapLevel[] = useMemo(() => {
    const count =
      stage === 'arcs' ? division : stage === 'review' || stage === 'done' ? plan.arcs.length : 0
    return plan.arcs.slice(0, count).map((entry) => ({
      angles: entry.placed.map(sectorAngle),
      route: entry.leadsOn,
    }))
  }, [plan.arcs, stage, division])
  const modelLevels: MapLevel[] = useMemo(
    () => modelMapLevels(trace, target, turn),
    [trace, target, turn],
  )
  const here = plan.arcs[division]
  const finished = stage === 'review' || stage === 'done'
  // After a check that did not fit, each drawn branch is marked where it stands: kept, or not
  // where a branch leaves. Without hints the check says only whether the division fits.
  const failedGrade =
    stage === 'arcs' && here.checked && here.placed.length === optionCount && here.leadsOn !== null
      ? gradeArcs(divisionBearings(trace, target, division, turn), here.placed, here.leadsOn)
      : null
  const verdicts =
    failedGrade && help
      ? here.placed.map((_, i) =>
          failedGrade.off.includes(i) ? ('off' as const) : ('kept' as const),
        )
      : undefined
  const sideMap = (
    <ArcMap
      rim={rim}
      levels={drawnLevels}
      drawing={
        stage === 'arcs'
          ? { placed: here.placed, leadsOn: here.leadsOn, count: optionCount, verdicts }
          : null
      }
      focus={stage === 'arcs' ? division : null}
      onPlace={stage === 'arcs' ? (sector) => dispatch({ type: 'place-arc', sector }) : undefined}
      star={finished && arcsAsked}
      label="Your map"
      rimSlot={
        stage === 'frame' && !done
          ? (position) => (
              <select
                value={plan.frame[position] ?? ''}
                onChange={(event) =>
                  dispatch({
                    type: 'label-rim',
                    rim: position,
                    word: (event.target.value || null) as Anatomical | null,
                  })
                }
                aria-label={`Direction at the ${RIM_LABELS[position].toLowerCase()} of the circle`}
                data-rim-picker={position}
              >
                <option value="">{RIM_LABELS[position]}…</option>
                {ANATOMICAL.map((word) => (
                  <option key={word} value={word}>
                    {ANATOMICAL_LABEL[word]}
                  </option>
                ))}
              </select>
            )
          : undefined
      }
    />
  )
  // The review: the learner's map, the model's, or the model's laid over the learner's.
  const [reviewShow, setReviewShow] = useState<'both' | 'mine' | 'model'>('both')
  const reviewLevels = useMemo(
    () =>
      reviewShow === 'model'
        ? modelLevels
        : reviewShow === 'mine'
          ? drawnLevels
          : withGhost(drawnLevels, modelLevels),
    [reviewShow, drawnLevels, modelLevels],
  )
  // While the airway is traced back from the lesion there is no map to show: the CT takes both
  // picture columns, and a reconstruction opens beside it on request.
  const mapShown = mapReady && frameAsked
  const ostium = stationCamera(trace, segmentStart)!
  const canReveal = section === 'learn' && frameAsked && (stage !== 'frame' || worked)

  // ── The task ───────────────────────────────────────────────────────────────────────────────
  const partNumber = spec.parts.indexOf(stage as PlanPart) + 1
  const kicker = (name: string) =>
    stage === 'review'
      ? 'Map · Review'
      : `${stage === 'frame' || stage === 'arcs' ? 'Map' : 'Plan'} · ${partNumber} of ${spec.parts.length} · ${name}`
  const show = (action: PlanAction) => () => dispatch(action)
  const mark = useCallback(
    (value: CtMark) => dispatch({ type: 'mark-lesion', mark: value }),
    [dispatch],
  )
  const choices = segmentChoices(target)
  const frameGrade = gradeFrame(frame, plan.frame)
  const bearings = divisionBearings(trace, target, division, turn)
  const arcGrade =
    stage === 'arcs' && here.placed.length === optionCount && here.leadsOn !== null
      ? gradeArcs(bearings, here.placed, here.leadsOn)
      : null
  const packet = stage === 'arcs' ? junctionFeedbackPacket(divisionCheckpoint.id) : null
  const lesionMissVerdict =
    stage === 'lesion' && plan.lesionMark && !plan.lesionMark.ok
      ? lesionVerdict(trace, { slice: plan.lesionMark.slice, pixel: plan.lesionMark.pixel })
      : null

  let now: NowCardModel
  if (done)
    now = {
      kicker: 'End of this trip',
      heading: closing.heading,
      // The summary can run past the bottom of the window; the way on stays in view.
      pinActions: true,
      primary: closing.next
        ? {
            label: closing.next.label,
            href: closing.next.href,
            onActivate: closing.next.onActivate,
          }
        : undefined,
    }
  else if (stage === 'lesion')
    now = {
      kicker: kicker(PLAN_PART_TITLES.lesion),
      heading: 'Find the airway that runs into the lesion',
      body: lesionInstruction(target),
      where: 'CT panel: scroll with the slider, then click the airway.',
      primary: worked
        ? { label: 'Show the airway', onActivate: show({ type: 'show-lesion' }) }
        : undefined,
      secondary: worked
        ? undefined
        : { label: 'Show me', onActivate: show({ type: 'show-lesion' }) },
    }
  else if (stage === 'segment')
    now = {
      kicker: kicker(PLAN_PART_TITLES.segment),
      heading: 'Which segmental bronchus does it come from?',
      body: segmentInstruction(),
      where:
        'CT panel: scroll with the slider or the wheel, drag to move the picture, click to pin where you have followed the airway to.',
      primary: worked
        ? { label: 'Show the segment', onActivate: show({ type: 'show-segment' }) }
        : undefined,
      secondary: worked
        ? undefined
        : { label: 'Show me', onActivate: show({ type: 'show-segment' }) },
    }
  else if (stage === 'views')
    now = {
      kicker: kicker(PLAN_PART_TITLES.views),
      heading: 'Set up the views that help you',
      body: viewsInstruction(target.segment.bronchusCode),
      where: 'Map panel: Coronal, Sagittal. CT panel: Rotate left, Rotate right, Flip.',
      primary: {
        label: 'On to the ostium',
        onActivate: show({ type: 'views-done' }),
        icon: <ArrowRight size={16} aria-hidden />,
      },
    }
  else if (stage === 'frame')
    now = {
      kicker: kicker(PLAN_PART_TITLES.frame),
      heading: `Label the ${target.segment.bronchusCode} ostium`,
      body: frameInstruction(target.segment.bronchusCode),
      where: 'Map panel: the four places on the circle.',
      primary: worked
        ? { label: 'Show the circle', onActivate: show({ type: 'show-frame' }) }
        : {
            label: 'Check the circle',
            onActivate: show({ type: 'check-frame' }),
            disabled: !frameGrade.complete,
            disabledReason: 'Put a direction at all four places first.',
          },
      secondary: worked
        ? { label: 'Check my own', onActivate: show({ type: 'check-frame' }) }
        : { label: 'Show me', onActivate: show({ type: 'show-frame' }) },
    }
  else if (stage === 'arcs')
    now = {
      kicker: kicker(`Division ${division + 1} of ${forks.length}`),
      heading: `Draw the branches of ${divisionCheckpoint.decision!.parent.airway.code}`,
      body: arcsInstruction(
        divisionCheckpoint.decision!.parent.airway.code,
        optionCount,
        division === 0,
      ),
      where:
        'CT panel: scroll from the fork until the branches separate. Map panel: click round the highlighted branch.',
      primary: worked
        ? { label: 'Show the branches', onActivate: show({ type: 'show-arcs' }) }
        : {
            label: 'Check the branches',
            onActivate: show({ type: 'check-arcs' }),
            disabled: here.placed.length !== optionCount || here.leadsOn === null,
            disabledReason:
              here.placed.length !== optionCount
                ? `Draw ${optionCount === 3 ? 'three' : 'two'} branches first.`
                : 'Mark the branch that goes on toward the lesion.',
          },
      secondary: worked
        ? { label: 'Check my own', onActivate: show({ type: 'check-arcs' }) }
        : { label: 'Show me', onActivate: show({ type: 'show-arcs' }) },
    }
  else
    now = {
      kicker: kicker(PLAN_PART_TITLES.review),
      ...(prefilled
        ? prefilledReview(target.segment.bronchusCode, plan.arcs.length)
        : {
            heading: 'Your map, with the model’s over it',
            body: reviewSentence(
              plan.arcs.length,
              plan.arcs.filter((a) => a.ok && !a.shown && a.misses === 0).length,
            ),
          }),
      primary: {
        label: drives ? 'Drive to the lesion' : 'Finish',
        onActivate: show({ type: 'finish' }),
        icon: <ArrowRight size={16} aria-hidden />,
      },
      secondary: prefilled
        ? { label: 'Draw it myself', onActivate: show({ type: 'draw-own' }) }
        : undefined,
    }

  const stageId = stage === 'frame' || stage === 'arcs' || stage === 'review' ? 'map' : 'plan'
  const stageState = (id: string) =>
    id === stageId ? 'now' : id === 'plan' && stageId === 'map' ? 'done' : 'todo'
  // Outside the lessons the views are not a step: they are offered where the circle is labelled.
  const viewsBesideCircle =
    section !== 'learn' && stage === 'frame' && !spec.parts.includes('views')
  const showIntro = Boolean(intro) && plan.stage === spec.parts[0]
  const partTeach = teach?.[stage as PlanPart]
  const hereTeach = stage === 'arcs' ? divisionTeach?.[division] : undefined

  return (
    <LessonShell
      section={section}
      stage={`plan:${stage}${stage === 'arcs' ? `:${division}` : ''}${done ? ':closed' : ''}`}
      label={title}
      module="bronchial-branch-tracing"
      header={
        <div className={styles.benchHeader}>
          <div className={styles.benchTitle}>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <ol className={styles.routeStrip} aria-label="The plan so far" data-route-strip>
            <li data-route-chip="lesion">
              Lesion · {segmentKnown ? target.segment.code : lobeOf(target)}
            </li>
            {(plan.segmentChoice === target.segment.bronchusCode ||
              !spec.parts.includes('segment')) &&
              stage !== 'lesion' &&
              stage !== 'segment' && <li data-route-chip="done">{target.segment.bronchusCode}</li>}
          </ol>
          <div className={styles.benchActions}>
            <button ref={helpButton} onClick={() => setHelpOpen(true)} data-bench-help>
              <CircleHelp size={15} aria-hidden /> What are we doing?
            </button>
            <button
              onClick={() => {
                setTrail([])
                onRestart()
              }}
              data-bench-restart
            >
              <RotateCcw size={15} aria-hidden /> Restart trip
            </button>
            {exit}
          </div>
        </div>
      }
    >
      <div
        ref={benchRef}
        className={styles.bench}
        style={{ height: benchMinHeight, minHeight: benchMinHeight }}
        data-bench
        data-plan-stage={stage}
        data-plan-wide={wide || undefined}
      >
        {/* The text column comes first, in the page and in the tab order: what to do, then the
            pictures it is done on. */}
        <div className={styles.now} style={{ gridArea: 'now' }}>
          <ol className={styles.loop} aria-label="Plan, map, navigate" data-loop-steps>
            {STAGE_STEPS.filter((step) => step.id !== 'navigate' || drives).map((step) => {
              const state = stageState(step.id)
              return (
                <li key={step.id} data-loop-step={step.id} data-loop-state={state}>
                  <strong>{step.label}</strong>
                  <span>{state === 'now' ? 'now' : step.what}</span>
                </li>
              )
            })}
          </ol>
          <NowCard model={now}>
            {/* How to work the step out sits in the card, beside the step: open when it comes,
                and folded away by whoever has read it. */}
            {!done && (showIntro || partTeach || hereTeach) && (
              <details
                className={styles.teachBox}
                // Open when the step comes. After a check that did not fit it folds, so what the
                // check found is in view under the card; it opens again with the next change.
                open={!(stage === 'arcs' && here.checked)}
                key={viewKey}
                data-teach-box
                // Where the card also holds choices or drawing controls, the text keeps to a few
                // lines and scrolls, so the controls stay in the window.
                data-teach-compact={stage === 'arcs' || stage === 'segment' || undefined}
              >
                <summary>How to work this out</summary>
                <div>
                  {showIntro && <p data-bench-intro>{intro}</p>}
                  {partTeach && <p data-plan-teach>{partTeach}</p>}
                  {hereTeach && <p data-division-teach>{hereTeach}</p>}
                </div>
              </details>
            )}
            {stage === 'segment' && !done && (
              <div className={styles.choices} role="group" aria-label="Segmental bronchi">
                {choices.map((choice) => (
                  <button
                    key={choice.code}
                    onClick={() => dispatch({ type: 'choose-segment', code: choice.code })}
                    data-segment-choice={choice.code}
                  >
                    <strong>{segmentLabel(choice)}</strong>
                  </button>
                ))}
              </div>
            )}
            {canPin && trail.length > 0 && (
              <p className={styles.mapTools} data-trail-tools>
                <span>
                  {trail.length === 1 ? '1 pin' : `${trail.length} pins`} on the CT, last on slice{' '}
                  {trail[trail.length - 1].slice}.
                </span>
                <button onClick={() => setSlice(trail[trail.length - 1].slice)} data-trail-go>
                  Go to it
                </button>
                <button onClick={() => setTrail([])} data-trail-clear>
                  Clear the pins
                </button>
              </p>
            )}
            {stage === 'views' && !done && (
              <p className={styles.mapTools}>
                <button onClick={() => openReconstruction('coronal')} data-open-view="coronal">
                  Open the coronal view
                </button>
                <button onClick={() => openReconstruction('sagittal')} data-open-view="sagittal">
                  Open the sagittal view
                </button>
              </p>
            )}
            {stage === 'arcs' && !done && (
              <>
                <div className={styles.sectorGrid} role="group" aria-label="Draw a branch toward">
                  {[7, 0, 1, 6, -1, 2, 5, 4, 3].map((sector) =>
                    sector < 0 ? (
                      <span key="centre">{divisionCheckpoint.decision!.parent.airway.code}</span>
                    ) : (
                      <button
                        key={sector}
                        disabled={
                          here.placed.includes(sector as never) || here.placed.length >= optionCount
                        }
                        onClick={() => dispatch({ type: 'place-arc', sector: sector as never })}
                        data-sector-button={sector}
                      >
                        {sectorPhrase(sector as never, rim)
                          .replace(/^on the /, '')
                          .replace(/ side$/, '')}
                      </button>
                    ),
                  )}
                </div>
                {here.placed.length > 0 && (
                  <ol className={styles.placedList} aria-label="Branches drawn">
                    {here.placed.map((sector, i) => (
                      <li key={sector} data-placed-branch={i + 1}>
                        <strong>{i + 1}</strong>
                        <span>{sectorPhrase(sector, rim)}</span>
                        <button
                          aria-pressed={here.leadsOn === i}
                          onClick={() => dispatch({ type: 'lead-on', index: i })}
                          data-leads-on={i + 1}
                        >
                          Toward the lesion
                        </button>
                        <button
                          onClick={() => dispatch({ type: 'remove-arc', index: i })}
                          data-remove-branch={i + 1}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
                <p className={styles.mapTools}>
                  <button onClick={() => setSlice(divisionSlice)} data-go-division>
                    Go to the division (slice {divisionSlice})
                  </button>
                  {!showLocators && !revealed && help && (
                    <button onClick={() => setRevealed(true)} data-reveal-locators>
                      Number the branches on the CT
                    </button>
                  )}
                </p>
              </>
            )}
            {done && (
              <div className={styles.closing} data-bench-closing>
                {closing.body.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            )}
          </NowCard>
          <div className={styles.feedback} aria-live="polite" data-bench-feedback>
            {stage === 'lesion' && lesionMissVerdict && (
              <Band tone="miss" {...lesionMiss(lesionMissVerdict, help)} />
            )}
            {stage === 'segment' && plan.lesionMark?.ok && !plan.segmentChoice && (
              <Band tone="in" {...lesionFound()} />
            )}
            {stage === 'segment' &&
              plan.segmentChoice &&
              plan.segmentChoice !== target.segment.bronchusCode && (
                <Band
                  tone="miss"
                  {...segmentMiss(choices.find((c) => c.code === plan.segmentChoice)!, help)}
                />
              )}
            {(stage === 'views' || (stage === 'frame' && !plan.frameChecked)) &&
              plan.segmentChoice === target.segment.bronchusCode && (
                <Band tone="in" {...segmentFound(target)} />
              )}
            {stage === 'frame' && plan.frameChecked && (
              <Band tone="miss" {...frameMiss(frameGrade, frame, plan.frame, help)} />
            )}
            {stage === 'arcs' &&
              division === 0 &&
              frameAsked &&
              plan.frameTurn !== null &&
              !here.checked && <Band tone="in" {...frameFound(plan.frameTurn)} />}
            {stage === 'arcs' && here.checked && arcGrade && (
              <Band tone="miss" {...arcsMiss(arcGrade, here.placed, bearings, rim, help)} />
            )}
            {stage === 'arcs' && division > 0 && !here.checked && plan.arcs[division - 1]?.ok && (
              <Band tone="in" {...arcsFound(false)} />
            )}
            {stage === 'review' && !prefilled && <Band tone="in" {...arcsFound(true)} />}
          </div>
        </div>

        <div className={styles.detail} style={{ gridArea: 'detail' }} data-bench-detail>
          {!done && (
            <>
              {viewsBesideCircle && (
                <div className={styles.note} data-views-note>
                  <p>{viewsInstruction(target.segment.bronchusCode)}</p>
                  <p className={styles.mapTools}>
                    <button onClick={() => openReconstruction('coronal')} data-open-view="coronal">
                      Open the coronal view
                    </button>
                    <button
                      onClick={() => openReconstruction('sagittal')}
                      data-open-view="sagittal"
                    >
                      Open the sagittal view
                    </button>
                  </p>
                </div>
              )}
              {stage === 'arcs' && packet && help && section !== 'assess' && here.checked && (
                <details data-fork-more>
                  <summary>More about this division on the CT</summary>
                  <p>{packetProse(packet.divergence)}</p>
                  <p>{packetProse(packet.continuity)}</p>
                </details>
              )}
            </>
          )}
          {notes}
        </div>

        {!wide && (
          <section className={styles.pane} style={{ gridArea: 'scope' }} aria-label="Map">
            <header className={styles.paneHead}>
              <h2>
                {tab === 'scope'
                  ? 'Bronchoscope'
                  : reconstruction
                    ? reconstruction === 'coronal'
                      ? 'Coronal'
                      : 'Sagittal'
                    : 'Map'}
              </h2>
              {segmentKnown && !reconstruction && <span>{target.segment.bronchusCode} ostium</span>}
              <div className={styles.sideTabs} role="group" aria-label="Side panel">
                <button
                  aria-pressed={tab === 'map'}
                  onClick={() => setTab('map')}
                  data-side-tab="map"
                >
                  {mapShown ? 'Map' : 'CT alone'}
                </button>
                <button
                  aria-pressed={tab === 'coronal'}
                  onClick={() => openReconstruction('coronal')}
                  data-side-tab="coronal"
                >
                  Coronal
                </button>
                <button
                  aria-pressed={tab === 'sagittal'}
                  onClick={() => openReconstruction('sagittal')}
                  data-side-tab="sagittal"
                >
                  Sagittal
                </button>
                {canReveal && (
                  <button
                    aria-pressed={tab === 'scope'}
                    onClick={() => setTab('scope')}
                    data-side-tab="scope"
                  >
                    Ostium view
                  </button>
                )}
              </div>
            </header>
            {reconstruction ? (
              <ReferenceCtView
                plane={reconstruction}
                index={refPlanes[reconstruction]}
                onIndexChange={(index) =>
                  setRefPlanes((all) => ({ ...all, [reconstruction]: index }))
                }
                axialSlice={current.slice}
                focus={followed}
                focusLabel={stage === 'frame' || stage === 'arcs' ? 'division' : 'lesion'}
                target={{ id: target.id }}
                onPick={(pick) =>
                  setView({
                    key: viewKey,
                    slice: pick.slice,
                    crop: { center: pick.pixel, size: current.crop.size },
                  })
                }
                wheelPlanes={wheelSlices}
              />
            ) : (
              <div className={styles.squareSlot}>
                {tab === 'scope' && canReveal ? (
                  <ScopeView
                    position={ostium.position}
                    direction={ostium.direction}
                    up={ostium.up}
                    openings={[]}
                    moving={false}
                    caption={`At the ${target.segment.bronchusCode} ostium, looking in.`}
                    phase="ostium"
                    falloffMm={falloffMmFor(routeRadiusMm(trace, ostium.arc))}
                    segmental={frame.side}
                  />
                ) : finished && arcsAsked && !prefilled ? (
                  // One map: the learner's, with the model's arcs laid over it.
                  <ArcMap
                    rim={rim}
                    levels={reviewLevels}
                    star
                    label={
                      reviewShow === 'model'
                        ? 'Model map'
                        : reviewShow === 'mine'
                          ? 'Your map'
                          : 'Your map with the model’s over it'
                    }
                  />
                ) : (
                  sideMap
                )}
              </div>
            )}
            {!reconstruction &&
              (tab !== 'scope' && finished && arcsAsked && !prefilled ? (
                <div className={`${styles.paneCaption} ${styles.reviewLegend}`} data-review-map>
                  <div className={styles.sideTabs} role="group" aria-label="Which map to show">
                    {(
                      [
                        ['both', 'Both'],
                        ['mine', 'Yours'],
                        ['model', 'The model’s'],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        aria-pressed={reviewShow === id}
                        onClick={() => setReviewShow(id)}
                        data-review-show={id}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {reviewShow === 'both' && (
                    <>
                      <span>
                        <i data-line="mine" aria-hidden /> yours
                      </span>
                      <span>
                        <i data-line="model" aria-hidden /> the model’s
                      </span>
                    </>
                  )}
                </div>
              ) : (
                <p className={styles.paneCaption} data-map-caption>
                  {tab === 'scope' && canReveal
                    ? 'The model scope at the ostium. Its rim words are the circle’s; your circle may be turned from it.'
                    : stage === 'arcs'
                      ? `Division ${division + 1}: the highlighted branch is where it takes place.`
                      : stage === 'frame'
                        ? 'The circle is the view into the ostium. Choose its four directions on it.'
                        : 'The circle is the view into the ostium; each division is drawn inside the branch before it.'}
                </p>
              ))}
          </section>
        )}

        <section className={styles.pane} style={{ gridArea: 'ct' }} aria-label="CT">
          <header className={styles.paneHead}>
            <h2>CT</h2>
            <span data-ct-display>
              {orientation.turns || orientation.reflected ? 'Turned by you' : 'Standard axial'}
            </span>
            {wide && (
              <div className={styles.sideTabs} role="group" aria-label="Open beside the CT">
                <button onClick={() => openReconstruction('coronal')} data-ct-beside="coronal">
                  Coronal beside
                </button>
                <button onClick={() => openReconstruction('sagittal')} data-ct-beside="sagittal">
                  Sagittal beside
                </button>
              </div>
            )}
          </header>
          <TracingCtViewer
            slice={current.slice}
            range={range}
            onSlice={setSlice}
            orientation={orientation}
            onTurn={(operation) => setOrientation((o) => turnCt(o, operation))}
            center={current.crop.center}
            size={current.crop.size}
            target={target}
            showNodule
            markSlice={stage === 'lesion' && !done ? current.slice : undefined}
            markLabel={stage === 'lesion' ? 'the airway into the lesion' : undefined}
            onMark={stage === 'lesion' && !done ? mark : undefined}
            marks={marks}
            locators={locators}
            tip={null}
            ticks={ticks}
            wheelSlices={wheelSlices}
            trail={trail}
            onTrail={canPin ? dropPin : undefined}
          />
        </section>
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

const RIM_LABELS: Record<Rim, string> = {
  top: 'Top',
  right: 'Right',
  bottom: 'Bottom',
  left: 'Left',
}
