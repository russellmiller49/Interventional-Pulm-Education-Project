'use client'

import { useId } from 'react'

import { accessoryKind } from '../../engine/scope/scopeAccessory'
import {
  ACCESSORY_CHECK_WORDS,
  ACCESSORY_COMMAND_WORDS,
  ACCESSORY_POSITION_BUTTON_WORDS,
  ACCESSORY_TOOL_WORDS,
  accessoryControlsNote,
} from '../../engine/scope/scopeMetrics'
import styles from './accessory-controls.module.css'
import {
  scopeControlId,
  type AccessoryPosition,
  type ScopeCommand,
  type ScopeControlKey,
  type ScopeState,
} from './types'

const POSITIONS = Object.keys(ACCESSORY_POSITION_BUTTON_WORDS) as readonly AccessoryPosition[]

/**
 * The tool in the working channel, as plain buttons (owner feedback, 2026-11-03).
 *
 * Two drop-downs named "Accessory" and "Accessory position" hid the one thing the brush exchange
 * asks first: loading the brush was "in the working channel" on the second list, and nothing said
 * so. The same commands now sit on buttons that say what they do:
 *
 * - **Where the tool is** is the operator's own hands on the catheter, so the button for where it
 *   is now is shown pressed.
 * - **Tell your assistant** is what the operator says. The assistant opens, closes, exposes or
 *   covers the tool and replies; the reply can be wrong (the misreport the section teaches), so
 *   these buttons hold no pressed state and claim nothing about the tool.
 * - **Check it on the scope view** is the operator's own look, the only thing that settles it.
 *
 * The assistant's latest reply, or the engine's refusal, is printed under the buttons that caused
 * it. Every button sends the command the drop-downs sent, so the goals and the record are unchanged.
 */
export function AccessoryControls({
  state,
  send,
  offerCheck,
  spotlightKey,
}: {
  readonly state: ScopeState
  readonly send: (command: ScopeCommand) => void
  /** The step offers the check (`verifyAccessory`); it is drawn with the tool it checks. */
  readonly offerCheck: boolean
  readonly spotlightKey?: ScopeControlKey
}) {
  const id = useId()
  const kind = accessoryKind(state.inputs.accessory)
  const tool = kind ? ACCESSORY_TOOL_WORDS[kind] : null
  return (
    <div
      id={scopeControlId('accessory')}
      className={styles.accessory}
      role="group"
      aria-label={tool ? `The ${tool.name}` : 'The tool'}
      tabIndex={-1}
      data-accessory-controls
      data-accessory-state={state.inputs.accessory}
      data-accessory-position={state.inputs.accessoryPosition}
    >
      <div
        id={scopeControlId('accessory-move')}
        className={styles.group}
        role="group"
        aria-labelledby={`${id}-where`}
        tabIndex={-1}
      >
        <span id={`${id}-where`} className={styles.groupLabel}>
          {tool ? tool.where : 'Where the tool is'}
        </span>
        <span className={styles.buttons}>
          {POSITIONS.map((position) => (
            <button
              key={position}
              id={scopeControlId(`accessory-move-${position}`)}
              type="button"
              aria-pressed={state.inputs.accessoryPosition === position}
              data-accessory-move={position}
              onClick={() => send({ type: 'accessory-move', to: position })}
            >
              {ACCESSORY_POSITION_BUTTON_WORDS[position]}
            </button>
          ))}
        </span>
      </div>
      {kind ? (
        <div className={styles.group} role="group" aria-labelledby={`${id}-say`}>
          <span id={`${id}-say`} className={styles.groupLabel}>
            Tell your assistant
          </span>
          <span className={styles.buttons}>
            {ACCESSORY_COMMAND_WORDS[kind].map(({ state: target, words }) => (
              <button
                key={target}
                id={scopeControlId(`accessory-say-${target}`)}
                type="button"
                aria-describedby={`${id}-note`}
                data-accessory-command={target}
                onClick={() => send({ type: 'accessory', state: target })}
              >
                {words}
              </button>
            ))}
          </span>
        </div>
      ) : null}
      <div className={styles.check}>
        {offerCheck ? (
          <span
            className={styles.checkButton}
            data-control="verifyAccessory"
            data-spotlight={spotlightKey === 'verifyAccessory' ? 'true' : undefined}
          >
            <button
              id={scopeControlId('verifyAccessory')}
              type="button"
              onClick={() => send({ type: 'verify-accessory' })}
            >
              {ACCESSORY_CHECK_WORDS}
            </button>
          </span>
        ) : null}
        <p id={`${id}-note`} className={styles.note}>
          {accessoryControlsNote(kind)}
        </p>
      </div>
      {/* Always in the page, so a reply is announced when it arrives; empty until there is one. */}
      <p
        className={styles.reply}
        role="status"
        data-scope-message={state.message ? '' : undefined}
        data-accessory-reply
      >
        {state.message}
      </p>
    </div>
  )
}
