import type { ReactNode } from 'react'

import { ecmoDerivedValueGuides } from '../../../content/ecmoValueGuides'
import type { EcmoChannelReadout, EcmoSimulationState, SupportMode } from '../../../engine/types'
import {
  predictionControls,
  predictionDirections,
  predictionGoals,
} from '../../../content/scenarios'
import { UNAVAILABLE_INDICATION, formatChannelReadout } from '../../channelReadout'
import { ModelBoundary, TextEquivalent, styles } from '../shared'

/**
 * Structure shared by every live drill teaching panel.
 *
 * The panels answer a fixed set of questions in a fixed order, and the order is the teaching: a
 * learner is asked what is being decided, then which signals can be believed and where they were
 * taken, then what the pattern is — before any mechanism is named. That sequence is what stops the
 * panel becoming a label the learner reads instead of a circuit the learner reads.
 *
 * The split at `AfterCommitment` is the anti-leak boundary. Everything above it teaches how to
 * inspect the state; everything below it names a mechanism, a fitting response, or a harmful reflex,
 * and any of those before the learner has chosen would hand over the authored answer. The gate is
 * the engine's own `scenario.prediction.committed`, so it cannot drift away from what the learner
 * actually did.
 */

/* ------------------------------------------------------------------ *
 * Signal provenance
 * ------------------------------------------------------------------ */

/**
 * What kind of claim a displayed number is.
 *
 * The first three mirror `EcmoReadoutStatus` exactly, because a panel that re-derived them would be
 * a second opinion about a question A1 already settled. The last three exist because a panel shows
 * quantities this console never displays at all: a value measured somewhere else entirely, a model
 * estimate, and a value this case simply asserts.
 *
 * `off-console` is load-bearing rather than a nicety. A bedside oximeter, an arterial blood gas, the
 * blender settings and an echocardiographic estimate are the other three of the four domains this
 * module teaches, and calling any of them `valid` would say the console can display them — which is
 * exactly the conflation the startup drill exists to break.
 */
export type DrillSignalKind =
  | 'valid'
  | 'device-unavailable'
  | 'simulation-unmodeled'
  | 'off-console'
  | 'estimated'
  | 'derived'
  | 'authored'
  /**
   * A physical state of the circuit that exists at the bedside and has no console channel at all —
   * a manual clamp, for instance. Distinct from `off-console`, which is measured by *something*;
   * nothing measures these. Calling one `valid` would tell a learner the console can be consulted
   * to confirm whether the patient is isolated, which is the exact conflation the air drill exists
   * to break.
   */
  | 'bedside'

/*
 * Short on the row, explained once under the table.
 *
 * The first draft carried the whole sentence on every row, so a nine-row register repeated "the
 * model produced it and the console can display it" nine times and buried the note that was the
 * actual teaching. The words are still there — the contract requires the kind to be readable as
 * words rather than carried by colour — they are just said once.
 */
const SIGNAL_KIND_LABEL: Readonly<Record<DrillSignalKind, string>> = {
  valid: 'On the console',
  'device-unavailable': 'Unavailable on this console',
  'simulation-unmodeled': 'Not modeled here',
  'off-console': 'Measured off the console',
  estimated: 'Model estimate',
  derived: 'Derived in this simulation',
  authored: 'Authored by this case',
  bedside: 'At the bedside, not on the console',
}

const SIGNAL_KIND_LEGEND: Readonly<Record<DrillSignalKind, string>> = {
  valid: 'this console measures and displays it, and the model produced a value it can show',
  'device-unavailable':
    'the console would not show a number here — the sensor is not reporting, or the value is outside the range it displays',
  'simulation-unmodeled':
    'this simulation has no value to offer for this state, which is not a claim about what the device would show',
  'off-console':
    'measured on the patient or on another device. This console neither produces nor displays it',
  estimated: 'derived by the model rather than measured by anything',
  derived:
    'calculated from other live or authored values in this simulation rather than measured by a sensor',
  authored: 'set by this case rather than measured',
  bedside:
    'a physical state of the circuit at the bedside. This console has no sensor for it and never displays it',
}

