'use client'

import { useState } from 'react'
import { ecmoSensorSite } from '../../content/circuitSegments'
import type { EcmoSimulationState } from '../../engine/types'
import { useStageTeachingScope } from '../stage/StageTeachingScope'
import { EcmoCircuitWalk } from './EcmoCircuitWalk'
import {
  ChannelValue,
  CircuitPressureIdentity,
  FoundationTeachingBlock,
  TextEquivalent,
  VA_MODELED_CONFIGURATION,
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
  const walking = Boolean(useStageTeachingScope()?.focusedPresentation)
  const [localSite, setLocalSite] = useState<FoundationPressureSite>('pVen')
  const selected = pressureSite ?? localSite
  const site = ecmoSensorSite(selected)
  const { circuit, gas } = state
  return (
    <div className={styles.panel} data-teaching-panel="circuit-flow-path">
      <FoundationTeachingBlock id="blood-path" title="Review the blood path">
        {/*
          The configuration, said once where the learner first meets the circuit.

          It used to be a box in the circuit panel's header on every task ("VV femoral-femoral
          configuration · Drainage: femoral vein → centrifugal pump → membrane oxygenator. Return:
          femoral vein → right atrium."), and on VA a "Modeled configuration" pill above this panel
          as well. A tester (2026-10-23) asked for the box to go and its sentence to open the module.
        */}
        {!walking || navigation.activeStopId === 'walk-drainage' ? (
          <p
            className="mb-3 text-sm leading-6"
            data-circuit-configuration={state.supportMode}
            data-va-configuration={
              state.supportMode === 'va' ? VA_MODELED_CONFIGURATION : undefined
            }
          >
            {state.supportMode === 'va'
              ? 'This circuit is peripheral femoral VA ECMO. Blood drains from a femoral vein, passes through the centrifugal pump and then the membrane oxygenator, and returns through a femoral artery, flowing retrograde up the aorta toward the heart.'
              : 'This circuit is femoral–femoral VV ECMO. Blood drains from a femoral vein, passes through the centrifugal pump and then the membrane oxygenator, and returns through a femoral vein to the right atrium.'}
          </p>
        ) : null}
        <EcmoCircuitWalk {...navigation} pastPrediction state={state} />
        {/*
          One stop on screen, and only the notes that belong to it.

          Both notes below used to follow every stop, with a disclosure and a vocabulary paragraph
          after them, so the text column ran well past the map it sits beside and the control that
          moves the walk on was two screens down. A tester (2026-10-13) asked whether anyone would
          read that far and could not find the way to the next task. Each note now arrives at the
          stop that introduces its subject. Outside a stage every note renders, as before.
        */}
        {!walking || navigation.activeStopId === 'walk-return' ? (
          <p className="mt-3 text-sm leading-6" data-walk-return-note>
            {state.supportMode === 'vv'
              ? 'In VV ECMO, oxygenated return blood enters the venous circulation. The native heart still pumps blood through the lungs and onward to the tissues.'
              : 'This peripheral femoral VA circuit returns oxygenated blood into the arterial circulation, in parallel with native cardiac output.'}
          </p>
        ) : null}
        {/*
          S2-7 (ECMO-FELLOW-04): one reading carried four names across the module — the console's
          SvO₂, and "pre-oxygenator", "venous-line" and "drainage-line" saturation in the copy — and
          nothing said they were the same number. Said once here, where the reading is first met. The
          console label is the device's own (IFU rev. 2.3: SvO₂, venous oxygen saturation, measured by
          the venous probe) and is kept.
        */}
        {!walking || navigation.activeStopId === 'walk-membrane' ? (
          <p
            className={`${styles.section} mt-3 text-sm leading-6`}
            data-first-use="venous-line-saturation"
          >
            <strong>One reading, several names.</strong>
            {/* A string with its own leading space: the production build drops one the layout implies. */}
            {
              ' The console labels its venous oxygen saturation SvO₂. The venous probe measures it on the drainage side, before the oxygenator, so these lessons also call it the pre-oxygenator, venous-line or drainage-line saturation. This is a drainage-line measurement, not a direct measurement of the patient’s mixed-venous saturation.'
            }
          </p>
        ) : null}
      </FoundationTeachingBlock>
      <FoundationTeachingBlock id="gas-path" title="Review the gas path">
        <section className={styles.section} aria-labelledby="gas-path-heading" data-gas-path>
          <h3 id="gas-path-heading" className={styles.heading}>
            Sweep-gas path
          </h3>
          {/*
            Two plain paragraphs where there were an arrow chain and a sentence per segment ("A
            setting here is a request, not proof of delivery"); a tester (2026-10-14) was unsure
            what she was reading.
          */}
          {/*
            What sweep gas is and what it does, before any question leans on it. A tester
            (2026-10-23) met "sweep gas" in an answer option at the end of this section and did not
            remember it being taught; this task named its path but never said what it was for. The
            statements are the module's own: the membrane walk stop's takeaway and the control
            section's narrative.
          */}
          <p className="mt-3 text-sm leading-6" data-sweep-definition>
            <strong>Sweep gas</strong> is the gas that ventilates the membrane lung: oxygen, or a
            blend of oxygen and air. It flows through the inside of the hollow fibres while blood
            flows around the outside. Gas and blood never mix: across the fibre walls, oxygen moves
            from the gas into the blood and CO₂ moves from the blood into the gas.
          </p>
          <p className="mt-2 text-sm leading-6">
            The gas runs from the wall supply through the blender, which sets the sweep flow rate
            and its oxygen fraction, into the gas side of the membrane lung and out through the
            exhaust. On the map it is the dashed line.
          </p>
          <p className="mt-2 text-sm leading-6" data-sweep-effect>
            The sweep flow rate mainly sets CO₂ removal: more sweep clears more CO₂ and lowers the
            PaCO₂. Oxygenation depends mostly on blood flow and the sweep gas’s oxygen fraction, not
            on how fast the sweep runs.
          </p>
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
            location; Δp is calculated from two of them.
          </p>
          <div className="my-3 flex flex-wrap gap-2" role="group" aria-label="Pressure locations">
            {FOUNDATION_PRESSURE_SITES.map((id) => (
              <button
                type="button"
                key={id}
                // The pressed state is real (aria-pressed) and now visible too: filled, with dark
                // ink, where the others stay outlined (S2-8). Luminance, not hue, carries it.
                className="min-h-11 rounded-xl border px-3 font-semibold hover:border-[#71e1e5] aria-pressed:border-[#71e1e5] aria-pressed:bg-[#71e1e5] aria-pressed:text-[#04211f]"
                aria-pressed={selected === id}
                data-pressure-site-toggle={id}
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
                Δp ={' '}
                {site.derivedFromSiteIds.map((id) => ecmoSensorSite(id).deviceLabel).join(' − ')}.
                It is the pressure difference across the oxygenator, not a fourth physical sampling
                site. If either input is unavailable, the difference is unavailable too.
              </p>
            ) : null}
            {site.caution ? <p className="mt-2 text-sm leading-6">{site.caution}</p> : null}
          </div>
          {/* Said with the reading it is about, not under every pressure (it is also on the map). */}
          {selected === 'pArt' ? <CircuitPressureIdentity /> : null}
          <details className="mt-3">
            <summary className="cursor-pointer font-semibold">All locations in words</summary>
            <TextEquivalent>
              {FOUNDATION_PRESSURE_SITES.map(
                (id) => `${ecmoSensorSite(id).deviceLabel}: ${ecmoSensorSite(id).measuredAt}.`,
              ).join(' ')}{' '}
              Δp is derived across the oxygenator; it is not a fourth sampling site.
            </TextEquivalent>
          </details>
          <p className="mt-3 text-sm leading-6" data-channel-vocabulary>
            pVen, pInt and pArt are CARDIOHELP/Getinge channel labels rather than standard ECMO
            vocabulary. Other consoles may label or provide these measurements differently. Circuit
            blood flow is a general ECMO quantity.
          </p>
        </section>
      </FoundationTeachingBlock>
      <FoundationTeachingBlock id="circuit-patient" title="Review circuit and patient pressure">
        <section className={styles.section} aria-labelledby="circuit-patient-heading">
          <h3 id="circuit-patient-heading" className={styles.heading}>
            Circuit pressure and patient pressure
          </h3>
          {/*
            The two readings this task compares, side by side and each named by where it is taken.

            A fellow walkthrough (S2-4) found the task asking for pArt "alongside the independent
            patient monitor" while the monitor sat about 1,300 px further down the page. Both cells
            read the one live simulation state the console and the bedside monitor read; nothing is
            copied or held here. The full monitor is also the first surface beside this task.
          */}
          <dl className="mt-3 grid gap-2 sm:grid-cols-2" data-part-map-pair>
            <div className="rounded-xl border p-3" data-measurement-site="circuit">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Circuit · console channel
              </dt>
              <dd className="mt-1">
                <ChannelValue label="pArt" readout={circuit.readouts.pArt} unit="mmHg" />
              </dd>
              <dd className="mt-1 text-xs leading-5">{ecmoSensorSite('pArt').measuredAt}.</dd>
            </div>
            <div className="rounded-xl border p-3" data-measurement-site="patient">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Patient · bedside monitor
              </dt>
              <dd className="mt-1">
                <span className="inline-flex flex-col" data-patient-map>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">MAP</span>
                  <span className="text-lg font-semibold">
                    {state.patient.meanArterialPressure} mmHg
                  </span>
                </span>
              </dd>
              <dd className="mt-1 text-xs leading-5">
                The patient&apos;s mean arterial pressure, from the independent bedside monitor
                rather than any circuit sensor.
              </dd>
            </div>
          </dl>
          {/* Two short statements where there were four, three of them saying the same thing. */}
          <CircuitPressureIdentity />
          <p className="mt-2 text-sm leading-6" data-part-map-sites>
            Two places, two numbers: they are not expected to agree, and neither stands in for the
            other. Read the patient&apos;s blood pressure on the bedside monitor.
            {state.supportMode === 'vv'
              ? ' In VV, “arterial” is only the device’s label: return blood still goes into a vein.'
              : ''}
          </p>
        </section>
        {/*
          "More about flow and saturation measurements" (circuit blood flow, the drainage-line
          saturation and the systemic venous estimate) used to close this task. A tester
          (2026-10-23) asked whether it served the task's point; it does not, and the saturation
          guides are taught where they are used (the VV and VA physiology sections).
        */}
      </FoundationTeachingBlock>
    </div>
  )
}
