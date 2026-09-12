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

/** Held insertion is a sequence of ordinary commands, capped at 24 authored mm/s. */
export function ScopeDock(props: ScopePaneProps & { needsStep: boolean }) {
  const { view, state, controlsEnabled, onCommand, onReset, spotlightKey } = props
  const inputMode = useRef<ScopeInputMode>('pointer')
  const hold = useRef<ReturnType<typeof setInterval> | null>(null)
  const repeat = useRef<() => void>(() => {})
  const stop = () => {
    if (hold.current) clearInterval(hold.current)
    hold.current = null
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
    // The click supplies the initial step. Only a sustained hold starts repetition.
    repeat.current = () =>
      onCommand({ type: 'advance', mm: direction * state.inputs.stepMm }, inputMode.current)
    hold.current = setInterval(
      () => repeat.current(),
      Math.max(160, (state.inputs.stepMm / 24) * 1000),
    )
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
            onPointerDown={(event) => start(event, direction)}
            onPointerUp={stop}
            onPointerCancel={stop}
            onLostPointerCapture={stop}
            onClick={() => send({ type: 'advance', mm: direction * state.inputs.stepMm })}
          >
            {key === 'advance' ? 'Advance' : 'Withdraw'}
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
            <input
              id={id}
              type="range"
              min={rotate ? -179 : -limit}
              max={limit}
              step={1}
              value={value}
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
          </label>
        )
      case 'accessory':
        return (
          <>
            <label htmlFor={id}>
              Accessory
              <select
                id={id}
                aria-label="Accessory"
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
        return null
    }
  }
  const keys = [...view.controls.filter((key) => key !== 'declare')]
  if (props.needsStep && !keys.includes('step')) keys.push('step')
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
