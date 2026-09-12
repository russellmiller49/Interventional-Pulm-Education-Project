'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { StageLayout } from '@/features/learning-module/stage/StageLayout'
import { SectionHeader } from '@/features/learning-module/stage/SectionHeader'
import { NowCard } from '@/features/learning-module/stage/NowCard'
import { LookInLine } from '@/features/learning-module/stage/LookInLine'
import { BASE_PATH, SOURCE, VERSION } from '../content/lessons'
import { ASSESS_TRACES, PRACTICE_TRACES, SEGMENT_PRACTICE_TRACES } from '../content/practice'
import {
  COURSE_OPTIONS,
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
  lastUnlocked,
  validCtMark,
  validBranch,
} from '../engine/ct-session'
import { saveCtAttempt } from '../engine/progress'
import { ModuleFrame } from './ModuleFrame'
import { NativeCtViewer } from './NativeCtViewer'
import {
  CtAirwayGuide,
  CtBranchDecision,
  CtJunctionTeaching,
  CtCourseControl,
  CtTraceList,
  CtTargetRelationControl,
  CtTargetFeedback,
} from './CtTraceControls'
import { TargetCtPreview } from './TargetCtPreview'
import styles from './branch-tracing.module.css'
import { resetPaneScroll } from './resetPaneScroll'

