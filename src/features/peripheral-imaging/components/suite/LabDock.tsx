'use client'
import { useEffect } from 'react'
import {
  LAB_CONTROLS,
  LAB_METRICS,
  labReadouts,
  labValue,
  formatReadout,
  type LabMetricId,
} from '../../engine/labMetrics'
import { controlElementId, type ImagingSuitePaneProps } from './types'
import styles from './suite-scene.module.css'

export function LabDock(props: ImagingSuitePaneProps & { disabledControls?: ReadonlySet<string> }) {
  const { view, lab, onLabChange, controlsEnabled, spotlightKey } = props
  const readouts = view.lab ? labReadouts(view.lab, lab.values, view.sectionId) : {}
  const metricIds = view.readouts ?? (Object.keys(readouts) as LabMetricId[])
  useEffect(() => {
    if (!spotlightKey) return
    document.getElementById(controlElementId(spotlightKey))?.focus({ preventScroll: true })
  }, [spotlightKey])
  return (
    <div className={styles.dock}>
      {view.lab && (
        <fieldset className={styles.controls} disabled={!controlsEnabled} data-suite-controls>
          <legend>Explore the model</legend>
          {LAB_CONTROLS[view.lab]
            .filter((c) => !view.controls || view.controls.includes(c.key))
            .map((control) => {
              const id = controlElementId(control.key)
              const current = labValue(view.lab!, lab.values, control.key, view.sectionId)
              return (
                <div
                  key={control.key}
                  className={styles.control}
                  data-spotlight={spotlightKey === control.key ? 'true' : undefined}
                >
                  {control.kind === 'range' ? (
                    <>
                      <div className={styles.controlLabel}>
                        <label htmlFor={id}>{control.label}</label>
                        <output htmlFor={id}>
                          {String(current)}
                          {control.unit}
                        </output>
                      </div>
                      <input
                        id={id}
                        type="range"
                        min={control.min}
                        max={control.max}
                        step={control.step}
                        value={Number(current)}
                        onChange={(e) => onLabChange({ [control.key]: Number(e.target.value) })}
                      />
                    </>
                  ) : control.kind === 'toggle' ? (
                    <label htmlFor={id}>
                      <input
                        id={id}
                        type="checkbox"
                        checked={current === true}
                        onChange={(e) => onLabChange({ [control.key]: e.target.checked })}
                      />
                      {control.label}
                    </label>
                  ) : control.kind === 'select' || control.kind === 'choice' ? (
                    <>
                      <label htmlFor={id}>{control.label}</label>
                      <select
                        id={id}
                        value={String(current)}
                        onChange={(e) => {
                          const option = control.options?.find(
                            (o) => String(o.value) === e.target.value,
                          )
                          if (option) onLabChange({ [control.key]: option.value })
                        }}
                      >
                        {control.options?.map((option) => (
                          <option key={String(option.value)} value={String(option.value)}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <button
                      id={id}
                      type="button"
                      disabled={
                        (control.key === 'captured' && readouts.ready !== true) ||
                        props.disabledControls?.has(control.key)
                      }
                      onClick={() => onLabChange({ [control.key]: true })}
                    >
                      {control.label}
                    </button>
                  )}
                </div>
              )
            })}
          <button type="button" onClick={props.onLabReset}>
            Reset this model
          </button>
        </fieldset>
      )}
      <dl className={styles.readouts} data-readouts>
        {metricIds.map((metric) => (
          <div key={metric} data-readout={metric}>
            <dt>{LAB_METRICS[metric].label}</dt>
            <dd>{formatReadout(metric, readouts[metric])}</dd>
          </div>
        ))}
      </dl>
      {props.goals.length > 0 && (
        <ul className={styles.goals} data-suite-goals aria-label="What this step is waiting for">
          {props.goals.map(({ goal, met }) => (
            <li key={goal.label} data-met={met ? 'true' : 'false'}>
              {goal.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
