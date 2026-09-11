'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { StageLayout } from '@/features/learning-module/stage/StageLayout'
import { SectionHeader } from '@/features/learning-module/stage/SectionHeader'
import { NowCard } from '@/features/learning-module/stage/NowCard'
import { LookInLine } from '@/features/learning-module/stage/LookInLine'
import { BASE_PATH, SOURCE, VERSION } from '../content/lessons'
import { ASSESS_TRACES, PRACTICE_TRACES, SEGMENT_PRACTICE_TRACES } from '../content/practice'
import {
  COURSE_OPTIONS,
  type Course,
  type CtMark,
  type CtResponse,
  type TargetRelation,
} from '../content/ct-types'
import { traceById, targetForTrace } from '../geometry/native-ct'
import { DISPLAY_PRESETS } from '../geometry/coordinates'
import { marksComplete, validCtMark } from '../engine/ct-session'
import { saveCtAttempt } from '../engine/progress'
import { ModuleFrame } from './ModuleFrame'
import { NativeCtViewer } from './NativeCtViewer'
import {
  CtAirwayGuide,
  CtCourseControl,
  CtTraceList,
  CtTargetRelationControl,
  CtTargetFeedback,
} from './CtTraceControls'
import { TargetCtPreview } from './TargetCtPreview'
import styles from './branch-tracing.module.css'

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
          Your marks first; comparison after submission.
        </p>
        <div className={styles.introGrid}>
          <section>
            <h2>Follow the airway toward the target</h2>
            <p>
              Inspect the target nodule, then start in the identified parent airway. At each named
              checkpoint, mark the lumen that continues from it. Use neighboring slices, the
              book-oriented view and the standard axial view to check the connection.
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
  const [levelRequest, setLevelRequest] = useState(0)
  const [marks, setMarks] = useState<(CtMark | null)[]>([null, null, null])
  const [course, setCourse] = useState<Course | ''>('')
  const [targetRelation, setTargetRelation] = useState<TargetRelation | ''>('')
  const [hints, setHints] = useState(0)
  const [responses, setResponses] = useState<(CtResponse | null)[]>(ids.map(() => null))
  const [submitted, setSubmitted] = useState(false),
    [saveFailed, setSaveFailed] = useState(false)
  const trace = traceById(ids[index])
  const target = targetForTrace(trace)
  const ready = marksComplete(marks) && Boolean(course) && Boolean(targetRelation)
  const recorded = responses.every(Boolean)
  const dirty =
    JSON.stringify(responses[index]) !== JSON.stringify({ marks, course, hints, targetRelation })
  function open(i: number) {
    const response = responses[i]
    setIndex(i)
    setActive(0)
    setMarks(response?.marks ?? [null, null, null])
    setCourse(response?.course ?? '')
    setTargetRelation(response?.targetRelation ?? '')
    setHints(response?.hints ?? 0)
  }
  function record() {
    if (!ready) return
    const response: CtResponse = {
      marks: marks as CtMark[],
      course: course as Course,
      hints,
      targetRelation: targetRelation as TargetRelation,
    }
    const next = responses.map((r, i) => (i === index ? response : r))
    setResponses(next)
    if (!saveCtAttempt(`${mode}.${trace.id}`, hints)) setSaveFailed(true)
    if (index < ids.length - 1) {
      const nextResponse = next[index + 1]
      setIndex(index + 1)
      setActive(0)
      setMarks(nextResponse?.marks ?? [null, null, null])
      setCourse(nextResponse?.course ?? '')
      setTargetRelation(nextResponse?.targetRelation ?? '')
      setHints(nextResponse?.hints ?? 0)
    }
  }
  function exportWorksheet() {
    const content = {
      module: 'bronchial-branch-tracing',
      version: VERSION,
      mode,
      sourceCaseCount: 1,
      assessment: 'Ungraded CT route planning toward simulated nodules',
      nomenclatureVersion: 'nomenclature-v1',
      traces: ids.map((id, i) => ({
        id,
        target: {
          id: targetForTrace(traceById(id)).id,
          segment: targetForTrace(traceById(id)).segment,
          simulated: true,
        },
        airwayPath: traceById(id).airwayPath,
        checkpoints: traceById(id).checkpoints.map(({ id, airway, landmark }) => ({
          id,
          airway,
          landmark,
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
          <span>
            {target.segment.name} · {DISPLAY_PRESETS[trace.preset]}
          </span>
          <span>Native 0.5 mm axial slices</span>
          <span>One source CT · ungraded</span>
        </div>
      }
      task={
        <>
          <NowCard
            model={{
              kicker: `Interpretation ${index + 1}`,
              heading: 'Follow and record the airway',
              body: `Plan an airway approach to the nodule in ${target.segment.code}. Record three airway checkpoints, the course and the airway–nodule relationship.`,
              where: <LookInLine location={{ pane: 'simulator', landmark: 'CT tracing stack' }} />,
              primary: {
                label:
                  recorded && !dirty ? 'Submit all CT interpretations' : 'Record CT interpretation',
                onActivate: () => {
                  if (recorded && !dirty) setSubmitted(true)
                  else record()
                },
                disabled: !ready,
                disabledReason:
                  'Record all three checkpoints, the airway course and its relationship to the nodule.',
              },
            }}
          >
            <CtTraceList
              trace={trace}
              marks={marks}
              active={active}
              onActive={(i) => {
                setActive(i)
                setLevelRequest((v) => v + 1)
              }}
            />
            <CtCourseControl value={course} onChange={setCourse} />
            <CtTargetRelationControl value={targetRelation} onChange={setTargetRelation} />
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
                  disabled={i > index && !responses[i]}
                  aria-current={i === index ? 'step' : undefined}
                  onClick={() => open(i)}
                >
                  Trace {i + 1}
                  {responses[i] ? ' · recorded' : ''}
                </button>
              ))}
            </div>
          </NowCard>
        </>
      }
      teaching={
        <div className={styles.teaching}>
          <h2>Trace without the reference</h2>
          <p>
            Use <strong>Show target</strong> to inspect the simulated nodule in the{' '}
            <strong>
              {target.segment.name.toLowerCase()} ({target.segment.code})
            </strong>
            .
          </p>
          <p>
            Use Start to find the parent airway, then follow the air column through the stack. At
            the three named airway checkpoints, record the lumen you believe continues from that
            parent.
          </p>
          <p>
            After the distal checkpoint, inspect adjacent slices toward the nodule. Record what the
            visible air column supports. Proximity alone does not establish a continuous airway
            approach.
          </p>
          <p>
            Book tracing view applies the convention for this region. Standard axial changes only
            the display; your marks remain attached to the same anatomy.
          </p>
          <h2>Record uncertainty honestly</h2>
          <p>
            If the source image does not resolve the connection, use “Lumen unresolved here.” A
            centerline or nearby vessel would not establish continuity by itself.
          </p>
          <p className={styles.small}>
            The whole set must be submitted before its comparison is shown. Changes to a recorded
            response do not erase the first attempt.
          </p>
          <CtAirwayGuide trace={trace} />
        </div>
      }
      simulator={
        <NativeCtViewer
          key={trace.id}
          trace={trace}
          marks={marks}
          active={active}
          levelRequest={levelRequest}
          onActive={setActive}
          onMark={(mark) => {
            if (validCtMark(mark, trace, active))
              setMarks((current) => current.map((m, i) => (i === active ? mark : m)))
          }}
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
  return (
    <NativeCtViewer
      trace={traceById(id)}
      marks={response.marks}
      active={active}
      onActive={setActive}
      revealed
    />
  )
}
