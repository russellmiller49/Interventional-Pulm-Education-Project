'use client'

import type { Dispatch, ReactNode } from 'react'
import { ArrowRight, Check, ShieldAlert } from 'lucide-react'

import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'
import { ChoiceReasoningFeedback } from '@/features/learning-module/components/ChoiceReasoningFeedback'

import {
  MCS_LEARN_PHASES,
  mcsLearnControls,
  type McsLearnControl,
  type McsLearnControlId,
  type McsLearnPhase,
  type McsLessonTransferDefinition,
  type McsObservedSignal,
  type McsSectionLearningContract,
} from '../content'
import type { McsAction, McsDerivedMetrics, McsSimulationState } from '../engine'
import { McsControls } from './McsControls'
import styles from './mechanical-circulatory-support.module.css'

const phaseTitles: Readonly<Record<McsLearnPhase, string>> = {
  recognize: 'Recognize',
  predict: 'Predict',
  act: 'Act',
  observe: 'Observe',
  explain: 'Explain',
  transfer: 'Transfer',
}

const continueLabels: Readonly<Record<McsLearnPhase, string>> = {
  recognize: 'Continue to the prediction',
  predict: 'Continue to the task',
  act: 'Continue to what changed',
  observe: 'Continue to the explanation',
  explain: 'Continue to the transfer patient',
  transfer: 'Continue',
}

const controlByActionId: ReadonlyMap<string, McsLearnControl> = new Map(
  Object.values(mcsLearnControls).map((control) => [control.actionId, control]),
)

/** The simulator action a guided-action button dispatches. Only these ids have buttons. */
function guidedAction(actionId: string): McsAction | null {
  if (actionId === 'inspect:arterial') return { type: 'INSPECT', id: 'arterial' }
  if (actionId === 'inspect:preload') return { type: 'INSPECT', id: 'preload' }
  if (actionId === 'inspect:device') return { type: 'INSPECT', id: 'device' }
  if (actionId === 'team:escalate') return { type: 'ESCALATE' }
  if (actionId === 'device:select:iabp') return { type: 'SELECT_DEVICE', device: 'iabp' }
  if (actionId === 'device:select:impella') return { type: 'SELECT_DEVICE', device: 'impella' }
  if (actionId === 'device:select:lvad') return { type: 'SELECT_DEVICE', device: 'lvad' }
  return null
}

function readSignal(metrics: McsDerivedMetrics, signal: McsObservedSignal): string {
  const value = metrics[signal.key]
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  if (value === null) return 'not reported on this pathway'
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'not available'
  return `${value.toFixed(signal.digits)} ${signal.unit}`.trim()
}

