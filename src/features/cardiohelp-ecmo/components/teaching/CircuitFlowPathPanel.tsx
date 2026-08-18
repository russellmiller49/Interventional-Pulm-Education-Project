import { deriveEcmoCircuitPresentation } from '../../content/circuitPresentation'
import {
  ecmoBloodPathSegments,
  ecmoSensorSitesForSegment,
  resolveEcmoModeText,
} from '../../content/circuitSegments'
import { ecmoDerivedValueGuides } from '../../content/ecmoValueGuides'
import type { EcmoSimulationState } from '../../engine/types'
import { EcmoCircuitMinimap } from './EcmoCircuitMinimap'
import { ChannelValue, GuidedValue, ModelBoundary, TextEquivalent, styles } from './shared'

/**
 * Every console signal placed where it physically sits, before any value is interpreted.
 *
 * The blood path and the gas path are drawn as separate rows with different stroke patterns as
 * well as different labels, because a learner who cannot distinguish them by colour still has to
 * be able to tell sweep gas from blood.
 *
 * The stops and the sensors at them now come from the shared circuit registry rather than from a
 * list kept here. This lesson was where that vocabulary was first written down, and three other
 * surfaces had since paraphrased it; naming the places once means the map above this list, the
 * localization rows in the drills, and this stop list cannot disagree about where anything is.
 * Completing the registry also finished this list: the flow probe on the return limb had always
 * been missing from it, which is a strange omission in a lesson whose subject is every signal at
 * its own location.
 */

export function CircuitFlowPathPanel({ state }: { readonly state: EcmoSimulationState }) {
  const { circuit, gas } = state
  const segments = ecmoBloodPathSegments()

  return (
    <div className={styles.panel} data-teaching-panel="circuit-flow-path">
      <EcmoCircuitMinimap
        supportMode={state.supportMode}
        presentation={deriveEcmoCircuitPresentation(state, {
          kind: 'foundation-scaffold',
          emphasis: 'path-order',
        })}
      />

      <section className={styles.section} aria-labelledby="path-heading">
        <h3 id="path-heading" className={styles.heading}>
          The blood path, in order
        </h3>

        <ol className="mt-3 grid gap-2" data-blood-path>
          {segments.map((segment, index) => {
            const sensors = ecmoSensorSitesForSegment(segment.id)
            return (
              <li
                key={segment.id}
                className="rounded-xl border-l-4 border-solid bg-muted/30 p-3"
                data-circuit-segment={segment.id}
              >
                <p className="text-sm font-semibold">
                  {index + 1}. {resolveEcmoModeText(segment.label, state.supportMode)}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {resolveEcmoModeText(segment.detail, state.supportMode)}
                </p>
                {sensors.length > 0 ? (
                  <p className="mt-1 text-xs font-medium">
                    Reported here: {sensors.map((site) => site.stopLabel).join(' · ')}
                  </p>
                ) : null}
              </li>
            )
          })}
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
