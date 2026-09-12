'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Link, useRouter } from '@/i18n/navigation'
import { ModuleFrameV2 } from '@/features/learning-module/components/ModuleFrameV2'
import { StageLayout } from '@/features/learning-module/stage/StageLayout'
import { NowCard } from '@/features/learning-module/stage/NowCard'
import { StepList } from '@/features/learning-module/stage/StepList'
import { LookInLine } from '@/features/learning-module/stage/LookInLine'
import { Workbench } from './components/Workbench'
import { INITIAL_SCENARIO, useSimulator, type Simulator } from './engine/useSimulator'
import {
  ASSESSMENT,
  BASE_ROUTE,
  CAO_SOURCE,
  LESSONS,
  REVIEW_SOURCE,
  nextLesson,
  type Lesson,
} from './data/curriculum'
import styles from './therapeutic.module.css'

const MODES = [
  ['overview', 'Overview', 'Purpose & instrument pathway'],
  ['learn', 'Learn', 'Guided tissue handling'],
  ['practice', 'Practice', 'Open instrument workbench'],
  ['assess', 'Assess', 'Decisions & debrief'],
] as const
const modeHref = (mode: string) => `${BASE_ROUTE}?mode=${mode}`
function Sources() {
  return (
    <p className={styles.micro}>
      Clinical reference:{' '}
      <a href={REVIEW_SOURCE} target="_blank" rel="noreferrer">
        Mudambi, Miller & Eapen · Malignant central airway obstruction (2017), S1094–S1100
      </a>
      . Context:{' '}
      <a href={CAO_SOURCE} target="_blank" rel="noreferrer">
        CHEST central airway obstruction guideline (2024)
      </a>
      . See also <Link href="/thermal-ablation">thermal-ablation principles</Link>.
    </p>
  )
}
export function TherapeuticBronchoscopyModule() {
  const params = useSearchParams(),
    router = useRouter(),
    sim = useSimulator()
  const raw = params.get('mode'),
    mode = MODES.find((m) => m[0] === raw)?.[0] ?? 'overview'
  const lesson = LESSONS.find((l) => l.sectionId === params.get('lesson')) ?? LESSONS[0]
  const [completed, setCompleted] = useState<Set<string>>(new Set()),
    [firstAttempts, setFirstAttempts] = useState<Record<string, number>>({})
  const next = nextLesson(completed)
  const learn = (id = next.sectionId) => router.push(`${BASE_ROUTE}?mode=learn&lesson=${id}`)
  return (
    <div className={styles.root} data-mode={mode}>
      <ModuleFrameV2
        eyebrow="Interventional pulmonology · Instrument laboratory"
        title="Therapeutic Bronchoscopy"
        releaseLabel="Admin preview"
        activeHref={modeHref(mode)}
        navItems={MODES.map(([id, title, description]) => ({
          href: modeHref(id),
          title,
          description,
        }))}
        activityMode={mode === 'learn'}
        safetyNotice="Educational prototype. Tissue, bleeding and instrument dimensions are authored models. Airway management and rigid access are assumed prerequisites; this exercise does not establish procedural competence."
      >
        {mode === 'overview' && (
          <main className={styles.overview}>
            <span className={styles.eyebrow}>Biopsy · Debulking · Reassessment</span>
            <h1>From seeing the lesion to handling tissue.</h1>
            <p className={styles.intro}>
              Work inside a three-dimensional airway with instruments that engage, separate and
              retrieve tumor tissue. Inspect the defect you create and manage the resulting loss of
              visibility.
            </p>
            <p>
              For fellows and instructors familiar with central airway anatomy. Begin with a normal
              reference, then practice forceps biopsy, cryoextraction and snare resection. This is a
              separate module using the reviewed anatomy assets.
            </p>
            <div className={styles.actionRow}>
              <button className={styles.primary} onClick={() => learn()}>
                {completed.size ? 'Continue learning' : 'Start with forceps biopsy'}
              </button>
              <Link href={modeHref('practice')}>Explore the workbench</Link>
            </div>
            <div className={styles.cards}>
              {LESSONS.map((l, i) => (
                <article key={l.sectionId} className={styles.card}>
                  <span className={styles.number}>0{i + 1}</span>
                  <h2>{l.title}</h2>
                  <p>{l.objective}</p>
                  <small>
                    Prerequisite: {l.prerequisite}. About {l.minutes} minutes.
                  </small>
                  <div className={styles.actionRow}>
                    <button onClick={() => learn(l.sectionId)}>
                      {completed.has(l.sectionId) ? 'Review lesson' : 'Open lesson'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <p className={styles.micro}>
              {completed.size} of {LESSONS.length} instrument lessons completed in this session.
              Progress and specimen records restart on reload. There is no competence score.
            </p>
            <Sources />
          </main>
        )}
        {mode === 'practice' && (
          <main>
            <div className={styles.stageHeader} style={{ padding: '18px 20px 0' }}>
              <h2>Instrument workbench</h2>
              <span className={styles.micro}>Scenario changes reset tissue and specimens</span>
            </div>
            <Workbench sim={sim} />
            <div style={{ padding: '0 20px 20px' }}>
              <Sources />
            </div>
          </main>
        )}
        {mode === 'learn' && (
          <Learn
            key={lesson.sectionId}
            lesson={lesson}
            sim={sim}
            firstAttempt={firstAttempts[lesson.sectionId]}
            onAttempt={(answer) =>
              setFirstAttempts((a) =>
                a[lesson.sectionId] === undefined ? { ...a, [lesson.sectionId]: answer } : a,
              )
            }
            onLesson={learn}
            onComplete={() => {
              setCompleted((c) => new Set([...c, lesson.sectionId]))
              router.push(modeHref('overview'))
            }}
          />
        )}
        {mode === 'assess' && <Assess />}
      </ModuleFrameV2>
    </div>
  )
}
function Learn({
  lesson,
  sim,
  firstAttempt,
  onAttempt,
  onLesson,
  onComplete,
}: {
  lesson: Lesson
  sim: Simulator
  firstAttempt: number | undefined
  onAttempt: (answer: number) => void
  onLesson: (id: string) => void
  onComplete: () => void
}) {
  const [step, setStep] = useState(0),
    [review, setReview] = useState<number | null>(null),
    [choice, setChoice] = useState<number | null>(null),
    [prediction, setPrediction] = useState<number | null>(null)
  const [performed, setPerformed] = useState<Set<string>>(new Set())
  useEffect(() => {
    sim.reset({ ...INITIAL_SCENARIO, ...lesson.scenario }, lesson.instrument)
    // A lesson mounts once per instrument; residual-tissue updates do not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.sectionId])
  const current = lesson.steps[review ?? step],
    retrieved = sim.instrument.specimens.filter((s) => s.instrument === lesson.instrument).length
  const gates = [
    sim.compared && !sim.normal,
    prediction !== null,
    retrieved >= 1,
    retrieved >= 1 && !sim.instrument.outside && !sim.instrument.pending,
    true,
    retrieved >= 1 && !sim.instrument.outside && !sim.instrument.pending,
  ]
  const allowed =
    review !== null || (step === 1 && prediction === null ? choice !== null : gates[step])
  const advance = () => {
    if (review !== null) {
      setReview(null)
      return
    }
    if (step === 1 && prediction === null) {
      if (choice !== null) {
        setPrediction(choice)
        onAttempt(choice)
      }
      return
    }
    if (!gates[step]) return
    setPerformed((p) => new Set([...p, current.id]))
    if (step === 5) {
      onComplete()
      return
    }
    if (step === 4)
      sim.reset(
        { ...INITIAL_SCENARIO, ...lesson.scenario, site: 'left-mainstem' },
        lesson.instrument,
      )
    setStep((s) => s + 1)
  }
  const status =
    step === 0
      ? 'Compare the normal reference and return to the lesion to continue.'
      : step === 2 || step === 5
        ? `${retrieved} specimen retrieved. Complete collection and return to the airway.`
        : step === 3
          ? 'Inspect the defect and blood after retrieving the tissue.'
          : undefined
  return (
    <StageLayout
      stageId={current.id}
      label={lesson.title}
      module="therapeutic-bronchoscopy"
      workspaceLabel="Therapeutic bronchoscopy lesson"
      paneOrder={['steps', 'teaching', 'simulator']}
      defaultWidthFractions={{ primary: 0.26, secondary: 0.29 }}
      paneMinimums={{ primary: 300, secondary: 280, tertiary: 340 }}
      paneCaptions={{
        steps: 'what to do',
        teaching: 'tissue handling',
        simulator: 'bronchoscope & instruments',
      }}
      compactPane={current.lookIn?.pane}
      header={
        <div className={styles.stageHeader}>
          <h1>{lesson.title}</h1>
          <Link href={modeHref('overview')}>Module overview</Link>
          <select
            aria-label="Instrument lesson"
            value={lesson.sectionId}
            onChange={(e) => onLesson(e.target.value)}
          >
            {LESSONS.map((l) => (
              <option key={l.sectionId} value={l.sectionId}>
                {l.index + 1}. {l.title}
              </option>
            ))}
          </select>
        </div>
      }
      contextStrip={<span>{lesson.objective} · In-session progress only.</span>}
      task={
        <>
          <NowCard
            model={{
              kicker: `Step ${(review ?? step) + 1} of ${lesson.steps.length} · ${current.phase}`,
              heading: current.title,
              body: current.instruction,
              where: <LookInLine location={current.lookIn!} />,
              primary: {
                label:
                  review !== null
                    ? 'Return to current step'
                    : step === 1 && prediction !== null
                      ? 'Continue to tissue handling'
                      : current.actionLabel,
                onActivate: advance,
                disabled: !allowed,
                disabledReason: !allowed
                  ? (status ?? 'Select a prediction before submitting.')
                  : undefined,
              },
              status: review === null && step !== 1 && allowed ? status : undefined,
              back:
                step > 0
                  ? {
                      label: 'Review previous step',
                      onActivate: () => setReview(Math.max(0, step - 1)),
                    }
                  : undefined,
            }}
          >
            {(review ?? step) === 1 && (
              <div>
                <h3>Prediction</h3>
                <div className={styles.answers}>
                  {lesson.choices.map((c, i) => (
                    <label key={c}>
                      <input
                        type="radio"
                        name="prediction"
                        checked={(prediction ?? choice) === i}
                        disabled={prediction !== null || review !== null}
                        onChange={() => setChoice(i)}
                      />
                      {c}
                    </label>
                  ))}
                </div>
                {prediction !== null && (
                  <p className={styles.feedback}>
                    {prediction === lesson.answer
                      ? 'That matches the modeled response.'
                      : 'Reconsider the relationship between contact, tissue separation and retrieval.'}{' '}
                    {lesson.explanation}
                    {firstAttempt !== undefined && firstAttempt !== prediction
                      ? ' Your first response is retained for this session.'
                      : ''}
                  </p>
                )}
              </div>
            )}
          </NowCard>
          <StepList
            lesson={lesson}
            currentIndex={step}
            furthestPerformedIndex={step - 1}
            performedStepIds={performed}
            predictionCommitted={prediction !== null}
            reviewIndex={review}
            recapFor={(i) => [lesson.steps[i].instruction]}
            onSelect={(i) => {
              if (i < step) setReview(i)
            }}
          />
        </>
      }
      teaching={
        <div className={styles.teaching}>
          {(review ?? step) < 2 ? (
            <>
              <h3>Normal airway and lesion</h3>
              <p>
                The normal reference shows the same airway and scope position without the added
                lesion. In the lesion view, identify the wall attachment and the remaining lumen
                before introducing a tool.
              </p>
              <p>
                Use the camera and the tissue surface together. The small circle marks the optical
                center; the instrument emerges from the lower right of the view.
              </p>
            </>
          ) : (
            <>
              <h3>
                {(review ?? step) === 4
                  ? 'Why the tissue changed'
                  : (review ?? step) === 5
                    ? 'A changed location'
                    : 'Worked example'}
              </h3>
              {(review ?? step) === 4 ? (
                <p>{lesson.explanation}</p>
              ) : (
                <ol>
                  {lesson.worked.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              )}
              {(review ?? step) === 3 && (
                <p>
                  The mesh now retains approximately {Math.round(sim.remaining * 100)}% of its
                  initial tumor volume. This is a geometry estimate, not the percentage of lumen
                  obstruction. There are {retrieved} retrieved specimens in this procedure.
                </p>
              )}
              {(review ?? step) === 5 && (
                <p>
                  {lesson.transfer} The airway angle and available wall clearance have changed.
                  Re-establish contact under direct view.
                </p>
              )}
            </>
          )}
          <p className={styles.micro}>
            Scope insertion is limited by the reviewed wall and the current tumor surface. Tissue
            actions require contact. This prototype protects normal wall from resection and does not
            model perforation, anesthesia, rigid access or patient physiology.
          </p>
          <Sources />
        </div>
      }
      simulator={<Workbench sim={sim} guided locked={step < 2 || review !== null} />}
    />
  )
}
function Assess() {
  const [answers, setAnswers] = useState<Record<string, number>>({}),
    [submitted, setSubmitted] = useState(false)
  return (
    <main className={styles.assess}>
      <span className={styles.eyebrow}>Instrument decisions</span>
      <h1>Check the next action.</h1>
      <p>
        Choose the next action in each situation. Feedback appears after submission; this check does
        not assess procedural competence.
      </p>
      {ASSESSMENT.map((q, index) => (
        <fieldset key={q.id} disabled={submitted}>
          <legend>
            {index + 1}. {q.prompt}
          </legend>
          <div className={styles.answers}>
            {q.options.map((o, i) => (
              <label key={o}>
                <input
                  name={q.id}
                  type="radio"
                  checked={answers[q.id] === i}
                  onChange={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                />
                {o}
              </label>
            ))}
          </div>
          {submitted && (
            <p className={styles.feedback}>
              {answers[q.id] === q.answer ? 'Appropriate next action.' : 'Review this decision.'}{' '}
              {q.feedback}
            </p>
          )}
        </fieldset>
      ))}
      <div className={styles.actionRow}>
        {!submitted ? (
          <button
            className={styles.primary}
            disabled={Object.keys(answers).length !== ASSESSMENT.length}
            onClick={() => setSubmitted(true)}
          >
            Submit decisions
          </button>
        ) : (
          <Link href={modeHref('practice')}>Apply these decisions in Practice</Link>
        )}
      </div>
      <Sources />
    </main>
  )
}
