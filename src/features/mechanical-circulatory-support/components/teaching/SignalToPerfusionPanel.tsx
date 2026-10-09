import { mcsDerivedValueGuides } from '../../content/derivedValueGuides'
import { beforeAfterReadings, flowAccountView, reading } from './selectors'
import { mcsComparesAgainstActionBaseline, mcsMechanismDisclosed } from './revealStage'
import type { McsTeachingPanelProps } from './panelProps'
import {
  BeforeAfter,
  FigureCaption,
  FlowAccount,
  GuidedValue,
  LiveValue,
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
 * rung with nothing on it. The empty rung is the point. A learner who can see that the top of the
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
  withholdFlowAccount = false,
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
        {/*
         * One orientation, said once (F08). The rungs are listed down the page from the first to the
         * fourth, so the panel used to call the organ rung "the bottom rung" while the question
         * feedback and the glossary called organ response "the top of the ladder". A ladder is
         * climbed: pressure is the first rung, organ response is the top, and every surface says so.
         */}
        <p className="mt-2 text-xs leading-5" data-ladder-orientation>
          Read it as a climb: pressure is the first rung and organ response is the top. The list
          runs from the first rung to the top, and a reading on one rung answers only that
          rung&rsquo;s question.
        </p>
        {/*
         * The rung titles carry their own numbers, so the list draws no marker of its own. Inside
         * the stage every ordered list is given a decimal marker, which printed "1. 1. Pressure"
         * (F06); the inline style is what jsdom can see, the class is what the page uses.
         */}
        <ol
          className="mt-3 grid list-none gap-2 pl-0"
          style={{ listStyle: 'none', paddingLeft: 0 }}
          data-causal-ladder
        >
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
            <p className="mt-1 text-xs leading-5" data-rung-scope>
              <span className="font-semibold">Answers: </span>a driving pressure exists at the
              artery it is read from. <span className="font-semibold">Does not answer: </span>how
              much blood is moving.
            </p>
          </li>

          <li className="min-w-0 rounded-xl border-l-4 border-solid p-3" data-ladder-rung="flow">
            <p className="text-sm font-semibold">2. Flow — three separate lines</p>
            {withholdFlowAccount ? (
              <p className="mt-2 text-xs leading-5" data-flow-account-withheld>
                Covered until you have committed your prediction of what this account will show.
              </p>
            ) : (
              <FlowAccount account={account} disclosed={disclosed} />
            )}
            <p className="mt-2 text-xs leading-5" data-rung-scope>
              <span className="font-semibold">Answers: </span>how much blood is moving, and along
              which path each number describes it moving.{' '}
              <span className="font-semibold">Does not answer: </span>whether that blood carries
              enough oxygen, or reaches a tissue bed.
            </p>
          </li>

          <li
            className="min-w-0 rounded-xl border-l-4 border-solid p-3"
            data-ladder-rung="oxygen-delivery"
          >
            <p className="text-sm font-semibold">3. Oxygen delivery</p>
            <div className="mt-2 grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
              <LiveValue
                label="Mixed venous saturation"
                value={metrics.svo2Percent}
                unit="%"
                digits={0}
                kind="modeled"
                note="Falls when oxygen delivery falls short of consumption."
              />
              <div
                className="min-w-0 rounded-xl border border-dashed p-3"
                data-live-value="Whole-body oxygen delivery"
                data-live-value-kind="not-modeled"
              >
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Whole-body oxygen delivery
                </p>
                <p className="text-sm font-semibold">not in the simulator</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Cardiac output × arterial oxygen content. The simulator has no hemoglobin.
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs leading-5" data-rung-scope>
              <span className="font-semibold">Answers: </span>which way the balance between delivery
              and consumption is leaning. <span className="font-semibold">Does not answer: </span>
              how much oxygen is delivered, or whether it is enough.
            </p>
          </li>

          <li
            className="min-w-0 rounded-xl border-l-4 border-dashed p-3"
            data-ladder-rung="organ-response"
          >
            <p className="text-sm font-semibold">4. Organ response</p>
            <p className="mt-1 text-xs leading-5" data-rung-scope>
              <span className="font-semibold">The top rung, and the goal of support. </span>
              Mentation, urine output, skin perfusion and the lactate trend answer here. Read them
              at the bedside; the simulator has none of them.
            </p>
            <details className="mt-2 text-xs leading-5" data-rung-detail="organ-response">
              <summary className="cursor-pointer font-semibold">
                Why each organ finding matters
              </summary>
              <UnmodeledOrganResponse />
            </details>
          </li>
        </ol>

        <TextEquivalent>
          Pressure: {reading(metrics.mapMmHg, 0)} mm Hg mean arterial pressure, with a wedge
          pressure of {reading(metrics.pcwpMmHg, 0)} and a right atrial pressure of{' '}
          {reading(metrics.rapMmHg, 0)} mm Hg. Flow:{' '}
          {withholdFlowAccount
            ? 'covered until the prediction is committed.'
            : flowAccountSentence(account, disclosed)}{' '}
          Mixed venous saturation: {reading(metrics.svo2Percent, 0)} percent. Organ response: read
          at the bedside.
        </TextEquivalent>

        <FigureCaption>
          Each reading answers its own rung&rsquo;s question. One of the three flow numbers is the
          flow the circulation actually receives.
        </FigureCaption>
      </PanelSection>

      <PanelSection title="Cardiac power — a pressure–flow summary" id="signals-cpo" reference>
        <GuidedValue
          guide={mcsDerivedValueGuides.cardiacPowerOutputW}
          value={metrics.cardiacPowerOutputW}
        />
        <p className="mt-3 text-xs leading-5" data-cpo-caution>
          Cardiac power multiplies a pressure by a flow, so it sits across two rungs of the ladder
          at once. It can rise while flow falls, as it does on a durable pump when blood pressure
          climbs, so a rising value is not on its own evidence that delivery improved.
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
          <p className="mt-2 text-xs leading-5">
            Nothing in this section changes the patient, so the two columns should match.
          </p>
        </PanelSection>
      ) : null}

      {reveal === 'transfer' ? (
        <PanelSection title="The transfer patient, read live" id="signals-transfer">
          <TransferState principle="Three readings, three different questions. A preserved mean pressure answers at the pressure level and nowhere else, and the flow account has three lines rather than one number — in this patient exactly as in the last one.">
            <div className="mt-2 grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
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
                note="Falls when delivery falls short of consumption."
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
              mixed venous saturation {reading(metrics.svo2Percent, 0)} percent, cardiac power{' '}
              {reading(metrics.cardiacPowerOutputW, 2)} W. {flowAccountSentence(account, disclosed)}
            </TextEquivalent>
          </TransferState>
        </PanelSection>
      ) : null}
    </div>
  )
}
