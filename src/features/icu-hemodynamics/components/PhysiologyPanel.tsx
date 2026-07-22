'use client'

import type { Dispatch } from 'react'

import { PAC_POSITION_ANATOMY } from '@/features/cardiac-anatomy/content/paths'

import type { HemodynamicAction, HemodynamicSimulationState } from '../engine'
import { HemodynamicHeart3D } from './HemodynamicHeart3D'
import styles from './icu-hemodynamics.module.css'

interface PhysiologyPanelProps {
  state: HemodynamicSimulationState
  dispatch: Dispatch<HemodynamicAction>
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function PhysiologyPanel({ state, dispatch }: PhysiologyPanelProps) {
  const { parameters, measurements, catheter, measurementSystem } = state
  const anatomy = PAC_POSITION_ANATOMY[catheter.position]
  const targetAnatomy = catheter.targetPosition
    ? PAC_POSITION_ANATOMY[catheter.targetPosition]
    : null
  const rvLoopHeight = 20 + clamp(measurements.rvSystolicMmHg / 80, 0.2, 1) * 58
  const lvLoopWidth = 34 + clamp(measurements.cardiacOutputLMin / 8, 0.2, 1) * 58
  const levelDescription =
    measurementSystem.transducerLevelCm === 0
      ? 'at the phlebostatic axis'
      : `${Math.abs(measurementSystem.transducerLevelCm).toFixed(0)} centimeters ${measurementSystem.transducerLevelCm > 0 ? 'above' : 'below'} the phlebostatic axis`
  const summary = [
    targetAnatomy
      ? `Catheter is advancing from ${catheter.position.toUpperCase()} toward ${catheter.targetPosition?.toUpperCase()}; the monitor remains on the confirmed ${catheter.position.toUpperCase()} waveform until arrival.`
      : `Catheter tip is in ${catheter.position.toUpperCase()} at ${catheter.insertionDepthCm} centimeters.`,
    anatomy.landmark,
    anatomy.waveform,
    `The pressure transducer is ${levelDescription} and is ${measurementSystem.zeroed ? 'zeroed' : 'not yet zeroed'}.`,
    `Modeled right atrial pressure is ${measurements.rapMmHg} and PAWP is ${measurements.pawpMmHg ?? 'unavailable'} millimeters of mercury.`,
    `Cardiac output is ${measurements.cardiacOutputLMin.toFixed(1)} liters per minute.`,
    `Systemic resistance is ${Math.round(parameters.systemicVascularResistanceDynSecCm5)} dynes seconds per centimeter to the fifth; pulmonary resistance is ${parameters.pulmonaryVascularResistanceWU.toFixed(1)} Wood units.`,
    `PEEP is ${parameters.peepCmH2O.toFixed(0)} centimeters of water.`,
  ].join(' ')

  return (
    <section className={styles.physiologyPanel} aria-labelledby="physiology-heading">
      <header className={styles.sectionHeader}>
        <div>
          <span>Mechanism view</span>
          <h2 id="physiology-heading">Anatomy, catheter position, and pressure reference</h2>
        </div>
        <button
          type="button"
          aria-pressed={state.showPressureVolumeLoops}
          onClick={() => dispatch({ type: 'TOGGLE_PV_LOOPS' })}
        >
          {state.showPressureVolumeLoops ? 'Hide' : 'Show'} PV loops
        </button>
      </header>

      <HemodynamicHeart3D state={state} />

      <p className={styles.anatomyMorphologyNote}>
        <strong>Valve morphology:</strong> Aortic cusps are segmented. Mitral, tricuspid, and
        pulmonic anatomy are route/orifice proxies only; do not assess leaflets or chordae here.
      </p>

      <dl
        className={styles.anatomyMetricGrid}
        aria-label="Synchronized pressure and flow landmarks"
      >
        <div data-circulation="right">
          <dt>RA</dt>
          <dd>
            {measurements.rapMmHg} <small>mmHg</small>
          </dd>
        </div>
        <div data-circulation="right">
          <dt>RV</dt>
          <dd>
            {measurements.rvSystolicMmHg}/{measurements.rvDiastolicMmHg}
          </dd>
        </div>
        <div data-circulation="right">
          <dt>PA</dt>
          <dd>
            {measurements.papSystolicMmHg}/{measurements.papDiastolicMmHg}
          </dd>
        </div>
        <div data-circulation="left">
          <dt>PAWP</dt>
          <dd>
            {measurements.pawpMmHg ?? '—'} <small>mmHg</small>
          </dd>
        </div>
        <div data-circulation="flow">
          <dt>CO</dt>
          <dd>
            {measurements.cardiacOutputLMin.toFixed(1)} <small>L/min</small>
          </dd>
        </div>
        <div data-circulation="load">
          <dt>PVR / SVR</dt>
          <dd>
            {parameters.pulmonaryVascularResistanceWU.toFixed(1)} <small>WU</small> ·{' '}
            {Math.round(parameters.systemicVascularResistanceDynSecCm5)}
          </dd>
        </div>
      </dl>

      {state.showPressureVolumeLoops ? (
        <figure className={styles.pvLoopPanel}>
          <svg
            viewBox="0 0 360 120"
            role="img"
            aria-label={`Qualitative synchronized pressure-volume loops. RV systolic pressure ${measurements.rvSystolicMmHg} millimeters of mercury and modeled cardiac output ${measurements.cardiacOutputLMin.toFixed(1)} liters per minute.`}
          >
            <path d="M28 12 V96 H334" className={styles.pvAxis} />
            <path
              d={`M72 91 C56 ${91 - rvLoopHeight} 96 ${91 - rvLoopHeight} 118 91 C103 101 82 101 72 91 Z`}
              className={styles.rvLoop}
            />
            <path
              d={`M190 91 C169 27 ${190 + lvLoopWidth} 20 ${190 + lvLoopWidth} 77 C${190 + lvLoopWidth - 4} 100 212 103 190 91 Z`}
              className={styles.lvLoop}
            />
            <text x="76" y="108">
              RV
            </text>
            <text x="228" y="108">
              LV
            </text>
          </svg>
          <figcaption>
            Qualitative loop shape responds to the synchronized educational model; it is not a
            measured pressure-volume study.
          </figcaption>
        </figure>
      ) : null}

      <p className={styles.visualTextEquivalent}>
        <strong>Visual text equivalent:</strong> {summary} The transparent CT-derived anatomy is a
        teaching surface. The flow-directed balloon is shown inflated only for modeled RA/RV-to-PA
        advancement and deflated on PA arrival. The catheter route and transducer are educational
        overlays, not procedural placement guidance.
      </p>
    </section>
  )
}