/** The kinds, as a value, so a test cannot pin a stale count of them. */
export const DRILL_SIGNAL_KINDS = Object.keys(SIGNAL_KIND_LABEL) as readonly DrillSignalKind[]

export interface DrillSignalRow {
  readonly label: string
  /** Where in the circuit or on the patient this number is taken. */
  readonly measuredAt: string
  readonly value: string
  readonly kind: DrillSignalKind
  /** Registered guide for a number the panel interprets. Non-numeric state labels omit it. */
  readonly valueGuideKey?: keyof typeof ecmoDerivedValueGuides
  /** What this signal can, and cannot, be asked. */
  readonly note: string
}

/** A console pressure or saturation channel, classified by the engine's own readout status. */
export function channelSignalRow(
  label: string,
  measuredAt: string,
  readout: EcmoChannelReadout,
  unit: string,
  note: string,
  precision = 0,
  valueGuideKey?: keyof typeof ecmoDerivedValueGuides,
): DrillSignalRow {
  const formatted = formatChannelReadout(label, readout, unit, precision)
  return {
    label,
    measuredAt,
    value: formatted.displayText,
    kind: readout.status,
    valueGuideKey,
    note: formatted.available ? note : `${note} ${readout.reason}`.trim(),
  }
}

/** A value measured on the patient or on a device other than this console. */
export function offConsoleSignalRow(
  label: string,
  measuredAt: string,
  value: string,
  note: string,
  valueGuideKey?: keyof typeof ecmoDerivedValueGuides,
): DrillSignalRow {
  return { label, measuredAt, value, kind: 'off-console', note, valueGuideKey }
}

export function valueSignalRow(
  label: string,
  measuredAt: string,
  value: string,
  note: string,
  kind: DrillSignalKind = 'valid',
  valueGuideKey?: keyof typeof ecmoDerivedValueGuides,
): DrillSignalRow {
  return { label, measuredAt, value, kind, note, valueGuideKey }
}

/**
 * Questions 2 and 3 together: what each signal is worth, and where it was taken.
 *
 * "What it is worth" is deliberately a claim about the measurement, not about the case: where the
 * number comes from, what it is and is not (a circuit pressure is not a patient arterial pressure),
 * and why it is or is not available. Ranking two signals against each other for *this* question is
 * an interpretation, and interpretations belong after the commitment — which is why some panels
 * render a second register inside `AfterCommitment` rather than saying more in the first.
 */
