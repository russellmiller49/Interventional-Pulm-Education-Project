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

const MODEL_KEYS = new Set([
  'slicesTarget',
  'planeTool',
  'planeLesion',
  'planeDeeper',
  'showCurrent',
  'depth',
  'resetGeometry',
  'speed',
  'shift',
  'previous',
  'capture',
  'offsetX',
  'offsetDepth',
  'center',
  'tipX',
  'tipY',
  'tipZ',
  'toolNear',
  'toolAcross',
  'revealed',
  'kerma',
  'area',
])

export function LabDock(props: ImagingSuitePaneProps & { disabledControls?: ReadonlySet<string> }) {
  const { view, lab, onLabChange, controlsEnabled, spotlightKey } = props
  const readouts = view.lab ? labReadouts(view.lab, lab.values, view.sectionId) : {}
  const metricIds = props.independent
    ? []
    : (view.readouts ?? (Object.keys(readouts) as LabMetricId[]))
  const controls = view.lab
    ? LAB_CONTROLS[view.lab].filter(
        (c) =>
          (!view.controls || view.controls.includes(c.key)) &&
          (!props.independent || !MODEL_KEYS.has(c.key)),
      )
    : []
  useEffect(() => {
    if (!spotlightKey) return
    document.getElementById(controlElementId(spotlightKey))?.focus({ preventScroll: true })
  }, [spotlightKey])
  return (
    <div className={styles.dock}>
      {view.lab && controls.length > 0 && (
        <fieldset className={styles.controls} disabled={!controlsEnabled} data-suite-controls>
          <legend>Image controls</legend>
          {view.lab === 'acquisition' && (
            <p>
              Checklist confirmations are learner-declared. This scene does not detect collisions or
              verify clinical safety.
            </p>
          )}
          {[false, true].map((model) => {
            const group = controls.filter((c) => MODEL_KEYS.has(c.key) === model)
            return group.length ? (
              <fieldset
                key={String(model)}
                className={styles.controlGroup}
                data-model-controls={model ? 'true' : undefined}
              >
                <legend>
                  {model
                    ? 'Teaching-model adjustments · fictional state'
                    : 'Imaging and display controls'}
                </legend>
                {group.map((control) => {
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
              </fieldset>
            ) : null
          })}
          <button type="button" onClick={props.onLabReset}>
            Reset this model
          </button>
        </fieldset>
      )}
      {view.lab === 'temporal' && (
        <p>
          Pulse width may be system-selected or mode-dependent. Fixed-current examples use 20 mA;
          tube loading is not patient dose. No image-lag model is included.
        </p>
      )}
      <dl className={styles.readouts} data-readouts>
        {metricIds.map((metric) => (
          <div key={metric} data-readout={metric}>
            <dt>{LAB_METRICS[metric].label}</dt>
            <dd>{formatReadout(metric, readouts[metric])}</dd>
          </div>
        ))}
      </dl>
      <LabGoals goals={props.goals} />
    </div>
  )
}

export function LabGoals({ goals }: Pick<ImagingSuitePaneProps, 'goals'>) {
  return goals.length > 0 ? (
    <ul className={styles.goals} data-suite-goals aria-label="What this step is waiting for">
      {goals.map(({ goal, met }) => (
        <li key={goal.label} data-met={met ? 'true' : 'false'}>
          {goal.label}
        </li>
      ))}
    </ul>
  ) : null
}
