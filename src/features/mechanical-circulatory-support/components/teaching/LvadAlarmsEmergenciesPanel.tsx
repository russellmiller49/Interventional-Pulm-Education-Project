import type { McsTeachingPanelProps } from './panelProps'
import { mcsComparesAgainstActionBaseline, mcsMechanismDisclosed } from './revealStage'
import {
  MCS_ESTIMATED_FLOW_BOUNDARY,
  activeAlarms,
  beforeAfterReadings,
  flowAccountView,
  hasAlarm,
  lvadView,
  reading,
} from './selectors'
import {
  AlarmBand,
  BeforeAfter,
  DEADBAND_CAPTION,
  FigureScope,
  FlowAccount,
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
  const account = flowAccountView(state)
  const alarms = activeAlarms(state)
  const rows = beforeAfterReadings(
    [
      { metric: 'pumpPowerW', label: 'Pump power', unit: 'W', kind: 'displayed' },
      { metric: 'deviceFlowLMin', label: 'Displayed pump flow', unit: 'L/min', kind: 'estimated' },
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

  const domains: readonly Domain[] = [
    {
      id: 'external-power',
      title: 'External power path',
      modeledState: controller?.powerConnected === false ? 'present' : 'absent',
      evidence: controller?.powerConnected
        ? 'an approved power path is connected in this model'
        : 'the modeled external power path is not connected',
      raises: controller?.powerConnected
        ? 'Nothing in this domain in this state.'
        : 'An interrupted power path, which is time-critical and is corrected before anything else is investigated.',
      differential:
        'Battery state, cable seating, the controller connection, and the source the patient is on. Power is preserved rather than interrupted to test a theory.',
    },
    {
      id: 'controller',
      title: 'Controller and device state',
      modeledState: controller?.controllerFault ? 'present' : 'absent',
      evidence: controller?.controllerFault
        ? 'a modeled controller fault is present'
        : 'no modeled controller fault',
      raises: controller?.controllerFault
        ? 'A device state the controller is reporting about itself.'
        : 'Nothing in this domain in this state.',
      differential:
        'A controller fault, a device state the controller cannot interpret, or an alarm the controller raises about itself. Controller exchange and device-specific emergency operation are not taught here.',
    },
    {
      id: 'preload-rv',
      title: 'Preload and right-sided delivery',
      modeledState: 'reading-only',
      evidence: `right atrial pressure ${reading(metrics.rapMmHg, 0)} mm Hg · wedge ${reading(metrics.pcwpMmHg, 0)} mm Hg · end-diastolic volume ${reading(metrics.lvedvMl, 0)} mL · modeled RV contractility ${reading(state.patient.rightVentricularContractility, 2)} · pulmonary vascular resistance ${reading(state.patient.pulmonaryVascularResistanceWU, 1)} Wood units · rhythm ${state.patient.rhythm} · tamponade ${state.patient.tamponade ? 'modeled present' : 'modeled not present'} · suction alarm ${hasAlarm(state, 'lvad-suction') ? 'active' : 'not active'}`,
      raises:
        'Whether the pump is being filled. These readings are read together; no single one of them, the right atrial pressure included, establishes right ventricular failure or inadequate filling on its own.',
      differential:
        'Hypovolemia, right ventricular failure, tamponade, and arrhythmia — several of which produce the same low displayed flow from opposite loading states.',
    },
    {
      id: 'afterload',
      title: 'Afterload',
      modeledState: hasAlarm(state, 'lvad-high-afterload') ? 'present' : 'absent',
      evidence: `mean arterial pressure ${reading(metrics.mapMmHg, 0)} mm Hg · systemic vascular resistance ${reading(state.patient.systemicVascularResistanceDynSecCm5, 0)} dyn·s·cm⁻⁵ · high-afterload alarm ${hasAlarm(state, 'lvad-high-afterload') ? 'active' : 'not active'}`,
      raises:
        'Whether the pressure the pump ejects against is limiting what crosses it at this speed.',
      differential:
        'Hypertension reduces flow at a fixed speed. On this pathway a blood-pressure problem is a flow problem.',
    },
    {
      id: 'suction',
      title: 'Inflow suction',
      modeledState: hasAlarm(state, 'lvad-suction') ? 'present' : 'absent',
      evidence: hasAlarm(state, 'lvad-suction')
        ? 'a modeled inflow suction pattern is present'
        : 'no modeled suction pattern',
      raises: hasAlarm(state, 'lvad-suction')
        ? 'Inlet conditions inadequate for the speed set — a loading problem rather than an obstruction.'
        : 'Nothing in this domain in this state.',
      differential:
        'The ventricle underfilled relative to the speed set, with the septum or free wall drawn toward the inlet. It is a loading problem, not an obstruction.',
    },
    {
      id: 'obstruction',
      title: 'Inflow or outflow obstruction, or malposition',
      modeledState: 'reading-only',
      evidence: 'not represented in this simulation',
      raises:
        'Nothing this model can raise. It carries no reading for this domain, so nothing on this screen speaks to it either way.',
      differential:
        'Inflow cannula malposition and outflow graft obstruction. This simulation models neither the physical narrowing nor its progression, so nothing on this screen can exclude them.',
    },
    {
      id: 'recirculation',
      title: 'Aortic regurgitant recirculation',
      modeledState: hasAlarm(state, 'lvad-recirculation') ? 'present' : 'absent',
      evidence:
        metrics.recirculatingFlowLMin > 0
          ? `${reading(metrics.recirculatingFlowLMin, 1)} L/min returns across the valve and is counted out of the effective line`
          : 'no modeled regurgitant return',
      raises:
        'Whether part of what the pump moves is returning to the chamber it came from, so that a plausible displayed flow sits beside a smaller delivery.',
      differential:
        'Blood pumped into the aorta returning to the chamber it came from, so the displayed flow can look adequate while delivery is not.',
    },
    {
      id: 'high-power',
      title: 'High-power pattern',
      modeledState: highPower ? 'present' : 'absent',
      evidence: highPower
        ? `a suspected high-power pattern is present: power ${reading(metrics.pumpPowerW, 1)} W with a displayed flow of ${reading(metrics.deviceFlowLMin, 1)} L/min`
        : 'no high-power pattern in this state',
      raises: highPower
        ? 'A power signature that has stopped tracking the flow it is supposed to imply — a reason for urgent specialist evaluation, not a diagnosis.'
        : 'Nothing in this domain in this state.',
      differential:
        'A power signature that stops tracking the flow it is supposed to imply. It is a reason for urgent specialist evaluation and imaging — not, on its own, a diagnosis.',
    },
  ]

  return (
    <div className={styles.panel} data-teaching-panel={contract.sectionId}>
      <PanelSection title="Active alarms, with their priority in words" id="alarms-band">
        <AlarmBand alarms={alarms} disclosed={disclosed} />
        <TextEquivalent>{alarmSentence(alarms)}.</TextEquivalent>
        <div className="mt-3 grid gap-2 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
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
            value={metrics.deviceFlowLMin}
            unit="L/min"
            kind="estimated"
          />
          <LiveValue
            label="Pulsatility index"
            value={metrics.pulsatilityIndex}
            unit=""
            kind="displayed"
          />
        </div>
        <ModelBoundary>
          Every alarm here names a state this model has entered and prints what produced it. No
          product alarm limit is reproduced anywhere in this module; those belong to the current
          instructions for the specific equipment in use.
        </ModelBoundary>
      </PanelSection>

      <PanelSection title="The flow account, and what has not moved" id="alarms-flow">
        <FlowAccount account={account} disclosed={disclosed} />
        <TextEquivalent>{flowAccountSentence(account, disclosed)}</TextEquivalent>
        <ModelBoundary>{MCS_ESTIMATED_FLOW_BOUNDARY}</ModelBoundary>
      </PanelSection>

      <PanelSection title="Where an alarm on this pathway comes from" id="alarms-localization">
        <div className={styles.scroller}>
          <table className={`${styles.table} min-w-[36rem]`} data-alarm-localization>
            <caption className="text-left text-xs leading-5 text-muted-foreground">
              Eight domains, and three columns that do different jobs. Current modeled evidence is
              read from the live model. What this raises is the question that evidence opens — never
              a conclusion it proves. What remains in the differential is what a bedside would still
              have to work through, most of which this simulation does not represent.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="pb-1 pr-3 font-semibold">
                  Domain
                </th>
                <th scope="col" className="pb-1 pr-3 font-semibold">
                  Current modeled evidence
                </th>
                <th scope="col" className="pb-1 pr-3 font-semibold">
                  What this raises
                </th>
                <th scope="col" className="pb-1 font-semibold">
                  What remains in the differential
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
                        ? 'modeled state present'
                        : domain.modeledState === 'absent'
                          ? 'modeled state not present'
                          : 'readings only — no modeled verdict'}
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
                    ? 'modeled state present'
                    : domain.modeledState === 'absent'
                      ? 'modeled state not present'
                      : 'readings only, no modeled verdict'
                } — ${domain.evidence}. This raises: ${domain.raises}`,
            )
            .join(' ')}
        </TextEquivalent>
        <FigureScope
          establishes="Which explicit modeled states this simulation has entered, and which readings speak to each domain."
          doesNotEstablish="A diagnosis. Findings present in a simulation are not a differential worked through at a bedside, and several of these domains are not represented here at all."
        />
      </PanelSection>

      {/*
        What the pattern does to power and to the flow display is this section's prediction, so the
        whole account waits for the commitment. Before it, the section says only what the word
        "suspected" means and where the module stops.
      */}
      {disclosed ? (
        <PanelSection
          title="What a high-power pattern does here, and does not"
          id="alarms-high-power"
        >
          <p className="mt-3 text-sm leading-6" data-high-power-claim>
            {highPower
              ? `A suspected high-power pattern is present. Pump power reads ${reading(metrics.pumpPowerW, 1)} W and the displayed flow reads ${reading(metrics.deviceFlowLMin, 1)} L/min, with an effective systemic delivery of ${reading(metrics.effectiveSystemicFlowLMin, 1)} L/min.`
              : 'No high-power pattern is present in this state.'}{' '}
            The word this module uses is <em>suspected</em>. A power signature is a pattern, and
            pump thrombosis is a diagnosis reached from clinical status, power and flow trends,
            device logs where available, hemolysis evaluation, focused imaging, and evaluation for
            loading and inflow/outflow causes — never from a power value alone.
          </p>
          <ul className="mt-3 grid gap-2 text-xs leading-5" data-high-power-boundaries>
            <li data-high-power-boundary="flow-unchanged">
              <span className="font-semibold">
                In this model the pattern raises power and leaves the delivered flow where it
                was.{' '}
              </span>
              That separation is the signal. This module does not teach the converse. In this model
              the modeled pattern leaves delivery unchanged, so nothing on this screen establishes
              any fall in what the patient is receiving.
            </li>
            <li data-high-power-boundary="hemolysis">
              <span className="font-semibold">Hemolysis is not modeled. </span>No value on this
              screen rises or falls with red-cell destruction, and its absence here is a limit of
              the model rather than a statement about the state.
            </li>
            <li data-high-power-boundary="obstruction">
              <span className="font-semibold">
                Physical collapse or progressive obstruction of a flow path is not modeled.{' '}
              </span>
              Nothing narrows over time in this simulation, so an unchanging screen is not evidence
              that a flow path is intact.
            </li>
            <li data-high-power-boundary="escalation">
              <span className="font-semibold">The boundary of this module. </span>Preserve the power
              path, examine the patient, and bring the mechanical-support team and imaging to the
              bedside under the current instructions for the implanted device and local protocol.
              Controller exchange, driveline repair, and device-specific emergency operation are not
              taught here.
            </li>
          </ul>
          <TextEquivalent>
            A high-power pattern is {highPower ? 'present' : 'not present'} in this state. In this
            model it raises the power signature and does not change delivered flow. Hemolysis is not
            modeled. Physical collapse or progressive obstruction of a flow path is not modeled. The
            pattern is a reason to preserve power and call the mechanical-support team, not a
            diagnosis.
          </TextEquivalent>
        </PanelSection>
      ) : (
        <PanelSection title="What an alarm on this pathway is, and is not" id="alarms-high-power">
          <p className="mt-3 text-sm leading-6" data-high-power-claim="withheld">
            The word this module uses for any pattern on this controller is <em>suspected</em>. A
            signature is a pattern; a diagnosis is reached from clinical status, trends, device logs
            where available, focused imaging, and evaluation for loading and flow-path causes —
            never from one value alone. What a pattern does to the readings here is what this
            section asks you to predict.
          </p>
        </PanelSection>
      )}

      {mcsComparesAgainstActionBaseline(reveal) ? (
        <PanelSection title="Before the pattern, and now" id="alarms-before-after">
          <BeforeAfter
            rows={rows}
            baselineLabel="On entering the task"
            caption="How far power moved, and how far the flow it is supposed to imply moved with it."
          />
          <TextEquivalent>{beforeAfterSentence(rows)}.</TextEquivalent>
          <ModelBoundary>{DEADBAND_CAPTION}</ModelBoundary>
        </PanelSection>
      ) : null}

      {reveal === 'transfer' ? (
        <PanelSection title="The transfer patient, read live" id="alarms-transfer">
          <TransferState principle="A power signature that has stopped tracking the flow it is supposed to imply is a reason to preserve the power path, examine the patient, and call the mechanical-support team — in any patient, and before any number has been explained.">
            <div className="mt-2 grid gap-2 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
              <LiveSetting
                label="External power"
                value={controller?.powerConnected ? 'connected' : 'not connected'}
                kind="modeled"
              />
              <LiveValue label="Pump power" value={metrics.pumpPowerW} unit="W" kind="displayed" />
              <LiveValue
                label="Displayed pump flow"
                value={metrics.deviceFlowLMin}
                unit="L/min"
                kind="estimated"
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
              {reading(metrics.deviceFlowLMin, 1)} L/min, and effective systemic delivery reads{' '}
              {reading(metrics.effectiveSystemicFlowLMin, 1)} L/min. {alarmSentence(alarms)}.
            </TextEquivalent>
          </TransferState>
        </PanelSection>
      ) : null}
    </div>
  )
}
