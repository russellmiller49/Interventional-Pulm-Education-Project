'use client'

import { useEffect, useRef, type PointerEvent } from 'react'
import { MODEL_DEFLECTION_LIMIT_DEG } from '../../engine/scope/scopeInputs'
import { ACCESSORY_POSITION_WORDS, ACCESSORY_STATE_WORDS } from '../../engine/scope/scopeMetrics'
import {
  scopeControlId,
  type ScopePaneProps,
  type ScopeCommand,
  type ScopeControlKey,
  type ScopeInputMode,
  type AccessoryState,
  type AccessoryPosition,
} from './types'
import styles from './scope-scene.module.css'
import { accessoryKind } from '../../engine/scope/scopeAccessory'
import { HELD_INTERVAL_MS, HELD_STEP_MM, HOLD_DELAY_MS, HOLD_RELEASE_MS } from './scopeKeyMap'
import { NameSegment } from './NameSegment'

/**
 * Choosing a state here is a command to the assistant, not the state itself (SUP-16).
 *
 * The accessory is in the assistant's hands: the operator asks, the assistant answers, and only
 * the image settles what the accessory is actually doing — which is the whole point of the
 * misreport the section teaches. The selects therefore show the state the model is in, and this
 * note says that choosing one asks for a change rather than making it true.
 */
const ACCESSORY_COMMAND_NOTE =
  'Choosing here commands the assistant; the image settles what the accessory is doing.'
const ACCESSORY_COMMAND_NOTE_ID = scopeControlId('accessory-command-note')

/**
 * A press of Advance or Withdraw is one step. Held, it becomes a glide: ordinary advance commands
 * in fine increments at a steady rate (`scopeKeyMap.ts`), and the release adds no step of its own.
 */
