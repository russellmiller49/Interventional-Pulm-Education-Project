'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, ClipboardCheck, Pencil } from 'lucide-react'
import type { SocratesSlideDocument, SocratesCaseDocument } from '@/features/socrates-builder/types'
import {
  caseKey,
  currentProgress,
  learningDocuments,
  moduleName,
  PROGRESS_KEY,
  progressSchema,
  teachingTitle,
  type CaseProgress,
  type LearningMode,
  type LearningProgress,
} from '../model'
import type { SlideAssignment } from '@/features/socrates-builder/web-overlay-storage'
import { SlideLesson } from './SlideLesson'
import styles from './learning.module.css'

export function SocratesLearningWorkspace({
  documents,
  assignments,
  preview,
  onLibrary,
  onEdit,
}: {
  documents: SocratesSlideDocument[]
  assignments?: Record<string, SlideAssignment>
  preview?: { id: string; mode: LearningMode }
  onLibrary?: () => void
  onEdit?: (document: SocratesCaseDocument) => void
}) {
  const [progress, setProgress] = useState<LearningProgress>({})
  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState<LearningMode | null>(preview?.mode ?? null)
  const [active, setActive] = useState<string | null>(preview?.id ?? null)
  const [module, setModule] = useState('all')
  const [warning, setWarning] = useState('')
  const title = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let message = ''
    let restoredProgress: LearningProgress = {}
    try {
      const raw = localStorage.getItem(PROGRESS_KEY)
      if (raw && !preview) restoredProgress = progressSchema.parse(JSON.parse(raw))
    } catch {
      message += ' Saved progress could not be restored.'
    }
    // Hydrate browser-only author previews without rendering a different initial slide.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(restoredProgress)
    setWarning(message)
    setReady(true)
  }, [preview])
  useEffect(() => {
    if (ready) title.current?.focus()
  }, [mode, active, ready])

  const allCases = learningDocuments(documents)
  const assignedCases = (target: LearningMode) =>
    assignments ? allCases.filter((doc) => assignments[caseKey(doc)] === target) : allCases
  const cases = preview
    ? allCases.filter((doc) => caseKey(doc) === preview.id)
    : mode
      ? assignedCases(mode)
      : allCases
  const modules = [...new Set(cases.map(moduleName))]
  const selected = cases.find((doc) => caseKey(doc) === active)
  const completed = (doc: SocratesCaseDocument, target: LearningMode) => {
    const saved = currentProgress(doc, progress)
    return target === 'teaching' ? saved.teachingComplete : Boolean(saved.submission)
  }
  const count = (target: LearningMode) =>
    assignedCases(target).filter((doc) => completed(doc, target)).length
  function updateProgress(doc: SocratesCaseDocument, value: CaseProgress) {
    const next = { ...progress, [caseKey(doc)]: value }
    setProgress(next)
    if (preview) return
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
          {preview
            ? 'Author preview · responses are not recorded'
            : 'Module preview · assigned slides only'}
        </span>
        <span>Browser only · unpublished</span>
      </div>
      {warning && (
        <p className={styles.warning} role="alert">
          {warning}
        </p>
      )}
      {onLibrary && (
        <div className={styles.authorActions}>
          <button className={styles.secondary} onClick={onLibrary}>
            <ArrowLeft size={16} /> Slide library & builder
          </button>
          {preview && selected && onEdit && (
            <button className={styles.secondary} onClick={() => onEdit(selected)}>
              <Pencil size={16} /> Return to editing
            </button>
          )}
        </div>
      )}
      {selected && mode ? (
        <>
          <h2 className={styles.srOnly} tabIndex={-1} ref={title}>
            {mode === 'teaching' ? 'Teaching slide' : 'Testing slide'} {cases.indexOf(selected) + 1}
          </h2>
          <SlideLesson
            key={`${caseKey(selected)}-${mode}`}
            document={selected}
            previewOnly={Boolean(preview)}
            mode={mode}
            position={cases.indexOf(selected) + 1}
            total={cases.length}
            progress={currentProgress(selected, progress)}
            onProgress={(value) => updateProgress(selected, value)}
            onBack={() => (preview && onLibrary ? onLibrary() : setActive(null))}
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
              <span className={styles.largeCount}>
                {(mode
                  ? cases.length
                  : new Set(
                      [...assignedCases('teaching'), ...assignedCases('testing')].map(caseKey),
                    ).size
                )
                  .toString()
                  .padStart(2, '0')}
              </span>
              <span>{mode ? 'slides in this module' : 'slides assigned to modules'}</span>
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
                      {new Set(assignedCases('teaching').map(moduleName)).size} curriculum{' '}
                      {new Set(assignedCases('teaching').map(moduleName)).size === 1
                        ? 'section'
                        : 'sections'}
                    </span>
                    <span>
                      {count('teaching')} / {assignedCases('teaching').length} reviewed
                    </span>
                  </div>
                  <button
                    className={styles.primary}
                    disabled={!assignedCases('teaching').length}
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
                      {count('testing')} / {assignedCases('testing').length} submitted
                    </span>
                  </div>
                  <button
                    className={styles.primary}
                    disabled={!assignedCases('testing').length}
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
                  Assign each slide to Teaching or Testing in the shared slide library. Unassigned
                  drafts stay in the library, where you can edit their context, add bounding boxes,
                  and preview either version before deciding.
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
              Assign slides in the slide library to build this module. You can preview unassigned
              drafts there.
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
