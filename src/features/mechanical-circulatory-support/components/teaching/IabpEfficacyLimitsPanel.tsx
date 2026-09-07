import { mcsDerivedValueGuides } from '../../content/derivedValueGuides'
import type { McsTeachingPanelProps } from './panelProps'
import { mcsComparesAgainstActionBaseline, mcsMechanismDisclosed } from './revealStage'
import {
  MCS_OXYGEN_DELIVERY_BOUNDARY,
  activeAlarms,
  beforeAfterReadings,
  flowAccountView,
  iabpTimingView,
  reading,
  tracePath,
  trendTrace,
} from './selectors'
import {
  AlarmBand,
  BeforeAfter,
  DEADBAND_CAPTION,
  FigureScope,
  FlowAccount,
  GuidedValue,
  LiveValue,
  ModelBoundary,
  PanelSection,
  TextEquivalent,
  TransferState,
  UnmodeledOrganResponse,
  WaitingState,
  alarmSentence,
  beforeAfterSentence,
  flowAccountSentence,
  styles,
} from './shared'

/**
 * Section 4 — a device that is working correctly beside a circulation that is not.
 *
 * The figure is two lines on one time axis: mean arterial pressure and effective systemic delivery,
 * each normalized to its own range so that the *shape* of the separation is visible in a pane this
 * narrow. Normalizing them separately is a real distortion, and it is labelled as one — the axis
 * ends are printed beside each line so nobody reads a crossing point as a physiological event.
 *
 * Beside the trend sits the technical-performance block: synchrony, ratio, trigger. The whole
 * teaching of the section is that this block can stay perfect while the other one deteriorates, so
 * they are drawn as two separate accounts rather than as one summary.
 */

const TREND_WIDTH = 320
const TREND_HEIGHT = 64

