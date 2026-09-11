'use client'

import { projectOptical } from '@/lib/bronchoscopy-core/frame'
import { scopeOpticalFrame } from '@/lib/airway-anatomy/transport-frames'

import { airwayDisplayName } from '../../content/airwayTree'
import {
  declarationAllowed,
  expectedLedgerAirways,
  inspectionRecords,
  ledgerStatus,
} from '../../engine/scope/inspectionLedger'
import { MODEL_DEFLECTION_LIMIT_DEG } from '../../engine/scope/scopeInputs'
import {
  ACCESSORY_POSITION_WORDS,
  ACCESSORY_STATE_WORDS,
  describeScopePerformance,
  scopeReadouts,
} from '../../engine/scope/scopeMetrics'
import { OPTICAL_ASPECT, OPTICAL_FOV_DEG } from '../../engine/scope/scopeOstia'
import { LocationCaptionStrip } from './LocationCaptionStrip'
import styles from './scope-fallback.module.css'
import { TreeAnswerFieldset } from './TreeAnswerFieldset'
import { TreeMap } from './TreeMap'
import {
  DECLARABLE_STATUSES,
  SCOPE_CONTROL_KEYS,
  SCOPE_DOM,
  scopeControlId,
  type AccessoryPosition,
  type AccessoryState,
  type DeclarableStatus,
  type InspectionStatus,
  type OstiumPin,
  type ScopeCommand,
  type ScopeControlKey,
  type ScopePaneProps,
  type ScopeState,
} from './types'

/**
 * The DOM-only scope pane: what the stage shows until Codex's scene for a mode lands, and what
 * the flow tests mount through `ScopeTestDouble`.
 *
 * Everything in the contract is honoured here, in native HTML: the caption strip and the tree
 * answer, the round optical field tinted by the view signal with the openings ahead pinned by
 * the same projection the scene uses, the airway map, one native control per key the step
 * offers, the readouts, the inspection record with its declarations, the honest performance line,
 * the goals and the model boundary. Every learner action leaves as a command through
 * `onCommand`; nothing here computes a position or a label (the host's reducer does).
 */

const PLACE_WORDS: Readonly<Record<Exclude<ScopeState['place'], 'airway'>, string>> = {
  bench: 'The tip is on the bench, outside the model',
  larynx: 'In the model larynx',
  tube: 'Inside the tube',
}

const INSPECTION_STATUS_WORDS: Readonly<Record<InspectionStatus, string>> = {
  'not-observed': 'Not observed',
  identified: 'Identified',
  'ostium-visualized': 'Opening in view',
  entered: 'Entered',
  inspected: 'Inspected',
  'not-safely-accessible': 'Not safely accessible',
}

const DECLARATION_WORDS: Readonly<Record<DeclarableStatus, string>> = {
  identified: 'Identified',
  inspected: 'Inspected',
  'not-safely-accessible': 'Not safely accessible',
  'not-observed': 'Not observed',
}

const DECLARED_WITHOUT_VIEW = 'declared inspected without a view beyond its opening'

/** Printed wherever the record shows (A07/A30). */
export const LEDGER_CAVEAT =
  'Entering an airway is not inspecting it; only a declaration records an inspection.'

const ACCESSORY_STATES = Object.keys(ACCESSORY_STATE_WORDS) as readonly AccessoryState[]
const ACCESSORY_POSITIONS = Object.keys(ACCESSORY_POSITION_WORDS) as readonly AccessoryPosition[]

const UNLABELED_OPENING = 'an opening ahead'

interface FieldPin {
  readonly pin: OstiumPin
  readonly left: string
  readonly top: string
}

/** The openings in the round field, placed by the scene's own projection of the optical frame. */
function fieldPins(state: ScopeState): readonly FieldPin[] {
  if (!state.pose) return []
  const frame = scopeOpticalFrame(state.pose)
  return state.ostia.flatMap((pin) => {
    if (!pin.inView) return []
    const projected = projectOptical(pin.pointLps, frame, OPTICAL_ASPECT, OPTICAL_FOV_DEG)
    if (!projected) return []
    return [
      {
        pin,
        left: `${((projected.x + 1) / 2) * 100}%`,
        top: `${((1 - projected.y) / 2) * 100}%`,
      },
    ]
  })
}

/**
 * What is seen, never why: the cause of a red or dark field is the answer some sections ask for,
 * so the field's name describes the picture and leaves the mechanism to the learner.
 */
const VIEW_SEEN_WORDS: Readonly<Record<ScopeState['signals']['view'], string>> = {
  clear: 'a clear view of the airway',
  'red-out': 'a red field',
  contaminated: 'a smeared view',
  dark: 'a dark field',
}

function opticalFieldName(state: ScopeState, pins: readonly FieldPin[]): string {
  const view = `The view through the scope: ${VIEW_SEEN_WORDS[state.signals.view]}`
  if (pins.length === 0) return view
  const openings = state.inputs.branchLabels
    ? `Openings ahead: ${pins.map(({ pin }) => pin.fullLabel).join(', ')}`
    : pins.length === 1
      ? 'One opening ahead'
      : `${pins.length} openings ahead`
  return `${view}. ${openings}`
}