function BeforeAfterTable({
  contract,
  before,
  after,
}: {
  contract: McsSectionLearningContract
  before: McsDerivedMetrics | null
  after: McsDerivedMetrics
}) {
  return (
    <table className={styles.beforeAfterTable} data-before-after>
      <caption className="sr-only">
        Readings before and after the requested action, for {contract.lessonTitle}
      </caption>
      <thead>
        <tr>
          <th scope="col">Reading</th>
          <th scope="col">Before</th>
          <th scope="col">After</th>
        </tr>
      </thead>
      <tbody>
        {contract.observedSignals.map((signal) => (
          <tr key={String(signal.key)} data-signal={String(signal.key)} data-level={signal.level}>
            <th scope="row">
              {signal.label}
              <small>{signal.level.replace('-', ' ')}</small>
            </th>
            <td>{before ? readSignal(before, signal) : 'not captured'}</td>
            <td>{readSignal(after, signal)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * Pane three: the phase the learner is in, the one instruction it carries, and the control it means.
 *
 * Everything the learner is asked to *do* is here, in the order the phases run. The rules that
 * matter: committing an answer never advances anything — a separate control does — and the section
 * is recorded only after the whole sequence has been worked through, with no manual completion
 * control anywhere in it.
 */
export function McsLearnActionPane({
  contract,
  state,
  dispatch,
  transfer,
  phase,
  onAdvance,
  actionSatisfied,
  beforeMetrics,
  recognizeChoiceId,
  onRecognizeChoice,
  recognizeCommitted,
  onRecognizeCommit,
  predictionChoiceId,
  onPredictionChoice,
  predictionCommitted,
  onPredictionCommit,
  transferChoiceId,
  onTransferChoice,
  transferCommitted,
  onTransferCommit,
  sectionComplete,
  helpVisible,
  onHelp,
  conceptIds,
  sectionNav,
  afterCompletion,
}: {
  contract: McsSectionLearningContract
  state: McsSimulationState
  dispatch: Dispatch<McsAction>
  transfer: McsLessonTransferDefinition
  phase: McsLearnPhase
  onAdvance: () => void
  actionSatisfied: boolean
  beforeMetrics: McsDerivedMetrics | null
  recognizeChoiceId: string | null
  onRecognizeChoice: (id: string) => void
  recognizeCommitted: boolean
  onRecognizeCommit: () => void
  predictionChoiceId: string | null
  onPredictionChoice: (id: string) => void
  predictionCommitted: boolean
  onPredictionCommit: () => void
  transferChoiceId: string | null
  onTransferChoice: (id: string) => void
  transferCommitted: boolean
  onTransferCommit: () => void
  sectionComplete: boolean
  helpVisible: boolean
  onHelp: () => void
  conceptIds?: readonly string[]
  sectionNav: ReactNode
  afterCompletion: ReactNode
}) {
  const phaseIndex = MCS_LEARN_PHASES.indexOf(phase)
  const targetControl = contract.targetControl
    ? mcsLearnControls[contract.targetControl]
    : undefined
  const guidedControls = contract.allowedActions
    .map((id) => mcsLearnControls[id])
    .filter((control) => control.location === 'guided-actions')
  const settingControls = contract.allowedActions
    .map((id) => mcsLearnControls[id])
    .filter((control) => control.location !== 'guided-actions')
  const recognizeChoice = contract.recognizeOptions.find(
    (option) => option.id === recognizeChoiceId,
  )
  const transferChoice = transfer.item.choices.find((choice) => choice.id === transferChoiceId)
  const transferActionsMet = transfer.requiredActionIds.every((id) => state.actionIds.includes(id))
  // Required transfer actions with no guided button of their own have to be worked in the controls,
  // so the control they mean is the one to highlight there.
  const transferControlActionIds = transfer.requiredActionIds.filter(
    (actionId) => !guidedAction(actionId),
  )
  const transferHighlightControl = transferControlActionIds
    .map((actionId) => controlByActionId.get(actionId)?.id)
    .find((id): id is McsLearnControlId => Boolean(id))
  const helpCopy: Readonly<Record<McsLearnPhase, string>> = {
    recognize: contract.teaching.whatTheTargetRepresents,
    predict: contract.predictionReasoning,
    act: targetControl
      ? `${targetControl.label} — ${targetControl.changes} ${targetControl.doesNotGuarantee}`
      : (contract.noActionExplanation ?? contract.observationFocus),
    observe: contract.observationFocus,
    explain: contract.reassessmentPrompt,
    transfer: transfer.item.explanation,
  }

  return (
    <section className={styles.learnActionPane} aria-labelledby="mcs-learn-action-heading">
      <header className={styles.learnPaneHeader}>
        <span className={styles.kicker}>
          YOUR TURN · {contract.lessonSequenceLabel.toUpperCase()}
        </span>
        <h2 id="mcs-learn-action-heading">
          {phaseTitles[phase]} — step {phaseIndex + 1} of {MCS_LEARN_PHASES.length}
        </h2>
      </header>

      <ol className={styles.learnPhaseRail} aria-label="Where you are in this section">
        {MCS_LEARN_PHASES.map((candidate, index) => (
          <li
            key={candidate}
            data-current={candidate === phase || undefined}
            data-worked-through={index < phaseIndex || undefined}
            aria-current={candidate === phase ? 'step' : undefined}
          >
            <span aria-hidden="true">{index + 1}</span>
            <small>{phaseTitles[candidate]}</small>
            <span className="sr-only">
              {index < phaseIndex
                ? ' worked through'
                : candidate === phase
                  ? ' current step'
                  : ' not yet reached'}
            </span>
          </li>
        ))}
      </ol>

      <div
        className={styles.learnInstruction}
        data-learn-instruction
        role="group"
        aria-live="polite"
      >
        <strong>
          {phase === 'recognize'
            ? contract.recognizePrompt
            : phase === 'predict'
              ? contract.predictionPrompt
              : phase === 'act'
                ? contract.actionInstruction
                : phase === 'observe'
                  ? contract.observationFocus
                  : phase === 'explain'
                    ? contract.reassessmentPrompt
                    : contract.transferPrompt}
        </strong>
      </div>

      {phase === 'recognize' ? (
        <div className={styles.learnResponse}>
          <fieldset disabled={recognizeCommitted}>
            <legend className="sr-only">{contract.recognizePrompt}</legend>
            {contract.recognizeOptions.map((option) => (
              <label key={option.id}>
                <input
                  type="radio"
                  name={`recognize-${contract.sectionId}`}
                  value={option.id}
                  checked={recognizeChoiceId === option.id}
                  onChange={() => onRecognizeChoice(option.id)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </fieldset>
          {recognizeCommitted ? null : (
            <button type="button" disabled={!recognizeChoiceId} onClick={onRecognizeCommit}>
              Record what you identified
            </button>
          )}
          {recognizeCommitted && recognizeChoice ? (
            <div
              className={styles.learnFeedback}
              role="status"
              data-recognize-feedback
              data-right={recognizeChoice.correct ? 'true' : 'false'}
            >
              <strong>{recognizeChoice.correct ? 'That is it' : 'Not this one'}</strong>
              <p>{recognizeChoice.feedback}</p>
              {recognizeChoice.correct ? null : (
                <p>
                  <strong>What the pathway shows: </strong>
                  {contract.recognizeOptions.find((option) => option.correct)?.feedback}
                </p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {phase === 'predict' ? (
        <div className={styles.learnResponse}>
          <fieldset disabled={predictionCommitted}>
            <legend>{contract.predictionItem.stem}</legend>
            {contract.predictionItem.choices.map((choice) => (
              <label key={choice.id}>
                <input
                  type="radio"
                  name={`predict-${contract.sectionId}`}
                  value={choice.id}
                  checked={predictionChoiceId === choice.id}
                  onChange={() => onPredictionChoice(choice.id)}
                />
                <span>{choice.label}</span>
              </label>
            ))}
          </fieldset>
          {predictionCommitted ? null : (
            <button type="button" disabled={!predictionChoiceId} onClick={onPredictionCommit}>
              Commit this answer
            </button>
          )}
          {predictionCommitted && predictionChoiceId ? (
            <>
              <AnswerVerdict
                item={contract.predictionItem}
                choiceId={predictionChoiceId}
                timing="immediate-after-commit"
                theme="light"
                onContinue={onAdvance}
                continueLabel={continueLabels.predict}
              />
              <p className={styles.learnAside}>{contract.predictionReasoning}</p>
            </>
          ) : null}
        </div>
      ) : null}

      {phase === 'act' ? (
        <div className={styles.learnResponse}>
          {contract.actionMode === 'inspect-only' ? (
            <p className={styles.learnNoAction} data-inspect-only>
              <strong>No adjustment is expected in this section.</strong>{' '}
              {contract.noActionExplanation}
            </p>
          ) : targetControl ? (
            <p className={styles.learnAside} data-target-control={targetControl.id}>
              <strong>Use this control: {targetControl.label}</strong> — it changes{' '}
              {targetControl.changes.charAt(0).toLowerCase() + targetControl.changes.slice(1)}{' '}
              {targetControl.doesNotGuarantee}
            </p>
          ) : null}

          {guidedControls.length > 0 ? (
            <div className={styles.guidedActionButtons}>
              {guidedControls.map((control) => {
                const action = guidedAction(control.actionId)
                const done = state.actionIds.includes(control.actionId)
                if (!action) return null
                return (
                  <button
                    type="button"
                    key={control.id}
                    data-mcs-control={control.id}
                    data-mcs-control-highlighted={
                      contract.targetControl === control.id ? 'true' : undefined
                    }
                    data-worked-through={done || undefined}
                    disabled={done}
                    onClick={() => dispatch(action)}
                  >
                    {done ? <Check aria-hidden="true" /> : null}
                    {control.label}
                  </button>
                )
              })}
            </div>
          ) : null}

          {settingControls.length > 0 ? (
            <details open className={styles.learnControlsHost}>
              <summary>The control this step means, with the rest of the workspace</summary>
              <McsControls
                state={state}
                dispatch={dispatch}
                highlightControl={contract.targetControl}
              />
            </details>
          ) : null}

          <p className={styles.learnResponseStatus} role="status" aria-live="polite">
            {state.responseMessage}
          </p>
        </div>
      ) : null}

      {phase === 'observe' ? (
        <div className={styles.learnResponse}>
          <BeforeAfterTable contract={contract} before={beforeMetrics} after={state.metrics} />
          {contract.unmodeledNote ? (
            <p className={styles.learnAside} data-unmodeled-note>
              <strong>What this model does not represent:</strong> {contract.unmodeledNote}
            </p>
          ) : null}
          <div className={styles.learnFeedback} role="status">
            <strong>What the simulation reports</strong>
            <p>{state.causalExplanation}</p>
          </div>
          {state.alarms.some((alarm) => alarm.active) ? (
            <div className={styles.learnAlarmList} role="status">
              <ShieldAlert aria-hidden="true" />
              <ul>
                {state.alarms
                  .filter((alarm) => alarm.active)
                  .map((alarm) => (
                    <li key={alarm.id}>
                      <strong>{alarm.label}</strong> — {alarm.explanation}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {phase === 'explain' ? (
        <div className={styles.learnResponse}>
          <p>{contract.explanation}</p>
          <dl className={styles.learnExplainList}>
            <div>
              <dt>This establishes</dt>
              <dd>{contract.whatThisEstablishes}</dd>
            </div>
            <div data-emphasis="true">
              <dt>This does not establish</dt>
              <dd>{contract.whatThisDoesNotEstablish}</dd>
            </div>
            <div>
              <dt>Read wrongly as</dt>
              <dd>{contract.commonMisinterpretation}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {phase === 'transfer' ? (
        <div className={styles.learnResponse} data-transfer>
          <p className={styles.learnAside}>
            <strong>What changed: </strong>
            {contract.transferContext}
          </p>
          <div className={styles.transferContext}>
            {transfer.contextItems.map((entry) => (
              <span key={entry.label}>
                <small>{entry.label}</small>
                <strong>{entry.value}</strong>
              </span>
            ))}
          </div>
          <fieldset disabled={transferCommitted}>
            <legend>{transfer.item.stem}</legend>
            {transfer.item.choices.map((choice) => (
              <label key={choice.id}>
                <input
                  type="radio"
                  name={`transfer-${contract.sectionId}`}
                  value={choice.id}
                  checked={transferChoiceId === choice.id}
                  onChange={() => onTransferChoice(choice.id)}
                />
                <span>{choice.label}</span>
              </label>
            ))}
          </fieldset>
          <div className={styles.transferAction}>
            <strong>Then work it in the transfer patient</strong>
            <p>{transfer.requiredActionLabel}</p>
            <div className={styles.guidedActionButtons}>
              {transfer.requiredActionIds.map((actionId) => {
                const action = guidedAction(actionId)
                const control = controlByActionId.get(actionId)
                if (!action || !control) return null
                const done = state.actionIds.includes(actionId)
                return (
                  <button
                    type="button"
                    key={actionId}
                    data-mcs-control={control.id}
                    data-worked-through={done || undefined}
                    disabled={done}
                    onClick={() => dispatch(action)}
                  >
                    {done ? <Check aria-hidden="true" /> : null}
                    {control.label}
                  </button>
                )
              })}
            </div>
            {transferControlActionIds.length > 0 ? (
              <details open className={styles.learnControlsHost}>
                <summary>The workspace controls this transfer needs</summary>
                <McsControls
                  state={state}
                  dispatch={dispatch}
                  highlightControl={transferHighlightControl}
                />
              </details>
            ) : null}
          </div>
          {transferCommitted ? null : (
            <button
              type="button"
              disabled={!transferChoiceId || !transferActionsMet}
              onClick={onTransferCommit}
            >
              Commit this transfer answer
            </button>
          )}
          {transferCommitted && transferChoice ? (
            <ChoiceReasoningFeedback
              choice={transferChoice}
              explanation={transfer.item.explanation}
              evidenceIds={transfer.item.evidenceIds}
              conceptIds={conceptIds}
            />
          ) : null}
          {sectionComplete ? (
            <section className={styles.lessonCompletion} aria-label="Section worked through">
              <div aria-live="polite">
                <Check aria-hidden="true" />
                <span>
                  <strong>Section worked through</strong>
                  <small>
                    Working through this section records participation in an educational module. It
                    does not establish readiness for independent device selection, insertion,
                    operation, or troubleshooting.
                  </small>
                </span>
              </div>
              {afterCompletion}
            </section>
          ) : (
            <p className={styles.learnAside}>{contract.completionCondition}</p>
          )}
        </div>
      ) : null}

      <div className={styles.learnPaneActions}>
        <button type="button" onClick={onHelp} disabled={helpVisible}>
          Help with this step
        </button>
        {phase !== 'predict' && phase !== 'transfer' ? (
          <button
            type="button"
            data-learn-continue
            disabled={
              (phase === 'recognize' && !recognizeCommitted) ||
              (phase === 'act' && !actionSatisfied)
            }
            onClick={onAdvance}
          >
            {continueLabels[phase]} <ArrowRight aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {helpVisible ? (
        <p className={styles.learnHelp} role="status" data-learn-help>
          <strong>Help:</strong> {helpCopy[phase]}
        </p>
      ) : null}

      <nav className={styles.learnSectionNav} aria-label="Move to another section">
        {sectionNav}
      </nav>
    </section>
  )
}
