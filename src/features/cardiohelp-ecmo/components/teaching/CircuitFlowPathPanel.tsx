'use client'

import { useState } from 'react'
import {
  ecmoGasPathSegments,
  ecmoSensorSite,
  resolveEcmoModeText,
} from '../../content/circuitSegments'
import { ecmoDerivedValueGuides } from '../../content/ecmoValueGuides'
import type { EcmoSimulationState } from '../../engine/types'
import { EcmoCircuitWalk } from './EcmoCircuitWalk'
import {
  ChannelValue,
  CircuitPressureIdentity,
  FoundationTeachingBlock,
  GuidedValue,
  ModelBoundary,
  TextEquivalent,
  VaConfigurationLabel,
  styles,
} from './shared'
import { useEcmoCircuitWalkNavigation, type EcmoWalkPanelProps } from './useEcmoCircuitWalk'

export const FOUNDATION_PRESSURE_SITES = ['pVen', 'pInt', 'pArt', 'deltaP'] as const
export type FoundationPressureSite = (typeof FOUNDATION_PRESSURE_SITES)[number]

export function CircuitFlowPathPanel({
  state,
  walk,
  pressureSite,
  onPressureSiteChange,
}: {
  readonly state: EcmoSimulationState
  readonly walk?: EcmoWalkPanelProps
  readonly pressureSite?: FoundationPressureSite
  readonly onPressureSiteChange?: (site: FoundationPressureSite) => void
}) {
  const navigation = useEcmoCircuitWalkNavigation('circuit-flow-path', walk)
  const [localSite, setLocalSite] = useState<FoundationPressureSite>('pVen')
  const selected = pressureSite ?? localSite
  const site = ecmoSensorSite(selected)
  const { circuit, gas } = state
  return (
    <div className={styles.panel} data-teaching-panel="circuit-flow-path">
      {state.supportMode === 'va' ? <VaConfigurationLabel /> : null}
      <FoundationTeachingBlock id="blood-path" title="Review the blood path">
        <EcmoCircuitWalk {...navigation} pastPrediction state={state} />
        <p className="text-sm leading-6">
          {state.supportMode === 'vv'
            ? 'In VV ECMO, oxygenated return blood enters the venous circulation. The native heart still pumps blood through the lungs and onward to the tissues.'
            : 'This peripheral femoral VA circuit returns oxygenated blood into the arterial circulation, in parallel with native cardiac output.'}
        </p>
      </FoundationTeachingBlock>
      <FoundationTeachingBlock id="gas-path" title="Review the gas path">
        <section className={styles.section} aria-labelledby="gas-path-heading" data-gas-path>
          <h3 id="gas-path-heading" className={styles.heading}>
            Sweep-gas path
          </h3>
          <p className="mt-3 text-sm leading-6">
            Gas supply → external gas controls → gas side of the membrane lung → exhaust. The map
            draws this separate path with dashed lines.
          </p>
          {ecmoGasPathSegments().map((segment) => (
            <p key={segment.id} className="mt-2 text-sm leading-6">
              {resolveEcmoModeText(segment.detail, state.supportMode)}
            </p>
          ))}
          <TextEquivalent>
            Sweep is {gas.sweepLpm.toFixed(1)} L/min and sweep-gas oxygen fraction is{' '}
            {gas.fio2.toFixed(2)}. Blood and gas remain on opposite sides of the membrane.
          </TextEquivalent>
        </section>
      </FoundationTeachingBlock>
      <FoundationTeachingBlock id="pressure-sites" title="Review pressure locations">
        <section className={styles.section} aria-labelledby="pressure-sites-heading">
          <h3 id="pressure-sites-heading" className={styles.heading}>
            Pressure measurements
          </h3>
          <p className="mt-2 text-sm leading-6">
            Three pressures are measured at three blood-path locations. Select one to read its
            location; ΔP is calculated from two of them.
          </p>
          <div className="my-3 flex flex-wrap gap-2" role="group" aria-label="Pressure locations">
            {FOUNDATION_PRESSURE_SITES.map((id) => (
              <button
                type="button"
                key={id}
                className="min-h-11 rounded-xl border px-3 font-semibold"
                aria-pressed={selected === id}
                onClick={() => {
                  setLocalSite(id)
                  onPressureSiteChange?.(id)
                }}
              >
                {ecmoSensorSite(id).deviceLabel}
              </button>
            ))}
          </div>
          <div data-pressure-location={selected}>
            <h4 className="font-semibold">
              {site.deviceLabel} · {site.plainName}
            </h4>
            <p className="mt-2 text-sm leading-6" data-pressure-location-text>
              {site.measuredAt}.
            </p>
            <ChannelValue
              label={site.deviceLabel}
              readout={circuit.readouts[selected]}
              unit="mmHg"
            />
            {selected === 'deltaP' ? (
              <p className="mt-2 text-sm leading-6">
                ΔP ={' '}
                {site.derivedFromSiteIds.map((id) => ecmoSensorSite(id).deviceLabel).join(' − ')}.
                It is the pressure difference across the oxygenator, not a fourth physical sampling
                site. If either input is unavailable, the difference is unavailable too.
              </p>
            ) : null}
            {site.caution ? <p className="mt-2 text-sm leading-6">{site.caution}</p> : null}
          </div>
          <CircuitPressureIdentity />
          <details className="mt-3">
            <summary className="cursor-pointer font-semibold">All locations in words</summary>
            <TextEquivalent>
              {FOUNDATION_PRESSURE_SITES.map(
                (id) => `${ecmoSensorSite(id).deviceLabel}: ${ecmoSensorSite(id).measuredAt}.`,
              ).join(' ')}{' '}
              ΔP is derived across the oxygenator; it is not a fourth sampling site.
            </TextEquivalent>
          </details>
        </section>
      </FoundationTeachingBlock>
      <FoundationTeachingBlock id="circuit-patient" title="Review circuit and patient pressure">
        <section className={styles.section} aria-labelledby="circuit-patient-heading">
          <h3 id="circuit-patient-heading" className={styles.heading}>
            Circuit pressure and patient pressure
          </h3>
          <div className="mt-3">
            <ChannelValue label="pArt" readout={circuit.readouts.pArt} unit="mmHg" />
          </div>
          <CircuitPressureIdentity />
          <p className="mt-3 text-sm leading-6">
            Read the patient&apos;s arterial pressure on the separate bedside monitor. A change in
            circuit pArt does not establish the patient&apos;s arterial pressure or tissue
            perfusion.
          </p>
          {state.supportMode === 'vv' ? (
            <p className="mt-2 text-sm leading-6">
              The word “arterial” in this device label does not change VV anatomy: return blood
              still goes into a vein.
            </p>
          ) : null}
        </section>
      </FoundationTeachingBlock>
      <details className={styles.section}>
        <summary className="cursor-pointer font-semibold">
          More about flow and saturation measurements
        </summary>
        <GuidedValue
          guide={ecmoDerivedValueGuides.circuitBloodFlow}
          value={circuit.bloodFlow}
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
      </details>
      <p className="text-sm leading-6" data-channel-vocabulary>
        pVen, pInt and pArt are CARDIOHELP/Getinge channel labels rather than standard ECMO
        vocabulary. Other consoles may label or provide these measurements differently. Circuit
        blood flow is a general ECMO quantity.
      </p>
      <ModelBoundary>
        The schematic teaches order and location. It is not a scale drawing of tubing, cannulae, or
        component geometry. These channel names belong to this CARDIOHELP configuration.
      </ModelBoundary>
    </div>
  )
}
