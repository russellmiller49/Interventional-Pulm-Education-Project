'use client'
import { useEffect, useState } from 'react'
import {
  LAB_CONTROLS,
  LAB_METRIC_MEANINGS,
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
  // Report 3.8: several readouts update together, and nothing said which of them the last control
  // change had moved. A readout is marked from the change that moved it until the next change; it
  // is a statement about the display, and no value, unit or formula is touched.
  const shown = metricIds.map((metric) => `${metric}=${formatReadout(metric, readouts[metric])}`)
  const shownKey = shown.join('|')
  const [tracked, setTracked] = useState<{
    readonly key: string
    readonly shown: readonly string[]
    readonly changed: ReadonlySet<string>
  }>({ key: shownKey, shown, changed: new Set() })
  if (tracked.key !== shownKey) {
    // Adjusted while rendering, from the previous render's readouts, rather than in an effect.
    const moved = shown
      .filter((entry) => !tracked.shown.includes(entry))
      .map((entry) => entry.split('=')[0])
    // Every readout moving at once is a reset or a new example, not one control's effect.
    const changed = moved.length < shown.length ? new Set(moved) : new Set<string>()
    setTracked({ key: shownKey, shown, changed })
  }
  const changed = tracked.changed
  useEffect(() => {
    if (!spotlightKey) return
    document.getElementById(controlElementId(spotlightKey))?.focus({ preventScroll: true })
  }, [spotlightKey])
  return (
    <div className={styles.dock} data-lab-dock>
      {/* Report 2.13 (fellow walkthrough, PDF p.21/p.27): the step's checklist was printed in the
          explanation column, which the comparison workbench puts below the fold, while the footer
          said "the changes listed below". It is the list of what these controls are for, so it
          leads the dock that holds them. */}
      {props.goals.length > 0 && (
        <div className={styles.goalBlock} data-dock-goals>
          <p className={styles.goalHeading}>What to do in this step</p>
          <LabGoals goals={props.goals} />
        </div>
      )}
      {view.lab && controls.length > 0 && (
        <fieldset className={styles.controls} disabled={!controlsEnabled} data-suite-controls>
          <legend>Image controls</legend>
          {view.lab === 'acquisition' && (
            <p data-learner-declared>
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
                  {model ? 'Teaching-model adjustments' : 'Imaging and display controls'}
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
        // Report 3.9: what the tube-load readout is for, from the section's own arithmetic.
        <p data-tube-load-note>
          Tube load at a fixed 20 mA is pulse rate × pulse width × current: the output the tube is
          asked for each second. Halving the pulse rate while the pulse doubles leaves it unchanged,
          which is why a lower pulse rate alone does not mean less output. It is not patient dose.
          Pulse width may be system-selected or mode-dependent, and no image-lag model is included.
        </p>
      )}
      <dl className={styles.readouts} data-readouts>
        {metricIds.map((metric) => (
          <div
            key={metric}
            data-readout={metric}
            data-readout-changed={changed.has(metric) ? 'true' : undefined}
          >
            <dt>{LAB_METRICS[metric].label}</dt>
            <dd>{formatReadout(metric, readouts[metric])}</dd>
          </div>
        ))}
      </dl>
      {/* Report 2.11: each printed readout says what it is, from the arithmetic that produces it. */}
      {metricIds.length > 0 && (
        <details className={styles.readoutMeanings} data-readout-meanings>
          <summary>What these readouts mean</summary>
          <dl>
            {metricIds.map((metric) => (
              <div key={metric} data-readout-meaning={metric}>
                <dt>{LAB_METRICS[metric].label}</dt>
                <dd>{LAB_METRIC_MEANINGS[metric]}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
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
