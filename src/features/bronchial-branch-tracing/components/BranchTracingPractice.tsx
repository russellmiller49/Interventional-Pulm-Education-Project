'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { HelpDialog } from '@/features/learning-module/stage/HelpDialog'
import { draftSignature, readCtDraft, writeCtDraft, freshRouteView } from '../engine/ct-draft'
import { parsePracticeDraft, type PracticeDraft } from '../engine/practice-draft'
import { browserStorage } from '../engine/selfPacedProgress'
import { CtProgressiveMap } from './CtBranchMap'
import { CtRouteAttemptHistory } from './CtRouteAttemptHistory'
import type { CtViewerState } from '../content/ct-types'
import { CtRouteWorkspace } from './CtRouteWorkspace'
import { CourseOutline } from './CourseOutline'
import { SectionHeader } from '@/features/learning-module/stage/SectionHeader'
import { NowCard } from '@/features/learning-module/stage/NowCard'
import { BASE_PATH, LESSONS, SOURCE, VERSION } from '../content/lessons'
import { ASSESS_TRACES, PRACTICE_TRACES, SEGMENT_PRACTICE_TRACES } from '../content/practice'
import {
  type Course,
  type CtBranchChoice,
  type CtMark,
  type CtResponse,
  type TargetRelation,
} from '../content/ct-types'
import { traceById, targetForTrace } from '../geometry/native-ct'
import { STANDARD_ORIENTATION, sameOrientation, type CtOrientation } from '../geometry/orientation'
import { CtOrientationFeedback } from './CtOrientationTeaching'
import {
  emptyTraceWork,
  traceComplete,
  junctionReady,
  reachableThrough,
  referenceIndex,
  validCtMark,
  validBranch,
} from '../engine/ct-session'
import { ModuleFrame } from './ModuleFrame'
import { NativeCtViewer } from './NativeCtViewer'
import {
  CtAirwayGuide,
  CtBranchDecision,
  CtContinuationFeedback,
  CtCourseFeedback,
  CtJunctionTeaching,
  CtCourseControl,
  CtTraceList,
  CtTargetRelationControl,
  CtTargetFeedback,
} from './CtTraceControls'
import { approachReference } from '../engine/model-reference'
import { TargetCtPreview } from './TargetCtPreview'
import { courseMap, lessonHref, lessonNumber, moreRoutesSet } from '../content/course-guide'
import { count } from '../engine/display-text'
import styles from './branch-tracing.module.css'
import { resetPaneScroll } from './resetPaneScroll'

/** The route lesson whose worked example and transfer route the More routes set revisits. */
const ROUTE_LESSON = 'variants-limits'

const RealCtExplorer = dynamic(() => import('./RealCtExplorer').then((m) => m.RealCtExplorer), {
  ssr: false,
  loading: () => <p>Loading CT explorer…</p>,
})

/**
 * Practice and the former Assess address share one self-paced route host. `assess` keeps its
 * address and its four-route set; it no longer withholds references or labels work independent.
 */
