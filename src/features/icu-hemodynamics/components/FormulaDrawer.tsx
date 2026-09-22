'use client'

import type { Dispatch } from 'react'

import {
  HEMODYNAMIC_CLINICAL_THRESHOLDS,
  hemodynamicDerivedValueGuides,
  hemodynamicDerivedValueIds,
  type DerivedValueGuide,
} from '../content'
import {
  calculateDerivedHemodynamics,
  type HemodynamicAction,
  type HemodynamicSimulationState,
  type InterpretationValue,
} from '../engine'
import {
  physiologicalEpisodeWords,
  storedWedgeProvenance,
  thermodilutionSeriesView,
} from '../engine/measurementProvenance'
import styles from './icu-hemodynamics.module.css'

interface FormulaDrawerProps {
  state: HemodynamicSimulationState
  dispatch: Dispatch<HemodynamicAction>
  observedInputsOnly?: boolean
}

function DerivedValue({
  value,
  guide,
}: {
  readonly value: InterpretationValue
  readonly guide: DerivedValueGuide
}) {
  return (
    <>
      {value.status === 'not-interpretable' ? (
        <span className={styles.notInterpretable} title={value.reason}>
          Not interpretable
        </span>
      ) : (
        <strong>
          {value.value} <small>{value.unit}</small>
        </strong>
      )}
      <dl>
        <div>
          <dt>How to read it</dt>
          <dd>{guide.normalRange}</dd>
        </div>
        {guide.actionableThresholds ? (
          <div>
            <dt>Context-specific boundaries</dt>
            <dd>{guide.actionableThresholds}</dd>
          </div>
        ) : null}
        <div>
          <dt>Limits</dt>
          <dd>{guide.caveats}</dd>
        </div>
      </dl>
    </>
  )
}

export function FormulaDrawer({ state, dispatch, observedInputsOnly = false }: FormulaDrawerProps) {
  const derivedReviewComplete = state.signalValidationChecks.includes('derived-reviewed')
  /*
   * HD-PRE-REVIEW-02 (report L7-06, section E). A derived value is only as current as the oldest
   * thing it is made of. Flow comes from the series acquired under the conditions the patient is in
   * now, and the wedge only when it was stored under those same conditions — a post-intervention
   * pressure is never divided by a pre-intervention output because both happen to exist.
   */
  const seriesView = thermodilutionSeriesView(state)
  const storedWedge = storedWedgeProvenance(state)
  const wedgeIsCurrent = storedWedge !== null && storedWedge.current !== false
  const staleInputs = [
    seriesView.currentEstablished || !seriesView.latestEarlierEstablished
      ? null
      : `the only accepted thermodilution series was acquired ${physiologicalEpisodeWords(seriesView.latestEarlierEstablished.identity.episode)}`,
    storedWedge !== null && storedWedge.current === false
      ? `the stored wedge was read ${physiologicalEpisodeWords(storedWedge.episode)}`
      : null,
  ].filter((item): item is string => item !== null)
  const derived = calculateDerivedHemodynamics({
    measurements: observedInputsOnly
      ? {
          ...state.measurements,
          cardiacOutputLMin: seriesView.current.averageLMin ?? undefined,
          pawpMmHg: wedgeIsCurrent ? state.catheter.storedWedgeMmHg : null,
        }
      : state.measurements,
    bodySurfaceAreaM2: state.parameters.bodySurfaceAreaM2,
    inputsStale: !state.measurementSystem.zeroed || state.measurementSystem.artifact !== 'none',
    ppvContext: {
      controlledMechanicalVentilation: state.parameters.spontaneousBreathingFraction === 0,
      regularRhythm:
        state.parameters.rhythmRegularity >=
        HEMODYNAMIC_CLINICAL_THRESHOLDS.signalValidation.rhythmRegularityMinimum,
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
    <details className={styles.formulaDrawer}>
      <summary>Derived hemodynamics and interpretation limits</summary>
      <div className={styles.formulaIntro}>
        <p>
          {observedInputsOnly
            ? 'Flow-dependent results use the accepted thermodilution series for the current conditions; wedge-dependent results require a value stored under those conditions. The other pressures are the simulation’s current estimates. '
            : 'Every value is calculated from the simulation’s current estimates. '}
          Stale, unzeroed, artifact-contaminated, or physiologically invalid inputs remain
          explicitly uninterpretable.
        </p>
        {observedInputsOnly && staleInputs.length > 0 ? (
          <p data-derived-stale-inputs>
            Not used, because the patient’s modeled physiology has changed since:{' '}
            {staleInputs.join('; ')}. A value from before the change does not describe the patient
            now.
          </p>
        ) : null}
        <span>Current BSA: {state.parameters.bodySurfaceAreaM2.toFixed(2)} m²</span>
      </div>
      <div className={styles.formulaGrid}>
        {hemodynamicDerivedValueIds.map((key) => {
          const result = derived[key]
          const guide = hemodynamicDerivedValueGuides[key]
          return (
            <article key={key}>
              <div>
                <span>{guide.label}</span>
                <code>{guide.formula}</code>
              </div>
              <DerivedValue value={result} guide={guide} />
              {result.reason && <p>{result.reason}</p>}
            </article>
          )
        })}
      </div>
      <p className={styles.formulaCaution}>
        PPV is only displayed when rhythm, ventilation, effort, chest condition, waveform quality,
        and RV context meet the modeled validity screen. The approximately{' '}
        {HEMODYNAMIC_CLINICAL_THRESHOLDS.pulsePressureVariation.responsivePercent}% teaching
        threshold is shown only inside those conditions and still predicts fluid responsiveness—not
        volume status or a mandate to give fluid.
      </p>
      <button
        type="button"
        className={styles.checkResponseButton}
        aria-pressed={derivedReviewComplete}
        disabled={derivedReviewComplete}
        onClick={() => dispatch({ type: 'VALIDATE_SIGNAL', check: 'derived-reviewed' })}
      >
        {derivedReviewComplete
          ? 'Input validity and interpretation limits reviewed'
          : 'Confirm input validity and interpretation limits reviewed'}
      </button>
    </details>
  )
}
