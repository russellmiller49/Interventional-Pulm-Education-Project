import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ImagingSuitePane } from '../../src/features/peripheral-imaging/components/suite/ImagingSuitePane'
import { SUITE_VIEWS } from '../../src/features/peripheral-imaging/content/suiteViews'
import type { ImagingSectionId } from '../../src/features/peripheral-imaging/content/pathway'
import { chainCaption } from '../../src/features/peripheral-imaging/content/imagingChain'
import { ROOM_FIXTURE } from './room-fixture'
import {
  emptyLabState,
  labStateAfterChange,
} from '../../src/features/peripheral-imaging/engine/labGoalEvaluation'
import type {
  SuiteCamera,
  SuiteViewSpec,
} from '../../src/features/peripheral-imaging/components/suite/types'

const projection: SuiteViewSpec = {
  sectionId: 'projection',
  mode: 'projection',
  litStop: 'beam',
  stopSentence: 'You are at the beam.',
  camera: 'suite',
  layers: [
    'Airways',
    'Lungs',
    'Ribs and spine',
    'table',
    'gantry',
    'cone',
    'ray',
    'monitor',
    'labels',
  ],
  variant: 'generic',
  monitor: 'beside',
  bindings: [
    { input: 'orbit', control: 'orbit' },
    { input: 'tilt', control: 'tilt' },
    { input: 'toolDepth', control: 'depth' },
  ],
  defaults: {},
  lab: 'geometry',
  controls: ['orbit', 'tilt', 'depth', 'resetGeometry'],
  readouts: ['separationMm', 'depthMm'],
  boundary:
    'Authored cone geometry (720/1200 mm, 640 mm field) shared with the DRR and readouts; the CT supplies anatomy, the target and tool are authored. The ray colouring is a relative attenuation proxy from quantised CT, not exposure or dose.',
}
const params = new URLSearchParams(location.search)
const section = params.get('section') as ImagingSectionId | null
const authored = params.get('mode') === 'room' ? ROOM_FIXTURE : section && SUITE_VIEWS[section]
const baseView = authored || projection
const labId = baseView.lab ?? 'geometry'
function Harness() {
  const [lab, setLab] = useState(() => emptyLabState(labId, baseView.sectionId))
  const [answer, setAnswer] = useState(false),
    [locked, setLocked] = useState(false),
    [selected, setSelected] = useState<string | null>(null)
  const [committed, setCommitted] = useState<string | null>(null)
  const [mode, setMode] = useState<'projection' | 'signal'>('projection')
  const [hideMonitor, setHideMonitor] = useState(false)
  const [camera, setCamera] = useState<SuiteCamera>('suite')
  const [spotlight, setSpotlight] = useState(false)
  const [paused, setPaused] = useState(false)
  const [hiddenRoomLayers, setHiddenRoomLayers] = useState<readonly string[]>([])
  const view = {
    ...baseView,
    layers:
      baseView.mode === 'room'
        ? baseView.layers.filter((layer) => !hiddenRoomLayers.includes(layer))
        : baseView.layers,
    mode: authored ? baseView.mode : mode,
    camera: authored ? baseView.camera : camera,
    monitor: hideMonitor ? ('hidden' as const) : baseView.monitor,
    chainAnswer: answer,
    litStop: answer ? null : baseView.litStop,
  }
  return (
    <main style={{ maxWidth: 1280, margin: '24px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 24, color: '#e3edef' }}>Imaging suite · contract preview</h1>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <button onClick={() => setAnswer(!answer)}>Toggle chain answer</button>
        <button onClick={() => setLocked(!locked)}>Toggle control lock</button>
        <button onClick={() => setCommitted(selected)} disabled={!answer || !selected}>
          Commit preview answer
        </button>
        <button onClick={() => setHideMonitor(!hideMonitor)}>Toggle monitor</button>
        <button onClick={() => setMode(mode === 'projection' ? 'signal' : 'projection')}>
          Toggle signal mode
        </button>
        <button onClick={() => setCamera(camera === 'suite' ? 'beam' : 'suite')}>
          Change supplied camera
        </button>
        <button onClick={() => setSpotlight(!spotlight)}>Spotlight tool depth</button>
        <button onClick={() => setPaused(!paused)}>Toggle review pause</button>
        {baseView.mode === 'room' &&
          ['Thoracic envelope', 'Lungs', 'Ribs and spine', 'cone'].map((layer) => (
            <label key={layer}>
              <input
                type="checkbox"
                checked={!hiddenRoomLayers.includes(layer)}
                onChange={() =>
                  setHiddenRoomLayers((current) =>
                    current.includes(layer)
                      ? current.filter((item) => item !== layer)
                      : [...current, layer],
                  )
                }
              />{' '}
              Show {layer}
            </label>
          ))}
      </div>
      <ImagingSuitePane
        key={mode}
        view={view}
        lab={lab}
        onLabChange={(patch) =>
          setLab((current) => labStateAfterChange(labId, current, patch, baseView.sectionId))
        }
        onLabReset={() => setLab(emptyLabState(labId, baseView.sectionId))}
        controlsEnabled={!locked && !answer && !paused}
        lockedReason={paused ? undefined : 'Choose your prediction before changing the model.'}
        pausedReason="Reviewing the earlier state."
        spotlightKey={spotlight ? 'depth' : undefined}
        goals={[
          {
            goal: { type: 'event', id: 'separation-seen', label: 'Inspect another projection' },
            met: lab.events.includes('separation-seen'),
          },
        ]}
        chainCaption={chainCaption(view.litStop)}
        chainAnswer={
          answer
            ? {
                name: 'preview',
                legend: 'Choose a component on the image-formation map',
                choices: [
                  { id: 'beam', stop: 'beam', label: 'The beam' },
                  { id: 'detector', stop: 'detector', label: 'The detector' },
                  { id: 'patient', stop: 'patient', label: 'The patient' },
                  { id: 'unknown', stop: null, label: 'Cannot locate it from this image' },
                ],
                selectedChoiceId: selected,
                committedChoiceId: committed,
                correctChoiceIds: ['detector'],
                onSelect: setSelected,
                disabled: committed !== null,
              }
            : undefined
        }
      >
        <p data-harness-child style={{ fontSize: 12 }}>
          Preview content passed through the pane.
        </p>
      </ImagingSuitePane>
    </main>
  )
}
createRoot(document.getElementById('root')!).render(<Harness />)
