import { ChainAnswerFieldset } from '../components/suite/ChainAnswerFieldset'
import { ChainCaptionStrip } from '../components/suite/ChainCaptionStrip'
import { controlElementId, SUITE_DOM, type ImagingSuitePaneProps } from '../components/suite/types'
import {
  controlDefault,
  formatReadout,
  LAB_CONTROLS,
  LAB_METRICS,
  labReadouts,
  labValue,
  type LabMetricId,
} from '../engine/labMetrics'

/**
 * A DOM-only simulator pane for the flow tests.
 *
 * Renders one native input per lab control with the contract's element id, the readouts the
 * step names, the chain caption strip and the chain answer fieldset — nothing else — so a test
 * can drive a section the way a learner does without WebGL, `@fluoroview/*` or `next/dynamic`.
 * Mount it with `jest.mock('../components/suite/ImagingSuitePane', () => require('../test-support/SuiteTestDouble').suitePaneDouble)`.
 */
export function SuiteTestDouble(props: ImagingSuitePaneProps) {
  const { view, lab, onLabChange, controlsEnabled, goals } = props
  const lessonId = view.sectionId
  const readouts = view.lab ? labReadouts(view.lab, lab.values, lessonId) : {}
  const metricIds: readonly LabMetricId[] =
    view.readouts ?? (Object.keys(readouts) as LabMetricId[])
  return (
    <div
      {...{
        [SUITE_DOM.scene]: '',
        [SUITE_DOM.mode]: view.mode,
        [SUITE_DOM.state]: 'ready',
        [SUITE_DOM.lit]: view.litStop ?? '',
      }}
    >
      <ChainCaptionStrip lit={view.litStop} caption={props.chainCaption} />
      {props.chainAnswer ? <ChainAnswerFieldset answer={props.chainAnswer} /> : null}
      {!controlsEnabled ? (
        <p role="status">{props.lockedReason ?? props.pausedReason ?? 'Controls unavailable'}</p>
      ) : null}
      {view.lab ? (
        <fieldset disabled={!controlsEnabled} data-suite-controls>
          {LAB_CONTROLS[view.lab]
            .filter((control) => !view.controls || view.controls.includes(control.key))
            .map((control) => {
              const id = controlElementId(control.key)
              const current = labValue(view.lab!, lab.values, control.key, lessonId)
              switch (control.kind) {
                case 'range':
                  return (
                    <label key={control.key} htmlFor={id}>
                      {control.label}
                      <input
                        id={id}
                        type="range"
                        min={control.min}
                        max={control.max}
                        step={control.step}
                        value={
                          typeof current === 'number'
                            ? current
                            : Number(controlDefault(control, lessonId))
                        }
                        onChange={(event) =>
                          onLabChange({ [control.key]: Number(event.target.value) })
                        }
                      />
                    </label>
                  )
                case 'toggle':
                  return (
                    <label key={control.key} htmlFor={id}>
                      <input
                        id={id}
                        type="checkbox"
                        checked={current === true}
                        onChange={(event) => onLabChange({ [control.key]: event.target.checked })}
                      />
                      {control.label}
                    </label>
                  )
                case 'select':
                case 'choice':
                  return (
                    <label key={control.key} htmlFor={id}>
                      {control.label}
                      <select
                        id={id}
                        value={String(current)}
                        onChange={(event) => {
                          const option = control.options?.find(
                            (candidate) => String(candidate.value) === event.target.value,
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
                    </label>
                  )
                case 'action':
                  return (
                    <button
                      key={control.key}
                      id={id}
                      type="button"
                      onClick={() => onLabChange({ [control.key]: true })}
                    >
                      {control.label}
                    </button>
                  )
                default:
                  return null
              }
            })}
        </fieldset>
      ) : null}
      <dl {...{ [SUITE_DOM.readouts]: '' }}>
        {metricIds.map((metric) => (
          <div key={metric} {...{ [SUITE_DOM.readout]: metric }}>
            <dt>{LAB_METRICS[metric].label}</dt>
            <dd>{formatReadout(metric, readouts[metric])}</dd>
          </div>
        ))}
      </dl>
      {goals.length > 0 ? (
        <ul data-suite-goals>
          {goals.map(({ goal, met }) => (
            <li key={goal.label} data-met={met ? 'true' : 'false'}>
              {goal.label}
            </li>
          ))}
        </ul>
      ) : null}
      <p {...{ [SUITE_DOM.boundary]: '' }}>{view.boundary}</p>
      {props.children}
    </div>
  )
}

export const suitePaneDouble = { ImagingSuitePane: SuiteTestDouble }
