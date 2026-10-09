import { MCS_NUMBERS } from '../../content/teachingNumbers'
import type { McsTeachingPanelProps } from './panelProps'
import { mcsComparesAgainstActionBaseline, mcsMechanismDisclosed } from './revealStage'
import {
  MCS_ESTIMATED_FLOW_BOUNDARY,
  MCS_DURABLE_FLOW_IDENTITY,
  activeAlarms,
  afterloadCostView,
  beforeAfterReadings,
  flowAccountView,
  hasAlarm,
  lvadView,
  reading,
} from './selectors'
import {
  AlarmBand,
  BeforeAfter,
  FlowAccount,
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
 * Section 8 — where an alarm on this pathway can be coming from, and which of those is present.
 *
 * The figure is a localization table across eight domains, and its three columns do different jobs.
 * Current modeled evidence is read from the live model. What this raises is the question that
 * evidence opens. What remains in the differential is what a bedside would still have to exclude,
 * most of which this simulation does not represent at all. Keeping them apart is the whole point: a
 * learner who reads the third column as findings has invented a patient, and a learner who reads a
 * single raised pressure as a diagnosis has done the same thing one column earlier.
 *
 * The high-power row is written against what this engine really does. It raises the power signature
 * and leaves the delivered flow where it was. It does not lower delivery, it does not produce
 * hemolysis, and it does not collapse or progressively obstruct anything, because none of that is
 * modeled — and the panel says so rather than implying the absence is reassurance.
 */

/**
 * One row of the localization table.
 *
 * `modeledState` is a tri-state on purpose. A binary present/absent is honest for the states this
 * model explicitly enters — power disconnected, controller fault, suction, high afterload,
 * regurgitant recirculation, the high-power flag — and dishonest everywhere else, because a
 * pressure is not a finding. Domains without an explicit modeled state carry `'reading-only'`, and
 * the table prints their readings without attaching a verdict to them.
 */
interface Domain {
  readonly id: string
  readonly title: string
  readonly modeledState: 'present' | 'absent' | 'reading-only'
  /** What the model currently shows for this domain. Readings, not conclusions. */
  readonly evidence: string
  /** What that evidence raises as a question — never what it proves. */
  readonly raises: string
  readonly differential: string
}

export function LvadAlarmsEmergenciesPanel({
  contract,
  state,
  reveal,
  beforeMetrics,
}: McsTeachingPanelProps) {
  const disclosed = mcsMechanismDisclosed(reveal)
  const metrics = state.metrics
  const controller = lvadView(state)
  const afterloadCost = afterloadCostView(state)
  const account = flowAccountView(state)
  const alarms = activeAlarms(state)
  const rows = beforeAfterReadings(
    [
      { metric: 'pumpPowerW', label: 'Pump power', unit: 'W', kind: 'displayed' },
      {
        metric: 'estimatedPumpFlowLMin',
        label: 'Displayed pump flow',
        unit: 'L/min',
        kind: 'displayed',
      },
      { metric: 'deviceFlowLMin', label: 'Real pump flow', unit: 'L/min', kind: 'modeled' },
      { metric: 'pulsatilityIndex', label: 'Pulsatility index', unit: '', kind: 'displayed' },
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

  const highPower = controller?.highPowerPattern ?? false

  const displayedFlow = metrics.estimatedPumpFlowLMin ?? metrics.deviceFlowLMin
  const domains: readonly Domain[] = [
    {
      id: 'external-power',
      title: 'External power',
      modeledState: controller?.powerConnected === false ? 'present' : 'absent',
      evidence: controller?.powerConnected ? 'power is connected' : 'power is disconnected',
      raises: controller?.powerConnected
        ? 'Nothing here.'
        : 'The pump has lost its power. This comes before everything else.',
      differential:
        'Reconnect power at once: a charged battery or the power module. Check the driveline connection. Call the LVAD team while you do it.',
    },
    {
      id: 'controller',
      title: 'Controller',
      modeledState: controller?.controllerFault ? 'present' : 'absent',
      evidence: controller?.controllerFault
        ? 'a controller fault is present'
        : 'no controller fault',
      raises: controller?.controllerFault
        ? 'The controller is reporting a fault in itself.'
        : 'Nothing here.',
      differential:
        'Check the power and driveline connections. A controller fault means changing to the backup controller. Call the LVAD team while you do it.',
    },
    {
      id: 'preload-rv',
      title: 'Preload and right-sided delivery',
      modeledState: 'reading-only',
      evidence: `right atrial pressure ${reading(metrics.rapMmHg, 0)} mm Hg · wedge ${reading(metrics.pcwpMmHg, 0)} mm Hg · end-diastolic volume ${reading(metrics.lvedvMl, 0)} mL · right ventricular contractility index ${reading(state.patient.rightVentricularContractility, 2)} · pulmonary vascular resistance ${reading(state.patient.pulmonaryVascularResistanceWU, 1)} Wood units · rhythm ${state.patient.rhythm} · tamponade ${state.patient.tamponade ? 'present' : 'absent'} · suction alarm ${hasAlarm(state, 'lvad-suction') ? 'active' : 'not active'}`,
      raises:
        'Whether the pump is being filled. Read these with the pulsatility index: low flow with a low index is an underfilled ventricle.',
      differential:
        'Hypovolemia, bleeding, tamponade, right heart failure, arrhythmia. Give volume, look for bleeding, get an echo. Do not raise the speed into an empty ventricle.',
    },
    {
      id: 'afterload',
      title: 'Afterload',
      modeledState: hasAlarm(state, 'lvad-high-afterload') ? 'present' : 'absent',
      evidence: `mean arterial pressure ${reading(metrics.mapMmHg, 0)} mm Hg · systemic vascular resistance ${reading(state.patient.systemicVascularResistanceDynSecCm5, 0)} dyn·s·cm⁻⁵${
        afterloadCost
          ? ` · afterload is costing the pump ${afterloadCost.costPercent}% of its flow at this speed · the alarm is raised above ${afterloadCost.alarmThresholdMmHg} mm Hg`
          : ''
      } · high-afterload alarm ${hasAlarm(state, 'lvad-high-afterload') ? 'active' : 'not active'}`,
      raises:
        'Whether blood pressure is limiting flow. Low flow with a high pulsatility index and a high mean pressure is afterload.',
      differential: `Lower mean arterial pressure toward the goal of ${MCS_NUMBERS.value('lvad-map-goal')} with afterload reduction. Pump flow rises as the pressure falls. Do not raise the speed against it.`,
    },
    {
      id: 'suction',
      title: 'Inflow suction',
      modeledState: hasAlarm(state, 'lvad-suction') ? 'present' : 'absent',
      evidence: hasAlarm(state, 'lvad-suction') ? 'a suction alarm is active' : 'no suction',
      raises: hasAlarm(state, 'lvad-suction')
        ? 'The ventricle is underfilled for the speed set, and the septum or free wall is drawn toward the inlet.'
        : 'Nothing here.',
      differential:
        'A preload problem, not an obstruction. Give volume, look for bleeding and right heart failure, get an echo.',
    },
    {
      id: 'obstruction',
      title: 'Inflow or outflow obstruction, or malposition',
      modeledState: 'reading-only',
      evidence: 'not in the simulator',
      raises: 'Nothing on this screen speaks to it.',
      differential:
        'Inflow cannula malposition, or a kinked or obstructed outflow graft. Both need imaging.',
    },
    {
      id: 'recirculation',
      title: 'Aortic regurgitant recirculation',
      modeledState: hasAlarm(state, 'lvad-recirculation') ? 'present' : 'absent',
      evidence:
        metrics.recirculatingFlowLMin > 0
          ? `${reading(metrics.recirculatingFlowLMin, 1)} L/min leaks back through the aortic valve and is counted out of effective delivery`
          : 'no regurgitant return',
      raises:
        'Whether part of what the pump moves is returning to the ventricle, so the displayed flow overstates delivery.',
      differential:
        'Aortic insufficiency. The displayed flow looks adequate while delivery is not. Echo shows it.',
    },
    {
      id: 'high-power',
      title: 'High-power pattern',
      modeledState: highPower ? 'present' : 'absent',
      evidence: highPower
        ? `a high-power pattern is present: power ${reading(metrics.pumpPowerW, 1)} W, displayed flow ${reading(displayedFlow, 1)} L/min, pulsatility index ${reading(metrics.pulsatilityIndex, 1)}`
        : 'no high-power pattern',
      raises: highPower
        ? disclosed
          ? 'Power is up and the displayed flow is up with it, but the pulsatility index is down and the patient is worse. The displayed flow is falsely high: suspect pump thrombosis.'
          : 'The high-power alarm is active.'
        : 'Nothing here.',
      differential:
        'Suspected pump thrombosis. Send LDH and plasma free hemoglobin, check the anticoagulation, get an echo, and call the LVAD team and surgeon.',
    },
  ]

  return (
    <div className={styles.panel} data-teaching-panel={contract.sectionId}>
      <PanelSection title="Active alarms, with their priority in words" id="alarms-band">
        <AlarmBand alarms={alarms} disclosed={disclosed} />
        <TextEquivalent>{alarmSentence(alarms)}.</TextEquivalent>
        <div className="mt-3 grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
          <LiveSetting
            label="External power"
            value={controller?.powerConnected ? 'connected' : 'not connected'}
            kind="modeled"
          />
          <LiveSetting
            label="Controller"
            value={controller?.controllerFault ? 'fault present' : 'no fault'}
            kind="modeled"
          />
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
            label="Pulsatility index"
            value={metrics.pulsatilityIndex}
            unit=""
            kind="displayed"
          />
        </div>
        <ReferenceValues
          title="HeartMate 3: what these values are held against"
          ids={[
            'lvad-map-goal',
            'lvad-map-ceiling',
            'lvad-power-elevation',
            'lvad-pulsatility-index',
          ]}
        >
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Read flow, power and pulsatility index against this patient&rsquo;s own baseline.
          </p>
        </ReferenceValues>
      </PanelSection>

      <PanelSection title="The flow account" id="alarms-flow">
        <FlowAccount account={account} disclosed={disclosed} />
        <TextEquivalent>{flowAccountSentence(account, disclosed)}</TextEquivalent>
        {disclosed ? (
          <p className="mt-2 text-xs leading-5" data-durable-flow-identity>
            {MCS_DURABLE_FLOW_IDENTITY} {MCS_ESTIMATED_FLOW_BOUNDARY}
          </p>
        ) : null}
      </PanelSection>

      <PanelSection
        title="Where an alarm on this pathway comes from"
        id="alarms-localization"
        reference
      >
        <div className={styles.scroller}>
          <table className={`${styles.table} min-w-[36rem]`} data-alarm-localization>
            <caption className="text-left text-xs leading-5 text-muted-foreground">
              Eight places an LVAD alarm can come from: what the simulator shows for each now, what
              that means, and the causes with the first moves.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="pb-1 pr-3 font-semibold">
                  Domain
                </th>
                <th scope="col" className="pb-1 pr-3 font-semibold">
                  On screen now
                </th>
                <th scope="col" className="pb-1 pr-3 font-semibold">
                  What it means
                </th>
                <th scope="col" className="pb-1 font-semibold">
                  Causes and first moves
                </th>
              </tr>
            </thead>
            <tbody>
              {domains.map((domain) => (
                <tr
                  key={domain.id}
                  data-alarm-domain={domain.id}
                  data-domain-modeled-state={domain.modeledState}
                >
                  <th scope="row" className="py-1 pr-3 align-top font-medium">
                    {domain.title}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {domain.modeledState === 'present'
                        ? 'present'
                        : domain.modeledState === 'absent'
                          ? 'not present'
                          : 'readings only'}
                    </span>
                  </th>
                  <td className="py-1 pr-3 align-top">{domain.evidence}</td>
                  <td className="py-1 pr-3 align-top">{domain.raises}</td>
                  <td className="py-1 align-top">{domain.differential}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TextEquivalent>
          {domains
            .map(
              (domain) =>
                `${domain.title}: ${
                  domain.modeledState === 'present'
                    ? 'present'
                    : domain.modeledState === 'absent'
                      ? 'not present'
                      : 'readings only'
                } — ${domain.evidence}. ${domain.raises} ${domain.differential}`,
            )
            .join(' ')}
        </TextEquivalent>
      </PanelSection>

      {/*
        What the pattern does to power, the flow display and the pulsatility index is this section's
        prediction, so the whole account waits for the commitment.
      */}
      {disclosed ? (
        <PanelSection
          title="The high-power pattern: suspected pump thrombosis"
          id="alarms-high-power"
        >
          <p className="mt-3 text-sm leading-6" data-high-power-claim>
            {highPower
              ? `A high-power pattern is present. Pump power reads ${reading(metrics.pumpPowerW, 1)} W and the displayed flow reads ${reading(displayedFlow, 1)} L/min, but the pump is really moving ${reading(metrics.deviceFlowLMin, 1)} L/min and the pulsatility index is ${reading(metrics.pulsatilityIndex, 1)}.`
              : 'No high-power pattern is present.'}{' '}
            The controller measures power and calculates the displayed flow from it. Thrombus on the
            rotor adds drag: power rises, the displayed flow rises with it, and the real flow, the
            pulsatility index and the patient fall. Power elevation that suggests thrombosis:{' '}
            {MCS_NUMBERS.value('lvad-power-elevation')}.
          </p>
          <ul className="mt-3 grid gap-2 text-xs leading-5" data-high-power-boundaries>
            <li data-high-power-boundary="flow-unchanged">
              <span className="font-semibold">The displayed flow is falsely high. </span>It is an
              estimate from power. Believe the patient, the pulsatility index and the mean arterial
              pressure.
            </li>
            <li data-high-power-boundary="hemolysis">
              <span className="font-semibold">Hemolysis is the laboratory evidence. </span>Send LDH
              and plasma free hemoglobin. The simulator has no laboratory values.
            </li>
            <li data-high-power-boundary="obstruction">
              <span className="font-semibold">An obstructed outflow graft looks different. </span>
              Flow and power are low and the pulsatility index is high.
            </li>
            <li data-high-power-boundary="escalation">
              <span className="font-semibold">First moves, in order. </span>Keep power connected.
              Send LDH and plasma free hemoglobin. Check the anticoagulation. Get an echo. Call the
              LVAD team and surgeon.
            </li>
          </ul>
          <TextEquivalent>
            A high-power pattern is {highPower ? 'present' : 'not present'}. Thrombus raises power,
            and the displayed flow, calculated from power, rises with it while real flow and the
            pulsatility index fall. First moves: keep power connected, send LDH and plasma free
            hemoglobin, check the anticoagulation, get an echo, call the LVAD team and surgeon.
          </TextEquivalent>
        </PanelSection>
      ) : (
        <PanelSection title="What an alarm on this pathway is, and is not" id="alarms-high-power">
          <p className="mt-3 text-sm leading-6" data-high-power-claim="withheld">
            An alarm is a pattern, not a diagnosis. Read it with the patient, the trend and the
            other controller values. What this pattern does to power, the displayed flow and the
            pulsatility index is what this section asks you to predict.
          </p>
        </PanelSection>
      )}

      {mcsComparesAgainstActionBaseline(reveal) ? (
        <PanelSection title="Before the pattern, and now" id="alarms-before-after">
          <BeforeAfter
            rows={rows}
            baselineLabel="On entering the task"
            caption="Power, the displayed flow calculated from it, the real flow, and the pulsatility index."
          />
          <TextEquivalent>{beforeAfterSentence(rows)}.</TextEquivalent>
        </PanelSection>
      ) : null}

      {reveal === 'transfer' ? (
        <PanelSection title="The transfer patient, read live" id="alarms-transfer">
          <TransferState principle="Power up, displayed flow up, pulsatility index down and a patient who is worse: suspect pump thrombosis. The displayed flow is falsely high. Keep power connected, send LDH and plasma free hemoglobin, check the anticoagulation, get an echo, and call the LVAD team and surgeon.">
            <div className="mt-2 grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
              <LiveSetting
                label="External power"
                value={controller?.powerConnected ? 'connected' : 'not connected'}
                kind="modeled"
              />
              <LiveValue label="Pump power" value={metrics.pumpPowerW} unit="W" kind="displayed" />
              <LiveValue
                label="Displayed pump flow"
                value={metrics.estimatedPumpFlowLMin ?? metrics.deviceFlowLMin}
                unit="L/min"
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
              In the transfer patient the external power path is{' '}
              {controller?.powerConnected ? 'connected' : 'not connected'}, pump power reads{' '}
              {reading(metrics.pumpPowerW, 1)} W, the displayed pump flow reads{' '}
              {reading(metrics.estimatedPumpFlowLMin ?? metrics.deviceFlowLMin, 1)} L/min, and
              effective systemic delivery reads {reading(metrics.effectiveSystemicFlowLMin, 1)}{' '}
              L/min. {alarmSentence(alarms)}.
            </TextEquivalent>
          </TransferState>
        </PanelSection>
      ) : null}
    </div>
  )
}
