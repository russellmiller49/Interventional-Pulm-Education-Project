import type { ReactNode } from 'react'

import { DerivedValueReadout } from '@/features/critical-care/components/teaching/EvidenceRenderers'
import type { CriticalCareDerivedValueGuide } from '@/features/critical-care/content/derivedValueGuides'

import { MCS_NUMBERS, type McsNumberId } from '../../content/teachingNumbers'
import type { McsAlarm } from '../../engine/types'
import {
  MCS_DISPLAY_DEADBANDS,
  MCS_UNMODELED_ORGAN_SIGNALS,
  mcsAlarmPriorityWords,
  mcsDirectionMarks,
  mcsDirectionWords,
  mcsLiveValueKindLabels,
  reading,
  type McsBeforeAfterReading,
  type McsFlowAccountView,
  type McsLiveValueKind,
  type McsPathwayView,
  type McsUnmodeledSignal,
} from './selectors'

/**
 * The primitives every MCS live teaching panel is built from.
 *
 * Written as utility-class markup rather than against the module stylesheet on purpose: the offline
 * review harness renders these components with `renderToStaticMarkup`, and a CSS-module import would
 * make that harness need a bundler shim before it could show a reviewer anything.
 *
 * Four rules are enforced structurally rather than left to an author's memory.
 *
 *  - Nothing is carried by colour. Every direction has a word and a mark, every alarm prints its
 *    priority in words, and every value prints what kind of quantity it is.
 *  - Every figure carries a text equivalent with the same numbers in it, not a description of the
 *    picture.
 *  - `min-w-0` sits on every section, because these render as grid items inside a narrow secondary
 *    pane and a grid item's default `min-width: auto` lets one wide table push the whole pane wider.
 *    Anything that genuinely cannot fit scrolls inside its own labelled wrapper.
 *  - No animation, no transition, no hover-only content. There is nothing here for a reduced-motion
 *    preference to suppress and nothing a pointer reveals that a keyboard does not.
 */

export const styles = {
  panel: 'grid gap-4 min-w-0',
  section: 'min-w-0 rounded-2xl border p-4',
  heading: 'text-sm font-semibold uppercase tracking-wide text-muted-foreground',
  subheading: 'text-xs font-semibold uppercase tracking-wide text-muted-foreground',
  caption: 'mt-2 text-xs leading-5 text-muted-foreground',
  scroller: 'mt-3 overflow-x-auto',
  table: 'w-full text-left text-sm',
} as const

/* ------------------------------------------------------------------ *
 * Section shell
 * ------------------------------------------------------------------ */

/**
 * A titled block inside a panel, with the heading wired to the region that owns it.
 *
 * `reference` folds the block behind its own heading. Section 9's first step ran to roughly 4,400
 * words because the seven-question scaffold, both threshold sources, the complete-profile boundary,
 * the two interpreted values and the bridge/exit note were all open at once, on three steps in a
 * row (F30). The scaffold a step is worked from stays open; the blocks that are there to be looked
 * up fold to a labelled disclosure, one click away, for everyone — nothing is removed and nothing
 * is hidden from assistive technology. A block that carries a consequential limit at its point of
 * use is never marked `reference`.
 */
