import { useState } from 'react'
import {
  MCS_UNLOADING_BASE_LEVEL,
  MCS_UNLOADING_COMPARISON_LEVELS,
  MCS_UNLOADING_DELTA_CAPTION,
  mcsUnloadingSignals,
  type McsUnloadingLevel,
} from '../../content/unloadingExamples'
import { mcsObservedDirection } from '../../engine/learningSession'
import { replayMcsUnloadingComparison } from '../../engine/unloadingComparison'
import styles from './mcs-unloading.module.css'

/** Differences of the rounded values this table actually receives, at matched times. */
function deltaText(before: number, after: number, unit: string, digits: number): string {
  const difference = Number((after - before).toFixed(digits))
  if (difference === 0) return 'No resolvable displayed change'
  return `${difference > 0 ? '+' : '−'}${Math.abs(difference).toFixed(digits)} ${unit}`
}

/** A replay of provided examples; it never dispatches into a learner's live session. */
export function McsUnloadingComparison() {
  const [level, setLevel] = useState<McsUnloadingLevel>(6)
  const [examples, setExamples] = useState(() => replayMcsUnloadingComparison())
  const [notice, setNotice] = useState('Provided model examples. No action or answer recorded.')

  function replay(next: McsUnloadingLevel) {
    setLevel(next)
    setExamples(replayMcsUnloadingComparison(next))
    setNotice(
      `Comparison replayed: P${MCS_UNLOADING_BASE_LEVEL} and P${next}, from the same starting conditions. No action or answer recorded.`,
    )
  }

  return (
    <div className={styles.comparison} data-unloading-comparison>
      <p>
        Both examples use an aligned Impella CP with normal purge and no right pump. Only the
        modeled filling input differs between them. Each starts at P5, then compares continued P5
        with P{level} at the same simulated time. These are model outputs, not patient measurements
        or a recommendation to increase support.
      </p>
      <div className={styles.controls}>
        <div role="group" aria-label="Comparison setting" className={styles.settings}>
          <span>Compare P5 with:</span>
          {MCS_UNLOADING_COMPARISON_LEVELS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={level === value}
              onClick={() => replay(value)}
            >
              P{value}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => replay(level)}>
          Replay comparison
        </button>
        <button type="button" onClick={() => replay(6)}>
          Reset comparison to P6
        </button>
      </div>
      <p role="status">{notice}</p>
      {examples
        .filter(({ changed }) =>
          changed.alarms.some((alarm) => alarm.active && alarm.id === 'impella-left-suction'),
        )
        .map(({ id, label }) => (
          <p key={id} className={styles.warning} data-unloading-suction>
            <strong>{label}: </strong>Suction remains present at both settings. A higher flow number
            does not establish safe support or resolution of underfilling. Assess filling, RV
            delivery and position with the MCS team and current device instructions.
          </p>
        ))}
      <div className={styles.examples}>
        {examples.map(({ id, label, preloadPercent, baseline, control, changed }) => {
          return (
            <section
              key={id}
              className={styles.example}
              data-unloading-condition={id}
              aria-labelledby={`unloading-${id}`}
            >
              <h4 id={`unloading-${id}`}>{label}</h4>
              <p>
                Filling input: {preloadPercent}% of the model reference. This input is not a
                measured blood volume or a clinical target.
              </p>
              <p className={styles.tableHint}>
                Scroll the table horizontally if all columns are not visible.
              </p>
              <div
                className={styles.tableScroll}
                role="region"
                aria-label={`${label} pressure and flow comparison`}
                tabIndex={0}
              >
                <table>
                  <caption>
                    Provided outputs at {changed.timeSeconds.toFixed(2)} simulated seconds
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Modeled quantity</th>
                      <th scope="col">P5 control</th>
                      <th scope="col">P{level}</th>
                      <th scope="col">Difference at the same instant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mcsUnloadingSignals.map(([key, name, unit, digits]) => (
                      <tr key={key} data-unloading-signal={key}>
                        <th scope="row">
                          {name}
                          <small>{unit}</small>
                        </th>
                        <td>{control.metrics[key].toFixed(digits)}</td>
                        <td>{changed.metrics[key].toFixed(digits)}</td>
                        <td data-unloading-delta={key}>
                          {deltaText(control.metrics[key], changed.metrics[key], unit, digits)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p data-unloading-delta-caption>{MCS_UNLOADING_DELTA_CAPTION}</p>
              <p data-unloading-interpretation>
                Compared with continued P5, LV volume{' '}
                {mcsObservedDirection(control.metrics.lvedvMl, changed.metrics.lvedvMl, 0)} by{' '}
                {Math.abs(changed.metrics.lvedvMl - control.metrics.lvedvMl)} mL. Wedge pressure{' '}
                {mcsObservedDirection(control.metrics.pcwpMmHg, changed.metrics.pcwpMmHg, 0)} (
                {control.metrics.pcwpMmHg} → {changed.metrics.pcwpMmHg} mm Hg). Left pump flow{' '}
                {mcsObservedDirection(
                  control.metrics.leftDeviceFlowLMin,
                  changed.metrics.leftDeviceFlowLMin,
                  2,
                )}{' '}
                by{' '}
                {Math.abs(
                  changed.metrics.leftDeviceFlowLMin - control.metrics.leftDeviceFlowLMin,
                ).toFixed(2)}{' '}
                L/min. These are matched-time endpoints; they do not establish the sequence of the
                responses.
              </p>
              <details>
                <summary>Starting state and model assumptions</summary>
                <p>
                  Seed {baseline.seed}. P5 starting state at {baseline.timeSeconds.toFixed(2)} s;
                  both branches then receive the same setting-update step and eight simulated
                  seconds of observation. The interval is authored, not a clinical stabilization
                  time.
                </p>
                <p>
                  Starting LV volume {baseline.metrics.lvedvMl} mL; wedge pressure{' '}
                  {baseline.metrics.pcwpMmHg} mm Hg. Comparison uses the later P5 control to account
                  for settling, rather than attributing all change from this starting state to the
                  new setting.
                </p>
                <p>
                  Heart rate {baseline.patient.heartRateBpm} beats/min; SVR{' '}
                  {baseline.patient.systemicVascularResistanceDynSecCm5} dyn·s/cm⁵; modeled LV/RV
                  contractility {baseline.patient.leftVentricularContractility}/
                  {baseline.patient.rightVentricularContractility}; PVR{' '}
                  {baseline.patient.pulmonaryVascularResistanceWU} Wood units; PEEP{' '}
                  {baseline.patient.peepCmH2O} cm H₂O. No modeled aortic insufficiency or tamponade.
                </p>
                <p>
                  Active modeled alarms at P5:{' '}
                  {control.alarms
                    .filter((alarm) => alarm.active)
                    .map((alarm) => alarm.label)
                    .join('; ') || 'none'}
                  . At P{level}:{' '}
                  {changed.alarms
                    .filter((alarm) => alarm.active)
                    .map((alarm) => alarm.label)
                    .join('; ') || 'none'}
                  .
                </p>
              </details>
            </section>
          )
        })}
      </div>
      <section data-unloading-explanation>
        <h4>How to read the comparison</h4>
        <p>
          Pump flow and unloading are related but different. Here, LV end-diastolic volume is a
          loading-dependent model surrogate; it is not the conserved LV reservoir volume or an
          echocardiographic measurement. Wedge pressure is a separate modeled quantity, displayed to
          the nearest mm Hg. A smaller LV can therefore appear beside an unchanged pressure. An
          unchanged rounded pressure does not rule out the modeled volume response.
        </p>
        <p>
          Compare concurrent native flow, left pump flow and regurgitant return: effective systemic
          flow is native plus left pump flow minus return, within display rounding. Native ejection
          changes during support. Right-pump flow, when present elsewhere in the module, is in
          series and is not added to that systemic total.
        </p>
        <p>
          These outputs do not establish improved organ perfusion. Lactate, urine output, mentation,
          hemolysis and tissue oxygen delivery are not measured by this model. The low-filling
          example isolates the existing signal-dump condition; IMP-01 adds reduced RV contractility
          and higher PVR, while IMP-03 adds high afterload and a purge warning.
        </p>
        <p>
          The CP model is not a validated manufacturer flow estimator. The section’s source notes
          retain the distinction between peak and mean product flow and the unresolved textbook
          disagreement. Faculty/device review of this interpretation remains pending.
        </p>
      </section>
    </div>
  )
}
