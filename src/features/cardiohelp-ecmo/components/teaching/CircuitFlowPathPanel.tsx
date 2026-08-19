'use client'

import { ecmoDerivedValueGuides } from '../../content/ecmoValueGuides'
import type { EcmoSimulationState } from '../../engine/types'
import { EcmoCircuitWalk } from './EcmoCircuitWalk'
import { ChannelValue, GuidedValue, ModelBoundary, TextEquivalent, styles } from './shared'
import { useEcmoCircuitWalkNavigation, type EcmoWalkPanelProps } from './useEcmoCircuitWalk'

/**
 * Every console signal placed where it physically sits, one place at a time.
 *
 * This lesson's `recognize` phase has always told the learner to "step through the circuit segments
 * in order". Nothing stepped: the panel printed all six at once and the learner scrolled a list.
 * The list is now the walk, which is the same six places from the same registry, reached one at a
 * time with the map marking where they are standing — so the instruction describes what is on the
 * screen, the way R2 made the `act`-phase instruction describe the map it had just built.
 *
 * What stays below the walk is what belongs to the section rather than to a place on it: the gas
 * path, which is a second path rather than a stop; the four pressure channels as a set, because
 * reading them together is the skill; and the registered value guides.
 */

export function CircuitFlowPathPanel({
  state,
  walk,
}: {
  readonly state: EcmoSimulationState
  readonly walk?: EcmoWalkPanelProps
}) {
  const { circuit, gas } = state
  const navigation = useEcmoCircuitWalkNavigation('circuit-flow-path', walk)

  return (
    <div className={styles.panel} data-teaching-panel="circuit-flow-path">
      <EcmoCircuitWalk {...navigation} state={state} />

      <section className={styles.section} aria-labelledby="path-heading">
        <h3 id="path-heading" className={styles.heading}>
          The paths this circuit runs, and the channels that describe them
        </h3>

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
            <strong>pArt is not the patient&rsquo;s arterial blood pressure</strong>: it is a
            pressure measurement in the post-oxygenator, return-side circuit tubing, and the
            patient&rsquo;s blood pressure comes from the independent monitor. In VV ECMO the return
            cannula enters the venous circulation even though the returned blood is oxygenated.
            Circuit blood flow is different in kind: the quantity is general ECMO vocabulary, and
            what belongs to this device is where the sensor sits, what the console displays, and
            when the value is available. This simulation asserts no expected value for any of them —
            your unit will have local reference values. Ask for them.
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
