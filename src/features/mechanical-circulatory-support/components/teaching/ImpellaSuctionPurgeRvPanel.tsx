import {
  MCS_MODEL_BOUNDARY_REFERENCES,
  mcsDerivedValueGuides,
} from '../../content/derivedValueGuides'
import type { McsTeachingPanelProps } from './panelProps'
import { mcsComparesAgainstActionBaseline, mcsMechanismDisclosed } from './revealStage'
import {
  activeAlarms,
  inflowLimitView,
  beforeAfterReadings,
  flowAccountView,
  impellaView,
  mcsComparisonPathways,
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
  const inflowLimit = inflowLimitView(state)
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
        'Whether the chamber a pump draws from has volume in it, and whether suction is present.',
      doesNotSettle:
        'Why the volume is not arriving. A high right atrial pressure with an underfilled left ventricle points to the right heart; a low one points to hypovolemia.',
    },
    {
      id: 'position',
      title: 'Position',
      readings: `left ${pump?.leftPositionWords ?? 'not applicable'} · right ${pump?.rightEnabled ? (pump?.rightPositionWords ?? 'not applicable') : 'no right-sided pump in place'}`,
      settles: 'The placement state of each pump.',
      doesNotSettle:
        'Where either device actually sits. Confirm it with echo and the placement signal.',
    },
    {
      id: 'afterload',
      title: 'Afterload and pulmonary vascular load',
      readings: `systemic vascular resistance ${reading(state.patient.systemicVascularResistanceDynSecCm5, 0)} dyn·s·cm⁻⁵ · pulmonary vascular resistance ${reading(state.patient.pulmonaryVascularResistanceWU, 1)} Wood units · mean arterial pressure ${reading(metrics.mapMmHg, 0)} mm Hg`,
      settles:
        'What each pump ejects against: systemic pressure for the left pump, pulmonary vascular resistance for the right.',
      doesNotSettle: 'Whether load or filling is the limit. Both lower the same displayed flow.',
    },
    {
      id: 'purge',
      title: 'Purge path',
      readings: `left ${pump?.leftPurgeWords ?? 'not applicable'} · right ${pump?.rightEnabled ? (pump?.rightPurgeWords ?? 'not applicable') : 'no right-sided pump in place'}`,
      settles: 'Whether a purge alarm is active.',
      doesNotSettle:
        'Anything about flow or filling. A purge alarm and suction are different problems with different causes.',
    },
  ] as const

  return (
    <div className={styles.panel} data-teaching-panel={contract.sectionId}>
      {/*
        Where the right-sided pump returns its blood is this section's own identification, and
        whether the two pump flows add is its prediction. Before the commitment the panel shows the
        left-sided pathway that is in place and says a second pump is drawn on the map; the
        right-sided pathway, the series relationship and the never-summed rule arrive with the
        commitment.
      */}
      <PanelSection
        title={
          disclosed ? 'Two pumps, in series, on one circulation' : 'Two pumps on one circulation'
        }
        id="rv-pathways"
      >
        <div className="grid gap-3">
          {disclosed ? (
            <div data-pump-side="right">
              <p className={styles.subheading}>Right-sided pump — a delivery to the lung</p>
              <PathwayGraphic pathway={mcsComparisonPathways.impellaRight} />
            </div>
          ) : (
            <p className="text-xs leading-5" data-pump-side="right" data-withheld>
              A right-sided pump can be started beside the left-sided one. Where it draws from and
              where it returns is the question this section opens with. Use the map beside the
              monitor.
            </p>
          )}
          <div data-pump-side="left">
            <p className={styles.subheading}>Left-sided pump — a delivery to the body</p>
            <PathwayGraphic pathway={mcsComparisonPathways.impellaLeft} />
          </div>
        </div>
        {disclosed ? (
          <p className="mt-3 text-xs leading-5" data-serial-not-additive>
            These pathways are in series. The right-sided pump delivers venous blood into the
            pulmonary artery; that blood crosses the lungs, fills the left heart, and is then moved
            onward by the left-sided pump. One stream, measured at two stages. Adding the two
            displayed flows counts that blood twice. Systemic flow is the left-sided number.
          </p>
        ) : null}
        <TextEquivalent>
          {disclosed ? `${pathwaySentence(mcsComparisonPathways.impellaRight)} ` : ''}
          {pathwaySentence(mcsComparisonPathways.impellaLeft)}
          {disclosed ? ' The two are serial and their displayed flows are never added.' : ''}
        </TextEquivalent>
      </PanelSection>

      <PanelSection title="The flow account, with the sides kept apart" id="rv-flow">
        <FlowAccount account={account} disclosed={disclosed} />
        <div className="mt-3 grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
          <LiveValue
            label="Pump balance"
            value={metrics.pumpBalanceLMin}
            unit="L/min"
            kind="derived"
            note="Right-sided flow minus left-sided flow. A positive balance means more blood is going into the lung than the left heart is moving on: watch for pulmonary congestion."
          />
          <LiveValue
            label="Effective systemic delivery"
            value={metrics.effectiveSystemicFlowLMin}
            unit="L/min"
            kind="reasoned"
            note="What reaches the body. Right-sided pump flow is not part of it."
          />
        </div>
        <TextEquivalent>
          {flowAccountSentence(account, disclosed)} Pump balance reads{' '}
          {reading(metrics.pumpBalanceLMin, 1)} L/min: right-sided flow minus left-sided flow.
          Effective systemic delivery is {reading(metrics.effectiveSystemicFlowLMin, 1)} L/min and
          does not contain the right-sided flow.
        </TextEquivalent>

        {disclosed ? (
          <p className="mt-2 text-xs leading-5" data-rp-role>
            A left-sided pump cannot pump what the right heart does not deliver. When the right
            ventricle is the limit, treat the right heart (an inotrope, a pulmonary vasodilator,
            right-sided support) rather than raising the left pump further. A right-sided pump
            restores filling of the left heart; it is not a second systemic stream.
          </p>
        ) : null}
      </PanelSection>

      <PanelSection title="One low flow, four separate questions" id="rv-differential" reference>
        <div className={styles.scroller}>
          <table className={`${styles.table} min-w-[34rem]`} data-low-flow-differential>
            <caption className="text-left text-xs leading-5 text-muted-foreground">
              Each domain with the readings that speak to it, what they settle and what they leave
              open. Work through all four before you touch the P-level.
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
        <div className="mt-3 grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
          <LiveSetting
            label="Left-sided purge state"
            value={pump?.leftPurgeWords ?? 'not applicable'}
            kind="modeled"
            note="A purge alarm is a problem in the purge system, not in blood flow. It is not suction."
          />
          <LiveSetting
            label="Suction state"
            value={
              pump?.leftSuction
                ? 'left-sided suction present'
                : pump?.rightSuction
                  ? 'right-sided suction present'
                  : 'no suction'
            }
            kind="modeled"
            note="Suction means the inlet is short of blood for the P-level in use. It is a statement about inflow, not about how big the ventricle is."
          />
          {inflowLimit ? (
            <LiveSetting
              label="What is limiting inflow to the left pump"
              value={inflowLimit.label}
              kind="modeled"
              note={inflowLimit.note}
            />
          ) : null}
        </div>
        <section className="mt-3 text-xs leading-5" data-suction-first-moves>
          <h5 className="font-semibold">Suction alarm: first moves</h5>
          <ol className="mt-1 grid gap-1">
            <li>Reduce the P-level by one or two levels.</li>
            <li>Give volume if the patient is underfilled.</li>
            <li>Check catheter position with echo.</li>
            <li>Assess the right ventricle.</li>
            <li>Then return to the previous P-level.</li>
          </ol>
          <p className="mt-1 text-muted-foreground">Impella instructions for use, p. 7.17.</p>
        </section>
      </PanelSection>

      <PanelSection title="Right-sided filling, and the ratio that will not report it" id="rv-papi">
        <div className="mt-3 grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
          <LiveValue
            label="Right atrial pressure"
            value={metrics.rapMmHg}
            unit="mm Hg"
            digits={0}
            kind="modeled"
            note="The pressure behind the right ventricle. It falls when a right-sided pump takes venous return past it."
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
          <span className="font-semibold">Simulator value. </span>
          {MCS_MODEL_BOUNDARY_REFERENCES.rvLimitedPapiMax.statement} Here the ratio barely moves
          when right-sided support starts, because the simulator ties pulmonary pulse pressure to
          right ventricular contractility alone. Judge right-sided support from right atrial
          pressure and left-sided filling instead.
        </p>
        <TextEquivalent>
          Right atrial pressure is {reading(metrics.rapMmHg, 0)} mm Hg, pulmonary vascular
          resistance is {reading(state.patient.pulmonaryVascularResistanceWU, 1)} Wood units, and
          the pulmonary pulsatility ratio is {reading(metrics.papi, 1)}.
        </TextEquivalent>
      </PanelSection>

      <PanelSection title="Active alarms" id="rv-alarms">
        <AlarmBand alarms={alarms} disclosed={disclosed} />
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
        </PanelSection>
      ) : null}

      {reveal === 'transfer' ? (
        <PanelSection title="The transfer patient, read live" id="rv-transfer">
          <TransferState principle="Suction means the inlet is short of blood for the P-level in use: underfilling, right heart failure or position. Turn the P-level down, find the cause, and only then turn it back up. Raising it into suction worsens the underfilling and the hemolysis.">
            <div className="mt-2 grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
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
                      : 'no suction'
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
            <AlarmBand alarms={alarms} disclosed={disclosed} />
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