export function SignalRegister({
  rows,
  summary,
  title = 'What is on screen, and what each reading is worth',
  headingId = 'drill-signals-heading',
}: {
  readonly rows: readonly DrillSignalRow[]
  readonly summary: ReactNode
  readonly title?: string
  readonly headingId?: string
}) {
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.heading}>
        {title}
      </h3>
      {/*
        Focusable, because it is the only way to reach the columns it clips. The teaching pane is
        `overflow-x: hidden`, so when this table is wider than the pane a pointer user can drag it
        sideways and a keyboard user previously could not reach the "what it is worth" column at all.
        A scroll container that holds content needs a name and a tab stop.
      */}
      <div
        className="mt-3 overflow-x-auto"
        tabIndex={0}
        role="group"
        aria-labelledby={headingId}
        data-signal-register-scroller
      >
        <table className="w-full text-sm" data-signal-register>
          <caption className="sr-only">
            Every signal this drill turns on, where it is measured, and whether it is valid,
            unavailable, unmodeled, estimated, derived, off the console, at the bedside, or
            authored.
          </caption>
          <thead>
            <tr className="text-left">
              <th scope="col" className="pr-3 pb-1">
                Signal
              </th>
              <th scope="col" className="pr-3 pb-1">
                Measured at
              </th>
              <th scope="col" className="pr-3 pb-1">
                Now
              </th>
              <th scope="col" className="pb-1">
                What it is worth
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.label}
                data-signal={row.label}
                data-signal-kind={row.kind}
                data-value-guide-id={
                  row.valueGuideKey ? ecmoDerivedValueGuides[row.valueGuideKey].id : undefined
                }
              >
                <th scope="row" className="pr-3 pt-3 align-top font-semibold">
                  {row.label}
                </th>
                <td className="pr-3 pt-3 align-top" data-signal-site>
                  {row.measuredAt}
                </td>
                <td className="pr-3 pt-3 align-top font-semibold" data-signal-value>
                  {row.value}
                </td>
                <td className="pt-3 align-top">
                  <span className="inline-block" data-signal-kind-label>
                    {SIGNAL_KIND_LABEL[row.kind]}
                  </span>
                  <span className="mt-1 block text-muted-foreground">{row.note}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="mt-3 grid gap-1" data-signal-kind-legend>
        {(Object.keys(SIGNAL_KIND_LEGEND) as DrillSignalKind[])
          .filter((kind) => rows.some((row) => row.kind === kind))
          .map((kind) => (
            <div key={kind} className="flex flex-wrap gap-1">
              <dt className="font-semibold">{SIGNAL_KIND_LABEL[kind]}:</dt>
              <dd className="text-muted-foreground">{SIGNAL_KIND_LEGEND[kind]}.</dd>
            </div>
          ))}
      </dl>
      <TextEquivalent>{summary}</TextEquivalent>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * The pattern, before any mechanism is named
 * ------------------------------------------------------------------ */

export interface DrillPatternRow {
  readonly label: string
  readonly reading: string
  readonly movement: string
}

/**
 * Question 4. Description only — what each thing reads, and where to compare it.
 *
 * The `movement` column says what to compare a row with, never how the comparison came out. "Read
 * these against the flow beside them" is a reading instruction; "these fell with the flow, so the
 * limitation is upstream" is the answer to the question the learner has not yet been allowed to
 * answer.
 */