export function ScopeDock(props: ScopePaneProps & { needsStep: boolean }) {
  const { view, state, controlsEnabled, onCommand, onReset, spotlightKey } = props
  const inputMode = useRef<ScopeInputMode>('pointer')
  const hold = useRef<ReturnType<typeof setInterval> | null>(null)
  const holdDelay = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)
  // Until when a click belongs to the hold that just ended, and so adds no step of its own.
  const releaseUntil = useRef(0)
  const repeat = useRef<() => void>(() => {})
  const stop = () => {
    if (holdDelay.current) clearTimeout(holdDelay.current)
    holdDelay.current = null
    if (hold.current) clearInterval(hold.current)
    hold.current = null
    if (held.current) {
      // Only the click that follows this release at once: a hold the browser cancelled is
      // followed by none, and must not swallow the learner's next press.
      held.current = false
      releaseUntil.current = performance.now() + HOLD_RELEASE_MS
    }
  }
  useEffect(() => {
    const release = () => stop()
    window.addEventListener('blur', release)
    document.addEventListener('visibilitychange', release)
    return () => {
      release()
      window.removeEventListener('blur', release)
      document.removeEventListener('visibilitychange', release)
    }
  }, [])
  useEffect(() => {
    stop()
  }, [controlsEnabled, view.sectionId, view.mode])
  const send = (command: ScopeCommand) => {
    if (controlsEnabled) onCommand(command, inputMode.current)
  }
  const start = (event: PointerEvent<HTMLButtonElement>, direction: number) => {
    if (!controlsEnabled || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    stop()
    releaseUntil.current = 0
    // A short press is the click's one step. Only a sustained hold starts the glide.
    repeat.current = () =>
      onCommand({ type: 'advance', mm: direction * HELD_STEP_MM }, inputMode.current)
    holdDelay.current = setTimeout(() => {
      held.current = true
      repeat.current()
      hold.current = setInterval(() => repeat.current(), HELD_INTERVAL_MS)
    }, HOLD_DELAY_MS)
  }
  const button = (key: ScopeControlKey, text: string, command: ScopeCommand) => (
    <button id={scopeControlId(key)} type="button" onClick={() => send(command)}>
      {text}
    </button>
  )
  const control = (key: ScopeControlKey) => {
    const id = scopeControlId(key)
    switch (key) {
      case 'advance':
      case 'withdraw': {
        const direction = key === 'advance' ? 1 : -1
        return (
          <button
            id={id}
            type="button"
            aria-label={key === 'advance' ? 'Advance' : 'Withdraw'}
            onPointerDown={(event) => start(event, direction)}
            onPointerUp={stop}
            onPointerCancel={stop}
            onLostPointerCapture={stop}
            onClick={() => {
              // The release of a hold has already travelled; it is not one more step.
              if (performance.now() < releaseUntil.current) {
                releaseUntil.current = 0
                return
              }
              send({ type: 'advance', mm: direction * state.inputs.stepMm })
            }}
          >
            {key === 'advance' ? 'Advance' : 'Withdraw'}
            {view.physicalControlLabels ? (
              <small>{key === 'advance' ? 'Guide the tube forward' : 'Draw the tube back'}</small>
            ) : null}
          </button>
        )
      }
      case 'rotate':
      case 'deflect': {
        const rotate = key === 'rotate'
        const limit = rotate ? 180 : MODEL_DEFLECTION_LIMIT_DEG
        const value = rotate ? state.inputs.rotationDeg : state.inputs.deflectionDeg
        return (
          <label htmlFor={id}>
            {rotate ? 'Rotation' : 'Deflection'} <output>{Math.round(value)}°</output>
            {view.physicalControlLabels ? (
              <small>{rotate ? 'Turn the control section' : 'Move the angulation lever'}</small>
            ) : null}
            <input
              id={id}
              type="range"
              min={rotate ? -179 : -limit}
              max={limit}
              step={1}
              value={value}
              aria-label={rotate ? 'Rotation' : 'Deflection'}
              onChange={(event) =>
                send({
                  type: rotate ? 'set-rotation' : 'set-deflection',
                  deg: Number(event.target.value),
                })
              }
            />
          </label>
        )
      }
      case 'suction':
        return (
          <label htmlFor={id}>
            <input
              id={id}
              type="checkbox"
              checked={state.inputs.suction}
              onChange={(event) => send({ type: 'suction', on: event.target.checked })}
            />
            Suction
            {view.physicalControlLabels ? <small>Apply / release the suction control</small> : null}
          </label>
        )
      case 'accessory':
        return (
          <>
            <p id={ACCESSORY_COMMAND_NOTE_ID} className={styles.commandNote}>
              {ACCESSORY_COMMAND_NOTE}
            </p>
            <label htmlFor={id}>
              Accessory
              <select
                id={id}
                aria-label="Accessory"
                aria-describedby={ACCESSORY_COMMAND_NOTE_ID}
                value={state.inputs.accessory}
                onChange={(event) =>
                  send({ type: 'accessory', state: event.target.value as AccessoryState })
                }
              >
                {Object.entries(ACCESSORY_STATE_WORDS)
                  .filter(
                    ([value]) =>
                      accessoryKind(value as AccessoryState) ===
                      accessoryKind(state.inputs.accessory),
                  )
                  .map(([value, text]) => (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  ))}
              </select>
            </label>
            <label htmlFor={scopeControlId('accessory-move')}>
              Accessory position
              <select
                id={scopeControlId('accessory-move')}
                aria-label="Accessory position"
                aria-describedby={ACCESSORY_COMMAND_NOTE_ID}
                value={state.inputs.accessoryPosition}
                onChange={(event) =>
                  send({ type: 'accessory-move', to: event.target.value as AccessoryPosition })
                }
              >
                {Object.entries(ACCESSORY_POSITION_WORDS).map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </select>
            </label>
          </>
        )
      case 'capture':
        return button(key, 'Capture an image', { type: 'capture' })
      case 'acknowledge':
        return button(key, 'Acknowledge', { type: 'acknowledge' })
      case 'recenter':
        return button(key, 'Recenter', { type: 'assist', assist: 'recenter' })
      case 'reset':
        return (
          <button id={id} type="button" onClick={onReset}>
            Reset the scope
          </button>
        )
      case 'teleportStart':
        return button(key, 'Back to the start', { type: 'assist', assist: 'teleport-to-start' })
      case 'branchLabels':
        return (
          <label htmlFor={id}>
            <input
              id={id}
              type="checkbox"
              checked={state.inputs.branchLabels}
              onChange={(event) => send({ type: 'branch-labels', on: event.target.checked })}
            />
            In-view labels
          </label>
        )
      case 'clearLens':
        return button(key, 'Clear the lens', { type: 'clear-lens' })
      case 'verifyAccessory':
        return button(key, 'Check the accessory against the image', { type: 'verify-accessory' })
      case 'step':
        return button(key, 'Step one second', { type: 'tick', seconds: 1 })
      case 'declare':
        return <NameSegment view={view} state={state} disabled={!controlsEnabled} onName={send} />
    }
  }
  // A naming record asks its question in a row of its own, under the movement controls.
  const keys: ScopeControlKey[] = view.controls.filter((key) => key !== 'declare')
  if (props.needsStep && !keys.includes('step')) keys.push('step')
  if (view.controls.includes('declare') && view.ledger?.naming) keys.push('declare')
  if (!keys.length) return null
  return (
    <fieldset
      data-scope-controls
      disabled={!controlsEnabled}
      className={styles.dock}
      aria-label="The scope controls under the view"
      onPointerDownCapture={(event) => {
        inputMode.current = event.pointerType === 'touch' ? 'touch' : 'pointer'
      }}
      onKeyDownCapture={() => {
        inputMode.current = 'keyboard'
      }}
    >
      {keys.map((key) => (
        <div
          key={key}
          className={styles.control}
          data-control={key}
          data-spotlight={spotlightKey === key ? 'true' : undefined}
        >
          {control(key)}
        </div>
      ))}
    </fieldset>
  )
}