export function IabpEfficacyLimitsPanel({
  contract,
  state,
  reveal,
  beforeMetrics,
}: McsTeachingPanelProps) {
  const disclosed = mcsMechanismDisclosed(reveal)
  const metrics = state.metrics
  const timing = iabpTimingView(state)
  const account = flowAccountView(state)
  const alarms = activeAlarms(state)
  const mapTrace = trendTrace(state.trends, (sample) => sample.mapMmHg)
  const flowTrace = trendTrace(state.trends, (sample) => sample.effectiveFlowLMin)
  const rows = beforeAfterReadings(
    [
      {
        metric: 'timingQualityPercent',
        label: 'Timing synchrony',
        unit: '%',
        digits: 0,
        kind: 'displayed',
      },
      {
        metric: 'rapMmHg',
        label: 'Right atrial pressure',
        unit: 'mm Hg',
        digits: 0,
        kind: 'modeled',
      },
      {
        metric: 'mapMmHg',
        label: 'Mean arterial pressure',
        unit: 'mm Hg',
        digits: 0,
        kind: 'modeled',
      },
      { metric: 'nativeFlowLMin', label: 'Native contribution', unit: 'L/min', kind: 'modeled' },
      {
        metric: 'effectiveSystemicFlowLMin',
        label: 'Effective systemic delivery',
        unit: 'L/min',
        kind: 'reasoned',
      },
      {
        metric: 'svo2Percent',
        label: 'Mixed venous saturation',
        unit: '%',
        digits: 0,
        kind: 'modeled',
      },
    ],
    beforeMetrics,
    metrics,
  )

  return (
    <div className={styles.panel} data-teaching-panel={contract.sectionId}>
      <PanelSection title="Two accounts, kept apart" id="efficacy-two-accounts">
        <div className="mt-3 grid gap-3 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
          <div className="min-w-0 rounded-xl border p-3" data-account="technical">
            <p className={styles.subheading}>How the device is performing</p>
            <p className="mt-2 text-lg font-semibold">
              {reading(metrics.timingQualityPercent, 0)}
              {metrics.timingQualityPercent === null ? '' : '%'}
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              timing synchrony · directly displayed
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {timing
                ? `${timing.triggerSource} trigger at ${timing.assistRatio}, inflation ${timing.inflationOffsetMs} ms from the notch`
                : 'no counterpulsation pathway in place'}
            </p>
          </div>
          <div className="min-w-0 rounded-xl border p-3" data-account="physiologic">
            <p className={styles.subheading}>What the circulation is receiving</p>
            <p className="mt-2 text-lg font-semibold">
              {reading(metrics.effectiveSystemicFlowLMin, 1)} L/min
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              effective systemic delivery · reasoned
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              mean pressure {reading(metrics.mapMmHg, 0)} mm Hg · pulse pressure{' '}
              {reading(metrics.pulsePressureMmHg, 0)} mm Hg · mixed venous saturation{' '}
              {reading(metrics.svo2Percent, 0)}%
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5" data-two-accounts-note>
          These are two different questions. The left box asks whether the balloon is doing its job
          against the cardiac cycle. The right box asks what the patient is receiving. Nothing
          forces them to agree, and the left box has no way of reporting when they do not.
        </p>
        <TextEquivalent>
          Timing synchrony reads {reading(metrics.timingQualityPercent, 0)} percent while effective
          systemic delivery reads {reading(metrics.effectiveSystemicFlowLMin, 1)} L/min, with a mean
          arterial pressure of {reading(metrics.mapMmHg, 0)} mm Hg, a pulse pressure of{' '}
          {reading(metrics.pulsePressureMmHg, 0)} mm Hg and a modeled mixed venous saturation of{' '}
          {reading(metrics.svo2Percent, 0)} percent.
        </TextEquivalent>
        <p className="mt-2 text-xs leading-5" data-no-augmentation-target>
          No value of synchrony, augmented pressure, or assist ratio is set as something to reach.
          This module publishes no augmentation target of any kind.
        </p>
      </PanelSection>

      <PanelSection title="Pressure and flow on one time axis" id="efficacy-trend">
        {mapTrace && flowTrace ? (
          <>
            <svg
              viewBox={`0 0 ${TREND_WIDTH} ${TREND_HEIGHT + 16}`}
              className="mt-3 h-auto w-full"
              role="img"
              aria-label="Mean arterial pressure and effective systemic flow drawn on one time axis, each scaled to its own range"
              data-response-trend
            >
              <path
                d={tracePath(mapTrace, TREND_WIDTH, TREND_HEIGHT)}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                data-trend-line="map"
              />
              <path
                d={tracePath(flowTrace, TREND_WIDTH, TREND_HEIGHT)}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeDasharray="5 3"
                data-trend-line="effective-flow"
              />
              <text x="0" y={TREND_HEIGHT + 12} fontSize="7" fill="currentColor">
                solid — mean pressure {mapTrace.minimum.toFixed(0)} to {mapTrace.maximum.toFixed(0)}{' '}
                mm Hg · dashed — effective flow {flowTrace.minimum.toFixed(1)} to{' '}
                {flowTrace.maximum.toFixed(1)} L/min
              </text>
            </svg>
            <TextEquivalent>
              Over the retained trend, mean arterial pressure ranged from{' '}
              {mapTrace.minimum.toFixed(0)} to {mapTrace.maximum.toFixed(0)} mm Hg and effective
              systemic delivery ranged from {flowTrace.minimum.toFixed(1)} to{' '}
              {flowTrace.maximum.toFixed(1)} L/min. Mean pressure now reads{' '}
              {reading(metrics.mapMmHg, 0)} mm Hg and effective systemic delivery now reads{' '}
              {reading(metrics.effectiveSystemicFlowLMin, 1)} L/min.
            </TextEquivalent>
            <ModelBoundary>
              The two lines are drawn on separate scales so that both fit a narrow pane, and the
              ends of each scale are printed above. A crossing of the two lines is an artefact of
              that choice and means nothing. The retained trend is short; this figure shows the last
              few modeled minutes, not a shift.
            </ModelBoundary>
          </>
        ) : (
          <WaitingState label="response trend" />
        )}
        <FigureScope
          establishes="Whether mean pressure and effective systemic delivery are moving together or apart over the retained trend."
          doesNotEstablish="Why they are moving apart, and whether either value is adequate for this patient. A separation is a prompt to look upstream, not a diagnosis."
        />
      </PanelSection>

      <PanelSection title="The flow account, unchanged by timing" id="efficacy-flow">
        <FlowAccount account={account} disclosed={disclosed} />
        <TextEquivalent>{flowAccountSentence(account, disclosed)}</TextEquivalent>
        {disclosed ? (
          <p className="mt-2 text-xs leading-5" data-no-device-stream>
            However well this mechanism is timed, it never acquires a stream of its own. Every litre
            in the effective line is native output, which is why the mechanism has a ceiling set by
            the ventricle it is timed to — and why an augmented arterial trace is not evidence that
            cardiac output is sufficient.
          </p>
        ) : null}
      </PanelSection>

      <PanelSection title="Cardiac power, and what it is not" id="efficacy-cpo">
        <GuidedValue
          guide={mcsDerivedValueGuides.cardiacPowerOutputW}
          value={metrics.cardiacPowerOutputW}
        />
        <div className="mt-3 grid gap-2 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
          <LiveValue
            label="Mixed venous saturation"
            value={metrics.svo2Percent}
            unit="%"
            digits={0}
            kind="modeled"
            note="A downstream balance signal, not a measurement of oxygen delivery and not a value to drive toward."
          />
          <LiveValue
            label="Pulse pressure"
            value={metrics.pulsePressureMmHg}
            unit="mm Hg"
            digits={0}
            kind="modeled"
            note="A pressure-level finding. A wider or taller pressure wave is not a larger forward stroke volume."
          />
        </div>
        <ModelBoundary>{MCS_OXYGEN_DELIVERY_BOUNDARY}</ModelBoundary>
      </PanelSection>

      <PanelSection title="What is not on this screen" id="efficacy-unmodeled">
        <UnmodeledOrganResponse />
        <p className="mt-2 text-xs leading-5">
          Whether this patient is better is answered at the organ level, and this simulation
          produces no patient-level outcome at all — no recovery, no survival, no duration of
          support. The absence of a worsening organ signal here is a property of the model, not
          reassurance.
        </p>
      </PanelSection>

      {mcsComparesAgainstActionBaseline(reveal) ? (
        <PanelSection title="Before, and now" id="efficacy-before-after">
          <BeforeAfter
            rows={rows}
            baselineLabel="On entering the task"
            caption="The device account and the physiologic account, before and now, side by side."
          />
          <TextEquivalent>{beforeAfterSentence(rows)}.</TextEquivalent>
          <AlarmBand
            alarms={alarms}
            disclosed={disclosed}
            emptyLabel="No modeled alarm is active in this state."
          />
          <TextEquivalent>{alarmSentence(alarms)}.</TextEquivalent>
          <ModelBoundary>{DEADBAND_CAPTION}</ModelBoundary>
        </PanelSection>
      ) : null}

      {reveal === 'transfer' ? (
        <PanelSection title="The transfer patient, read live" id="efficacy-transfer">
          <TransferState principle="A device that reports it is performing correctly has not reported that the circulation is adequate. When the two accounts disagree, the limitation is somewhere the device display cannot see.">
            <div className="mt-2 grid gap-2 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
              <LiveValue
                label="Timing synchrony"
                value={metrics.timingQualityPercent}
                unit="%"
                digits={0}
                kind="displayed"
              />
              <LiveValue
                label="Right atrial pressure"
                value={metrics.rapMmHg}
                unit="mm Hg"
                digits={0}
                kind="modeled"
              />
              <LiveValue
                label="Effective systemic delivery"
                value={metrics.effectiveSystemicFlowLMin}
                unit="L/min"
                kind="reasoned"
              />
              <LiveValue
                label="Pulmonary pulsatility ratio"
                value={metrics.papi}
                unit=""
                kind="derived"
              />
            </div>
            <FlowAccount account={account} disclosed={disclosed} />
            <TextEquivalent>
              In the transfer patient: timing synchrony {reading(metrics.timingQualityPercent, 0)}{' '}
              percent, right atrial pressure {reading(metrics.rapMmHg, 0)} mm Hg, effective systemic
              delivery {reading(metrics.effectiveSystemicFlowLMin, 1)} L/min, pulmonary pulsatility
              ratio {reading(metrics.papi, 1)}. {flowAccountSentence(account, disclosed)}
            </TextEquivalent>
          </TransferState>
        </PanelSection>
      ) : null}
    </div>
  )
}
