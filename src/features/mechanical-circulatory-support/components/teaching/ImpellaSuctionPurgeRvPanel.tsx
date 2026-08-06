import {
  MCS_MODEL_BOUNDARY_REFERENCES,
  mcsDerivedValueGuides,
} from '../../content/derivedValueGuides'
import type { McsTeachingPanelProps } from './panelProps'
import { mcsComparesAgainstActionBaseline, mcsMechanismDisclosed } from './revealStage'
import {
  MCS_ESTIMATED_FLOW_BOUNDARY,
  activeAlarms,
  beforeAfterReadings,
  flowAccountView,
  impellaView,
  mcsComparisonPathways,
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
  PathwayGraphic,
  TextEquivalent,
  TransferState,
  alarmSentence,
  beforeAfterSentence,
  flowAccountSentence,
  pathwaySentence,
  styles,
} from './shared'

/**
 * Section 6 — one low flow, four different problems it could be.
 *
 * The figure is a reconciliation table rather than a diagnosis. Each domain gets the readings that
 * speak to it and a sentence saying what those readings can and cannot settle, because the error
 * this section exists to prevent is reading one low number and reaching for the setting.
 *
 * Two arithmetic rules are structural here. The right-sided flow is drawn on the pulmonary side of
 * the account and never enters the systemic total, and pump balance is labelled as a difference
 * between two pumps rather than as an output — it is the only number on the panel that would be
 * meaningless as a delivery, and the one most likely to be read as one.
 */

