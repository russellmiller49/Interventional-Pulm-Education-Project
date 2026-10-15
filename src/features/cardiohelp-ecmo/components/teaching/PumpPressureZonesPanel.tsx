'use client'

import { ecmoDerivedValueGuides } from '../../content/ecmoValueGuides'
import { ecmoReferenceProfileForMode } from '../../content/referenceProfiles'
import type { EcmoSimulationState } from '../../engine/types'
import { EcmoCircuitWalk } from './EcmoCircuitWalk'
import { useStageTeachingScope } from '../stage/StageTeachingScope'
import { EcmoLocalizationCard } from './EcmoLocalizationCard'
import { EcmoCircuitPressureReference } from './EcmoReferenceValues'
import {
  ChannelValue,
  FoundationTeachingBlock,
  VaConfigurationLabel,
  GuidedValue,
  TextEquivalent,
  comparisonPhrase,
  direction,
  styles,
} from './shared'
import { useEcmoCircuitWalkNavigation, type EcmoWalkPanelProps } from './useEcmoCircuitWalk'

/**
 * Speed is selected; flow is what the circuit returns under its current loading.
 *
 * Comparisons here are against *this modeled circuit's own reference state*, never against
 * "normal ECMO values" — the reference profile is an authored teaching anchor, and calling it
 * normal would turn a model constant into a clinical claim.
 *
 * This is where the module states its diagnostic grammar, and the three "mechanism previews" it
 * used to keep in a private array are now four rows of the shared localization registry, rendered
 * by reference. Two things changed and both were already true: the gas path is one of the four
 * recurring patterns and was only ever missing from the preview list, and the sentences a drill
 * later uses are now literally the sentences shown here rather than a paraphrase of them.
 *
 * The scaffold stops at pattern and location. What to inspect, the response that fits and the
 * reflex to avoid stay with the drills, because a learner meeting this table is looking at a
 * circuit with nothing wrong with it and has not been asked to diagnose anything yet.
 */

