'use client'

import dynamic from 'next/dynamic'
import { useCallback, useRef, useState, type KeyboardEvent } from 'react'
import { ScopePaneFrame } from './ScopeFallback'
import { ScopeDock } from './ScopeDock'
import { useScopePlayback } from './useScopePlayback'
import { SCOPE_KEY_MAP, scopeKeyCommand } from './scopeKeyMap'
import { SCOPE_MODES, type ScopeMode, type ScopePaneProps } from './types'
import styles from './scope-scene.module.css'
import { TreeMap } from './TreeMap'

const Scene = dynamic(() => import('./ScopeScene'), {
  ssr: false,
  loading: () => <p role="status">Loading the teaching model…</p>,
})
export const SCOPE_MODES_READY: ReadonlySet<ScopeMode> = new Set(SCOPE_MODES)
export { resolveScopeInputs } from '../../engine/scope/scopeInputs'
export { scopeViewErrors } from '../../engine/scope/scopeViewErrors'

export function ScopeScenePane(props: ScopePaneProps) {
  return <ScenePane key={props.view.mode} {...props} />
}

function ScenePane(props: ScopePaneProps) {
  const root = useRef<HTMLDivElement>(null)
  const playbackRoot = useRef<HTMLDivElement>(null)
  const lastMove = useRef(0)
  const [schematic, setSchematic] = useState(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [visualTab, setVisualTab] = useState<'scope' | 'map'>('scope')
  const ready = schematic || status === 'ready'
  const playback = useScopePlayback(props, playbackRoot, ready, schematic)
  const report = useCallback((next: 'loading' | 'ready' | 'failed') => setStatus(next), [])
  const enabled = props.controlsEnabled && ready
  const keyboard = (event: KeyboardEvent) => {
    if (!enabled || event.altKey || event.metaKey || event.ctrlKey) return
    const target = event.target as HTMLElement
    if (target.closest('input, select, textarea, button, [contenteditable="true"]')) return
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
    const control = SCOPE_KEY_MAP[key]
    if (!control || !props.view.controls.includes(control)) return
    const command = scopeKeyCommand(key, props.state)
    if (!command) return
    event.preventDefault()
    if (
      event.repeat &&
      command.type !== 'advance' &&
      command.type !== 'rotate' &&
      command.type !== 'deflect'
    )
      return
    if (command.type === 'advance') {
      const now = performance.now()
      if (event.repeat && now - lastMove.current < (props.state.inputs.stepMm / 24) * 1000) return
      lastMove.current = now
    }
    props.onCommand(command, 'keyboard')
  }
  return (
    <div
      ref={root}
      className={styles.pane}
      tabIndex={0}
      onKeyDown={keyboard}
      aria-label="Interactive scope workspace"
    >
      {schematic ? (
        <div ref={playbackRoot}>
          <p role="status">Schematic view. Use the airway map and controls to continue.</p>
          <button
            type="button"
            onClick={() => {
              setStatus('loading')
              setSchematic(false)
            }}
          >
            Try the 3D view again
          </button>
          <ScopePaneFrame
            {...props}
            renderState="fallback"
            dock={<ScopeDock {...props} needsStep={playback.needsStep} />}
          />
        </div>
      ) : (
        <ScopePaneFrame
          {...props}
          hideMap
          controlsEnabled={enabled}
          renderState={status === 'failed' ? 'failed' : ready ? 'ready' : 'fallback'}
          opticalView={
            <>
              {props.state.place !== 'bench' ? (
                <div className={styles.visualTabs} role="tablist" aria-label="Scope and airway map">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={visualTab === 'scope'}
                    onClick={() => setVisualTab('scope')}
                  >
                    Scope view
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={visualTab === 'map'}
                    onClick={() => setVisualTab('map')}
                  >
                    Airway map
                  </button>
                </div>
              ) : null}
              <div
                className={styles.visualWorkspace}
                data-bench={props.state.place === 'bench' ? 'true' : undefined}
                data-visual-tab={visualTab}
              >
                <div className={styles.scopeColumn} ref={playbackRoot}>
                  <Scene
                    {...props}
                    controlsEnabled={enabled}
                    visible={playback.visible}
                    onStatus={report}
                  />
                  {status === 'failed' ? (
                    <button
                      type="button"
                      className={styles.fallbackButton}
                      onClick={() => setSchematic(true)}
                    >
                      Use the schematic view
                    </button>
                  ) : null}
                </div>
                {props.state.place !== 'bench' ? (
                  <div className={styles.mapColumn}>
                    <TreeMap
                      map={props.map}
                      lit={props.view.litAirways ?? []}
                      current={props.state.location.label}
                      tipLps={props.state.pose?.tipLps ?? null}
                      treeAnswer={props.treeAnswer}
                    />
                  </div>
                ) : null}
              </div>
            </>
          }
          dock={<ScopeDock {...props} controlsEnabled={enabled} needsStep={playback.needsStep} />}
        />
      )}
      {props.view.controls.length > 0 ? (
        <details className={styles.help}>
          <summary>Keyboard controls</summary>
          <p>
            Focus the scope view. W / S: advance / withdraw; A / D: rotate; up / down arrows:
            deflect; Space: suction. Only the controls shown for this step are active.
          </p>
        </details>
      ) : null}
    </div>
  )
}
