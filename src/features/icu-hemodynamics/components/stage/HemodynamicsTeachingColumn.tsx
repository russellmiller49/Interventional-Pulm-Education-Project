'use client'

import { useId, useEffect, useRef } from 'react'

import { StageBlock } from '@/features/learning-module/stage/StageBlock'
import { useStageTeachingScope } from '@/features/learning-module/stage/StageTeachingScope'

import {
  HEMODYNAMICS_CONTROL_PANEL,
  hemodynamicsControlIds,
  type HemodynamicsControlId,
} from '../../content/controlPanel'
import {
  pacPrebriefExpectedTransitions,
  pacPrebriefStopConditions,
} from '../../content/pacAdvancementPrebrief'
import { pawpCaptureSteps } from '../../content/pawpCaptureSequence'
import { pressureSystemValiditySteps } from '../../content/pressureSystemValidity'
import { routeStop, routeStopNumber, type RouteStopId } from '../../content/routeSpine'
import type { ControlStripState } from '../../content/sectionSpecs'
import {
  grammarLocusLabels,
  SIGNAL_GRAMMAR_TREND_RULE,
  signalGrammarRows,
} from '../../content/signalGrammar'
import type { HemodynamicsStageLesson, HemodynamicsStageStep } from '../../content/stageLessons'
import { CardiacOutputMethodModel } from '../CardiacOutputMethodModel'
import { FickMethodWorkbench } from '../FickMethodWorkbench'
import { NormalWaveformReference } from '../NormalWaveformReference'
import { NormalWaveformValidityChallenges } from '../NormalWaveformValidityChallenges'
import { DerivedHemodynamicsTeachingPanel } from '../PacMeasurementTeaching'
import { WaveformAtlasPanel } from '../WaveformAtlasPanel'
import { WedgeValidityPanel } from '../WedgeValidityPanel'
import type { HemodynamicSimulationState } from '../../engine/types'
import { IntroductoryTeaching } from './IntroductoryTeaching'
import styles from './hemodynamics-stage.module.css'

/**
 * The teaching pane: what a learner reads beside the monitor, foregrounded by the step.
 *
 * Before the commitment: what the section is for, the stop the step stands at (its analogy, its
 * precise statement, its checklist), and the control panel where the section introduces it.
 * After the commitment: the rows of the one table this section fills in, the control strip, the
 * section's deeper reference folded to its heading, and the model boundary. The scope decides
 * which blocks are the focus; the commitment decides what may be said at all.
 */
const STATE_WORDS: Readonly<Record<ControlStripState, string>> = {
  'this-one': 'this one',
  'not-this-one': 'not this one',
  'harmful-reflex': 'the harmful reflex',
  monitoring: 'monitoring only here',
}