export function PumpPressureZonesPanel({
  state,
  walk,
}: {
  readonly state: EcmoSimulationState
  readonly walk?: EcmoWalkPanelProps
}) {
  const { circuit, device } = state
  const navigation = useEcmoCircuitWalkNavigation('pump-and-pressure-zones', walk)
  const scope = useStageTeachingScope()
  const profile = ecmoReferenceProfileForMode(state.supportMode)
  const referenceFlow = (profile.expected.bloodFlow.low + profile.expected.bloodFlow.high) / 2
  const referenceDeltaP = (profile.expected.deltaP.low + profile.expected.deltaP.high) / 2

  const flowShift = direction(circuit.bloodFlow - referenceFlow, 0.05)
  // A direction is an interpretation, so it needs a value the model stands behind. Comparing the
  // stopped circuit's intercept against the reference would print "about the same" underneath a
  // tile that already reads `--`.
  const deltaPReadout = circuit.readouts.deltaP
  const deltaPShift =
    deltaPReadout.displayed === null
      ? null
      : direction(deltaPReadout.displayed - referenceDeltaP, 2)

  if (scope?.foundationBlock)
    return (
      <div className={styles.panel} data-teaching-panel="pump-and-pressure-zones">
        {state.supportMode === 'va' ? <VaConfigurationLabel /> : null}
        <FoundationTeachingBlock id="pump-setting" title="Review speed and loading">
          <section className={styles.section} aria-labelledby="setting-flow-heading">
            <h3 id="setting-flow-heading" className={styles.heading}>
              Setting and resulting flow
            </h3>
            <div className="mt-3 grid gap-3">
              <p data-selected-setting>
                <strong>Pump speed · setting:</strong> {device.rpmSetpoint} rpm
              </p>
              <p data-resulting-flow>
                <strong>Circuit blood flow · measured result:</strong>{' '}
                {circuit.bloodFlow.toFixed(2)} L/min
              </p>
            </div>
            <p className="mt-3 text-sm leading-6">
              A centrifugal pump moves the blood reaching its inlet against downstream resistance.
              The same pump speed can produce different flows when drainage or return-side
              resistance changes.
            </p>
            <p className="mt-2 text-sm leading-6">
              This circuit is settled, with drainage to spare.
            </p>
          </section>
        </FoundationTeachingBlock>
        <FoundationTeachingBlock id="pump-speed" title="Review the speed comparison">
          <section className={styles.section} aria-labelledby="speed-comparison-heading">
            <h3 id="speed-comparison-heading" className={styles.heading}>
              The speed comparison
            </h3>
            {/*
              Three short paragraphs where there were four and a separate task. A tester
              (2026-10-13) found this step "way too much text" and the next one, which printed the
              same table again with two lines on how to read it, "the same as the previous task".
              The reading guidance is folded in here and that task is gone.

              S3-2 (ECMO-FELLOW-02) is kept: the suction change here is about one mmHg, the honest
              size of it on this circuit, said plainly rather than enlarged.
            */}
            <p className="mt-3 text-sm leading-6">
              With loading unchanged and blood available at the inlet, more speed gives more flow.
              Drawing that extra blood takes more suction, so pVen becomes a little more negative (a
              Change of −1 means more negative).
            </p>
            <p className="mt-2 text-sm leading-6" data-small-change-note>
              The change is small here, about one mmHg for three hundred more rpm, because this
              circuit has drainage to spare. Drainage runs short when less blood reaches the
              drainage cannula than the pump is asking for: hypovolemia or bleeding, a cannula that
              is malpositioned, too small or sucked against the vessel wall, a kinked or clotted
              drainage limb, or raised intrathoracic or intra-abdominal pressure such as tamponade
              or tension pneumothorax. Then the same speed increase pulls pVen far more negative for
              little extra flow, and the answer is to find and treat the cause, not to add speed.
            </p>
            <p className="mt-2 text-sm leading-6">
              After the pump, pInt and pArt rise with the extra flow, and so does Δp: it depends on
              flow through the oxygenator, so a rise after a speed change is not, by itself, new
              membrane resistance.
            </p>
          </section>
        </FoundationTeachingBlock>
        <FoundationTeachingBlock id="pump-result" title="Review how to read the result">
          <section className={styles.section} aria-labelledby="pump-result-heading">
            <h3 id="pump-result-heading" className={styles.heading}>
              Read the saved comparison
            </h3>
            <p className="mt-3 text-sm leading-6">
              Compare flow and pVen in the retained table below, then read the pressures after the
              pump. A negative Change for pVen means that drainage pressure became more negative.
            </p>
            <p className="mt-2 text-sm leading-6">
              Δp also depends on flow through the oxygenator. A change in Δp after changing speed is
              not, by itself, evidence of new membrane resistance.
            </p>
          </section>
        </FoundationTeachingBlock>
        <FoundationTeachingBlock id="pump-load" title="Review the loading comparison">
          <section className={styles.section} aria-labelledby="load-comparison-heading">
            <h3 id="load-comparison-heading" className={styles.heading}>
              The loading comparison
            </h3>
            <p className="mt-3 text-sm leading-6">
              The existing return-resistance preview uses the same pump speed as the reference. Read
              the resulting flow and both post-pump pressures before interpreting the gradient.
            </p>
            <p className="mt-2 text-sm leading-6">
              The preview changes the downstream loading condition. It does not model its cause or a
              developing obstruction. No speed increase is used to overcome the resistance.
            </p>
          </section>
        </FoundationTeachingBlock>
        {/*
          Reference material for the two tasks it is about (the settled reference and the loading
          comparison), rather than a disclosure under every task of the section. The pArt line that
          stood above it is said by the comparison table and the circuit panel already.
        */}
        {/*
          Reference material for the loading task only, said to be optional, and only the part that
          task is about. On the first task it held a second walk card and a device-specification
          card under the pressure-pattern table, and a tester (2026-10-14) opened it and asked
          whether she was supposed to read all of it.
        */}
        {scope.foundationBlock === 'pump-load' ? (
          <details className={styles.section} data-pressure-patterns>
            <summary className="cursor-pointer font-semibold">
              Optional: the four pressure patterns
            </summary>
            <EcmoLocalizationCard mode="scaffold-table" supportMode={state.supportMode} />
          </details>
        ) : null}
      </div>
    )

  return (
    <div className={styles.panel} data-teaching-panel="pump-and-pressure-zones">
      <EcmoCircuitWalk {...navigation} state={state} />

      <section className={styles.section} aria-labelledby="pump-heading">
        <h3 id="pump-heading" className={styles.heading}>
          Setting, result, and the zones that report them
        </h3>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border p-3" data-selected-setting>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Selected setting
            </p>
            <p className="text-2xl font-semibold">{device.rpmSetpoint} rpm</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Chosen by the operator. It does not by itself determine the flow.
            </p>
          </div>
          <div className="rounded-xl border p-3" data-resulting-flow>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Resulting flow</p>
            <p className="text-2xl font-semibold">{circuit.bloodFlow.toFixed(2)} L/min</p>
            {/*
              Explicit separators. A bare space between an expression and the text after it is
              dropped by the JSX transform here, which is why this line read "lower thanthis
              circuit's reference state" on screen while looking correct in the source.
            */}
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {comparisonPhrase[flowShift]} <span>this circuit&rsquo;s reference state</span>
              {flowShift === 'flat' ? '' : ` (${referenceFlow.toFixed(2)} L/min)`}.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4" data-pressure-zones>
          <ChannelValue label="pVen" readout={circuit.readouts.pVen} unit="mmHg" />
          <ChannelValue label="pInt" readout={circuit.readouts.pInt} unit="mmHg" />
          <ChannelValue label="pArt" readout={circuit.readouts.pArt} unit="mmHg" />
          <ChannelValue label="Δp" readout={circuit.readouts.deltaP} unit="mmHg" />
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {deltaPShift === null
            ? `The gradient is not being reported, so it cannot be compared with this circuit’s reference state. ${deltaPReadout.reason}`
            : `The gradient is ${comparisonPhrase[deltaPShift]} this circuit’s reference state.`}{' '}
          Read the four together: one zone moving alone means something different from two moving
          together.
        </p>

        <TextEquivalent>
          The pump is set to {device.rpmSetpoint} rpm and the circuit is returning{' '}
          {circuit.bloodFlow.toFixed(2)} L/min, {comparisonPhrase[flowShift]}{' '}
          <span>this circuit&rsquo;s reference flow of {referenceFlow.toFixed(2)} L/min.</span>{' '}
          {deltaPShift === null
            ? `The gradient across the membrane is not available, ${deltaPReadout.reason}`
            : `The gradient across the membrane is ${comparisonPhrase[deltaPShift]} its reference value of ${referenceDeltaP.toFixed(0)} mmHg.`}{' '}
          Speed is a setting; flow is the result of that speed under the loading the circuit
          currently has.
        </TextEquivalent>

        <EcmoCircuitPressureReference />
      </section>

      <EcmoLocalizationCard mode="scaffold-table" supportMode={state.supportMode} />

      <GuidedValue
        guide={ecmoDerivedValueGuides.transmembraneDeltaP}
        value={circuit.readouts.deltaP.displayed}
        headingLevel={3}
      />
    </div>
  )
}
