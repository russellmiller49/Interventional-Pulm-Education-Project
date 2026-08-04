'use client'

import { AlertTriangle } from 'lucide-react'

import {
  MCS_COMPLETION_BOUNDARY,
  MCS_FLOW_ADDITIVITY_WARNING,
  mcsCausalLadder,
  mcsCommonModelQuestions,
  mcsFirstUseTerms,
  mcsFlowAccount,
  type McsFlowAccountLineId,
} from '../content/commonModel'
import type { McsSimulationState } from '../engine'
import styles from './mechanical-circulatory-support.module.css'

/**
 * The common cardiovascular model, rendered before any device-specific control.
 *
 * Two halves that answer different questions. The causal ladder says which *question* a signal
 * answers — pressure, flow, oxygen delivery, or organ response — and refuses to let a reading taken
 * at one level be reported as an answer at a higher one. The flow account says which *stream* a
 * flow number describes, and carries the warning that the three lines are not automatically added.
 *
 * Live values are bound in where the simulation has one, so the model is not a static aside beside
 * a moving simulator. Where no live value exists — the organ-response level, and the effective
 * systemic line at the bedside — the panel says so rather than substituting a nearby number, which
 * is the same error the panel exists to prevent.
 */

function formatFlow(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)} L/min` : '—'
}

function liveLevelValues(state: McsSimulationState | null): Record<string, string> {
  if (!state) return {}
  const metrics = state.metrics
  return {
    'mcs.causal.pressure': `MAP ${metrics.mapMmHg} · pulse pressure ${metrics.pulsePressureMmHg} mm Hg · RAP ${metrics.rapMmHg} · PCWP ${metrics.pcwpMmHg} mm Hg`,
    'mcs.causal.flow': `Native ${formatFlow(metrics.nativeFlowLMin)} · displayed device ${formatFlow(metrics.deviceFlowLMin)} · effective systemic ${formatFlow(metrics.effectiveSystemicFlowLMin)}`,
    'mcs.causal.oxygen-delivery': `SvO₂ ${metrics.svo2Percent}% · cardiac power ${metrics.cardiacPowerOutputW.toFixed(2)} W`,
    'mcs.causal.organ-response':
      'Not represented by any single number here. Mentation, urine output, skin perfusion, and lactate answer at this level and this simulation does not model them.',
  }
}

function liveAccountValues(state: McsSimulationState | null): Record<string, string> {
  if (!state) return {}
  const metrics = state.metrics
  const deviceLine =
    state.device.kind === 'iabp'
      ? 'No device flow reported — this mechanism moves no blood along a path of its own'
      : state.device.kind === 'impella'
        ? `Left pump ${formatFlow(metrics.leftDeviceFlowLMin)} · right pump ${formatFlow(metrics.rightDeviceFlowLMin)} (right is a pulmonary delivery, never added to the left)`
        : formatFlow(metrics.deviceFlowLMin)
  return {
    native: formatFlow(metrics.nativeFlowLMin),
    'device-displayed': deviceLine,
    'effective-systemic': `${formatFlow(metrics.effectiveSystemicFlowLMin)}${
      metrics.recirculatingFlowLMin > 0.05
        ? ` · ${formatFlow(metrics.recirculatingFlowLMin)} returns to the chamber it came from and is counted out`
        : ''
    }`,
  }
}

/**
 * The value-type chip has to follow the pathway, not only the authored default.
 *
 * The displayed device line is an estimate wherever a pump reports one — but counterpulsation
 * reports no flow at all, and labelling a number that does not exist as "estimated" is the same
 * category error the panel exists to prevent. Only this line varies; the other two are the same
 * kind of quantity under every topology.
 */
function liveValueTypeFor(
  line: McsFlowAccountLineId,
  defaultValueType: string,
  state: McsSimulationState | null,
): string {
  if (line !== 'device-displayed' || !state) return defaultValueType
  return state.device.kind === 'iabp' ? 'no device flow reported' : defaultValueType
}

export function McsCausalLadder({ state }: { state?: McsSimulationState | null }) {
  const live = liveLevelValues(state ?? null)
  return (
    <section
      className={styles.causalLadder}
      aria-labelledby="mcs-causal-ladder-heading"
      data-mcs-common-model="causal-ladder"
    >
      <div className={styles.commonModelHeading}>
        <span className={styles.kicker}>ONE MODEL, FOUR LEVELS</span>
        <h3 id="mcs-causal-ladder-heading">Pressure, flow, oxygen delivery, organ response</h3>
        <p>
          Nearly every wrong conclusion in mechanical support is a reading taken at one level and
          reported at a higher one. Each level answers only its own question.
        </p>
      </div>
      <ol>
        {mcsCausalLadder.map((level) => (
          <li key={level.id} data-level={level.order}>
            <div className={styles.causalLevelHead}>
              <span aria-hidden="true">{level.order}</span>
              <strong>{level.label}</strong>
            </div>
            <p className={styles.causalLevelQuestion}>{level.question}</p>
            {live[level.id] ? (
              <p className={styles.causalLevelLive}>
                <small>Here, right now</small>
                <span>{live[level.id]}</span>
              </p>
            ) : null}
            <dl>
              <div>
                <dt>Establishes</dt>
                <dd>{level.whatItEstablishes}</dd>
              </div>
              <div data-emphasis="true">
                <dt>Does not establish</dt>
                <dd>{level.whatItCannotEstablish}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function McsFlowAccount({ state }: { state?: McsSimulationState | null }) {
  const live = liveAccountValues(state ?? null)
  return (
    <section
      className={styles.flowAccount}
      aria-labelledby="mcs-flow-account-heading"
      data-mcs-common-model="flow-account"
    >
      <div className={styles.commonModelHeading}>
        <span className={styles.kicker}>THREE LINES, NOT ONE NUMBER</span>
        <h3 id="mcs-flow-account-heading">
          Native contribution, displayed device contribution, effective systemic delivery
        </h3>
      </div>
      <ol>
        {mcsFlowAccount.map((line) => (
          <li key={line.id} data-flow-line={line.id}>
            <div className={styles.flowAccountHead}>
              <strong>{line.label}</strong>
              <span
                className={styles.valueTypeChip}
                data-value-type={liveValueTypeFor(line.id, line.valueType, state ?? null)}
              >
                {liveValueTypeFor(line.id, line.valueType, state ?? null)}
              </span>
            </div>
            {live[line.id] ? <p className={styles.flowAccountLive}>{live[line.id]}</p> : null}
            <p>{line.definition}</p>
            <p className={styles.flowAccountValueType}>{line.valueTypeStatement}</p>
            <p className={styles.flowAccountMisleads}>
              <small>How it misleads</small>
              {line.howItMisleads}
            </p>
          </li>
        ))}
      </ol>
      <aside
        className={styles.additivityWarning}
        role="note"
        aria-label="Displayed flows are not automatically additive"
        data-mcs-common-model="additivity-warning"
      >
        <AlertTriangle aria-hidden="true" />
        <div>
          <strong>{MCS_FLOW_ADDITIVITY_WARNING.headline}</strong>
          <p>{MCS_FLOW_ADDITIVITY_WARNING.statement}</p>
          <ul>
            {MCS_FLOW_ADDITIVITY_WARNING.worked.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </div>
      </aside>
    </section>
  )
}

export function McsModelQuestions() {
  return (
    <section
      className={styles.modelQuestions}
      aria-labelledby="mcs-model-questions-heading"
      data-mcs-common-model="questions"
    >
      <div className={styles.commonModelHeading}>
        <span className={styles.kicker}>BEFORE ANY DEVICE CONTROL</span>
        <h3 id="mcs-model-questions-heading">Seven questions that decide what the device is for</h3>
        <p>
          Naming a device first hides the judgement instead of making it. Work these in order, and
          the product track becomes a detail rather than the subject.
        </p>
      </div>
      <ol>
        {mcsCommonModelQuestions.map((entry) => (
          <li key={entry.id} data-question-order={entry.order}>
            <h4>
              <span aria-hidden="true">{String(entry.order).padStart(2, '0')}</span>
              {entry.question}
            </h4>
            <p>{entry.whyItMatters}</p>
            <ul>
              {entry.answeredBy.map((observation) => (
                <li key={observation}>{observation}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function McsFirstUseTerms() {
  return (
    <section
      className={styles.firstUseTerms}
      aria-labelledby="mcs-first-use-terms-heading"
      data-mcs-common-model="terms"
    >
      <div className={styles.commonModelHeading}>
        <span className={styles.kicker}>WORDS THIS MODULE USES</span>
        <h3 id="mcs-first-use-terms-heading">Defined at first use, with the way each misleads</h3>
      </div>
      <dl>
        {mcsFirstUseTerms.map((term) => (
          <div key={term.id} data-term-id={term.id}>
            <dt>{term.term}</dt>
            <dd>
              <p>{term.definition}</p>
              <p className={styles.termQuestion}>
                <small>Answers</small>
                {term.clinicalQuestion}
              </p>
              <p className={styles.termMisleads}>
                <small>Misleads when</small>
                {term.howItMisleads}
              </p>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function McsCompletionBoundary() {
  return (
    <aside
      className={styles.completionBoundary}
      role="note"
      aria-label="What working through this module does and does not establish"
      data-mcs-common-model="completion-boundary"
    >
      <strong>{MCS_COMPLETION_BOUNDARY.headline}</strong>
      <p>{MCS_COMPLETION_BOUNDARY.statement}</p>
    </aside>
  )
}

/**
 * The whole model in one block.
 *
 * `variant="foundation"` is the in-workbench form shown above the simulator on the two foundation
 * sections; `variant="front-door"` is the overview form shown before the product tracks. They
 * render the same authored content in the same order — the difference is only which surrounding
 * chrome supplies the heading.
 */
export function McsCommonModel({
  state,
  variant = 'foundation',
}: {
  state?: McsSimulationState | null
  variant?: 'foundation' | 'front-door'
}) {
  return (
    <section
      className={styles.commonModel}
      aria-labelledby="mcs-common-model-heading"
      data-mcs-common-model="root"
      data-variant={variant}
    >
      <div className={styles.commonModelIntro}>
        <span className={styles.kicker}>THE COMMON MODEL</span>
        <h2 id="mcs-common-model-heading">One cardiovascular model, before any product track</h2>
        <p>
          Every pathway in this module — a balloon that changes timing, a pump across a valve, an
          implanted pump, an extracorporeal circuit — is read with the same questions, the same four
          levels, and the same three flow lines. Learn it once here and the device tracks become
          variations rather than four separate subjects.
        </p>
      </div>
      <McsModelQuestions />
      <div className={styles.commonModelGrid}>
        <McsCausalLadder state={state} />
        <McsFlowAccount state={state} />
      </div>
      <McsFirstUseTerms />
      <McsCompletionBoundary />
    </section>
  )
}
