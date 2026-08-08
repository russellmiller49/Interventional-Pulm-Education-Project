import { mcsDerivedValueGuides } from '../../content/derivedValueGuides'
import {
  MCS_OXYGEN_DELIVERY_BOUNDARY,
  beforeAfterReadings,
  flowAccountView,
  reading,
} from './selectors'
import { mcsComparesAgainstActionBaseline, mcsMechanismDisclosed } from './revealStage'
import type { McsTeachingPanelProps } from './panelProps'
import {
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
  beforeAfterSentence,
  flowAccountSentence,
  styles,
} from './shared'

/**
 * Section 1 — the causal ladder, one rung at a time, from the live state.
 *
 * The figure is the ladder itself: a pressure rung, a flow rung with three separate lines on it, an
 * oxygen rung that says out loud that this engine calculates no oxygen delivery at all, and an organ
 * rung with nothing on it. The empty rung is the point. A learner who can see that the bottom of the
 * ladder is blank stops reading a preserved mean pressure as an answer to a question nobody asked it.
 *
 * Before a commitment the rungs carry their live values, their units and their kinds, and no
 * explanation of why the device line is empty — that is the prediction.
 */
export function SignalToPerfusionPanel({
  contract,
  state,
  reveal,
  beforeMetrics,
}: McsTeachingPanelProps) {
  const disclosed = mcsMechanismDisclosed(reveal)
  const metrics = state.metrics
  const account = flowAccountView(state)
  const rows = beforeAfterReadings(
    [
      {
        metric: 'mapMmHg',
        label: 'Mean arterial pressure',
        unit: 'mm Hg',
        digits: 0,
        kind: 'modeled',
      },
      { metric: 'nativeFlowLMin', label: 'Native contribution', unit: 'L/min', kind: 'modeled' },
      {
        metric: 'deviceFlowLMin',
        label: 'Displayed device contribution',
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
      <PanelSection title="The ladder, right now" id="signals-ladder">
        <ol className="mt-3 grid gap-2" data-causal-ladder>
          <li
            className="min-w-0 rounded-xl border-l-4 border-solid p-3"
            data-ladder-rung="pressure"
          >
            <p className="text-sm font-semibold">1. Pressure</p>
            <p className="mt-1 text-base font-semibold">
              {reading(metrics.mapMmHg, 0)} mm Hg mean arterial pressure
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              modeled · pulse pressure {reading(metrics.pulsePressureMmHg, 0)} mm Hg · wedge{' '}
              {reading(metrics.pcwpMmHg, 0)} mm Hg · right atrial {reading(metrics.rapMmHg, 0)} mm
              Hg
            </p>
            <p className="mt-1 text-xs leading-5">
              <span className="font-semibold">This rung can establish: </span>a driving pressure
              exists at the artery it is read from.
            </p>
            <p className="mt-1 text-xs leading-5">
              <span className="font-semibold">It cannot establish: </span>how much blood is moving.
              A mean pressure that reads as acceptable is not a statement about flow, and this
              simulation never treats one as adequate perfusion.
            </p>
          </li>

          <li className="min-w-0 rounded-xl border-l-4 border-solid p-3" data-ladder-rung="flow">
            <p className="text-sm font-semibold">2. Flow — three separate lines</p>
            <FlowAccount account={account} disclosed={disclosed} />
            <p className="mt-2 text-xs leading-5">
              <span className="font-semibold">This rung can establish: </span>how much blood is
              moving, and along which path each number describes it moving.
            </p>
            <p className="mt-1 text-xs leading-5">
              <span className="font-semibold">It cannot establish: </span>whether that blood is
              carrying enough oxygen, or whether it is reaching a tissue bed.
            </p>
          </li>

          <li
            className="min-w-0 rounded-xl border-l-4 border-solid p-3"
            data-ladder-rung="oxygen-delivery"
          >
            <p className="text-sm font-semibold">3. Oxygen delivery — not directly calculated</p>
            <div className="mt-2 grid gap-2 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
              <LiveValue
                label="Mixed venous saturation"
                value={metrics.svo2Percent}
                unit="%"
                digits={0}
                kind="modeled"
                note="Modeled delivery–consumption balance signal. It moves with the modeled balance among blood flow, oxygen availability assumptions, and tissue consumption and extraction assumptions. It is not a measurement of oxygen delivery, not a calculation of it, not proof that delivery is adequate, and this module sets no value for it to be driven toward."
              />
              <div
                className="min-w-0 rounded-xl border border-dashed p-3"
                data-live-value="Whole-body oxygen delivery"
                data-live-value-kind="not-modeled"
              >
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Whole-body oxygen delivery
                </p>
                <p className="text-sm font-semibold">not calculated by this simulation</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">not modeled</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Hemoglobin and arterial oxygen content are not modeled, so the product that would
                  make an oxygen-delivery figure does not exist here.
                </p>
              </div>
            </div>
            <ModelBoundary>{MCS_OXYGEN_DELIVERY_BOUNDARY}</ModelBoundary>
          </li>

          <li
            className="min-w-0 rounded-xl border-l-4 border-dashed p-3"
            data-ladder-rung="organ-response"
          >
            <p className="text-sm font-semibold">4. Organ response — empty in this simulation</p>
            <UnmodeledOrganResponse />
          </li>
        </ol>

        <TextEquivalent>
          The simulation directly populates pressure and flow. It does not calculate whole-body
          oxygen delivery because hemoglobin and arterial oxygen content are not modeled. It
          provides a modeled downstream delivery–consumption balance signal through mixed venous
          saturation, and it does not model organ response. Pressure: {reading(metrics.mapMmHg, 0)}{' '}
          mm Hg mean arterial pressure, with a wedge pressure of {reading(metrics.pcwpMmHg, 0)} and
          a right atrial pressure of {reading(metrics.rapMmHg, 0)} mm Hg. Flow:{' '}
          {flowAccountSentence(account, disclosed)} The modeled balance signal reads{' '}
          {reading(metrics.svo2Percent, 0)} percent. Organ response: nothing at all.
        </TextEquivalent>

        <ModelBoundary>
          The four rungs are a teaching order, not a measurement chain. Each value is produced
          independently by the model rather than derived from the rung above it, and the reason they
          are drawn in one column is that a learner reading one rung tends to answer at another.
        </ModelBoundary>

        <FigureScope
          establishes="Which question each reading on this screen answers, and which of the three flow numbers is the one the circulation actually experiences."
          doesNotEstablish="Whether this circulation is adequate. Nothing on the ladder answers at the organ level, and the bottom rung is empty here by construction."
        />
      </PanelSection>

      <PanelSection title="Cardiac power — a pressure–flow summary" id="signals-cpo">
        <GuidedValue
          guide={mcsDerivedValueGuides.cardiacPowerOutputW}
          value={metrics.cardiacPowerOutputW}
        />
        <p className="mt-3 text-xs leading-5" data-cpo-caution>
          Cardiac power multiplies a pressure by a flow, so it sits across two rungs of the ladder
          at once. That makes it a compact summary and a poor substitute for either. It can rise
          while the flow term inside it falls — a state this module reaches later on durable support
          — so a rising value is never on its own evidence that delivery improved.
        </p>
        <TextEquivalent>
          Cardiac power reads {reading(metrics.cardiacPowerOutputW, 2)} W, computed from a mean
          arterial pressure of {reading(metrics.mapMmHg, 0)} mm Hg and an effective systemic
          delivery of {reading(metrics.effectiveSystemicFlowLMin, 1)} L/min. Because it is a
          product, it can move upward while the flow inside it moves downward.
        </TextEquivalent>
      </PanelSection>

      {mcsComparesAgainstActionBaseline(reveal) ? (
        <PanelSection title="The same readings, before and now" id="signals-before-after">
          <BeforeAfter
            rows={rows}
            baselineLabel="On entering the task"
            caption="Readings captured when the task began, beside the readings now."
          />
          <TextEquivalent>{beforeAfterSentence(rows)}.</TextEquivalent>
          <ModelBoundary>
            {DEADBAND_CAPTION} This section changes nothing in the patient, so anything that does
            move between the two columns is the fixed-step model settling rather than a response to
            you.
          </ModelBoundary>
        </PanelSection>
      ) : null}

      {reveal === 'transfer' ? (
        <PanelSection title="The transfer patient, read live" id="signals-transfer">
          <TransferState principle="Three readings, three different questions. A preserved mean pressure answers at the pressure level and nowhere else, and the flow account has three lines rather than one number — in this patient exactly as in the last one.">
            <div className="mt-2 grid gap-2 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
              <LiveValue
                label="Mean arterial pressure"
                value={metrics.mapMmHg}
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
                label="Mixed venous saturation"
                value={metrics.svo2Percent}
                unit="%"
                digits={0}
                kind="modeled"
                note="Modeled delivery–consumption balance signal."
              />
              <LiveValue
                label="Cardiac power"
                value={metrics.cardiacPowerOutputW}
                unit="W"
                digits={2}
                kind="derived"
              />
            </div>
            <FlowAccount account={account} disclosed={disclosed} />
            <TextEquivalent>
              In the transfer patient: mean arterial pressure {reading(metrics.mapMmHg, 0)} mm Hg,
              effective systemic delivery {reading(metrics.effectiveSystemicFlowLMin, 1)} L/min,
              modeled delivery–consumption balance signal {reading(metrics.svo2Percent, 0)} percent,
              cardiac power {reading(metrics.cardiacPowerOutputW, 2)} W.{' '}
              {flowAccountSentence(account, disclosed)}
            </TextEquivalent>
          </TransferState>
        </PanelSection>
      ) : null}
    </div>
  )
}
