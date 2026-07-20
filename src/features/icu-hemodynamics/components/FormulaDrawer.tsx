'use client'

import type { Dispatch } from 'react'

import {
  calculateDerivedHemodynamics,
  type HemodynamicAction,
  type HemodynamicSimulationState,
  type InterpretationValue,
} from '../engine'
import styles from './icu-hemodynamics.module.css'

interface FormulaDrawerProps {
  state: HemodynamicSimulationState
  dispatch: Dispatch<HemodynamicAction>
}

const formulas = [
  ['strokeVolumeMl', 'SV', 'CO × 1000 / HR'],
  ['strokeVolumeIndexMlM2', 'SVI', 'SV / BSA'],
  ['systemicVascularResistance', 'SVR', '80 × (MAP − RAP) / CO'],
  ['systemicVascularResistanceIndex', 'SVRI', 'SVR × BSA'],
  ['pulmonaryVascularResistance', 'PVR', '(mPAP − PAWP) / CO'],
  ['pulmonaryVascularResistanceIndex', 'PVRI', 'PVR × BSA'],
  ['cardiacPowerOutputW', 'CPO', 'MAP × CO / 451'],
  ['pulmonaryArteryPulsatilityIndex', 'PAPi', '(PASP − PADP) / RAP'],
  ['pulmonaryArteryCompliance', 'PA compliance', 'SV / (PASP − PADP)'],
  ['pulsePressureVariationPercent', 'PPV', '(PPmax − PPmin) / PPmean × 100'],
] as const

function DerivedValue({ value }: { value: InterpretationValue }) {
  if (value.status === 'not-interpretable') {
    return (
      <span className={styles.notInterpretable} title={value.reason}>
        Not interpretable
      </span>
    )
  }
  return (
    <strong>
      {value.value} <small>{value.unit}</small>
    </strong>
  )
}

export function FormulaDrawer({ state, dispatch }: FormulaDrawerProps) {
  const derived = calculateDerivedHemodynamics({
    measurements: state.measurements,
    bodySurfaceAreaM2: state.parameters.bodySurfaceAreaM2,
    inputsStale: !state.measurementSystem.zeroed || state.measurementSystem.artifact !== 'none',
    ppvContext: {
      controlledMechanicalVentilation: state.parameters.spontaneousBreathingFraction === 0,
      regularRhythm: state.parameters.rhythmRegularity >= 0.95,
      noSpontaneousEffort: state.parameters.spontaneousBreathingFraction === 0,
      tidalVolumeMlKg: 8,
      closedChest: true,
      validArterialWaveform:
        state.measurementSystem.zeroed && state.measurementSystem.artifact === 'none',
      rightVentricularFailure: state.parameters.rightVentricularContractility < 0.6,
      intraAbdominalPressureElevated: false,
    },
  })

  return (
    <details
      className={styles.formulaDrawer}
      onToggle={(event) => {
        if (event.currentTarget.open)
          dispatch({ type: 'VALIDATE_SIGNAL', check: 'derived-reviewed' })
      }}
    >
      <summary>Derived hemodynamics and interpretation limits</summary>
      <div className={styles.formulaIntro}>
        <p>
          Every value is calculated from the current simulated measurements. Stale, unzeroed,
          artifact-contaminated, or physiologically invalid inputs remain explicitly
          uninterpretable.
        </p>
        <span>Current BSA: {state.parameters.bodySurfaceAreaM2.toFixed(2)} m²</span>
      </div>
      <div className={styles.formulaGrid}>
        {formulas.map(([key, label, formula]) => {
          const result = derived[key]
          return (
            <article key={key}>
              <div>
                <span>{label}</span>
                <code>{formula}</code>
              </div>
              <DerivedValue value={result} />
              {result.reason && <p>{result.reason}</p>}
            </article>
          )
        })}
      </div>
      <p className={styles.formulaCaution}>
        PPV is only displayed when rhythm, ventilation, effort, chest condition, waveform quality,
        and RV context meet the modeled validity screen. A threshold is never applied outside those
        conditions.
      </p>
    </details>
  )
}