const RealCtExplorer = dynamic(() => import('./RealCtExplorer').then((m) => m.RealCtExplorer), {
  ssr: false,
  loading: () => <p>Loading CT explorer…</p>,
})
export function BranchTracingPractice({ mode }: { mode: 'practice' | 'assess' }) {
  const [started, setStarted] = useState(false),
    [explorer, setExplorer] = useState(false)
  const [selection, setSelection] = useState('mixed')
  const ids =
    mode === 'assess' ? ASSESS_TRACES : selection === 'mixed' ? PRACTICE_TRACES : [selection]
  if (started)
    return (
      <ModuleFrame section={mode} activity>
        <CtPracticeSession mode={mode} ids={ids} onExit={() => setStarted(false)} />
      </ModuleFrame>
    )
  return (
    <ModuleFrame section={mode}>
      <main className={styles.overview}>
        <div className={styles.eyebrow}>
          BRANCH TRACING / {mode === 'practice' ? 'PRACTICE' : 'ASSESS'}
          <span>Real CT · 0.5 mm</span>
        </div>
        <h1 className={styles.pageTitle}>
          {mode === 'practice'
            ? 'Trace to a nodule in a named segment'
            : 'Record an independent CT interpretation'}
        </h1>
        <p className={styles.subtitle}>
          {mode === 'practice'
            ? 'Choose a segment or practice a mixed set of four targets.'
            : 'Plan four airway approaches to simulated nodules.'}{' '}
          Your marks first; source trace after submission.
        </p>
        <div className={styles.introGrid}>
          <section>
            <h2>Follow the airway toward the target</h2>
            <p>
              Inspect the target nodule, then start in the trachea. Work through every modeled fork
              in order, selecting a daughter and marking the continuing lumen before opening the
              next junction. Start with standard axial CT and turn or reflect it yourself while
              comparing the paired virtual bronchoscopy.
            </p>
            <p>
              Record the patient-space course and whether the distal airway can be followed toward
              the nodule. You may revisit your interpretations before submitting the set.
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
            <button className={styles.startButton} onClick={() => setStarted(true)}>
              {mode === 'practice' ? 'Start CT practice' : 'Start CT interpretation'}
            </button>
          </section>
          <TargetCtPreview traceId={ids[0]} />
        </div>
        <p className={styles.notice}>
          These authored nodule targets share one teaching CT. Source-derived comparisons support
          self-review; clinical case labels and camera checkpoints are awaiting faculty review. No
          automated clinical grade or pass threshold is assigned.
        </p>
        {mode === 'practice' && (
          <section className={styles.source}>
            <h2>Explore the CT and airway freely</h2>
            <p>
              The original whole-volume preview and matched exterior/virtual airway viewer remain
              available for ungraded exploration.
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
  const [index, setIndex] = useState(0),
    [active, setActive] = useState(0)
  const [furthest, setFurthest] = useState(0)
  const [levelRequest, setLevelRequest] = useState(0)
  const [marks, setMarks] = useState<(CtMark | null)[]>(
    () => emptyTraceWork(traceById(ids[0])).marks,
  )
  const [branches, setBranches] = useState<(CtBranchChoice | null)[]>(
    () => emptyTraceWork(traceById(ids[0])).branches,
  )
  const [junctions, setJunctions] = useState<boolean[]>(
    () => emptyTraceWork(traceById(ids[0])).recorded,
  )
  const drafts = useRef<
    Record<
      string,
      {
        marks: (CtMark | null)[]
        branches: (CtBranchChoice | null)[]
        recorded: boolean[]
        course: Course | ''
        targetRelation: TargetRelation | ''
        hints: number
        orientation: CtOrientation
        alignment: CtResponse['orientation'] | null
      }
    >
  >({})
  const [course, setCourse] = useState<Course | ''>('')
  const [targetRelation, setTargetRelation] = useState<TargetRelation | ''>('')
  const [hints, setHints] = useState(0)
  const [orientation, setOrientation] = useState<CtOrientation>(STANDARD_ORIENTATION)
  const [alignment, setAlignment] = useState<CtResponse['orientation'] | null>(null)
  const [firstOrientations, setFirstOrientations] = useState<(CtOrientation | null)[]>(
    ids.map(() => null),
  )
  const [responses, setResponses] = useState<(CtResponse | null)[]>(ids.map(() => null))
  const [submitted, setSubmitted] = useState(false),
    [saveFailed, setSaveFailed] = useState(false)
  const trace = traceById(ids[index])
  const target = targetForTrace(trace)
  const routeDone = traceComplete(trace, { marks, branches, recorded: junctions })
  const stationDone = Boolean(junctions[active])
  const taskTop = useRef<HTMLDivElement>(null)
  const teachingTop = useRef<HTMLDivElement>(null)
  useEffect(() => {
    resetPaneScroll(taskTop.current)
    resetPaneScroll(teachingTop.current)
  }, [active, index, alignment, stationDone])
  const stationTask = Boolean(alignment) && !routeDone
  const maxActive = alignment ? lastUnlocked(junctions) : 0
  const ready = Boolean(alignment) && routeDone && Boolean(course) && Boolean(targetRelation)
  function selectActive(i: number) {
    if (i < 0 || i > maxActive) return
    setActive(i)
    setLevelRequest((v) => v + 1)
  }
  const recorded = responses.every(Boolean)
  const dirty =
    JSON.stringify(responses[index]) !==
    JSON.stringify({ orientation: alignment, marks, branches, course, hints, targetRelation })
  function restore(i: number, response: CtResponse | null) {
    const draft = drafts.current[ids[i]],
      empty = emptyTraceWork(traceById(ids[i]))
    setIndex(i)
    setFurthest((current) => Math.max(current, i))
    setActive(0)
    setMarks(response?.marks ?? draft?.marks ?? empty.marks)
    setBranches(response?.branches ?? draft?.branches ?? empty.branches)
    setJunctions(response ? response.marks.map(() => true) : (draft?.recorded ?? empty.recorded))
    setCourse(response?.course ?? draft?.course ?? '')
    setTargetRelation(response?.targetRelation ?? draft?.targetRelation ?? '')
    setHints(response?.hints ?? draft?.hints ?? 0)
    setOrientation(response?.orientation.used ?? draft?.orientation ?? STANDARD_ORIENTATION)
    setAlignment(response?.orientation ?? draft?.alignment ?? null)
  }
  function open(i: number) {
    drafts.current[trace.id] = {
      marks,
      branches,
      recorded: junctions,
      course,
      targetRelation,
      hints,
      orientation,
      alignment,
    }
    restore(i, responses[i])
  }
  function record() {
    if (!ready || !alignment) return
    const response: CtResponse = {
      orientation: alignment,
      marks: marks as CtMark[],
      branches: [...branches],
      course: course as Course,
      hints,
      targetRelation: targetRelation as TargetRelation,
    }
    const next = responses.map((r, i) => (i === index ? response : r))
    setResponses(next)
    if (!saveCtAttempt(`${mode}.${trace.id}`, hints)) setSaveFailed(true)
    if (index < ids.length - 1) restore(index + 1, next[index + 1])
  }

  function exportWorksheet() {
    const content = {
      module: 'bronchial-branch-tracing',
      version: VERSION,
      mode,
      sourceCaseCount: 1,
      assessment: 'Ungraded CT route planning toward simulated nodules',
      nomenclatureVersion: 'nomenclature-v1',
      branchRouteVersion: 'branch-tracing-decisions/v1',
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
  if (submitted)
    return (
      <div className={styles.debrief}>
        <h1>CT interpretation debrief</h1>
        <p>
          You recorded {ids.length} {ids.length === 1 ? 'route' : 'routes'} toward{' '}
          {ids.length === 1 ? 'a simulated nodule' : 'simulated nodules'}. Compare each marked lumen
          with the source-derived path, then inspect the distal airway–nodule relationship.
        </p>
        <p className={styles.small}>
          ○ Your trace · ＋ Source-derived comparison. These are interpretations within one CT; no
          clinical accuracy grade is assigned.
        </p>
        {saveFailed && (
          <p role="status">
            Browser storage is unavailable. The current worksheet remains available for local
            export.
          </p>
        )}
        <div className={styles.tabs}>
          <button onClick={exportWorksheet}>Export your CT worksheet</button>
          <button onClick={onExit}>Return to {mode === 'practice' ? 'Practice' : 'Assess'}</button>
        </div>
        {ids.map((id, i) => (
          <section key={id} className={styles.ctDebriefRow}>
            <div>
              <h2>
                Target {i + 1} · {targetForTrace(traceById(id)).segment.code}
              </h2>
              <p>{COURSE_OPTIONS[responses[i]!.course]}</p>
              <CtOrientationFeedback trace={traceById(id)} {...responses[i]!.orientation} />
              <CtTargetFeedback value={responses[i]!.targetRelation} />
              <p>
                {responses[i]!.marks.filter((m) => m.pixel === null).length} checkpoints marked
                unresolved.{' '}
                {responses[i]!.hints > 0 ? 'Tracing reminder used.' : 'No tracing reminder used.'}
              </p>
              <p>
                Start with the parent lumen and examine continuity toward each mark. A difference
                from the centerline is a reason to inspect the image, not an automatic wrong answer.
              </p>
            </div>
            <DebriefViewer id={id} response={responses[i]!} />
          </section>
        ))}
      </div>
    )
  return (
    <StageLayout
      module="bronchial-branch-tracing"
      stageId={`ct-${index}`}
      label="Independent CT tracing"
      workspaceLabel="CT interpretation workspace"
      paneOrder={['steps', 'teaching', 'simulator']}
      defaultWidthFractions={{ primary: 0.26, secondary: 0.29 }}
      paneMinimums={{ primary: 300, secondary: 280, tertiary: 340 }}
      paneCaptions={{
        steps: 'your interpretation',
        teaching: 'task and orientation',
        simulator: 'real CT stack',
      }}
      compactPane="simulator"
      header={
        <SectionHeader
          kicker={mode === 'practice' ? 'Practice · Real CT' : 'Assess · CT worksheet'}
          title={`Trace ${index + 1} of ${ids.length}`}
          meta={[`Target: ${target.segment.code}`, 'Feedback after submission']}
          onRestart={onExit}
          restartLabel="Exit this set"
          saveAndExitHref={BASE_PATH}
          resumedNote={
            saveFailed
              ? 'Browser storage is unavailable. Work continues, but progress cannot be saved.'
              : undefined
          }
        />
      }
      contextStrip={
        <div className={styles.context}>
          <span>{target.segment.name} · choose the CT orientation</span>
          <span>Native 0.5 mm axial slices</span>
          <span>One source CT · ungraded</span>
        </div>
      }
      task={
        <div ref={taskTop}>
          <NowCard
            model={{
              kicker: `Interpretation ${index + 1}`,
              heading: !alignment
                ? 'Choose the CT orientation'
                : stationTask
                  ? trace.checkpoints[active].decision
                    ? `Junction ${active + 1} of ${trace.checkpoints.length - 1}`
                    : 'Distal nodule approach'
                  : 'Describe the completed route',
              body: alignment
                ? `Plan an airway approach to the nodule in ${target.segment.code}. Select and mark every daughter branch in order, then record the distal airway–nodule relationship.`
                : 'Start in standard axial. Rotate or reflect the CT to the tracing convention for this region. Compare it with the virtual airway view, then record the orientation you chose.',
              where: <LookInLine location={{ pane: 'simulator', landmark: 'CT tracing stack' }} />,
              primary: {
                label: !alignment
                  ? 'Use this orientation'
                  : stationTask
                    ? stationDone
                      ? active + 1 === trace.checkpoints.length - 1
                        ? 'Continue to nodule approach'
                        : 'Next junction'
                      : trace.checkpoints[active].decision
                        ? 'Record this junction'
                        : 'Record nodule approach'
                    : recorded && !dirty
                      ? 'Submit all CT interpretations'
                      : 'Record CT interpretation',
                onActivate: () => {
                  if (!alignment) {
                    if (sameOrientation(orientation, STANDARD_ORIENTATION)) return
                    const first = firstOrientations[index] ?? { ...orientation }
                    setFirstOrientations((current) =>
                      current.map((v, i) => (i === index ? first : v)),
                    )
                    setAlignment({ first, used: { ...orientation } })
                    setLevelRequest((v) => v + 1)
                  } else if (stationTask) {
                    if (stationDone) selectActive(active + 1)
                    else if (junctionReady(trace, active, marks, branches))
                      setJunctions((values) => values.map((v, i) => (i === active ? true : v)))
                  } else if (recorded && !dirty) setSubmitted(true)
                  else record()
                },
                disabled: !alignment
                  ? sameOrientation(orientation, STANDARD_ORIENTATION)
                  : stationTask
                    ? !stationDone && !junctionReady(trace, active, marks, branches)
                    : !ready,
                disabledReason: !alignment
                  ? 'Use the rotate or flip controls first.'
                  : 'Select a daughter (or uncertainty) and mark its lumen (or unresolved lumen). Record each junction before moving on.',
              },
            }}
          >
            {alignment && (
              <>
                {stationTask && (
                  <CtBranchDecision
                    trace={trace}
                    active={active}
                    choice={branches[active]}
                    recorded={stationDone}
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
                <p role="status">
                  {stationDone
                    ? 'Junction response recorded. Comparison follows submission of the set.'
                    : marks[active]
                      ? 'Lumen response recorded. Record this junction to continue.'
                      : 'Lumen mark needed in the CT tracing stack.'}
                </p>
                <button onClick={() => setAlignment(null)}>Revise orientation</button>
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
            {mode === 'practice' && (
              <div className={styles.hints}>
                <button disabled={hints > 0} onClick={() => setHints(1)}>
                  Tracing reminder
                </button>
                {hints > 0 && (
                  <p>
                    Follow the walls from Start through neighboring planes. The next airway
                    checkpoint may lie cranially or caudally.
                  </p>
                )}
              </div>
            )}
            <div className={styles.checkpoints}>
              {ids.map((id, i) => (
                <button
                  key={id}
                  disabled={i > furthest}
                  aria-current={i === index ? 'step' : undefined}
                  onClick={() => open(i)}
                >
                  Trace {i + 1}
                  {responses[i] ? ' · recorded' : ''}
                </button>
              ))}
            </div>
          </NowCard>
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
      teaching={
        <div ref={teachingTop} className={styles.teaching}>
          {alignment && <CtJunctionTeaching trace={trace} active={active} />}
          <h2>Trace without the reference</h2>
          <p>
            Use <strong>Show target</strong> to inspect the simulated nodule in the{' '}
            <strong>
              {target.segment.name.toLowerCase()} ({target.segment.code})
            </strong>
            .
          </p>
          <p>
            Use Start to find the trachea, then follow the air column through every fork. At each
            junction, select a daughter in Steps and mark its lumen on Current junction CT. Record
            the junction before continuing.
          </p>
          <p>
            After the distal checkpoint, inspect adjacent slices toward the nodule. Record what the
            visible air column supports. Proximity alone does not establish a continuous airway
            approach.
          </p>
          <p>
            Use Rotate 90° left, Rotate 90° right or Flip left–right. Reset to standard lets you
            start again. These controls change the display; your marks remain attached to the same
            anatomy. The virtual camera follows the selected airway location. An axial slice and an
            endoscopic view have different projections; compare their branch relationships.
          </p>
          <h2>Record uncertainty honestly</h2>
          <p>
            If the source image does not resolve the connection, use “Lumen unresolved here.” A
            centerline or nearby vessel would not establish continuity by itself.
          </p>
          <p className={styles.small}>
            Each junction is presented on the source route, even if your preceding choice differs.
            Your recorded choices remain unchanged; explicit branch comparisons and reference marks
            are withheld until the whole set is submitted.
          </p>
          <CtAirwayGuide trace={trace} active={active} pending />
        </div>
      }
      simulator={
        <NativeCtViewer
          key={trace.id}
          trace={trace}
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
                  if (active === lastUnlocked(junctions) && validCtMark(mark, trace, active))
                    setMarks((current) => current.map((m, i) => (i === active ? mark : m)))
                }
              : undefined
          }
          showAnchor
        />
      }
      footer={
        <div className={styles.footer}>
          <a href={SOURCE.url} target="_blank" rel="noreferrer">
            {SOURCE.title}
          </a>
          <span>CT/source comparison · no clinical pass threshold</span>
        </div>
      }
    />
  )
}
function DebriefViewer({ id, response }: { id: string; response: CtResponse }) {
  const [active, setActive] = useState(0)
  const [orientation, setOrientation] = useState(response.orientation.used)
  return (
    <>
      <NativeCtViewer
        trace={traceById(id)}
        marks={response.marks}
        active={active}
        onActive={setActive}
        orientation={orientation}
        onOrientation={setOrientation}
        revealed
      />
      <CtBranchDecision
        trace={traceById(id)}
        active={active}
        choice={response.branches[active]}
        recorded
        reveal
      />
    </>
  )
}
