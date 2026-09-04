import { ECMO_CONTROL_PANEL } from '../../content/controlPanel'
import { ecmoDerivedValueGuides } from '../../content/ecmoValueGuides'
import { EcmoSourceList } from '../evidence/EcmoSourceList'
import type { EcmoSimulationState } from '../../engine/types'
import { GuidedValue, ModelBoundary, TextEquivalent, styles } from './shared'

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
        <ol className="mt-3 grid gap-2 lg:grid-cols-3">
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
                <span className="font-semibold">Does not move:</span> {knob.doesNotMove}
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

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
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
            PaCO₂ responds to sweep as a straight line in this simulation, by construction. There is
            no plateau and no diminishing return, because none is modeled. Real CO₂ removal shows
            diminishing returns and becomes limited by blood flow through the membrane, membrane
            performance, and the remaining gas-side gradient — so read the direction here, not the
            slope.
          </span>
        </ModelBoundary>

        <ModelBoundary>
          <span data-local-model-boundary="demand-and-native-lung-fixed">
            Two of the terms in that sentence never move in this simulation. The patient&rsquo;s
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