export function PatternReading({
  rows,
  summary,
  title = 'The pattern in front of you',
  headingId = 'drill-pattern-heading',
}: {
  readonly rows: readonly DrillPatternRow[]
  readonly summary: ReactNode
  readonly title?: string
  readonly headingId?: string
}) {
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.heading}>
        {title}
      </h3>
      <dl className="mt-3 grid gap-2" data-drill-pattern>
        {rows.map((row) => (
          <div key={row.label} className="rounded-xl border px-3 py-2" data-pattern-row={row.label}>
            <dt className="font-semibold">{row.label}</dt>
            <dd className="mt-1">
              <span data-pattern-reading>{row.reading}</span>{' '}
              <span className="text-muted-foreground" data-pattern-movement>
                {row.movement}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <TextEquivalent>{summary}</TextEquivalent>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Pre-commitment discriminators
 * ------------------------------------------------------------------ */

export interface DrillDiscriminator {
  /** Phrased as a question. An answer here would be the prediction's answer. */
  readonly question: string
  readonly whereToLook: string
}

/**
 * What distinguishes the candidate explanations, asked rather than answered.
 *
 * This is the whole of what a panel may say before commitment about competing mechanisms: which
 * observation separates them, and where to make it. Reporting which way the observation has already
 * come out would name the mechanism, which is the thing the learner is being asked to name.
 */
export function Discriminators({ items }: { readonly items: readonly DrillDiscriminator[] }) {
  return (
    <section className={styles.section} aria-labelledby="drill-discriminators-heading">
      <h3 id="drill-discriminators-heading" className={styles.heading}>
        Questions that separate the possibilities
      </h3>
      <ul className="mt-3 grid gap-2" data-drill-discriminators>
        {items.map((item) => (
          <li key={item.question} className="rounded-xl border px-3 py-2" data-discriminator>
            <p className="font-semibold">{item.question}</p>
            <p className="mt-1 text-muted-foreground">{item.whereToLook}</p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-muted-foreground" data-precommit-note>
        These are questions, not answers. Which way each one falls is what you are being asked to
        commit to.
      </p>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * The commitment gate
 * ------------------------------------------------------------------ */

/** What the learner actually sent the engine, echoed with the authored labels. */
function CommittedChoice({ state }: { readonly state: EcmoSimulationState }) {
  const { goalId, control, direction } = state.scenario.prediction
  const goalLabel = predictionGoals.find((goal) => goal.id === goalId)?.label
  const controlLabel = predictionControls.find((item) => item.value === control)?.label
  const directionLabel = predictionDirections.find((item) => item.value === direction)?.label
  if (!goalLabel && !controlLabel && !directionLabel) return null
  return (
    <p className="rounded-xl border border-dashed px-3 py-2" data-committed-choice>
      <span className="font-semibold">You committed to: </span>
      {[goalLabel, controlLabel, directionLabel].filter(Boolean).join(' · ')}.{' '}
      <span className="text-muted-foreground">
        Whether that was the best of the authored options is answered beside the question, not here.
      </span>
    </p>
  )
}

/**
 * The mechanism half of the panel, withheld until the learner has chosen.
 *
 * `state.scenario.prediction.committed` is the gate rather than a prop, so a panel cannot be handed
 * a truthy flag by a caller that has not actually taken a commitment — and so reloading a scenario,
 * which clears the commitment, correctly puts the panel back to its pre-commitment shape.
 */
export function AfterCommitment({
  state,
  children,
}: {
  readonly state: EcmoSimulationState
  readonly children: ReactNode
}) {
  if (!state.scenario.prediction.committed) {
    return (
      <section
        className={styles.section}
        aria-labelledby="drill-withheld-heading"
        data-withheld-until-commitment
      >
        <h3 id="drill-withheld-heading" className={styles.heading}>
          Held back until you commit
        </h3>
        <p className="mt-2">
          The mechanism, the response that fits it, and the reflex to avoid are all held until you
          have committed a prediction. Reading them first would answer the question for you.
        </p>
      </section>
    )
  }
  return (
    <div className="grid gap-4" data-after-commitment>
      <CommittedChoice state={state} />
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Post-commitment blocks
 * ------------------------------------------------------------------ */

/** Question 5. */
export function Mechanism({ children }: { readonly children: ReactNode }) {
  return (
    <section className={styles.section} aria-labelledby="drill-mechanism-heading">
      <h3 id="drill-mechanism-heading" className={styles.heading}>
        What best explains it
      </h3>
      <div className="mt-2 grid gap-2" data-drill-mechanism>
        {children}
      </div>
    </section>
  )
}

export interface DrillCompetingExplanation {
  readonly candidate: string
  /** Why it remains on the table, or what would have to be true for it to be the answer. */
  readonly standing: string
}

/** Question 6. Never "ruled out" — what is left open, and on what. */
export function CompetingExplanations({
  items,
}: {
  readonly items: readonly DrillCompetingExplanation[]
}) {
  return (
    <section className={styles.section} aria-labelledby="drill-competing-heading">
      <h3 id="drill-competing-heading" className={styles.heading}>
        What is still on the table
      </h3>
      <dl className="mt-3 grid gap-2" data-drill-competing>
        {items.map((item) => (
          <div key={item.candidate} className="rounded-xl border px-3 py-2" data-competing>
            <dt className="font-semibold">{item.candidate}</dt>
            <dd className="mt-1">{item.standing}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** Question 7. */
export function FittingResponse({ children }: { readonly children: ReactNode }) {
  return (
    <section className={styles.section} aria-labelledby="drill-response-heading">
      <h3 id="drill-response-heading" className={styles.heading}>
        The move that fits the mechanism
      </h3>
      <div className="mt-2 grid gap-2" data-drill-fitting-response>
        {children}
      </div>
    </section>
  )
}

/** Question 8. Three domains, always all three, always separately. */
export function ThreeDomainResponse({
  device,
  circuitOrGas,
  patient,
  circuitOrGasLabel = 'Circuit',
}: {
  readonly device: ReactNode
  readonly circuitOrGas: ReactNode
  readonly patient: ReactNode
  readonly circuitOrGasLabel?: string
}) {
  return (
    <section className={styles.section} aria-labelledby="drill-domains-heading">
      <h3 id="drill-domains-heading" className={styles.heading}>
        What should happen, by domain
      </h3>
      <dl className="mt-3 grid gap-2" data-drill-domains>
        <div className="rounded-xl border px-3 py-2" data-domain="device">
          <dt className="font-semibold">Device</dt>
          <dd className="mt-1">{device}</dd>
        </div>
        <div className="rounded-xl border px-3 py-2" data-domain="circuit-or-gas">
          <dt className="font-semibold">{circuitOrGasLabel}</dt>
          <dd className="mt-1">{circuitOrGas}</dd>
        </div>
        <div className="rounded-xl border px-3 py-2" data-domain="patient">
          <dt className="font-semibold">Patient</dt>
          <dd className="mt-1">{patient}</dd>
        </div>
      </dl>
    </section>
  )
}

/** Question 9. */
export function HarmfulReflex({
  action,
  children,
}: {
  readonly action: string
  readonly children: ReactNode
}) {
  return (
    <section className={styles.section} aria-labelledby="drill-reflex-heading">
      <h3 id="drill-reflex-heading" className={styles.heading}>
        The reflex that does harm here
      </h3>
      <p className="mt-2 font-semibold" data-harmful-reflex={action}>
        {action}
      </p>
      <div className="mt-1 grid gap-2">{children}</div>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Frame
 * ------------------------------------------------------------------ */

/** Question 1 and the panel's identity. Question 10 closes it. */
export function DrillPanelFrame({
  scenarioId,
  supportMode,
  clinicalQuestion,
  boundaries,
  reviewStatus,
  creditEligible,
  children,
}: {
  readonly scenarioId: string
  readonly supportMode: SupportMode
  readonly clinicalQuestion: ReactNode
  /** Question 10. At least one, always, and always phrased about this simulation. */
  readonly boundaries: readonly ReactNode[]
  /** B6 metadata. Omitted on frozen pilot files so their learner-facing copy stays untouched. */
  readonly reviewStatus?: 'draft' | 'frozen-pilot'
  readonly creditEligible?: boolean
  readonly children: ReactNode
}) {
  return (
    <div
      className={styles.panel}
      data-teaching-panel={scenarioId}
      data-drill-panel={scenarioId}
      data-drill-support-mode={supportMode}
      data-panel-review-status={reviewStatus}
      data-panel-credit-eligible={creditEligible === undefined ? undefined : String(creditEligible)}
    >
      <section className={styles.section} aria-labelledby="drill-question-heading">
        <h3 id="drill-question-heading" className={styles.heading}>
          What is being decided
        </h3>
        <p className="mt-2" data-clinical-question>
          {clinicalQuestion}
        </p>
      </section>
      {children}
      <section className={styles.section} aria-labelledby="drill-boundary-heading">
        <h3 id="drill-boundary-heading" className={styles.heading}>
          What this simulation cannot show you
        </h3>
        {boundaries.map((boundary, index) => (
          // Authored prose in a fixed list; there is no other stable key and the list never reorders.
          <ModelBoundary key={index}>{boundary}</ModelBoundary>
        ))}
      </section>
    </div>
  )
}

/** The dash the console shows, reused so panels never hard-code their own. */
export { UNAVAILABLE_INDICATION }
