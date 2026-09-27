'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, ClipboardCheck, Upload } from 'lucide-react'
import type { SocratesSlideDocument, SocratesCaseDocument } from '@/features/socrates-builder/types'
import {
  caseKey,
  COLLECTION_KEY,
  collectionSchema,
  currentProgress,
  learningDocuments,
  moduleName,
  PROGRESS_KEY,
  progressSchema,
  teachingTitle,
  type CaseProgress,
  type LearningCollection,
  type LearningMode,
  type LearningProgress,
} from '../model'
import { SlideLesson } from './SlideLesson'
import styles from './learning.module.css'

export function SocratesLearningWorkspace({ documents }: { documents: SocratesSlideDocument[] }) {
  const [collection, setCollection] = useState<LearningCollection | null>(null)
  const [progress, setProgress] = useState<LearningProgress>({})
  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState<LearningMode | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const [module, setModule] = useState('all')
  const [warning, setWarning] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const title = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let message = ''
    let restoredCollection: LearningCollection | null = null
    let restoredProgress: LearningProgress = {}
    try {
      const raw = localStorage.getItem(COLLECTION_KEY)
      if (raw) restoredCollection = collectionSchema.parse(JSON.parse(raw))
    } catch {
      message =
        'The curriculum could not be restored. Its stored copy is preserved; import the curriculum file again.'
    }
    try {
      const raw = localStorage.getItem(PROGRESS_KEY)
      if (raw) restoredProgress = progressSchema.parse(JSON.parse(raw))
    } catch {
      message += ' Saved progress could not be restored.'
    }
    // Hydrate browser-only author previews without rendering a different initial slide.
    setCollection(restoredCollection)
    setProgress(restoredProgress)
    setWarning(message)
    setReady(true)
  }, [])
  useEffect(() => {
    if (ready) title.current?.focus()
  }, [mode, active, ready])

  const cases = learningDocuments(collection?.documents ?? documents)
  const modules = [...new Set(cases.map(moduleName))]
  const selected = cases.find((doc) => caseKey(doc) === active)
  const completed = (doc: SocratesCaseDocument, target: LearningMode) => {
    const saved = currentProgress(doc, progress)
    return target === 'teaching' ? saved.teachingComplete : Boolean(saved.submission)
  }
  const count = (target: LearningMode) => cases.filter((doc) => completed(doc, target)).length
  function updateProgress(doc: SocratesCaseDocument, value: CaseProgress) {
    const next = { ...progress, [caseKey(doc)]: value }
    setProgress(next)
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(next))
    } catch {
      setWarning(
        'Progress is kept for this visit, but browser storage is unavailable or full. Keep this page open until you can save it.',
      )
    }
  }
  function openCase(doc: SocratesCaseDocument) {
    if (mode === 'teaching')
      updateProgress(doc, { ...currentProgress(doc, progress), teachingViewed: true })
    setActive(caseKey(doc))
  }
  function chooseModule(next: LearningMode) {
    setMode(next)
    setActive(null)
    setModule('all')
  }
  async function importCollection(file?: File) {
    if (!file) return
    try {
      if (file.size > 2_000_000) throw new Error('The curriculum file is too large (maximum 2 MB).')
      const parsed = collectionSchema.safeParse(JSON.parse(await file.text()))
      if (!parsed.success)
        throw new Error(
          'Use a SOCRATES local curriculum package containing validated draft slides.',
        )
      setCollection(parsed.data)
      setActive(null)
      setMode(null)
      setModule('all')
      try {
        localStorage.setItem(COLLECTION_KEY, JSON.stringify(parsed.data))
        setWarning('')
      } catch {
        setWarning(
          'The curriculum is open for this visit but could not be saved in this browser. Keep the original JSON file to import it again.',
        )
      }
    } catch (cause) {
      setWarning(cause instanceof Error ? cause.message : 'Unable to read the curriculum file.')
    } finally {
      if (input.current) input.current.value = ''
    }
  }
  if (!ready)
    return (
      <div className={styles.shell} role="status">
        Opening the slide curriculum…
      </div>
    )

  const visible =
    mode === 'teaching' && module !== 'all'
      ? cases.filter((doc) => moduleName(doc) === module)
      : cases
  const nextIncomplete = visible.find((doc) => !completed(doc, mode ?? 'teaching'))
  return (
    <div className={styles.shell}>
      <div className={styles.reviewBar}>
        <span>
          <span className={styles.dot} />
          Author preview · teaching/testing allocation pending
        </span>
        <span>Browser only · unpublished</span>
      </div>
      {warning && (
        <p className={styles.warning} role="alert">
          {warning}
        </p>
      )}
      {selected && mode ? (
        <>
          <h2 className={styles.srOnly} tabIndex={-1} ref={title}>
            {mode === 'teaching' ? 'Teaching slide' : 'Testing slide'} {cases.indexOf(selected) + 1}
          </h2>
          <SlideLesson
            key={`${caseKey(selected)}-${mode}`}
            document={selected}
            mode={mode}
            position={cases.indexOf(selected) + 1}
            total={cases.length}
            progress={currentProgress(selected, progress)}
            onProgress={(value) => updateProgress(selected, value)}
            onBack={() => setActive(null)}
            onNext={
              visible.indexOf(selected) < visible.length - 1
                ? () => openCase(visible[visible.indexOf(selected) + 1])
                : null
            }
          />
        </>
      ) : (
        <>
          <div className={styles.hero}>
            <div>
              {mode && (
                <button
                  className={styles.textButton}
                  onClick={() => {
                    setMode(null)
                    setModule('all')
                  }}
                >
                  <ArrowLeft size={17} />
                  All modules
                </button>
              )}
              <div className={styles.eyebrow}>SOCRATES · Slide interpretation</div>
              <h1 ref={title} tabIndex={-1}>
                {mode === 'teaching'
                  ? 'Teaching set'
                  : mode === 'testing'
                    ? 'Testing set'
                    : 'Learn the patterns.\nRead the tissue.'}
              </h1>
              <p>
                {mode === 'teaching'
                  ? 'Study tissue architecture and cellular detail with the authored teaching notes beside each slide.'
                  : mode === 'testing'
                    ? 'Interpret tissue independently. Color overlays, teaching notes, and reference answers stay hidden—even after submission.'
                    : 'A teaching module for guided study and a separate testing module for independent interpretation.'}
              </p>
            </div>
            <div className={styles.heroAside}>
              <span className={styles.largeCount}>{cases.length.toString().padStart(2, '0')}</span>
              <span>slides available for review</span>
              {!mode && (
                <>
                  <button className={styles.secondary} onClick={() => input.current?.click()}>
                    <Upload size={16} />
                    Import curriculum
                  </button>
                  <input
                    ref={input}
                    type="file"
                    accept="application/json,.json"
                    aria-label="Import local curriculum JSON"
                    hidden
                    onChange={(event) => void importCollection(event.target.files?.[0])}
                  />
                </>
              )}
            </div>
          </div>
          {!mode ? (
            <>
              <div className={styles.moduleCards}>
                <section className={styles.moduleCard}>
                  <div className={styles.moduleIcon}>
                    <BookOpen size={27} />
                  </div>
                  <span className={styles.eyebrow}>01 / Guided study</span>
                  <h2>Teaching</h2>
                  <p>
                    Read the slide from low to high magnification. Compare tissue and color images,
                    review the interpretation, and identify the key learning point.
                  </p>
                  <div className={styles.moduleMeta}>
                    <span>
                      {modules.length} curriculum {modules.length === 1 ? 'section' : 'sections'}
                    </span>
                    <span>
                      {count('teaching')} / {cases.length} reviewed
                    </span>
                  </div>
                  <button
                    className={styles.primary}
                    disabled={!cases.length}
                    onClick={() => chooseModule('teaching')}
                  >
                    Open teaching module
                    <ArrowRight size={18} />
                  </button>
                </section>
                <section className={styles.moduleCard}>
                  <div className={styles.moduleIcon}>
                    <ClipboardCheck size={27} />
                  </div>
                  <span className={styles.eyebrow}>02 / Independent interpretation</span>
                  <h2>Testing</h2>
                  <p>
                    Examine tissue alone. Record adequacy, cancer classification, confidence, and
                    optional reasoning. Submitted responses remain separate from teaching.
                  </p>
                  <div className={styles.moduleMeta}>
                    <span>Tissue only</span>
                    <span>
                      {count('testing')} / {cases.length} submitted
                    </span>
                  </div>
                  <button
                    className={styles.primary}
                    disabled={!cases.length}
                    onClick={() => chooseModule('testing')}
                  >
                    Open testing module
                    <ArrowRight size={18} />
                  </button>
                </section>
              </div>
              <div className={styles.allocation}>
                <div>
                  <span className={styles.eyebrow}>Before launch</span>
                  <h3>Choose the teaching and testing sets</h3>
                </div>
                <p>
                  Every imported slide is available in both modules for author review. These are
                  preview pools; final case assignments have not been made. Your existing
                  slide-builder drafts remain separate.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className={styles.directoryBar}>
                <div>
                  <strong>
                    {count(mode)} of {cases.length}
                  </strong>
                  <span> {mode === 'teaching' ? 'reviewed' : 'submitted'}</span>
                </div>
                <progress
                  max={Math.max(1, cases.length)}
                  value={count(mode)}
                  aria-label={`${mode} progress`}
                />
                {nextIncomplete && (
                  <button className={styles.primary} onClick={() => openCase(nextIncomplete)}>
                    {count(mode) ? 'Continue' : 'Start'}{' '}
                    {mode === 'teaching' ? 'teaching' : 'testing'}
                    <ArrowRight size={18} />
                  </button>
                )}
              </div>
              {mode === 'teaching' && (
                <div className={styles.filters} role="group" aria-label="Curriculum sections">
                  <button aria-pressed={module === 'all'} onClick={() => setModule('all')}>
                    All slides
                  </button>
                  {modules.map((name, i) => (
                    <button
                      key={name}
                      aria-pressed={module === name}
                      onClick={() => setModule(name)}
                    >
                      {i + 1}. {name.replace(/^MODULE \d+ — /, '').toLowerCase()}
                    </button>
                  ))}
                </div>
              )}
              <div className={styles.caseGrid}>
                {visible.map((doc) => {
                  const position = cases.indexOf(doc) + 1
                  const saved = currentProgress(doc, progress)
                  return (
                    <button
                      className={styles.caseCard}
                      key={caseKey(doc)}
                      onClick={() => openCase(doc)}
                    >
                      <span className={styles.caseNumber}>{String(position).padStart(2, '0')}</span>
                      <span className={styles.caseDescription}>
                        <strong>
                          {mode === 'teaching'
                            ? teachingTitle(doc)
                            : `Slide ${String(position).padStart(2, '0')}`}
                        </strong>
                        <small>
                          {completed(doc, mode) ? (
                            <>
                              <Check size={13} />
                              {mode === 'teaching' ? 'Reviewed' : 'Submitted'}
                            </>
                          ) : (mode === 'teaching' && saved.teachingViewed) ||
                            (mode === 'testing' && Object.keys(saved.draft).length) ? (
                            'In progress'
                          ) : (
                            'Not started'
                          )}
                        </small>
                      </span>
                      <ArrowRight size={17} />
                    </button>
                  )
                })}
              </div>
            </>
          )}
          {!cases.length && (
            <p className={styles.warning}>
              Import a local curriculum package or add case content to a browser draft to begin.
            </p>
          )}
        </>
      )}
      <footer className={styles.footer}>
        For education only. Draft teaching content requires author review before release. Completing
        these modules does not establish clinical competency.
      </footer>
    </div>
  )
}
