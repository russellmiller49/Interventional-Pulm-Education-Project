'use client'

import { BookOpen, FileSearch, Lightbulb } from 'lucide-react'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

import type { CrrtLearnerCitation } from '../sourcePresentation'
import { CrrtDialog } from './CrrtDialog'
import { CrrtGlossaryButton } from './CrrtGlossary'
import { CrrtSourceRecord } from './CrrtSourceRecord'
import styles from './crrt-workbench.module.css'

/**
 * The CRRT Practice / Challenge workbench (CRRT-FELLOW-03, F-09 / F-11 / F-12).
 *
 * This replaces the shared native-workbench frame for CRRT only. That frame put the patient
 * evidence in a single sideways-scrolling strip (3,625 px of content in a 1,265 px box at
 * 1280 × 900, 2,650 px at 390 × 844) and floated "Current task" over its column labels. Here the
 * task and the evidence sit in one column that reads first — beside the case on a wide screen,
 * above it on a narrow one — and the page scrolls natively. Nothing is fixed over content.
 */
export function CrrtWorkbenchLayout({
  navigation,
  currentTask,
  evidence,
  children,
}: {
  readonly navigation?: ReactNode
  readonly currentTask: ReactNode
  readonly evidence: ReactNode
  readonly children: ReactNode
}) {
  const railRef = useRef<HTMLDivElement>(null)
  useScrollableTabStop(railRef)
  return (
    <div className={styles.workbench} data-crrt-workbench>
      {navigation}
      <div className={styles.body}>
        <div
          ref={railRef}
          className={styles.rail}
          data-crrt-workbench-rail
          role="region"
          aria-label="Current task and case evidence"
        >
          {currentTask}
          {evidence}
        </div>
        <section className={styles.main} aria-label="Simulation viewport">
          {children}
        </section>
      </div>
    </div>
  )
}

/**
 * On a wide screen the rail keeps its place beside the case and scrolls on its own when the task
 * and evidence are taller than the window. A region that scrolls must be reachable by keyboard,
 * so it takes a tab stop only while it actually overflows — never an empty stop on a phone.
 */
function useScrollableTabStop(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const update = () => {
      const scrollable = element.scrollHeight > element.clientHeight + 1
      if (scrollable) element.setAttribute('tabindex', '0')
      else element.removeAttribute('tabindex')
    }
    const observer = new ResizeObserver(update)
    observer.observe(element)
    for (const child of Array.from(element.children)) observer.observe(child)
    update()
    return () => observer.disconnect()
  }, [ref])
}

export type CrrtEvidenceBasis = 'supplied' | 'setting' | 'model'

export interface CrrtEvidenceItem {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly basis: CrrtEvidenceBasis
}

const evidenceGroups: readonly {
  readonly basis: CrrtEvidenceBasis
  readonly heading: string
  readonly note: string
}[] = [
  { basis: 'supplied', heading: 'Supplied at case start', note: 'not modeled over time' },
  { basis: 'setting', heading: 'Current settings', note: 'prescription in force' },
  { basis: 'model', heading: 'Live model output', note: 'simulation, now' },
]

/**
 * Every clinical item the old strip carried, wrapped instead of hidden (F-11 / F-12). Items are
 * grouped by where each value comes from — supplied with the case, the current prescription
 * setting, or live simulation output — so a held or supplied number is never read as a simulated
 * response. The active alert always leads, so it cannot sit below the fold of the panel.
 */