export function BranchTracingPractice({ mode }: { mode: 'practice' | 'assess' }) {
  const [started, setStarted] = useState(false),
    [explorer, setExplorer] = useState(false)
  const [selection, setSelection] = useState(SEGMENT_PRACTICE_TRACES[2])
  const ids =
    mode === 'assess' ? ASSESS_TRACES : selection === 'mixed' ? PRACTICE_TRACES : [selection]
  useEffect(() => {
    try {
      const previous = browserStorage()?.getItem('branch-tracing.practice-selection')
      if (previous && (previous === 'mixed' || SEGMENT_PRACTICE_TRACES.includes(previous))) {
        // Restore the user's selection from browser storage after hydration.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelection(previous)
      }
    } catch {
      /* The draft save path explains unavailable storage. */
    }
  }, [])
  if (started)
    return (
      <ModuleFrame section={mode} activity>
        <CtPracticeSession mode={mode} ids={ids} onExit={() => setStarted(false)} />
      </ModuleFrame>
    )
  return (
    <ModuleFrame section={mode}>
      <main className={styles.overview} data-route-set-landing={mode}>
        <div className={styles.eyebrow}>
          BRANCH TRACING / {mode === 'practice' ? 'PRACTICE' : 'MORE ROUTES'}
          <span>Real CT · 0.5 mm</span>
        </div>
        <h1 className={styles.pageTitle}>
          {mode === 'practice'
            ? 'Trace to a nodule in a named segment'
            : 'Trace four more routes to simulated nodules'}
        </h1>
        <p className={styles.subtitle}>
          {mode === 'practice'
            ? 'Start with one route, or choose a mixed set.'
            : 'An optional revisit set in the same teaching CT, with the same reference and help as Practice.'}{' '}
          Show the reference at any junction, check what you marked, or continue without recording.
        </p>
        {mode === 'practice' ? (
          <p className={styles.small} data-route-set-role="practice">
            Suggested after the {courseMap().lessons} Learn lessons, and open now. Each target is a
            simulated nodule in one segment of this CT; the route runs from the trachea through
            every modeled division.
          </p>
        ) : (
          <section className={styles.notice} data-route-set-role="more-routes">
            <h2>What this set is</h2>
            <p>
              A mixed set of {courseMap().moreRoutes} routes in the same teaching CT. Some repeat
              targets you may already have traced, so treat it as a revisit, not a new patient case.
              This address once held a separate assessment; it now works like Practice, the
              reference stays available and nothing is assessed.
            </p>
            <ul>
              {moreRoutesSet().map((entry) => (
                <li key={entry.traceId} data-more-route={entry.target.segment.code}>
                  <strong>{entry.target.segment.code}</strong> · {entry.target.segment.name}
                  {entry.alsoIn.length ? ` · also ${entry.alsoIn.join(' and ')}` : ''}
                </li>
              ))}
            </ul>
            <p className={styles.small}>
              The Lesson {lessonNumber(ROUTE_LESSON)} routes are in{' '}
              <Link href={lessonHref(ROUTE_LESSON)}>
                {LESSONS.find((l) => l.id === ROUTE_LESSON)?.title}
              </Link>
              .
            </p>
          </section>
        )}
        <div className={styles.introGrid}>
          <section>
            <h2>Follow the airway toward the target</h2>
            <p>
              Inspect the target nodule, then start in the trachea. At each modeled fork, select a
              daughter and mark the continuing lumen, then check the junction to compare it. Start
              with standard axial CT and turn or reflect it yourself while comparing the paired
              virtual bronchoscopy.
            </p>
            <p>
              Record the patient-space course and whether the distal airway can be followed toward
              the nodule. You can compare every route with the reference whenever you like, with or
              without a recorded interpretation.
            </p>
            {mode === 'practice' && (
              <label className={styles.courseChoice}>
                <strong>Target segment</strong>
                <select
                  aria-label="Target segment"
                  value={selection}
                  onChange={(e) => setSelection(e.target.value)}
                >
                  <option value="mixed">Mixed set · four targets</option>
                  {SEGMENT_PRACTICE_TRACES.map((id) => {
                    const target = targetForTrace(traceById(id))
                    return (
                      <option key={id} value={id}>
                        {target.segment.code} · {target.segment.name}
                      </option>
                    )
                  })}
                </select>
              </label>
            )}
            <button
              className={styles.startButton}
              onClick={() => {
                try {
                  browserStorage()?.setItem('branch-tracing.practice-selection', selection)
                } catch {
                  /* Session displays the save failure. */
                }
                setStarted(true)
              }}
            >
              {mode === 'practice' ? 'Start CT practice' : 'Start the route set'}
            </button>
          </section>
          <TargetCtPreview traceId={ids[0]} />
        </div>
        <p className={styles.notice}>
          These authored nodule targets share one teaching CT. Source-derived comparisons support
          self-review; clinical case labels and camera checkpoints are awaiting faculty review.
          Nothing here is scored and there is no pass threshold.
        </p>
        {mode === 'practice' && (
          <section className={styles.source}>
            <h2>Explore the CT and airway freely</h2>
            <p>
              The original whole-volume preview and matched exterior/virtual airway viewer remain
              available for free exploration.
            </p>
            <button onClick={() => setExplorer((v) => !v)}>
              {explorer ? 'Close CT explorer' : 'Open CT and airway explorer'}
            </button>
            {explorer && <RealCtExplorer />}
          </section>
        )}
      </main>
    </ModuleFrame>
  )
}

