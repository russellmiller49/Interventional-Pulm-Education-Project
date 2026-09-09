import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import SuiteScene from '../../src/features/peripheral-imaging/components/suite/SuiteScene'
import { chainCaption } from '../../src/features/peripheral-imaging/content/imagingChain'
import {
  emptyLabState,
  labStateAfterChange,
} from '../../src/features/peripheral-imaging/engine/labGoalEvaluation'
import type { SuiteViewSpec } from '../../src/features/peripheral-imaging/components/suite/types'

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
function Harness() {
  const [lab, setLab] = useState(() => emptyLabState('geometry', 'projection'))
  const [answer, setAnswer] = useState(false),
    [locked, setLocked] = useState(false),
    [selected, setSelected] = useState<string | null>(null)
  const [committed, setCommitted] = useState<string | null>(null)
  const [mode, setMode] = useState<'projection' | 'signal'>('projection')
  const [hideMonitor, setHideMonitor] = useState(false)
  const view = {
    ...projection,
    mode,
    monitor: hideMonitor ? ('hidden' as const) : ('beside' as const),
    chainAnswer: answer,
    litStop: answer ? null : projection.litStop,
  }
  return (
    <main style={{ maxWidth: 1280, margin: '24px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 24, color: '#234855' }}>Imaging suite · contract preview</h1>
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
      </div>
      <SuiteScene
        key={mode}
        view={view}
        lab={lab}
        onLabChange={(patch) =>
          setLab((current) => labStateAfterChange('geometry', current, patch, 'projection'))
        }
        onLabReset={() => setLab(emptyLabState('geometry', 'projection'))}
        controlsEnabled={!locked && !answer}
        lockedReason="Choose your prediction before changing the model."
        pausedReason="Reviewing the earlier state."
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
                legend: 'Choose a stop on the imaging chain',
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
      </SuiteScene>
    </main>
  )
}
createRoot(document.getElementById('root')!).render(<Harness />)
