import { mcsDerivedValueGuides } from '../../content/derivedValueGuides'
import type { McsTeachingPanelProps } from './panelProps'
import { mcsComparesAgainstActionBaseline, mcsMechanismDisclosed } from './revealStage'
import {
  afterloadCostView,
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
  FlowAccount,
  GuidedValue,
  LiveSetting,
  LiveValue,
  PanelSection,
  ReferenceValues,
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
 * taught is that these values are not independent: the simplified flow model and power/PI calculations share loading inputs, and all of them move when the loading at either end of the pump moves. A layout that made
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
  const afterloadCost = afterloadCostView(state)
  const gradient = displaySignalNumber(state, 'pressureGradientMmHg')
  const rows = beforeAfterReadings(
    [
      { metric: 'pumpPowerW', label: 'Pump power', unit: 'W', kind: 'displayed' },
      { metric: 'pulsatilityIndex', label: 'Pulsatility index', unit: '', kind: 'displayed' },
      {
        metric: 'estimatedPumpFlowLMin',
        label: 'Displayed pump flow',
        unit: 'L/min',
        kind: 'displayed',
      },
      { metric: 'deviceFlowLMin', label: 'Real pump flow', unit: 'L/min', kind: 'modeled' },
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
      <PanelSection
        title="Controller parameters and separate patient measurements"
        id="lvad-parameter-set"
      >
        <div className="mt-3 grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
          <LiveValue
            label="Speed"
            value={controller ? controller.speedRpm : null}
            unit="rpm"
            digits={0}
            kind="displayed"
            note="The one value you set. It fixes how fast the impeller turns; how much blood crosses depends on filling and on the pressure at the outlet."
          />
          <LiveValue
            label="Pump power"
            value={metrics.pumpPowerW}
            unit="W"
            kind="displayed"
            note="Measured directly: the watts needed to hold the set speed. More flow needs more power. So does thrombus on the rotor."
          />
          <LiveValue
            label="Displayed pump flow"
            value={metrics.estimatedPumpFlowLMin ?? metrics.deviceFlowLMin}
            unit="L/min"
            kind="displayed"
            note={
              disclosed
                ? 'An estimate. The controller calculates it from power at the set speed and the hematocrit entered, so anything that raises power raises this number.'
                : 'What this number is made from is the question this section opens with.'
            }
          />
          {disclosed ? (
            <LiveValue
              label="Flow the pump is really delivering"
              value={metrics.deviceFlowLMin}
              unit="L/min"
              kind="modeled"
              note="Only a simulator can show this. It matches the display until power rises for a reason other than flow."
            />
          ) : null}
          <LiveValue
            label="Pulsatility index"
            value={metrics.pulsatilityIndex}
            unit=""
            kind="displayed"
            note="How much the flow through the pump swings with each heartbeat. A full, contracting ventricle gives a high index; an empty ventricle, a fast pump or a failing right heart gives a low one."
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

        {disclosed ? (
          <ol className="mt-3 grid gap-1 text-xs leading-5" data-parameter-dependency>
            <li>You set the speed. Typical HeartMate 3 speeds are in the box below.</li>
            <li>
              Flow follows speed, filling and the pressure at the outlet: currently{' '}
              {reading(gradient, 0)} mm Hg across the pump. A continuous-flow pump is
              afterload-sensitive, so a higher blood pressure means less flow at the same speed.
            </li>
            <li>
              The controller measures power and calculates the displayed flow from it. With thrombus
              on the rotor, power rises, the displayed flow rises with it, and the real flow falls.
            </li>
            <li>
              Pulsatility index falls when the ventricle is underfilled (bleeding, tamponade, right
              heart failure) and when speed is raised. It rises with afterload and as the ventricle
              recovers.
            </li>
          </ol>
        ) : null}

        <table className="mt-3 w-full text-left text-xs leading-5" data-parameter-patterns>
          <caption className="text-left font-semibold">
            Reading flow, power and pulsatility together
          </caption>
          <thead>
            <tr>
              <th scope="col">Displayed flow and power</th>
              <th scope="col">Pulsatility index</th>
              <th scope="col">Think of</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Low</td>
              <td>Low</td>
              <td>Hypovolemia, tamponade, right heart failure, arrhythmia</td>
            </tr>
            <tr>
              <td>Low</td>
              <td>High</td>
              <td>Hypertension, low speed, a kinked or obstructed graft</td>
            </tr>
            <tr>
              <td>High</td>
              <td>Low</td>
              <td>Pump thrombus, vasodilation, speed set too high</td>
            </tr>
            <tr>
              <td>High</td>
              <td>High</td>
              <td>Exercise, a recovering ventricle</td>
            </tr>
          </tbody>
        </table>

        <TextEquivalent>
          Speed {reading(controller ? controller.speedRpm : null, 0)} rpm, pump power{' '}
          {reading(metrics.pumpPowerW, 1)} W, displayed pump flow{' '}
          {reading(metrics.estimatedPumpFlowLMin ?? metrics.deviceFlowLMin, 1)} L/min, pulsatility
          index {reading(metrics.pulsatilityIndex, 1)}, gradient across the pump{' '}
          {reading(gradient, 0)} mm Hg, effective systemic delivery{' '}
          {reading(metrics.effectiveSystemicFlowLMin, 1)} L/min.
          {disclosed
            ? ' Power is measured; displayed flow is calculated from power at the set speed.'
            : ''}
        </TextEquivalent>

        <ReferenceValues
          title="HeartMate 3: what to hold these against"
          ids={[
            'heartmate3-speed-typical',
            'lvad-map-goal',
            'lvad-map-ceiling',
            'lvad-power-elevation',
            'lvad-pulsatility-index',
          ]}
        >
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Each patient has their own baseline flow, power and pulsatility index. Read every value
            against that patient&rsquo;s baseline; the implanting program sets the speed.
          </p>
        </ReferenceValues>
      </PanelSection>

      <PanelSection title="Loading, on both sides of the pump" id="lvad-loading">
        <div className="mt-3 grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
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
          {afterloadCost ? (
            <LiveSetting
              label="Flow lost to afterload"
              value={`${afterloadCost.costPercent}% of the flow at this speed`}
              kind="modeled"
              note={`Afterload is costing this pump ${afterloadCost.costPercent}% of the flow it would deliver at the same speed and filling. The afterload alarm is raised when mean arterial pressure is above ${afterloadCost.alarmThresholdMmHg} mm Hg; it is ${afterloadCost.alarmRaised ? 'raised' : 'not raised'} here.`}
            />
          ) : null}
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
                : 'The pump is taking the whole output. A valve that never opens can fuse and leak over months, which is one reason speed is not simply set as high as it will go.'
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
        <AlarmBand alarms={alarms} disclosed={disclosed} />
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
        ) : disclosed ? (
          <p className="mt-3 text-xs leading-5" data-cpo-paradox="not-present">
            Cardiac power multiplies a pressure by a flow, so the two can move in opposite
            directions inside it. This simulation produces exactly that under a high enough
            afterload: mean pressure rises far enough to carry the product upward while forward flow
            falls. A rising cardiac power is therefore never on its own evidence that perfusion
            improved.
          </p>
        ) : (
          <p className="mt-3 text-xs leading-5" data-cpo-paradox="withheld">
            Cardiac power multiplies a pressure by a flow. What that means when the two move
            differently is part of what this section asks you to predict.
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
        <p className="mt-3 text-xs leading-5" data-map-teaching>
          On a continuous-flow pump a high mean arterial pressure lowers pump flow and raises the
          risk of stroke. Treat the blood pressure; raising the speed against it does not help.
        </p>
      </PanelSection>

      {mcsComparesAgainstActionBaseline(reveal) ? (
        <PanelSection title="Before the loading change, and now" id="lvad-before-after">
          <BeforeAfter
            rows={rows}
            baselineLabel="On entering the task"
            caption="The controller set, the delivery, the pressure, and the summary that combines two of them."
          />
          <TextEquivalent>{beforeAfterSentence(rows)}.</TextEquivalent>
        </PanelSection>
      ) : null}

      {reveal === 'transfer' ? (
        <PanelSection title="The transfer patient, read live" id="lvad-transfer">
          <TransferState principle="Low displayed flow with a high mean pressure and a high pulsatility index is afterload. Lower the blood pressure toward the goal; do not raise the speed. A rising cardiac power beside a falling flow is not improvement.">
            <div className="mt-2 grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
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
                value={metrics.estimatedPumpFlowLMin ?? metrics.deviceFlowLMin}
                unit="L/min"
                kind="displayed"
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
            <AlarmBand alarms={alarms} disclosed={disclosed} />
            <TextEquivalent>
              In the transfer patient: speed {reading(controller ? controller.speedRpm : null, 0)}{' '}
              rpm, pump power {reading(metrics.pumpPowerW, 1)} W, displayed pump flow{' '}
              {reading(metrics.estimatedPumpFlowLMin ?? metrics.deviceFlowLMin, 1)} L/min, mean
              arterial pressure {reading(metrics.mapMmHg, 0)} mm Hg, systemic vascular resistance{' '}
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
