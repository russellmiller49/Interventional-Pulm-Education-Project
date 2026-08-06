'use client'

import { useId, useMemo } from 'react'

import { crrtPressureSignalDetail, type CrrtPressureSignalId } from '../content/circuitModel'
import type {
  CrrtDevicePressureSignalView,
  CrrtDeviceTreatmentContextView,
  PrismaxPilotOperationsDisplay,
} from '../engine/deviceAdapters/prismax'
import styles from './crrt-live-pressure-device.module.css'

/**
 * The live educational pressure profile.
 *
 * This component performs no clinical arithmetic. Every pressure, every kind,
 * every availability state and every recorded point arrives already decided on
 * `operations`, which is the device adapter's own read-only view of the running
 * model. What happens here is formatting, layout, and plotting geometry.
 *
 * Teaching prose is read from the circuit model by signal id, so the wording a
 * learner sees beside a value is the same wording the universal circuit uses
 * for the same site. There is deliberately no second explanation of a pressure
 * anywhere in this module.
 */
export interface CrrtLivePressureDeviceProps {
  /** The one adapter-composed view model. Nothing else feeds this surface. */
  readonly operations: PrismaxPilotOperationsDisplay
  readonly selectedSignalId: CrrtPressureSignalId
  readonly onSelectSignal: (id: CrrtPressureSignalId) => void
  /** Optional slot rendered under the profile, used for the linked circuit. */
  readonly children?: React.ReactNode
}

const KIND_LABEL = {
  'directly-modelled-site': 'Directly modelled site',
  'calculated-relationship': 'Calculated relationship',
} as const

/** A shape per kind, so the distinction survives without colour. */
const KIND_GLYPH = {
  'directly-modelled-site': '◉',
  'calculated-relationship': '∑',
} as const

function formatMmHg(value: number | null): string {
  if (value === null) return 'Unavailable'
  return `${Math.round(value)} mmHg`
}

function spokenValue(signal: CrrtDevicePressureSignalView): string {
  if (signal.valueMmHg === null) return 'unavailable'
  return `${Math.round(signal.valueMmHg)} millimetres of mercury`
}