function CtPracticeSession({
  mode,
  ids,
  onExit,
}: {
  mode: 'practice' | 'assess'
  ids: string[]
  onExit: () => void
}) {
  const router = useRouter()
  const setName = mode === 'practice' ? 'Practice' : 'More routes'
  const draftKey = `${mode}.${ids.join('.')}`
  const signature = useMemo(() => draftSignature([mode, ids.map(traceById)]), [mode, ids])
  const [loaded] = useState(() =>
    readCtDraft(browserStorage(), draftKey, signature, (v) => parsePracticeDraft(v, ids)),
  )
  const resume = loaded.value
  const [targetViewed, setTargetViewed] = useState<Record<string, boolean>>(
    resume?.targetViewed ?? {},
  )
  const [attempts, setAttempts] = useState<PracticeDraft['attempts']>(resume?.attempts ?? {})
  const [help, setHelp] = useState(false)
  const [exitWarning, setExitWarning] = useState(false)
  const helpRef = useRef<HTMLButtonElement>(null)
  const [views, setViews] = useState<Record<string, CtViewerState>>(resume?.views ?? {})
  const [index, setIndex] = useState(resume?.index ?? 0),
    [active, setActive] = useState(resume?.active ?? 0)
  const [furthest, setFurthest] = useState(resume?.furthest ?? 0)
  const [imageReady, setImageReady] = useState(false)
  const [levelRequest, setLevelRequest] = useState(0)
  const [marks, setMarks] = useState<(CtMark | null)[]>(
    () => resume?.work.marks ?? emptyTraceWork(traceById(ids[0])).marks,
  )
  const [branches, setBranches] = useState<(CtBranchChoice | null)[]>(
    () => resume?.work.branches ?? emptyTraceWork(traceById(ids[0])).branches,
  )
  const [junctions, setJunctions] = useState<boolean[]>(
    () => resume?.work.recorded ?? emptyTraceWork(traceById(ids[0])).recorded,
  )
  const [reached, setReached] = useState(resume?.work.reached ?? 0)
  const [drafts, setDrafts] = useState<PracticeDraft['drafts']>(resume?.drafts ?? {})
  const [course, setCourse] = useState<Course | ''>(resume?.work.course ?? '')
  const [targetRelation, setTargetRelation] = useState<TargetRelation | ''>(
    resume?.work.targetRelation ?? '',
  )
  const [hints, setHints] = useState(resume?.work.hints ?? 0)
  const [orientation, setOrientation] = useState<CtOrientation>(
    resume?.work.orientation ?? STANDARD_ORIENTATION,
  )
  const [alignment, setAlignment] = useState<CtResponse['orientation'] | null>(
    resume?.work.alignment ?? null,
  )
  const [firstOrientations, setFirstOrientations] = useState<(CtOrientation | null)[]>(
    resume?.firstOrientations ?? ids.map(() => null),
  )
  const [responses, setResponses] = useState<(CtResponse | null)[]>(
    resume?.responses ?? ids.map(() => null),
  )
  const [submitted, setSubmitted] = useState(resume?.submitted ?? false),
    [saveFailed, setSaveFailed] = useState(false)
  // Junction references the learner chose to show, per trace. Transient; records nothing.
  const [shownRefs, setShownRefs] = useState<Record<string, number[]>>({})
  const trace = traceById(ids[index])
  const onViewChange = useCallback(
    (view: CtViewerState) =>
      setViews((current) =>
        JSON.stringify(current[trace.id]) === JSON.stringify(view)
          ? current
          : { ...current, [trace.id]: view },
      ),
    [trace.id],
  )
  const snapshot = useMemo(
    () => ({
      targetViewed,
      index,
      active,
      furthest,
      attempts,
      work: {
        marks,
        branches,
        recorded: junctions,
        course,
        targetRelation,
        hints,
        orientation,
        alignment,
        reached,
      },
      drafts: drafts,
      responses,
      firstOrientations,
      submitted,
      views,
    }),
    [
      targetViewed,
      index,
      active,
      furthest,
      attempts,
      drafts,
      marks,
      branches,
      junctions,
      course,
      targetRelation,
      hints,
      orientation,
      alignment,
      reached,
      responses,
      firstOrientations,
      submitted,
      views,
    ],
  )
  useEffect(() => {
    // Report whether synchronization with browser storage succeeded.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaveFailed(!writeCtDraft(browserStorage(), draftKey, signature, snapshot))
  }, [draftKey, signature, snapshot])
  const target = targetForTrace(trace)
  const routeDone = traceComplete(trace, { marks, branches, recorded: junctions })
  const stationDone = Boolean(junctions[active])
  const shown = new Set(shownRefs[trace.id] ?? [])
  const referenceShown = shown.has(active)
  const taskTop = useRef<HTMLDivElement>(null)
  const teachingTop = useRef<HTMLDivElement>(null)
  useEffect(() => {
    resetPaneScroll(taskTop.current)
    resetPaneScroll(teachingTop.current)
  }, [active, index, alignment, stationDone])
  const stationTask = Boolean(alignment) && !routeDone
  const maxActive = alignment ? reachableThrough(junctions, reached) : 0
  const ready =
    Boolean(alignment) &&
    routeDone &&
    Boolean(course) &&
    Boolean(targetRelation) &&
    Boolean(targetViewed[trace.id])
  function selectActive(i: number) {
    if (i < 0 || i > maxActive) return
    setActive(i)
    setLevelRequest((v) => v + 1)
  }
  function skipJunction() {
    if (!alignment || stationDone || active >= trace.checkpoints.length - 1) return
    setReached((current) => Math.max(current, active + 1))
    setActive(active + 1)
    setLevelRequest((v) => v + 1)
  }
  function toggleReference() {
    setShownRefs((current) => {
      const list = current[trace.id] ?? []
      return {
        ...current,
        [trace.id]: list.includes(active) ? list.filter((i) => i !== active) : [...list, active],
      }
    })
  }
  const recordedCount = responses.filter(Boolean).length
  const recordedResponse = responses[index]
  const lastTrace = index === ids.length - 1
  const dirty =
    !recordedResponse ||
    !alignment ||
    !sameOrientation(recordedResponse.orientation.first, alignment.first) ||
    !sameOrientation(recordedResponse.orientation.used, orientation) ||
    JSON.stringify(recordedResponse.marks.map((m) => [m.slice, m.pixel])) !==
      JSON.stringify(marks.map((m) => m && [m.slice, m.pixel])) ||
    JSON.stringify(recordedResponse.branches) !== JSON.stringify(branches) ||
    recordedResponse.course !== course ||
    recordedResponse.targetRelation !== targetRelation
  const upToDate = Boolean(recordedResponse) && !dirty

  function restore(i: number, response: CtResponse | null) {
    const draft = drafts[ids[i]],
      empty = emptyTraceWork(traceById(ids[i]))
    setIndex(i)
    setFurthest((current) => Math.max(current, i))
    setActive(0)
    setMarks(response?.marks ?? draft?.marks ?? empty.marks)
    setBranches(response?.branches ?? draft?.branches ?? empty.branches)
    setJunctions(response ? response.marks.map(() => true) : (draft?.recorded ?? empty.recorded))
    setReached(draft?.reached ?? 0)
    setCourse(response?.course ?? draft?.course ?? '')
    setTargetRelation(response?.targetRelation ?? draft?.targetRelation ?? '')
    setHints(draft?.hints ?? 0)
    setOrientation(response?.orientation.used ?? draft?.orientation ?? STANDARD_ORIENTATION)
    setAlignment(response?.orientation ?? draft?.alignment ?? null)
  }
  function open(i: number) {
    if (i === index) return
    setDrafts((current) => ({
      ...current,
      [trace.id]: {
        marks,
        branches,
        recorded: junctions,
        course,
        targetRelation,
        hints,
        orientation,
        alignment,
        reached,
      },
    }))
    restore(i, responses[i])
  }
  function record() {
    if (!ready || !alignment) return
    // The learner's own interpretation for comparison; no hint use or score is stored.
    const response: CtResponse = {
      orientation: { first: alignment.first, used: { ...orientation } },
      marks: marks as CtMark[],
      branches: [...branches],
      course: course as Course,
      targetRelation: targetRelation as TargetRelation,
    }
    const next = responses.map((r, i) => (i === index ? response : r))
    setResponses(next)
    if (index < ids.length - 1) restore(index + 1, next[index + 1])
  }

  function exportWorksheet() {
    const content = {
      module: 'bronchial-branch-tracing',
      version: VERSION,
      mode,
      sourceCaseCount: 1,
      activity: 'Self-paced CT route planning toward simulated nodules; not scored',
      nomenclatureVersion: 'nomenclature-v1',
      branchRouteVersion: 'branch-tracing-decisions/v1',
      junctionAttempts: attempts,
      traces: ids.map((id, i) => ({
        id,
        target: {
          id: targetForTrace(traceById(id)).id,
          segment: targetForTrace(traceById(id)).segment,
          simulated: true,
        },
        airwayPath: traceById(id).airwayPath,
        checkpoints: traceById(id).checkpoints.map(({ id, airway, landmark, decision }) => ({
          id,
          airway,
          landmark,
          parent: decision?.parent.airway,
          options: decision?.options.map(({ sourceEdgeId, label, direction }) => ({
            sourceEdgeId,
            label,
            direction,
          })),
        })),
        interpretation: responses[i],
      })),
    }
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' }),
    )
    const a = document.createElement('a')
    a.href = url
    a.download = 'bronchial-ct-interpretation.json'
    a.click()
    URL.revokeObjectURL(url)
  }
  // Work in progress for a route: the live state for the open route, the saved per-route draft
  // for the others. Nothing here is promoted into a recorded interpretation.
  const workFor = (i: number) =>
    i === index
      ? {
          marks,
          branches,
          recorded: junctions,
          course,
          targetRelation,
          reached,
        }
      : drafts[ids[i]]
  const partialCount = ids.filter(
    (_, i) =>
      !responses[i] && (workFor(i)?.recorded.some(Boolean) || workFor(i)?.marks.some(Boolean)),
  ).length
  if (submitted)
    return (
      <div className={styles.debrief} data-route-comparison>
        <h1>Compare your routes with the reference</h1>
        <p>
          {recordedCount} of {ids.length} {ids.length === 1 ? 'route has' : 'routes have'} a
          recorded interpretation
          {partialCount > 0
            ? `, and ${partialCount} ${partialCount === 1 ? 'has' : 'have'} junction work that is not part of one yet`
            : ''}
          . Compare each marked lumen with the source-derived path, then inspect the distal
          airway–nodule relationship. Your partial work is shown as you left it; a route with
          neither shows the reference only.
        </p>
        <p className={styles.small}>
          ○ Your trace · ＋ Source-derived comparison. These are interpretations within one CT;
          nothing is scored.
        </p>
        {saveFailed && (
          <p role="status">
            Browser storage is unavailable. The current worksheet remains available for local
            export.
          </p>
        )}
        <div className={styles.tabs}>
          <button onClick={exportWorksheet}>Export your CT worksheet</button>
          <button onClick={() => setSubmitted(false)}>Review and retry these junctions</button>
          <button onClick={onExit}>Return to {setName}</button>
        </div>
        {ids.map((id, i) => {
          const response = responses[i]
          const trace = traceById(id)
          const work = response ? undefined : workFor(i)
          const stops = trace.checkpoints.length
          const recordedStops = work?.recorded.filter(Boolean).length ?? 0
          const placed = work?.marks.filter(Boolean).length ?? 0
          const partial = Boolean(work && (recordedStops > 0 || placed > 0))
          return (
            <section
              key={id}
              className={styles.ctDebriefRow}
              data-route-state={response ? 'recorded' : partial ? 'partial' : 'none'}
            >
              <div>
                <h2>
                  Target {i + 1} · {targetForTrace(trace).segment.code}
                  {partial && (
                    <>
                      {' '}
                      <span className={styles.partialTag} data-route-partial>
                        Partial
                      </span>
                    </>
                  )}
                </h2>
                {response ? (
                  <>
                    <CtCourseFeedback value={response.course} trace={trace} />
                    <CtOrientationFeedback trace={trace} {...response.orientation} />
                    <CtTargetFeedback
                      value={response.targetRelation}
                      reference={approachReference(trace, targetForTrace(trace))}
                    />
                    <p>
                      {count(response.marks.filter((m) => m.pixel === null).length, 'checkpoint')}{' '}
                      marked unresolved.
                    </p>
                    <p>
                      Start with the parent lumen and examine continuity toward each mark. A
                      difference from the centerline is a reason to inspect the image, not an
                      automatic wrong answer.
                    </p>
                  </>
                ) : partial ? (
                  <>
                    <p data-partial-counts>
                      {recordedStops} of {stops} {stops === 1 ? 'stop' : 'stops'} recorded on this
                      route; final route interpretation not recorded.{' '}
                      {placed > recordedStops
                        ? `${placed - recordedStops} further ${placed - recordedStops === 1 ? 'lumen response is' : 'lumen responses are'} placed but not yet checked. `
                        : ''}
                      Your marks are shown below exactly as you left them.
                    </p>
                    <p>
                      Nothing has been finalized or filled in for you: the course and airway–nodule
                      description are part of the route interpretation and were not recorded, so
                      they are not shown. Return to the route to continue where you stopped.
                    </p>
                  </>
                ) : (
                  <p>
                    No junction work and no interpretation recorded for this route. The reference
                    trace is shown for study; nothing is marked as yours.
                  </p>
                )}
              </div>
              <DebriefViewer
                id={id}
                response={response}
                partialMarks={partial ? work!.marks : undefined}
                partialBranches={partial ? work!.branches : undefined}
                partialRecorded={partial ? work!.recorded : undefined}
              />
            </section>
          )
        })}
      </div>
    )
  return (
    <CtRouteWorkspace
      section={mode}
      stageId={`ct-${index}`}
      label="CT route tracing"
      header={
        <SectionHeader
          kicker={mode === 'practice' ? 'Practice · Real CT' : 'More routes · Real CT'}
          title={`Trace ${index + 1} of ${ids.length}`}
          sectionsControl={<CourseOutline />}
          meta={[`Target: ${target.segment.code}`, 'Reference available at every junction']}
          onRestart={() => {
            if (writeCtDraft(browserStorage(), draftKey, signature, snapshot)) onExit()
            else setExitWarning(true)
          }}
          restartLabel="Return to route selection"
          helpRef={helpRef}
          onHelp={() => setHelp(true)}
          onSaveAndExit={() => {
            if (writeCtDraft(browserStorage(), draftKey, signature, snapshot))
              router.push(BASE_PATH)
            else setExitWarning(true)
          }}
          resumedNote={
            saveFailed
              ? 'Browser storage is unavailable. Work continues, but your draft cannot be saved.'
              : loaded.notice || undefined
          }
        />
      }
      contextStrip={
        <div className={styles.context}>
          <span>{target.segment.name} · choose the CT orientation</span>
          <span>Native 0.5 mm axial slices</span>
          <span>One source CT · not scored</span>
        </div>
      }
      task={
        <div ref={taskTop}>
          <NowCard
            model={{
              kicker: `Route ${index + 1}`,
              heading: !alignment
                ? 'Choose the CT orientation'
                : stationTask
                  ? trace.checkpoints[active].decision
                    ? `Junction ${active + 1} of ${trace.checkpoints.length - 1}`
                    : 'Distal nodule approach'
                  : 'Describe the completed route',
              body: alignment
                ? `Plan an airway approach to the nodule in ${target.segment.code}. Select and mark each daughter branch, check the junction to compare it, then record the distal airway–nodule relationship. You can show the reference or continue without recording at any point.`
                : 'Standard axial is a valid tracing display. Patient directions remain attached to the image if you choose to rotate or reflect it. Record the display you choose.',
              primary: {
                label: !alignment
                  ? 'Use this orientation'
                  : stationTask
                    ? stationDone
                      ? active + 1 === trace.checkpoints.length - 1
                        ? 'Inspect the distal airway–nodule relationship'
                        : 'Continue to the next division'
                      : trace.checkpoints[active].decision
                        ? 'Check this junction'
                        : 'Record nodule approach'
                    : upToDate
                      ? lastTrace
                        ? 'Compare all routes'
                        : 'Next route'
                      : 'Record CT interpretation',
                onActivate: () => {
                  if (!alignment) {
                    const first = firstOrientations[index] ?? { ...orientation }
                    setFirstOrientations((current) =>
                      current.map((v, i) => (i === index ? first : v)),
                    )
                    setAlignment({ first, used: { ...orientation } })
                    setLevelRequest((v) => v + 1)
                  } else if (stationTask) {
                    if (stationDone) selectActive(active + 1)
                    else if (junctionReady(trace, active, marks, branches)) {
                      const key = `${trace.id}.${trace.checkpoints[active].id}`
                      // The learner's own response at this fork, kept for review and retry only.
                      setAttempts((current) => ({
                        ...current,
                        [key]: [
                          ...(current[key] ?? []),
                          {
                            mark: marks[active]!,
                            branch: branches[active],
                            orientation: { ...orientation },
                          },
                        ],
                      }))
                      setJunctions((values) => values.map((v, i) => (i === active ? true : v)))
                    }
                  } else if (upToDate) {
                    if (lastTrace) setSubmitted(true)
                    else open(index + 1)
                  } else record()
                },
                disabled:
                  !imageReady ||
                  (!alignment
                    ? false
                    : stationTask
                      ? !stationDone && !junctionReady(trace, active, marks, branches)
                      : !upToDate && !ready),
                disabledReason: !imageReady
                  ? 'Wait for the CT image to load.'
                  : !routeDone
                    ? 'To check, select a daughter (or uncertainty) and mark its lumen (or unresolved lumen). You can also continue without recording.'
                    : !targetViewed[trace.id]
                      ? 'To record the distal interpretation, use Show target to inspect the nodule and its adjacent CT. You can also move on without recording.'
                      : 'To record, describe the course and airway–nodule relationship. You can also move on without recording.',
              },
              secondary:
                stationTask && !stationDone && active < trace.checkpoints.length - 1
                  ? { label: 'Continue without recording', onActivate: skipJunction }
                  : !upToDate
                    ? {
                        label: lastTrace ? 'Compare all routes' : 'Next route without recording',
                        onActivate: () => (lastTrace ? setSubmitted(true) : open(index + 1)),
                      }
                    : undefined,
            }}
          />
          <div className={styles.routeResponses}>
            {alignment && (
              <>
                {stationTask && (
                  <CtBranchDecision
                    trace={trace}
                    active={active}
                    choice={branches[active]}
                    recorded={stationDone}
                    reveal={stationDone || referenceShown}
                    onChange={
                      !stationDone
                        ? (value) => {
                            if (validBranch(trace, active, value))
                              setBranches((values) =>
                                values.map((v, i) => (i === active ? value : v)),
                              )
                          }
                        : undefined
                    }
                  />
                )}
                {stationTask && !stationDone && (
                  <button aria-pressed={referenceShown} onClick={toggleReference}>
                    Show reference for this junction
                  </button>
                )}
                <p role="status">
                  {stationDone
                    ? 'Junction recorded. Compare the model reference with the CT before continuing.'
                    : referenceShown
                      ? 'Reference shown. Choosing a branch and placing a mark are still yours to do, or continue without recording.'
                      : marks[active]
                        ? 'Lumen response placed. Check this junction to compare.'
                        : 'Lumen mark needed in the CT tracing stack to check this junction.'}
                </p>
                {stationDone && (
                  <button
                    onClick={() => {
                      setMarks((values) => values.map((v, i) => (i === active ? null : v)))
                      setBranches((values) => values.map((v, i) => (i === active ? null : v)))
                      setJunctions((values) => values.map((v, i) => (i === active ? false : v)))
                      setResponses((values) => values.map((v, i) => (i === index ? null : v)))
                    }}
                  >
                    Retry this junction
                  </button>
                )}
                <button onClick={() => setAlignment(null)}>Revise orientation</button>
                <CtRouteAttemptHistory
                  key={`${trace.id}.${active}`}
                  trace={trace}
                  active={active}
                  attempts={attempts[`${trace.id}.${trace.checkpoints[active].id}`] ?? []}
                />
                {routeDone && (
                  <>
                    <CtCourseControl
                      from={trace.focusAirway?.code}
                      value={course}
                      onChange={setCourse}
                    />
                    <CtTargetRelationControl value={targetRelation} onChange={setTargetRelation} />
                  </>
                )}
              </>
            )}
            <div className={styles.hints}>
              <button disabled={hints > 0} onClick={() => setHints(1)}>
                Tracing reminder
              </button>
              {hints > 0 && (
                <p>
                  Follow the walls from Start through neighboring planes. The next airway checkpoint
                  may lie cranially or caudally.
                </p>
              )}
            </div>
            <div className={styles.checkpoints}>
              {ids.map((id, i) => (
                <button
                  key={id}
                  aria-current={i === index ? 'step' : undefined}
                  onClick={() => open(i)}
                >
                  Trace {i + 1}
                  {responses[i] ? ' · recorded' : ''}
                </button>
              ))}
              <button onClick={() => setSubmitted(true)}>
                Compare all routes with the reference
              </button>
            </div>
          </div>

          <CtTraceList
            trace={trace}
            marks={marks}
            recorded={junctions}
            active={active}
            maxActive={maxActive}
            onActive={selectActive}
          />
        </div>
      }
      map={
        <CtProgressiveMap
          trace={trace}
          recorded={junctions}
          active={active}
          onReview={selectActive}
          reveal
          branches={branches}
        />
      }
      teaching={
        <div ref={teachingTop} className={styles.teaching}>
          {alignment && <CtJunctionTeaching trace={trace} active={active} />}
          <h2>Trace with a reference at each junction</h2>
          <p>
            Use <strong>Show target</strong> to inspect the simulated nodule in the{' '}
            <strong>
              {target.segment.name.toLowerCase()} ({target.segment.code})
            </strong>
            .
          </p>
          <p>
            Use Start to find the trachea, then follow the air column through every fork. At each
            junction, select the branch you would follow and mark its lumen on Current junction CT.
            Check the junction to compare it, or show the reference first.
          </p>
          <p>
            After the distal checkpoint, inspect adjacent slices toward the nodule. Record what the
            visible air column supports. Proximity alone does not establish a continuous airway
            approach.
          </p>
          <p>
            Use Rotate 90° left, Rotate 90° right or Flip left–right. Return to standard axial lets
            you start again. These controls change the display; your marks remain attached to the
            same anatomy. The virtual camera follows the model reference route, even after a
            different branch choice. An axial slice and an endoscopic view have different
            projections; compare their branch relationships.
          </p>
          <h2>Record uncertainty honestly</h2>
          <p>
            If the source image does not resolve the connection, use “Lumen unresolved here.” A
            centerline or nearby vessel would not establish continuity by itself.
          </p>
          <p className={styles.small}>
            Each junction is presented on the source route, even if your preceding choice differs.
            Your recorded choices remain unchanged. Showing a reference never places or moves a
            mark.
          </p>
          <CtAirwayGuide trace={trace} active={active} pending />
        </div>
      }
      simulator={
        <NativeCtViewer
          key={trace.id}
          trace={trace}
          initialView={views[trace.id] ?? freshRouteView(trace)}
          onViewChange={onViewChange}
          onReadyChange={setImageReady}
          onTargetReady={() =>
            setTargetViewed((current) =>
              current[trace.id] ? current : { ...current, [trace.id]: true },
            )
          }
          scopeAvailable={stationDone || referenceShown}
          referenceThrough={referenceIndex(junctions, shown)}
          marks={marks}
          active={active}
          levelRequest={levelRequest}
          onActive={selectActive}
          maxActive={maxActive}
          orientation={orientation}
          onOrientation={setOrientation}
          orientationPending={!alignment}
          onMark={
            alignment && !stationDone
              ? (mark) => {
                  if (active <= maxActive && validCtMark(mark, trace, active))
                    setMarks((current) => current.map((m, i) => (i === active ? mark : m)))
                }
              : undefined
          }
          showAnchor
        />
      }
      overlay={
        <>
          <HelpDialog open={help} onClose={() => setHelp(false)} returnFocusTo={helpRef}>
            <p>
              {!alignment
                ? 'Choose the display orientation, then record it.'
                : !routeDone
                  ? 'Select the branch you would follow and mark its lumen. Browse freely; Go to response slice restores the marking frame.'
                  : 'Describe the airway course and distal relationship, then record the interpretation.'}
            </p>
            <p>
              Each checked junction shows a model comparison. Show reference for this junction
              displays it without recording anything, and Continue without recording moves on.
              Nothing is scored. Help preserves your answers.
            </p>
          </HelpDialog>
          <HelpDialog
            open={exitWarning}
            onClose={() => setExitWarning(false)}
            title="This draft could not be saved"
          >
            <p>Leaving will lose changes since the last successful save.</p>
            <button onClick={() => router.push(BASE_PATH)}>Leave without saving</button>
          </HelpDialog>
        </>
      }
      footer={
        <div className={styles.footer}>
          <a href={SOURCE.url} target="_blank" rel="noreferrer">
            {SOURCE.title}
          </a>
          <span>CT/source comparison · self-paced, not scored</span>
        </div>
      }
    />
  )
}
function DebriefViewer({
  id,
  response,
  partialMarks,
  partialBranches,
  partialRecorded,
}: {
  id: string
  response: CtResponse | null
  /** Junction work that is not part of a recorded interpretation, shown as the learner left it. */
  partialMarks?: (CtMark | null)[]
  partialBranches?: (CtBranchChoice | null)[]
  partialRecorded?: boolean[]
}) {
  const trace = traceById(id)
  const [active, setActive] = useState(0)
  const [orientation, setOrientation] = useState(response?.orientation.used ?? STANDARD_ORIENTATION)
  const marks = response?.marks ?? partialMarks ?? trace.checkpoints.map(() => null)
  const branches = response?.branches ?? partialBranches ?? trace.checkpoints.map(() => null)
  const recordedHere = Boolean(response) || Boolean(partialRecorded?.[active])
  return (
    <>
      <NativeCtViewer
        trace={trace}
        marks={marks}
        active={active}
        onActive={setActive}
        orientation={orientation}
        onOrientation={setOrientation}
        revealed
      />
      {!response && partialRecorded && (
        <p className={styles.small} data-partial-station={active}>
          {partialRecorded[active]
            ? 'You recorded this junction. It is not part of a recorded route interpretation.'
            : marks[active]
              ? 'A lumen response is placed here but this junction was not checked.'
              : 'Nothing was recorded at this junction. The ＋ reference below is the model route, not your work.'}
        </p>
      )}
      <CtBranchDecision
        trace={trace}
        active={active}
        choice={branches[active] ?? null}
        recorded={recordedHere}
        reveal
      />
      {trace.checkpoints[active].decision && (
        <CtContinuationFeedback
          checkpoint={trace.checkpoints[active]}
          choice={recordedHere ? (branches[active] ?? null) : null}
        />
      )}
    </>
  )
}