export function ScopeFallback(props: ScopePaneProps) {
  const {
    view,
    state,
    onCommand,
    onReset,
    controlsEnabled,
    lockedReason,
    pausedReason,
    goals,
    spotlightKey,
  } = props
  const send = (command: ScopeCommand) => onCommand(command, 'pointer')

  const pins = fieldPins(state)
  const alignOffered = view.assists['align-to-branch'] === true && controlsEnabled
  const interactiveField = alignOffered && pins.length > 0

  const dockKeys = SCOPE_CONTROL_KEYS.filter(
    (key) => key !== 'declare' && view.controls.includes(key),
  )
  const declareOffered = view.controls.includes('declare')
  const readouts = scopeReadouts(view, state)
  const records = expectedLedgerAirways(view).length > 0 ? inspectionRecords(state.ledger) : []
  const lastMode = state.inputModes[state.inputModes.length - 1]

  const spotlight = (key: ScopeControlKey) => (spotlightKey === key ? 'true' : undefined)

  const renderControl = (key: ScopeControlKey) => {
    const id = scopeControlId(key)
    switch (key) {
      case 'advance':
        return (
          <button
            id={id}
            type="button"
            onClick={() => send({ type: 'advance', mm: state.inputs.stepMm })}
          >
            Advance
          </button>
        )
      case 'withdraw':
        return (
          <button
            id={id}
            type="button"
            onClick={() => send({ type: 'advance', mm: -state.inputs.stepMm })}
          >
            Withdraw
          </button>
        )
      case 'rotate':
        return (
          <label htmlFor={id}>
            Rotation
            <input
              id={id}
              type="range"
              min={-180}
              max={180}
              step={1}
              value={state.inputs.rotationDeg}
              onChange={(event) => send({ type: 'set-rotation', deg: Number(event.target.value) })}
            />
          </label>
        )
      case 'deflect':
        return (
          <label htmlFor={id}>
            Deflection
            <input
              id={id}
              type="range"
              min={-MODEL_DEFLECTION_LIMIT_DEG}
              max={MODEL_DEFLECTION_LIMIT_DEG}
              step={1}
              value={state.inputs.deflectionDeg}
              onChange={(event) =>
                send({ type: 'set-deflection', deg: Number(event.target.value) })
              }
            />
          </label>
        )
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
      case 'accessory': {
        const moveId = scopeControlId('accessory-move')
        return (
          <>
            <label htmlFor={id}>
              Accessory
              <select
                id={id}
                value={state.inputs.accessory}
                onChange={(event) =>
                  send({ type: 'accessory', state: event.target.value as AccessoryState })
                }
              >
                {ACCESSORY_STATES.map((accessory) => (
                  <option key={accessory} value={accessory}>
                    {ACCESSORY_STATE_WORDS[accessory]}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor={moveId}>
              Accessory position
              <select
                id={moveId}
                value={state.inputs.accessoryPosition}
                onChange={(event) =>
                  send({ type: 'accessory-move', to: event.target.value as AccessoryPosition })
                }
              >
                {ACCESSORY_POSITIONS.map((position) => (
                  <option key={position} value={position}>
                    {ACCESSORY_POSITION_WORDS[position]}
                  </option>
                ))}
              </select>
            </label>
          </>
        )
      }
      case 'capture':
        return (
          <button id={id} type="button" onClick={() => send({ type: 'capture' })}>
            Capture an image
          </button>
        )
      case 'acknowledge':
        return (
          <button id={id} type="button" onClick={() => send({ type: 'acknowledge' })}>
            Acknowledge
          </button>
        )
      case 'recenter':
        return (
          <button
            id={id}
            type="button"
            onClick={() => send({ type: 'assist', assist: 'recenter' })}
          >
            Recenter
          </button>
        )
      case 'reset':
        return (
          <button id={id} type="button" onClick={() => onReset()}>
            Reset the scope
          </button>
        )
      case 'teleportStart':
        return (
          <button
            id={id}
            type="button"
            onClick={() => send({ type: 'assist', assist: 'teleport-to-start' })}
          >
            Back to the start
          </button>
        )
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
        return (
          <button id={id} type="button" onClick={() => send({ type: 'clear-lens' })}>
            Clear the lens
          </button>
        )
      case 'verifyAccessory':
        return (
          <button id={id} type="button" onClick={() => send({ type: 'verify-accessory' })}>
            Check the accessory against the image
          </button>
        )
      case 'step':
        return (
          <button id={id} type="button" onClick={() => send({ type: 'tick', seconds: 1 })}>
            Step one second
          </button>
        )
      case 'declare':
        return null
    }
  }

  return (
    <div
      className={styles.pane}
      {...{
        [SCOPE_DOM.scene]: '',
        [SCOPE_DOM.mode]: view.mode,
        [SCOPE_DOM.state]: 'fallback',
        [SCOPE_DOM.profile]: view.profile,
      }}
    >
      <LocationCaptionStrip caption={props.caption} current={state.location.spineStop} />
      {props.treeAnswer ? <TreeAnswerFieldset answer={props.treeAnswer} /> : null}
      {!controlsEnabled && (lockedReason ?? pausedReason) ? (
        <p className={styles.reason} role="status">
          {lockedReason ?? pausedReason}
        </p>
      ) : null}

      <div className={styles.optical}>
        <div
          className={styles.field}
          role={interactiveField ? 'group' : 'img'}
          aria-label={opticalFieldName(state, pins)}
          {...{ [SCOPE_DOM.viewSignal]: state.signals.view }}
        >
          <div className={styles.lumen} />
          {pins.map(({ pin, left, top }) => {
            const shared = {
              className: styles.ostium,
              style: { left, top },
              'data-ostium-pin': pin.label,
              'aria-label': state.inputs.branchLabels ? pin.fullLabel : UNLABELED_OPENING,
            }
            const text = state.inputs.branchLabels ? pin.label : null
            return alignOffered ? (
              <button
                key={pin.label}
                type="button"
                onClick={() =>
                  send({ type: 'assist', assist: 'align-to-branch', label: pin.label })
                }
                {...shared}
              >
                {text}
              </button>
            ) : (
              <span key={pin.label} {...shared}>
                {text}
              </span>
            )
          })}
        </div>
        {state.place !== 'airway' ? (
          <p className={styles.place} data-scope-place={state.place}>
            {PLACE_WORDS[state.place]}
          </p>
        ) : null}
        {state.message ? (
          <p className={styles.message} role="status" data-scope-message>
            {state.message}
          </p>
        ) : null}
      </div>

      <TreeMap
        map={props.map}
        lit={view.litAirways ?? []}
        current={state.location.label}
        tipLps={state.pose?.tipLps ?? null}
        treeAnswer={props.treeAnswer}
      />

      {dockKeys.length > 0 ? (
        <fieldset
          className={styles.controls}
          disabled={!controlsEnabled}
          data-scope-controls
          aria-label="The scope controls under the view"
        >
          {dockKeys.map((key) => (
            <div
              key={key}
              className={styles.control}
              data-control={key}
              data-spotlight={spotlight(key)}
            >
              {renderControl(key)}
            </div>
          ))}
        </fieldset>
      ) : null}

      {readouts.length > 0 ? (
        <dl
          className={styles.readouts}
          aria-label="The readouts under the controls"
          {...{ [SCOPE_DOM.readouts]: '' }}
        >
          {readouts.map((readout) => (
            <div key={readout.id} {...{ [SCOPE_DOM.readout]: readout.id }}>
              <dt>{readout.label}</dt>
              <dd>{readout.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {records.length > 0 ? (
        <div
          className={styles.ledger}
          id={declareOffered ? scopeControlId('declare') : undefined}
          data-spotlight={spotlight('declare')}
        >
          <table aria-label="The inspection record" {...{ [SCOPE_DOM.ledger]: '' }}>
            <thead>
              <tr>
                <th scope="col">Airway</th>
                <th scope="col">Status</th>
                {declareOffered ? <th scope="col">Declare</th> : null}
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const status = ledgerStatus(record)
                return (
                  <tr
                    key={record.label}
                    {...{ [SCOPE_DOM.ledgerRow]: record.label, [SCOPE_DOM.ledgerStatus]: status }}
                  >
                    <th scope="row">{airwayDisplayName(record.label)}</th>
                    <td>
                      {INSPECTION_STATUS_WORDS[status]}
                      {record.inspected === 'declared-without-view'
                        ? ` · ${DECLARED_WITHOUT_VIEW}`
                        : ''}
                    </td>
                    {declareOffered ? (
                      <td>
                        <select
                          id={scopeControlId(`declare-${record.label}`)}
                          aria-label={`Declare ${record.label}`}
                          value=""
                          disabled={!controlsEnabled}
                          onChange={(event) => {
                            const declared = event.target.value as DeclarableStatus | ''
                            if (declared)
                              send({ type: 'declare', airway: record.label, status: declared })
                          }}
                        >
                          <option value="">Declare…</option>
                          {DECLARABLE_STATUSES.map((declared) => (
                            <option
                              key={declared}
                              value={declared}
                              disabled={!declarationAllowed(record, declared)}
                            >
                              {DECLARATION_WORDS[declared]}
                            </option>
                          ))}
                        </select>
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className={styles.caveat}>{LEDGER_CAVEAT}</p>
        </div>
      ) : null}

      <p
        className={styles.performance}
        {...{
          [SCOPE_DOM.inputMode]: lastMode ?? '',
          [SCOPE_DOM.assists]: state.assistsUsed.join(','),
        }}
      >
        {describeScopePerformance(state)}
      </p>

      {goals.length > 0 ? (
        <ul className={styles.goals} aria-label="What this step is waiting for" data-scope-goals>
          {goals.map(({ goal, met }) => (
            <li key={goal.id} data-met={met ? 'true' : 'false'}>
              {goal.label}
            </li>
          ))}
        </ul>
      ) : null}

      <p className={styles.boundary} {...{ [SCOPE_DOM.boundary]: '' }}>
        <strong>Model boundary.</strong> {view.boundary}
      </p>
      {props.children}
    </div>
  )
}