export function CrrtEvidenceSummary({
  alert,
  items,
  deviceLabel,
  safetyConstraints,
}: {
  readonly alert: { readonly active: boolean; readonly label: string }
  readonly items: readonly CrrtEvidenceItem[]
  readonly deviceLabel: string
  readonly safetyConstraints: readonly string[]
}) {
  const headingId = useId()
  return (
    <section className={styles.evidence} aria-labelledby={headingId} data-crrt-evidence-summary>
      <h2 id={headingId} className={styles.panelHeading}>
        Live patient, prescription, and circuit
      </h2>
      <dl className={styles.alertRow} data-active={alert.active} data-evidence-id="alert">
        <dt>Active alert · live model</dt>
        <dd>{alert.label}</dd>
      </dl>
      {evidenceGroups.map((group) => {
        const groupItems = items.filter((item) => item.basis === group.basis)
        if (groupItems.length === 0) return null
        return (
          <div key={group.basis} className={styles.evidenceGroup} data-basis={group.basis}>
            <h3>
              {group.heading} <span>· {group.note}</span>
            </h3>
            <dl className={styles.evidenceList}>
              {groupItems.map((item) => (
                <div key={item.id} className={styles.evidenceRow} data-evidence-id={item.id}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )
      })}
      <details className={styles.evidenceMore}>
        <summary>Device profile and safety constraints</summary>
        <p>Device profile: {deviceLabel}</p>
        {safetyConstraints.length > 0 ? (
          <ul aria-label="Safety constraints">
            {safetyConstraints.map((constraint) => (
              <li key={constraint}>{constraint}</li>
            ))}
          </ul>
        ) : null}
      </details>
    </section>
  )
}

export interface CrrtReferenceMaterial {
  readonly reference: {
    readonly id: string
    readonly title: string
    readonly summary: string
    readonly meta?: string
  }
  readonly evidence: readonly {
    readonly id: string
    readonly title: string
    readonly sourceLabel: string
    readonly limitation: string
    readonly limitationLabel?: string
    /** Plain review state; the exact record is one disclosure away (F-19). */
    readonly review?: string
    readonly citation?: CrrtLearnerCitation
  }[]
}

/**
 * What this stage asks for, beside the reference material that supports it.
 *
 * On a phone the body folds behind one toggle so the case is not pushed down a screen; on wider
 * screens it is always open and the toggle is not rendered. Reference and Evidence stay reachable
 * either way, as two separately named buttons rather than one run-on phrase in a footer.
 */
export function CrrtCurrentTask({
  immediateGoal,
  objective,
  requiredAction,
  targets,
  targetsLabel,
  hint,
  material,
  children,
}: {
  readonly immediateGoal: string
  readonly objective: string
  readonly requiredAction: string
  readonly targets: readonly string[]
  readonly targetsLabel: string
  readonly hint?: string
  readonly material: CrrtReferenceMaterial
  readonly children?: ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const [hintVisible, setHintVisible] = useState(false)
  const headingId = useId()
  const bodyId = useId()
  const hintId = useId()
  return (
    <section
      className={styles.task}
      aria-labelledby={headingId}
      data-crrt-current-task
      data-expanded={expanded}
    >
      <div className={styles.taskHeader}>
        <h2 id={headingId} className={styles.panelHeading}>
          Current task
        </h2>
        <button
          type="button"
          className={styles.taskToggle}
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? 'Hide task details' : 'Show task details'}
        </button>
      </div>
      <p className={styles.goal}>
        <strong>Immediate goal</strong> {immediateGoal}
      </p>
      <div id={bodyId} className={styles.taskBody}>
        <div className={styles.taskCard}>
          <strong>Required action</strong>
          <p>{requiredAction}</p>
        </div>
        <details className={styles.targets}>
          <summary>
            Objective and {targetsLabel.toLowerCase()}
            {targets.length > 0 ? ` (${targets.length})` : ''}
          </summary>
          <p>{objective}</p>
          {targets.length > 0 ? (
            <ul aria-label={targetsLabel}>
              {targets.map((target) => (
                <li key={target}>{target}</li>
              ))}
            </ul>
          ) : null}
        </details>
        {hint && hintVisible ? (
          <div className={styles.hint} id={hintId} role="status">
            <strong>Hint</strong>
            <p>{hint}</p>
          </div>
        ) : null}
        {children}
      </div>
      <div className={styles.materialActions} role="group" aria-label="Hint and reference material">
        {hint ? (
          // A passive reveal: the hint is announced where it appears and focus stays here.
          <button
            type="button"
            className={styles.materialButton}
            aria-expanded={hintVisible}
            aria-controls={hintVisible ? hintId : undefined}
            onClick={() => setHintVisible((visible) => !visible)}
          >
            <Lightbulb aria-hidden="true" /> {hintVisible ? 'Hide hint' : 'Show hint'}
          </button>
        ) : null}
        <CrrtMaterialDrawer
          material={material}
          kind="reference"
          trigger={
            <button type="button" className={styles.materialButton}>
              <BookOpen aria-hidden="true" /> Reference
            </button>
          }
        />
        <CrrtMaterialDrawer
          material={material}
          kind="evidence"
          trigger={
            <button type="button" className={styles.materialButton}>
              <FileSearch aria-hidden="true" /> Evidence
            </button>
          }
        />
        <CrrtGlossaryButton className={styles.materialButton} />
      </div>
    </section>
  )
}

/** Keep long source locators readable without changing other modules' shared drawers. */
function CrrtMaterialDrawer({
  material,
  kind,
  trigger,
}: {
  readonly material: CrrtReferenceMaterial
  readonly kind: 'reference' | 'evidence'
  readonly trigger: ReactElement
}) {
  const reference = kind === 'reference'
  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className={styles.materialContent} data-crrt-material={kind}>
        <SheetHeader className={styles.materialHeader}>
          <SheetTitle>{reference ? 'Reference' : 'Evidence and model limits'}</SheetTitle>
          <SheetDescription>
            {reference
              ? 'Point-of-use learning records. Return to the activity when ready.'
              : 'Versioned sources and boundaries for this educational activity.'}
          </SheetDescription>
        </SheetHeader>
        <div className={styles.materialBody}>
          {reference ? (
            <article className={styles.materialEntry}>
              <h3>{material.reference.title}</h3>
              <p>{material.reference.summary}</p>
              {material.reference.meta ? <p>{material.reference.meta}</p> : null}
            </article>
          ) : (
            material.evidence.map((entry) => (
              <article key={entry.id} className={styles.materialEntry}>
                <h3>{entry.title}</h3>
                <p>{entry.sourceLabel}</p>
                {entry.review ? <p>{entry.review}</p> : null}
                <p>
                  <strong>{entry.limitationLabel ?? 'Limit'}:</strong> {entry.limitation}
                </p>
                {entry.citation ? <CrrtSourceRecord citation={entry.citation} /> : null}
              </article>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/**
 * Help as a deliberate, visible surface (F-09). Before this, Help revealed its hint inside the
 * collapsed "Current task" drawer, so a click changed nothing a learner could see and focus stayed
 * on the button. The dialog shows the case's existing first hint and where each surface lives.
 * Opening or closing it dispatches nothing: no time, setting, answer, record or score changes.
 */
export function CrrtHelpDialog({
  open,
  onOpenChange,
  returnFocusRef,
  hint,
  caseTitle,
  includesCaseNavigation,
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly returnFocusRef: RefObject<HTMLElement | null>
  readonly hint?: string
  readonly caseTitle: string
  readonly includesCaseNavigation: boolean
}) {
  return (
    <CrrtDialog
      open={open}
      onOpenChange={onOpenChange}
      returnFocusRef={returnFocusRef}
      title="Help for this case"
      description={`${caseTitle}. Opening help changes nothing in your run: no simulated time passes, no setting changes, and nothing is recorded or judged.`}
    >
      <div className={styles.help} data-crrt-help-surface>
        <section aria-labelledby="crrt-help-hint">
          <h3 id="crrt-help-hint">Hint</h3>
          <p>
            {hint ?? 'This case has no authored hint. Use the current task and Reference below.'}
          </p>
        </section>
        <section aria-labelledby="crrt-help-where">
          <h3 id="crrt-help-where">Where things are</h3>
          <ul>
            <li>
              <strong>Current task</strong> — what this stage asks you to do, with the case findings
              to review.
            </li>
            <li>
              <strong>Live patient, prescription, and circuit</strong> — the active alert first,
              then values grouped as supplied at case start (not modeled over time), current
              settings, and live model output.
            </li>
            <li>
              <strong>Case, Machine + circuit, Patient &amp; trends, Debrief</strong> — the tabs
              above the case. Actions are on Case; the console and live pressures are on Machine +
              circuit.
            </li>
            <li>
              <strong>Reference</strong> opens the case description and its sources.{' '}
              <strong>Evidence</strong>
              {' opens each source’s scope and limits. '}
              <strong>Glossary</strong>
              {
                ' defines the terms used here — PBP, effluent, net machine removal (PFR), whole-patient balance and more.'
              }
            </li>
            {includesCaseNavigation ? (
              <li>
                <strong>Cases</strong> — above the task: choose any case, or step to the previous or
                next one. The address bar keeps the case you are on, so reload and Back work.
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    </CrrtDialog>
  )
}
