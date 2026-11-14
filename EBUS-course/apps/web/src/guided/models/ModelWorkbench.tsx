import { useCallback, useEffect, useReducer, useState } from 'react'
import {
  EMPTY_EBUS_OBSERVATION,
  type EbusObservation,
  type EbusWorkbenchConfig,
} from '../../../../../../src/lib/ebus-guided-bridge'
import {
  MODEL_REVISION,
  MODEL_STEPS,
  PHANTOM_RECOMMENDED_COMPARISON,
  initialModelState,
  modelComplete,
  modelFrameId,
  modelReducer,
  type ModelAction,
  type ModelPackage,
  type ModelState,
} from '../../../../../../src/lib/ebus-model-contract'
import { ModelViewport } from './ModelViewport'
import { ModelImage } from './ModelImage'
import { NeedleHandleView, type NeedleHandlePart } from './NeedleHandleView'
import { NeedleSteps } from './NeedleSteps'
import './models.css'
const titles: Record<ModelPackage, string> = {
  needle: 'One needle pass, by your own hand',
  contact: 'Acoustic-contact cutaway',
  measurement: 'Shape, sweep and measurement',
  routes: 'EBUS and EUS-B route comparison',
}
const stepLabels: Record<string, string> = {
  'gain-gap': 'With “Air gap” selected, raise gain to 75 or more',
  direct: 'Select “Direct contact”, then “Inspect acoustic path”',
  balloon: 'Select “Fluid-balloon contact”, then inspect',
  bubble: 'Select “Balloon with bubble”, then inspect',
  shadow: 'Select “Contact with reflector”, then inspect',
  'ellipsoid-sweep': 'Move “Plane offset” from one end to the other and watch the section change',
  'short-axis-record': 'At the central section: freeze, click the top and bottom borders, then “Record measurement”',
  '4L-airway': 'Record 4L from the airway',
  '4L-esophagus': 'Record 4L from the esophagus',
  '7-airway': 'Record 7 from the airway',
  '7-esophagus': 'Record 7 from the esophagus',
  '8-esophagus': 'Record the lower paraesophageal example from the esophagus',
  unsupported: 'Select a target with no window and record the limitation',
}
function Controls({ state: s, act }: { state: ModelState; act: (a: ModelAction) => void }) {
  const button = (label: string, type: string) => (
    <button onClick={() => act({ type })}>{label}</button>
  )
  // The needle lab has its own list of steps and controls (`NeedleSteps`).
  if (s.package === 'needle') return null
  if (s.package === 'contact')
    return (
      <>
        <label>
          Contact condition{' '}
          <select
            aria-label="Contact condition"
            value={s.mode}
            onChange={(e) => act({ type: 'mode', value: e.target.value })}
          >
            <option value="gap">Air gap</option>
            <option value="direct">Direct contact</option>
            <option value="balloon">Fluid-balloon contact</option>
            <option value="bubble">Balloon with bubble</option>
            <option value="shadow">Contact with reflector</option>
          </select>
        </label>
        <label>
          Gain · illustrative {s.gain}
          <input
            type="range"
            min="0"
            max="100"
            aria-label="Gain · illustrative"
            value={s.gain}
            onChange={(e) => act({ type: 'gain', value: Number(e.target.value) })}
          />
        </label>
        {button('Inspect acoustic path', 'inspect')}
      </>
    )
  if (s.package === 'routes')
    return (
      <>
        <label>
          Target / region{' '}
          <select
            aria-label="Target / region"
            value={s.station}
            onChange={(e) => act({ type: 'station', value: e.target.value })}
          >
            <option value="4L">4L example</option>
            <option value="7">7 example</option>
            <option value="8">Lower paraesophageal example (8)</option>
            <option value="9">9 — not in this model</option>
            <option value="11R">11R — no EUS-B preset</option>
            <option value="4R">4R — no EUS-B preset</option>
          </select>
        </label>
        <label>
          Approach{' '}
          <select
            aria-label="Approach"
            value={s.route}
            onChange={(e) => act({ type: 'route', value: e.target.value })}
          >
            <option value="airway">Airway · EBUS</option>
            <option value="esophagus">Esophagus · EUS-B</option>
          </select>
        </label>
        {button('Record comparison / limitation', 'inspect')}
      </>
    )
  const p = s.calipers[s.endpoint] ?? [0, 22]
  return (
    <>
      <label>
        Shape{' '}
        <select
          aria-label="Shape"
          value={s.shape}
          onChange={(e) => act({ type: 'shape', value: e.target.value })}
        >
          <option value="ellipsoid">Elongated (the one you measure)</option>
          <option value="sphere">Sphere (optional)</option>
          <option value="adjacent">Two adjacent objects (optional)</option>
          <option value="lobulated">Lobulated (optional)</option>
        </select>
      </label>
      <label>
        Plane offset · {s.offset} mm
        <input
          aria-label="Plane offset"
          type="range"
          min="-12"
          max="12"
          step="2"
          value={s.offset}
          disabled={s.frozen}
          onChange={(e) => act({ type: 'offset', value: Number(e.target.value) })}
        />
      </label>
      <div className="model-buttons">
        <button
          disabled={s.frozen || s.offset === PHANTOM_RECOMMENDED_COMPARISON.offset}
          onClick={() => act({ type: 'offset', value: PHANTOM_RECOMMENDED_COMPARISON.offset })}
        >
          Go to the central section
        </button>
        {button(s.frozen ? 'Unfreeze section' : 'Freeze section', 'freeze')}
      </div>
      <p className="model-caption">
        {s.frozen
          ? 'Click the top border of the shape on the image, then the bottom border.'
          : 'Freeze the section to place calipers.'}
      </p>
      <div className="model-buttons">{button('Record measurement', 'record')}</div>
      {s.record && <p className="model-record">Short axis: {s.record.value.toFixed(1)} mm.</p>}
      <details>
        <summary>Place calipers with numbers instead</summary>
        <label>
          Active caliper{' '}
          <select
            aria-label="Active caliper"
            value={s.endpoint}
            onChange={(e) => act({ type: 'endpoint', value: Number(e.target.value) })}
          >
            <option value={0}>Caliper 1</option>
            <option value={1}>Caliper 2</option>
          </select>
        </label>
        <div className="model-calipers">
          <label>
            Horizontal position · mm, 0 at the midline
            <input
              type="number"
              min="-30"
              max="30"
              step=".5"
              value={p[0]}
              disabled={!s.frozen}
              onChange={(e) => {
                act({ type: 'caliper', value: [Number(e.target.value), p[1]] })
                act({ type: 'endpoint', value: s.endpoint })
              }}
            />
          </label>
          <label>
            Vertical position · mm from the top of the field
            <input
              type="number"
              min="0"
              max="46"
              step=".5"
              value={p[1]}
              disabled={!s.frozen}
              onChange={(e) => {
                act({ type: 'caliper', value: [p[0], Number(e.target.value)] })
                act({ type: 'endpoint', value: s.endpoint })
              }}
            />
          </label>
        </div>
      </details>
    </>
  )
}
export function ModelWorkbench({
  config,
  onObservation,
}: {
  config: EbusWorkbenchConfig
  onObservation: (o: EbusObservation) => void
}) {
  const pkg = config.modelPackage!
  const [state, dispatch] = useReducer(modelReducer, pkg, (name) =>
    initialModelState(name, { needleMovements: config.needleMovements }),
  )
  // The handle part whose control has the focus, lit in the handle strip.
  const [handleFocus, setHandleFocus] = useState<NeedleHandlePart | ''>('')
  const [rendered, setRendered] = useState(''),
    [error, setError] = useState('')
  const frameId = modelFrameId(state),
    complete = modelComplete(state)
  const act = useCallback(
    (a: ModelAction) => {
      if (!config.locked && !error) dispatch(a)
    },
    [config.locked, error],
  )
  const onError = useCallback((message: string) => {
    setError(message)
    setRendered('')
  }, [])
  useEffect(() => {
    const ready = !error && rendered === frameId
    onObservation({
      ...EMPTY_EBUS_OBSERVATION,
      ready,
      frameReady: ready,
      actionCount: state.actions,
      lastAction: state.package,
      frozen: config.locked || ('frozen' in state && state.frozen),
      measured: state.package === 'measurement' && !!state.record,
      saved: state.package === 'measurement' && !!state.record,
      model: {
        package: pkg,
        revision: MODEL_REVISION,
        frameId: ready ? frameId : '',
        steps: state.steps,
        complete: ready && complete,
        annotations: config.reveal,
        // The live selection behind the rendered frame, read from the model state rather than
        // from the image (EBUS-PRE-REVIEW-02, carry-forward of L5-1).
        ...(state.package === 'contact' ? { contactMode: state.mode } : {}),
      },
    })
  }, [state, rendered, frameId, error, config.locked, config.reveal, complete, pkg, onObservation])
  return (
    <main
      className="additional-models"
      data-model-package={pkg}
      data-model-frame={rendered === frameId ? frameId : ''}
    >
      <header>
        <p className="model-kicker">
          {config.demonstration
            ? 'Worked example'
            : config.locked
              ? 'Your image'
              : 'Model activity'}
        </p>
        <h1>{titles[pkg]}</h1>
      </header>
      {error ? (
        <div role="alert">
          {error} <button onClick={() => window.location.reload()}>Retry models</button>
        </div>
      ) : state.package === 'needle' ? (
        /*
         * The needle lab on one screen (rebuild of 2026-11-11): the handle across the top, the
         * ultrasound picture and the scope tip under it, and the steps with their controls beside
         * them. The learner's hand, the tip and the image are all in view at once.
         */
        <div className="needle-lab">
          <div className="needle-stage">
            <NeedleHandleView state={state} focus={handleFocus} />
            <ModelImage state={state} reveal={config.reveal} locked={config.locked} dispatch={act} />
            <ModelViewport
              state={state}
              reveal={config.reveal}
              onRendered={setRendered}
              onError={onError}
            />
          </div>
          <section className="model-controls needle-panel">
            <fieldset disabled={config.locked || !rendered}>
              <legend className="sr-only">{titles[pkg]} controls</legend>
              <div className="needle-panel-head">
                {config.locked ? (
                  <h2>Your image</h2>
                ) : (
                  <h2 className="model-steps">
                    Steps: {state.steps.length} of {MODEL_STEPS[pkg].length} done
                  </h2>
                )}
                <button className="needle-reset" onClick={() => act({ type: 'reset' })}>
                  Reset activity
                </button>
              </div>
              {!config.locked && (
                <NeedleSteps
                  state={state}
                  act={act}
                  demonstration={!!config.demonstration}
                  onFocus={setHandleFocus}
                />
              )}
            </fieldset>
            {complete && !config.locked && (
              <p role="status" className="model-feedback">
                All steps done. Select “Continue with this image” in the lesson.
              </p>
            )}
            {config.locked && (
              <p>Controls are locked while you answer. You can still turn the model.</p>
            )}
          </section>
        </div>
      ) : (
        <>
          {/* The views and the controls that drive them share one row at laptop widths and stack
              again when the column is narrow (EBUS-PRE-REVIEW-02, L5-5 / L9-1 / L21-2). They were
              stacked, which put a dozen controls below a workbench taller than the viewport. */}
          <div className="model-workspace">
          <div className="model-views">
          <ModelImage state={state} reveal={config.reveal} locked={config.locked} dispatch={act} />
          <ModelViewport
            state={state}
            reveal={config.reveal}
            onRendered={setRendered}
            onError={onError}
          />
          </div>
          <section className="model-controls">
            <h2>{config.locked ? 'Your image' : 'Controls'}</h2>
            <fieldset disabled={config.locked || !rendered}>
              <legend className="sr-only">{titles[pkg]} controls</legend>
              <Controls state={state} act={act} />
              <button onClick={() => act({ type: 'reset' })}>Reset activity</button>
            </fieldset>
            {state.notice && !config.locked && (
              <p role="status" className="model-feedback">
                {state.notice}
              </p>
            )}
            {!config.locked && (
              <div
                className="model-steps"
                data-model-steps={config.demonstration ? 'demonstration' : 'activity'}
              >
                <strong>
                  Steps: {state.steps.length} of {MODEL_STEPS[pkg].length} done
                </strong>
                <ul>
                  {MODEL_STEPS[pkg].map((step) => (
                    <li key={step} data-done={state.steps.includes(step)}>
                      {state.steps.includes(step) ? '✓' : '○'} {stepLabels[step]}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {complete && !config.locked && (
              <p role="status" className="model-feedback">
                All steps done. Select “Continue with this image” in the lesson.
              </p>
            )}
            {config.locked && (
              <p>
                Controls are locked while you answer. You can still turn the model.
              </p>
            )}
          </section>
          </div>
        </>
      )}
    </main>
  )
}