function formatClock(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

function deliveryLabel(context: CrrtDeviceTreatmentContextView): string {
  if (context.deliveryState === 'running') return 'Therapy running'
  if (context.deliveryState === 'paused') return 'Therapy paused'
  if (context.deliveryState === 'ended') return 'Therapy ended'
  return 'Therapy not started'
}

function flowText(value: number | null, unit: string): string {
  return value === null ? 'Not set' : `${Math.round(value)} ${unit}`
}

/**
 * A recorded series, drawn from the points the model actually kept. The domain
 * arrives from the adapter; this only turns it into coordinates.
 */
function HistoryPlot({
  signal,
  startSeconds,
  endSeconds,
  titleId,
}: {
  readonly signal: CrrtDevicePressureSignalView
  readonly startSeconds: number
  readonly endSeconds: number
  readonly titleId: string
}) {
  const domain = signal.historyValueDomainMmHg
  const points = signal.history.filter(
    (sample): sample is { timeSeconds: number; valueMmHg: number } => sample.valueMmHg !== null,
  )
  if (!domain || points.length < 2 || endSeconds <= startSeconds) return null

  const width = 600
  const height = 150
  const padY = 16
  // A flat series would divide by zero; give it a band to sit in the middle of.
  const flat = domain.maxMmHg === domain.minMmHg
  const low = flat ? domain.minMmHg - 1 : domain.minMmHg
  const high = flat ? domain.maxMmHg + 1 : domain.maxMmHg

  const x = (seconds: number) => ((seconds - startSeconds) / (endSeconds - startSeconds)) * width
  const y = (value: number) => height - padY - ((value - low) / (high - low)) * (height - padY * 2)

  const path = points
    .map(
      (sample, index) =>
        `${index === 0 ? 'M' : 'L'} ${x(sample.timeSeconds).toFixed(1)} ${y(sample.valueMmHg).toFixed(1)}`,
    )
    .join(' ')
  const last = points[points.length - 1]

  return (
    <svg
      className={styles.plot}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-labelledby={titleId}
      data-kind={signal.kind}
    >
      <path className={styles.plotLine} d={path} />
      {/* A rectangle, not a circle: the plot stretches to fill its box on both
          axes, which would render a circle as a lopsided blob. */}
      <rect
        className={styles.plotHead}
        x={x(last.timeSeconds) - 4}
        y={y(last.valueMmHg) - 4}
        width={8}
        height={8}
      />
    </svg>
  )
}

export function CrrtLivePressureDevice({
  operations,
  selectedSignalId,
  onSelectSignal,
  children,
}: CrrtLivePressureDeviceProps) {
  const idPrefix = `crrt-live-pressure-${useId().replaceAll(':', '')}`
  const headingId = `${idPrefix}-heading`
  const summaryId = `${idPrefix}-summary`
  const plotTitleId = `${idPrefix}-plot-title`

  const signals = operations.pressureSignals
  const context = operations.treatmentContext
  const selected = signals.find((signal) => signal.id === selectedSignalId) ?? signals[0]
  const detail = crrtPressureSignalDetail(selected.id)
  const timeDomain = context.historyTimeDomainSeconds

  const textEquivalent = useMemo(() => {
    const lines = [
      `${deliveryLabel(context)}.`,
      context.bloodFlowContributesToPressures
        ? 'The blood pump is running and both lumens are connected, so blood flow is acting on these pressures.'
        : 'The blood pump is not moving blood through the circuit, so these values are the model at zero flow rather than readings taken during treatment.',
      `Modality ${context.modality ? context.modality.toUpperCase() : 'not set'}; blood flow ${flowText(context.bloodFlowMlMin, 'millilitres per minute')}; dialysate ${flowText(context.dialysateFlowMlHour, 'millilitres per hour')}; patient fluid removal ${flowText(context.patientFluidRemovalMlHour, 'millilitres per hour')}.`,
      'Pressure profile:',
      ...signals.map((signal) => {
        const kind = KIND_LABEL[signal.kind]
        const where =
          signal.kind === 'directly-modelled-site'
            ? `read at ${crrtPressureSignalDetail(signal.id).physicalLocation}`
            : `calculated from ${signal.contributingSiteLabels.join(', ')}; it has no site of its own`
        const history =
          signal.historyAvailability === 'sampled'
            ? `${signal.history.length} recorded points`
            : 'current value only, no recorded series'
        return `${signal.label}: ${spokenValue(signal)}. ${kind}, ${where}. ${history}.`
      }),
      `Selected: ${selected.label}, a ${KIND_LABEL[selected.kind].toLowerCase()}, currently ${spokenValue(selected)}.`,
    ]
    return lines.join(' ')
  }, [context, signals, selected])

  return (
    <section className={styles.livePanel} aria-labelledby={headingId}>
      <header className={styles.liveHeader}>
        <div>
          <span className={styles.liveEyebrow}>Live educational pressure profile</span>
          <h2 id={headingId}>What the model is reporting right now</h2>
        </div>
        <div
          className={styles.liveRunStatus}
          data-running={context.bloodFlowContributesToPressures}
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true">{context.bloodFlowContributesToPressures ? '◉' : '◌'}</span>
          <strong>{deliveryLabel(context)}</strong>
        </div>
      </header>

      <p className={styles.lede}>
        These are modelled device values, not readings from a machine at a bedside. Four of them are
        modelled at a place on the circuit you could go and look at. Two of them are arithmetic over
        those places and have nowhere to inspect.
      </p>

      <dl className={styles.contextGrid} aria-label="Current treatment context">
        <div>
          <dt>Therapy</dt>
          <dd>{context.modality ? context.modality.toUpperCase() : 'Not set'}</dd>
        </div>
        <div>
          <dt>Blood flow</dt>
          <dd>{flowText(context.bloodFlowMlMin, 'mL/min')}</dd>
        </div>
        <div>
          <dt>Dialysate</dt>
          <dd>{flowText(context.dialysateFlowMlHour, 'mL/h')}</dd>
        </div>
        <div>
          <dt>Patient fluid removal</dt>
          <dd>{flowText(context.patientFluidRemovalMlHour, 'mL/h')}</dd>
        </div>
        <div>
          <dt>Elapsed</dt>
          <dd>{formatClock(context.simulationTimeSeconds)}</dd>
        </div>
      </dl>

      {!context.bloodFlowContributesToPressures ? (
        <p className={styles.stoppedNote} role="note">
          The pump is not moving blood right now. The model still reports a number for every
          channel, but these are the values it settles to at zero flow — read them as the circuit at
          rest, not as a treatment reading.
        </p>
      ) : null}

      <p className={styles.liveVisuallyHidden} id={summaryId}>
        {textEquivalent}
      </p>

      <div
        className={styles.signalGrid}
        role="group"
        aria-label="Pressure channels; select one to see where it comes from"
      >
        {signals.map((signal) => {
          const isSelected = signal.id === selected.id
          return (
            <button
              key={signal.id}
              type="button"
              className={styles.signalCard}
              data-kind={signal.kind}
              data-selected={isSelected}
              data-unavailable={signal.valueMmHg === null}
              aria-pressed={isSelected}
              onClick={() => onSelectSignal(signal.id)}
            >
              <span className={styles.signalKind}>
                <i aria-hidden="true">{KIND_GLYPH[signal.kind]}</i>
                {KIND_LABEL[signal.kind]}
              </span>
              <span className={styles.signalLabel}>{signal.label}</span>
              <strong className={styles.signalValue} data-unavailable={signal.valueMmHg === null}>
                {formatMmHg(signal.valueMmHg)}
              </strong>
              <span className={styles.signalWhere}>
                {signal.kind === 'directly-modelled-site'
                  ? 'Has a place on the circuit'
                  : `From ${signal.contributingSiteLabels.length} sites · no place of its own`}
              </span>
            </button>
          )
        })}
      </div>

      <section className={styles.detailPanel} aria-live="polite" data-kind={selected.kind}>
        <header>
          <span className={styles.detailKind}>
            <i aria-hidden="true">{KIND_GLYPH[selected.kind]}</i>
            {KIND_LABEL[selected.kind]}
          </span>
          <h3>{selected.label}</h3>
          <strong data-unavailable={selected.valueMmHg === null}>
            {formatMmHg(selected.valueMmHg)}
          </strong>
        </header>

        {selected.valueMmHg === null ? (
          <p className={styles.unavailableNote} role="note">
            {selected.unavailableReason}
          </p>
        ) : null}

        <dl className={styles.detailList}>
          <div>
            <dt>Where it comes from</dt>
            <dd>{detail.physicalLocation}</dd>
          </div>
          <div>
            <dt>What produces it</dt>
            <dd>{detail.whatProducesTheValue}</dd>
          </div>
          <div>
            <dt>What blood flow does to it</dt>
            <dd>{detail.bloodFlowEffect}</dd>
          </div>
          <div>
            <dt>When it is not telling you much</dt>
            <dd>{detail.whenUnreliable}</dd>
          </div>
        </dl>

        {selected.kind === 'calculated-relationship' ? (
          <p className={styles.derivationNote}>
            Built from {selected.contributingSiteLabels.join(', ')}. Read those first — there is no
            transducer here to go and inspect.
          </p>
        ) : null}

        <div className={styles.historyBlock}>
          <h4 id={plotTitleId}>
            {selected.historyAvailability === 'sampled'
              ? `${selected.label} over this run`
              : `${selected.label}: current value only`}
          </h4>
          {selected.historyAvailability === 'sampled' && timeDomain ? (
            <>
              <HistoryPlot
                signal={selected}
                startSeconds={timeDomain.startSeconds}
                endSeconds={timeDomain.endSeconds}
                titleId={plotTitleId}
              />
              <p className={styles.historyCaption}>
                {selected.history.length} points the model kept, one every{' '}
                {Math.round(context.historyIntervalSeconds / 60)} minutes, from{' '}
                {formatClock(timeDomain.startSeconds)} to {formatClock(timeDomain.endSeconds)}
                {selected.historyValueDomainMmHg
                  ? `, ranging ${Math.round(selected.historyValueDomainMmHg.minMmHg)} to ${Math.round(selected.historyValueDomainMmHg.maxMmHg)} mmHg`
                  : ''}
                . Nothing is drawn between the points that the model did not record.
              </p>
            </>
          ) : (
            <p className={styles.historyCaption} role="note">
              {selected.historyUnavailableReason ??
                'This model keeps no series for this channel, so only the current value is shown.'}
            </p>
          )}
        </div>

        <p className={styles.boundaryNote}>{detail.firstInspectionBoundary}</p>
      </section>

      {children}

      <footer className={styles.boundaryFooter}>
        <p>
          A pressure number is partly a function of how fast blood is being pumped. A value that
          moves after a flow change is not by itself evidence of a new obstruction. Start from where
          the reading is taken and read the whole profile together, then look at the patient, the
          access, and the circuit. This surface supplies no target, no normal range, and no alarm
          setting.
        </p>
        <p>
          Exactly how a commercial machine displays, groups, or alarms on these values belongs to
          the manufacturer&apos;s instructions and your local training, not to this model.
        </p>
      </footer>
    </section>
  )
}
