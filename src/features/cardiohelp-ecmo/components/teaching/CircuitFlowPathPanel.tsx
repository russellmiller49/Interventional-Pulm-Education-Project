import { ecmoDerivedValueGuides } from '../../content/ecmoValueGuides'
import type { EcmoSimulationState } from '../../engine/types'
import { ChannelValue, GuidedValue, ModelBoundary, TextEquivalent, styles } from './shared'

/**
 * Every console signal placed where it physically sits, before any value is interpreted.
 *
 * The blood path and the gas path are drawn as separate rows with different stroke patterns as
 * well as different labels, because a learner who cannot distinguish them by colour still has to
 * be able to tell sweep gas from blood.
 */

interface Segment {
  readonly id: string
  readonly label: string
  readonly detail: string
  readonly sensors: readonly string[]
}

function bloodPath(state: EcmoSimulationState): readonly Segment[] {
  const returnTarget =
    state.supportMode === 'va' ? 'Arterial return to the patient' : 'Venous return to the patient'
  const returnDetail =
    state.supportMode === 'va'
      ? 'Returned to the arterial side, so circuit flow runs in parallel with the native heart and competes with it.'
      : 'Returned to the venous side, so circuit blood is in series with the native lung and some of it can be drained straight back.'
  return [
    {
      id: 'drainage',
      label: 'Patient venous drainage',
      detail: 'Blood is pulled from the venous circulation into the drainage limb.',
      sensors: ['pVen'],
    },
    {
      id: 'pump',
      label: 'Centrifugal pump',
      detail: 'Generates the flow by pulling on drainage and pushing into the membrane.',
      sensors: [],
    },
    {
      id: 'pre-membrane',
      label: 'Pre-oxygenator location',
      detail: 'After the pump, before the membrane lung. This is where pInt is reported.',
      sensors: ['pInt', 'SvO₂ (venous measuring cell)'],
    },
    {
      id: 'membrane',
      label: 'Membrane lung',
      detail:
        'Gas exchange happens here, across a membrane the sweep gas passes on the other side of.',
      sensors: ['ΔP spans this'],
    },
    {
      id: 'post-membrane',
      label: 'Post-oxygenator / return location',
      detail: 'After the membrane, on the return limb. This is where pArt is reported.',
      sensors: ['pArt', 'Post-oxygenator saturation'],
    },
    { id: 'return', label: returnTarget, detail: returnDetail, sensors: [] },
  ]
}

export function CircuitFlowPathPanel({ state }: { readonly state: EcmoSimulationState }) {
  const { circuit, gas } = state
  const segments = bloodPath(state)

  return (
    <div className={styles.panel} data-teaching-panel="circuit-flow-path">
      <section className={styles.section} aria-labelledby="path-heading">
        <h3 id="path-heading" className={styles.heading}>
          The blood path, in order
        </h3>

        <ol className="mt-3 grid gap-2" data-blood-path>
          {segments.map((segment, index) => (
            <li
              key={segment.id}
              className="rounded-xl border-l-4 border-solid bg-muted/30 p-3"
              data-circuit-segment={segment.id}
            >
              <p className="text-sm font-semibold">
                {index + 1}. {segment.label}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{segment.detail}</p>
              {segment.sensors.length > 0 ? (
                <p className="mt-1 text-xs font-medium">
                  Reported here: {segment.sensors.join(' · ')}
                </p>
              ) : null}
            </li>
          ))}
        </ol>

        <div className="mt-4 rounded-xl border border-dashed p-3" data-gas-path>
          <p className="text-sm font-semibold">Sweep-gas path — a separate path, drawn dashed</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Gas source → sweep control ({gas.sweepLpm.toFixed(1)} L/min, oxygen fraction{' '}
            {gas.fio2.toFixed(2)}) → the gas side of the membrane → exhaust. It never joins the
            blood path, and no pressure channel above sits in it.
            {gas.sourceConnected ? '' : ' The gas source is currently interrupted.'}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-4" data-live-pressures>
          <ChannelValue label="pVen" readout={circuit.readouts.pVen} unit="mmHg" />
          <ChannelValue label="pInt" readout={circuit.readouts.pInt} unit="mmHg" />
          <ChannelValue label="pArt" readout={circuit.readouts.pArt} unit="mmHg" />
          <ChannelValue label="ΔP" readout={circuit.readouts.deltaP} unit="mmHg" />
        </div>

        <TextEquivalent>
          The blood path runs drainage → pump → pre-oxygenator → membrane lung → post-oxygenator →{' '}
          {state.supportMode === 'va' ? 'arterial' : 'venous'} return. pVen is reported on the
          drainage limb, pInt between pump and membrane, pArt after the membrane on the return limb,
          and ΔP is the difference between pInt and pArt across the membrane. The venous measuring
          cell that produces the displayed SvO₂ sits on the venous inlet of the oxygenator pump
          unit. The sweep gas runs on the other side of the membrane and is not part of the blood
          path.
        </TextEquivalent>

        <ModelBoundary>
          The schematic is a teaching diagram of order and location, not a scale drawing of tubing
          lengths, cannula sizes, or component geometry.
        </ModelBoundary>

        {/*
          Stated at first use, beside the channels themselves. These three names are this
          manufacturer's, and one of them reads like a patient measurement it is not.
        */}
        <ModelBoundary>
          <span data-channel-vocabulary>
            pVen, pInt and pArt are CARDIOHELP/Getinge channel labels rather than standard ECMO
            vocabulary — another console may name the same measurements differently, or not report
            them at all. All three are pressures inside the circuit. In particular{' '}
            <strong>pArt is not the patient&rsquo;s arterial pressure</strong>: it is the pressure
            on the return limb, and in VV support that limb is venous. The patient&rsquo;s blood
            pressure comes from the independent monitor, never from this console. This simulation
            asserts no expected value for any of them — your unit will have local reference values.
            Ask for them.
          </span>
        </ModelBoundary>
      </section>

      <GuidedValue
        guide={ecmoDerivedValueGuides.circuitBloodFlow}
        value={circuit.bloodFlow}
        headingLevel={3}
      />
      <GuidedValue
        guide={ecmoDerivedValueGuides.pVen}
        value={circuit.readouts.pVen.displayed}
        headingLevel={3}
      />
      <GuidedValue
        guide={ecmoDerivedValueGuides.pInt}
        value={circuit.readouts.pInt.displayed}
        headingLevel={3}
      />
      <GuidedValue
        guide={ecmoDerivedValueGuides.pArt}
        value={circuit.readouts.pArt.displayed}
        headingLevel={3}
      />
      <GuidedValue
        guide={ecmoDerivedValueGuides.venousLineSaturation}
        value={circuit.readouts.venousLineSaturation.displayed}
        headingLevel={3}
      />
      <GuidedValue
        guide={ecmoDerivedValueGuides.systemicVenousSaturationEstimate}
        value={state.patient.systemicVenousSaturationEstimate}
        headingLevel={3}
      />
    </div>
  )
}