export function HemodynamicsTeachingColumn({
  lesson,
  step,
  stops,
  provenanceResolved,
  state,
  flow = false,
}: {
  readonly lesson: HemodynamicsStageLesson
  readonly step: HemodynamicsStageStep
  readonly stops: readonly RouteStopId[]
  readonly provenanceResolved: boolean
  readonly state?: HemodynamicSimulationState
  readonly flow?: boolean
}) {
  const scope = useStageTeachingScope()
  const listIdBase = useId()
  const committed = scope?.predictionCommitted ?? true
  const spec = lesson.spec
  const focusRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Task changes only: no focus stealing or scroll resets on simulator ticks.
    const panel = focusRef.current?.closest('[role="region"][aria-label="Teaching panel"]')
    if (panel instanceof HTMLElement) panel.scrollTop = 0
  }, [step.id])
  const introductory = [
    'why-measure',
    'pressure-system',
    'waveform-interpretation',
    'waveform-components',
  ].includes(lesson.sectionId)
  const procedural =
    lesson.sectionId === 'catheter-advancement' || lesson.sectionId === 'pawp-capture'
  const independentAttempt = step.teaching === 'attempt' || step.surface === 'recognition'
  const rows = signalGrammarRows.filter((row) => spec.grammarRowIds.includes(row.id))
  const stopsToShow = flow
    ? []
    : introductory
      ? step.interaction.kind === 'walk'
        ? stops
        : []
      : stops.length > 0
        ? stops
        : spec.spineStops
  const introducesPanel = !flow && lesson.sectionId === 'pressure-system' && step.ordinal === 1

  return (
    <div ref={focusRef} className={styles.teaching} data-teaching-panel>
      {step.teaching && state && (!flow || step.teaching !== 'attempt') ? (
        <div data-current-teaching={step.teaching}>
          <IntroductoryTeaching topic={step.teaching} state={state} />
        </div>
      ) : null}
      {procedural && (!flow || step.interaction.kind === 'read') ? (
        <DeeperReference lesson={lesson} provenanceResolved={provenanceResolved} prebrief />
      ) : null}
      {flow && procedural && step.interaction.kind !== 'read' ? (
        <p className={styles.dockNote} data-procedural-safety>
          {lesson.sectionId === 'pawp-capture'
            ? 'Acquire only from a confirmed PA tracing. Store an end-expiratory value, deflate, and verify the PA tracing returns. The automatic release is a model safeguard, not a clinical inflation limit.'
            : 'Confirm each settled tracing before moving. Stop for resistance, ectopy or patient deterioration; those events are not modeled here.'}
        </p>
      ) : null}
      {!independentAttempt && (!flow || (step.ordinal === 1 && !step.teaching)) ? (
        <>
          <StageBlock kind="question" heading="What this section is for">
            <section className={styles.teachingCard} data-teaching-block="purpose">
              <p className={styles.kicker}>What this section is for</p>
              <p>{spec.objective}</p>
              <p>
                <strong>One new idea.</strong> {spec.newConcept}
              </p>
              {/*
            The increment sentence, under a label a step can point at. Five Recognize instructions
            said "read the increment", which named a dashed box with no heading; the box says what
            it is now, and the instructions say "what this section adds".
          */}
              <div className={styles.increment}>
                <p className={styles.kicker}>What this section adds</p>
                <p data-increment-sentence>{spec.incrementSentence}</p>
              </div>
            </section>
          </StageBlock>

          {introducesPanel ? (
            <StageBlock kind="signals" heading="Five things you can change">
              <section className={styles.teachingCard} data-teaching-block="control-panel">
                <p className={styles.kicker}>Five things you can change</p>
                <p>{HEMODYNAMICS_CONTROL_PANEL.sentence}</p>
                <ul className={styles.checklist}>
                  {HEMODYNAMICS_CONTROL_PANEL.controls.map((control) => (
                    <li key={control.id}>
                      <strong>{control.plainName}</strong> — moves {control.moves}; does not move{' '}
                      {control.doesNotMove}.
                    </li>
                  ))}
                </ul>
                <p>{HEMODYNAMICS_CONTROL_PANEL.axes.reference}</p>
                <p>{HEMODYNAMICS_CONTROL_PANEL.axes.response}</p>
              </section>
            </StageBlock>
          ) : null}

          <StageBlock kind="pattern" heading="Where you are on the path">
            {stopsToShow.map((stopId) => {
              const stop = routeStop(stopId)
              return (
                <section
                  key={stopId}
                  className={styles.teachingCard}
                  data-teaching-block="stop"
                  data-stop={stopId}
                  aria-label={stop.title}
                >
                  <p className={styles.kicker}>
                    Stop {routeStopNumber(stopId)} · {stop.title}
                  </p>
                  <p className={styles.analogy}>{stop.analogy}</p>
                  <p>{stop.precise}</p>
                  <dl className={styles.stopFacts}>
                    <div>
                      <dt>On the monitor</dt>
                      <dd>{stop.monitorLabel}.</dd>
                    </div>
                    <div>
                      <dt>Later activity</dt>
                      <dd>
                        {stop.wiggle.change} {stop.wiggle.watch} Use the controls when the lesson
                        opens that activity.
                      </dd>
                    </div>
                  </dl>
                  <p className={styles.kicker} id={`${listIdBase}-${stopId}`}>
                    {stop.checklistLabel}
                  </p>
                  <ul className={styles.checklist} aria-labelledby={`${listIdBase}-${stopId}`}>
                    {stop.checklist.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </StageBlock>
        </>
      ) : null}

      {committed && !independentAttempt && (!flow || step.interaction.kind === 'explain') ? (
        <>
          {rows.length > 0 ? (
            <StageBlock kind="after-commitment" heading="Waveform patterns and common causes">
              <section className={styles.teachingCard} data-teaching-block="grammar">
                <p className={styles.kicker}>Waveform patterns and common causes</p>
                <table className={styles.grammarTable}>
                  <thead>
                    <tr>
                      <th scope="col">What you see</th>
                      <th scope="col">Where it lives</th>
                      <th scope="col">The shortlist</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} data-grammar-row={row.id}>
                        <th scope="row">{row.whatYouSee}</th>
                        <td>
                          {grammarLocusLabels[row.locus]}
                          {row.locusDetail ? ` — ${row.locusDetail}` : ''}
                        </td>
                        <td>
                          {row.shortlist.join(' · ')}
                          <br />
                          <small>{row.firstMove}</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className={styles.trendRule}>{SIGNAL_GRAMMAR_TREND_RULE}</p>
              </section>
            </StageBlock>
          ) : null}

          <StageBlock kind="after-commitment" heading="Which control, if any">
            <section className={styles.teachingCard} data-teaching-block="control-strip">
              <p className={styles.kicker}>Which control, if any</p>
              <ul className={styles.controlStrip} data-control-strip={spec.controlStrip.verdict}>
                {hemodynamicsControlIds.map((controlId: HemodynamicsControlId) => {
                  const control = HEMODYNAMICS_CONTROL_PANEL.controls.find(
                    (c) => c.id === controlId,
                  )!
                  const state = spec.controlStrip.states[controlId]
                  return (
                    <li key={controlId} data-control={controlId} data-state={state}>
                      <span>{control.plainName}</span>
                      <strong>{STATE_WORDS[state]}</strong>
                    </li>
                  )
                })}
              </ul>
              <p>{spec.controlStrip.sentence}</p>
            </section>
          </StageBlock>

          {!procedural ? (
            <DeeperReference lesson={lesson} provenanceResolved={provenanceResolved} />
          ) : null}

          <StageBlock kind="boundary" heading="What this simulation leaves out">
            <section className={styles.teachingCard} data-teaching-block="boundary">
              <p className={styles.kicker}>What this simulation leaves out</p>
              <p>{spec.modelBoundary}</p>
            </section>
          </StageBlock>
        </>
      ) : null}
    </div>
  )
}

function DeeperReference({
  lesson,
  provenanceResolved,
  prebrief = false,
}: {
  readonly lesson: HemodynamicsStageLesson
  readonly provenanceResolved: boolean
  readonly prebrief?: boolean
}) {
  switch (lesson.sectionId) {
    case 'pressure-system':
    case 'pac-signal-validation':
      return (
        <StageBlock kind="after-commitment" heading="The validity sequence, in full">
          <section className={styles.teachingCard} data-teaching-block="validity-sequence">
            <p className={styles.kicker}>The validity sequence, in full</p>
            <ol className={styles.sequence}>
              {pressureSystemValiditySteps.map((step) => (
                <li key={step.id}>
                  <strong>{step.shortLabel}.</strong> {step.question}{' '}
                  <small>{step.whatItEstablishes}</small>
                </li>
              ))}
            </ol>
          </section>
        </StageBlock>
      )
    case 'waveform-interpretation':
      return (
        <>
          <StageBlock kind="after-commitment" heading="The normal reference, in full">
            <div data-teaching-block="normal-reference">
              <NormalWaveformReference />
            </div>
          </StageBlock>
          <StageBlock kind="after-commitment" heading="When a fault makes the place unnameable">
            <div data-teaching-block="validity-challenges">
              <NormalWaveformValidityChallenges />
            </div>
          </StageBlock>
        </>
      )
    case 'waveform-components':
      return (
        <StageBlock kind="after-commitment" heading="The patterns the waves can make">
          <div data-teaching-block="abnormal-atlas">
            <WaveformAtlasPanel
              onlyCategories={['abnormal']}
              heading="The patterns the waves can make"
            />
          </div>
        </StageBlock>
      )
    case 'catheter-advancement':
      return (
        <StageBlock
          kind="after-commitment"
          heading="When to stop"
          visibility={prebrief ? 'shown' : undefined}
        >
          <section className={styles.teachingCard} data-teaching-block="stop-conditions">
            <p className={styles.kicker}>What to expect, and when to stop</p>
            <ul className={styles.checklist}>
              {pacPrebriefExpectedTransitions.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <dl className={styles.stopFacts}>
              {pacPrebriefStopConditions.map((condition) => (
                <div key={condition.id}>
                  <dt>{condition.trigger}</dt>
                  <dd>{condition.response}</dd>
                </div>
              ))}
            </dl>
          </section>
        </StageBlock>
      )
    case 'pawp-capture':
      return (
        <>
          <StageBlock
            kind="after-commitment"
            heading="The wedge sequence, in full"
            visibility={prebrief ? 'shown' : undefined}
          >
            <section className={styles.teachingCard} data-teaching-block="wedge-sequence">
              <p className={styles.kicker}>The wedge sequence, in full</p>
              <ol className={styles.sequence}>
                {pawpCaptureSteps.map((step) => (
                  <li key={step.id}>
                    <strong>{step.shortLabel}.</strong> {step.whatYouDo}{' '}
                    <small>{step.whatItDoesNotEstablish}</small>
                  </li>
                ))}
              </ol>
            </section>
          </StageBlock>
          <StageBlock
            kind="after-commitment"
            heading="Is the wedge real?"
            visibility={prebrief ? 'collapsed' : undefined}
          >
            <div data-teaching-block="wedge-validity">
              <WedgeValidityPanel />
            </div>
          </StageBlock>
        </>
      )
    case 'thermodilution-series':
      return (
        <>
          <StageBlock kind="after-commitment" heading="The three ways to a flow number">
            <div data-teaching-block="method-model">
              <CardiacOutputMethodModel provenanceResolved={provenanceResolved} />
            </div>
          </StageBlock>
          <StageBlock kind="after-commitment" heading="Fick, input by input">
            <div data-teaching-block="fick-episodes">
              <FickMethodWorkbench />
            </div>
          </StageBlock>
        </>
      )
    case 'derived-hemodynamics':
      return (
        <StageBlock kind="after-commitment" heading="The records behind every calculated value">
          <div data-teaching-block="derived-records">
            <DerivedHemodynamicsTeachingPanel />
          </div>
        </StageBlock>
      )
    default:
      return null
  }
}
