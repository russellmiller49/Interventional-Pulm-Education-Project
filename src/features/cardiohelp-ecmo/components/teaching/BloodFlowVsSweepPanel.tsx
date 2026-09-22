import { useStageTeachingScope } from '../stage/StageTeachingScope'
import { ECMO_CONTROL_PANEL, ecmoControlKnob } from '../../content/controlPanel'
import { ecmoDerivedValueGuides } from '../../content/ecmoValueGuides'
import { EcmoSourceList } from '../evidence/EcmoSourceList'
import type { EcmoSimulationState } from '../../engine/types'
import {
  FoundationTeachingBlock,
  GuidedValue,
  ModelBoundary,
  TextEquivalent,
  VaConfigurationLabel,
  styles,
} from './shared'

/**
 * Two controls, two paths, two principal effects.
 *
 * The wording is deliberately "principally affects" rather than "controls independently": the two
 * are not clinically independent under all conditions, and a panel that said so would be teaching
 * something the sources do not support.
 */

function PathColumn({
  title,
  controlLabel,
  controlValue,
  steps,
  responses,
  dashed,
}: {
  readonly title: string
  readonly controlLabel: string
  readonly controlValue: string
  readonly steps: readonly string[]
  readonly responses: readonly { readonly label: string; readonly value: string }[]
  readonly dashed?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${dashed ? 'border-dashed' : 'border-solid'}`}
      data-response-path={title}
    >
      <h4 className="text-sm font-semibold">{title}</h4>
      <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{controlLabel}</p>
      <p className="text-xl font-semibold">{controlValue}</p>
      <ol className="mt-2 grid gap-1">
        {steps.map((step) => (
          <li key={step} className="text-xs leading-5 text-muted-foreground">
            → {step}
          </li>
        ))}
      </ol>
      <dl className="mt-3 grid grid-cols-2 gap-2">
        {responses.map((response) => (
          <div key={response.label}>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              {response.label}
            </dt>
            <dd className="text-sm font-semibold">{response.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function BloodFlowVsSweepPanel({ state }: { readonly state: EcmoSimulationState }) {
  const { circuit, gas, patient, device } = state
  const scope = useStageTeachingScope()

  if (scope?.foundationBlock)
    return (
      <div className={styles.panel} data-teaching-panel="blood-flow-versus-sweep">
        {state.supportMode === 'va' ? <VaConfigurationLabel /> : null}
        <FoundationTeachingBlock id="controls" title="Review the three adjustments">
          <section
            className={styles.section}
            aria-labelledby="three-adjustments-heading"
            data-control-panel
          >
            <h3 id="three-adjustments-heading" className={styles.heading}>
              Three adjustments, two control locations
            </h3>
            <ol className="mt-3 grid list-decimal gap-3 pl-5">
              {ECMO_CONTROL_PANEL.knobs.map((knob) => (
                <li key={knob.id} data-control-knob={knob.id}>
                  <strong>{knob.plainName}</strong>
                  <p>
                    {knob.id === 'pump-speed'
                      ? 'On the pump console.'
                      : 'On the external gas controls.'}{' '}
                    {knob.principallyMoves}.
                  </p>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-sm leading-6">
              Sweep-gas oxygen fraction is the oxygen concentration delivered to the membrane lung.
              It is separate from ventilator FiO₂, which describes gas delivered to the native
              lungs.
            </p>
            <p className="mt-2 text-sm leading-6">
              The following guided controls reset to the same starting circuit for every comparison.
              The changes are not cumulative.
            </p>
          </section>
        </FoundationTeachingBlock>
        <FoundationTeachingBlock id="control-pump" title="Review pump speed">
          <section className={styles.section} aria-labelledby="control-pump-heading">
            <h3 id="control-pump-heading" className={styles.heading}>
              Pump speed
            </h3>
            <p className="mt-3 text-sm leading-6">
              The console sets rotational speed. Flow is the resulting blood movement under the
              current loading conditions. Its contribution to oxygen delivery depends on hemoglobin,
              recirculation, native circulation, and patient demand.
            </p>
            <p className="mt-2 text-sm leading-6">{ecmoControlKnob('pump-speed').doesNotMove}</p>
            {/* S4-4 (ECMO-FELLOW-02): the model's PaCO₂ has no blood-flow term at all. */}
            <p className="mt-2 text-sm leading-6" data-local-model-boundary="co2-flow-independent">
              In this simulation PaCO₂ follows sweep alone, so a speed change leaves it exactly
              where it was. The bedside limit that blood flow places on CO₂ removal is real and is
              not represented here.
            </p>
            {state.supportMode === 'va' ? (
              <p className="mt-2 text-sm leading-6" data-comparison-limitation>
                The VA reference fixes regional patient saturations for this comparison. A higher
                flow here does not produce a modeled saturation increase or establish better tissue
                perfusion.
              </p>
            ) : (
              <p className="mt-2 text-sm leading-6" data-local-model-boundary="saturation-ceiling">
                In this model patient saturation rises with the flow left after re-drainage only
                until it stops at 100, which the reference circuit reaches at about 4000 rpm. Above
                that, more speed still raises flow and pulls harder on the drainage limb, with no
                further modeled saturation change.
              </p>
            )}
          </section>
        </FoundationTeachingBlock>
        <FoundationTeachingBlock id="control-sweep" title="Review sweep-gas flow">
          <section className={styles.section} aria-labelledby="control-sweep-heading">
            <h3 id="control-sweep-heading" className={styles.heading}>
              Sweep-gas flow
            </h3>
            <p className="mt-3 text-sm leading-6">
              Sweep is gas flow past the membrane, adjusted at the external gas controls. It
              principally changes CO₂ removal. Read PaCO₂ and pH after the comparison.
            </p>
            <p className="mt-2 text-sm leading-6">{ecmoControlKnob('sweep').doesNotMove}</p>
            <p className="mt-2 text-sm leading-6" data-local-model-boundary="sweep-linearity">
              The model uses a straight-line sweep response down to a fixed lower bound: PaCO₂ stops
              at 20 mmHg, which the reference circuit reaches at about 7.5 L/min, and more sweep
              changes nothing past that. Real clearance also depends on blood flow, membrane
              function, and gas delivery. Read the direction, not the slope.
            </p>
            <p className="mt-2 text-sm font-semibold leading-6">
              Rapid CO₂ correction can cause harm. The comparison demonstrates a relationship, not a
              titration rate or treatment instruction.
            </p>
            {/* S4-3 (ECMO-FELLOW-02): the model's seconds are its own steps, not a bedside rate. */}
            <p className="mt-2 text-sm leading-6" data-local-model-boundary="compressed-time">
              The model settles a sweep change within seconds. Those are compressed modeled seconds,
              not a bedside time course, and a reading taken at the end of a comparison can still be
              moving.
            </p>
          </section>
        </FoundationTeachingBlock>
        <FoundationTeachingBlock id="control-oxygen" title="Review sweep-gas oxygen fraction">
          <section className={styles.section} aria-labelledby="control-oxygen-heading">
            <h3 id="control-oxygen-heading" className={styles.heading}>
              Sweep-gas oxygen fraction
            </h3>
            <p className="mt-3 text-sm leading-6">
              This external gas setting changes the oxygen concentration offered to the membrane. It
              does not change the sweep flow or ventilator FiO₂.
            </p>
            <p className="mt-2 text-sm leading-6">
              The comparison lowers the fraction with blood flow and sweep unchanged. Read the
              simulated post-oxygenator sample and the patient&apos;s saturation separately; the
              sample is not a measured CARDIOHELP console channel.
            </p>
            {/*
             * S4-2 (ECMO-FELLOW-02): the two saturations come from two separate bounded formulas and
             * there is no dissolved-oxygen or PO₂ term anywhere in this model. The gap between them
             * is therefore not a physiological explanation, and ECMO-OWNER-04 holds the physiology.
             */}
            {state.supportMode === 'vv' ? (
              <p
                className="mt-2 text-sm leading-6"
                data-local-model-boundary="separate-saturations"
              >
                In this simulation the two are computed separately: the post-oxygenator sample moves
                on a short scale near full saturation, while the patient&apos;s saturation scales
                with the flow reaching the patient times the oxygen fraction. This model has no
                dissolved-oxygen or post-oxygenator PO₂ term, so the difference in how far they move
                is not an explanation of physiology.
              </p>
            ) : null}
            <p className="mt-2 text-sm leading-6" data-comparison-limitation>
              {state.supportMode === 'va'
                ? 'This model changes post-oxygenator saturation but holds VA regional patient saturations fixed in this preview. Their unchanged values do not show that gas oxygen fraction is clinically unimportant.'
                : 'The VV model also changes patient saturation. Its response size is an authored teaching curve, not a prediction for a patient.'}
            </p>
          </section>
        </FoundationTeachingBlock>
        <ModelBoundary>
          <span data-local-model-boundary="demand-and-native-lung-fixed">
            Oxygen consumption and native lung contribution remain fixed in these comparisons. Each
            result is retained at its stated modeled time; neither tissue adequacy nor clinical
            competence is established.
          </span>
        </ModelBoundary>
      </div>
    )

  return (
    <div className={styles.panel} data-teaching-panel="blood-flow-versus-sweep">
      {/*
        The small control panel (skill principle 4), stated once before any troubleshooting: the
        three things a learner can change, the one thing that is for emergencies, and the fact that
        everything else on the console is monitoring. Reused as a knob strip in every drill's
        Explain step, so the wording here is the registry's, not this panel's.
      */}
      <section
        className={styles.section}
        aria-labelledby="control-panel-heading"
        data-control-panel
      >
        <h3 id="control-panel-heading" className={styles.heading}>
          The control panel: three things you can change
        </h3>
        <p className="mt-2 text-sm leading-6">{ECMO_CONTROL_PANEL.sentence}</p>
        <ol className="mt-3 grid gap-2 ">
          {ECMO_CONTROL_PANEL.knobs.map((knob) => (
            <li key={knob.id} className="rounded-xl border p-3" data-control-knob={knob.id}>
              <p className="text-sm font-semibold">{knob.plainName}</p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {knob.consoleLabel} · {knob.axis}
              </p>
              <p className="mt-2 text-sm leading-5">
                <span className="font-semibold">Moves:</span> {knob.principallyMoves}
              </p>
              <p className="text-sm leading-5 text-muted-foreground">
                <span className="font-semibold">Limits:</span> {knob.doesNotMove}
              </p>
            </li>
          ))}
        </ol>
        {ECMO_CONTROL_PANEL.emergencyOnly.map((control) => (
          <p
            key={control.id}
            className="mt-3 text-sm leading-6 text-muted-foreground"
            data-control-emergency={control.id}
          >
            <span className="font-semibold">{control.plainName}.</span> {control.sentence}{' '}
            Everything else on the console is monitoring.
          </p>
        ))}
        <EcmoSourceList
          compact
          evidenceIds={ECMO_CONTROL_PANEL.sourceIds}
          title="Sources"
          headingLevel={4}
        />
      </section>

      <section className={styles.section} aria-labelledby="paths-heading">
        <h3 id="paths-heading" className={styles.heading}>
          The blood path and the gas path
        </h3>

        <div className="mt-3 grid gap-3 ">
          <PathColumn
            title="Blood path"
            controlLabel="Pump speed"
            controlValue={`${device.rpmSetpoint} rpm`}
            steps={[
              `circuit blood flow ${circuit.bloodFlow.toFixed(2)} L/min`,
              'blood exposure to the membrane',
              'oxygen transfer and the support the patient receives',
            ]}
            responses={[
              { label: 'Circuit flow', value: `${circuit.bloodFlow.toFixed(2)} L/min` },
              { label: 'Patient SpO₂', value: patient.spo2.toFixed(1) },
            ]}
          />
          <PathColumn
            title="Gas path"
            controlLabel="Sweep gas"
            controlValue={`${gas.sweepLpm.toFixed(1)} L/min`}
            dashed
            steps={[
              `oxygen fraction ${gas.fio2.toFixed(2)}`,
              gas.sourceConnected
                ? 'gradient maintained on the gas side of the membrane'
                : 'gas source interrupted — no gradient is being maintained',
              'carbon dioxide clearance',
            ]}
            responses={[
              { label: 'PaCO₂', value: `${patient.paCO2.toFixed(1)} mmHg` },
              { label: 'pH', value: patient.pH.toFixed(2) },
            ]}
          />
        </div>

        <p className="mt-3 text-sm leading-6">
          In this model blood flow principally affects oxygen transfer and the support delivered,
          subject to drainage, recirculation, native circulation, hemoglobin, and patient demand.
          Sweep principally affects carbon dioxide clearance. They are not fully independent of one
          another, but they are not interchangeable either.
        </p>

        <TextEquivalent>
          The pump is at {device.rpmSetpoint} rpm producing {circuit.bloodFlow.toFixed(2)} L/min of
          circuit flow, with the patient saturation at {patient.spo2.toFixed(1)}. The sweep gas is
          at {gas.sweepLpm.toFixed(1)} L/min with an oxygen fraction of {gas.fio2.toFixed(2)}, with
          the arterial carbon dioxide value at {patient.paCO2.toFixed(1)} mmHg and pH{' '}
          {patient.pH.toFixed(2)}.{' '}
          {gas.sourceConnected
            ? 'The gas source is connected.'
            : 'The gas source is interrupted, so no gradient is being maintained across the membrane.'}{' '}
          Carbon dioxide is far more diffusible than oxygen, which is why its removal is governed
          mostly by the gas side rather than by how much blood is passing the membrane.
        </TextEquivalent>

        <ModelBoundary>
          The magnitude of any change you produce here is this simulation&rsquo;s, not a bedside
          dose-response. Each comparison restores the reference circuit first, so the second result
          is never the sum of two changes.
        </ModelBoundary>

        <ModelBoundary>
          <span data-local-model-boundary="sweep-linearity">
            PaCO₂ responds to sweep as a straight line in this simulation, by construction, until it
            stops at a fixed lower bound of 20 mmHg — about 7.5 L/min of sweep on the reference
            circuit. Past that bound more sweep changes nothing here; before it there is no
            diminishing return, because none is modeled. The bound is a limit of this simulation,
            not a physiological plateau. Real CO₂ removal shows diminishing returns and becomes
            limited by blood flow through the membrane, membrane performance, and the remaining
            gas-side gradient — so read the direction here, not the slope.
          </span>
        </ModelBoundary>

        <ModelBoundary>
          <span data-local-model-boundary="demand-and-native-lung-fixed">
            Two of the factors in that sentence never move in this simulation. The patient&rsquo;s
            oxygen consumption is an authored constant, and the native lung&rsquo;s contribution is
            fixed, so nothing here can show you a patient whose demand rose or whose own lungs
            recovered. Both are among the commonest reasons a real ECMO patient&rsquo;s numbers
            change without anyone touching the circuit.
          </span>
        </ModelBoundary>
      </section>

      <GuidedValue
        guide={ecmoDerivedValueGuides.recirculationAdjustedCircuitFlow}
        value={circuit.recirculationAdjustedCircuitFlowLpm}
        headingLevel={3}
      />
    </div>
  )
}