export function ImpellaSuctionPurgeRvPanel({
  contract,
  state,
  reveal,
  beforeMetrics,
}: McsTeachingPanelProps) {
  const disclosed = mcsMechanismDisclosed(reveal)
  const metrics = state.metrics
  const pump = impellaView(state)
  const account = flowAccountView(state)
  const alarms = activeAlarms(state)
  const rows = beforeAfterReadings(
    [
      {
        metric: 'rightDeviceFlowLMin',
        label: 'Right-sided pump flow, into the lung',
        unit: 'L/min',
        kind: 'estimated',
      },
      {
        metric: 'leftDeviceFlowLMin',
        label: 'Left-sided pump flow, into the aorta',
        unit: 'L/min',
        kind: 'estimated',
      },
      {
        metric: 'effectiveSystemicFlowLMin',
        label: 'Effective systemic delivery',
        unit: 'L/min',
        kind: 'reasoned',
      },
      {
        metric: 'rapMmHg',
        label: 'Right atrial pressure',
        unit: 'mm Hg',
        digits: 0,
        kind: 'modeled',
      },
      { metric: 'pcwpMmHg', label: 'Wedge pressure', unit: 'mm Hg', digits: 0, kind: 'modeled' },
      { metric: 'papi', label: 'Pulmonary pulsatility ratio', unit: '', kind: 'derived' },
    ],
    beforeMetrics,
    metrics,
  )

  const domains = [
    {
      id: 'preload-and-suction',
      title: 'Preload and right-sided delivery',
      readings: `right atrial pressure ${reading(metrics.rapMmHg, 0)} mm Hg · wedge ${reading(metrics.pcwpMmHg, 0)} mm Hg · left-sided suction ${pump?.leftSuction ? 'present' : 'absent'} · right-sided suction ${pump?.rightSuction ? 'present' : 'absent'}`,
      settles:
        'Whether the modeled chamber a pump is drawing from has volume in it, and whether the model has entered a suction state.',
      doesNotSettle:
        'Why the volume is not arriving. A high right atrial pressure with an underfilled left ventricle points upstream; it does not name the cause.',
    },
    {
      id: 'position',
      title: 'Position',
      readings: `left ${pump?.leftPositionWords ?? 'not applicable'} · right ${pump?.rightEnabled ? (pump?.rightPositionWords ?? 'not applicable') : 'no right-sided pump in place'}`,
      settles: 'What the modeled placement state currently is for each pump.',
      doesNotSettle:
        'Where either device actually sits. Real position is an imaging question and belongs to qualified operators under current instructions.',
    },
    {
      id: 'afterload',
      title: 'Afterload and pulmonary vascular load',
      readings: `systemic vascular resistance ${reading(state.patient.systemicVascularResistanceDynSecCm5, 0)} dyn·s·cm⁻⁵ · pulmonary vascular resistance ${reading(state.patient.pulmonaryVascularResistanceWU, 1)} Wood units · mean arterial pressure ${reading(metrics.mapMmHg, 0)} mm Hg`,
      settles:
        'What each pump is currently ejecting against — systemic pressure for the left-sided pump, pulmonary load for the right-sided one.',
      doesNotSettle:
        'Whether a high load is the limiting problem rather than one of several. Loads and filling change flow through the same displayed number.',
    },
    {
      id: 'purge',
      title: 'Purge path',
      readings: `left ${pump?.leftPurgeWords ?? 'not applicable'} · right ${pump?.rightEnabled ? (pump?.rightPurgeWords ?? 'not applicable') : 'no right-sided pump in place'}`,
      settles:
        'Whether a purge warning is present in this simulation. In this model a purge warning raises an alarm and changes no modeled blood flow at all.',
      doesNotSettle:
        'Anything about flow, filling, or blood trauma. A purge warning and a suction state are different problems with different causes, and this module authors no purge-fluid or anticoagulation management.',
    },
  ] as const

  return (
    <div className={styles.panel} data-teaching-panel={contract.sectionId}>
      <PanelSection title="Two pumps, in series, on one circulation" id="rv-pathways">
        <div className="grid gap-3">
          <div data-pump-side="right">
            <p className={styles.subheading}>Right-sided pump — a delivery to the lung</p>
            <PathwayGraphic pathway={mcsComparisonPathways.impellaRight} />
          </div>
          <div data-pump-side="left">
            <p className={styles.subheading}>Left-sided pump — a delivery to the body</p>
            <PathwayGraphic pathway={mcsComparisonPathways.impellaLeft} />
          </div>
        </div>
        <p className="mt-3 text-xs leading-5" data-serial-not-additive>
          These pathways are in series. The right-sided pump delivers venous blood into the
          pulmonary artery; that blood crosses the lungs, fills the left heart, and is then moved
          onward by the left-sided pump. One stream, measured at two stages. Adding the two
          displayed flows counts that blood twice, so they are never summed here — and the systemic
          device-flow signal carries the left-sided pump only.
        </p>
        <TextEquivalent>
          {pathwaySentence(mcsComparisonPathways.impellaRight)}{' '}
          {pathwaySentence(mcsComparisonPathways.impellaLeft)} The two are serial and their
          displayed flows are never added.
        </TextEquivalent>
        <FigureScope
          establishes="Where each pump draws from, where each returns to, and why one of the two numbers has not reached the systemic circulation yet."
          doesNotEstablish="Whether this patient needed a second pump. Biventricular support is a decision made with the responsible team, not a reading."
        />
      </PanelSection>

      <PanelSection title="The flow account, with the sides kept apart" id="rv-flow">
        <FlowAccount account={account} disclosed={disclosed} />
        <div className="mt-3 grid gap-2 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
          <LiveValue
            label="Pump balance"
            value={metrics.pumpBalanceLMin}
            unit="L/min"
            kind="derived"
            note="The right-sided flow minus the left-sided flow. It is a difference between two pumps, used to notice when more is being delivered into the lung than the left heart is handling. It is not an output, and nothing receives it."
          />
          <LiveValue
            label="Effective systemic delivery"
            value={metrics.effectiveSystemicFlowLMin}
            unit="L/min"
            kind="reasoned"
            note="What reaches the systemic circulation. The right-sided pump flow is not part of this number."
          />
        </div>
        <TextEquivalent>
          {flowAccountSentence(account, disclosed)} Pump balance reads{' '}
          {reading(metrics.pumpBalanceLMin, 1)} L/min, which is the difference between the two pumps
          and not a delivery to anything. Effective systemic delivery is{' '}
          {reading(metrics.effectiveSystemicFlowLMin, 1)} L/min and does not contain the right-sided
          flow.
        </TextEquivalent>
        <ModelBoundary>{MCS_ESTIMATED_FLOW_BOUNDARY}</ModelBoundary>
        {disclosed ? (
          <p className="mt-2 text-xs leading-5" data-rp-role>
            A right-sided pump restores delivery through the lungs and therefore filling of the left
            heart. That is what lets a left-sided pump move blood it previously did not have. It
            does not become a second systemic stream, and its number never enters the systemic
            total.
          </p>
        ) : null}
      </PanelSection>

      <PanelSection title="One low flow, four separate questions" id="rv-differential">
        <div className={styles.scroller}>
          <table className={`${styles.table} min-w-[34rem]`} data-low-flow-differential>
            <caption className="text-left text-xs leading-5 text-muted-foreground">
              Each domain with the readings that speak to it, what those readings can settle, and
              what they cannot. Reconciling all four is the task; no single row is a diagnosis.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="pb-1 pr-3 font-semibold">
                  Domain
                </th>
                <th scope="col" className="pb-1 pr-3 font-semibold">
                  Readings now
                </th>
                <th scope="col" className="pb-1 pr-3 font-semibold">
                  Can settle
                </th>
                <th scope="col" className="pb-1 font-semibold">
                  Cannot settle
                </th>
              </tr>
            </thead>
            <tbody>
              {domains.map((domain) => (
                <tr key={domain.id} data-differential-domain={domain.id}>
                  <th scope="row" className="py-1 pr-3 align-top font-medium">
                    {domain.title}
                  </th>
                  <td className="py-1 pr-3 align-top">{domain.readings}</td>
                  <td className="py-1 pr-3 align-top">{domain.settles}</td>
                  <td className="py-1 align-top">{domain.doesNotSettle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TextEquivalent>
          {domains
            .map((domain) => `${domain.title}: ${domain.readings}. Can settle: ${domain.settles}`)
            .join('. ')}
          .
        </TextEquivalent>
        <div className="mt-3 grid gap-2 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
          <LiveSetting
            label="Left-sided purge state"
            value={pump?.leftPurgeWords ?? 'not applicable'}
            kind="modeled"
            note="A purge warning in this simulation raises an alarm and changes no modeled blood flow. It is not the same problem as suction, and it has a different cause."
          />
          <LiveSetting
            label="Suction state"
            value={
              pump?.leftSuction
                ? 'left-sided suction present'
                : pump?.rightSuction
                  ? 'right-sided suction present'
                  : 'no suction state in this model'
            }
            kind="modeled"
            note="A suction state means the chamber a pump is drawing from is underfilled or restricted relative to what has been asked of it."
          />
        </div>
        <ModelBoundary>
          Haemolysis is not modeled anywhere in this simulation, and neither is the detailed
          behaviour of a purge system. The blood-trauma alarm is a modeled risk flag, not a
          haemolysis outcome, and no purge-fluid or anticoagulation management is authored here.
        </ModelBoundary>
        <FigureScope
          establishes="Which readings belong to which of the four domains, and what each domain can and cannot answer on its own."
          doesNotEstablish="Which domain is responsible. That is a reconciliation across all four, made with the patient in front of you."
        />
      </PanelSection>

      <PanelSection title="Right-sided filling, and the ratio that will not report it" id="rv-papi">
        <div className="mt-3 grid gap-2 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
          <LiveValue
            label="Right atrial pressure"
            value={metrics.rapMmHg}
            unit="mm Hg"
            digits={0}
            kind="modeled"
            note="The pressure behind the right ventricle, and the reading that moves first when right-sided delivery changes in this model."
          />
          <LiveValue
            label="Pulmonary vascular resistance"
            value={state.patient.pulmonaryVascularResistanceWU}
            unit="Wood units"
            kind="modeled"
            note="The load a right-sided pump ejects against."
          />
        </div>
        <GuidedValue
          guide={mcsDerivedValueGuides.pulmonaryArteryPulsatilityIndex}
          value={metrics.papi}
        />
        <p className="mt-3 text-xs leading-5" data-papi-limitation>
          <span className="font-semibold">A limit of this model. </span>
          {MCS_MODEL_BOUNDARY_REFERENCES.rvLimitedPapiMax.statement}{' '}
          {MCS_MODEL_BOUNDARY_REFERENCES.rvLimitedPapiMax.appliesWhen} In this model the pulmonary
          pulse pressure that forms the numerator is a function of right ventricular contractility
          alone, so right-sided support moves the ratio only through the right atrial pressure in
          its denominator — a change of about a tenth for several litres per minute of delivery. It
          must not be used on its own to judge whether right-sided support is working, and nothing
          in this section asks you to read it that way.
        </p>
        <TextEquivalent>
          Right atrial pressure is {reading(metrics.rapMmHg, 0)} mm Hg, pulmonary vascular
          resistance is {reading(state.patient.pulmonaryVascularResistanceWU, 1)} Wood units, and
          the pulmonary pulsatility ratio is {reading(metrics.papi, 1)}. In this model that ratio
          barely responds to right-sided support, and it responds through the right atrial pressure
          rather than through the pulmonary pulse.
        </TextEquivalent>
      </PanelSection>

      <PanelSection title="Active alarms" id="rv-alarms">
        <AlarmBand alarms={alarms} />
        <TextEquivalent>{alarmSentence(alarms)}.</TextEquivalent>
      </PanelSection>

      {mcsComparesAgainstActionBaseline(reveal) ? (
        <PanelSection title="Before right-sided support, and now" id="rv-before-after">
          <BeforeAfter
            rows={rows}
            baselineLabel="On entering the task"
            caption="The two pump flows on separate rows, the systemic delivery that contains only one of them, and the right-sided filling pressures."
          />
          <TextEquivalent>{beforeAfterSentence(rows)}.</TextEquivalent>
          <ModelBoundary>{DEADBAND_CAPTION}</ModelBoundary>
        </PanelSection>
      ) : null}

      {reveal === 'transfer' ? (
        <PanelSection title="The transfer patient, read live" id="rv-transfer">
          <TransferState principle="A pump in suction is short of blood, not short of setting. Raising support against an underfilled chamber worsens the underfilling and the blood trauma, whichever side of the circulation the shortage came from.">
            <div className="mt-2 grid gap-2 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
              <LiveValue
                label="Preload"
                value={state.patient.preloadPercent}
                unit="% of reference"
                digits={0}
                kind="modeled"
              />
              <LiveSetting
                label="Suction state"
                value={
                  pump?.leftSuction
                    ? 'left-sided suction present'
                    : pump?.rightSuction
                      ? 'right-sided suction present'
                      : 'no suction state in this model'
                }
                kind="modeled"
              />
              <LiveValue
                label="Left-sided performance level"
                value={pump ? pump.leftLevel : null}
                digits={0}
                kind="displayed"
              />
              <LiveValue
                label="Effective systemic delivery"
                value={metrics.effectiveSystemicFlowLMin}
                unit="L/min"
                kind="reasoned"
              />
            </div>
            <FlowAccount account={account} disclosed={disclosed} />
            <AlarmBand alarms={alarms} />
            <TextEquivalent>
              In the transfer patient preload is {reading(state.patient.preloadPercent, 0)} percent
              of reference, the left-sided performance level is {pump ? pump.leftLevel : '—'}, and
              effective systemic delivery is {reading(metrics.effectiveSystemicFlowLMin, 1)} L/min.{' '}
              {flowAccountSentence(account, disclosed)} {alarmSentence(alarms)}.
            </TextEquivalent>
          </TransferState>
        </PanelSection>
      ) : null}
    </div>
  )
}
