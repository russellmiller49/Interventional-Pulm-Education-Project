import { mcsDerivedValueGuides } from '../../content/derivedValueGuides'
import type { McsTeachingPanelProps } from './panelProps'
import { mcsComparesAgainstActionBaseline, mcsMechanismDisclosed } from './revealStage'
import {
  MCS_ESTIMATED_FLOW_BOUNDARY,
  activeAlarms,
  beforeAfterReadings,
  directionOf,
  displaySignalNumber,
  flowAccountView,
  isReported,
  lvadView,
  mcsDirectionWords,
  reading,
} from './selectors'
import {
  AlarmBand,
  BeforeAfter,
  DEADBAND_CAPTION,
  FigureScope,
  FlowAccount,
  GuidedValue,
  LiveSetting,
  LiveValue,
  ModelBoundary,
  PanelSection,
  TextEquivalent,
  TransferState,
  alarmSentence,
  beforeAfterSentence,
  flowAccountSentence,
  styles,
} from './shared'

/**
 * Section 7 — speed, power, estimated flow, pulsatility, loading, delivery, as one set.
 *
 * The figure is a chain of dependencies rather than a controller face, because the claim being
 * taught is that these values are not independent: the displayed flow is computed from two of the
 * others, and all of them move when the loading at either end of the pump moves. A layout that made
 * them look like six separate gauges would teach the opposite of the section.
 *
 * The cardiac-power paradox is shown only when the live state actually demonstrates it. The engine
 * genuinely produces a rise in cardiac power alongside a fall in effective flow under high
 * afterload, so the panel checks the two directions against the captured baseline and says so when
 * it happens, rather than asserting it in prose that would be there whatever the state did.
 */