export function PanelSection({
  title,
  id,
  reference = false,
  children,
}: {
  readonly title: string
  /** Stable id, so the accessible name does not change between renders. */
  readonly id: string
  /** Lookup material: folded behind its heading, open on request. */
  readonly reference?: boolean
  readonly children: ReactNode
}) {
  const headingId = `mcs-panel-${id}`
  if (reference) {
    return (
      <details
        className={styles.section}
        aria-labelledby={headingId}
        data-panel-section={id}
        data-panel-reference
      >
        <summary className="cursor-pointer">
          <h4 id={headingId} className={`${styles.heading} inline`}>
            {title}
          </h4>
          <span className="ml-2 text-xs text-muted-foreground" data-panel-reference-label>
            Reference · open to read
          </span>
        </summary>
        {children}
      </details>
    )
  }
  return (
    <section className={styles.section} aria-labelledby={headingId} data-panel-section={id}>
      <h4 id={headingId} className={styles.heading}>
        {title}
      </h4>
      {children}
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Text equivalent, simulator-value note, figure caption
 * ------------------------------------------------------------------ */

/**
 * The same relationships and the same numbers as the figure, in prose. Never decorative.
 *
 * Folded behind "In words", for everyone. Printed open, each of these repeated the figure above it
 * and together they were about six thousand words of a walk through the module (F06, F39); the
 * suggestion to make them screen-reader-only would have taken a useful alternative away from
 * sighted readers who prefer a sentence to a table. A native disclosure keeps it one keystroke away
 * for any reader, and it is still in the document for assistive technology and for find-in-page.
 */
export function TextEquivalent({ children }: { readonly children: ReactNode }) {
  return (
    <details className="mt-2 text-xs leading-5 text-muted-foreground" data-text-equivalent>
      <summary className="cursor-pointer font-semibold" data-text-equivalent-summary>
        In words
      </summary>
      <p className="mt-1">{children}</p>
    </details>
  )
}

/** The author named in each short citation, keyed by the register's source id. */
const MCS_NUMBER_SOURCE_NAMES: Readonly<Record<string, string>> = {
  'impella-cp-ifu-rev-v-supplied': 'Impella CP instructions for use',
  'impella-55-ifu-rev-l-supplied': 'Impella 5.5 instructions for use',
  'TEXT-CASE-BASED-LVAD-INPATIENT-2021': 'Steiner & Tran',
  'TEXT-CASE-BASED-LVAD-OUTPATIENT-2021': 'Yousefzai & Urey',
  'TEXT-CASE-BASED-LVAD-COMPLICATIONS-2021': 'Perna & Wettersten',
}

/**
 * The numbers a fellow holds a live reading against, each with where it comes from.
 *
 * It sits directly under the live values it applies to. `title` says which device or patient the
 * numbers are for.
 */
export function ReferenceValues({
  title,
  ids,
  children,
}: {
  readonly title: string
  readonly ids: readonly McsNumberId[]
  readonly children?: ReactNode
}) {
  return (
    <section className="mt-3 min-w-0 rounded-xl border px-3 py-2" data-reference-values>
      <h4 className="text-xs font-semibold">{title}</h4>
      <dl className="mt-1 grid gap-1 text-xs leading-5">
        {ids.map((id) => {
          const row = MCS_NUMBERS.get(id)
          return (
            <div key={id} data-teaching-number={id}>
              <dt className="inline font-medium">{row.label}: </dt>
              <dd className="inline">
                <strong>{row.value}</strong>{' '}
                <small className="text-muted-foreground">
                  (
                  {row.sources
                    .map(
                      (source) =>
                        `${MCS_NUMBER_SOURCE_NAMES[source.sourceId] ?? source.sourceId} ${source.year}`,
                    )
                    .join('; ')}
                  )
                </small>
              </dd>
            </div>
          )
        })}
      </dl>
      {children}
    </section>
  )
}

/**
 * A limit of the simulator, printed only where a learner could take a simulated value for one a
 * real console or patient would give.
 */
export function ModelBoundary({ children }: { readonly children: ReactNode }) {
  return (
    <p
      className="mt-3 rounded-xl border border-dashed px-3 py-2 text-xs leading-5"
      data-model-boundary
    >
      <span className="font-semibold">Simulator value. </span>
      {children}
    </p>
  )
}

/** One line saying what the figure above it shows. */
export function FigureCaption({ children }: { readonly children: ReactNode }) {
  return (
    <p className="mt-3 text-xs leading-5 text-muted-foreground" data-figure-caption>
      {children}
    </p>
  )
}

/** Shown instead of a figure while the buffer that feeds it is still filling. */
export function WaitingState({ label }: { readonly label: string }) {
  return (
    <p className="mt-3 text-sm text-muted-foreground" role="status" data-waiting-state={label}>
      Waiting for the {label} to collect enough samples to draw.
    </p>
  )
}

/* ------------------------------------------------------------------ *
 * Values
 * ------------------------------------------------------------------ */

/**
 * One live value with the kind of quantity it is spelled out beside it.
 *
 * The kind is never abbreviated to a badge colour, and the vocabulary has no `measured` member —
 * see `McsLiveValueKind`.
 */
export function LiveValue({
  label,
  value,
  unit,
  kind,
  digits = 1,
  note,
}: {
  readonly label: string
  readonly value: number | null | undefined
  readonly unit?: string
  readonly kind: McsLiveValueKind
  readonly digits?: number
  readonly note?: ReactNode
}) {
  const text = reading(value, digits)
  const unavailable = text === 'not available'
  return (
    <div
      className="min-w-0 rounded-xl border p-3"
      data-live-value={label}
      data-live-value-kind={kind}
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">
        {unavailable ? text : `${text}${unit ? ` ${unit}` : ''}`}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground" data-live-value-kind-label>
        {mcsLiveValueKindLabels[kind]}
      </p>
      {note ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{note}</p> : null}
    </div>
  )
}

/** A device setting that is a word rather than a number — a trigger source, a placement state. */
export function LiveSetting({
  label,
  value,
  kind = 'displayed',
  note,
}: {
  readonly label: string
  readonly value: string
  readonly kind?: McsLiveValueKind
  readonly note?: ReactNode
}) {
  return (
    <div
      className="min-w-0 rounded-xl border p-3"
      data-live-value={label}
      data-live-value-kind={kind}
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-base font-semibold">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground" data-live-value-kind-label>
        {mcsLiveValueKindLabels[kind]}
      </p>
      {note ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{note}</p> : null}
    </div>
  )
}

/** A value the model does not produce at all, said out loud rather than left off the figure. */
export function NotModeled({
  label,
  whyItMatters,
}: {
  readonly label: string
  readonly whyItMatters: ReactNode
}) {
  return (
    <div
      className="min-w-0 rounded-xl border border-dashed p-3"
      data-live-value={label}
      data-live-value-kind="not-modeled"
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">not in the simulator</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground" data-live-value-kind-label>
        {mcsLiveValueKindLabels['not-modeled']}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{whyItMatters}</p>
    </div>
  )
}

/** The organ-level signals this engine never produces, as one block. */
export function UnmodeledOrganResponse({
  signals = MCS_UNMODELED_ORGAN_SIGNALS,
}: {
  readonly signals?: readonly McsUnmodeledSignal[]
}) {
  return (
    <div data-unmodeled-organ-response>
      <ul className="mt-3 grid gap-2">
        {signals.map((signal) => (
          <li
            key={signal.id}
            className="rounded-xl border border-dashed p-2 text-xs leading-5"
            data-unmodeled-signal={signal.id}
          >
            <span className="font-semibold">{signal.label}. </span>
            {signal.whyItMatters}
          </li>
        ))}
      </ul>
      <TextEquivalent>
        {signals.map((signal) => signal.label).join(', ')}: read these at the bedside. The simulator
        has none of them.
      </TextEquivalent>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Before and after
 * ------------------------------------------------------------------ */

/**
 * The baseline the runtime captured on entering the act phase, the reading now, and the direction.
 *
 * Both raw values are always printed, so the direction word never stands in for them, and the
 * deadband that produced the word is named in the caption rather than left implicit.
 */
export function BeforeAfter({
  rows,
  baselineLabel,
  currentLabel = 'Now',
  caption,
}: {
  readonly rows: readonly McsBeforeAfterReading[]
  readonly baselineLabel: string
  readonly currentLabel?: string
  readonly caption: string
}) {
  return (
    <div className={styles.scroller}>
      <table className={styles.table} data-before-after-figure>
        <caption className="text-left text-xs leading-5 text-muted-foreground">
          {caption} {DEADBAND_NOTE}
        </caption>
        <thead>
          <tr>
            <th scope="col" className="pb-1 pr-3 font-semibold">
              Reading
            </th>
            <th scope="col" className="pb-1 pr-3 font-semibold">
              {baselineLabel}
            </th>
            <th scope="col" className="pb-1 pr-3 font-semibold">
              {currentLabel}
            </th>
            <th scope="col" className="pb-1 font-semibold">
              Direction
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row.metric)} data-before-after-row={String(row.metric)}>
              <th scope="row" className="py-1 pr-3 font-medium">
                {row.label}
                <span className="block text-xs font-normal text-muted-foreground">
                  {mcsLiveValueKindLabels[row.kind]}
                </span>
              </th>
              <td className="py-1 pr-3 text-muted-foreground" data-baseline-value>
                {row.baselineMissing
                  ? 'not captured yet'
                  : `${reading(row.before, row.digits)}${row.unit ? ` ${row.unit}` : ''}`}
              </td>
              <td className="py-1 pr-3 font-semibold" data-current-value>
                {`${reading(row.current, row.digits)}${row.unit ? ` ${row.unit}` : ''}`}
              </td>
              <td className="py-1" data-direction={row.direction}>
                <span aria-hidden="true">{mcsDirectionMarks[row.direction]} </span>
                {row.baselineMissing ? 'no baseline' : mcsDirectionWords[row.direction]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** The same table in prose, so the comparison is never only in a table. */
export function beforeAfterSentence(rows: readonly McsBeforeAfterReading[]): string {
  return rows
    .map((row) => {
      if (row.baselineMissing) {
        return `${row.label} reads ${reading(row.current, row.digits)}${row.unit ? ` ${row.unit}` : ''} with no baseline captured`
      }
      return `${row.label} moved from ${reading(row.before, row.digits)} to ${reading(row.current, row.digits)}${row.unit ? ` ${row.unit}` : ''}, ${mcsDirectionWords[row.direction]}`
    })
    .join('. ')
}

/**
 * The transfer patient, read live, with nothing carried across from the previous one.
 *
 * The action-entry snapshot is deliberately absent here rather than relabelled. A different patient
 * has been loaded; a baseline captured before an action in the last one describes none of what is on
 * screen, and a comparison against it would read as though it had been taken after the transfer
 * setup. What travels between the two patients is the principle, so the principle is what this
 * block prints beside the live readings.
 */
export function TransferState({
  principle,
  children,
}: {
  readonly principle: ReactNode
  readonly children: ReactNode
}) {
  return (
    <div data-transfer-state>
      <p className="mt-2 text-xs leading-5" data-transfer-baseline-note>
        Live readings from the new patient. Nothing is carried over from the last one.
      </p>
      {children}
      <p className="mt-3 text-xs leading-5" data-transferable-principle>
        <span className="font-semibold">What travels between the two patients: </span>
        {principle}
      </p>
    </div>
  )
}

/**
 * Said once, in the caption of every before-and-after table: how big a change has to be before the
 * direction column calls it one.
 */
export const DEADBAND_NOTE = `A change smaller than the simulator’s beat-to-beat variation reads as “about the same”; mean arterial pressure has to move ${MCS_DISPLAY_DEADBANDS.mapMmHg} mm Hg to count.`

/* ------------------------------------------------------------------ *
 * Flow account
 * ------------------------------------------------------------------ */

/**
 * Native, device, and effective systemic flow as separate quantities that are never added.
 *
 * The bars are drawn one per row against a shared scale and are never stacked or concatenated,
 * because a stacked bar is a picture of a sum — and for the two microaxial pathways the sum is the
 * exact error this module exists to prevent. Each row says what its number is a flow *of*.
 *
 * `data-live-readout` is on the wrapper deliberately: the landed workspace test reads the two
 * microaxial destinations from that hook, and the account is now rendered here rather than in the
 * pane, so the hook moves with the content it names.
 */
export function FlowAccount({
  account,
  disclosed,
  headingNote,
}: {
  readonly account: McsFlowAccountView
  /**
   * Whether the mechanism may be named yet. Before a commitment the rows still carry every raw
   * value, its unit and its kind — what they lose is the sentence that explains *why* a line is
   * empty or why two lines must not be added, because on several sections that sentence is the
   * prediction the learner has not made yet.
   */
  readonly disclosed: boolean
  readonly headingNote?: ReactNode
}) {
  const impella = account.presentation === 'left-and-right'
  return (
    <div className="mt-3" data-flow-account={account.presentation} data-live-readout>
      {headingNote ? (
        <p className="text-xs leading-5 text-muted-foreground">{headingNote}</p>
      ) : null}
      <dl className="mt-2 grid gap-2">
        {account.lines.map((line) => {
          const width =
            line.value === null ? 0 : Math.max(1, (line.value / account.scaleLMin) * 100)
          return (
            <div
              key={line.id}
              className="min-w-0 rounded-xl border p-2"
              data-flow-line={line.id}
              data-flow-line-kind={line.kind}
            >
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {line.label}
              </dt>
              <dd className="m-0">
                <span className="text-lg font-semibold">{line.valueText}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {mcsLiveValueKindLabels[line.kind]}
                </span>
                <span
                  className="mt-1 block h-2 rounded-full border"
                  style={{ width: `${width}%` }}
                  aria-hidden="true"
                  data-flow-bar
                />
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {line.id === 'device' && line.value === null && !disclosed
                    ? 'the console for this mechanism reports no flow figure'
                    : line.destination}
                </span>
              </dd>
            </div>
          )
        })}
      </dl>
      {impella ? (
        <p className="mt-2 text-xs leading-5" data-serial-flow-warning>
          Left {reading(account.leftDevice, 1)} L/min into the aorta · right{' '}
          {reading(account.rightDevice, 1)} L/min into the lung
          {disclosed
            ? '. These two pumps handle the same blood one after the other, so they are reported separately and are never added.'
            : ' — two destinations, reported on two rows.'}
        </p>
      ) : null}
    </div>
  )
}

export function flowAccountSentence(account: McsFlowAccountView, disclosed: boolean): string {
  const lines = account.lines
    .map((line) => `${line.label} ${line.valueText}, ${mcsLiveValueKindLabels[line.kind]}`)
    .join('; ')
  if (!disclosed) return `${lines}.`
  const serial =
    account.presentation === 'left-and-right'
      ? ' The left-sided and right-sided pump flows are serial and are not added.'
      : account.presentation === 'none-reported'
        ? ' There is no device flow line to add to the native line on this mechanism.'
        : ''
  return `${lines}.${serial}`
}

/* ------------------------------------------------------------------ *
 * Pathway graphic
 * ------------------------------------------------------------------ */

const relationshipStroke: Readonly<Record<McsPathwayView['relationship'], string>> = {
  series: '10 0',
  parallel: '6 4',
  'no-pathway': '2 5',
}

/**
 * Source → active component → destination, drawn once per pathway in place.
 *
 * The three boxes carry their own words. They used to be three empty outlined rectangles scaled to
 * the full width of the card, with the words printed as a list underneath, so a learner looked at
 * empty boxes, read a list, and matched the two by eye (F22). The words now sit inside the box they
 * name, the boxes wrap to a column on a narrow screen, and the list underneath keeps only what the
 * boxes do not say.
 *
 * The series/parallel distinction is carried by the connector's line pattern *and* by a printed
 * sentence, and a pathway that moves no blood keeps its explicit "no source" / "no destination"
 * boxes rather than omitting them, so the absence is legible as a fact about the mechanism rather
 * than as a missing part of the drawing.
 */
export function PathwayGraphic({ pathway }: { readonly pathway: McsPathwayView }) {
  const boxes = [
    { key: 'source', role: 'Source', text: pathway.source, attr: { 'data-pathway-source': '' } },
    {
      key: 'component',
      role: 'Active component',
      text: pathway.activeComponent,
      attr: { 'data-pathway-component': '' },
    },
    {
      key: 'destination',
      role: 'Destination',
      text: pathway.destination,
      attr: { 'data-pathway-destination': '' },
    },
  ] as const
  return (
    <figure
      className="m-0 mt-2 min-w-0"
      data-pathway={pathway.id}
      data-pathway-relationship={pathway.relationship}
    >
      <ol
        className="m-0 flex list-none flex-col p-0 md:flex-row md:items-stretch"
        // The stage's `.block ol` makes every list a padded grid; this list is a row of boxes.
        style={{ display: 'flex', paddingLeft: 0 }}
        aria-label={`Pathway: ${pathway.source}, then ${pathway.activeComponent}, then ${pathway.destination}`}
        data-pathway-flow
      >
        {boxes.map((box, index) => (
          <li key={box.key} className="flex min-w-0 flex-1 flex-col md:flex-row">
            {index > 0 ? <PathwayConnector relationship={pathway.relationship} /> : null}
            <div
              className={`min-w-0 flex-1 rounded-lg border-2 p-2 text-sm leading-5 ${
                box.key === 'component' ? 'border-dashed' : 'border-solid'
              }`}
              style={{ borderColor: 'currentColor', overflowWrap: 'normal' }}
              data-pathway-box={box.key}
            >
              <span className="block text-[0.7rem] font-extrabold uppercase tracking-[0.08em] opacity-80">
                {box.role}
              </span>
              <span className="block font-semibold" {...box.attr}>
                {box.text}
              </span>
            </div>
          </li>
        ))}
      </ol>
      <dl className="mt-2 grid gap-1 text-xs leading-5" data-pathway-legend>
        <div>
          <dt className="font-semibold">Relationship</dt>
          <dd data-pathway-relationship-label>
            {pathway.relationshipLabel}{' '}
            <span className="opacity-80">({relationshipLineWords[pathway.relationship]})</span>
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Chamber primarily unloaded</dt>
          <dd data-pathway-unloaded>{pathway.chamberUnloaded}</dd>
        </div>
        <div>
          <dt className="font-semibold">Chamber or vascular bed potentially loaded</dt>
          <dd data-pathway-loaded>{pathway.chamberOrBedLoaded}</dd>
        </div>
        <div>
          <dt className="font-semibold">Gas exchange</dt>
          <dd data-pathway-gas-exchange={pathway.gasExchange ? 'yes' : 'no'}>
            {pathway.gasExchangeLabel}
          </dd>
        </div>
      </dl>
    </figure>
  )
}

/** What the connector's line pattern means, in words, beside the relationship it draws. */
const relationshipLineWords: Readonly<Record<McsPathwayView['relationship'], string>> = {
  series: 'solid connector: in series',
  parallel: 'dashed connector: in parallel with native ejection',
  'no-pathway': 'dotted connector: no blood pathway',
}

/** The arrow between two boxes: across on a wide screen, down on a narrow one. Decorative. */
function PathwayConnector({
  relationship,
}: {
  readonly relationship: McsPathwayView['relationship']
}) {
  return (
    <span
      className="flex items-center justify-center py-0.5 md:px-0.5 md:py-0"
      aria-hidden="true"
      data-pathway-connector={relationship}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 rotate-90 md:rotate-0"
        aria-hidden="true"
        focusable="false"
      >
        <line
          x1="2"
          y1="12"
          x2="17"
          y2="12"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeDasharray={relationshipStroke[relationship]}
        />
        <path d="M15 7 L22 12 L15 17 Z" fill="currentColor" />
      </svg>
    </span>
  )
}

export function pathwaySentence(pathway: McsPathwayView): string {
  return `${pathway.source}, through ${pathway.activeComponent}, to ${pathway.destination}. ${pathway.relationshipLabel}. It unloads ${pathway.chamberUnloaded}. It can load ${pathway.chamberOrBedLoaded}. ${pathway.gasExchangeLabel}.`
}

/* ------------------------------------------------------------------ *
 * Alarms
 * ------------------------------------------------------------------ */

/** Active modeled alarms, each with its priority as a word rather than as a colour. */
export function AlarmBand({
  alarms,
  emptyLabel = 'No alarm is active.',
  disclosed = true,
}: {
  readonly alarms: readonly McsAlarm[]
  readonly emptyLabel?: string
  /**
   * Whether each alarm's explanation is printed. An alarm's label is on the monitor already; its
   * explanation names the mechanism behind it, which before the commitment is the section's answer.
   */
  readonly disclosed?: boolean
}) {
  if (alarms.length === 0) {
    return (
      <p className="mt-3 text-sm text-muted-foreground" data-alarm-band="empty">
        {emptyLabel}
      </p>
    )
  }
  return (
    <ul className="mt-3 grid gap-2" data-alarm-band="active">
      {alarms.map((alarm) => (
        <li
          key={alarm.id}
          className="rounded-xl border p-2 text-xs leading-5"
          data-alarm={alarm.id}
          data-alarm-priority={alarm.priority}
        >
          <span className="font-semibold">{alarm.label} — </span>
          <span data-alarm-priority-words>{mcsAlarmPriorityWords[alarm.priority]}</span>.{' '}
          {disclosed ? alarm.explanation : null}
        </li>
      ))}
    </ul>
  )
}

export function alarmSentence(alarms: readonly McsAlarm[]): string {
  if (alarms.length === 0) return 'No alarm is active'
  return alarms
    .map((alarm) => `${alarm.label} at ${mcsAlarmPriorityWords[alarm.priority]}`)
    .join('; ')
}

/* ------------------------------------------------------------------ *
 * Evidence
 * ------------------------------------------------------------------ */

/** A live value beside its guide. Interpretation only ever arrives through one of these. */
export function GuidedValue({
  guide,
  value,
  headingLevel = 4,
}: {
  readonly guide: CriticalCareDerivedValueGuide
  readonly value: number | null
  readonly headingLevel?: 2 | 3 | 4 | 5
}) {
  return (
    <DerivedValueReadout
      guide={guide}
      value={value === null || !Number.isFinite(value) ? null : value}
      headingLevel={headingLevel}
    />
  )
}

/** Content that only exists after the learner has committed an answer, behind a disclosure. */
export function AfterCommitment({
  summary,
  children,
}: {
  readonly summary: string
  readonly children: ReactNode
}) {
  return (
    <details className="mt-3 rounded-xl border border-dashed px-3 py-2" data-after-commitment open>
      <summary className="cursor-pointer text-xs font-semibold">{summary}</summary>
      <div className="mt-2">{children}</div>
    </details>
  )
}
