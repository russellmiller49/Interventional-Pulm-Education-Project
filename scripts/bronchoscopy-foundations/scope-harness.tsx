import { ScopePilot } from '../../src/features/bronchoscopy-foundations/test-support/scopePilot'
import { section as surveySection } from '../../src/features/bronchoscopy-foundations/content/sections/systematic-survey'
import { NextIntlClientProvider } from 'next-intl'
import { createRoot } from 'react-dom/client'
import { useCallback, useEffect, useState } from 'react'
import { ScopePane } from '../../src/features/bronchoscopy-foundations/components/scope/ScopePane'
import {
  SCOPE_MODES,
  type ScopeMode,
  type ScopeCommand,
  type ScopeInputMode,
  type ScopeViewSpec,
} from '../../src/features/bronchoscopy-foundations/components/scope/types'
import { loadStageScopeCase } from '../../src/features/bronchoscopy-foundations/components/stage/scopeCaseLoader'
import {
  createScopeState,
  reduceScope,
} from '../../src/features/bronchoscopy-foundations/engine/scope/scopeReducer'
import { scopeLocationCaption } from '../../src/features/bronchoscopy-foundations/engine/scope/scopeCaption'
import type { ScopeCase } from '../../src/features/bronchoscopy-foundations/engine/scope/scopeCase'
import type { ScopeRuntimeState } from '../../src/features/bronchoscopy-foundations/engine/scope/scopeRuntime'

const profile = 'adult-teaching-combined-left-basal-v1'
function viewFor(mode: ScopeMode): ScopeViewSpec {
  return {
    sectionId: 'scene-review',
    mode,
    profile,
    start:
      mode === 'controls-isolated'
        ? { kind: 'bench' }
        : mode === 'larynx-entry'
          ? { kind: 'larynx' }
          : mode === 'tube'
            ? { kind: 'tube' }
            : { kind: 'airway', label: 'TR', at: 'distal' },
    controls:
      mode === 'idle'
        ? []
        : [
            'advance',
            'withdraw',
            'rotate',
            'deflect',
            'suction',
            'branchLabels',
            'recenter',
            'reset',
            'step',
            'clearLens',
            'accessory',
            'capture',
            'acknowledge',
            'verifyAccessory',
            'declare',
          ],
    assists:
      mode === 'guided-walk'
        ? {
            'centerline-lock': true,
            'aim-guard': true,
            'branch-labels': true,
            'align-to-branch': true,
          }
        : {},
    defaults:
      mode === 'tube'
        ? { tube: { kind: 'ett', idMm: 8 }, scopeOdMm: 6 }
        : mode === 'accessory'
          ? { accessory: 'forceps-closed', accessoryPosition: 'at-tip' }
          : {},
    script: mode === 'larynx-entry' ? 'breathing-cords' : undefined,
    readouts: [
      'currentAirway',
      'depthMm',
      'rotationDeg',
      'deflectionDeg',
      'annularAreaFraction',
      'annularAreaMm2',
      'cordsState',
      'accessoryState',
    ],
    ledger: { expected: ['RMSB', 'LMSB'] },
    litAirways: ['TR', 'RMSB', 'LMSB'],
    boundary:
      'Authored teaching geometry. These images and dimensions are not patient measurements or device specifications.',
  }
}

declare global {
  interface Window {
    scopeHarness: {
      command: (command: ScopeCommand, mode?: ScopeInputMode) => void
      state: ScopeRuntimeState
      view: ScopeViewSpec
      scopeCase: ScopeCase
      setView: (view: ScopeViewSpec) => void
      runTask: (task: 'rul' | 'survey') => void
    }
  }
}
function Harness({ scopeCase }: { scopeCase: ScopeCase }) {
  const [view, setView] = useState(viewFor('guided-walk'))
  const [state, setState] = useState(() => createScopeState(view, scopeCase))
  const [enabled, setEnabled] = useState(true)
  const command = useCallback(
    (command: ScopeCommand, mode: ScopeInputMode = 'pointer') => {
      setState((previous) => reduceScope(previous, command, mode, { view, scopeCase }))
    },
    [view, scopeCase],
  )
  const change = useCallback(
    (next: ScopeViewSpec) => {
      setView(next)
      setState(createScopeState(next, scopeCase))
    },
    [scopeCase],
  )
  useEffect(() => {
    const runTask = (task: 'rul' | 'survey') => {
      if (surveySection.act.kind !== 'scope-lab') throw new Error('Survey is not a scope lab')
      const nextView =
        task === 'survey'
          ? surveySection.act.view
          : {
              ...viewFor('guided-walk'),
              start: { kind: 'airway', label: 'RMSB', at: 'distal' } as const,
            }
      let current = createScopeState(nextView, scopeCase)
      const pilot = new ScopePilot({
        view: nextView,
        scopeCase,
        get state() {
          return current
        },
        send(cmd) {
          current = reduceScope(current, cmd, 'keyboard', { view: nextView, scopeCase })
        },
      })
      if (task === 'rul') pilot.goInto('RUL')
      else {
        for (const label of ['RLL', 'RB6', 'RB7', 'RB8', 'RB9'] as const) {
          pilot.goInto(label)
          if (pilot.state.signals.view === 'contaminated') pilot.send({ type: 'clear-lens' })
          pilot.goDeep(label)
          pilot.send({ type: 'declare', airway: label, status: 'inspected' })
          if (label !== 'RLL') pilot.withdrawTo('RLL')
        }
        pilot.lookAt('RB10')
        pilot.send({ type: 'declare', airway: 'RB10', status: 'not-safely-accessible' })
        pilot.withdrawToEdge(scopeCase.originEdge.get('RLL')!)
        pilot.goInto('RB6')
      }
      setView(nextView)
      setState(current)
    }
    window.scopeHarness = { state, command, view, scopeCase, setView: change, runTask }
  }, [state, command, view, scopeCase, change])
  return (
    <main style={{ maxWidth: 940, margin: '20px auto', padding: 16 }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <label>
          Scene mode{' '}
          <select
            aria-label="Scene mode"
            value={view.mode}
            onChange={(event) => change(viewFor(event.target.value as ScopeMode))}
          >
            {SCOPE_MODES.map((mode) => (
              <option key={mode}>{mode}</option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          Controls enabled
        </label>
      </div>
      <ScopePane
        view={view}
        state={state}
        map={scopeCase.map}
        onCommand={command}
        onReset={() => setState(createScopeState(view, scopeCase))}
        controlsEnabled={enabled}
        lockedReason="Controls are paused."
        goals={[]}
        caption={scopeLocationCaption(state)}
      />
      <output data-harness-events>{state.events.join(',')}</output>
    </main>
  )
}
loadStageScopeCase(profile).then((scopeCase) =>
  createRoot(document.getElementById('root')!).render(
    <NextIntlClientProvider locale="en" messages={{}} onError={() => {}}>
      <Harness scopeCase={scopeCase} />
    </NextIntlClientProvider>,
  ),
)
