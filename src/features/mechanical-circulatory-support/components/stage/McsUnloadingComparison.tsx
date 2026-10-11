import { useState } from 'react'
import {
  MCS_UNLOADING_BASE_LEVEL,
  MCS_UNLOADING_COMPARISON_LEVELS,
  MCS_UNLOADING_DELTA_CAPTION,
  mcsUnloadingSignals,
  type McsUnloadingLevel,
} from '../../content/unloadingExamples'
import { MCS_NUMBERS } from '../../content/teachingNumbers'
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
            <strong>{label}: </strong>Suction is present at both settings, so the higher flow number
            is not better support. Reduce the P-level by one or two levels, give volume if the
            patient is underfilled, check position with echo and assess the right ventricle.
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
                {/*
                 * On a narrow card the rows stack — each quantity with its three values labelled —
                 * instead of scrolling the values off to the right, where on a phone only the
                 * quantity names were on screen (F24, presentation only). The explicit roles keep
                 * it a table for assistive technology when the stacked layout changes its display.
                 */}
                <table role="table">
                  <caption>
                    Provided outputs at {changed.timeSeconds.toFixed(2)} simulated seconds
                  </caption>
                  <thead role="rowgroup">
                    <tr role="row">
                      <th scope="col" role="columnheader">
                        Modeled quantity
                      </th>
                      <th scope="col" role="columnheader">
                        P5 control
                      </th>
                      <th scope="col" role="columnheader">
                        P{level}
                      </th>
                      <th scope="col" role="columnheader">
                        Difference at the same instant
                      </th>
                    </tr>
                  </thead>
                  <tbody role="rowgroup">
                    {mcsUnloadingSignals.map(([key, name, unit, digits]) => (
                      <tr key={key} role="row" data-unloading-signal={key}>
                        <th scope="row" role="rowheader">
                          {name}
                          <small>{unit}</small>
                        </th>
                        <td role="cell" data-column-label="P5 control">
                          {control.metrics[key].toFixed(digits)}
                        </td>
                        <td role="cell" data-column-label={`P${level}`}>
                          {changed.metrics[key].toFixed(digits)}
                        </td>
                        <td
                          role="cell"
                          data-unloading-delta={key}
                          data-column-label="Difference at the same instant"
                        >
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
                L/min, compared at the same moment in both branches.
              </p>
              <details>
                <summary>Starting state</summary>
                <p>
                  P5 starting state at {baseline.timeSeconds.toFixed(2)} s. Both branches then
                  receive the same setting change and eight simulated seconds of observation.
                </p>
                <p>
                  Starting LV volume {baseline.metrics.lvedvMl} mL; wedge pressure{' '}
                  {baseline.metrics.pcwpMmHg} mm Hg. Each change is measured against P5 held for the
                  same eight seconds.
                </p>
                <p>
                  Heart rate {baseline.patient.heartRateBpm} beats/min; SVR{' '}
                  {baseline.patient.systemicVascularResistanceDynSecCm5} dyn·s/cm⁵; LV/RV
                  contractility {baseline.patient.leftVentricularContractility}/
                  {baseline.patient.rightVentricularContractility}; PVR{' '}
                  {baseline.patient.pulmonaryVascularResistanceWU} Wood units; PEEP{' '}
                  {baseline.patient.peepCmH2O} cm H₂O. No aortic insufficiency or tamponade.
                </p>
                <p>
                  Active alarms at P5:{' '}
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
          Pump flow and unloading are related but different. Unloading shows as a smaller ventricle
          and a lower wedge pressure. LV end-diastolic volume here is a simulator surrogate, not an
          echo measurement, and wedge pressure is shown to the nearest mm Hg, so a smaller ventricle
          can sit beside an unchanged pressure.
        </p>
        <p>
          Effective systemic flow is native flow plus left pump flow, minus any regurgitant return.
          Native ejection falls as support rises. A right-sided pump is in series and is never added
          to the systemic total.
        </p>
        <p>
          More flow on the console is not better perfusion until the patient shows it: mentation,
          urine output and the lactate trend. Mean flow to expect on an Impella CP:{' '}
          {MCS_NUMBERS.value('impella-cp-flow-by-level')}. Peak flow in systole at P-9 is{' '}
          {MCS_NUMBERS.value('impella-cp-peak-flow')}: a peak, not a mean.
        </p>
      </section>
    </div>
  )
}