export function LvadParametersAssessmentPanel({
  contract,
  state,
  reveal,
  beforeMetrics,
}: McsTeachingPanelProps) {
  const disclosed = mcsMechanismDisclosed(reveal)
  const metrics = state.metrics
  const controller = lvadView(state)
  const account = flowAccountView(state)
  const alarms = activeAlarms(state)
  const gradient = displaySignalNumber(state, 'pressureGradientMmHg')
  const rows = beforeAfterReadings(
    [
      { metric: 'pumpPowerW', label: 'Pump power', unit: 'W', kind: 'displayed' },
      { metric: 'pulsatilityIndex', label: 'Pulsatility index', unit: '', kind: 'displayed' },
      { metric: 'deviceFlowLMin', label: 'Displayed pump flow', unit: 'L/min', kind: 'estimated' },
      {
        metric: 'effectiveSystemicFlowLMin',
        label: 'Effective systemic delivery',
        unit: 'L/min',
        kind: 'reasoned',
      },
      {
        metric: 'mapMmHg',
        label: 'Mean arterial pressure',
        unit: 'mm Hg',
        digits: 0,
        kind: 'modeled',
      },
      {
        metric: 'cardiacPowerOutputW',
        label: 'Cardiac power',
        unit: 'W',
        digits: 2,
        kind: 'derived',
      },
    ],
    beforeMetrics,
    metrics,
  )

  const flowDelta =
    beforeMetrics && isReported(beforeMetrics.effectiveSystemicFlowLMin)
      ? metrics.effectiveSystemicFlowLMin - beforeMetrics.effectiveSystemicFlowLMin
      : null
  const powerDelta =
    beforeMetrics && isReported(beforeMetrics.cardiacPowerOutputW)
      ? metrics.cardiacPowerOutputW - beforeMetrics.cardiacPowerOutputW
      : null
  const flowDirection = flowDelta === null ? null : directionOf(flowDelta, 0.15)
  const cpoDirection = powerDelta === null ? null : directionOf(powerDelta, 0.08)
  /**
   * Only claimed when the live state actually shows it: effective delivery down, cardiac power up.
   * Held as one object so the two direction words cannot be read outside the branch that proved them.
   */
  const paradox =
    flowDirection === 'lower' && cpoDirection === 'higher' && beforeMetrics
      ? { flowDirection, cpoDirection, before: beforeMetrics }
      : null

  return (
    <div className={styles.panel} data-teaching-panel={contract.sectionId}>
      <PanelSection title="One set of values, not six gauges" id="lvad-parameter-set">
        <div className="mt-3 grid gap-2 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
          <LiveValue
            label="Speed"
            value={controller ? controller.speedRpm : null}
            unit="rpm"
            digits={0}
            kind="displayed"
            note="What is set. It fixes how fast the impeller turns, not how much blood crosses it."
          />
          <LiveValue
            label="Pump power"
            value={metrics.pumpPowerW}
            unit="W"
            kind="displayed"
            note="The work the impeller is doing on the blood it is actually moving. It falls when less blood crosses at an unchanged resistance."
          />
          <LiveValue
            label="Displayed pump flow"
            value={metrics.deviceFlowLMin}
            unit="L/min"
            kind="estimated"
            note="Computed from power and speed against an assumed viscosity. It inherits every assumption in that computation."
          />
          <LiveValue
            label="Pulsatility index"
            value={metrics.pulsatilityIndex}
            unit=""
            kind="displayed"
            note="How much of the cycle the native ventricle is still contributing. It is not a measure of volume status, of right ventricular function, or of adequacy."
          />
          <LiveValue
            label="Pressure the pump works across"
            value={gradient}
            unit="mm Hg"
            digits={0}
            kind="modeled"
            note="Aortic pressure against left-sided filling pressure. This is the term a rising afterload moves."
          />
          <LiveValue
            label="Effective systemic delivery"
            value={metrics.effectiveSystemicFlowLMin}
            unit="L/min"
            kind="reasoned"
            note="What reaches the circulation once the native contribution and any regurgitant return are reconciled."
          />
        </div>

        <ol className="mt-3 grid gap-1 text-xs leading-5" data-parameter-dependency>
          <li>Speed is set. It does not by itself decide how much blood crosses the pump.</li>
          <li>
            What crosses depends on what fills the ventricle and on the pressure at the outlet —
            currently {reading(gradient, 0)} mm Hg across the pump.
          </li>
          <li>
            Power tracks the work being done on the blood that crosses, so it moves with the volume
            rather than with the pressure alone.
          </li>
          <li>
            The displayed flow is computed from power and speed, so it moves when they move — which
            is not the same thing as measuring the blood.
          </li>
          <li>
            Pulsatility index reports what is left of the native beat. The same displayed flow can
            sit beside very different values of it.
          </li>
        </ol>

        <TextEquivalent>
          Speed {reading(controller ? controller.speedRpm : null, 0)} rpm, pump power{' '}
          {reading(metrics.pumpPowerW, 1)} W, displayed pump flow{' '}
          {reading(metrics.deviceFlowLMin, 1)} L/min, pulsatility index{' '}
          {reading(metrics.pulsatilityIndex, 1)}, gradient across the pump {reading(gradient, 0)} mm
          Hg, effective systemic delivery {reading(metrics.effectiveSystemicFlowLMin, 1)} L/min.
          These are one interdependent set: the displayed flow is computed from two of the others
          rather than measured.
        </TextEquivalent>

        <ModelBoundary>{MCS_ESTIMATED_FLOW_BOUNDARY}</ModelBoundary>
        <p className="mt-2 text-xs leading-5" data-no-published-targets>
          This module publishes no speed, power, pulsatility-index or alarm value for a durable
          pump. Speed is prescribed per patient by the implanting programme, and a change belongs to
          that team working from the current instructions for the implanted device.
        </p>
        <FigureScope
          establishes="What each controller value is, how it is produced, and which of them is computed rather than read."
          doesNotEstablish="Whether this patient is adequately supported, and what should be changed. The same displayed flow can sit beside very different patient states."
        />
      </PanelSection>

      <PanelSection title="Loading, on both sides of the pump" id="lvad-loading">
        <div className="mt-3 grid gap-2 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
          <LiveValue
            label="Mean arterial pressure"
            value={metrics.mapMmHg}
            unit="mm Hg"
            digits={0}
            kind="modeled"
          />
          <LiveValue
            label="Systemic vascular resistance"
            value={state.patient.systemicVascularResistanceDynSecCm5}
            unit="dyn·s·cm⁻⁵"
            digits={0}
            kind="modeled"
          />
          <LiveValue
            label="Right atrial pressure"
            value={metrics.rapMmHg}
            unit="mm Hg"
            digits={0}
            kind="modeled"
          />
          <LiveValue
            label="Wedge pressure"
            value={metrics.pcwpMmHg}
            unit="mm Hg"
            digits={0}
            kind="modeled"
          />
          <LiveValue
            label="Left ventricular end-diastolic volume"
            value={metrics.lvedvMl}
            unit="mL"
            digits={0}
            kind="modeled"
          />
          <LiveSetting
            label="Aortic valve"
            value={metrics.aorticValveOpening ? 'opening' : 'not opening'}
            kind="modeled"
            note={
              metrics.aorticValveOpening
                ? 'The native ventricle is still ejecting through it.'
                : 'On durable support an intermittently opening or closed valve is an expected state rather than a fault.'
            }
          />
        </div>
        <FlowAccount account={account} disclosed={disclosed} />
        <TextEquivalent>
          Mean arterial pressure {reading(metrics.mapMmHg, 0)} mm Hg with a systemic vascular
          resistance of {reading(state.patient.systemicVascularResistanceDynSecCm5, 0)} dyn·s·cm⁻⁵;
          right atrial pressure {reading(metrics.rapMmHg, 0)} mm Hg and wedge pressure{' '}
          {reading(metrics.pcwpMmHg, 0)} mm Hg; end-diastolic volume {reading(metrics.lvedvMl, 0)}{' '}
          mL; the aortic valve is {metrics.aorticValveOpening ? 'opening' : 'not opening'}.{' '}
          {flowAccountSentence(account, disclosed)}
        </TextEquivalent>
        <AlarmBand alarms={alarms} />
        <TextEquivalent>{alarmSentence(alarms)}.</TextEquivalent>
      </PanelSection>

      <PanelSection title="Cardiac power against effective flow" id="lvad-cpo">
        <GuidedValue
          guide={mcsDerivedValueGuides.cardiacPowerOutputW}
          value={metrics.cardiacPowerOutputW}
        />
        {paradox && disclosed ? (
          <p className="mt-3 text-xs leading-5" data-cpo-paradox="present">
            <span className="font-semibold">This state is the worked example. </span>Since the
            baseline was captured, effective systemic delivery has moved{' '}
            {mcsDirectionWords[paradox.flowDirection]} —{' '}
            {reading(paradox.before.effectiveSystemicFlowLMin, 1)} to{' '}
            {reading(metrics.effectiveSystemicFlowLMin, 1)} L/min — while cardiac power has moved{' '}
            {mcsDirectionWords[paradox.cpoDirection]},{' '}
            {reading(paradox.before.cardiacPowerOutputW, 2)} to{' '}
            {reading(metrics.cardiacPowerOutputW, 2)} W. Cardiac power is a pressure multiplied by a
            flow, and here the pressure term has moved far enough to carry the product upward while
            the flow inside it fell. A rising cardiac power is not evidence that perfusion improved.
          </p>
        ) : (
          <p className="mt-3 text-xs leading-5" data-cpo-paradox="not-present">
            Cardiac power multiplies a pressure by a flow, so the two can move in opposite
            directions inside it. This simulation produces exactly that under a high enough
            afterload: mean pressure rises far enough to carry the product upward while forward flow
            falls. A rising cardiac power is therefore never on its own evidence that perfusion
            improved.
          </p>
        )}
        <TextEquivalent>
          Cardiac power reads {reading(metrics.cardiacPowerOutputW, 2)} W from a mean arterial
          pressure of {reading(metrics.mapMmHg, 0)} mm Hg and an effective systemic delivery of{' '}
          {reading(metrics.effectiveSystemicFlowLMin, 1)} L/min
          {paradox
            ? `, having moved ${mcsDirectionWords[paradox.cpoDirection]} while effective delivery moved ${mcsDirectionWords[paradox.flowDirection]}`
            : ''}
          .
        </TextEquivalent>
        <ModelBoundary>
          A rise in mean arterial pressure on durable support is itself a reason to reassess rather
          than a reassurance, and this simulation models none of the consequences of sustained
          hypertension. Blood-pressure management and any speed change belong to the prescribing
          team.
        </ModelBoundary>
      </PanelSection>

      {mcsComparesAgainstActionBaseline(reveal) ? (
        <PanelSection title="Before the loading change, and now" id="lvad-before-after">
          <BeforeAfter
            rows={rows}
            baselineLabel="On entering the task"
            caption="The controller set, the delivery, the pressure, and the summary that combines two of them."
          />
          <TextEquivalent>{beforeAfterSentence(rows)}.</TextEquivalent>
          <ModelBoundary>{DEADBAND_CAPTION}</ModelBoundary>
        </PanelSection>
      ) : null}

      {reveal === 'transfer' ? (
        <PanelSection title="The transfer patient, read live" id="lvad-transfer">
          <TransferState principle="The displayed flow is an estimate that inherits the loading at both ends of the pump. A low number is read together with the pressures, not on its own — and a rising cardiac power beside a falling flow is a property of the product, not a sign of improvement.">
            <div className="mt-2 grid gap-2 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
              <LiveValue
                label="Speed"
                value={controller ? controller.speedRpm : null}
                unit="rpm"
                digits={0}
                kind="displayed"
              />
              <LiveValue label="Pump power" value={metrics.pumpPowerW} unit="W" kind="displayed" />
              <LiveValue
                label="Displayed pump flow"
                value={metrics.deviceFlowLMin}
                unit="L/min"
                kind="estimated"
              />
              <LiveValue
                label="Mean arterial pressure"
                value={metrics.mapMmHg}
                unit="mm Hg"
                digits={0}
                kind="modeled"
              />
              <LiveValue
                label="Systemic vascular resistance"
                value={state.patient.systemicVascularResistanceDynSecCm5}
                unit="dyn·s·cm⁻⁵"
                digits={0}
                kind="modeled"
              />
              <LiveValue
                label="Effective systemic delivery"
                value={metrics.effectiveSystemicFlowLMin}
                unit="L/min"
                kind="reasoned"
              />
            </div>
            <AlarmBand alarms={alarms} />
            <TextEquivalent>
              In the transfer patient: speed {reading(controller ? controller.speedRpm : null, 0)}{' '}
              rpm, pump power {reading(metrics.pumpPowerW, 1)} W, displayed pump flow{' '}
              {reading(metrics.deviceFlowLMin, 1)} L/min, mean arterial pressure{' '}
              {reading(metrics.mapMmHg, 0)} mm Hg, systemic vascular resistance{' '}
              {reading(state.patient.systemicVascularResistanceDynSecCm5, 0)} dyn·s·cm⁻⁵, effective
              systemic delivery {reading(metrics.effectiveSystemicFlowLMin, 1)} L/min.{' '}
              {alarmSentence(alarms)}.
            </TextEquivalent>
          </TransferState>
        </PanelSection>
      ) : null}
    </div>
  )
}
