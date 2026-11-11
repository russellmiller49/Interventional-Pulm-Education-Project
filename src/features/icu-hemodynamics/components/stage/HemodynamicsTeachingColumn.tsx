'use client'

import { useId, useEffect, useRef, useState, type ReactNode } from 'react'

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
import {
  hemodynamicsSectionIds,
  type ControlStripState,
  type HemodynamicsSectionId,
} from '../../content/sectionSpecs'
import {
  grammarLocusLabels,
  SIGNAL_GRAMMAR_TREND_RULE,
  signalGrammarRows,
} from '../../content/signalGrammar'
import type { HemodynamicsStageLesson, HemodynamicsStageStep } from '../../content/stageLessons'
import { HEMODYNAMICS_NUMBERS } from '../../content/teachingNumbers'
import { CardiacOutputMethodModel } from '../CardiacOutputMethodModel'
import { FickMethodWorkbench } from '../FickMethodWorkbench'
import {
  HemodynamicsReferenceValues,
  HemodynamicsShockProfiles,
} from '../HemodynamicsReferenceValues'
import { NormalWaveformReference } from '../NormalWaveformReference'
import { NormalWaveformValidityChallenges } from '../NormalWaveformValidityChallenges'
import { DerivedHemodynamicsTeachingPanel } from '../PacMeasurementTeaching'
import { TroubleshootingPanel } from '../TroubleshootingPanel'
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
 * section's deeper reference folded to its heading, and a simulator limit where one matters. The scope decides
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
  /*
   * What the learner has already had is folded under its heading (owner, 2026-11-11).
   *
   * Measured on screen, the seventeen Explain cards held about 26,000 of the module's 36,900
   * task-card words, and close to half of that was blocks printed word for word earlier in the
   * same section: each
   * section has two Explain cards, and the second ("What carried over") printed the first one's
   * pattern table, control list and whole reference again. On the second card each of those blocks
   * is now a closed heading that says where it was shown; the worked explanation of the question
   * stays open. Section 3's first Explain card also reprinted the teaching of the task before it.
   * No sentence is removed: a folded block keeps its content and opens in place.
   */
  const explaining = flow && step.interaction.kind === 'explain'
  const firstExplain = lesson.steps.find((candidate) => candidate.interaction.kind === 'explain')
  const shownOn =
    explaining && firstExplain && firstExplain.id !== step.id
      ? `shown on task ${firstExplain.ordinal}`
      : undefined
  // The flow section's Explain card: its method block and its Fick block reprint reading pages.
  const fickPages = lesson.steps.find((candidate) => candidate.interaction.kind === 'observe')
  const earlierPages =
    explaining && lesson.sectionId === 'thermodilution-series'
      ? {
          method: `from task ${lesson.steps[0].ordinal}`,
          fick: fickPages ? `shown on task ${fickPages.ordinal}` : undefined,
        }
      : undefined
  const teachingShownOn =
    explaining && step.teaching && step.teaching !== 'attempt'
      ? lesson.steps.find(
          (candidate) => candidate.teaching === step.teaching && candidate.ordinal < step.ordinal,
        )
      : undefined
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
      {step.teaching && state && !teachingShownOn && (!flow || step.teaching !== 'attempt') ? (
        <div data-current-teaching={step.teaching}>
          <IntroductoryTeaching topic={step.teaching} state={state} figureBeside={flow} />
        </div>
      ) : null}
      {step.teaching && state && teachingShownOn ? (
        <ReferenceBlock
          heading={INTRO_TEACHING_HEADINGS[step.teaching] ?? 'The teaching for this question'}
          repeat={`from task ${teachingShownOn.ordinal}`}
        >
          <div data-current-teaching={step.teaching}>
            <IntroductoryTeaching topic={step.teaching} state={state} />
          </div>
        </ReferenceBlock>
      ) : null}
      {procedural && (!flow || step.interaction.kind === 'read') ? (
        <DeeperReference lesson={lesson} provenanceResolved={provenanceResolved} prebrief />
      ) : null}
      {flow && procedural && step.interaction.kind !== 'read' ? (
        <p className={styles.dockNote} data-procedural-safety>
          {lesson.sectionId === 'pawp-capture'
            ? `Wedge only from a confirmed PA tracing. Inflate slowly with ${HEMODYNAMICS_NUMBERS.value('balloon-volume')}, stop as soon as it wedges, store an end-expiratory value, deflate, and check that the PA tracing returns.`
            : 'Confirm each settled tracing before moving. For resistance, ectopy or a deteriorating patient, make the first move from the list; the simulator shows none of them.'}
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
                    Map stop {routeStopNumber(stopId)} · {stop.title}
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
          {shownOn ? (
            <p className={styles.dockNote} data-carried-over-note>
              The section&apos;s tables and reference were {shownOn} and are folded here. Open any
              of them to read it again.
            </p>
          ) : null}
          {rows.length > 0 ? (
            <ReferenceBlock heading="Waveform patterns and common causes" repeat={shownOn}>
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
            </ReferenceBlock>
          ) : null}

          <ReferenceBlock heading="Which control, if any" repeat={shownOn}>
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
          </ReferenceBlock>

          {!procedural ? (
            <DeeperReference
              lesson={lesson}
              provenanceResolved={provenanceResolved}
              repeat={shownOn}
              earlierPages={earlierPages}
            />
          ) : null}

          {spec.modelBoundary.trim().length > 0 ? (
            <StageBlock kind="boundary" heading="Simulator limit">
              <section className={styles.teachingCard} data-teaching-block="boundary">
                <p>{spec.modelBoundary}</p>
              </section>
            </StageBlock>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

/** The headings the introductory teaching carries, for where it is folded as already shown. */
const INTRO_TEACHING_HEADINGS: Readonly<Record<string, string>> = {
  'rv-pa': 'Right ventricle versus pulmonary artery',
}

/** "from Section 8": the section where a reference shared between sections is shown open. */
function fromSection(sectionId: HemodynamicsSectionId): string {
  return `from Section ${hemodynamicsSectionIds.indexOf(sectionId) + 1}`
}

/**
 * A block of an Explain card. Where the learner has already had it (`repeat` says where), it is a
 * closed heading that opens in place; otherwise it is the stage block it always was.
 */
function ReferenceBlock({
  heading,
  repeat,
  children,
}: {
  readonly heading: string
  readonly repeat?: string
  readonly children: ReactNode
}) {
  if (repeat)
    return (
      <div data-repeated-block={repeat}>
        <StageBlock
          kind="after-commitment"
          heading={`${heading} · ${repeat}`}
          visibility="collapsed"
        >
          {children}
        </StageBlock>
      </div>
    )
  return (
    <StageBlock kind="after-commitment" heading={heading}>
      {children}
    </StageBlock>
  )
}

function DeeperReference({
  lesson,
  provenanceResolved,
  prebrief = false,
  repeat,
  earlierPages,
}: {
  readonly lesson: HemodynamicsStageLesson
  readonly provenanceResolved: boolean
  readonly prebrief?: boolean
  /** Where the learner has already had this section's reference ("shown on task 5"). */
  readonly repeat?: string
  /**
   * The flow section's reading pages, where its Explain card would reprint them: the first task
   * reads the thermodilution sequence and quality checks, and the Observe task reads the six Fick
   * episodes one page at a time (`flowReadingParts`).
   */
  readonly earlierPages?: { readonly method?: string; readonly fick?: string }
}) {
  switch (lesson.sectionId) {
    case 'pressure-system':
    case 'pac-signal-validation':
      return (
        <>
          {lesson.sectionId === 'pac-signal-validation' ? (
            <ReferenceBlock heading="Shock profiles" repeat={fromSection('derived-hemodynamics')}>
              <section className={styles.teachingCard} data-teaching-block="shock-profiles">
                <p className={styles.kicker}>Once the numbers are valid: which shock is it?</p>
                <HemodynamicsShockProfiles />
              </section>
            </ReferenceBlock>
          ) : null}
          <ReferenceBlock
            heading="The validity sequence, in full"
            repeat={
              lesson.sectionId === 'pac-signal-validation' ? fromSection('pressure-system') : repeat
            }
          >
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
            <SignalTroubleshootingAtlas />
          </ReferenceBlock>
        </>
      )
    case 'waveform-interpretation':
      return (
        <>
          <ReferenceBlock heading="The normal reference, in full" repeat={repeat}>
            <div data-teaching-block="normal-reference">
              <NormalWaveformReference />
            </div>
          </ReferenceBlock>
          <ReferenceBlock heading="When a fault makes the place unnameable" repeat={repeat}>
            <div data-teaching-block="validity-challenges">
              <NormalWaveformValidityChallenges />
            </div>
          </ReferenceBlock>
        </>
      )
    case 'waveform-components':
      return (
        <ReferenceBlock heading="The patterns the waves can make" repeat={repeat}>
          <div data-teaching-block="abnormal-atlas">
            <WaveformAtlasPanel
              onlyCategories={['abnormal']}
              heading="The patterns the waves can make"
            />
          </div>
        </ReferenceBlock>
      )
    case 'catheter-advancement':
      return (
        <StageBlock
          kind="after-commitment"
          heading="When to stop"
          visibility={prebrief ? 'shown' : undefined}
        >
          <section className={styles.teachingCard} data-teaching-block="stop-conditions">
            <p className={styles.kicker}>
              What to expect, and the first move when it goes off plan
            </p>
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
            <HemodynamicsReferenceValues
              title="Floating the catheter, in numbers"
              ids={['balloon-volume', 'flotation-ectopy', 'pa-rupture-mortality']}
            />
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
                    <strong>{step.shortLabel}.</strong> {step.whatYouDo}
                    {step.whatItDoesNotEstablish ? (
                      <>
                        {' '}
                        <small>{step.whatItDoesNotEstablish}</small>
                      </>
                    ) : null}
                  </li>
                ))}
              </ol>
              <HemodynamicsReferenceValues
                title="The balloon, in numbers"
                ids={['balloon-volume', 'overwedge-volume', 'retract-distance']}
              />
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
          <StageBlock
            kind="after-commitment"
            heading="Signal problems, each beside a normal tracing"
            visibility={prebrief ? 'collapsed' : undefined}
          >
            <SignalTroubleshootingAtlas />
          </StageBlock>
        </>
      )
    case 'thermodilution-series':
      return (
        <>
          <ReferenceBlock heading="Thermodilution technique" repeat={repeat}>
            <section className={styles.teachingCard} data-teaching-block="thermodilution-technique">
              <p className={styles.kicker}>Thermodilution technique</p>
              <p>
                Inject fast and smoothly through the proximal port at the same point in the
                respiratory cycle each time, at end expiration. Take at least three. The injectate
                volume and temperature must match the monitor&apos;s computation constant. Injectate
                at room temperature is also used.
              </p>
              <HemodynamicsReferenceValues
                title="Thermodilution, in numbers"
                ids={['injectate-volume', 'thermodilution-spread']}
              />
            </section>
          </ReferenceBlock>
          <ReferenceBlock heading="The three ways to a flow number" repeat={repeat}>
            <div data-teaching-block="method-model">
              <CardiacOutputMethodModel
                provenanceResolved={provenanceResolved}
                shownEarlier={
                  earlierPages?.method
                    ? { methodId: 'thermodilution', where: earlierPages.method }
                    : undefined
                }
              />
            </div>
          </ReferenceBlock>
          <ReferenceBlock heading="Fick, input by input" repeat={repeat}>
            <div data-teaching-block="fick-episodes">
              <FickMethodWorkbench episodesShownEarlier={earlierPages?.fick} />
            </div>
          </ReferenceBlock>
          <ReferenceBlock heading="Vary the technique yourself" repeat={repeat}>
            {/*
              The thermodilution lab with adjustable volume, temperature, respiratory phase and
              injection time lives in the case workspace, on that case's own engine. It used to be
              a link out of the lesson, because a second copy here would be a second patient running
              beside this lesson's (report P-06). The case is now this section's last task: it runs
              inside the section, and this section's patient is paused while it does.
            */}
            <section className={styles.teachingCard} data-teaching-block="thermodilution-lab">
              <p className={styles.kicker}>Vary the technique yourself</p>
              <p>
                The case at the end of this section includes a thermodilution lab where the
                injectate volume, its temperature, the respiratory timing and the length of the
                injection can each be changed and the curve regenerated. In the case, open{' '}
                <strong>Cardiac-output trials</strong>.
              </p>
              <p data-thermodilution-lab-note>The lab is the last task of this section.</p>
            </section>
          </ReferenceBlock>
        </>
      )
    case 'derived-hemodynamics':
      return (
        <>
          <ReferenceBlock heading="Shock profiles" repeat={repeat}>
            <section className={styles.teachingCard} data-teaching-block="shock-profiles">
              <p className={styles.kicker}>Shock profiles: what the numbers add up to</p>
              <HemodynamicsShockProfiles />
            </section>
          </ReferenceBlock>
          <ReferenceBlock heading="Each calculated value, input by input" repeat={repeat}>
            <div data-teaching-block="derived-records">
              <DerivedHemodynamicsTeachingPanel />
            </div>
          </ReferenceBlock>
        </>
      )
    default:
      return null
  }
}

/**
 * The Practice troubleshooting atlas, in Learn.
 *
 * It shows a normal pulmonary-artery tracing beside each signal problem on one scale, with the
 * direction of error for each number — what the pressure-system and wedge sections describe in
 * words — and it was reachable only from inside a collapsed panel of a Practice case (report P-06).
 * This is the same component reading the same generator, with no engine attached: here it is a
 * reference to read, not a control, so it offers no "apply to the live monitor" action and cannot
 * change this lesson's patient.
 */
function SignalTroubleshootingAtlas() {
  // Mounted when first opened: eight generated comparisons are not built for a learner who never
  // opens them. Once opened it stays mounted, so closing and reopening keeps the selected problem.
  const [opened, setOpened] = useState(false)
  return (
    <details
      className={styles.teachingCard}
      data-learn-troubleshooting-atlas
      onToggle={(event) => {
        if (event.currentTarget.open) setOpened(true)
      }}
    >
      <summary>
        Open the signal troubleshooting atlas: each problem beside a normal tracing, on one scale
      </summary>
      {opened ? <TroubleshootingPanel /> : null}
    </details>
  )
}
