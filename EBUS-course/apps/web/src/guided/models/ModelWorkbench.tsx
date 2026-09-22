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
import './models.css'
const titles: Record<ModelPackage, string> = {
  needle: 'Needle assembly and tip visibility',
  contact: 'Acoustic-contact cutaway',
  measurement: 'Shape, sweep and measurement',
  routes: 'EBUS and EUS-B route comparison',
}
const stepLabels: Record<string, string> = {
  sheath: 'Sheath adjusted',
  'live-tip': 'Tip displayed live',
  'lost-tip-stop': 'Stopped after lost tip',
  'resistance-stop': 'Stopped for resistance',
  'protected-removal': 'Protected removal',
  'gain-gap': 'Gain compared with air gap',
  direct: 'Direct contact inspected',
  balloon: 'Balloon contact inspected',
  bubble: 'Bubble window inspected',
  shadow: 'Reflector shadow inspected',
  'sphere-sweep': 'Sphere swept',
  'ellipsoid-sweep': 'Elongated shape swept',
  'adjacent-sweep': 'Adjacent shapes swept',
  'lobulated-sweep': 'Lobulated shape swept',
  'short-axis-record': 'Short-axis image recorded',
  '4L-airway': '4L airway view',
  '4L-esophagus': '4L esophageal view',
  '7-airway': '7 airway view',
  '7-esophagus': '7 esophageal view',
  '8-esophagus': 'Lower esophageal example',
  unsupported: 'Unsupported window acknowledged',
}
function Controls({ state: s, act }: { state: ModelState; act: (a: ModelAction) => void }) {
  const button = (label: string, type: string) => (
    <button onClick={() => act({ type })}>{label}</button>
  )
  if (s.package === 'needle')
    return (
      <>
        <label>
          Sheath position{' '}
          <select
            aria-label="Sheath position"
            value={s.sheath}
            onChange={(e) => act({ type: 'sheath', value: Number(e.target.value) })}
          >
            <option value={0}>Initial</option>
            <option value={1}>Adjusted</option>
            <option value={2}>Further adjusted</option>
          </select>
        </label>
        {button(s.secured ? 'Release sheath lock' : 'Lock sheath', 'secure')}
        {button('Advance needle one increment', 'extend')}
        {button('Retract needle fully', 'retract')}
        {button(s.live ? 'Freeze reference image' : 'Return to live image', 'live')}
        {button(s.contact ? 'Lose acoustic contact' : 'Restore acoustic contact', 'contact')}
        {button('Change imaging plane', 'lost')}
        {button('Introduce resistance', 'resistance')}
        {button('Stop and reassess', 'stop')}
        {button('Restore demonstration window', 'restore')}
        {button('Remove assembly', 'remove')}
        <p>
          Sheath: {s.sheath ? 'adjusted' : 'initial'} · Lock: {s.secured ? 'secured' : 'released'} ·
          Needle: {s.extension ? 'exposed' : 'retracted'} ·{' '}
          {s.removed ? 'assembly removed' : 'assembly in channel'}
        </p>
      </>
    )
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
            <option value="9">9 — not modeled</option>
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
  const download = () => {
    const svg = document.querySelector<SVGSVGElement>('.phantom-section')
    if (!svg || !s.record) return
    const copy = svg.cloneNode(true) as SVGSVGElement
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    copy.setAttribute('width', '720')
    copy.setAttribute('height', '552')
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title')
    title.textContent = `${s.record.label}: ${s.record.value.toFixed(1)} phantom mm. Authored geometric phantom, not a patient image. ${s.record.frameId}`
    copy.prepend(title)
    const url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'ebus-phantom-station-7-short-axis.svg'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
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
          <option value="sphere">Sphere</option>
          <option value="ellipsoid">Elongated</option>
          <option value="adjacent">Two adjacent objects</option>
          <option value="lobulated">Lobulated</option>
        </select>
      </label>
      <button
        onClick={() => {
          act({ type: 'shape', value: PHANTOM_RECOMMENDED_COMPARISON.shape })
          act({ type: 'offset', value: PHANTOM_RECOMMENDED_COMPARISON.offset })
        }}
      >
        Go to the recommended comparison
      </button>
      <p className="model-caption">
        The recorded image this activity asks for is the central plane of the elongated phantom.
        Start there, then sweep the other shapes and planes to see how the section changes; both
        remain available and the activity still records every plane you visit.
      </p>
      <label>
        Plane offset · {s.offset} phantom mm
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
          disabled={s.frozen || s.offset <= -12}
          onClick={() => act({ type: 'offset', value: s.offset - 2 })}
        >
          Previous plane
        </button>
        <button
          disabled={s.frozen || s.offset >= 12}
          onClick={() => act({ type: 'offset', value: s.offset + 2 })}
        >
          Next plane
        </button>
        {button(s.frozen ? 'Unfreeze section' : 'Freeze section', 'freeze')}
      </div>
      <p>Sweep positions visited: {s.bins[s.shape].length} of 13. The object remains fixed.</p>
      <label>
        Measurement axis{' '}
        <select
          aria-label="Measurement axis"
          value={s.axis}
          onChange={(e) => act({ type: 'axis', value: e.target.value })}
        >
          <option value="short">Short axis</option>
          <option value="long">Long axis</option>
        </select>
      </label>
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
          Horizontal position · phantom mm, 0 at the midline
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
          Vertical position · phantom mm from the top of the field
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
      <label>
        Image label{' '}
        <select
          aria-label="Image label"
          value={s.station}
          onChange={(e) => act({ type: 'station', value: e.target.value })}
        >
          <option value="">Choose label</option>
          <option>Phantom station 7</option>
          <option>Unlabeled image</option>
        </select>
      </label>
      <div className="model-buttons">
        {button('Record phantom image', 'record')}
        {button('Not adequately visualized', 'inadequate')}
      </div>
      {s.record && <button onClick={download}>Download phantom image</button>}
      {s.record && (
        <p className="model-record">
          {s.record.label}: {s.record.value.toFixed(1)} phantom mm.
        </p>
      )}
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
  const [state, dispatch] = useReducer(modelReducer, pkg, initialModelState)
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
      frozen:
        config.locked || ('frozen' in state && state.frozen) || ('live' in state && !state.live),
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
            ? 'Worked demonstration · nothing here is recorded'
            : config.locked
              ? 'Retained model observation'
              : 'Guided model activity'}
        </p>
        <h1>{titles[pkg]}</h1>
      </header>
      {error ? (
        <div role="alert">
          {error} <button onClick={() => window.location.reload()}>Retry models</button>
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
            <h2>{config.locked ? 'Retained model observation' : 'Model controls'}</h2>
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
              <details data-model-steps={config.demonstration ? 'demonstration' : 'activity'}>
                {/*
                 * In the demonstration this list is a guide to the worked example, not a record
                 * (EBUS-PRE-REVIEW-04, L5-2): it sat beside "exploration does not complete your
                 * activity" and read as tracking. The host drops demonstration observations; the
                 * label now says so. In the learner's own activity it lists the steps the activity asks for.
                 */}
                <summary>
                  {config.demonstration
                    ? 'Steps in this demonstration · ' +
                      state.steps.length +
                      ' of ' +
                      MODEL_STEPS[pkg].length +
                      ' explored, not recorded'
                    : 'Steps this activity asks for · ' +
                      state.steps.length +
                      ' of ' +
                      MODEL_STEPS[pkg].length}
                </summary>
                <ul>
                  {MODEL_STEPS[pkg].map((step) => (
                    <li key={step}>
                      {state.steps.includes(step) ? '✓' : '○'} {stepLabels[step]}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {complete && !config.locked && (
              <p role="status" className="model-feedback">
                Required model actions recorded. Hold this acquisition in the lesson.
              </p>
            )}
            {config.locked && (
              <p>
                Controls are locked while you interpret the retained observation. Observer orbit
                remains available.
              </p>
            )}
          </section>
          </div>
        </>
      )}
    </main>
  )
}
